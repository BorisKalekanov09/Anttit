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

export interface ThemeDef {
  key: string;
  name: string;
  description: string;
  states: string[];
  difficulty: 'simple' | 'medium' | 'complex';
  emoji: string;
  state_colors: Record<string, string>;
}

export interface SimConfig {
  theme: string;
  agent_count: number;
  topology: string;
  tick_rate: number;
  personalities: PersonalityDef[];
}

// WebSocket message types
export interface InitMessage {
  type: 'init';
  positions: Record<string, [number, number]>;
  edges: [number, number][];
  states: string[];
  state_colors: Record<string, string>;
  personalities: { name: string; color: string }[];
  theme: string;
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

export interface AnalysisMessage {
  type: 'analysis';
  text: string;
}

export type SimMessage = InitMessage | TickMessage | AnalysisMessage;

export interface SimState {
  simId: string;
  tick: number;
  running: boolean;
  paused: boolean;
  initData: InitMessage | null;
  latestTick: TickMessage | null;
  events: TickEvent[];
  history: TickMessage[];
  analysis: string;
}
