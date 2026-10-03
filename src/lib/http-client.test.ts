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
