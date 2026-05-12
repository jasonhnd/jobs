/**
 * Highlights.test.ts — pin the byte-for-byte output of the shared
 * Highlights template. Three legacy `renderHighlights` copies all
 * produced this exact string; the test asserts the consolidated
 * template preserves it so the SEO baseline diff stays clean.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderHighlights } from './Highlights.js';

describe('renderHighlights', () => {
  test('empty list returns empty SafeHtml (no empty <div>)', () => {
    assert.equal(renderHighlights([]), '');
  });

  test('single item produces canonical byte-equivalent markup', () => {
    assert.equal(
      renderHighlights(['first highlight']),
      '<div class="highlights"><ul><li>first highlight</li></ul></div>',
    );
  });

  test('multi item concatenates in order with no separators', () => {
    assert.equal(
      renderHighlights(['a', 'b', 'c']),
      '<div class="highlights"><ul><li>a</li><li>b</li><li>c</li></ul></div>',
    );
  });

  test('escapes XSS payload in each item', () => {
    const out = renderHighlights(['<script>x</script>', 'a"b']);
    assert.ok(out.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(out.includes('a&quot;b'));
    assert.ok(!out.includes('<script>'));
  });
});
