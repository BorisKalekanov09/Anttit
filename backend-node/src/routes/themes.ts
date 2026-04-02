import { Router } from 'express';
import type { ThemeDef } from '../types.js';

const router = Router();

const THEMES: ThemeDef[] = [
  {
    key: 'misinformation',
    name: 'Misinformation Spread',
    description: 'Agents share and believe/disbelieve news as it spreads through their social network.',
    states: ['unaware', 'exposed', 'believer', 'resistant'],
    difficulty: 'medium',
    emoji: '📰',
    state_colors: {
      unaware: '#64748b',
      exposed: '#f59e0b',
      believer: '#ef4444',
      resistant: '#22c55e',
    },
  },
  {
    key: 'epidemic',
    name: 'Epidemic',
    description: 'Agents get sick, recover, or die as disease spreads through contact networks.',
    states: ['healthy', 'exposed', 'infected', 'recovered', 'dead'],
    difficulty: 'simple',
    emoji: '🦠',
    state_colors: {
      healthy: '#22c55e',
      exposed: '#f59e0b',
      infected: '#ef4444',
      recovered: '#3b82f6',
      dead: '#374151',
    },
  },
  {
    key: 'politics',
    name: 'Political Polarization',
    description: 'Agents shift political opinions as they interact with neighbors in an ideological landscape.',
    states: ['far_left', 'left', 'center', 'right', 'far_right'],
    difficulty: 'complex',
    emoji: '🗳️',
    state_colors: {
      far_left: '#1d4ed8',
      left: '#60a5fa',
      center: '#a855f7',
      right: '#f97316',
      far_right: '#b91c1c',
    },
  },
  {
    key: 'cultural',
    name: 'Cultural Trends',
    description: 'Agents adopt, spread, or abandon cultural trends as they diffuse through social networks.',
    states: ['traditional', 'curious', 'early_adopter', 'trendy', 'burned_out'],
    difficulty: 'medium',
    emoji: '🎭',
    state_colors: {
      traditional: '#78716c',
      curious: '#a3e635',
      early_adopter: '#06b6d4',
      trendy: '#ec4899',
      burned_out: '#6b7280',
    },
  },
];

router.get('/', (_req, res) => {
  res.json(THEMES);
});

export default router;
