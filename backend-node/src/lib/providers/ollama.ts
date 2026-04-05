import { BaseProvider, type ProviderResponse, type ProviderValidationResult } from './base.js';
import { getModelsForProvider } from '../model-registry.js';
import type { ModelInfo } from '../model-registry.js';

export class OllamaProvider extends BaseProvider {
  provider = 'ollama' as const;
  apiKey?: string;
  baseUrl: string;
  modelName: string;

  constructor(baseUrl: string = 'http://localhost:11434', modelName: string = 'llama2') {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.modelName = modelName;
  }

  async validateConnection(): Promise<ProviderValidationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `Ollama endpoint returned ${response.status}`,
        };
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models || [];

      if (!models.find(m => m.name === this.modelName)) {
        return {
          valid: false,
          error: `Model "${this.modelName}" not found on Ollama instance. Available: ${models.map(m => m.name).join(', ')}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to connect to Ollama at ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateCompletion(
    prompt: string,
    _modelId: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ProviderResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 1024,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        response: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        content: data.response,
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0,
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
    return getModelsForProvider('ollama');
  }

  setModel(modelName: string): void {
    this.modelName = modelName;
  }
}
