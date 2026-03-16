import chalk from "chalk";
import inquirer from "inquirer";
import type { CreativeState, SelectedDirection } from "../state.js";
import { addArtifact } from "../state.js";
import { callLLMJson } from "../utils/llm.js";
import { phase3ScoringPrompt } from "../engine/prompts.js";
import { checkPhase3ExitCriteria } from "../utils/exit-criteria.js";

function scoreBar(score: number, max = 5): string {
  return "█".repeat(score) + "░".repeat(max - score) + ` ${score}/${max}`;
}

function riskColor(severity?: string): typeof chalk {
  switch (severity) {
    case "critical": return chalk.red;
    case "high": return chalk.yellow;
    case "moderate": return chalk.cyan;
    default: return chalk.green;
  }
}

export async function runPhase3(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.blue("━".repeat(60)));
  console.log(chalk.blue.bold("  PHASE 3 — Directional Convergence"));
  console.log(chalk.blue("━".repeat(60)) + "\n");

  if (!state.idea_pool || state.idea_pool.length === 0) {
    console.log(chalk.red("  No idea pool found. Run Phase 2 first."));
    return;
  }

  console.log(chalk.dim("  Scoring ideas and generating dissent records..."));

  const { system, user } = phase3ScoringPrompt(state);
  const rawDirs = await callLLMJson<SelectedDirection[] | Record<string, SelectedDirection[]>>(system, user, 2500);
  const directions: SelectedDirection[] = Array.isArray(rawDirs) ? rawDirs : (Object.values(rawDirs).find(Array.isArray) ?? []);

  // Display AI selections for review
  console.log("\n" + chalk.bold("  Suggested Directions\n"));

  directions.forEach((dir, i) => {
    const idea = state.idea_pool?.find((idea) => idea.id === dir.idea_ref);
    const rc = riskColor(dir.risk_severity);

    console.log(chalk.bold(`  [${i + 1}] ${idea?.idea_text ?? dir.idea_ref}`));
    console.log(`       Feasibility: ${chalk.cyan(scoreBar(dir.feasibility_score))}`);
    console.log(`       Impact:      ${chalk.magenta(scoreBar(dir.impact_score))}`);
    if (dir.risk_notes) {
      console.log(`       Risk:        ${rc(`[${(dir.risk_severity ?? "?").toUpperCase()}]`)} ${dir.risk_notes}`);
    }
    console.log(chalk.yellow(`       Dissent:     ${dir.dissent_record}`));
    console.log();
  });

  // Let user confirm or override selection
  const ideaChoices = (state.idea_pool ?? []).map((idea) => ({
    name: `[${idea.source_tag}] ${idea.idea_text.slice(0, 80)}`,
    value: idea.id,
  }));

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: "confirm",
      name: "confirmed",
      message: "Accept these directions? (n to manually select)",
      default: true,
    },
  ]);

  let finalDirections = directions;

  if (!confirmed) {
    const { selected } = await inquirer.prompt<{ selected: string[] }>([
      {
        type: "checkbox",
        name: "selected",
        message: "Select up to 3 directions to pursue:",
        choices: ideaChoices,
        validate: (v) => v.length > 0 && v.length <= 3 ? true : "Select 1–3 directions",
      },
    ]);

    finalDirections = selected.map((id) => {
      const existing = directions.find((d) => d.idea_ref === id);
      if (existing) return existing;
      // Fallback for ideas not scored by AI
      return {
        idea_ref: id,
        feasibility_score: 3,
        impact_score: 3,
        risk_notes: "Manually selected — scoring not yet available",
        risk_severity: "moderate" as const,
        dissent_record: "Manually selected by user. AI dissent not generated for this item.",
      };
    });
  }

  state.selected_directions = finalDirections;

  addArtifact(state, "direction", JSON.stringify(finalDirections, null, 2));

  // Exit criteria
  console.log();
  const check = checkPhase3ExitCriteria(state);
  if (check.passed) {
    console.log(chalk.green("  ✓ Exit criteria met"));
    state.phase_status = "exit_criteria_met";
  } else {
    console.log(chalk.red("  ✗ Exit criteria not met:"));
    check.failures.forEach((f) => console.log(chalk.red(`    - ${f}`)));
    state.phase_status = "blocked";
  }
}
