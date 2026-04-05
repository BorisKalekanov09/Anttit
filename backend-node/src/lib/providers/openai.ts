import { BaseProvider, type ProviderResponse, type ProviderValidationResult } from './base.js';
import { getModelsForProvider } from '../model-registry.js';
import type { ModelInfo } from '../model-registry.js';

export class OpenAIProvider extends BaseProvider {
  provider = 'openai' as const;
  apiKey: string;
  baseUrl: string = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async validateConnection(): Promise<ProviderValidationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateCompletion(
    prompt: string,
    modelId: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    }
  ): Promise<ProviderResponse> {
    this.validateModelId(modelId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          top_p: options?.topP ?? 1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  getAvailableModels(): ModelInfo[] {
    return getModelsForProvider('openai');
  }
}
