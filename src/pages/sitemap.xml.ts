/**
 * sitemap.xml.ts — site-wide sitemap, generated at build time.
 *
 * Emits ~606 URLs:
 *   - Home + /map (with 16 sector-filter query-string variants)
 *   - 3 legal pages (/privacy /about /compliance)
 *   - 2 GEO surfaces (/llms.txt /llms-full.txt)
 *   - 1 rankings index + 9 ranking slugs
 *   - 1 sectors index + 16 sector hubs
 *   - All occupation detail pages (one per public/data.detail/<id>.json)
 *
 * The output is served at /sitemap.xml. Vercel cache headers are configured
 * in vercel.json (max-age=300, s-maxage=600, application/xml).
 */
import type { APIRoute } from 'astro';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ALL_RANKINGS } from '../data/lib/rankings';
import { INTEREST_META } from '../data/lib/interests-meta';
import { SKILL_META } from '../data/lib/skills-meta';
import { COMPARE_META } from '../data/lib/compare-meta';
import {
  ABILITIES_CONFIGS, KNOWLEDGE_CONFIGS, VALUES_CONFIGS,
  EDUCATION_CONFIGS, TRAINING_CONFIGS, WORK_STYLES_CONFIGS,
  EMPLOYMENT_CONFIGS, LIFE_BALANCE_CONFIGS, ENTRY_PATHS_CONFIGS,
} from '../data/lib/genre-configs';
import { CAREER_PERSONAS } from '../data/lib/careers-meta';
import { LICENSE_HUBS } from '../data/lib/licenses-meta';
import { QA_ITEMS } from '../data/lib/qa-meta';
import { EXPLORE_ROUTES } from '../data/lib/explore-routes';
import { nowIso } from '../data/lib/now';

const SITE = 'https://mirai-shigoto.com';
const REPO = path.resolve(process.cwd());

interface SectorDef {
  id: string;
}

interface SectorsFile {
  sectors: SectorDef[];
}

function loadSectorIds(): string[] {
  try {
    const json = JSON.parse(
      readFileSync(path.join(REPO, 'data', 'sectors', 'sectors.ja-en.json'), 'utf8'),
    ) as SectorsFile;
    return json.sectors.map((s) => s.id);
  } catch (err) {
    console.error(`[sitemap] loadSectorIds failed: ${(err as Error).message}`);
    return [];
  }
}

function loadOccupationIds(): number[] {
  try {
    const dir = path.join(REPO, 'public', 'data.detail');
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    return files
      .map((f) => parseInt(f.replace('.json', ''), 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  } catch (err) {
    console.error(`[sitemap] loadOccupationIds failed: ${(err as Error).message}`);
    return [];
  }
}

function escapeXmlLoc(s: string): string {
  // Defensive XML escape for <loc> values. Sector / ranking IDs today follow
  // /^[a-z_-]+$/ so injection isn't a present risk, but a malformed seed in
  // sectors.ja-en.json that contained '&' would produce invalid XML.
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlBlock(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${escapeXmlLoc(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export const GET: APIRoute = () => {
  // Use nowIso() (cached, env-overridable via BUILD_DATA_TIMESTAMP) for the
  // <lastmod> values so the sitemap stays consistent with the generated_at
  // stamp on data.*.json projections produced in the same build.
  const today = nowIso().slice(0, 10);
  const sectorIds = loadSectorIds();
  const rankingSlugs = ALL_RANKINGS.map(([slug]) => slug);
  const occupationIds = loadOccupationIds();

  const entries: string[] = [];

  // Top-level
  entries.push(urlBlock(`${SITE}/`, today, 'weekly', '1.0'));
  entries.push(urlBlock(`${SITE}/map`, today, 'monthly', '0.9'));

  // Sector-filtered map variants
  for (const sid of sectorIds) {
    entries.push(urlBlock(`${SITE}/map?sector=${sid}`, today, 'monthly', '0.7'));
  }

  // Legal / static pages
  entries.push(urlBlock(`${SITE}/privacy`, today, 'yearly', '0.3'));
  entries.push(urlBlock(`${SITE}/about`, today, 'monthly', '0.5'));
  entries.push(urlBlock(`${SITE}/compliance`, today, 'monthly', '0.4'));

  // GEO surface (llms.txt convention; listed for general crawlers)
  entries.push(urlBlock(`${SITE}/llms.txt`, today, 'monthly', '0.2'));
  entries.push(urlBlock(`${SITE}/llms-full.txt`, today, 'monthly', '0.2'));

  // Rankings cluster
  entries.push(urlBlock(`${SITE}/ja/rankings`, today, 'weekly', '0.8'));
  for (const slug of rankingSlugs) {
    entries.push(urlBlock(`${SITE}/ja/rankings/${slug}`, today, 'weekly', '0.7'));
  }

  // Sectors cluster
  entries.push(urlBlock(`${SITE}/ja/sectors`, today, 'weekly', '0.8'));
  for (const sid of sectorIds) {
    entries.push(urlBlock(`${SITE}/ja/sectors/${sid}`, today, 'weekly', '0.7'));
  }

  // Interests (RIASEC) cluster — 6 types + index
  entries.push(urlBlock(`${SITE}/ja/interests`, today, 'weekly', '0.8'));
  for (const meta of INTEREST_META) {
    entries.push(urlBlock(`${SITE}/ja/interests/${meta.slug}`, today, 'weekly', '0.7'));
  }

  // Skills cluster — 10 skills + index
  entries.push(urlBlock(`${SITE}/ja/skills`, today, 'weekly', '0.8'));
  for (const meta of SKILL_META) {
    entries.push(urlBlock(`${SITE}/ja/skills/${meta.slug}`, today, 'weekly', '0.7'));
  }

  // Compare (X vs Y) cluster — 12 pairs + index
  entries.push(urlBlock(`${SITE}/ja/compare`, today, 'weekly', '0.8'));
  for (const meta of COMPARE_META) {
    entries.push(urlBlock(`${SITE}/ja/compare/${meta.slug}`, today, 'weekly', '0.7'));
  }

  // ─── Phase 3-5 Genre clusters ───
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
    entries.push(urlBlock(`${SITE}/ja/${g.path}`, today, 'weekly', '0.8'));
    for (const cfg of g.configs) {
      entries.push(urlBlock(`${SITE}/ja/${g.path}/${cfg.slug}`, today, 'weekly', '0.7'));
    }
  }

  // Careers personas
  entries.push(urlBlock(`${SITE}/ja/careers`, today, 'weekly', '0.8'));
  for (const p of CAREER_PERSONAS) {
    entries.push(urlBlock(`${SITE}/ja/careers/${p.slug}`, today, 'weekly', '0.7'));
  }

  // Licenses
  entries.push(urlBlock(`${SITE}/ja/licenses`, today, 'weekly', '0.8'));
  for (const h of LICENSE_HUBS) {
    entries.push(urlBlock(`${SITE}/ja/licenses/${h.slug}`, today, 'weekly', '0.7'));
  }

  // Q&A
  entries.push(urlBlock(`${SITE}/ja/q`, today, 'weekly', '0.8'));
  for (const q of QA_ITEMS) {
    entries.push(urlBlock(`${SITE}/ja/q/${q.slug}`, today, 'weekly', '0.7'));
  }

  // About + yearly
  entries.push(urlBlock(`${SITE}/ja/about`, today, 'monthly', '0.6'));
  entries.push(urlBlock(`${SITE}/ja/about/methodology`, today, 'monthly', '0.7'));
  entries.push(urlBlock(`${SITE}/ja/about/glossary`, today, 'monthly', '0.5'));
  entries.push(urlBlock(`${SITE}/ja/about/data-sources`, today, 'monthly', '0.5'));
  entries.push(urlBlock(`${SITE}/ja/yearly`, today, 'monthly', '0.6'));
  entries.push(urlBlock(`${SITE}/ja/yearly/2026-report`, today, 'yearly', '0.7'));
  entries.push(urlBlock(`${SITE}/ja/yearly/5year-changes`, today, 'yearly', '0.6'));
  entries.push(urlBlock(`${SITE}/ja/yearly/next-decade`, today, 'yearly', '0.6'));

  // L2 explore routes
  entries.push(urlBlock(`${SITE}/ja/explore`, today, 'weekly', '0.7'));
  for (const r of EXPLORE_ROUTES) {
    entries.push(urlBlock(`${SITE}/ja/explore/${r.slug}`, today, 'weekly', '0.6'));
  }

  // Per-occupation detail pages
  for (const id of occupationIds) {
    entries.push(urlBlock(`${SITE}/ja/${id}`, today, 'weekly', '0.6'));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
