import oldRoutes from '../../../docs/pro-split/generated-routes.json';

const validRoutes = new Set(oldRoutes);

export interface GeoReferralParams {
  readonly geo_referrer_engine: string;
  readonly geo_referrer_bucket: string;
  readonly geo_referrer_host: string;
  readonly geo_landing_family: string;
  readonly geo_landing_edition: 'ordinary' | 'pro';
  readonly geo_citation_candidate: string;
}

export function landingFamily(pathname: string): string {
  if (pathname.startsWith('/pro/')) {
    const logical = pathname.slice(4);
    if (logical === '/404') return 'occupation';
    if (!validRoutes.has(logical)) return 'other';
    pathname = logical;
  }
  if (pathname === '/occupations/404' || (pathname !== '/404' && /^\/[1-9]\d*$/.test(pathname) && validRoutes.has(pathname))) return 'occupation';
  if (pathname === '/answers' || pathname.startsWith('/answers/')) return 'answers';
  if (pathname === '/q' || pathname.startsWith('/q/')) return 'qa';
  if (pathname === '/sectors' || pathname.startsWith('/sectors/')) return 'sector';
  if (pathname === '/rankings' || pathname.startsWith('/rankings/')) return 'ranking';
  if (pathname === '/compare' || pathname.startsWith('/compare/')) return 'compare';
  if (pathname === '/standard') return 'standard';
  if (pathname === '/methodology') return 'methodology';
  if (pathname === '/map') return 'map';
  return 'other';
}

export function isGoogleHost(host: string): boolean {
  return /^google\.[a-z.]+$/.test(host);
}

export function classifyGeoReferral(pageUrl: URL, referer: string): GeoReferralParams {
  const refUrl = referer ? (() => {
    try {
      return new URL(referer);
    } catch {
      return null;
    }
  })() : null;

  const refHost = refUrl?.hostname.toLowerCase().replace(/^www\./, '') ?? '';
  const family = landingFamily(pageUrl.pathname);
  const citableLanding = ['answers', 'qa', 'sector', 'ranking', 'compare', 'standard', 'methodology'].includes(family);

  let engine = 'direct';
  let bucket = 'direct';

  if (refHost) {
    const sameSite = refHost === pageUrl.hostname.toLowerCase().replace(/^www\./, '')
      || refHost.endsWith('.mirai-shigoto.com');

    if (sameSite) {
      engine = 'internal';
      bucket = 'internal';
    } else if (refHost === 'perplexity.ai') {
      engine = 'perplexity';
      bucket = 'ai_engine';
    } else if (refHost === 'chatgpt.com' || refHost === 'chat.openai.com') {
      engine = 'chatgpt_search';
      bucket = 'ai_engine';
    } else if (refHost === 'gemini.google.com' || refHost === 'bard.google.com') {
      engine = 'gemini';
      bucket = 'ai_engine';
    } else if (refHost === 'copilot.microsoft.com' || (refHost === 'bing.com' && refUrl?.pathname.startsWith('/chat'))) {
      engine = 'bing_copilot';
      bucket = 'ai_engine';
    } else if (refHost === 'claude.ai') {
      engine = 'claude';
      bucket = 'ai_engine';
    } else if (refHost === 'you.com' || refHost === 'phind.com' || refHost === 'komo.ai' || refHost === 'andisearch.com') {
      engine = refHost.replace(/\./g, '_');
      bucket = 'ai_engine';
    } else if (isGoogleHost(refHost)) {
      engine = 'google_search';
      bucket = 'search';
    } else if (refHost === 'bing.com' || refHost.endsWith('.bing.com')) {
      engine = 'bing_search';
      bucket = 'search';
    } else {
      engine = 'other_external';
      bucket = 'external';
    }
  }

  const citationCandidate = bucket === 'ai_engine' || (bucket === 'search' && citableLanding);

  return {
    geo_referrer_engine: engine,
    geo_referrer_bucket: bucket,
    geo_referrer_host: refHost || '(direct)',
    geo_landing_family: family,
    geo_landing_edition: pageUrl.pathname === '/pro' || pageUrl.pathname.startsWith('/pro/') ? 'pro' : 'ordinary',
    geo_citation_candidate: citationCandidate ? 'true' : 'false',
  };
}

export function attachDeliveryParams(payload: unknown, params: GeoReferralParams): void {
  if (!payload || typeof payload !== 'object') return;
  const events = (payload as { events?: Array<{ params?: Record<string, unknown> }> }).events;
  const delivery = events?.[0];
  if (!delivery?.params) return;
  delivery.params = { ...delivery.params, ...params };
}

/** The one host whose pages belong in a search index. */
const PRODUCTION_HOST = 'mirai-shigoto.com';

/**
 * Whether a request's Host should be withheld from search indexes.
 *
 * Preview deployments are a complete, indexable mirror of production.
 * Verified 2026-09-21: pre.mirai-shigoto.com served robots.txt `Allow: /`
 * and `<meta name="robots" content="index, follow">`, and Google had
 * already picked up pre.mirai-shigoto.com/data. 839 duplicate URLs
 * competing with the canonical host is not a risk worth carrying.
 *
 * Decided per REQUEST, not at build time, for two reasons. Astro loads
 * .env.local into the build and this repo's own .env.local carries
 * VERCEL=1 and VERCEL_ENV="preview" (it comes from `vercel env pull`), so
 * no build-time env signal can tell a local build from a preview one.
 * Worse, `capture:seo-baseline` runs locally — a build-time noindex would
 * bake `noindex` into tests/baseline/seo-metadata.jsonl for all 839 pages
 * and make verify:gates drift against every production build. Deciding at
 * the edge leaves the static HTML, and therefore the baseline, untouched.
 *
 * Allow-list, not deny-list: only the exact production host is indexable.
 * Every preview URL, every *.vercel.app deployment URL and every future
 * alias is withheld without needing to be enumerated. A missing or
 * malformed Host header is withheld too — an unidentifiable request is
 * not the production site.
 */
export function shouldWithholdFromIndex(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return true;
  // Host may carry a port (`example.com:3000`); compare the name only.
  const host = hostHeader.split(':')[0].trim().toLowerCase();
  return host !== PRODUCTION_HOST;
}
