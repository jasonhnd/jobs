/**
 * OccFaq.test.ts — pin the byte-for-byte output of the occupation
 * detail page's FAQ block (variant DOM with .faq-list wrapper and
 * .faq-item / .faq-answer classes).
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderOccFaq } from './OccFaq.js';

describe('renderOccFaq', () => {
  test('empty array returns empty SafeHtml (no <section>)', () => {
    assert.equal(renderOccFaq([]), '');
  });

  test('single Q/A pair renders the variant DOM exactly', () => {
    const out = renderOccFaq([['なぜ高い?', '需要が伸びているため。']]);
    assert.equal(
      out,
      '<section class="faq" aria-label="よくある質問">' +
        '<h2>よくある質問</h2>' +
        '<div class="faq-list">' +
        '<details class="faq-item"><summary>なぜ高い?</summary>' +
        '<div class="faq-answer">需要が伸びているため。</div></details>' +
        '</div>' +
        '</section>',
    );
  });

  test('multiple items render in order inside .faq-list wrapper', () => {
    const out = renderOccFaq([
      ['Q1', 'A1'],
      ['Q2', 'A2'],
      ['Q3', 'A3'],
    ]);
    // Three <details> items.
    const detailsCount = (out.match(/<details class="faq-item">/g) || []).length;
    assert.equal(detailsCount, 3);
    // Single wrapping <div class="faq-list">.
    const wrapperCount = (out.match(/<div class="faq-list">/g) || []).length;
    assert.equal(wrapperCount, 1);
    // Order preserved.
    assert.ok(out.indexOf('Q1') < out.indexOf('Q2'));
    assert.ok(out.indexOf('Q2') < out.indexOf('Q3'));
  });

  test('XSS payloads in question + answer are escaped', () => {
    const out = renderOccFaq([['<script>q</script>', '<img src=x onerror=y>']]);
    assert.ok(!out.includes('<script>q</script>'));
    assert.ok(!out.includes('<img src=x onerror=y>'));
    assert.ok(out.includes('&lt;script&gt;q&lt;/script&gt;'));
    assert.ok(out.includes('&lt;img src=x onerror=y&gt;'));
  });

  test('DOM differs from FaqSection (variant guard)', () => {
    // Sanity check that this template emits the variant DOM, not the
    // bare FaqSection one. If a future refactor unifies them, this
    // test should break loudly to force a deliberate decision.
    const out = renderOccFaq([['q', 'a']]);
    assert.ok(out.includes('<details class="faq-item">'));
    assert.ok(out.includes('<div class="faq-list">'));
    assert.ok(out.includes('<div class="faq-answer">'));
    assert.ok(!out.includes('<div class="faq-a">'));
  });
});
