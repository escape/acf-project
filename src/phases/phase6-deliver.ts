import type { CreativeState, ProjectRetro } from "../state.js";
import { addArtifact } from "../state.js";
import type { PhaseDeps } from "../adapters/deps.js";
import { phase6ContextNotesPrompt, phase6RetroPrompt } from "../engine/prompts.js";
import { checkPhase6ExitCriteria } from "../utils/exit-criteria.js";

type DeliveryMethod = "file" | "terminal" | "external";

export async function runPhase6(state: CreativeState, deps: PhaseDeps): Promise<void> {
  const { llm, ui, store } = deps;

  ui.section("PHASE 6 — Delivery");

  if (!state.integrated_artifact?.final_draft) {
    ui.error("No integrated artifact found. Run Phase 5 first.");
    return;
  }

  ui.heading("Final Artifact");
  ui.raw(state.integrated_artifact.final_draft);

  // Generate context notes
  ui.blank();
  ui.line("Generating context notes...", "dim");
  const { system: cs, user: cu } = phase6ContextNotesPrompt(state);
  const { context_notes } = await llm.callJson<{ context_notes: string }>(cs, cu, { maxTokens: 2048 });

  ui.heading("Context Notes");
  ui.raw(context_notes);

  // Delivery options
  const deliveryMethod = await ui.choice<DeliveryMethod>("How are you delivering this?", [
    { label: "Export to file (saves to ./projects/exports/)", value: "file" },
    { label: "Display in terminal (copy from here)", value: "terminal" },
    { label: "Mark as delivered (already sent externally)", value: "external" },
  ]);

  let deliveryNote = "";

  if (deliveryMethod === "file") {
    const filename = `${state.id}-delivery.md`;
    const content = [
      `# Delivered Work\n`,
      `**Project:** ${state.id}`,
      `**Brief:** ${state.brief.raw_text}\n`,
      `---\n`,
      `## Final Artifact\n`,
      state.integrated_artifact.final_draft,
      `\n---\n`,
      `## Context Notes\n`,
      context_notes,
    ].join("\n");
    const { ref } = await store.exportArtifact(state.id, filename, content);
    ui.success(`Exported to: ${ref}`);
    deliveryNote = `Exported to file: ${ref}`;
  } else if (deliveryMethod === "terminal") {
    ui.heading("── DELIVERABLE ──────────────────────────────────");
    ui.raw(state.integrated_artifact.final_draft);
    ui.line("─────────────────────────────────────────────────", "bold");
    deliveryNote = "Displayed in terminal";
  } else {
    const note = await ui.text("Delivery note (where/how it was sent):");
    deliveryNote = note || "Delivered externally";
  }

  // Collect reception
  const reception = await ui.text("Initial reception / reactions (or 'pending'):");

  state.delivered_work = {
    final_artifact: state.integrated_artifact.final_draft,
    context_notes,
    reception_log: reception || "pending",
  };

  addArtifact(state, "final", `${deliveryNote}\n\n${state.integrated_artifact.final_draft}`);

  // Project retro
  ui.heading("Project Retrospective");
  ui.line("Generating retrospective...", "dim");
  const { system: rs, user: ru } = phase6RetroPrompt(state);
  const retro = await llm.callJson<ProjectRetro>(rs, ru, { maxTokens: 2048 });

  ui.heading("What Worked");
  retro.what_worked?.forEach((w) => ui.bullet(w, { marker: "+", markerStyle: "success", textStyle: "success" }));

  ui.heading("What Didn't");
  retro.what_didnt?.forEach((w) => ui.bullet(w, { marker: "-", markerStyle: "error", textStyle: "error" }));

  ui.heading("Belief Shifts");
  retro.belief_shifts?.forEach((b) => ui.bullet(b, { marker: "↔", markerStyle: "warn", textStyle: "warn" }));

  // Allow human additions
  const addRetro = await ui.confirm("Add your own retro notes?", false);

  if (addRetro) {
    const extra = await ui.text("Additional notes (added to belief_shifts):");
    if (extra.trim()) retro.belief_shifts.push(extra.trim());
  }

  state.project_retro = retro;
  addArtifact(state, "retro", JSON.stringify(retro, null, 2));

  // Exit criteria
  ui.blank();
  const check = checkPhase6ExitCriteria(state);
  if (check.passed) {
    ui.success("Exit criteria met");
    state.phase_status = "exit_criteria_met";
  } else {
    ui.error("Exit criteria not met:");
    check.failures.forEach((f) => ui.line(`    - ${f}`, "error"));
    state.phase_status = "blocked";
  }
}
