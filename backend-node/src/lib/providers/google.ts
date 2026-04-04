import { BaseProvider, type ProviderResponse, type ProviderValidationResult } from './base.js';
import { getModelsForProvider } from '../model-registry.js';
import type { ModelInfo } from '../model-registry.js';

export class GoogleProvider extends BaseProvider {
  provider = 'google' as const;
  apiKey: string;
  baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/openai/';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async validateConnection(): Promise<ProviderValidationResult> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
        {
          method: 'GET',
          timeout: 10000,
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { valid: false, error: 'Invalid API key' };
        }
        if (response.status === 429) {
          return {
            valid: false,
            error: 'Rate limited or quota exceeded',
            rateLimitResetAt: new Date(Date.now() + 300000),
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
    this.validateModelId(modelId);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options?.temperature ?? 0.7,
              maxOutputTokens: options?.maxTokens ?? 2048,
            },
          }),
          timeout: 60000,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        if (response.status === 429 || error.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('API quota exceeded. Please try again later.');
        }
        throw new Error(`Google API error (${response.status}): ${error}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
        usageMetadata?: {
          promptTokenCount: number;
          candidatesTokenCount: number;
        };
      };

      const firstCandidate = data.candidates?.[0];
      const textPart = firstCandidate?.content?.parts?.[0];

      return {
        content: textPart?.text || '',
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount || 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        },
      };
    } catch (error) {
      this.logError('Generation failed', error);
      throw error;
    }
  }

  getAvailableModels(): ModelInfo[] {
    return getModelsForProvider('google');
  }
}
