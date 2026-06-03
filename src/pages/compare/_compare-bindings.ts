/**
 * src/pages/compare/_compare-bindings.ts — bindings for [pair].astro.
 * Phase D audit #7 (2026-05-14): page frontmatter ≤30 lines per doc §2.5.
 */
import type { KnowledgeGraph } from '@/graph';
import type { CompareResult } from '@/views/compare-hub.js';
import type { CompareSlug } from '@/views/compare-meta.js';
import { COMPARE_META } from '@/views/compare-meta.js';
import {
  renderCompareHero, renderCompareTable, renderTopSkillsCompare,
  renderFaqHtml, renderRelatedCompares, renderJsonLd, escapeHtml,
} from '@/templates/Compare.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';

const SITE = 'https://mirai-shigoto.com';

export interface ComparePairBindings {
  readonly canonical: string;
  readonly ogImage: string;
  readonly title: string;
  readonly seoDesc: string;
  readonly heroHtml: string;
  readonly tableHtml: string;
  readonly skillsHtml: string;
  readonly faqHtml: string;
  readonly relatedHtml: string;
  readonly pointsHtml: string;
  readonly hintsHtml: string;
  readonly introHtml: string;
  readonly crossHubHtml: string;
  readonly jsonLd: string;
}

function listOfStrings(items: ReadonlyArray<string>, cls: string): string {
  return '<ul class="' + cls + '">' + items.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
}

export function buildComparePairBindings(result: CompareResult, graph: KnowledgeGraph): ComparePairBindings {
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
  const crossHubHtml = renderRelatedHubsBlock('compare', slug, 6);
  return {
    canonical, ogImage, title, seoDesc,
    heroHtml, tableHtml, skillsHtml, faqHtml, relatedHtml,
    pointsHtml, hintsHtml, introHtml, crossHubHtml, jsonLd,
  };
}
