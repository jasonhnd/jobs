/**
 * src/views/ranking/rankings/intent.ts — intent-driven combination rankings.
 *
 * AI 安全 × 他軸の組合せ + 規制保護 + 低ストレス. These rankings answer the
 * shape "I want a job that's AI-safe AND <constraint>".
 *
 *   ai-safe-high-demand / ai-safe-short-hours / ai-safe-young-workforce /
 *   ai-safe-no-license / ai-safe-physical / ai-safe-interpersonal /
 *   regulated-protected / low-stress-stable.
 */

import { TOP_N, DEMAND_SCORE, DEMAND_JA, type Occupation, type RankingResult } from '../config.js';
import {
  safeMean,
  inSectorSet,
  PHYSICAL_SECTORS,
  INTERPERSONAL_SECTORS,
} from '../utilities.js';
import { FAQS } from '../../ranking-copy.js';

export interface IntentRankings {
  aiSafeHighDemand: Occupation[];
  aiSafeShortHours: Occupation[];
  aiSafeYoung: Occupation[];
  aiSafeNoLicense: Occupation[];
  aiSafePhysical: Occupation[];
  aiSafeInterpersonal: Occupation[];
  regulatedProtected: Occupation[];
  lowStressStable: Occupation[];
  entries: Array<[string, RankingResult]>;
}

export function buildIntentRankings(scored: Occupation[]): IntentRankings {
  // 21. 高需要 × AI 安全
  const aiSafeHighDemand = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && (DEMAND_SCORE[o.demand_band ?? ''] ?? 0) >= 3)
    .sort((a, b) => (DEMAND_SCORE[b.demand_band ?? ''] ?? 0) - (DEMAND_SCORE[a.demand_band ?? ''] ?? 0) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);

  // 22. 低労働時間 × AI 安全
  const aiSafeShortHours = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.monthly_hours)
    .sort((a, b) => (a.monthly_hours ?? 9999) - (b.monthly_hours ?? 9999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);

  // 23. 若手中心 × AI 安全
  const aiSafeYoung = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.average_age)
    .sort((a, b) => (a.average_age ?? 999) - (b.average_age ?? 999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);

  // 24. 無資格 × AI 安全
  const aiSafeNoLicense = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.certs.length === 0)
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);

  // 25. 身体性 × AI 安全
  const aiSafePhysical = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && inSectorSet(o, PHYSICAL_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.workers ?? 0) - (a.workers ?? 0))
    .slice(0, TOP_N);

  // 26. 対人 × AI 安全
  const aiSafeInterpersonal = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && inSectorSet(o, INTERPERSONAL_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.workers ?? 0) - (a.workers ?? 0))
    .slice(0, TOP_N);

  // 38. 規制で守られた職業 (certs >= 2 + ai_risk <= 5)
  const regulatedProtected = scored
    .filter((o) => o.certs.length >= 2 && (o.ai_risk ?? 999) <= 5)
    .sort((a, b) => b.certs.length - a.certs.length || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);

  // 39. 低ストレス安定職 (short hours + low AI)
  const lowStressStable = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.monthly_hours && o.monthly_hours <= 165)
    .sort((a, b) => (a.monthly_hours ?? 999) - (b.monthly_hours ?? 999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);

  const entries: Array<[string, RankingResult]> = [
    ['ai-safe-high-demand', {
      slug: 'ai-safe-high-demand',
      items: aiSafeHighDemand,
      showSalary: true,
      extraColFn: (o) => {
        const db = o.demand_band ?? '';
        const label = DEMAND_JA[db];
        return label ? [{ kind: 'demand-pill' as const, band: db, label }] : [];
      },
      faqItems: FAQS['ai-safe-high-demand'],
      title: '高需要 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `人手不足かつ AI 影響度が低い職業 TOP${aiSafeHighDemand.length}。介護・建設・医療系を中心とした「鉄板」キャリア候補。`,
      h1Text: `高需要 × AI 安全 TOP${aiSafeHighDemand.length}`,
      subText: '求人需要 <strong>高め以上</strong> × AI 影響 <strong>5 以下</strong>',
      introText: '採用されやすく賃金交渉余地もあり、かつ AI 代替リスクが低い「鉄板」キャリア候補。介護・建設・医療系が中心で、未経験参入のルートも整備されています。',
      statBlocks: [
        ['対象職業数', `${aiSafeHighDemand.length}`],
        ['平均 AI 影響', `${safeMean(aiSafeHighDemand, 'ai_risk').toFixed(1)} / 10`],
        ['平均年収', `${Math.trunc(safeMean(aiSafeHighDemand, 'salary'))} 万円`],
      ],
    }],
    ['ai-safe-short-hours', {
      slug: 'ai-safe-short-hours',
      items: aiSafeShortHours,
      showSalary: true,
      extraColFn: (o) => (o.monthly_hours ? [`月${Math.trunc(o.monthly_hours)}h`] : []),
      faqItems: FAQS['ai-safe-short-hours'],
      title: '低労働時間 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `労働時間が短く AI 影響度も低い職業 TOP${TOP_N}。ワークライフバランスと将来性を両立する職業を一覧。`,
      h1Text: `低労働時間 × AI 安全 TOP${TOP_N}`,
      subText: 'AI 影響 <strong>5 以下</strong> × 月間労働時間 <strong>昇順</strong>',
      introText: '労働時間が短く、かつ AI 代替リスクも低い職業をランキング。教育・公務・専門職の一部が該当します。',
      statBlocks: [
        ['TOP30 平均月間労働', `${Math.trunc(safeMean(aiSafeShortHours, 'monthly_hours'))} 時間`],
        ['TOP30 平均 AI 影響', `${safeMean(aiSafeShortHours, 'ai_risk').toFixed(1)} / 10`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(aiSafeShortHours, 'salary'))} 万円`],
      ],
    }],
    ['ai-safe-young-workforce', {
      slug: 'ai-safe-young-workforce',
      items: aiSafeYoung,
      showSalary: true,
      extraColFn: (o) => (o.average_age ? [`${o.average_age.toFixed(1)} 歳`] : []),
      faqItems: FAQS['ai-safe-young-workforce'],
      title: '若手中心 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `平均年齢が若く AI 影響度も低い職業 TOP${TOP_N}。新卒・第二新卒の参考に。`,
      h1Text: `若手中心 × AI 安全 TOP${TOP_N}`,
      subText: 'AI 影響 <strong>5 以下</strong> × 平均年齢 <strong>昇順</strong>',
      introText: '若手が多く活躍し、かつ AI 代替リスクも低い職業をランキング。新卒・第二新卒のキャリア選択の参考に。',
      statBlocks: [
        ['TOP30 平均年齢', `${safeMean(aiSafeYoung, 'average_age').toFixed(1)} 歳`],
        ['TOP30 平均 AI 影響', `${safeMean(aiSafeYoung, 'ai_risk').toFixed(1)} / 10`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(aiSafeYoung, 'salary'))} 万円`],
      ],
    }],
    ['ai-safe-no-license', {
      slug: 'ai-safe-no-license',
      items: aiSafeNoLicense,
      showSalary: true,
      faqItems: FAQS['ai-safe-no-license'],
      title: '無資格 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `関連資格不要で AI 影響度も低い職業 TOP${aiSafeNoLicense.length}。資格に頼らず長く続けられる分野を一覧。`,
      h1Text: `無資格 × AI 安全 TOP${aiSafeNoLicense.length}`,
      subText: '関連資格 <strong>なし</strong> × AI 影響 <strong>5 以下</strong>',
      introText: '関連国家資格を要さず、AI 代替リスクも低い職業群。実務経験で勝負できる分野を中心にランキング。',
      statBlocks: [
        ['対象職業数', `${aiSafeNoLicense.length}`],
        ['平均 AI 影響', `${safeMean(aiSafeNoLicense, 'ai_risk').toFixed(1)} / 10`],
        ['平均年収', `${Math.trunc(safeMean(aiSafeNoLicense, 'salary'))} 万円`],
      ],
    }],
    ['ai-safe-physical', {
      slug: 'ai-safe-physical',
      items: aiSafePhysical,
      showSalary: true,
      faqItems: FAQS['ai-safe-physical'],
      title: '身体性 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `身体技能職で AI 影響度も低い職業 TOP${aiSafePhysical.length}。製造・建設・農林等の現場職を一覧。`,
      h1Text: `身体性 × AI 安全 TOP${aiSafePhysical.length}`,
      subText: '製造・建設・メンテ・農林・軽作業セクター × AI 影響 <strong>5 以下</strong>',
      introText: '手の感覚・現場判断・身体的調整を要する職業は AI で代替されにくく、構造的な優位性を持ちます。建設職人・整備士・農林漁業・配管工等が代表例。',
      statBlocks: [
        ['対象職業数', `${aiSafePhysical.length}`],
        ['平均 AI 影響', `${safeMean(aiSafePhysical, 'ai_risk').toFixed(1)} / 10`],
        ['平均年収', `${Math.trunc(safeMean(aiSafePhysical, 'salary'))} 万円`],
      ],
    }],
    ['ai-safe-interpersonal', {
      slug: 'ai-safe-interpersonal',
      items: aiSafeInterpersonal,
      showSalary: true,
      faqItems: FAQS['ai-safe-interpersonal'],
      title: '対人 × AI 安全な職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `対人スキル中心で AI 影響度も低い職業 TOP${aiSafeInterpersonal.length}。医療・福祉・教育・販売・サービス系を一覧。`,
      h1Text: `対人 × AI 安全 TOP${aiSafeInterpersonal.length}`,
      subText: '医療・福祉・教育・販売・サービスセクター × AI 影響 <strong>5 以下</strong>',
      introText: '感情の機微・信頼関係・即興的な調整を要する対人職は AI で代替しにくい。看護師・介護福祉士・保育士・教師・販売員・接客スタッフが代表例。',
      statBlocks: [
        ['対象職業数', `${aiSafeInterpersonal.length}`],
        ['平均 AI 影響', `${safeMean(aiSafeInterpersonal, 'ai_risk').toFixed(1)} / 10`],
        ['平均年収', `${Math.trunc(safeMean(aiSafeInterpersonal, 'salary'))} 万円`],
      ],
    }],
    ['regulated-protected', {
      slug: 'regulated-protected',
      items: regulatedProtected,
      showSalary: true,
      extraColFn: (o) => [`資格 ${o.certs.length}`],
      faqItems: FAQS['regulated-protected'],
      title: '規制で守られた職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `関連資格 2 個以上かつ AI 影響度 5 以下の職業 TOP${regulatedProtected.length}。参入障壁と AI 抗性を併せ持つ高度専門職を一覧。`,
      h1Text: `規制で守られた職業 TOP${regulatedProtected.length}`,
      subText: '関連資格 <strong>2 個以上</strong> × AI 影響 <strong>5 以下</strong>',
      introText: '複数の関連国家資格を要し、かつ AI 代替リスクも低い職業群。法的に守られた業務範囲を持つ高度専門職が中心です。',
      statBlocks: [
        ['対象職業数', `${regulatedProtected.length}`],
        ['平均資格数', regulatedProtected.length > 0 ? (regulatedProtected.reduce((s, o) => s + o.certs.length, 0) / regulatedProtected.length).toFixed(1) : '—'],
        ['平均年収', `${Math.trunc(safeMean(regulatedProtected, 'salary'))} 万円`],
      ],
    }],
    ['low-stress-stable', {
      slug: 'low-stress-stable',
      items: lowStressStable,
      showSalary: true,
      extraColFn: (o) => (o.monthly_hours ? [`月${Math.trunc(o.monthly_hours)}h`] : []),
      faqItems: FAQS['low-stress-stable'],
      title: '低ストレス安定職 TOP30【2026年版】| 未来の仕事',
      seoDesc: `月間労働時間 165 時間以下かつ AI 影響度 5 以下の職業 TOP${lowStressStable.length}。長く続けやすい安定職を一覧。`,
      h1Text: `低ストレス安定職 TOP${lowStressStable.length}`,
      subText: '月間労働時間 <strong>165 時間以下</strong> × AI 影響 <strong>5 以下</strong>',
      introText: '労働時間が短く、かつ AI 代替リスクも低い「長く続けやすい」職業群。教育・公務・専門職の一部が該当します。',
      statBlocks: [
        ['対象職業数', `${lowStressStable.length}`],
        ['TOP30 平均月間労働', `${Math.trunc(safeMean(lowStressStable, 'monthly_hours'))} 時間`],
        ['TOP30 平均 AI 影響', `${safeMean(lowStressStable, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
  ];

  return {
    aiSafeHighDemand,
    aiSafeShortHours,
    aiSafeYoung,
    aiSafeNoLicense,
    aiSafePhysical,
    aiSafeInterpersonal,
    regulatedProtected,
    lowStressStable,
    entries,
  };
}
