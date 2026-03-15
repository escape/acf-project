import chalk from "chalk";
import inquirer from "inquirer";
import type { CreativeState, IntegratedArtifact } from "../state.js";
import { addArtifact } from "../state.js";
import { callLLMJson } from "../utils/llm.js";
import { phase5IntegrationPrompt } from "../engine/prompts.js";
import { checkPhase5ExitCriteria } from "../utils/exit-criteria.js";

export async function runPhase5(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.blue("━".repeat(60)));
  console.log(chalk.blue.bold("  PHASE 5 — Polishing & Integration"));
  console.log(chalk.blue("━".repeat(60)) + "\n");

  if (!state.iterations || state.iterations.length === 0) {
    console.log(chalk.red("  No iterations found. Run Phase 4 first."));
    return;
  }

  const latest = state.iterations[state.iterations.length - 1];
  console.log(chalk.dim(`  Integrating from v${latest.version}...`));

  const { system, user } = phase5IntegrationPrompt(state);
  const rawIntegrated = await callLLMJson<IntegratedArtifact>(system, user, 3500);
  const integrated: IntegratedArtifact = {
    final_draft: typeof rawIntegrated.final_draft === "string" ? rawIntegrated.final_draft : JSON.stringify(rawIntegrated.final_draft, null, 2),
    coherence_report: typeof rawIntegrated.coherence_report === "string" ? rawIntegrated.coherence_report : JSON.stringify(rawIntegrated.coherence_report),
    ethics_check: typeof rawIntegrated.ethics_check === "string" ? rawIntegrated.ethics_check : JSON.stringify(rawIntegrated.ethics_check),
  };

  console.log("\n" + chalk.bold("  Final Draft\n"));
  console.log(chalk.white("  " + integrated.final_draft.replace(/\n/g, "\n  ")));

  console.log("\n" + chalk.bold("  Coherence Report\n"));
  console.log(chalk.dim("  " + integrated.coherence_report.replace(/\n/g, "\n  ")));

  console.log("\n" + chalk.bold("  Ethics Check\n"));
  const ethicsColor = integrated.ethics_check.toLowerCase().includes("no issues")
    ? chalk.green
    : chalk.yellow;
  console.log(ethicsColor("  " + integrated.ethics_check.replace(/\n/g, "\n  ")));

  // Human review
  console.log();
  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: "list",
      name: "action",
      message: "Review the integrated artifact:",
      choices: [
        { name: "Accept as final", value: "accept" },
        { name: "Accept with my edits", value: "edit" },
        { name: "Regenerate", value: "regenerate" },
      ],
    },
  ]);

  if (action === "regenerate") {
    console.log(chalk.dim("  Regenerating..."));
    const { system: s2, user: u2 } = phase5IntegrationPrompt(state);
    const regen = await callLLMJson<IntegratedArtifact>(s2, u2, 3500);
    state.integrated_artifact = regen;
  } else if (action === "edit") {
    const { editedDraft } = await inquirer.prompt<{ editedDraft: string }>([
      {
        type: "input",
        name: "editedDraft",
        message: "Paste your edited final draft:",
        validate: (v) => v.trim().length > 20 ? true : "Draft is too short",
      },
    ]);
    state.integrated_artifact = { ...integrated, final_draft: editedDraft };
  } else {
    state.integrated_artifact = integrated;
  }

  addArtifact(state, "draft", state.integrated_artifact.final_draft);

  // Exit criteria
  console.log();
  const check = checkPhase5ExitCriteria(state);
  if (check.passed) {
    console.log(chalk.green("  ✓ Exit criteria met"));
    state.phase_status = "exit_criteria_met";
  } else {
    console.log(chalk.red("  ✗ Exit criteria not met:"));
    check.failures.forEach((f) => console.log(chalk.red(`    - ${f}`)));
    state.phase_status = "blocked";
  }
}
