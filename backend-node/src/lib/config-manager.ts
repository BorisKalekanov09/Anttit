import { encrypt, decrypt, hashSensitiveData } from './encryption.js';
import type { ProviderType } from './model-registry.js';

export interface StoredProviderConfig {
  provider: ProviderType;
  encryptedApiKey?: string;
  apiKeyHash: string;
  baseUrl?: string;
  modelName?: string;
  isActive: boolean;
  createdAt: string;
  lastValidated?: string;
  validationError?: string;
}

export interface ProviderConfigRequest {
  provider: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

export interface ActiveModelConfig {
  worldGeneration: {
    provider: ProviderType;
    modelId: string;
  };
  agentDecision: {
    provider: ProviderType;
    modelId: string;
  };
}

class ConfigManager {
  private configs: Map<ProviderType, StoredProviderConfig> = new Map();
  private modelConfig: ActiveModelConfig | null = null;

  loadConfig(data: Record<string, unknown>): void {
    if (data.providers && typeof data.providers === 'object') {
      const providers = data.providers as Record<string, StoredProviderConfig>;
      Object.entries(providers).forEach(([provider, config]) => {
        this.configs.set(provider as ProviderType, config);
      });
    }
    if (data.modelConfig && typeof data.modelConfig === 'object') {
      this.modelConfig = data.modelConfig as ActiveModelConfig;
    }
  }

  saveConfig(provider: ProviderType, config: ProviderConfigRequest): StoredProviderConfig {
    if (!config.apiKey && provider !== 'ollama') {
      throw new Error(`API key required for ${provider}`);
    }

    const stored: StoredProviderConfig = {
      provider,
      apiKeyHash: config.apiKey ? hashSensitiveData(config.apiKey) : '',
      encryptedApiKey: config.apiKey ? encrypt(config.apiKey) : undefined,
      baseUrl: config.baseUrl,
      modelName: config.modelName,
      isActive: false,
      createdAt: new Date().toISOString(),
    };

    this.configs.set(provider, stored);
    return stored;
  }

  getDecryptedKey(provider: ProviderType): string | null {
    const config = this.configs.get(provider);
    if (!config || !config.encryptedApiKey) return null;

    try {
      return decrypt(config.encryptedApiKey);
    } catch (error) {
      console.error(`Failed to decrypt key for ${provider}:`, error);
      return null;
    }
  }

  getConfig(provider: ProviderType): StoredProviderConfig | null {
    return this.configs.get(provider) || null;
  }

  getAllConfigs(): StoredProviderConfig[] {
    return Array.from(this.configs.values());
  }

  setActiveModels(worldGenProvider: ProviderType, worldGenModel: string, agentProvider: ProviderType, agentModel: string): void {
    this.modelConfig = {
      worldGeneration: { provider: worldGenProvider, modelId: worldGenModel },
      agentDecision: { provider: agentProvider, modelId: agentModel },
    };
  }

  getActiveModels(): ActiveModelConfig {
    if (!this.modelConfig) {
      throw new Error('No model configuration set');
    }
    return this.modelConfig;
  }

  updateValidationStatus(provider: ProviderType, valid: boolean, error?: string): void {
    const config = this.configs.get(provider);
    if (config) {
      config.lastValidated = new Date().toISOString();
      if (valid) {
        config.validationError = undefined;
        config.isActive = true;
      } else {
        config.validationError = error;
        config.isActive = false;
      }
    }
  }

  deleteConfig(provider: ProviderType): void {
    this.configs.delete(provider);
  }

  exportForStorage(): {
    providers: Record<string, StoredProviderConfig>;
    modelConfig: ActiveModelConfig | null;
  } {
    const providers: Record<string, StoredProviderConfig> = {};
    this.configs.forEach((config, provider) => {
      providers[provider] = config;
    });

    return { providers, modelConfig: this.modelConfig };
  }
}

export const configManager = new ConfigManager();
