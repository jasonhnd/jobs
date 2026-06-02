/**
 * src/pages/rankings/_rankings-bindings.ts — bindings for [type].astro.
 * Phase D audit #7 (2026-05-14): page frontmatter ≤30 lines per doc §2.5.
 */
import type { KnowledgeGraph } from '@/graph';
import type { RankingResult } from '@/views/ranking.js';
import { ALL_RANKINGS, type RankingSlug } from '@/views/ranking.js';
import {
  renderRankItem, renderHighlights, renderSectorChart,
  renderFaqHtml, renderRelatedRankings, renderJsonLd, escapeHtml,
} from '@/templates/Ranking.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';

const SITE = 'https://mirai-shigoto.com';

export interface RankingsSlugBindings {
  readonly canonical: string;
  readonly ogImage: string;
  readonly statsHtml: string;
  readonly highlightsHtml: string;
  readonly sectorChartHtml: string;
  readonly rankItems: string;
  readonly faqHtml: string;
  readonly relatedHtml: string;
  readonly crossHubHtml: string;
  readonly introInlinedHtml: string;
  readonly jsonLd: string;
}

export function buildRankingsSlugBindings(result: RankingResult, graph: KnowledgeGraph): RankingsSlugBindings {
  const slug = result.slug as RankingSlug;
  const canonical = `${SITE}/rankings/${slug}`;
  const ogImage = `${SITE}/api/og?ranking=${slug}`;
  const statsHtml = result.statBlocks.length > 0
    ? `<dl class="stats">${result.statBlocks.map(([l, v]) => `<div><dt>${escapeHtml(l)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>`
    : '';
  const highlightsHtml = renderHighlights(result.items, slug);
  const sectorChartHtml = renderSectorChart(result.items);
  const rankItems = result.items
    .map((o) => renderRankItem(o, result.showSalary, result.extraColFn ? result.extraColFn(o) : null))
    .join('');
  const faqHtml = renderFaqHtml(result.faqItems);
  const relatedHtml = renderRelatedRankings(slug, ALL_RANKINGS);
  const linkRegistry = buildLinkRegistry(graph);
  const introInlinedHtml = inlineLinkText(result.introText, linkRegistry, { maxLinks: 4 });
  const crossHubHtml = renderRelatedHubsBlock('rankings', slug, 6);
  const jsonLd = renderJsonLd(canonical, result.title, result.seoDesc, result.items, result.faqItems);
  return {
    canonical, ogImage, statsHtml, highlightsHtml, sectorChartHtml,
    rankItems, faqHtml, relatedHtml, crossHubHtml, introInlinedHtml, jsonLd,
  };
}
