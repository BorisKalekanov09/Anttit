import Graph from 'graphology';
import { v4 as uuidv4 } from 'uuid';
import type {
  SimulationConfig,
  PersonalityDef,
  TickEvent,
  TickMessage,
  InitMessage,
  AnalysisReport,
  AgentRole,
  RoleMix,
  Decision,
  DiscussionComment,
  DiscussionPost,
  FeedUpdateMessage,
  AgentAction,
  Belief,
  BeliefUpdateMessage,
  RelationshipUpdateMessage,
  RelationshipType,
  DirectMessage,
  DirectMessageUpdateMessage,
  AgentGroup,
  GroupMessage,
  GroupUpdateMessage,
} from '../types.js';
import { Agent, createAgent, addMemory, addEpisodicMemory, getTraits, applyRoleModifiers, canCompressMemory, canBecomeResistant } from './agent.js';
import { buildGraph, computePositions, getEdgeList, TopologyType } from './topology.js';
import { loadTheme, ThemeModule } from './themes/index.js';
import * as gemini from '../ai/gemini.js';
import { addLike, addComment, readFeed, appendPost } from '../store/feedStore.js';
import { graphDb } from '../db/graphDb.js';
import { appendDM } from '../store/dmStore.js';
import { getGroups, createGroup, addMember, removeMember as removeGroupMember, appendGroupMessage, findExistingGroup } from '../store/groupStore.js';

export class SimulationEngine {
  config: SimulationConfig;
  theme: ThemeModule;
  graph: Graph;
  agents: Map<string, Agent>;
  tick: number;
  running: boolean;
  paused: boolean;
  tickRate: number;
  subscribers: Set<(msg: string) => void>;
  metricsHistory: TickMessage[];
  positions: Record<string, [number, number]>;
  edges: [number, number][];
  injectQueue: Array<{ type: string; [key: string]: unknown }>;
  analysis: AnalysisReport | null;
  intervalHandle: ReturnType<typeof setInterval> | null;
  apiCallCount: number;
  totalTokensUsed: number;

  constructor(config: SimulationConfig) {
    this.config = config;
    this.theme = loadTheme(config.theme);
    this.graph = new Graph();
    this.agents = new Map();
    this.tick = 0;
    this.running = false;
    this.paused = false;
    this.tickRate = config.tickRate;
    this.subscribers = new Set();
    this.metricsHistory = [];
    this.positions = {};
    this.edges = [];
    this.injectQueue = [];
    this.analysis = null;
    this.intervalHandle = null;
    this.apiCallCount = 0;
    this.totalTokensUsed = 0;
  }

  async build(): Promise<InitMessage> {
    this.graph = buildGraph(this.config.topology as TopologyType, this.config.agentCount);
    this.positions = computePositions(this.graph, this.config.topology as TopologyType);
    this.edges = getEdgeList(this.graph);

    const personalities = this.distributePersonalities();
    const roles = this.config.roleMix ? this.distributeRoles() : null;

    for (let i = 0; i < this.config.agentCount; i++) {
      const id = String(i);
      const pDef = personalities[i];
      const role: AgentRole = roles ? roles[i] : 'default';
      
      const agent = createAgent(id, pDef, this.theme.INITIAL_STATE, role);
      agent.beliefs = this.theme.VALID_STATES.map((state) => ({
        topic: state,
        weight: 0.5,
      }));
      applyRoleModifiers(agent);
      this.agents.set(id, agent);
    }

    if (this.config.initial_state_distribution) {
      this.applyInitialStateDistribution(this.config.initial_state_distribution);
    } else {
      this.theme.seedStates(this.agents);
    }

    return this.getInitData();
  }

  private applyInitialStateDistribution(distribution: Record<string, number>): void {
    const agentIds = Array.from(this.agents.keys());
    this.shuffleArray(agentIds);
    
    let assignedCount = 0;
    const totalAgents = agentIds.length;
    
    for (const [state, percentage] of Object.entries(distribution)) {
      if (!this.theme.VALID_STATES.includes(state)) continue;
      const count = Math.round((percentage / 100) * totalAgents);
      for (let i = 0; i < count && assignedCount < totalAgents; i++) {
        this.agents.get(agentIds[assignedCount])!.state = state;
        assignedCount++;
      }
    }
  }

  private distributePersonalities(): PersonalityDef[] {
    const n = this.config.agentCount;
    const result: PersonalityDef[] = [];
    
    for (const p of this.config.personalities) {
      const pct = (p.suggested_percentage || 0) / 100.0;
      const count = Math.round(n * pct);
      for (let i = 0; i < count; i++) {
        result.push(p);
      }
    }

    while (result.length < n) {
      result.push(this.config.personalities[0]);
    }

    this.shuffleArray(result);
    return result.slice(0, n);
  }

  private distributeRoles(): AgentRole[] {
    const n = this.config.agentCount;
    const mix = this.config.roleMix!;
    const result: AgentRole[] = [];

    const roleEntries: [AgentRole, number][] = [
      ['influencer', mix.influencer],
      ['skeptic', mix.skeptic],
      ['bot', mix.bot],
      ['follower', mix.follower],
      ['default', mix.default],
    ];

    for (const [role, pct] of roleEntries) {
      const count = Math.round(n * pct / 100);
      for (let i = 0; i < count; i++) {
        result.push(role);
      }
    }

    while (result.length < n) {
      result.push('default');
    }

    this.shuffleArray(result);
    return result.slice(0, n);
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  subscribe(fn: (msg: string) => void): void {
    this.subscribers.add(fn);
  }

  unsubscribe(fn: (msg: string) => void): void {
    this.subscribers.delete(fn);
  }

  private emit(msg: object): void {
    const msgStr = JSON.stringify(msg);
    for (const fn of this.subscribers) {
      try {
        fn(msgStr);
      } catch {
        // ignore failed sends
      }
    }
  }

  emitDMUpdate(dm: DirectMessage): void {
    const msg: DirectMessageUpdateMessage = { type: 'dm_update', dm };
    this.emit(msg);
  }

  emitGroupUpdate(groups: AgentGroup[], newMessage?: GroupMessage): void {
    const msg: GroupUpdateMessage = { type: 'group_update', groups, newMessage };
    this.emit(msg);
  }

  private trackApiCall(tokensUsed: number = 0, reason: string = ''): void {
    this.apiCallCount++;
    this.totalTokensUsed += tokensUsed;
    this.emit({
      type: 'api_call',
      count: this.apiCallCount,
      tokensUsed: this.totalTokensUsed,
      reason,
    });
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  setTickRate(rate: number): void {
    this.tickRate = Math.max(0.05, Math.min(5.0, rate));
  }

  inject(eventType: string, payload: Record<string, unknown>): void {
    this.injectQueue.push({ type: eventType, ...payload });
  }

  stop(): void {
    this.running = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getInitData(): InitMessage {
    return {
      type: 'init',
      positions: this.positions,
      edges: this.edges,
      states: this.theme.VALID_STATES,
      state_colors: this.theme.STATE_COLORS,
      personalities: Array.from(this.agents.values()).map(a => ({
        name: a.personality.name,
        color: a.personality.color,
      })),
      theme: this.theme.THEME_NAME,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.emit(this.getInitData());

    const tickLoop = async () => {
      if (!this.running) return;
      
      if (!this.paused) {
        await this.executeTick();
      }

      if (this.running) {
        this.intervalHandle = setTimeout(tickLoop, this.tickRate * 1000);
      }
    };

    tickLoop();
  }

  async generateFinalAnalysis(): Promise<AnalysisReport> {
    if (this.metricsHistory.length === 0) {
      return {
        summary: 'No simulation data to analyze.',
        timeline: '',
        personalities: {},
        realWorldParallel: '',
        recommendations: [],
      };
    }

    const personalityNames = [...new Set(
      Array.from(this.agents.values()).map(a => a.personality.name)
    )];

    this.analysis = await gemini.generateAnalysis(
      this.theme.THEME_NAME,
      personalityNames,
      this.metricsHistory,
      this.config.modelName,
      this.config.seedText
    );

    this.emit({ type: 'analysis', report: this.analysis });
    return this.analysis;
  }

  private async executeTick(): Promise<void> {
    this.tick++;
    const tickEvents: TickEvent[] = [];

    while (this.injectQueue.length > 0) {
      const ev = this.injectQueue.shift()!;
      this.applyInjection(ev);
    }

    // Passive exposure: agents in the initial state have a small random chance
    // to be passively exposed each tick. This prevents stalling when the seed
    // fraction is too small to overcome the exposure threshold via social pressure alone.
    const PASSIVE_EXPOSURE_CHANCE = 0.08;
    const initialState = this.theme.INITIAL_STATE;
    const passiveTargetState = this.theme.VALID_STATES[1];
    if (passiveTargetState && passiveTargetState !== initialState) {
      for (const [aid, agent] of this.agents) {
        if (agent.state === initialState && Math.random() < PASSIVE_EXPOSURE_CHANCE) {
          const oldState = agent.state;
          agent.state = passiveTargetState;
          this.updateBeliefsForTransition(agent, oldState, passiveTargetState);
          this.emit({ type: 'belief_update', agentId: aid, beliefs: agent.beliefs } as BeliefUpdateMessage);
          addMemory(agent, `Tick ${this.tick}: passively encountered ${this.theme.THEME_NAME}`);
          tickEvents.push({
            tick: this.tick,
            agent_id: aid,
            personality: agent.personality.name,
            from_state: oldState,
            to_state: passiveTargetState,
            reason: 'passive exposure',
            ai: false,
          });
        }
      }
    }

    const agentIds = Array.from(this.agents.keys());
    const ruleDecisions: Map<string, Decision> = new Map();
    const geminiCandidates: string[] = [];

    for (const aid of agentIds) {
      const agent = this.agents.get(aid)!;
      const neighbors = this.getNeighbors(aid);
      const neighborStates = neighbors.map(n => this.agents.get(n)!.state);

      const useAI = this.shouldUseAI(agent, neighborStates);
      if (useAI) {
        geminiCandidates.push(aid);
      } else if (agent.role === 'follower') {
        const decision = this.followerDecision(agent, neighborStates);
        ruleDecisions.set(aid, decision);
      } else if (agent.role === 'skeptic') {
        const decision = this.skepticDecision(agent, neighborStates);
        ruleDecisions.set(aid, decision);
      } else {
        const decision = this.theme.ruleDecision(agent, neighborStates);
        ruleDecisions.set(aid, decision);
      }
    }

    const geminiDecisions: Map<string, Decision> = new Map();
    if (geminiCandidates.length > 0) {
      const capped = geminiCandidates.slice(0, Math.min(geminiCandidates.length, this.config.aiAgentsPerTick || 20));
      
      const tasks = capped.map(async (aid) => {
        const agent = this.agents.get(aid)!;
        const neighbors = this.getNeighbors(aid);
        const neighborStates = neighbors.map(n => this.agents.get(n)!.state);
        
        try {
          const result = await this.geminiDecide(agent, neighborStates);
          return { aid, result };
        } catch {
          const fallback = this.theme.ruleDecision(agent, neighborStates);
          return { aid, result: fallback };
        }
      });

      const results = await Promise.all(tasks);
      for (const { aid, result } of results) {
        geminiDecisions.set(aid, result);
        this.agents.get(aid)!.usedGeminiRecently = true;
      }

      for (const aid of geminiCandidates.slice(this.config.aiAgentsPerTick || 20)) {
        const agent = this.agents.get(aid)!;
        const neighbors = this.getNeighbors(aid);
        const neighborStates = neighbors.map(n => this.agents.get(n)!.state);
        ruleDecisions.set(aid, this.theme.ruleDecision(agent, neighborStates));
      }
    }

    const allDecisions = new Map([...ruleDecisions, ...geminiDecisions]);
    for (const [aid, [newState, reason]] of allDecisions) {
      const agent = this.agents.get(aid)!;
      if (newState !== agent.state && this.theme.VALID_STATES.includes(newState)) {
        const oldState = agent.state;
        agent.state = newState;

        this.updateBeliefsForTransition(agent, oldState, newState);
        const beliefMsg: BeliefUpdateMessage = {
          type: 'belief_update',
          agentId: aid,
          beliefs: agent.beliefs,
        };
        this.emit(beliefMsg);

        const eventText = `Tick ${this.tick}: Agent ${aid} (${agent.personality.name}) ${oldState}→${newState} — ${reason}`;
        addMemory(agent, eventText);

        // Retrieve reasoning trace if this was an AI decision
        const geminiResult = (agent as any)._lastGeminiResult as { reasoning_trace?: unknown; confidence?: number } | undefined;
        addEpisodicMemory(agent, {
          tick: this.tick,
          event: `changed from ${oldState} to ${newState}`,
          influence: 'neighbors',
          impact: geminiDecisions.has(aid) ? 'high' : 'low',
          reasoning_trace: geminiResult?.reasoning_trace as any,
          confidence: geminiResult?.confidence,
        });

        tickEvents.push({
          tick: this.tick,
          agent_id: aid,
          personality: agent.personality.name,
          from_state: oldState,
          to_state: newState,
          reason,
          ai: geminiDecisions.has(aid),
        });

        // Track relationship: find the neighbor most likely to have influenced this state change
        if (geminiDecisions.has(aid)) {
          void this.recordInfluenceRelationship(aid, newState, reason);
        }
      }
    }

    for (const agent of this.agents.values()) {
      if (Math.random() * 100 < agent.personality.activity) {
        void this.performAutoAgentAction(agent);
      }
    }

    // Every 3 ticks: agents with relationships occasionally DM each other
    if (this.tick % 3 === 0) {
      void this.performAutoDMs();
    }

    // Every 5 ticks: agents with shared beliefs may form or join groups
    if (this.tick % 5 === 0) {
      void this.performAutoGroupFormation();
    }

    if (this.tick % 15 === 0) {
      const compressionTasks = Array.from(this.agents.values())
        .filter(a => a.usedGeminiRecently && a.memory.length > 0 && canCompressMemory(a))
        .map(async (agent) => {
          try {
            const episodicSummary = agent.episodicMemory
              .slice(-5)
              .map(e => `Tick ${e.tick}: ${e.event}`)
              .join('; ');
            const memoryWithEpisodic = episodicSummary 
              ? [...agent.memory, `Key events: ${episodicSummary}`]
              : agent.memory;
            agent.memorySummary = await gemini.compressMemory(memoryWithEpisodic, agent.personality.name, this.config.modelName);
          } catch {
          }
        });

      await Promise.all(compressionTasks);

      for (const agent of this.agents.values()) {
        agent.usedGeminiRecently = false;
      }
    }

    const metrics = this.computeMetrics(tickEvents);
    this.metricsHistory.push(metrics);

    if (this.metricsHistory.length > 2000) {
      this.metricsHistory = this.metricsHistory.slice(-2000);
    }

    this.emit(metrics);
  }

  private shouldUseAI(agent: Agent, neighborStates: string[]): boolean {
    if (agent.role === 'bot') return true;
    if (agent.role === 'skeptic') return false;
    if (agent.role === 'follower') return false;
    if (this.agents.size <= 50) return true;
    return this.theme.isAmbiguous(agent, neighborStates);
  }

  private followerDecision(agent: Agent, neighborStates: string[]): Decision {
    if (neighborStates.length === 0) {
      return [agent.state, 'No neighbors to follow'];
    }
    
    const stateCounts: Record<string, number> = {};
    for (const state of neighborStates) {
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    }
    
    for (const [state, count] of Object.entries(stateCounts)) {
      if (state !== agent.state && count / neighborStates.length > agent.followerThreshold) {
        return [state, `Following the majority (${Math.round(count / neighborStates.length * 100)}% of neighbors)`];
      }
    }
    
    return [agent.state, 'Waiting for clearer consensus'];
  }

  private skepticDecision(agent: Agent, neighborStates: string[]): Decision {
    const baseDecision = this.theme.ruleDecision(agent, neighborStates);
    const [proposedState, reason] = baseDecision;
    
    if (proposedState !== agent.state && agent.resistantBias) {
      const resistantState = this.theme.VALID_STATES.find(s => 
        s.includes('resistant') || s.includes('skeptic') || s.includes('recovered')
      );
      if (resistantState && resistantState !== agent.state) {
        return [resistantState, `Skeptical resistance to change (was considering: ${reason})`];
      }
    }
    
    return baseDecision;
  }

  public getNeighbors(agentId: string): string[] {
    const agent = this.agents.get(agentId)!;
    const directNeighbors = this.graph.neighbors(agentId);
    
    if (agent.role === 'influencer') {
      const secondDegree = new Set<string>();
      for (const n of directNeighbors) {
        for (const nn of this.graph.neighbors(n)) {
          if (nn !== agentId) secondDegree.add(nn);
        }
      }
      return [...new Set([...directNeighbors, ...secondDegree])];
    }
    
    return directNeighbors;
  }

  private async geminiDecide(agent: Agent, neighborStates: string[]): Promise<Decision> {
    if (agent.role === 'bot') {
      return [agent.state, `Spreading ${agent.state} to neighbors`];
    }

    const result = await gemini.agentDecision(
      agent.agentId,
      agent.personality.name,
      agent.personality.description,
      this.theme.THEME_NAME,
      agent.state,
      neighborStates,
      agent.memorySummary,
      getTraits(agent),
      agent.episodicMemory,
      agent.emotionalState,
      this.config.modelName
    );

    // Stash the full result so executeTick can read reasoning_trace + confidence
    (agent as any)._lastGeminiResult = result;

    let newState = result.new_state || agent.state;
    if (!this.theme.VALID_STATES.includes(newState)) {
      newState = agent.state;
    }

    if (!canBecomeResistant(agent)) {
      const isResistantState = newState.includes('resistant') || 
                                newState.includes('skeptic') || 
                                newState.includes('recovered');
      if (isResistantState && agent.state !== newState) {
        newState = agent.state;
      }
    }

    if (result.emotional_shift !== undefined) {
      agent.emotionalState = Math.max(-1, Math.min(1, agent.emotionalState + result.emotional_shift));
    }

    return [newState, result.reason || 'AI decision'];
  }

  private async recordInfluenceRelationship(
    changedAgentId: string,
    newState: string,
    reason: string
  ): Promise<void> {
    try {
      const neighbors = this.getNeighbors(changedAgentId);
      if (neighbors.length === 0) return;

      // Find neighbors already in the new state — they influenced this change
      const matchingNeighbors = neighbors.filter(
        n => this.agents.get(n)?.state === newState
      );
      if (matchingNeighbors.length === 0) return;

      // Pick the neighbor with the highest influence trait as the primary influencer
      const influencerId = matchingNeighbors.reduce((best, n) => {
        const bestTraits = getTraits(this.agents.get(best)!);
        const nTraits = getTraits(this.agents.get(n)!);
        return (nTraits.influence ?? 50) > (bestTraits.influence ?? 50) ? n : best;
      }, matchingNeighbors[0]);

      const strength = 0.3 + (matchingNeighbors.length / Math.max(neighbors.length, 1)) * 0.5;

      // Determine relationship type from state transition context
      let relType: RelationshipType = 'INFLUENCES';
      if (newState.includes('resistant') || newState.includes('skeptic')) {
        relType = 'DISAGREES_WITH';
      } else if (newState === this.agents.get(influencerId)?.state) {
        relType = 'SUPPORTS';
      }

      const rel = await graphDb.recordRelationship(
        this.config.simId,
        influencerId,
        changedAgentId,
        relType,
        strength,
        reason.slice(0, 200),
        this.tick
      );

      const relMsg: RelationshipUpdateMessage = {
        type: 'relationship_update',
        data: rel,
      };
      this.emit(relMsg);
    } catch {
      // Relationship tracking is non-critical — never let it break a tick
    }
  }

  private applyInjection(ev: { type: string; [key: string]: unknown }): void {
    const eventType = ev.type;

    if (eventType === 'rumour_burst' || eventType === 'viral_moment') {
      const fraction = (ev.fraction as number) || 0.1;
      const ids = Array.from(this.agents.keys());
      const count = Math.max(1, Math.floor(ids.length * fraction));
      const selected = this.sampleArray(ids, count);
      const targetState = this.theme.SEED_STATE || this.theme.VALID_STATES[1];
      
      for (const aid of selected) {
        this.agents.get(aid)!.state = targetState;
      }
    } else if (eventType === 'reset_random') {
      for (const agent of this.agents.values()) {
        const randomIdx = Math.floor(Math.random() * this.theme.VALID_STATES.length);
        agent.state = this.theme.VALID_STATES[randomIdx];
      }
    } else if (eventType === 'authority_speaks') {
      for (const agent of this.agents.values()) {
        if (agent.state === this.theme.SEED_STATE && Math.random() < 0.3) {
          const resistantState = this.theme.VALID_STATES.find(s => 
            s.includes('resistant') || s.includes('skeptic') || s.includes('recovered')
          );
          if (resistantState) {
            agent.state = resistantState;
          }
        }
      }
    } else if (eventType === 'mass_recovery') {
      const fraction = (ev.fraction as number) || 0.2;
      const targetAgents = Array.from(this.agents.values()).filter(
        a => a.state === this.theme.SEED_STATE || a.state === 'infected' || a.state === 'believer'
      );
      const count = Math.max(1, Math.floor(targetAgents.length * fraction));
      const selected = this.sampleArray(targetAgents, count);
      const recoveryState = this.theme.VALID_STATES.find(s => 
        s.includes('recovered') || s.includes('resistant') || s === 'healthy'
      );
      if (recoveryState) {
        for (const agent of selected) {
          agent.state = recoveryState;
        }
      }
    } else if (eventType === 'network_split') {
      const edgesToRemove = Math.floor(this.graph.size * 0.1);
      const edges = this.graph.edges();
      for (let i = 0; i < Math.min(edgesToRemove, edges.length); i++) {
        const randomEdge = edges[Math.floor(Math.random() * edges.length)];
        if (this.graph.hasEdge(randomEdge)) {
          this.graph.dropEdge(randomEdge);
        }
      }
      this.edges = getEdgeList(this.graph);
    }
  }

  private sampleArray<T>(array: T[], count: number): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  private computeMetrics(tickEvents: TickEvent[]): TickMessage {
    const stateCounts: Record<string, number> = {};
    for (const state of this.theme.VALID_STATES) {
      stateCounts[state] = 0;
    }
    for (const agent of this.agents.values()) {
      stateCounts[agent.state] = (stateCounts[agent.state] || 0) + 1;
    }

    const breakdown: Record<string, Record<string, number>> = {};
    for (const agent of this.agents.values()) {
      const pname = agent.personality.name;
      if (!breakdown[pname]) {
        breakdown[pname] = {};
        for (const s of this.theme.VALID_STATES) {
          breakdown[pname][s] = 0;
        }
      }
      breakdown[pname][agent.state] = (breakdown[pname][agent.state] || 0) + 1;
    }

    const nodeStates: Record<string, string> = {};
    for (const [aid, agent] of this.agents) {
      nodeStates[aid] = agent.state;
    }

    return {
      type: 'tick',
      tick: this.tick,
      state_counts: stateCounts,
      breakdown,
      events: tickEvents.slice(-10),
      node_states: nodeStates,
      total_agents: this.agents.size,
    };
  }

  snapshot(): {
    sim_id: string;
    theme: string;
    tick: number;
    agents: Record<string, { state: string; personality: string; memory_summary: string }>;
    metrics_history: TickMessage[];
  } {
    return {
      sim_id: this.config.simId,
      theme: this.config.theme,
      tick: this.tick,
      agents: Object.fromEntries(
        Array.from(this.agents.entries()).map(([aid, a]) => [
          aid,
          {
            state: a.state,
            personality: a.personality.name,
            memory_summary: a.memorySummary,
          },
        ])
      ),
      metrics_history: this.metricsHistory.slice(-100),
    };
  }

  private recordAction(agentId: string, actionType: 'like' | 'comment', feedPostId?: string): void {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`[Engine] Agent ${agentId} not found for action recording`);
        return;
      }

      const action: AgentAction = {
        id: uuidv4(),
        agentId,
        actionType,
        feedPostId,
        createdAt: new Date().toISOString(),
      };

      agent.actionLog.push(action);
    } catch (error) {
      console.error('[Engine] Error recording action:', error);
      // Non-blocking: don't throw
    }
  }

  async addFeedLike(postId: string, agentId?: string): Promise<void> {
    try {
      await addLike(this.config.simId, postId);
      
      if (agentId) {
        this.recordAction(agentId, 'like', postId);
        this.trackApiCall(0, 'agent_like');
      }
      
      const feedSnapshot = await readFeed(this.config.simId);
      const feedMsg: FeedUpdateMessage = {
        type: 'feed_update',
        reason: 'like',
        posts: feedSnapshot.posts,
      };
      this.emit(feedMsg);
    } catch (error) {
      console.error('[Engine] Error adding like to post:', error);
      throw error;
    }
  }

  async addFeedComment(postId: string, comment: DiscussionComment, agentId?: string): Promise<void> {
    try {
      await addComment(this.config.simId, postId, comment);
      
      if (agentId) {
        this.recordAction(agentId, 'comment', postId);
        this.trackApiCall(0, 'agent_comment');
      }
      
      const feedSnapshot = await readFeed(this.config.simId);
      const feedMsg: FeedUpdateMessage = {
        type: 'feed_update',
        reason: 'comment',
        posts: feedSnapshot.posts,
      };
      this.emit(feedMsg);
    } catch (error) {
      console.error('[Engine] Error adding comment to post:', error);
      throw error;
    }
  }

  async getDiscussionFeed(): Promise<DiscussionPost[]> {
    try {
      const feedSnapshot = await readFeed(this.config.simId);
      return feedSnapshot.posts;
    } catch (error) {
      console.error('[Engine] Error retrieving discussion feed:', error);
      return [];
    }
  }

  async createFeedPost(agentId: string, title: string, content: string, tags: string[] = []): Promise<DiscussionPost> {
    try {
      const agent = this.agents.get(agentId);
      const author = agent?.personality.name || 'Unknown';
      
      const newPost: DiscussionPost = {
        id: uuidv4(),
        title,
        content,
        author,
        author_type: 'agent',
        created_at: new Date().toISOString(),
        likes: 0,
        comments: [],
        tags,
        agentId,
      };
      
      const createdPost = await appendPost(this.config.simId, newPost);
      this.recordAction(agentId, 'post', createdPost.id);
      this.trackApiCall(0, 'agent_post');
      
      const feedSnapshot = await readFeed(this.config.simId);
      const feedMsg: FeedUpdateMessage = {
        type: 'feed_update',
        reason: 'new_post',
        posts: feedSnapshot.posts,
      };
      this.emit(feedMsg);
      
      return createdPost;
    } catch (error) {
      console.error('[Engine] Error creating feed post:', error);
      throw error;
    }
  }

  getAgents(): Map<string, Agent> {
    return this.agents;
  }

  private updateBeliefsForTransition(agent: Agent, fromState: string, toState: string): void {
    const delta = 0.05;
    agent.beliefs = agent.beliefs.map((belief: Belief) => {
      let weight = belief.weight;
      if (belief.topic === toState) {
        weight = Math.min(1, weight + delta);
      }
      if (belief.topic === fromState) {
        weight = Math.max(0, weight - delta);
      }
      return { ...belief, weight };
    });
  }

  /**
   * Agents with any relationship occasionally send DMs.
   * Falls back to neighbor-pair sampling when no tracked relationships exist.
   * We sample a few pairs per check to avoid flooding.
   */
  private async performAutoDMs(): Promise<void> {
    try {
      const relationships = graphDb.getRelationshipsForSim(this.config.simId);
      // Lower threshold to 0.3 so early-sim relationships qualify too
      let strong = relationships.filter(r => r.strength >= 0.3 && r.type !== 'RELATES_TO');

      // Fallback: if no tracked relationships yet, use neighbor pairs
      if (strong.length === 0) {
        const agentIds = Array.from(this.agents.keys());
        for (const aid of agentIds.sort(() => Math.random() - 0.5).slice(0, 10)) {
          const neighbors = this.getNeighbors(aid);
          if (neighbors.length > 0) {
            const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
            strong.push({
              id: `fallback-${aid}-${neighbor}`,
              simId: this.config.simId,
              sourceAgentId: aid,
              targetAgentId: neighbor,
              type: 'INFLUENCES' as RelationshipType,
              strength: 0.3,
              tickCreated: this.tick,
              tickUpdated: this.tick,
            });
          }
        }
      }

      // Pick up to 5 random relationships to generate DMs
      const candidates = strong.sort(() => Math.random() - 0.5).slice(0, 5);

      for (const rel of candidates) {
        if (Math.random() > 0.65) continue; // 65% chance per candidate

        const sender = this.agents.get(rel.sourceAgentId);
        const receiver = this.agents.get(rel.targetAgentId);
        if (!sender || !receiver) continue;

        const dmTemplates: Record<string, string[]> = {
          INFLUENCES: [
            `Hey, I noticed you've been thinking about ${receiver.state} too. We should talk.`,
            `I believe ${sender.state} is the right path. Have you considered it?`,
            `Just wanted to check in — I think we're aligned on this.`,
          ],
          SUPPORTS: [
            `Glad we're on the same page about ${sender.state}.`,
            `Your perspective on this really resonated with me.`,
            `We should coordinate — our views align closely.`,
          ],
          DISAGREES_WITH: [
            `I fundamentally disagree with your stance on ${receiver.state}.`,
            `Can we talk? I think you're missing something important here.`,
            `Our views are very different — maybe worth a direct conversation.`,
          ],
        };

        const templates = dmTemplates[rel.type] ?? dmTemplates['INFLUENCES'];
        const content = templates[Math.floor(Math.random() * templates.length)];

        const dm: DirectMessage = {
          id: uuidv4(),
          simId: this.config.simId,
          fromAgentId: sender.agentId,
          toAgentId: receiver.agentId,
          fromAuthor: sender.personality.name,
          toAuthor: receiver.personality.name,
          content,
          createdAt: new Date().toISOString(),
        };

        await appendDM(this.config.simId, dm);
        this.emitDMUpdate(dm);
      }
    } catch (err) {
      console.error('[Engine] performAutoDMs error:', err);
    }
  }

  /**
   * Agents that share the same belief state and are graph-neighbors
   * may form or join a group together.
   */
  private async performAutoGroupFormation(): Promise<void> {
    try {
      const agentList = Array.from(this.agents.values());

      // Group agents by their current state
      const byState: Record<string, Agent[]> = {};
      for (const agent of agentList) {
        if (!byState[agent.state]) byState[agent.state] = [];
        byState[agent.state].push(agent);
      }

      for (const [state, members] of Object.entries(byState)) {
        if (members.length < 2) continue; // need at least 2 to form a group

        // Pick a cluster of up to 5 agents in this state
        const cluster = members.sort(() => Math.random() - 0.5).slice(0, 5);
        const clusterIds = cluster.map(a => a.agentId);

        // Check if a group for this belief already exists
        const existing = await findExistingGroup(this.config.simId, state, clusterIds);

        if (existing) {
          // Add any cluster member not yet in the group
          let changed = false;
          for (const agentId of clusterIds) {
            if (!existing.memberIds.includes(agentId)) {
              await addMember(this.config.simId, existing.id, agentId);
              changed = true;
            }
          }

          if (changed) {
            const groups = await getGroups(this.config.simId);
            this.emitGroupUpdate(groups);

            // New member sends a group greeting
            const newMember = cluster.find(a => !existing.memberIds.includes(a.agentId));
            if (newMember) {
              const greetings = [
                `Just joined. Glad to find others who share our view on ${state}.`,
                `Hello everyone. I believe ${state} is the right position.`,
                `Looking forward to discussing this with the group.`,
              ];
              const msg: GroupMessage = {
                id: uuidv4(),
                groupId: existing.id,
                simId: this.config.simId,
                authorId: newMember.agentId,
                author: newMember.personality.name,
                content: greetings[Math.floor(Math.random() * greetings.length)],
                createdAt: new Date().toISOString(),
              };
              await appendGroupMessage(this.config.simId, msg);
              const groups2 = await getGroups(this.config.simId);
              this.emitGroupUpdate(groups2, msg);
            }
          }
        } else if (Math.random() < 0.65) {
          // 65% chance to form a new group
          const founder = cluster[0];
          const groupNames: string[] = [
            `${state} Alliance`,
            `The ${state} Coalition`,
            `${founder.personality.name}'s ${state} Circle`,
            `${state} Collective`,
          ];
          const group: AgentGroup = {
            id: uuidv4(),
            simId: this.config.simId,
            name: groupNames[Math.floor(Math.random() * groupNames.length)],
            description: `A group of agents united by the shared belief: ${state}`,
            memberIds: clusterIds,
            createdBy: founder.agentId,
            createdAt: new Date().toISOString(),
            sharedBelief: state,
          };

          await createGroup(this.config.simId, group);

          // Founder sends opening message
          const openings = [
            `I've created this group for us to coordinate on ${state}.`,
            `Welcome everyone. Let's discuss our shared stance on ${state}.`,
            `This is a private space for those of us who believe in ${state}.`,
          ];
          const msg: GroupMessage = {
            id: uuidv4(),
            groupId: group.id,
            simId: this.config.simId,
            authorId: founder.agentId,
            author: founder.personality.name,
            content: openings[Math.floor(Math.random() * openings.length)],
            createdAt: new Date().toISOString(),
          };
          await appendGroupMessage(this.config.simId, msg);

          const groups = await getGroups(this.config.simId);
          this.emitGroupUpdate(groups, msg);
        }

        // Members who changed state may leave their group
        if (Math.random() < 0.2) {
          const allGroups = await getGroups(this.config.simId);
          for (const group of allGroups) {
            for (const memberId of [...group.memberIds]) {
              const member = this.agents.get(memberId);
              if (member && group.sharedBelief && member.state !== group.sharedBelief) {
                // Agent no longer shares the group's belief — 50% chance to leave
                if (Math.random() < 0.5) {
                  await removeGroupMember(this.config.simId, group.id, memberId);
                }
              }
            }
          }
          const updatedGroups = await getGroups(this.config.simId);
          this.emitGroupUpdate(updatedGroups);
        }

        // Group members occasionally send group messages
        const allGroups = await getGroups(this.config.simId);
        for (const group of allGroups) {
          if (group.memberIds.length === 0) continue;
          if (Math.random() > 0.55) continue; // 55% chance per group per formation check

          const speakerId = group.memberIds[Math.floor(Math.random() * group.memberIds.length)];
          const speaker = this.agents.get(speakerId);
          if (!speaker) continue;

          const groupMessages = [
            `Has anyone else noticed the shift in the network? ${speaker.state} feels like it's spreading.`,
            `I'm still firmly ${speaker.state}. What about the rest of you?`,
            `We need to stay aligned on this.`,
            `The opposition is growing. Let's coordinate.`,
            `I think our position is stronger than ever.`,
          ];

          const msg: GroupMessage = {
            id: uuidv4(),
            groupId: group.id,
            simId: this.config.simId,
            authorId: speakerId,
            author: speaker.personality.name,
            content: groupMessages[Math.floor(Math.random() * groupMessages.length)],
            createdAt: new Date().toISOString(),
          };
          await appendGroupMessage(this.config.simId, msg);
          const finalGroups = await getGroups(this.config.simId);
          this.emitGroupUpdate(finalGroups, msg);
        }

        break; // process one state cluster per call to avoid too much work
      }
    } catch (err) {
      console.error('[Engine] performAutoGroupFormation error:', err);
    }
  }

  private async performAutoAgentAction(agent: Agent): Promise<void> {
    try {
      const feedSnapshot = await readFeed(this.config.simId);
      const posts = feedSnapshot.posts;

       if (posts.length === 0) {
         const traits = {
           credulity: agent.personality.credulity,
           influence: agent.personality.influence,
           stubbornness: agent.personality.stubbornness,
           activity: agent.personality.activity,
         };
         const postData = await gemini.generateDiscussionPost(
           agent.personality.name,
           agent.state,
           agent.beliefs,
           agent.memory,
           this.theme.THEME_NAME,
           this.config.modelName,
           agent.role,
           traits
         );
        
        await this.createFeedPost(
          agent.agentId,
          postData.title,
          postData.content,
          postData.tags
        );
        return;
      }

      const rand = Math.random();
      
       if (rand < 0.35) {
         const traits = {
           credulity: agent.personality.credulity,
           influence: agent.personality.influence,
           stubbornness: agent.personality.stubbornness,
           activity: agent.personality.activity,
         };
         const postData = await gemini.generateDiscussionPost(
           agent.personality.name,
           agent.state,
           agent.beliefs,
           agent.memory,
           this.theme.THEME_NAME,
           this.config.modelName,
           agent.role,
           traits
         );
        
        await this.createFeedPost(
          agent.agentId,
          postData.title,
          postData.content,
          postData.tags
        );
      } else if (rand < 0.50) {
        const targetPost = posts[Math.floor(Math.random() * posts.length)];
        await this.addFeedLike(targetPost.id, agent.agentId);
       } else if (rand < 0.65) {
         const targetPost = posts[Math.floor(Math.random() * posts.length)];
         const traits = {
           credulity: agent.personality.credulity,
           influence: agent.personality.influence,
           stubbornness: agent.personality.stubbornness,
           activity: agent.personality.activity,
         };
         const commentText = await gemini.generateCommentText(
           agent.personality.name,
           agent.state,
           agent.beliefs,
           targetPost.title,
           targetPost.content,
           targetPost.author,
           this.theme.THEME_NAME,
           this.config.modelName,
           agent.role,
           traits
         );
        
        const comment: DiscussionComment = {
          id: uuidv4(),
          author: agent.personality.name,
          author_type: 'agent',
          message: commentText,
          created_at: new Date().toISOString(),
          agentId: agent.agentId,
        };
        await this.addFeedComment(targetPost.id, comment, agent.agentId);
      }
    } catch (error) {
      const errorMsg = String(error);
      if ((error as any).isQuotaError || errorMsg.includes('QUOTA_EXCEEDED')) {
        console.log('[Engine] API quota exceeded - skipping agent action');
        return;
      }
      console.error('[Engine] Auto agent action failed:', error);
    }
  }
}
