import chalk from "chalk";
import inquirer from "inquirer";
import type { CreativeState } from "../state.js";
import { generateId, addArtifact } from "../state.js";
import { callLLM, callLLMJson } from "../utils/llm.js";
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
  manualTrigger = false
): Promise<{ accepted: boolean; phaseRecommendation: "stay" | "advance" | "regress" }> {
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

  console.log("\n" + chalk.yellow("━".repeat(60)));
  console.log(chalk.yellow.bold(`  ⚡ META-CYCLE INTERVENTION`));
  console.log(chalk.yellow(`  Trigger: ${triggerLabel(triggerReason as TriggerReason)}`));
  console.log(chalk.yellow(`  ${triggerDetail}`));
  console.log(chalk.yellow("━".repeat(60)) + "\n");

  // ── Step 1: Thesis ─────────────────────────────────────────────────────────
  console.log(chalk.dim("  Generating thesis (current position)..."));
  const { system: tSys, user: tUser } = metaCycleThesisPrompt(state, triggerReason);
  const thesis = await callLLM(tSys, tUser, 512);

  console.log("\n" + chalk.bold("  THESIS"));
  console.log(chalk.white("  " + thesis.replace(/\n/g, "\n  ")));

  // ── Step 2: Antithesis ─────────────────────────────────────────────────────
  console.log("\n" + chalk.dim("  Generating antithesis (counter-position)..."));
  const { system: aSys, user: aUser } = metaCycleAntithesisPrompt(state, triggerReason, thesis);
  const antithesis = await callLLMJson<Antithesis>(aSys, aUser, 800);

  console.log("\n" + chalk.bold("  ANTITHESIS"));
  console.log(chalk.red("  Challenge:   ") + antithesis.challenge);
  console.log(chalk.red("  Alternative: ") + antithesis.alternative);
  console.log(chalk.red("  Provocation: ") + chalk.italic(antithesis.provocation));

  // ── Step 3: Synthesis ──────────────────────────────────────────────────────
  console.log("\n" + chalk.dim("  Generating synthesis (evolution)..."));
  const { system: sSys, user: sUser } = metaCycleSynthesisPrompt(state, thesis, antithesis);
  const synthesis = await callLLMJson<Synthesis>(sSys, sUser, 600);

  console.log("\n" + chalk.bold("  SYNTHESIS"));
  console.log(chalk.green("  Evolution:   ") + synthesis.evolution_note);
  console.log(
    chalk.green("  Recommend:   ") +
      chalk.bold(synthesis.phase_recommendation.toUpperCase())
  );

  console.log();

  // ── Human decision ─────────────────────────────────────────────────────────
  const { decision } = await inquirer.prompt<{ decision: string }>([
    {
      type: "list",
      name: "decision",
      message: "Accept this synthesis?",
      choices: [
        { name: "Yes — accept and continue", value: "accept" },
        { name: "No — dismiss and continue", value: "dismiss" },
        { name: "Edit — I'll note my own synthesis", value: "edit" },
      ],
    },
  ]);

  let accepted = decision === "accept";
  let userNote: string | undefined;

  if (decision === "edit") {
    const { note } = await inquirer.prompt<{ note: string }>([
      { type: "input", name: "note", message: "Your synthesis / reframing:" },
    ]);
    userNote = note;
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
    // Add tension from antithesis provocation
    state.tensions.push({
      id: generateId("ten"),
      description: antithesis.provocation,
      source: "meta_cycle",
      status: "active",
    });
  }

  console.log(
    accepted
      ? chalk.green("  ✓ Synthesis accepted.")
      : chalk.dim("  ✗ Synthesis dismissed.")
  );
  console.log(chalk.yellow("━".repeat(60)) + "\n");

  return { accepted, phaseRecommendation: synthesis.phase_recommendation };
}

export async function checkAndRunMetaCycle(
  state: CreativeState
): Promise<{ phaseRecommendation: "stay" | "advance" | "regress" }> {
  const detection = detectTriggers(state);
  if (!detection.triggered) return { phaseRecommendation: "stay" };

  const result = await runMetaCycle(state);
  return { phaseRecommendation: result.phaseRecommendation };
}
