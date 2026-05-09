/**
 * sitemap.xml.ts — site-wide sitemap, generated at build time.
 *
 * Migrated from scripts/build_occupations.py:write_sitemap() +
 *                scripts/build_sector_hubs.py:append_sitemap_blocks().
 *
 * Emits the same URL surface the Python pipeline produced (~606 URLs):
 *   - Home + /map (with 16 sector-filter query-string variants)
 *   - 3 legal pages (/privacy /about /compliance)
 *   - 2 GEO surfaces (/llms.txt /llms-full.txt)
 *   - 1 rankings index + 9 ranking slugs
 *   - 1 sectors index + 16 sector hubs
 *   - All occupation detail pages (one entry per dist/data.detail/<id>.json)
 *
 * The output is served at /sitemap.xml. Vercel cache headers are configured
 * in vercel.json (max-age=300, s-maxage=600, application/xml).
 */
import type { APIRoute } from 'astro';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ALL_RANKINGS } from '../data/lib/rankings';

const SITE = 'https://mirai-shigoto.com';
const REPO = path.resolve(process.cwd());

interface SectorDef {
  id: string;
}

interface SectorsFile {
  sectors: SectorDef[];
}

function loadSectorIds(): string[] {
  const json = JSON.parse(
    readFileSync(path.join(REPO, 'data', 'sectors', 'sectors.ja-en.json'), 'utf8'),
  ) as SectorsFile;
  return json.sectors.map((s) => s.id);
}

function loadOccupationIds(): number[] {
  const dir = path.join(REPO, 'dist', 'data.detail');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => parseInt(f.replace('.json', ''), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function urlBlock(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export const GET: APIRoute = () => {
  const today = new Date().toISOString().slice(0, 10);
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
