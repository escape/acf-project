import chalk from "chalk";
import type { CreativeState, Framing } from "../state.js";
import { addArtifact } from "../state.js";
import { callLLMJson } from "../utils/llm.js";
import { phase1Prompt } from "../engine/prompts.js";
import { checkPhase1ExitCriteria } from "../utils/exit-criteria.js";

export async function runPhase1(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.blue("━".repeat(60)));
  console.log(chalk.blue.bold("  PHASE 1 — Cognitive Framing"));
  console.log(chalk.blue("━".repeat(60)) + "\n");

  console.log(chalk.dim("  Brief: ") + state.brief.raw_text);
  console.log();
  console.log(chalk.dim("  Generating framing document..."));

  const { system, user } = phase1Prompt(state.brief.raw_text, state);
  const framing = await callLLMJson<Framing>(system, user, 2048);

  state.framing = framing;

  // Display results
  console.log("\n" + chalk.bold("  Core Questions"));
  framing.core_questions.forEach((q, i) => {
    console.log(chalk.cyan(`  ${i + 1}. ${q.question}`));
    if (q.why_it_matters) console.log(chalk.dim(`     → ${q.why_it_matters}`));
  });

  console.log("\n" + chalk.bold("  Assumptions"));
  framing.assumptions.forEach((a) => {
    const conf = {
      high: chalk.red,
      medium: chalk.yellow,
      low: chalk.green,
      untested: chalk.gray,
    }[a.confidence] ?? chalk.white;
    console.log(`  ${conf(`[${a.confidence.toUpperCase()}]`)} ${a.assumption}`);
    if (a.source) console.log(chalk.dim(`         source: ${a.source}`));
  });

  console.log("\n" + chalk.bold("  Constraints"));
  framing.constraints?.forEach((c) => {
    const tag = c.hard ? chalk.red("[HARD]") : chalk.yellow("[SOFT]");
    console.log(`  ${tag} ${c.constraint} ${chalk.dim(`(${c.type})`)}`);
  });

  console.log("\n" + chalk.bold("  Blind Spot Audit"));
  framing.blind_spot_audit?.findings?.forEach((f) => {
    console.log(chalk.dim(`  • ${f}`));
  });
  framing.blind_spot_audit?.dissenting_perspectives?.forEach((p) => {
    console.log(chalk.magenta(`  ↔ ${p}`));
  });

  // Add belief tags from assumptions
  framing.assumptions.forEach((a) => {
    state.belief_tags.push({ tag: a.assumption, status: "active" });
  });

  addArtifact(
    state,
    "framing_doc",
    JSON.stringify(framing, null, 2)
  );

  // Exit criteria check
  console.log();
  const check = checkPhase1ExitCriteria(state);
  if (check.passed) {
    console.log(chalk.green("  ✓ Exit criteria met"));
    state.phase_status = "exit_criteria_met";
  } else {
    console.log(chalk.red("  ✗ Exit criteria not met:"));
    check.failures.forEach((f) => console.log(chalk.red(`    - ${f}`)));
    state.phase_status = "blocked";
  }
}
