import { BaseProvider, type ProviderResponse, type ProviderValidationResult } from './base.js';
import { getModelsForProvider } from '../model-registry.js';
import type { ModelInfo } from '../model-registry.js';

export class OpenRouterProvider extends BaseProvider {
  provider = 'openrouter' as const;
  apiKey: string;
  baseUrl: string = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async validateConnection(): Promise<ProviderValidationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, error: 'Invalid API key' };
        }
        if (response.status === 429) {
          return {
            valid: false,
            error: 'Rate limited',
            rateLimitResetAt: new Date(Date.now() + 60000),
          };
        }
        return { valid: false, error: `API error: ${response.status}` };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async generateCompletion(
    prompt: string,
    modelId: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ProviderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://tuesfest2026.local',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
        }),
        timeout: 60000,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
        };
      };

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
      };
    } catch (error) {
      this.logError('Generation failed', error);
      throw error;
    }
  }

  getAvailableModels(): ModelInfo[] {
    return getModelsForProvider('openrouter');
  }
}
