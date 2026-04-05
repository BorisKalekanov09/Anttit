import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { DiscussionComment, DiscussionPost } from '../types.js';
import { getSimulation } from '../simulation/registry.js';
import { readFeed, appendPost } from '../store/feedStore.js';

const router = Router({ mergeParams: true });

// ── GET /api/simulations/:simId/feed ──────────────────────────────────────
// Returns current feed snapshot with posts and stats
router.get('/', async (req: Request<{ simId: string }>, res: Response) => {
  try {
    const { simId } = req.params;

    const engine = getSimulation(simId);
    if (!engine) {
      res.status(404).json({ error: 'Simulation not found' });
      return;
    }

    const snapshot = await readFeed(simId);
    res.json(snapshot);
  } catch (error) {
    console.error('[Feed Error]', error);
    res.status(500).json({ error: String(error) });
  }
});

// ── POST /api/simulations/:simId/feed/posts ───────────────────────────────
// Create a new discussion post (agent-generated or user-initiated)
router.post('/posts', async (req: Request<{ simId: string }, {}, { title?: string; content?: string; author?: string; agentId?: string; tags?: string[] }>, res: Response) => {
  try {
    const { simId } = req.params;
    const { title = 'Untitled', content = '', author = 'Anonymous', agentId, tags = [] } = req.body;

    const engine = getSimulation(simId);
    if (!engine) {
      res.status(404).json({ error: 'Simulation not found' });
      return;
    }

    const newPost: DiscussionPost = {
      id: uuidv4(),
      title,
      content,
      author,
      author_type: agentId ? 'agent' : 'user',
      created_at: new Date().toISOString(),
      likes: 0,
      comments: [],
      tags,
      ...(agentId && { agentId }),
    };

    const createdPost = await appendPost(simId, newPost);
    
    // Record action if agent-authored
    if (agentId) {
      engine.recordAction(agentId, 'post', createdPost.id);
    }

    res.status(201).json(createdPost);
  } catch (error) {
    console.error('[Feed Create Error]', error);
    res.status(500).json({ error: String(error) });
  }
});

// ── POST /api/simulations/:simId/feed/posts/:postId/like ─────────────────
// Increment like count for a post
// Optional: agentId in body for manual agent-triggered likes
router.post('/posts/:postId/like', async (req: Request<{ simId: string; postId: string }, {}, { agentId?: string }>, res: Response) => {
  try {
    const { simId, postId } = req.params;
    const { agentId } = req.body;

    const engine = getSimulation(simId);
    if (!engine) {
      res.status(404).json({ error: 'Simulation not found' });
      return;
    }

    await engine.addFeedLike(postId, agentId);

    const feed = await engine.getDiscussionFeed();
    const updatedPost = feed.find((p: DiscussionPost) => p.id === postId);
    
    if (!updatedPost) {
      res.status(404).json({ error: `Post ${postId} not found` });
      return;
    }

    res.json(updatedPost);
  } catch (error) {
    console.error('[Feed Like Error]', error);
    const errorMsg = String(error);
    
    if (errorMsg.includes('not found')) {
      res.status(404).json({ error: errorMsg });
      return;
    }
    
    res.status(500).json({ error: errorMsg });
  }
});

// ── POST /api/simulations/:simId/feed/posts/:postId/comment ────────────────
// Add a comment to a post
// Optional: agentId in body to mark comment as agent-authored (sets author_type='agent')
router.post(
  '/posts/:postId/comment',
  async (req: Request<{ simId: string; postId: string }, {}, { author?: string; message?: string; agentId?: string }>, res: Response) => {
    try {
      const { simId, postId } = req.params;
      const { author = 'Guest', message = '', agentId } = req.body;

      const engine = getSimulation(simId);
      if (!engine) {
        res.status(404).json({ error: 'Simulation not found' });
        return;
      }

      const authorType: 'user' | 'agent' = agentId ? 'agent' : 'user';

      const comment: DiscussionComment = {
        id: uuidv4(),
        author,
        author_type: authorType,
        message,
        created_at: new Date().toISOString(),
        ...(agentId && { agentId }),
      };

      await engine.addFeedComment(postId, comment, agentId);

      const feed = await engine.getDiscussionFeed();
      const updatedPost = feed.find((p: DiscussionPost) => p.id === postId);
      
      if (!updatedPost) {
        res.status(404).json({ error: `Post ${postId} not found` });
        return;
      }

      res.json(updatedPost);
    } catch (error) {
      console.error('[Feed Comment Error]', error);
      const errorMsg = String(error);
      
      if (errorMsg.includes('not found')) {
        res.status(404).json({ error: errorMsg });
        return;
      }
      
      res.status(500).json({ error: errorMsg });
    }
  }
);

export default router;
