import express, { type Request, type Response } from 'express';
import { configManager, type ProviderConfigRequest } from '../lib/config-manager.js';
import { createProvider } from '../lib/providers/factory.js';
import { getModelsForProvider, getAllProviders } from '../lib/model-registry.js';
import { validateEncryptionKey } from '../lib/encryption.js';
import type { ProviderType } from '../lib/model-registry.js';

const router = express.Router();

let requestCounts: Map<string, number[]> = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = requestCounts.get(ip) || [];
  const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= RATE_LIMIT_MAX) {
    return false;
  }

  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

router.use((req: Request, res: Response, next) => {
  // Only rate limit POST/DELETE requests, allow all GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Also allow validation endpoint without rate limiting
  if (req.path.includes('/validate/')) {
    return next();
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Too many requests. Maximum 5 per minute.' });
    return;
  }

  next();
});

router.get('/encryption-status', (_req: Request, res: Response) => {
  const status = validateEncryptionKey();
  if (!status.valid) {
    res.status(500).json({ error: status.message });
    return;
  }
  res.json({ valid: true, message: status.message });
});

router.get('/providers', (_req: Request, res: Response) => {
  const providers = getAllProviders();
  const configs = configManager.getAllConfigs();

  // Map provider types to display names
  const providerDisplayNames: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    groq: 'Groq',
    openrouter: 'OpenRouter',
    ollama: 'Ollama',
  };

  const providerStatus: Record<string, any> = {};
  
  providers.forEach(provider => {
    const config = configs.find(c => c.provider === provider);
    const displayName = providerDisplayNames[provider] || provider;
    
    providerStatus[displayName] = {
      status: config?.isActive ? 'connected' : (config ? 'error' : 'not_configured'),
      error: config?.validationError,
      last_validated: config?.lastValidated,
    };
  });

  res.json({ providers: providerStatus });
});

router.get('/models/:provider', (req: Request, res: Response) => {
  const { provider } = req.params;

  try {
    const models = getModelsForProvider(provider as ProviderType);
    res.json({ provider, models });
  } catch (error) {
    res.status(400).json({
      error: `Unknown provider: ${provider}`,
    });
  }
});

router.post('/save', express.json({ limit: '1kb' }), async (req: Request, res: Response) => {
  try {
    let { provider, apiKey, baseUrl, modelName } = req.body as ProviderConfigRequest;

    if (!provider) {
      res.status(400).json({ error: 'Provider is required' });
      return;
    }

    // Normalize provider name to lowercase
    provider = (provider as string).toLowerCase() as ProviderType;

    const config = configManager.saveConfig(provider, {
      provider,
      apiKey,
      baseUrl,
      modelName,
    });

    res.json({
      success: true,
      provider,
      message: 'Configuration saved (not yet validated). Run validation to confirm.',
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to save configuration',
    });
  }
});

router.post('/validate/:provider', express.json({ limit: '1kb' }), async (req: Request, res: Response) => {
  try {
    let { provider } = req.params;
    const { apiKey, baseUrl, modelName } = req.body as ProviderConfigRequest;

    if (!provider) {
      res.status(400).json({ error: 'Provider is required' });
      return;
    }

    // Normalize provider name to lowercase
    provider = provider.toLowerCase();

    try {
      const providerInstance = createProvider(provider as ProviderType, {
        apiKey: apiKey || undefined,
        baseUrl,
        modelName,
      });

      const validation = await providerInstance.validateConnection();

      if (!validation.valid) {
        configManager.updateValidationStatus(provider as ProviderType, false, validation.error);
        res.status(400).json({
          success: false,
          provider,
          error: validation.error,
        });
        return;
      }

      configManager.updateValidationStatus(provider as ProviderType, true);
      res.json({
        success: true,
        provider,
        message: 'Provider validated successfully',
      });
    } catch (validationError) {
      const errorMsg = validationError instanceof Error ? validationError.message : String(validationError);
      configManager.updateValidationStatus(provider as ProviderType, false, errorMsg);
      res.status(400).json({
        success: false,
        provider,
        error: errorMsg,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Validation failed',
    });
  }
});

router.post('/set-active-models', express.json({ limit: '1kb' }), (req: Request, res: Response) => {
  try {
    const { worldGeneration, agentDecision } = req.body as {
      worldGeneration?: { provider: string; modelId: string };
      agentDecision?: { provider: string; modelId: string };
    };

    if (!worldGeneration || !agentDecision) {
      res.status(400).json({
        error: 'Both worldGeneration and agentDecision must be specified',
      });
      return;
    }

    configManager.setActiveModels(
      worldGeneration.provider as ProviderType,
      worldGeneration.modelId,
      agentDecision.provider as ProviderType,
      agentDecision.modelId
    );

    res.json({
      success: true,
      message: 'Active models configured',
      config: configManager.getActiveModels(),
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to set active models',
    });
  }
});

router.get('/active-models', (_req: Request, res: Response) => {
  try {
    const config = configManager.getActiveModels();
    res.json(config);
  } catch (error) {
    res.status(400).json({
      error: 'No active model configuration set',
    });
  }
});

router.delete('/:provider', (req: Request, res: Response) => {
  const provider = req.params.provider.toLowerCase();
  configManager.deleteConfig(provider as ProviderType);
  res.json({
    success: true,
    message: `Configuration for ${provider} deleted`,
  });
});

export default router;
