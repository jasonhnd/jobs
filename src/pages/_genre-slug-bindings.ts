/**
 * src/pages/_genre-slug-bindings.ts — single-entry binding builder
 * for the 9 genre-family [slug].astro pages (abilities / knowledge /
 * values / education / training / work-styles / employment-types /
 * life-balance / entry-paths).
 *
 * Created 2026-05-14 (Phase D audit #7) to absorb the ~50 lines of
 * frontmatter business logic that previously lived in each page,
 * keeping each [slug].astro thin per doc §2.5 (page = view+template
 * binding, not business logic).
 *
 * The 9 pages share an identical render shape; what varies is genre
 * path, genre label, OG param, the `*_CONFIGS` constant, and the
 * sub-text + SEO-desc templating. All those are passed in via the
 * `GenreSlugInput`.
 *
 * Page-local sibling (Astro `_`-prefix → not routed).
 */

import type { KnowledgeGraph } from '@/graph';
import type { GenreResult, GenreHubConfig } from '@/views/genre-hub.js';
import {
  renderRankItem,
  renderHighlights,
  renderSectorChart,
  renderFaqHtml,
  renderGenreJsonLd,
  escapeHtml,
} from '@/templates/Hub.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';
import type { HubGenre } from '@/views/hub-hub-graph.js';

const SITE_ORIGIN = 'https://mirai-shigoto.com';

export interface GenreSlugInput {
  readonly result: GenreResult;
  readonly graph: KnowledgeGraph;
  /** URL prefix segment, e.g. 'abilities' for /abilities/{slug}. */
  readonly genrePath: string;
  /** Display label for breadcrumb / sub-page, e.g. '能力から探す'. */
  readonly genreLabel: string;
  /** OG endpoint query parameter name, e.g. 'ability' for /api/og?ability={slug}. */
  readonly ogParam: string;
  /** The genre's `*_CONFIGS` array — used for the related-genre footer list. */
  readonly allConfigs: ReadonlyArray<GenreHubConfig>;
  /** Subtitle template for the page header `<p class="sub">`. */
  readonly subTemplate: (shortJa: string, n: number) => string;
  /** SEO meta description template. */
  readonly seoDescTemplate: (shortJa: string, n: number, descJa: string) => string;
  /** Optional title override; defaults to `${titleJa}｜TOP ${n}・AI 影響度付き【2026 年版】 | 未来の仕事`. */
  readonly titleTemplate?: (titleJa: string, n: number) => string;
  /** Heading text for the related-genre section, e.g. '他の能力'. */
  readonly relatedHeading: string;
  /** Cross-hub `genre` key passed to renderRelatedHubsBlock — must be one of HubGenre. */
  readonly crossHubKey: HubGenre;
}

export interface GenreSlugBindings {
  readonly canonical: string;
  readonly ogImage: string;
  readonly title: string;
  readonly seoDesc: string;
  readonly subHtml: string;
  readonly jsonLd: string;
  readonly statsHtml: string;
  readonly highlightsHtml: string;
  readonly sectorChartHtml: string;
  readonly rankItems: string;
  readonly faqHtml: string;
  readonly introHtml: string;
  readonly crossHubHtml: string;
  readonly relatedHtml: string;
  readonly charsHtml: string;
  readonly developHtml: string;
}

function listOfStrings(items: ReadonlyArray<string>, cls: string): string {
  return '<ul class="' + cls + '">' + items.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
}

export function buildGenreSlugBindings(input: GenreSlugInput): GenreSlugBindings {
  const { result, graph, genrePath, genreLabel, ogParam, allConfigs, subTemplate, seoDescTemplate, titleTemplate, relatedHeading: _h, crossHubKey } = input;
  void _h; // accepted for symmetry; the template injects the heading
  const cfg = result.config;
  const n = result.items.length;

  const canonical = `${SITE_ORIGIN}/${genrePath}/${cfg.slug}`;
  const ogImage = `${SITE_ORIGIN}/api/og?${ogParam}=${cfg.slug}`;
  const title = titleTemplate
    ? titleTemplate(cfg.title_ja, n)
    : `${cfg.title_ja}｜TOP ${n}・AI 影響度付き【2026 年版】 | 未来の仕事`;
  const seoDesc = seoDescTemplate(cfg.short_ja, n, cfg.description_ja);
  const subHtml = subTemplate(cfg.short_ja, n);

  const statsHtml = result.stats.length > 0
    ? `<dl class="stats">${result.stats
        .map(([l, v]) => `<div><dt>${escapeHtml(l)}</dt><dd>${escapeHtml(v)}</dd></div>`)
        .join('')}</dl>`
    : '';
  const highlightsHtml = renderHighlights(result.highlights);
  const sectorChartHtml = renderSectorChart(result.sectorBreakdown, `セクター内訳（TOP${n}）`);
  const rankItems = result.items.map((o) => renderRankItem(o, cfg.short_ja)).join('');
  const faqHtml = renderFaqHtml(result.faqItems);
  const jsonLd = renderGenreJsonLd(canonical, cfg, result.items, seoDesc, result.faqItems, genrePath, genreLabel);

  const linkRegistry = buildLinkRegistry(graph);
  const introHtml = inlineLinkText(cfg.description_ja, linkRegistry, { maxLinks: 5 });
  const crossHubHtml = renderRelatedHubsBlock(crossHubKey, cfg.slug, 6);

  const charsHtml = cfg.characteristics_ja ? listOfStrings(cfg.characteristics_ja, 'characteristics') : '';
  const developHtml = cfg.how_to_develop_ja ? listOfStrings(cfg.how_to_develop_ja, 'how-to-develop') : '';

  const relatedHtml = '<ul class="related-genre">' + allConfigs
    .filter((m) => m.slug !== cfg.slug)
    .map((m) => `<li><a href="/${genrePath}/${m.slug}"><span class="rg-name">${escapeHtml(m.short_ja)}</span><span class="rg-desc">${escapeHtml(m.description_ja.slice(0, 60))}…</span></a></li>`)
    .join('') + '</ul>';

  return {
    canonical, ogImage, title, seoDesc, subHtml, jsonLd,
    statsHtml, highlightsHtml, sectorChartHtml, rankItems, faqHtml,
    introHtml, crossHubHtml, relatedHtml, charsHtml, developHtml,
  };
}
