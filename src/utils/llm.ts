import Anthropic from "@anthropic-ai/sdk";
import { callMistralLLM, callMistralLLMJson } from "./llm-mistral.js";

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"; // Updated to current recommended model (June 2026)

// Determine which provider to use based on environment variables
const LLM_PROVIDER = process.env.LLM_PROVIDER || "anthropic"; // "anthropic" or "mistral"

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<string> {
  if (LLM_PROVIDER === "mistral") {
    return callMistralLLM(systemPrompt, userPrompt, maxTokens);
  }

  // Default to Anthropic with retry logic
  let retries = 3;
  while (retries > 0) {
    try {
      const response = await anthropicClient.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = response.content[0];
      if (block.type !== "text") throw new Error("Unexpected response type from LLM");
      return block.text;
    } catch (error) {
      if (retries === 1) throw error;
      console.log(`Retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
      retries--;
    }
  }
  throw new Error("Failed to get response from Anthropic after multiple retries");
}

export async function callLLMJson<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<T> {
  const raw = await callLLM(systemPrompt, userPrompt, maxTokens);
  const jsonStr = extractJson(raw);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error(`LLM returned invalid JSON:\n${raw}`);
  }
}

function extractJson(raw: string): string {
  // 1. Try parsing the whole response directly
  try { JSON.parse(raw.trim()); return raw.trim(); } catch { /* continue */ }

  // 2. Find the outermost { } or [ ] using balanced matching (handles nested code blocks)
  const curly = raw.indexOf("{");
  const square = raw.indexOf("[");
  const firstCurly = curly === -1 ? Infinity : curly;
  const firstSquare = square === -1 ? Infinity : square;
  const opener = firstSquare < firstCurly ? "[" : "{";
  const closer = opener === "{" ? "}" : "]";
  const start = Math.min(firstCurly, firstSquare);
  if (start === Infinity) return raw.trim();

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    if (ch === closer) {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return raw.trim();
}
