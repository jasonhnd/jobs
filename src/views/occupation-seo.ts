/**
 * src/views/occupation-seo.ts — derive SEO + OG meta strings for
 * the 556 /[id] occupation detail pages.
 *
 * Extracted from src/pages/[id].astro. The page used to inline
 * the title / description / og:* / keywords / one-line-callout
 * derivation; consolidating it here keeps the formula in one
 * tested place and out of the page frontmatter.
 *
 * Title format:
 *   with salary:  `${nameJa}の年収は${universe}職業中上位${pct}%｜AI影響${riskStr}`
 *   no salary:    `${nameJa}のAI影響${riskStr}｜未来の仕事`
 *   unscored AI:  `未評価` instead of `{n}/10`
 *
 * Why the percentile and not the yen figure (2026-09-21, supersedes #276):
 * #276 put the yen figure in the title on 2026-08-24 on the hypothesis that
 * 年収 queries impressed but did not convert because the title showed no
 * number. It was never measured afterwards. Measured now against the two
 * page families the change did not touch:
 *
 *   occupation /<id>   CTR 0.96% → 0.83%  (-14%), position 8.7 → 8.3
 *   /rankings/*        CTR 4.86% → 5.05%  (+4%)   ← untouched control
 *   everything else    CTR 2.44% → 2.71%  (+11%)  ← untouched control
 *
 * Both controls rose over the same window; the only family that fell is the
 * one that got the yen figure, and it fell while its ranking improved. The
 * figure answers the query in the SERP, so there is nothing left to click
 * for. The 年収 token itself is kept — adding it is what moved position
 * 8.7 → 8.3 — and only the ANSWER is withheld.
 *
 * `universe` comes from salaryStanding() and is 544, not 556: jobtag
 * publishes no salary for 12 statutory-pay / self-employed occupations. Do
 * not substitute OCCUPATION_COUNT.SCORED here.
 *
 * Description: salary standing (jobtag) → workers → AI-impact tier →
 * "degree of work change, not unemployment probability" when scored →
 * the 将来性 tail. Do not say AI代替リスク in the meta description.
 *
 * OG title/description are the same as title/description but
 * capped at 120 / 300 chars respectively.
 *
 * Keywords: [nameJa, …aliasesJa.slice(0, 8)].join(', ').
 */

import { displayScore } from '../data/lib/banker-round.js';

/** Narrow input — only the Rec fields the SEO derivation reads. */
export interface OccupationSeoInput {
  readonly nameJa: string;
  /** 0-10 AI risk score; null/missing → "AI影響度を分析" generic copy. */
  readonly aiRisk: number | null;
  /**
   * Position in the salary distribution, from salaryStanding(). null when
   * jobtag publishes no salary for this occupation — the title then drops
   * the 年収 clause entirely rather than inventing a standing.
   */
  readonly salaryStanding: { readonly topPercent: number; readonly universe: number } | null;
  /** Workforce count in persons. Falsy → omitted. */
  readonly workers: number | null | undefined;
  /** Up to 8 aliases ride into the keywords meta. */
  readonly aliasesJa: readonly string[];
}

/** Bundle of SEO + OG strings for one occupation detail page. */
export interface OccupationSeoOutput {
  readonly title: string;
  readonly description: string;
  readonly ogTitle: string;
  readonly ogDescription: string;
  readonly keywords: string;
}

const OG_TITLE_MAX = 120;
const OG_DESCRIPTION_MAX = 300;
const KEYWORDS_ALIAS_MAX = 8;
const RISK_LOW_CEILING = 3;
const RISK_MID_CEILING = 6;
const NATIONAL_AVG_TAIL = '将来性やなり方、必要なスキルを詳しく解説。';

/** Locale-aware comma rendering for the workers count in the
 *  description's data clause. Inlined to avoid pulling fmtInt into
 *  view layer (which currently doesn't depend on src/lib). */
function fmtIntCommas(n: number): string {
  return Math.trunc(n).toLocaleString('en-US');
}

export function buildOccupationSeo(input: OccupationSeoInput): OccupationSeoOutput {
  const { nameJa, aiRisk, salaryStanding, workers, aliasesJa } = input;
  // SEO fix 2026-05-17 (H1): when aiRisk is null (the 4 new IPD
  // occupations 581-584 not yet scored), render the readable
  // '未評価' instead of an em dash that looked like missing data in
  // Google SERPs.
  const shown = aiRisk !== null ? displayScore(aiRisk) : null;
  const riskStr = shown !== null ? `${shown}/10` : '未評価';

  const title = salaryStanding
    ? `${nameJa}の年収は${salaryStanding.universe}職業中上位${salaryStanding.topPercent}%｜AI影響${riskStr}`
    : `${nameJa}のAI影響${riskStr}｜未来の仕事`;

  const clauses: string[] = [];
  if (salaryStanding) {
    clauses.push(
      `${nameJa}の年収は${salaryStanding.universe}職業中で上位${salaryStanding.topPercent}%（厚生労働省 jobtag 2026年版）。`,
    );
  }
  if (workers) {
    clauses.push(`就業者は${fmtIntCommas(workers)}人。`);
  }
  if (aiRisk !== null && shown !== null) {
    const tier =
      aiRisk <= RISK_LOW_CEILING ? '低め' : aiRisk <= RISK_MID_CEILING ? '中程度' : '高め';
    clauses.push(`${nameJa}のAI影響度は10段階中${shown}と${tier}です。`);
    clauses.push('仕事の中身がAIで変わる度合いであり、失業の確率ではありません。');
  } else {
    clauses.push(`${nameJa}のAI影響度を分析。`);
  }
  clauses.push(NATIONAL_AVG_TAIL);

  const description = clauses.join('');

  const ogTitle = title.slice(0, OG_TITLE_MAX);
  const ogDescription = description.slice(0, OG_DESCRIPTION_MAX);

  const keywordTerms = [nameJa, ...aliasesJa.slice(0, KEYWORDS_ALIAS_MAX)].filter(Boolean);
  const keywords = keywordTerms.join(', ');

  return { title, description, ogTitle, ogDescription, keywords };
}
