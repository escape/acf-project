import type { CreativeState, Iteration } from "../state.js";
import { addArtifact } from "../state.js";
import type { PhaseDeps } from "../adapters/deps.js";
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

type FeedbackMode = "ai" | "human" | "both";

export async function runPhase4(state: CreativeState, deps: PhaseDeps): Promise<void> {
  const { llm, ui } = deps;

  ui.section("PHASE 4 — Iterative Crafting");

  if (!state.selected_directions || state.selected_directions.length === 0) {
    ui.error("No selected directions found. Run Phase 3 first.");
    return;
  }

  if (!state.iterations) state.iterations = [];

  const currentVersion = state.iterations.length + 1;

  // Show selected directions as context
  ui.line("Working from selected directions:", "bold");
  state.selected_directions.forEach((d) => {
    const idea = state.idea_pool?.find((i) => i.id === d.idea_ref);
    ui.bullet(idea?.idea_text ?? d.idea_ref, { textStyle: "dim" });
  });
  ui.blank();

  // Generate the iteration artifact
  const previousArtifact = state.iterations[state.iterations.length - 1]?.artifact;
  const previousFeedback = state.iterations[state.iterations.length - 1]?.feedback;

  ui.line(`Generating iteration v${currentVersion}...`, "dim");
  const { system, user } = phase4IterationPrompt(state, currentVersion, previousArtifact, previousFeedback);
  const output = await llm.callJson<IterationLLMOutput>(system, user, { maxTokens: 16384 });

  if (typeof output.artifact !== "string" || typeof output.retro_notes !== "string") {
    throw new Error(
      `Phase 4 LLM returned non-string fields. The prompt requires "artifact" and "retro_notes" to be strings. Got: artifact=${typeof output.artifact}, retro_notes=${typeof output.retro_notes}`
    );
  }

  ui.heading(`Artifact v${currentVersion}`);
  ui.raw(output.artifact);
  ui.blank();
  ui.line(`Retro: ${output.retro_notes}`, "dim");

  // Collect feedback
  ui.heading("Feedback");
  const feedbackMode = await ui.choice<FeedbackMode>("How do you want to provide feedback?", [
    { label: "Generate critical AI review", value: "ai" },
    { label: "Write my own feedback", value: "human" },
    { label: "Both (AI review + my notes)", value: "both" },
  ]);

  let feedback = "";

  if (feedbackMode === "ai" || feedbackMode === "both") {
    ui.line("Generating critical review...", "dim");
    const { system: fs, user: fu } = phase4FeedbackPrompt(state, output.artifact, currentVersion);
    const aiFeedback = await llm.callJson<FeedbackLLMOutput>(fs, fu, { maxTokens: 2048 });

    ui.heading("AI Review");
    ui.labeled("Works:    ", aiFeedback.what_works, "success");
    ui.labeled("Fails:    ", aiFeedback.what_doesnt, "error");
    ui.labeled("Gap:      ", aiFeedback.biggest_gap, "warn");
    ui.labeled("Brief alignment: ", aiFeedback.alignment_with_brief, "dim");

    feedback = `Works: ${aiFeedback.what_works}\nFails: ${aiFeedback.what_doesnt}\nBiggest gap: ${aiFeedback.biggest_gap}\nBrief alignment: ${aiFeedback.alignment_with_brief}`;
  }

  if (feedbackMode === "human" || feedbackMode === "both") {
    const humanFeedback = await ui.text("Your feedback:", {
      validate: (v) => (v.trim().length > 5 ? true : "Feedback must be substantive"),
    });
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
  ui.blank();
  const check = checkPhase4ExitCriteria(state);
  if (check.passed) {
    ui.success("Exit criteria met");
    state.phase_status = "exit_criteria_met";
  } else {
    ui.warn("Exit criteria not yet met:");
    check.failures.forEach((f) => ui.line(`    - ${f}`, "warn"));
    state.phase_status = "in_progress";
  }
}
