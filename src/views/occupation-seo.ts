/**
 * src/views/occupation-seo.ts — derive SEO + OG meta strings for
 * the 556 /ja/[id] occupation detail pages.
 *
 * Extracted from src/pages/ja/[id].astro. The page used to inline
 * the title / description / og:* / keywords / one-line-callout
 * derivation; consolidating it here keeps the formula in one
 * tested place and out of the page frontmatter.
 *
 * Title format:
 *   `${nameJa}の将来性・年収・AI影響度【${riskStr}】｜未来の仕事`
 *
 * Description format (mirrors the legacy code's three-clause
 * structure: risk tier + optional data parts + always-on tail):
 *   `${nameJa}の${riskTierDesc}。${dataParts}。将来性やなり方、…`
 *
 * OG title/description are the same as title/description but
 * capped at 120 / 300 chars respectively (legacy parity).
 *
 * Keywords: [nameJa, …aliasesJa.slice(0, 8)].join(', ').
 */

/** Narrow input — only the Rec fields the SEO derivation reads. */
export interface OccupationSeoInput {
  readonly nameJa: string;
  /** 0-10 AI risk score; null/missing → "AI影響度を分析" generic copy. */
  readonly aiRisk: number | null;
  /** Annual salary in 万円. Falsy → omitted from description's data clause. */
  readonly salaryMan: number | null | undefined;
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
  const { nameJa, aiRisk, salaryMan, workers, aliasesJa } = input;
  const riskStr = aiRisk !== null ? `${aiRisk}/10` : '—';

  const title = `${nameJa}の将来性・年収・AI影響度【${riskStr}】｜未来の仕事`;

  const riskTierDesc =
    aiRisk !== null
      ? `AI代替リスクは10段階中${aiRisk}と${
          aiRisk <= RISK_LOW_CEILING ? '低め' : aiRisk <= RISK_MID_CEILING ? '中程度' : '高め'
        }`
      : 'AI影響度を分析';

  const salaryShort = salaryMan ? `年収${Math.trunc(salaryMan)}万円` : '';
  const workersShort = workers ? `就業者${fmtIntCommas(workers)}人` : '';
  const dataParts = [salaryShort, workersShort].filter(Boolean).join('・');

  const description = dataParts
    ? `${nameJa}の${riskTierDesc}。${dataParts}。${NATIONAL_AVG_TAIL}`
    : `${nameJa}の${riskTierDesc}。${NATIONAL_AVG_TAIL}`;

  const ogTitle = title.slice(0, OG_TITLE_MAX);
  const ogDescription = description.slice(0, OG_DESCRIPTION_MAX);

  const keywordTerms = [nameJa, ...aliasesJa.slice(0, KEYWORDS_ALIAS_MAX)].filter(Boolean);
  const keywords = keywordTerms.join(', ');

  return { title, description, ogTitle, ogDescription, keywords };
}
