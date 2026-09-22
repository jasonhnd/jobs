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
    window: z.enum(['itu_3m', 'days_30', 'days_7', 'state', 'cumulative']),
    as_of: IsoDate,
    published_at: IsoDate,
    grade: z.enum(['A', 'B', 'C', 'D']),
    source_name: z.string().min(1),
    source_url: z.url().nullable(),
    status: z.enum(['placeholder', 'verified']),
    note: z.string(),
    /** Which population the figure covers. Product sets barely overlap across markets. */
    market: z.enum(['cn', 'row', 'world']),
    /**
     * product   — one product's users (summed inside a market, overlap subtracted)
     * union     — a panel's deduplicated total for a market (used as-is; products listed only)
     * top_down  — share × population, an independent estimate for cross-checking
     * base      — a population figure other anchors refer to (never cited by a level)
     */
    kind: z.enum(['product', 'union', 'top_down', 'base']).default('product'),
    /** top_down only: the published share (0..1) and the base anchor it multiplies. */
    share: z.number().min(0).max(1).optional(),
    base_anchor: z.string().optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    const need = (cond: boolean, message: string) => {
      if (!cond) ctx.addIssue({ code: 'custom', message });
    };
    if (a.kind === 'top_down') {
      need(a.share !== undefined && a.base_anchor !== undefined, 'top_down anchors carry share and base_anchor');
    } else {
      need(a.share === undefined && a.base_anchor === undefined, `${a.kind} anchors carry no share / base_anchor`);
    }
  });
export type HaidAnchor = z.infer<typeof HaidAnchorSchema>;
export type HaidMarket = HaidAnchor['market'];

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

/** Overlap rates are per market: a U.S. survey says nothing about 豆包 vs 千問. */
const OverlapByMarket = z
  .object({
    cn: HaidOverlapEntrySchema.nullable().default(null),
    row: HaidOverlapEntrySchema.nullable().default(null),
    world: HaidOverlapEntrySchema.nullable().default(null),
  })
  .strict();
export const HaidOverlapSchema = z
  .object({
    level_4: OverlapByMarket,
    level_5: OverlapByMarket,
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

export const HaidMethodSchema = z.enum(['single', 'max_single', 'sum_minus_overlap', 'market_union_topdown', 'none']);
export type HaidMethod = z.infer<typeof HaidMethodSchema>;

/** Which certainty each method yields. `single` may be measured or residual. */
export const METHOD_CERTAINTY: Readonly<Record<HaidMethod, readonly HaidReleaseCertainty[]>> = {
  single: ['measured', 'residual'],
  max_single: ['lower_bound'],
  sum_minus_overlap: ['range'],
  market_union_topdown: ['range'],
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
     *   market_union_topdown — per market: a union anchor as-is, else sum × (1 − that
     *                          market's overlap); bottom-up = Σ markets; top-down =
     *                          Σ top_down anchors; low = min, high = max, mid = √(low·high)
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
      case 'market_union_topdown':
        need(lv.anchors.length >= 2, 'method market_union_topdown cites at least two anchors');
        need(lv.overlap !== undefined, 'method market_union_topdown needs the overlap table for its level');
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

  for (const a of anchors) {
    if (a.kind === 'top_down') {
      const base = anchorById.get(a.base_anchor!);
      if (!base) problems.push(`anchor ${a.id} names unknown base_anchor ${a.base_anchor}`);
      else if (base.kind !== 'base') problems.push(`anchor ${a.id}: base_anchor ${a.base_anchor} is not a base anchor`);
      else {
        const expected = a.share! * base.value;
        if (Math.abs(a.value - expected) > Math.max(1, expected * 0.01)) {
          problems.push(`anchor ${a.id}: value ${a.value} is not share × base = ${a.share} × ${base.value} = ${Math.round(expected)}`);
        }
      }
    }
  }

  const { end: quarterEnd } = quarterBounds(release.release);
  for (const [k, lv] of Object.entries(release.levels)) {
    const spec = HAID_LEVELS.find((l) => String(l.level) === k)!;
    const cited: HaidAnchor[] = [];
    for (const id of lv.anchors) {
      const a = anchorById.get(id);
      if (!a) {
        problems.push(`level ${k} cites unknown anchor ${id}`);
        continue;
      }
      cited.push(a);
      if (a.kind === 'base') problems.push(`level ${k} cites base anchor ${id}; bases are only multiplied by top_down anchors`);
      if (!windowFits(spec.window, a.window)) {
        problems.push(`level ${k} (${spec.window}) cannot use anchor ${id} with window ${a.window}`);
      }
    }
    if (cited.length > 0 && cited.every((a) => isStale(a.as_of, quarterEnd))) {
      problems.push(`level ${k}: every cited anchor is older than 12 months at ${quarterEnd}`);
    }
    if (lv.overlap && k !== '4' && k !== '5') {
      problems.push(`level ${k} must not carry an overlap (HAID subtracts overlap at levels 4 and 5 only)`);
    }
    if (lv.method === 'sum_minus_overlap' && lv.overlap) {
      const markets = new Set(cited.map((a) => a.market));
      if (markets.size !== 1) problems.push(`level ${k}: sum_minus_overlap needs all anchors in one market, got ${[...markets].join(',')}`);
      const m = [...markets][0];
      if (m && overlap[lv.overlap][m] === null) problems.push(`level ${k} cites overlap ${lv.overlap}.${m} which is null`);
    }
    if (lv.method === 'market_union_topdown' && lv.overlap) {
      for (const m of new Set(cited.filter((a) => a.kind === 'product').map((a) => a.market))) {
        const hasUnion = cited.some((a) => a.kind === 'union' && a.market === m);
        if (!hasUnion && overlap[lv.overlap][m] === null) problems.push(`level ${k}: market ${m} has products but neither a union anchor nor an overlap rate`);
      }
      if (!cited.some((a) => a.kind === 'top_down')) problems.push(`level ${k}: market_union_topdown needs at least one top_down anchor`);
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
      for (const m of ['cn', 'row', 'world'] as const) {
        const o = overlap[key][m];
        if (o && o.status !== 'verified') problems.push(`final release: overlap ${key}.${m} is still ${o.status}`);
      }
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
  // A cumulative count (all-time users) bounds nothing within a window: list it, never cite it.
  if (anchorWindow === 'cumulative') return false;
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

/** [start, end] ISO dates of a release id's quarter. */
export function quarterBounds(release: string): { readonly start: string; readonly end: string } {
  const m = /^(\d{4})-q([1-4])$/.exec(release);
  if (!m) throw new Error(`[haid-release] bad release id ${release}`);
  const y = m[1];
  const q = Number(m[2]);
  const startMonth = (q - 1) * 3 + 1;
  const endDay = q === 1 || q === 4 ? 31 : 30;
  return { start: `${y}-${String(startMonth).padStart(2, '0')}-01`, end: `${y}-${String(startMonth + 2).padStart(2, '0')}-${endDay}` };
}

/** Older than 12 months at the quarter's end → 古い. */
export function isStale(asOf: string, quarterEnd: string): boolean {
  const cutoff = new Date(quarterEnd);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return new Date(asOf) < cutoff;
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
