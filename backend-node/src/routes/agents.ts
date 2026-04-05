import { Router, Request, Response } from 'express';
import type { AgentProfile, Belief } from '../types.js';
import { getSimulation } from '../simulation/registry.js';
import * as profileLikeStore from '../store/profileLikeStore.js';

// Type guard for errors with statusCode property - no type assertions
function isConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (!('statusCode' in error)) return false;
  
  const descriptor = Object.getOwnPropertyDescriptor(error, 'statusCode');
  return descriptor?.value === 409;
}

const router = Router({ mergeParams: true });

// ── GET /api/simulations/:simId/agents/:agentId/details ──────────────────────
// Returns detailed agent information: beliefs, memory, connections, and influence
router.get(
  '/:agentId/details',
  async (req: Request<{ simId: string; agentId: string }>, res: Response) => {
    try {
      const { simId, agentId } = req.params;

      const engine = getSimulation(simId);
      if (!engine) {
        res.status(404).json({ error: 'Simulation not found' });
        return;
      }

      const agent = engine.agents.get(agentId);
      if (!agent) {
        res.status(404).json({ error: `Agent ${agentId} not found` });
        return;
      }

      const neighbors = engine.getNeighbors(agentId);
      const neighborAgents = neighbors.map(nId => {
        const neighbor = engine.agents.get(nId)!;
        const relationshipType = agent.socialTies.get(nId) || 'neutral';
        return {
          id: nId,
          personality: neighbor.personality.name,
          role: neighbor.role,
          state: neighbor.state,
          influence: neighbor.personality.influence,
          relationshipType,
          recentActivity: neighbor.memory.slice(-3), // Last 3 memories for context
        };
      });

      const recentEpisodicEvents = agent.episodicMemory.slice(-10).map(e => ({
        tick: e.tick,
        event: e.event,
        impact: e.impact,
        description: e.description || '',
      }));

      res.json({
        id: agentId,
        personality: agent.personality.name,
        state: agent.state,
        emotionalState: agent.emotionalState,
        memorySummary: agent.memorySummary,
        recentMemory: recentEpisodicEvents,
        beliefs: agent.beliefs,
        connectedAgents: neighborAgents,
        tick: engine.tick,
      });
    } catch (error) {
      console.error('[Agent Details Error]', error);
      res.status(500).json({ error: String(error) });
    }
  }
);

// ── GET /api/simulations/:simId/agents/:agentId ──────────────────────────────
// Returns agent profile: role, personality, beliefs, and like count
router.get('/:agentId', async (req: Request<{ simId: string; agentId: string }>, res: Response) => {
  try {
    const { simId, agentId } = req.params;

    const engine = getSimulation(simId);
    if (!engine) {
      res.status(404).json({ error: 'Simulation not found' });
      return;
    }

    const agent = engine.agents.get(agentId);
    if (!agent) {
      res.status(404).json({ error: `Agent ${agentId} not found` });
      return;
    }

    // Get the like count for this agent
    const likeCount = await profileLikeStore.getProfileLikeCount(simId, agentId);
    let viewerHasLiked = false;

    if (req.viewerId) {
      try {
        viewerHasLiked = await profileLikeStore.hasLikedProfile(simId, agentId, req.viewerId);
      } catch {
        viewerHasLiked = false;
      }
    }

    const profile: AgentProfile = {
      id: agentId,
      role: agent.role,
      personality: agent.personality.name,
      beliefs: agent.beliefs,
      profileLikes: likeCount,
      viewerHasLiked,
    };

    res.json(profile);
  } catch (error) {
    console.error('[Agent Profile Error]', error);
    res.status(500).json({ error: String(error) });
  }
});

// ── GET /api/simulations/:simId/agents/:agentId/timeline ─────────────────────
// Returns paginated timeline of agent actions/events (episodic memory + action log)
// Query params: offset=0, limit=20
router.get(
  '/:agentId/timeline',
  async (req: Request<{ simId: string; agentId: string }, {}, {}, { offset?: string; limit?: string }>, res: Response) => {
    try {
      const { simId, agentId } = req.params;
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));

      const engine = getSimulation(simId);
      if (!engine) {
        res.status(404).json({ error: 'Simulation not found' });
        return;
      }

      const agent = engine.agents.get(agentId);
      if (!agent) {
        res.status(404).json({ error: `Agent ${agentId} not found` });
        return;
      }

      // Build unified timeline from episodic memory and action log
      // Map both to same shape: { timestamp: string, event: string }
      const episodicItems = agent.episodicMemory.map(entry => ({
        timestamp: entry.createdAt || new Date().toISOString(),
        event: entry.event,
      }));

      const actionItems = agent.actionLog.map(action => ({
        timestamp: action.createdAt,
        event: `${action.actionType} action${action.feedPostId ? ` on post ${action.feedPostId}` : ''}`,
      }));

      // Combine and sort by timestamp (newest first)
      const allItems = [...episodicItems, ...actionItems].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Apply pagination
      const total = allItems.length;
      const paginated = allItems.slice(offset, offset + limit);

      res.json({
        agentId,
        timeline: paginated,
        pagination: {
          offset,
          limit,
          total,
          hasMore: offset + limit < total,
        },
      });
    } catch (error) {
      console.error('[Agent Timeline Error]', error);
      const errorMsg = String(error);

      if (errorMsg.includes('not found')) {
        res.status(404).json({ error: errorMsg });
        return;
      }

      res.status(500).json({ error: errorMsg });
    }
  }
);

// ── POST /api/simulations/:simId/agents/:agentId/profile-like ────────────────
// Add a like to an agent's profile with viewerId enforcement
// viewerId is enforced from req.viewerId (middleware), ignoring any body overrides
// Returns 409 if viewerId has already liked this agent
router.post(
  '/:agentId/profile-like',
  async (req: Request<{ simId: string; agentId: string }>, res: Response) => {
    try {
      const { simId, agentId } = req.params;
      const viewerId = req.viewerId; // Enforce viewerId from middleware

      const engine = getSimulation(simId);
      if (!engine) {
        res.status(404).json({ error: 'Simulation not found' });
        return;
      }

      const agent = engine.agents.get(agentId);
      if (!agent) {
        res.status(404).json({ error: `Agent ${agentId} not found` });
        return;
      }

      // Attempt to add the like
      await profileLikeStore.addProfileLike(simId, agentId, viewerId);

      // Return updated profile
      const likeCount = await profileLikeStore.getProfileLikeCount(simId, agentId);

      const profile: AgentProfile = {
        id: agentId,
        role: agent.role,
        personality: agent.personality.name,
        beliefs: agent.beliefs,
        profileLikes: likeCount,
        viewerHasLiked: true,
      };

      res.status(201).json(profile);
    } catch (error) {
      console.error('[Profile Like Error]', error);
      const errorMsg = String(error);

      // Check for 409 Conflict (duplicate like)
      if (isConflictError(error)) {
        res.status(409).json({ error: errorMsg });
        return;
      }

      if (errorMsg.includes('not found')) {
        res.status(404).json({ error: errorMsg });
        return;
      }

      res.status(500).json({ error: errorMsg });
    }
  }
);

export default router;
