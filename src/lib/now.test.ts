/**
 * now.test.ts — pin the `generated_at` timestamp contract.
 *
 * `nowIso()` is the single source of truth for build-time timestamps
 * stamped into every projection output (sectors / sitemap / etc).
 * The function is process-cached: first call computes, subsequent
 * calls return the cached value. This guarantees:
 *
 *   1. Reproducibility — one build emits identical timestamps across
 *      its 8 projections, even if the wall clock ticks between calls.
 *
 *   2. Determinism under CI — when `BUILD_DATA_TIMESTAMP` env is set
 *      (e.g. from `git log -1 --format=%cI`), the cache is bypassed
 *      on the first call only; subsequent calls return the env-derived
 *      cached value. Critical for byte-reproducible builds.
 *
 *   3. Test isolation — `_resetNowIsoCache()` clears the cache between
 *      tests so env override + format checks don't poison each other.
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';

import { nowIso, _resetNowIsoCache } from './now.js';

beforeEach(() => {
  _resetNowIsoCache();
  delete process.env.BUILD_DATA_TIMESTAMP;
});

afterEach(() => {
  _resetNowIsoCache();
  delete process.env.BUILD_DATA_TIMESTAMP;
});

describe('nowIso — format', () => {
  test('returns ISO 8601 UTC with literal "+00:00" offset', () => {
    const s = nowIso();
    assert.match(
      s,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/,
      `format mismatch: ${s}`,
    );
  });

  test('year is 4 digits + month/day/hour/minute/second are 2 digits each', () => {
    const s = nowIso();
    const [date, time] = s.split('T');
    const [year, month, day] = date!.split('-');
    const [hour, minute, secAndOffset] = time!.split(':');
    const sec = secAndOffset!.slice(0, 2);
    assert.equal(year!.length, 4);
    assert.equal(month!.length, 2);
    assert.equal(day!.length, 2);
    assert.equal(hour!.length, 2);
    assert.equal(minute!.length, 2);
    assert.equal(sec.length, 2);
  });

  test('parseable as a Date (round-trips through Date.parse)', () => {
    const s = nowIso();
    const parsed = Date.parse(s);
    assert.ok(!Number.isNaN(parsed), `Date.parse failed on: ${s}`);
  });
});

describe('nowIso — caching', () => {
  test('first + second call within the same process return identical value', () => {
    const a = nowIso();
    const b = nowIso();
    assert.equal(a, b);
  });

  test('cached value persists even when the wall clock has ticked', async () => {
    const a = nowIso();
    // Sleep ~1.5s — long enough for the second to flip.
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    const b = nowIso();
    assert.equal(a, b, 'cache must shield wall-clock drift');
  });

  test('_resetNowIsoCache forces a fresh compute on the next call', () => {
    const first = nowIso();
    _resetNowIsoCache();
    process.env.BUILD_DATA_TIMESTAMP = '2099-12-31T23:59:59+00:00';
    const second = nowIso();
    assert.notEqual(first, second);
    assert.equal(second, '2099-12-31T23:59:59+00:00');
  });
});

describe('nowIso — BUILD_DATA_TIMESTAMP env override', () => {
  test('env value returned verbatim on first call', () => {
    process.env.BUILD_DATA_TIMESTAMP = '2026-01-15T12:34:56+00:00';
    assert.equal(nowIso(), '2026-01-15T12:34:56+00:00');
  });

  test('env value is NOT parsed — any string returned verbatim', () => {
    // Documented behaviour: the env value is treated as opaque.
    // Caller (CI script) is responsible for ISO format.
    process.env.BUILD_DATA_TIMESTAMP = 'literally anything';
    assert.equal(nowIso(), 'literally anything');
  });

  test('env override takes effect on first call but cache still applies', () => {
    process.env.BUILD_DATA_TIMESTAMP = '2026-01-01T00:00:00+00:00';
    const a = nowIso();
    // Even if env changes mid-process, cache holds.
    process.env.BUILD_DATA_TIMESTAMP = '2099-12-31T23:59:59+00:00';
    const b = nowIso();
    assert.equal(a, b, 'cache must shield env change');
    assert.equal(a, '2026-01-01T00:00:00+00:00');
  });

  test('empty string env is treated as unset (falls through to computed clock)', () => {
    process.env.BUILD_DATA_TIMESTAMP = '';
    const s = nowIso();
    assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/);
  });
});

describe('_resetNowIsoCache — test-only helper', () => {
  test('called when no cache exists is a no-op (does not throw)', () => {
    _resetNowIsoCache();
    assert.doesNotThrow(() => _resetNowIsoCache());
  });

  test('does not affect env state (only clears module-level cache)', () => {
    process.env.BUILD_DATA_TIMESTAMP = '2026-01-01T00:00:00+00:00';
    _resetNowIsoCache();
    assert.equal(process.env.BUILD_DATA_TIMESTAMP, '2026-01-01T00:00:00+00:00');
  });
});
