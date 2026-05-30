/**
 * rankings-meta.ts — single source of truth for ranking slugs +
 * their display text. Pure-data module, ZERO fs / Node-runtime imports
 * — safe to import from both Astro frontmatter (Node SSG) AND Vercel
 * Edge Functions (api/og.tsx).
 *
 * Phase 2 expansion (2026-05-09):
 *   Phase 1 baseline = 9 rankings (ai-risk-{high,low}, salary-safe, workers,
 *   salary, entry-salary, young-workforce, short-hours, high-demand).
 *   Phase 2 adds +30 grouped into 5 themes:
 *     - 単軸 +5         (hourly-wage, recruit-ratio, aging-workforce,
 *                        monthly-hours-long, recruit-ratio-low)
 *     - AI 軸 +6        (ai-replaced-soon, ai-resistant-craft,
 *                        ai-at-risk-but-paid, ai-augmented, ai-frontier,
 *                        ai-stable-employment)
 *     - 組合せ +8        (ai-safe-{high-demand,short-hours,young-workforce,
 *                        no-license,physical,interpersonal} +
 *                        high-salary-high-demand + high-salary-young-entry)
 *     - 教育・資格 +5    (license-required, no-license-required,
 *                        high-school-ok, university-required,
 *                        graduate-school-required)
 *     - ニッチ +6         (public-sector, freelance-friendly,
 *                        self-employed-typical, large-workforce-stable,
 *                        regulated-protected, low-stress-stable)
 *
 * Adding a 40th ranking: edit ONLY this file (slug + meta), then add
 * sort/filter logic + FAQ in rankings.ts. The drift test in
 * rankings-meta.test.ts asserts both sides stay aligned.
 */

export type RankingSlug =
  // ── Phase 1 baseline (9) ──
  | 'ai-risk-high'
  | 'ai-risk-low'
  | 'salary-safe'
  | 'workers'
  | 'salary'
  | 'entry-salary'
  | 'young-workforce'
  | 'short-hours'
  | 'high-demand'
  // ── Phase 2 単軸 (5) ──
  | 'hourly-wage'
  | 'recruit-ratio'
  | 'aging-workforce'
  | 'monthly-hours-long'
  | 'recruit-ratio-low'
  // ── Phase 2 AI 軸派生 (6) ──
  | 'ai-replaced-soon'
  | 'ai-resistant-craft'
  | 'ai-at-risk-but-paid'
  | 'ai-augmented'
  | 'ai-frontier'
  | 'ai-stable-employment'
  // ── Phase 2 組合せ (8) ──
  | 'ai-safe-high-demand'
  | 'ai-safe-short-hours'
  | 'ai-safe-young-workforce'
  | 'ai-safe-no-license'
  | 'ai-safe-physical'
  | 'ai-safe-interpersonal'
  | 'high-salary-high-demand'
  | 'high-salary-young-entry'
  // ── Phase 2 教育・資格軸 (5) ──
  | 'license-required'
  | 'no-license-required'
  | 'high-school-ok'
  | 'university-required'
  | 'graduate-school-required'
  // ── Phase 2 ニッチ (6) ──
  | 'public-sector'
  | 'freelance-friendly'
  | 'self-employed-typical'
  | 'large-workforce-stable'
  | 'regulated-protected'
  | 'low-stress-stable';

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
  // ── Phase 1 baseline ──
  { slug: 'ai-risk-high',    name_ja: 'AIに奪われる仕事 TOP30',   description_ja: 'AI影響度が高い職業ランキング',     og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'ai-risk-low',     name_ja: 'AI影響が少ない仕事 TOP30', description_ja: 'AIリスクが低く将来性のある職業',   og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'salary-safe',     name_ja: '高年収×低AIリスク TOP30',  description_ja: '年収が高くAI代替リスクが低い職業', og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'workers',         name_ja: '就業者数ランキング TOP30', description_ja: '日本で最も就業者が多い職業',       og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'salary',          name_ja: '年収ランキング TOP30',     description_ja: '年収が最も高い職業',               og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'entry-salary',    name_ja: '初任給ランキング TOP30',   description_ja: '初任給が高い職業',                 og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'young-workforce', name_ja: '平均年齢が若い職業 TOP30', description_ja: '若手が活躍する職業',               og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'short-hours',     name_ja: '労働時間が短い職業 TOP30', description_ja: 'ワークライフバランスに優れた職業', og_eyebrow: 'RANKING · TOP 30' },
  { slug: 'high-demand',     name_ja: '人手不足の職業 TOP30',     description_ja: '求人需要が高い職業',               og_eyebrow: 'RANKING · TOP 30' },

  // ── Phase 2 単軸 (5) ──
  { slug: 'hourly-wage',         name_ja: '時給が高い職業 TOP30',         description_ja: '時給ベースで報酬が高い職業',           og_eyebrow: 'RANKING · 時給' },
  { slug: 'recruit-ratio',       name_ja: '求人倍率が高い職業 TOP30',     description_ja: '人手不足が顕著な売り手市場の職業',     og_eyebrow: 'RANKING · 求人倍率' },
  { slug: 'aging-workforce',     name_ja: 'シニア中心の職業 TOP30',       description_ja: '平均年齢が高く経験者が活躍する職業',   og_eyebrow: 'RANKING · シニア' },
  { slug: 'monthly-hours-long',  name_ja: '労働時間が長い職業 TOP30',     description_ja: '月間労働時間が長い職業',               og_eyebrow: 'RANKING · 長時間' },
  { slug: 'recruit-ratio-low',   name_ja: '求人倍率が低い職業 TOP30',     description_ja: '採用競争が厳しい買い手市場の職業',     og_eyebrow: 'RANKING · 買い手市場' },

  // ── Phase 2 AI 軸派生 (6) ──
  { slug: 'ai-replaced-soon',    name_ja: 'AI 置き換えが進む職業 TOP30',  description_ja: 'AI 影響度 8/10 以上、業務再設計が急務', og_eyebrow: 'RANKING · AI 影響 大' },
  { slug: 'ai-resistant-craft',  name_ja: '伝統技能で AI に強い職業 TOP30', description_ja: '製造・建設・メンテ系の手技中心職業',  og_eyebrow: 'RANKING · 技能職' },
  { slug: 'ai-at-risk-but-paid', name_ja: 'AI リスク高 × 高年収 TOP30',  description_ja: 'AI 影響度高だが現状年収も高い注意組',  og_eyebrow: 'RANKING · 要注意' },
  { slug: 'ai-augmented',        name_ja: 'AI で補強される職業 TOP30',    description_ja: 'AI 影響度 4-6、業務がAIで増強される',  og_eyebrow: 'RANKING · AI 補強域' },
  { slug: 'ai-frontier',         name_ja: 'AI を使いこなす側の職業 TOP21', description_ja: 'IT・通信セクターで AI 活用が業務の中心', og_eyebrow: 'RANKING · AI 使い手' },
  { slug: 'ai-stable-employment',name_ja: 'AI 安全 × 正規雇用率高 TOP30', description_ja: '低 AI 影響かつ安定雇用率が高い職業',   og_eyebrow: 'RANKING · 安定職' },

  // ── Phase 2 組合せ (8) ──
  { slug: 'ai-safe-high-demand',     name_ja: '高需要 × AI 安全 TOP30',       description_ja: '人手不足かつ AI 影響度が低い職業',   og_eyebrow: 'RANKING · AI 安全 × 需要' },
  { slug: 'ai-safe-short-hours',     name_ja: '低労働時間 × AI 安全 TOP30',  description_ja: '労働時間が短く AI 影響も低い職業',   og_eyebrow: 'RANKING · AI 安全 × 短時間' },
  { slug: 'ai-safe-young-workforce', name_ja: '若手中心 × AI 安全 TOP30',     description_ja: '平均年齢が若くて AI 影響も低い職業', og_eyebrow: 'RANKING · AI 安全 × 若手' },
  { slug: 'ai-safe-no-license',      name_ja: '無資格 × AI 安全 TOP30',       description_ja: '資格なしで就けて AI 影響も低い職業', og_eyebrow: 'RANKING · AI 安全 × 無資格' },
  { slug: 'ai-safe-physical',        name_ja: '身体性 × AI 安全 TOP30',       description_ja: '身体技能職で AI 影響も低い職業',     og_eyebrow: 'RANKING · AI 安全 × 身体性' },
  { slug: 'ai-safe-interpersonal',   name_ja: '対人 × AI 安全 TOP30',         description_ja: '対人スキル中心で AI 影響も低い職業', og_eyebrow: 'RANKING · AI 安全 × 対人' },
  { slug: 'high-salary-high-demand', name_ja: '高年収 × 高需要 TOP30',        description_ja: '年収が高くかつ人手不足の職業',       og_eyebrow: 'RANKING · 高年収 × 需要' },
  { slug: 'high-salary-young-entry', name_ja: '初任給が高い × 若手活躍 TOP30', description_ja: '初任給が高くて若手が多い職業',       og_eyebrow: 'RANKING · 高初任給' },

  // ── Phase 2 教育・資格軸 (5) ──
  { slug: 'license-required',         name_ja: '国家資格が必要な職業 TOP30',   description_ja: '関連資格が多く参入のかべが明確な職業', og_eyebrow: 'RANKING · 資格職' },
  { slug: 'no-license-required',      name_ja: '無資格で就ける × AI 安全な職業 TOP30', description_ja: '資格不要かつ AI リスクも低い職業',  og_eyebrow: 'RANKING · 無資格' },
  { slug: 'high-school-ok',           name_ja: '高卒で目指せる職業 TOP30',     description_ja: '高卒比率が高く学歴ハードルが低い職業', og_eyebrow: 'RANKING · 高卒可' },
  { slug: 'university-required',      name_ja: '大卒以上が中心の職業 TOP30',   description_ja: '大卒比率が高く学位が前提となる職業',   og_eyebrow: 'RANKING · 大卒中心' },
  { slug: 'graduate-school-required', name_ja: '大学院卒中心の職業 TOP30',     description_ja: '修士・博士課程修了者が多い専門職',     og_eyebrow: 'RANKING · 大学院卒' },

  // ── Phase 2 ニッチ (6) ──
  { slug: 'public-sector',          name_ja: '公的機関・公務員系の職業 TOP15',     description_ja: '保安・公務系セクターの職業',           og_eyebrow: 'RANKING · 公務' },
  { slug: 'freelance-friendly',     name_ja: 'フリーランス向きの職業 TOP30',      description_ja: 'フリーランス・自営の比率が高い職業',   og_eyebrow: 'RANKING · フリーランス' },
  { slug: 'self-employed-typical',  name_ja: '独立・開業が典型の職業 TOP30',      description_ja: '自営業比率が高く独立が典型キャリア',   og_eyebrow: 'RANKING · 独立' },
  { slug: 'large-workforce-stable', name_ja: '大規模就業 × AI 安全 TOP30',         description_ja: '就業者数が多くかつ AI 影響も低い職業', og_eyebrow: 'RANKING · 大規模 × 安全' },
  { slug: 'regulated-protected',    name_ja: '規制で守られた職業 TOP30',          description_ja: '関連資格が多くかつ AI 影響も低い職業', og_eyebrow: 'RANKING · 規制保護' },
  { slug: 'low-stress-stable',      name_ja: '低ストレス安定職 TOP30',            description_ja: '短い労働時間かつ AI 影響も低い職業',   og_eyebrow: 'RANKING · 低ストレス' },
];
