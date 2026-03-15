# ACF — Adaptive Creative Framework (Claude Code POC)

## What This Is

A CLI tool that runs creative projects through a structured framework with an embedded dialectical engine. The engine detects when creative work is stagnating, drifting, or falling into groupthink — and introduces productive contradiction to force evolution.

## Core Concept

Seven phases guide a creative project from brief to delivery. At each phase boundary (and optionally mid-phase), a **Hegelian meta-cycle** evaluates the work: it summarizes the current position (thesis), generates a structured counter-position (antithesis), and proposes an evolved reframing (synthesis). The human always decides whether to accept.

## POC Scope

Build phases 1–3 and the meta-cycle engine. Phases 4–7 are stubbed.

- **Phase 1 — Cognitive Framing**: Take a raw brief, generate core questions, surface assumptions, run a blind-spot audit.
- **Phase 2 — Divergent Exploration**: Generate 5+ ideas using varied methods (analogy, inversion, provocation, etc.), each tagged with which assumption it challenges.
- **Phase 3 — Directional Convergence**: Score and select directions. Force dissent generation for every selection.
- **Meta-cycle**: Runs at each phase transition. Checks for stagnation, groupthink, drift, comfort-zone. If triggered, runs thesis→antithesis→synthesis and proposes state mutation.

## Key Files

- `acf-contract.yaml` — The semantic contract. This is the specification. Read it first.
- `creative-state.schema.json` — JSON Schema for the CreativeState object (the central data structure).

## Architecture Decisions

- **Language**: TypeScript (Node.js)
- **Interface**: CLI with interactive prompts (use `inquirer` or similar)
- **LLM calls**: Use Anthropic SDK (`@anthropic-ai/sdk`). Model: `claude-sonnet-4-20250514`
- **State**: Local filesystem. Save state as JSON files in a `./projects/` directory.
- **No database**: In-memory for POC. No vector DB, no containers.
- **No web UI**: CLI only for now.

## Project Structure

```
acf/
├── CLAUDE.md                      # This file
├── acf-contract.yaml              # Semantic contract (spec)
├── creative-state.schema.json     # JSON Schema
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   # CLI entry point
│   ├── state.ts                   # CreativeState management (load/save/validate)
│   ├── phases/
│   │   ├── phase1-framing.ts      # Cognitive Framing
│   │   ├── phase2-diverge.ts      # Divergent Exploration
│   │   ├── phase3-converge.ts     # Directional Convergence
│   │   └── phase-stubs.ts         # Phases 4-7 (placeholder)
│   ├── engine/
│   │   ├── meta-cycle.ts          # Hegelian meta-cycle logic
│   │   ├── tension-detector.ts    # Detects stagnation, drift, groupthink
│   │   └── prompts.ts             # All LLM prompt templates
│   └── utils/
│       ├── llm.ts                 # Anthropic API wrapper
│       └── exit-criteria.ts       # Phase transition validation
└── projects/                      # Saved project states (gitignored)
```

## How It Should Work (User Flow)

```
$ acf new
> Enter your creative brief: "Rebrand a 50-year-old regional bank for Gen Z without alienating existing customers"

[Phase 1: Cognitive Framing]
Generating core questions...
  1. What does "Gen Z" actually mean for this bank's geography?
  2. What are existing customers' emotional anchors to the current brand?
  3. ...

Surfacing assumptions...
  - "Gen Z wants digital-first" (confidence: medium, source: industry reports)
  - "Existing customers resist change" (confidence: low, source: assumption)

Running blind-spot audit...
  - Missing perspective: employees who embody the current brand
  - Missing perspective: Gen Z who already bank here

Exit criteria check: ✓ met
Meta-cycle check: ⚠ Trigger: comfort_zone — all assumptions are industry clichés

[Meta-Cycle Intervention]
Thesis: The framing assumes a generational binary (Gen Z vs. existing).
Antithesis: What if the real tension isn't generational but geographic — urban vs. rural identity?
Provocation: Is "rebrand" the right word, or is this actually a "brand extension"?

Accept synthesis? [y/n/edit]

[Phase 2: Divergent Exploration]
...
```

## LLM Prompt Design Principles

- Every prompt includes the relevant section of the semantic contract as context.
- Prompts ask for structured JSON output matching the schema.
- The meta-cycle prompt explicitly receives the trigger reason and must address it specifically — no generic "have you considered the opposite?" responses.
- Dissent generation prompts must produce substantive disagreement, not token pushback.

## Commands

- `acf new` — Start a new project from a brief
- `acf resume <project-id>` — Resume a saved project
- `acf status <project-id>` — Show current state summary
- `acf meta-cycle <project-id>` — Manually trigger a meta-cycle
- `acf export <project-id>` — Export state as formatted markdown report

## What Good Looks Like

- The tool should feel like working with a sharp creative director who won't let you be lazy.
- Meta-cycle interventions should be specific and uncomfortable, not generic.
- Phase transitions should feel earned — exit criteria matter.
- The state file should be a complete, readable record of creative evolution.

## What Bad Looks Like

- Generic LLM outputs ("Have you considered thinking outside the box?")
- Meta-cycle that always fires or never fires
- Phase transitions without meaningful state changes
- Prompts that don't use the contract/schema as grounding
