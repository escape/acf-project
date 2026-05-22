import fs from "fs";
import path from "path";
import type { CreativeState } from "../../state.js";
import type {
  ExportRef,
  PatternLibrary,
  ProjectSummary,
  StateStore,
} from "./adapter.js";

export interface FilesystemStoreConfig {
  // Root directory under which projects/ exports/ and pattern-library.json live.
  // Defaults to ./projects (matches current CLI behavior).
  rootDir?: string;
}

export function createFilesystemStore(config: FilesystemStoreConfig = {}): StateStore {
  const rootDir = config.rootDir ?? path.join(process.cwd(), "projects");
  const exportsDir = path.join(rootDir, "exports");
  const patternsFile = path.join(rootDir, "pattern-library.json");

  const projectPath = (id: string) => path.join(rootDir, `${id}.json`);

  const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  };

  return {
    async save(state: CreativeState): Promise<void> {
      ensureDir(rootDir);
      state.updated_at = new Date().toISOString();
      fs.writeFileSync(projectPath(state.id), JSON.stringify(state, null, 2), "utf-8");
    },

    async load(id: string): Promise<CreativeState | null> {
      const p = projectPath(id);
      if (!fs.existsSync(p)) return null;
      return JSON.parse(fs.readFileSync(p, "utf-8")) as CreativeState;
    },

    async list(): Promise<ProjectSummary[]> {
      if (!fs.existsSync(rootDir)) return [];
      return fs
        .readdirSync(rootDir)
        .filter((f) => f.endsWith(".json") && f.startsWith("proj_"))
        .map((f) => {
          const s = JSON.parse(fs.readFileSync(path.join(rootDir, f), "utf-8")) as CreativeState;
          return {
            id: s.id,
            phase: s.phase,
            brief: s.brief.raw_text.slice(0, 80),
            updated_at: s.updated_at,
          };
        })
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async exists(id: string): Promise<boolean> {
      return fs.existsSync(projectPath(id));
    },

    async loadPatternLibrary(): Promise<PatternLibrary> {
      if (!fs.existsSync(patternsFile)) {
        return { updated_at: new Date().toISOString(), entries: [] };
      }
      return JSON.parse(fs.readFileSync(patternsFile, "utf-8")) as PatternLibrary;
    },

    async savePatternLibrary(lib: PatternLibrary): Promise<void> {
      ensureDir(rootDir);
      lib.updated_at = new Date().toISOString();
      fs.writeFileSync(patternsFile, JSON.stringify(lib, null, 2), "utf-8");
    },

    async exportArtifact(_projectId, filename, content): Promise<ExportRef> {
      ensureDir(exportsDir);
      const filepath = path.join(exportsDir, filename);
      fs.writeFileSync(filepath, content, "utf-8");
      return { ref: filepath };
    },
  };
}
