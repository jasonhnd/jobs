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

async function fetchUpstream<T>(
  fetchImpl: FetchLike,
  url: URL,
  init: RequestInit,
  timeoutMs: number,
  readBody: (response: Response) => Promise<T>,
): Promise<T | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      // Keep the fetch signal alive through body consumption. The race also
      // bounds injected implementations that do not reject on abort.
      resolve(null);
      controller.abort();
    }, timeoutMs);
  });
  const read = (async () => {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      controller.abort();
      return null;
    }
    return await readBody(response);
  })().catch(() => null);
  try {
    return await Promise.race([read, deadline]);
  } finally {
    clearTimeout(timer!);
  }
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
    (response) => response.text(),
  );

  const baseState = parseShindanBaseState(requestUrl.searchParams);
  let state = baseState;
  if (baseState && requestUrl.searchParams.has('job')) {
    const worktypesRaw = await fetchUpstream<unknown>(
      fetchImpl,
      new URL('/data.worktypes.json', origin),
      { headers: { Accept: 'application/json' } },
      timeoutMs,
      (response) => response.json(),
    );
    if (worktypesRaw !== null) {
      // Occupation context is optional. A truncated/corrupt projection must
      // degrade to the already-validated base result instead of rejecting the
      // Edge request and turning every job-bearing share URL into a 500.
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

  const basePageHtml = await basePagePromise;
  if (basePageHtml === null) {
    return new Response('Diagnostic share page unavailable', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const jobId = requestUrl.searchParams.get('job');
  const jobContext = jobId ? await fetchShareJobContext(origin, jobId, fetchImpl, timeoutMs) : null;
  const metadata = state ? buildShindanShareMetadata(origin, state, jobContext) : null;
  const html = renderShindanShareHtml(basePageHtml, metadata);
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
  const detailRaw = await fetchUpstream<unknown>(
    fetchImpl,
    new URL(`/data.detail/${paddedId}.json`, origin),
    { headers: { Accept: 'application/json' } },
    timeoutMs,
    (response) => response.json(),
  );
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
