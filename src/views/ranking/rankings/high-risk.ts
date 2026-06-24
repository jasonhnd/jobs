/**
 * src/views/ranking/rankings/high-risk.ts — AI 高リスク系ランキング.
 *
 * Returns the RankingResult entries plus the pre-sorted Occupation[]
 * slices for the high-AI-risk theme so the orchestrator can reuse
 * them when assembling hub-card previews without recomputing.
 */

import { TOP_N, type Occupation, type RankingResult } from '../config.js';
import { byKeyDesc, safeMean, inSectorSet, CRAFT_SECTORS } from '../utilities.js';
import { FAQS } from '../../ranking-copy.js';
import { SCORE_ATTRIBUTION } from '../../../site/score-attribution.js';

export interface HighRiskRankings {
  aiHigh: Occupation[];
  meanHigh: number;
  aiReplacedSoon: Occupation[];
  aiResistantCraft: Occupation[];
  aiAtRiskPaid: Occupation[];
  aiAugmented: Occupation[];
  aiFrontier: Occupation[];
  entries: Array<[string, RankingResult]>;
}

export function buildHighRiskRankings(
  scored: Occupation[],
  limit = TOP_N,
): HighRiskRankings {
  // 1. AI risk high — sort -ai_risk, id asc
  const aiHigh = byKeyDesc(scored, (o) => o.ai_risk, (o) => o.id).slice(0, limit);
  const meanHigh = safeMean(aiHigh, 'ai_risk');

  // 15. AI 置き換えが進行中 (ai_risk >= 8 desc, workers as tie)
  const aiReplacedSoon = scored
    .filter((o) => (o.ai_risk ?? 0) >= 8)
    .sort((a, b) => {
      // ai_risk descending — higher risk first. (The earlier version named
      // the variables `ra = b.ai_risk` / `rb = a.ai_risk` and returned
      // `ra - rb`, which is correct but reads exactly backwards; any future
      // editor following the apparent convention would invert the sort.)
      const aRisk = a.ai_risk ?? 0;
      const bRisk = b.ai_risk ?? 0;
      if (aRisk !== bRisk) return bRisk - aRisk;
      return (b.workers ?? 0) - (a.workers ?? 0);
    })
    .slice(0, limit);
  const meanAiReplaced = safeMean(aiReplacedSoon, 'ai_risk');

  // 16. 伝統技能で AI に強い (ai_risk <= 3 + craft sectors)
  const aiResistantCraft = scored
    .filter((o) => (o.ai_risk ?? 999) <= 3 && inSectorSet(o, CRAFT_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || a.id - b.id)
    .slice(0, limit);

  // 17. AI リスク高 × 高年収
  const aiAtRiskPaid = scored
    .filter((o) => (o.ai_risk ?? 0) >= 7 && (o.salary ?? 0) >= 500)
    .sort((a, b) => {
      const sa = b.salary ?? 0; const sb = a.salary ?? 0;
      if (sa !== sb) return sa - sb;
      return (b.ai_risk ?? 0) - (a.ai_risk ?? 0);
    })
    .slice(0, limit);

  // 18. AI で補強される (ai_risk 4-6, sort by salary desc)
  const aiAugmented = scored
    .filter((o) => (o.ai_risk ?? -1) >= 4 && (o.ai_risk ?? -1) <= 6)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id)
    .slice(0, limit);

  // 19. AI を使いこなす側 (sector=it + ai_risk >= 5)
  const aiFrontier = scored
    .filter((o) => o.sector_id === 'it' && (o.ai_risk ?? 0) >= 5)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id)
    .slice(0, limit);

  const entries: Array<[string, RankingResult]> = [
    ['ai-risk-high', {
      slug: 'ai-risk-high',
      items: aiHigh,
      showSalary: true,
      faqItems: FAQS['ai-risk-high'],
      title: 'AIに奪われる仕事ランキング TOP30【2026年版】| 未来の仕事',
      seoDesc: `AI影響度が最も高い職業TOP${TOP_N}。平均スコア${meanHigh.toFixed(1)}/10。AI代替リスク・年収・就業者数を一覧比較。${SCORE_ATTRIBUTION.modelDisplay}独自分析（非公式）。`,
      h1Text: `AIに奪われる仕事 TOP${TOP_N}`,
      subText: `AI 影響度が最も <strong>高い</strong> 職業ランキング（${scored.length} 職業中）`,
      introText: `厚労省の職業データに基づき、${SCORE_ATTRIBUTION.modelDisplay} が AIOIS-10 で AI 影響を分析。0〜10 のスコアが高い職業ほど、業務の多くがAIで代替・補助される可能性があります。ただし「仕事がなくなる」という意味ではありません。`,
      statBlocks: [
        ['対象職業数', `${scored.length}`],
        ['TOP30 平均 AI 影響', `${meanHigh.toFixed(1)} / 10`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(aiHigh, 'salary'))} 万円`],
        ['TOP30 平均年齢', `${safeMean(aiHigh, 'average_age').toFixed(1)} 歳`],
      ],
    }],
    ['ai-replaced-soon', {
      slug: 'ai-replaced-soon',
      items: aiReplacedSoon,
      showSalary: true,
      faqItems: FAQS['ai-replaced-soon'],
      title: 'AI 置き換えが進む職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `AI 影響度 8/10 以上の職業 TOP${TOP_N}。業務再設計が急務な分野を AI 影響度・年収と共に一覧。`,
      h1Text: `AI 置き換えが進む職業 TOP${TOP_N}`,
      subText: 'AI 影響度 <strong>8/10 以上</strong> の職業ランキング',
      introText: '5-10 年で業務内容が大きく変わる可能性が高い、AI 影響度 8 以上の職業群。職業自体が消えるわけではなく、業務再設計が急務であるシグナルです。',
      statBlocks: [
        ['対象職業数', `${aiReplacedSoon.length}`],
        ['TOP30 平均 AI 影響', `${meanAiReplaced.toFixed(1)} / 10`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(aiReplacedSoon, 'salary'))} 万円`],
      ],
    }],
    ['ai-resistant-craft', {
      slug: 'ai-resistant-craft',
      items: aiResistantCraft,
      showSalary: true,
      faqItems: FAQS['ai-resistant-craft'],
      title: '伝統技能で AI に強い職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `製造・建設・メンテ・農林系で AI 影響度が低い職業 TOP${aiResistantCraft.length}。手技中心で AI 代替が難しい分野を一覧。`,
      h1Text: `伝統技能で AI に強い職業 TOP${aiResistantCraft.length}`,
      subText: '製造・建設・メンテ系で AI 影響度 <strong>3 以下</strong> の技能職',
      introText: '手技・経験的判断・身体的調整を要する技能職は AI で代替しにくく、製造・建設・メンテ・農林の現場職が低 AI 影響度のまま安定する傾向にあります。',
      statBlocks: [
        ['対象職業数', `${aiResistantCraft.length}`],
        ['TOP 平均 AI 影響', `${safeMean(aiResistantCraft, 'ai_risk').toFixed(1)} / 10`],
        ['TOP 平均年収', `${Math.trunc(safeMean(aiResistantCraft, 'salary'))} 万円`],
      ],
    }],
    ['ai-at-risk-but-paid', {
      slug: 'ai-at-risk-but-paid',
      items: aiAtRiskPaid,
      showSalary: true,
      faqItems: FAQS['ai-at-risk-but-paid'],
      title: 'AI リスク高 × 高年収の職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `AI 影響度 7+ かつ年収 500 万円以上の「要注意組」TOP${aiAtRiskPaid.length}。今は稼げるが業務再設計が前提の分野。`,
      h1Text: `AI リスク高 × 高年収 TOP${aiAtRiskPaid.length}`,
      subText: 'AI 影響度 <strong>7 以上</strong> × 年収 <strong>500 万円以上</strong> の要注意組',
      introText: 'AI で代替されやすいが現状の年収はまだ高い職業群。今は稼げるが、5-10 年での業務再設計や AI を使いこなす側へのシフトが鍵です。',
      statBlocks: [
        ['対象職業数', `${aiAtRiskPaid.length}`],
        ['平均年収', `${Math.trunc(safeMean(aiAtRiskPaid, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(aiAtRiskPaid, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
    ['ai-augmented', {
      slug: 'ai-augmented',
      items: aiAugmented,
      showSalary: true,
      faqItems: FAQS['ai-augmented'],
      title: 'AI で補強される職業 TOP30【2026年版】| 未来の仕事',
      seoDesc: `AI 影響度 4-6 で AI で業務が増強される職業 TOP${TOP_N}。年収順で並べた「AI 共存域」の職業一覧。`,
      h1Text: `AI で補強される職業 TOP${TOP_N}`,
      subText: 'AI 影響度 <strong>4-6</strong> の AI 共存域・年収順ランキング',
      introText: 'AI が業務を一部肩代わりする「補強域」の職業。完全代替されるリスクは低いが、AI ツールを使いこなせるかでパフォーマンス差が広がります。',
      statBlocks: [
        ['対象職業数', `${aiAugmented.length}`],
        ['TOP30 平均 AI 影響', `${safeMean(aiAugmented, 'ai_risk').toFixed(1)} / 10`],
        ['TOP30 平均年収', `${Math.trunc(safeMean(aiAugmented, 'salary'))} 万円`],
      ],
    }],
    ['ai-frontier', {
      slug: 'ai-frontier',
      items: aiFrontier,
      showSalary: true,
      faqItems: FAQS['ai-frontier'],
      title: 'AI を使いこなす側の職業 TOP21【2026年版】| 未来の仕事',
      seoDesc: `IT・通信セクターで AI を活用する職業 TOP${aiFrontier.length}。AI フロンティア職を年収・AI 影響度と共に一覧。`,
      h1Text: `AI を使いこなす側の職業 TOP${aiFrontier.length}`,
      subText: 'IT・通信セクターで AI 影響度 <strong>5 以上</strong> の AI フロンティア職',
      introText: 'AI を使う側に立ち、業務に AI を活用・組み込む立場の職業群。IT エンジニア・データサイエンティスト・AI コーディング等が該当します。',
      statBlocks: [
        ['対象職業数', `${aiFrontier.length}`],
        ['平均年収', `${Math.trunc(safeMean(aiFrontier, 'salary'))} 万円`],
        ['平均 AI 影響', `${safeMean(aiFrontier, 'ai_risk').toFixed(1)} / 10`],
      ],
    }],
  ];

  return { aiHigh, meanHigh, aiReplacedSoon, aiResistantCraft, aiAtRiskPaid, aiAugmented, aiFrontier, entries };
}
