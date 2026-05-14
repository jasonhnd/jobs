/**
 * src/views/sitemap.ts — sitemap.xml view (URL enumeration +
 * XML serialization).
 *
 * Step 10 part 2 (2026-05-13): the per-page `src/pages/sitemap.xml.ts`
 * used to inline the entire enumeration + XML build. Per
 * docs/architecture.md §5 "横切关注点 = view 的另一种实例", the
 * sitemap is a horizontal view fed by the same graph as every
 * URL-emitting page family. This module owns:
 *
 *   - `SitemapEntry` typed row shape
 *   - `buildSitemapEntries(graph, today)` — enumerate every public URL
 *   - `renderSitemapXml(entries)` — XML serialization (defensive
 *     `<loc>` escape for non-alphanum sector / slug ids)
 *
 * The page file (src/pages/sitemap.xml.ts) becomes a 10-line
 * handler that loads the graph, calls the view, and returns the
 * Response.
 *
 * Output bytes match the previous inline implementation
 * byte-for-byte (the SEO baseline `sitemap.xml` snapshot
 * covers this).
 */

import { ALL_RANKINGS } from './ranking.js';
import { INTEREST_META } from './interests-meta.js';
import { SKILL_META } from './skills-meta.js';
import { COMPARE_META } from './compare-meta.js';
import {
  ABILITIES_CONFIGS, KNOWLEDGE_CONFIGS, VALUES_CONFIGS,
  EDUCATION_CONFIGS, TRAINING_CONFIGS, WORK_STYLES_CONFIGS,
  EMPLOYMENT_CONFIGS, LIFE_BALANCE_CONFIGS, ENTRY_PATHS_CONFIGS,
} from './genre-configs.js';
import { CAREER_PERSONAS } from './careers-meta.js';
import { LICENSE_HUBS } from './licenses-meta.js';
import { QA_ITEMS } from './qa-meta.js';
import { EXPLORE_ROUTES } from './explore-routes.js';
import type { KnowledgeGraph } from '@/graph';

const SITE_ORIGIN = 'https://mirai-shigoto.com';

export interface SitemapEntry {
  readonly loc: string;
  readonly lastmod: string;
  readonly changefreq: string;
  readonly priority: string;
}

function entry(loc: string, lastmod: string, changefreq: string, priority: string): SitemapEntry {
  return { loc, lastmod, changefreq, priority };
}

/**
 * Enumerate every public URL on the site at build time.
 *
 * URL clusters (matches the previous inline structure 1-for-1):
 *   - Home + /map (+ 16 sector-filter query-string variants)
 *   - 3 legal pages (/privacy /about /compliance)
 *   - 2 GEO surfaces (/llms.txt /llms-full.txt)
 *   - Rankings (index + N ranking slugs)
 *   - Sectors (index + 16 hubs)
 *   - Interests / Skills / Compare clusters (index + each slug)
 *   - 9 Genre clusters (abilities / knowledge / values / education /
 *     training / work-styles / employment-types / life-balance /
 *     entry-paths)
 *   - Careers / Licenses / Q&A / about/yearly / explore L2
 *   - All 556 occupation detail pages
 */
export function buildSitemapEntries(
  graph: KnowledgeGraph,
  today: string,
): SitemapEntry[] {
  const sectorIds = [...graph.sectors.keys()].map((id) => id as unknown as string);
  const rankingSlugs = ALL_RANKINGS.map(([slug]) => slug);
  const occupationIds = [...graph.occupations.keys()]
    .map((id) => id as unknown as number)
    .sort((a, b) => a - b);

  const entries: SitemapEntry[] = [];

  // Top-level
  entries.push(entry(`${SITE_ORIGIN}/`, today, 'weekly', '1.0'));
  entries.push(entry(`${SITE_ORIGIN}/map`, today, 'monthly', '0.9'));

  // Sector-filtered map variants
  for (const sid of sectorIds) {
    entries.push(entry(`${SITE_ORIGIN}/map?sector=${sid}`, today, 'monthly', '0.7'));
  }

  // Legal / static pages
  entries.push(entry(`${SITE_ORIGIN}/privacy`, today, 'yearly', '0.3'));
  entries.push(entry(`${SITE_ORIGIN}/about`, today, 'monthly', '0.5'));
  entries.push(entry(`${SITE_ORIGIN}/compliance`, today, 'monthly', '0.4'));

  // GEO surface (llms.txt convention; listed for general crawlers)
  entries.push(entry(`${SITE_ORIGIN}/llms.txt`, today, 'monthly', '0.2'));
  entries.push(entry(`${SITE_ORIGIN}/llms-full.txt`, today, 'monthly', '0.2'));

  // Rankings cluster
  entries.push(entry(`${SITE_ORIGIN}/ja/rankings`, today, 'weekly', '0.8'));
  for (const slug of rankingSlugs) {
    entries.push(entry(`${SITE_ORIGIN}/ja/rankings/${slug}`, today, 'weekly', '0.7'));
  }

  // Sectors cluster
  entries.push(entry(`${SITE_ORIGIN}/ja/sectors`, today, 'weekly', '0.8'));
  for (const sid of sectorIds) {
    entries.push(entry(`${SITE_ORIGIN}/ja/sectors/${sid}`, today, 'weekly', '0.7'));
  }

  // Interests (RIASEC) cluster — 6 types + index
  entries.push(entry(`${SITE_ORIGIN}/ja/interests`, today, 'weekly', '0.8'));
  for (const meta of INTEREST_META) {
    entries.push(entry(`${SITE_ORIGIN}/ja/interests/${meta.slug}`, today, 'weekly', '0.7'));
  }

  // Skills cluster — 10 skills + index
  entries.push(entry(`${SITE_ORIGIN}/ja/skills`, today, 'weekly', '0.8'));
  for (const meta of SKILL_META) {
    entries.push(entry(`${SITE_ORIGIN}/ja/skills/${meta.slug}`, today, 'weekly', '0.7'));
  }

  // Compare (X vs Y) cluster — 12 pairs + index
  entries.push(entry(`${SITE_ORIGIN}/ja/compare`, today, 'weekly', '0.8'));
  for (const meta of COMPARE_META) {
    entries.push(entry(`${SITE_ORIGIN}/ja/compare/${meta.slug}`, today, 'weekly', '0.7'));
  }

  // 9 Genre clusters (abilities / knowledge / values / education /
  // training / work-styles / employment-types / life-balance / entry-paths)
  const genreClusters: Array<{ path: string; configs: ReadonlyArray<{ slug: string }> }> = [
    { path: 'abilities', configs: ABILITIES_CONFIGS },
    { path: 'knowledge', configs: KNOWLEDGE_CONFIGS },
    { path: 'values', configs: VALUES_CONFIGS },
    { path: 'education', configs: EDUCATION_CONFIGS },
    { path: 'training', configs: TRAINING_CONFIGS },
    { path: 'work-styles', configs: WORK_STYLES_CONFIGS },
    { path: 'employment-types', configs: EMPLOYMENT_CONFIGS },
    { path: 'life-balance', configs: LIFE_BALANCE_CONFIGS },
    { path: 'entry-paths', configs: ENTRY_PATHS_CONFIGS },
  ];
  for (const g of genreClusters) {
    entries.push(entry(`${SITE_ORIGIN}/ja/${g.path}`, today, 'weekly', '0.8'));
    for (const cfg of g.configs) {
      entries.push(entry(`${SITE_ORIGIN}/ja/${g.path}/${cfg.slug}`, today, 'weekly', '0.7'));
    }
  }

  // Careers personas
  entries.push(entry(`${SITE_ORIGIN}/ja/careers`, today, 'weekly', '0.8'));
  for (const p of CAREER_PERSONAS) {
    entries.push(entry(`${SITE_ORIGIN}/ja/careers/${p.slug}`, today, 'weekly', '0.7'));
  }

  // Licenses
  entries.push(entry(`${SITE_ORIGIN}/ja/licenses`, today, 'weekly', '0.8'));
  for (const h of LICENSE_HUBS) {
    entries.push(entry(`${SITE_ORIGIN}/ja/licenses/${h.slug}`, today, 'weekly', '0.7'));
  }

  // Q&A
  entries.push(entry(`${SITE_ORIGIN}/ja/q`, today, 'weekly', '0.8'));
  for (const q of QA_ITEMS) {
    entries.push(entry(`${SITE_ORIGIN}/ja/q/${q.slug}`, today, 'weekly', '0.7'));
  }

  // About + yearly (hand-curated long-tail content)
  entries.push(entry(`${SITE_ORIGIN}/ja/about`, today, 'monthly', '0.6'));
  entries.push(entry(`${SITE_ORIGIN}/ja/about/methodology`, today, 'monthly', '0.7'));
  entries.push(entry(`${SITE_ORIGIN}/ja/about/glossary`, today, 'monthly', '0.5'));
  entries.push(entry(`${SITE_ORIGIN}/ja/about/data-sources`, today, 'monthly', '0.5'));
  entries.push(entry(`${SITE_ORIGIN}/ja/yearly`, today, 'monthly', '0.6'));
  entries.push(entry(`${SITE_ORIGIN}/ja/yearly/2026-report`, today, 'yearly', '0.7'));
  entries.push(entry(`${SITE_ORIGIN}/ja/yearly/5year-changes`, today, 'yearly', '0.6'));
  entries.push(entry(`${SITE_ORIGIN}/ja/yearly/next-decade`, today, 'yearly', '0.6'));

  // L2 explore routes
  entries.push(entry(`${SITE_ORIGIN}/ja/explore`, today, 'weekly', '0.7'));
  for (const r of EXPLORE_ROUTES) {
    entries.push(entry(`${SITE_ORIGIN}/ja/explore/${r.slug}`, today, 'weekly', '0.6'));
  }

  // Per-occupation detail pages
  for (const id of occupationIds) {
    entries.push(entry(`${SITE_ORIGIN}/ja/${id}`, today, 'weekly', '0.6'));
  }

  return entries;
}

function escapeXmlLoc(s: string): string {
  // Defensive XML escape for <loc> values. Sector / ranking IDs today
  // follow /^[a-z_-]+$/ so injection isn't a present risk, but a
  // malformed seed that contained '&' would produce invalid XML.
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

function urlBlock(e: SitemapEntry): string {
  return (
    `  <url>\n` +
    `    <loc>${escapeXmlLoc(e.loc)}</loc>\n` +
    `    <lastmod>${e.lastmod}</lastmod>\n` +
    `    <changefreq>${e.changefreq}</changefreq>\n` +
    `    <priority>${e.priority}</priority>\n` +
    `  </url>`
  );
}

/**
 * Serialize entries into the full sitemap XML document, matching
 * the byte-exact output of the previous inline page implementation.
 */
export function renderSitemapXml(entries: ReadonlyArray<SitemapEntry>): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(urlBlock).join('\n') +
    `\n</urlset>\n`
  );
}
