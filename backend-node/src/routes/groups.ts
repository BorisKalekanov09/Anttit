import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AgentGroup, GroupMessage } from '../types.js';
import { getSimulation } from '../simulation/registry.js';
import {
  getGroups,
  createGroup,
  addMember,
  removeMember,
  appendGroupMessage,
  getGroupMessages,
} from '../store/groupStore.js';

const router = Router({ mergeParams: true });

// GET /api/simulations/:simId/groups
router.get('/', async (req: Request<{ simId: string }>, res: Response) => {
  try {
    const { simId } = req.params;
    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }
    const groups = await getGroups(simId);
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/simulations/:simId/groups
// Body: { name, createdBy, initialMembers?, sharedBelief?, description? }
router.post('/', async (
  req: Request<{ simId: string }, {}, { name?: string; createdBy?: string; initialMembers?: string[]; sharedBelief?: string; description?: string }>,
  res: Response
) => {
  try {
    const { simId } = req.params;
    const { name = 'Unnamed Group', createdBy = '', initialMembers = [], sharedBelief, description } = req.body;

    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }

    const group: AgentGroup = {
      id: uuidv4(),
      simId,
      name,
      description,
      memberIds: [...new Set([createdBy, ...initialMembers].filter(Boolean))],
      createdBy,
      createdAt: new Date().toISOString(),
      sharedBelief,
    };

    await createGroup(simId, group);

    // Broadcast updated group list
    const groups = await getGroups(simId);
    engine.emitGroupUpdate(groups);

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/simulations/:simId/groups/:groupId/join
// Body: { agentId }
router.post('/:groupId/join', async (
  req: Request<{ simId: string; groupId: string }, {}, { agentId?: string }>,
  res: Response
) => {
  try {
    const { simId, groupId } = req.params;
    const { agentId } = req.body;
    if (!agentId) { res.status(400).json({ error: 'agentId required' }); return; }

    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }

    const updated = await addMember(simId, groupId, agentId);
    if (!updated) { res.status(404).json({ error: 'Group not found' }); return; }

    const groups = await getGroups(simId);
    engine.emitGroupUpdate(groups);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/simulations/:simId/groups/:groupId/leave
// Body: { agentId }
router.post('/:groupId/leave', async (
  req: Request<{ simId: string; groupId: string }, {}, { agentId?: string }>,
  res: Response
) => {
  try {
    const { simId, groupId } = req.params;
    const { agentId } = req.body;
    if (!agentId) { res.status(400).json({ error: 'agentId required' }); return; }

    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }

    await removeMember(simId, groupId, agentId);

    const groups = await getGroups(simId);
    engine.emitGroupUpdate(groups);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/simulations/:simId/groups/:groupId/messages
router.get('/:groupId/messages', async (req: Request<{ simId: string; groupId: string }>, res: Response) => {
  try {
    const { simId, groupId } = req.params;
    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }

    const messages = await getGroupMessages(simId, groupId);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/simulations/:simId/groups/:groupId/messages
// Body: { agentId, content }
router.post('/:groupId/messages', async (
  req: Request<{ simId: string; groupId: string }, {}, { agentId?: string; content?: string }>,
  res: Response
) => {
  try {
    const { simId, groupId } = req.params;
    const { agentId, content = '' } = req.body;
    if (!agentId) { res.status(400).json({ error: 'agentId required' }); return; }

    const engine = getSimulation(simId);
    if (!engine) { res.status(404).json({ error: 'Simulation not found' }); return; }

    const agents = engine.getAgents();
    const agent = agents.get(agentId);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

    const groups = await getGroups(simId);
    const group = groups.find(g => g.id === groupId);
    if (!group) { res.status(404).json({ error: 'Group not found' }); return; }
    if (!group.memberIds.includes(agentId)) { res.status(403).json({ error: 'Agent is not a member of this group' }); return; }

    const msg: GroupMessage = {
      id: uuidv4(),
      groupId,
      simId,
      authorId: agentId,
      author: agent.personality.name,
      content,
      createdAt: new Date().toISOString(),
    };

    await appendGroupMessage(simId, msg);

    const updatedGroups = await getGroups(simId);
    engine.emitGroupUpdate(updatedGroups, msg);

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
