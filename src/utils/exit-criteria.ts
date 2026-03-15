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

export function checkPhase4ExitCriteria(state: CreativeState): ExitCheckResult {
  const failures: string[] = [];
  const iterations = state.iterations ?? [];

  if (iterations.length < 2)
    failures.push(`At least 2 iterations required (have ${iterations.length})`);

  const missingFeedback = iterations.filter((i) => !i.feedback || i.feedback.trim().length < 10);
  if (missingFeedback.length > 0)
    failures.push(`${missingFeedback.length} iteration(s) missing substantive feedback`);

  const missingRetro = iterations.filter((i) => !i.retro_notes || i.retro_notes.trim().length < 10);
  if (missingRetro.length > 0)
    failures.push(`${missingRetro.length} iteration(s) missing retro notes`);

  return { passed: failures.length === 0, failures };
}

export function checkPhase5ExitCriteria(state: CreativeState): ExitCheckResult {
  const failures: string[] = [];
  const ia = state.integrated_artifact;

  if (!ia?.coherence_report || ia.coherence_report.trim().length < 20)
    failures.push("Coherence report missing or too thin");

  if (!ia?.ethics_check || ia.ethics_check.trim().length < 10)
    failures.push("Ethics check missing");

  return { passed: failures.length === 0, failures };
}

export function checkPhase6ExitCriteria(state: CreativeState): ExitCheckResult {
  const failures: string[] = [];

  if (!state.delivered_work?.final_artifact)
    failures.push("Work not yet delivered");

  if (!state.project_retro)
    failures.push("Project retrospective not completed");
  else {
    if ((state.project_retro.what_worked?.length ?? 0) === 0)
      failures.push("Retro: what_worked is empty");
    if ((state.project_retro.what_didnt?.length ?? 0) === 0)
      failures.push("Retro: what_didnt is empty");
  }

  return { passed: failures.length === 0, failures };
}

export function checkPhase7ExitCriteria(state: CreativeState): ExitCheckResult {
  const failures: string[] = [];
  const mu = state.methodology_updates;

  if (!mu) {
    failures.push("Methodology updates not generated");
  } else {
    if ((mu.process_patches?.length ?? 0) === 0) failures.push("No process patches generated");
    if ((mu.pattern_library?.length ?? 0) === 0) failures.push("No pattern library entries generated");
  }

  return { passed: failures.length === 0, failures };
}

export function checkExitCriteria(state: CreativeState): ExitCheckResult {
  switch (state.phase) {
    case 1: return checkPhase1ExitCriteria(state);
    case 2: return checkPhase2ExitCriteria(state);
    case 3: return checkPhase3ExitCriteria(state);
    case 4: return checkPhase4ExitCriteria(state);
    case 5: return checkPhase5ExitCriteria(state);
    case 6: return checkPhase6ExitCriteria(state);
    case 7: return checkPhase7ExitCriteria(state);
    default: return { passed: true, failures: [] };
  }
}
