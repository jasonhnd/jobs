/**
 * src/templates/InterestHub.ts — HTML / JSON-LD / CSS for the 6
 * /interests/[type] hub pages + /interests index.
 *
 * Extracted from src/views/interests.ts on 2026-05-14 (Phase D #3 per
 * docs/architecture.md §8 row 9 "data is view, HTML is template").
 *
 * Templates layer rule (per scripts/check-architecture.cjs): no view-value
 * imports allowed. The previous `renderRelatedInterests` reached into the
 * INTEREST_META constant from src/views/interests-meta — this template
 * instead takes the meta list as a function parameter so the call-site
 * (page) passes it explicitly.
 */
import type { InterestType, InterestMeta } from '../views/interests-meta.js';
import type { InterestOccupation } from '../views/interests.js';
import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';
import { riskClass } from '../lib/risk.js';
import { fmtInt } from '../lib/num.js';

export { escapeHtml };

export { renderHighlights } from './Highlights.js';
export { renderSectorChart } from './SectorChart.js';
export { renderFaqSection as renderFaqHtml } from './FaqSection.js';

/**
 * Mini RIASEC bar — 6 小さい縦棒で R/I/A/S/E/C を可視化。
 */
export function renderRiasecMini(
  o: InterestOccupation,
  primary: 'R' | 'I' | 'A' | 'S' | 'E' | 'C',
): string {
  const dims: Array<['R' | 'I' | 'A' | 'S' | 'E' | 'C', number]> = [
    ['R', o.riasec.R],
    ['I', o.riasec.I],
    ['A', o.riasec.A],
    ['S', o.riasec.S],
    ['E', o.riasec.E],
    ['C', o.riasec.C],
  ];
  const bars = dims
    .map(([letter, v]) => {
      const pct = Math.max(2, Math.min(100, (v / 5) * 100));
      const cls = letter === primary ? 'rmini-bar primary' : 'rmini-bar';
      return `<span class="${cls}" style="height:${pct.toFixed(0)}%" title="${letter}: ${v.toFixed(2)}"></span>`;
    })
    .join('');
  return `<span class="rmini" aria-label="RIASEC profile">${bars}</span>`;
}

export function renderInterestItem(
  o: InterestOccupation,
  primary: 'R' | 'I' | 'A' | 'S' | 'E' | 'C',
): string {
  const title = o.name_ja || `#${o.id}`;
  const score = o.ai_risk;
  const scoreStr = score === null ? '—' : `${score}/10`;
  const band = riskClass(score);
  const sector = o.sector_ja || '';
  const salary = o.salary;
  const workers = o.workers;

  const stats: string[] = [
    `<span class="rmini-wrap">${renderRiasecMini(o, primary)}<span class="rmini-score">${primary} ${o.primary_score.toFixed(2)}</span></span>`,
    `<span class="risk-pill ${band}">${escapeHtml(scoreStr)}</span>`,
  ];
  if (salary) stats.push(`<span class="rl-salary">${Math.trunc(salary)}万円</span>`);
  if (workers) stats.push(`<span class="rl-workers">${fmtInt(workers)}人</span>`);

  const sectorHtml = sector ? `<span class="rl-sector">${escapeHtml(sector)}</span>` : '';
  return (
    `<li>` +
    `<div class="rl-main">` +
    `<a class="rl-name" href="/${o.id}">${escapeHtml(title)}</a>` +
    `${sectorHtml}` +
    `</div>` +
    `<div class="rl-stats">${stats.join('')}</div>` +
    `</li>`
  );
}

/**
 * Phase D #3 (2026-05-14) signature change: `allMeta` now passed in by
 * caller. Previous version read INTEREST_META from view layer.
 */
export function renderRelatedInterests(
  currentSlug: InterestType,
  allMeta: ReadonlyArray<InterestMeta>,
): string {
  const items = allMeta
    .filter((m) => m.slug !== currentSlug)
    .map(
      (m) =>
        `<li><a href="/interests/${m.slug}">` +
        `<span class="ri-letter">${m.letter}</span>` +
        `<span class="ri-name">${escapeHtml(m.name_ja)}タイプ</span>` +
        `<span class="ri-desc">${escapeHtml(m.typical_fields_ja.slice(0, 3).join('・'))}</span>` +
        `</a></li>`,
    )
    .join('');
  return `<ul class="related-interests">${items}</ul>`;
}

// ─── JSON-LD ────────────────────────────────────────────────────

const SITE = 'https://mirai-shigoto.com';
const DATE_PUBLISHED = '2026-05-09';
const DATE_MODIFIED = '2026-05-30';  // Bumped to latest score-run date; see Ranking.ts

export function renderJsonLd(
  canonical: string,
  meta: InterestMeta,
  items: InterestOccupation[],
  description: string,
  faqItems: ReadonlyArray<readonly [string, string]> | null,
): string {
  const itemList = items.map((o, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE}/${o.id}`,
    name: o.name_ja || `#${o.id}`,
  }));

  const graph: unknown[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: meta.title_ja,
      description,
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'ja',
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      publisher: { '@id': `${SITE}/#organization` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
    },
    {
      '@type': 'CollectionPage',
      '@id': `${canonical}#collection`,
      name: meta.title_ja,
      description,
      url: canonical,
      inLanguage: 'ja',
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      isPartOf: { '@id': `${canonical}#webpage` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: '興味タイプから探す', item: `${SITE}/interests` },
        { '@type': 'ListItem', position: 3, name: meta.title_ja, item: canonical },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#list`,
      name: meta.title_ja,
      numberOfItems: itemList.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: itemList,
    },
  ];

  if (faqItems && faqItems.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faqItems.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

// ─── interests/index hub-card renderer (Phase D audit #8 2026-05-14) ────

export interface InterestsHubCard {
  readonly slug: string;
  readonly letter: string;
  readonly name_ja: string;
  readonly description_ja: string;
  readonly top_preview: string | null | undefined;
  readonly top_count: number;
}

export function renderInterestsHubCards(cards: ReadonlyArray<InterestsHubCard>): SafeHtml {
  return cards.map((c) => {
    const previewHtml = c.top_preview ? `<span class="iri-preview">${escapeHtml(c.top_preview)}</span>` : '';
    return (
      `<li><a href="/interests/${c.slug}">` +
      `<span class="iri-letter">${c.letter}</span>` +
      `<span class="iri-name">${escapeHtml(c.name_ja)}タイプ</span>` +
      `<span class="iri-desc">${escapeHtml(c.description_ja.slice(0, 90) + '…')}</span>` +
      `${previewHtml}` +
      `<span class="iri-count">TOP ${c.top_count} 職業</span>` +
      `</a></li>`
    );
  }).join('') as SafeHtml;
}

export function renderHubJsonLd(): string {
  const canonical = `${SITE}/interests`;
  const seoDesc =
    '日本の 556 職業を RIASEC 興味タイプ 6 分類で整理。' +
    '現実的・研究的・芸術的・社会的・企業的・慣習的の各タイプにおすすめの職業を一覧。';
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          url: canonical,
          name: '興味タイプから探す',
          description: seoDesc,
          isPartOf: { '@id': `${SITE}/#website` },
          inLanguage: 'ja',
          datePublished: DATE_PUBLISHED,
          dateModified: DATE_MODIFIED,
          publisher: { '@id': `${SITE}/#organization` },
          breadcrumb: { '@id': `${canonical}#breadcrumb` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${canonical}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: '興味タイプから探す', item: canonical },
          ],
        },
      ],
    },
    null,
    2,
  );
}
