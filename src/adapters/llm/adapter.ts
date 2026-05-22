// LLM adapter interface and shared helpers.
//
// Concrete provider adapters (anthropic.ts, mistral.ts, …) compose with
// buildLLMAdapter() so callJson() / JSON extraction / token clamping live in
// one place and providers only have to implement raw `call`.

export interface CallOpts {
  maxTokens: number;
  timeoutMs?: number;
  temperature?: number;
}

export interface LLMAdapter {
  readonly name: string;          // e.g. "anthropic"
  readonly model: string;         // e.g. "claude-haiku-4-5-20251001"
  readonly maxOutputTokens: number;
  call(systemPrompt: string, userPrompt: string, opts: CallOpts): Promise<string>;
  callJson<T>(systemPrompt: string, userPrompt: string, opts: CallOpts): Promise<T>;
}

export interface BuildAdapterArgs {
  name: string;
  model: string;
  maxOutputTokens: number;
  call: (systemPrompt: string, userPrompt: string, opts: CallOpts) => Promise<string>;
}

export function buildLLMAdapter(args: BuildAdapterArgs): LLMAdapter {
  const clamp = (opts: CallOpts): CallOpts => ({
    ...opts,
    maxTokens: Math.min(opts.maxTokens, args.maxOutputTokens),
  });

  const call = (system: string, user: string, opts: CallOpts) =>
    args.call(system, user, clamp(opts));

  return {
    name: args.name,
    model: args.model,
    maxOutputTokens: args.maxOutputTokens,
    call,
    async callJson<T>(system: string, user: string, opts: CallOpts): Promise<T> {
      const raw = await call(system, user, opts);
      const jsonStr = extractJson(raw);
      try {
        return JSON.parse(jsonStr) as T;
      } catch {
        throw new Error(`${args.name} returned invalid JSON:\n${raw}`);
      }
    },
  };
}

export function extractJson(raw: string): string {
  // 1. Whole response is valid JSON
  try { JSON.parse(raw.trim()); return raw.trim(); } catch { /* continue */ }

  // 2. Balanced-bracket scan from first opener
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
