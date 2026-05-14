/**
 * occupation.test.ts — pin the upstream-error contract for
 * `renderOccupationOgCard`.
 *
 * Scope: same shape as sector.test.ts — only the pre-render code path
 * (`fetch` result handling + zod validation). The actual `ImageResponse`
 * render branch falls through to `loadGoogleFont`, which we don't
 * exercise (real Google Fonts fetch from a test = slow + flaky +
 * yields no useful assertion).
 *
 * Pre-render contract (this file's surface):
 *   - 404 when upstream returns 404 (occupation does not exist)
 *   - 502 when upstream returns any other non-OK status
 *   - 502 when upstream JSON does not match `DetailRecordSchema`
 *   - Fetch URL uses padded id from `padId(idParam)` against the
 *     request's own origin
 *
 * `RISK_COLORS[risk] ?? DEFAULT_RISK_COLOR` mapping is exercised
 * indirectly — if a malformed score breaks the lookup, the render call
 * (which we don't reach in tests) would crash. We pin the validation
 * boundary so a bad upstream record cannot get past zod.
 */

import { describe, test, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderOccupationOgCard } from './occupation.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Minimal valid DetailRecord fixtures kept inline at each test that
// needs them — the schema only requires `id: number`, every other
// field is optional/nullish.

describe('renderOccupationOgCard — upstream 404 path', () => {
  test('404 when upstream returns 404 (occupation does not exist)', async () => {
    globalThis.fetch = async () => new Response('', { status: 404 });
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '999');
    assert.equal(res.status, 404);
    assert.equal(await res.text(), 'Occupation not found');
  });

  test('404 response does NOT leak the input idParam', async () => {
    // Audit's #4.4: fixed message, no user input echoed.
    globalThis.fetch = async () => new Response('', { status: 404 });
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '<injected>');
    const body = await res.text();
    assert.ok(!body.includes('<injected>'), `body should NOT echo input: ${body}`);
  });
});

describe('renderOccupationOgCard — upstream 5xx path', () => {
  test('502 when upstream returns 500', async () => {
    globalThis.fetch = async () => new Response('upstream broken', { status: 500 });
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '156');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream detail fetch failed');
  });

  test('502 when upstream returns 503', async () => {
    globalThis.fetch = async () => new Response('', { status: 503 });
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '156');
    assert.equal(res.status, 502);
  });
});

describe('renderOccupationOgCard — zod schema validation', () => {
  test('502 when upstream JSON is not an object at all (e.g. array)', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify([1, 2, 3]), { status: 200 });
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '156');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream detail data invalid');
  });

  test('502 when `id` is missing (required field)', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ title: { ja: '看護師' } }), { status: 200 });
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '156');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream detail data invalid');
  });

  test('502 when `id` is the wrong type (string instead of number)', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ id: 'one-five-six' }), { status: 200 });
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '156');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream detail data invalid');
  });

  test('502 when `ai_risk.score` is a string (must be nullable number)', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          id: 156,
          ai_risk: { score: 'high' },
        }),
        { status: 200 },
      );
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '156');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream detail data invalid');
  });

  test('502 error body NEVER echoes the malformed payload back to the caller', async () => {
    // The schema-mismatch handler logs structured detail server-side
    // (Vercel observability) and responds with a fixed string. The
    // request body must never leak fields like `evil_marker` to the
    // social-card scraper.
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ evil_marker_xyz: 'leak-me', id: 'wrong' }),
        { status: 200 },
      );
    const url = new URL('https://example.com/');
    const res = await renderOccupationOgCard(url, '156');
    const body = await res.text();
    assert.equal(res.status, 502);
    assert.ok(!body.includes('evil_marker_xyz'), `body must not echo input: ${body}`);
    assert.ok(!body.includes('leak-me'), `body must not echo input: ${body}`);
  });
});

describe('renderOccupationOgCard — fetch URL construction', () => {
  test('uses padded id from padId() against the request origin', async () => {
    // padId(156) → '0156' per src/lib/og-helpers.ts. Validates that
    // the renderer reaches the right CDN path even for low-digit ids
    // (id=1 → 0001, not 1). Caught a prior bug where un-padded paths
    // returned 404 from CDN despite the file existing.
    let capturedUrl = '';
    globalThis.fetch = async (input) => {
      capturedUrl = typeof input === 'string' ? input : input.toString();
      return new Response('', { status: 404 });
    };
    const url = new URL('https://pre.mirai-shigoto.com/api/og?id=156');
    await renderOccupationOgCard(url, '156');
    assert.equal(capturedUrl, 'https://pre.mirai-shigoto.com/data.detail/0156.json');
  });

  test('uses request origin (not a hardcoded production origin)', async () => {
    // Critical for preview deploys: each branch deploy has its own
    // *.vercel.app origin. The renderer MUST fetch from the request's
    // own origin, otherwise preview OG cards would pull production
    // data — masking schema drift across environments.
    let capturedUrl = '';
    globalThis.fetch = async (input) => {
      capturedUrl = typeof input === 'string' ? input : input.toString();
      return new Response('', { status: 404 });
    };
    const previewUrl = new URL('https://jobs-abc123-zkscio.vercel.app/api/og?id=156');
    await renderOccupationOgCard(previewUrl, '156');
    assert.match(capturedUrl, /jobs-abc123-zkscio\.vercel\.app/);
    assert.ok(!capturedUrl.includes('mirai-shigoto.com'), `origin must match request: ${capturedUrl}`);
  });
});
