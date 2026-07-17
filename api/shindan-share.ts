import { trustedFetchOrigin, WorktypesProjectionSchema } from '../src/lib/og-helpers.js';
import {
  addShindanOccupationContext,
  parseShindanBaseState,
} from '../src/site/shindan-result-state.js';
import {
  buildShindanShareMetadata,
  renderShindanShareHtml,
} from '../src/site/shindan-share-html.js';

export const config = {
  runtime: 'edge',
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
      const parsed = WorktypesProjectionSchema.safeParse(await worktypesResponse.json());
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

  const metadata = state ? buildShindanShareMetadata(origin, state) : null;
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

export default function handler(request: Request): Promise<Response> {
  return renderShindanShareResponse(request);
}
