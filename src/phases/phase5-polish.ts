import type { CreativeState, IntegratedArtifact } from "../state.js";
import { addArtifact } from "../state.js";
import type { PhaseDeps } from "../adapters/deps.js";
import { phase5IntegrationPrompt } from "../engine/prompts.js";
import { checkPhase5ExitCriteria } from "../utils/exit-criteria.js";

type Phase5Action = "accept" | "edit" | "regenerate";

async function generateIntegrated(
  state: CreativeState,
  deps: PhaseDeps
): Promise<IntegratedArtifact> {
  const { system, user } = phase5IntegrationPrompt(state);
  const integrated = await deps.llm.callJson<IntegratedArtifact>(system, user, { maxTokens: 16384 });

  if (
    typeof integrated.final_draft !== "string" ||
    typeof integrated.coherence_report !== "string" ||
    typeof integrated.ethics_check !== "string"
  ) {
    throw new Error(
      `Phase 5 LLM returned non-string fields. The prompt requires all three fields to be strings. Got: final_draft=${typeof integrated.final_draft}, coherence_report=${typeof integrated.coherence_report}, ethics_check=${typeof integrated.ethics_check}`
    );
  }
  return integrated;
}

export async function runPhase5(state: CreativeState, deps: PhaseDeps): Promise<void> {
  const { ui } = deps;

  ui.section("PHASE 5 — Polishing & Integration");

  if (!state.iterations || state.iterations.length === 0) {
    ui.error("No iterations found. Run Phase 4 first.");
    return;
  }

  const latest = state.iterations[state.iterations.length - 1];
  ui.line(`Integrating from v${latest.version}...`, "dim");

  const integrated = await generateIntegrated(state, deps);

  ui.heading("Final Draft");
  ui.raw(integrated.final_draft);

  ui.heading("Coherence Report");
  ui.raw(integrated.coherence_report);

  ui.heading("Ethics Check");
  const ethicsStyle = integrated.ethics_check.toLowerCase().includes("no issues") ? "success" : "warn";
  ui.line(integrated.ethics_check.replace(/\n/g, "\n  "), ethicsStyle);

  // Human review
  ui.blank();
  const action = await ui.choice<Phase5Action>("Review the integrated artifact:", [
    { label: "Accept as final", value: "accept" },
    { label: "Accept with my edits", value: "edit" },
    { label: "Regenerate", value: "regenerate" },
  ]);

  if (action === "regenerate") {
    ui.line("Regenerating...", "dim");
    const regen = await generateIntegrated(state, deps);
    state.integrated_artifact = regen;
  } else if (action === "edit") {
    const editedDraft = await ui.text("Paste your edited final draft:", {
      validate: (v) => (v.trim().length > 20 ? true : "Draft is too short"),
    });
    state.integrated_artifact = { ...integrated, final_draft: editedDraft };
  } else {
    state.integrated_artifact = integrated;
  }

  addArtifact(state, "draft", state.integrated_artifact.final_draft);

  // Exit criteria
  ui.blank();
  const check = checkPhase5ExitCriteria(state);
  if (check.passed) {
    ui.success("Exit criteria met");
    state.phase_status = "exit_criteria_met";
  } else {
    ui.error("Exit criteria not met:");
    check.failures.forEach((f) => ui.line(`    - ${f}`, "error"));
    state.phase_status = "blocked";
  }
}
