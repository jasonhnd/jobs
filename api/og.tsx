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

import { ImageResponse } from "@vercel/og";
import {
  RISK_COLORS,
  loadGoogleFont,
  fmtNumber,
  padId,
  DetailRecordSchema,
} from "../src/lib/og-helpers.js";
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

  // Fetch the per-occupation detail file (~3.5 KB gz). Vercel CDN caches the
  // upstream fetch by URL, so concurrent OG requests for the same id share it.
  const detailUrl = new URL(`/data.detail/${padId(idParam)}.json`, url.origin);
  const detailRes = await fetch(detailUrl.toString());
  if (detailRes.status === 404) {
    return new Response("Occupation not found", { status: 404 });
  }
  if (!detailRes.ok) {
    return new Response("Upstream detail fetch failed", { status: 502 });
  }
  const detailRaw: unknown = await detailRes.json();
  const detailParsed = DetailRecordSchema.safeParse(detailRaw);
  if (!detailParsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      `[og] detail projection schema mismatch for id=${idParam}`,
      detailParsed.error.issues.slice(0, 3),
    );
    return new Response("Upstream detail data invalid", { status: 502 });
  }
  const rec = detailParsed.data;

  const risk = rec.ai_risk?.score ?? null;
  const riskColor = risk != null ? (RISK_COLORS[risk] ?? "#8a93a3") : "#8a93a3";
  const primaryName = rec.title?.ja ?? "";
  const workers = rec.stats?.workers ?? 0;
  const salary = rec.stats?.salary_man_yen ?? 0;

  const riskLabel = "AI 影響";
  const workersLabel = `就業者 ${fmtNumber(workers)} 人`;
  const salaryLabel = `平均年収 ${salary} 万円`;
  const siteMark = "mirai-shigoto.com";
  const riskNumberStr = risk != null ? String(risk) : "—";

  // Subset string covers every glyph we are about to render. This keeps the
  // Google Fonts fetch tiny (a few KB instead of ~3 MB for full Noto Sans JP).
  const subsetText =
    `独立分析 ${siteMark} ${primaryName} ${riskLabel} ` +
    `${workersLabel} ${salaryLabel} ${riskNumberStr} / 10 ·`;

  // v1.2.0 Direction C convergence: serif for the occupation name, sans for everything else.
  const [fontSerifBuf, fontSansBoldBuf, fontSansRegBuf] = await Promise.all([
    loadGoogleFont("Noto+Serif+JP", 600, subsetText),
    loadGoogleFont("Noto+Sans+JP",  800, subsetText),
    loadGoogleFont("Noto+Sans+JP",  500, subsetText),
  ]);

  // Direction C palette (synced from styles/mobile-tokens.css).
  const C = {
    bg:        "#FAF6EE",  // warm cream canvas
    ink:       "#241E18",  // primary ink
    muted:     "#7A6F5E",  // secondary muted
    hairline:  "rgba(36, 30, 24, 0.12)",
    accent:    "#D96B3D",  // terracotta — "独立分析" badge + accent
    bg2:       "#FFFFFF",  // elevated card surface
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: C.bg,
          color: C.ink,
          fontFamily: "NotoSansJP",
          padding: "48px 64px",
        }}
      >
        {/* Top bar — "独立分析" badge + site mark */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: C.accent,
              color: "#FFFFFF",
              padding: "8px 18px",
              borderRadius: "999px",
              fontWeight: 800,
              fontSize: "22px",
              letterSpacing: "0.08em",
            }}
          >
            独立分析
          </div>
          <div style={{ fontSize: "24px", color: C.muted, fontWeight: 500 }}>
            {siteMark}
          </div>
        </div>

        {/* Main row — risk block + names */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "56px",
            flex: 1,
            marginTop: "40px",
          }}
        >
          <div
            style={{
              background: C.bg2,
              border: `4px solid ${riskColor}`,
              color: riskColor,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "320px",
              height: "320px",
              borderRadius: "24px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontFamily: "NotoSerifJP",
                fontSize: "200px",
                fontWeight: 600,
                lineHeight: 1,
              }}
            >
              {riskNumberStr}
            </div>
            <div
              style={{
                fontSize: "36px",
                fontWeight: 600,
                marginTop: "-4px",
                color: C.muted,
                letterSpacing: "0.04em",
              }}
            >
              / 10
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: "14px",
            }}
          >
            <div
              style={{
                fontSize: "26px",
                color: C.muted,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {riskLabel}
            </div>
            <div
              style={{
                fontFamily: "NotoSerifJP",
                fontSize: "72px",
                fontWeight: 600,
                lineHeight: 1.12,
                color: C.ink,
                letterSpacing: "-0.01em",
              }}
            >
              {primaryName}
            </div>
          </div>
        </div>

        {/* Bottom stats line */}
        <div
          style={{
            display: "flex",
            gap: "28px",
            fontSize: "26px",
            color: C.ink,
            fontWeight: 500,
            borderTop: `1px solid ${C.hairline}`,
            paddingTop: "24px",
            marginTop: "32px",
          }}
        >
          <span>{workersLabel}</span>
          <span style={{ color: C.muted, opacity: 0.5 }}>·</span>
          <span>{salaryLabel}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "NotoSerifJP", data: fontSerifBuf,  weight: 600, style: "normal" },
        { name: "NotoSansJP",  data: fontSansBoldBuf, weight: 800, style: "normal" },
        { name: "NotoSansJP",  data: fontSansRegBuf, weight: 500, style: "normal" },
      ],
      headers: {
        // Tell Vercel CDN + downstream caches to keep this card for a day,
        // serve-stale-while-revalidate for a week. social platforms aggressively
        // cache anyway; this just protects against thundering herd on cold edges.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
