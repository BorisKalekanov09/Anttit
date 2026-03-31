"""
Core simulation engine.
Manages world state, tick loop, hybrid rule/Gemini decisions, and metric emission.
"""
import asyncio
import time
import uuid
import random
from dataclasses import dataclass, field
from typing import Callable, Any

import networkx as nx

from simulation.agent import Agent, AgentPersonality
from simulation import topology as topo_module
from ai import gemini


THEME_MODULES = {
    "misinformation": "simulation.themes.misinformation",
    "epidemic": "simulation.themes.epidemic",
    "politics": "simulation.themes.politics",
    "cultural": "simulation.themes.cultural",
}


def _load_theme(theme_key: str):
    import importlib
    mod_path = THEME_MODULES.get(theme_key, "simulation.themes.misinformation")
    return importlib.import_module(mod_path)


@dataclass
class SimulationConfig:
    sim_id: str
    theme: str
    agent_count: int
    topology: str
    tick_rate: float          # target seconds between ticks
    personalities: list[dict]  # list of personality dicts with percentages


@dataclass
class WorldState:
    graph: nx.Graph
    agents: dict[str, Agent]
    tick: int = 0
    events: list[str] = field(default_factory=list)
    metrics_history: list[dict] = field(default_factory=list)


class SimulationEngine:
    def __init__(self, config: SimulationConfig):
        self.config = config
        self.theme = _load_theme(config.theme)
        self._running = False
        self._paused = False
        self._tick_rate = config.tick_rate
        self._subscribers: list[asyncio.Queue] = []
        self.world: WorldState | None = None
        self.positions: dict = {}
        self.edges: list = []
        self._inject_queue: list[dict] = []
        self.analysis: str = ""

    # ── Setup ──────────────────────────────────────────────────────────────

    def build(self):
        """Build the world graph and populate agents."""
        G = topo_module.build_graph(self.config.topology, self.config.agent_count)
        self.positions = topo_module.compute_positions(G, self.config.topology)
        self.edges = [[u, v] for u, v in G.edges()]

        agents: dict[str, Agent] = {}
        personalities = self._distribute_personalities()

        for i in range(self.config.agent_count):
            p_data = personalities[i]
            p = AgentPersonality(
                name=p_data["name"],
                description=p_data.get("description", ""),
                credulity=int(p_data.get("credulity", 50)),
                influence=int(p_data.get("influence", 50)),
                stubbornness=int(p_data.get("stubbornness", 50)),
                activity=int(p_data.get("activity", 50)),
                color=p_data.get("color", "#888888"),
            )
            agent = Agent(
                agent_id=str(i),
                personality=p,
                state=self.theme.INITIAL_STATE,
            )
            agents[str(i)] = agent

        # Seed initial states
        self.theme.seed_states(agents)

        self.world = WorldState(graph=G, agents=agents)

    def _distribute_personalities(self) -> list[dict]:
        """Distribute personality types across the agent population."""
        n = self.config.agent_count
        result = []
        for p in self.config.personalities:
            pct = p.get("suggested_percentage", p.get("percentage", 0)) / 100.0
            count = round(n * pct)
            result.extend([p] * count)
        # Fill any rounding gaps
        while len(result) < n:
            result.append(self.config.personalities[0])
        random.shuffle(result)
        return result[:n]

    # ── Subscribers ────────────────────────────────────────────────────────

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._subscribers:
            self._subscribers.remove(q)

    def _emit(self, message: dict):
        for q in list(self._subscribers):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                pass  # drop if consumer is too slow

    # ── Controls ───────────────────────────────────────────────────────────

    def pause(self):
        self._paused = True

    def resume(self):
        self._paused = False

    def set_tick_rate(self, rate: float):
        self._tick_rate = max(0.05, min(5.0, rate))

    def inject_event(self, event_type: str, payload: dict):
        self._inject_queue.append({"type": event_type, **payload})

    def stop(self):
        self._running = False

    # ── Main loop ──────────────────────────────────────────────────────────

    def get_init_data(self) -> dict:
        return {
            "type": "init",
            "positions": self.positions,
            "edges": self.edges,
            "states": self.theme.VALID_STATES,
            "state_colors": self.theme.STATE_COLORS,
            "personalities": [
                {"name": a.personality.name, "color": a.personality.color}
                for a in self.world.agents.values()
            ] if self.world else [],
            "theme": self.theme.THEME_NAME,
        }

    async def run(self):
        if not self.world:
            self.build()
        self._running = True

        # Emit initial topology info
        self._emit(self.get_init_data())

        while self._running:
            tick_start = time.monotonic()

            if not self._paused:
                await self._tick()

            elapsed = time.monotonic() - tick_start
            sleep_time = max(0.0, self._tick_rate - elapsed)
            await asyncio.sleep(sleep_time)

        # Generate final analysis
        if self.world.metrics_history:
            personality_names = list({
                a.personality.name for a in self.world.agents.values()
            })
            self.analysis = await gemini.generate_analysis(
                self.theme.THEME_NAME,
                personality_names,
                self.world.metrics_history,
            )
        self._emit({"type": "analysis", "text": self.analysis})

    async def _tick(self):
        world = self.world
        world.tick += 1
        agents = world.agents
        G = world.graph
        tick_events = []

        # Handle injected events
        while self._inject_queue:
            ev = self._inject_queue.pop(0)
            self._apply_injection(ev, agents)

        # Build observation context for each agent
        agent_ids = list(agents.keys())
        rule_decisions: dict[str, tuple[str, str]] = {}
        gemini_candidates: list[str] = []

        for aid in agent_ids:
            agent = agents[aid]
            neighbors = list(G.neighbors(int(aid)))
            neighbor_states = [agents[str(n)].state for n in neighbors if str(n) in agents]

            use_ai = len(agents) <= 50 or self.theme.is_ambiguous(agent, neighbor_states)
            if use_ai:
                gemini_candidates.append(aid)
            else:
                new_state, reason = self.theme.rule_decision(agent, neighbor_states)
                rule_decisions[aid] = (new_state, reason)

        # Fire Gemini calls in parallel (with cap to avoid overload)
        gemini_decisions: dict[str, tuple[str, str]] = {}
        if gemini_candidates:
            capped = gemini_candidates[:min(len(gemini_candidates), 20)]
            tasks = []
            for aid in capped:
                agent = agents[aid]
                neighbors = list(G.neighbors(int(aid)))
                neighbor_states = [agents[str(n)].state for n in neighbors if str(n) in agents]
                tasks.append(self._gemini_decide(agent, neighbor_states))
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for aid, result in zip(capped, results):
                if isinstance(result, Exception):
                    # Fallback to rules
                    neighbors = list(G.neighbors(int(aid)))
                    neighbor_states = [agents[str(n)].state for n in neighbors if str(n) in agents]
                    new_state, reason = self.theme.rule_decision(agents[aid], neighbor_states)
                    gemini_decisions[aid] = (new_state, reason)
                else:
                    gemini_decisions[aid] = result
                agents[aid].used_gemini_recently = True
            # Remaining candidates beyond cap use rules
            for aid in gemini_candidates[20:]:
                neighbors = list(G.neighbors(int(aid)))
                neighbor_states = [agents[str(n)].state for n in neighbors if str(n) in agents]
                new_state, reason = self.theme.rule_decision(agents[aid], neighbor_states)
                rule_decisions[aid] = (new_state, reason)

        # Apply all decisions atomically
        all_decisions = {**rule_decisions, **gemini_decisions}
        for aid, (new_state, reason) in all_decisions.items():
            agent = agents[aid]
            if new_state != agent.state and new_state in self.theme.VALID_STATES:
                old_state = agent.state
                agent.state = new_state
                event_text = (
                    f"Tick {world.tick}: Agent {aid} ({agent.personality.name}) "
                    f"{old_state}→{new_state} — {reason}"
                )
                agent.add_memory(event_text)
                tick_events.append({
                    "tick": world.tick,
                    "agent_id": aid,
                    "personality": agent.personality.name,
                    "from_state": old_state,
                    "to_state": new_state,
                    "reason": reason,
                    "ai": aid in gemini_decisions,
                })

        # Memory compression every 20 ticks for Gemini-active agents
        if world.tick % 20 == 0:
            compression_tasks = [
                self._compress_memory(agent)
                for agent in agents.values()
                if agent.used_gemini_recently and list(agent.memory)
            ]
            if compression_tasks:
                await asyncio.gather(*compression_tasks, return_exceptions=True)
            for agent in agents.values():
                agent.used_gemini_recently = False

        # Compute and emit metrics
        metrics = self._compute_metrics(world, tick_events)
        world.metrics_history.append(metrics)
        # Keep history bounded (last 2000 ticks)
        if len(world.metrics_history) > 2000:
            world.metrics_history = world.metrics_history[-2000:]

        self._emit({"type": "tick", **metrics})

    async def _gemini_decide(self, agent: Agent, neighbor_states: list[str]) -> tuple[str, str]:
        result = await gemini.agent_decision(
            agent_id=agent.agent_id,
            personality_name=agent.personality.name,
            personality_desc=agent.personality.description,
            theme=self.theme.THEME_NAME,
            current_state=agent.state,
            neighbor_states=neighbor_states,
            memory_summary=agent.memory_summary,
            traits=agent.traits(),
        )
        new_state = result.get("new_state", agent.state)
        if new_state not in self.theme.VALID_STATES:
            new_state = agent.state
        reason = result.get("reason", "AI decision")
        return new_state, reason

    async def _compress_memory(self, agent: Agent):
        events = list(agent.memory)
        if not events:
            return
        summary = await gemini.compress_memory(events, agent.personality.name)
        agent.memory_summary = summary

    def _apply_injection(self, ev: dict, agents: dict):
        ev_type = ev.get("type")
        if ev_type == "rumour_burst":
            # Force 10% of agents to believer/infected state
            ids = random.sample(list(agents.keys()), k=max(1, len(agents) // 10))
            first_state = self.theme.SEED_STATE if hasattr(self.theme, "SEED_STATE") else self.theme.VALID_STATES[1]
            for aid in ids:
                agents[aid].state = first_state
        elif ev_type == "reset_random":
            for agent in agents.values():
                agent.state = random.choice(self.theme.VALID_STATES)

    def _compute_metrics(self, world: WorldState, tick_events: list) -> dict:
        agents = world.agents
        state_counts = {}
        for state in self.theme.VALID_STATES:
            state_counts[state] = sum(1 for a in agents.values() if a.state == state)

        # Per-personality breakdown
        breakdown: dict[str, dict[str, int]] = {}
        for agent in agents.values():
            pname = agent.personality.name
            if pname not in breakdown:
                breakdown[pname] = {s: 0 for s in self.theme.VALID_STATES}
            breakdown[pname][agent.state] = breakdown[pname].get(agent.state, 0) + 1

        # Node color map for visualization
        node_states = {aid: a.state for aid, a in agents.items()}

        return {
            "tick": world.tick,
            "state_counts": state_counts,
            "breakdown": breakdown,
            "events": tick_events[-10:],  # last 10 events
            "node_states": node_states,
            "total_agents": len(agents),
        }

    def snapshot(self) -> dict:
        """Full world state snapshot for export."""
        if not self.world:
            return {}
        return {
            "sim_id": self.config.sim_id,
            "theme": self.config.theme,
            "tick": self.world.tick,
            "agents": {
                aid: {
                    "state": a.state,
                    "personality": a.personality.name,
                    "memory_summary": a.memory_summary,
                }
                for aid, a in self.world.agents.items()
            },
            "metrics_history": self.world.metrics_history[-100:],
        }


# ── Global simulation registry ─────────────────────────────────────────────
_simulations: dict[str, SimulationEngine] = {}


def get_simulation(sim_id: str) -> SimulationEngine | None:
    return _simulations.get(sim_id)


def create_simulation(config: SimulationConfig) -> SimulationEngine:
    engine = SimulationEngine(config)
    engine.build()
    _simulations[config.sim_id] = engine
    return engine


def list_simulations() -> list[str]:
    return list(_simulations.keys())
