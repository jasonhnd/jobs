import { fetchWithTimeout } from '../src/lib/http-client.js';
import {
  DetailRecordSchema,
  padId,
  trustedFetchOrigin,
  WorktypesProjectionSchema,
} from '../src/lib/og-helpers.js';
import {
  addShindanOccupationContext,
  parseShindanBaseState,
} from '../src/site/shindan-result-state.js';
import {
  buildShindanShareMetadata,
  renderShindanShareHtml,
  type ShindanShareJobContext,
} from '../src/site/shindan-share-html.js';

export const config = {
  // nodejs + vercel.json bunVersion 1.4.x → Bun 1.4 (TOOLCHAIN §9 / #304).
  runtime: 'nodejs',
  regions: ['hnd1', 'kix1'],
};

type FetchLike = typeof fetch;

/** Same-origin shell, worktypes, and detail reads. A stall must not hold the function. */
const SHINDAN_SHARE_UPSTREAM_TIMEOUT_MS = 5000;

function fetchUpstream(
  fetchImpl: FetchLike,
  url: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  return fetchWithTimeout(url, init, timeoutMs, fetchImpl).catch(() => null);
}

export async function renderShindanShareResponse(
  request: Request,
  fetchImpl: FetchLike = fetch,
  timeoutMs: number = SHINDAN_SHARE_UPSTREAM_TIMEOUT_MS,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const origin = trustedFetchOrigin(requestUrl);
  const basePagePromise = fetchUpstream(
    fetchImpl,
    new URL('/shindan', origin),
    {
      headers: {
        Accept: 'text/html',
        'X-Shindan-Shell-Fetch': '1',
      },
    },
    timeoutMs,
  );

  const baseState = parseShindanBaseState(requestUrl.searchParams);
  let state = baseState;
  if (baseState && requestUrl.searchParams.has('job')) {
    const worktypesResponse = await fetchUpstream(
      fetchImpl,
      new URL('/data.worktypes.json', origin),
      { headers: { Accept: 'application/json' } },
      timeoutMs,
    );
    if (worktypesResponse?.ok) {
      // Occupation context is optional. A truncated/corrupt projection must
      // degrade to the already-validated base result instead of rejecting the
      // Edge request and turning every job-bearing share URL into a 500.
      const worktypesRaw: unknown = await worktypesResponse.json().catch(() => null);
      const parsed = WorktypesProjectionSchema.safeParse(worktypesRaw);
      if (parsed.success) {
        state = addShindanOccupationContext(
          baseState,
          requestUrl.searchParams,
          parsed.data.occupations,
        );
      }
    }
  }

  const basePageResponse = await basePagePromise;
  if (!basePageResponse?.ok) {
    return new Response('Diagnostic share page unavailable', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const jobId = requestUrl.searchParams.get('job');
  const jobContext = jobId ? await fetchShareJobContext(origin, jobId, fetchImpl, timeoutMs) : null;
  const metadata = state ? buildShindanShareMetadata(origin, state, jobContext) : null;
  const html = renderShindanShareHtml(await basePageResponse.text(), metadata);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex, follow',
    },
  });
}

// Unfurlers reach this endpoint through the middleware share rewrite and
// may probe HEAD before GET; named-export routing otherwise answers 405
// (#330). Mirror the GET 200 headers without the body work.
export function HEAD(_request: Request): Response {
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex, follow',
    },
  });
}

async function fetchShareJobContext(
  origin: string,
  jobId: string,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<ShindanShareJobContext | null> {
  let paddedId: string;
  try {
    paddedId = padId(jobId);
  } catch {
    return null;
  }
  const detailRes = await fetchUpstream(
    fetchImpl,
    new URL(`/data.detail/${paddedId}.json`, origin),
    { headers: { Accept: 'application/json' } },
    timeoutMs,
  );
  if (!detailRes?.ok) return null;
  const detailRaw: unknown = await detailRes.json().catch(() => null);
  const parsed = DetailRecordSchema.safeParse(detailRaw);
  if (!parsed.success) return null;
  const title = parsed.data.title?.ja;
  if (!title) return null;
  return {
    title,
    score: parsed.data.ai_risk?.score ?? null,
  };
}

export async function GET(request: Request): Promise<Response> {
  return renderShindanShareResponse(request);
}
