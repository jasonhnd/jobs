import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isValidElement } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

// Bun module mocks survive mock.restore(). Only the isolated child replaces
// ImageResponse; other tests in the full suite retain the real OG module.
if (process.env.OG_LAYOUT_TEST_CHILD !== '1') {
  test('OG layout contracts in an isolated ImageResponse process', () => {
    const suppliedDir = process.env.OG_LAYOUT_COVERAGE_DIR;
    const coverageDir = suppliedDir ?? mkdtempSync(join(tmpdir(), 'og-layout-'));
    try {
      const result = spawnSync(process.execPath, [
        'test', fileURLToPath(import.meta.url), '--coverage',
        '--coverage-reporter=text', '--coverage-reporter=lcov', `--coverage-dir=${coverageDir}`,
      ], {
        env: { PATH: process.env.PATH, OG_LAYOUT_TEST_CHILD: '1' },
        encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
      });
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      assert.equal(result.error, undefined);
      assert.equal(result.status, 0);
      // The parent's coverage cannot see child execution. Check the child's
      // real renderer coverage so a stubbed renderer cannot masquerade as green.
      const records = readFileSync(join(coverageDir, 'lcov.info'), 'utf8').split('end_of_record');
      for (const name of ['_frame', 'worktype', 'occupation', 'sector']) {
        const record = records.find(value => value.includes(`SF:src/lib/og-renderers/${name}.ts\n`));
        assert.ok(record, `${name} must appear in isolated coverage`);
        const found = Number(record.match(/^LF:(\d+)$/m)?.[1]);
        const hit = Number(record.match(/^LH:(\d+)$/m)?.[1]);
        assert.ok(found > 0 && hit / found >= 0.7, `${name} line coverage must be at least 70% (${hit}/${found})`);
      }
    } finally {
      if (!suppliedDir) rmSync(coverageDir, { recursive: true, force: true });
    }
  });
} else {
  // @ts-expect-error bun:test is runtime-only; the repo does not install Bun types.
  const { mock } = await import('bun:test');
  type Element = ReactElement<{ children?: ReactNode; style: CSSProperties }>;
  interface Options {
    width: number;
    height: number;
    headers: HeadersInit;
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
  const { renderOccupationOgCard } = await import('./occupation.js');
  const { renderSectorOgCard } = await import('./sector.js');
  const { renderWorktypeOgCard, buildWorktypeContextCopy } = await import('./worktype.js');
  const { COLORS, BADGE_TEXT, SITE_MARK, FOOTER_RIGHT } = await import('./_frame.js');
  const { RISK_COLORS, SECTOR_HUE_COLOR } = await import('../og-helpers.js');
  const { FAMILIES, FAMILY_CODES, GAP, LABELS, SHARE, VARIANTS, VARIANT_IDS_BY_FAMILY } = await import('../../site/worktype-copy.js');
  const { WORKTYPE_CARDS } = await import('../../views/og-cards.js');
  const origin = 'https://jobs-layout-zkscio.vercel.app';
  const url = new URL(`${origin}/api/og`);
  const fontBytes = new Uint8Array([1, 2, 3]);
  const fontSubsets: string[] = [];
  const dataRequests: string[] = [];
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  function prepare(data: Record<string, unknown>): void {
    images.length = 0;
    fontSubsets.length = 0;
    dataRequests.length = 0;
    globalThis.fetch = async input => {
      const request = new URL(String(input));
      if (request.origin === 'https://fonts.googleapis.com') {
        fontSubsets.push(request.searchParams.get('text')!);
        return new Response("@font-face { src: url(https://fonts.gstatic.com/layout-fixture.ttf) format('truetype'); }");
      }
      if (request.href === 'https://fonts.gstatic.com/layout-fixture.ttf') return new Response(fontBytes);
      assert.equal(request.origin, origin, 'data must come from the requested preview origin');
      assert.ok(Object.hasOwn(data, request.pathname), `unexpected fetch: ${request.href}`);
      dataRequests.push(request.pathname);
      const value = data[request.pathname];
      return value instanceof Response ? value.clone() : Response.json(value);
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
    test(`occupation score ${score} keeps a bounded label and matching layout`, async () => {
      const title = `Occupation fixture ${label}`;
      prepare({ '/data.detail/0156.json': {
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

  test('occupation missing fields keep empty title and missing-stat labels; zero stats stay zero', async () => {
    for (const stats of [undefined, { workers: null, salary_man_yen: null }, { workers: 0, salary_man_yen: 0 }]) {
      prepare({ '/data.detail/0001.json': { id: 1, stats } });
      const copy = common(await renderOccupationOgCard(url, '1'), 1200, 630, '#8a7a6a');
      assert.equal(nodeAtSize('190px').props.children, '—');
      assert.equal(nodeAtSize('72px').props.children, '');
      assert.ok(copy.includes(stats?.workers === 0 ? '就業者 0 人' : '就業者 —'));
      assert.ok(copy.includes(stats?.salary_man_yen === 0 ? '平均年収 0 万円' : '平均年収 —'));
    }
  });

  for (const hue of ['safe', 'mid', 'warm'] as const) {
    test(`sector ${hue} preserves hue, formatted stats and only three sample titles`, async () => {
      const sector = { id: 'fixture', ja: `Sector fixture ${hue}`, hue, occupation_count: 12,
        mean_ai_risk: 3.9666666666666663, total_workforce: 1_500_000,
        sample_titles_ja: ['First', 'Second', 'Third', 'Excluded'] };
      prepare({ '/data.sectors.json': { sectors: [sector] } });
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

  test('sector missing or empty samples omit the sample row and zero stats remain visible', async () => {
    for (const samples of [undefined, []]) {
      prepare({ '/data.sectors.json': { sectors: [{
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

  const projection = {
    schema_version: '1.0',
    families: Object.fromEntries(FAMILY_CODES.map(code => [code, { familyId: code, count: 1, pct: 12.5 }])),
    variants: Object.fromEntries(FAMILY_CODES.map(code => [code, {}])),
    occupations: { '156': { code: 'CDB', familyId: 'CDB', exposure: 2, rarityPct: 12.5 } },
  };
  const family = 'RPK';
  const variant = 'mediator';

  for (const shape of ['wide', 'square'] as const) {
    test(`worktype ${shape} identity card retains the character and copy hierarchy`, async () => {
      prepare({ '/data.worktypes.json': projection });
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
      test(`worktype ${shape} score ${score} replaces character with a bounded badge and recomputed gap`, async () => {
        const title = `Worktype fixture ${shape} ${label}`;
        prepare({ '/data.worktypes.json': projection, '/data.detail/0156.json': {
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

  test('worktype null score keeps identity artwork but includes valid job context', async () => {
    prepare({ '/data.worktypes.json': projection, '/data.detail/0156.json': {
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
    test(`worktype ${fixture.name} degrades to identity without trusting supplied gap`, async () => {
      prepare({ '/data.worktypes.json': fixture.projection, '/data.detail/0156.json': fixture.detail });
      const copy = common(await renderWorktypeOgCard(url, { family, variant, shape: 'wide', job: fixture.job, gap: 'hidden_risk' }),
        1200, 630, WORKTYPE_CARDS[family].accent);
      assert.ok(copy.includes(WORKTYPE_CARDS[family].character));
      assert.ok(!copy.some(text => text.startsWith(`${LABELS.gap}:`)));
      assert.ok(!copy.includes('/ 10'));
      assert.equal(dataRequests.length, fixture.name === 'invalid id' ? 1 : 2);
    });
  }

  test('worktype cross-family variant falls back to the selected family default', async () => {
    prepare({ '/data.worktypes.json': projection });
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
      prepare({ '/data.worktypes.json': fixture });
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
}
