/**
 * src/views/ranking/rankings/education.ts — 学歴・資格軸ランキング.
 *
 * high-school-ok / university-required / graduate-school-required /
 * license-required / no-license-required.
 */

import { TOP_N, type Occupation, type RankingResult } from '../config.js';
import { safeMean, eduPct, gradPct, EDU } from '../utilities.js';
import { FAQS } from '../../ranking-copy.js';

export interface EducationRankings {
  highSchoolOk: Occupation[];
  universityRequired: Occupation[];
  graduateSchoolRequired: Occupation[];
  licenseRequired: Occupation[];
  noLicenseRequired: Occupation[];
  entries: Array<[string, RankingResult]>;
}

export function buildEducationRankings(
  occs: Occupation[],
  scored: Occupation[],
  limit = TOP_N,
): EducationRankings {
  // 31. 高卒で就ける (高卒比率 30%+ で sort)
  const highSchoolOk = occs
    .filter((o) => eduPct(o, EDU.highSchool) >= 30)
    .sort((a, b) => eduPct(b, '高卒') - eduPct(a, '高卒') || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, limit);

  // 32. 大卒以上が中心 (大卒比率 50%+)
  const universityRequired = occs
    .filter((o) => eduPct(o, EDU.university) >= 50)
    .sort((a, b) => eduPct(b, '大卒') - eduPct(a, '大卒') || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, limit);

  // 33. 大学院卒中心 (大学院卒 = 修士+博士 30%+)
  const graduateSchoolRequired = occs
    .filter((o) => gradPct(o) >= 30)
    .sort((a, b) => gradPct(b) - gradPct(a) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, limit);

  // 29. 国家資格必須
  const licenseRequired = occs
    .filter((o) => o.certs.length >= 1)
    .sort((a, b) => b.certs.length - a.certs.length || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, limit);

  // 30. 無資格で就ける × AI 安全
  const noLicenseRequired = scored
    .filter((o) => o.certs.length === 0 && (o.ai_risk ?? 999) <= 5)
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, limit);

  const entries: Array<[string, RankingResult]> = [
    ['high-school-ok', {
      slug: 'high-school-ok',
      items: highSchoolOk,
      showSalary: true,
      extraColFn: (o) => [`高卒 ${eduPct(o, EDU.highSchool).toFixed(0)}%`],
      faqItems: FAQS['high-school-ok'],
      title: '高卒で目指せる職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `高卒比率が高い職業 TOP${highSchoolOk.length}。学歴ハードルが低く実務能力で評価される職業を一覧。`,
      h1Text: `高卒で目指せる職業 TOP${highSchoolOk.length}`,
      subText: '高卒比率 <strong>30% 以上</strong> · 降順',
      introText: '高卒の従事者比率が高く、学歴より実務能力と適性で評価される職業群。建設・製造・運輸・サービス・公安系の現場職が中心。',
      statBlocks: [
        ['対象職業数', `${highSchoolOk.length}`],
        ['平均年収', `${Math.trunc(safeMean(highSchoolOk, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(highSchoolOk, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['university-required', {
      slug: 'university-required',
      items: universityRequired,
      showSalary: true,
      extraColFn: (o) => [`大卒 ${eduPct(o, EDU.university).toFixed(0)}%`],
      faqItems: FAQS['university-required'],
      title: '大卒以上が中心の職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `大卒比率 50% 以上の職業 TOP${universityRequired.length}。学位が前提となる専門職を一覧。`,
      h1Text: `大卒以上が中心の職業 TOP${universityRequired.length}`,
      subText: '大卒比率 <strong>50% 以上</strong> · 降順',
      introText: '大卒以上の従事者比率が高い職業群。専門知識・抽象的思考・複雑な意思決定を要する分野で、医療・士業・研究・上流 IT 等が含まれます。',
      statBlocks: [
        ['対象職業数', `${universityRequired.length}`],
        ['平均年収', `${Math.trunc(safeMean(universityRequired, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(universityRequired, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['graduate-school-required', {
      slug: 'graduate-school-required',
      items: graduateSchoolRequired,
      showSalary: true,
      extraColFn: (o) => [`院卒 ${gradPct(o).toFixed(0)}%`],
      faqItems: FAQS['graduate-school-required'],
      title: '大学院卒中心の職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `修士・博士課程修了者が多い職業 TOP${graduateSchoolRequired.length}。高度専門職を一覧。`,
      h1Text: `大学院卒中心の職業 TOP${graduateSchoolRequired.length}`,
      subText: '大学院卒比率 (修士+博士) <strong>30% 以上</strong> · 降順',
      introText: '研究職・大学教員・専門医・特定の士業など、博士・修士課程修了が前提となる高度専門職の職業群です。',
      statBlocks: [
        ['対象職業数', `${graduateSchoolRequired.length}`],
        ['平均年収', `${Math.trunc(safeMean(graduateSchoolRequired, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(graduateSchoolRequired, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['license-required', {
      slug: 'license-required',
      items: licenseRequired,
      showSalary: true,
      extraColFn: (o) => [`資格 ${o.certs.length}`],
      faqItems: FAQS['license-required'],
      title: '国家資格が必要な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `関連資格が多い職業 TOP${licenseRequired.length}。参入のかべが明確な専門職を年収・AI 影響度と共に一覧。`,
      h1Text: `国家資格が必要な職業 TOP${licenseRequired.length}`,
      subText: '関連資格数 <strong>降順</strong> ランキング',
      introText: '医療・士業・建設・福祉・教育系の専門職で、参入のかべが明確に設定されている職業群。資格保有者しかできない業務範囲があり、AI 代替が起きにくい傾向。',
      statBlocks: [
        ['対象職業数', `${licenseRequired.length}`],
        ['平均年収', `${Math.trunc(safeMean(licenseRequired, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(licenseRequired, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['no-license-required', {
      slug: 'no-license-required',
      items: noLicenseRequired,
      showSalary: true,
      faqItems: FAQS['no-license-required'],
      title: '無資格で就ける × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `関連資格不要で AI 影響度も低い職業 TOP${noLicenseRequired.length}。実務経験ベースで勝負できる分野を一覧。`,
      h1Text: `無資格で就ける × AI 安全 TOP${noLicenseRequired.length}`,
      subText: '関連資格 <strong>なし</strong> × AI 影響 <strong>5 以下</strong>',
      introText: '関連国家資格を要さず、AI 代替リスクも低い職業群。建設技能職・運輸・対人サービスの一部が該当します。',
      statBlocks: [
        ['対象職業数', `${noLicenseRequired.length}`],
        ['平均 AI 影響', `${safeMean(noLicenseRequired, 'ai_risk').toFixed(1)} / 10`],
        ['平均年収', `${Math.trunc(safeMean(noLicenseRequired, 'salary'))} 万円`],
      ],
    }],
  ];

  return { highSchoolOk, universityRequired, graduateSchoolRequired, licenseRequired, noLicenseRequired, entries };
}
