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
    cards: Array<{ slug: RankingSlug; name: string; desc: string; count: number; preview: string }>;
  };
}
