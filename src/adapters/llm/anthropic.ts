import Anthropic from "@anthropic-ai/sdk";
import { buildLLMAdapter, type CallOpts, type LLMAdapter } from "./adapter.js";

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  retries?: number;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_OUTPUT_TOKENS = 64000;

export function createAnthropicAdapter(config: AnthropicConfig): LLMAdapter {
  const client = new Anthropic({ apiKey: config.apiKey });
  const model = config.model ?? DEFAULT_MODEL;
  const maxRetries = config.retries ?? 3;

  const call = async (system: string, user: string, opts: CallOpts): Promise<string> => {
    let attempt = 0;
    let lastError: unknown;
    while (attempt < maxRetries) {
      try {
        const requestOpts = opts.timeoutMs ? { timeout: opts.timeoutMs } : undefined;
        const response = await client.messages.create(
          {
            model,
            max_tokens: opts.maxTokens,
            system,
            messages: [{ role: "user", content: user }],
            ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
          },
          requestOpts
        );

        const block = response.content[0];
        if (block.type !== "text") {
          throw new Error("Unexpected response type from Anthropic");
        }
        return block.text;
      } catch (err) {
        lastError = err;
        attempt++;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Anthropic call failed after retries");
  };

  return buildLLMAdapter({
    name: "anthropic",
    model,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    call,
  });
}
