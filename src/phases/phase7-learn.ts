import chalk from "chalk";
import fs from "fs";
import path from "path";
import type { CreativeState, MethodologyUpdates } from "../state.js";
import { addArtifact } from "../state.js";
import { callLLMJson } from "../utils/llm.js";
import { phase7LearningPrompt } from "../engine/prompts.js";
import { checkPhase7ExitCriteria } from "../utils/exit-criteria.js";

// Phase 7 has persistence: true — writes to a shared system-level patterns file
const PATTERNS_FILE = path.join(process.cwd(), "projects", "pattern-library.json");

interface PatternLibrary {
  updated_at: string;
  entries: Array<{
    project_id: string;
    date: string;
    process_patches: string[];
    belief_calibration: string[];
    pattern_library: string[];
  }>;
}

function loadPatternLibrary(): PatternLibrary {
  if (!fs.existsSync(PATTERNS_FILE)) {
    return { updated_at: new Date().toISOString(), entries: [] };
  }
  return JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8")) as PatternLibrary;
}

function savePatternLibrary(lib: PatternLibrary): void {
  lib.updated_at = new Date().toISOString();
  fs.writeFileSync(PATTERNS_FILE, JSON.stringify(lib, null, 2), "utf-8");
}

export async function runPhase7(state: CreativeState): Promise<void> {
  console.log("\n" + chalk.blue("━".repeat(60)));
  console.log(chalk.blue.bold("  PHASE 7 — Continuous Learning"));
  console.log(chalk.blue("━".repeat(60)) + "\n");

  if (!state.project_retro) {
    console.log(chalk.red("  No project retro found. Run Phase 6 first."));
    return;
  }

  console.log(chalk.dim("  Extracting methodology insights..."));

  const { system, user } = phase7LearningPrompt(state);
  const updates = await callLLMJson<MethodologyUpdates>(system, user, 1500);

  console.log("\n" + chalk.bold("  Process Patches\n"));
  updates.process_patches?.forEach((p, i) =>
    console.log(`  ${chalk.cyan(String(i + 1).padStart(2, "0"))}  ${p}`)
  );

  console.log("\n" + chalk.bold("  Belief Calibration\n"));
  updates.belief_calibration?.forEach((b, i) =>
    console.log(`  ${chalk.magenta(String(i + 1).padStart(2, "0"))}  ${b}`)
  );

  console.log("\n" + chalk.bold("  Pattern Library\n"));
  updates.pattern_library?.forEach((p, i) =>
    console.log(`  ${chalk.green(String(i + 1).padStart(2, "0"))}  ${p}`)
  );

  state.methodology_updates = updates;
  addArtifact(state, "retro", JSON.stringify(updates, null, 2));

  // Persist to system-level pattern library
  const lib = loadPatternLibrary();
  lib.entries.push({
    project_id: state.id,
    date: new Date().toISOString().slice(0, 10),
    process_patches: updates.process_patches ?? [],
    belief_calibration: updates.belief_calibration ?? [],
    pattern_library: updates.pattern_library ?? [],
  });
  savePatternLibrary(lib);

  console.log(chalk.green(`\n  ✓ Patterns persisted to: projects/pattern-library.json`));
  console.log(chalk.dim(`  Library now contains ${lib.entries.length} project(s) of learnings.`));

  // Exit criteria
  console.log();
  const check = checkPhase7ExitCriteria(state);
  if (check.passed) {
    console.log(chalk.green("  ✓ Exit criteria met — project complete"));
    state.phase_status = "exit_criteria_met";
  } else {
    console.log(chalk.red("  ✗ Exit criteria not met:"));
    check.failures.forEach((f) => console.log(chalk.red(`    - ${f}`)));
    state.phase_status = "blocked";
  }
}
