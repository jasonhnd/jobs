/**
 * src/views/rankings.ts — data utilities for the ja/rankings/* pages.
 *
 * Migrated from src/data/lib/rankings.ts 2026-05-14 (Phase B).
 * The largest single Phase B migration (1425 lines). Architectural
 * smell: mixes file I/O, data shaping, HTML rendering, and JSON-LD
 * — Phase C should split. For Phase B 'retire data/lib' scope,
 * kept as one file to limit blast radius.
 *
 *
 *   - loadOccupations()      reads public/data.treemap.json
 *   - buildRankings()        applies top-N sort/filter rules per ranking slug
 *   - buildHubData()         global stats / sector insights for the hub page
 *
 * Source: public/data.treemap.json (552 records). Field names differ from the
 * per-occupation detail files: name_ja → title_ja, hours → monthly_hours,
 * age → average_age (a quirk preserved for backward-compat with downstream).
 *
 * Reads the file via fs at import time (Astro frontmatter).
 */
// Phase D audit #6 (2026-05-14): removed `node:fs` imports + legacy
// loadOccupations() + loadCertsById() (read public/data.treemap.json
// and public/data.detail/*.json directly). Per doc §3.3 views must not
// do I/O — all callers pass a graph-backed loader via the buildRankings()
// loader argument (see loadOccupationsFromGraph below).

export const TOP_N = 30;

export interface Occupation {
  id: number;
  title_ja: string | null;
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  monthly_hours: number | null;
  average_age: number | null;
  recruit_wage: number | null;
  /** 有効求人倍率 (Phase 2 で必要) */
  recruit_ratio: number | null;
  demand_band: string | null;
  sector_id: string;
  sector_ja: string;
  /** Phase 2: 学歴分布 (JA-key %、treemap.json の education_pct から) */
  education_pct: Record<string, number> | null;
  /** Phase 2: 雇用形態分布 (JA-key %、treemap.json の employment_type から) */
  employment_type: Record<string, number> | null;
  /** Phase 2: 関連資格リスト (data.detail/<id>.json の related_certs_ja から、別 fetch) */
  certs: ReadonlyArray<string>;
  /** Phase 2: 派生時給 (recruit_wage_man_yen × 10000 / 160h、なければ null) */
  hourly_wage: number | null;
}

// Phase D audit #6 (2026-05-14): removed legacy TreemapFileSchema +
// DetailFileMinimalSchema (zod-validated runtime types for the two file
// shapes that loadOccupations / loadCertsById used to parse). The
// canonical data shape now flows from the graph via
// loadOccupationsFromGraph below.

// ---------------------------------------------------------------------------
// Phase 2: filter / classification helpers (sector groups, education tiers,
// employment-type pivots). These keep the buildRankings() body readable —
// new rankings should use these helpers instead of inline boolean conditions.
// ---------------------------------------------------------------------------

/** Sector groups used by physical / interpersonal / craft rankings. */
const PHYSICAL_SECTORS: ReadonlySet<string> = new Set([
  'seizo', 'maint', 'kensetu', 'noringyo', 'keiseki',
]);
const INTERPERSONAL_SECTORS: ReadonlySet<string> = new Set([
  'iryo', 'fukushi', 'kyoiku', 'hanbai', 'service',
]);
const CRAFT_SECTORS: ReadonlySet<string> = new Set([
  'seizo', 'maint', 'kensetu', 'keiseki', 'noringyo',
]);
const PUBLIC_SECTORS: ReadonlySet<string> = new Set([
  'hoan', // 保安・公安 (police/fire/etc)
]);

function inSectorSet(o: Occupation, set: ReadonlySet<string>): boolean {
  return set.has(o.sector_id);
}

/**
 * Pull a 学歴 key from education_pct (JA keys: 高卒 / 大卒 / 修士 etc.).
 * Returns 0 when missing — safe for sort comparisons.
 */
function eduPct(o: Occupation, key: string): number {
  return o.education_pct?.[key] ?? 0;
}

/**
 * 大学院卒比率 = 修士 + 博士 (combined).
 */
function gradPct(o: Occupation): number {
  return eduPct(o, '修士課程卒（修士と同等の専門職学位を含む）') + eduPct(o, '博士課程卒');
}

/**
 * Pull 雇用形態 key (JA: 正規 / パートタイマー / 自営、フリーランス etc.).
 */
function empPct(o: Occupation, key: string): number {
  return o.employment_type?.[key] ?? 0;
}

// ---------------------------------------------------------------------------
// Constants and metadata (mirrors scripts/build_rankings.py).
// ---------------------------------------------------------------------------

export const DEMAND_SCORE: Record<string, number> = {
  hot: 4,
  warm: 3,
  cool: 2,
  cold: 1,
};

export const DEMAND_JA: Record<string, string> = {
  hot: '需要高',
  warm: 'やや高',
  cool: '安定',
  cold: '低',
};

// Slug + display metadata live in rankings-meta.ts (a pure-data module
// with no fs imports) so api/og.tsx can also consume them without
// pulling fs into the Edge Function bundle. Re-exported here for
// back-compat with existing consumers of `RankingSlug` and
// `ALL_RANKINGS` from this file.
import { RANKING_META, type RankingSlug as RankingSlugMeta } from './rankings-meta.js';
// Pulled back into local scope for buildRankings(). The same symbols are
// also re-exported from the bottom of this file for external consumers.
import { FAQS } from './ranking-copy.js';
// Phase D cleanup (2026-05-14): doc §6.2 forbids views from importing
// runtime values from templates. escapeHtml is pulled from lib/ directly;
// only the ExtraCol type stays from templates (type-only is permitted).
import { escapeHtml } from '../lib/safe-html.js';
import type { ExtraCol } from '../templates/Ranking.js';

export type RankingSlug = RankingSlugMeta;

export const ALL_RANKINGS: ReadonlyArray<readonly [RankingSlug, string, string]> =
  RANKING_META.map((m) => [m.slug, m.name_ja, m.description_ja] as const);


// ---------------------------------------------------------------------------
// Sort / filter rules per ranking (mirrors scripts/build_rankings.py:main).
// ---------------------------------------------------------------------------

function byKeyDesc<T>(items: T[], key: (o: T) => number | null | undefined, tie: (o: T) => number = () => 0): T[] {
  return [...items].sort((a, b) => {
    const av = key(a) ?? 0;
    const bv = key(b) ?? 0;
    if (bv !== av) return bv - av;
    return tie(a) - tie(b);
  });
}

function byKeyAsc<T>(items: T[], key: (o: T) => number | null | undefined, tie: (o: T) => number = () => 0): T[] {
  return [...items].sort((a, b) => {
    const av = key(a) ?? 0;
    const bv = key(b) ?? 0;
    if (av !== bv) return av - bv;
    return tie(a) - tie(b);
  });
}

export interface RankingResult {
  slug: RankingSlug;
  items: Occupation[];
  /** Stats prepared for the page header `<dl class="stats">`. */
  statBlocks: ReadonlyArray<readonly [string, string]>;
  /**
   * Optional extra metric per item, rendered before salary. Returns a list
   * of typed extra-col descriptors that the renderer escapes safely — see
   * `ExtraCol` in ranking-renderers.ts. Plain strings show as the standard
   * `rl-extra` chip; `{ kind: 'demand-pill', … }` produces the colored
   * demand badge.
   */
  extraColFn?: (o: Occupation) => ExtraCol[];
  /** Whether to show the salary chip. */
  showSalary: boolean;
  faqItems: ReadonlyArray<readonly [string, string]>;
  // Page metadata (mirrors render_page args).
  title: string;
  seoDesc: string;
  h1Text: string;
  /** Allowed to contain inline <strong> markup; rendered raw. */
  subText: string;
  introText: string;
}

// `export` so ranking-renderers.ts can reuse them. Exposed-internal helpers,
// not part of the rankings.ts façade — callers should still import from
// './rankings.js' to keep the public surface in one place.
export function safeMean(items: Occupation[], key: keyof Occupation): number {
  const vals = items
    .map((o) => o[key])
    .filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

// Single source of truth lives at src/lib/num. Re-exported under the
// existing public name so ranking-renderers + sibling consumers
// (which still import `fmtInt` from this module) keep working.
import { fmtInt } from '../lib/num.js';
export { fmtInt };

export interface RankingsBundle {
  results: Map<RankingSlug, RankingResult>;
  hub: {
    globalStats: ReadonlyArray<readonly [string, string]>;
    /**
     * Pre-rendered safe HTML fragments for the rankings-hub "insights"
     * block. Each string is built in this module via escapeHtml() over
     * sector names plus literal <strong> emphasis — i.e. the contract is
     * "fully trusted HTML; downstream MUST NOT re-escape and MUST NOT
     * concatenate with untrusted data". Callers in pages do `set:html`.
     */
    insights: string[];
    cards: Array<{ slug: RankingSlug; name: string; desc: string; count: number; preview: string }>;
  };
}

/**
 * `loader` lets callers inject a graph-based Occupation producer instead
 * of the default treemap.json + data.detail/* reader. Step 5 of the
 * architecture migration uses this to route ranking pages through the
 * knowledge graph.
 */
export function buildRankings(
  loader: () => Occupation[],
): RankingsBundle {
  const occs = loader();
  const scored = occs.filter((o) => o.ai_risk !== null);
  const withSalary = occs.filter((o) => o.salary && o.ai_risk !== null);

  const allMeanRisk = safeMean(scored, 'ai_risk');
  const allMeanSalary = safeMean(occs.filter((o) => o.salary), 'salary');
  const allWorkers = occs.reduce((s, o) => s + (o.workers ?? 0), 0);

  // 1. AI risk high — sort -ai_risk, id asc
  const aiHigh = byKeyDesc(scored, (o) => o.ai_risk, (o) => o.id).slice(0, TOP_N);
  const meanHigh = safeMean(aiHigh, 'ai_risk');

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

  // 4. Workers
  const byWorkers = byKeyDesc(
    occs.filter((o) => o.workers),
    (o) => o.workers,
  ).slice(0, TOP_N);
  const totalWorkersTop = byWorkers.reduce((s, o) => s + (o.workers ?? 0), 0);

  // 5. Salary (pure)
  const bySalary = byKeyDesc(
    occs.filter((o) => o.salary),
    (o) => o.salary,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanSalaryTop = safeMean(bySalary, 'salary');

  // 6. Entry salary
  const byEntry = byKeyDesc(
    occs.filter((o) => o.recruit_wage),
    (o) => o.recruit_wage,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanEntry = safeMean(byEntry, 'recruit_wage');

  // 7. Young workforce
  const byYoung = byKeyAsc(
    occs.filter((o) => o.average_age),
    (o) => o.average_age,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanAgeYoung = safeMean(byYoung, 'average_age');

  // 8. Short hours
  const byHours = byKeyAsc(
    occs.filter((o) => o.monthly_hours),
    (o) => o.monthly_hours,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanHours = safeMean(byHours, 'monthly_hours');

  // 9. High demand
  let withDemand = occs.filter((o) => o.demand_band && (DEMAND_SCORE[o.demand_band] ?? 0) >= 3);
  if (withDemand.length < TOP_N) {
    withDemand = occs.filter((o) => o.demand_band);
  }
  const byDemand = [...withDemand]
    .sort((a, b) => {
      const ds = (DEMAND_SCORE[b.demand_band ?? ''] ?? 0) - (DEMAND_SCORE[a.demand_band ?? ''] ?? 0);
      if (ds !== 0) return ds;
      const ss = (b.salary ?? 0) - (a.salary ?? 0);
      if (ss !== 0) return ss;
      return a.id - b.id;
    })
    .slice(0, TOP_N);
  const hotCount = byDemand.filter((o) => o.demand_band === 'hot').length;
  const warmCount = byDemand.filter((o) => o.demand_band === 'warm').length;

  // ---- Build per-ranking page metadata ----

  const results = new Map<RankingSlug, RankingResult>();

  results.set('ai-risk-high', {
    slug: 'ai-risk-high',
    items: aiHigh,
    showSalary: true,
    faqItems: FAQS['ai-risk-high'],
    title: 'AIに奪われる仕事ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `AI影響度が最も高い職業TOP${TOP_N}。平均スコア${meanHigh.toFixed(1)}/10。AI代替リスク・年収・就業者数を一覧比較。Claude Opus 4.7独自分析（非公式）。`,
    h1Text: `AIに奪われる仕事 TOP${TOP_N}`,
    subText: `AI 影響度が最も <strong>高い</strong> 職業ランキング（${scored.length} 職業中）`,
    introText: '厚労省の職業データに基づき、Claude Opus 4.7がタスクレベルでAI影響度を分析。10段階中スコアが高い職業ほど、業務の多くがAIで代替・補助される可能性があります。ただし「仕事がなくなる」という意味ではありません。',
    statBlocks: [
      ['対象職業数', `${scored.length}`],
      ['TOP30 平均 AI 影響', `${meanHigh.toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiHigh, 'salary'))} 万円`],
      ['TOP30 平均年齢', `${safeMean(aiHigh, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('ai-risk-low', {
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
  });

  results.set('salary-safe', {
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
  });

  results.set('workers', {
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
  });

  results.set('salary', {
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
  });

  results.set('entry-salary', {
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
  });

  results.set('young-workforce', {
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
  });

  results.set('short-hours', {
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
  });

  results.set('high-demand', {
    slug: 'high-demand',
    items: byDemand,
    showSalary: true,
    extraColFn: (o) => {
      const db = o.demand_band ?? '';
      const label = DEMAND_JA[db];
      return label ? [{ kind: 'demand-pill' as const, band: db, label }] : [];
    },
    faqItems: FAQS['high-demand'],
    title: '人手不足の職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `求人需要が最も高い職業TOP${TOP_N}。「需要高」${hotCount}件・「やや高」${warmCount}件。転職・就活の参考に。`,
    h1Text: `人手不足の職業 TOP${TOP_N}`,
    subText: '求人需要が最も <strong>高い</strong> 職業ランキング',
    introText: '人手不足が深刻な職業を求人需要の高い順にランキング。採用されやすく待遇改善も期待できる職業を年収・AI影響度と共に確認できます。',
    statBlocks: [
      ['「需要高」職業数', `${hotCount}`],
      ['「やや高」職業数', `${warmCount}`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byDemand, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byDemand, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // ════════════════════════════════════════════════════════════════════════
  // Phase 2 (2026-05-09): +30 new rankings — see rankings-meta.ts for slugs.
  // ════════════════════════════════════════════════════════════════════════

  // ── 単軸 (5) ──

  // 10. 時給ランキング (派生: recruit_wage / 160h、円)
  const byHourly = byKeyDesc(occs.filter((o) => o.hourly_wage), (o) => o.hourly_wage, (o) => o.id).slice(0, TOP_N);
  const meanHourly = safeMean(byHourly, 'hourly_wage');
  results.set('hourly-wage', {
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
  });

  // 11. 求人倍率 (recruit_ratio desc)
  const byRecruitRatio = byKeyDesc(occs.filter((o) => o.recruit_ratio !== null), (o) => o.recruit_ratio, (o) => o.id).slice(0, TOP_N);
  const meanRecruitRatio = safeMean(byRecruitRatio, 'recruit_ratio');
  results.set('recruit-ratio', {
    slug: 'recruit-ratio',
    items: byRecruitRatio,
    showSalary: true,
    extraColFn: (o) => (o.recruit_ratio !== null ? [`${o.recruit_ratio.toFixed(2)} 倍`] : []),
    faqItems: FAQS['recruit-ratio'],
    title: '求人倍率が高い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `求人倍率が最も高い職業 TOP${TOP_N}。平均 ${meanRecruitRatio.toFixed(2)} 倍。人手不足が顕著な売り手市場の職業一覧。`,
    h1Text: `求人倍率が高い職業 TOP${TOP_N}`,
    subText: '求人倍率が最も <strong>高い</strong> 職業ランキング',
    introText: '1 人の求職者あたり何件の求人があるかを表す「有効求人倍率」が高い職業をランキング。1.0 を超えると売り手市場、人手不足を示唆します。',
    statBlocks: [
      ['TOP30 平均求人倍率', `${meanRecruitRatio.toFixed(2)} 倍`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byRecruitRatio, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byRecruitRatio, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 12. シニア中心 (average_age desc)
  const byAging = byKeyDesc(occs.filter((o) => o.average_age), (o) => o.average_age, (o) => o.id).slice(0, TOP_N);
  const meanAgeAging = safeMean(byAging, 'average_age');
  results.set('aging-workforce', {
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
  });

  // 13. 月労働時間が長い (monthly_hours desc)
  const byHoursLong = byKeyDesc(occs.filter((o) => o.monthly_hours), (o) => o.monthly_hours, (o) => o.id).slice(0, TOP_N);
  const meanHoursLong = safeMean(byHoursLong, 'monthly_hours');
  results.set('monthly-hours-long', {
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
  });

  // 14. 求人倍率が低い (recruit_ratio asc, 買い手市場)
  const byRecruitLow = byKeyAsc(occs.filter((o) => o.recruit_ratio !== null), (o) => o.recruit_ratio, (o) => o.id).slice(0, TOP_N);
  const meanRecruitLow = safeMean(byRecruitLow, 'recruit_ratio');
  results.set('recruit-ratio-low', {
    slug: 'recruit-ratio-low',
    items: byRecruitLow,
    showSalary: true,
    extraColFn: (o) => (o.recruit_ratio !== null ? [`${o.recruit_ratio.toFixed(2)} 倍`] : []),
    faqItems: FAQS['recruit-ratio-low'],
    title: '求人倍率が低い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `求人倍率が最も低い職業 TOP${TOP_N}。平均 ${meanRecruitLow.toFixed(2)} 倍。採用競争が厳しい買い手市場の職業一覧。`,
    h1Text: `求人倍率が低い職業 TOP${TOP_N}`,
    subText: '求人倍率が最も <strong>低い</strong> 職業ランキング (買い手市場)',
    introText: '応募者数に対して求人数が少ない買い手市場の職業をランキング。人気職業や参入障壁が高い分野、市場縮小傾向の業種が含まれます。',
    statBlocks: [
      ['TOP30 平均求人倍率', `${meanRecruitLow.toFixed(2)} 倍`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byRecruitLow, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byRecruitLow, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // ── AI 軸派生 (6) ──

  // 15. AI 置き換えが進行中 (ai_risk >= 8 desc, salary as tie)
  const aiReplacedSoon = scored
    .filter((o) => (o.ai_risk ?? 0) >= 8)
    .sort((a, b) => {
      const ra = b.ai_risk ?? 0; const rb = a.ai_risk ?? 0;
      if (ra !== rb) return ra - rb;
      return (b.workers ?? 0) - (a.workers ?? 0);
    })
    .slice(0, TOP_N);
  const meanAiReplaced = safeMean(aiReplacedSoon, 'ai_risk');
  results.set('ai-replaced-soon', {
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
  });

  // 16. 伝統技能で AI 抗性が高い (ai_risk <= 3 + craft sectors)
  const aiResistantCraft = scored
    .filter((o) => (o.ai_risk ?? 999) <= 3 && inSectorSet(o, CRAFT_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || a.id - b.id)
    .slice(0, TOP_N);
  results.set('ai-resistant-craft', {
    slug: 'ai-resistant-craft',
    items: aiResistantCraft,
    showSalary: true,
    faqItems: FAQS['ai-resistant-craft'],
    title: '伝統技能で AI 抗性が高い職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `製造・建設・メンテ・農林系で AI 影響度が低い職業 TOP${aiResistantCraft.length}。手技中心で AI 代替が難しい分野を一覧。`,
    h1Text: `伝統技能で AI 抗性が高い職業 TOP${aiResistantCraft.length}`,
    subText: '製造・建設・メンテ系で AI 影響度 <strong>3 以下</strong> の技能職',
    introText: '手技・経験的判断・身体的調整を要する技能職は AI で代替しにくく、製造・建設・メンテ・農林の現場職が低 AI 影響度のまま安定する傾向にあります。',
    statBlocks: [
      ['対象職業数', `${aiResistantCraft.length}`],
      ['TOP 平均 AI 影響', `${safeMean(aiResistantCraft, 'ai_risk').toFixed(1)} / 10`],
      ['TOP 平均年収', `${Math.trunc(safeMean(aiResistantCraft, 'salary'))} 万円`],
    ],
  });

  // 17. AI リスク高 × 高年収
  const aiAtRiskPaid = scored
    .filter((o) => (o.ai_risk ?? 0) >= 7 && (o.salary ?? 0) >= 500)
    .sort((a, b) => {
      const sa = b.salary ?? 0; const sb = a.salary ?? 0;
      if (sa !== sb) return sa - sb;
      return (b.ai_risk ?? 0) - (a.ai_risk ?? 0);
    })
    .slice(0, TOP_N);
  results.set('ai-at-risk-but-paid', {
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
  });

  // 18. AI で補強される (ai_risk 4-6, sort by salary desc)
  const aiAugmented = scored
    .filter((o) => (o.ai_risk ?? -1) >= 4 && (o.ai_risk ?? -1) <= 6)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id)
    .slice(0, TOP_N);
  results.set('ai-augmented', {
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
  });

  // 19. AI を使いこなす側 (sector=it + ai_risk >= 5)
  const aiFrontier = scored
    .filter((o) => o.sector_id === 'it' && (o.ai_risk ?? 0) >= 5)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || a.id - b.id)
    .slice(0, TOP_N);
  results.set('ai-frontier', {
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
  });

  // 20. AI 安全 × 正規雇用率高
  const aiStableEmployment = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && empPct(o, '正規の職員、従業員') >= 60)
    .sort((a, b) => empPct(b, '正規の職員、従業員') - empPct(a, '正規の職員、従業員') || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('ai-stable-employment', {
    slug: 'ai-stable-employment',
    items: aiStableEmployment,
    showSalary: true,
    extraColFn: (o) => [`正規 ${empPct(o, '正規の職員、従業員').toFixed(0)}%`],
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
  });

  // ── 組合せ (8) ──

  // 21. 高需要 × AI 安全
  const aiSafeHighDemand = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && (DEMAND_SCORE[o.demand_band ?? ''] ?? 0) >= 3)
    .sort((a, b) => (DEMAND_SCORE[b.demand_band ?? ''] ?? 0) - (DEMAND_SCORE[a.demand_band ?? ''] ?? 0) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-high-demand', {
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
  });

  // 22. 低労働時間 × AI 安全
  const aiSafeShortHours = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.monthly_hours)
    .sort((a, b) => (a.monthly_hours ?? 9999) - (b.monthly_hours ?? 9999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-short-hours', {
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
  });

  // 23. 若手中心 × AI 安全
  const aiSafeYoung = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.average_age)
    .sort((a, b) => (a.average_age ?? 999) - (b.average_age ?? 999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-young-workforce', {
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
  });

  // 24. 無資格 × AI 安全
  const aiSafeNoLicense = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.certs.length === 0)
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-no-license', {
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
  });

  // 25. 身体性 × AI 安全
  const aiSafePhysical = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && inSectorSet(o, PHYSICAL_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.workers ?? 0) - (a.workers ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-physical', {
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
  });

  // 26. 対人 × AI 安全
  const aiSafeInterpersonal = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && inSectorSet(o, INTERPERSONAL_SECTORS))
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.workers ?? 0) - (a.workers ?? 0))
    .slice(0, TOP_N);
  results.set('ai-safe-interpersonal', {
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
  });

  // 27. 高年収 × 高需要
  const highSalaryHighDemand = scored
    .filter((o) => o.salary && (DEMAND_SCORE[o.demand_band ?? ''] ?? 0) >= 3)
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0) || (DEMAND_SCORE[b.demand_band ?? ''] ?? 0) - (DEMAND_SCORE[a.demand_band ?? ''] ?? 0))
    .slice(0, TOP_N);
  results.set('high-salary-high-demand', {
    slug: 'high-salary-high-demand',
    items: highSalaryHighDemand,
    showSalary: true,
    extraColFn: (o) => {
      const db = o.demand_band ?? '';
      const label = DEMAND_JA[db];
      return label ? [{ kind: 'demand-pill' as const, band: db, label }] : [];
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
  });

  // 28. 初任給が高い × 若手活躍
  const highSalaryYoungEntry = occs
    .filter((o) => o.recruit_wage && o.average_age && o.average_age <= 40)
    .sort((a, b) => (b.recruit_wage ?? 0) - (a.recruit_wage ?? 0) || (a.average_age ?? 999) - (b.average_age ?? 999))
    .slice(0, TOP_N);
  results.set('high-salary-young-entry', {
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
  });

  // ── 教育・資格軸 (5) ──

  // 29. 国家資格必須
  const licenseRequired = occs
    .filter((o) => o.certs.length >= 1)
    .sort((a, b) => b.certs.length - a.certs.length || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('license-required', {
    slug: 'license-required',
    items: licenseRequired,
    showSalary: true,
    extraColFn: (o) => [`資格 ${o.certs.length}`],
    faqItems: FAQS['license-required'],
    title: '国家資格が必要な職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `関連資格が多い職業 TOP${licenseRequired.length}。参入障壁が明確な専門職を年収・AI 影響度と共に一覧。`,
    h1Text: `国家資格が必要な職業 TOP${licenseRequired.length}`,
    subText: '関連資格数 <strong>降順</strong> ランキング',
    introText: '医療・士業・建設・福祉・教育系の専門職で、参入障壁が明確に設定されている職業群。資格保有者しかできない業務範囲があり、AI 代替が起きにくい傾向。',
    statBlocks: [
      ['対象職業数', `${licenseRequired.length}`],
      ['平均年収', `${Math.trunc(safeMean(licenseRequired, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(licenseRequired, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 30. 無資格で就ける × AI 安全
  const noLicenseRequired = scored
    .filter((o) => o.certs.length === 0 && (o.ai_risk ?? 999) <= 5)
    .sort((a, b) => (a.ai_risk ?? 0) - (b.ai_risk ?? 0) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('no-license-required', {
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
  });

  // 31. 高卒で就ける (高卒比率 30%+ で sort)
  const highSchoolOk = occs
    .filter((o) => eduPct(o, '高卒') >= 30)
    .sort((a, b) => eduPct(b, '高卒') - eduPct(a, '高卒') || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('high-school-ok', {
    slug: 'high-school-ok',
    items: highSchoolOk,
    showSalary: true,
    extraColFn: (o) => [`高卒 ${eduPct(o, '高卒').toFixed(0)}%`],
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
  });

  // 32. 大卒以上が中心 (大卒比率 50%+)
  const universityRequired = occs
    .filter((o) => eduPct(o, '大卒') >= 50)
    .sort((a, b) => eduPct(b, '大卒') - eduPct(a, '大卒') || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('university-required', {
    slug: 'university-required',
    items: universityRequired,
    showSalary: true,
    extraColFn: (o) => [`大卒 ${eduPct(o, '大卒').toFixed(0)}%`],
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
  });

  // 33. 大学院卒中心 (大学院卒 = 修士+博士 30%+)
  const graduateSchoolRequired = occs
    .filter((o) => gradPct(o) >= 30)
    .sort((a, b) => gradPct(b) - gradPct(a) || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('graduate-school-required', {
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
  });

  // ── ニッチ (6) ──

  // 34. 公的機関・公務員系
  const publicSector = occs
    .filter((o) => inSectorSet(o, PUBLIC_SECTORS))
    .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0) || a.id - b.id)
    .slice(0, TOP_N);
  results.set('public-sector', {
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
  });

  // 35. フリーランス向き (自営、フリーランス比率 20%+)
  const freelanceFriendly = occs
    .filter((o) => empPct(o, '自営、フリーランス') >= 20)
    .sort((a, b) => empPct(b, '自営、フリーランス') - empPct(a, '自営、フリーランス') || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('freelance-friendly', {
    slug: 'freelance-friendly',
    items: freelanceFriendly,
    showSalary: true,
    extraColFn: (o) => [`フリー ${empPct(o, '自営、フリーランス').toFixed(0)}%`],
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
  });

  // 36. 独立・開業が典型 (自営、フリーランス + パートタイマー以外、を別軸で見る)
  // 経営層 + 自営、フリーランス の合計が高い職業
  const selfEmployedTypical = occs
    .filter((o) => empPct(o, '自営、フリーランス') + empPct(o, '経営層（役員等）') >= 30)
    .sort((a, b) =>
      (empPct(b, '自営、フリーランス') + empPct(b, '経営層（役員等）')) -
      (empPct(a, '自営、フリーランス') + empPct(a, '経営層（役員等）'))
      || (b.salary ?? 0) - (a.salary ?? 0))
    .slice(0, TOP_N);
  results.set('self-employed-typical', {
    slug: 'self-employed-typical',
    items: selfEmployedTypical,
    showSalary: true,
    extraColFn: (o) => [`独立 ${(empPct(o, '自営、フリーランス') + empPct(o, '経営層（役員等）')).toFixed(0)}%`],
    faqItems: FAQS['self-employed-typical'],
    title: '独立・開業が典型の職業 TOP30【2026年版】| 未来の仕事',
    seoDesc: `フリーランス + 経営層比率が高い職業 TOP${selfEmployedTypical.length}。独立がキャリアの自然な到達点となる職業を一覧。`,
    h1Text: `独立・開業が典型の職業 TOP${selfEmployedTypical.length}`,
    subText: 'フリーランス + 経営層 比率 <strong>30% 以上</strong> · 降順',
    introText: '美容師・調理師・建設職人・士業など、独立がキャリアの自然な到達点とされる職業群。雇われ段階を経て独立 → 開業のルートが王道です。',
    statBlocks: [
      ['対象職業数', `${selfEmployedTypical.length}`],
      ['平均年収', `${Math.trunc(safeMean(selfEmployedTypical, 'salary'))} 万円`],
      ['平均 AI 影響', `${safeMean(selfEmployedTypical, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // 37. 大規模就業 × AI 安全 (workers desc among low-AI)
  const largeWorkforceStable = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.workers && o.workers >= 50000)
    .sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('large-workforce-stable', {
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
  });

  // 38. 規制で守られた職業 (certs >= 2 + ai_risk <= 5)
  const regulatedProtected = scored
    .filter((o) => o.certs.length >= 2 && (o.ai_risk ?? 999) <= 5)
    .sort((a, b) => b.certs.length - a.certs.length || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('regulated-protected', {
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
  });

  // 39. 低ストレス安定職 (short hours + low AI)
  const lowStressStable = scored
    .filter((o) => (o.ai_risk ?? 999) <= 5 && o.monthly_hours && o.monthly_hours <= 165)
    .sort((a, b) => (a.monthly_hours ?? 999) - (b.monthly_hours ?? 999) || (a.ai_risk ?? 0) - (b.ai_risk ?? 0))
    .slice(0, TOP_N);
  results.set('low-stress-stable', {
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
  });

  // ---- Hub data ----

  const globalStats: Array<readonly [string, string]> = [
    ['総職業数', '556'],
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
    `年収上位30職業の平均AI影響度は<strong>${safeMean(bySalary, 'ai_risk').toFixed(1)}/10</strong>と中程度`,
    '就業者数上位は事務・販売系が占めるが、AI影響度は<strong>高め</strong>の傾向',
    'AI影響度が低い職業ほど<strong>身体性・対人スキル</strong>を求められる傾向',
  ];

  const cards: RankingsBundle['hub']['cards'] = [
    // ── Phase 1 baseline (9) ──
    { slug: 'ai-risk-high', name: 'AIに奪われる仕事 TOP30', desc: 'AI影響度が高い職業ランキング', count: aiHigh.length, preview: makePreview(aiHigh, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-risk-low', name: 'AI影響が少ない仕事 TOP30', desc: 'AIリスクが低く将来性のある職業', count: aiLow.length, preview: makePreview(aiLow, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'salary-safe', name: '高年収×低AIリスク TOP30', desc: '年収が高くAI代替リスクが低い職業', count: salarySafe.length, preview: makePreview(salarySafe, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'workers', name: '就業者数ランキング TOP30', desc: '日本で最も就業者が多い職業', count: byWorkers.length, preview: makePreview(byWorkers, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'salary', name: '年収ランキング TOP30', desc: '年収が最も高い職業', count: bySalary.length, preview: makePreview(bySalary, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'entry-salary', name: '初任給ランキング TOP30', desc: '初任給が高い職業', count: byEntry.length, preview: makePreview(byEntry, (o) => `初任給 ${Math.trunc(o.recruit_wage ?? 0)}万円`) },
    { slug: 'young-workforce', name: '平均年齢が若い職業 TOP30', desc: '若手が活躍する職業', count: byYoung.length, preview: makePreview(byYoung, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'short-hours', name: '労働時間が短い職業 TOP30', desc: 'ワークライフバランスに優れた職業', count: byHours.length, preview: makePreview(byHours, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}時間`) },
    { slug: 'high-demand', name: '人手不足の職業 TOP30', desc: '求人需要が高い職業', count: byDemand.length, preview: makePreview(byDemand, (o) => DEMAND_JA[o.demand_band ?? ''] ?? '') },
    // ── Phase 2 単軸 (5) ──
    { slug: 'hourly-wage', name: '時給が高い職業 TOP30', desc: '時給ベースで報酬が高い職業', count: byHourly.length, preview: makePreview(byHourly, (o) => `¥${(o.hourly_wage ?? 0).toLocaleString('en-US')}`) },
    { slug: 'recruit-ratio', name: '求人倍率が高い職業 TOP30', desc: '人手不足が顕著な売り手市場', count: byRecruitRatio.length, preview: makePreview(byRecruitRatio, (o) => `${(o.recruit_ratio ?? 0).toFixed(2)}倍`) },
    { slug: 'aging-workforce', name: 'シニア中心の職業 TOP30', desc: '平均年齢が高く経験者が活躍', count: byAging.length, preview: makePreview(byAging, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'monthly-hours-long', name: '労働時間が長い職業 TOP30', desc: '月間労働時間が長い職業', count: byHoursLong.length, preview: makePreview(byHoursLong, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}時間`) },
    { slug: 'recruit-ratio-low', name: '求人倍率が低い職業 TOP30', desc: '採用競争が厳しい買い手市場', count: byRecruitLow.length, preview: makePreview(byRecruitLow, (o) => `${(o.recruit_ratio ?? 0).toFixed(2)}倍`) },
    // ── Phase 2 AI 軸派生 (6) ──
    { slug: 'ai-replaced-soon', name: 'AI 置き換えが進む職業', desc: 'AI 影響度 8 以上、業務再設計が急務', count: aiReplacedSoon.length, preview: makePreview(aiReplacedSoon, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-resistant-craft', name: '伝統技能で AI 抗性が高い職業', desc: '製造・建設・メンテ系の技能職', count: aiResistantCraft.length, preview: makePreview(aiResistantCraft, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-at-risk-but-paid', name: 'AI リスク高 × 高年収', desc: 'AI 影響度高でも現状年収高の要注意組', count: aiAtRiskPaid.length, preview: makePreview(aiAtRiskPaid, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'ai-augmented', name: 'AI で補強される職業', desc: 'AI 影響度 4-6 の AI 共存域', count: aiAugmented.length, preview: makePreview(aiAugmented, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-frontier', name: 'AI を使いこなす側の職業', desc: 'IT・通信セクターの AI フロンティア職', count: aiFrontier.length, preview: makePreview(aiFrontier, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'ai-stable-employment', name: 'AI 安全 × 正規雇用率高', desc: '低 AI 影響かつ正社員中心の安定職', count: aiStableEmployment.length, preview: makePreview(aiStableEmployment, (o) => `正規 ${empPct(o, '正規の職員、従業員').toFixed(0)}%`) },
    // ── Phase 2 組合せ (8) ──
    { slug: 'ai-safe-high-demand', name: '高需要 × AI 安全', desc: '人手不足かつ AI 影響度が低い', count: aiSafeHighDemand.length, preview: makePreview(aiSafeHighDemand, (o) => DEMAND_JA[o.demand_band ?? ''] ?? '') },
    { slug: 'ai-safe-short-hours', name: '低労働時間 × AI 安全', desc: '労働時間が短く AI 影響も低い', count: aiSafeShortHours.length, preview: makePreview(aiSafeShortHours, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}h`) },
    { slug: 'ai-safe-young-workforce', name: '若手中心 × AI 安全', desc: '平均年齢が若くて AI 影響も低い', count: aiSafeYoung.length, preview: makePreview(aiSafeYoung, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'ai-safe-no-license', name: '無資格 × AI 安全', desc: '資格なしで就けて AI 影響も低い', count: aiSafeNoLicense.length, preview: makePreview(aiSafeNoLicense, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-safe-physical', name: '身体性 × AI 安全', desc: '身体技能職で AI 影響も低い', count: aiSafePhysical.length, preview: makePreview(aiSafePhysical, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-safe-interpersonal', name: '対人 × AI 安全', desc: '対人スキル中心で AI 影響も低い', count: aiSafeInterpersonal.length, preview: makePreview(aiSafeInterpersonal, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'high-salary-high-demand', name: '高年収 × 高需要', desc: '年収が高くかつ人手不足の職業', count: highSalaryHighDemand.length, preview: makePreview(highSalaryHighDemand, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'high-salary-young-entry', name: '初任給が高い × 若手活躍', desc: '初任給が高くて若手が多い', count: highSalaryYoungEntry.length, preview: makePreview(highSalaryYoungEntry, (o) => `初任給 ${Math.trunc(o.recruit_wage ?? 0)}万円`) },
    // ── Phase 2 教育・資格軸 (5) ──
    { slug: 'license-required', name: '国家資格が必要な職業', desc: '関連資格が多い高度専門職', count: licenseRequired.length, preview: makePreview(licenseRequired, (o) => `資格 ${o.certs.length}`) },
    { slug: 'no-license-required', name: '無資格で就ける × AI 安全', desc: '資格不要かつ AI リスク低', count: noLicenseRequired.length, preview: makePreview(noLicenseRequired, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'high-school-ok', name: '高卒で目指せる職業', desc: '高卒比率 30% 以上の職業', count: highSchoolOk.length, preview: makePreview(highSchoolOk, (o) => `高卒 ${eduPct(o, '高卒').toFixed(0)}%`) },
    { slug: 'university-required', name: '大卒以上が中心の職業', desc: '大卒比率 50% 以上の職業', count: universityRequired.length, preview: makePreview(universityRequired, (o) => `大卒 ${eduPct(o, '大卒').toFixed(0)}%`) },
    { slug: 'graduate-school-required', name: '大学院卒中心の職業', desc: '修士・博士課程修了者が多い', count: graduateSchoolRequired.length, preview: makePreview(graduateSchoolRequired, (o) => `院卒 ${gradPct(o).toFixed(0)}%`) },
    // ── Phase 2 ニッチ (6) ──
    { slug: 'public-sector', name: '公的機関・公務員系の職業', desc: '保安・公安セクターの公務員職', count: publicSector.length, preview: makePreview(publicSector, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'freelance-friendly', name: 'フリーランス向きの職業', desc: '自営・フリーランス比率 20% 以上', count: freelanceFriendly.length, preview: makePreview(freelanceFriendly, (o) => `フリー ${empPct(o, '自営、フリーランス').toFixed(0)}%`) },
    { slug: 'self-employed-typical', name: '独立・開業が典型の職業', desc: '独立がキャリアの自然な到達点', count: selfEmployedTypical.length, preview: makePreview(selfEmployedTypical, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'large-workforce-stable', name: '大規模就業 × AI 安全', desc: '就業者 5 万人+ かつ AI 影響低', count: largeWorkforceStable.length, preview: makePreview(largeWorkforceStable, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'regulated-protected', name: '規制で守られた職業', desc: '関連資格 2 個+ かつ AI 影響低', count: regulatedProtected.length, preview: makePreview(regulatedProtected, (o) => `資格 ${o.certs.length}`) },
    { slug: 'low-stress-stable', name: '低ストレス安定職', desc: '短い労働時間 × 低 AI 影響', count: lowStressStable.length, preview: makePreview(lowStressStable, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}h`) },
  ];

  return { results, hub: { globalStats, insights, cards } };
}

function makePreview(items: Occupation[], metric: (o: Occupation) => string): string {
  if (items.length === 0) return '';
  const top = items[0];
  const name = top.title_ja ?? '';
  return `1位 ${name}（${metric(top)}）`;
}


// ---------------------------------------------------------------------------
// Public façade — re-export editorial FAQs from ranking-copy.ts.
// HTML / JSON-LD rendering helpers moved to src/templates/Ranking.ts on
// 2026-05-14 (Phase D #5); pages now import HTML symbols from there
// directly per docs/architecture.md §8 row 11.
// ---------------------------------------------------------------------------

export { FAQS } from './ranking-copy.js';

// ─── Graph adapter (merged from src/views/ranking.ts 2026-05-14 Phase D #4
//     per docs/architecture.md §8 row 10 'rankings.ts → views/ranking.ts'). ───

import type { KnowledgeGraph, OccupationId } from '@/graph';
import { riskBand as legacyRiskBand, demandBand as legacyDemandBand } from '../data/lib/bands';

// Mirror of src/data/projections/treemap.ts:EDU_KEY_EN_TO_JA. Kept local
// because the projection module is not in the architecture's public
// surface; copying 8 lines here avoids a cross-layer import.
const EDU_KEY_EN_TO_JA: Record<string, string> = {
  below_high_school: '高卒未満',
  high_school: '高卒',
  vocational_school: '専門学校卒',
  junior_college: '短大卒',
  technical_college: '高専卒',
  university: '大卒',
  masters: '修士課程卒（修士と同等の専門職学位を含む）',
  doctorate: '博士課程卒',
};

const EMP_KEY_EN_TO_JA: Record<string, string> = {
  regular_employee: '正規の職員、従業員',
  part_time: 'パートタイマー',
  dispatched: '派遣社員',
  contract: '契約社員、期間従業員',
  self_employed_freelance: '自営、フリーランス',
  executive: '経営層（役員等）',
  casual_non_student: 'アルバイト（学生以外）',
  casual_student: 'アルバイト（学生）',
  unknown: 'わからない',
  other: 'その他',
};

function convertEnToJaPct(
  enDict: Record<string, number> | null,
  mapping: Record<string, string>,
): Record<string, number> | null {
  if (enDict == null) return null;
  const out: Record<string, number> = {};
  for (const [enKey, frac] of Object.entries(enDict)) {
    const jaKey = mapping[enKey];
    if (jaKey == null) continue;
    // Banker's rounding to 1 decimal place — matches src/data/lib/banker-round.ts.
    out[jaKey] = bankerRound1(frac * 100);
  }
  return out;
}

/** Banker's rounding to 1 decimal place (half-to-even). */
function bankerRound1(n: number): number {
  const scaled = n * 10;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  let rounded: number;
  if (diff > 0.5) rounded = floor + 1;
  else if (diff < 0.5) rounded = floor;
  else rounded = floor % 2 === 0 ? floor : floor + 1;
  return rounded / 10;
}

// Reuse the legacy band functions to guarantee output parity. Importing
// pure logic from src/data/lib is permitted under the layer policy
// (those modules are no-HTML, no-I/O helpers).

/**
 * Build the full Occupation[] that buildRankings() expects, sourced from
 * graph instead of treemap.json + per-occupation cert files.
 */
export function loadOccupationsFromGraph(graph: KnowledgeGraph): Occupation[] {
  const out: Occupation[] = [];
  for (const [occId, occ] of graph.occupations) {
    const idNum = occId as unknown as number;
    const sectorId = graph.sectorOf(occId as OccupationId);
    const sector = sectorId ? graph.sectors.get(sectorId) : null;
    const aiScore = occ.aiRisk?.score ?? null;
    const recruitWage = occ.stats?.recruitWageManYen ?? null;
    // hourly_wage = recruit_wage_man_yen × 10000 / 160h (matches legacy).
    const hourlyWage = recruitWage !== null ? (recruitWage * 10000) / 160 : null;

    out.push({
      id: idNum,
      title_ja: occ.titleJa,
      ai_risk: aiScore,
      risk_band: legacyRiskBand(aiScore),
      workers: occ.stats?.workers ?? null,
      salary: occ.stats?.salaryManYen ?? null,
      monthly_hours: occ.stats?.monthlyHours ?? null,
      average_age: occ.stats?.averageAge ?? null,
      recruit_wage: recruitWage,
      recruit_ratio: occ.stats?.recruitRatio ?? null,
      demand_band: legacyDemandBand(occ.stats?.recruitRatio ?? null),
      sector_id: sectorId !== null ? (sectorId as unknown as string) : '_uncategorized',
      sector_ja: sector ? sector.nameJa : '未分類',
      education_pct: convertEnToJaPct(occ.educationDistribution, EDU_KEY_EN_TO_JA),
      employment_type: convertEnToJaPct(occ.employmentType, EMP_KEY_EN_TO_JA),
      certs: occ.relatedCertsJa as string[],
      hourly_wage: hourlyWage,
    });
  }
  // Sort by id ascending — matches legacy treemap order.
  out.sort((a, b) => a.id - b.id);
  return out;
}
