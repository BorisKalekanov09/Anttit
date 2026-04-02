import { Router, Request, Response } from 'express';
import type { TraitTooltipRequest } from '../types.js';
import { traitTooltip } from '../ai/gemini.js';

const router = Router();

router.post('/', async (req: Request<{}, {}, TraitTooltipRequest>, res: Response) => {
  try {
    const { trait, theme, value } = req.body;
    const tooltip = await traitTooltip(trait, theme, value);
    res.json({ tooltip });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
