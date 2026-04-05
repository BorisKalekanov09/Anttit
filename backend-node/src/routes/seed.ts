import { Router, Request, Response } from 'express';
import type { SeedRequest, SeedResponse } from '../types.js';
import { generateSeedConfig, generatePersonalities } from '../ai/gemini.js';
import { configManager } from '../lib/config-manager.js';

const router = Router();

router.post('/', async (req: Request<{}, {}, SeedRequest>, res: Response) => {
  try {
    const { text, theme } = req.body;
    
    const activeModels = configManager.getActiveModels();
    const modelName = activeModels?.worldGeneration?.modelId;

    const defaultPersonalities = await generatePersonalities(theme, text, modelName);
    
    const seedConfig = await generateSeedConfig(text, theme, defaultPersonalities, modelName);

    const response: SeedResponse = {
      suggestedConfig: {
        agentCount: seedConfig.agent_count,
        theme,
        initial_state_distribution: seedConfig.initial_state_distribution,
        seed_fraction: seedConfig.seed_fraction,
        ideologicalGroups: seedConfig.ideologicalGroups,
      },
      suggestedPersonalities: defaultPersonalities.map((p) => ({
        ...p,
        suggested_percentage: seedConfig.personality_mix[p.name] || p.suggested_percentage,
      })),
      seedRationale: `Based on your scenario "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}", we suggest ${seedConfig.agent_count} agents with a seed fraction of ${Math.round(seedConfig.seed_fraction * 100)}%. This distribution reflects the dynamics typically seen in ${theme} scenarios.`,
      ideologicalGroups: seedConfig.ideologicalGroups,
    };

    res.json(response);
  } catch (error) {
    const errorMsg = String(error);
    if (errorMsg.includes('API_QUOTA_EXCEEDED')) {
      res.status(429).json({ error: 'API quota exhausted. Please wait a few minutes before trying again.' });
      return;
    }
    res.status(500).json({ error: String(error) });
  }
});

export default router;
