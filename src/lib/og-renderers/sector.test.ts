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


// Capture the Satori input without rendering a PNG. spyOn is restored after
// every test (unlike Bun module mocks), so other files retain real ImageResponse.
const { spyOn } = await import('bun:test');
import * as og from '@vercel/og';
import { isValidElement } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { COLORS, BADGE_TEXT, SITE_MARK, FOOTER_RIGHT } from './_frame.js';
import { SECTOR_HUE_COLOR } from '../og-helpers.js';

type Element = ReactElement<{ children?: ReactNode; style: CSSProperties }>;
interface Options {
  width: number;
  height: number;
  headers: HeadersInit;
  fonts: { name: string; weight: number; style: string; data: ArrayBuffer }[];
}
const images: { tree: ReactNode; options: Options }[] = [];
const origin = 'https://jobs-tree-zkscio.vercel.app';
const url = new URL(`${origin}/api/og`);
const fontBytes = new Uint8Array([0x00, 0x01, 0x00, 0x00, 1, 2, 3]);
const fontSubsets: string[] = [];
const dataRequests: string[] = [];

function prepare(t: import('node:test').TestContext, data: Record<string, unknown>): void {
  images.length = 0;
  fontSubsets.length = 0;
  dataRequests.length = 0;
  const imageSpy = spyOn(og, 'ImageResponse').mockImplementation(function (tree: ReactNode, options: Options) {
    images.push({ tree, options });
    return new Response('fixture-image-response', { headers: options.headers });
  });
  t.after(() => imageSpy.mockRestore());
  t.mock.method(globalThis, 'fetch', async (input: Request | URL | string) => {
    const request = new URL(String(input));
    if (request.origin === 'https://fonts.googleapis.com') {
      fontSubsets.push(request.searchParams.get('text')!);
      return new Response("@font-face { src: url(https://fonts.gstatic.com/tree-fixture.ttf) format('truetype'); }");
    }
    if (request.href === 'https://fonts.gstatic.com/tree-fixture.ttf') return new Response(fontBytes);
    assert.equal(request.origin, origin, 'data must use the requested preview origin');
    assert.ok(Object.hasOwn(data, request.pathname), `unexpected fetch: ${request.href}`);
    dataRequests.push(request.pathname);
    const value = data[request.pathname];
    return value instanceof Response ? value.clone() : Response.json(value);
  });
}
  function elements(tree: ReactNode): Element[] {
    if (Array.isArray(tree)) return tree.flatMap(elements);
    if (!isValidElement<{ children?: ReactNode; style: CSSProperties }>(tree)) return [];
    assert.equal(typeof tree.type, 'string', 'Satori receives host elements, not unrendered components');
    return [tree, ...elements(tree.props.children)];
  }

  function texts(tree: ReactNode): string[] {
    if (Array.isArray(tree)) return tree.flatMap(texts);
    if (isValidElement<{ children?: ReactNode }>(tree)) return texts(tree.props.children);
    return typeof tree === 'string' || typeof tree === 'number' ? [String(tree)] : [];
  }

  function nodeAtSize(size: string): Element {
    const node = elements(images[0].tree).find(node => node.props.style.fontSize === size);
    assert.ok(node, `missing ${size} text node`);
    return node;
  }

  function common(response: Response, width: number, height: number, accent: string): string[] {
    assert.equal(response.status, 200);
    assert.equal(images.length, 1);
    const { tree, options } = images[0];
    assert.equal(options.width, width);
    assert.equal(options.height, height);
    assert.equal(response.headers.get('Cache-Control'),
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    assert.deepEqual(options.fonts.map(({ name, weight, style }) => ({ name, weight, style })), [
      { name: 'NotoSerifJP', weight: 600, style: 'normal' },
      { name: 'NotoSansJP', weight: 800, style: 'normal' },
      { name: 'NotoSansJP', weight: 500, style: 'normal' },
    ]);
    for (const font of options.fonts) assert.deepEqual(new Uint8Array(font.data), fontBytes);
    const nodes = elements(tree);
    assert.equal(nodes[0].props.style.borderLeft, `16px solid ${accent}`);
    assert.equal(nodes[0].props.style.backgroundColor, COLORS.bg);
    assert.equal(nodes[0].props.style.width, '100%');
    assert.equal(nodes[0].props.style.height, '100%');
    const copy = texts(tree);
    assert.equal(copy[0], BADGE_TEXT);
    assert.ok(copy.includes(SITE_MARK));
    assert.equal(copy.at(-1), FOOTER_RIGHT);
    return copy;
  }

  for (const hue of ['safe', 'mid', 'warm'] as const) {
    test(`sector ${hue} preserves hue, formatted stats and only three sample titles`, async t => {
      const sector = { id: 'fixture', ja: `Sector fixture ${hue}`, hue, occupation_count: 12,
        mean_ai_risk: 3.9666666666666663, total_workforce: 1_500_000,
        sample_titles_ja: ['First', 'Second', 'Third', 'Excluded'] };
      prepare(t, { '/data.sectors.json': { sectors: [sector] } });
      const copy = common(await renderSectorOgCard(url, 'fixture'), 1200, 630, SECTOR_HUE_COLOR[hue]);
      assert.deepEqual(dataRequests, ['/data.sectors.json']);
      assert.equal(nodeAtSize('104px').props.children, sector.ja);
      assert.ok(copy.includes('First　・　Second　・　Third'));
      assert.ok(copy.includes('12 職業'));
      assert.ok(copy.includes('平均 AI 影響 4.0 / 10'));
      assert.ok(copy.includes('就業者 計 1,500,000 人'));
      assert.ok(!copy.join(' ').includes('Excluded'));
      assert.ok(!copy.join(' ').includes(String(sector.mean_ai_risk)));
      assert.equal(fontSubsets.length, 3);
      assert.ok(fontSubsets.every(subset => subset.includes('4.0 / 10') && !subset.includes('Excluded')));
    });
  }

  test('sector missing or empty samples omit the sample row and zero stats remain visible', async t => {
    for (const samples of [undefined, []]) {
      prepare(t, { '/data.sectors.json': { sectors: [{
        id: 'fixture', ja: 'Sector fixture no samples', hue: 'safe', occupation_count: 0,
        mean_ai_risk: 0, total_workforce: 0, sample_titles_ja: samples,
      }] } });
      const copy = common(await renderSectorOgCard(url, 'fixture'), 1200, 630, SECTOR_HUE_COLOR.safe);
      assert.ok(copy.includes('0 職業'));
      assert.ok(copy.includes('平均 AI 影響 0.0 / 10'));
      assert.ok(copy.includes('就業者 計 0 人'));
      assert.equal(elements(images[0].tree).filter(node => node.props.style.fontSize === '24px').length, 1,
        'only the site mark has 24px text when there are no samples');
    }
  });

