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
import { SCORE_PANEL } from '../site/score-attribution.js';
import { formatConsensusCitation } from '../site/consensus-copy.js';
import {
  summarizeGeoOccupationIds,
  type GeoFacts,
  type GeoOccupationGroupSummary,
} from '../site/geo-facts.js';
import { escapeHtml, unsafeReviewedHtml, type SafeHtml } from './safe-html.js';

/**
 * Workforce count → compact Japanese (約N万人). Integer 万 at ≥10万, one
 * decimal in the 1万–10万 range; below 1万 uses whole 千 rounded to the nearest
 * thousand (約N千人) — "約0.3万人" reads awkwardly. e.g. 692,975 → 約69万人;
 * 48,720 → 約4.9万人; 8,200 → 約8千人; 2,950 → 約3千人.
 */
function fmtWorkersMan(workers: number): string {
  if (workers >= 100000) return `約${Math.round(workers / 10000)}万人`;
  if (workers >= 10000) return `約${Math.round(workers / 1000) / 10}万人`;
  return `約${Math.round(workers / 1000)}千人`;
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
  /** @deprecated Unused; citation now uses SCORE_PANEL. Kept optional for callers. */
  readonly scoredDate?: string;
}

/**
 * Build the citable fact paragraph. Returns '' when the occupation is
 * unscored (the block then self-omits). Output is plain text — callers
 * escape it before inserting into HTML.
 */
export function buildAiFactSummary(input: AiFactInput): string {
  const { nameJa, aiRisk, rank, total, meanRisk, aiois, salaryMan, workers } = input;
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
  parts.push(formatConsensusCitation(SCORE_PANEL.voteCount, SCORE_PANEL.latestRunDate));

  return parts.join('');
}

export interface SectorGeoFactInput {
  readonly facts: GeoFacts;
  readonly sectorId: string;
}

export interface OccupationSetGeoFactInput {
  readonly facts: GeoFacts;
  readonly subjectJa: string;
  readonly pageKindJa: string;
  readonly occupationIds: readonly number[];
}

export interface CompareGeoFactInput {
  readonly facts: GeoFacts;
  readonly subjectJa: string;
  readonly occupationIds: readonly [number, number];
}

export interface OccupationGeoFactInput {
  readonly facts: GeoFacts;
  readonly occupationId: number;
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('ja-JP').format(Math.round(n));
}

function fmtScore(n: number): string {
  return n.toFixed(1);
}

function fmtScore2(n: number): string {
  return n.toFixed(2);
}

function fmtSalaryMan(n: number): string {
  return `${Math.trunc(n)}万円`;
}

function geoSource(): string {
  return formatConsensusCitation(SCORE_PANEL.voteCount, SCORE_PANEL.latestRunDate);
}

function requireGroupOccupation(
  summary: GeoOccupationGroupSummary,
  key: 'firstOccupation' | 'highestImpactOccupation' | 'lowestImpactOccupation',
): NonNullable<GeoOccupationGroupSummary[typeof key]> {
  const occupation = summary[key];
  if (!occupation) throw new Error(`ai-fact-summary: missing ${key}`);
  return occupation;
}

export function buildOccupationGeoFactSummary(input: OccupationGeoFactInput): string {
  const { facts, occupationId } = input;
  const occupation = facts.occupations.find((candidate) => candidate.id === occupationId);
  if (!occupation) return '';

  const relative = occupation.aiImpact >= facts.meanAiImpact ? '上回る' : '下回る';
  const parts: string[] = [
    `${occupation.nameJa}の引用用ファクト：GEO-Aの全${facts.occupationCount}職業データでは、` +
      `${occupation.nameJa}のAI影響度は${fmtScore(occupation.aiImpact)}/10です。` +
      `AI影響度の高い順では${occupation.aiImpactRank}/${facts.occupationCount}位で、` +
      `全体平均${fmtScore2(facts.meanAiImpact)}/10を${relative}水準です。`,
  ];

  if (occupation.displacementRisk !== null) {
    const displacement =
      occupation.displacementRisk < 4
        ? '職そのものが大きく減るリスクは低め'
        : occupation.displacementRisk < 7
          ? '業務の再設計が進みやすい中程度のリスク'
          : '職そのものが縮小するリスクも相対的に高め';
    parts.push(`AIOIS-10の仕事が減るリスクは${fmtScore(occupation.displacementRisk)}/10で、${displacement}です。`);
  }

  const stats: string[] = [];
  if (occupation.salaryMan !== null) stats.push(`年収中央値は約${fmtSalaryMan(occupation.salaryMan)}`);
  if (occupation.workers !== null) stats.push(`就業者は${fmtWorkersMan(occupation.workers)}`);
  if (stats.length) parts.push(`${stats.join('、')}。`);
  parts.push(geoSource());

  return parts.join('');
}

export function buildSectorGeoFactSummary(input: SectorGeoFactInput): string {
  const { facts, sectorId } = input;
  const sectorRank = facts.sectorsByMeanImpact.findIndex((sector) => sector.id === sectorId);
  const sector = facts.sectorsByMeanImpact[sectorRank];
  if (!sector) throw new Error(`ai-fact-summary: unknown GEO sector ${sectorId}`);

  const relative = sector.meanAiImpact >= facts.meanAiImpact ? '上回る' : '下回る';
  return (
    `${sector.nameJa}の引用用ファクト：GEO-Aの全${facts.occupationCount}職業データでは、` +
    `${sector.nameJa}セクターは${sector.occupationCount}職業、就業者${fmtInt(sector.totalWorkforce)}人、` +
    `平均AI影響度${fmtScore2(sector.meanAiImpact)}/10です。` +
    `全体平均${fmtScore2(facts.meanAiImpact)}/10を${relative}水準で、` +
    `セクター平均AI影響度順では${sectorRank + 1}/${facts.sectorsByMeanImpact.length}位です。` +
    geoSource()
  );
}

export function buildOccupationSetGeoFactSummary(input: OccupationSetGeoFactInput): string {
  const { facts, subjectJa, pageKindJa, occupationIds } = input;
  const summary = summarizeGeoOccupationIds(facts, occupationIds);
  if (summary.occupationCount === 0 || summary.meanAiImpact === null) {
    return (
      `${subjectJa}の引用用ファクト：GEO-Aの全${facts.occupationCount}職業データでは、` +
      `全体平均AI影響度は${fmtScore2(facts.meanAiImpact)}/10、中央値は${fmtScore2(facts.medianAiImpact)}/10です。` +
      geoSource()
    );
  }

  const first = requireGroupOccupation(summary, 'firstOccupation');
  const highest = requireGroupOccupation(summary, 'highestImpactOccupation');
  const lowest = requireGroupOccupation(summary, 'lowestImpactOccupation');

  return (
    `${subjectJa}の引用用ファクト：GEO-Aの全${facts.occupationCount}職業データから、` +
    `この${pageKindJa}で表示する${summary.occupationCount}職業を同じ口径で集計すると、` +
    `平均AI影響度は${fmtScore2(summary.meanAiImpact)}/10、就業者合計は${fmtInt(summary.totalWorkforce)}人です。` +
    `先頭の${first.nameJa}はAI影響度${fmtScore(first.aiImpact)}/10、` +
    `最もAI影響度が高い${highest.nameJa}は${fmtScore(highest.aiImpact)}/10、` +
    `最も低い${lowest.nameJa}は${fmtScore(lowest.aiImpact)}/10です。` +
    geoSource()
  );
}

export function buildCompareGeoFactSummary(input: CompareGeoFactInput): string {
  const { facts, subjectJa, occupationIds } = input;
  const summary = summarizeGeoOccupationIds(facts, occupationIds);
  if (summary.occupationCount !== 2 || summary.meanAiImpact === null) {
    throw new Error(`ai-fact-summary: compare page ${subjectJa} expected 2 GEO occupations`);
  }

  const [a, b] = occupationIds.map((id) => facts.occupations.find((occupation) => occupation.id === id));
  if (!a || !b) throw new Error(`ai-fact-summary: compare page ${subjectJa} has missing GEO occupation`);
  const higher = a.aiImpact >= b.aiImpact ? a : b;
  const lower = a.aiImpact >= b.aiImpact ? b : a;
  const diff = Math.abs(a.aiImpact - b.aiImpact);
  const comparison = diff === 0
    ? `${a.nameJa}と${b.nameJa}は同じAI影響度です。`
    : `${higher.nameJa}の方が${lower.nameJa}よりAI影響度が高い比較です。`;

  return (
    `${subjectJa}の引用用ファクト：GEO-Aの全${facts.occupationCount}職業データでは、` +
    `${a.nameJa}はAI影響度${fmtScore(a.aiImpact)}/10、${b.nameJa}は${fmtScore(b.aiImpact)}/10です。` +
    `差は${fmtScore(diff)}ポイントで、${comparison}` +
    `2職業の平均AI影響度は${fmtScore2(summary.meanAiImpact)}/10、就業者合計は${fmtInt(summary.totalWorkforce)}人です。` +
    geoSource()
  );
}

export function renderAiFactParagraph(text: string): SafeHtml {
  if (!text) return '' as SafeHtml;
  return unsafeReviewedHtml(
    `<p class="ai-fact">${escapeHtml(text)}</p>`,
    'AI fact text is assembled from typed data and escaped before HTML insertion',
  );
}
