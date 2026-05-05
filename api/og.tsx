// api/og.tsx — Vercel Edge Function: dynamic Open Graph image for an occupation.
//
// GET /api/og?id=<occupation_id>&lang=<ja|en>
//
//   Renders a 1200×630 PNG card carrying:
//     - the occupation's AI-risk number on a risk-band-colored block
//     - JA + EN occupation names
//     - workforce + average annual salary
//     - UNOFFICIAL banner + site mark
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
// Vercel CDN caches each unique URL. First request ≈ 200–500 ms (cold start +
// font fetch); subsequent identical requests are CDN hits.

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// Risk-band → tile color, aligned with Direction C palette (mobile-tokens.css).
// Sage green for low risk, warm gold for mid, terracotta for high.
const RISK_COLORS: Record<number, string> = {
  0: "#6E9B89", 1: "#6E9B89", 2: "#6E9B89",   // sage — safe / low
  3: "#93A879", 4: "#93A879",                   // sage-gold transition — mid-low
  5: "#D4A749", 6: "#D4A749",                   // warm gold — mid
  7: "#D96B3D", 8: "#D96B3D",                   // terracotta — high
  9: "#B85535", 10: "#B85535",                  // deep terracotta — max
};

// Pull a Google-Fonts subset that covers exactly the characters we will draw.
// Returns the OTF/TTF bytes; satori (inside @vercel/og) needs binary font data.
async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const url =
    `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}` +
    `&text=${encodeURIComponent(text)}&display=swap`;
  const css = await (
    await fetch(url, {
      // Force a UA that gets ttf/otf back, not woff2 — satori cannot parse woff2.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; satori; rv:1.0)" },
    })
  ).text();
  const match = css.match(/src:\s*url\((.+?)\)\s*format\(['"](opentype|truetype)['"]\)/);
  if (!match) throw new Error(`font src not found in CSS: ${family} ${weight}`);
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error(`failed to fetch font binary: ${fontRes.status}`);
  return await fontRes.arrayBuffer();
}

function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

// Shape of /data.detail/<padded>.json (DetailProjectionSchema; see DATA_ARCHITECTURE.md §6.2).
// Only the fields actually consumed by the OG card are typed here — the JSON has more.
interface DetailRecord {
  id: number;
  title?: { ja?: string; en?: string | null };
  ai_risk?: { score?: number; rationale_ja?: string; rationale_en?: string } | null;
  stats?: { workers?: number | null; salary_man_yen?: number | null } | null;
}

function padId(idDigits: string): string {
  // /data.detail/<id>.json is 4-digit zero-padded per §3A.2 (e.g. "0042.json").
  // Bound the digit count defensively — we won't ever serve more than 9999 occupations.
  return idDigits.padStart(4, "0").slice(-4);
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "ja";

  if (!idParam || !/^\d+$/.test(idParam)) {
    return new Response("Bad request: ?id= required (numeric)", { status: 400 });
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
  const rec = (await detailRes.json()) as DetailRecord;

  const risk = rec.ai_risk?.score ?? null;
  const riskColor = risk != null ? (RISK_COLORS[risk] ?? "#8a93a3") : "#8a93a3";
  const nameJa = rec.title?.ja ?? "";
  const nameEn = rec.title?.en ?? "";
  const workers = rec.stats?.workers ?? 0;
  const salary = rec.stats?.salary_man_yen ?? 0;

  const primaryName = lang === "ja" ? nameJa : (nameEn || nameJa);
  const subName = lang === "ja" ? nameEn : nameJa;
  const riskLabel = lang === "ja" ? "AI 影響" : "AI Impact";
  const workersLabel =
    lang === "ja"
      ? `就業者 ${fmtNumber(workers)} 人`
      : `Workforce ${fmtNumber(workers)}`;
  const salaryLabel =
    lang === "ja"
      ? `平均年収 ${salary} 万円`
      : `Avg salary ${salary} 万円`;
  const siteMark = "mirai-shigoto.com";
  const riskNumberStr = risk != null ? String(risk) : "—";

  // Subset string covers every glyph we are about to render. This keeps the
  // Google Fonts fetch tiny (a few KB instead of ~3 MB for full Noto Sans JP).
  const subsetText =
    `UNOFFICIAL ${siteMark} ${primaryName} ${subName} ${riskLabel} ` +
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
    accent:    "#D96B3D",  // terracotta — UNOFFICIAL + accent
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
        {/* Top bar — UNOFFICIAL badge + site mark */}
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
            UNOFFICIAL
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
            {subName ? (
              <div style={{ fontSize: "30px", color: C.muted, fontWeight: 500 }}>
                {subName}
              </div>
            ) : null}
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
