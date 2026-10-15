// Tests for src/lib/http-client.js — runs under `tsx --test`.
//
// Audit CODE-007: `fetchWithTimeout` must abort a stalled fetch via
// AbortController without leaking the timer, and must compose with a
// caller-supplied AbortSignal so either source can abort the request.

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { fetchWithTimeout } from './http-client.js';

describe('fetchWithTimeout', () => {
  test('returns response on a fast fetch (under timeout)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('ok', { status: 200 }) as Response;
    try {
      const res = await fetchWithTimeout('https://example.com/x', {}, 1000);
      assert.equal(res.status, 200);
      assert.equal(await res.text(), 'ok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('aborts a stalled fetch after timeoutMs (AbortError)', async () => {
    const originalFetch = globalThis.fetch;
    // Stub fetch as a function that respects the abort signal.
    globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
        // Never resolve otherwise → fetch hangs until abort fires.
      })) as typeof fetch;
    try {
      await assert.rejects(
        () => fetchWithTimeout('https://example.com/x', {}, 50),
        (err: unknown) => err instanceof Error && err.name === 'AbortError',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('calls an injected fetch and leaves global fetch unused', async () => {
    const originalFetch = globalThis.fetch;
    let globalCalls = 0;
    globalThis.fetch = (async () => {
      globalCalls += 1;
      return new Response('global', { status: 500 });
    }) as typeof fetch;
    try {
      const res = await fetchWithTimeout(
        'https://example.com/x',
        {},
        1000,
        async () => new Response('injected', { status: 200 }),
      );
      assert.equal(globalCalls, 0);
      assert.equal(res.status, 200);
      assert.equal(await res.text(), 'injected');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('caller-supplied signal can also abort (composes with timeout)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      })) as typeof fetch;
    try {
      const controller = new AbortController();
      const p = fetchWithTimeout(
        'https://example.com/x',
        { signal: controller.signal },
        5000,  // long timeout — caller should win
      );
      // Abort from caller side immediately.
      controller.abort();
      await assert.rejects(
        () => p,
        (err: unknown) => err instanceof Error && err.name === 'AbortError',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// Older runtimes lack AbortSignal.any. Restore both globals even when assertions fail.
for (const mode of ['already-aborted', 'caller-aborts', 'timeout'] as const) {
  test(`fallback signal composition: ${mode}`, async () => {
    const originalFetch = globalThis.fetch;
    const anyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    const caller = new AbortController();
    let receivedSignal: AbortSignal | null | undefined;
    Object.defineProperty(AbortSignal, 'any', { configurable: true, value: undefined });
    globalThis.fetch = (async (_url, init) => {
      receivedSignal = init?.signal;
      assert.ok(receivedSignal);
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException('aborted', 'AbortError'));
        if (receivedSignal!.aborted) abort();
        else receivedSignal!.addEventListener('abort', abort, { once: true });
      });
    }) as typeof fetch;
    try {
      if (mode === 'already-aborted') caller.abort();
      const request = fetchWithTimeout('https://example.com/fixture', { signal: caller.signal }, mode === 'timeout' ? 20 : 1000);
      if (mode === 'caller-aborts') caller.abort();
      await assert.rejects(request, (error: unknown) => error instanceof Error && error.name === 'AbortError');
      assert.notEqual(receivedSignal, caller.signal);
      assert.equal(receivedSignal!.aborted, true);
      assert.equal(caller.signal.aborted, mode !== 'timeout');
    } finally {
      globalThis.fetch = originalFetch;
      if (anyDescriptor) Object.defineProperty(AbortSignal, 'any', anyDescriptor);
      else Reflect.deleteProperty(AbortSignal, 'any');
    }
  });
}

test('clears the timeout after both success and network rejection', async () => {
  const originalFetch = globalThis.fetch;
  const failure = new Error('fixture network failure');
  const signals: AbortSignal[] = [];
  try {
    for (const fails of [false, true]) {
      globalThis.fetch = (async (_url, init) => {
        assert.ok(init?.signal);
        signals.push(init.signal);
        assert.equal(init.method, 'POST');
        assert.equal(init.body, 'fixture');
        if (fails) throw failure;
        return new Response('ok');
      }) as typeof fetch;
      const request = fetchWithTimeout('https://example.com/fixture', { method: 'POST', body: 'fixture' }, 20);
      if (fails) await assert.rejects(request, (error: unknown) => error === failure);
      else assert.equal(await (await request).text(), 'ok');
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.deepEqual(signals.map((signal) => signal.aborted), [false, false]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Audit 2026-10-07 P1 (#861): the timeout must also cover the body read. A
// real local server sends headers plus a partial body and then stalls.
describe('body-reading helpers keep the timeout armed until the body is read', () => {
  async function withStallingServer(
    run: (url: string) => Promise<void>,
  ): Promise<void> {
    const { createServer } = await import('node:http');
    const sockets = new Set<import('node:net').Socket>();
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"partial":');
      // Never end the response.
    });
    server.on('connection', (socket) => { sockets.add(socket); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as import('node:net').AddressInfo;
    try {
      await run(`http://127.0.0.1:${port}/stall`);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  for (const name of ['fetchJsonWithTimeout', 'fetchTextWithTimeout', 'fetchBufferWithTimeout'] as const) {
    test(`${name} rejects with AbortError when the body stalls after the headers`, async () => {
      const mod = await import('./http-client.js') as Record<string, unknown>;
      const helper = mod[name] as (url: string, init: RequestInit, ms: number) => Promise<unknown>;
      assert.equal(typeof helper, 'function', `${name} is exported`);
      await withStallingServer(async (url) => {
        const started = Date.now();
        await assert.rejects(
          () => helper(url, {}, 150),
          (err: unknown) => err instanceof Error && err.name === 'AbortError',
        );
        assert.ok(Date.now() - started < 2000, 'aborted near the deadline');
      });
    });
  }

  test('fetchJsonWithTimeout returns the response and the parsed body', async () => {
    const { fetchJsonWithTimeout } = await import('./http-client.js');
    const result = await fetchJsonWithTimeout('https://example.com/x', {}, 1000,
      async () => new Response('{"a":1}', { status: 404 }));
    assert.equal(result.response.status, 404);
    assert.deepEqual(result.body, { a: 1 });
  });

  test('fetchJsonWithTimeout yields a null body for a non-JSON payload', async () => {
    const { fetchJsonWithTimeout } = await import('./http-client.js');
    const result = await fetchJsonWithTimeout('https://example.com/x', {}, 1000,
      async () => new Response('<html>oops</html>', { status: 200 }));
    assert.equal(result.response.status, 200);
    assert.equal(result.body, null);
  });

  test('fetchTextWithTimeout and fetchBufferWithTimeout return the full body', async () => {
    const { fetchTextWithTimeout, fetchBufferWithTimeout } = await import('./http-client.js');
    const text = await fetchTextWithTimeout('https://example.com/x', {}, 1000,
      async () => new Response('hello'));
    assert.equal(text.body, 'hello');
    const buf = await fetchBufferWithTimeout('https://example.com/x', {}, 1000,
      async () => new Response(new Uint8Array([1, 2, 3])));
    assert.deepEqual(new Uint8Array(buf.body), new Uint8Array([1, 2, 3]));
  });

  test('the timer is cleared after the body has been read', async () => {
    const { fetchTextWithTimeout } = await import('./http-client.js');
    let signal: AbortSignal | undefined;
    const result = await fetchTextWithTimeout('https://example.com/x', {}, 20, async (_u, init) => {
      signal = init?.signal ?? undefined;
      return new Response('done');
    });
    assert.equal(result.body, 'done');
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(signal?.aborted, false);
  });
});
