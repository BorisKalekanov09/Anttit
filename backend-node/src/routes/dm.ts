import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { DirectMessage } from '../types.js';
import { getSimulation } from '../simulation/registry.js';
import { appendDM, getConversation, getAgentDMs } from '../store/dmStore.js';

const router = Router({ mergeParams: true });

// GET /api/simulations/:simId/dms/conversation/:agentA/:agentB
router.get('/conversation/:agentA/:agentB', async (req: Request<{ simId: string; agentA: string; agentB: string }>, res: Response) => {
  try {
    const { simId, agentA, agentB } = req.params;
    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }

    const dms = await getConversation(simId, agentA, agentB);
    res.json({ dms });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/simulations/:simId/dms/agent/:agentId
router.get('/agent/:agentId', async (req: Request<{ simId: string; agentId: string }>, res: Response) => {
  try {
    const { simId, agentId } = req.params;
    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }

    const dms = await getAgentDMs(simId, agentId);
    res.json({ dms });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/simulations/:simId/dms
// Body: { fromAgentId, toAgentId, content }
router.post('/', async (req: Request<{ simId: string }, {}, { fromAgentId?: string; toAgentId?: string; content?: string }>, res: Response) => {
  try {
    const { simId } = req.params;
    const { fromAgentId, toAgentId, content = '' } = req.body;

    if (!fromAgentId || !toAgentId) {
      res.status(400).json({ error: 'fromAgentId and toAgentId are required' });
      return;
    }

    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }

    const agents = engine.getAgents();
    const fromAgent = agents.get(fromAgentId);
    const toAgent = agents.get(toAgentId);

    if (!fromAgent || !toAgent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const dm: DirectMessage = {
      id: uuidv4(),
      simId,
      fromAgentId,
      toAgentId,
      fromAuthor: fromAgent.personality.name,
      toAuthor: toAgent.personality.name,
      content,
      createdAt: new Date().toISOString(),
    };

    await appendDM(simId, dm);

    // Broadcast via WebSocket
    engine.emitDMUpdate(dm);

    res.status(201).json(dm);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
