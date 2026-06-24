/**
 * src/views/ranking/rankings/workforce.ts — 就業者数・年齢軸ランキング.
 *
 * workers / young-workforce / aging-workforce / large-workforce-stable.
 */

import { TOP_N, type Occupation, type RankingResult } from '../config.js';
import { byKeyDesc, byKeyAsc, safeMean } from '../utilities.js';
import { fmtInt } from '../../../lib/num.js';
import { FAQS } from '../../ranking-copy.js';

export interface WorkforceRankings {
  byWorkers: Occupation[];
  byYoung: Occupation[];
  byAging: Occupation[];
  largeWorkforceStable: Occupation[];
  entries: Array<[string, RankingResult]>;
}

export function buildWorkforceRankings(
  occs: Occupation[],
  scored: Occupation[],
  limit = TOP_N,
): WorkforceRankings {
  // 4. Workers
  const byWorkers = byKeyDesc(
    occs.filter((o) => o.workers),
    (o) => o.workers,
  ).slice(0, limit);
  const totalWorkersTop = byWorkers.reduce((s, o) => s + (o.workers ?? 0), 0);

  // 7. Young workforce
  const byYoung = byKeyAsc(
    occs.filter((o) => o.average_age),
    (o) => o.average_age,
    (o) => o.id,
  ).slice(0, limit);
  const meanAgeYoung = safeMean(byYoung, 'average_age');

  // 12. シニア中心 (average_age desc)
  const byAging = byKeyDesc(occs.filter((o) => o.average_age), (o) => o.average_age, (o) => o.id).slice(0, limit);
  const meanAgeAging = safeMean(byAging, 'average_age');

  // 37. 大規模就業 × AI 安全 (workers desc among low-AI)
  const largeWorkforceStable = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.workers && o.workers >= 50000)
    .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, limit);

  const entries: Array<[string, RankingResult]> = [
    ['workers', {
      slug: 'workers',
      items: byWorkers,
      showSalary: true,
      faqItems: FAQS['workers'],
      title: '就業者数が多い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `日本で最も就業者が多い職業TOP${TOP_N}。合計${fmtInt(totalWorkersTop)}人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。`,
      h1Text: `就業者数ランキング TOP${TOP_N}`,
      subText: '日本で最も <strong>就業者が多い</strong> 職業',
      introText: '厚労省の職業情報データベース（job tag）に基づく就業者数ランキング。最も多くの人が従事している職業をAI影響度・年収データと共に一覧できます。',
      statBlocks: [
        ['TOP30 合計就業者数', `${fmtInt(totalWorkersTop)} 人`],
        ['TOP30 平均 AI 影響', `${safeMean(byWorkers, 'ai_risk').toFixed(1)} / 10`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byWorkers, 'salary'))} 万円`],
      ],
    }],
    ['young-workforce', {
      slug: 'young-workforce',
      items: byYoung,
      showSalary: true,
      extraColFn: (o) => (o.average_age ? [`${o.average_age.toFixed(1)}歳`] : []),
      faqItems: FAQS['young-workforce'],
      title: '平均年齢が若い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `平均年齢が最も低い職業TOP${TOP_N}。平均${meanAgeYoung.toFixed(1)}歳。若手が活躍する職業を年収・AI影響度と共に一覧。`,
      h1Text: `平均年齢が若い職業 TOP${TOP_N}`,
      subText: '平均年齢が最も <strong>低い</strong> 職業ランキング',
      introText: '若い世代が多く活躍する職業をランキング。IT・クリエイティブ・サービス業など、比較的新しい産業や体力を要する職種で平均年齢が低い傾向にあります。',
      statBlocks: [
        ['TOP30 平均年齢', `${meanAgeYoung.toFixed(1)} 歳`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byYoung, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byYoung, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['aging-workforce', {
      slug: 'aging-workforce',
      items: byAging,
      showSalary: true,
      extraColFn: (o) => (o.average_age ? [`${o.average_age.toFixed(1)} 歳`] : []),
      faqItems: FAQS['aging-workforce'],
      title: 'シニア中心の職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `平均年齢が最も高い職業 TOP${TOP_N}。平均 ${meanAgeAging.toFixed(1)} 歳。経験者が活躍する職業一覧。`,
      h1Text: `シニア中心の職業 TOP${TOP_N}`,
      subText: '平均年齢が最も <strong>高い</strong> 職業ランキング',
      introText: '長年の経験・人脈・現場判断が価値を持つ職業や、若手参入が少ない伝統的な職業で平均年齢が高くなる傾向。中高年からの参入チャンスとも読み取れます。',
      statBlocks: [
        ['TOP30 平均年齢', `${meanAgeAging.toFixed(1)} 歳`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byAging, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byAging, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['large-workforce-stable', {
      slug: 'large-workforce-stable',
      items: largeWorkforceStable,
      showSalary: true,
      faqItems: FAQS['large-workforce-stable'],
      title: '大規模就業 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `就業者数 5 万人以上かつ AI 影響度 5 以下の職業 TOP${largeWorkforceStable.length}。日本の労働市場の安定軸を一覧。`,
      h1Text: `大規模就業 × AI 安全 TOP${largeWorkforceStable.length}`,
      subText: '就業者数 <strong>5 万人以上</strong> × AI 影響 <strong>5 以下</strong>',
      introText: '日本の労働人口に占める比重が大きく、かつ AI 影響度も低い「中軸を支える」職業群。看護師・介護福祉士・建設職人・運輸・小売・サービス系等。',
      statBlocks: [
        ['対象職業数', `${largeWorkforceStable.length}`],
        ['TOP 合計就業者数', `${fmtInt(largeWorkforceStable.reduce((s, o) => s + (o.workers ?? 0), 0))} 人`],
        ['平均 AI 影響', `${safeMean(largeWorkforceStable, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
  ];

  return { byWorkers, byYoung, byAging, largeWorkforceStable, entries };
}
