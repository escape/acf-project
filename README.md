# ACF: Adaptive Creative Framework

A CLI tool that runs creative projects through a seven-phase structured framework with an embedded **Hegelian meta-cycle engine** — a dialectical process that detects stagnation, groupthink, and drift in creative work, then introduces productive contradiction to force evolution.

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd acf
npm install

# Start a new project
npx tsx src/index.ts new

# Resume a project
npx tsx src/index.ts resume <project-id>
```

## How It Works

You provide a creative brief. The tool walks you through three phases (POC scope):

1. **Cognitive Framing** — Surfaces assumptions, generates core questions, audits blind spots
2. **Divergent Exploration** — Generates varied ideas, each tagged by method and which assumption it challenges
3. **Directional Convergence** — Scores, selects, and forces substantive dissent on every choice

At each phase boundary, the **meta-cycle engine** evaluates your creative state for:
- **Stagnation** — work not evolving between iterations
- **Groupthink** — uniform agreement without real dissent
- **Drift** — current work diverging from original intent
- **Comfort zone** — all choices are safe, nothing bold

When triggered, it runs a thesis → antithesis → synthesis cycle and proposes a reframing. You always decide whether to accept.

## Project Structure

- `acf-contract.yaml` — The semantic contract (specification of the entire framework)
- `creative-state.schema.json` — JSON Schema for the central state object
- `CLAUDE.md` — Project brief for Claude Code development
- `src/` — Implementation (TypeScript, CLI)

## Building with Claude Code

This project is designed to be built with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). The `CLAUDE.md` file contains the full project brief. Point Claude Code at this directory and tell it to start building.

## License

CC BY 4.0 — Wladimiro Bizzotto
