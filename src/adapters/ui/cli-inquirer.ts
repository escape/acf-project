import chalk from "chalk";
import inquirer from "inquirer";
import type { Choice, Segment, Style, TextInputOpts, UIAdapter } from "./adapter.js";

const styleFn: Record<Style, (s: string) => string> = {
  normal: (s) => s,
  dim: chalk.dim,
  bold: chalk.bold,
  success: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  info: chalk.cyan,
  accent: chalk.magenta,
};

const apply = (text: string, style: Style = "normal"): string => styleFn[style](text);

export function createCliUIAdapter(): UIAdapter {
  return {
    section(title) {
      console.log("\n" + chalk.blue("━".repeat(60)));
      console.log(chalk.blue.bold(`  ${title}`));
      console.log(chalk.blue("━".repeat(60)) + "\n");
    },

    heading(text) {
      console.log("\n" + chalk.bold(`  ${text}\n`));
    },

    divider() {
      console.log(chalk.dim("  " + "─".repeat(58)));
    },

    blank() {
      console.log();
    },

    line(text, style = "normal") {
      console.log("  " + apply(text, style));
    },

    labeled(label, value, labelStyle = "normal") {
      console.log("  " + apply(label, labelStyle) + value);
    },

    bullet(text, opts) {
      const marker = opts?.marker ?? "•";
      const markerStyle: Style = opts?.markerStyle ?? "dim";
      const textStyle: Style = opts?.textStyle ?? "normal";
      console.log(`  ${apply(marker, markerStyle)} ${apply(text, textStyle)}`);
    },

    segments(parts: Segment[]) {
      const composed = parts.map((p) => apply(p.text, p.style ?? "normal")).join("");
      console.log("  " + composed);
    },

    raw(text) {
      console.log("  " + text.replace(/\n/g, "\n  "));
    },

    success(text) {
      console.log(chalk.green(`  ✓ ${text}`));
    },

    warn(text) {
      console.log(chalk.yellow(`  ⚠ ${text}`));
    },

    error(text) {
      console.log(chalk.red(`  ✗ ${text}`));
    },

    async text(question, opts: TextInputOpts = {}) {
      const { value } = await inquirer.prompt<{ value: string }>([
        {
          type: "input",
          name: "value",
          message: question,
          default: opts.default,
          validate: opts.validate,
        },
      ]);
      return value;
    },

    async choice<T>(question: string, options: Choice<T>[], defaultValue?: T): Promise<T> {
      const { value } = await inquirer.prompt<{ value: T }>([
        {
          type: "list",
          name: "value",
          message: question,
          choices: options.map((o) => ({ name: o.label, value: o.value })),
          default: defaultValue,
        },
      ]);
      return value;
    },

    async confirm(question, defaultValue = false) {
      const { value } = await inquirer.prompt<{ value: boolean }>([
        { type: "confirm", name: "value", message: question, default: defaultValue },
      ]);
      return value;
    },
  };
}
