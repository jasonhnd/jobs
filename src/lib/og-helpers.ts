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
 * v1.4.0: dropped title.en / ai_rationale_en (site is JA-only).
 *
 * Runtime-validated by DetailRecordSchema below — call `safeParse` on
 * fetched JSON before using fields. The TypeScript type is derived from
 * the schema so the two stay in lockstep.
 */
export const DetailRecordSchema = z
  .object({
    id: z.number().int(),
    title: z
      .object({
        ja: z.string().optional(),
      })
      .passthrough()
      .nullish(),
    ai_risk: z
      .object({
        score: z.number().nullish(),
        rationale_ja: z.string().nullish(),
      })
      .passthrough()
      .nullish(),
    stats: z
      .object({
        workers: z.number().nullish(),
        salary_man_yen: z.number().nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();
export type DetailRecord = z.infer<typeof DetailRecordSchema>;

/**
 * Shape of `/data.sectors.json` — used by the sector-card branch.
 * v1.4.0: dropped sector.en (site is JA-only).
 */
export const SectorRecordSchema = z
  .object({
    id: z.string(),
    ja: z.string(),
    hue: z.enum(["safe", "mid", "warm"]),
    occupation_count: z.number(),
    mean_ai_risk: z.number(),
    total_workforce: z.number(),
    sample_titles_ja: z.array(z.string()).optional(),
  })
  .passthrough();
export type SectorRecord = z.infer<typeof SectorRecordSchema>;

export const SectorsProjectionSchema = z
  .object({
    sectors: z.array(SectorRecordSchema),
  })
  .passthrough();
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
 */
const _fontCache = new Map<string, Promise<ArrayBuffer>>();

export async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const key = `${family}|${weight}|${text}`;
  const cached = _fontCache.get(key);
  if (cached) return cached;
  const promise = fetchGoogleFont(family, weight, text);
  _fontCache.set(key, promise);
  promise.catch(() => { _fontCache.delete(key); });
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
