import type { CreativeState, Framing } from "../state.js";
import { addArtifact } from "../state.js";
import type { PhaseDeps } from "../adapters/deps.js";
import type { Style } from "../adapters/ui/adapter.js";
import { phase1Prompt } from "../engine/prompts.js";
import { checkPhase1ExitCriteria } from "../utils/exit-criteria.js";

const CONFIDENCE_STYLE: Record<string, Style> = {
  high: "error",
  medium: "warn",
  low: "success",
  untested: "dim",
};

export async function runPhase1(state: CreativeState, deps: PhaseDeps): Promise<void> {
  const { llm, ui } = deps;

  ui.section("PHASE 1 — Cognitive Framing");
  ui.labeled("Brief: ", state.brief.raw_text, "dim");
  ui.blank();
  ui.line("Generating framing document...", "dim");

  const { system, user } = phase1Prompt(state.brief.raw_text, state);
  const framing = await llm.callJson<Framing>(system, user, { maxTokens: 2048 });

  state.framing = framing;

  ui.heading("Core Questions");
  framing.core_questions.forEach((q, i) => {
    ui.line(`${i + 1}. ${q.question}`, "info");
    if (q.why_it_matters) ui.line(`   → ${q.why_it_matters}`, "dim");
  });

  ui.heading("Assumptions");
  framing.assumptions.forEach((a) => {
    const style = CONFIDENCE_STYLE[a.confidence] ?? "normal";
    ui.segments([
      { text: `[${a.confidence.toUpperCase()}] `, style },
      { text: a.assumption },
    ]);
    if (a.source) ui.line(`         source: ${a.source}`, "dim");
  });

  ui.heading("Constraints");
  framing.constraints?.forEach((c) => {
    ui.segments([
      { text: c.hard ? "[HARD] " : "[SOFT] ", style: c.hard ? "error" : "warn" },
      { text: c.constraint },
      { text: ` (${c.type})`, style: "dim" },
    ]);
  });

  ui.heading("Blind Spot Audit");
  framing.blind_spot_audit?.findings?.forEach((f) => {
    ui.bullet(f, { textStyle: "dim" });
  });
  framing.blind_spot_audit?.dissenting_perspectives?.forEach((p) => {
    ui.bullet(p, { marker: "↔", markerStyle: "accent", textStyle: "accent" });
  });

  // Add belief tags from assumptions
  framing.assumptions.forEach((a) => {
    state.belief_tags.push({ tag: a.assumption, status: "active" });
  });

  addArtifact(state, "framing_doc", JSON.stringify(framing, null, 2));

  // Exit criteria check
  ui.blank();
  const check = checkPhase1ExitCriteria(state);
  if (check.passed) {
    ui.success("Exit criteria met");
    state.phase_status = "exit_criteria_met";
  } else {
    ui.error("Exit criteria not met:");
    check.failures.forEach((f) => ui.line(`    - ${f}`, "error"));
    state.phase_status = "blocked";
  }
}
