/**
 * src/lib/urls.ts — canonical URL helpers for mirai-shigoto.com.
 *
 * Currently a single helper (jaUrl) extracted from
 * src/pages/ja/[id].astro. Additional URL builders will collect
 * here as more pages migrate off inline string interpolation.
 */

const SITE_ORIGIN = 'https://mirai-shigoto.com';

/** Canonical absolute URL for a Japanese occupation detail page. */
export function jaUrl(id: number): string {
  return `${SITE_ORIGIN}/ja/${id}`;
}
