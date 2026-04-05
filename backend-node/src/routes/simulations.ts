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

// ── Conversations ─────────────────────────────────────────────────────────

router.get('/:simId/conversations', async (req: Request<{ simId: string }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  const conversations = await engine.getConversationLogs();
  res.json({ conversations });
});

router.get('/:simId/conversations/:agentA/:agentB', async (req: Request<{ simId: string; agentA: string; agentB: string }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  const all = await engine.getConversationLogs();
  const filtered = all.filter(c =>
    (c.agentAId === req.params.agentA && c.agentBId === req.params.agentB) ||
    (c.agentAId === req.params.agentB && c.agentBId === req.params.agentA)
  );
  res.json({ conversations: filtered });
});

// ── Causal Chain ──────────────────────────────────────────────────────────

router.get('/:simId/agents/:agentId/causal-chain', (req: Request<{ simId: string; agentId: string }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  const chain = engine.buildCausalChain(req.params.agentId);
  if (!chain) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(chain);
});

// ── Advanced Metrics ──────────────────────────────────────────────────────

router.get('/:simId/advanced-metrics', (req: Request<{ simId: string }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  const last = engine.metricsHistory[engine.metricsHistory.length - 1];
  res.json(last?.advancedMetrics ?? { polarizationIndex: 0, echoChamberScore: 0, spreadSpeed: null, influenceCentrality: {} });
});

// ── Experiment Controls ───────────────────────────────────────────────────

router.post('/:simId/experiment/assign', (req: Request<{ simId: string }, {}, { treatmentFraction?: number }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  const fraction = req.body.treatmentFraction ?? 0.5;
  engine.assignExperimentGroups(fraction);
  res.json({ status: 'ok', message: `Assigned treatment (${Math.round(fraction * 100)}%) and control groups` });
});

router.get('/:simId/experiment/groups', (req: Request<{ simId: string }>, res: Response) => {
  const engine = getSimulation(req.params.simId);
  if (!engine) {
    res.status(404).json({ error: 'Simulation not found' });
    return;
  }
  const agents = engine.getAgents();
  const groups: Record<string, { agentId: string; experimentGroup: string; state: string; personality: string }[]> = {
    control: [],
    treatment: [],
    none: [],
  };
  for (const [id, agent] of agents) {
    groups[agent.experimentGroup].push({
      agentId: id,
      experimentGroup: agent.experimentGroup,
      state: agent.state,
      personality: agent.personality.name,
    });
  }
  res.json({ groups });
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
