import type { CreativeState, MetaCycleEntry } from "../state.js";

// ── Heuristic similarity (Jaccard on word tokens) ────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

// ── Trigger detection ────────────────────────────────────────────────────────

export type TriggerReason = "stagnation" | "groupthink" | "drift" | "comfort_zone" | "manual";
export type DetectionResult =
  | { triggered: false }
  | { triggered: true; reason: TriggerReason; detail: string };

export function detectTriggers(state: CreativeState): DetectionResult {
  // Guard: max 3 meta-cycles per phase
  const cycleCount = (state.meta_cycle_count ?? {})[state.phase] ?? 0;
  if (cycleCount >= 3) return { triggered: false };

  // 1. STAGNATION — check if last two artifacts in this phase are very similar
  const phaseArtifacts = state.artifacts.filter((a) => a.phase === state.phase);
  if (phaseArtifacts.length >= 2) {
    const last = phaseArtifacts[phaseArtifacts.length - 1];
    const prev = phaseArtifacts[phaseArtifacts.length - 2];
    const sim = jaccard(tokenize(last.content), tokenize(prev.content));
    if (sim > 0.75) {
      return {
        triggered: true,
        reason: "stagnation",
        detail: `Last two artifacts are ${Math.round(sim * 100)}% lexically similar — work is not evolving.`,
      };
    }
  }

  // 2. GROUPTHINK — dissent records are empty or trivially short
  if (state.phase === 3 && state.selected_directions && state.selected_directions.length > 0) {
    const thinDissent = state.selected_directions.filter(
      (d) => !d.dissent_record || d.dissent_record.trim().length < 30
    );
    if (thinDissent.length > 0) {
      return {
        triggered: true,
        reason: "groupthink",
        detail: `${thinDissent.length} selected direction(s) have no substantive dissent on record.`,
      };
    }
  }

  // 3. DRIFT — current artifacts diverge from core framing questions
  if (state.framing?.core_questions && phaseArtifacts.length > 0) {
    const framingText = state.framing.core_questions.map((q) => q.question).join(" ");
    const framingTokens = tokenize(framingText);
    const latestTokens = tokenize(phaseArtifacts[phaseArtifacts.length - 1].content);
    const overlap = jaccard(framingTokens, latestTokens);
    // Low overlap with framing suggests drift (threshold: < 0.08 for sparse texts)
    if (phaseArtifacts.length > 0 && overlap < 0.05 && framingTokens.size > 10) {
      return {
        triggered: true,
        reason: "drift",
        detail: `Current work has low lexical overlap (${Math.round(overlap * 100)}%) with original framing questions — possible drift from the core problem.`,
      };
    }
  }

  // 4. COMFORT ZONE — all selected directions have low risk
  if (state.phase === 3 && state.selected_directions && state.selected_directions.length > 0) {
    const allLowRisk = state.selected_directions.every(
      (d) => !d.risk_severity || d.risk_severity === "low"
    );
    if (allLowRisk) {
      return {
        triggered: true,
        reason: "comfort_zone",
        detail: "All selected directions have low risk severity — no bold bets on the table.",
      };
    }
  }

  // 5. Phase 1 specific: assumptions contradict each other (confidence mismatch + opposing sources)
  if (state.phase === 1 && state.framing?.assumptions) {
    const assumptions = state.framing.assumptions;
    if (assumptions.length >= 2) {
      const allSameSentiment = assumptions.every((a) => a.confidence === assumptions[0].confidence);
      const allIndustry = assumptions.filter(
        (a) => a.source?.toLowerCase().includes("industry") || a.source?.toLowerCase().includes("report")
      );
      if (allIndustry.length === assumptions.length) {
        return {
          triggered: true,
          reason: "comfort_zone",
          detail: "All assumptions are sourced from industry reports — no first-hand or contrarian sources.",
        };
      }
    }
  }

  return { triggered: false };
}

export function incrementMetaCycleCount(state: CreativeState): void {
  if (!state.meta_cycle_count) state.meta_cycle_count = {};
  state.meta_cycle_count[state.phase] = ((state.meta_cycle_count[state.phase] ?? 0) + 1);
}

export function getLastMetaCycleForPhase(
  state: CreativeState
): MetaCycleEntry | undefined {
  return [...state.meta_cycle_log].reverse().find((e) => e.phase === state.phase);
}
