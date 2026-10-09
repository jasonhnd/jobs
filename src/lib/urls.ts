/**
 * src/lib/urls.ts — canonical URL helpers for mirai-shigoto.com.
 *
 * Phase E (2026-05-15): SITE_ORIGIN now sources from src/site/config.ts
 * so the production origin lives in exactly one place.
 */

import { siteConfig } from '@/site/config';

import { occupationRoute, rankingRoute, type Edition } from '@/site/route-policy';

/** Page path; ID404 is distinct from the root custom error document. */
export function occupationPath(id: number, edition: Edition = 'ordinary'): string {
  return occupationRoute(id, edition).pagePath;
}

export function occupationUrl(id: number, edition: Edition = 'ordinary'): string {
  return `${siteConfig.origin}${occupationPath(id, edition)}`;
}

export function occupationCanonicalUrl(id: number, edition: Edition = 'ordinary'): string {
  return `${siteConfig.origin}${occupationRoute(id, edition).canonicalPath}`;
}

export function rankingUrl(slug: string, edition: Edition = 'ordinary'): string {
  return `${siteConfig.origin}${rankingRoute(slug, edition).pagePath}`;
}

export function rankingCanonicalUrl(slug: string, edition: Edition = 'ordinary'): string {
  return `${siteConfig.origin}${rankingRoute(slug, edition).canonicalPath}`;
}

/** Historic ordinary entity URL retained for existing consumers. */
export function jaUrl(id: number): string {
  return occupationCanonicalUrl(id);
}
