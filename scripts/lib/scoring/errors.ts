/**
 * errors.ts — the shared error vocabulary every provider translates into.
 *
 * Each vendor phrases "the model is unavailable", "I refuse", and "slow down"
 * completely differently. Rather than teach the retry loop every vendor's
 * wording, each provider maps its own errors onto the small vocabulary below
 * and the retry POLICY is written once, here.
 *
 * A provider therefore cannot invent its own retry behaviour — in particular it
 * has no way to express "quietly fall back to a different model", which
 * docs/SCORING_RUNBOOK.md forbids ("never silently fallback or invent a default
 * score").
 *
 * Behaviour note: `shouldBackoff` is deliberately the UNION of this table and
 * the pre-existing transient-text check, so classifying an error can only ever
 * add a backoff delay, never remove one that the runner already applied.
 */

export type ScoringErrorKind =
  /** The requested model is unavailable/unknown. Never silently substituted. */
  | 'model_unavailable'
  /** The model declined to answer. */
  | 'refusal'
  /** Quota / 429 / too many requests. */
  | 'rate_limited'
  /** Network, transport, or provider-infrastructure failure. */
  | 'transport'
  /** Response was not parseable as the expected JSON object. */
  | 'malformed'
  /** Parsed fine, but violates the AIOIS-10 contract (bad formula, wrong id, …). */
  | 'contract_violation'
  /** Response was cut off mid-answer. */
  | 'truncated'
  /** In-agent only: the prompt is waiting for an answer that has not been written yet. */
  | 'missing_answer';

export const SCORING_ERROR_KINDS: readonly ScoringErrorKind[] = [
  'model_unavailable',
  'refusal',
  'rate_limited',
  'transport',
  'malformed',
  'contract_violation',
  'truncated',
  'missing_answer',
];

interface KindPolicy {
  /** Whether the runner should spend another attempt on this occupation. */
  readonly retry: boolean;
  /** Whether the runner should wait before that attempt. */
  readonly backoff: boolean;
}

const POLICY: Readonly<Record<ScoringErrorKind, KindPolicy>> = {
  model_unavailable: { retry: true, backoff: true },
  refusal: { retry: true, backoff: false },
  rate_limited: { retry: true, backoff: true },
  transport: { retry: true, backoff: true },
  malformed: { retry: true, backoff: false },
  contract_violation: { retry: true, backoff: false },
  truncated: { retry: true, backoff: false },
  // Not a failure to retry against the model — the operator owes an answer.
  missing_answer: { retry: false, backoff: false },
};

export function shouldRetry(kind: ScoringErrorKind): boolean {
  return POLICY[kind].retry;
}

export function shouldBackoff(kind: ScoringErrorKind, text = ''): boolean {
  return POLICY[kind].backoff || isTransientCliError(text);
}

const MODEL_UNAVAILABLE_PATTERNS: readonly RegExp[] = [
  /\b(?:requested\s+)?model\b.{0,80}\b(?:unavailable|not\s+available|not\s+found|unsupported|does\s+not\s+exist|cannot\s+be\s+used)\b/i,
  /(?:指定|要求).{0,24}モデル.{0,40}(?:利用できません|見つかりません|対応していません)/,
];

const REFUSAL_PATTERNS: readonly RegExp[] = [
  /\b(?:i\s+cannot|i\s+can't|i\s+am\s+unable|i'm\s+unable|cannot\s+comply|refus(?:e|al|ed|ing))\b/i,
];

const PROVIDER_ERROR_PATTERNS: readonly RegExp[] = [
  /\b(?:provider|upstream|inference|service)\b.{0,80}\b(?:error|failed|failure|unavailable|overloaded)\b/i,
  /(?:プロバイダ|上流|推論|サービス).{0,40}(?:エラー|失敗|利用できません)/,
];

const RATE_LIMIT_PATTERNS: readonly RegExp[] = [/\b(?:429|rate.?limit|too many requests|quota)\b/i];

const TRUNCATION_PATTERNS: readonly RegExp[] = [
  /\b(?:max_tokens|truncat(?:ed|ion)|incomplete\s+response|length\s+limit)\b/i,
];

/**
 * Patterns that mean "the model reported an upstream failure or declined"
 * rather than "the model answered badly". Kept as one exported helper because
 * the raw text is what gets stored in the audit trail.
 */
const EXPLICIT_SCORING_ERROR_PATTERNS: readonly RegExp[] = [
  ...MODEL_UNAVAILABLE_PATTERNS,
  ...PROVIDER_ERROR_PATTERNS,
  ...REFUSAL_PATTERNS,
];

export function explicitScoringError(raw: string): string | null {
  const compact = raw.replace(/\s+/g, ' ').trim();
  for (const pattern of EXPLICIT_SCORING_ERROR_PATTERNS) {
    const match = compact.match(pattern);
    if (match) return match[0].slice(0, 200);
  }
  return null;
}

export function isTransientCliError(text: string): boolean {
  return /\b(429|rate.?limit|too many requests|temporar(?:y|ily)|timeout|timed out|ECONNRESET|ETIMEDOUT|overloaded|unavailable)\b/i.test(
    text,
  );
}

/**
 * Default text → kind classifier. A provider whose vendor phrases things
 * differently (another language, vendor-specific codes) overrides
 * `classifyError` rather than editing this function.
 */
export function classifyErrorText(text: string): ScoringErrorKind {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (MODEL_UNAVAILABLE_PATTERNS.some((p) => p.test(compact))) return 'model_unavailable';
  if (RATE_LIMIT_PATTERNS.some((p) => p.test(compact))) return 'rate_limited';
  if (REFUSAL_PATTERNS.some((p) => p.test(compact))) return 'refusal';
  if (PROVIDER_ERROR_PATTERNS.some((p) => p.test(compact))) return 'transport';
  if (TRUNCATION_PATTERNS.some((p) => p.test(compact))) return 'truncated';
  if (isTransientCliError(compact)) return 'transport';
  return 'malformed';
}

/** Error carrying a classified kind so the audit trail stays machine-readable. */
export class ScoringError extends Error {
  readonly kind: ScoringErrorKind;

  constructor(kind: ScoringErrorKind, message: string) {
    super(message);
    this.name = 'ScoringError';
    this.kind = kind;
  }
}

/** Recover the kind from any thrown value, classifying free-text errors. */
export function kindOf(err: unknown, fallbackText = ''): ScoringErrorKind {
  if (err instanceof ScoringError) return err.kind;
  const message = err instanceof Error ? err.message : String(err);
  return classifyErrorText(`${message}\n${fallbackText}`);
}
