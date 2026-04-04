// TypeScript interfaces for the simulation platform

export interface PersonalityDef {
  name: string;
  description: string;
  credulity: number;
  influence: number;
  stubbornness: number;
  activity: number;
  suggested_percentage: number;
  color: string;
}

export type AgentRole = 'default' | 'influencer' | 'skeptic' | 'bot' | 'follower';

export interface Belief {
  topic: string;
  weight: number;
}

export interface AgentProfile {
  id: string;
  role: AgentRole;
  personality: string;
  beliefs: Belief[];
  profileLikes: number;
  viewerHasLiked?: boolean;
  narrativeSummary?: string;
  relationships?: Relationship[];
}

export interface AgentAction {
  id: string;
  agentId: string;
  actionType: 'like' | 'comment';
  feedPostId?: string;
  createdAt: string;
}

export interface ThemeDef {
  key: string;
  name: string;
  description: string;
  states: string[];
  difficulty: 'simple' | 'medium' | 'complex';
  emoji: string;
  state_colors: Record<string, string>;
}

export interface EpisodicEntry {
  tick: number;
  event: string;
  influence: string;
  impact: 'high' | 'low';
  createdAt?: string;
  reasoning_trace?: ReasoningTrace;
  confidence?: number;
}

export interface SimConfig {
  theme: string;
  agent_count: number;
  topology: string;
  tick_rate: number;
  personalities: PersonalityDef[];
}

// WebSocket message types
export interface Agent {
  id: string;
  state: string;
  role: 'influencer' | 'skeptic' | 'bot' | 'follower';
  personality: string;
  emotionalState: number;
  memory: string[];
}

export interface InitMessage {
  type: 'init';
  positions: Record<string, [number, number]>;
  edges: [number, number][];
  states: string[];
  state_colors: Record<string, string>;
  personalities: { name: string; color: string }[];
  theme: string;
  agents?: Agent[];
  agentProfiles?: AgentProfile[];
}

export interface TickEvent {
  tick: number;
  agent_id: string;
  personality: string;
  from_state: string;
  to_state: string;
  reason: string;
  ai: boolean;
  emotionalState?: number;
}

export interface TickMessage {
  type: 'tick';
  tick: number;
  state_counts: Record<string, number>;
  breakdown: Record<string, Record<string, number>>;
  events: TickEvent[];
  node_states: Record<string, string>;
  total_agents: number;
  role_breakdown?: Record<string, number>;
  agents?: Agent[];
}

export interface AnalysisReport {
  summary: string;
  timeline: string;
  personalities: Record<string, string>;
  realWorldParallel: string;
  recommendations: string[];
}

export interface AnalysisMessage {
  type: 'analysis';
  report: AnalysisReport;
}

export interface DiscussionComment {
  id: string;
  author: string;
  author_type: 'user' | 'agent';
  message: string;
  created_at: string;
  agentId?: string;
}

export interface DiscussionPost {
  id: string;
  author: string;
  author_type: 'user' | 'agent';
  personality?: string;
  content: string;
  created_at: string;
  likes: number;
  comments: DiscussionComment[];
  agentId?: string;
  tags?: string[];
}

export interface FeedUpdateMessage {
  type: 'feed_update';
  reason: 'new_post' | 'like' | 'comment';
  posts: DiscussionPost[];
}

export interface BeliefUpdateMessage {
  type: 'belief_update';
  agentId: string;
  beliefs: Belief[];
}

export type RelationshipType = 'RELATES_TO' | 'INFLUENCES' | 'DISAGREES_WITH' | 'SUPPORTS';

export interface Relationship {
  id: string;
  simId: string;
  sourceAgentId: string;
  targetAgentId: string;
  type: RelationshipType;
  strength: number;
  narrative?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RelationshipUpdateMessage {
  type: 'relationship_update';
  data: Relationship;
}

export type SimMessage = InitMessage | TickMessage | AnalysisMessage | FeedUpdateMessage | BeliefUpdateMessage | RelationshipUpdateMessage;

export interface ReasoningTrace {
  personality_influence: string;
  memory_influence: string;
  social_pressure: string;
  emotional_state_impact: string;
}

export interface WorldConfig {
  topic: string;
  scenario_description: string;
  agent_count: number;
  key_concepts: string[];
  personality_archetypes: PersonalityDef[];
  initial_state_distribution: Record<string, number>;
  suggested_config: {
    theme: string;
    agent_count: number;
    topology: string;
    tick_rate: number;
  };
}

export interface SimState {
  simId: string;
  tick: number;
  running: boolean;
  paused: boolean;
  initData: InitMessage | null;
  latestTick: TickMessage | null;
  events: TickEvent[];
  history: TickMessage[];
  analysisReport: AnalysisReport | null;
  discussionFeed: DiscussionPost[];
  relationships: Relationship[];
}
