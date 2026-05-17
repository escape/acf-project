import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
});
const MODEL = "mistral-large-latest"; // or "mistral-small", "mistral-medium", etc.

export async function callMistralLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<string> {
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