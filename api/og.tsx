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

import {
  PAGE_CARDS,
  RANKING_CARDS,
  INTEREST_CARDS,
  SKILL_CARDS,
  COMPARE_CARDS,
} from "../src/views/og-cards.js";
import { renderGenericOgCard } from "../src/lib/og-renderers/generic.js";
import { renderMapOgCard } from "../src/lib/og-renderers/map.js";
import { renderSectorOgCard } from "../src/lib/og-renderers/sector.js";
import { renderOccupationOgCard } from "../src/lib/og-renderers/occupation.js";

export const config = { runtime: "edge" };

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
  const sectorParam = url.searchParams.get("sector");
  const idParam = url.searchParams.get("id");
  const pageParam = url.searchParams.get("page");
  const rankingParam = url.searchParams.get("ranking");
  const interestParam = url.searchParams.get("interest");
  const skillParam = url.searchParams.get("skill");
  const compareParam = url.searchParams.get("compare");

  // /map OG card uses the rich treemap-legend variant — special-case before
  // the generic ?page= branch.
  if (pageParam === "map") {
    return renderMapOgCard();
  }

  // Generic text-only cards: /api/og?page=home|about|privacy|compliance|404|sectors|rankings|interests
  if (pageParam) {
    const cfg = PAGE_CARDS[pageParam];
    if (!cfg) {
      return new Response(
        `Bad request: unknown ?page=${pageParam}. Known: ${Object.keys(PAGE_CARDS).join(", ")}, map`,
        { status: 400 },
      );
    }
    return renderGenericOgCard(cfg);
  }

  // Per-ranking text cards: /api/og?ranking=<slug>
  if (rankingParam) {
    const cfg = RANKING_CARDS[rankingParam];
    if (!cfg) {
      return new Response(
        `Bad request: unknown ?ranking=${rankingParam}. Known: ${Object.keys(RANKING_CARDS).join(", ")}`,
        { status: 400 },
      );
    }
    return renderGenericOgCard(cfg);
  }

  // Per-interest (RIASEC) text cards: /api/og?interest=<slug>
  if (interestParam) {
    const cfg = INTEREST_CARDS[interestParam];
    if (!cfg) {
      return new Response(
        `Bad request: unknown ?interest=${interestParam}. Known: ${Object.keys(INTEREST_CARDS).join(", ")}`,
        { status: 400 },
      );
    }
    return renderGenericOgCard(cfg);
  }

  // Per-skill text cards: /api/og?skill=<slug>
  if (skillParam) {
    const cfg = SKILL_CARDS[skillParam];
    if (!cfg) {
      return new Response(
        `Bad request: unknown ?skill=${skillParam}. Known: ${Object.keys(SKILL_CARDS).join(", ")}`,
        { status: 400 },
      );
    }
    return renderGenericOgCard(cfg);
  }

  // Per-compare text cards: /api/og?compare=<slug>
  if (compareParam) {
    const cfg = COMPARE_CARDS[compareParam];
    if (!cfg) {
      return new Response(
        `Bad request: unknown ?compare=${compareParam}. Known: ${Object.keys(COMPARE_CARDS).join(", ")}`,
        { status: 400 },
      );
    }
    return renderGenericOgCard(cfg);
  }

  // Phase 9: sector-card branch — /api/og?sector=<sector_id>
  if (sectorParam) {
    return renderSectorOgCard(url, sectorParam);
  }

  if (!idParam || !/^\d+$/.test(idParam)) {
    return new Response(
      "Bad request: required ?id=<n>, ?sector=<id>, ?ranking=<slug>, ?interest=<slug>, ?skill=<slug>, ?compare=<slug>, or ?page=<map|home|about|privacy|compliance|404|sectors|rankings|interests|skills|compare>",
      { status: 400 },
    );
  }

  return renderOccupationOgCard(url, idParam);
}
