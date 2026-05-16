import chalk from "chalk";
import { listProjects, loadState } from "../state.js";

export function showProjectStats() {
  console.log(chalk.bold("\n  Project Statistics\n"));

  const projects = listProjects();
  if (projects.length === 0) {
    console.log(chalk.dim("  No projects found.\n"));
    return;
  }

  // Load full state for each project to get detailed stats
  const stats = projects.map(proj => {
    try {
      const state = loadState(proj.id);
      return {
        id: proj.id,
        phase: proj.phase,
        metaCycles: state.meta_cycle_log.length,
        artifacts: state.artifacts.length,
        tensions: state.tensions.filter(t => t.status === "active").length,
        ideas: state.idea_pool?.length || 0,
        directions: state.selected_directions?.length || 0
      };
    } catch (e) {
      return {
        id: proj.id,
        phase: proj.phase,
        metaCycles: 0,
        artifacts: 0,
        tensions: 0,
        ideas: 0,
        directions: 0
      };
    }
  });

  // Calculate totals
  const totalMetaCycles = stats.reduce((sum, p) => sum + p.metaCycles, 0);
  const totalArtifacts = stats.reduce((sum, p) => sum + p.artifacts, 0);
  const totalTensions = stats.reduce((sum, p) => sum + p.tensions, 0);
  const totalIdeas = stats.reduce((sum, p) => sum + p.ideas, 0);
  const totalDirections = stats.reduce((sum, p) => sum + p.directions, 0);

  console.log(chalk.bold("  Summary Statistics"));
  console.log(`  Total Projects: ${chalk.cyan(projects.length)}`);
  console.log(`  Total Meta-cycles: ${chalk.yellow(totalMetaCycles)}`);
  console.log(`  Total Artifacts: ${chalk.green(totalArtifacts)}`);
  console.log(`  Active Tensions: ${chalk.red(totalTensions)}`);
  console.log(`  Total Ideas: ${chalk.blue(totalIdeas)}`);
  console.log(`  Selected Directions: ${chalk.magenta(totalDirections)}`);

  console.log(chalk.bold("\n  Phase Distribution"));
  const phases = [1, 2, 3, 4, 5, 6, 7];
  phases.forEach(phase => {
    const count = stats.filter(p => p.phase === phase).length;
    const bar = "█".repeat(Math.round(count * 5));
    console.log(`  Phase ${phase}: ${bar} ${count}`);
  });

  console.log();
}