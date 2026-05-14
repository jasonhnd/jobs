/**
 * src/pages/ja/interests/_interests-bindings.ts — bindings for [type].astro.
 * Phase D audit #7 (2026-05-14): page frontmatter ≤30 lines per doc §2.5.
 */
import type { KnowledgeGraph } from '@/graph';
import type { InterestResult } from '../../../views/interests.js';
import type { InterestType } from '../../../views/interests-meta.js';
import { INTEREST_META } from '../../../views/interests-meta.js';
import {
  renderInterestItem, renderHighlights, renderSectorChart,
  renderFaqHtml, renderRelatedInterests, renderJsonLd, escapeHtml,
} from '../../../templates/InterestHub.js';
import { buildLinkRegistry, inlineLinkText } from '../../../views/inline-links.js';
import { renderRelatedHubsBlock } from '../../../views/hub-hub-graph.js';

const SITE = 'https://mirai-shigoto.com';

export interface InterestsSlugBindings {
  readonly canonical: string;
  readonly ogImage: string;
  readonly title: string;
  readonly seoDesc: string;
  readonly statsHtml: string;
  readonly highlightsHtml: string;
  readonly sectorChartHtml: string;
  readonly rankItems: string;
  readonly faqHtml: string;
  readonly relatedHtml: string;
  readonly introHtml: string;
  readonly crossHubHtml: string;
  readonly charsHtml: string;
  readonly fieldsHtml: string;
  readonly jsonLd: string;
}

function listOfStrings(items: ReadonlyArray<string>, cls: string): string {
  return '<ul class="' + cls + '">' + items.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
}

export function buildInterestsSlugBindings(result: InterestResult, graph: KnowledgeGraph): InterestsSlugBindings {
  const slug = result.meta.slug as InterestType;
  const meta = result.meta;
  const canonical = `${SITE}/ja/interests/${slug}`;
  const ogImage = `${SITE}/api/og?interest=${slug}`;
  const title = `${meta.title_ja}｜TOP ${result.items.length}・AI 影響度付き【2026 年版】 | 未来の仕事`;
  const seoDesc =
    `RIASEC 興味タイプ ${meta.letter} (${meta.name_ja}) におすすめの職業 TOP ${result.items.length}。` +
    `${meta.description_ja.slice(0, 80)}…AI 影響度・年収・就業者数で一覧。`;
  const statsHtml = result.stats.length > 0
    ? `<dl class="stats">${result.stats.map(([l, v]) => `<div><dt>${escapeHtml(l)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>`
    : '';
  const highlightsHtml = renderHighlights(result.highlights);
  const sectorChartHtml = renderSectorChart(result.sectorBreakdown, `セクター内訳（TOP${result.items.length}）`);
  const rankItems = result.items.map((o) => renderInterestItem(o, meta.letter)).join('');
  const faqHtml = renderFaqHtml(result.faqItems);
  const relatedHtml = renderRelatedInterests(slug, INTEREST_META);
  const jsonLd = renderJsonLd(canonical, meta, result.items, seoDesc, result.faqItems);
  const charsHtml = listOfStrings(meta.characteristics_ja, 'characteristics');
  const fieldsHtml = listOfStrings(meta.typical_fields_ja, 'fields');
  const linkRegistry = buildLinkRegistry(graph);
  const introHtml = inlineLinkText(meta.description_ja, linkRegistry, { maxLinks: 5 });
  const crossHubHtml = renderRelatedHubsBlock('interests', slug, 6);
  return {
    canonical, ogImage, title, seoDesc,
    statsHtml, highlightsHtml, sectorChartHtml, rankItems, faqHtml,
    relatedHtml, introHtml, crossHubHtml, charsHtml, fieldsHtml, jsonLd,
  };
}
