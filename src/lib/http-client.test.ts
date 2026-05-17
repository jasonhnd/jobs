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
