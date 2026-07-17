/**
 * src/lib/urls.ts — canonical URL helpers for mirai-shigoto.com.
 *
 * Phase E (2026-05-15): SITE_ORIGIN now sources from src/site/config.ts
 * so the production origin lives in exactly one place.
 */

import { siteConfig } from '@/site/config';

/**
 * Root-level paths that are owned by a static page rather than an occupation.
 *
 * Occupation IDs normally keep the historic `/{id}` URL. ID 404 is the one
 * exception because `/404` must remain the host's custom not-found document.
 * Keeping the exception here prevents individual URL producers from drifting.
 */
const RESERVED_ROOT_OCCUPATION_IDS = new Set([404]);

/** Canonical path for an occupation detail page. */
export function occupationPath(id: number): string {
  return RESERVED_ROOT_OCCUPATION_IDS.has(id) ? `/occupations/${id}` : `/${id}`;
}

/** Canonical absolute URL for a Japanese occupation detail page. */
export function jaUrl(id: number): string {
  return `${siteConfig.origin}${occupationPath(id)}`;
}
