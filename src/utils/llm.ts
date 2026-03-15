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
  const match = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const jsonStr = match ? (match[1] ?? match[0]) : raw;
  try {
    return JSON.parse(jsonStr.trim()) as T;
  } catch {
    throw new Error(`LLM returned invalid JSON:\n${raw}`);
  }
}
