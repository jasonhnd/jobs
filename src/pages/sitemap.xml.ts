/**
 * sitemap.xml.ts — site-wide sitemap, generated at build time.
 *
 * Thin binding shell: loads the graph, asks the view to enumerate
 * every public URL, then serializes to XML. See
 * `src/views/sitemap.ts` for the actual logic.
 */
import type { APIRoute } from 'astro';
import { loadGraph } from '@/graph';
import { nowIso } from '../lib/now.js';
import { buildSitemapEntries, renderSitemapXml, sitemapLastmods } from '@/views/sitemap';

/**
 * Sitemap MUST contain at least this many URLs. Falls below the bound when
 * a loader silently returns []. The bound is derived from the current
 * production output (~821 URLs at v1.5.x) with healthy margin, but stays
 * well below it so legitimate occupation churn (a handful of detail files
 * added or removed in a sprint) doesn't trip the check.
 */
const SITEMAP_MIN_URL_COUNT = 600;

export const GET: APIRoute = async () => {
  const graph = await loadGraph();
  // <lastmod> = the site's freshest CONTENT date (latest AI-score run_date),
  // not the build clock. Using nowIso() here bumped all 820 lastmods to "today"
  // on every rebuild, drifting the SEO baseline daily (the same class of bug
  // the 2026-06-03 ai-adoption fix addressed). nowIso() now only serves as the
  // fallback for the degenerate case of a graph with no scored occupation.
  const lastmods = sitemapLastmods(graph, nowIso().slice(0, 10));
  const entries = buildSitemapEntries(graph, lastmods);

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
