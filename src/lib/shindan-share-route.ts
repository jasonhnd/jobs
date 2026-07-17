/**
 * Resolve diagnostic result requests before Vercel's static-file routing.
 *
 * Vercel gives the filesystem precedence over `vercel.json` rewrites, so the
 * generated `/shindan.html` would otherwise mask a conditional rewrite. The
 * root Routing Middleware runs before that lookup and can safely send only
 * result queries to the Edge metadata renderer.
 */
export function shindanShareRewriteTarget(requestUrl: URL): URL | null {
  if (requestUrl.pathname !== '/shindan' || !requestUrl.searchParams.has('self')) {
    return null;
  }

  const target = new URL('/api/shindan-share', requestUrl.origin);
  target.search = requestUrl.search;
  return target;
}
