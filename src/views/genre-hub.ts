/**
 * genre-hub.ts — generic data-driven hub builder.
 *
 * Phase 3 (2026-05-10) で 9 個の新 genre が同一パターンを共有するため、
 * skills-hub.ts / interests.ts のロジックを共通化したライブラリ。
 *
 * 対象 genre (各 hub = "ある軸で TOP 30 職業"):
 *   - abilities (能力 — abilities_top5)
 *   - knowledge (知識 — knowledge_top5)
 *   - values (価値観 — work_values_top5)
 *   - work-styles (業務形態 — work_characteristics_top5)
 *   - training (習熟期間 — training_pre/post_top5)
 *   - entry-paths (入職経路 — experience_top5)
 *   - education (学歴 — education_pct from treemap)
 *   - employment-types (雇用形態 — employment_type from treemap)
 *   - life-balance (ライフバランス — derived from multiple fields)
 *
 * 各 hub は GenreHubConfig で挙動を表現し、buildGenreBundle が共通の
 * filter/sort/render を実行する。
 */
// 2026-05-17 R2 fix: fs reads (formerly via `strict-load`) moved to
// `src/page-data/projection-loaders.ts` so the view layer is truly
// fs-free per architecture.md §3.3. This file re-exports
// `loadAllDetails` + the `DetailFileMin` type for backwards
// compatibility with the 15+ existing call sites — they still see
// the same API, but the fs boundary is now correctly at the
// page-data layer.
import {
  loadAllDetails as _loadAllDetailsFromPageData,
  type DetailFileMin as _DetailFileMinFromPageData,
} from '../page-data/projection-loaders.js';

const TOP_N = 30;

// ─── Types ──────────────────────────────────────────────────────

export type DetailFileMin = _DetailFileMinFromPageData;

export interface GenreOccupation {
  id: number;
  name_ja: string;
  primary_score: number;
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  monthly_hours: number | null;
  average_age: number | null;
  sector_id: string;
  sector_ja: string;
}

export type DimensionField =
  | 'abilities_top5'
  | 'knowledge_top5'
  | 'skills_top10'
  | 'work_values_top5'
  | 'work_characteristics_top5'
  | 'training_pre_top5'
  | 'training_post_top5'
  | 'experience_top5';

export interface GenreHubConfig {
  slug: string;
  short_ja: string;
  title_ja: string;
  description_ja: string;
  /** OG card eyebrow */
  og_eyebrow: string;
  /** Optional sub-info panels */
  characteristics_ja?: ReadonlyArray<string>;
  how_to_develop_ja?: ReadonlyArray<string>;
  /** For dimension-based filtering: which top-N field on detail to use */
  dimension_field?: DimensionField;
  /** The key to look up within the dimension */
  dimension_key?: string;
  /**
   * For derived hubs: a custom predicate. Returns null to exclude,
   * or a numeric score (used for sorting desc).
   */
  custom_filter?: (d: DetailFileMin) => number | null;
}

export interface GenreResult {
  config: GenreHubConfig;
  items: GenreOccupation[];
  stats: ReadonlyArray<readonly [label: string, value: string]>;
  sectorBreakdown: ReadonlyArray<readonly [sector: string, count: number]>;
  highlights: ReadonlyArray<string>;
  faqItems: ReadonlyArray<readonly [q: string, a: string]>;
}

// ─── Loader (re-export from page-data, 2026-05-17 R2) ─────────

export const loadAllDetails = _loadAllDetailsFromPageData;

// ─── Helpers ──────────────────────────────────────────────────

// Single source of truth lives at src/lib/num. Re-exported for legacy consumers.
import { fmtInt, safeMean } from '../lib/num.js';
export { fmtInt, safeMean };

// Single source of truth lives at src/lib/safe-html.ts. Import for internal
// use within this module, re-export so existing pages/sibling lib files
// continue to work. SafeHtml is structurally a string — callers expecting
// string see no API change.
import { escapeHtml } from '../lib/safe-html.js';
export { escapeHtml };

// Single source of truth lives at src/lib/risk. Re-exported so existing
// consumers (pages importing `riskClass` from this module) keep working.
import { riskClass } from '../lib/risk.js';
export { riskClass };

// ─── Core builder ────────────────────────────────────────────

function adaptToOcc(d: DetailFileMin, score: number): GenreOccupation {
  return {
    id: d.id,
    name_ja: d.title?.ja ?? `#${d.id}`,
    primary_score: score,
    ai_risk: d.ai_risk?.score ?? null,
    risk_band: d.risk_band ?? null,
    workers: d.stats?.workers ?? null,
    salary: d.stats?.salary_man_yen ?? null,
    monthly_hours: d.stats?.monthly_hours ?? null,
    average_age: d.stats?.average_age ?? null,
    sector_id: d.sector?.id ?? '',
    sector_ja: d.sector?.ja ?? '',
  };
}

export function buildGenreItems(
  details: ReadonlyArray<DetailFileMin>,
  config: GenreHubConfig,
): GenreOccupation[] {
  const candidates: GenreOccupation[] = [];

  if (config.dimension_field && config.dimension_key) {
    // Dimension-based: scan top-N of each detail for the key
    for (const d of details) {
      const arr = d[config.dimension_field] as Array<{ key: string; score: number }> | null | undefined;
      if (!arr) continue;
      const entry = arr.find((e) => e.key === config.dimension_key);
      if (!entry) continue;
      candidates.push(adaptToOcc(d, entry.score));
    }
  } else if (config.custom_filter) {
    // Custom predicate
    for (const d of details) {
      const score = config.custom_filter(d);
      if (score === null) continue;
      candidates.push(adaptToOcc(d, score));
    }
  }

  candidates.sort((a, b) => {
    if (b.primary_score !== a.primary_score) return b.primary_score - a.primary_score;
    return a.id - b.id;
  });
  return candidates.slice(0, TOP_N);
}

export function buildGenreResult(
  details: ReadonlyArray<DetailFileMin>,
  config: GenreHubConfig,
): GenreResult {
  const items = buildGenreItems(details, config);

  // Sector breakdown
  const sectorCounts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
  }
  const sectorBreakdown: Array<readonly [string, number]> = Array.from(sectorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Stats
  const meanRisk = safeMean(items.map((o) => o.ai_risk));
  const meanSalary = safeMean(items.map((o) => o.salary));
  const meanScore = safeMean(items.map((o) => o.primary_score));
  const totalWorkers = items.reduce((s, o) => s + (o.workers ?? 0), 0);

  const stats: Array<readonly [string, string]> = [
    [`平均 ${config.short_ja}スコア`, `${meanScore.toFixed(2)}`],
    ['平均 AI 影響', meanRisk > 0 ? `${meanRisk.toFixed(1)} / 10` : '—'],
    ['平均年収', meanSalary > 0 ? `${Math.trunc(meanSalary)} 万円` : '—'],
    ['TOP30 合計就業者数', `${fmtInt(totalWorkers)} 人`],
  ];

  // Highlights
  const top3 = items.slice(0, 3).map((o) => o.name_ja).join('、');
  const dominantSector = sectorBreakdown[0]?.[0] ?? '';
  const dominantCount = sectorBreakdown[0]?.[1] ?? 0;
  const highlights: string[] = [
    `1 位は「${items[0]?.name_ja ?? '—'}」（${config.short_ja}スコア ${items[0]?.primary_score.toFixed(2) ?? '—'}）`,
    top3 ? `TOP 3 は ${top3}` : '',
    dominantSector ? `セクターは「${dominantSector}」が ${dominantCount} 件と最多` : '',
    meanRisk > 0 ? `TOP30 の平均 AI 影響は ${meanRisk.toFixed(1)}/10` : '',
    config.characteristics_ja?.[0] ? `特徴: ${config.characteristics_ja[0]}` : '',
  ].filter(Boolean);

  // Auto FAQ
  const faqItems: Array<readonly [string, string]> = [];
  faqItems.push([
    `${config.short_ja}が中心となるのはどんな職業？`,
    config.description_ja,
  ]);
  if (top3) {
    faqItems.push([
      `${config.short_ja}スコアが高い職業 TOP 3 は？`,
      `${top3} です。本ページでは TOP ${items.length} 職業を AI 影響度・年収・就業者数と共に確認できます。`,
    ]);
  }
  if (meanRisk > 0) {
    const tier = meanRisk <= 3.5 ? '低め' : meanRisk <= 5.5 ? '中程度' : 'やや高め';
    faqItems.push([
      `${config.short_ja}が必要な職業は AI 影響度が高い？`,
      `本 hub の TOP ${items.length} の平均 AI 影響度は ${meanRisk.toFixed(1)}/10 で ${tier} の水準です。本サイトの AI 影響度は Claude Opus 4.7 による独自分析（非公式）です。`,
    ]);
  }
  if (config.how_to_develop_ja?.length) {
    faqItems.push([
      `${config.short_ja}を伸ばすには？`,
      `代表的なヒント: ${config.how_to_develop_ja.slice(0, 2).join('。')}。本 TOP 職業の業務に近い実践を積むのが効果的です。`,
    ]);
  }

  return {
    config,
    items,
    stats,
    sectorBreakdown,
    highlights,
    faqItems,
  };
}
