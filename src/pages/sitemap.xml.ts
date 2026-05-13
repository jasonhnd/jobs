/**
 * sitemap.xml.ts — site-wide sitemap, generated at build time.
 *
 * Thin binding shell: loads the graph, asks the view to enumerate
 * every public URL, then serializes to XML. See
 * `src/views/sitemap.ts` for the actual logic.
 */
import type { APIRoute } from 'astro';
import { loadGraph } from '@/graph';
import { nowIso } from '../data/lib/now.js';
import { buildSitemapEntries, renderSitemapXml } from '@/views/sitemap';

/**
 * Sitemap MUST contain at least this many URLs. Falls below the bound when
 * a loader silently returns []. The bound is derived from the current
 * production output (~821 URLs at v1.5.x) with healthy margin, but stays
 * well below it so legitimate occupation churn (a handful of detail files
 * added or removed in a sprint) doesn't trip the check.
 */
const SITEMAP_MIN_URL_COUNT = 600;

export const GET: APIRoute = async () => {
  // nowIso() (cached, env-overridable via BUILD_DATA_TIMESTAMP) keeps the
  // <lastmod> values consistent with the generated_at stamp on
  // data.*.json projections produced in the same build.
  const today = nowIso().slice(0, 10);
  const graph = await loadGraph();
  const entries = buildSitemapEntries(graph, today);

  if (entries.length < SITEMAP_MIN_URL_COUNT) {
    // The sitemap is the single biggest crawl-budget signal we send to
    // search engines. A regression that quietly shrinks it would only
    // surface days later in Search Console — assert at build time so a
    // broken loader (missing detail dir, partial deploy) fails CI loudly.
    throw new Error(
      `[sitemap] generated ${entries.length} URLs, below the safety floor of ${SITEMAP_MIN_URL_COUNT}. ` +
      `This usually means the knowledge graph load failed or a config module returned [].`,
    );
  }

  return new Response(renderSitemapXml(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
