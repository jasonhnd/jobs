/**
 * src/pages/licenses/_license-bindings.ts — bindings builder for
 * /licenses/[license].astro. Phase D audit #7 slim (2026-05-14).
 */
import type { KnowledgeGraph } from '@/graph';
import type { LicenseHub } from '@/views/licenses-meta.js';
import { LICENSE_HUBS } from '@/views/licenses-meta.js';
import type { GenreOccupation, DetailFileMin } from '@/views/genre-hub.js';
import { occupationPath } from '@/lib/urls';

/**
 * Match-and-rank pipeline for getStaticPaths — kept here so the page
 * file doesn't carry the 20-line map/filter/score chain in its
 * frontmatter (doc §2.5).
 */
export function buildLicenseItems(
  details: DetailFileMin[],
  hub: LicenseHub,
  matchFn: (d: DetailFileMin, h: LicenseHub) => boolean,
  rankFn: (d: DetailFileMin, h: LicenseHub) => number,
): GenreOccupation[] {
  return details
    .filter((d) => matchFn(d, hub))
    .map((d) => ({ d, score: rankFn(d, hub) }))
    .sort((a, b) => b.score - a.score).slice(0, 30)
    .map(({ d }) => ({
      id: d.id, name_ja: d.title?.ja ?? `#${d.id}`,
      primary_score: (d.related_certs_ja ?? []).length,
      ai_risk: d.ai_risk?.score ?? null, risk_band: d.risk_band ?? null,
      workers: d.stats?.workers ?? null, salary: d.stats?.salary_man_yen ?? null,
      monthly_hours: d.stats?.monthly_hours ?? null, average_age: d.stats?.average_age ?? null,
      sector_id: d.sector?.id ?? '', sector_ja: d.sector?.ja ?? '',
    }));
}
import {
  renderRankItem, renderHighlights, renderSectorChart, renderFaqHtml,
  escapeHtml, fmtInt, safeMean,
} from '@/templates/Hub.js';
import { buildLinkRegistry, inlineLinkText } from '@/views/inline-links.js';
import { renderRelatedHubsBlock } from '@/views/hub-hub-graph.js';

const SITE = 'https://mirai-shigoto.com';

export interface LicenseBindingsInput {
  readonly hub: LicenseHub;
  readonly items: GenreOccupation[];
  readonly graph: KnowledgeGraph;
}

export interface LicenseBindings {
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
  readonly examplesHtml: string;
  readonly jsonLd: string;
}

function listOfStrings(items: ReadonlyArray<string>, cls: string): string {
  return '<ul class="' + cls + '">' + items.map((s) => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>';
}

export function buildLicenseBindings(input: LicenseBindingsInput): LicenseBindings {
  const { hub, items, graph } = input;
  const canonical = `${SITE}/licenses/${hub.slug}`;
  const ogImage = `${SITE}/api/og?license=${hub.slug}`;
  const title = `${hub.title_ja}｜${items.length} 職業 | 未来の仕事`;
  const seoDesc = `${hub.short_ja}カテゴリーの資格と関連職業 ${items.length} 件。${hub.description_ja.slice(0, 80)}…`;

  const meanRisk = safeMean(items.map((o) => o.ai_risk));
  const meanSalary = safeMean(items.map((o) => o.salary));
  const totalWorkers = items.reduce((s, o) => s + (o.workers ?? 0), 0);

  const statsHtml =
    `<dl class="stats">` +
    `<div><dt>関連職業数</dt><dd>${items.length}</dd></div>` +
    `<div><dt>平均 AI 影響</dt><dd>${meanRisk > 0 ? meanRisk.toFixed(1) + ' / 10' : '—'}</dd></div>` +
    `<div><dt>平均年収</dt><dd>${meanSalary > 0 ? Math.trunc(meanSalary) + ' 万円' : '—'}</dd></div>` +
    `<div><dt>合計就業者数</dt><dd>${fmtInt(totalWorkers)} 人</dd></div>` +
    `</dl>`;

  const sectorCounts = new Map<string, number>();
  for (const o of items) if (o.sector_ja) sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
  const sectorBreakdown = Array.from(sectorCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sectorChartHtml = renderSectorChart(sectorBreakdown, `セクター内訳`);

  const top3 = items.slice(0, 3).map((o) => o.name_ja).join('、');
  const highlights = [
    `1 位は「${items[0]?.name_ja ?? '—'}」`,
    top3 ? `TOP 3 は ${top3}` : '',
    meanRisk > 0 ? `平均 AI 影響度 ${meanRisk.toFixed(1)}/10` : '',
    `代表資格: ${hub.cert_examples_ja.slice(0, 3).join('、')}`,
  ].filter(Boolean);
  const highlightsHtml = renderHighlights(highlights);
  const rankItems = items.map((o) => renderRankItem(o, hub.short_ja)).join('');

  const faqs: Array<readonly [string, string]> = [
    [`${hub.short_ja}カテゴリーとは？`, hub.description_ja],
    [`代表的な資格は？`, `${hub.cert_examples_ja.join('、')} などが該当します。`],
    [`取得の難度は？`, hub.difficulty_ja],
    [`関連する職業は何件ある？`, `本サイトでは ${items.length} 職業を該当として表示しています。資格の検索キーワードに基づく自動分類です。`],
  ];
  const faqHtml = renderFaqHtml(faqs);
  const examplesHtml = listOfStrings(hub.cert_examples_ja, 'cert-examples');

  const linkRegistry = buildLinkRegistry(graph);
  const introHtml = inlineLinkText(hub.description_ja, linkRegistry, { maxLinks: 5 });
  const crossHubHtml = renderRelatedHubsBlock('licenses', hub.slug, 6);

  const relatedHtml = '<ul class="related-genre">' + LICENSE_HUBS
    .filter((h) => h.slug !== hub.slug).slice(0, 8)
    .map((h) => `<li><a href="/licenses/${h.slug}"><span class="rg-name">${escapeHtml(h.short_ja)}</span><span class="rg-desc">${escapeHtml(h.description_ja.slice(0, 60))}…</span></a></li>`)
    .join('') + '</ul>';

  const itemList = items.map((o, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}${occupationPath(o.id)}`, name: o.name_ja }));
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: hub.title_ja, description: seoDesc },
      { '@type': 'CollectionPage', '@id': `${canonical}#collection`, name: hub.title_ja, description: seoDesc },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: '資格から探す', item: `${SITE}/licenses` },
        { '@type': 'ListItem', position: 3, name: hub.title_ja, item: canonical },
      ] },
      { '@type': 'ItemList', numberOfItems: itemList.length, itemListElement: itemList },
      { '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  }, null, 2);

  return {
    canonical, ogImage, title, seoDesc,
    statsHtml, highlightsHtml, sectorChartHtml, rankItems, faqHtml,
    introHtml, crossHubHtml, relatedHtml, examplesHtml, jsonLd,
  };
}
