// src/lib/og-helpers.ts — shared helpers for the api/og.tsx Vercel Edge
// Function. Lives under src/lib/ (not api/) so Vercel does NOT auto-route
// it as a function endpoint. TypeScript here because the consumer (og.tsx)
// is already TSX — same compile path.
//
// Two concerns:
//
//   1. Font loading (loadGoogleFont) with a module-level Promise cache so
//      warm Edge instances skip the CSS + binary round-trips on repeat
//      requests for the same (family, weight, text) tuple.
//
//   2. Pure data shared across templates: risk-band → color, sector hue →
//      color, the shape of `/data.detail/<id>.json` and
//      `/data.sectors.json`, the generic-card config struct, and small
//      formatters (`fmtNumber`, `padId`).
//
// Templates themselves stay in api/og.tsx so satori JSX + Edge runtime
// boundary lives in one place.

import {
  DetailFileSchema,
  SectorRecordSchema,
  SectorsProjectionSchema,
} from "./projection-schemas.js";

// ─── Risk / hue palettes ──────────────────────────────────────────────────

/**
 * Risk-band → tile color. Mirrors the canonical --risk-0..4 scale in
 * canonical-css.ts (satori needs a literal hex, not a CSS var, so the
 * values are kept in sync by hand). Green for low impact → red for high.
 */
export const RISK_COLORS: Record<number, string> = {
  0: "#0F8A66", 1: "#0F8A66", 2: "#0F8A66",   // --risk-0 teal-green — low
  3: "#5BA84F", 4: "#5BA84F",                   // --risk-1 green — mid-low
  5: "#D9A03B", 6: "#D9A03B",                   // --risk-2 gold — mid
  7: "#E27A33", 8: "#E27A33",                   // --risk-3 orange — high
  9: "#C4422F", 10: "#C4422F",                  // --risk-4 red — max
};

/** Sector hue → Direction C accent color for the OG card border. */
export const SECTOR_HUE_COLOR: Record<string, string> = {
  safe: "#6E9B89", // sage
  mid:  "#D4A749", // warm gold
  warm: "#D96B3D", // terracotta
};

// ─── Shapes of consumed JSON projections ──────────────────────────────────

/**
 * Shape of `/data.detail/<padded>.json` (see DATA_ARCHITECTURE.md §6.2).
 * Only the fields actually consumed by the OG card are typed here.
 *
 * Phase D #8 (2026-05-14 architecture.md §8 row 14): this is now DERIVED
 * from `DetailFileSchema` in src/lib/projection-schemas.ts via `.pick()`.
 * Eliminates the "二次 schema" drift risk that the doc flagged. The OG
 * card only reads 4 top-level fields (id / title / ai_risk / stats);
 * picking them gives an equivalent runtime validator without re-stating
 * the inner shapes.
 *
 * Why this is safe for Edge bundle: projection-schemas.ts is pure-TS
 * (no JSX) and zod-only. The 2026-05-14 27-deploy-failure was caused by
 * `.tsx` dep loader limitation, not by Edge dep-tree depth. Adding a
 * pure-TS zod schema to the transitive tree of api/og.tsx is verified
 * Edge-compatible.
 *
 * Equivalence with the pre-D8 hand-written DetailRecordSchema is pinned
 * by the existing drift tests in src/lib/og-helpers.test.ts (the same
 * tests that previously validated subset relationship now validate
 * pick-derived identity).
 */
export const DetailRecordSchema = DetailFileSchema.pick({
  id: true,
  title: true,
  ai_risk: true,
  stats: true,
});

/**
 * Shape of `/data.sectors.json` — used by the sector-card branch.
 *
 * Phase D #8 follow-up (2026-05-16): re-exported from
 * `./projection-schemas.ts` instead of being hand-written here. The two
 * shapes were structurally identical (verified by og-helpers.test.ts
 * drift guard), so duplicating them served no purpose other than drift
 * risk. Done in the same pattern as DetailRecordSchema above, which was
 * itself the Phase D #8 (2026-05-14) precedent.
 *
 * v1.4.0: dropped sector.en (site is JA-only) — encoded in
 * projection-schemas as well.
 *
 * Edge-bundle safety: same rationale as DetailRecordSchema — pure-TS,
 * zod-only, no JSX, no fs. Adding to the transitive dep tree of
 * api/og.tsx is Edge-compatible.
 */
export { SectorRecordSchema, SectorsProjectionSchema };

/** Per-page template config consumed by `renderGenericCard`. */
export interface GenericCardConfig {
  eyebrow: string;
  title: string;
  subtitle: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────

export function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * /data.detail/<id>.json is 4-digit zero-padded (e.g. "0042.json").
 * Bound the digit count defensively — we won't ever serve more than 9999
 * occupations.
 *
 * Strict: rejects anything that isn't 1–4 ASCII digits. The earlier
 * implementation silently truncated overflow via `.slice(-4)`, which
 * turned `padId("10001")` into `"0001"` and served occupation #1's OG
 * card for any 5+-digit id (CODE-008). The dispatch layer only routes a
 * 1–4-digit id to the occupation renderer (anything else degrades to
 * the home card — og-dispatch.ts safety net), so this throw is a
 * last-resort guard; if it ever fires, api/og.tsx's catch-all turns it
 * into a 503, never a wrong-card 200.
 */
export function padId(idDigits: string): string {
  if (!/^\d{1,4}$/.test(idDigits)) {
    throw new Error(`padId: invalid input ${JSON.stringify(idDigits)} (must be 1-4 ASCII digits)`);
  }
  return idDigits.padStart(4, "0");
}

/** Production origin — the fallback target for {@link trustedFetchOrigin}. */
const PRODUCTION_ORIGIN = "https://mirai-shigoto.com";

/**
 * Origin to use for an OG renderer's upstream `/data.*.json` fetch.
 *
 * The renderers fetch from the REQUEST's own origin so each preview deploy
 * reads its own data (pinned by occupation.test.ts — preview cards must not
 * silently pull production data). This guard keeps that behaviour for hosts we
 * actually serve — `mirai-shigoto.com` (+ subdomains), `*.vercel.app` preview
 * domains, and localhost dev — but for any OTHER host (i.e. a spoofed `Host`
 * header) it falls back to the production origin rather than issuing a
 * server-side fetch to an attacker-chosen host. SSRF defence-in-depth: Vercel
 * already normalises `Host` to the deployment domain, so this is a
 * belt-and-braces guard, and it degrades to a valid card (never hard-fails).
 */
export function trustedFetchOrigin(url: URL): string {
  const host = url.hostname;
  const trusted =
    host === "mirai-shigoto.com" ||
    host.endsWith(".mirai-shigoto.com") ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host === "127.0.0.1";
  return trusted ? url.origin : PRODUCTION_ORIGIN;
}

// ─── Font loading with in-flight Promise cache ────────────────────────────

/**
 * Module-level Promise cache keyed by `family|weight|text`. Same
 * (family, weight, subsetText) tuple within an Edge instance's lifetime
 * resolves from cache — shaves the CSS fetch + binary fetch on warm
 * instances. Caches the *Promise* so concurrent first-time callers all
 * await the same in-flight fetch instead of racing N redundant requests.
 * On fetch failure the rejected Promise is evicted so the next caller
 * retries fresh.
 *
 * 2026-05-17 H19 fix: previously unbounded. The cache key includes the
 * subset `text`, which varies per occupation/sector title (556+ unique
 * subsets), so warm Edge instances accumulated hundreds of MB of font
 * buffers and would OOM after a few hours of traffic. LRU-cap at 32
 * entries — covers our 2 fonts × ~16 frequently-used subsets and
 * evicts cold tails. Subset variability is a minor cache-miss tax
 * (~50ms extra on cold subset) vs the OOM crash it prevents.
 */
const FONT_CACHE_LIMIT = 32;
const _fontCache = new Map<string, Promise<ArrayBuffer>>();

export async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const key = `${family}|${weight}|${text}`;
  const cached = _fontCache.get(key);
  if (cached) {
    // Bump to most-recent by re-inserting (Map preserves insertion order).
    _fontCache.delete(key);
    _fontCache.set(key, cached);
    return cached;
  }
  const promise = fetchGoogleFont(family, weight, text);
  // Evict rejected promise on failure so the next caller retries fresh.
  promise.catch(() => { _fontCache.delete(key); });
  _fontCache.set(key, promise);
  // Trim oldest if over capacity. Map iteration order = insertion
  // order, so the first key is the LRU victim.
  while (_fontCache.size > FONT_CACHE_LIMIT) {
    const firstKey = _fontCache.keys().next().value;
    if (firstKey === undefined) break;
    _fontCache.delete(firstKey);
  }
  return promise;
}

async function fetchGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const url =
    `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}` +
    `&text=${encodeURIComponent(text)}&display=swap`;
  const cssRes = await fetch(url, {
    // Force a UA that gets ttf/otf back, not woff2 — satori cannot parse woff2.
    headers: { "User-Agent": "Mozilla/5.0 (compatible; satori; rv:1.0)" },
  });
  // Fail loudly on non-2xx so the OG endpoint returns 503 + Retry-After
  // instead of trying to regex-match an error page. Without this check the
  // next line would silently feed Google's HTML error page to the regex,
  // which would only fail later when the cryptic "font src not found" was
  // logged — a much harder failure to diagnose at 3 AM.
  if (!cssRes.ok) {
    throw new Error(
      `font CSS fetch failed: ${family} ${weight}: HTTP ${cssRes.status}`,
    );
  }
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\((.+?)\)\s*format\(['"](opentype|truetype)['"]\)/);
  if (!match) throw new Error(`font src not found in CSS: ${family} ${weight}`);
  // Defence-in-depth: match[1] is extracted from Google's CSS *response* —
  // external data we parse. Pin the binary fetch to the known font CDN so a
  // poisoned / MITM'd / future-redesigned CSS body can't redirect this into
  // an arbitrary-host server-side fetch (SSRF) from the Edge network.
  const fontBinaryUrl = match[1];
  if (!fontBinaryUrl.startsWith("https://fonts.gstatic.com/")) {
    throw new Error(`unexpected font binary host (expected fonts.gstatic.com): ${fontBinaryUrl}`);
  }
  const fontRes = await fetch(fontBinaryUrl);
  if (!fontRes.ok) throw new Error(`failed to fetch font binary: ${fontRes.status}`);
  return await fontRes.arrayBuffer();
}
