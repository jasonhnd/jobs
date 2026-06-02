/**
 * Transfer.test.ts — pin the byte-for-byte output of the
 * career-transfer card grid extracted from [id].astro.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderTransfer } from './Transfer.js';

describe('renderTransfer', () => {
  test('empty array returns empty SafeHtml (no <section>)', () => {
    assert.equal(renderTransfer([]), '');
  });

  test('single card renders the full <section> + one transfer-card', () => {
    const out = renderTransfer([
      { id: 42, name: 'プログラマー', aiRisk: 6, similarity: 0.82 },
    ]);
    assert.equal(
      out,
      '<section class="transfer" aria-label="似た仕事 / キャリア転換の候補">' +
        '<h2>似た仕事 / キャリア転換の候補</h2>' +
        '<div class="transfer-grid">' +
        '<a class="transfer-card" href="/42">' +
        '<span class="tc-name">プログラマー</span>' +
        '<span class="tc-meta">' +
        '<span class="tc-risk">AI 影響 6/10</span>' +
        '<span class="tc-similarity">類似度 82%</span>' +
        '</span>' +
        '</a>' +
        '</div>' +
        '</section>',
    );
  });

  test('null aiRisk renders em-dash', () => {
    const out = renderTransfer([
      { id: 1, name: 'x', aiRisk: null, similarity: 0.5 },
    ]);
    assert.ok(out.includes('AI 影響 —'));
    assert.ok(!out.includes('AI 影響 null'));
  });

  test('undefined similarity omits the similarity chip', () => {
    const out = renderTransfer([
      { id: 1, name: 'x', aiRisk: 5, similarity: undefined },
    ]);
    assert.ok(!out.includes('tc-similarity'));
    assert.ok(!out.includes('類似度'));
    assert.ok(out.includes('AI 影響 5/10'));
  });

  test('null similarity also omits the similarity chip', () => {
    const out = renderTransfer([
      { id: 1, name: 'x', aiRisk: 5, similarity: null },
    ]);
    assert.ok(!out.includes('tc-similarity'));
  });

  test('similarity rounded to nearest integer percent', () => {
    const out = renderTransfer([
      { id: 1, name: 'x', aiRisk: 5, similarity: 0.667 },
    ]);
    assert.ok(out.includes('類似度 67%'));
    const outDown = renderTransfer([
      { id: 1, name: 'y', aiRisk: 5, similarity: 0.664 },
    ]);
    assert.ok(outDown.includes('類似度 66%'));
  });

  test('multiple cards render in order with one wrapper grid', () => {
    const out = renderTransfer([
      { id: 1, name: 'A', aiRisk: 1, similarity: 0.9 },
      { id: 2, name: 'B', aiRisk: 2, similarity: 0.8 },
      { id: 3, name: 'C', aiRisk: 3, similarity: 0.7 },
    ]);
    const cardCount = (out.match(/<a class="transfer-card" href=/g) || []).length;
    assert.equal(cardCount, 3);
    const gridCount = (out.match(/<div class="transfer-grid">/g) || []).length;
    assert.equal(gridCount, 1);
    assert.ok(out.indexOf('href="/1"') < out.indexOf('href="/2"'));
    assert.ok(out.indexOf('href="/2"') < out.indexOf('href="/3"'));
  });

  test('XSS payload in name escaped (but href is not escaped — caller controls id)', () => {
    const out = renderTransfer([
      { id: 999, name: '<script>x</script>', aiRisk: 5, similarity: 0.5 },
    ]);
    assert.ok(!out.includes('<script>x</script>'));
    assert.ok(out.includes('&lt;script&gt;x&lt;/script&gt;'));
    // id is numeric, so href is structurally safe.
    assert.ok(out.includes('href="/999"'));
  });
});
