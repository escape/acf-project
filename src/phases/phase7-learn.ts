import type { CreativeState, MethodologyUpdates } from "../state.js";
import { addArtifact } from "../state.js";
import type { PhaseDeps } from "../adapters/deps.js";
import { phase7LearningPrompt } from "../engine/prompts.js";
import { checkPhase7ExitCriteria } from "../utils/exit-criteria.js";

export async function runPhase7(state: CreativeState, deps: PhaseDeps): Promise<void> {
  const { llm, ui, store } = deps;

  ui.section("PHASE 7 — Continuous Learning");

  if (!state.project_retro) {
    ui.error("No project retro found. Run Phase 6 first.");
    return;
  }

  ui.line("Extracting methodology insights...", "dim");

  const { system, user } = phase7LearningPrompt(state);
  const updates = await llm.callJson<MethodologyUpdates>(system, user, { maxTokens: 2048 });

  ui.heading("Process Patches");
  updates.process_patches?.forEach((p, i) =>
    ui.segments([
      { text: String(i + 1).padStart(2, "0"), style: "info" },
      { text: `  ${p}` },
    ])
  );

  ui.heading("Belief Calibration");
  updates.belief_calibration?.forEach((b, i) =>
    ui.segments([
      { text: String(i + 1).padStart(2, "0"), style: "accent" },
      { text: `  ${b}` },
    ])
  );

  ui.heading("Pattern Library");
  updates.pattern_library?.forEach((p, i) =>
    ui.segments([
      { text: String(i + 1).padStart(2, "0"), style: "success" },
      { text: `  ${p}` },
    ])
  );

  state.methodology_updates = updates;
  addArtifact(state, "retro", JSON.stringify(updates, null, 2));

  // Persist to system-level pattern library (cross-project)
  const lib = await store.loadPatternLibrary();
  lib.entries.push({
    project_id: state.id,
    date: new Date().toISOString().slice(0, 10),
    process_patches: updates.process_patches ?? [],
    belief_calibration: updates.belief_calibration ?? [],
    pattern_library: updates.pattern_library ?? [],
  });
  await store.savePatternLibrary(lib);

  ui.blank();
  ui.success("Patterns persisted to: projects/pattern-library.json");
  ui.line(`Library now contains ${lib.entries.length} project(s) of learnings.`, "dim");

  // Exit criteria
  ui.blank();
  const check = checkPhase7ExitCriteria(state);
  if (check.passed) {
    ui.success("Exit criteria met — project complete");
    state.phase_status = "exit_criteria_met";
  } else {
    ui.error("Exit criteria not met:");
    check.failures.forEach((f) => ui.line(`    - ${f}`, "error"));
    state.phase_status = "blocked";
  }
}
