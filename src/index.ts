#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import {
  createNewState,
  loadState,
  saveState,
  listProjects,
  type CreativeState,
} from "./state.js";
import { runPhase1 } from "./phases/phase1-framing.js";
import { runPhase2 } from "./phases/phase2-diverge.js";
import { runPhase3 } from "./phases/phase3-converge.js";
import { runPhase4 } from "./phases/phase4-craft.js";
import { runPhase5 } from "./phases/phase5-polish.js";
import { runPhase6 } from "./phases/phase6-deliver.js";
import { runPhase7 } from "./phases/phase7-learn.js";
import { runMetaCycle, checkAndRunMetaCycle } from "./engine/meta-cycle.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function header(): void {
  console.log(chalk.bold.white("\n  ACF — Adaptive Creative Framework"));
  console.log(chalk.dim("  Dialectical engine for creative projects\n"));
}

function phaseLabel(phase: number): string {
  const labels: Record<number, string> = {
    1: "Cognitive Framing",
    2: "Divergent Exploration",
    3: "Directional Convergence",
    4: "Iterative Crafting",
    5: "Polishing & Integration",
    6: "Delivery",
    7: "Continuous Learning",
  };
  return labels[phase] ?? `Phase ${phase}`;
}

async function advancePhase(state: CreativeState): Promise<void> {
  // Run meta-cycle check at phase transition
  console.log(chalk.dim("\n  Running meta-cycle check..."));
  const { phaseRecommendation } = await checkAndRunMetaCycle(state);

  if (phaseRecommendation === "regress" && state.phase > 1) {
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: "confirm",
        name: "confirm",
        message: `Meta-cycle recommends returning to Phase ${state.phase - 1}. Go back?`,
        default: false,
      },
    ]);
    if (confirm) {
      state.phase = state.phase - 1;
      state.phase_status = "in_progress";
      saveState(state);
      console.log(chalk.yellow(`  ↩ Returning to Phase ${state.phase}: ${phaseLabel(state.phase)}`));
      return;
    }
  }

  if (state.phase < 7) {
    state.phase = state.phase + 1;
    state.phase_status = "in_progress";
  }
  saveState(state);
}

async function runCurrentPhase(state: CreativeState): Promise<void> {
  switch (state.phase) {
    case 1: await runPhase1(state); break;
    case 2: await runPhase2(state); break;
    case 3: await runPhase3(state); break;
    case 4: await runPhase4(state); break;
    case 5: await runPhase5(state); break;
    case 6: await runPhase6(state); break;
    case 7: await runPhase7(state); break;
    default:
      console.log(chalk.red(`  Unknown phase: ${state.phase}`));
  }
  saveState(state);
}

// ── Commands ─────────────────────────────────────────────────────────────────

program
  .name("acf")
  .description("Adaptive Creative Framework — dialectical engine for creative projects")
  .version("0.1.0");

// ── acf new ──────────────────────────────────────────────────────────────────

program
  .command("new")
  .description("Start a new creative project")
  .action(async () => {
    header();

    const { brief } = await inquirer.prompt<{ brief: string }>([
      {
        type: "input",
        name: "brief",
        message: "Enter your creative brief:",
        validate: (v) => v.trim().length > 10 ? true : "Brief must be at least 10 characters",
      },
    ]);

    const { domain } = await inquirer.prompt<{ domain: string }>([
      {
        type: "input",
        name: "domain",
        message: "Domain (optional, e.g. branding, product, editorial):",
      },
    ]);

    const state = createNewState(brief.trim(), domain.trim() || undefined);
    saveState(state);

    console.log(chalk.dim(`\n  Project ID: ${state.id}`));
    console.log(chalk.dim("  Saved to: projects/" + state.id + ".json\n"));

    // Run phases interactively
    let running = true;
    while (running && state.phase <= 7) {
      await runCurrentPhase(state);

      if (state.phase_status === "blocked") {
        console.log(chalk.red("\n  Phase blocked — exit criteria not met. Retrying phase."));
        continue;
      }

      const isLast = state.phase === 7;
      const { next } = await inquirer.prompt<{ next: string }>([
        {
          type: "list",
          name: "next",
          message: `Phase ${state.phase} complete. What next?`,
          choices: [
            ...(!isLast ? [{ name: `Advance to Phase ${state.phase + 1}: ${phaseLabel(state.phase + 1)}`, value: "advance" }] : []),
            ...(isLast ? [{ name: "Complete project", value: "finish" }] : []),
            { name: "Repeat this phase", value: "repeat" },
            { name: "Manually trigger meta-cycle", value: "meta" },
            { name: "Save and exit", value: "exit" },
          ],
        },
      ]);

      if (next === "advance") {
        await advancePhase(state);
      } else if (next === "repeat") {
        state.phase_status = "in_progress";
        saveState(state);
      } else if (next === "meta") {
        await runMetaCycle(state, true);
        saveState(state);
      } else if (next === "finish") {
        running = false;
      } else {
        running = false;
      }
    }

    console.log(chalk.green(`\n  ✓ Project saved: ${state.id}`));
    console.log(chalk.dim(`  Resume with: acf resume ${state.id}\n`));
  });

// ── acf resume ───────────────────────────────────────────────────────────────

program
  .command("resume <project-id>")
  .description("Resume a saved project")
  .action(async (projectId: string) => {
    header();
    let state: CreativeState;
    try {
      state = loadState(projectId);
    } catch (e) {
      console.log(chalk.red(`  Project not found: ${projectId}`));
      process.exit(1);
    }

    console.log(chalk.dim(`  Resuming: ${state.id}`));
    console.log(chalk.dim(`  Phase ${state.phase}: ${phaseLabel(state.phase)}\n`));

    let running = true;
    while (running) {
      await runCurrentPhase(state);

      if (state.phase_status === "blocked") continue;

      const choices = [];
      if (state.phase < 7) choices.push({ name: `Advance to Phase ${state.phase + 1}: ${phaseLabel(state.phase + 1)}`, value: "advance" });
      if (state.phase === 7) choices.push({ name: "Complete project", value: "finish" });
      choices.push({ name: "Repeat this phase", value: "repeat" });
      choices.push({ name: "Manually trigger meta-cycle", value: "meta" });
      choices.push({ name: "Save and exit", value: "exit" });

      const { next } = await inquirer.prompt<{ next: string }>([
        { type: "list", name: "next", message: "What next?", choices },
      ]);

      if (next === "advance" || next === "finish") {
        await advancePhase(state);
        if (state.phase > 7) running = false;
      } else if (next === "repeat") {
        state.phase_status = "in_progress";
        saveState(state);
      } else if (next === "meta") {
        await runMetaCycle(state, true);
        saveState(state);
      } else {
        running = false;
      }
    }

    console.log(chalk.green(`\n  ✓ Project saved: ${state.id}\n`));
  });

// ── acf status ───────────────────────────────────────────────────────────────

program
  .command("status [project-id]")
  .description("Show project status summary")
  .action((projectId?: string) => {
    header();

    if (!projectId) {
      const projects = listProjects();
      if (projects.length === 0) {
        console.log(chalk.dim("  No projects found. Run: acf new\n"));
        return;
      }
      console.log(chalk.bold("  Projects\n"));
      projects.forEach((p) => {
        console.log(
          `  ${chalk.cyan(p.id.padEnd(30))} Phase ${p.phase} — ${phaseLabel(p.phase)}`
        );
        console.log(chalk.dim(`  ${"".padEnd(30)} "${p.brief}..."`));
        console.log(chalk.dim(`  ${"".padEnd(30)} Updated: ${p.updated_at.slice(0, 10)}\n`));
      });
      return;
    }

    let state: CreativeState;
    try {
      state = loadState(projectId);
    } catch {
      console.log(chalk.red(`  Project not found: ${projectId}`));
      process.exit(1);
    }

    console.log(chalk.bold("  Project Status\n"));
    console.log(`  ID:      ${chalk.cyan(state.id)}`);
    console.log(`  Phase:   ${state.phase} — ${phaseLabel(state.phase)}`);
    console.log(`  Status:  ${state.phase_status}`);
    console.log(`  Brief:   ${state.brief.raw_text.slice(0, 100)}...`);

    if (state.framing) {
      console.log(`\n  ${chalk.bold("Framing")}`);
      console.log(`  Questions: ${state.framing.core_questions?.length ?? 0}`);
      console.log(`  Assumptions: ${state.framing.assumptions?.length ?? 0}`);
    }

    if (state.idea_pool) {
      console.log(`\n  ${chalk.bold("Idea Pool")}: ${state.idea_pool.length} ideas`);
    }

    if (state.selected_directions) {
      console.log(`\n  ${chalk.bold("Selected Directions")}: ${state.selected_directions.length}`);
    }

    if (state.meta_cycle_log.length > 0) {
      console.log(`\n  ${chalk.bold("Meta-cycle Log")}: ${state.meta_cycle_log.length} intervention(s)`);
      state.meta_cycle_log.forEach((e) => {
        const status = e.accepted ? chalk.green("accepted") : chalk.dim("dismissed");
        console.log(`  • Phase ${e.phase} — ${e.trigger} — ${status}`);
      });
    }

    if (state.tensions.filter((t) => t.status === "active").length > 0) {
      const active = state.tensions.filter((t) => t.status === "active");
      console.log(`\n  ${chalk.bold("Active Tensions")}: ${active.length}`);
      active.forEach((t) => console.log(chalk.yellow(`  • ${t.description}`)));
    }

    console.log();
  });

// ── acf meta-cycle ───────────────────────────────────────────────────────────

program
  .command("meta-cycle <project-id>")
  .description("Manually trigger a meta-cycle on a saved project")
  .action(async (projectId: string) => {
    header();
    let state: CreativeState;
    try {
      state = loadState(projectId);
    } catch {
      console.log(chalk.red(`  Project not found: ${projectId}`));
      process.exit(1);
    }

    await runMetaCycle(state, true);
    saveState(state);
    console.log(chalk.green(`\n  ✓ State saved.\n`));
  });

// ── acf export ───────────────────────────────────────────────────────────────

program
  .command("export <project-id>")
  .description("Export project state as a formatted markdown report")
  .action((projectId: string) => {
    let state: CreativeState;
    try {
      state = loadState(projectId);
    } catch {
      console.log(chalk.red(`  Project not found: ${projectId}`));
      process.exit(1);
    }

    const lines: string[] = [];

    lines.push(`# ACF Project Report`);
    lines.push(`\n**ID:** ${state.id}`);
    lines.push(`**Created:** ${state.created_at.slice(0, 10)}`);
    lines.push(`**Phase:** ${state.phase} — ${phaseLabel(state.phase)}`);
    lines.push(`\n---\n`);

    lines.push(`## Brief\n\n${state.brief.raw_text}\n`);

    if (state.framing) {
      lines.push(`## Phase 1 — Cognitive Framing\n`);
      lines.push(`### Core Questions\n`);
      state.framing.core_questions?.forEach((q, i) => {
        lines.push(`${i + 1}. **${q.question}**`);
        if (q.why_it_matters) lines.push(`   _${q.why_it_matters}_`);
      });
      lines.push(`\n### Assumptions\n`);
      state.framing.assumptions?.forEach((a) => {
        lines.push(`- [${a.confidence.toUpperCase()}] ${a.assumption} _(${a.source ?? "unknown source"})_`);
      });
      lines.push(`\n### Blind Spot Audit\n`);
      state.framing.blind_spot_audit?.findings?.forEach((f) => lines.push(`- ${f}`));
      lines.push(`\n**Dissenting perspectives:**`);
      state.framing.blind_spot_audit?.dissenting_perspectives?.forEach((p) => lines.push(`- ${p}`));
    }

    if (state.idea_pool && state.idea_pool.length > 0) {
      lines.push(`\n---\n\n## Phase 2 — Idea Pool\n`);
      state.idea_pool.forEach((idea, i) => {
        lines.push(`### ${i + 1}. ${idea.idea_text}`);
        lines.push(`- **Method:** ${idea.source_tag}`);
        if (idea.belief_challenge) lines.push(`- **Challenges:** ${idea.belief_challenge}`);
      });
    }

    if (state.selected_directions && state.selected_directions.length > 0) {
      lines.push(`\n---\n\n## Phase 3 — Selected Directions\n`);
      state.selected_directions.forEach((dir, i) => {
        const idea = state.idea_pool?.find((idea) => idea.id === dir.idea_ref);
        lines.push(`### Direction ${i + 1}: ${idea?.idea_text ?? dir.idea_ref}`);
        lines.push(`- Feasibility: ${dir.feasibility_score}/5`);
        lines.push(`- Impact: ${dir.impact_score}/5`);
        if (dir.risk_notes) lines.push(`- Risk [${dir.risk_severity?.toUpperCase()}]: ${dir.risk_notes}`);
        lines.push(`- **Dissent:** ${dir.dissent_record}`);
      });
    }

    if (state.meta_cycle_log.length > 0) {
      lines.push(`\n---\n\n## Meta-cycle Log\n`);
      state.meta_cycle_log.forEach((e, i) => {
        lines.push(`### Intervention ${i + 1} — Phase ${e.phase} (${e.trigger})\n`);
        lines.push(`**Thesis:** ${e.thesis}\n`);
        lines.push(`**Antithesis:**`);
        lines.push(`- Challenge: ${e.antithesis.challenge}`);
        lines.push(`- Alternative: ${e.antithesis.alternative}`);
        lines.push(`- Provocation: _${e.antithesis.provocation}_\n`);
        lines.push(`**Synthesis:** ${e.synthesis.evolution_note}`);
        lines.push(`**Recommendation:** ${e.synthesis.phase_recommendation.toUpperCase()}`);
        lines.push(`**Accepted:** ${e.accepted ? "Yes" : "No"}\n`);
      });
    }

    if (state.tensions.length > 0) {
      lines.push(`\n---\n\n## Active Tensions\n`);
      state.tensions
        .filter((t) => t.status === "active")
        .forEach((t) => lines.push(`- ${t.description}`));
    }

    console.log(lines.join("\n"));
  });

// ── Run ───────────────────────────────────────────────────────────────────────

program.parse(process.argv);
