/**
 * src/views/sector-faqs.ts — build the Q/A tuples used to power
 * the FAQPage Schema.org node on the /ja/sectors/[sector] hub.
 *
 * Sister of src/views/occupation-faqs (per-occupation FAQ
 * builder for /ja/[id]). Pure data shaping — produces
 * `readonly [question, answer]` tuples with no HTML.
 *
 * Up to five questions emit, each gated on the corresponding
 * sector statistics being present:
 *
 *   1. {sector}業界にはどんな職業がありますか？       — always
 *   2. {sector}業界で AI 影響度が最も高い職業は？     — needs topHigh
 *   3. {sector}業界で AI 影響度が最も低い職業は？     — needs topLow
 *   4. {sector}業界の平均 AI 影響度は？               — needs meanRisk
 *   5. {sector}業界の将来性は？                       — needs both
 */

import { fmtInt } from '../lib/num.js';

/** One ranked occupation summary as the FAQ builder consumes it.
 *  A subset of the page's SectorOccupationSummary shape. */
export interface SectorOccupationLite {
  /** Empty / null entries are filtered out by the FAQ builder. */
  readonly titleJa: string | null;
  readonly aiRisk: number | null;
}

/** Narrow input — only the sector-stats fields the FAQ builder
 *  reads. The caller's adapter does sector data prep upstream. */
export interface SectorFaqsInput {
  readonly nameJa: string;
  /** Number of occupations in this sector. */
  readonly occupationCount: number;
  /** Sum of workers across the sector's occupations. */
  readonly workforceTotal: number;
  /** Mean AI risk (0-10) across the sector. null → Q4 + Q5 skip. */
  readonly meanRisk: number | null;
  /** Top-N by workforce, used for the "what kinds of jobs"
   *  representative list in Q1. */
  readonly topWorkers: ReadonlyArray<SectorOccupationLite>;
  /** Top-N by AI risk descending. Empty → Q2 skipped. */
  readonly topHigh: ReadonlyArray<SectorOccupationLite>;
  /** Top-N by AI risk ascending. Empty → Q3 + Q5 skipped. */
  readonly topLow: ReadonlyArray<SectorOccupationLite>;
}

export type SectorFaqItem = readonly [question: string, answer: string];

const MEAN_RISK_LOW_CEIL = 4.0;
const MEAN_RISK_HIGH_FLOOR = 6.0;
// Sector-mean-risk → Japanese tier label. The cutoffs (3.5 / 5.5 / 7.0)
// are intentionally distinct from per-occupation riskCallout thresholds
// because a sector mean is smoothed over many occupations.
function meanRiskTierLabel(mean: number): string {
  if (mean <= 3.5) return '低め';
  if (mean <= 5.5) return '中程度';
  if (mean <= 7.0) return 'やや高め';
  return '高め';
}

export function buildSectorFaqs(input: SectorFaqsInput): readonly SectorFaqItem[] {
  const { nameJa, occupationCount, workforceTotal, meanRisk, topWorkers, topHigh, topLow } =
    input;
  const faqs: SectorFaqItem[] = [];

  // Q1: occupations in sector (always).
  const sampleWorkers = topWorkers.slice(0, 3).filter((o) => o.titleJa);
  const sampleStr = sampleWorkers.length
    ? sampleWorkers.map((o) => o.titleJa).join('、')
    : '—';
  faqs.push([
    `${nameJa}業界にはどんな職業がありますか？`,
    `${nameJa}業界は${occupationCount}の職業に分類されており、代表的な職業は${sampleStr}などです。` +
      `就業者数の合計は約${fmtInt(workforceTotal)}人にのぼります。`,
  ]);

  // Q2: highest AI impact (needs topHigh).
  if (topHigh.length) {
    const top3 = topHigh.slice(0, 3);
    const itemsStr = top3
      .filter((o) => o.titleJa && o.aiRisk !== null)
      .map((o) => `${o.titleJa}（AI影響 ${o.aiRisk}/10）`)
      .join('、');
    faqs.push([
      `${nameJa}業界で AI 影響度が最も高い職業は？`,
      `AI影響度が高い順に、${itemsStr} です。` +
        `これらは AI による業務代替・補助の可能性が比較的高い傾向にあります。`,
    ]);
  }

  // Q3: lowest AI impact (needs topLow).
  if (topLow.length) {
    const top3 = topLow.slice(0, 3);
    const itemsStr = top3
      .filter((o) => o.titleJa && o.aiRisk !== null)
      .map((o) => `${o.titleJa}（AI影響 ${o.aiRisk}/10）`)
      .join('、');
    faqs.push([
      `${nameJa}業界で AI 影響度が最も低い職業は？`,
      `AI影響度が低い順に、${itemsStr} です。` +
        `身体性・対人スキル・現場判断が必要なため、AI による代替が難しい職業です。`,
    ]);
  }

  // Q4: average AI impact + tier interpretation.
  if (meanRisk !== null) {
    const tier = meanRiskTierLabel(meanRisk);
    faqs.push([
      `${nameJa}業界の平均 AI 影響度は？`,
      `${nameJa}業界の${occupationCount}職業の平均 AI 影響度は10段階中 ${meanRisk.toFixed(1)} で、${tier}の水準です。` +
        `これは Claude Opus 4.8 による独自分析（非公式）の値で、職業ごとのバラつきがあります。`,
    ]);
  }

  // Q5: future outlook (needs meanRisk + topLow).
  if (meanRisk !== null && topLow.length) {
    const safeJobsStr = topLow
      .slice(0, 3)
      .filter((o) => o.titleJa)
      .map((o) => o.titleJa)
      .join('、');
    let outlook: string;
    if (meanRisk <= MEAN_RISK_LOW_CEIL) {
      outlook = 'AIに代替されにくい職業が多く、将来性が比較的高い';
    } else if (meanRisk >= MEAN_RISK_HIGH_FLOOR) {
      outlook = '業界全体で AI による業務変化が見込まれ、職業選択時には個別の代替リスクの確認が重要';
    } else {
      outlook = '職業によって AI 影響度に差があり、個別に検討が必要';
    }
    faqs.push([
      `${nameJa}業界の将来性は？`,
      `平均 AI 影響度 ${meanRisk.toFixed(1)}/10 で、${outlook}な業界です。` +
        `特に AI リスクが低い職業として ${safeJobsStr} などが挙げられます。`,
    ]);
  }

  return faqs;
}
