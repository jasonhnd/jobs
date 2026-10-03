import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isValidElement } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

// Bun module mocks survive mock.restore(), so ImageResponse is replaced only in
// an isolated child process (same approach as layout.test.ts).
if (process.env.OG_MAP_GENERIC_TEST_CHILD !== '1') {
  test('map + generic OG renderers in an isolated ImageResponse process', () => {
    const coverageDir = mkdtempSync(join(tmpdir(), 'og-map-generic-'));
    try {
      const result = spawnSync(process.execPath, [
        'test', fileURLToPath(import.meta.url), '--coverage',
        '--coverage-reporter=text', '--coverage-reporter=lcov', `--coverage-dir=${coverageDir}`,
      ], {
        env: { PATH: process.env.PATH, OG_MAP_GENERIC_TEST_CHILD: '1' },
        encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
      });
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0);
      const records = readFileSync(join(coverageDir, 'lcov.info'), 'utf8').split('end_of_record');
      for (const name of ['map', 'generic']) {
        const record = records.find(value => value.includes(`SF:src/lib/og-renderers/${name}.ts\n`));
        assert.ok(record, `${name} must appear in isolated coverage`);
        const found = Number(record.match(/^LF:(\d+)$/m)?.[1]);
        const hit = Number(record.match(/^LH:(\d+)$/m)?.[1]);
        assert.ok(found > 0 && hit / found >= 0.7, `${name} line coverage must be at least 70% (${hit}/${found})`);
      }
    } finally {
      rmSync(coverageDir, { recursive: true, force: true });
    }
  });
} else {
  // @ts-expect-error bun:test is runtime-only; the repo does not install Bun types.
  const { mock } = await import('bun:test');
  type Element = ReactElement<{ children?: ReactNode; style: CSSProperties }>;
  interface Options {
    width: number;
    height: number;
    headers?: HeadersInit;
    fonts: { name: string; weight: number; style: string; data: ArrayBuffer }[];
  }
  const images: { tree: ReactNode; options: Options }[] = [];
  mock.module('@vercel/og', () => ({
    ImageResponse: class extends Response {
      constructor(tree: ReactNode, options: Options) {
        super('fixture-image-response', { headers: options.headers });
        images.push({ tree, options });
      }
    },
  }));
  const { renderMapOgCard } = await import('./map.js');
  const { renderGenericOgCard } = await import('./generic.js');
  const { COLORS, FOOTER_LEFT, FOOTER_RIGHT } = await import('./_frame.js');
  const { RISK_BAND_HEX } = await import('../design-tokens.js');
  const { OCCUPATION_COUNT } = await import('../../site/config.js');

  const fontBytes = new Uint8Array([1, 2, 3]);
  const fontRequests: { weight: string; text: string }[] = [];
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  function stubFetch(): void {
    images.length = 0;
    fontRequests.length = 0;
    globalThis.fetch = async input => {
      const request = new URL(String(input));
      if (request.origin === 'https://fonts.googleapis.com') {
        fontRequests.push({
          weight: request.searchParams.get('family')!,
          text: request.searchParams.get('text')!,
        });
        return new Response("@font-face { src: url(https://fonts.gstatic.com/map-generic-fixture.ttf) format('truetype'); }");
      }
      assert.equal(request.href, 'https://fonts.gstatic.com/map-generic-fixture.ttf', `unexpected fetch: ${request.href}`);
      return new Response(fontBytes);
    };
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

  function assertFonts(): void {
    assert.deepEqual(images[0].options.fonts.map(({ name, weight, style }) => ({ name, weight, style })), [
      { name: 'NotoSerifJP', weight: 600, style: 'normal' },
      { name: 'NotoSansJP', weight: 800, style: 'normal' },
      { name: 'NotoSansJP', weight: 500, style: 'normal' },
    ]);
    for (const font of images[0].options.fonts) assert.deepEqual(new Uint8Array(font.data), fontBytes);
  }

  // Keep this the first test: it observes the uncached font fetches.
  test('renderMapOgCard renders the static 1200x630 map card with the 5-band swatch', async () => {
    stubFetch();
    const response = await renderMapOgCard();

    assert.equal(response.status, 200);
    assert.equal(images.length, 1);
    assert.equal(images[0].options.width, 1200);
    assert.equal(images[0].options.height, 630);
    assert.equal(response.headers.get('Cache-Control'),
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    assertFonts();

    // loadGoogleFont caches by (family, weight, text); the map card has no
    // parameters, so only this first call reaches fetch.
    assert.deepEqual(fontRequests.map(r => r.weight).sort(), [
      'Noto Sans JP:wght@500', 'Noto Sans JP:wght@800', 'Noto Serif JP:wght@600',
    ]);
    for (const { text } of fontRequests) {
      for (const needed of ['職業マップ', 'ヒートマップ', FOOTER_LEFT, FOOTER_RIGHT]) assert.ok(text.includes(needed), needed);
    }

    const all = texts(images[0].tree);
    assert.ok(all.includes('職業マップ'));
    assert.ok(all.includes('AI 影響度 × 就業者数 ヒートマップ'));
    assert.ok(all.includes(`OCCUPATION MAP / 全 ${OCCUPATION_COUNT.SCORED} 職業`));
    assert.ok(all.includes('面積 = 就業者数 ・ 色 = AI 影響(低 → 高)'));
    assert.ok(all.includes(FOOTER_RIGHT));

    const title = elements(images[0].tree).find(node => node.props.style.fontSize === '128px');
    assert.ok(title);
    assert.equal(title.props.style.color, COLORS.ink);
    const swatch = elements(images[0].tree).filter(node =>
      typeof node.props.style.background === 'string' && (RISK_BAND_HEX as readonly string[]).includes(node.props.style.background));
    assert.deepEqual(swatch.map(node => node.props.style.background), [...RISK_BAND_HEX]);
  });

  test('renderGenericOgCard renders the config text and shared footer', async () => {
    stubFetch();
    const config = { eyebrow: 'FIXTURE EYEBROW', title: 'フィクスチャ見出し', subtitle: 'フィクスチャ副題' };
    const response = await renderGenericOgCard(config);

    assert.equal(response.status, 200);
    assert.equal(images.length, 1);
    assert.equal(images[0].options.width, 1200);
    assert.equal(images[0].options.height, 630);
    assertFonts();

    const all = texts(images[0].tree);
    for (const value of [config.eyebrow, config.title, config.subtitle, FOOTER_LEFT, FOOTER_RIGHT]) {
      assert.ok(all.includes(value), `missing ${value}`);
    }
    const title = elements(images[0].tree).find(node => node.props.style.fontSize === '84px');
    assert.ok(title);
    assert.equal(title.props.style.fontFamily, 'NotoSerifJP');
    const subtitle = elements(images[0].tree).find(node => node.props.style.fontSize === '32px');
    assert.ok(subtitle);
    assert.equal(subtitle.props.style.color, COLORS.muted);
  });

  test('renderGenericOgCard includes the config text in every font subset', async () => {
    stubFetch();
    await renderGenericOgCard({ eyebrow: 'EYE-X', title: '題名X', subtitle: '副題X' });

    assert.equal(fontRequests.length, 3);
    for (const { text } of fontRequests) {
      for (const needed of ['EYE-X', '題名X', '副題X', FOOTER_LEFT]) assert.ok(text.includes(needed), needed);
    }
  });

  test('renderGenericOgCard rejects when a font binary request fails', async () => {
    stubFetch();
    globalThis.fetch = async input => String(input).startsWith('https://fonts.googleapis.com')
      ? new Response("@font-face { src: url(https://fonts.gstatic.com/x.ttf) format('truetype'); }")
      : new Response('gone', { status: 500 });
    await assert.rejects(
      renderGenericOgCard({ eyebrow: 'E-fail', title: 'T-fail', subtitle: 'S-fail' }),
      /failed to fetch font binary/,
    );
  });
}
