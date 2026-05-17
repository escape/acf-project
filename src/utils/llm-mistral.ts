import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
  timeoutMs: 120000, // 120 seconds - matches Claude's effective timeout
});
const MODEL = "mistral-large-latest"; // or "mistral-small", "mistral-medium", etc.

async function callMistralLLMWithRetry(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048,
  retries = 3
): Promise<string> {
  let lastError: unknown;
  while (retries > 0) {
    try {
      const response = await client.chat.complete({
        model: MODEL,
        maxTokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error("No response from Mistral API");
      }

      // Handle both string and ContentChunk[] response types
      const content = response.choices[0].message?.content;
      if (content === undefined || content === null) {
        throw new Error("No content in Mistral API response");
      }
      if (typeof content === 'string') {
        return content;
      } else if (Array.isArray(content)) {
        return content.map(chunk => {
          if (typeof chunk === 'string') return chunk;
          if ('text' in chunk) return chunk.text;
          if ('image_url' in chunk && typeof chunk.image_url === 'object' && chunk.image_url && 'url' in chunk.image_url) {
            return `[IMAGE: ${chunk.image_url.url}]`;
          }
          return '';
        }).join('');
      } else {
        throw new Error("Unexpected response format from Mistral API");
      }
    } catch (error) {
      lastError = error;
      if (retries === 1) throw error;
      console.log(`Mistral retrying... (${retries - 1} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries))); // Exponential backoff
      retries--;
    }
  }
  throw lastError;
}

export async function callMistralLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<string> {
  return callMistralLLMWithRetry(systemPrompt, userPrompt, maxTokens);
}

export async function callMistralLLMJson<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<T> {
  const raw = await callMistralLLM(systemPrompt, userPrompt, maxTokens);
  const jsonStr = extractJson(raw);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error(`Mistral returned invalid JSON:\n${raw}`);
  }
}

function extractJson(raw: string): string {
  // 1. Strip markdown code block fences (```json ... ``` or ``` ... ```)
  let cleaned = raw.trim();
  const codeBlockMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // 2. Try parsing the cleaned response directly
  try { JSON.parse(cleaned); return cleaned; } catch { /* continue */ }

  // 3. Find the outermost { } or [ ] using balanced matching (handles nested code blocks)
  const curly = cleaned.indexOf("{");
  const square = cleaned.indexOf("[");
  const firstCurly = curly === -1 ? Infinity : curly;
  const firstSquare = square === -1 ? Infinity : square;
  const opener = firstSquare < firstCurly ? "[" : "{";
  const closer = opener === "{" ? "}" : "]";
  const start = Math.min(firstCurly, firstSquare);
  if (start === Infinity) return cleaned;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    if (ch === closer) {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }

  return cleaned;
}