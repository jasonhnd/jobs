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
  loadHaidRelease,
  type HaidRelease,
  type HaidReleaseCertainty,
  type HaidTriple,
} from '../schema/haid-release.js';
import {
  HAID_RELEASE_BASE_PATH,
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

function displayOf(certainty: HaidReleaseCertainty, t: HaidTriple | null): number | null {
  if (t === null) return null;
  switch (certainty) {
    case 'lower_bound':
      return t.low;
    case 'none':
      return null;
    default:
      return t.mid;
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
  const population = release.levels['1'].n_at_least?.mid;
  if (population === null || population === undefined || population <= 0) {
    throw new Error('[haid-release] level 1 must carry the population');
  }

  // 1. display values, then clamp by nesting from the top down.
  const raw = HAID_LEVELS.map((spec) => {
    const lv = release.levels[String(spec.level)];
    return { spec, lv, display: displayOf(lv.certainty, lv.n_at_least), clamped: false };
  });
  for (let i = raw.length - 2; i >= 0; i -= 1) {
    const next = raw[i + 1].display;
    const here = raw[i].display;
    if (next === null) continue;
    // A データなし level below a level that has data is still at least that
    // many people (nesting); draw it at the floor with n(k) = 0, certainty none.
    if (here === null || here < next) {
      raw[i].display = next;
      raw[i].clamped = true;
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
    const t = r.lv.n_at_least;
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
  return { files, releases: ids, latest };
}
