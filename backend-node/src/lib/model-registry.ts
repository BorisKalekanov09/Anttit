export type ProviderType = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'ollama';
export type ModelCategory = 'world-generation' | 'agent-decision' | 'both';

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
  category: ModelCategory;
  contextWindow: number;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

export interface ProviderCatalog {
  [provider: string]: ModelInfo[];
}

const MODELS: ProviderCatalog = {
  openai: [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      category: 'both',
      contextWindow: 128000,
      costPer1kTokens: { input: 0.01, output: 0.03 },
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      category: 'both',
      contextWindow: 128000,
      costPer1kTokens: { input: 0.005, output: 0.015 },
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      category: 'both',
      contextWindow: 128000,
      costPer1kTokens: { input: 0.00015, output: 0.0006 },
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      category: 'both',
      contextWindow: 16385,
      costPer1kTokens: { input: 0.0005, output: 0.0015 },
    },
  ],
  anthropic: [
    {
      id: 'claude-3-opus-20250219',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      category: 'both',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
    },
    {
      id: 'claude-3-sonnet-20250229',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      category: 'both',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
    },
    {
      id: 'claude-3-haiku-20250307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      category: 'both',
      contextWindow: 200000,
      costPer1kTokens: { input: 0.00080, output: 0.0024 },
    },
  ],
  google: [
    {
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini 2.0 Flash Lite',
      provider: 'google',
      category: 'both',
      contextWindow: 1000000,
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'google',
      category: 'both',
      contextWindow: 1000000,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      category: 'both',
      contextWindow: 2000000,
    },
  ],
  groq: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      provider: 'groq',
      category: 'both',
      contextWindow: 128000,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      provider: 'groq',
      category: 'both',
      contextWindow: 128000,
    },
    {
      id: 'meta-llama/llama-4-scout-17b-16e-instruct',
      name: 'Llama 4 Scout 17B',
      provider: 'groq',
      category: 'both',
      contextWindow: 131072,
    },
    {
      id: 'qwen/qwen3-32b',
      name: 'Qwen 3 32B',
      provider: 'groq',
      category: 'both',
      contextWindow: 32768,
    },
  ],
  openrouter: [
    {
      id: 'openrouter/auto',
      name: 'OpenRouter Auto (Best Value)',
      provider: 'openrouter',
      category: 'both',
      contextWindow: 8192,
    },
    {
      id: 'meta-llama/llama-3.1-405b-instruct',
      name: 'Llama 3.1 405B',
      provider: 'openrouter',
      category: 'both',
      contextWindow: 131072,
    },
    {
      id: 'google/gemini-2.0-flash-lite-preview-02-05:free',
      name: 'Gemini 2.0 Flash Lite (Free)',
      provider: 'openrouter',
      category: 'both',
      contextWindow: 1000000,
    },
  ],
  ollama: [
    {
      id: 'custom',
      name: 'Custom Ollama Model (specify name)',
      provider: 'ollama',
      category: 'both',
      contextWindow: 4096,
    },
  ],
};

export function getModelsForProvider(provider: ProviderType): ModelInfo[] {
  return MODELS[provider] || [];
}

export function getModelInfo(provider: ProviderType, modelId: string): ModelInfo | null {
  const models = MODELS[provider];
  if (!models) return null;
  return models.find(m => m.id === modelId) || null;
}

export function getModelsForCategory(
  category: ModelCategory,
  providers?: ProviderType[]
): ModelInfo[] {
  const providersToSearch = providers || Object.keys(MODELS);
  const models: ModelInfo[] = [];

  providersToSearch.forEach(provider => {
    const providerModels = MODELS[provider];
    if (providerModels) {
      models.push(
        ...providerModels.filter(m => m.category === category || m.category === 'both')
      );
    }
  });

  return models;
}

export function getAllProviders(): ProviderType[] {
  return Object.keys(MODELS) as ProviderType[];
}
