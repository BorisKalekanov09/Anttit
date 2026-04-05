import { Router, Request, Response } from 'express';
import type { TraitTooltipRequest } from '../types.js';
import { traitTooltip } from '../ai/gemini.js';
import { configManager } from '../lib/config-manager.js';

const router = Router();

router.post('/', async (req: Request<{}, {}, TraitTooltipRequest>, res: Response) => {
  try {
    const { trait, theme, value } = req.body;
    
    const activeModels = configManager.getActiveModels();
    const modelName = activeModels?.worldGeneration?.modelId;
    
    const tooltip = await traitTooltip(trait, theme, value, modelName);
    res.json({ tooltip });
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
