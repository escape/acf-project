// PhaseDeps — the single argument every phase function and the meta-cycle
// receives. Bundles all three adapter seams so the engine code only ever
// touches `deps.llm`, `deps.ui`, and `deps.store` instead of importing
// providers, terminal libs, or fs directly.

import type { LLMAdapter } from "./llm/adapter.js";
import type { UIAdapter } from "./ui/adapter.js";
import type { StateStore } from "./storage/adapter.js";

export interface PhaseDeps {
  llm: LLMAdapter;
  ui: UIAdapter;
  store: StateStore;
}
