/**
 * FaqSection.test.ts — pin the byte-for-byte output of the shared FAQ
 * template. Five legacy renderFaqHtml copies (compare-hub, genre-hub,
 * interests, ranking-renderers, skills-hub) all produced this exact
 * string; the test asserts the consolidated template preserves it so
 * the SEO baseline diff stays clean during migration.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderFaqSection } from './FaqSection.js';

describe('renderFaqSection', () => {
  test('empty list returns empty SafeHtml (no empty <section>)', () => {
    assert.equal(renderFaqSection([]), '');
  });

  test('single Q/A produces the canonical byte-equivalent markup', () => {
    const out = renderFaqSection([['なぜ?', 'こうです。']]);
    assert.equal(
      out,
      '<section class="faq" aria-label="よくある質問">' +
        '<h2>よくある質問</h2>' +
        '<details><summary>なぜ?</summary>' +
        '<div class="faq-a">こうです。</div></details>' +
        '</section>',
    );
  });

  test('multi Q/A concatenates in order with no separators', () => {
    const out = renderFaqSection([
      ['Q1', 'A1'],
      ['Q2', 'A2'],
    ]);
    assert.equal(
      out,
      '<section class="faq" aria-label="よくある質問">' +
        '<h2>よくある質問</h2>' +
        '<details><summary>Q1</summary><div class="faq-a">A1</div></details>' +
        '<details><summary>Q2</summary><div class="faq-a">A2</div></details>' +
        '</section>',
    );
  });

  test('escapes user-supplied q + a (XSS payload)', () => {
    const out = renderFaqSection([['<script>alert(1)</script>', 'a"b<c']]);
    assert.ok(
      out.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),
      'question must be HTML-escaped',
    );
    assert.ok(out.includes('a&quot;b&lt;c'), 'answer must be HTML-escaped');
    assert.ok(!out.includes('<script>'), 'raw <script> must not survive');
  });
});
