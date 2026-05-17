/**
 * src/views/ranking/rankings/low-risk.ts — AI 低リスク系ランキング.
 *
 * ai-risk-low + salary-safe (the "high pay × low AI risk" combo).
 */

import { TOP_N, type Occupation, type RankingResult } from '../config.js';
import { byKeyAsc, safeMean } from '../utilities.js';
import { FAQS } from '../../ranking-copy.js';

export interface LowRiskRankings {
  aiLow: Occupation[];
  salarySafe: Occupation[];
  entries: Array<[string, RankingResult]>;
}

export function buildLowRiskRankings(
  scored: Occupation[],
  withSalary: Occupation[],
): LowRiskRankings {
  // 2. AI risk low — sort ai_risk asc, id asc
  const aiLow = byKeyAsc(scored, (o) => o.ai_risk, (o) => o.id).slice(0, TOP_N);
  const meanLow = safeMean(aiLow, 'ai_risk');

  // 3. Salary x safe — filter ai_risk<=5, sort -salary then ai_risk then id
  const salarySafe = withSalary
    .filter((o) => (o.ai_risk ?? 0) <= 5)
    .sort((a, b) => {
      const sa = a.salary ?? 0;
      const sb = b.salary ?? 0;
      if (sb !== sa) return sb - sa;
      const ra = a.ai_risk ?? 0;
      const rb = b.ai_risk ?? 0;
      if (ra !== rb) return ra - rb;
      return a.id - b.id;
    })
    .slice(0, TOP_N);
  const meanSalarySS = safeMean(salarySafe, 'salary');
  const meanRiskSS = safeMean(salarySafe, 'ai_risk');

  const entries: Array<[string, RankingResult]> = [
    ['ai-risk-low', {
      slug: 'ai-risk-low',
      items: aiLow,
      showSalary: true,
      faqItems: FAQS['ai-risk-low'],
      title: 'AI影響が少ない仕事ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `AIに代替されにくい職業TOP${TOP_N}。平均スコア${meanLow.toFixed(1)}/10。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。`,
      h1Text: `AI影響が少ない仕事 TOP${TOP_N}`,
      subText: `AI 影響度が最も <strong>低い</strong> 職業ランキング（${scored.length} 職業中）`,
      introText: '身体性・対人関係・創造性が求められる職業はAIによる代替が難しく、スコアが低くなる傾向があります。「AIに奪われない仕事」をお探しの方に、将来性の高い職業を年収データと共に紹介します。',
      statBlocks: [
        ['対象職業数', `${scored.length}`],
        ['TOP30 平均 AI 影響', `${meanLow.toFixed(1)} / 10`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(aiLow, 'salary'))} 万円`],
        ['TOP30 平均年齢', `${safeMean(aiLow, 'average_age').toFixed(1)} 歳`],
      ],
    }],
    ['salary-safe', {
      slug: 'salary-safe',
      items: salarySafe,
      showSalary: true,
      faqItems: FAQS['salary-safe'],
      title: '高年収×低AIリスクの職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `年収が高くAI代替リスクが低い職業TOP${TOP_N}。平均年収${Math.trunc(meanSalarySS)}万円・平均AI影響${meanRiskSS.toFixed(1)}/10。将来性と収入を両立できる仕事を一覧。`,
      h1Text: `高年収×低AIリスク TOP${TOP_N}`,
      subText: '年収が高く、かつ AI 影響度が <strong>5以下</strong> の職業',
      introText: '高い年収を得ながらAIに代替されにくい——そんな職業を探している方へ。AI影響度5以下（10段階）かつ年収が高い順にランキングしました。',
      statBlocks: [
        ['TOP30 平均年収', `${Math.trunc(meanSalarySS)} 万円`],
        ['TOP30 平均 AI 影響', `${meanRiskSS.toFixed(1)} / 10`],
        ['TOP30 平均年齢', `${safeMean(salarySafe, 'average_age').toFixed(1)} 歳`],
      ],
    }],
  ];

  return { aiLow, salarySafe, entries };
}
