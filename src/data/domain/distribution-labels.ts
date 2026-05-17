/**
 * src/data/domain/distribution-labels.ts — single source of truth
 * for IPD education/employment distribution EN→JA key mappings.
 *
 * 2026-05-17 CODE-011 fix: previously these maps were duplicated in
 * `src/data/projections/treemap.ts` and consumed (in JA-key form)
 * by `src/views/ranking.ts`. Any drift between the two sites
 * silently produced ranking pages that filtered against keys the
 * data layer no longer emitted. Now both consumers import from
 * here.
 *
 * Source: IPD v7.00 codebook + jobtag display labels. The "わからない"
 * education bucket is intentionally EXCLUDED from EDU_LABELS_EN_TO_JA
 * because the legacy data.json shape never carried it; the treemap
 * preserves that omission for byte parity. Employment "わからない"
 * IS included because the legacy shape carried it.
 */

export const EDU_LABELS_EN_TO_JA: Record<string, string> = {
  below_high_school: '高卒未満',
  high_school: '高卒',
  vocational_school: '専門学校卒',
  junior_college: '短大卒',
  technical_college: '高専卒',
  university: '大卒',
  masters: '修士課程卒（修士と同等の専門職学位を含む）',
  doctorate: '博士課程卒',
  // "unknown" / わからない intentionally excluded — matches legacy data.json shape.
};

export const EMP_LABELS_EN_TO_JA: Record<string, string> = {
  regular_employee: '正規の職員、従業員',
  part_time: 'パートタイマー',
  dispatched: '派遣社員',
  contract: '契約社員、期間従業員',
  self_employed_freelance: '自営、フリーランス',
  executive: '経営層（役員等）',
  casual_non_student: 'アルバイト（学生以外）',
  casual_student: 'アルバイト（学生）',
  unknown: 'わからない',
  other: 'その他',
};

/**
 * Reverse-lookup: JA label → EN key. Useful for ranking filters that
 * receive a JA key string from the projection layer and need to
 * locate the original IPD field.
 */
export const EDU_LABELS_JA_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EDU_LABELS_EN_TO_JA).map(([en, ja]) => [ja, en]),
);

export const EMP_LABELS_JA_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EMP_LABELS_EN_TO_JA).map(([en, ja]) => [ja, en]),
);

/**
 * Whitelisted JA keys — frozen-array exports for `as const`-style
 * consumers (e.g. exhaustiveness checks in views).
 */
export const EDU_LABELS_JA: ReadonlyArray<string> = Object.values(EDU_LABELS_EN_TO_JA);
export const EMP_LABELS_JA: ReadonlyArray<string> = Object.values(EMP_LABELS_EN_TO_JA);

/**
 * Named JA-key constants — preferred over string literals at consumer
 * sites (e.g. ranking filters that do `eduPct(o, EDU.highSchool)`
 * instead of `eduPct(o, '高卒')`). If the JA labels are ever
 * renamed in the EN_TO_JA map, these named consts update mechanically
 * and the TypeScript compiler catches stale consumer literals.
 */
export const EDU = {
  belowHighSchool: EDU_LABELS_EN_TO_JA.below_high_school,
  highSchool:      EDU_LABELS_EN_TO_JA.high_school,
  vocational:      EDU_LABELS_EN_TO_JA.vocational_school,
  juniorCollege:   EDU_LABELS_EN_TO_JA.junior_college,
  technicalCollege:EDU_LABELS_EN_TO_JA.technical_college,
  university:      EDU_LABELS_EN_TO_JA.university,
  masters:         EDU_LABELS_EN_TO_JA.masters,
  doctorate:       EDU_LABELS_EN_TO_JA.doctorate,
} as const;

export const EMP = {
  regular:               EMP_LABELS_EN_TO_JA.regular_employee,
  partTime:              EMP_LABELS_EN_TO_JA.part_time,
  dispatched:            EMP_LABELS_EN_TO_JA.dispatched,
  contract:              EMP_LABELS_EN_TO_JA.contract,
  selfEmployedFreelance: EMP_LABELS_EN_TO_JA.self_employed_freelance,
  executive:             EMP_LABELS_EN_TO_JA.executive,
  casualNonStudent:      EMP_LABELS_EN_TO_JA.casual_non_student,
  casualStudent:         EMP_LABELS_EN_TO_JA.casual_student,
  unknown:               EMP_LABELS_EN_TO_JA.unknown,
  other:                 EMP_LABELS_EN_TO_JA.other,
} as const;
