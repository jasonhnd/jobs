/**
 * Resolve diagnostic result requests before Vercel's static-file routing.
 *
 * Vercel gives the filesystem precedence over `vercel.json` rewrites, so the
 * generated `/shindan.html` would otherwise mask a conditional rewrite. The
 * root Routing Middleware runs before that lookup and can safely send only
 * result queries to the Edge metadata renderer.
 *
 * Owner lock 2026-08-17: `/shindan` stays as the no-occupation 9-question
 * entry. Occupation-bearing old links (`?job=`) 301 to `/me`. Social
 * scrapers keep the share rewrite so OG is not lost on a redirect chain.
 */
import { NO_OCC_ALIAS_PATH, NO_OCC_PATH } from '../site/no-occ-path.js';

const JOB_ID_RE = /^\d{1,4}$/;

export function noOccAliasRedirectTarget(requestUrl: URL): URL | null {
  if (requestUrl.pathname !== NO_OCC_ALIAS_PATH) return null;
  const target = new URL(NO_OCC_PATH, requestUrl.origin);
  target.search = requestUrl.search;
  return target;
}

export function shindanOccupationRedirectTarget(requestUrl: URL): URL | null {
  if (requestUrl.pathname !== '/shindan') return null;
  const jobRaw = requestUrl.searchParams.get('job');
  if (!jobRaw || !JOB_ID_RE.test(jobRaw)) return null;
  const id = String(Number(jobRaw));
  if (id === '0') return null;

  const target = new URL('/me', requestUrl.origin);
  target.searchParams.set('id', id);
  const self = requestUrl.searchParams.get('self');
  const variant = requestUrl.searchParams.get('variant');
  const axes = requestUrl.searchParams.get('axes');
  if (self) target.searchParams.set('self', self);
  if (variant) target.searchParams.set('variant', variant);
  if (axes) target.searchParams.set('axes', axes);
  return target;
}

/**
 * `/me?id=` is a client-rendered page; its static OG is the generic /me card.
 * Social unfurlers rewrite to the occupation page, which already has the
 * score-led OG card (#237). Humans keep `/me?id=`.
 */
export function meOccupationOgRewriteTarget(requestUrl: URL): URL | null {
  if (requestUrl.pathname !== '/me') return null;
  const idRaw = requestUrl.searchParams.get('id');
  if (!idRaw || !JOB_ID_RE.test(idRaw)) return null;
  const id = Number(idRaw);
  if (id === 0) return null;
  const path = id === 404 ? '/occupations/404' : `/${id}`;
  return new URL(path, requestUrl.origin);
}

export function shindanShareRewriteTarget(requestUrl: URL): URL | null {
  if (requestUrl.pathname !== '/shindan' || !requestUrl.searchParams.has('self')) {
    return null;
  }

  const target = new URL('/api/shindan-share', requestUrl.origin);
  target.search = requestUrl.search;
  return target;
}
