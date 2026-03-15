import type { CreativeState } from "../state.js";

// ── System context injected into every call ──────────────────────────────────

export const ACF_SYSTEM_CONTEXT = `You are the ACF (Adaptive Creative Framework) engine.
Your role is to assist creative projects through structured phases with intellectual rigour.
- Output only valid JSON unless told otherwise.
- Be specific and substantive — generic outputs are failures.
- Challenge assumptions; do not flatter or validate lazily.
- Every response must be grounded in the actual brief and state provided.`;

// ── Phase 1: Cognitive Framing ───────────────────────────────────────────────

export function phase1Prompt(brief: string): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `Analyse this creative brief and produce a Phase 1 Cognitive Framing document.

BRIEF:
"""
${brief}
"""

Return a JSON object with this exact shape:
{
  "core_questions": [
    { "question": "...", "why_it_matters": "..." }
  ],
  "constraints": [
    { "constraint": "...", "type": "budget|time|ethical|legal|technical|cultural|other", "hard": true }
  ],
  "assumptions": [
    { "assumption": "...", "confidence": "high|medium|low|untested", "source": "..." }
  ],
  "blind_spot_audit": {
    "findings": ["..."],
    "dissenting_perspectives": ["..."]
  }
}

Rules:
- 3–7 core_questions. Each must be genuinely open — not leading questions.
- At least 2 constraints (even if soft).
- At least 3 assumptions, each with a confidence level and source.
- blind_spot_audit must name specific missing perspectives or voices, not generic ones.
- Do NOT produce industry clichés. Be specific to this brief.`,
  };
}

// ── Phase 2: Divergent Exploration ──────────────────────────────────────────

export function phase2Prompt(state: CreativeState): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `You are generating divergent ideas for a creative project in Phase 2.

BRIEF:
"""
${state.brief.raw_text}
"""

FRAMING (Phase 1 output):
${JSON.stringify(state.framing, null, 2)}

Generate at least 7 ideas using varied generative methods. Return a JSON array:
[
  {
    "id": "idea_01",
    "idea_text": "...",
    "source_tag": "analogy|inversion|reference|combination|random|provocation|constraint_flip",
    "belief_challenge": "Which assumption from framing does this challenge, and how?",
    "raw_notes": "Unstructured thinking behind it"
  }
]

Rules:
- No two ideas should use the same source_tag unless you have 7+ ideas total.
- At least 3 ideas must have a substantive belief_challenge (not empty, not trivial).
- Include at least 1 "inversion" and 1 "provocation" idea.
- Ideas should be genuinely different from each other — not variations on one theme.
- Be specific, not abstract. An idea must be actionable, not a vague direction.`,
  };
}

// ── Phase 3: Directional Convergence ────────────────────────────────────────

export function phase3ScoringPrompt(state: CreativeState): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `You are scoring and selecting directions in Phase 3 of a creative project.

BRIEF:
"""
${state.brief.raw_text}
"""

FRAMING:
${JSON.stringify(state.framing, null, 2)}

IDEA POOL:
${JSON.stringify(state.idea_pool, null, 2)}

Select 1–3 directions worth developing. For each selection, produce a substantive dissent record.

Return a JSON array:
[
  {
    "idea_ref": "<id from idea pool>",
    "feasibility_score": 1-5,
    "impact_score": 1-5,
    "risk_notes": "What could go wrong — be specific",
    "risk_severity": "low|moderate|high|critical",
    "dissent_record": "Devil's advocate argument against this selection. Must be substantive — not 'it might not work'."
  }
]

Rules:
- Do not select only safe, low-risk ideas. At least one selection should have risk_severity of 'high' or 'critical' if the ideas support it.
- dissent_record must be at least 2 sentences of genuine pushback.
- Score honestly — do not cluster everything at 4/5.`,
  };
}

// ── Meta-cycle ───────────────────────────────────────────────────────────────

// ── Phase 4: Iterative Crafting ──────────────────────────────────────────────

export function phase4IterationPrompt(
  state: CreativeState,
  version: number,
  previousArtifact?: string,
  feedback?: string
): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `You are building iteration v${version} of a creative artifact.

BRIEF:
"""
${state.brief.raw_text}
"""

FRAMING:
${JSON.stringify(state.framing, null, 2)}

SELECTED DIRECTIONS:
${JSON.stringify(
  state.selected_directions?.map((d) => ({
    idea: state.idea_pool?.find((i) => i.id === d.idea_ref)?.idea_text,
    feasibility: d.feasibility_score,
    impact: d.impact_score,
  })),
  null,
  2
)}

${previousArtifact ? `PREVIOUS ARTIFACT (v${version - 1}):\n"""\n${previousArtifact}\n"""` : ""}
${feedback ? `FEEDBACK ON PREVIOUS VERSION:\n"""\n${feedback}\n"""` : ""}

Produce iteration v${version}. Return a JSON object:
{
  "artifact": "The creative work itself — substantive, not a description of what you'd make. Write it.",
  "retro_notes": "What changed from the previous version and why, or what first principles guided v1. Be specific."
}

Rules:
- The artifact must be the actual work, not a plan for it.
- If this is v1, make bold choices grounded in the selected directions.
- If this is v2+, show meaningful evolution — not cosmetic changes.
- retro_notes must identify what genuinely changed and what drove that change.`,
  };
}

export function phase4FeedbackPrompt(
  state: CreativeState,
  artifact: string,
  version: number
): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `You are a critical reviewer of a creative artifact. Be honest, specific, and uncomfortable.

BRIEF:
"""
${state.brief.raw_text}
"""

FRAMING CORE QUESTIONS:
${state.framing?.core_questions?.map((q) => `- ${q.question}`).join("\n") ?? "none"}

ARTIFACT (v${version}):
"""
${artifact}
"""

Provide structured feedback. Return a JSON object:
{
  "what_works": "What genuinely works and why",
  "what_doesnt": "What fails, is weak, or is missing — be specific",
  "biggest_gap": "The single most important thing that needs to change",
  "alignment_with_brief": "Does this answer the core questions? Which ones does it miss?"
}

Do not be polite. Weak feedback is a failure.`,
  };
}

// ── Phase 5: Polishing & Integration ────────────────────────────────────────

export function phase5IntegrationPrompt(state: CreativeState): { system: string; user: string } {
  const latestIteration = state.iterations?.[state.iterations.length - 1];
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `You are integrating and polishing a creative project in Phase 5.

BRIEF:
"""
${state.brief.raw_text}
"""

ORIGINAL FRAMING:
${JSON.stringify(state.framing, null, 2)}

LATEST ARTIFACT (v${latestIteration?.version ?? "?"}):
"""
${latestIteration?.artifact ?? "none"}
"""

ALL ITERATION RETRO NOTES:
${state.iterations?.map((it) => `v${it.version}: ${it.retro_notes}`).join("\n") ?? "none"}

Produce the integrated final artifact. Return a JSON object:
{
  "final_draft": "The polished, unified work — write it in full",
  "coherence_report": "How the parts connect. What was cut and why. How this responds to the original framing.",
  "ethics_check": "Any problematic elements, blind spots, or harmful implications? Be honest. 'No issues found' is acceptable only if genuinely true."
}`,
  };
}

// ── Phase 6: Delivery ────────────────────────────────────────────────────────

export function phase6ContextNotesPrompt(state: CreativeState): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `Write context notes for a delivered creative work.

BRIEF:
"""
${state.brief.raw_text}
"""

FINAL ARTIFACT:
"""
${state.integrated_artifact?.final_draft ?? "none"}
"""

Return a JSON object:
{
  "context_notes": "How to read or use this work. What it's responding to. What decisions were made and why. Written for the audience, not the team."
}`,
  };
}

export function phase6RetroPrompt(state: CreativeState): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `Write a project retrospective for a completed creative project.

BRIEF:
"""
${state.brief.raw_text}
"""

ORIGINAL ASSUMPTIONS:
${state.framing?.assumptions?.map((a) => `- [${a.confidence}] ${a.assumption}`).join("\n") ?? "none"}

META-CYCLE INTERVENTIONS: ${state.meta_cycle_log.length}
${state.meta_cycle_log.map((e) => `- Phase ${e.phase} (${e.trigger}): ${e.synthesis.evolution_note}`).join("\n")}

COHERENCE REPORT:
${state.integrated_artifact?.coherence_report ?? "none"}

Return a JSON object:
{
  "what_worked": ["..."],
  "what_didnt": ["..."],
  "belief_shifts": ["Which assumption from phase 1 turned out wrong or incomplete, and what replaced it"]
}

Be specific. Generic retros are useless.`,
  };
}

// ── Phase 7: Continuous Learning ─────────────────────────────────────────────

export function phase7LearningPrompt(state: CreativeState): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `Extract reusable methodology insights from a completed creative project.

PROJECT BRIEF:
"""
${state.brief.raw_text}
"""

RETROSPECTIVE:
${JSON.stringify(state.project_retro, null, 2)}

META-CYCLE LOG (${state.meta_cycle_log.length} interventions):
${state.meta_cycle_log.map((e) => `- ${e.trigger} in phase ${e.phase}: ${e.antithesis.provocation}`).join("\n")}

BELIEF SHIFTS:
${state.project_retro?.belief_shifts?.join("\n") ?? "none"}

Return a JSON object:
{
  "process_patches": ["Specific changes to make to how this framework is used next time"],
  "belief_calibration": ["Updated priors — what to assume (or not assume) going into the next project"],
  "pattern_library": ["Reusable patterns or moves discovered in this project that could apply elsewhere"]
}

These outputs persist beyond this project. Make them genuinely transferable.`,
  };
}

export function metaCycleThesisPrompt(
  state: CreativeState,
  trigger: string
): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `Summarise the current creative position as a THESIS for a Hegelian meta-cycle.

TRIGGER: ${trigger}
CURRENT PHASE: ${state.phase}

BRIEF:
"""
${state.brief.raw_text}
"""

CURRENT STATE SUMMARY:
${JSON.stringify(
  {
    framing: state.framing,
    idea_pool: state.idea_pool,
    selected_directions: state.selected_directions,
    tensions: state.tensions,
    belief_tags: state.belief_tags,
  },
  null,
  2
)}

Write 2–4 sentences that articulate:
1. What position the project is currently committed to
2. What assumptions underpin that position
3. What the implicit worldview is

Return plain text (no JSON). Be precise — no vague generalisations.`,
  };
}

export function metaCycleAntithesisPrompt(
  state: CreativeState,
  trigger: string,
  thesis: string
): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `Generate an ANTITHESIS for a Hegelian meta-cycle intervention.

TRIGGER REASON: ${trigger}
CURRENT PHASE: ${state.phase}

THESIS (current position):
"""
${thesis}
"""

BRIEF:
"""
${state.brief.raw_text}
"""

The antithesis must directly stress-test the weakness that caused the trigger: "${trigger}".
Do NOT produce generic "have you considered the opposite?" responses.

Return a JSON object:
{
  "challenge": "What is specifically wrong with the current direction, given the trigger",
  "alternative": "A concrete different approach — specific enough to act on",
  "provocation": "A question the project has not yet asked that would change everything if answered"
}`,
  };
}

export function metaCycleSynthesisPrompt(
  state: CreativeState,
  thesis: string,
  antithesis: { challenge: string; alternative: string; provocation: string }
): { system: string; user: string } {
  return {
    system: ACF_SYSTEM_CONTEXT,
    user: `Generate a SYNTHESIS for a Hegelian meta-cycle. The synthesis must be higher than either position — an evolution, not a compromise.

CURRENT PHASE: ${state.phase}

THESIS:
"""
${thesis}
"""

ANTITHESIS:
${JSON.stringify(antithesis, null, 2)}

BRIEF:
"""
${state.brief.raw_text}
"""

Return a JSON object:
{
  "evolution_note": "What genuinely changed and why this is an evolution, not just a blend of thesis and antithesis",
  "phase_recommendation": "stay|advance|regress"
}

phase_recommendation:
- "stay": the phase has more work to do given the intervention
- "advance": the intervention resolves outstanding gaps; move forward
- "regress": the intervention reveals the previous phase needs revisiting`,
  };
}
