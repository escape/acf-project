// UIAdapter — abstracts all human-facing I/O so the engine never imports
// inquirer, chalk, console, or any other terminal-specific module.
// A mobile shell implements the same interface with React Native components.

export type Style =
  | "normal"
  | "dim"
  | "bold"
  | "success"   // green
  | "warn"      // yellow
  | "error"    // red
  | "info"      // cyan
  | "accent";   // magenta/highlight

export interface Choice<T> {
  label: string;
  value: T;
}

export interface Segment {
  text: string;
  style?: Style;
}

export interface TextInputOpts {
  validate?: (v: string) => true | string;
  default?: string;
}

export interface UIAdapter {
  // ── Block elements ──────────────────────────────────────────────────────────
  section(title: string): void;              // Big phase header with dividers
  heading(text: string): void;               // Subheading (bold)
  divider(): void;
  blank(): void;

  // ── Inline text ─────────────────────────────────────────────────────────────
  line(text: string, style?: Style): void;
  labeled(label: string, value: string, labelStyle?: Style): void; // "Works:  …"
  bullet(text: string, opts?: { marker?: string; markerStyle?: Style; textStyle?: Style }): void;
  segments(parts: Segment[]): void;          // One line composed of styled segments
  raw(text: string): void;                   // Multiline content shown verbatim

  // ── Status sugar ────────────────────────────────────────────────────────────
  success(text: string): void;
  warn(text: string): void;
  error(text: string): void;

  // ── Input ───────────────────────────────────────────────────────────────────
  text(question: string, opts?: TextInputOpts): Promise<string>;
  choice<T>(question: string, options: Choice<T>[], defaultValue?: T): Promise<T>;
  confirm(question: string, defaultValue?: boolean): Promise<boolean>;
}
