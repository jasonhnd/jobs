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

export async function renderShindanShareResponse(
  request: Request,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const origin = trustedFetchOrigin(requestUrl);
  const basePagePromise = fetchImpl(new URL('/shindan', origin), {
    headers: {
      Accept: 'text/html',
      'X-Shindan-Shell-Fetch': '1',
    },
  }).catch(() => null);

  const baseState = parseShindanBaseState(requestUrl.searchParams);
  let state = baseState;
  if (baseState && requestUrl.searchParams.has('job')) {
    const worktypesResponse = await fetchImpl(new URL('/data.worktypes.json', origin), {
      headers: { Accept: 'application/json' },
    }).catch(() => null);
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
  const jobContext = jobId ? await fetchShareJobContext(origin, jobId, fetchImpl) : null;
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

async function fetchShareJobContext(
  origin: string,
  jobId: string,
  fetchImpl: FetchLike,
): Promise<ShindanShareJobContext | null> {
  let paddedId: string;
  try {
    paddedId = padId(jobId);
  } catch {
    return null;
  }
  const detailRes = await fetchImpl(new URL(`/data.detail/${paddedId}.json`, origin), {
    headers: { Accept: 'application/json' },
  }).catch(() => null);
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
