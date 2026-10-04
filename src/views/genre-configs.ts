/**
 * src/views/genre-configs.ts — 9 ジャンル × 計 60 個のデータ駆動 hub の設定。
 *
 * 内訳: abilities 10 + knowledge 10 + values 8 + education 6 + training 5
 *      + work-styles 7 + employment-types 4 + life-balance 6 + entry-paths 5
 *
 * 各 genre は genre-hub.ts の buildGenreResult() で TOP 30 を計算する。
 * Pure-data モジュール、fs imports なし — Astro frontmatter と Edge Function
 * 両方からインポート可能。
 *
 * Migrated from src/data/lib/genre-configs.ts 2026-05-14 (Phase B, file #18 of 18).
 * Per docs/architecture.md §6.2, the 60 hub-config objects feed view-layer
 * URL emission (sitemap), graph traversal (spoke-hub-graph / hub-hub-graph),
 * and 9 × (index + [slug]) page families = 21 Astro pages. Every consumer is
 * an HTML / sitemap surface, so the canonical home is src/views/. The type
 * import `GenreHubConfig` / `DetailFileMin` still points at
 * src/views/genre-hub.ts (cross-dir bridge); genre-hub itself stays in
 * data/lib for Phase B because it owns the buildGenreBundle compute and is
 * tested there. A future Phase C pass can colocate the type with the data
 * or split genre-hub into a graph-layer ranker + a views-layer renderer.
 */
import { ABILITIES_CONFIGS } from './genre-configs/abilities.js';
import { KNOWLEDGE_CONFIGS } from './genre-configs/knowledge.js';
import { VALUES_CONFIGS } from './genre-configs/values.js';
import { EDUCATION_CONFIGS } from './genre-configs/education.js';
import { TRAINING_CONFIGS } from './genre-configs/training.js';
import { WORK_STYLES_CONFIGS } from './genre-configs/work-styles.js';
import { EMPLOYMENT_CONFIGS } from './genre-configs/employment.js';
import { LIFE_BALANCE_CONFIGS } from './genre-configs/life-balance.js';
import { ENTRY_PATHS_CONFIGS } from './genre-configs/entry-paths.js';

export { ABILITIES_CONFIGS, KNOWLEDGE_CONFIGS, VALUES_CONFIGS, EDUCATION_CONFIGS, TRAINING_CONFIGS, WORK_STYLES_CONFIGS, EMPLOYMENT_CONFIGS, LIFE_BALANCE_CONFIGS, ENTRY_PATHS_CONFIGS };

// ─── Genre catalogues (for index pages + cross-genre navigation) ──

export interface GenreCatalogue {
  path: string;
  label_ja: string;
  description_ja: string;
  configs: ReadonlyArray<GenreHubConfig>;
}

export const GENRE_CATALOGUES: ReadonlyArray<GenreCatalogue> = [
  { path: 'abilities', label_ja: '能力から探す', description_ja: 'IPD 52 能力軸から、各能力が核となる職業 TOP 30 を一覧。', configs: ABILITIES_CONFIGS },
  { path: 'knowledge', label_ja: '知識から探す', description_ja: 'IPD 33 知識領域から、各知識を活かす職業 TOP 30 を一覧。', configs: KNOWLEDGE_CONFIGS },
  { path: 'values', label_ja: '価値観から探す', description_ja: 'IPD 12 価値観軸から、各価値観に合う職業 TOP 30 を一覧。', configs: VALUES_CONFIGS },
  { path: 'education', label_ja: '学歴から探す', description_ja: '学歴別の職業群を 6 段階に分類して一覧。', configs: EDUCATION_CONFIGS },
  { path: 'training', label_ja: '習熟期間から探す', description_ja: '入職後の習熟期間別に職業を 5 段階で分類。', configs: TRAINING_CONFIGS },
  { path: 'work-styles', label_ja: '働き方から探す', description_ja: '屋内/屋外・移動・シフト等の働き方別に職業を分類。', configs: WORK_STYLES_CONFIGS },
  { path: 'employment-types', label_ja: '雇用形態から探す', description_ja: '正社員・フリーランス・パート・公務員の雇用形態別。', configs: EMPLOYMENT_CONFIGS },
  { path: 'life-balance', label_ja: 'ライフバランスから探す', description_ja: '育児・介護・健康・趣味との両立に向く職業群。', configs: LIFE_BALANCE_CONFIGS },
  { path: 'entry-paths', label_ja: '入職経路から探す', description_ja: '新卒・中途・バイト出身・独立型の入職経路別に分類。', configs: ENTRY_PATHS_CONFIGS },
];

export function getGenreByPath(path: string): GenreCatalogue | null {
  return GENRE_CATALOGUES.find((g) => g.path === path) ?? null;
}
