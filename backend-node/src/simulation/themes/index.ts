import type { Agent } from '../agent.js';
import type { Decision } from '../../types.js';

export interface ThemeModule {
  THEME_NAME: string;
  THEME_DESCRIPTION: string;
  VALID_STATES: string[];
  INITIAL_STATE: string;
  SEED_STATE: string;
  SEED_FRACTION: number;
  STATE_COLORS: Record<string, string>;
  EMOJI: string;
  DIFFICULTY: 'simple' | 'medium' | 'complex';
  seedStates(agents: Map<string, Agent>): void;
  ruleDecision(agent: Agent, neighborStates: string[]): Decision;
  isAmbiguous(agent: Agent, neighborStates: string[]): boolean;
}

import * as misinformation from './misinformation.js';
import * as epidemic from './epidemic.js';
import * as politics from './politics.js';
import * as cultural from './cultural.js';

const themes: Record<string, ThemeModule> = {
  misinformation,
  epidemic,
  politics,
  cultural,
};

export function loadTheme(themeKey: string): ThemeModule {
  return themes[themeKey] || misinformation;
}

export function getAllThemes(): ThemeModule[] {
  return Object.values(themes);
}
