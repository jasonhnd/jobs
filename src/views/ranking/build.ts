/**
 * src/views/ranking/build.ts — buildRankings() orchestrator.
 *
 * Extracted from src/views/ranking.ts (2026-05-17, audit finding
 * CODE-010 — splitting the 1411-line monolith). Wires together the
 * per-theme builders under ./rankings/* and assembles the hub data
 * (global stats, sector insights, ranking-card previews).
 */

import { escapeHtml } from '../../lib/safe-html.js';
import { fmtInt } from '../../lib/num.js';
import {
  type Occupation,
  type RankingsBundle,
  type RankingsHubGroup,
  type RankingSlug,
  type RankingResult,
  type RankingGroupKey,
  TOP_N,
  DEMAND_JA,
  RANKING_GROUPS,
} from './config.js';
import { safeMean, makePreview, eduPct, gradPct, empPct, EDU, EMP } from './utilities.js';

import { buildHighRiskRankings } from './rankings/high-risk.js';
import { buildLowRiskRankings } from './rankings/low-risk.js';
import { buildSalaryRankings } from './rankings/salary.js';
import { buildWorkforceRankings } from './rankings/workforce.js';
import { buildWorkConditionsRankings } from './rankings/work-conditions.js';
import { buildEmploymentRankings } from './rankings/employment.js';
import { buildEducationRankings } from './rankings/education.js';
import { buildIntentRankings } from './rankings/intent.js';
import { OCCUPATION_COUNT } from '../../site/config.js';

export interface BuildRankingsOptions {
  /**
   * Max items returned per ranking. The default keeps the public TOP-N page
   * contract; data projections can pass Infinity to inspect the full sorted
   * ranking universe without changing page output.
   */
  limit?: number;
}

/**
 * `loader` lets callers inject a graph-based Occupation producer instead
 * of the default treemap.json + data.detail/* reader. Step 5 of the
 * architecture migration uses this to route ranking pages through the
 * knowledge graph.
 */
export function buildRankings(
  loader: () => Occupation[],
  options: BuildRankingsOptions = {},
): RankingsBundle {
  const limit = options.limit ?? TOP_N;
  const occs = loader();
  const scored = occs.filter((o) => o.ai_risk !== null);
  const withSalary = occs.filter((o) => o.salary && o.ai_risk !== null);

  const allMeanRisk = safeMean(scored, 'ai_risk');
  const allMeanSalary = safeMean(occs.filter((o) => o.salary), 'salary');
  const allWorkers = occs.reduce((s, o) => s + (o.workers ?? 0), 0);

  // Theme builders — each owns its filter/sort logic + result objects.
  const highRisk = buildHighRiskRankings(scored, limit);
  const lowRisk = buildLowRiskRankings(scored, withSalary, limit);
  const salary = buildSalaryRankings(occs, scored, limit);
  const workforce = buildWorkforceRankings(occs, scored, limit);
  const workConditions = buildWorkConditionsRankings(occs, limit);
  const employment = buildEmploymentRankings(occs, scored, limit);
  const education = buildEducationRankings(occs, scored, limit);
  const intent = buildIntentRankings(scored, limit);

  // ─── Assemble results map (slug → RankingResult) ──────────────────────
  const results = new Map<RankingSlug, RankingResult>();
  const allEntries: Array<[string, RankingResult]> = [
    ...highRisk.entries,
    ...lowRisk.entries,
    ...salary.entries,
    ...workforce.entries,
    ...workConditions.entries,
    ...employment.entries,
    ...education.entries,
    ...intent.entries,
  ];
  for (const [slug, result] of allEntries) {
    results.set(slug as RankingSlug, result);
  }

  // ─── Hub data ────────────────────────────────────────────────────────
  const globalStats: Array<readonly [string, string]> = [
    ['総職業数', `${OCCUPATION_COUNT.SCORED}`],
    ['全体平均 AI 影響', `${allMeanRisk.toFixed(1)} / 10`],
    ['全体平均年収', `${Math.trunc(allMeanSalary)} 万円`],
    ['総就業者数', `${Math.round(allWorkers / 10000)} 万人`],
  ];

  const sectorRisks = new Map<string, number[]>();
  for (const o of scored) {
    const sid = o.sector_ja || '';
    if (sid) {
      const arr = sectorRisks.get(sid) ?? [];
      arr.push(o.ai_risk ?? 0);
      sectorRisks.set(sid, arr);
    }
  }
  const sectorMeanRisks = new Map<string, number>();
  for (const [s, v] of sectorRisks.entries()) {
    if (v.length > 0) sectorMeanRisks.set(s, v.reduce((a, b) => a + b, 0) / v.length);
  }
  let highestRiskSector = '';
  let lowestRiskSector = '';
  let maxMean = -Infinity;
  let minMean = Infinity;
  for (const [s, m] of sectorMeanRisks.entries()) {
    if (m > maxMean) {
      maxMean = m;
      highestRiskSector = s;
    }
    if (m < minMean) {
      minMean = m;
      lowestRiskSector = s;
    }
  }

  const insights = [
    `<strong>${escapeHtml(highestRiskSector)}</strong>セクターはAI影響度平均${(sectorMeanRisks.get(highestRiskSector) ?? 0).toFixed(1)}と全セクターで最高`,
    `<strong>${escapeHtml(lowestRiskSector)}</strong>セクターはAI影響度平均${(sectorMeanRisks.get(lowestRiskSector) ?? 0).toFixed(1)}と最も低い`,
    `年収上位30職業の平均AI影響度は<strong>${safeMean(salary.bySalary, 'ai_risk').toFixed(1)}/10</strong>と中程度`,
    '就業者数上位は事務・販売系が占めるが、AI影響度は<strong>高め</strong>の傾向',
    'AI影響度が低い職業ほど<strong>身体性・対人スキル</strong>を求められる傾向',
  ];

  const cards: RankingsBundle['hub']['cards'] = [
    // ── Phase 1 baseline (9) ──
    { slug: 'ai-risk-high', name: 'AIに奪われる仕事 TOP30', desc: 'AI影響度が高い職業ランキング', count: highRisk.aiHigh.length, preview: makePreview(highRisk.aiHigh, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-risk-low', name: 'AI影響が少ない仕事 TOP30', desc: 'AIリスクが低く将来性のある職業', count: lowRisk.aiLow.length, preview: makePreview(lowRisk.aiLow, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'salary-safe', name: '高年収×低AIリスク TOP30', desc: '年収が高くAI代替リスクが低い職業', count: lowRisk.salarySafe.length, preview: makePreview(lowRisk.salarySafe, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'workers', name: '就業者数ランキング TOP30', desc: '日本で最も就業者が多い職業', count: workforce.byWorkers.length, preview: makePreview(workforce.byWorkers, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'salary', name: '年収ランキング TOP30', desc: '年収が最も高い職業', count: salary.bySalary.length, preview: makePreview(salary.bySalary, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'entry-salary', name: '初任給ランキング TOP30', desc: '初任給が高い職業', count: salary.byEntry.length, preview: makePreview(salary.byEntry, (o) => `初任給 ${Math.trunc(o.recruit_wage ?? 0)}万円`) },
    { slug: 'young-workforce', name: '平均年齢が若い職業 TOP30', desc: '若手が活躍する職業', count: workforce.byYoung.length, preview: makePreview(workforce.byYoung, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'short-hours', name: '労働時間が短い職業 TOP30', desc: 'ワークライフバランスに優れた職業', count: workConditions.byHours.length, preview: makePreview(workConditions.byHours, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}時間`) },
    { slug: 'high-demand', name: '人手不足の職業 TOP30', desc: '求人需要が高い職業', count: workConditions.byDemand.length, preview: makePreview(workConditions.byDemand, (o) => DEMAND_JA[o.demand_band ?? ''] ?? '') },
    // ── Phase 2 単軸 (5) ──
    { slug: 'hourly-wage', name: '時給が高い職業 TOP30', desc: '時給ベースで報酬が高い職業', count: workConditions.byHourly.length, preview: makePreview(workConditions.byHourly, (o) => `¥${(o.hourly_wage ?? 0).toLocaleString('en-US')}`) },
    { slug: 'recruit-ratio', name: '求人倍率が高い職業 TOP30', desc: '人手不足が顕著な売り手市場', count: workConditions.byRecruitRatio.length, preview: makePreview(workConditions.byRecruitRatio, (o) => `${(o.recruit_ratio ?? 0).toFixed(2)}倍`) },
    { slug: 'aging-workforce', name: 'シニア中心の職業 TOP30', desc: '平均年齢が高く経験者が活躍', count: workforce.byAging.length, preview: makePreview(workforce.byAging, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'monthly-hours-long', name: '労働時間が長い職業 TOP30', desc: '月間労働時間が長い職業', count: workConditions.byHoursLong.length, preview: makePreview(workConditions.byHoursLong, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}時間`) },
    { slug: 'recruit-ratio-low', name: '求人倍率が低い職業 TOP30', desc: '採用競争が厳しい買い手市場', count: workConditions.byRecruitLow.length, preview: makePreview(workConditions.byRecruitLow, (o) => `${(o.recruit_ratio ?? 0).toFixed(2)}倍`) },
    // ── Phase 2 AI 軸派生 (6) ──
    { slug: 'ai-replaced-soon', name: 'AI 置き換えが進む職業', desc: 'AI 影響度 8 以上、業務再設計が急務', count: highRisk.aiReplacedSoon.length, preview: makePreview(highRisk.aiReplacedSoon, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-resistant-craft', name: '伝統技能で AI に強い職業', desc: '製造・建設・メンテ系の技能職', count: highRisk.aiResistantCraft.length, preview: makePreview(highRisk.aiResistantCraft, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-at-risk-but-paid', name: 'AI リスク高 × 高年収', desc: 'AI 影響度高でも現状年収高の要注意組', count: highRisk.aiAtRiskPaid.length, preview: makePreview(highRisk.aiAtRiskPaid, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'ai-augmented', name: 'AI で補強される職業', desc: 'AI 影響度 4-6 の AI 共存域', count: highRisk.aiAugmented.length, preview: makePreview(highRisk.aiAugmented, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-frontier', name: 'AI を使いこなす側の職業', desc: 'IT・通信セクターの AI フロンティア職', count: highRisk.aiFrontier.length, preview: makePreview(highRisk.aiFrontier, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'ai-stable-employment', name: 'AI 安全 × 正規雇用率高', desc: '低 AI 影響かつ正社員中心の安定職', count: employment.aiStableEmployment.length, preview: makePreview(employment.aiStableEmployment, (o) => `正規 ${empPct(o, EMP.regular).toFixed(0)}%`) },
    // ── Phase 2 組合せ (8) ──
    { slug: 'ai-safe-high-demand', name: '高需要 × AI 安全', desc: '人手不足かつ AI 影響度が低い', count: intent.aiSafeHighDemand.length, preview: makePreview(intent.aiSafeHighDemand, (o) => DEMAND_JA[o.demand_band ?? ''] ?? '') },
    { slug: 'ai-safe-short-hours', name: '低労働時間 × AI 安全', desc: '労働時間が短く AI 影響も低い', count: intent.aiSafeShortHours.length, preview: makePreview(intent.aiSafeShortHours, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}h`) },
    { slug: 'ai-safe-young-workforce', name: '若手中心 × AI 安全', desc: '平均年齢が若くて AI 影響も低い', count: intent.aiSafeYoung.length, preview: makePreview(intent.aiSafeYoung, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'ai-safe-no-license', name: '無資格 × AI 安全', desc: '資格なしで就けて AI 影響も低い', count: intent.aiSafeNoLicense.length, preview: makePreview(intent.aiSafeNoLicense, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-safe-physical', name: '身体性 × AI 安全', desc: '身体技能職で AI 影響も低い', count: intent.aiSafePhysical.length, preview: makePreview(intent.aiSafePhysical, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-safe-interpersonal', name: '対人 × AI 安全', desc: '対人スキル中心で AI 影響も低い', count: intent.aiSafeInterpersonal.length, preview: makePreview(intent.aiSafeInterpersonal, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'high-salary-high-demand', name: '高年収 × 高需要', desc: '年収が高くかつ人手不足の職業', count: salary.highSalaryHighDemand.length, preview: makePreview(salary.highSalaryHighDemand, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'high-salary-young-entry', name: '初任給が高い × 若手活躍', desc: '初任給が高くて若手が多い', count: salary.highSalaryYoungEntry.length, preview: makePreview(salary.highSalaryYoungEntry, (o) => `初任給 ${Math.trunc(o.recruit_wage ?? 0)}万円`) },
    // ── Phase 2 教育・資格軸 (5) ──
    { slug: 'license-required', name: '国家資格が必要な職業', desc: '関連資格が多い高度専門職', count: education.licenseRequired.length, preview: makePreview(education.licenseRequired, (o) => `資格 ${o.certs.length}`) },
    { slug: 'no-license-required', name: '無資格で就ける × AI 安全', desc: '資格不要かつ AI リスク低', count: education.noLicenseRequired.length, preview: makePreview(education.noLicenseRequired, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'high-school-ok', name: '高卒で目指せる職業', desc: '高卒比率 30% 以上の職業', count: education.highSchoolOk.length, preview: makePreview(education.highSchoolOk, (o) => `高卒 ${eduPct(o, EDU.highSchool).toFixed(0)}%`) },
    { slug: 'university-required', name: '大卒以上が中心の職業', desc: '大卒比率 50% 以上の職業', count: education.universityRequired.length, preview: makePreview(education.universityRequired, (o) => `大卒 ${eduPct(o, EDU.university).toFixed(0)}%`) },
    { slug: 'graduate-school-required', name: '大学院卒中心の職業', desc: '修士・博士課程修了者が多い', count: education.graduateSchoolRequired.length, preview: makePreview(education.graduateSchoolRequired, (o) => `院卒 ${gradPct(o).toFixed(0)}%`) },
    // ── Phase 2 ニッチ (6) ──
    { slug: 'public-sector', name: '公的機関・公務員系の職業', desc: '保安・公安セクターの公務員職', count: employment.publicSector.length, preview: makePreview(employment.publicSector, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'freelance-friendly', name: 'フリーランス向きの職業', desc: '自営・フリーランス比率 20% 以上', count: employment.freelanceFriendly.length, preview: makePreview(employment.freelanceFriendly, (o) => `フリー ${empPct(o, EMP.selfEmployedFreelance).toFixed(0)}%`) },
    { slug: 'self-employed-typical', name: '独立・開業が典型の職業', desc: '独立がキャリアの自然な到達点', count: employment.selfEmployedTypical.length, preview: makePreview(employment.selfEmployedTypical, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'large-workforce-stable', name: '大規模就業 × AI 安全', desc: '就業者 5 万人+ かつ AI 影響低', count: workforce.largeWorkforceStable.length, preview: makePreview(workforce.largeWorkforceStable, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'regulated-protected', name: '規制で守られた職業', desc: '関連資格 2 個+ かつ AI 影響低', count: intent.regulatedProtected.length, preview: makePreview(intent.regulatedProtected, (o) => `資格 ${o.certs.length}`) },
    { slug: 'low-stress-stable', name: '低ストレス安定職', desc: '短い労働時間 × 低 AI 影響', count: intent.lowStressStable.length, preview: makePreview(intent.lowStressStable, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}h`) },
  ];

  // ─── RA-128: group hub cards into 6 thematic buckets ────────────────
  const cardBySlug = new Map(cards.map((c) => [c.slug, c]));
  const groups: RankingsHubGroup[] = (Object.keys(RANKING_GROUPS) as RankingGroupKey[]).map((key) => {
    const def = RANKING_GROUPS[key];
    return {
      key,
      label_ja: def.label_ja,
      lede_ja: def.lede_ja,
      cards: def.slugs
        .map((s) => cardBySlug.get(s as RankingSlug))
        .filter((c): c is NonNullable<typeof c> => c !== undefined),
    };
  });

  return { results, hub: { globalStats, insights, cards, groups } };
}
