/**
 * src/pages/careers/_career-bindings.ts — bindings builder for
 * /careers/[career].astro.
 *
 * Created 2026-05-14 (Phase D audit #7) to slim careers/[career].astro
 * frontmatter from 135 lines → ≤30 lines per doc §2.5.
 */

import type { KnowledgeGraph } from '@/graph';
import type { CareerPersona } from '@/views/careers-meta.js';
import { CAREER_PERSONAS } from '@/views/careers-meta.js';
import type { GenreOccupation, DetailFileMin } from '@/views/genre-hub.js';
import { occupationPath } from '@/lib/urls';

/**
 * Match-and-score pipeline used in getStaticPaths. Kept here so the page
 * frontmatter doesn't carry the 20-line filter+score chain.
 */
export function buildCareerItems(details: DetailFileMin[], persona: CareerPersona): GenreOccupation[] {
  return details
    .map((d) => ({ d, score: persona.recommend(d) }))
    .filter((x): x is { d: DetailFileMin; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score).slice(0, 30)
    .map((s) => ({
      id: s.d.id, name_ja: s.d.title?.ja ?? `#${s.d.id}`, primary_score: s.score,
      ai_risk: s.d.ai_risk?.score ?? null, risk_band: s.d.risk_band ?? null,
      workers: s.d.stats?.workers ?? null, salary: s.d.stats?.salary_man_yen ?? null,
      monthly_hours: s.d.stats?.monthly_hours ?? null, average_age: s.d.stats?.average_age ?? null,
      sector_id: s.d.sector?.id ?? '', sector_ja: s.d.sector?.ja ?? '',
    }));
}
import {
  renderRankItem, renderHighlights, renderSectorChart, renderFaqHtml,
  escapeHtml, safeMean,
} from '@/templates/Hub.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';

const SITE = 'https://mirai-shigoto.com';

export interface CareerBindingsInput {
  readonly persona: CareerPersona;
  readonly items: GenreOccupation[];
  readonly graph: KnowledgeGraph;
}

export interface CareerBindings {
  readonly canonical: string;
  readonly ogImage: string;
  readonly title: string;
  readonly seoDesc: string;
  readonly statsHtml: string;
  readonly highlightsHtml: string;
  readonly sectorChartHtml: string;
  readonly rankItems: string;
  readonly faqHtml: string;
  readonly introHtml: string;
  readonly crossHubHtml: string;
  readonly relatedHtml: string;
  readonly advantagesHtml: string;
  readonly cautionsHtml: string;
  readonly jsonLd: string;
}

function listOfStrings(items: ReadonlyArray<string>, cls: string): string {
  return '<ul class="' + cls + '">' + items.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
}

export function buildCareerBindings(input: CareerBindingsInput): CareerBindings {
  const { persona, items, graph } = input;
  const canonical = `${SITE}/careers/${persona.slug}`;
  const ogImage = `${SITE}/api/og?career=${persona.slug}`;
  const title = `${persona.title_ja}｜推薦 TOP ${items.length} | 未来の仕事`;
  const seoDesc = `${persona.short_ja}向けの推薦職業 TOP ${items.length}。${persona.description_ja.slice(0, 80)}…`;

  const meanRisk = safeMean(items.map((o) => o.ai_risk));
  const meanSalary = safeMean(items.map((o) => o.salary));

  const statsHtml =
    `<dl class="stats">` +
    `<div><dt>推薦数</dt><dd>${items.length}</dd></div>` +
    `<div><dt>平均 AI 影響</dt><dd>${meanRisk > 0 ? meanRisk.toFixed(1) + ' / 10' : '—'}</dd></div>` +
    `<div><dt>平均年収</dt><dd>${meanSalary > 0 ? Math.trunc(meanSalary) + ' 万円' : '—'}</dd></div>` +
    `</dl>`;

  const sectorCounts = new Map<string, number>();
  for (const o of items) if (o.sector_ja) sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
  const sectorBreakdown = Array.from(sectorCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sectorChartHtml = renderSectorChart(sectorBreakdown, `セクター内訳（TOP${items.length}）`);

  const top3 = items.slice(0, 3).map((o) => o.name_ja).join('、');
  const highlights = [
    `1 位は「${items[0]?.name_ja ?? '—'}」`,
    top3 ? `TOP 3 は ${top3}` : '',
    meanRisk > 0 ? `平均 AI 影響度 ${meanRisk.toFixed(1)}/10` : '',
    persona.advantages_ja[0] ? `利点: ${persona.advantages_ja[0]}` : '',
  ].filter(Boolean);
  const highlightsHtml = renderHighlights(highlights);

  const rankItems = items.map((o) => renderRankItem(o, persona.short_ja)).join('');

  const faqs: Array<readonly [string, string]> = [
    [`${persona.short_ja}の特徴は？`, persona.description_ja],
    [`${persona.short_ja}向けに推薦される職業 TOP 3 は？`, top3 ? `${top3} 等の ${items.length} 職業を推薦。` : '推薦数が少ないため条件を再確認してください。'],
    [`${persona.short_ja}が選ぶ際の注意点は？`, persona.cautions_ja.join('。') + '。'],
    [`${persona.short_ja}の利点は？`, persona.advantages_ja.join('。') + '。'],
  ];
  const faqHtml = renderFaqHtml(faqs);

  const advantagesHtml = listOfStrings(persona.advantages_ja, 'advantages');
  const cautionsHtml = listOfStrings(persona.cautions_ja, 'cautions');

  const linkRegistry = buildLinkRegistry(graph);
  const introHtml = inlineLinkText(persona.description_ja, linkRegistry, { maxLinks: 5 });
  const crossHubHtml = renderRelatedHubsBlock('careers', persona.slug, 6);

  const relatedHtml = '<ul class="related-genre">' + CAREER_PERSONAS
    .filter((p) => p.slug !== persona.slug)
    .map((p) => `<li><a href="/careers/${p.slug}"><span class="rg-name">${escapeHtml(p.short_ja)}</span><span class="rg-desc">${escapeHtml(p.description_ja.slice(0, 60))}…</span></a></li>`)
    .join('') + '</ul>';

  const itemList = items.map((o, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE}${occupationPath(o.id)}`,
    name: o.name_ja,
  }));
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: persona.title_ja, description: seoDesc, isPartOf: { '@id': `${SITE}/#website` }, inLanguage: 'ja' },
      { '@type': 'CollectionPage', '@id': `${canonical}#collection`, name: persona.title_ja, description: seoDesc },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'キャリア段階から探す', item: `${SITE}/careers` },
        { '@type': 'ListItem', position: 3, name: persona.title_ja, item: canonical },
      ] },
      { '@type': 'ItemList', numberOfItems: itemList.length, itemListElement: itemList },
      { '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  }, null, 2);

  return {
    canonical, ogImage, title, seoDesc,
    statsHtml, highlightsHtml, sectorChartHtml, rankItems, faqHtml,
    introHtml, crossHubHtml, relatedHtml, advantagesHtml, cautionsHtml,
    jsonLd,
  };
}
