/**
 * src/lib/ai-fact-summary.ts — the "citable fact block".
 *
 * A number-dense, self-contained, attributed one-paragraph summary rendered
 * near the top of each occupation detail page. Designed so AI answer engines
 * and voice search can lift it verbatim *with attribution* — see
 * docs/SEO_GEO_STRATEGY.md §3 Phase 1 ("be the cited number, not the answer").
 *
 * It replaces the role of the generic five-band `.one-line` callout (which
 * only knew the risk score, so every page read the same boilerplate) with a
 * fact paragraph specific to THIS occupation: score + rank + vs-mean + the
 * dominant AIOIS-10 dimension + the 補助/代替 framing + hard stats + source.
 *
 * Pure data → Japanese string. The Japanese is formulaic (assembled from
 * numbers), not editorial prose — consistent with the site's other generated
 * copy (display strings, auto-FAQ, highlights). The phrasing is part of the
 * SEO copy contract and is pinned by tests + the SEO baseline diff.
 */
import type { Aiois10 } from '../graph/types.js';

/**
 * Workforce count → compact Japanese (約N万人). Integer 万 at ≥10万, one
 * decimal in the 1万–10万 range; below 1万 falls back to 千 (約N千人) because
 * "約0.3万人" reads awkwardly. e.g. 692,975 → 約69万人; 48,720 → 約4.9万人;
 * 2,950 → 約3千人.
 */
function fmtWorkersMan(workers: number): string {
  if (workers >= 100000) return `約${Math.round(workers / 10000)}万人`;
  if (workers >= 10000) return `約${Math.round(workers / 1000) / 10}万人`;
  return `約${Math.round(workers / 100) / 10}千人`;
}

/** Japanese labels for the AIOIS-10 dimensions, mirroring the on-page
 *  Aiois10Profile.ts wording but trimmed for sentence use. */
const DIM_LABEL: Record<string, string> = {
  d1: '頭脳・情報の業務',
  d2: '定型的な手順のくり返し',
  d3: '体・現場での実務',
  d4: '判断と責任',
  d5: '人とのやりとり・情緒',
  d6: '新しいものを生み出す力',
  d7: '資格・安全の壁',
  d8: '自動化のコスト',
  d9: '人手不足・制度',
  d10: '今後の需要',
};

/** ■ Moat dimensions — high score = protected by a human advantage. */
const MOAT_KEYS = ['d3', 'd4', 'd5', 'd6', 'd7'] as const;
/** ▲ Driver dimensions — high score = more exposed to AI. */
const DRIVER_KEYS = ['d1', 'd2', 'd10'] as const;

function topDim(aiois: Aiois10, keys: readonly string[]): string {
  let bestKey = keys[0];
  let bestVal = -1;
  for (const k of keys) {
    const v = aiois[k as keyof Aiois10] as number;
    if (typeof v === 'number' && v > bestVal) {
      bestVal = v;
      bestKey = k;
    }
  }
  return bestKey;
}

export interface AiFactInput {
  readonly nameJa: string;
  readonly aiRisk: number | null;
  /** 1-based rank by AI impact (1 = most impacted); null when unranked. */
  readonly rank: number | null;
  /** Total ranked occupations (the denominator). */
  readonly total: number;
  /** Site-wide mean AI impact, e.g. 4.24. */
  readonly meanRisk: number;
  readonly aiois: Aiois10 | null;
  readonly salaryMan: number | null;
  readonly workers: number | null;
  /** Human-readable score date, e.g. "2026年5月". */
  readonly scoredDate: string;
}

/**
 * Build the citable fact paragraph. Returns '' when the occupation is
 * unscored (the block then self-omits). Output is plain text — callers
 * escape it before inserting into HTML.
 */
export function buildAiFactSummary(input: AiFactInput): string {
  const { nameJa, aiRisk, rank, total, meanRisk, aiois, salaryMan, workers, scoredDate } = input;
  if (aiRisk === null) return '';

  const parts: string[] = [];

  // 1. Headline number + rank + vs mean.
  let lead = `${nameJa}のAI影響度は${aiRisk}/10。`;
  if (rank !== null && total > 0) {
    const vsMean =
      aiRisk >= meanRisk
        ? `全体平均（${meanRisk.toFixed(2)}）を上回る`
        : `全体平均（${meanRisk.toFixed(2)}）を下回る`;
    lead += `全${total}職業を影響度の高い順に並べると${rank}位で、${vsMean}水準です。`;
  }
  parts.push(lead);

  // 2. Narrative from displacement risk + the dominant dimension.
  if (aiois) {
    const disp = aiois.displacement;
    const moatLabel = DIM_LABEL[topDim(aiois, MOAT_KEYS)];
    const driverLabel = DIM_LABEL[topDim(aiois, DRIVER_KEYS)];
    let narrative: string;
    if (disp < 4.0) {
      narrative =
        `${moatLabel}など人間の強みが守りとなり、AIは業務の一部を補助するものの、職そのものが大きく減るリスクは低めです（仕事が減るリスク ${disp.toFixed(1)}/10）。`;
    } else if (disp < 7.0) {
      narrative =
        `AIによる業務の置き換えが部分的に進む一方、${moatLabel}は人間に残りやすく、業務の再設計しだいで対応の余地があります（仕事が減るリスク ${disp.toFixed(1)}/10）。`;
    } else {
      narrative =
        `${driverLabel}の比重が高く自動化の余地が大きいため、職そのものが縮小するリスクも相対的に高めです（仕事が減るリスク ${disp.toFixed(1)}/10）。`;
    }
    parts.push(narrative);
  }

  // 3. Hard stats.
  const stats: string[] = [];
  if (salaryMan !== null) stats.push(`年収中央値は約${Math.trunc(salaryMan)}万円`);
  if (workers !== null) stats.push(`就業者は${fmtWorkersMan(workers)}`);
  if (stats.length > 0) parts.push(stats.join('、') + '。');

  // 4. Source + date (the attribution that makes the block citable).
  parts.push(`（出典：厚生労働省 jobtag ＋ AIOIS-10、Claude Opus 4.8、${scoredDate}）`);

  return parts.join('');
}
