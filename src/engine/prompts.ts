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
