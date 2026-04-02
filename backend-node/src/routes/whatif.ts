import { Router, Request, Response } from 'express';
import type { WhatIfRequest, WhatIfResponse } from '../types.js';
import { generateInjection } from '../ai/gemini.js';
import { getSimulation } from '../simulation/registry.js';

const router = Router({ mergeParams: true });

const AVAILABLE_EVENT_TYPES = [
  'rumour_burst',
  'reset_random',
  'authority_speaks',
  'viral_moment',
  'network_split',
  'mass_recovery',
];

router.post('/', async (req: Request<{ simId: string }, {}, WhatIfRequest>, res: Response) => {
  try {
    const { simId } = req.params;
    const { description } = req.body;

    const engine = getSimulation(simId);
    if (!engine) {
      res.status(404).json({ error: 'Simulation not found' });
      return;
    }

    const currentStateCounts: Record<string, number> = {};
    for (const state of engine.theme.VALID_STATES) {
      currentStateCounts[state] = 0;
    }
    for (const agent of engine.agents.values()) {
      currentStateCounts[agent.state] = (currentStateCounts[agent.state] || 0) + 1;
    }

    const injection = await generateInjection(
      description,
      engine.theme.THEME_NAME,
      currentStateCounts,
      AVAILABLE_EVENT_TYPES
    );

    const response: WhatIfResponse = {
      eventType: injection.eventType,
      payload: injection.payload,
      preview: injection.preview,
    };

    res.json(response);
  } catch (error) {
    console.error('[What-If Error]', error);
    
    const errorMsg = String(error);
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED');
    
    res.json({
      eventType: 'rumour_burst',
      payload: { fraction: 0.05 },
      preview: isQuotaError
        ? 'API quota exceeded. Using default rumor spread (5% of agents affected). Try again later.'
        : 'Error generating scenario impact. Using fallback impact (5% of agents affected).',
    });
  }
});

export default router;
