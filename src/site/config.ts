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
 *   - SCORED = 552 — AI-scored by Claude Opus 4.7 (what treemap / rankings show)
 *   - TOTAL  = 556 — full JILPT IPD v7.00 dataset (4 are not scored yet)
 *
 * Before this constant existed, the two values were scattered across
 * 30+ surfaces and produced contradictory copy: homepage said "552
 * 職業", /ja/sectors H1 said "556 職業", /404 said "業界別 556
 * 職業". Users hit different numbers in adjacent pages.
 *
 * Rule of thumb:
 *   - User-facing copy that references THE MAP / RANKINGS / HUBS → SCORED
 *   - Provenance discussion (/about/data-sources, glossary) describing
 *     the IPD source dataset itself → TOTAL
 */
export const OCCUPATION_COUNT = {
  /** AI-scored occupations — what users see on the map, in rankings, hubs. */
  SCORED: 552,
  /** Full JILPT IPD v7.00 occupation count (raw dataset). */
  TOTAL: 556,
} as const;
