import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { fmtNumber, loadGoogleFont, padId } from './og-helpers.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const binaryUrl = 'https://fonts.gstatic.com/test-fixture.ttf';
const bytes = new Uint8Array([0x00, 0x01, 0x00, 0x00, 1, 2, 3, 4]);
const css = (format = 'truetype', url = binaryUrl) => `@font-face { src: url(${url}) format('${format}'); }`;

test('OG formatters preserve grouped numbers and strict four-digit IDs', () => {
  assert.equal(fmtNumber(1_234_567), '1,234,567');
  assert.equal(fmtNumber(0), '0');
  for (const [input, output] of [['1', '0001'], ['42', '0042'], ['156', '0156'], ['9999', '9999'], ['0001', '0001']]) {
    assert.equal(padId(input), output);
  }
  for (const invalid of ['', '10001', '-1', '1.5', ' 1', '1 ', '１２', '../1']) {
    assert.throws(() => padId(invalid), /must be 1-4 ASCII digits/);
  }
});

test('font loading encodes the subset, requests a satori UA and returns binary bytes', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    return url === binaryUrl ? new Response(bytes) : new Response(css('opentype'));
  };
  const result = await loadGoogleFont('Noto+Sans+JP', 800, 'font-test: A & B / 字');
  assert.deepEqual(new Uint8Array(result), bytes);
  assert.equal(calls[0].url,
    'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@800&text=font-test%3A%20A%20%26%20B%20%2F%20%E5%AD%97&display=swap');
  assert.equal(new Headers(calls[0].init?.headers).get('User-Agent'), 'Mozilla/5.0 (compatible; satori; rv:1.0)');
  assert.equal(calls[1].url, binaryUrl);
});

test('concurrent and warm calls share one fetch pair; family, weight and text separate keys', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const calls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input);
    calls.push(url);
    if (url === binaryUrl) return new Response(bytes);
    await gate;
    return new Response(css());
  };
  const first = loadGoogleFont('Fixture+Sans', 500, 'font-test: concurrent');
  const second = loadGoogleFont('Fixture+Sans', 500, 'font-test: concurrent');
  assert.equal(calls.length, 1, 'in-flight requests are coalesced');
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a, b);
  assert.equal(await loadGoogleFont('Fixture+Sans', 500, 'font-test: concurrent'), a);
  assert.equal(calls.length, 2, 'warm cache performs no new fetch');
  await loadGoogleFont('Fixture+Serif', 500, 'font-test: concurrent');
  await loadGoogleFont('Fixture+Sans', 800, 'font-test: concurrent');
  await loadGoogleFont('Fixture+Sans', 500, 'font-test: different');
  assert.equal(calls.length, 8, 'each changed cache component needs a new CSS/binary pair');
});

test('32-entry font cache refreshes hits and evicts the least recently used key', async () => {
  const cssCalls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input);
    if (url === binaryUrl) return new Response(bytes);
    cssCalls.push(new URL(url).searchParams.get('text')!);
    return new Response(css());
  };
  const load = (key: string) => loadGoogleFont('Fixture+LRU', 500, `font-test: lru ${key}`);
  await load('a');
  await load('b');
  for (let i = 0; i < 30; i++) await load(String(i));
  await load('a'); // a is now newer than b, even though a was inserted first.
  await load('overflow');
  await load('a');
  assert.equal(cssCalls.filter(key => key.endsWith(' a')).length, 1);
  await load('b');
  assert.equal(cssCalls.filter(key => key.endsWith(' b')).length, 2);
  assert.equal(cssCalls.length, 34);
});

const failures = [
  { name: 'CSS HTTP error', response: () => new Response('unavailable', { status: 503 }), error: /font CSS fetch failed:.*HTTP 503/ },
  { name: 'missing source', response: () => new Response('@font-face {}'), error: /font src not found/ },
  { name: 'unsupported woff2', response: () => new Response(css('woff2')), error: /font src not found/ },
  { name: 'untrusted host', response: () => new Response(css('truetype', 'https://example.test/font.ttf')), error: /unexpected font binary host/ },
  { name: 'lookalike host', response: () => new Response(css('truetype', 'https://fonts.gstatic.com.example.test/font.ttf')), error: /unexpected font binary host/ },
  { name: 'insecure CDN URL', response: () => new Response(css('truetype', 'http://fonts.gstatic.com/font.ttf')), error: /unexpected font binary host/ },
];
for (const fixture of failures) {
  test(`font ${fixture.name} rejects before binary fetch and retries the same key`, async () => {
    const calls: string[] = [];
    let failing = true;
    globalThis.fetch = async input => {
      const url = String(input);
      calls.push(url);
      if (url === binaryUrl) return new Response(bytes);
      return failing ? fixture.response() : new Response(css());
    };
    const subset = `font-test: ${fixture.name}`;
    await assert.rejects(loadGoogleFont('Fixture+Retry', 500, subset), fixture.error);
    assert.equal(calls.length, 1, 'invalid CSS must not trigger a binary request');
    failing = false;
    assert.deepEqual(new Uint8Array(await loadGoogleFont('Fixture+Retry', 500, subset)), bytes);
    assert.equal(calls.length, 3, 'failed promise is evicted');
  });
}

for (const failure of ['binary HTTP', 'network'] as const) {
  test(`font ${failure} failure is evicted and the same key can retry`, async () => {
    let failing = true;
    let calls = 0;
    globalThis.fetch = async input => {
      calls++;
      if (String(input) !== binaryUrl) return new Response(css());
      if (failing && failure === 'network') throw new Error('fixture network failure');
      return failing ? new Response('', { status: 502 }) : new Response(bytes);
    };
    const subset = `font-test: retry ${failure}`;
    await assert.rejects(loadGoogleFont('Fixture+Retry', 800, subset),
      failure === 'network' ? /fixture network failure/ : /failed to fetch font binary: 502/);
    failing = false;
    assert.deepEqual(new Uint8Array(await loadGoogleFont('Fixture+Retry', 800, subset)), bytes);
    assert.equal(calls, 4);
  });
}

// Audit 2026-10-07 (#861): a 200 response that is not a font used to resolve
// and stay in the promise cache, so a warm instance kept failing the render.
test('font loading rejects non-font bytes and evicts them so the next call refetches', async () => {
  let binaryCalls = 0;
  let payload: Uint8Array = new TextEncoder().encode('<html>not a font</html>');
  globalThis.fetch = async input => {
    if (String(input) === binaryUrl) {
      binaryCalls++;
      return new Response(payload);
    }
    return new Response(css());
  };
  const load = () => loadGoogleFont('Fixture+Signature', 500, 'font-test: signature');
  await assert.rejects(load(), /unexpected font signature/);
  payload = new Uint8Array([0x00]);
  await assert.rejects(load(), /unexpected font signature/);
  payload = bytes;
  assert.deepEqual(new Uint8Array(await load()), bytes);
  assert.equal(binaryCalls, 3, 'each rejected payload was evicted and refetched');
});

for (const [label, signature] of [
  ['TrueType 00010000', [0x00, 0x01, 0x00, 0x00]],
  ['CFF OTTO', [0x4f, 0x54, 0x54, 0x4f]],
  ['Apple true', [0x74, 0x72, 0x75, 0x65]],
] as const) {
  test(`font loading accepts the ${label} signature`, async () => {
    const font = new Uint8Array([...signature, 9, 9]);
    globalThis.fetch = async input => String(input) === binaryUrl ? new Response(font) : new Response(css());
    assert.deepEqual(new Uint8Array(await loadGoogleFont('Fixture+Accept', 500, `font-test: ${label}`)), font);
  });
}
