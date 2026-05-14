/**
 * genre-hub.ts — generic data-driven hub builder.
 *
 * Phase 3 (2026-05-10) で 9 個の新 genre が同一パターンを共有するため、
 * skills-hub.ts / interests.ts のロジックを共通化したライブラリ。
 *
 * 対象 genre (各 hub = "ある軸で TOP 30 職業"):
 *   - abilities (能力 — abilities_top5)
 *   - knowledge (知識 — knowledge_top5)
 *   - values (価値観 — work_values_top5)
 *   - work-styles (業務形態 — work_characteristics_top5)
 *   - training (習熟期間 — training_pre/post_top5)
 *   - entry-paths (入職経路 — experience_top5)
 *   - education (学歴 — education_pct from treemap)
 *   - employment-types (雇用形態 — employment_type from treemap)
 *   - life-balance (ライフバランス — derived from multiple fields)
 *
 * 各 hub は GenreHubConfig で挙動を表現し、buildGenreBundle が共通の
 * filter/sort/render を実行する。
 */
import { join } from 'node:path';
import { strictReadJson, strictReaddir } from '../lib/strict-load.js';
import { DetailFileSchema } from '../lib/projection-schemas.js';

const REPO_ROOT = process.cwd();
const DETAIL_DIR = join(REPO_ROOT, 'public', 'data.detail');

const TOP_N = 30;

// ─── Types ──────────────────────────────────────────────────────

export interface DetailFileMin {
  id: number;
  title?: { ja?: string };
  ai_risk?: { score?: number | null } | null;
  risk_band?: string | null;
  stats?: {
    salary_man_yen?: number | null;
    workers?: number | null;
    monthly_hours?: number | null;
    average_age?: number | null;
    recruit_ratio?: number | null;
    recruit_wage_man_yen?: number | null;
  } | null;
  sector?: { id?: string; ja?: string } | null;
  /** Phase 3 added top-N for various dimensions */
  abilities_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  knowledge_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  skills_top10?: Array<{ key: string; label_ja: string; score: number }> | null;
  work_values_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  work_characteristics_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  training_pre_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  training_post_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  experience_top5?: Array<{ key: string; label_ja: string; score: number }> | null;
  related_certs_ja?: ReadonlyArray<string>;
  /** Phase 3: full distribution dicts (EN-keyed) for education / employment hubs */
  education_distribution?: Record<string, number> | null;
  employment_type?: Record<string, number> | null;
}

export interface GenreOccupation {
  id: number;
  name_ja: string;
  primary_score: number;
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  monthly_hours: number | null;
  average_age: number | null;
  sector_id: string;
  sector_ja: string;
}

export type DimensionField =
  | 'abilities_top5'
  | 'knowledge_top5'
  | 'skills_top10'
  | 'work_values_top5'
  | 'work_characteristics_top5'
  | 'training_pre_top5'
  | 'training_post_top5'
  | 'experience_top5';

export interface GenreHubConfig {
  slug: string;
  short_ja: string;
  title_ja: string;
  description_ja: string;
  /** OG card eyebrow */
  og_eyebrow: string;
  /** Optional sub-info panels */
  characteristics_ja?: ReadonlyArray<string>;
  how_to_develop_ja?: ReadonlyArray<string>;
  /** For dimension-based filtering: which top-N field on detail to use */
  dimension_field?: DimensionField;
  /** The key to look up within the dimension */
  dimension_key?: string;
  /**
   * For derived hubs: a custom predicate. Returns null to exclude,
   * or a numeric score (used for sorting desc).
   */
  custom_filter?: (d: DetailFileMin) => number | null;
}

export interface GenreResult {
  config: GenreHubConfig;
  items: GenreOccupation[];
  stats: ReadonlyArray<readonly [label: string, value: string]>;
  sectorBreakdown: ReadonlyArray<readonly [sector: string, count: number]>;
  highlights: ReadonlyArray<string>;
  faqItems: ReadonlyArray<readonly [q: string, a: string]>;
}

// ─── Loader (cached) ──────────────────────────────────────────

let _detailCache: DetailFileMin[] | null = null;
export function loadAllDetails(): DetailFileMin[] {
  if (_detailCache) return _detailCache;
  // strictReaddir + strictReadJson abort the build on missing dir,
  // malformed JSON, or schema drift. Set ALLOW_PARTIAL_DATA=1 to fall
  // back to "log + skip" semantics for local development. The previous
  // silent-empty-array behavior was the audit's #4.1 — a single failure
  // could produce 9 genre hub pages with no occupations and still ship.
  const files = strictReaddir(DETAIL_DIR, (f) => f.endsWith('.json'), 'genre-hub.detail');
  const out: DetailFileMin[] = [];
  for (const f of files) {
    // Cast: DetailFileSchema is intentionally a superset of
    // DetailFileMin (fewer required fields). The runtime check still
    // validates the load-bearing fields; the cast just bridges the
    // structural type mismatch on the optional ones.
    out.push(
      strictReadJson(join(DETAIL_DIR, f), DetailFileSchema, 'genre-hub.detail') as DetailFileMin,
    );
  }
  _detailCache = out;
  return out;
}

// ─── Helpers ──────────────────────────────────────────────────

// Single source of truth lives at src/lib/num. Re-exported for legacy consumers.
import { fmtInt, safeMean } from '../lib/num.js';
export { fmtInt, safeMean };

// Single source of truth lives at src/lib/safe-html.ts. Import for internal
// use within this module, re-export so existing pages/sibling lib files
// continue to work. SafeHtml is structurally a string — callers expecting
// string see no API change.
import { escapeHtml } from '../lib/safe-html.js';
export { escapeHtml };

// Single source of truth lives at src/lib/risk. Re-exported so existing
// consumers (pages importing `riskClass` from this module) keep working.
import { riskClass } from '../lib/risk.js';
export { riskClass };

// ─── Core builder ────────────────────────────────────────────

function adaptToOcc(d: DetailFileMin, score: number): GenreOccupation {
  return {
    id: d.id,
    name_ja: d.title?.ja ?? `#${d.id}`,
    primary_score: score,
    ai_risk: d.ai_risk?.score ?? null,
    risk_band: d.risk_band ?? null,
    workers: d.stats?.workers ?? null,
    salary: d.stats?.salary_man_yen ?? null,
    monthly_hours: d.stats?.monthly_hours ?? null,
    average_age: d.stats?.average_age ?? null,
    sector_id: d.sector?.id ?? '',
    sector_ja: d.sector?.ja ?? '',
  };
}

export function buildGenreItems(
  details: ReadonlyArray<DetailFileMin>,
  config: GenreHubConfig,
): GenreOccupation[] {
  const candidates: GenreOccupation[] = [];

  if (config.dimension_field && config.dimension_key) {
    // Dimension-based: scan top-N of each detail for the key
    for (const d of details) {
      const arr = d[config.dimension_field] as Array<{ key: string; score: number }> | null | undefined;
      if (!arr) continue;
      const entry = arr.find((e) => e.key === config.dimension_key);
      if (!entry) continue;
      candidates.push(adaptToOcc(d, entry.score));
    }
  } else if (config.custom_filter) {
    // Custom predicate
    for (const d of details) {
      const score = config.custom_filter(d);
      if (score === null) continue;
      candidates.push(adaptToOcc(d, score));
    }
  }

  candidates.sort((a, b) => {
    if (b.primary_score !== a.primary_score) return b.primary_score - a.primary_score;
    return a.id - b.id;
  });
  return candidates.slice(0, TOP_N);
}

export function buildGenreResult(
  details: ReadonlyArray<DetailFileMin>,
  config: GenreHubConfig,
): GenreResult {
  const items = buildGenreItems(details, config);

  // Sector breakdown
  const sectorCounts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
  }
  const sectorBreakdown: Array<readonly [string, number]> = Array.from(sectorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Stats
  const meanRisk = safeMean(items.map((o) => o.ai_risk));
  const meanSalary = safeMean(items.map((o) => o.salary));
  const meanScore = safeMean(items.map((o) => o.primary_score));
  const totalWorkers = items.reduce((s, o) => s + (o.workers ?? 0), 0);

  const stats: Array<readonly [string, string]> = [
    [`平均 ${config.short_ja}スコア`, `${meanScore.toFixed(2)}`],
    ['平均 AI 影響', meanRisk > 0 ? `${meanRisk.toFixed(1)} / 10` : '—'],
    ['平均年収', meanSalary > 0 ? `${Math.trunc(meanSalary)} 万円` : '—'],
    ['TOP30 合計就業者数', `${fmtInt(totalWorkers)} 人`],
  ];

  // Highlights
  const top3 = items.slice(0, 3).map((o) => o.name_ja).join('、');
  const dominantSector = sectorBreakdown[0]?.[0] ?? '';
  const dominantCount = sectorBreakdown[0]?.[1] ?? 0;
  const highlights: string[] = [
    `1 位は「${items[0]?.name_ja ?? '—'}」（${config.short_ja}スコア ${items[0]?.primary_score.toFixed(2) ?? '—'}）`,
    top3 ? `TOP 3 は ${top3}` : '',
    dominantSector ? `セクターは「${dominantSector}」が ${dominantCount} 件と最多` : '',
    meanRisk > 0 ? `TOP30 の平均 AI 影響は ${meanRisk.toFixed(1)}/10` : '',
    config.characteristics_ja?.[0] ? `特徴: ${config.characteristics_ja[0]}` : '',
  ].filter(Boolean);

  // Auto FAQ
  const faqItems: Array<readonly [string, string]> = [];
  faqItems.push([
    `${config.short_ja}が中心となるのはどんな職業？`,
    config.description_ja,
  ]);
  if (top3) {
    faqItems.push([
      `${config.short_ja}スコアが高い職業 TOP 3 は？`,
      `${top3} です。本ページでは TOP ${items.length} 職業を AI 影響度・年収・就業者数と共に確認できます。`,
    ]);
  }
  if (meanRisk > 0) {
    const tier = meanRisk <= 3.5 ? '低め' : meanRisk <= 5.5 ? '中程度' : 'やや高め';
    faqItems.push([
      `${config.short_ja}が必要な職業は AI 影響度が高い？`,
      `本 hub の TOP ${items.length} の平均 AI 影響度は ${meanRisk.toFixed(1)}/10 で ${tier} の水準です。本サイトの AI 影響度は Claude Opus 4.7 による独自分析（非公式）です。`,
    ]);
  }
  if (config.how_to_develop_ja?.length) {
    faqItems.push([
      `${config.short_ja}を伸ばすには？`,
      `代表的なヒント: ${config.how_to_develop_ja.slice(0, 2).join('。')}。本 TOP 職業の業務に近い実践を積むのが効果的です。`,
    ]);
  }

  return {
    config,
    items,
    stats,
    sectorBreakdown,
    highlights,
    faqItems,
  };
}

// ─── HTML rendering helpers ────────────────────────────────────

export function renderRankItem(o: GenreOccupation, shortJa: string): string {
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
  );
}

// Shared Highlights template — single source of truth in src/templates/Highlights.
export { renderHighlights } from '../templates/Highlights.js';

// Shared SectorChart template — single source of truth in src/templates/SectorChart.
// (ranking-renderers keeps its own renderSectorChart — different signature.)
export { renderSectorChart } from '../templates/SectorChart.js';

// Shared FAQ template — single source of truth in src/templates/FaqSection.
export { renderFaqSection as renderFaqHtml } from '../templates/FaqSection.js';

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
  genrePath: string, // e.g. "abilities", "knowledge"
  genreLabel: string, // e.g. "能力から探す"
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

// ─── Shared CSS for genre hub pages ──────────────────────────

export const GENRE_HUB_CSS = `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;--fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;--accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;--border:rgba(36,30,24,0.10);--font-serif:"Noto Serif JP","Source Serif Pro",Georgia,serif;--font-sans:"Plus Jakarta Sans","Hiragino Sans",-apple-system,BlinkMacSystemFont,"Yu Gothic UI","Segoe UI",Roboto,sans-serif}
:root[data-theme="light"],:root[data-theme="dark"]{--bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;--fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;--accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;--border:rgba(36,30,24,0.10)}
html{font-size:16px}
body{background:var(--bg);color:var(--fg);font-family:var(--font-sans);line-height:1.65}
a{color:var(--accent-deep);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
a:hover{color:var(--accent)}
.skip-link{position:absolute;left:-9999px;top:0;background:var(--fg);color:var(--bg);padding:8px 12px;z-index:100}
.skip-link:focus{left:8px;top:8px}
#wrapper{max-width:980px;margin:0 auto;padding:32px 20px 80px}
.crumb{font-size:.85rem;color:var(--fg2);margin-bottom:24px}
.crumb a{color:var(--fg2)}
.crumb span[aria-hidden]{margin:0 8px;color:var(--fg3)}
header{margin-bottom:32px;border-bottom:1px solid var(--border);padding-bottom:24px}
h1{font-family:var(--font-serif);font-size:clamp(1.75rem,4vw,2.5rem);font-weight:600;line-height:1.25;color:var(--fg);margin-bottom:12px}
h1 .accent{color:var(--accent-deep)}
.sub{color:var(--fg2);font-size:.95rem}
.sub strong{color:var(--accent-deep);font-weight:600}
.intro{margin:24px 0;color:var(--fg);font-size:1.05rem;max-width:64ch}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:32px 0}
.stats>div{background:var(--bg2);border:1px solid var(--border);padding:16px;border-radius:6px}
.stats dt{font-size:.75rem;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.stats dd{font-family:var(--font-serif);font-size:1.4rem;font-weight:600;color:var(--fg)}
section{margin:48px 0}
h2{font-family:var(--font-serif);font-size:1.35rem;font-weight:600;color:var(--fg);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)}
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
.related-genre{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;list-style:none;padding:0}
.related-genre li a{display:block;padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--fg);transition:border-color 150ms}
.related-genre li a:hover{border-color:var(--accent)}
.related-genre .rg-name{display:block;font-family:var(--font-serif);font-weight:500;color:var(--accent-deep);margin-bottom:4px}
.related-genre .rg-desc{display:block;font-size:.78rem;color:var(--fg2)}
.genre-cards{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;padding:0;margin:0}
.genre-cards li a{display:block;padding:22px 22px 18px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--fg);transition:border-color 150ms,transform 150ms;min-height:160px}
.genre-cards li a:hover{border-color:var(--accent);transform:translateY(-1px)}
.gci-name{display:block;font-family:var(--font-serif);font-size:1.2rem;font-weight:600;color:var(--accent-deep);margin-bottom:10px}
.gci-desc{display:block;font-size:.86rem;color:var(--fg2);line-height:1.6;margin-bottom:10px}
.gci-count{font-size:.78rem;color:var(--fg3);font-variant-numeric:tabular-nums}
@media (max-width:600px){#wrapper{padding:20px 16px 60px}h1{font-size:1.5rem}.rank-list li{grid-template-columns:28px 1fr;gap:10px}.rank-list .rl-stats{margin-top:6px}.sb-row{grid-template-columns:80px 1fr 36px}}
`;
