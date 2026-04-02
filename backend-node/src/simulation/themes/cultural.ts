import type { Agent } from '../agent.js';
import type { Decision } from '../../types.js';
import { getTraits } from '../agent.js';

export const THEME_NAME = 'Cultural Trends';
export const THEME_DESCRIPTION = 'Agents adopt, spread, or abandon cultural trends as they diffuse through social networks.';
export const VALID_STATES = ['traditional', 'curious', 'early_adopter', 'trendy', 'burned_out'];
export const INITIAL_STATE = 'traditional';
export const SEED_STATE = 'early_adopter';
export const SEED_FRACTION = 0.05;
export const EMOJI = '🎭';
export const DIFFICULTY: 'simple' | 'medium' | 'complex' = 'medium';

export const STATE_COLORS: Record<string, string> = {
  traditional: '#78716c',
  curious: '#a3e635',
  early_adopter: '#06b6d4',
  trendy: '#ec4899',
  burned_out: '#6b7280',
};

export function seedStates(agents: Map<string, Agent>): void {
  const ids = Array.from(agents.keys());
  shuffleArray(ids);
  const seedCount = Math.max(1, Math.floor(ids.length * SEED_FRACTION));
  
  ids.forEach((id, i) => {
    const agent = agents.get(id)!;
    agent.state = i < seedCount ? SEED_STATE : INITIAL_STATE;
  });
}

export function ruleDecision(agent: Agent, neighborStates: string[]): Decision {
  const state = agent.state;
  const traits = getTraits(agent);
  const credulity = traits.credulity / 100.0;
  const stubbornness = traits.stubbornness / 100.0;
  const activity = traits.activity / 100.0;

  const trendyCount = neighborStates.filter(
    s => s === 'trendy' || s === 'early_adopter'
  ).length;
  const total = neighborStates.length || 1;
  const trendPressure = trendyCount / total;

  if (state === 'traditional') {
    if (Math.random() < trendPressure * credulity * 0.4) {
      return ['curious', 'noticed trend in social circle'];
    }
    return ['traditional', 'uninterested in trends'];
  }

  if (state === 'curious') {
    if (Math.random() < trendPressure * credulity * 0.5) {
      return ['early_adopter', 'decided to try the trend'];
    }
    if (Math.random() < stubbornness * 0.1) {
      return ['traditional', 'reverted to traditional ways'];
    }
    return ['curious', 'still considering'];
  }

  if (state === 'early_adopter') {
    if (trendPressure > 0.5 && Math.random() < activity * 0.3) {
      return ['trendy', 'trend went mainstream'];
    }
    return ['early_adopter', 'still on cutting edge'];
  }

  if (state === 'trendy') {
    if (Math.random() < 0.05 + (1 - stubbornness) * 0.05) {
      return ['burned_out', 'trend fatigue set in'];
    }
    return ['trendy', 'enjoying the trend'];
  }

  if (state === 'burned_out') {
    if (Math.random() < stubbornness * 0.03) {
      return ['traditional', 'returned to roots'];
    }
    return ['burned_out', 'exhausted by constant trends'];
  }

  return [state, 'no change'];
}

export function isAmbiguous(agent: Agent, neighborStates: string[]): boolean {
  if (!neighborStates.length || !['curious', 'traditional'].includes(agent.state)) {
    return false;
  }
  const trendy = neighborStates.filter(
    s => s === 'trendy' || s === 'early_adopter'
  ).length;
  const pressure = trendy / neighborStates.length;
  return pressure >= 0.3 && pressure <= 0.6;
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
