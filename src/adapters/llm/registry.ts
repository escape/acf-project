import type { LLMAdapter } from "./adapter.js";
import { createAnthropicAdapter } from "./anthropic.js";
import { createMistralAdapter } from "./mistral.js";

export type ProviderName = "anthropic" | "mistral";

export interface ProviderConfig {
  provider: ProviderName;
  apiKey: string;
  model?: string;
}

export function createLLM(config: ProviderConfig): LLMAdapter {
  switch (config.provider) {
    case "anthropic":
      return createAnthropicAdapter({ apiKey: config.apiKey, model: config.model });
    case "mistral":
      return createMistralAdapter({ apiKey: config.apiKey, model: config.model });
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown LLM provider: ${_exhaustive}`);
    }
  }
}
