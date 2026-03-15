import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from LLM");
  return block.text;
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
  const opener = raw.indexOf("{") !== -1 ? "{" : "[";
  const closer = opener === "{" ? "}" : "]";
  const start = raw.indexOf(opener);
  if (start === -1) return raw.trim();

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
