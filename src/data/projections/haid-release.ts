/**
 * data.haid-<release>.json + data.haid-latest.json — quarterly HAID
 * current-state releases for /aiadoption (aiadoption-1.2).
 *
 * Inputs: every directory under data/haid-release/ (validated by
 * src/data/schema/haid-release.ts). Definitions come from
 * src/site/haid-spec.ts and are copied into the payload so a consumer can
 * read one file.
 *
 * Derivations (docs/HAID.md 判定の規則・測定と報告の方法):
 *   display(k)  = mid for measured / residual / range, low for lower_bound,
 *                 null for none. Clamped so that display(k) >= display(k+1)
 *                 (nesting); a clamp is recorded, never silent.
 *   n(k)        = display(k) - display(k+1)   (display(11) := 0)
 *   sum n(1..10) = population, by construction.
 *   n certainty = none if N(≥k) is none; residual for level 2 (spec);
 *                 otherwise the weaker of N(≥k) and N(≥k+1).
 *   as_of       = latest as_of among anchors cited by any level.
 *
 * Numbers stay raw (people). Rounding to 1 / 2 significant figures is the
 * page's job (見出し 1 けた・表 2 けた).
 */
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  HAID_BOUNDARIES,
  HAID_CANONICAL_PATH,
  HAID_CERTAINTY_JA,
  HAID_GRADE_JA,
  HAID_LEVELS,
  HAID_LICENSE,
  HAID_LICENSE_URL,
  HAID_NAME_JA,
  HAID_RELATIONS,
  HAID_SPEC_VERSION,
} from '../../site/haid-spec.js';
import {
  HAID_RELEASE_ROOT,
  isStale,
  loadHaidRelease,
  quarterBounds,
  type HaidAnchor,
  type HaidLevelInput,
  type HaidOverlap,
  type HaidRelease,
  type HaidReleaseCertainty,
  type HaidTriple,
} from '../schema/haid-release.js';
import {
  HAID_RELEASE_BASE_PATH,
  type HaidDerivation,
  type HaidDerivationTerm,
  type HaidMarketBlock,
  type HaidLatestPayload,
  type HaidPreviousLevel,
  type HaidReleaseLevelOut,
  type HaidReleasePayload,
} from '../../site/haid-release-types.js';

export { HAID_RELEASE_BASE_PATH, type HaidLatestPayload, type HaidReleaseLevelOut, type HaidReleasePayload };

export interface HaidReleaseContext {
  /** Every release id, oldest first. */
  readonly releases: readonly string[];
  /** Payload of `release.previous`, when it exists. */
  readonly previous: HaidReleasePayload | null;
}

const CERTAINTY_RANK: Record<HaidReleaseCertainty, number> = {
  measured: 0,
  residual: 1,
  range: 2,
  lower_bound: 3,
  none: 4,
};

function weaker(a: HaidReleaseCertainty, b: HaidReleaseCertainty): HaidReleaseCertainty {
  return CERTAINTY_RANK[a] >= CERTAINTY_RANK[b] ? a : b;
}

interface Computed {
  readonly triple: HaidTriple | null;
  readonly derivation: HaidDerivation;
}

/** The arithmetic behind N(≥k). Every branch is spelled out so the page can print it. */
export function computeLevel(
  lv: HaidLevelInput,
  levelWindow: string,
  anchorById: ReadonlyMap<string, HaidAnchor>,
  overlap: HaidOverlap,
  quarterEnd: string,
): Computed {
  const terms: HaidDerivationTerm[] = lv.anchors.map((id) => {
    const a = anchorById.get(id);
    if (!a) throw new Error(`[haid-release] unknown anchor ${id}`);
    const base = a.kind === 'top_down' ? anchorById.get(a.base_anchor!) ?? null : null;
    return {
      id: a.id,
      entity_ja: a.entity_ja,
      metric_ja: a.metric_ja,
      value: a.value,
      window: a.window,
      grade: a.grade,
      narrower_window: levelWindow === 'days_30' && a.window === 'days_7',
      market: a.market,
      kind: a.kind,
      stale: isStale(a.as_of, quarterEnd),
      share: a.share ?? null,
      base_value: base?.value ?? null,
      base_label_ja: base ? `${base.entity_ja} ${base.metric_ja}` : null,
    };
  });
  const values = terms.map((t) => t.value);
  const max = values.length ? Math.max(...values) : null;
  const base = {
    method: lv.method, terms, max, sum: null, overlap_rate: null, floored_to: null,
    markets: null, bottom_up: null, top_down: null, raw_sum: null,
  } as const;
  switch (lv.method) {
    case 'none':
      return { triple: null, derivation: { ...base, low: null, mid: null, high: null, computed: null } };
    case 'single': {
      const v = values[0];
      return { triple: { low: v, mid: v, high: v }, derivation: { ...base, low: v, mid: v, high: v, computed: v } };
    }
    case 'max_single':
      return { triple: { low: max, mid: null, high: null }, derivation: { ...base, low: max, mid: null, high: null, computed: max } };
    case 'sum_minus_overlap': {
      const market = terms[0]?.market ?? 'world';
      const o = lv.overlap ? overlap[lv.overlap][market] : null;
      if (!o) throw new Error(`[haid-release] sum_minus_overlap without an overlap rate for market ${market}`);
      const sum = values.reduce((a, b) => a + b, 0);
      const mid = Math.round(sum * (1 - o.rate));
      return {
        triple: { low: max, mid, high: sum },
        derivation: { ...base, sum, overlap_rate: o.rate, low: max, mid, high: sum, computed: mid, raw_sum: sum },
      };
    }
    case 'market_union_topdown': {
      if (!lv.overlap) throw new Error('[haid-release] market_union_topdown without an overlap table');
      const table = overlap[lv.overlap];
      const marketsSeen = [...new Set(terms.filter((t) => t.kind === 'product' || t.kind === 'union').map((t) => t.market))];
      const markets: HaidMarketBlock[] = marketsSeen.map((m) => {
        const products = terms.filter((t) => t.kind === 'product' && t.market === m);
        const unionAnchor = terms.find((t) => t.kind === 'union' && t.market === m) ?? null;
        const sum = products.length ? products.reduce((a, t) => a + t.value, 0) : null;
        const mx = products.length ? Math.max(...products.map((t) => t.value)) : null;
        if (unionAnchor) {
          return { market: m, union_anchor: unionAnchor.id, products: products.map((t) => t.id), sum, max: mx, overlap_rate: null, union: unionAnchor.value };
        }
        const o = table[m];
        if (!o) throw new Error(`[haid-release] market ${m} has products but no union anchor and no overlap rate`);
        return { market: m, union_anchor: null, products: products.map((t) => t.id), sum, max: mx, overlap_rate: o.rate, union: Math.round((sum ?? 0) * (1 - o.rate)) };
      });
      const bottomUp = markets.reduce((a, b) => a + b.union, 0);
      const topDownTerms = terms.filter((t) => t.kind === 'top_down');
      const topDown = topDownTerms.reduce((a, t) => a + t.value, 0);
      const rawSum = terms.filter((t) => t.kind === 'product').reduce((a, t) => a + t.value, 0)
        + markets.filter((b) => b.union_anchor && b.products.length === 0).reduce((a, b) => a + b.union, 0);
      const low = Math.min(bottomUp, topDown);
      const high = Math.max(bottomUp, topDown);
      const mid = Math.round(Math.sqrt(low * high));
      return {
        triple: { low, mid, high },
        derivation: { ...base, markets, bottom_up: bottomUp, top_down: topDown, raw_sum: rawSum, sum: null, low, mid, high, computed: mid },
      };
    }
  }
}

export function buildHaidReleasePayload(
  input: HaidRelease,
  context: HaidReleaseContext = { releases: [input.release.release], previous: null },
): HaidReleasePayload {
  const { release, anchors, overlap } = input;
  if (release.previous !== null && context.previous === null) {
    throw new Error(`[haid-release] ${release.release} names previous ${release.previous} but no payload was given`);
  }
  if (context.previous !== null && context.previous.release !== release.previous) {
    throw new Error(`[haid-release] ${release.release}: previous payload is ${context.previous.release}, expected ${release.previous}`);
  }
  const round = context.releases.indexOf(release.release) + 1;
  if (round === 0) throw new Error(`[haid-release] ${release.release} is not in the release list`);
  const anchorById = new Map(anchors.map((a) => [a.id, a]));

  // 1. compute N(≥k) from the anchors per method, then clamp by nesting from the top down.
  const raw = HAID_LEVELS.map((spec) => {
    const lv = release.levels[String(spec.level)];
    const c = computeLevel(lv, spec.window, anchorById, overlap, quarterBounds(release.release).end);
    return { spec, lv, triple: c.triple, derivation: c.derivation, display: c.derivation.computed, clamped: false };
  });
  const population = raw[0].display;
  if (population === null || population <= 0) {
    throw new Error('[haid-release] level 1 must carry the population');
  }
  for (let i = raw.length - 2; i >= 0; i -= 1) {
    const next = raw[i + 1].display;
    const here = raw[i].display;
    if (next === null) continue;
    // A データなし level below a level that has data is still at least that
    // many people (nesting); draw it at the floor with n(k) = 0, certainty none.
    if (here === null || here < next) {
      raw[i].display = next;
      raw[i].clamped = true;
      raw[i].derivation = { ...raw[i].derivation, floored_to: next };
    }
  }

  // 2. n(k) = display(k) - display(k+1), certainty from the weaker side.
  const levels: HaidReleaseLevelOut[] = raw.map((r, i) => {
    const nextDisplay = i + 1 < raw.length ? raw[i + 1].display ?? 0 : 0;
    const nextCert: HaidReleaseCertainty = i + 1 < raw.length ? raw[i + 1].lv.certainty : 'measured';
    let nCert: HaidReleaseCertainty;
    if (r.lv.certainty === 'none') nCert = 'none';
    else if (r.spec.level === 2) nCert = 'residual';
    else nCert = weaker(r.lv.certainty, nextCert === 'none' ? 'measured' : nextCert);
    const nDisplay = r.display === null ? null : r.display - nextDisplay;
    const t = r.triple;
    return {
      level: r.spec.level,
      relation: r.spec.relation,
      ja: r.spec.ja,
      en: r.spec.en,
      n_at_least: {
        certainty: r.lv.certainty,
        low: t?.low ?? null,
        mid: t?.mid ?? null,
        high: t?.high ?? null,
        display: r.display,
        clamped: r.clamped,
      },
      n: {
        certainty: nCert,
        display: nDisplay,
        share: nDisplay === null ? null : nDisplay / population,
      },
      anchors: [...r.lv.anchors],
      overlap: r.lv.overlap ?? null,
      method_ja: r.lv.method_ja,
      derivation: r.derivation,
    };
  });

  // 3. as_of = latest cited anchor.
  const cited = new Set(levels.flatMap((l) => l.anchors).concat(release.payment.anchors));
  const asOf = anchors
    .filter((a) => cited.has(a.id))
    .map((a) => a.as_of)
    .sort()
    .at(-1);
  if (!asOf) throw new Error('[haid-release] no cited anchor — as_of cannot be derived');
  // A round's 時点 must fall inside its own quarter (owner ruling 2026-09-22: a Q3
  // round built only from Q2-dated anchors is not a Q3 round).
  const { start, end } = quarterBounds(release.release);
  if (asOf < start || asOf > end) {
    throw new Error(`[haid-release] ${release.release}: as_of ${asOf} (latest cited anchor) is outside ${start}..${end} — cite at least one anchor published in the quarter`);
  }

  return {
    schema_version: '1.0.0',
    standard: 'HAID',
    name_ja: HAID_NAME_JA,
    spec_version: HAID_SPEC_VERSION,
    spec_url: `https://mirai-shigoto.com${HAID_CANONICAL_PATH}`,
    license: HAID_LICENSE,
    license_url: HAID_LICENSE_URL,
    release: release.release,
    label_ja: release.label_ja,
    version: release.version,
    status: release.status,
    as_of: asOf,
    planned_publish: release.planned_publish,
    published_at: release.published_at,
    previous: release.previous,
    url: `https://mirai-shigoto.com${HAID_RELEASE_BASE_PATH}/${release.release}`,
    population,
    levels,
    relations: HAID_RELATIONS,
    boundaries: HAID_BOUNDARIES,
    anchors: [...anchors],
    overlap,
    payment: release.payment,
    certainty_labels_ja: HAID_CERTAINTY_JA,
    grade_labels_ja: HAID_GRADE_JA,
    placeholder_anchors: anchors.filter((a) => a.status === 'placeholder').map((a) => a.id),
    releases: [...context.releases],
    round,
    previous_levels: context.previous === null ? null : previousLevelsOf(context.previous),
  };
}

function previousLevelsOf(prev: HaidReleasePayload): HaidPreviousLevel[] {
  return prev.levels.map((l) => ({
    level: l.level,
    n_at_least_display: l.n_at_least.display,
    n_at_least_certainty: l.n_at_least.certainty,
    n_display: l.n.display,
    anchor_grades: anchorGradesOf(prev, l.level),
    anchor_ids: [...l.anchors].sort(),
  }));
}

/** Sorted unique grades of the anchors a level cites — a change means 「数え方が変わった」. */
export function anchorGradesOf(p: HaidReleasePayload, level: number): string[] {
  const l = p.levels.find((x) => x.level === level);
  if (!l) return [];
  const byId = new Map(p.anchors.map((a) => [a.id, a.grade]));
  return [...new Set(l.anchors.map((id) => byId.get(id)).filter((g): g is 'A' | 'B' | 'C' | 'D' => g !== undefined))].sort();
}

/** Newest release id wins; ids sort lexically because they are yyyy-qN. */
export function pickLatestRelease(ids: readonly string[]): string {
  if (ids.length === 0) throw new Error('[haid-release] no release directory found');
  return [...ids].sort().at(-1)!;
}

export async function listHaidReleaseIds(root: string = HAID_RELEASE_ROOT): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function buildHaidRelease(
  distRoot: string,
  root: string = HAID_RELEASE_ROOT,
): Promise<{ files: string[]; releases: string[]; latest: string }> {
  const ids = await listHaidReleaseIds(root);
  const latest = pickLatestRelease(ids);
  const files: string[] = [];
  const built = new Map<string, HaidReleasePayload>();
  for (const id of ids) {
    const input = await loadHaidRelease(join(root, id));
    if (input.release.release !== id) {
      throw new Error(`[haid-release] directory ${id} declares release ${input.release.release}`);
    }
    const prevId = input.release.previous;
    if (prevId !== null && !built.has(prevId)) {
      throw new Error(`[haid-release] ${id} names previous ${prevId}, which is missing or not older`);
    }
    const payload = buildHaidReleasePayload(input, { releases: ids, previous: prevId === null ? null : built.get(prevId)! });
    built.set(id, payload);
    const outPath = join(distRoot, `data.haid-${id}.json`);
    await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
    files.push(outPath);
  }
  const latestOut: HaidLatestPayload = built.get(latest)!;
  const latestPath = join(distRoot, 'data.haid-latest.json');
  await writeFile(latestPath, JSON.stringify(latestOut, null, 2) + '\n', 'utf-8');
  files.push(latestPath);
  // The retired 5-layer model's file keeps its URL as a stub that points at
  // the successor (owner ruling 2026-09-21: no redirect, no vercel.json change).
  const stubPath = join(distRoot, RETIRED_AI_ADOPTION_FILE);
  await writeFile(stubPath, JSON.stringify(retiredAiAdoptionStub(latest), null, 2) + '\n', 'utf-8');
  files.push(stubPath);
  return { files, releases: ids, latest };
}

export const RETIRED_AI_ADOPTION_FILE = 'data.ai-adoption.json';

/** What /data.ai-adoption.json serves after aiadoption-1.5. Shape is frozen; consumers should move on. */
export function retiredAiAdoptionStub(latestRelease: string) {
  return {
    deprecated: true,
    retired_on: '2026-09-22',
    last_period: '2026-Q2',
    last_model_version: '0.1.0',
    successor: '/data.haid-latest.json',
    successor_release: `/data.haid-${latestRelease}.json`,
    standard: 'HAID',
    standard_url: `https://mirai-shigoto.com${HAID_CANONICAL_PATH}`,
    note: 'The 5-layer AI adoption model (深く使う/有料/無料/端末でふれる/未利用) was retired. Quarterly HAID releases replace it: ten nested levels, per-level certainty, anchors with grades.',
  };
}
