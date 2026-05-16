#!/usr/bin/env node
import { program } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import {
  createNewState,
  loadState,
  saveState,
  listProjects,
  generateId,
  type CreativeState,
  type Lens,
} from "./state.js";
import { showProjectStats } from "./commands/stats.js";
import { runPhase1 } from "./phases/phase1-framing.js";
import { runPhase2 } from "./phases/phase2-diverge.js";
import { runPhase3 } from "./phases/phase3-converge.js";
import { runPhase4 } from "./phases/phase4-craft.js";
import { runPhase5 } from "./phases/phase5-polish.js";
import { runPhase6 } from "./phases/phase6-deliver.js";
import { runPhase7 } from "./phases/phase7-learn.js";
import { runMetaCycle, checkAndRunMetaCycle } from "./engine/meta-cycle.js";

// ── Logging ───────────────────────────────────────────────────────────────────

const ANSI_RE = /\x1B\[[0-9;]*[mGKHFABCDJK]/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, "");
}

function setupLogFile(logPath: string): void {
  const resolved = path.resolve(logPath);
  const stream = fs.createWriteStream(resolved, { flags: "a" });

  stream.write(`\n${"─".repeat(60)}\n`);
  stream.write(`ACF session — ${new Date().toISOString()}\n`);
  stream.write(`${"─".repeat(60)}\n\n`);

  // Buffer current line; reset on \r (inquirer redraws), flush on \n
  let lineBuf = "";

  function logChunk(text: string): void {
    for (const ch of text) {
      if (ch === "\r") {
        lineBuf = "";           // inquirer is rewriting this line — discard partial
      } else if (ch === "\n") {
        stream.write(lineBuf + "\n");
        lineBuf = "";
      } else {
        lineBuf += ch;
      }
    }
  }

  const originalWrite = process.stdout.write.bind(process.stdout) as typeof process.stdout.write;
  (process.stdout as NodeJS.WriteStream).write = function (
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void
  ): boolean {
    const text = chunk instanceof Uint8Array ? new TextDecoder().decode(chunk) : chunk;
    logChunk(stripAnsi(text));
    if (typeof encodingOrCb === "function") {
      return originalWrite(chunk, encodingOrCb);
    }
    return originalWrite(chunk, encodingOrCb as BufferEncoding, cb);
  } as typeof process.stdout.write;

  process.on("exit", () => {
    if (lineBuf) stream.write(lineBuf + "\n"); // flush any trailing partial line
    stream.end();
  });
  console.log(chalk.dim(`  Logging to: ${resolved}\n`));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  .version("0.1.0")
  .option("--log", "write a plain-text transcript of this session to acf-session.log")
  .option("--log-file <path>", "write a plain-text transcript to a specific file")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.logFile) {
      setupLogFile(opts.logFile as string);
    } else if (opts.log) {
      setupLogFile("acf-session.log");
    }
  });

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

// ── acf stats ─────────────────────────────────────────────────────────────────

program
  .command("stats")
  .description("Show overall project statistics")
  .action(() => {
    header();
    showProjectStats();
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

    const markdown = lines.join("\n");

    // Write to file
    const exportDir = path.join(process.cwd(), "projects", "exports");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const exportPath = path.join(exportDir, `${state.id}.md`);
    fs.writeFileSync(exportPath, markdown, "utf-8");

    // Also print to terminal
    console.log(markdown);
    console.log(chalk.green(`\n  ✓ Saved to: ${exportPath}\n`));
  });

// ── acf assume ───────────────────────────────────────────────────────────────

program
  .command("assume <project-id> <instruction>")
  .description("Inject a persistent assumption into all future LLM calls")
  .option("--from <phase>", "activate from this phase number onward", "1")
  .option("--label <label>", "short label for this assumption")
  .action((projectId: string, instruction: string, opts) => {
    let state: CreativeState;
    try { state = loadState(projectId); } catch {
      console.log(chalk.red(`  Project not found: ${projectId}`)); process.exit(1);
    }
    if (!state.lenses) state.lenses = [];
    const lens: Lens = {
      id: generateId("lens"),
      type: "assumption",
      instruction,
      label: opts.label ?? instruction.slice(0, 50),
      phase_from: parseInt(opts.from, 10) || 1,
      active: true,
      created_at: new Date().toISOString(),
    };
    state.lenses.push(lens);
    saveState(state);
    console.log(chalk.green(`\n  ✓ Assumption active from Phase ${lens.phase_from}:`));
    console.log(chalk.white(`    "${instruction}"\n`));
  });

// ── acf lens ─────────────────────────────────────────────────────────────────

program
  .command("lens <project-id> <instruction>")
  .description("Inject a persistent reasoning persona/frame into all future LLM calls")
  .option("--from <phase>", "activate from this phase number onward", "1")
  .option("--label <label>", "short label for this lens")
  .action((projectId: string, instruction: string, opts) => {
    let state: CreativeState;
    try { state = loadState(projectId); } catch {
      console.log(chalk.red(`  Project not found: ${projectId}`)); process.exit(1);
    }
    if (!state.lenses) state.lenses = [];
    const lens: Lens = {
      id: generateId("lens"),
      type: "persona",
      instruction: `Reason like ${instruction}`,
      label: opts.label ?? instruction.slice(0, 50),
      phase_from: parseInt(opts.from, 10) || 1,
      active: true,
      created_at: new Date().toISOString(),
    };
    state.lenses.push(lens);
    saveState(state);
    console.log(chalk.green(`\n  ✓ Lens active from Phase ${lens.phase_from}:`));
    console.log(chalk.white(`    "Reason like ${instruction}"\n`));
  });

// ── acf lenses ───────────────────────────────────────────────────────────────

program
  .command("lenses <project-id>")
  .description("List all active lenses and assumptions for a project")
  .action((projectId: string) => {
    header();
    let state: CreativeState;
    try { state = loadState(projectId); } catch {
      console.log(chalk.red(`  Project not found: ${projectId}`)); process.exit(1);
    }
    const lenses = state.lenses ?? [];
    if (lenses.length === 0) {
      console.log(chalk.dim("  No lenses or assumptions set.\n"));
      return;
    }
    console.log(chalk.bold("  Active Lenses & Assumptions\n"));
    lenses.forEach((l) => {
      const status = l.active ? chalk.green("active") : chalk.dim("inactive");
      const type = l.type === "assumption" ? chalk.cyan("[assume]") : chalk.magenta("[lens]  ");
      console.log(`  ${type} ${status}  from Phase ${l.phase_from}  ${chalk.dim(l.id)}`);
      console.log(`         ${l.instruction}`);
      console.log();
    });
  });

// ── acf drop-lens ─────────────────────────────────────────────────────────────

program
  .command("drop-lens <project-id> <lens-id>")
  .description("Deactivate a lens or assumption by its ID")
  .action((projectId: string, lensId: string) => {
    let state: CreativeState;
    try { state = loadState(projectId); } catch {
      console.log(chalk.red(`  Project not found: ${projectId}`)); process.exit(1);
    }
    const lens = (state.lenses ?? []).find((l) => l.id === lensId);
    if (!lens) {
      console.log(chalk.red(`  Lens not found: ${lensId}`)); process.exit(1);
    }
    lens.active = false;
    saveState(state);
    console.log(chalk.green(`\n  ✓ Lens deactivated: "${lens.label}"\n`));
  });

// ── Run ───────────────────────────────────────────────────────────────────────

program.parse(process.argv);
