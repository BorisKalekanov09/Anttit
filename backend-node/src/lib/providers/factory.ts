import { BaseProvider } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { GroqProvider } from './groq.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider } from './ollama.js';
import type { ProviderType } from '../model-registry.js';

export function createProvider(
  provider: ProviderType,
  config: {
    apiKey?: string;
    baseUrl?: string;
    modelName?: string;
  }
): BaseProvider {
  switch (provider) {
    case 'openai':
      if (!config.apiKey) throw new Error('OpenAI API key is required');
      return new OpenAIProvider(config.apiKey);

    case 'anthropic':
      if (!config.apiKey) throw new Error('Anthropic API key is required');
      return new AnthropicProvider(config.apiKey);

    case 'google':
      if (!config.apiKey) throw new Error('Google API key is required');
      return new GoogleProvider(config.apiKey);

    case 'groq':
      if (!config.apiKey) throw new Error('Groq API key is required');
      return new GroqProvider(config.apiKey);

    case 'openrouter':
      if (!config.apiKey) throw new Error('OpenRouter API key is required');
      return new OpenRouterProvider(config.apiKey);

    case 'ollama':
      return new OllamaProvider(config.baseUrl, config.modelName);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export { BaseProvider, OpenAIProvider, AnthropicProvider, GoogleProvider, GroqProvider, OpenRouterProvider, OllamaProvider };
