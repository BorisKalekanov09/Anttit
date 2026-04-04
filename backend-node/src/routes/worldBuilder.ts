import express from 'express';
import { generateWorldConfig, generatePersonalitiesForWorld, getDefaultStateDistribution } from '../ai/worldBuilder.js';

const router = express.Router();

/**
 * POST /api/world-builder/generate
 * Accepts a natural language topic and generates a full simulation configuration.
 */
router.post('/generate', async (req, res) => {
  const { topic } = req.body as { topic?: string };

  if (!topic || typeof topic !== 'string' || topic.trim().length < 5) {
    res.status(400).json({ error: 'Topic must be at least 5 characters' });
    return;
  }

  try {
    // Step 1: Generate world meta-config from topic (theme suggestion, concepts, etc.)
    const worldConfig = await generateWorldConfig(topic.trim());

    // Step 2: Generate personalities tailored to the topic (parallel with nothing else)
    const personalities = await generatePersonalitiesForWorld(topic.trim(), worldConfig.key_concepts);

    // Step 3: Get default state distribution for the suggested theme (no extra API call needed)
    const distribution = getDefaultStateDistribution(worldConfig.suggested_theme);

    res.json({
      topic: worldConfig.topic,
      scenario_description: worldConfig.scenario_description,
      agent_count: Math.min(300, Math.max(50, worldConfig.agent_count || 80)),
      key_concepts: worldConfig.key_concepts,
      personality_archetypes: personalities,
      initial_state_distribution: distribution,
      suggested_config: {
        theme: worldConfig.suggested_theme,
        agent_count: Math.min(300, Math.max(50, worldConfig.agent_count || 80)),
        topology: 'small_world',
        tick_rate: 0.5,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[WorldBuilder] Error generating world config:', msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
