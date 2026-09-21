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

export const HAID_RELEASE_BASE_PATH = '/aiadoption';

export interface HaidReleaseLevelOut {
  level: number;
  relation: string;
  ja: string;
  en: string;
  n_at_least: {
    certainty: HaidReleaseCertainty;
    low: number | null;
    mid: number | null;
    high: number | null;
    /** Value the page draws and quotes. null when データなし. */
    display: number | null;
    /** true when nesting raised display above the input (see file header). */
    clamped: boolean;
  };
  n: {
    certainty: HaidReleaseCertainty;
    display: number | null;
    /** display / population, 0..1. null when データなし. */
    share: number | null;
  };
  anchors: string[];
  overlap: string | null;
  method_ja: string;
}

export interface HaidReleasePayload {
  schema_version: string;
  standard: 'HAID';
  name_ja: string;
  spec_version: string;
  spec_url: string;
  license: string;
  license_url: string;
  release: string;
  label_ja: string;
  version: string;
  status: 'draft' | 'final';
  as_of: string;
  planned_publish: string;
  published_at: string | null;
  previous: string | null;
  url: string;
  population: number;
  levels: HaidReleaseLevelOut[];
  relations: typeof HAID_RELATIONS;
  boundaries: typeof HAID_BOUNDARIES;
  anchors: HaidRelease['anchors'];
  overlap: HaidRelease['overlap'];
  payment: HaidRelease['release']['payment'];
  certainty_labels_ja: typeof HAID_CERTAINTY_JA;
  grade_labels_ja: typeof HAID_GRADE_JA;
  /** Anchors still marked placeholder — non-empty only for a draft. */
  placeholder_anchors: string[];
}

export interface HaidLatestPayload extends HaidReleasePayload {
  releases: string[];
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

export function buildHaidReleasePayload(input: HaidRelease): HaidReleasePayload {
  const { release, anchors, overlap } = input;
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
    if (next !== null && here !== null && here < next) {
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
  };
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
  let latestPayload: HaidReleasePayload | null = null;
  for (const id of ids) {
    const payload = buildHaidReleasePayload(await loadHaidRelease(join(root, id)));
    if (payload.release !== id) {
      throw new Error(`[haid-release] directory ${id} declares release ${payload.release}`);
    }
    const outPath = join(distRoot, `data.haid-${id}.json`);
    await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
    files.push(outPath);
    if (id === latest) latestPayload = payload;
  }
  const latestOut: HaidLatestPayload = { ...latestPayload!, releases: ids };
  const latestPath = join(distRoot, 'data.haid-latest.json');
  await writeFile(latestPath, JSON.stringify(latestOut, null, 2) + '\n', 'utf-8');
  files.push(latestPath);
  return { files, releases: ids, latest };
}
