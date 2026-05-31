/**
 * src/templates/Hub.ts — HTML / JSON-LD / CSS for the 9 genre-family
 * hub clusters (abilities / knowledge / values / education / training /
 * work-styles / employment-types / life-balance / entry-paths) plus
 * careers / licenses / q / about / yearly / explore — every page that
 * imports GENRE_HUB_CSS, escapeHtml, or the render helpers.
 *
 * Extracted from src/views/genre-hub.ts on 2026-05-14 (Phase D #1 per
 * docs/architecture.md §8 row 7 "data is view, HTML is template"). This
 * is the largest of the Phase D splits — 21 page families touch the
 * GENRE_HUB_CSS export alone, 9 page families call buildGenreResult and
 * the renderGenre*JsonLd helpers.
 *
 * Templates layer rule (per scripts/check-architecture.cjs): no view
 * value imports. Types from views/genre-hub flow in via `import type`.
 */
import type { GenreOccupation, GenreHubConfig } from '../views/genre-hub.js';
import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';
import { riskClass } from '../lib/risk.js';
import { fmtInt, safeMean } from '../lib/num.js';

// Re-exports so page importers (which previously pulled these from
// views/genre-hub) have one stop for HTML-rendering primitives.
export { escapeHtml, fmtInt, safeMean, riskClass };
export { renderHighlights } from './Highlights.js';
export { renderSectorChart } from './SectorChart.js';
export { renderFaqSection as renderFaqHtml } from './FaqSection.js';

export function renderRankItem(o: GenreOccupation, shortJa: string): SafeHtml {
  const title = o.name_ja || `#${o.id}`;
  const scoreStr = o.ai_risk === null ? '—' : `${o.ai_risk}/10`;
  const band = riskClass(o.ai_risk);
  const sector = o.sector_ja || '';
  const stats: string[] = [
    `<span class="genre-score">${escapeHtml(shortJa)} ${o.primary_score.toFixed(2)}</span>`,
    `<span class="risk-pill ${band}">${escapeHtml(scoreStr)}</span>`,
  ];
  if (o.salary) stats.push(`<span class="rl-salary">${Math.trunc(o.salary)}万円</span>`);
  if (o.workers) stats.push(`<span class="rl-workers">${fmtInt(o.workers)}人</span>`);

  const sectorHtml = sector ? `<span class="rl-sector">${escapeHtml(sector)}</span>` : '';
  return (
    `<li>` +
    `<div class="rl-main">` +
    `<a class="rl-name" href="/ja/${o.id}">${escapeHtml(title)}</a>` +
    `${sectorHtml}` +
    `</div>` +
    `<div class="rl-stats">${stats.join('')}</div>` +
    `</li>`
  ) as SafeHtml;
}

// ─── JSON-LD ────────────────────────────────────────────────

const SITE = 'https://mirai-shigoto.com';
const DATE_PUBLISHED = '2026-05-10';
const DATE_MODIFIED = '2026-05-10';

export function renderGenreJsonLd(
  canonical: string,
  config: GenreHubConfig,
  items: GenreOccupation[],
  description: string,
  faqItems: ReadonlyArray<readonly [string, string]> | null,
  genrePath: string,
  genreLabel: string,
): string {
  const itemList = items.map((o, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE}/ja/${o.id}`,
    name: o.name_ja || `#${o.id}`,
  }));
  const graph: unknown[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: config.title_ja,
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
      name: config.title_ja,
      description,
      url: canonical,
      inLanguage: 'ja',
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: genreLabel, item: `${SITE}/ja/${genrePath}` },
        { '@type': 'ListItem', position: 3, name: config.title_ja, item: canonical },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#list`,
      name: config.title_ja,
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

export function renderGenreIndexJsonLd(
  canonical: string,
  genreLabel: string,
  description: string,
): string {
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${canonical}#webpage`,
          url: canonical,
          name: genreLabel,
          description,
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
            { '@type': 'ListItem', position: 2, name: genreLabel, item: canonical },
          ],
        },
      ],
    },
    null,
    2,
  );
}

// ─── Hub-index card renderers (Phase D audit #8 2026-05-14) ──────────
// Used by every */index.astro genre/family hub page. Pages prepare the
// `{slug, short_ja, description_ja, count, top, countLabel}` array; this
// template handles HTML assembly so frontmatter stays free of `.map().join`.

export interface GenreHubIndexCard {
  readonly slug: string;
  readonly short_ja: string;
  readonly description_ja: string;
  readonly count: number;
  readonly top: string;
  readonly countLabel: string;
}

export function renderGenreHubIndexCards(
  cards: ReadonlyArray<GenreHubIndexCard>,
  pathPrefix: string,
  descMaxLen: number = 90,
): SafeHtml {
  return cards.map((c) =>
    `<li><a href="/ja/${pathPrefix}/${c.slug}">` +
    `<span class="gci-name">${escapeHtml(c.short_ja)}</span>` +
    `<span class="gci-desc">${escapeHtml(c.description_ja.slice(0, descMaxLen))}…</span>` +
    (c.top ? `<span class="iri-preview">1位 ${escapeHtml(c.top)}</span>` : '') +
    `<span class="gci-count">${escapeHtml(c.countLabel)}</span>` +
    `</a></li>`,
  ).join('') as SafeHtml;
}

// ─── q/index grouped-cards renderer ────────────────────────────────────
// Q&A index renders 5 sub-genre `<section>` blocks. Each section has its
// own heading + cards. Page prepares groups; this assembles HTML.

export interface QGroupItem {
  readonly slug: string;
  readonly question: string;
  readonly short_answer: string;
}

export function renderQGroupsHtml(
  groups: ReadonlyArray<readonly [string, ReadonlyArray<QGroupItem>]>,
): SafeHtml {
  // RA-016 (2026-05-18): unified Q&A pattern via <details>. Hub used to
  // be a clickable card list (each card jumped to /ja/q/<slug>), while
  // the detail page used <details> for collapse. Two surfaces, two
  // interaction models — confusing. Now the hub is also <details>:
  // summary is the question, body is the short_answer + a "詳しく見る"
  // link to the full detail page. Keyboard, screen reader, and
  // bookmark behaviour unchanged.
  return groups.map(([title, items]) =>
    `<section><h2>${escapeHtml(title)} (${items.length})</h2>` +
    `<ul class="qa-list">` +
    items.map((q) =>
      `<li class="qa-item">` +
      `<details>` +
      `<summary>${escapeHtml(q.question)}</summary>` +
      `<div class="qa-body">` +
      `<p class="qa-short">${escapeHtml(q.short_answer)}</p>` +
      `<a class="qa-detail-link" href="/ja/q/${q.slug}">詳しく見る <span aria-hidden="true">→</span></a>` +
      `</div>` +
      `</details>` +
      `</li>`,
    ).join('') +
    `</ul></section>`,
  ).join('') as SafeHtml;
}

// ─── explore/index and explore/[route] renderers ───────────────────────

export interface ExploreIndexCard {
  readonly slug: string;
  readonly short_ja: string;
  readonly description_ja: string;
  readonly genreCount: number;
}

export function renderExploreIndexCards(cards: ReadonlyArray<ExploreIndexCard>): SafeHtml {
  return cards.map((c) =>
    `<li><a href="/ja/explore/${c.slug}">` +
    `<span class="gci-name">${escapeHtml(c.short_ja)}</span>` +
    `<span class="gci-desc">${escapeHtml(c.description_ja.slice(0, 90))}…</span>` +
    `<span class="gci-count">${c.genreCount} 個の genre</span>` +
    `</a></li>`,
  ).join('') as SafeHtml;
}

export interface ExploreGenreLink {
  readonly path: string;
  readonly label: string;
  readonly desc: string;
}

export function renderExploreGenreCards(genres: ReadonlyArray<ExploreGenreLink>): SafeHtml {
  return genres.map((g) =>
    `<li><a href="/ja/${g.path}">` +
    `<span class="gci-name">${escapeHtml(g.label)}</span>` +
    `<span class="gci-desc">${escapeHtml(g.desc)}</span>` +
    `<span class="gci-count">→ 詳しく見る</span>` +
    `</a></li>`,
  ).join('') as SafeHtml;
}

export interface ExploreOtherRoute {
  readonly slug: string;
  readonly short_ja: string;
  readonly description_ja: string;
}

export function renderExploreOtherRoutes(
  routes: ReadonlyArray<ExploreOtherRoute>,
): SafeHtml {
  return ('<ul class="related-genre">' + routes.map((r) =>
    `<li><a href="/ja/explore/${r.slug}">` +
    `<span class="rg-name">${escapeHtml(r.short_ja)}</span>` +
    `<span class="rg-desc">${escapeHtml(r.description_ja.slice(0, 60))}…</span>` +
    `</a></li>`,
  ).join('') + '</ul>') as SafeHtml;
}

export function renderExploreIndexJsonLd(): string {
  const canonical = 'https://mirai-shigoto.com/ja/explore';
  const seoDesc = '日本 556 職業を 7 つの入口から探せる。業種・ランキング・適職・スキル資格・働き方・比較・方法論。';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: '探す方法', description: seoDesc, isPartOf: { '@id': `${SITE}/#website` }, inLanguage: 'ja' },
      { '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: '探す方法', item: canonical },
      ] },
    ],
  }, null, 2);
}

export function renderExploreSlugJsonLd(slug: string, title_ja: string, seoDesc: string): string {
  const canonical = `https://mirai-shigoto.com/ja/explore/${slug}`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: title_ja, description: seoDesc, inLanguage: 'ja' },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: '探す方法', item: `${SITE}/ja/explore` },
        { '@type': 'ListItem', position: 3, name: title_ja, item: canonical },
      ] },
    ],
  }, null, 2);
}

// ─── Shared CSS for genre hub pages ──────────────────────────
//
// Page class: **Hub** (Design.md §6.5)
//   - 共通の reset / wrapper (980) / body / typography baseline / crumb / header h1 /
//     section h2 は `src/lib/canonical/hub.ts` の `CANONICAL_HUB_CSS` から継承
//   - `:root{}` token は `src/lib/canonical-css.ts` 経由で全 page global emit、
//     ここでは再宣言しない
//
// 本 export が定義する **Hub-page-only** な部分:
//   .intro/.stats (hub-grid 用), .genre-detail, .rank-list, .risk-pill,
//   .highlights, .sector-chart, .faq, .related-genre, .genre-cards
//
// `_<page>-bindings.ts` パターンの 13 hub-index page がこれを `set:html` で食べる。

import { CANONICAL_HUB_CSS } from '../lib/canonical/hub';

const HUB_PAGE_SPECIFIC_CSS = `
.intro{margin:24px 0;color:var(--fg);font-size:1.05rem;max-width:64ch}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:32px 0}
.stats>div{background:var(--bg2);border:1px solid var(--border);padding:16px;border-radius:6px}
.stats dt{font-size:.75rem;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.stats dd{font-family:var(--font-serif);font-size:1.4rem;font-weight:600;color:var(--fg)}
.genre-detail{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:24px;margin:24px 0}
.genre-detail h2{margin-top:0;font-size:1.15rem;color:var(--accent);border:none;padding:0;margin-bottom:14px}
.genre-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:18px}
@media (max-width:600px){.genre-detail-grid{grid-template-columns:1fr;gap:14px}}
.genre-detail-grid h3{font-family:var(--font-serif);font-size:1rem;color:var(--accent-deep);margin:0 0 10px}
.genre-detail-grid ul{list-style:disc;padding-left:20px;margin:0}
.genre-detail-grid li{font-size:.92rem;color:var(--fg);margin-bottom:6px;line-height:1.6}
.rank-list{list-style:none;counter-reset:rank;padding:0}
.rank-list li{counter-increment:rank;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:14px 16px;margin-bottom:8px;display:grid;grid-template-columns:36px 1fr auto;gap:14px;align-items:center}
.rank-list li:hover{border-color:var(--accent)}
.rank-list li::before{content:counter(rank);font-family:var(--font-serif);font-size:1.2rem;font-weight:700;color:var(--fg3);text-align:center}
.rank-list li:nth-child(-n+3)::before{color:var(--accent)}
.rank-list .rl-main{display:flex;flex-direction:column;gap:4px;min-width:0}
.rank-list .rl-name{font-family:var(--font-serif);font-size:1.05rem;font-weight:500;color:var(--fg);text-decoration:none;overflow:hidden;text-overflow:ellipsis}
.rank-list .rl-name:hover{color:var(--accent);text-decoration:underline}
.rank-list .rl-sector{font-size:.78rem;color:var(--fg2)}
.rank-list .rl-stats{display:flex;gap:10px;flex-wrap:wrap;align-items:center;white-space:nowrap}
.genre-score{font-family:ui-monospace,monospace;font-size:.78rem;color:var(--accent-deep);font-variant-numeric:tabular-nums;font-weight:600}
.risk-pill{display:inline-block;padding:2px 10px;border-radius:12px;font-size:.75rem;font-weight:600;font-variant-numeric:tabular-nums}
.risk-pill.low{background:#E0EAE2;color:#48705F}
.risk-pill.mid{background:#F4E5C7;color:#8A6A2A}
.risk-pill.high{background:#F5D5C7;color:#A24A28}
.rl-salary,.rl-workers{font-size:.82rem;color:var(--fg2);font-variant-numeric:tabular-nums}
.highlights{margin:24px 0}
.highlights ul{list-style:none;display:flex;flex-direction:column;gap:8px;padding:0}
.highlights li{background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--accent-deep);padding:10px 16px;border-radius:0 6px 6px 0;font-size:.9rem;color:var(--fg)}
.sector-chart{margin:24px 0}
.sc-title{font-size:.85rem;color:var(--fg2);margin-bottom:10px;font-weight:500}
.sb-row{display:grid;grid-template-columns:110px 1fr 44px;gap:8px;align-items:center;margin-bottom:5px;font-size:.8rem}
.sb-label{color:var(--fg2);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-track{height:14px;background:var(--bg3);border-radius:3px;overflow:hidden}
.sb-fill{display:block;height:100%;background:var(--accent-deep);border-radius:3px;min-width:3px}
.sb-count{color:var(--fg3);font-variant-numeric:tabular-nums;text-align:right}
.faq{margin:48px 0}
.faq details{background:var(--bg2);border:1px solid var(--border);border-radius:6px;margin-bottom:8px}
.faq summary{padding:14px 18px;cursor:pointer;font-weight:500;font-size:.95rem;color:var(--fg);list-style:none}
.faq summary::before{content:"Q. ";color:var(--accent);font-weight:700}
.faq summary::-webkit-details-marker{display:none}
.faq .faq-a{padding:0 18px 14px;font-size:.9rem;color:var(--fg2);line-height:1.7}
.related-genre{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;padding:0;margin:0;grid-auto-rows:1fr}
.related-genre li a{display:flex;flex-direction:column;padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--fg);transition:border-color 150ms;height:100%}
.related-genre li a:hover{border-color:var(--accent)}
.related-genre .rg-name{display:block;font-family:var(--font-serif);font-weight:500;color:var(--accent-deep);margin-bottom:4px}
.related-genre .rg-desc{display:block;font-size:.78rem;color:var(--fg2)}
.genre-cards{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:0;margin:0;grid-auto-rows:1fr}
.genre-cards li a{display:flex;flex-direction:column;padding:22px 22px 18px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--fg);transition:border-color 150ms,transform 150ms;min-height:160px;height:100%}
.genre-cards li a:hover{border-color:var(--accent);transform:translateY(-1px)}
.gci-name{display:block;font-family:var(--font-serif);font-size:1.2rem;font-weight:600;color:var(--accent-deep);margin-bottom:10px}
.gci-desc{display:-webkit-box;font-size:.86rem;color:var(--fg2);line-height:1.6;margin-bottom:10px;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;flex:1}
.iri-preview{display:block;font-size:.78rem;color:var(--fg2);line-height:1.4;margin-bottom:8px;min-height:1.96em;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.gci-count{font-size:.78rem;color:var(--fg3);font-variant-numeric:tabular-nums}
/* RA-016 (2026-05-18): unified Q&A details list — see renderQGroupsHtml */
.qa-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:16px}
.qa-item details{background:var(--bg2);border:1px solid var(--border);border-radius:10px;transition:border-color 150ms,box-shadow 150ms}
.qa-item details[open]{border-color:var(--accent);box-shadow:0 4px 14px rgba(217,107,61,0.08)}
/* RA-120 (2026-05-18): mobile min-height stops alternating 61↔91 row heights when long questions wrap to 2 lines. */
.qa-item summary{cursor:pointer;padding:16px 22px;font-family:var(--font-serif);font-size:1.05rem;font-weight:600;color:var(--accent-deep);list-style:none;display:flex;justify-content:space-between;align-items:center;gap:14px;min-height:60px}
.qa-item summary::-webkit-details-marker{display:none}
.qa-item summary::after{content:"+";font-family:var(--font-sans);font-weight:400;font-size:1.4rem;color:var(--fg2);transition:transform 150ms;flex-shrink:0;line-height:1}
.qa-item details[open] summary::after{content:"\\00d7"}
.qa-item summary:hover{color:var(--accent)}
.qa-item .qa-body{padding:0 22px 18px;border-top:1px solid var(--line)}
.qa-item .qa-short{margin:14px 0 12px;color:var(--fg);line-height:1.7;font-size:.94rem}
.qa-item .qa-detail-link{display:inline-block;font-size:.84rem;color:var(--accent);text-decoration:none;font-weight:500;padding:6px 0}
.qa-item .qa-detail-link:hover{text-decoration:underline}
@media (max-width:600px){.rank-list li{grid-template-columns:28px 1fr;gap:10px}.rank-list .rl-stats{margin-top:6px;grid-column:1 / -1}.sb-row{grid-template-columns:80px 1fr 36px}}
`;

export const GENRE_HUB_CSS = CANONICAL_HUB_CSS + HUB_PAGE_SPECIFIC_CSS;
