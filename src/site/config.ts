/**
 * src/site/config.ts — single source of truth for site identity.
 *
 * Phase E (2026-05-15): consolidates the scattered hard-coded values
 * that used to live in src/lib/urls.ts (SITE_ORIGIN) and
 * src/layouts/BaseLayout.astro (lang / og:site_name / og:locale /
 * default OG image). Moving them here defends against the same
 * class of regression captured in the
 * `feedback_pii_audit_surface` memory: operator-name / X-handle
 * fixes used to span 8+ surfaces and got missed.
 *
 * Multi-locale is NOT a goal — the user explicitly does not plan
 * other-language variants. The point of this module is consistency
 * + grep-ability, not internationalization.
 */

export const siteConfig = {
  /** Canonical absolute origin (no trailing slash). */
  origin: 'https://mirai-shigoto.com',
  /** Open Graph `og:site_name` + screen-reader-friendly site label. */
  siteName: '日本の職業 AI 影響マップ',
  /** `<html lang="…">` value. */
  htmlLang: 'ja',
  /** `og:locale` value (BCP 47-style with underscore per OG spec). */
  ogLocale: 'ja_JP',
  /**
   * Default Open Graph image URL when no per-page override is given.
   * Points at the home-card endpoint so layouts can safely fall
   * back to it.
   */
  defaultOgImage: 'https://mirai-shigoto.com/api/og?page=home',
} as const;

export type SiteConfig = typeof siteConfig;

/**
 * Occupation counts — single source of truth for the two numbers that
 * appear across the site.
 *
 *   - SCORED = 556 — AI-scored by Claude Opus 4.8 / AIOIS-10; all on the map.
 *   - TOTAL  = 556 — full JILPT IPD v7.00 dataset.
 *
 * History: was 552 vs 556 until 2026-05-30. The 4 newest occupations
 * (581-584: ブロックチェーン・エンジニア / 声優 / 産業医 / 3Dプリンター技術者)
 * lacked labor stats and dropped off the workforce treemap. Estimated stats
 * were added (data/stats_legacy/058x.json, source="estimate_*") so the map,
 * rankings, and all copy show the full 556. Kept as two constants for any
 * future split.
 */
export const OCCUPATION_COUNT = {
  /** AI-scored occupations shown on the map / rankings / hubs. */
  SCORED: 556,
  /** Full JILPT IPD v7.00 occupation count (raw dataset). */
  TOTAL: 556,
} as const;
