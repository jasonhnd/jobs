/**
 * src/views/ranking/config.ts — type definitions + immutable constants
 * for the ranking subsystem.
 *
 * Extracted from src/views/ranking.ts (2026-05-17, audit finding CODE-010
 * splitting the 1411-line monolith). Pure data + types only: no logic,
 * no I/O. Safe to import from anywhere in the view / page-data /
 * template layers (per docs/architecture.md §6.2).
 */

import { RANKING_META, type RankingSlug as RankingSlugMeta } from '../rankings-meta.js';
import type { ExtraCol } from '../../templates/Ranking.js';

export const TOP_N = 30;

export interface Occupation {
  id: number;
  title_ja: string | null;
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  monthly_hours: number | null;
  average_age: number | null;
  recruit_wage: number | null;
  /** 有効求人倍率 (Phase 2 で必要) */
  recruit_ratio: number | null;
  demand_band: string | null;
  sector_id: string;
  sector_ja: string;
  /** Phase 2: 学歴分布 (JA-key %、treemap.json の education_pct から) */
  education_pct: Record<string, number> | null;
  /** Phase 2: 雇用形態分布 (JA-key %、treemap.json の employment_type から) */
  employment_type: Record<string, number> | null;
  /** Phase 2: 関連資格リスト (data.detail/<id>.json の related_certs_ja から、別 fetch) */
  certs: ReadonlyArray<string>;
  /** Phase 2: 派生時給 (recruit_wage_man_yen × 10000 / 160h、なければ null) */
  hourly_wage: number | null;
}

export const DEMAND_SCORE: Record<string, number> = {
  hot: 4,
  warm: 3,
  cool: 2,
  cold: 1,
};

export const DEMAND_JA: Record<string, string> = {
  hot: '需要高',
  warm: 'やや高',
  cool: '安定',
  cold: '低',
};

export type RankingSlug = RankingSlugMeta;

export const ALL_RANKINGS: ReadonlyArray<readonly [RankingSlug, string, string]> =
  RANKING_META.map((m) => [m.slug, m.name_ja, m.description_ja] as const);

export interface RankingResult {
  slug: RankingSlug;
  items: Occupation[];
  /** Stats prepared for the page header `<dl class="stats">`. */
  statBlocks: ReadonlyArray<readonly [string, string]>;
  /**
   * Optional extra metric per item, rendered before salary. Returns a list
   * of typed extra-col descriptors that the renderer escapes safely — see
   * `ExtraCol` in ranking-renderers.ts. Plain strings show as the standard
   * `rl-extra` chip; `{ kind: 'demand-pill', … }` produces the colored
   * demand badge.
   */
  extraColFn?: (o: Occupation) => ExtraCol[];
  /** Whether to show the salary chip. */
  showSalary: boolean;
  faqItems: ReadonlyArray<readonly [string, string]>;
  // Page metadata (mirrors render_page args).
  title: string;
  seoDesc: string;
  h1Text: string;
  /** Allowed to contain inline <strong> markup; rendered raw. */
  subText: string;
  introText: string;
}

export interface RankingsHubCardData {
  slug: RankingSlug;
  name: string;
  desc: string;
  count: number;
  preview: string;
}

/**
 * RA-128: grouped view of hub cards. Each group has a label, lede, and
 * the same card objects re-bucketed in the order defined by
 * RANKING_GROUPS. `cards` retained for backward compatibility.
 */
export interface RankingsHubGroup {
  key: string;
  label_ja: string;
  lede_ja: string;
  cards: RankingsHubCardData[];
}

// ─── RA-128: 39-card grouping for /rankings hub ────────────────────
// Groups all 39 hub cards into 6 thematic categories with sticky-anchor
// chip nav. Order within each group matters (drives card order on page).
// Lives in config (not index.ts) so build.ts can import without creating
// an index → build → index cycle.
export const RANKING_GROUPS = {
  basic: {
    label_ja: '基本ランキング 9 軸',
    lede_ja: '年収・就業者数・労働時間など出発点の 9 指標',
    slugs: [
      'ai-risk-high',
      'ai-risk-low',
      'salary-safe',
      'workers',
      'salary',
      'entry-salary',
      'young-workforce',
      'short-hours',
      'high-demand',
    ] as const,
  },
  single: {
    label_ja: '単軸で深く 5 軸',
    lede_ja: '時給・求人倍率・年齢など追加 5 指標',
    slugs: [
      'hourly-wage',
      'recruit-ratio',
      'aging-workforce',
      'monthly-hours-long',
      'recruit-ratio-low',
    ] as const,
  },
  ai: {
    label_ja: 'AI と職業 6 軸',
    lede_ja: 'AI 影響度を軸にした 6 つの切り口',
    slugs: [
      'ai-replaced-soon',
      'ai-resistant-craft',
      'ai-at-risk-but-paid',
      'ai-augmented',
      'ai-frontier',
      'ai-stable-employment',
    ] as const,
  },
  combo: {
    label_ja: '組合せで絞る 8 軸',
    lede_ja: '"AI 安全 × 高需要" など 2 軸交差で実用度を上げる',
    slugs: [
      'ai-safe-high-demand',
      'ai-safe-short-hours',
      'ai-safe-young-workforce',
      'ai-safe-no-license',
      'ai-safe-physical',
      'ai-safe-interpersonal',
      'high-salary-high-demand',
      'high-salary-young-entry',
    ] as const,
  },
  education: {
    label_ja: '教育・資格で 5 軸',
    lede_ja: '学歴・資格要件で絞り込む 5 つの視点',
    slugs: [
      'license-required',
      'no-license-required',
      'high-school-ok',
      'university-required',
      'graduate-school-required',
    ] as const,
  },
  niche: {
    label_ja: 'ニッチな視点 6 軸',
    lede_ja: 'フリーランス・独立・低ストレスなど少数派の道',
    slugs: [
      'public-sector',
      'freelance-friendly',
      'self-employed-typical',
      'large-workforce-stable',
      'regulated-protected',
      'low-stress-stable',
    ] as const,
  },
} as const;

export type RankingGroupKey = keyof typeof RANKING_GROUPS;

export interface RankingsBundle {
  results: Map<RankingSlug, RankingResult>;
  hub: {
    globalStats: ReadonlyArray<readonly [string, string]>;
    /**
     * Pre-rendered safe HTML fragments for the rankings-hub "insights"
     * block. Each string is built in this module via escapeHtml() over
     * sector names plus literal <strong> emphasis — i.e. the contract is
     * "fully trusted HTML; downstream MUST NOT re-escape and MUST NOT
     * concatenate with untrusted data". Callers in pages do `set:html`.
     */
    insights: string[];
    cards: RankingsHubCardData[];
    groups: RankingsHubGroup[];
  };
}
