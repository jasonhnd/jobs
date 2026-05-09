/**
 * image-sitemap.xml.ts — Google image-sitemap for OG cards.
 *
 * Migrated from scripts/build_image_sitemap.py.
 *
 * Emits one <url> entry per occupation linking to:
 *   - <loc>: the detail page (https://mirai-shigoto.com/ja/<id>)
 *   - <image:image><image:loc>: the dynamic OG card endpoint (/api/og?id=<id>)
 *   - <image:title>: "{ja_title} — AI影響 {score}/10"
 *
 * Source: dist/data.detail/<id>.json (one file per occupation; produced by
 * src/data/build.ts). Only occupations with a non-null ai_risk.score are
 * included, matching the legacy Python filter.
 */
import type { APIRoute } from 'astro';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SITE = 'https://mirai-shigoto.com';
const REPO = path.resolve(process.cwd());

interface DetailFile {
  id: number;
  title?: { ja?: string };
  ai_risk?: { score?: number | null };
}

interface OccEntry {
  id: number;
  title: string;
  score: number;
}

function loadOccupations(): OccEntry[] {
  const dir = path.join(REPO, 'public', 'data.detail');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out: OccEntry[] = [];
  for (const f of files) {
    const j = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as DetailFile;
    if (typeof j.id !== 'number') continue;
    const score = j.ai_risk?.score;
    if (score == null) continue;
    const title = j.title?.ja ?? '';
    if (!title) continue;
    out.push({ id: j.id, title, score });
  }
  return out.sort((a, b) => a.id - b.id);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = () => {
  const occs = loadOccupations();

  const entries = occs.map((o) => {
    const title = `${o.title} — AI影響 ${o.score}/10`;
    return `  <url>
    <loc>${SITE}/ja/${o.id}</loc>
    <image:image>
      <image:loc>${SITE}/api/og?id=${o.id}</image:loc>
      <image:title>${escapeXml(title)}</image:title>
    </image:image>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
