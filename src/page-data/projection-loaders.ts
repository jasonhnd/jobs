/**
 * src/page-data/projection-loaders.ts — fs-reading loaders for the
 * 4 projection JSONs that view modules used to read directly. Moved
 * here 2026-05-17 (deep-audit R2 / C2 fix) so views/ becomes truly
 * fs-free per architecture.md §3.3.
 *
 * Background: Phase E's "✓ views fs=0" claim only counted direct
 * `node:fs` imports — these 4 views imported from `src/lib/strict-load.ts`
 * which transitively reads fs. A repeat audit (2026-05-17) flagged
 * `genre-hub.ts`, `compare-hub.ts`, `interests.ts`, `skills-hub.ts`
 * as still doing fs at call time. They now delegate to this module.
 *
 * Long-term: each of these projections should be read from the graph
 * (like profile5 + transfer_paths did in Phase E), eliminating this
 * file entirely. That requires graph schema extensions per projection
 * — deferred to a follow-up. For now this file is the single fs
 * boundary for views, with the same module-level caches the views
 * used to carry locally (preserved to avoid build-time redundant I/O).
 */
import { join } from 'node:path';
import { strictReadJson, strictReaddir } from '../lib/strict-load.js';
import {
  DetailFileSchema,
  ScoreHistoryProjectionSchema,
  type ScoreHistoryProjectionShape,
} from '../lib/projection-schemas.js';

const REPO_ROOT = process.cwd();
const PUBLIC_DIR = join(REPO_ROOT, 'public');

// ─── DetailFile (full) loader (genre-hub + compare-hub) ─────────────────
// Re-use DetailFileSchema's inferred shape via the structural types the
// callers expect. Keeping the same loose shapes the callers used
// historically — `as` cast bridges the structural mismatch where
// DetailFileSchema's `.optional()` chains don't align with caller types.

export interface DetailFileMin {
  id: number;
  title?: { ja?: string };
  ai_risk?: { score?: number | null; rationale_ja?: string } | null;
  risk_band?: string | null;
  description?: { summary_ja?: string };
  stats?: {
    salary_man_yen?: number | null;
    workers?: number | null;
    monthly_hours?: number | null;
    average_age?: number | null;
    recruit_ratio?: number | null;
    recruit_wage_man_yen?: number | null;
  } | null;
  sector?: { id?: string; ja?: string } | null;
  abilities_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  knowledge_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  skills_top10?: Array<{ key: string; label_ja: string; score: number }> | null;
  work_values_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  work_characteristics_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  training_pre_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  training_post_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  experience_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  related_certs_ja?: ReadonlyArray<string>;
  education_distribution?: Record<string, number> | null;
  employment_type?: Record<string, number> | null;
}

// Path-scoped caches keep injected fixture trees separate from the build.
const _allDetailsCache = new Map<string, DetailFileMin[]>();
const _detailByIdCache = new Map<string, DetailFileMin>();

/**
 * Load every `public/data.detail/<id>.json` file. Returns a flat
 * array sorted by file enumeration order (alphabetical / id-padded).
 * Cached for the lifetime of the build. Per architecture.md §3.3,
 * the fs read lives at the page-data boundary, not in views.
 */
export function loadAllDetails(publicDir: string = PUBLIC_DIR): DetailFileMin[] {
  const detailDir = join(publicDir, 'data.detail');
  const cached = _allDetailsCache.get(detailDir);
  if (cached) return cached;
  const files = strictReaddir(detailDir, (f) => f.endsWith('.json'), 'projection-loaders.detail');
  const out: DetailFileMin[] = [];
  for (const f of files) {
    const d = strictReadJson(
      join(detailDir, f),
      DetailFileSchema,
      'projection-loaders.detail',
    ) as DetailFileMin;
    out.push(d);
    _detailByIdCache.set(join(detailDir, `${String(d.id).padStart(4, '0')}.json`), d);
  }
  _allDetailsCache.set(detailDir, out);
  return out;
}

/**
 * Load one `public/data.detail/<id>.json` file by occupation id.
 * Padded to 4 digits internally. Cached. Used by compare-hub for
 * 40-ish per-page lookups; the cache also warms from a prior
 * `loadAllDetails()` call so they share the cost.
 */
export function loadDetailById(id: number, publicDir: string = PUBLIC_DIR): DetailFileMin {
  const padded = String(id).padStart(4, '0');
  const filePath = join(publicDir, 'data.detail', `${padded}.json`);
  const cached = _detailByIdCache.get(filePath);
  if (cached) return cached;
  const data = strictReadJson(
    filePath,
    DetailFileSchema,
    'projection-loaders.detail',
  ) as DetailFileMin;
  _detailByIdCache.set(filePath, data);
  return data;
}

// ─── Holland + treemap loaders (interests view) ─────────────────────────

/** Shape of `public/data.holland.json`. Validated loosely via schema
 *  at load time — see projection-schemas.ts for the runtime Zod. */
export interface HollandFile {
  cols: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<number | string | null>>;
}

/** Shape of `public/data.treemap.json` records the interests view reads. */
export interface TreemapRecordSummary {
  id: number;
  name_ja?: string;
  ai_risk?: number | null;
  workers?: number | null;
  salary?: number | null;
  hours?: number | null;
  recruit_ratio?: number | null;
}
export type TreemapFileSummary = ReadonlyArray<TreemapRecordSummary>;

const _hollandCache = new Map<string, HollandFile>();
const _treemapCache = new Map<string, TreemapFileSummary>();

import {
  HollandFileSchema,
  TreemapFileSummarySchema,
} from '../lib/projection-schemas.js';

export function loadHolland(publicDir: string = PUBLIC_DIR): HollandFile {
  const filePath = join(publicDir, 'data.holland.json');
  const cached = _hollandCache.get(filePath);
  if (cached) return cached;
  const data = strictReadJson(
    filePath,
    HollandFileSchema,
    'projection-loaders.holland',
  ) as HollandFile;
  _hollandCache.set(filePath, data);
  return data;
}

export function loadTreemapSummary(publicDir: string = PUBLIC_DIR): TreemapFileSummary {
  const filePath = join(publicDir, 'data.treemap.json');
  const cached = _treemapCache.get(filePath);
  if (cached) return cached;
  const data = strictReadJson(
    filePath,
    TreemapFileSummarySchema,
    'projection-loaders.treemap',
  ) as TreemapFileSummary;
  _treemapCache.set(filePath, data);
  return data;
}

// ─── Skill rankings loader (skills-hub view) ────────────────────────────

/** Shape of `public/data.skills/<ipdKey>.json` — top-N occupation list
 *  ranked by IPD score for the given skill. */
export interface SkillRankingFile {
  skill_key: string;
  label_ja: string;
  label_en?: string;
  occupations: ReadonlyArray<{
    id: number;
    name_ja: string;
    score: number;
  }>;
}

import { SkillRankingFileSchema } from '../lib/projection-schemas.js';

const _skillCache = new Map<string, SkillRankingFile>();

export function loadSkillRanking(ipdKey: string, publicDir: string = PUBLIC_DIR): SkillRankingFile {
  const filePath = join(publicDir, 'data.skills', `${ipdKey}.json`);
  const cached = _skillCache.get(filePath);
  if (cached) return cached;
  const data = strictReadJson(
    filePath,
    SkillRankingFileSchema,
    'projection-loaders.skill',
  ) as SkillRankingFile;
  _skillCache.set(filePath, data);
  return data;
}

// ─── Multi-model score history loader (occupation detail page) ───────

const _scoreHistoryCache = new Map<string, ScoreHistoryProjectionShape>();

export function loadScoreHistory(publicDir: string = PUBLIC_DIR): ScoreHistoryProjectionShape {
  const filePath = join(publicDir, 'data.score_history.json');
  const cached = _scoreHistoryCache.get(filePath);
  if (cached) return cached;
  const data = strictReadJson(
    filePath,
    ScoreHistoryProjectionSchema,
    'projection-loaders.score-history',
  ) as ScoreHistoryProjectionShape;
  _scoreHistoryCache.set(filePath, data);
  return data;
}
