import type { CreativeState, Idea } from "../state.js";
import { addArtifact } from "../state.js";
import type { PhaseDeps } from "../adapters/deps.js";
import type { Style } from "../adapters/ui/adapter.js";
import { phase2Prompt } from "../engine/prompts.js";
import { checkPhase2ExitCriteria } from "../utils/exit-criteria.js";

const SOURCE_TAG_STYLE: Record<string, Style> = {
  analogy: "info",
  inversion: "error",
  reference: "info",
  combination: "accent",
  random: "dim",
  provocation: "warn",
  constraint_flip: "success",
};

export async function runPhase2(state: CreativeState, deps: PhaseDeps): Promise<void> {
  const { llm, ui } = deps;

  ui.section("PHASE 2 — Divergent Exploration");
  ui.line("Generating ideas from varied generative methods...", "dim");

  const { system, user } = phase2Prompt(state);
  const raw = await llm.callJson<Idea[] | Record<string, Idea[]>>(system, user, { maxTokens: 4096 });
  const ideas: Idea[] = Array.isArray(raw)
    ? raw
    : (Object.values(raw).flat().filter(Array.isArray).flat() ?? []);

  state.idea_pool = ideas;

  ui.heading(`Idea Pool (${ideas.length} ideas)`);

  ideas.forEach((idea, i) => {
    const tagStyle = SOURCE_TAG_STYLE[idea.source_tag] ?? "normal";
    ui.segments([
      { text: String(i + 1).padStart(2, "0"), style: "bold" },
      { text: "  " },
      { text: `[${idea.source_tag}]`, style: tagStyle },
      { text: "  " },
      { text: idea.idea_text },
    ]);
    if (idea.belief_challenge) {
      ui.line(`     ↳ challenges: ${idea.belief_challenge}`, "dim");
    }
  });

  // Coverage stats
  const byTag = ideas.reduce<Record<string, number>>((acc, idea) => {
    acc[idea.source_tag] = (acc[idea.source_tag] ?? 0) + 1;
    return acc;
  }, {});

  ui.heading("Coverage");
  Object.entries(byTag).forEach(([tag, count]) => {
    const tagStyle = SOURCE_TAG_STYLE[tag] ?? "normal";
    ui.segments([
      { text: tag.padEnd(20), style: tagStyle },
      { text: " " },
      { text: "▪".repeat(count) },
      { text: ` ${count}` },
    ]);
  });

  const challenging = ideas.filter((i) => i.belief_challenge?.trim());
  ui.blank();
  ui.line(`${challenging.length}/${ideas.length} ideas challenge an assumption`, "dim");

  addArtifact(state, "idea", JSON.stringify(ideas, null, 2));

  // Exit criteria
  ui.blank();
  const check = checkPhase2ExitCriteria(state);
  if (check.passed) {
    ui.success("Exit criteria met");
    state.phase_status = "exit_criteria_met";
  } else {
    ui.error("Exit criteria not met:");
    check.failures.forEach((f) => ui.line(`    - ${f}`, "error"));
    state.phase_status = "blocked";
  }
}
