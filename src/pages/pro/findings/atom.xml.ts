import type { APIRoute } from 'astro';
import { renderFindingsAtom } from '@/site/findings/atom';

export const GET: APIRoute = () => new Response(renderFindingsAtom(), {
  headers: {
    'Content-Type': 'application/atom+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  },
});
