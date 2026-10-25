/**
 * model.test.ts — per-run model share card.
 *
 * Success renders the four signed lines and nothing else from the run.
 * Unknown, malformed, and bare slugs render the home card. Upstream
 * failures and inconsistent run identity stay retriable errors.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { afterEach, describe, test } from 'node:test';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';

import { PAGE_CARDS } from '../../views/og-cards.js';
import { BADGE_TEXT, FOOTER_LEFT, FOOTER_RIGHT, SITE_MARK } from './_frame.js';
import { renderModelOgCard } from './model.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const EYEBROW = 'AIモデル比較 · 未来の仕事';
const OPUS_SLUG = 'opus-5@2026-07-26';
const GROK_SLUG = 'grok-4.5@2026-09-08';
const HISTOGRAM_SENTINEL = 12345;

function histogram(): { from: number; to: number; count: number }[] {
  return Array.from({ length: 20 }, (_, i) => ({
    from: i / 2,
    to: (i + 1) / 2,
    count: i === 3 ? HISTOGRAM_SENTINEL : 0,
  }));
}

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: OPUS_SLUG,
    model: 'claude-opus-5',
    modelDisplay: 'Stored Display',
    provider: 'anthropic',
    in_panel: true,
    date: '2026-07-26',
    covered_count: 552,
    prompt_version: 'AIOIS-10 v1.0',
    distribution: {
      mean_transformation: 5,
      median_transformation: 5,
      bands: {
        low: { count: 0, pct: 0 },
        mid: { count: 1, pct: 100 },
        high: { count: 0, pct: 0 },
      },
      histogram: histogram(),
    },
    highest: [],
    lowest: [],
    drift: { baseline: true, note_id: 'first_aiois_batch' },
    nav: { prev: null, next: null },
    ...overrides,
  };
}

function projection(models: Record<string, unknown>): Record<string, unknown> {
  return { generated_at: '2026-10-26T00:00:00.000Z', models };
}

const BOTH_RUNS = projection({
  [OPUS_SLUG]: record(),
  [GROK_SLUG]: record({
    slug: GROK_SLUG,
    model: 'grok-4.5',
    modelDisplay: 'Stored Grok',
    provider: 'xai',
    date: '2026-09-08',
    covered_count: 556,
  }),
});

const { spyOn } = await import('bun:test');
import * as og from '@vercel/og';

const images: { tree: ReactNode }[] = [];
const fontBytes = new Uint8Array([0x00, 0x01, 0x00, 0x00, 1, 2, 3]);

function texts(tree: ReactNode): string[] {
  if (Array.isArray(tree)) return tree.flatMap(texts);
  if (isValidElement<{ children?: ReactNode }>(tree)) return texts(tree.props.children);
  return typeof tree === 'string' || typeof tree === 'number' ? [String(tree)] : [];
}

function homeTexts(): string[] {
  return [
    BADGE_TEXT,
    SITE_MARK,
    PAGE_CARDS.home.eyebrow,
    PAGE_CARDS.home.title,
    PAGE_CARDS.home.subtitle,
    FOOTER_LEFT,
    FOOTER_RIGHT,
  ];
}

function installImageSpy(t: import('node:test').TestContext): void {
  images.length = 0;
  const imageSpy = spyOn(og, 'ImageResponse').mockImplementation(function (tree: ReactNode) {
    images.push({ tree });
    return new Response('fixture-image-response', {
      headers: { 'Content-Type': 'image/png' },
    });
  });
  t.after(() => imageSpy.mockRestore());
}

function installFetch(
  payload: unknown,
  onRequest?: (url: URL) => void,
): void {
  globalThis.fetch = async (input: Request | URL | string) => {
    const request = new URL(String(input));
    onRequest?.(request);
    if (request.hostname === 'fonts.googleapis.com') {
      return new Response("@font-face { src: url(https://fonts.gstatic.com/model-fixture.ttf) format('truetype'); }");
    }
    if (request.hostname === 'fonts.gstatic.com') return new Response(fontBytes);
    if (payload instanceof Response) return payload.clone();
    return Response.json(payload);
  };
}

describe('renderModelOgCard — signed lines', () => {
  test('the renderer source adds no Japanese beyond the signed lines', () => {
    let source = readFileSync(new URL('./model.ts', import.meta.url), 'utf8');
    for (const phrase of [EYEBROW, '採点日 ', ' · 対象 ', '職業']) {
      source = source.replaceAll(phrase, '');
    }
    assert.doesNotMatch(source, /[ぁ-んァ-ン一-龯・]/);
  });

  for (const fixture of [
    {
      slug: OPUS_SLUG,
      title: 'Claude Opus 5',
      provider: 'Anthropic',
      detail: '採点日 2026年7月26日 · 対象 552職業',
    },
    {
      slug: GROK_SLUG,
      title: 'Grok 4.5',
      provider: 'xAI',
      detail: '採点日 2026年9月8日 · 対象 556職業',
    },
  ]) {
    test(`${fixture.slug} renders the four signed lines and not the histogram`, async (t) => {
      installImageSpy(t);
      const requests: string[] = [];
      installFetch(BOTH_RUNS, (url) => requests.push(url.href));
      const page = new URL('https://jobs-tree-zkscio.vercel.app/api/og');
      const response = await renderModelOgCard(page, fixture.slug);
      assert.equal(response.status, 200);
      assert.equal(images.length, 1);
      assert.deepEqual(texts(images[0]!.tree), [
        BADGE_TEXT,
        SITE_MARK,
        EYEBROW,
        fixture.title,
        fixture.provider,
        fixture.detail,
        FOOTER_LEFT,
        FOOTER_RIGHT,
      ]);
      assert.equal(texts(images[0]!.tree).includes('Stored Display'), false);
      assert.equal(texts(images[0]!.tree).join('\n').includes(String(HISTOGRAM_SENTINEL)), false);
      assert.deepEqual(requests.filter((href) => href.includes('/data.models_by_model.json')), [
        'https://jobs-tree-zkscio.vercel.app/data.models_by_model.json',
      ]);
    });
  }
});

describe('renderModelOgCard — home fallback', () => {
  test('bare, malformed, and path-like slugs render the home card without fetching', async (t) => {
    installImageSpy(t);
    const requests: string[] = [];
    installFetch(BOTH_RUNS, (url) => requests.push(url.href));
    const page = new URL('https://pre.mirai-shigoto.com/api/og');
    for (const slug of ['opus-5', 'opus-5@2026-7-26', '../etc/passwd', 'opus-5@2026-07-26/../../etc', '']) {
      images.length = 0;
      requests.length = 0;
      const response = await renderModelOgCard(page, slug);
      assert.equal(response.status, 200, slug);
      assert.deepEqual(texts(images[0]!.tree), homeTexts(), slug);
      assert.equal(requests.some((href) => href.includes('/data.models_by_model.json')), false, slug);
    }
  });

  test('unknown and non-canonical slugs render the home card after a successful fetch', async (t) => {
    installImageSpy(t);
    const requests: string[] = [];
    installFetch(BOTH_RUNS, (url) => requests.push(url.href));
    const page = new URL('https://pre.mirai-shigoto.com/api/og');
    for (const slug of ['opus-5@2026-01-01', 'claude-opus-5@2026-07-26', 'nope@2026-07-26']) {
      images.length = 0;
      requests.length = 0;
      const response = await renderModelOgCard(page, slug);
      assert.equal(response.status, 200, slug);
      assert.deepEqual(texts(images[0]!.tree), homeTexts(), slug);
      assert.equal(texts(images[0]!.tree).includes(EYEBROW), false, slug);
      assert.deepEqual(requests.filter((href) => href.includes('/data.models_by_model.json')), [
        'https://pre.mirai-shigoto.com/data.models_by_model.json',
      ], slug);
    }
  });

  test('prototype keys are not a run even when the shape is dated', async (t) => {
    installImageSpy(t);
    installFetch(BOTH_RUNS);
    const page = new URL('https://pre.mirai-shigoto.com/api/og');
    for (const slug of ['constructor@2026-01-01', 'toString@2026-01-01', '__proto__@2026-01-01']) {
      images.length = 0;
      const response = await renderModelOgCard(page, slug);
      assert.equal(response.status, 200, slug);
      assert.deepEqual(texts(images[0]!.tree), homeTexts(), slug);
    }
  });
});

describe('renderModelOgCard — retriable upstream errors', () => {
  test('HTTP failures stay 502 and do not render the home card', async (t) => {
    installImageSpy(t);
    const page = new URL('https://pre.mirai-shigoto.com/api/og');
    for (const status of [404, 500]) {
      images.length = 0;
      installFetch(new Response('upstream broken', { status }));
      const response = await renderModelOgCard(page, OPUS_SLUG);
      assert.equal(response.status, 502);
      assert.equal(await response.text(), 'Upstream models fetch failed');
      assert.equal(response.headers.get('cache-control'), null);
      assert.equal(images.length, 0);
    }
  });

  test('invalid JSON and schema mismatches stay 502 without echoing the slug', async (t) => {
    installImageSpy(t);
    const log = t.mock.method(console, 'error', () => {});
    const page = new URL('https://pre.mirai-shigoto.com/api/og');
    const slug = 'evil-marker@2026-07-26';
    for (const body of ['not-json', JSON.stringify({ generated_at: 'x' }), JSON.stringify(projection({
      [slug]: record({ slug, model: 'evil-marker', covered_count: 1, histogram: [] }),
    }))]) {
      images.length = 0;
      installFetch(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }));
      const response = await renderModelOgCard(page, slug);
      assert.equal(response.status, 502);
      const text = await response.text();
      assert.equal(text, 'Upstream models data invalid');
      assert.equal(text.includes(slug), false);
      assert.equal(text.includes('evil-marker'), false);
      assert.equal(images.length, 0);
    }
    assert.ok(log.mock.calls.length >= 1);
  });

  test('a thrown upstream fetch stays thrown', async (t) => {
    installImageSpy(t);
    globalThis.fetch = async () => {
      throw new Error('network down');
    };
    await assert.rejects(renderModelOgCard(new URL('https://pre.mirai-shigoto.com/api/og'), OPUS_SLUG), /network down/);
    assert.equal(images.length, 0);
  });

  test('an untrusted host is fetched from production, not the request host', async () => {
    let captured = '';
    globalThis.fetch = async (input: Request | URL | string) => {
      captured = String(input);
      return new Response('nope', { status: 500 });
    };
    const response = await renderModelOgCard(new URL('https://evil.example/api/og'), OPUS_SLUG);
    assert.equal(response.status, 502);
    assert.equal(captured, 'https://mirai-shigoto.com/data.models_by_model.json');
  });
});

describe('renderModelOgCard — model/date/slug consistency', () => {
  test('inner slug, model, date, and duplicate runs stay 502, not the home card', async (t) => {
    installImageSpy(t);
    const log = t.mock.method(console, 'error', () => {});
    const page = new URL('https://jobs-abc123-zkscio.vercel.app/api/og');
    const cases: Record<string, unknown>[] = [
      projection({ [OPUS_SLUG]: record({ slug: 'other@2026-07-26' }) }),
      projection({ [OPUS_SLUG]: record({ model: 'gpt-6-sol' }) }),
      projection({ [OPUS_SLUG]: record({ date: '2026-01-01' }) }),
      projection({
        [OPUS_SLUG]: record(),
        'other@2026-07-26': record({ slug: 'other@2026-07-26', model: 'claude-opus-5', date: '2026-07-26' }),
      }),
      projection({ 'claude-opus-5@2026-07-26': record({ slug: 'claude-opus-5@2026-07-26' }) }),
    ];
    for (const body of cases) {
      images.length = 0;
      let captured = '';
      installFetch(body, (url) => { captured = url.href; });
      const slug = Object.keys((body.models ?? {}) as Record<string, unknown>)[0]!;
      const response = await renderModelOgCard(page, slug);
      assert.equal(response.status, 502, slug);
      assert.equal(await response.text(), 'Upstream models data invalid');
      assert.equal(images.length, 0, slug);
      assert.equal(captured, 'https://jobs-abc123-zkscio.vercel.app/data.models_by_model.json');
    }
    assert.ok(log.mock.calls.length >= 1);
  });
});
