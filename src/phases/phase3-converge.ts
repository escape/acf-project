import type { CreativeState, SelectedDirection } from "../state.js";
import { addArtifact } from "../state.js";
import type { PhaseDeps } from "../adapters/deps.js";
import type { Style } from "../adapters/ui/adapter.js";
import { phase3ScoringPrompt } from "../engine/prompts.js";
import { checkPhase3ExitCriteria } from "../utils/exit-criteria.js";

function scoreBar(score: number, max = 5): string {
  return "█".repeat(score) + "░".repeat(max - score) + ` ${score}/${max}`;
}

function riskStyle(severity?: string): Style {
  switch (severity) {
    case "critical": return "error";
    case "high": return "warn";
    case "moderate": return "info";
    default: return "success";
  }
}

export async function runPhase3(state: CreativeState, deps: PhaseDeps): Promise<void> {
  const { llm, ui } = deps;

  ui.section("PHASE 3 — Directional Convergence");

  if (!state.idea_pool || state.idea_pool.length === 0) {
    ui.error("No idea pool found. Run Phase 2 first.");
    return;
  }

  ui.line("Scoring ideas and generating dissent records...", "dim");

  const { system, user } = phase3ScoringPrompt(state);
  const rawDirs = await llm.callJson<SelectedDirection[] | Record<string, SelectedDirection[]>>(
    system,
    user,
    { maxTokens: 2500 }
  );
  const directions: SelectedDirection[] = Array.isArray(rawDirs)
    ? rawDirs
    : (Object.values(rawDirs).find(Array.isArray) ?? []);

  ui.heading("Suggested Directions");

  directions.forEach((dir, i) => {
    const idea = state.idea_pool?.find((idea) => idea.id === dir.idea_ref);
    const rStyle = riskStyle(dir.risk_severity);

    ui.line(`[${i + 1}] ${idea?.idea_text ?? dir.idea_ref}`, "bold");
    ui.segments([
      { text: "     Feasibility: " },
      { text: scoreBar(dir.feasibility_score), style: "info" },
    ]);
    ui.segments([
      { text: "     Impact:      " },
      { text: scoreBar(dir.impact_score), style: "accent" },
    ]);
    if (dir.risk_notes) {
      ui.segments([
        { text: "     Risk:        " },
        { text: `[${(dir.risk_severity ?? "?").toUpperCase()}]`, style: rStyle },
        { text: ` ${dir.risk_notes}` },
      ]);
    }
    ui.line(`     Dissent:     ${dir.dissent_record}`, "warn");
    ui.blank();
  });

  // Confirm or override
  const confirmed = await ui.confirm("Accept these directions? (n to manually select)", true);

  let finalDirections = directions;

  if (!confirmed) {
    // checkbox-style multi-select via repeated single choices isn't ergonomic;
    // use a single choice that lists each idea and lets the user pick up to 3
    // by repeating. Simpler: prompt one direction at a time, then stop.
    // For visual + behavioral parity with inquirer's checkbox, we ask the user
    // to type comma-separated indices instead.
    const ideaList = state.idea_pool ?? [];
    ideaList.forEach((idea, idx) => {
      ui.line(`${idx + 1}. [${idea.source_tag}] ${idea.idea_text.slice(0, 80)}`);
    });
    const indicesStr = await ui.text(
      "Enter 1-3 idea numbers separated by commas (e.g. 1,3,5):",
      {
        validate: (v) => {
          const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
          if (parts.length < 1 || parts.length > 3) return "Select 1–3 directions";
          if (parts.some((p) => !/^\d+$/.test(p))) return "Use numbers only";
          const nums = parts.map(Number);
          if (nums.some((n) => n < 1 || n > ideaList.length)) return `Numbers must be 1–${ideaList.length}`;
          return true;
        },
      }
    );

    const selected = indicesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => ideaList[Number(n) - 1].id);

    finalDirections = selected.map((id) => {
      const existing = directions.find((d) => d.idea_ref === id);
      if (existing) return existing;
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
  ui.blank();
  const check = checkPhase3ExitCriteria(state);
  if (check.passed) {
    ui.success("Exit criteria met");
    state.phase_status = "exit_criteria_met";
  } else {
    ui.error("Exit criteria not met:");
    check.failures.forEach((f) => ui.line(`    - ${f}`, "error"));
    state.phase_status = "blocked";
  }
}
