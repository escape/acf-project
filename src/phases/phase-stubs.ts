import chalk from "chalk";
import type { CreativeState } from "../state.js";

export async function runPhase4(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.gray("━".repeat(60)));
  console.log(chalk.gray.bold("  PHASE 4 — Iterative Crafting [STUB]"));
  console.log(chalk.gray("━".repeat(60)));
  console.log(chalk.dim("\n  This phase is not yet implemented in the POC."));
  console.log(chalk.dim("  Selected directions from Phase 3:"));
  state.selected_directions?.forEach((d) => {
    const idea = state.idea_pool?.find((i) => i.id === d.idea_ref);
    console.log(chalk.dim(`  • ${idea?.idea_text ?? d.idea_ref}`));
  });
  state.phase = 4;
  state.phase_status = "in_progress";
}

export async function runPhase5(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.gray("━".repeat(60)));
  console.log(chalk.gray.bold("  PHASE 5 — Polishing & Integration [STUB]"));
  console.log(chalk.gray("━".repeat(60)));
  console.log(chalk.dim("\n  This phase is not yet implemented in the POC."));
  state.phase = 5;
  state.phase_status = "in_progress";
}

export async function runPhase6(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.gray("━".repeat(60)));
  console.log(chalk.gray.bold("  PHASE 6 — Delivery [STUB]"));
  console.log(chalk.gray("━".repeat(60)));
  console.log(chalk.dim("\n  This phase is not yet implemented in the POC."));
  state.phase = 6;
  state.phase_status = "in_progress";
}

export async function runPhase7(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.gray("━".repeat(60)));
  console.log(chalk.gray.bold("  PHASE 7 — Continuous Learning [STUB]"));
  console.log(chalk.gray("━".repeat(60)));
  console.log(chalk.dim("\n  This phase is not yet implemented in the POC."));
  state.phase = 7;
  state.phase_status = "in_progress";
}
