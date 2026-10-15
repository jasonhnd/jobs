import { describe, test, afterEach, before, after } from 'node:test';
import { strict as assert } from 'node:assert';

import { occupationNameFontSize, renderOccupationOgCard, statLabels } from './occupation.js';

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
  const origError = console.error;
  before(() => {
    // Schema-mismatch path logs to stderr for Vercel observability. Tests
    // assert the HTTP body; mute the expected log so CI does not look failed.
    console.error = () => {};
  });
  after(() => {
    console.error = origError;
  });

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

  test('502 response body never echoes the malformed payload back to the caller', async () => {
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

describe('occupationNameFontSize — every name fits in three lines', () => {
  // The name column is 700px wide: 9 full-width glyphs per line at 72px.
  for (const [length, size] of [[0, 72], [9, 72], [26, 72], [27, 72], [28, 60], [30, 60], [33, 60], [34, 52]] as const) {
    test(`${length} characters → ${size}px`, () => {
      assert.equal(occupationNameFontSize('字'.repeat(length)), size);
    });
  }
  test('counts characters, not UTF-16 code units', () => {
    assert.equal(occupationNameFontSize('𠮷'.repeat(27)), 72);
  });
});

describe('statLabels — null stats render an em-dash, not 0', () => {
  test('present values render with their unit', () => {
    const { workersLabel, salaryLabel } = statLabels(123456, 540);
    assert.equal(workersLabel, '就業者 123,456 人');
    assert.equal(salaryLabel, '平均年収 540 万円');
  });

  test('null salary renders 平均年収 — (NOT 平均年収 0 万円)', () => {
    // The 12 nullsalary occupations (警察官・裁判官 etc.) must not claim 0 income.
    const { salaryLabel } = statLabels(123456, null);
    assert.equal(salaryLabel, '平均年収 —');
    assert.ok(!salaryLabel.includes('0 万円'), `must not assert zero income: ${salaryLabel}`);
  });

  test('null workers renders 就業者 — (NOT 就業者 0 人)', () => {
    const { workersLabel } = statLabels(null, 540);
    assert.equal(workersLabel, '就業者 —');
    assert.ok(!workersLabel.includes('0 人'), `must not assert zero workers: ${workersLabel}`);
  });
});


// Capture the Satori input without rendering a PNG. spyOn is restored after
// every test (unlike Bun module mocks), so other files retain real ImageResponse.
const { spyOn } = await import('bun:test');
import * as og from '@vercel/og';
import { isValidElement } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { COLORS, BADGE_TEXT, SITE_MARK, FOOTER_RIGHT } from './_frame.js';
import { RISK_COLORS } from '../og-helpers.js';

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

  for (const [score, label] of [[3.9666666666666663, '4'], [4.25, '4.2'], [0, '0'], [10, '10'], [null, '—']] as const) {
    test(`occupation score ${score} keeps a bounded label and matching layout`, async t => {
      const title = `Occupation fixture ${label}`;
      prepare(t, { '/data.detail/0156.json': {
        id: 156, title: { ja: title }, ai_risk: { score }, stats: { workers: 123456, salary_man_yen: 540 },
      } });
      const color = score === null ? '#8a7a6a' : RISK_COLORS[Math.round(score)];
      const copy = common(await renderOccupationOgCard(url, '156'), 1200, 630, color);
      assert.deepEqual(dataRequests, ['/data.detail/0156.json']);
      assert.equal(nodeAtSize('190px').props.children, label);
      assert.equal(nodeAtSize('72px').props.children, title);
      const badge = elements(images[0].tree).find(node => node.props.style.width === '300px')!;
      assert.equal(badge.props.style.height, '300px');
      assert.equal(badge.props.style.flexShrink, 0);
      assert.equal(badge.props.style.border, `4px solid ${color}`);
      const fills = elements(images[0].tree).filter(node => node.props.style.height === '100%' && node.props.style.backgroundColor === color);
      assert.equal(fills.length, score === null ? 0 : 1, 'missing score omits the mini scale');
      if (score !== null) assert.equal(fills[0].props.style.width, `${(score / 10) * 100}%`);
      assert.ok(copy.includes('就業者 123,456 人'));
      assert.ok(copy.includes('平均年収 540 万円'));
      assert.equal(fontSubsets.length, 3);
      assert.ok(fontSubsets.every(subset => subset.includes(`${label} / 10`) && subset.includes(title)));
      if (score === 3.9666666666666663) {
        assert.ok(!copy.join(' ').includes(String(score)), 'raw mean cannot spill into the score badge');
        assert.ok(fontSubsets.every(subset => !subset.includes(String(score))));
      }
    });
  }

  // Audit 2026-10-07 (#861): the 30-character id 471 name wrapped to 4 lines
  // at 72px and pushed the scale into the footer rule.
  test('a name longer than three 72px lines renders at a smaller size', async t => {
    const title = 'M&Aマネージャー、M&Aコンサルタント/M&Aアドバイザー';
    prepare(t, { '/data.detail/0471.json': { id: 471, title: { ja: title }, ai_risk: { score: 4.8 } } });
    await renderOccupationOgCard(url, '471');
    assert.equal(nodeAtSize('60px').props.children, title);
    assert.ok(!elements(images[0].tree).some(node => node.props.style.fontSize === '72px'));
  });

  test('occupation missing fields keep empty title and missing-stat labels; zero stats stay zero', async t => {
    for (const stats of [undefined, { workers: null, salary_man_yen: null }, { workers: 0, salary_man_yen: 0 }]) {
      prepare(t, { '/data.detail/0001.json': { id: 1, stats } });
      const copy = common(await renderOccupationOgCard(url, '1'), 1200, 630, '#8a7a6a');
      assert.equal(nodeAtSize('190px').props.children, '—');
      assert.equal(nodeAtSize('72px').props.children, '');
      assert.ok(copy.includes(stats?.workers === 0 ? '就業者 0 人' : '就業者 —'));
      assert.ok(copy.includes(stats?.salary_man_yen === 0 ? '平均年収 0 万円' : '平均年収 —'));
    }
  });

