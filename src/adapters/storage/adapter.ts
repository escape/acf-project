import type { CreativeState } from "../../state.js";

export interface ProjectSummary {
  id: string;
  brief: string;
  phase: number;
  updated_at: string;
}

export interface PatternLibraryEntry {
  project_id: string;
  date: string;
  process_patches: string[];
  belief_calibration: string[];
  pattern_library: string[];
}

export interface PatternLibrary {
  updated_at: string;
  entries: PatternLibraryEntry[];
}

export interface ExportRef {
  // CLI: filesystem path. Mobile: document URI, share link, or AsyncStorage key.
  ref: string;
}

export interface StateStore {
  // ── Project state ───────────────────────────────────────────────────────────
  save(state: CreativeState): Promise<void>;
  load(id: string): Promise<CreativeState | null>;
  list(): Promise<ProjectSummary[]>;
  exists(id: string): Promise<boolean>;

  // ── Pattern library (cross-project, accumulates) ────────────────────────────
  loadPatternLibrary(): Promise<PatternLibrary>;
  savePatternLibrary(lib: PatternLibrary): Promise<void>;

  // ── Exported artifacts (Phase 6 deliverables, markdown exports, …) ─────────
  exportArtifact(projectId: string, filename: string, content: string): Promise<ExportRef>;
}
