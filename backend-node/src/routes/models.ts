import { Router } from 'express';

const router = Router();

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fast and efficient model for simulation decisions' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Balanced speed and capability' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable model for complex reasoning' },
];

router.get('/', (_req, res) => {
  res.json({ models: AVAILABLE_MODELS });
});

export default router;
