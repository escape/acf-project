# ACF — Adaptive Creative Framework

A CLI tool that runs creative projects through a **seven-phase structured framework** with an embedded **Hegelian meta-cycle engine** — a dialectical process that detects stagnation, groupthink, and drift in creative work, then introduces productive contradiction to force evolution.

The tool should feel like working with a sharp creative director who won't let you be lazy.

---

## How It Works

You provide a creative brief. ACF walks you through seven phases, using Claude (via the Anthropic API) at each step:

| Phase | Name | What happens |
|---|---|---|
| 1 | **Cognitive Framing** | Surfaces assumptions, generates core questions, audits blind spots |
| 2 | **Divergent Exploration** | Generates varied ideas tagged by method and which assumption each challenges |
| 3 | **Directional Convergence** | Scores and selects directions; forces substantive dissent on every choice |
| 4 | **Iterative Crafting** | Builds the actual artifact in short cycles with critical feedback each round |
| 5 | **Polishing & Integration** | Unifies iterations into a final draft with coherence report and ethics check |
| 6 | **Delivery** | Ships the work, collects reception, generates a project retrospective |
| 7 | **Continuous Learning** | Extracts process patches, updated priors, and reusable patterns — persists them to a cross-project library |

At every phase boundary, the **meta-cycle engine** evaluates the creative state for:

- **Stagnation** — work not evolving between iterations (heuristic: lexical similarity > 75%)
- **Groupthink** — uniform agreement with no substantive dissent captured
- **Drift** — current work diverging from original intent
- **Comfort zone** — all choices are low-risk, nothing bold

When triggered, it runs a **thesis → antithesis → synthesis** cycle and proposes a reframing. You always decide whether to accept.

---

## Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

---

## Installation

```bash
git clone https://github.com/escape/acf-project.git
cd acf-project
npm install
npm run build
```

Set your API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Usage

```bash
# Start a new project
node dist/index.js new

# Resume a saved project
node dist/index.js resume <project-id>

# Show project status
node dist/index.js status
node dist/index.js status <project-id>

# Manually trigger a meta-cycle
node dist/index.js meta-cycle <project-id>

# Export a project as a markdown report (also saves to ./projects/exports/<id>.md)
node dist/index.js export <project-id>
```

### Reasoning Lenses & Assumptions

You can inject persistent directives that shape every LLM call for a project from a given phase onward.

```bash
# Inject a persistent assumption (treated as given for all reasoning)
node dist/index.js assume <project-id> "The audience is mobile-first" --from 2
node dist/index.js assume <project-id> "Budget is non-negotiable" --label budget

# Inject a reasoning lens (Claude will reason from this perspective)
node dist/index.js lens <project-id> "a sceptical B2B buyer" --from 3
node dist/index.js lens <project-id> "a first-generation immigrant unfamiliar with the brand" --label immigrant-lens

# List all lenses and assumptions for a project
node dist/index.js lenses <project-id>

# Deactivate a lens or assumption
node dist/index.js drop-lens <project-id> <lens-id>
```

Lenses and assumptions are stored in the project state and automatically injected into the system context of every subsequent API call. Each one is scoped to a starting phase (`--from`) — nothing is applied retroactively.

During development, you can run without building:

```bash
npm run dev -- new
npm run dev -- resume <project-id>
```

Project state is saved as JSON files in `./projects/`. The pattern library from Phase 7 accumulates across projects at `./projects/pattern-library.json`.

---

## Architecture

```
src/
├── index.ts                   # CLI entry point (commander)
├── state.ts                   # CreativeState types, load/save/list
├── phases/
│   ├── phase1-framing.ts      # Cognitive Framing
│   ├── phase2-diverge.ts      # Divergent Exploration
│   ├── phase3-converge.ts     # Directional Convergence
│   ├── phase4-craft.ts        # Iterative Crafting
│   ├── phase5-polish.ts       # Polishing & Integration
│   ├── phase6-deliver.ts      # Delivery
│   └── phase7-learn.ts        # Continuous Learning
├── engine/
│   ├── meta-cycle.ts          # Hegelian meta-cycle (thesis → antithesis → synthesis)
│   ├── tension-detector.ts    # Heuristic trigger detection (Jaccard similarity)
│   └── prompts.ts             # All LLM prompt templates
└── utils/
    ├── llm.ts                 # Anthropic SDK wrapper
    └── exit-criteria.ts       # Phase transition validation
```

### The Semantic Contract

`acf-contract.yaml` is the authoritative specification of the framework — what each phase requires and produces, when the meta-cycle fires, and what "tension" means in measurable terms. The implementation is derived from it. If you extend the tool, update the contract first.

`creative-state.schema.json` defines the `CreativeState` object that flows through every phase and persists to disk.

### Reasoning Lenses

Each project maintains a `lenses[]` array in its state. Lenses are of two types:

| Type | What it does |
|---|---|
| `assumption` | Prepended as "Assume: …" — treated as given facts in every LLM call |
| `persona` | Prepended as "Reason like …" — Claude adopts that reasoning perspective |

`engine/prompts.ts` exports a `buildSystemContext(state)` function that filters active lenses for the current phase and injects them into the system prompt. All phase and meta-cycle prompts use this function, so any lens set before a phase runs is automatically in scope.

### LLM usage

All API calls use `claude-sonnet-4-20250514`. A typical full run (phases 1–7, one meta-cycle) uses roughly:

- **10–16 API calls**
- **~30,000–45,000 input tokens**
- **~8,000–12,000 output tokens**
- **~$0.15–0.30 USD**

Stagnation and drift detection use heuristic lexical similarity (Jaccard) — no extra API calls.

---

## Example Session

```
$ node dist/index.js new

  ACF — Adaptive Creative Framework

? Enter your creative brief: Rebrand a 50-year-old regional bank for Gen Z without alienating existing customers

  PHASE 1 — Cognitive Framing

  Core Questions
  1. What does "Gen Z" mean specifically for this bank's geography and customer base?
     → The answer changes everything downstream
  2. What emotional anchors do existing customers have to the current brand?
  ...

  ⚡ META-CYCLE INTERVENTION
  Trigger: COMFORT ZONE
  All assumptions sourced from industry reports — no first-hand sources.

  THESIS:    The framing assumes a generational binary...
  ANTITHESIS Challenge: The real tension may not be generational but geographic...
             Provocation: Is "rebrand" the right word, or is this a brand extension?

  Accept synthesis? › Yes / No / Edit
```

---

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — Wladimiro Bizzotto
