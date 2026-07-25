/**
 * contract.ts — the AIOIS-10 raw-output contract.
 *
 * THIS FILE IS THE ONLY DEFINITION OF "WHAT COUNTS AS A VALID SCORE".
 *
 * Every provider — the Codex CLI, in-agent scoring, and any future vendor —
 * is validated against exactly this file. A provider may translate
 * `SCORE_OUTPUT_JSON_SCHEMA` into whatever native structured-output mechanism
 * it has (OpenAI `--output-schema`, Anthropic forced tool use, Gemini
 * `responseSchema`, or plain prompt text when the vendor has no mechanism at
 * all), but no provider may define its own notion of a valid score. Native
 * enforcement only reduces how often a model gets it wrong; the safety floor
 * is always the validation below.
 *
 * Contract source of truth: `/standard` and `docs/AIOIS-10.md`.
 *   E              = mean(d1, d2)
 *   M              = mean(d3..d7)
 *   P              = mean(d8, d9)
 *   transformation = E
 *   displacement   = clamp(0, 10, E × (1 − M/10) × (0.6 + 0.4 × (P + d10) / 20))
 *   ai_risk        === aiois.transformation   (strict equality, not a tolerance)
 *
 * Reported index values are re-computed here and rejected when they diverge by
 * more than ±0.05. Divergence is never silently corrected — see
 * docs/SCORING_RUNBOOK.md "検証側（assembler）は…silent 補正はしない".
 */
import { z } from 'zod';

/** Rounding tolerance for re-computed indices, per docs/SCORING_RUNBOOK.md. */
export const AIOIS_INDEX_TOL = 0.05 + 1e-9;

/** The 12 numeric fields every AIOIS-10 score must carry. */
export const AIOIS_FIELD_NAMES = [
  'd1',
  'd2',
  'd3',
  'd4',
  'd5',
  'd6',
  'd7',
  'd8',
  'd9',
  'd10',
  'transformation',
  'displacement',
] as const;

export type AioisFieldName = (typeof AIOIS_FIELD_NAMES)[number];

const oneDecimalScore = z
  .number()
  .min(0)
  .max(10)
  .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, {
    message: 'must have at most one decimal place',
  });

/**
 * Listed explicitly rather than generated from AIOIS_FIELD_NAMES: this is the
 * contract, and it should be readable at a glance. The conformance suite
 * asserts these keys stay in sync with AIOIS_FIELD_NAMES.
 */
export const AioisOutputSchema = z
  .object({
    d1: oneDecimalScore,
    d2: oneDecimalScore,
    d3: oneDecimalScore,
    d4: oneDecimalScore,
    d5: oneDecimalScore,
    d6: oneDecimalScore,
    d7: oneDecimalScore,
    d8: oneDecimalScore,
    d9: oneDecimalScore,
    d10: oneDecimalScore,
    transformation: oneDecimalScore,
    displacement: oneDecimalScore,
  })
  .strict();

export type AioisVector = z.infer<typeof AioisOutputSchema>;

/** Re-computed index values for one AIOIS-10 vector. */
export function computeIndices(aiois: AioisVector): {
  readonly transformation: number;
  readonly displacement: number;
} {
  const e = (aiois.d1 + aiois.d2) / 2;
  const m = (aiois.d3 + aiois.d4 + aiois.d5 + aiois.d6 + aiois.d7) / 5;
  const p = (aiois.d8 + aiois.d9) / 2;
  const displacement = Math.min(10, Math.max(0, e * (1 - m / 10) * (0.6 + (0.4 * (p + aiois.d10)) / 20)));
  return { transformation: e, displacement };
}

export const ScoreSchema = z
  .object({
    id: z.number().int().min(1).max(999),
    ai_risk: oneDecimalScore,
    rationale_ja: z.string().min(1),
    confidence: z.number().min(0).max(1),
    aiois: AioisOutputSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.ai_risk !== value.aiois.transformation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ai_risk'],
        message: 'must equal aiois.transformation',
      });
    }
    const expected = computeIndices(value.aiois);
    if (Math.abs(value.aiois.transformation - expected.transformation) > AIOIS_INDEX_TOL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aiois', 'transformation'],
        message: `must equal mean(d1,d2) within ±0.05 (expected ${expected.transformation.toFixed(2)})`,
      });
    }
    if (Math.abs(value.aiois.displacement - expected.displacement) > AIOIS_INDEX_TOL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aiois', 'displacement'],
        message: `must equal formula value within ±0.05 (expected ${expected.displacement.toFixed(2)})`,
      });
    }
  });

export type ScoredOccupation = z.infer<typeof ScoreSchema>;

/**
 * Canonical JSON Schema for one scored occupation.
 *
 * Providers with native structured output translate THIS object into their own
 * format. Adding a field here is the single edit that propagates to every
 * provider; the conformance suite asserts each provider's translation still
 * carries all 12 AIOIS fields.
 */
export const SCORE_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1, maximum: 999 },
    ai_risk: { type: 'number', minimum: 0, maximum: 10 },
    rationale_ja: { type: 'string', minLength: 1 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    aiois: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        AIOIS_FIELD_NAMES.map((k) => [k, { type: 'number', minimum: 0, maximum: 10 }]),
      ),
      required: [...AIOIS_FIELD_NAMES],
    },
  },
  required: ['id', 'ai_risk', 'rationale_ja', 'confidence', 'aiois'],
} as const;

/** Strip Markdown fences / surrounding prose so a lenient provider still parses. */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1]!.trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

/**
 * A model that cannot score sometimes emits a well-formed but meaningless
 * all-zero vector with confidence 0. That is a refusal wearing a valid shape —
 * reject it rather than let it reach a batch file.
 */
export function isSyntheticZeroPlaceholder(score: ScoredOccupation): boolean {
  const values = [score.ai_risk, ...AIOIS_FIELD_NAMES.map((k) => score.aiois[k])];
  return score.confidence === 0 && values.every((value) => value === 0);
}

/** Serialize one score to its raw-JSONL line, with a stable key order. */
export function scoreToJsonLine(score: ScoredOccupation): string {
  return JSON.stringify({
    id: score.id,
    ai_risk: score.ai_risk,
    rationale_ja: score.rationale_ja,
    confidence: score.confidence,
    aiois: Object.fromEntries(AIOIS_FIELD_NAMES.map((k) => [k, score.aiois[k]])),
  });
}
