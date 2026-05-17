import chalk from "chalk";
import type { CreativeState, Idea } from "../state.js";
import { addArtifact } from "../state.js";
import { callLLMJson } from "../utils/llm.js";
import { phase2Prompt } from "../engine/prompts.js";
import { checkPhase2ExitCriteria } from "../utils/exit-criteria.js";

const SOURCE_TAG_COLORS: Record<string, typeof chalk> = {
  analogy: chalk.cyan,
  inversion: chalk.red,
  reference: chalk.blue,
  combination: chalk.magenta,
  random: chalk.gray,
  provocation: chalk.yellow,
  constraint_flip: chalk.green,
};

export async function runPhase2(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.blue("━".repeat(60)));
  console.log(chalk.blue.bold("  PHASE 2 — Divergent Exploration"));
  console.log(chalk.blue("━".repeat(60)) + "\n");

  console.log(chalk.dim("  Generating ideas from varied generative methods..."));

  const { system, user } = phase2Prompt(state);
  const raw = await callLLMJson<Idea[] | Record<string, Idea[]>>(system, user, 4096);
  const ideas: Idea[] = Array.isArray(raw) ? raw : (Object.values(raw).flat().filter(Array.isArray).flat() ?? []);

  state.idea_pool = ideas;

  console.log("\n" + chalk.bold(`  Idea Pool (${ideas.length} ideas)\n`));

  ideas.forEach((idea, i) => {
    const color = SOURCE_TAG_COLORS[idea.source_tag] ?? chalk.white;
    console.log(
      `  ${chalk.bold(String(i + 1).padStart(2, "0"))}  ${color(`[${idea.source_tag}]`)}  ${idea.idea_text}`
    );
    if (idea.belief_challenge) {
      console.log(chalk.dim(`       ↳ challenges: ${idea.belief_challenge}`));
    }
  });

  // Stats
  const byTag = ideas.reduce<Record<string, number>>((acc, idea) => {
    acc[idea.source_tag] = (acc[idea.source_tag] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\n" + chalk.bold("  Coverage"));
  Object.entries(byTag).forEach(([tag, count]) => {
    const color = SOURCE_TAG_COLORS[tag] ?? chalk.white;
    console.log(`  ${color(tag.padEnd(20))} ${"▪".repeat(count)} ${count}`);
  });

  const challenging = ideas.filter((i) => i.belief_challenge?.trim());
  console.log(chalk.dim(`\n  ${challenging.length}/${ideas.length} ideas challenge an assumption`));

  addArtifact(state, "idea", JSON.stringify(ideas, null, 2));

  // Exit criteria
  console.log();
  const check = checkPhase2ExitCriteria(state);
  if (check.passed) {
    console.log(chalk.green("  ✓ Exit criteria met"));
    state.phase_status = "exit_criteria_met";
  } else {
    console.log(chalk.red("  ✗ Exit criteria not met:"));
    check.failures.forEach((f) => console.log(chalk.red(`    - ${f}`)));
    state.phase_status = "blocked";
  }
}
