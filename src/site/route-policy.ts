/** Stage 1B final address policy. Occupation simplification remains stage 2. */
import manifest from '../../docs/pro-split/route-manifest.json';
import { siteConfig } from './config';
import { stringifyJsonLd } from '../lib/json-for-script';

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
/** Stage 3: the eight-card ordinary index and complete Pro index are distinct. */
export function rankingIndexCanonicalPath(edition: Edition = 'ordinary'): string {
  return edition === 'pro' ? '/pro/rankings' : '/rankings';
}
const rankings = new Map(PRO_RANKINGS.map(row => [row.slug, row]));
export const MIGRATED_FAMILIES = new Set(manifest.pageTemplates
  .filter(row => row.oldStatus === 301)
  .map(row => row.oldTemplate.split('/')[1]!));

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
    pagePath: edition === 'pro' ? row.proPath : (row.ordinaryPath ?? row.proPath),
    canonicalPath: edition === 'pro' ? row.proCanonical : (row.ordinaryPath ?? row.proPath),
    noindex: row.noindex,
    sitemap: edition === 'pro' ? row.proSitemap : row.ordinarySitemap,
    ordinarySwitchPath: row.ordinaryPath ?? '/',
    ordinaryProCta: row.ordinaryPath !== null,
  };
}

/** Final links by edition, retaining shared endpoints and every query/fragment byte. */
export function editionHref(href: string, edition: Edition): string {
  if (href.startsWith(`${siteConfig.origin}/`)) return siteConfig.origin + editionHref(href.slice(siteConfig.origin.length), edition);
  const match = /^(\/[^?#]*)([?#].*)?$/.exec(href);
  if (!match) return href;
  const [, path, suffix = ''] = match;
  if (MIGRATED_FAMILIES.has(path!.split('/')[1]!)) return `/pro${path}${suffix}`;
  if (path === '/rankings') return edition === 'pro' ? `/pro/rankings${suffix}` : href;
  const ranking = /^\/rankings\/([^/]+)$/.exec(path!);
  if (ranking && rankings.has(ranking[1]!)) return rankingRoute(ranking[1]!, edition).pagePath + suffix;
  const occupation = /^\/([1-9]\d*)$/.exec(path!);
  if (edition === 'pro' && occupation && Number(occupation[1]) !== manifest.occupation.exception.id) {
    return occupationRoute(Number(occupation[1]), edition).pagePath + suffix;
  }
  if (edition === 'pro' && path === manifest.occupation.exception.ordinaryPath) return manifest.occupation.exception.proPath + suffix;
  return href;
}

/** Structured page links follow edition; the occupation entity and shared dataset stay stable. */
export function editionJsonLd(json: string, edition: Edition): string {
  function structuredHref(href: string): string {
    const absolute = href.startsWith(`${siteConfig.origin}/`);
    const raw = absolute ? href.slice(siteConfig.origin.length) : href;
    const match = /^(\/[^?#]*)([?#].*)?$/.exec(raw);
    if (match) {
      const path = match[1]!;
      const suffix = match[2] ?? '';
      const ranking = /^\/(?:pro\/)?rankings\/([^/]+)$/.exec(path);
      if (ranking && rankings.has(ranking[1]!)) {
        return (absolute ? siteConfig.origin : '') + rankingRoute(ranking[1]!, edition).canonicalPath + suffix;
      }
      if (path === '/rankings' || path === '/pro/rankings') {
        return (absolute ? siteConfig.origin : '') + rankingIndexCanonicalPath(edition) + suffix;
      }
    }
    return editionHref(href, edition);
  }
  function visit(value: unknown, key = '', stableEntity = false): unknown {
    if (Array.isArray(value)) return value.map(it => visit(it, key, stableEntity));
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const stable = record['@type'] === 'Occupation';
      return Object.fromEntries(Object.entries(record).map(([k,v]) => [k,visit(v,k,stable)]));
    }
    if (typeof value === 'string' && ['@id','url','item','mainEntityOfPage'].includes(key)
      && !stableEntity && !value.endsWith('#occupation')) return structuredHref(value);
    return value;
  }
  return stringifyJsonLd(visit(JSON.parse(json), '', false));
}

/** Adapt a trusted JSON-LD slot without touching any other inline script. */
export function editionJsonLdSlot(html: string, edition: Edition): string {
  return html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,
    (_all, start: string, json: string, end: string) => start + editionJsonLd(json, edition) + end);
}

/** Adapt trusted renderer output; never prefix arbitrary links or change prose/scripts. */
export function editionHtmlLinks<T extends string>(html: T, edition: Edition): T {
  // Scripts/styles are opaque. In particular, CSP-pinned analytics bytes never enter this adapter.
  return html.replace(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<nav\b[^>]*class="edition-nav"[^>]*>[\s\S]*?<\/nav>)|\bhref=(['"])([^'"]*)\2/gi,
    (_all, opaque: string | undefined, quote: string, href: string) => opaque ?? `href=${quote}${editionHref(href, edition)}${quote}`) as T;
}
