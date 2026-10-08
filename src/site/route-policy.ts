/** Stage 1A policy only. Planned redirects/final canonicals are not active. */
import manifest from '../../docs/pro-split/route-manifest.json';

export type Edition = 'ordinary' | 'pro';
export interface RoutePolicy {
  readonly pagePath: string;
  readonly canonicalPath: string;
  readonly noindex: boolean;
  readonly sitemap: boolean;
  readonly ordinarySwitchPath: string;
}

export interface RankingRoutePolicy extends RoutePolicy {
  /** Only the eight final ordinary rankings receive the ordinary-page Pro CTA. */
  readonly ordinaryProCta: boolean;
}

export const PRO_RANKINGS = manifest.rankings;
const rankings = new Map(PRO_RANKINGS.map(row => [row.slug, row]));

/** Called with graph-owned IDs; route generation, not this helper, validates existence. */
export function occupationRoute(id: number, edition: Edition = 'ordinary'): RoutePolicy {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Invalid occupation ID: ${id}`);
  const exception = manifest.occupation.exception;
  const ordinary = id === exception.id ? exception.ordinaryPath : `/${id}`;
  const pro = id === exception.id ? exception.proPath : manifest.occupation.proTemplate.replace('<numeric-id>', String(id));
  return { pagePath: edition === 'pro' ? pro : ordinary, canonicalPath: ordinary, noindex: false, sitemap: edition === 'ordinary', ordinarySwitchPath: ordinary };
}

export function rankingRoute(slug: string, edition: Edition = 'ordinary'): RankingRoutePolicy {
  const row = rankings.get(slug);
  if (!row) throw new Error(`Unknown ranking: ${slug}`);
  return {
    pagePath: edition === 'pro' ? row.proPath : row.oldPath,
    canonicalPath: edition === 'pro' ? row.phase1ProCanonical : row.oldPath,
    noindex: row.noindex,
    // Stage 1A preserves the existing ordinary sitemap, including its four noindex entries.
    sitemap: edition === 'ordinary',
    // All old ranking pages are still live in stage 1A, even future migrations.
    ordinarySwitchPath: row.oldPath,
    ordinaryProCta: row.ordinaryPath !== null,
  };
}

/** Only duplicated families switch edition. Shared and not-yet-migrated URLs stay at root. */
export function editionHref(href: string, edition: Edition): string {
  if (edition === 'ordinary') return href;
  const match = /^(\/[^?#]*)([?#].*)?$/.exec(href);
  if (!match) return href;
  const [, path, suffix = ''] = match;
  if (path === '/rankings') return `/pro/rankings${suffix}`;
  const ranking = /^\/rankings\/([^/]+)$/.exec(path!);
  if (ranking && rankings.has(ranking[1]!)) return rankingRoute(ranking[1]!, edition).pagePath + suffix;
  const occupation = /^\/([1-9]\d*)$/.exec(path!);
  if (occupation && Number(occupation[1]) !== manifest.occupation.exception.id) {
    return occupationRoute(Number(occupation[1]), edition).pagePath + suffix;
  }
  if (path === manifest.occupation.exception.ordinaryPath) return manifest.occupation.exception.proPath + suffix;
  return href;
}

/** Adapt trusted renderer output; never prefix arbitrary links or change prose/scripts. */
export function editionHtmlLinks<T extends string>(html: T, edition: Edition): T {
  if (edition === 'ordinary') return html;
  return html.replace(/\bhref=(['"])([^'"]*)\1/g, (_all, quote: string, href: string) =>
    `href=${quote}${editionHref(href, edition)}${quote}`) as T;
}
