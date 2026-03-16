import fs from "fs";
import path from "path";
import { createHash } from "crypto";

// ── Types derived from creative-state.schema.json ──────────────────────────

export interface CoreQuestion {
  question: string;
  why_it_matters?: string;
}

export interface Constraint {
  constraint: string;
  type: "budget" | "time" | "ethical" | "legal" | "technical" | "cultural" | "other";
  hard?: boolean;
}

export interface Assumption {
  assumption: string;
  confidence: "high" | "medium" | "low" | "untested";
  source?: string;
}

export interface BlindSpotAudit {
  findings: string[];
  dissenting_perspectives: string[];
}

export interface Framing {
  core_questions: CoreQuestion[];
  constraints: Constraint[];
  assumptions: Assumption[];
  blind_spot_audit: BlindSpotAudit;
}

export type SourceTag = "analogy" | "inversion" | "reference" | "combination" | "random" | "provocation" | "constraint_flip";

export interface Idea {
  id: string;
  idea_text: string;
  source_tag: SourceTag;
  belief_challenge?: string;
  raw_notes?: string;
}

export interface SelectedDirection {
  idea_ref: string;
  feasibility_score: number;
  impact_score: number;
  risk_notes?: string;
  risk_severity?: "low" | "moderate" | "high" | "critical";
  dissent_record: string;
}

export interface Artifact {
  id: string;
  phase: number;
  type: "framing_doc" | "idea" | "direction" | "prototype" | "draft" | "final" | "retro" | "meta_cycle_output";
  content: string;
  created_at: string;
}

export interface Tension {
  id: string;
  description: string;
  source?: "human_identified" | "meta_cycle" | "feedback" | "assumption_conflict";
  status: "active" | "resolved" | "deferred" | "escalated";
  resolution?: string;
}

export interface BeliefTag {
  tag: string;
  status: "active" | "challenged" | "revised" | "discarded";
  challenged_by?: string;
}

export interface Lens {
  id: string;
  type: "assumption" | "persona";
  instruction: string;
  label: string;
  phase_from: number;
  active: boolean;
  created_at: string;
}

export interface MetaCycleEntry {
  id: string;
  phase: number;
  trigger: "stagnation" | "groupthink" | "drift" | "comfort_zone" | "manual";
  thesis: string;
  antithesis: {
    challenge: string;
    alternative: string;
    provocation: string;
  };
  synthesis: {
    evolution_note: string;
    phase_recommendation: "stay" | "advance" | "regress";
  };
  accepted?: boolean;
  timestamp: string;
}

// ── Phase 4 types ────────────────────────────────────────────────────────────

export interface Iteration {
  version: number;
  artifact: string;
  feedback: string;
  retro_notes: string;
}

// ── Phase 5 types ────────────────────────────────────────────────────────────

export interface IntegratedArtifact {
  final_draft: string;
  coherence_report: string;
  ethics_check: string;
}

// ── Phase 6 types ────────────────────────────────────────────────────────────

export interface DeliveredWork {
  final_artifact: string;
  context_notes: string;
  reception_log: string;
}

export interface ProjectRetro {
  what_worked: string[];
  what_didnt: string[];
  belief_shifts: string[];
}

// ── Phase 7 types ────────────────────────────────────────────────────────────

export interface MethodologyUpdates {
  process_patches: string[];
  belief_calibration: string[];
  pattern_library: string[];
}

export interface CreativeState {
  id: string;
  created_at: string;
  updated_at: string;
  phase: number;
  phase_status: "in_progress" | "blocked" | "exit_criteria_met" | "meta_cycle_active";
  brief: {
    raw_text: string;
    domain?: string;
    stakeholders?: string[];
  };
  framing?: Framing;
  idea_pool?: Idea[];
  selected_directions?: SelectedDirection[];
  artifacts: Artifact[];
  tensions: Tension[];
  belief_tags: BeliefTag[];
  lenses: Lens[];
  meta_cycle_log: MetaCycleEntry[];
  // Track meta-cycle count per phase to enforce max_cycles_per_phase: 3
  meta_cycle_count?: Record<number, number>;
  // Phase 4
  iterations?: Iteration[];
  // Phase 5
  integrated_artifact?: IntegratedArtifact;
  // Phase 6
  delivered_work?: DeliveredWork;
  project_retro?: ProjectRetro;
  // Phase 7
  methodology_updates?: MethodologyUpdates;
}

// ── Persistence ─────────────────────────────────────────────────────────────

const PROJECTS_DIR = path.join(process.cwd(), "projects");

function projectPath(id: string): string {
  return path.join(PROJECTS_DIR, `${id}.json`);
}

export function generateId(prefix = "proj"): string {
  const ts = Date.now().toString(36);
  const rand = createHash("sha256").update(Math.random().toString()).digest("hex").slice(0, 6);
  return `${prefix}_${ts}_${rand}`;
}

export function saveState(state: CreativeState): void {
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  state.updated_at = new Date().toISOString();
  fs.writeFileSync(projectPath(state.id), JSON.stringify(state, null, 2), "utf-8");
}

export function loadState(id: string): CreativeState {
  const p = projectPath(id);
  if (!fs.existsSync(p)) throw new Error(`Project not found: ${id}`);
  return JSON.parse(fs.readFileSync(p, "utf-8")) as CreativeState;
}

export function listProjects(): Array<{ id: string; phase: number; brief: string; updated_at: string }> {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const s = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), "utf-8")) as CreativeState;
      return { id: s.id, phase: s.phase, brief: s.brief.raw_text.slice(0, 80), updated_at: s.updated_at };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function createNewState(brief: string, domain?: string): CreativeState {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    created_at: now,
    updated_at: now,
    phase: 1,
    phase_status: "in_progress",
    brief: { raw_text: brief, domain },
    artifacts: [],
    tensions: [],
    belief_tags: [],
    lenses: [],
    meta_cycle_log: [],
    meta_cycle_count: {},
  };
}

export function addArtifact(
  state: CreativeState,
  type: Artifact["type"],
  content: string
): void {
  state.artifacts.push({
    id: generateId("art"),
    phase: state.phase,
    type,
    content,
    created_at: new Date().toISOString(),
  });
}
