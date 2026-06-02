/**
 * inline-links.test.ts — security-adjacent contract. The function
 * builds <a> tags from occupation/hub names embedded in prose; the
 * escape-first-then-anchor-injection ordering is load-bearing
 * because the upstream prose can contain HTML metacharacters
 * (operator-injected commentary, future user-derived data, etc).
 *
 * Tests pin the XSS-defense properties + the editorial rules
 * (longest-match, once-per-text).
 *
 * NOTE: `buildLinkRegistry` does file I/O (reads /data.detail/*.json).
 * We don't test the registry-build path here; tests use a
 * hand-rolled registry to exercise `inlineLinkText` directly.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  inlineLinkText,
  type LinkRegistry,
  type LinkTarget,
} from './inline-links.js';

/** Build a synthetic registry from `[pattern, href]` pairs.
 *  Patterns are sorted by length DESC to match production ordering. */
function makeRegistry(entries: Array<{ pattern: string; href: string }>): LinkRegistry {
  const patterns = entries
    .slice()
    .sort((a, b) => b.pattern.length - a.pattern.length)
    .map(({ pattern, href }) => ({
      pattern,
      target: { href, name: pattern, kind: 'occupation' as const } satisfies LinkTarget,
    }));
  return { patterns };
}

describe('inlineLinkText — escape-first XSS defense', () => {
  test('plain text without matches still gets HTML-escaped', () => {
    const registry = makeRegistry([]);
    const html = inlineLinkText('<script>alert(1)</script>', registry);
    assert.ok(!html.includes('<script>'), 'raw <script> leaked through');
    assert.match(html, /&lt;script&gt;/);
  });

  test('text containing < > & gets escaped', () => {
    const registry = makeRegistry([]);
    const html = inlineLinkText('A & B < C > D', registry);
    assert.ok(!html.includes(' & '), 'unescaped &');
    assert.match(html, /&amp;/);
    assert.match(html, /&lt;/);
    assert.match(html, /&gt;/);
  });

  test('matched occupation gets wrapped in <a> with the target href', () => {
    const registry = makeRegistry([{ pattern: '看護師', href: '/156' }]);
    const html = inlineLinkText('看護師について', registry);
    assert.match(html, /<a [^>]*href="\/156"[^>]*>看護師<\/a>/);
  });
});

describe('inlineLinkText — editorial rules', () => {
  test('once-per-block: second occurrence of same name stays plain text', () => {
    const registry = makeRegistry([{ pattern: '看護師', href: '/156' }]);
    const html = inlineLinkText('看護師は重要。もう一度看護師と書いた。', registry);
    const matches = html.match(/<a [^>]*>/g) ?? [];
    assert.equal(matches.length, 1, `expected 1 <a>, got ${matches.length}: ${html}`);
  });

  test('longest-match wins when patterns overlap', () => {
    const registry = makeRegistry([
      { pattern: '看護', href: '/short' },
      { pattern: '看護師', href: '/long' },
    ]);
    const html = inlineLinkText('看護師について', registry);
    assert.match(html, /href="\/long"/, 'longest match did not win');
    assert.ok(!html.includes('/short'), 'shorter match leaked');
  });

  test('empty registry leaves text unchanged (only escape applied)', () => {
    const registry = makeRegistry([]);
    const html = inlineLinkText('一般的なテキスト', registry);
    assert.equal(html, '一般的なテキスト');
  });

  test('empty input → empty output', () => {
    const registry = makeRegistry([{ pattern: '看護師', href: '/156' }]);
    const html = inlineLinkText('', registry);
    assert.equal(html, '');
  });
});

describe('inlineLinkText — defensive null / whitespace handling', () => {
  test('whitespace-only text → whitespace-only escaped output', () => {
    const registry = makeRegistry([]);
    const html = inlineLinkText('   ', registry);
    assert.equal(html.trim(), '');
  });
});
