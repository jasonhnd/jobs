/**
 * image-sitemap.xml.ts — Google image-sitemap for OG cards.
 *
 * Emits one <url> entry per occupation linking to:
 *   - <loc>: the detail page (https://mirai-shigoto.com/ja/<id>)
 *   - <image:image><image:loc>: the dynamic OG card endpoint (/api/og?id=<id>)
 *   - <image:title>: "{ja_title} — AI影響 {score}/10"
 *
 * Source: public/data.detail/<id>.json (one file per occupation; produced by
 * src/data/build.ts). Only occupations with a non-null ai_risk.score are
 * included, since /api/og can't render a card without a score.
 */
import type { APIRoute } from 'astro';
import path from 'node:path';
import { strictReadJson, strictReaddir } from '../data/lib/strict-load';
import { DetailFileSchema } from '../data/lib/projection-schemas';

const SITE = 'https://mirai-shigoto.com';
const REPO = path.resolve(process.cwd());

/** Image-sitemap floor — every occupation with an ai_risk score gets a
 *  URL. Set well below the live count (~556) so churn doesn't trip it,
 *  but high enough to catch "loader returned []" regressions. */
const IMAGE_SITEMAP_MIN_URL_COUNT = 400;

interface OccEntry {
  id: number;
  title: string;
  score: number;
}

function loadOccupations(): OccEntry[] {
  const dir = path.join(REPO, 'public', 'data.detail');
  const files = strictReaddir(dir, (f) => f.endsWith('.json'), 'image-sitemap.detail');
  const out: OccEntry[] = [];
  for (const f of files) {
    const j = strictReadJson(
      path.join(dir, f),
      DetailFileSchema,
      'image-sitemap.detail',
    );
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

  if (occs.length < IMAGE_SITEMAP_MIN_URL_COUNT) {
    throw new Error(
      `[image-sitemap] generated ${occs.length} entries, below the safety floor of ${IMAGE_SITEMAP_MIN_URL_COUNT}. ` +
      `Check that public/data.detail/ is populated and ai_risk.score is set.`,
    );
  }

  const entries = occs.map((o) => {
    const title = `${o.title} — AI影響 ${o.score}/10`;
    // o.id is a number so XML escape is redundant on <loc>, but use it
    // defensively in case a future caller pipes through a string id.
    return `  <url>
    <loc>${escapeXml(`${SITE}/ja/${o.id}`)}</loc>
    <image:image>
      <image:loc>${escapeXml(`${SITE}/api/og?id=${o.id}`)}</image:loc>
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
