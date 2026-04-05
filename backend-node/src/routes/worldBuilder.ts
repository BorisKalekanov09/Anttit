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
      ideologicalGroups: worldConfig.ideologicalGroups ?? ['group_a', 'group_b', 'group_c'],
      suggested_config: {
        theme: worldConfig.suggested_theme,
        agent_count: Math.min(300, Math.max(50, worldConfig.agent_count || 80)),
        topology: 'small_world',
        tick_rate: 0.5,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[WorldBuilder] Error generating world config:', msg);
    if (stack) console.error('[WorldBuilder] Stack:', stack);

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
    } else if (normalized.includes('model') && (normalized.includes('not available') || normalized.includes('not found') || normalized.includes('decommissioned'))) {
      statusCode = 400;
      errorMessage = 'The selected model is no longer available. Please go to Settings → Model Selection and choose an active model.';
    } else if (normalized.includes('syntaxerror') || normalized.includes('json') || normalized.includes('unexpected token')) {
      statusCode = 500;
      errorMessage = 'The AI returned an invalid response. Please try again.';
    } else if (normalized.includes('aborted') || normalized.includes('timeout') || normalized.includes('econnrefused')) {
      statusCode = 503;
      errorMessage = 'Connection to AI provider timed out. Please try again.';
    } else {
      // Log unknown errors with full details for debugging
      console.error('[WorldBuilder] Unclassified error — full message:', JSON.stringify(msg));
    }

    res.status(statusCode).json({ error: errorMessage });
  }
});

export default router;
