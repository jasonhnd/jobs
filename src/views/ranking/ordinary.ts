/** Ordinary presentation over the existing ranked result: no sorting or scoring. */
import type { Occupation, RankingResult } from './config';
import { fmtInt } from '../../lib/num';
import { formatRiskScoreLabel } from '../../lib/score-format';
import { riskClass } from '../../lib/risk';
import { occupationPath } from '../../lib/urls';
import { ORDINARY_RANKING_COPY as copy, ORDINARY_RANKING_LEADS, isOrdinaryRankingSlug, type OrdinaryRankingSlug } from '../../site/ordinary-ranking-copy';

const METRIC_LABELS: Readonly<Record<OrdinaryRankingSlug, string>> = {
  'ai-risk-high': 'AI変化度', 'ai-risk-low': 'AI変化度', workers: '就業者数',
  salary: '年収', 'salary-safe': '年収', 'short-hours': '月間労働時間',
  'hourly-wage': '換算時給', 'high-demand': '求人需要',
};

/** Uses graph-owned converted hourly wages; never recomputes from browser values. */
export function ordinaryRankingMetric(o: Occupation, slug: OrdinaryRankingSlug): string {
  const number = (n: number | null | undefined, format: (value: number) => string): string =>
    n == null || !Number.isFinite(n) ? '—' : format(n);
  switch (slug) {
    case 'workers': return number(o.workers, n => `${fmtInt(n)}人`);
    case 'salary': case 'salary-safe': return number(o.salary, n => `${Math.trunc(n)}万円`);
    case 'short-hours': return number(o.monthly_hours, n => `${Math.trunc(n)}時間`);
    case 'hourly-wage': return number(o.hourly_wage, n => `${n.toLocaleString('en-US')}円/時`);
    case 'high-demand': return o.demand_band ? { hot: '高需要', normal: '通常', cold: '低需要' }[o.demand_band] : '—';
    default: return formatRiskScoreLabel(o.ai_risk);
  }
}

export function buildOrdinaryRankingView(result: RankingResult) {
  if (!isOrdinaryRankingSlug(result.slug)) throw new Error(`No ordinary presentation: ${result.slug}`);
  const slug = result.slug;
  const h1 = slug === 'ai-risk-high' ? copy.highTitle.replace('TOP30', `TOP${result.items.length}`) : result.h1Text;
  const lead = ORDINARY_RANKING_LEADS[slug];
  return {
    slug, h1,
    title: slug === 'ai-risk-high' ? result.title.replace('AIに奪われる仕事ランキング', 'AIで大きく変わる仕事') : result.title,
    description: lead + (slug === 'hourly-wage' ? copy.hourlyNote : ''),
    lead,
    note: slug === 'hourly-wage' ? copy.hourlyNote : null,
    isAiRanking: slug === 'ai-risk-high' || slug === 'ai-risk-low',
    rows: result.items.map(o => ({
      id: o.id, href: occupationPath(o.id), name: o.title_ja ?? `#${o.id}`,
      metricLabel: METRIC_LABELS[slug], metric: ordinaryRankingMetric(o, slug),
      score: formatRiskScoreLabel(o.ai_risk), band: riskClass(o.ai_risk),
    })),
  };
}
export type OrdinaryRankingView = ReturnType<typeof buildOrdinaryRankingView>;
export type OrdinaryRankingRow = OrdinaryRankingView['rows'][number];
