import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import type { CreativeState, ProjectRetro } from "../state.js";
import { addArtifact } from "../state.js";
import { callLLMJson } from "../utils/llm.js";
import { phase6ContextNotesPrompt, phase6RetroPrompt } from "../engine/prompts.js";
import { checkPhase6ExitCriteria } from "../utils/exit-criteria.js";

export async function runPhase6(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.blue("━".repeat(60)));
  console.log(chalk.blue.bold("  PHASE 6 — Delivery"));
  console.log(chalk.blue("━".repeat(60)) + "\n");

  if (!state.integrated_artifact?.final_draft) {
    console.log(chalk.red("  No integrated artifact found. Run Phase 5 first."));
    return;
  }

  console.log(chalk.bold("  Final Artifact\n"));
  console.log(chalk.white("  " + state.integrated_artifact.final_draft.replace(/\n/g, "\n  ")));

  // Generate context notes
  console.log("\n" + chalk.dim("  Generating context notes..."));
  const { system: cs, user: cu } = phase6ContextNotesPrompt(state);
  const { context_notes } = await callLLMJson<{ context_notes: string }>(cs, cu, 2048);

  console.log("\n" + chalk.bold("  Context Notes\n"));
  console.log(chalk.dim("  " + context_notes.replace(/\n/g, "\n  ")));

  // Delivery options
  const { deliveryMethod } = await inquirer.prompt<{ deliveryMethod: string }>([
    {
      type: "list",
      name: "deliveryMethod",
      message: "How are you delivering this?",
      choices: [
        { name: "Export to file (saves to ./projects/exports/)", value: "file" },
        { name: "Display in terminal (copy from here)", value: "terminal" },
        { name: "Mark as delivered (already sent externally)", value: "external" },
      ],
    },
  ]);

  let deliveryNote = "";

  if (deliveryMethod === "file") {
    const exportDir = path.join(process.cwd(), "projects", "exports");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const filename = `${state.id}-delivery.md`;
    const filepath = path.join(exportDir, filename);
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
    fs.writeFileSync(filepath, content, "utf-8");
    console.log(chalk.green(`\n  ✓ Exported to: ${filepath}`));
    deliveryNote = `Exported to file: ${filepath}`;
  } else if (deliveryMethod === "terminal") {
    console.log(chalk.bold("\n  ── DELIVERABLE ──────────────────────────────────\n"));
    console.log(state.integrated_artifact.final_draft);
    console.log(chalk.bold("\n  ─────────────────────────────────────────────────"));
    deliveryNote = "Displayed in terminal";
  } else {
    const { note } = await inquirer.prompt<{ note: string }>([
      { type: "input", name: "note", message: "Delivery note (where/how it was sent):" },
    ]);
    deliveryNote = note || "Delivered externally";
  }

  // Collect reception
  const { reception } = await inquirer.prompt<{ reception: string }>([
    {
      type: "input",
      name: "reception",
      message: "Initial reception / reactions (or 'pending'):",
    },
  ]);

  state.delivered_work = {
    final_artifact: state.integrated_artifact.final_draft,
    context_notes,
    reception_log: reception || "pending",
  };

  addArtifact(state, "final", `${deliveryNote}\n\n${state.integrated_artifact.final_draft}`);

  // Project retro
  console.log("\n" + chalk.bold("  Project Retrospective\n"));
  console.log(chalk.dim("  Generating retrospective..."));
  const { system: rs, user: ru } = phase6RetroPrompt(state);
  const retro = await callLLMJson<ProjectRetro>(rs, ru, 2048);

  console.log("\n" + chalk.bold("  What Worked"));
  retro.what_worked?.forEach((w) => console.log(chalk.green(`  + ${w}`)));

  console.log("\n" + chalk.bold("  What Didn't"));
  retro.what_didnt?.forEach((w) => console.log(chalk.red(`  - ${w}`)));

  console.log("\n" + chalk.bold("  Belief Shifts"));
  retro.belief_shifts?.forEach((b) => console.log(chalk.yellow(`  ↔ ${b}`)));

  // Allow human additions
  const { addRetro } = await inquirer.prompt<{ addRetro: boolean }>([
    { type: "confirm", name: "addRetro", message: "Add your own retro notes?", default: false },
  ]);

  if (addRetro) {
    const { extra } = await inquirer.prompt<{ extra: string }>([
      { type: "input", name: "extra", message: "Additional notes (added to belief_shifts):" },
    ]);
    if (extra.trim()) retro.belief_shifts.push(extra.trim());
  }

  state.project_retro = retro;
  addArtifact(state, "retro", JSON.stringify(retro, null, 2));

  // Exit criteria
  console.log();
  const check = checkPhase6ExitCriteria(state);
  if (check.passed) {
    console.log(chalk.green("  ✓ Exit criteria met"));
    state.phase_status = "exit_criteria_met";
  } else {
    console.log(chalk.red("  ✗ Exit criteria not met:"));
    check.failures.forEach((f) => console.log(chalk.red(`    - ${f}`)));
    state.phase_status = "blocked";
  }
}
