/**
 * HAID release — one quarterly current-state release of 人類と AI の距離.
 *
 * Source files live under `data/haid-release/<release>/`:
 *   anchors.json  — vendor / statistics figures used as 錨点 (one row each)
 *   overlap.json  — cross-product overlap rates for levels 4 and 5
 *   release.json  — per-level N(≥k) inputs, certainty, anchors used, payment
 *
 * The definitions (levels, relations, boundaries) come from
 * `src/site/haid-spec.ts`; a release never restates them. A release is
 * append-only: a new quarter is a new directory, an old one is never edited
 * (docs/HAID.md 測定と報告の方法).
 *
 * Contract enforced by `validateHaidRelease()`:
 *   - exactly levels 1..10, certainty vocabulary from HAID
 *   - every level names a method; the method decides the certainty and how
 *     many anchors it cites (the projection does the arithmetic)
 *   - anchor windows fit the level's window (a 7-day count may floor a
 *     30-day level, never the reverse)
 *   - level 1 is the population anchor
 *   - every referenced anchor / overlap key exists
 *   - a `final` release has no placeholder anchor or overlap and carries
 *     `published_at`; a `draft` may hold placeholders (2026-09-21 ruling)
 *
 * Monotonicity of N(≥k) is *not* an input invariant: a lower bound for
 * level 3 may sit below the estimate for level 4. The projection clamps by
 * nesting (N(≥k) ≥ N(≥k+1)) and records that it did (derivation.floored).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { HAID_LEVELS, HAID_SPEC_VERSION, type HaidWindow } from '../../site/haid-spec.js';

export const HAID_RELEASE_ROOT = join('data', 'haid-release');

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const ReleaseId = z.string().regex(/^\d{4}-q[1-4]$/, 'yyyy-qN');

export const HaidAnchorSchema = z
  .object({
    id: z.string().min(1),
    entity: z.string().min(1),
    entity_ja: z.string().min(1),
    metric_ja: z.string().min(1),
    value: z.number().positive(),
    unit: z.enum(['people']),
    window: z.enum(['itu_3m', 'days_30', 'days_7', 'state']),
    as_of: IsoDate,
    published_at: IsoDate,
    grade: z.enum(['A', 'B', 'C', 'D']),
    source_name: z.string().min(1),
    source_url: z.url().nullable(),
    status: z.enum(['placeholder', 'verified']),
    note: z.string(),
  })
  .strict();
export type HaidAnchor = z.infer<typeof HaidAnchorSchema>;

export const HaidOverlapEntrySchema = z
  .object({
    rate: z.number().min(0).max(1),
    low: z.number().min(0).max(1),
    high: z.number().min(0).max(1),
    grade: z.enum(['C', 'D']),
    source_name: z.string().min(1),
    source_url: z.url().nullable(),
    as_of: IsoDate.nullable(),
    status: z.enum(['placeholder', 'verified']),
    note: z.string(),
  })
  .strict()
  .refine((o) => o.low <= o.rate && o.rate <= o.high, { message: 'low <= rate <= high' });
export type HaidOverlapEntry = z.infer<typeof HaidOverlapEntrySchema>;

export const HaidOverlapSchema = z
  .object({
    level_4: HaidOverlapEntrySchema.nullable(),
    level_5: HaidOverlapEntrySchema.nullable(),
  })
  .strict();
export type HaidOverlap = z.infer<typeof HaidOverlapSchema>;

export const HaidCertaintySchema = z.enum(['measured', 'residual', 'lower_bound', 'range', 'none']);
export type HaidReleaseCertainty = z.infer<typeof HaidCertaintySchema>;

const Triple = z
  .object({
    low: z.number().nonnegative().nullable(),
    mid: z.number().nonnegative().nullable(),
    high: z.number().nonnegative().nullable(),
  })
  .strict();
export type HaidTriple = z.infer<typeof Triple>;

export const HaidMethodSchema = z.enum(['single', 'max_single', 'sum_minus_overlap', 'none']);
export type HaidMethod = z.infer<typeof HaidMethodSchema>;

/** Which certainty each method yields. `single` may be measured or residual. */
export const METHOD_CERTAINTY: Readonly<Record<HaidMethod, readonly HaidReleaseCertainty[]>> = {
  single: ['measured', 'residual'],
  max_single: ['lower_bound'],
  sum_minus_overlap: ['range'],
  none: ['none'],
};

export const HaidLevelInputSchema = z
  .object({
    certainty: HaidCertaintySchema,
    /**
     * How N(≥k) is computed from the cited anchors (the projection does the
     * arithmetic and records it):
     *   single             — the one anchor's value
     *   max_single         — the largest single anchor (lower bound)
     *   sum_minus_overlap  — low = largest single, high = sum, mid = sum × (1 − overlap rate)
     *   none               — no anchor; データなし
     */
    method: HaidMethodSchema,
    anchors: z.array(z.string()),
    overlap: z.enum(['level_4', 'level_5']).optional(),
    method_ja: z.string().min(1),
  })
  .strict()
  .superRefine((lv, ctx) => {
    const need = (cond: boolean, message: string) => {
      if (!cond) ctx.addIssue({ code: 'custom', message });
    };
    need(METHOD_CERTAINTY[lv.method].includes(lv.certainty), `method ${lv.method} cannot yield certainty ${lv.certainty}`);
    switch (lv.method) {
      case 'none':
        need(lv.anchors.length === 0, 'method none must not cite anchors');
        need(lv.overlap === undefined, 'method none takes no overlap');
        break;
      case 'single':
        need(lv.anchors.length === 1, 'method single cites exactly one anchor');
        need(lv.overlap === undefined, 'method single takes no overlap');
        break;
      case 'max_single':
        need(lv.anchors.length >= 1, 'method max_single cites at least one anchor');
        need(lv.overlap === undefined, 'method max_single takes no overlap');
        break;
      case 'sum_minus_overlap':
        need(lv.anchors.length >= 2, 'method sum_minus_overlap cites at least two anchors');
        need(lv.overlap !== undefined, 'method sum_minus_overlap needs an overlap rate');
        break;
    }
  });
export type HaidLevelInput = z.infer<typeof HaidLevelInputSchema>;

const LevelKeys = HAID_LEVELS.map((l) => String(l.level)) as [string, ...string[]];

export const HaidReleaseFileSchema = z
  .object({
    release: ReleaseId,
    label_ja: z.string().min(1),
    version: z.string().regex(/^\d{4}-Q[1-4]\.\d+$/, 'yyyy-QN.n'),
    status: z.enum(['draft', 'final']),
    spec_version: z.literal(HAID_SPEC_VERSION),
    planned_publish: IsoDate,
    published_at: IsoDate.nullable(),
    population_anchor: z.string().min(1),
    previous: ReleaseId.nullable(),
    levels: z.object(Object.fromEntries(LevelKeys.map((k) => [k, HaidLevelInputSchema]))).strict(),
    payment: z
      .object({
        certainty: z.enum(['range', 'lower_bound', 'none']),
        count: Triple.nullable(),
        anchors: z.array(z.string()),
        method_ja: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type HaidReleaseFile = z.infer<typeof HaidReleaseFileSchema>;

export interface HaidRelease {
  readonly release: HaidReleaseFile;
  readonly anchors: readonly HaidAnchor[];
  readonly overlap: HaidOverlap;
}

/** Cross-file invariants. Returns a list of human-readable problems; empty = valid. */
export function validateHaidRelease(input: HaidRelease): string[] {
  const problems: string[] = [];
  const { release, anchors, overlap } = input;
  const anchorById = new Map(anchors.map((a) => [a.id, a]));

  if (anchorById.size !== anchors.length) problems.push('anchor ids must be unique');

  const pop = anchorById.get(release.population_anchor);
  if (!pop) {
    problems.push(`population_anchor ${release.population_anchor} not found`);
  } else {
    const l1 = release.levels['1'];
    if (l1.method !== 'single' || l1.certainty !== 'measured' || l1.anchors[0] !== release.population_anchor) {
      problems.push('level 1 must be method single, measured, citing the population anchor');
    }
  }

  for (const [k, lv] of Object.entries(release.levels)) {
    const spec = HAID_LEVELS.find((l) => String(l.level) === k)!;
    for (const id of lv.anchors) {
      const a = anchorById.get(id);
      if (!a) {
        problems.push(`level ${k} cites unknown anchor ${id}`);
        continue;
      }
      if (!windowFits(spec.window, a.window)) {
        problems.push(`level ${k} (${spec.window}) cannot use anchor ${id} with window ${a.window}`);
      }
    }
    if (lv.overlap && overlap[lv.overlap] === null) {
      problems.push(`level ${k} cites overlap ${lv.overlap} which is null`);
    }
    if (lv.overlap && k !== '4' && k !== '5') {
      problems.push(`level ${k} must not carry an overlap (HAID subtracts overlap at levels 4 and 5 only)`);
    }
  }
  for (const id of release.payment.anchors) {
    if (!anchorById.has(id)) problems.push(`payment cites unknown anchor ${id}`);
  }
  if (release.payment.certainty === 'none' && release.payment.count !== null) {
    problems.push('payment certainty none requires count null');
  }

  if (release.status === 'final') {
    if (release.published_at === null) problems.push('a final release must carry published_at');
    for (const a of anchors) {
      if (a.status !== 'verified') problems.push(`final release: anchor ${a.id} is still ${a.status}`);
      if (a.source_url === null) problems.push(`final release: anchor ${a.id} has no source_url`);
    }
    for (const key of ['level_4', 'level_5'] as const) {
      const o = overlap[key];
      if (o && o.status !== 'verified') problems.push(`final release: overlap ${key} is still ${o.status}`);
    }
  }
  return problems;
}

/**
 * An anchor's window must not be wider than the level's. A 7-day count may
 * serve a 30-day level (as a floor: weekly users are monthly users); a 30-day
 * count may not serve the 7-day level. Levels 1 and 2 take ITU / state
 * figures; levels 9–10 are judged as a state.
 */
export function windowFits(levelWindow: HaidWindow, anchorWindow: HaidAnchor['window']): boolean {
  switch (levelWindow) {
    case 'itu_3m':
    case 'residual':
      return anchorWindow === 'itu_3m' || anchorWindow === 'state';
    case 'days_30':
      return anchorWindow === 'days_30' || anchorWindow === 'days_7';
    case 'days_7':
      return anchorWindow === 'days_7';
    case 'state':
    case 'counterfactual':
      return anchorWindow === 'state';
  }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf-8'));
}

/** Load and validate one release directory. Throws with every problem listed. */
export async function loadHaidRelease(dir: string): Promise<HaidRelease> {
  const [releaseRaw, anchorsRaw, overlapRaw] = await Promise.all([
    readJson(join(dir, 'release.json')),
    readJson(join(dir, 'anchors.json')),
    readJson(join(dir, 'overlap.json')),
  ]);
  const release = HaidReleaseFileSchema.parse(releaseRaw);
  const anchors = z.array(HaidAnchorSchema).parse(anchorsRaw);
  const overlap = HaidOverlapSchema.parse(overlapRaw);
  const problems = validateHaidRelease({ release, anchors, overlap });
  if (problems.length > 0) {
    throw new Error(`[haid-release] ${dir}: ${problems.join('; ')}`);
  }
  return { release, anchors, overlap };
}
