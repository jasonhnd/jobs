/**
 * sector.test.ts — pin the input-validation + upstream-error contract
 * for `renderSectorOgCard`.
 *
 * Scope: only the pre-render code path (URL param shape, fetch result,
 * zod schema validation, sector-not-found lookup). The actual
 * `ImageResponse` render branch is NOT tested here — `loadGoogleFont`
 * makes a real Google Fonts fetch which is expensive + flaky from
 * tests, and the JSX/createElement tree itself is structural code best
 * validated by visual / deploy-time inspection.
 *
 * Pre-render contract (this file's surface):
 *   - 400 when `sectorId` fails `/^[a-z_]+$/`
 *   - 502 when `fetch('/data.sectors.json')` returns non-OK
 *   - 502 when the upstream JSON does not match `SectorsProjectionSchema`
 *   - 404 when the sector id is well-formed but not present in the
 *     validated projection
 *
 * The success path falls through to `loadGoogleFont` + `ImageResponse`
 * which we don't exercise here.
 */

import { describe, test, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderSectorOgCard } from './sector.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const VALID_SECTORS_JSON = {
  sectors: [
    {
      id: 'iryo',
      ja: '医療',
      hue: 'mid',
      occupation_count: 30,
      mean_ai_risk: 4.5,
      total_workforce: 1_500_000,
      sample_titles_ja: ['看護師', '医師', '薬剤師'],
    },
    {
      id: 'service',
      ja: 'サービス',
      hue: 'warm',
      occupation_count: 50,
      mean_ai_risk: 6.2,
      total_workforce: 3_000_000,
    },
  ],
};

describe('renderSectorOgCard — input validation (400 path)', () => {
  test('rejects uppercase letters in sectorId', async () => {
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'IRYO');
    assert.equal(res.status, 400);
    assert.match(await res.text(), /invalid sector id/);
  });

  test('rejects digits in sectorId', async () => {
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'iryo2');
    assert.equal(res.status, 400);
  });

  test('rejects path-traversal attempts', async () => {
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, '../etc/passwd');
    assert.equal(res.status, 400);
  });

  test('rejects empty string', async () => {
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, '');
    assert.equal(res.status, 400);
  });

  test('accepts lowercase + underscore (regex matches; reaches fetch step)', async () => {
    // Mock fetch to return non-OK so we can assert the function reached
    // the fetch step (i.e. the regex check passed) without needing a
    // valid upstream response.
    globalThis.fetch = async () => new Response('upstream broken', { status: 500 });
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'long_sector_name');
    // Not 400 → regex passed and we proceeded to the fetch.
    assert.notEqual(res.status, 400);
    assert.equal(res.status, 502);
  });
});

describe('renderSectorOgCard — upstream-error paths', () => {
  test('502 when upstream returns 500', async () => {
    globalThis.fetch = async () => new Response('upstream broken', { status: 500 });
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'iryo');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream sectors fetch failed');
  });

  test('502 when upstream returns 404', async () => {
    // Vercel CDN sometimes 404s a missing data.sectors.json. Still a
    // 502 from our side (we're an aggregator).
    globalThis.fetch = async () => new Response('', { status: 404 });
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'iryo');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream sectors fetch failed');
  });

  test('502 when upstream JSON shape is wrong (missing sectors array)', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ wrong: 'shape' }), { status: 200 });
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'iryo');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream sectors data invalid');
  });

  test('502 when individual sector record violates schema', async () => {
    // `hue` must be one of "safe" | "mid" | "warm". An invalid value
    // should fail the schema parse cleanly without leaking field names.
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          sectors: [
            {
              id: 'iryo',
              ja: '医療',
              hue: 'BAD_HUE',
              occupation_count: 30,
              mean_ai_risk: 4.5,
              total_workforce: 1_500_000,
            },
          ],
        }),
        { status: 200 },
      );
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'iryo');
    assert.equal(res.status, 502);
    assert.equal(await res.text(), 'Upstream sectors data invalid');
  });
});

describe('renderSectorOgCard — sector lookup (404 path)', () => {
  test('404 when sectorId is well-formed but not in the projection', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(VALID_SECTORS_JSON), { status: 200 });
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'unknown_sector');
    assert.equal(res.status, 404);
    assert.equal(await res.text(), 'Sector not found');
  });

  test('404 does NOT leak the input sectorId in the response body', async () => {
    // Audit's #4.4: error responses must not echo unvalidated user
    // input back to social-card scrapers. The 404 body is fixed text.
    globalThis.fetch = async () =>
      new Response(JSON.stringify(VALID_SECTORS_JSON), { status: 200 });
    const url = new URL('https://example.com/');
    const res = await renderSectorOgCard(url, 'evil_marker_xyz');
    const body = await res.text();
    assert.equal(res.status, 404);
    assert.ok(!body.includes('evil_marker_xyz'), `body should NOT echo input: ${body}`);
  });
});

describe('renderSectorOgCard — fetch URL construction', () => {
  test('uses the request URL origin to build the data.sectors.json fetch', async () => {
    let capturedUrl = '';
    globalThis.fetch = async (input: Request | string | URL) => {
      capturedUrl = typeof input === 'string' ? input : input.toString();
      return new Response('upstream broken', { status: 500 });
    };
    const url = new URL('https://pre.mirai-shigoto.com/api/og?sector=iryo');
    await renderSectorOgCard(url, 'iryo');
    assert.equal(capturedUrl, 'https://pre.mirai-shigoto.com/data.sectors.json');
  });
});
