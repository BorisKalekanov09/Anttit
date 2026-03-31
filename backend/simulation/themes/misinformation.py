"""
Misinformation Spread Theme
States: unaware → exposed → believer → resistant
"""
import random

STATES = ["unaware", "exposed", "believer", "resistant"]
INITIAL_STATE = "unaware"
SEED_STATE = "believer"  # A few agents start as believers
SEED_FRACTION = 0.05     # 5% start as believers


def seed_states(agents: dict) -> None:
    """Assign initial states to agents."""
    ids = list(agents.keys())
    random.shuffle(ids)
    seed_count = max(1, int(len(ids) * SEED_FRACTION))
    for i, aid in enumerate(ids):
        agents[aid].state = SEED_STATE if i < seed_count else INITIAL_STATE


def rule_decision(agent, neighbor_states: list[str]) -> tuple[str, str]:
    """Fast rule-based decision. Returns (new_state, reason)."""
    state = agent.state
    traits = agent.traits()
    credulity = traits["credulity"]
    stubbornness = traits["stubbornness"]

    believer_count = neighbor_states.count("believer")
    total = len(neighbor_states) or 1
    pressure = believer_count / total  # 0.0 - 1.0

    if state == "unaware":
        threshold = 1.0 - (credulity / 100.0) * 0.6 - 0.1
        if pressure > threshold:
            return "exposed", f"exposure pressure {pressure:.0%} exceeded threshold"
        return "unaware", "insufficient neighbor pressure"

    elif state == "exposed":
        accept_threshold = 1.0 - credulity / 100.0
        if pressure > accept_threshold:
            return "believer", "enough believers around — convinced"
        # Spontaneously resist
        if random.random() < (stubbornness / 200.0):
            return "resistant", "personal skepticism triggered"
        return "exposed", "still evaluating"

    elif state == "believer":
        if random.random() < (stubbornness / 500.0):
            return "resistant", "eventually questioned belief"
        return "believer", "reinforced by social network"

    elif state == "resistant":
        return "resistant", "immune — already evaluated and rejected"

    return state, "no change"


def is_ambiguous(agent, neighbor_states: list[str]) -> bool:
    """Return True if situation is ambiguous (needs Gemini)."""
    if not neighbor_states:
        return False
    believer_count = neighbor_states.count("believer")
    pressure = believer_count / len(neighbor_states)
    return 0.3 <= pressure <= 0.7 and agent.state in ("exposed", "unaware")


VALID_STATES = STATES
THEME_NAME = "Misinformation Spread"
THEME_DESCRIPTION = "Agents share and believe/disbelieve news as it spreads through their social network."
STATE_COLORS = {
    "unaware": "#64748b",
    "exposed": "#f59e0b",
    "believer": "#ef4444",
    "resistant": "#22c55e",
}
