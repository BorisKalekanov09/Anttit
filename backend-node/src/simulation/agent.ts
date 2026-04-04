import type { PersonalityDef, AgentRole, EpisodicEntry, Belief, AgentAction } from '../types.js';

export interface AgentPersonality {
  name: string;
  description: string;
  credulity: number;
  influence: number;
  stubbornness: number;
  activity: number;
  color: string;
}

export interface Agent {
  agentId: string;
  personality: AgentPersonality;
  state: string;
  role: AgentRole;
  memory: string[];
  memorySummary: string;
  ticksSinceCompression: number;
  usedGeminiRecently: boolean;
  episodicMemory: EpisodicEntry[];
  emotionalState: number;
  socialTies: Map<string, 'trust' | 'distrust'>;
  resistantBias: boolean;
  followerThreshold: number;
  beliefs: Belief[];
  actionLog: AgentAction[];
}

const MEMORY_MAX_LENGTH = 40;

export function createAgent(
  agentId: string,
  personalityDef: PersonalityDef,
  initialState: string,
  role: AgentRole = 'default'
): Agent {
  return {
    agentId,
    personality: {
      name: personalityDef.name,
      description: personalityDef.description || '',
      credulity: personalityDef.credulity ?? 50,
      influence: personalityDef.influence ?? 50,
      stubbornness: personalityDef.stubbornness ?? 50,
      activity: personalityDef.activity ?? 50,
      color: personalityDef.color || '#888888',
    },
    state: initialState,
    role,
    memory: [],
    memorySummary: '',
    ticksSinceCompression: 0,
    usedGeminiRecently: false,
    episodicMemory: [],
    emotionalState: 0,
    socialTies: new Map(),
    resistantBias: role === 'skeptic',
    followerThreshold: role === 'follower' ? 0.6 : 0.8,
    beliefs: [],
    actionLog: [],
  };
}

export function addMemory(agent: Agent, event: string): void {
  agent.memory.push(event);
  if (agent.memory.length > MEMORY_MAX_LENGTH) {
    agent.memory.shift();
  }
}

export function addEpisodicMemory(
  agent: Agent, 
  entry: EpisodicEntry
): void {
  agent.episodicMemory.push(entry);
}

export function getTraits(agent: Agent): Record<string, number> {
  return {
    credulity: agent.personality.credulity,
    influence: agent.personality.influence,
    stubbornness: agent.personality.stubbornness,
    activity: agent.personality.activity,
  };
}

export function canCompressMemory(agent: Agent): boolean {
  return agent.role !== 'bot';
}

export function canBecomeResistant(agent: Agent): boolean {
  return agent.role !== 'bot';
}

export function shouldSpreadState(agent: Agent): boolean {
  return agent.role === 'bot';
}

export function applyRoleModifiers(agent: Agent): void {
  switch (agent.role) {
    case 'influencer':
      agent.personality.activity = Math.max(agent.personality.activity, 80);
      break;
    case 'skeptic':
      agent.personality.credulity = Math.min(agent.personality.credulity, 20);
      agent.resistantBias = true;
      break;
    case 'follower':
      agent.personality.activity = 10;
      agent.followerThreshold = 0.6;
      break;
    case 'bot':
      break;
    default:
      break;
  }
}
