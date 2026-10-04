import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { GAP } from '../../site/worktype-copy.js';
import { classifyShindanGap } from '../../site/shindan-result-state.js';
import { renderWorktypeOgCard, buildWorktypeContextCopy, buildWorktypeFeatureLabel } from './worktype.js';

test('worktype OG context uses recomputed job gap copy', () => {
  const gap = classifyShindanGap('RPK', 'CDB').kind;
  const context = buildWorktypeContextCopy(gap, GAP[gap].label, {
    title: 'データ職業',
    worktypeCode: 'CDB',
    worktypeName: 'ものづくり設計家',
    score: 8.1,
  });

  assert.equal(gap, 'hidden_risk');
  assert.equal(buildWorktypeFeatureLabel('RPK'), 'AI働き方診断 / 段取りの世話役');
  assert.match(context, /データ職業 \/ ものづくり設計家/);
  assert.match(context, /働き方を更新する余地があります/);
});



import { FAMILIES, FAMILY_CODES, LABELS, SHARE, VARIANTS, VARIANT_IDS_BY_FAMILY } from '../../site/worktype-copy.js';
import { WORKTYPE_CARDS } from '../../views/og-cards.js';


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
const fontBytes = new Uint8Array([1, 2, 3]);
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

  const projection = {
    schema_version: '1.0',
    families: Object.fromEntries(FAMILY_CODES.map(code => [code, { familyId: code, count: 1, pct: 12.5 }])),
    variants: Object.fromEntries(FAMILY_CODES.map(code => [code, {}])),
    occupations: { '156': { code: 'CDB', familyId: 'CDB', exposure: 2, rarityPct: 12.5 } },
  };
  const family = 'RPK';
  const variant = 'mediator';

  for (const shape of ['wide', 'square'] as const) {
    test(`worktype ${shape} identity card retains the character and copy hierarchy`, async t => {
      prepare(t, { '/data.worktypes.json': projection });
      const visual = WORKTYPE_CARDS[family];
      const copy = common(await renderWorktypeOgCard(url, { family, variant, shape }),
        shape === 'square' ? 1080 : 1200, shape === 'square' ? 1080 : 630, visual.accent);
      const character = elements(images[0].tree).find(node => node.props.children === visual.character)!;
      assert.equal(character.props.style.fontSize, shape === 'square' ? '190px' : '152px');
      const block = elements(images[0].tree).find(node => node.props.style.width === (shape === 'square' ? '330px' : '270px'))!;
      assert.equal(block.props.style.height, block.props.style.width);
      assert.equal(block.props.style.flexShrink, 0);
      assert.equal(block.props.style.border, `6px solid ${visual.accent}`);
      assert.equal(block.props.style.background, 'linear-gradient(135deg, rgba(178, 109, 61, 0.18), #FFFFFF)');
      assert.equal(nodeAtSize(shape === 'square' ? '82px' : '74px').props.children, VARIANTS[family][variant].name);
      assert.ok(copy.includes(VARIANTS[family][variant].catch));
      assert.ok(copy.includes(`${LABELS.featureName} / ${FAMILIES[family].name}`));
      assert.ok(copy.includes(SHARE.challengeHooks[0]));
      assert.ok(!copy.includes('/ 10'));
      assert.ok(!elements(images[0].tree).some(node => node.props.style.borderLeft === `8px solid ${visual.accent}`));
      assert.deepEqual(dataRequests, ['/data.worktypes.json']);
    });

    for (const [score, label] of [[3.9666666666666663, '4'], [4.25, '4.2'], [0, '0'], [10, '10']] as const) {
      test(`worktype ${shape} score ${score} replaces character with a bounded badge and recomputed gap`, async t => {
        const title = `Worktype fixture ${shape} ${label}`;
        prepare(t, { '/data.worktypes.json': projection, '/data.detail/0156.json': {
          id: 156, title: { ja: title }, ai_risk: { score },
        } });
        const color = RISK_COLORS[Math.round(score)];
        const copy = common(await renderWorktypeOgCard(url, { family, variant, shape, job: '0156', gap: 'aligned' }),
          shape === 'square' ? 1080 : 1200, shape === 'square' ? 1080 : 630, color);
        assert.equal(nodeAtSize(shape === 'square' ? '160px' : '140px').props.children, label);
        assert.equal(nodeAtSize(shape === 'square' ? '82px' : '74px').props.children, title);
        const size = shape === 'square' ? '280px' : '270px';
        const badge = elements(images[0].tree).find(node => node.props.style.width === size)!;
        assert.equal(badge.props.style.height, size);
        assert.equal(badge.props.style.flexShrink, 0);
        assert.equal(badge.props.style.border, `4px solid ${color}`);
        assert.ok(copy.includes('/ 10'));
        assert.ok(copy.includes(VARIANTS[family][variant].name));
        assert.ok(copy.includes(SHARE.challengeHookWithJob));
        const context = copy.find(text => text.startsWith(`${LABELS.gap}:`))!;
        assert.ok(context.includes(GAP.hidden_risk.label), 'projection-derived gap overrides supplied aligned gap');
        assert.ok(!context.includes(GAP.aligned.label));
        assert.ok(context.includes(FAMILIES.CDB.name));
        assert.ok(!copy.includes(WORKTYPE_CARDS[family].character));
        assert.deepEqual(dataRequests, ['/data.worktypes.json', '/data.detail/0156.json']);
        assert.equal(fontSubsets.length, 3);
        assert.ok(fontSubsets.every(subset => subset.includes(`${label} / 10`)));
        if (score === 3.9666666666666663) {
          assert.ok(!copy.join(' ').includes(String(score)));
          assert.ok(fontSubsets.every(subset => !subset.includes(String(score))));
        }
      });
    }
  }

  test('worktype null score keeps identity artwork but includes valid job context', async t => {
    prepare(t, { '/data.worktypes.json': projection, '/data.detail/0156.json': {
      id: 156, title: { ja: 'Worktype null-score fixture' }, ai_risk: { score: null },
    } });
    const copy = common(await renderWorktypeOgCard(url, { family, variant, shape: 'wide', job: '156' }),
      1200, 630, WORKTYPE_CARDS[family].accent);
    assert.ok(copy.includes(WORKTYPE_CARDS[family].character));
    assert.ok(copy.some(text => text.includes('Worktype null-score fixture') && text.includes(GAP.hidden_risk.label)));
    assert.ok(!copy.includes('/ 10'));
    assert.equal(nodeAtSize('74px').props.children, VARIANTS[family][variant].name);
  });

  const jobFallbacks = [
    { name: 'invalid id', job: '../156', detail: { id: 156 }, projection },
    { name: 'upstream 404', job: '156', detail: new Response('', { status: 404 }), projection },
    { name: 'invalid detail', job: '156', detail: { id: 'invalid' }, projection },
    { name: 'missing title', job: '156', detail: { id: 156 }, projection },
    { name: 'missing assignment', job: '156', detail: { id: 156, title: { ja: 'Unassigned fixture' } },
      projection: { ...projection, occupations: {} } },
  ];
  for (const fixture of jobFallbacks) {
    test(`worktype ${fixture.name} degrades to identity without trusting supplied gap`, async t => {
      prepare(t, { '/data.worktypes.json': fixture.projection, '/data.detail/0156.json': fixture.detail });
      const copy = common(await renderWorktypeOgCard(url, { family, variant, shape: 'wide', job: fixture.job, gap: 'hidden_risk' }),
        1200, 630, WORKTYPE_CARDS[family].accent);
      assert.ok(copy.includes(WORKTYPE_CARDS[family].character));
      assert.ok(!copy.some(text => text.startsWith(`${LABELS.gap}:`)));
      assert.ok(!copy.includes('/ 10'));
      assert.equal(dataRequests.length, fixture.name === 'invalid id' ? 1 : 2);
    });
  }

  test('worktype cross-family variant falls back to the selected family default', async t => {
    prepare(t, { '/data.worktypes.json': projection });
    const copy = common(await renderWorktypeOgCard(url, { family, variant: 'hacker', shape: 'wide' }),
      1200, 630, WORKTYPE_CARDS[family].accent);
    assert.ok(copy.includes(VARIANTS[family][VARIANT_IDS_BY_FAMILY[family][0]].name));
    assert.ok(!copy.includes(VARIANTS.CDK.hacker.name));
  });

  for (const [fixture, body] of [
    [new Response('', { status: 500 }), 'Upstream worktypes fetch failed'],
    [{ schema_version: 'invalid' }, 'Upstream worktypes data invalid'],
  ] as const) {
    test(`worktype failure returns ${body} before fonts or image rendering`, async t => {
      prepare(t, { '/data.worktypes.json': fixture });
      t.mock.method(console, 'error', () => {});
      const response = await renderWorktypeOgCard(url, { family, variant, shape: 'wide' });
      assert.equal(response.status, 502);
      assert.equal(await response.text(), body);
      assert.equal(images.length, 0);
      assert.equal(fontSubsets.length, 0);
      assert.deepEqual(dataRequests, ['/data.worktypes.json']);
    });
  }

  test('context formatter covers empty, gap-only and job-only input without inventing copy', () => {
    assert.equal(buildWorktypeContextCopy(undefined, '', null), '');
    assert.equal(buildWorktypeContextCopy('aligned', GAP.aligned.label, null), `${LABELS.gap}: ${GAP.aligned.label}`);
    assert.equal(buildWorktypeContextCopy(undefined, '', { title: 'Fixture job', worktypeCode: 'CDB', score: null }),
      `${LABELS.gap}: Fixture job`);
  });