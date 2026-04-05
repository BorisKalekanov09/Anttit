import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { LaunchRequest, ControlRequest, InjectEventRequest, SimulationConfig } from '../types.js';
import { createSimulation, getSimulation, listSimulations, removeSimulation } from '../simulation/registry.js';

const router = Router();

router.post('/', async (req: Request<{}, {}, LaunchRequest>, res: Response) => {
  try {
    const body = req.body;
    const simId = uuidv4().slice(0, 8);

    const personalities = [...body.personalities];
    const total = personalities.reduce((sum, p) => sum + p.suggested_percentage, 0);
    if (total > 0 && total !== 100) {
      personalities.forEach(p => {
        p.suggested_percentage = Math.round((p.suggested_percentage * 100) / total);
      });
      const diff = 100 - personalities.reduce((sum, p) => sum + p.suggested_percentage, 0);
      personalities[0].suggested_percentage += diff;
    }

    const config: SimulationConfig = {
      simId,
      theme: body.theme,
      agentCount: Math.min(body.agent_count, 1000),
      topology: body.topology as SimulationConfig['topology'],
      tickRate: body.tick_rate,
      personalities,
      modelName: body.modelName || 'gemini-2.5-flash-lite',
      aiAgentsPerTick: 20,
      seedText: body.seedText,
      roleMix: body.roleMix,
    };

    const engine = await createSimulation(config);
    engine.start();

    res.json({ sim_id: simId });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.get('/', (_req: Request, res: Response) => {
  res.json({ simulations: listSimulations() });
});

router.get('/:simId/snapshot', (req: Request<{ simId: string }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.json(engine.snapshot());
});

router.get('/:simId/metrics', (req: Request<{ simId: string }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.json({
    apiCallCount: engine.apiCallCount,
    totalTokensUsed: engine.totalTokensUsed,
  });
});

router.post('/:simId/control', async (req: Request<{ simId: string }, {}, ControlRequest>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }

  const { action, tick_rate } = req.body;

  switch (action) {
    case 'pause':
      engine.pause();
      break;
    case 'resume':
      engine.resume();
      break;
    case 'stop':
      engine.stop();
      await engine.generateFinalAnalysis();
      break;
    case 'set_speed':
      if (tick_rate !== undefined) {
        engine.setTickRate(tick_rate);
      }
      break;
  }

  res.json({ status: 'ok' });
});

router.post('/:simId/inject', (req: Request<{ simId: string }, {}, InjectEventRequest>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }

  engine.inject(req.body.event_type, req.body.payload);
  res.json({ status: 'ok' });
});

router.post('/:simId/inject-belief', (req: Request<{ simId: string }, {}, { belief: string }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }

  const { belief } = req.body;
  if (!belief || !belief.trim()) {
    res.status(400).json({ error: 'Belief text is required' });
    return;
  }

  engine.inject('belief_injection', { belief: belief.trim() });
  res.json({ status: 'ok', message: 'Belief injected to all agents' });
});

router.delete('/:simId', (req: Request<{ simId: string }>, res: Response) => {
  const removed = removeSimulation(req.params.simId);
  if (!removed) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  res.json({ status: 'ok' });
});

export default router;
