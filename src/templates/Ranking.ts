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
import { escapeHtml, type SafeHtml } from '../lib/safe-html.js';
import { riskClass as riskBand } from '../lib/risk.js';
import { fmtInt } from '../lib/num.js';
import { OCCUPATION_COUNT } from '../site/config.js';

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
): SafeHtml {
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
    `<a class="rl-name" href="/${o.id}">${escapeHtml(title)}</a>` +
    `${sectorHtml}` +
    `</div>` +
    `<div class="rl-stats">${statsParts.join('')}</div>` +
    `</li>`
  ) as SafeHtml;
}

export function renderHighlights(items: Occupation[], slug: RankingSlug): SafeHtml {
  if (items.length === 0) return '' as SafeHtml;
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
  return `<div class="highlights"><ul>${itemsHtml}</ul></div>` as SafeHtml;
}

export function renderSectorChart(items: Occupation[]): SafeHtml {
  const counts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) counts.set(o.sector_ja, (counts.get(o.sector_ja) ?? 0) + 1);
  }
  if (counts.size === 0) return '' as SafeHtml;
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
  ) as SafeHtml;
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
): SafeHtml {
  const items = allRankings
    .filter(([slug]) => slug !== currentSlug)
    .map(([slug, name, desc]) =>
      `<li><a href="/rankings/${slug}">` +
      `${escapeHtml(name)}` +
      `<span class="rr-desc">${escapeHtml(desc)}</span>` +
      `</a></li>`,
    ).join('');
  return `<ul class="related-rankings">${items}</ul>` as SafeHtml;
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
    url: `${SITE}/${o.id}`,
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
      // canonical is `${SITE}/rankings/<slug>`.
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
        { '@type': 'ListItem', position: 2, name: 'ランキング', item: `${SITE}/rankings` },
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

// ─── rankings/index hub-card renderer (Phase D audit #8 2026-05-14) ────

export interface RankingsHubCard {
  readonly slug: string;
  readonly name: string;
  readonly desc: string;
  readonly preview: string | null | undefined;
  readonly count: number;
}

export function renderRankingsHubCards(cards: ReadonlyArray<RankingsHubCard>): SafeHtml {
  return cards.map((c) => renderHubCardLi(c)).join('') as SafeHtml;
}

// Internal helper — single <li> for one hub card. Shared by both the
// flat renderRankingsHubCards (back-compat) and the grouped
// renderRankingsHubGroups (RA-128) so layout stays in sync.
function renderHubCardLi(c: RankingsHubCard): string {
  const previewHtml = c.preview ? `<span class="rr-preview">${escapeHtml(c.preview)}</span>` : '';
  return (
    `<li><a href="/rankings/${c.slug}">` +
    `<span class="rr-title">${escapeHtml(c.name)}</span>` +
    `<span class="rr-desc">${escapeHtml(c.desc)}</span>` +
    `${previewHtml}` +
    `<span class="rr-count">${c.count} 職業</span>` +
    `</a></li>`
  );
}

// ─── RA-128: grouped hub-card renderer with sticky chip nav ──────────
//
// Renders the 39 hub cards into 6 thematic sections, each anchored with
// `id="grp-<key>"`, plus a sticky chip nav at the top driven by
// data-target attributes (matched against group keys by the IntersectionObserver
// script in src/pages/rankings/index.astro).

export interface RankingsHubGroupView {
  readonly key: string;
  readonly label_ja: string;
  readonly lede_ja: string;
  readonly cards: ReadonlyArray<RankingsHubCard>;
}

// Short chip labels (kept terse so the sticky chip row fits on mobile).
// Matched to group keys defined in src/views/ranking/config.ts.
const CHIP_LABEL_JA: Record<string, string> = {
  basic: '基本',
  single: '単軸',
  ai: 'AI',
  combo: '組合せ',
  education: '教育・資格',
  niche: 'ニッチ',
};

export function renderRankingsHubGroups(
  groups: ReadonlyArray<RankingsHubGroupView>,
): SafeHtml {
  if (groups.length === 0) return '' as SafeHtml;

  const chips = groups
    .map((g) => {
      const label = CHIP_LABEL_JA[g.key] ?? g.label_ja;
      return (
        `<a href="#grp-${escapeHtml(g.key)}" class="ra-chip" data-target="${escapeHtml(g.key)}">` +
        `${escapeHtml(label)} <span>${g.cards.length}</span>` +
        `</a>`
      );
    })
    .join('');

  const sections = groups
    .map((g) => {
      const lis = g.cards.map((c) => renderHubCardLi(c)).join('');
      return (
        `<section class="ranking-group" id="grp-${escapeHtml(g.key)}" data-group="${escapeHtml(g.key)}">` +
        `<h3 class="ranking-group-title">${escapeHtml(g.label_ja)}</h3>` +
        `<p class="ranking-group-lede">${escapeHtml(g.lede_ja)}</p>` +
        `<ul class="ranking-cards">${lis}</ul>` +
        `</section>`
      );
    })
    .join('');

  return (
    `<nav class="ranking-anchor-nav" aria-label="ランキングのカテゴリ">${chips}</nav>` +
    sections
  ) as SafeHtml;
}

export function renderRankingsHubStats(stats: ReadonlyArray<readonly [string, string]>): SafeHtml {
  if (stats.length === 0) return '' as SafeHtml;
  return `<dl class="stats">${stats
    .map(([l, v]) => `<div><dt>${escapeHtml(l)}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join('')}</dl>` as SafeHtml;
}

// Insights items are pre-rendered SafeHtml from views/ranking.ts (sector
// names are escaped at the source). Do NOT re-escape here.
export function renderRankingsHubInsights(insights: ReadonlyArray<string>): SafeHtml {
  if (insights.length === 0) return '' as SafeHtml;
  const items = insights.map((h) => `<li>${h}</li>`).join('');
  return `<section class="insights" aria-label="データから見える傾向"><h2>データから見える傾向</h2><ul>${items}</ul></section>` as SafeHtml;
}

// ─── RA-137: insights infographic — 5 screenshot-ready cards ──────────
//
// renderInsightCards() replaces the old text-only list with a 5-card
// grid suitable for sharing as screenshots. Each card has an icon,
// headline, body, and a share button.
//
// hub.insights from views/ranking/build.ts is a string[] of 5
// pre-rendered HTML fragments (containing <strong> markup). We strip
// the HTML tags to get plain text for the body, then pull the headline
// from the first <strong> + the few words before/after it. Card icons
// are inline SVG stroke icons (no external deps, no font glyphs).
//
// Layout matches the existing 5 insight themes:
//   0. Highest-AI-risk sector — rising arrow
//   1. Lowest-AI-risk sector  — shield
//   2. Salary-TOP30 mean AI   — scatter dots
//   3. Workers-TOP × AI       — people + warning
//   4. Low-AI ↔ physical/relational — handshake

interface InsightCardMeta {
  readonly icon: string; // inner SVG paths (no <svg> wrapper — wrapper is in template)
  readonly shareText: string;
}

// Per-card icon + share-text fallback. Order matches build.ts insights array.
const INSIGHT_CARD_META: ReadonlyArray<InsightCardMeta> = [
  {
    // 0. Rising arrow — highest AI-risk sector
    icon:
      '<polyline points="3 17 9 11 13 15 21 7"/>' +
      '<polyline points="14 7 21 7 21 14"/>',
    shareText: 'AI影響度が最も高いセクター',
  },
  {
    // 1. Shield — lowest AI-risk sector (safest)
    icon:
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    shareText: 'AI影響度が最も低いセクター',
  },
  {
    // 2. Scatter dots — TOP30 salary × AI-risk mean
    icon:
      '<circle cx="6" cy="18" r="1.5"/>' +
      '<circle cx="10" cy="12" r="1.5"/>' +
      '<circle cx="14" cy="14" r="1.5"/>' +
      '<circle cx="18" cy="8" r="1.5"/>' +
      '<line x1="3" y1="21" x2="21" y2="21"/>' +
      '<line x1="3" y1="3" x2="3" y2="21"/>',
    shareText: '高年収 × AI影響度の中央傾向',
  },
  {
    // 3. People + caution — high-workforce categories with AI risk
    icon:
      '<circle cx="9" cy="8" r="3"/>' +
      '<path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>' +
      '<path d="M17 11v3"/>' +
      '<circle cx="17" cy="17" r="0.5" fill="currentColor"/>',
    shareText: '就業者数上位×AI影響度の傾向',
  },
  {
    // 4. Handshake — low AI affinity ↔ physical/interpersonal
    icon:
      '<path d="M8 11l3 3 5-5"/>' +
      '<path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/>',
    shareText: '身体性・対人スキルとAI影響度',
  },
];

// Strip HTML tags from a string (insights from build.ts wrap key terms
// in <strong>…</strong>). Used to get plain text for share button + body.
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

// Extract a headline + body pair from a single insight HTML string.
// Heuristic: pull the first <strong>…</strong> term as the headline
// anchor, then surrounding context to round out the headline (~12-18
// chars), then the full stripped text becomes the body.
function parseInsightToHeadlineBody(insightHtml: string): { headline: string; body: string } {
  const plain = stripHtmlTags(insightHtml).trim();
  // For the body we use the full stripped sentence so the screenshot
  // captures the full meaning, not just the headline fragment.
  const body = plain;

  // Find first <strong>…</strong> term.
  const strongMatch = insightHtml.match(/<strong>([\s\S]*?)<\/strong>/);
  if (!strongMatch) {
    // No <strong> — fall back to first 18 chars as the headline.
    const headline = plain.length > 22 ? `${plain.slice(0, 20)}…` : plain;
    return { headline, body };
  }
  const strongTerm = stripHtmlTags(strongMatch[1]).trim();

  // Walk plain text, anchor on the strongTerm, and grab a tight headline
  // covering the term plus the immediately surrounding numeric/keyword
  // context (~16-22 chars total). This keeps the headline visually crisp
  // for screenshot sharing.
  const idx = plain.indexOf(strongTerm);
  if (idx === -1) {
    return { headline: strongTerm, body };
  }
  // Headline = strongTerm + the next 10-14 chars of context (typically
  // captures things like "平均 X.X" or "の傾向" / "セクター…平均X.X").
  const after = plain.slice(idx + strongTerm.length, idx + strongTerm.length + 18).trim();
  const headline = after.length > 0 ? `${strongTerm} ${after}` : strongTerm;
  return { headline, body };
}

export function renderInsightCards(insights: ReadonlyArray<string>): SafeHtml {
  if (insights.length === 0) return '' as SafeHtml;

  const cards = insights.slice(0, INSIGHT_CARD_META.length).map((insightHtml, i) => {
    const meta = INSIGHT_CARD_META[i];
    const { headline, body } = parseInsightToHeadlineBody(insightHtml);
    const shareText = `${headline} — ${body}`;
    return (
      `<article class="insight-card" data-insight="${i}">` +
      `<span class="ic-icon" aria-hidden="true">` +
      `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>` +
      `</span>` +
      `<h3 class="ic-headline">${escapeHtml(headline)}</h3>` +
      `<p class="ic-body">${escapeHtml(body)}</p>` +
      `<button type="button" class="ic-share" aria-label="この洞察をシェア" ` +
      `data-share-text="${escapeHtml(shareText)}">` +
      `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>` +
      `<path d="M16 6l-4-4-4 4"/>` +
      `<path d="M12 2v13"/>` +
      `</svg>` +
      `<span>シェア</span>` +
      `</button>` +
      `</article>`
    );
  }).join('');

  return (
    `<section class="insights-section" aria-label="データから見える傾向">` +
    `<h2>データから見える傾向</h2>` +
    `<div class="insight-cards">${cards}</div>` +
    `</section>`
  ) as SafeHtml;
}

export function renderHubJsonLd(): string {
  const canonical = `${SITE}/rankings`;
  // RA-003 (2026-05-18): SCORED count.
  const seoDesc = `日本${OCCUPATION_COUNT.SCORED}職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに奪われやすい仕事、高年収×低AIリスクの職業などを一覧。`;
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
