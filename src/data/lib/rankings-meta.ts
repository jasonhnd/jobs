/**
 * rankings-meta.ts — single source of truth for the 9 ranking slugs +
 * their display text. Pure-data module, ZERO fs / Node-runtime imports
 * — safe to import from both Astro frontmatter (Node SSG) AND Vercel
 * Edge Functions (api/og.tsx).
 *
 * Rationale:
 *   src/data/lib/rankings.ts can't be imported from api/og.tsx because
 *   it calls readFileSync at module-load time, which crashes the Edge
 *   runtime. Before this refactor, the 9 slug strings were duplicated
 *   between rankings.ts (ALL_RANKINGS array) and og.tsx (RANKING_CARDS
 *   record). Adding a new ranking required updating BOTH and forgetting
 *   one returned `400 unknown ?ranking=…` for that page's OG card.
 *
 *   This module is now the only place to add a ranking. rankings.ts
 *   derives ALL_RANKINGS from it; api/og.tsx derives RANKING_CARDS from
 *   it; rankings-meta.test.ts asserts both consumers stay in sync.
 *
 * To add a 10th ranking, edit ONLY this file:
 *   1. Add the new slug to RankingSlug union below.
 *   2. Add a new RankingMeta object to RANKING_META.
 *   3. Update FAQS / sort rules in rankings.ts (those still need
 *      per-slug logic — this module only carries the metadata).
 */

export type RankingSlug =
  | 'ai-risk-high'
  | 'ai-risk-low'
  | 'salary-safe'
  | 'workers'
  | 'salary'
  | 'entry-salary'
  | 'young-workforce'
  | 'short-hours'
  | 'high-demand';

export interface RankingMeta {
  slug: RankingSlug;
  /** JA title — used as ranking page <h1>, OG card title, sitemap label. */
  name_ja: string;
  /** JA description — used for SEO meta description + OG card subtitle. */
  description_ja: string;
  /** OG card eyebrow (small caps line above the title). */
  og_eyebrow: string;
}

export const RANKING_META: ReadonlyArray<RankingMeta> = [
  { slug: 'ai-risk-high',    name_ja: 'AIに奪われる仕事 TOP30',   description_ja: 'AI影響度が高い職業ランキング',     og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'ai-risk-low',     name_ja: 'AI影響が少ない仕事 TOP30', description_ja: 'AIリスクが低く将来性のある職業',   og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'salary-safe',     name_ja: '高年収×低AIリスク TOP30',  description_ja: '年収が高くAI代替リスクが低い職業', og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'workers',         name_ja: '就業者数ランキング TOP30', description_ja: '日本で最も就業者が多い職業',       og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'salary',          name_ja: '年収ランキング TOP30',     description_ja: '年収が最も高い職業',               og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'entry-salary',    name_ja: '初任給ランキング TOP30',   description_ja: '初任給が高い職業',                 og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'young-workforce', name_ja: '平均年齢が若い職業 TOP30', description_ja: '若手が活躍する職業',               og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'short-hours',     name_ja: '労働時間が短い職業 TOP30', description_ja: 'ワークライフバランスに優れた職業', og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'high-demand',     name_ja: '人手不足の職業 TOP30',     description_ja: '求人需要が高い職業',               og_eyebrow: 'RANKING · TOP 30' },
];
