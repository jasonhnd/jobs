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
const DETAIL_DIR = join(REPO_ROOT, 'public', 'data.detail');
const PUBLIC_DIR = join(REPO_ROOT, 'public');
const SKILLS_DIR = join(REPO_ROOT, 'public', 'data.skills');

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

let _allDetailsCache: DetailFileMin[] | null = null;
const _detailByIdCache = new Map<number, DetailFileMin>();

/**
 * Load every `public/data.detail/<id>.json` file. Returns a flat
 * array sorted by file enumeration order (alphabetical / id-padded).
 * Cached for the lifetime of the build. Per architecture.md §3.3,
 * the fs read lives at the page-data boundary, not in views.
 */
export function loadAllDetails(): DetailFileMin[] {
  if (_allDetailsCache) return _allDetailsCache;
  const files = strictReaddir(DETAIL_DIR, (f) => f.endsWith('.json'), 'projection-loaders.detail');
  const out: DetailFileMin[] = [];
  for (const f of files) {
    const d = strictReadJson(
      join(DETAIL_DIR, f),
      DetailFileSchema,
      'projection-loaders.detail',
    ) as DetailFileMin;
    out.push(d);
    _detailByIdCache.set(d.id, d);
  }
  _allDetailsCache = out;
  return out;
}

/**
 * Load one `public/data.detail/<id>.json` file by occupation id.
 * Padded to 4 digits internally. Cached. Used by compare-hub for
 * 40-ish per-page lookups; the cache also warms from a prior
 * `loadAllDetails()` call so they share the cost.
 */
export function loadDetailById(id: number): DetailFileMin {
  const cached = _detailByIdCache.get(id);
  if (cached) return cached;
  const padded = String(id).padStart(4, '0');
  const data = strictReadJson(
    join(DETAIL_DIR, `${padded}.json`),
    DetailFileSchema,
    'projection-loaders.detail',
  ) as DetailFileMin;
  _detailByIdCache.set(id, data);
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

let _hollandCache: HollandFile | null = null;
let _treemapCache: TreemapFileSummary | null = null;

import {
  HollandFileSchema,
  TreemapFileSummarySchema,
} from '../lib/projection-schemas.js';

export function loadHolland(): HollandFile {
  if (_hollandCache) return _hollandCache;
  _hollandCache = strictReadJson(
    join(PUBLIC_DIR, 'data.holland.json'),
    HollandFileSchema,
    'projection-loaders.holland',
  ) as HollandFile;
  return _hollandCache;
}

export function loadTreemapSummary(): TreemapFileSummary {
  if (_treemapCache) return _treemapCache;
  _treemapCache = strictReadJson(
    join(PUBLIC_DIR, 'data.treemap.json'),
    TreemapFileSummarySchema,
    'projection-loaders.treemap',
  ) as TreemapFileSummary;
  return _treemapCache;
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

export function loadSkillRanking(ipdKey: string): SkillRankingFile {
  const cached = _skillCache.get(ipdKey);
  if (cached) return cached;
  const data = strictReadJson(
    join(SKILLS_DIR, `${ipdKey}.json`),
    SkillRankingFileSchema,
    'projection-loaders.skill',
  ) as SkillRankingFile;
  _skillCache.set(ipdKey, data);
  return data;
}

// ─── Multi-model score history loader (occupation detail page) ───────

let _scoreHistoryCache: ScoreHistoryProjectionShape | null = null;

export function loadScoreHistory(): ScoreHistoryProjectionShape {
  if (_scoreHistoryCache) return _scoreHistoryCache;
  _scoreHistoryCache = strictReadJson(
    join(PUBLIC_DIR, 'data.score_history.json'),
    ScoreHistoryProjectionSchema,
    'projection-loaders.score-history',
  ) as ScoreHistoryProjectionShape;
  return _scoreHistoryCache;
}
