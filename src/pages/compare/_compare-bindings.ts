/**
 * src/pages/compare/_compare-bindings.ts — bindings for [pair].astro.
 * Phase D audit #7 (2026-05-14): page frontmatter ≤30 lines per doc §2.5.
 */
import { asOccupationId, type KnowledgeGraph } from '@/graph';
import {
  buildCompareGeoFactSummary,
  renderAiFactParagraph,
} from '@/lib/ai-fact-summary';
import { fmtInt } from '@/lib/num.js';
import { loadGeoFacts } from '@/page-data/geo-facts-loader';
import type { CompareResult, CompareSide } from '@/views/compare-hub.js';
import type { CompareSlug } from '@/views/compare-meta.js';
import { COMPARE_META } from '@/views/compare-meta.js';
import {
  renderCompareHero, renderCompareDuelBar, renderCompareTable, renderTopSkillsCompare,
  renderFaqHtml, renderRelatedCompares, renderJsonLd, escapeHtml,
} from '@/templates/Compare.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';
import type { GeoFacts } from '@/site/geo-facts';

const SITE = 'https://mirai-shigoto.com';

export interface ComparePairBindings {
  readonly canonical: string;
  readonly ogImage: string;
  readonly title: string;
  readonly seoDesc: string;
  readonly heroHtml: string;
  readonly duelBarHtml: string;
  readonly metricRowsHtml: string;
  readonly tableHtml: string;
  readonly skillsHtml: string;
  readonly faqHtml: string;
  readonly relatedHtml: string;
  readonly pointsHtml: string;
  readonly hintsHtml: string;
  readonly introHtml: string;
  readonly aiFactHtml: string;
  readonly crossHubHtml: string;
  readonly jsonLd: string;
}

export type MetricWin = 'a' | 'b' | null;

export interface CompareMetricRow {
  readonly label: string;
  readonly a: string;
  readonly b: string;
  readonly win: MetricWin;
  readonly kind: 'num' | 'text';
}

function formatCerts(certs: ReadonlyArray<string>): string {
  if (certs.length === 0) return '—';
  return certs[0] ?? '—';
}

function formatWorkers(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 10_000)}万人`;
  return `${fmtInt(n)}人`;
}

function displacementOf(graph: KnowledgeGraph, id: number): number | null {
  return graph.occupations.get(asOccupationId(id))?.aiRisk?.aiois?.displacement ?? null;
}

/** First-screen metric rows (#322). Skip a row when either side lacks the value. */
export function buildCompareMetricRows(
  a: CompareSide,
  b: CompareSide,
  graph: KnowledgeGraph,
): ReadonlyArray<CompareMetricRow> {
  const rows: CompareMetricRow[] = [];
  if (a.salary !== null && b.salary !== null) {
    rows.push({
      label: '年収 (平均)',
      a: `${Math.trunc(a.salary)}万円`,
      b: `${Math.trunc(b.salary)}万円`,
      win: a.salary === b.salary ? null : (a.salary > b.salary ? 'a' : 'b'),
      kind: 'num',
    });
  }
  const dispA = displacementOf(graph, a.id);
  const dispB = displacementOf(graph, b.id);
  if (dispA !== null && dispB !== null) {
    rows.push({
      label: '仕事が減るリスク',
      a: `${dispA.toFixed(1)}/10`,
      b: `${dispB.toFixed(1)}/10`,
      win: null,
      kind: 'num',
    });
  }
  if (a.workers !== null && b.workers !== null) {
    rows.push({
      label: '就業者数',
      a: formatWorkers(a.workers),
      b: formatWorkers(b.workers),
      win: null,
      kind: 'num',
    });
  }
  if (a.monthly_hours !== null && b.monthly_hours !== null) {
    rows.push({
      label: '月労働時間',
      a: `${Math.trunc(a.monthly_hours)}h`,
      b: `${Math.trunc(b.monthly_hours)}h`,
      win: a.monthly_hours === b.monthly_hours
        ? null
        : (a.monthly_hours < b.monthly_hours ? 'a' : 'b'),
      kind: 'num',
    });
  }
  rows.push({
    label: '関連資格',
    a: formatCerts(a.related_certs_ja),
    b: formatCerts(b.related_certs_ja),
    win: null,
    kind: 'text',
  });
  if (a.recruit_ratio !== null && b.recruit_ratio !== null) {
    rows.push({
      label: '求人倍率',
      a: `${a.recruit_ratio.toFixed(1)}倍`,
      b: `${b.recruit_ratio.toFixed(1)}倍`,
      win: a.recruit_ratio === b.recruit_ratio
        ? null
        : (a.recruit_ratio > b.recruit_ratio ? 'a' : 'b'),
      kind: 'num',
    });
  }
  return rows;
}

/** Split `520万円` → value + unit so the unit can render as a smaller caption. */
const METRIC_UNIT = /^(.*?)(万円|万人|人|h|\/10|倍)$/;

function renderMetricCell(
  text: string,
  side: 'a' | 'b',
  win: MetricWin,
  kind: CompareMetricRow['kind'],
): string {
  const cls = `cm-${side}${win === side ? ' win' : ''}${kind === 'num' ? ' num' : ''}`;
  if (kind === 'num') {
    const m = text.match(METRIC_UNIT);
    if (m && m[1] !== undefined && m[2] !== undefined) {
      return (
        `<span class="${cls}">` +
        `<span class="cm-val">${escapeHtml(m[1])}</span>` +
        `<small>${escapeHtml(m[2])}</small>` +
        `</span>`
      );
    }
  }
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

function formatMetricLabel(label: string): string {
  // Soft break so 仕事が減るリスク wraps as two caption lines at 86px,
  // matching frame-05, without changing the label string.
  if (label === '仕事が減るリスク') return '仕事が減る<wbr>リスク';
  return escapeHtml(label);
}

export function renderCompareMetricRows(rows: ReadonlyArray<CompareMetricRow>): string {
  if (rows.length === 0) return '';
  const body = rows.map((r) => (
    `<div class="cmp-metric">` +
    `<div class="cm-label">${formatMetricLabel(r.label)}</div>` +
    renderMetricCell(r.a, 'a', r.win, r.kind) +
    renderMetricCell(r.b, 'b', r.win, r.kind) +
    `</div>`
  )).join('');
  return `<div class="cmp-metrics">${body}</div>`;
}

function listOfStrings(items: ReadonlyArray<string>, cls: string): string {
  return '<ul class="' + cls + '">' + items.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
}

export function buildComparePairBindings(
  result: CompareResult,
  graph: KnowledgeGraph,
  geoFacts: GeoFacts = loadGeoFacts(),
): ComparePairBindings {
  const slug = result.meta.slug as CompareSlug;
  const meta = result.meta;
  const canonical = `${SITE}/compare/${slug}`;
  const ogImage = `${SITE}/api/og?compare=${slug}`;
  // The shorter "｜AI影響度・年収を比較" suffix keeps every pair's title under
  // Google's 60-char SERP truncation limit, including the longest pair
  // "Web マーケター vs マーケティング・リサーチャー" which previously overflowed
  // and had its trailing "| 未来の仕事" cut off.
  const title = `${meta.title_ja}｜AI影響度・年収を比較【2026 年版】｜未来の仕事`;
  const seoDesc = `${result.a.name_ja} と ${result.b.name_ja} を AI 影響度・年収・労働条件・必要スキルで比較。${meta.description_ja.slice(0, 100)}…`;
  const heroHtml = renderCompareHero(result.a, result.b);
  const duelBarHtml = renderCompareDuelBar(result.a, result.b);
  const metricRowsHtml = renderCompareMetricRows(
    buildCompareMetricRows(result.a, result.b, graph),
  );
  const tableHtml = renderCompareTable(result.rows, result.a.name_ja, result.b.name_ja);
  const skillsHtml = renderTopSkillsCompare(result.a, result.b);
  const faqHtml = renderFaqHtml(result.faqItems);
  const relatedHtml = renderRelatedCompares(slug, COMPARE_META);
  const jsonLd = renderJsonLd(canonical, meta, result.a, result.b, seoDesc, result.faqItems);
  const pointsHtml = listOfStrings(meta.comparison_points_ja, 'compare-points');
  const hintsHtml = listOfStrings(meta.decision_hints_ja, 'decision-hints');
  const linkRegistry = buildLinkRegistry(graph);
  const introHtml = inlineLinkText(meta.description_ja, linkRegistry, {
    maxLinks: 4,
    excludeIds: new Set([result.a.id, result.b.id]),
  });
  const aiFactHtml = renderAiFactParagraph(buildCompareGeoFactSummary({
    facts: geoFacts,
    subjectJa: meta.title_ja,
    occupationIds: [result.a.id, result.b.id],
  }));
  const crossHubHtml = renderRelatedHubsBlock('compare', slug, 6);
  return {
    canonical, ogImage, title, seoDesc,
    heroHtml, duelBarHtml, metricRowsHtml, tableHtml, skillsHtml, faqHtml, relatedHtml,
    pointsHtml, hintsHtml, introHtml, aiFactHtml, crossHubHtml, jsonLd,
  };
}
