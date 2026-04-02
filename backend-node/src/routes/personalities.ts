import { Router, Request, Response } from 'express';
import type { GeneratePersonalitiesRequest } from '../types.js';
import { generatePersonalities } from '../ai/gemini.js';

const router = Router();

router.post('/', async (req: Request<{}, {}, GeneratePersonalitiesRequest>, res: Response) => {
  try {
    const { theme, description } = req.body;
    const personalities = await generatePersonalities(theme, description);
    res.json({ personalities });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
