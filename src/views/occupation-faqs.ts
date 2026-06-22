/**
 * src/views/occupation-faqs.ts — build the Q/A tuples used to
 * power both the on-page FAQ block (src/templates/OccFaq) and the
 * FAQPage Schema.org node (src/templates/JsonLd).
 *
 * Extracted from src/pages/[id].astro (`buildOccFaqs`). Pure
 * data shaping — produces `readonly [question, answer]` tuples
 * with no HTML. The two consumers handle their own markup; this
 * function is the single source of truth for what questions get
 * asked and what answers reference.
 *
 * Up to four questions emit, each gated on the corresponding
 * Rec data being present:
 *
 *   1. 年収はいくらですか？      — salary in 万円
 *   2. AI代替リスクはどれくらい? — ai_risk + rationale + outlook
 *   3. 将来性はどうですか？      — same gate as #2 (always paired)
 *   4. なるにはどうすれば?       — how_to_become_ja first sentence
 *   5. 必要なスキルは?           — top 3-5 skills from skills_top10
 *
 * All number formatting (Math.trunc + locale-aware comma rendering
 * via fmtInt) and Japanese text snipping (sentence boundary at 「。」,
 * 220-char cap) live here too.
 */

import { fmtInt } from '../lib/num.js';
import { SCORE_ATTRIBUTION } from '../site/score-attribution.js';
import type { GeoFacts, GeoOccupationSummary } from '../site/geo-facts.js';

/** Narrow shape — only the Rec fields buildOccupationFaqs reads. */
export interface OccupationFaqsInput {
  readonly id?: number;
  readonly nameJa: string;
  /** Annual salary in 万円. */
  readonly salaryMan: number | null | undefined;
  readonly workers: number | null | undefined;
  readonly recruitRatio: number | null | undefined;
  /** 0-10 AI risk score. Null gates question #2 + #3 together. */
  readonly aiRisk: number | null | undefined;
  /** Short AI rationale sentence. Trailing 「。」is stripped. */
  readonly aiRationaleJa: string;
  /** Long-form "how to become" text. First sentence is excerpted. */
  readonly howToBecomeJa: string;
  /** Top 10 skills — label_ja is read; falsy entries are dropped. */
  readonly skillsTop10: ReadonlyArray<{ readonly labelJa: string | null }>;
  readonly geoFacts?: GeoFacts;
}

export type OccupationFaqItem = readonly [question: string, answer: string];

const SALARY_NATIONAL_AVG = '日本全体の平均年収（約460万円）';
const SALARY_HIGH_THRESHOLD = 500; // 万円
const SALARY_LOW_THRESHOLD = 420; // 万円

const RISK_LOW_CEILING = 3;
const RISK_HIGH_FLOOR = 7;
const RISK_MID_CEILING = 6;

const HOWTO_TRUNCATE_LENGTH = 220;
const HOWTO_FALLBACK_SLICE = 200;

function fmtScore(n: number): string {
  return n.toFixed(1);
}

function fmtScore2(n: number): string {
  return n.toFixed(2);
}

function findGeoOccupation(input: OccupationFaqsInput): GeoOccupationSummary | null {
  if (input.id === undefined || !input.geoFacts) return null;
  return input.geoFacts.occupations.find((occupation) => occupation.id === input.id) ?? null;
}

export function buildOccupationFaqs(
  input: OccupationFaqsInput,
): readonly OccupationFaqItem[] {
  const { nameJa, salaryMan, workers, recruitRatio, aiRisk, aiRationaleJa, howToBecomeJa, skillsTop10 } =
    input;
  const geoOccupation = findGeoOccupation(input);
  const geoFacts = input.geoFacts;
  const name = nameJa || '';
  const rationale = aiRationaleJa.trim().replace(/。$/, '').trim();
  const factAiRisk = geoOccupation?.aiImpact ?? aiRisk;
  const factWorkers = geoOccupation?.workers ?? workers;
  const factRecruitRatio = geoOccupation?.recruitRatio ?? recruitRatio;
  const how = howToBecomeJa.trim();
  const faqs: OccupationFaqItem[] = [];

  if (salaryMan) {
    const monthly = salaryMan / 12;
    const compare =
      salaryMan > SALARY_HIGH_THRESHOLD
        ? `${SALARY_NATIONAL_AVG}を上回る水準`
        : salaryMan < SALARY_LOW_THRESHOLD
          ? `${SALARY_NATIONAL_AVG}を下回る水準`
          : `${SALARY_NATIONAL_AVG}と同程度`;
    faqs.push([
      `${name}の年収はいくらですか？`,
      `${name}の平均年収は約${Math.trunc(salaryMan)}万円（月収換算で約${Math.trunc(monthly)}万円）で、${compare}です。これは厚生労働省 jobtag のデータに基づく値で、勤務先・地域・経験により幅があります。`,
    ]);
  }

  if (factAiRisk !== null && factAiRisk !== undefined) {
    const tier =
      factAiRisk <= RISK_LOW_CEILING
        ? '低めで、AI に代替されにくい職業'
        : factAiRisk <= RISK_MID_CEILING
          ? '中程度で、業務の一部が AI 補助に移行する可能性'
          : '高めで、業務の多くが AI による代替・補助の対象となる可能性';
    const rationaleStr = rationale ? `主な要因は「${rationale}」。` : '';
    const geoRankStr = geoOccupation && geoFacts
      ? `AI影響度の高い順では全${geoFacts.occupationCount}職業中${geoOccupation.aiImpactRank}位で、全体平均${fmtScore2(geoFacts.meanAiImpact)}/10と比較できます。`
      : '';
    const displacementStr = geoOccupation?.displacementRisk !== null && geoOccupation?.displacementRisk !== undefined
      ? `AIOIS-10の仕事が減るリスクは${fmtScore(geoOccupation.displacementRisk)}/10です。`
      : '';
    faqs.push([
      `${name}はAIでなくなる・AIに代替される仕事ですか？`,
      `${name}は「AIでなくなる」と断定する職業ではありません。GEO-AではAI影響度が10段階中 ${fmtScore(factAiRisk)} で、${tier}です。${geoRankStr}${displacementStr}${rationaleStr}これは ${SCORE_ATTRIBUTION.modelDisplay} による独自スコア（非公式）で、職業選択の唯一の根拠としては使用しないでください。`,
    ]);

    const outlook =
      factAiRisk <= RISK_LOW_CEILING
        ? 'AI に代替されにくく、将来性は比較的安定'
        : factAiRisk >= RISK_HIGH_FLOOR
          ? 'AI による業務変化が大きく見込まれ、スキルアップや関連職種への転換も視野に'
          : 'AI 影響は中程度で、業務の一部が AI 補助に移行する可能性';
    const workersStr = factWorkers ? `日本での就業者数は約${fmtInt(factWorkers)}人。` : '';
    const recruitStr =
      factRecruitRatio !== null && factRecruitRatio !== undefined
        ? `求人倍率 ${factRecruitRatio.toFixed(2)} 倍。`
        : '';
    faqs.push([
      `${name}の将来性はどうですか？`,
      `AI影響度 ${fmtScore(factAiRisk)}/10。${outlook}な職業です。${workersStr}${recruitStr}個別の状況に応じた判断が重要です。`,
    ]);
  }

  if (how) {
    let first = how.split('。')[0].trim();
    if (!first) first = how.slice(0, HOWTO_FALLBACK_SLICE).trim();
    if (first.length > HOWTO_TRUNCATE_LENGTH) {
      first = first.slice(0, HOWTO_TRUNCATE_LENGTH).trimEnd() + '…';
    }
    faqs.push([
      `${name}になるにはどうすればいいですか？`,
      `${first}。詳しい流れは本ページ内の「${name}になるには・必要な資格」セクションをご覧ください。`,
    ]);
  }

  if (skillsTop10.length) {
    const top3 = skillsTop10
      .slice(0, 3)
      .map((s) => s.labelJa)
      .filter((s): s is string => Boolean(s));
    if (top3.length) {
      const skillsStr = top3.join('、');
      let extra = '';
      if (skillsTop10.length >= 5) {
        const tail = skillsTop10
          .slice(3, 5)
          .map((s) => s.labelJa)
          .filter((s): s is string => Boolean(s));
        if (tail.length) extra = `加えて、${tail.join('、')}も重要です。`;
      }
      faqs.push([
        `${name}に必要なスキルは何ですか？`,
        `${name}で特に重視されるスキルは、${skillsStr}などです。${extra}詳しいスキル分布は本ページ内の「必要なスキル・知識・能力」セクションをご覧ください。`,
      ]);
    }
  }

  return faqs;
}
