import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GET } from '../../../api/og.js';
import { loadGoogleFont } from '../og-helpers.js';
import { FAMILY_CODES } from '../../site/worktype-copy.js';

const projection = {
  schema_version: '1.0',
  families: Object.fromEntries(FAMILY_CODES.map(code => [code, { familyId: code, count: 1, pct: 12.5 }])),
  variants: Object.fromEntries(FAMILY_CODES.map(code => [code, {}])),
  occupations: {},
};
const binaryUrl = 'https://fonts.gstatic.com/timeout-fixture.ttf';
const fontCss = `@font-face { src: url(${binaryUrl}) format('truetype'); }`;

// Control only the deadline timers; the fetch double honors the abort signal
// exactly as a network request does. No real network or wall-clock wait.
// `body` mode (#861): headers arrive at once, then the body never finishes —
// the deadline must still cover the body read.
for (const stall of ['headers', 'body'] as const) for (const fixture of [
  { name: 'occupation data', query: '?id=156', path: '/data.detail/0156.json', deadline: 5_000 },
  { name: 'sector data', query: '?sector=iryo', path: '/data.sectors.json', deadline: 5_000 },
  { name: 'worktypes data', query: '?worktype=RPK&variant=mediator', path: '/data.worktypes.json', deadline: 5_000 },
  { name: 'worktype job data', query: '?worktype=RPK&variant=mediator&job=156', path: '/data.detail/0156.json', deadline: 5_000 },
  { name: 'font CSS', query: '?page=about', host: 'fonts.googleapis.com', deadline: 8_000 },
  { name: 'font binary', query: '?page=privacy', host: 'fonts.gstatic.com', deadline: 8_000 },
]) {
  test(`stalled ${fixture.name} (${stall}) reaches the existing retriable 503 at its deadline`, async (t) => {
    let now = 0;
    let nextId = 0;
    const timers = new Map<number, { at: number; fire: () => void }>();
    t.mock.method(globalThis, 'setTimeout', (fire: () => void, delay: number) => {
      const id = ++nextId;
      timers.set(id, { at: now + delay, fire });
      return id;
    });
    t.mock.method(globalThis, 'clearTimeout', (id: number) => { timers.delete(id); });
    t.mock.method(console, 'error', () => {});
    let stalledSignal: AbortSignal | undefined;
    const requests: string[] = [];
    t.mock.method(globalThis, 'fetch', async (input: Request | URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      requests.push(url.href);
      if (url.pathname === fixture.path || url.hostname === fixture.host) {
        assert.ok(init?.signal, 'the upstream request must have a deadline signal');
        stalledSignal = init.signal;
        if (stall === 'body') {
          return new Response(new ReadableStream<Uint8Array>({
            start(controller) { controller.enqueue(new TextEncoder().encode('{"partial":')); },
          }));
        }
        return new Promise<Response>((_resolve, reject) => {
          stalledSignal!.addEventListener('abort', () => {
            reject(new DOMException('fixture timeout', 'AbortError'));
          }, { once: true });
        });
      }
      if (url.pathname === '/data.worktypes.json') return Response.json(projection);
      if (url.hostname === 'fonts.googleapis.com') return new Response(fontCss);
      assert.fail(`unexpected network request: ${url}`);
    });
    let settled = false;
    const result = GET(new Request(`https://pre.mirai-shigoto.com/api/og${fixture.query}`));
    void result.then(() => { settled = true; });
    // Flush the immediate response/JSON promises preceding the stalled fetch.
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok(stalledSignal, `fixture must reach ${fixture.name}; requests: ${requests}`);
    assert.equal(timers.size, fixture.host ? 3 : 1, 'only stalled requests retain timers');
    for (const timer of timers.values()) assert.equal(timer.at, fixture.deadline);
    now = fixture.deadline - 1;
    assert.equal(stalledSignal.aborted, false);
    assert.equal(settled, false, 'no downgrade before the deadline');
    now++;
    for (const timer of [...timers.values()]) timer.fire();
    const response = await result;
    assert.equal(stalledSignal.aborted, true);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(await response.text(), 'OG render failed');
    assert.equal(timers.size, 0, 'the rejected request must clear its timer');
  });
}

for (const stage of ['CSS', 'binary'] as const) {
  test(`font ${stage} timeout evicts the failed cache entry so the same subset can retry`, async (t) => {
    let fire!: () => void;
    t.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
      assert.equal(delay, 8_000);
      fire = callback;
      return 1;
    });
    t.mock.method(globalThis, 'clearTimeout', () => {});
    let failing = true;
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async (input: Request | URL | string, init?: RequestInit) => {
      calls++;
      const isBinary = String(input) === binaryUrl;
      if (failing && isBinary === (stage === 'binary')) {
        return new Promise<Response>((_resolve, reject) => {
          init!.signal!.addEventListener('abort', () => reject(new DOMException('fixture timeout', 'AbortError')), { once: true });
        });
      }
      return isBinary ? new Response(new Uint8Array([0x00, 0x01, 0x00, 0x00, 1, 2, 3])) : new Response(fontCss);
    });
    const subset = `timeout-retry-${stage}`;
    const pending = loadGoogleFont('Timeout+Fixture', 500, subset);
    const rejected = assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === 'AbortError');
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fire();
    await rejected;
    failing = false;
    assert.deepEqual(new Uint8Array(await loadGoogleFont('Timeout+Fixture', 500, subset)), new Uint8Array([0x00, 0x01, 0x00, 0x00, 1, 2, 3]));
    assert.equal(calls, stage === 'CSS' ? 3 : 4);
  });
}
