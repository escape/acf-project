import type { CreativeState } from "../state.js";

export type ExitCheckResult = { passed: boolean; failures: string[] };

export function checkPhase1ExitCriteria(state: CreativeState): ExitCheckResult {
  const failures: string[] = [];
  const f = state.framing;

  if (!f || (f.core_questions?.length ?? 0) < 3)
    failures.push("At least 3 core questions required");

  if (!f || (f.assumptions?.length ?? 0) < 2)
    failures.push("At least 2 explicit assumptions required");

  if (!f?.blind_spot_audit)
    failures.push("Blind spot audit must be completed");

  return { passed: failures.length === 0, failures };
}

export function checkPhase2ExitCriteria(state: CreativeState): ExitCheckResult {
  const failures: string[] = [];
  const pool = state.idea_pool ?? [];

  if (pool.length < 5) failures.push(`Minimum 5 ideas required (have ${pool.length})`);

  const challenging = pool.filter((i) => i.belief_challenge && i.belief_challenge.trim().length > 0);
  if (challenging.length < 2) failures.push("At least 2 ideas must challenge an existing assumption");

  const tags = new Set(pool.map((i) => i.source_tag));
  if (tags.size < 2) failures.push("Ideas must span at least 2 different source_tags");

  return { passed: failures.length === 0, failures };
}

export function checkPhase3ExitCriteria(state: CreativeState): ExitCheckResult {
  const failures: string[] = [];
  const dirs = state.selected_directions ?? [];

  if (dirs.length < 1) failures.push("At least 1 direction must be selected");

  const missingDissent = dirs.filter((d) => !d.dissent_record || d.dissent_record.trim().length < 10);
  if (missingDissent.length > 0)
    failures.push(`Dissent record missing or too thin for ${missingDissent.length} direction(s)`);

  return { passed: failures.length === 0, failures };
}

export function checkExitCriteria(state: CreativeState): ExitCheckResult {
  switch (state.phase) {
    case 1: return checkPhase1ExitCriteria(state);
    case 2: return checkPhase2ExitCriteria(state);
    case 3: return checkPhase3ExitCriteria(state);
    default: return { passed: true, failures: [] };
  }
}
