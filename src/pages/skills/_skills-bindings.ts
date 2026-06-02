/**
 * src/pages/skills/_skills-bindings.ts — bindings for [skill].astro.
 * Phase D audit #7 (2026-05-14): page frontmatter ≤30 lines per doc §2.5.
 */
import type { KnowledgeGraph } from '@/graph';
import type { SkillResult } from '@/views/skills-hub.js';
import type { SkillSlug } from '@/views/skills-meta.js';
import { SKILL_META } from '@/views/skills-meta.js';
import {
  renderSkillItem, renderHighlights, renderSectorChart,
  renderFaqHtml, renderRelatedSkills, renderJsonLd, escapeHtml,
} from '@/templates/SkillHub.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';

const SITE = 'https://mirai-shigoto.com';

export interface SkillsSlugBindings {
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
  readonly useCasesHtml: string;
  readonly trainHtml: string;
  readonly jsonLd: string;
}

function listOfStrings(items: ReadonlyArray<string>, cls: string): string {
  return '<ul class="' + cls + '">' + items.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
}

export function buildSkillsSlugBindings(result: SkillResult, graph: KnowledgeGraph): SkillsSlugBindings {
  const slug = result.meta.slug as SkillSlug;
  const meta = result.meta;
  const canonical = `${SITE}/skills/${slug}`;
  const ogImage = `${SITE}/api/og?skill=${slug}`;
  const title = `${meta.title_ja}｜TOP ${result.items.length}・AI 影響度付き【2026 年版】 | 未来の仕事`;
  const seoDesc =
    `${meta.short_ja}スコアが高い職業 TOP ${result.items.length}。` +
    `${meta.description_ja.slice(0, 80)}…AI 影響度・年収・就業者数で一覧。`;
  const statsHtml = result.stats.length > 0
    ? `<dl class="stats">${result.stats.map(([l, v]) => `<div><dt>${escapeHtml(l)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>`
    : '';
  const highlightsHtml = renderHighlights(result.highlights);
  const sectorChartHtml = renderSectorChart(result.sectorBreakdown, `セクター内訳（TOP${result.items.length}）`);
  const rankItems = result.items.map((o) => renderSkillItem(o, meta.short_ja)).join('');
  const faqHtml = renderFaqHtml(result.faqItems);
  const relatedHtml = renderRelatedSkills(slug, SKILL_META);
  const jsonLd = renderJsonLd(canonical, meta, result.items, seoDesc, result.faqItems);
  const useCasesHtml = listOfStrings(meta.use_cases_ja, 'use-cases');
  const trainHtml = listOfStrings(meta.how_to_train_ja, 'how-to-train');
  const linkRegistry = buildLinkRegistry(graph);
  const introHtml = inlineLinkText(meta.description_ja, linkRegistry, { maxLinks: 5 });
  const crossHubHtml = renderRelatedHubsBlock('skills', slug, 6);
  return {
    canonical, ogImage, title, seoDesc,
    statsHtml, highlightsHtml, sectorChartHtml, rankItems, faqHtml,
    relatedHtml, introHtml, crossHubHtml, useCasesHtml, trainHtml, jsonLd,
  };
}
