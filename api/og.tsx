// api/og.tsx — Vercel Edge Function: dynamic Open Graph image generator.
//
// All site OG cards render through this single endpoint. Three rich
// templates plus a generic text-only template cover every page type:
//
// GET /api/og?id=<occupation_id>          — occupation card (rich, 556 variants)
// GET /api/og?sector=<sector_id>          — sector hub card (rich, 16 variants)
// GET /api/og?page=map                    — /map page card (rich, treemap legend)
// GET /api/og?page=home|about|privacy|compliance|404|sectors|rankings
//                                         — generic page card (text-only)
// GET /api/og?ranking=<slug>              — ranking detail card (text-only, 9 slugs)
// GET /api/og?route=<slug>                — explore route card (text-only, 7 slugs)
// GET /api/og?worktype=<family>&variant=<variant>[&shape=square]
//                                         — AI働き方診断 result card
//   (interest / skill / compare families are also text-only — see og-dispatch.ts)
//
//   Unrenderable input (unknown slug / bad id / no param) never 400s —
//   it degrades to the home card (og-dispatch.ts safety net).
//
//   Every card is 1200×630 PNG with:
//     - "独立分析" badge top-left + site mark top-right
//     - Direction C warm-cream palette
//     - JA-only copy (site dropped EN UI in v1.4.0)
//
// The image-sitemap.xml only references ?id= cards (the 552 scored
// occupations) — the generic / ranking / sector cards are linked through
// each page's <meta property="og:image"> instead.
//
// The card is generated at request time (not pre-built), so any change to this
// file or to /data.detail/<id>.json takes effect on the next social-platform
// re-scrape — we do NOT have to regenerate 556 PNGs every time the design or
// data shifts.
//
// v1.0.8 (Phase 3): switched from a single /data.json fetch (~275 KB gz) to
// a per-occupation /data.detail/<padded>.json fetch (~3.5 KB gz each). One
// edge function instance no longer pulls the entire dataset just to render
// one card.
//
// v1.4.0: removed `lang=en` parameter handling — site is JA-only.
//
// Vercel CDN caches each unique URL. First request ≈ 200–500 ms (cold start +
// font fetch); subsequent identical requests are CDN hits.
//
// No application rate limit BY DESIGN: this is a public OG endpoint that social
// platforms (X / Facebook / LINE / Slack) must be free to scrape, and the CDN
// absorbs repeat load. A per-IP limit here would risk 429-ing a scraper
// mid-crawl and breaking link-preview cards — don't add one. DDoS protection,
// if ever needed, belongs at the Vercel/CDN edge, not in this handler.

// Dispatch decision lives in src/lib/og-dispatch.ts — a pure
// function that parses URL params and returns a discriminated
// `DispatchDecision`. This entry file is just the I/O wrapper:
// parse → decide → execute. Dispatch logic itself is unit-tested
// independently from the renderers (which need network for fonts).
import { decideDispatch } from "../src/lib/og-dispatch.js";
// Renderers are plain .ts files in src/lib/og-renderers/, using
// `createElement` (aliased as `h`) instead of JSX. The reason: Vercel's
// Edge Function bundler does NOT compile dependency .tsx files — it has
// loaders for .js / .ts only. By writing the renderer trees as
// `h('div', { style: {...} }, ...)` calls in .ts, the source is
// directly bundleable by Vercel with no pre-compile step required.
// See CHANGELOG [Unreleased] § "Vercel preview deploy unblocked".
import { renderGenericOgCard } from "../src/lib/og-renderers/generic.js";
import { renderMapOgCard } from "../src/lib/og-renderers/map.js";
import { renderSectorOgCard } from "../src/lib/og-renderers/sector.js";
import { renderOccupationOgCard } from "../src/lib/og-renderers/occupation.js";
import { renderWorktypeOgCard } from "../src/lib/og-renderers/worktype.js";

export const config = {
  runtime: "edge",
  // JA-only audience; pin to Tokyo + Osaka regions instead of the default
  // 19-region global pool. Saves Vercel function quota; minor cold-start
  // benefit for JP visitors.
  regions: ["hnd1", "kix1"],
};

// ─── Generic text-only card configs ──
// All 5 _CARDS dicts (PAGE / RANKING / INTEREST / SKILL / COMPARE)
// live in src/views/og-cards.ts as typed views — see imports above.


// Phase 9: sector hub OG card. Source = /data.sectors.json (16-sector projection).


// Design-Mobile.md §4.7: /map page OG card. Static layout, no upstream fetch.

export default async function handler(req: Request): Promise<Response> {
  try {
    return await renderHandler(req);
  } catch (err) {
    // Catch-all so a malformed Google Fonts response or a transient network
    // error returns a 503 with Retry-After instead of leaking a stack trace
    // through Vercel's default 500 page (which the social-card scrapers
    // would then cache).
    //
    // Detailed error → server-side log only. Response body is a fixed
    // string so we never echo data-source paths, font-loading internals,
    // or stack traces to scrapers. Audit's #4.4.
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[og] render failed: ${msg}`);
    return new Response("OG render failed", {
      status: 503,
      headers: { "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function renderHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const decision = decideDispatch(url);

  switch (decision.kind) {
    case "render-map":
      return renderMapOgCard();
    case "render-generic":
      return renderGenericOgCard(decision.config);
    case "render-sector":
      return renderSectorOgCard(url, decision.id);
    case "render-occupation":
      return renderOccupationOgCard(url, decision.id);
    case "render-worktype":
      return renderWorktypeOgCard(url, decision);
  }
}
