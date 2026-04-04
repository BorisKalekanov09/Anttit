/**
 * Shared types for TuesFest2026 Node.js Backend
 * Mirrors Python backend types + new feature fields from plan
 */

// ── Reasoning Trace (used in EpisodicEntry + GeminiDecision) ─────────────

export interface ReasoningTrace {
  personality_influence: string;
  memory_influence: string;
  social_pressure: string;
  emotional_state_impact: string;
}

// ── Agent Role Types (Feature 5) ──────────────────────────────────────────

export type AgentRole = 'default' | 'influencer' | 'skeptic' | 'bot' | 'follower';

export interface RoleMix {
  influencer: number;
  skeptic: number;
  bot: number;
  follower: number;
  default: number;
}

// ── Personality Types ─────────────────────────────────────────────────────

export interface PersonalityDef {
  name: string;
  description: string;
  credulity: number;       // 0-100
  influence: number;       // 0-100
  stubbornness: number;    // 0-100
  activity: number;        // 0-100
  suggested_percentage: number;
  color: string;
}

// ── Simulation Configuration ──────────────────────────────────────────────

export interface SimulationConfig {
  simId: string;
  theme: string;
  agentCount: number;
  topology: 'small_world' | 'scale_free' | 'random' | 'grid';
  tickRate: number;
  personalities: PersonalityDef[];
  modelName: string;
  aiAgentsPerTick: number;
  seedText?: string;
  roleMix?: RoleMix;
  initial_state_distribution?: Record<string, number>;
  seed_fraction?: number;
}

// ── Agent Memory Types (Feature 2: Enhanced Memory) ───────────────────────

export interface EpisodicEntry {
  tick: number;
  event: string;           // "changed from X to Y because..."
  influence: string;       // which agent triggered this
  impact: 'high' | 'low';
  createdAt?: string;      // ISO timestamp (real time, not epoch-based)
  reasoning_trace?: ReasoningTrace;
  confidence?: number;
}

// ── Belief Types (Feature 7: Agent Beliefs & Actions) ─────────────────────

export interface Belief {
  topic: string;
  weight: number;          // 0-1 range
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
  createdAt: string;       // ISO timestamp
}

// ── Theme Definition ──────────────────────────────────────────────────────

export interface ThemeDef {
  key: string;
  name: string;
  description: string;
  states: string[];
  difficulty: 'simple' | 'medium' | 'complex';
  emoji: string;
  state_colors: Record<string, string>;
}

// ── WebSocket Message Types ───────────────────────────────────────────────

export interface InitMessage {
  type: 'init';
  positions: Record<string, [number, number]>;
  edges: [number, number][];
  states: string[];
  state_colors: Record<string, string>;
  personalities: { name: string; color: string }[];
  theme: string;
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
}

export interface TickMessage {
  type: 'tick';
  tick: number;
  state_counts: Record<string, number>;
  breakdown: Record<string, Record<string, number>>;
  events: TickEvent[];
  node_states: Record<string, string>;
  total_agents: number;
}

// ── Analysis Report (Feature 1: AI Report Layer) ──────────────────────────

export interface AnalysisReport {
  summary: string;                          // 2-3 sentence executive summary
  timeline: string;                         // key turning points (tick-referenced)
  personalities: Record<string, string>;    // per-personality behavioral analysis
  realWorldParallel: string;                // metaphor/analogy to real events
  recommendations: string[];                // 3-5 actionable insights
}

export interface AnalysisMessage {
  type: 'analysis';
  report: AnalysisReport;
  // Legacy text field for backward compatibility
  text?: string;
}

// ── Discussion Feed Types (Feature 6: Discussion Feed) ──────────────────

export interface DiscussionComment {
  id: string;
  author: string;
  author_type: 'user' | 'agent';
  message: string;
  created_at: string;       // ISO timestamp
  agentId?: string;
}

export interface DiscussionPost {
  id: string;
  author: string;
  author_type: 'user' | 'agent';
  personality?: string;     // Optional personality name of the post author
  content: string;
  created_at: string;       // ISO timestamp
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

export interface FeedSnapshot {
  posts: DiscussionPost[];
  stats: {
    totalPosts: number;
    totalLikes: number;
    totalComments: number;
    updatedAt: string;
  };
}

export interface BeliefUpdateMessage {
  type: 'belief_update';
  agentId: string;
  beliefs: Belief[];
}

// ── Relationship Types (Feature X: Knowledge Graph Edges) ──────────────────────

export type RelationshipType = 'RELATES_TO' | 'INFLUENCES' | 'DISAGREES_WITH' | 'SUPPORTS';

export interface Relationship {
  id: string;
  simId: string;
  sourceAgentId: string;
  targetAgentId: string;
  type: RelationshipType;
  strength: number;       // 0-1 range
  narrative?: string;     // optional reason/explanation
  createdAt?: string;     // ISO timestamp
  updatedAt?: string;     // ISO timestamp
}

export interface RelationshipUpdateMessage {
  type: 'relationship_update';
  data: Relationship;
}

export type SimMessage = InitMessage | TickMessage | AnalysisMessage | FeedUpdateMessage | BeliefUpdateMessage | RelationshipUpdateMessage;

// ── API Request/Response Types ────────────────────────────────────────────

export interface ProfileLikeRequest {
  viewerId: string;
}

export interface LaunchRequest {
  theme: string;
  agent_count: number;
  topology: string;
  tick_rate: number;
  personalities: PersonalityDef[];
  seedText?: string;
  roleMix?: RoleMix;
  modelName?: string;
}

export interface GeneratePersonalitiesRequest {
  theme: string;
  description: string;
}

export interface TraitTooltipRequest {
  trait: string;
  theme: string;
  value: number;
}

export interface InjectEventRequest {
  event_type: string;
  payload: Record<string, unknown>;
}

export interface ControlRequest {
  action: 'pause' | 'resume' | 'stop' | 'set_speed';
  tick_rate?: number;
}

// ── Seed Input Types (Feature 3) ──────────────────────────────────────────

export interface SeedRequest {
  text: string;
  theme: string;
}

export interface SeedResponse {
  suggestedConfig: Partial<SimulationConfig>;
  suggestedPersonalities: PersonalityDef[];
  seedRationale: string;
}

// ── What-If Types (Feature 4) ─────────────────────────────────────────────

export interface WhatIfRequest {
  description: string;
}

export interface WhatIfResponse {
  eventType: string;
  payload: Record<string, unknown>;
  preview: string;
}

// ── Gemini Decision Types ─────────────────────────────────────────────────

export interface GeminiDecision {
  action: 'stay' | 'change';
  new_state: string;
  reason: string;
  emotional_shift?: number;
  confidence?: number;
  reasoning_trace?: ReasoningTrace;
}

// ── Decision Type ─────────────────────────────────────────────────────────

export type Decision = [string, string]; // [new_state, reason]

// ── WorldBuilder Types ────────────────────────────────────────────────────

export interface WorldBuilderRequest {
  topic: string;
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
