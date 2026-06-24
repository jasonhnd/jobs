/**
 * src/views/ranking/rankings/employment.ts — 雇用形態軸ランキング.
 *
 * ai-stable-employment / freelance-friendly / self-employed-typical /
 * public-sector.
 */

import { TOP_N, type Occupation, type RankingResult } from '../config.js';
import { safeMean, empPct, inSectorSet, PUBLIC_SECTORS, EMP } from '../utilities.js';
import { FAQS } from '../../ranking-copy.js';

export interface EmploymentRankings {
  aiStableEmployment: Occupation[];
  freelanceFriendly: Occupation[];
  selfEmployedTypical: Occupation[];
  publicSector: Occupation[];
  entries: Array<[string, RankingResult]>;
}

export function buildEmploymentRankings(
  occs: Occupation[],
  scored: Occupation[],
  limit = TOP_N,
): EmploymentRankings {
  // 20. AI 安全 × 正規雇用率高
  const aiStableEmployment = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && empPct(o, EMP.regular) >= 60)
    .sort((a, b) => empPct(b, EMP.regular) - empPct(a, EMP.regular) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, limit);

  // 35. フリーランス向き (自営、フリーランス比率 20%+)
  const freelanceFriendly = occs
    .filter((o) => empPct(o, EMP.selfEmployedFreelance) >= 20)
    .sort((a, b) => empPct(b, EMP.selfEmployedFreelance) - empPct(a, EMP.selfEmployedFreelance) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, limit);

  // 36. 独立・開業が典型 (経営層 + 自営、フリーランス >= 30%)
  const selfEmployedTypical = occs
    .filter((o) => empPct(o, EMP.selfEmployedFreelance) + empPct(o, EMP.executive) >= 30)
    .sort((a, b) =>
      (empPct(b, EMP.selfEmployedFreelance) + empPct(b, EMP.executive)) -
      (empPct(a, EMP.selfEmployedFreelance) + empPct(a, EMP.executive))
      || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, limit);

  // 34. 公的機関・公務員系
  const publicSector = occs
    .filter((o) => inSectorSet(o, PUBLIC_SECTORS))
    .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0) || a.id - b.id)
    .slice(0, limit);

  const entries: Array<[string, RankingResult]> = [
    ['ai-stable-employment', {
      slug: 'ai-stable-employment',
      items: aiStableEmployment,
      showSalary: true,
      extraColFn: (o) => [`正規 ${empPct(o, EMP.regular).toFixed(0)}%`],
      faqItems: FAQS['ai-stable-employment'],
      title: 'AI 安全 × 正規雇用率高の職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `AI 影響度 5 以下かつ正規雇用率 60% 以上の安定職業 TOP${aiStableEmployment.length}。長期的なキャリア安定性が期待できる分野。`,
      h1Text: `AI 安全 × 正規雇用率高 TOP${aiStableEmployment.length}`,
      subText: 'AI 影響度 <strong>5 以下</strong> × 正規雇用率 <strong>60% 以上</strong>',
      introText: '低 AI 影響度かつ正社員比率が高い、長期的に安定したキャリア形成が期待できる職業群です。',
      statBlocks: [
        ['対象職業数', `${aiStableEmployment.length}`],
        ['平均 AI 影響', `${safeMean(aiStableEmployment, 'ai_risk').toFixed(1)} / 10`],
        ['平均年収', `${Math.trunc(safeMean(aiStableEmployment, 'salary'))} 万円`],
      ],
    }],
    ['freelance-friendly', {
      slug: 'freelance-friendly',
      items: freelanceFriendly,
      showSalary: true,
      extraColFn: (o) => [`フリー ${empPct(o, EMP.selfEmployedFreelance).toFixed(0)}%`],
      faqItems: FAQS['freelance-friendly'],
      title: 'フリーランス向きの職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `自営・フリーランス比率が高い職業 TOP${freelanceFriendly.length}。独立しやすい分野を一覧。`,
      h1Text: `フリーランス向きの職業 TOP${freelanceFriendly.length}`,
      subText: '自営・フリーランス比率 <strong>20% 以上</strong> · 降順',
      introText: '専門スキルが個人ベースで完結する職業 (デザイン・執筆・IT・コンサル等) や、現場直結の自営業 (技能職・士業) など、独立しやすい分野をランキング。',
      statBlocks: [
        ['対象職業数', `${freelanceFriendly.length}`],
        ['平均年収', `${Math.trunc(safeMean(freelanceFriendly, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(freelanceFriendly, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['self-employed-typical', {
      slug: 'self-employed-typical',
      items: selfEmployedTypical,
      showSalary: true,
      extraColFn: (o) => [`独立 ${(empPct(o, EMP.selfEmployedFreelance) + empPct(o, EMP.executive)).toFixed(0)}%`],
      faqItems: FAQS['self-employed-typical'],
      title: '独立・開業が典型の職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `フリーランス + 経営層比率が高い職業 TOP${selfEmployedTypical.length}。独立がキャリアの自然な到達点となる職業を一覧。`,
      h1Text: `独立・開業が典型の職業 TOP${selfEmployedTypical.length}`,
      subText: 'フリーランス + 経営層 比率 <strong>30% 以上</strong> · 降順',
      introText: '美容師・調理師・建設職人・士業など、独立がキャリアの自然な到達点とされる職業群。雇われ段階を経て独立 → 開業のルートが定番です。',
      statBlocks: [
        ['対象職業数', `${selfEmployedTypical.length}`],
        ['平均年収', `${Math.trunc(safeMean(selfEmployedTypical, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(selfEmployedTypical, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['public-sector', {
      slug: 'public-sector',
      items: publicSector,
      showSalary: true,
      faqItems: FAQS['public-sector'],
      title: '公的機関・公務員系の職業 TOP15【2026年版】| 未来の仕事',
      seoDesc: `保安・公安セクターの公務員系職業 TOP${publicSector.length}。安定雇用・年功的昇進・福利厚生が特徴の分野。`,
      h1Text: `公的機関・公務員系の職業 TOP${publicSector.length}`,
      subText: '保安・公安セクターの公務員系職業ランキング',
      introText: '警察官・自衛官・消防士・公務員系職業をランキング。安定雇用・年功的昇進・手厚い福利厚生が特徴で、AI 影響度も低めの傾向です。',
      statBlocks: [
        ['対象職業数', `${publicSector.length}`],
        ['平均年収', `${Math.trunc(safeMean(publicSector, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(publicSector, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
  ];

  return { aiStableEmployment, freelanceFriendly, selfEmployedTypical, publicSector, entries };
}
