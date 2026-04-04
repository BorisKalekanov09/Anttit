import type { ModelInfo, ProviderType } from '../model-registry.js';

export interface ProviderResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ProviderValidationResult {
  valid: boolean;
  error?: string;
  remainingQuota?: number;
  rateLimitResetAt?: Date;
}

export abstract class BaseProvider {
  abstract provider: ProviderType;
  abstract apiKey?: string;

  abstract validateConnection(): Promise<ProviderValidationResult>;

  abstract generateCompletion(
    prompt: string,
    modelId: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    }
  ): Promise<ProviderResponse>;

  abstract getAvailableModels(): ModelInfo[];

  protected logError(message: string, error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${this.provider}] ${message}:`, errorMsg);
  }

  protected validateModelId(modelId: string): void {
    const available = this.getAvailableModels();
    if (!available.find(m => m.id === modelId)) {
      throw new Error(`Model ${modelId} not available for provider ${this.provider}`);
    }
  }
}
