/**
 * src/views/ranking/rankings/salary.ts — 年収軸ランキング.
 *
 * salary / entry-salary / high-salary-high-demand / high-salary-young-entry.
 */

import { TOP_N, HIGH_DEMAND_MIN, demandScore, demandLabel, type Occupation, type RankingResult } from '../config.js';
import { byKeyDesc, safeMean } from '../utilities.js';
import { FAQS } from '../../ranking-copy.js';

export interface SalaryRankings {
  bySalary: Occupation[];
  byEntry: Occupation[];
  highSalaryHighDemand: Occupation[];
  highSalaryYoungEntry: Occupation[];
  meanSalaryTop: number;
  entries: Array<[string, RankingResult]>;
}

export function buildSalaryRankings(
  occs: Occupation[],
  scored: Occupation[],
  limit = TOP_N,
): SalaryRankings {
  // 5. Salary (pure)
  const bySalary = byKeyDesc(
    occs.filter((o) => o.salary),
    (o) => o.salary,
    (o) => o.id,
  ).slice(0, limit);
  const meanSalaryTop = safeMean(bySalary, 'salary');

  // 6. Entry salary
  const byEntry = byKeyDesc(
    occs.filter((o) => o.recruit_wage),
    (o) => o.recruit_wage,
    (o) => o.id,
  ).slice(0, limit);
  const meanEntry = safeMean(byEntry, 'recruit_wage');

  // 27. 高年収 × 高需要
  const highSalaryHighDemand = scored
    .filter((o) => o.salary && demandScore(o.demand_band) >= HIGH_DEMAND_MIN)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || demandScore(b.demand_band) - demandScore(a.demand_band))
    .slice(0, limit);

  // 28. 初任給が高い × 若手活躍
  const highSalaryYoungEntry = occs
    .filter((o) => o.recruit_wage && o.average_age && o.average_age <= 40)
    .sort((a, b) => (b.recruit_wage ?? 0) - (a.recruit_wage ?? 0) || (a.average_age ?? 999) - (b.average_age ?? 999))
    .slice(0, limit);

  const entries: Array<[string, RankingResult]> = [
    ['salary', {
      slug: 'salary',
      items: bySalary,
      showSalary: true,
      faqItems: FAQS['salary'],
      title: '年収が高い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `日本で最も年収が高い職業TOP${TOP_N}。平均年収${Math.trunc(meanSalaryTop)}万円。AI影響度・就業者数も合わせて比較。`,
      h1Text: `年収ランキング TOP${TOP_N}`,
      subText: '年収が最も <strong>高い</strong> 職業ランキング',
      introText: '厚労省の職業情報データベースに基づく年収ランキング。年収が高い職業をAI影響度・就業者数と共に一覧できます。',
      statBlocks: [
        ['TOP30 平均年収', `${Math.trunc(meanSalaryTop)} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(bySalary, 'ai_risk').toFixed(1)} / 10`],
        ['TOP30 平均年齢', `${safeMean(bySalary, 'average_age').toFixed(1)} 歳`],
        ['TOP30 平均月間労働', `${Math.trunc(safeMean(bySalary, 'monthly_hours'))} 時間`],
      ],
    }],
    ['entry-salary', {
      slug: 'entry-salary',
      items: byEntry,
      showSalary: true,
      extraColFn: (o) => (o.recruit_wage ? [`初任給 ${Math.trunc(o.recruit_wage)}万円`] : []),
      faqItems: FAQS['entry-salary'],
      title: '初任給が高い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `初任給が最も高い職業TOP${TOP_N}。平均初任給${Math.trunc(meanEntry)}万円。年収・AI影響度も合わせて比較。就活・転職の参考に。`,
      h1Text: `初任給ランキング TOP${TOP_N}`,
      subText: '初任給が最も <strong>高い</strong> 職業ランキング',
      introText: '新卒・未経験からのスタート時の給与が高い職業をランキング。平均年収やAI影響度も合わせて確認できます。',
      statBlocks: [
        ['TOP30 平均初任給', `${Math.trunc(meanEntry)} 万円`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byEntry, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byEntry, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['high-salary-high-demand', {
      slug: 'high-salary-high-demand',
      items: highSalaryHighDemand,
      showSalary: true,
      extraColFn: (o) => {
        const label = demandLabel(o.demand_band);
        return label ? [{ kind: 'demand-pill' as const, band: o.demand_band ?? '', label }] : [];
      },
      faqItems: FAQS['high-salary-high-demand'],
      title: '高年収 × 高需要の職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `年収が高くかつ人手不足の職業 TOP${highSalaryHighDemand.length}。賃金上昇圧力が働く分野を一覧。`,
      h1Text: `高年収 × 高需要 TOP${highSalaryHighDemand.length}`,
      subText: '年収 <strong>高め</strong> × 求人需要 <strong>高め以上</strong>',
      introText: '医療系・建設系の専門職や IT 系上流職など、専門性 + 人手不足が重なる分野。賃金上昇圧力も働きます。',
      statBlocks: [
        ['対象職業数', `${highSalaryHighDemand.length}`],
        ['平均年収', `${Math.trunc(safeMean(highSalaryHighDemand, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(highSalaryHighDemand, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['high-salary-young-entry', {
      slug: 'high-salary-young-entry',
      items: highSalaryYoungEntry,
      showSalary: true,
      extraColFn: (o) => (o.recruit_wage ? [`初任給 ${Math.trunc(o.recruit_wage)} 万円`] : []),
      faqItems: FAQS['high-salary-young-entry'],
      title: '初任給が高い × 若手活躍の職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `初任給が高くて平均年齢 40 歳以下の職業 TOP${highSalaryYoungEntry.length}。新卒キャリア設計の参考に。`,
      h1Text: `初任給が高い × 若手活躍 TOP${highSalaryYoungEntry.length}`,
      subText: '初任給 <strong>降順</strong> × 平均年齢 <strong>40 歳以下</strong>',
      introText: 'スタート時の給与が高く、若手が多く活躍する職業をランキング。IT エンジニア・コンサル・金融系の一部が該当。',
      statBlocks: [
        ['TOP30 平均初任給', `${Math.trunc(safeMean(highSalaryYoungEntry, 'recruit_wage'))} 万円`],
        ['TOP30 平均年齢', `${safeMean(highSalaryYoungEntry, 'average_age').toFixed(1)} 歳`],
        ['TOP30 平均 AI 影響', `${safeMean(highSalaryYoungEntry, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
  ];

  return { bySalary, byEntry, highSalaryHighDemand, highSalaryYoungEntry, meanSalaryTop, entries };
}
