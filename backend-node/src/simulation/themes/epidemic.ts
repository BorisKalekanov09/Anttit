import type { Agent } from '../agent.js';
import type { Decision } from '../../types.js';
import { getTraits } from '../agent.js';

export const THEME_NAME = 'Epidemic';
export const THEME_DESCRIPTION = 'Agents get sick, recover, or die as disease spreads through contact networks.';
export const VALID_STATES = ['healthy', 'exposed', 'infected', 'recovered', 'dead'];
export const INITIAL_STATE = 'healthy';
export const SEED_STATE = 'infected';
export const SEED_FRACTION = 0.03;
export const EMOJI = '🦠';
export const DIFFICULTY: 'simple' | 'medium' | 'complex' = 'simple';

export const STATE_COLORS: Record<string, string> = {
  healthy: '#22c55e',
  exposed: '#f59e0b',
  infected: '#ef4444',
  recovered: '#3b82f6',
  dead: '#374151',
};

const TRANSMISSION_RATE = 0.4;
const RECOVERY_RATE = 0.08;
const DEATH_RATE = 0.01;

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

  if (state === 'healthy') {
    const infectedNeighbors = neighborStates.filter(
      s => s === 'infected' || s === 'exposed'
    ).length;
    const total = neighborStates.length || 1;
    const pressure = infectedNeighbors / total;
    const immuneFactor = 1.0 - traits.stubbornness / 200.0;
    
    if (Math.random() < pressure * TRANSMISSION_RATE * immuneFactor) {
      return ['exposed', `contacted infected neighbor (pressure ${Math.round(pressure * 100)}%)`];
    }
    return ['healthy', 'avoided infection'];
  }

  if (state === 'exposed') {
    const credulityFactor = traits.credulity / 100.0;
    if (Math.random() < 0.2 + credulityFactor * 0.1) {
      return ['infected', 'incubation period ended — symptomatic'];
    }
    return ['exposed', 'still incubating'];
  }

  if (state === 'infected') {
    if (Math.random() < DEATH_RATE) {
      return ['dead', 'succumbed to illness'];
    }
    if (Math.random() < RECOVERY_RATE) {
      return ['recovered', 'immune system prevailed'];
    }
    return ['infected', 'still sick'];
  }

  if (state === 'recovered') {
    return ['recovered', 'immune — recovered'];
  }

  if (state === 'dead') {
    return ['dead', 'deceased'];
  }

  return [state, 'no change'];
}

export function isAmbiguous(agent: Agent, neighborStates: string[]): boolean {
  if (!neighborStates.length || !['healthy', 'exposed'].includes(agent.state)) {
    return false;
  }
  const infected = neighborStates.filter(
    s => s === 'infected' || s === 'exposed'
  ).length;
  const pressure = infected / neighborStates.length;
  return pressure >= 0.25 && pressure <= 0.65;
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
