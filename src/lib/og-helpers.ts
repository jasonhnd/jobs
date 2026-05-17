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

import { z } from "zod";
import {
  DetailFileSchema,
  SectorRecordSchema,
  SectorsProjectionSchema,
} from "./projection-schemas.js";

// ─── Risk / hue palettes ──────────────────────────────────────────────────

/**
 * Risk-band → tile color, aligned with Direction C palette
 * (mobile-tokens.css). Sage green for low risk, warm gold for mid,
 * terracotta for high.
 */
export const RISK_COLORS: Record<number, string> = {
  0: "#6E9B89", 1: "#6E9B89", 2: "#6E9B89",   // sage — safe / low
  3: "#93A879", 4: "#93A879",                   // sage-gold transition — mid-low
  5: "#D4A749", 6: "#D4A749",                   // warm gold — mid
  7: "#D96B3D", 8: "#D96B3D",                   // terracotta — high
  9: "#B85535", 10: "#B85535",                  // deep terracotta — max
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
export type DetailRecord = z.infer<typeof DetailRecordSchema>;

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
export type SectorRecord = z.infer<typeof SectorRecordSchema>;
export type SectorsProjection = z.infer<typeof SectorsProjectionSchema>;

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
 */
export function padId(idDigits: string): string {
  return idDigits.padStart(4, "0").slice(-4);
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
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error(`failed to fetch font binary: ${fontRes.status}`);
  return await fontRes.arrayBuffer();
}
