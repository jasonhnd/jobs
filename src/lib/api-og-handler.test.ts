import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Bun module mocks persist beyond mock.restore(). Keep them out of the
// process running the real renderer tests. The normal unit command discovers
// this wrapper under src/ and also runs the handler cases in the child.
if (process.env.OG_HANDLER_TEST_CHILD !== '1') {
  test('OG handler cases in an isolated process', () => {
    const result = spawnSync(process.execPath, [
      'test', fileURLToPath(import.meta.url), '--coverage', '--coverage-reporter=text',
    ], {
      env: { PATH: process.env.PATH, OG_HANDLER_TEST_CHILD: '1' },
      encoding: 'utf8', timeout: 30_000,
    });
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
  });
} else {
  // Bun is the pinned test runner, but the project does not install Bun types.
  // @ts-expect-error bun:test is a runtime-only module
  const { mock } = await import('bun:test');
  const calls: { kind: string; args: unknown[] }[] = [];
  let response: Response;
  let failure: unknown;
  for (const [kind, name] of [
    ['generic', 'renderGenericOgCard'], ['map', 'renderMapOgCard'],
    ['sector', 'renderSectorOgCard'], ['occupation', 'renderOccupationOgCard'],
    ['worktype', 'renderWorktypeOgCard'],
  ]) {
    mock.module(fileURLToPath(new URL(`./og-renderers/${kind}.ts`, import.meta.url)), () => ({
      [name]: async (...args: unknown[]) => {
        calls.push({ kind, args });
        if (failure !== undefined) throw failure;
        return response;
      },
    }));
  }
  // A missed mock must fail locally rather than fetch fonts or projections.
  globalThis.fetch = async () => { throw new Error('Unexpected network request'); };
  const { GET, HEAD } = await import('../../api/og.js');
  const { PAGE_CARDS } = await import('../views/og-cards.js');
  const cache = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

  describe('OG handler', () => {
    const cases = [
      ['?page=map', 'map'], ['?page=about', 'generic'],
      ['?sector=information', 'sector'], ['?id=133', 'occupation'],
      ['?worktype=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133&gap=aligned&shape=square', 'worktype'],
      ['?page=unknown', 'generic'], ['?id=invalid', 'generic'], ['', 'generic'],
    ];
    for (const [query, kind] of cases) {
      test(`dispatches ${query || 'empty query'} and normalizes successful caching`, async () => {
        calls.length = 0;
        failure = undefined;
        response = new Response('synthetic PNG', {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, immutable, max-age=31536000' },
        });
        const url = new URL(`https://example.test/api/og${query}`);
        const result = await GET(new Request(url));
        assert.equal(result, response);
        assert.equal(result.status, 200);
        assert.equal(result.headers.get('content-type'), 'image/png');
        assert.equal(result.headers.get('cache-control'), cache);
        assert.equal(await result.text(), 'synthetic PNG');
        assert.equal(calls.length, 1);
        assert.equal(calls[0].kind, kind);
        const args = calls[0].args;
        if (kind === 'map') assert.deepEqual(args, []);
        else if (kind === 'generic') assert.deepEqual(args, [query === '?page=about' ? PAGE_CARDS.about : PAGE_CARDS.home]);
        else {
          assert.equal(String(args[0]), String(url));
          if (kind === 'sector') assert.equal(args[1], 'information');
          if (kind === 'occupation') assert.equal(args[1], '133');
          if (kind === 'worktype') assert.deepEqual(args[1], {
            kind: 'render-worktype', family: 'RPK', variant: 'mediator',
            axes: '3-0/2-1/2-1', job: '133', gap: 'aligned', shape: 'square',
          });
        }
      });
    }

    for (const status of [404, 503]) {
      test(`preserves renderer ${status} response and caching`, async () => {
        failure = undefined;
        response = new Response('upstream unavailable', { status, headers: { 'Cache-Control': 'no-store' } });
        const result = await GET(new Request('https://example.test/api/og?id=133'));
        assert.equal(result, response);
        assert.equal(result.status, status);
        assert.equal(result.headers.get('cache-control'), 'no-store');
        assert.equal(await result.text(), 'upstream unavailable');
      });
    }

    for (const thrown of [new Error('synthetic private renderer detail'), 'synthetic string failure']) {
      test(`render rejection (${typeof thrown}) returns a fixed retriable error`, async (t) => {
        failure = thrown;
        const log = t.mock.method(console, 'error', () => {});
        const result = await GET(new Request('https://example.test/api/og?page=map'));
        assert.equal(result.status, 503);
        assert.equal(result.headers.get('retry-after'), '60');
        assert.equal(result.headers.get('content-type'), 'text/plain; charset=utf-8');
        assert.equal(result.headers.get('cache-control'), null);
        assert.equal(await result.text(), 'OG render failed');
        assert.deepEqual(log.mock.calls[0].arguments, [
          `[og] render failed: ${thrown instanceof Error ? thrown.message : thrown}`,
        ]);
      });
    }

    test('HEAD returns the successful image headers without rendering', async () => {
      calls.length = 0;
      failure = new Error('HEAD must not render');
      const result = HEAD(new Request('https://example.test/api/og?id=invalid', { method: 'HEAD' }));
      assert.equal(result.status, 200);
      assert.equal(result.headers.get('content-type'), 'image/png');
      assert.equal(result.headers.get('cache-control'), cache);
      assert.equal(await result.text(), '');
      assert.deepEqual(calls, []);
    });
  });
}
