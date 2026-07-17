import {
  FAMILY_CODES,
  GAP,
  VARIANT_BUCKETS_BY_FAMILY,
  type FamilyCode,
  type GapKind,
  type WorktypeVariantBucket,
  type WorktypeVariantId,
} from './worktype-copy.js';

export const SHINDAN_AXES_PARAM = 'axes';

export interface ShindanBaseResultState {
  readonly family: FamilyCode;
  readonly variant: WorktypeVariantId;
  readonly axes: string;
  readonly bucket: WorktypeVariantBucket;
}

export interface ShindanResultState extends ShindanBaseResultState {
  readonly job?: string;
  readonly gap?: GapKind;
}

export interface ShindanOccupationWorktype {
  readonly code: FamilyCode;
}

export type ShindanOccupationWorktypes = Readonly<
  Record<string, ShindanOccupationWorktype | undefined>
>;

export interface ShindanGapClassification {
  readonly kind: GapKind;
  readonly matches: number;
  readonly gapAxes: number;
  readonly underusedStrengthCount: number;
  readonly riskMismatchCount: number;
}

const AXIS_POLES = [
  { left: 'C', right: 'R' },
  { left: 'P', right: 'D' },
  { left: 'B', right: 'K' },
] as const;

const FAMILY_CODE_SET = new Set<string>(FAMILY_CODES);
const AXES_PATTERN_RE = /^(?:2-1|3-0)\/(?:2-1|3-0)\/(?:2-1|3-0)$/;
const JOB_ID_RE = /^\d{1,4}$/;

function isFamilyCode(value: string): value is FamilyCode {
  return FAMILY_CODE_SET.has(value);
}

function isGapKind(value: string): value is GapKind {
  return Object.hasOwn(GAP, value);
}

export function bucketForShindanAxes(axes: string): WorktypeVariantBucket | null {
  if (!AXES_PATTERN_RE.test(axes)) return null;
  const strongCount = axes.split('/').filter((margin) => margin === '3-0').length;
  if (strongCount === 0) return 'balance';
  if (strongCount === 3) return 'sweep';
  return 'mixed';
}

export function parseShindanBaseState(
  params: URLSearchParams,
  familyParam: 'self' | 'worktype' = 'self',
): ShindanBaseResultState | null {
  const familyRaw = params.get(familyParam);
  const variantRaw = params.get('variant');
  const axes = params.get(SHINDAN_AXES_PARAM);
  if (!familyRaw || !variantRaw || !axes) return null;

  const family = familyRaw.toUpperCase();
  if (!isFamilyCode(family)) return null;

  const bucket = bucketForShindanAxes(axes);
  if (!bucket) return null;

  const expectedVariant = VARIANT_BUCKETS_BY_FAMILY[family][bucket];
  if (variantRaw !== expectedVariant) return null;

  return {
    family,
    variant: expectedVariant,
    axes,
    bucket,
  };
}

export function classifyShindanGap(
  selfCode: FamilyCode,
  jobCode: FamilyCode,
): ShindanGapClassification {
  let matches = 0;
  let underusedStrengthCount = 0;
  let riskMismatchCount = 0;

  for (let index = 0; index < AXIS_POLES.length; index += 1) {
    const axis = AXIS_POLES[index]!;
    const selfPole = selfCode.charAt(index);
    const jobPole = jobCode.charAt(index);
    if (selfPole === jobPole) {
      matches += 1;
    } else if (selfPole === axis.left && jobPole === axis.right) {
      underusedStrengthCount += 1;
    } else if (selfPole === axis.right && jobPole === axis.left) {
      riskMismatchCount += 1;
    }
  }

  let kind: GapKind = 'hidden_risk';
  if (matches >= 2) {
    kind = 'aligned';
  } else if (riskMismatchCount >= 2) {
    kind = 'hidden_risk';
  } else if (underusedStrengthCount > 0) {
    kind = 'hidden_strength';
  }

  return {
    kind,
    matches,
    gapAxes: AXIS_POLES.length - matches,
    underusedStrengthCount,
    riskMismatchCount,
  };
}

export function addShindanOccupationContext(
  base: ShindanBaseResultState,
  params: URLSearchParams,
  occupations: ShindanOccupationWorktypes,
): ShindanResultState {
  const jobRaw = params.get('job');
  const gapRaw = params.get('gap');
  if (!jobRaw && !gapRaw) return base;
  if (!jobRaw || !JOB_ID_RE.test(jobRaw)) return base;
  if (gapRaw && !isGapKind(gapRaw)) return base;

  const job = String(Number(jobRaw));
  if (job === '0') return base;
  const occupation = occupations[job];
  if (!occupation || !isFamilyCode(occupation.code)) return base;

  const computedGap = classifyShindanGap(base.family, occupation.code).kind;
  return {
    ...base,
    job,
    // A supplied value is only a cache hint. The occupation data always wins.
    gap: computedGap,
  };
}

export function parseShindanResultState(
  params: URLSearchParams,
  occupations: ShindanOccupationWorktypes,
  familyParam: 'self' | 'worktype' = 'self',
): ShindanResultState | null {
  const base = parseShindanBaseState(params, familyParam);
  return base ? addShindanOccupationContext(base, params, occupations) : null;
}

export function serializeShindanState(
  state: ShindanResultState,
  familyParam: 'self' | 'worktype' = 'self',
): URLSearchParams {
  const params = new URLSearchParams();
  params.set(familyParam, state.family);
  params.set('variant', state.variant);
  params.set(SHINDAN_AXES_PARAM, state.axes);
  if (state.job && state.gap) {
    params.set('job', state.job);
    params.set('gap', state.gap);
  }
  return params;
}

export function buildShindanResultUrl(origin: string, state: ShindanResultState): string {
  const url = new URL('/shindan', origin);
  url.search = serializeShindanState(state).toString();
  return url.toString();
}

export function buildShindanOgImageUrl(origin: string, state: ShindanResultState): string {
  const url = new URL('/api/og', origin);
  url.search = serializeShindanState(state, 'worktype').toString();
  return url.toString();
}
