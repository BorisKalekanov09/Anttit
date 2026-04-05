import type { Agent } from '../agent.js';
import type { Decision } from '../../types.js';
import { getTraits } from '../agent.js';

export const THEME_NAME = 'Misinformation Spread';
export const THEME_DESCRIPTION = 'Agents share and believe/disbelieve news as it spreads through their social network.';
export const VALID_STATES = ['unaware', 'exposed', 'believer', 'resistant'];
export const INITIAL_STATE = 'unaware';
export const SEED_STATE = 'believer';
export const SEED_FRACTION = 0.05;
export const EMOJI = '📰';
export const DIFFICULTY: 'simple' | 'medium' | 'complex' = 'medium';

export const STATE_COLORS: Record<string, string> = {
  unaware: '#64748b',
  exposed: '#f59e0b',
  believer: '#ef4444',
  resistant: '#22c55e',
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
  const credulity = traits.credulity;
  const stubbornness = traits.stubbornness;

  const believerCount = neighborStates.filter(s => s === 'believer').length;
  const exposedCount = neighborStates.filter(s => s === 'exposed').length;
  const total = neighborStates.length || 1;
  const pressure = (believerCount + exposedCount) / total;

  if (state === 'unaware') {
    const threshold = 0.4 - (credulity / 100.0) * 0.25;
    if (pressure > threshold) {
      return ['exposed', `exposure pressure ${Math.round(pressure * 100)}% exceeded threshold`];
    }
    return ['unaware', 'insufficient neighbor pressure'];
  }

  if (state === 'exposed') {
    const acceptThreshold = 0.5 - credulity / 200.0;
    if (pressure > acceptThreshold) {
      return ['believer', 'enough believers around — convinced'];
    }
    if (Math.random() < stubbornness / 150.0) {
      return ['resistant', 'personal skepticism triggered'];
    }
    return ['exposed', 'still evaluating'];
  }

  if (state === 'believer') {
    if (Math.random() < stubbornness / 300.0) {
      return ['resistant', 'eventually questioned belief'];
    }
    return ['believer', 'reinforced by social network'];
  }

  if (state === 'resistant') {
    return ['resistant', 'immune — already evaluated and rejected'];
  }

  return [state, 'no change'];
}

export function isAmbiguous(agent: Agent, neighborStates: string[]): boolean {
  if (!neighborStates.length) return false;
  const believerCount = neighborStates.filter(s => s === 'believer').length;
  const pressure = believerCount / neighborStates.length;
  return pressure >= 0.3 && pressure <= 0.7 && ['exposed', 'unaware'].includes(agent.state);
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
