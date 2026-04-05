import { BaseProvider, type ProviderResponse, type ProviderValidationResult } from './base.js';
import { getModelsForProvider } from '../model-registry.js';
import type { ModelInfo } from '../model-registry.js';

export class AnthropicProvider extends BaseProvider {
  provider = 'anthropic' as const;
  apiKey: string;
  baseUrl: string = 'https://api.anthropic.com/v1';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async validateConnection(): Promise<ProviderValidationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20250307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, error: 'Invalid API key' };
        }
        if (response.status === 429) {
          const resetAt = response.headers.get('retry-after');
          return {
            valid: false,
            error: 'Rate limited',
            rateLimitResetAt: resetAt ? new Date(Date.now() + parseInt(resetAt) * 1000) : undefined,
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
    }
  ): Promise<ProviderResponse> {
    this.validateModelId(modelId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: options?.maxTokens ?? 2048,
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature ?? 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${error}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
        usage?: {
          input_tokens: number;
          output_tokens: number;
        };
      };

      const textContent = data.content.find(c => c.type === 'text');

      return {
        content: textContent?.text || '',
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
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
    return getModelsForProvider('anthropic');
  }
}
