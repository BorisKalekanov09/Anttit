import type { Agent } from '../agent.js';
import type { Decision } from '../../types.js';
import { getTraits } from '../agent.js';

export const THEME_NAME = 'Political Polarization';
export const THEME_DESCRIPTION = 'Agents shift political opinions as they interact with neighbors in an ideological landscape.';
export const VALID_STATES = ['far_left', 'left', 'center', 'right', 'far_right'];
export const INITIAL_STATE = 'center';
export const SEED_STATE = 'center';
export const SEED_FRACTION = 1.0;
export const EMOJI = '🗳️';
export const DIFFICULTY: 'simple' | 'medium' | 'complex' = 'complex';

export const STATE_COLORS: Record<string, string> = {
  far_left: '#1d4ed8',
  left: '#60a5fa',
  center: '#a855f7',
  right: '#f97316',
  far_right: '#b91c1c',
};

const SPECTRUM = ['far_left', 'left', 'center', 'right', 'far_right'];

export function seedStates(agents: Map<string, Agent>): void {
  for (const agent of agents.values()) {
    const idx = Math.max(0, Math.min(4, Math.round(gaussianRandom(2, 1.2))));
    agent.state = SPECTRUM[idx];
  }
}

export function ruleDecision(agent: Agent, neighborStates: string[]): Decision {
  const state = agent.state;
  const traits = getTraits(agent);
  const currentIdx = SPECTRUM.indexOf(state);

  if (!neighborStates.length) {
    return [state, 'no neighbors'];
  }

  const neighborIdxs: number[] = [];
  for (const s of neighborStates) {
    const idx = SPECTRUM.indexOf(s);
    if (idx >= 0) neighborIdxs.push(idx);
  }

  if (!neighborIdxs.length) {
    return [state, 'neighbors have unknown states'];
  }

  const avgNeighbor = neighborIdxs.reduce((a, b) => a + b, 0) / neighborIdxs.length;
  const pull = avgNeighbor - currentIdx;

  const conformity = traits.credulity / 100.0;
  const stubbornness = traits.stubbornness / 100.0;

  let effectivePull = pull * conformity * (1.0 - stubbornness * 0.7);

  const stateCounts: Record<string, number> = {};
  for (const s of neighborStates) {
    stateCounts[s] = (stateCounts[s] || 0) + 1;
  }
  const dominant = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (dominant && (stateCounts[dominant] / neighborStates.length) > 0.7) {
    effectivePull *= 1.5;
  }

  if (Math.abs(effectivePull) > 0.5 && Math.random() < 0.3) {
    const newIdx = Math.max(0, Math.min(4, currentIdx + (effectivePull > 0 ? 1 : -1)));
    const newState = SPECTRUM[newIdx];
    if (newState !== state) {
      const direction = effectivePull > 0 ? 'right' : 'left';
      return [newState, `neighbor pressure shifted opinion ${direction}`];
    }
  }

  return [state, 'maintained current position'];
}

export function isAmbiguous(agent: Agent, neighborStates: string[]): boolean {
  if (!neighborStates.length) return false;
  
  const idxs: number[] = [];
  for (const s of neighborStates) {
    const idx = SPECTRUM.indexOf(s);
    if (idx >= 0) idxs.push(idx);
  }
  
  if (!idxs.length) return false;
  
  const mean = idxs.reduce((a, b) => a + b, 0) / idxs.length;
  const variance = idxs.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) / idxs.length;
  
  return variance > 1.0;
}

function gaussianRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdDev + mean;
}
