/**
 * src/templates/Ranking.ts — HTML / JSON-LD rendering helpers per ranking
 * page. Moved here from src/views/ranking-renderers.ts on 2026-05-14 as
 * Phase D #5 (doc §8 row 11 "templates/Ranking.astro + primitives").
 *
 * All functions return safe HTML strings. Every interpolation of user-
 * derived content goes through `escapeHtml`.
 *
 * Templates layer rule (per scripts/check-architecture.cjs): no view-value
 * imports allowed. Where the previous ranking-renderers reached into
 * `ALL_RANKINGS` / `DEMAND_JA` from views/rankings, this template now
 * either takes the value as a function parameter (renderRelatedRankings
 * takes allRankings) or uses local constants (DEMAND_JA is a tiny
 * dictionary kept in sync via doc reference).
 */
import type { Occupation } from '../views/ranking.js';
import type { RankingSlug } from '../views/rankings-meta.js';
import { escapeHtml } from '../lib/safe-html.js';
import { riskClass as riskBand } from '../lib/risk.js';
import { fmtInt } from '../lib/num.js';

// Local mirror of views/rankings.ts:safeMean — takes occupation objects +
// numeric key, returns the mean over non-null values. Templates can't import
// view-layer values; this duplicates the 4-line helper to keep the template
// self-contained. Drift detector in Ranking.test.ts pins identical output.
function safeMean(items: Occupation[], key: keyof Occupation): number {
  const vals = items
    .map((o) => o[key])
    .filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

// Local mirror of DEMAND_JA from views/rankings.ts (templates cannot import
// view-layer values). Kept tiny + audited — drift detector in
// src/templates/Ranking.test.ts checks the two stay in sync.
const DEMAND_JA: Record<string, string> = {
  hot: '高需要',
  normal: '通常',
  cold: '低需要',
};

export { escapeHtml };

/**
 * Extra column injected to the right of the risk-pill.
 *
 * The audit's concern was that the old API (`extraCols: string[]` of raw
 * HTML chunks) couldn't enforce escaping at the call site. This
 * discriminated union moves the responsibility into the renderer:
 *
 *   - A plain string is wrapped as `<span class="rl-extra">…</span>` with
 *     the text HTML-escaped.
 *   - `{ kind: 'demand-pill', band, label }` renders as the colored
 *     demand badge used on the `high-demand` / `ai-safe-high-demand` /
 *     `high-salary-high-demand` rankings — both `band` and `label` are
 *     escaped before insertion.
 *
 * Adding a new shape: extend the union here and add the matching branch
 * in renderRankItem below. Each new branch must HTML-escape any field
 * interpolated into class names or text.
 */
export type ExtraCol =
  | string
  | { kind: 'demand-pill'; band: string; label: string };

export function renderRankItem(
  o: Occupation,
  showSalary: boolean,
  extraCols: ReadonlyArray<ExtraCol> | null,
): string {
  const title = o.title_ja ?? `#${o.id}`;
  const score = o.ai_risk;
  const scoreStr = score === null ? '—' : `${score}/10`;
  const band = riskBand(score);
  const sector = o.sector_ja || '';
  const salary = o.salary;
  const workers = o.workers;

  const statsParts: string[] = [
    `<span class="risk-pill ${band}">${escapeHtml(scoreStr)}</span>`,
  ];
  if (extraCols) {
    for (const c of extraCols) {
      if (typeof c === 'string') {
        statsParts.push(`<span class="rl-extra">${escapeHtml(c)}</span>`);
      } else if (c.kind === 'demand-pill') {
        statsParts.push(
          `<span class="demand-pill ${escapeHtml(c.band)}">${escapeHtml(c.label)}</span>`,
        );
      }
    }
  }
  if (showSalary && salary) {
    statsParts.push(`<span class="rl-salary">${Math.trunc(salary)}万円</span>`);
  }
  if (workers) {
    statsParts.push(`<span class="rl-workers">${fmtInt(workers)}人</span>`);
  }

  const sectorHtml = sector ? `<span class="rl-sector">${escapeHtml(sector)}</span>` : '';
  return (
    `<li>` +
    `<div class="rl-main">` +
    `<a class="rl-name" href="/ja/${o.id}">${escapeHtml(title)}</a>` +
    `${sectorHtml}` +
    `</div>` +
    `<div class="rl-stats">${statsParts.join('')}</div>` +
    `</li>`
  );
}

export function renderHighlights(items: Occupation[], slug: RankingSlug): string {
  if (items.length === 0) return '';
  const top = items[0];
  const name = top.title_ja ?? '';
  const hl: string[] = [];

  if (slug === 'ai-risk-high' || slug === 'ai-risk-low') {
    hl.push(`1位は「${name}」（AI影響度 ${top.ai_risk}/10）`);
  } else if (slug === 'salary') {
    hl.push(`1位は「${name}」（年収 ${Math.trunc(top.salary ?? 0)}万円）`);
  } else if (slug === 'entry-salary') {
    hl.push(`1位は「${name}」（初任給 ${Math.trunc(top.recruit_wage ?? 0)}万円）`);
  } else if (slug === 'young-workforce') {
    hl.push(`1位は「${name}」（平均年齢 ${(top.average_age ?? 0).toFixed(1)}歳）`);
  } else if (slug === 'short-hours') {
    hl.push(`1位は「${name}」（月間 ${Math.trunc(top.monthly_hours ?? 0)}時間）`);
  } else if (slug === 'high-demand') {
    hl.push(`1位は「${name}」（求人需要：${DEMAND_JA[top.demand_band ?? ''] ?? ''}）`);
  } else {
    hl.push(`1位は「${name}」`);
  }

  // Top sector
  const sectorCounts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
  }
  let topSector = '';
  let topSectorCnt = 0;
  for (const [s, c] of sectorCounts.entries()) {
    if (c > topSectorCnt) {
      topSectorCnt = c;
      topSector = s;
    }
  }
  if (topSector) {
    hl.push(`TOP${items.length}の中で「${topSector}」セクターが${topSectorCnt}件と最多`);
  }

  const meanSal = safeMean(items, 'salary');
  const meanRisk = safeMean(items, 'ai_risk');
  if (meanSal > 0) {
    hl.push(`TOP${items.length}の平均年収は${Math.trunc(meanSal)}万円、平均AI影響度は${meanRisk.toFixed(1)}/10`);
  }

  const itemsHtml = hl.map((h) => `<li>${escapeHtml(h)}</li>`).join('');
  return `<div class="highlights"><ul>${itemsHtml}</ul></div>`;
}

export function renderSectorChart(items: Occupation[]): string {
  const counts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) counts.set(o.sector_ja, (counts.get(o.sector_ja) ?? 0) + 1);
  }
  if (counts.size === 0) return '';
  const ordered = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = ordered[0][1];
  const rows = ordered.slice(0, 6).map(([sec, cnt]) => {
    const pct = Math.trunc((cnt / maxCount) * 100);
    return (
      `<div class="sb-row">` +
      `<span class="sb-label">${escapeHtml(sec)}</span>` +
      `<span class="sb-track"><span class="sb-fill" style="width:${pct}%"></span></span>` +
      `<span class="sb-count">${cnt}件</span>` +
      `</div>`
    );
  }).join('');
  return (
    `<div class="sector-chart">` +
    `<div class="sc-title">セクター内訳（TOP${items.length}）</div>` +
    `${rows}` +
    `</div>`
  );
}

// Shared FAQ template — single source of truth in src/templates/FaqSection.
export { renderFaqSection as renderFaqHtml } from './FaqSection.js';

/**
 * Phase D #5 (2026-05-14) signature change: `allRankings` now passed in
 * by caller. Previous version read ALL_RANKINGS from view layer.
 */
export function renderRelatedRankings(
  currentSlug: RankingSlug,
  allRankings: ReadonlyArray<readonly [RankingSlug, string, string]>,
): string {
  const items = allRankings
    .filter(([slug]) => slug !== currentSlug)
    .map(([slug, name, desc]) =>
      `<li><a href="/ja/rankings/${slug}">` +
      `${escapeHtml(name)}` +
      `<span class="rr-desc">${escapeHtml(desc)}</span>` +
      `</a></li>`,
    ).join('');
  return `<ul class="related-rankings">${items}</ul>`;
}

// ---------------------------------------------------------------------------
// JSON-LD per ranking page (mirrors render_jsonld).
// ---------------------------------------------------------------------------

const SITE = 'https://mirai-shigoto.com';
const DATE_PUBLISHED = '2026-05-06';
const DATE_MODIFIED = '2026-05-06';

export function renderJsonLd(
  canonical: string,
  title: string,
  description: string,
  items: Occupation[],
  faqItems: ReadonlyArray<readonly [string, string]> | null,
): string {
  const itemList = items.map((o, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE}/ja/${o.id}`,
    name: o.title_ja ?? `#${o.id}`,
  }));

  const graph: unknown[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'ja',
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      publisher: { '@id': `${SITE}/#organization` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
    },
    {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      headline: title,
      description,
      // Per-ranking OG card. The slug comes off the canonical URL —
      // canonical is `${SITE}/ja/rankings/<slug>`.
      image:
        `${SITE}/api/og?ranking=${
          canonical.match(/\/rankings\/([^/?#]+)/)?.[1] ?? ''
        }`,
      url: canonical,
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      author: { '@id': `${SITE}/#organization` },
      publisher: { '@id': `${SITE}/#organization` },
      inLanguage: 'ja',
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      isPartOf: { '@id': `${canonical}#webpage` },
      articleSection: 'ランキング',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'ランキング', item: `${SITE}/ja/rankings` },
        { '@type': 'ListItem', position: 3, name: title, item: canonical },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#list`,
      name: title,
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

export function renderHubJsonLd(): string {
  const canonical = `${SITE}/ja/rankings`;
  const seoDesc = '日本556職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに奪われやすい仕事、高年収×低AIリスクの職業などを一覧。';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: '職業ランキング',
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
          { '@type': 'ListItem', position: 2, name: 'ランキング', item: canonical },
        ],
      },
    ],
  }, null, 2);
}
