/**
 * src/lib/urls.ts — canonical URL helpers for mirai-shigoto.com.
 *
 * Phase E (2026-05-15): SITE_ORIGIN now sources from src/site/config.ts
 * so the production origin lives in exactly one place.
 */

import { siteConfig } from '@/site/config';

/** Canonical absolute URL for a Japanese occupation detail page. */
export function jaUrl(id: number): string {
  return `${siteConfig.origin}/${id}`;
}
