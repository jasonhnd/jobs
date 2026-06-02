/**
 * src/views/image-sitemap.ts — Google image-sitemap view (URL enumeration +
 * XML serialization).
 *
 * Extracted from src/pages/image-sitemap.xml.ts on 2026-05-14 (Phase D
 * audit #5 per docs/architecture.md §5 + §3.1). The page-binding was doing
 * file I/O + schema parsing — both forbidden at the page layer. doc §5
 * cross-cutting view table lists `ImageSitemapView(graph)` as one of 7
 * cross-cutting surfaces; this module is that view.
 *
 * Mirror of src/views/sitemap.ts shape: pure-data builder that returns
 * typed rows, plus a renderer that produces the final XML string. The
 * page becomes a 10-line handler.
 *
 * Output bytes match the previous inline implementation byte-for-byte
 * (the SEO baseline `image-sitemap.xml` snapshot verifies this).
 */

import type { KnowledgeGraph } from '@/graph';

const SITE = 'https://mirai-shigoto.com';

/** Image-sitemap floor — every occupation with an ai_risk score gets a
 *  URL. Set well below the live count (~556) so churn doesn't trip it,
 *  but high enough to catch "loader returned []" regressions. */
export const IMAGE_SITEMAP_MIN_URL_COUNT = 400;

export interface ImageSitemapEntry {
  readonly id: number;
  readonly title: string;
  readonly score: number;
}

/**
 * Enumerate every occupation that has a non-null AI risk score (only
 * those can render an OG card). Returns sorted by id ascending —
 * matches the previous file-listing order which was sorted by padded
 * filename ('0001.json', '0002.json', ...).
 */
export function buildImageSitemapEntries(
  graph: KnowledgeGraph,
): ImageSitemapEntry[] {
  const out: ImageSitemapEntry[] = [];
  for (const [occId, occ] of graph.occupations) {
    const score = occ.aiRisk?.score;
    if (score == null) continue;
    const title = occ.titleJa;
    if (!title) continue;
    out.push({
      id: Number(occId),
      title,
      score,
    });
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

/**
 * Serialize entries into the full image-sitemap XML document, matching
 * the byte-exact output of the previous inline page implementation.
 */
export function renderImageSitemapXml(
  entries: ReadonlyArray<ImageSitemapEntry>,
): string {
  const blocks = entries.map((o) => {
    const title = `${o.title} — AI影響 ${o.score}/10`;
    return `  <url>
    <loc>${escapeXml(`${SITE}/${o.id}`)}</loc>
    <image:image>
      <image:loc>${escapeXml(`${SITE}/api/og?id=${o.id}`)}</image:loc>
      <image:title>${escapeXml(title)}</image:title>
    </image:image>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${blocks.join('\n')}
</urlset>
`;
}
