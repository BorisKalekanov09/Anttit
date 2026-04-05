import express from 'express';
import { generateWorldConfig, generatePersonalitiesForWorld, getDefaultStateDistribution } from '../ai/worldBuilder.js';
import { configManager } from '../lib/config-manager.js';
import { createProvider } from '../lib/providers/factory.js';
import { getModelInfo } from '../lib/model-registry.js';
import type { ProviderType } from '../lib/model-registry.js';

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
    const trimmedTopic = topic.trim();
    let provider: ProviderType;
    let modelId: string;
    let apiKey: string | null = null;
    let baseUrl: string | undefined;
    let modelName: string | undefined;

    try {
      const activeConfig = configManager.getActiveModels();
      provider = activeConfig.worldGeneration.provider;
      modelId = activeConfig.worldGeneration.modelId;

      const providerConfig = configManager.getConfig(provider);
      if (!providerConfig) {
        throw new Error(`INVALID_CONFIG: No configuration found for ${provider}`);
      }

      apiKey = configManager.getDecryptedKey(provider);
      baseUrl = providerConfig.baseUrl;
      modelName = providerConfig.modelName;
    } catch (error) {
      if (process.env.GEMINI_API_KEY) {
        provider = 'google';
        modelId = 'gemini-2.0-flash-lite';
        apiKey = process.env.GEMINI_API_KEY;
      } else {
        throw new Error('INVALID_CONFIG: No LLM provider configured. Please set up an API key in Settings.');
      }
    }

    if (provider !== 'ollama' && !apiKey) {
      throw new Error(`INVALID_CONFIG: Missing API key for ${provider}. Please update your configuration.`);
    }

    if (!getModelInfo(provider, modelId)) {
      throw new Error(`MODEL_NOT_FOUND: Model "${modelId}" not available for ${provider}.`);
    }

    const providerInstance = createProvider(provider, {
      apiKey: apiKey || undefined,
      baseUrl,
      modelName,
    });

    const worldConfig = await generateWorldConfig(providerInstance, modelId, trimmedTopic);
    const personalities = await generatePersonalitiesForWorld(
      providerInstance,
      modelId,
      trimmedTopic,
      worldConfig.key_concepts
    );
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

    const normalized = msg.toLowerCase();
    let statusCode = 500;
    let errorMessage = 'Failed to generate world configuration.';

    if (msg.startsWith('INVALID_CONFIG:')) {
      statusCode = 400;
      errorMessage = msg.replace('INVALID_CONFIG:', '').trim();
    } else if (msg.startsWith('MODEL_NOT_FOUND:')) {
      statusCode = 400;
      errorMessage = msg.replace('MODEL_NOT_FOUND:', '').trim();
    } else if (msg.startsWith('INVALID_KEY:')) {
      statusCode = 401;
      errorMessage = msg.replace('INVALID_KEY:', '').trim();
    } else if (
      normalized.includes('rate limit') ||
      normalized.includes('quota') ||
      normalized.includes('resource_exhausted') ||
      normalized.includes('429')
    ) {
      statusCode = 429;
      errorMessage = 'Rate limit exceeded. Please try again later.';
    } else if (
      normalized.includes('invalid api key') ||
      normalized.includes('401') ||
      normalized.includes('403')
    ) {
      statusCode = 401;
      errorMessage = 'Invalid API key. Please update your provider configuration.';
    } else if (normalized.includes('model') && (normalized.includes('not available') || normalized.includes('not found'))) {
      statusCode = 400;
      errorMessage = 'Model not found for the selected provider. Please choose a valid model.';
    }

    res.status(statusCode).json({ error: errorMessage });
  }
});

export default router;
