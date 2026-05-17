import chalk from "chalk";
import inquirer from "inquirer";
import type { CreativeState, Iteration } from "../state.js";
import { addArtifact } from "../state.js";
import { callLLMJson } from "../utils/llm.js";
import { phase4IterationPrompt, phase4FeedbackPrompt } from "../engine/prompts.js";
import { checkPhase4ExitCriteria } from "../utils/exit-criteria.js";

interface IterationLLMOutput {
  artifact: string;
  retro_notes: string;
}

interface FeedbackLLMOutput {
  what_works: string;
  what_doesnt: string;
  biggest_gap: string;
  alignment_with_brief: string;
}

export async function runPhase4(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.blue("━".repeat(60)));
  console.log(chalk.blue.bold("  PHASE 4 — Iterative Crafting"));
  console.log(chalk.blue("━".repeat(60)) + "\n");

  if (!state.selected_directions || state.selected_directions.length === 0) {
    console.log(chalk.red("  No selected directions found. Run Phase 3 first."));
    return;
  }

  if (!state.iterations) state.iterations = [];

  const currentVersion = state.iterations.length + 1;

  // Show selected directions as context
  console.log(chalk.bold("  Working from selected directions:"));
  state.selected_directions.forEach((d) => {
    const idea = state.idea_pool?.find((i) => i.id === d.idea_ref);
    console.log(chalk.dim(`  • ${idea?.idea_text ?? d.idea_ref}`));
  });
  console.log();

  // Generate the iteration artifact
  const previousArtifact = state.iterations[state.iterations.length - 1]?.artifact;
  const previousFeedback = state.iterations[state.iterations.length - 1]?.feedback;

  console.log(chalk.dim(`  Generating iteration v${currentVersion}...`));
  const { system, user } = phase4IterationPrompt(
    state,
    currentVersion,
    previousArtifact,
    previousFeedback
  );
  const output = await callLLMJson<IterationLLMOutput>(system, user, 16384);

  if (typeof output.artifact !== "string" || typeof output.retro_notes !== "string") {
    throw new Error(
      `Phase 4 LLM returned non-string fields. The prompt requires "artifact" and "retro_notes" to be strings. Got: artifact=${typeof output.artifact}, retro_notes=${typeof output.retro_notes}`
    );
  }

  console.log("\n" + chalk.bold(`  Artifact v${currentVersion}\n`));
  console.log(chalk.white("  " + output.artifact.replace(/\n/g, "\n  ")));
  console.log("\n" + chalk.dim(`  Retro: ${output.retro_notes}`));

  // Collect feedback
  console.log("\n" + chalk.bold("  Feedback\n"));
  const { feedbackMode } = await inquirer.prompt<{ feedbackMode: string }>([
    {
      type: "list",
      name: "feedbackMode",
      message: "How do you want to provide feedback?",
      choices: [
        { name: "Generate critical AI review", value: "ai" },
        { name: "Write my own feedback", value: "human" },
        { name: "Both (AI review + my notes)", value: "both" },
      ],
    },
  ]);

  let feedback = "";

  if (feedbackMode === "ai" || feedbackMode === "both") {
    console.log(chalk.dim("  Generating critical review..."));
    const { system: fs, user: fu } = phase4FeedbackPrompt(state, output.artifact, currentVersion);
    const aiFeedback = await callLLMJson<FeedbackLLMOutput>(fs, fu, 2048);

    console.log("\n" + chalk.bold("  AI Review"));
    console.log(chalk.green("  Works:    ") + aiFeedback.what_works);
    console.log(chalk.red("  Fails:    ") + aiFeedback.what_doesnt);
    console.log(chalk.yellow("  Gap:      ") + aiFeedback.biggest_gap);
    console.log(chalk.dim("  Brief alignment: ") + aiFeedback.alignment_with_brief);

    feedback = `Works: ${aiFeedback.what_works}\nFails: ${aiFeedback.what_doesnt}\nBiggest gap: ${aiFeedback.biggest_gap}\nBrief alignment: ${aiFeedback.alignment_with_brief}`;
  }

  if (feedbackMode === "human" || feedbackMode === "both") {
    const { humanFeedback } = await inquirer.prompt<{ humanFeedback: string }>([
      {
        type: "input",
        name: "humanFeedback",
        message: "Your feedback:",
        validate: (v) => v.trim().length > 5 ? true : "Feedback must be substantive",
      },
    ]);
    feedback = feedback ? `${feedback}\nHuman: ${humanFeedback}` : humanFeedback;
  }

  // Save iteration
  const iteration: Iteration = {
    version: currentVersion,
    artifact: output.artifact,
    feedback,
    retro_notes: output.retro_notes,
  };

  state.iterations.push(iteration);
  addArtifact(state, "prototype", `v${currentVersion}: ${output.artifact}`);

  // Exit criteria check
  console.log();
  const check = checkPhase4ExitCriteria(state);
  if (check.passed) {
    console.log(chalk.green("  ✓ Exit criteria met"));
    state.phase_status = "exit_criteria_met";
  } else {
    console.log(chalk.yellow("  ↻ Exit criteria not yet met:"));
    check.failures.forEach((f) => console.log(chalk.yellow(`    - ${f}`)));
    state.phase_status = "in_progress";
  }
}
