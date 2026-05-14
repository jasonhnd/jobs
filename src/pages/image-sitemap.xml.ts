/**
 * src/pages/image-sitemap.xml.ts — thin Astro binding for the Google
 * image-sitemap. All enumeration + serialization lives in
 * src/views/image-sitemap.ts (Phase D audit #5 — page must not do I/O
 * or schema parsing per docs/architecture.md §3.1).
 */
import type { APIRoute } from 'astro';
import { loadGraph } from '@/graph';
import {
  buildImageSitemapEntries,
  renderImageSitemapXml,
  IMAGE_SITEMAP_MIN_URL_COUNT,
} from '@/views/image-sitemap';

export const GET: APIRoute = async () => {
  const graph = await loadGraph();
  const entries = buildImageSitemapEntries(graph);

  if (entries.length < IMAGE_SITEMAP_MIN_URL_COUNT) {
    throw new Error(
      `[image-sitemap] generated ${entries.length} entries, below the safety floor of ${IMAGE_SITEMAP_MIN_URL_COUNT}. ` +
      `Check that the graph is populated and ai_risk.score is set.`,
    );
  }

  const xml = renderImageSitemapXml(entries);
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
