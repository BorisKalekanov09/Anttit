import { Router, Request, Response } from 'express';
import type { SeedRequest, SeedResponse } from '../types.js';
import { generateSeedConfig, generatePersonalities } from '../ai/gemini.js';

const router = Router();

router.post('/', async (req: Request<{}, {}, SeedRequest>, res: Response) => {
  try {
    const { text, theme } = req.body;

    const defaultPersonalities = await generatePersonalities(theme, text);
    
    const seedConfig = await generateSeedConfig(text, theme, defaultPersonalities);

    const response: SeedResponse = {
      suggestedConfig: {
        agentCount: seedConfig.agent_count,
        theme,
        initial_state_distribution: seedConfig.initial_state_distribution,
        seed_fraction: seedConfig.seed_fraction,
      },
      suggestedPersonalities: defaultPersonalities.map((p) => ({
        ...p,
        suggested_percentage: seedConfig.personality_mix[p.name] || p.suggested_percentage,
      })),
      seedRationale: `Based on your scenario "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}", we suggest ${seedConfig.agent_count} agents with a seed fraction of ${Math.round(seedConfig.seed_fraction * 100)}%. This distribution reflects the dynamics typically seen in ${theme} scenarios.`,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
