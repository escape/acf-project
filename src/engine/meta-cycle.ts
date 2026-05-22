import type { CreativeState } from "../state.js";
import { generateId, addArtifact } from "../state.js";
import type { PhaseDeps } from "../adapters/deps.js";
import {
  metaCycleThesisPrompt,
  metaCycleAntithesisPrompt,
  metaCycleSynthesisPrompt,
} from "./prompts.js";
import {
  detectTriggers,
  incrementMetaCycleCount,
  type TriggerReason,
} from "./tension-detector.js";

interface Antithesis {
  challenge: string;
  alternative: string;
  provocation: string;
}

interface Synthesis {
  evolution_note: string;
  phase_recommendation: "stay" | "advance" | "regress";
}

type Decision = "accept" | "dismiss" | "edit";

function triggerLabel(reason: TriggerReason): string {
  const labels: Record<TriggerReason, string> = {
    stagnation: "STAGNATION",
    groupthink: "GROUPTHINK",
    drift: "DRIFT",
    comfort_zone: "COMFORT ZONE",
    manual: "MANUAL",
  };
  return labels[reason];
}

export async function runMetaCycle(
  state: CreativeState,
  deps: PhaseDeps,
  manualTrigger = false
): Promise<{ accepted: boolean; phaseRecommendation: "stay" | "advance" | "regress" }> {
  const { llm, ui } = deps;

  const detection = manualTrigger ? null : detectTriggers(state);

  if (!manualTrigger && detection && !detection.triggered) {
    return { accepted: false, phaseRecommendation: "stay" };
  }

  const triggerReason: TriggerReason = manualTrigger
    ? "manual"
    : (detection as { triggered: true; reason: TriggerReason }).reason;
  const triggerDetail = manualTrigger
    ? "Manually triggered by user."
    : (detection as { triggered: true; detail: string }).detail;

  ui.section(`⚡ META-CYCLE INTERVENTION`);
  ui.line(`Trigger: ${triggerLabel(triggerReason)}`, "warn");
  ui.line(triggerDetail, "warn");
  ui.blank();

  // ── Step 1: Thesis ─────────────────────────────────────────────────────────
  ui.line("Generating thesis (current position)...", "dim");
  const { system: tSys, user: tUser } = metaCycleThesisPrompt(state, triggerReason);
  const thesis = await llm.call(tSys, tUser, { maxTokens: 512 });

  ui.heading("THESIS");
  ui.raw(thesis);

  // ── Step 2: Antithesis ─────────────────────────────────────────────────────
  ui.blank();
  ui.line("Generating antithesis (counter-position)...", "dim");
  const { system: aSys, user: aUser } = metaCycleAntithesisPrompt(state, triggerReason, thesis);
  const antithesis = await llm.callJson<Antithesis>(aSys, aUser, { maxTokens: 800 });

  ui.heading("ANTITHESIS");
  ui.labeled("Challenge:   ", antithesis.challenge, "error");
  ui.labeled("Alternative: ", antithesis.alternative, "error");
  ui.labeled("Provocation: ", antithesis.provocation, "error");

  // ── Step 3: Synthesis ──────────────────────────────────────────────────────
  ui.blank();
  ui.line("Generating synthesis (evolution)...", "dim");
  const { system: sSys, user: sUser } = metaCycleSynthesisPrompt(state, thesis, antithesis);
  const synthesis = await llm.callJson<Synthesis>(sSys, sUser, { maxTokens: 600 });

  ui.heading("SYNTHESIS");
  ui.labeled("Evolution:   ", synthesis.evolution_note, "success");
  ui.labeled("Recommend:   ", synthesis.phase_recommendation.toUpperCase(), "success");

  ui.blank();

  // ── Human decision ─────────────────────────────────────────────────────────
  const decision = await ui.choice<Decision>("Accept this synthesis?", [
    { label: "Yes — accept and continue", value: "accept" },
    { label: "No — dismiss and continue", value: "dismiss" },
    { label: "Edit — I'll note my own synthesis", value: "edit" },
  ]);

  let accepted = decision === "accept";
  let userNote: string | undefined;

  if (decision === "edit") {
    userNote = await ui.text("Your synthesis / reframing:");
    accepted = true;
  }

  // ── Log the cycle ──────────────────────────────────────────────────────────
  const entry = {
    id: generateId("mc"),
    phase: state.phase,
    trigger: triggerReason,
    thesis,
    antithesis,
    synthesis: {
      evolution_note: userNote ?? synthesis.evolution_note,
      phase_recommendation: synthesis.phase_recommendation,
    },
    accepted,
    timestamp: new Date().toISOString(),
  };

  state.meta_cycle_log.push(entry);
  incrementMetaCycleCount(state);

  addArtifact(
    state,
    "meta_cycle_output",
    `Trigger: ${triggerReason}\nThesis: ${thesis}\nChallenge: ${antithesis.challenge}\nAlternative: ${antithesis.alternative}\nProvocation: ${antithesis.provocation}\nSynthesis: ${entry.synthesis.evolution_note}`
  );

  if (accepted) {
    state.tensions.push({
      id: generateId("ten"),
      description: antithesis.provocation,
      source: "meta_cycle",
      status: "active",
    });
  }

  if (accepted) {
    ui.success("Synthesis accepted.");
  } else {
    ui.line("✗ Synthesis dismissed.", "dim");
  }

  return { accepted, phaseRecommendation: synthesis.phase_recommendation };
}

export async function checkAndRunMetaCycle(
  state: CreativeState,
  deps: PhaseDeps
): Promise<{ phaseRecommendation: "stay" | "advance" | "regress" }> {
  const detection = detectTriggers(state);
  if (!detection.triggered) return { phaseRecommendation: "stay" };

  const result = await runMetaCycle(state, deps);
  return { phaseRecommendation: result.phaseRecommendation };
}
