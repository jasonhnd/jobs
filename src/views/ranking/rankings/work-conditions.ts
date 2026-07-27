/**
 * src/views/ranking/rankings/work-conditions.ts — 労働時間・時給・求人倍率系.
 *
 * short-hours / monthly-hours-long / hourly-wage / recruit-ratio /
 * recruit-ratio-low / high-demand.
 */

import { TOP_N, HIGH_DEMAND_MIN, demandScore, demandLabel, type Occupation, type RankingResult } from '../config.js';
import { byKeyDesc, byKeyAsc, safeMean } from '../utilities.js';
import { FAQS } from '../../ranking-copy.js';

export interface WorkConditionsRankings {
  byHours: Occupation[];
  byHoursLong: Occupation[];
  byHourly: Occupation[];
  byRecruitRatio: Occupation[];
  byRecruitLow: Occupation[];
  byDemand: Occupation[];
  hotCount: number;
  normalCount: number;
  entries: Array<[string, RankingResult]>;
}

export function buildWorkConditionsRankings(
  occs: Occupation[],
  limit = TOP_N,
): WorkConditionsRankings {
  // 8. Short hours
  const byHours = byKeyAsc(
    occs.filter((o) => o.monthly_hours),
    (o) => o.monthly_hours,
    (o) => o.id,
  ).slice(0, limit);
  const meanHours = safeMean(byHours, 'monthly_hours');

  // 13. 月労働時間が長い (monthly_hours desc)
  const byHoursLong = byKeyDesc(occs.filter((o) => o.monthly_hours), (o) => o.monthly_hours, (o) => o.id).slice(0, limit);
  const meanHoursLong = safeMean(byHoursLong, 'monthly_hours');

  // 10. 時給ランキング (派生: recruit_wage / 160h、円)
  const byHourly = byKeyDesc(occs.filter((o) => o.hourly_wage), (o) => o.hourly_wage, (o) => o.id).slice(0, limit);
  const meanHourly = safeMean(byHourly, 'hourly_wage');

  // 11. 求人倍率 (recruit_ratio desc)
  const byRecruitRatio = byKeyDesc(occs.filter((o) => o.recruit_ratio !== null), (o) => o.recruit_ratio, (o) => o.id).slice(0, limit);
  const meanRecruitRatio = safeMean(byRecruitRatio, 'recruit_ratio');

  // 14. 求人倍率が低い (recruit_ratio asc, 買い手市場)
  const byRecruitLow = byKeyAsc(occs.filter((o) => o.recruit_ratio !== null), (o) => o.recruit_ratio, (o) => o.id).slice(0, limit);
  const meanRecruitLow = safeMean(byRecruitLow, 'recruit_ratio');

  // 9. High demand
  let withDemand = occs.filter((o) => demandScore(o.demand_band) >= HIGH_DEMAND_MIN);
  if (withDemand.length < TOP_N) {
    withDemand = occs.filter((o) => o.demand_band);
  }
  const byDemand = [...withDemand]
    .sort((a, b) => {
      const ds = demandScore(b.demand_band) - demandScore(a.demand_band);
      if (ds !== 0) return ds;
      const ss = (b.salary ?? 0) - (a.salary ?? 0);
      if (ss !== 0) return ss;
      return a.id - b.id;
    })
    .slice(0, limit);
  // Dataset-wide, NOT the page slice. Derived from byDemand (already sliced to
  // 30) this was tautologically 30 while the real figure is 270, and it shipped
  // in the meta description unprefixed, next to siblings labelled `TOP30 平均…`.
  const hotCount = occs.filter((o) => o.demand_band === 'hot').length;
  const normalCount = occs.filter((o) => o.demand_band === 'normal').length;

  const entries: Array<[string, RankingResult]> = [
    ['short-hours', {
      slug: 'short-hours',
      items: byHours,
      showSalary: true,
      extraColFn: (o) => (o.monthly_hours ? [`月${Math.trunc(o.monthly_hours)}h`] : []),
      faqItems: FAQS['short-hours'],
      title: '労働時間が短い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `月間労働時間が最も短い職業TOP${TOP_N}。平均${Math.trunc(meanHours)}時間。ワークライフバランスに優れた職業を年収・AI影響度と共に一覧。`,
      h1Text: `労働時間が短い職業 TOP${TOP_N}`,
      subText: '月間労働時間が最も <strong>短い</strong> 職業ランキング',
      introText: 'ワークライフバランスを重視する方向けに、月間労働時間が短い職業をランキング。年収やAI影響度も合わせて確認できます。',
      statBlocks: [
        ['TOP30 平均月間労働', `${Math.trunc(meanHours)} 時間`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byHours, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byHours, 'ai_risk').toFixed(1)} / 10`],
        ['TOP30 平均年齢', `${safeMean(byHours, 'average_age').toFixed(1)} 歳`],
      ],
    }],
    ['monthly-hours-long', {
      slug: 'monthly-hours-long',
      items: byHoursLong,
      showSalary: true,
      extraColFn: (o) => (o.monthly_hours ? [`月${Math.trunc(o.monthly_hours)}h`] : []),
      faqItems: FAQS['monthly-hours-long'],
      title: '労働時間が長い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `月間労働時間が最も長い職業 TOP${TOP_N}。平均 ${Math.trunc(meanHoursLong)} 時間。年収・AI 影響度と共に確認。`,
      h1Text: `労働時間が長い職業 TOP${TOP_N}`,
      subText: '月間労働時間が最も <strong>長い</strong> 職業ランキング',
      introText: '建設・運輸・医療・サービス業など、現場稼働や緊急対応が必要な職業で月間労働時間が長くなる傾向。長時間労働の常態化は健康面・継続性の観点でも要検討です。',
      statBlocks: [
        ['TOP30 平均月間労働', `${Math.trunc(meanHoursLong)} 時間`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byHoursLong, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byHoursLong, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['hourly-wage', {
      slug: 'hourly-wage',
      items: byHourly,
      showSalary: true,
      extraColFn: (o) => (o.hourly_wage ? [`時給 ¥${o.hourly_wage.toLocaleString('en-US')}`] : []),
      faqItems: FAQS['hourly-wage'],
      title: '時給が高い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `時給ベースで報酬が高い職業 TOP${TOP_N}。平均時給 ¥${Math.round(meanHourly).toLocaleString('en-US')}。AI 影響度・年収と共に一覧。`,
      h1Text: `時給が高い職業 TOP${TOP_N}`,
      subText: '時給ベースで報酬が <strong>高い</strong> 職業ランキング (求人賃金 ÷ 160h 推計)',
      introText: '時給ベースで報酬が高い職業をランキング。求人賃金 (月) を 160 時間で割った推計値で、フルタイム前提の参考値です。AI 影響度・年収も合わせて確認できます。',
      statBlocks: [
        ['TOP30 平均時給', `¥${Math.round(meanHourly).toLocaleString('en-US')}`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byHourly, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byHourly, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['recruit-ratio', {
      slug: 'recruit-ratio',
      items: byRecruitRatio,
      showSalary: true,
      extraColFn: (o) => (o.recruit_ratio !== null ? [`${o.recruit_ratio.toFixed(2)} 倍`] : []),
      faqItems: FAQS['recruit-ratio'],
      title: '求人倍率が高い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `求人倍率が最も高い職業 TOP${TOP_N}。平均 ${meanRecruitRatio.toFixed(2)} 倍。人手不足が顕著な売り手市場の職業一覧。`,
      h1Text: `求人倍率が高い職業 TOP${TOP_N}`,
      subText: '求人倍率が最も <strong>高い</strong> 職業ランキング',
      introText: '1 人の求職者あたり何件の求人があるかを表す「有効求人倍率」が高い職業をランキング。1.0 を超えると売り手市場、人手不足を表しています。',
      statBlocks: [
        ['TOP30 平均求人倍率', `${meanRecruitRatio.toFixed(2)} 倍`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byRecruitRatio, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byRecruitRatio, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['recruit-ratio-low', {
      slug: 'recruit-ratio-low',
      items: byRecruitLow,
      showSalary: true,
      extraColFn: (o) => (o.recruit_ratio !== null ? [`${o.recruit_ratio.toFixed(2)} 倍`] : []),
      faqItems: FAQS['recruit-ratio-low'],
      title: '求人倍率が低い職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `求人倍率が最も低い職業 TOP${TOP_N}。平均 ${meanRecruitLow.toFixed(2)} 倍。採用競争が厳しい買い手市場の職業一覧。`,
      h1Text: `求人倍率が低い職業 TOP${TOP_N}`,
      subText: '求人倍率が最も <strong>低い</strong> 職業ランキング (買い手市場)',
      introText: '応募者数に対して求人数が少ない買い手市場の職業をランキング。人気職業や参入のかべが高い分野、市場縮小傾向の業種が含まれます。',
      statBlocks: [
        ['TOP30 平均求人倍率', `${meanRecruitLow.toFixed(2)} 倍`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byRecruitLow, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byRecruitLow, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['high-demand', {
      slug: 'high-demand',
      items: byDemand,
      showSalary: true,
      extraColFn: (o) => {
        const label = demandLabel(o.demand_band);
        return label ? [{ kind: 'demand-pill' as const, band: o.demand_band ?? '', label }] : [];
      },
      faqItems: FAQS['high-demand'],
      title: '人手不足の職業ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `求人需要が最も高い職業TOP${TOP_N}。全${occs.length}職業のうち「需要高」は${hotCount}件・「安定」は${normalCount}件。転職・就活の参考に。`,
      h1Text: `人手不足の職業 TOP${TOP_N}`,
      subText: '求人需要が最も <strong>高い</strong> 職業ランキング',
      introText: '人手不足が深刻な職業を求人需要の高い順にランキング。採用されやすく待遇改善も期待できる職業を年収・AI影響度と共に確認できます。',
      statBlocks: [
        ['全体「需要高」職業数', `${hotCount}`],
        ['全体「安定」職業数', `${normalCount}`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(byDemand, 'salary'))} 万円`],
        ['TOP30 平均 AI 影響', `${safeMean(byDemand, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
  ];

  return { byHours, byHoursLong, byHourly, byRecruitRatio, byRecruitLow, byDemand, hotCount, normalCount, entries };
}
