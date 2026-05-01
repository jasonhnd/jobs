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
// file or to data.json takes effect on the next social-platform re-scrape — we
// do NOT have to regenerate 552 PNGs every time the design or data shifts.
//
// Vercel CDN caches each unique URL. First request ≈ 200–500 ms (cold start +
// font fetch); subsequent identical requests are CDN hits.

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// Risk-band → tile color, identical to the per-occupation page CSS.
const RISK_COLORS: Record<number, string> = {
  0: "#7ddc7d", 1: "#7ddc7d", 2: "#7ddc7d",
  3: "#a8d572", 4: "#a8d572",
  5: "#ffd84d", 6: "#ffd84d",
  7: "#ff8a3d", 8: "#ff8a3d",
  9: "#ff5050", 10: "#ff5050",
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

interface OccupationRecord {
  id: number;
  name_ja?: string;
  name_en?: string;
  ai_risk?: number;
  workers?: number;
  salary?: number;
  ai_rationale_ja?: string;
  ai_rationale_en?: string;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "ja";

  if (!idParam || !/^\d+$/.test(idParam)) {
    return new Response("Bad request: ?id= required (numeric)", { status: 400 });
  }

  // Fetch the dataset from the same origin. Vercel caches this internally,
  // so concurrent OG requests share one upstream fetch.
  const dataUrl = new URL("/data.json", url.origin);
  const dataRes = await fetch(dataUrl.toString());
  if (!dataRes.ok) {
    return new Response("Upstream data.json fetch failed", { status: 502 });
  }
  const data = (await dataRes.json()) as OccupationRecord[];
  const rec = data.find((r) => String(r.id) === idParam);
  if (!rec) {
    return new Response("Occupation not found", { status: 404 });
  }

  const risk = rec.ai_risk ?? null;
  const riskColor = risk != null ? (RISK_COLORS[risk] ?? "#8a93a3") : "#8a93a3";
  const nameJa = rec.name_ja ?? "";
  const nameEn = rec.name_en ?? "";
  const workers = rec.workers ?? 0;
  const salary = rec.salary ?? 0;

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

  const [fontBoldBuf, fontRegBuf] = await Promise.all([
    loadGoogleFont("Noto+Sans+JP", 800, subsetText),
    loadGoogleFont("Noto+Sans+JP", 500, subsetText),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0b0d10",
          color: "#e9eef5",
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
              background: "#ff8a3d",
              color: "#0b0d10",
              padding: "8px 18px",
              borderRadius: "6px",
              fontWeight: 800,
              fontSize: "22px",
              letterSpacing: "0.06em",
            }}
          >
            UNOFFICIAL
          </div>
          <div style={{ fontSize: "24px", color: "#8a93a3", fontWeight: 500 }}>
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
              background: riskColor,
              color: "#0b0d10",
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
            <div style={{ fontSize: "200px", fontWeight: 800, lineHeight: 1 }}>
              {riskNumberStr}
            </div>
            <div
              style={{
                fontSize: "44px",
                fontWeight: 800,
                marginTop: "-12px",
                opacity: 0.85,
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
                color: "#8a93a3",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {riskLabel}
            </div>
            <div
              style={{
                fontSize: "68px",
                fontWeight: 800,
                lineHeight: 1.08,
                color: "#ffb84d",
              }}
            >
              {primaryName}
            </div>
            {subName ? (
              <div style={{ fontSize: "32px", color: "#8a93a3", fontWeight: 500 }}>
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
            color: "#e9eef5",
            fontWeight: 500,
            borderTop: "1px solid #2a2f38",
            paddingTop: "24px",
            marginTop: "32px",
          }}
        >
          <span>{workersLabel}</span>
          <span style={{ color: "#3a4150" }}>·</span>
          <span>{salaryLabel}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "NotoSansJP", data: fontBoldBuf, weight: 800, style: "normal" },
        { name: "NotoSansJP", data: fontRegBuf, weight: 500, style: "normal" },
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
