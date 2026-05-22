import { Mistral } from "@mistralai/mistralai";
import { buildLLMAdapter, type CallOpts, type LLMAdapter } from "./adapter.js";

export interface MistralConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = "mistral-large-latest";
const MAX_OUTPUT_TOKENS = 8192;

export function createMistralAdapter(config: MistralConfig): LLMAdapter {
  const client = new Mistral({ apiKey: config.apiKey });
  const model = config.model ?? DEFAULT_MODEL;

  const call = async (system: string, user: string, opts: CallOpts): Promise<string> => {
    const response = await client.chat.complete({
      model,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("No response from Mistral API");
    }

    const content = response.choices[0].message?.content;
    if (content === undefined || content === null) {
      throw new Error("No content in Mistral API response");
    }
    if (typeof content === "string") return content;

    if (Array.isArray(content)) {
      return content
        .map(chunk => {
          if (typeof chunk === "string") return chunk;
          if ("text" in chunk) return chunk.text;
          if (
            "image_url" in chunk &&
            typeof chunk.image_url === "object" &&
            chunk.image_url &&
            "url" in chunk.image_url
          ) {
            return `[IMAGE: ${chunk.image_url.url}]`;
          }
          return "";
        })
        .join("");
    }

    throw new Error("Unexpected response format from Mistral API");
  };

  return buildLLMAdapter({
    name: "mistral",
    model,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    call,
  });
}
