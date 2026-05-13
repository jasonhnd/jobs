/**
 * LegacyRelated.test.ts — pin the fallback related-jobs section.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderLegacyRelated } from './LegacyRelated.js';

describe('renderLegacyRelated', () => {
  test('empty related array → empty SafeHtml', () => {
    assert.equal(renderLegacyRelated({ related: [], suppress: false }), '');
  });

  test('suppress=true → empty SafeHtml even with related rows', () => {
    assert.equal(
      renderLegacyRelated({
        related: [{ id: 1, nameJa: 'x', aiRisk: 5 }],
        suppress: true,
      }),
      '',
    );
  });

  test('single row renders <section> + <h2> + one <li> with name + risk', () => {
    const out = renderLegacyRelated({
      related: [{ id: 42, nameJa: 'プログラマー', aiRisk: 6 }],
      suppress: false,
    });
    assert.ok(out.includes('<section class="related" aria-label="類似する職業">'));
    assert.ok(out.includes('<h2>類似する職業</h2>'));
    assert.ok(out.includes('<a class="r-name" href="/ja/42">プログラマー</a>'));
    assert.ok(out.includes('<span class="r-risk">AI 影響 6/10</span>'));
  });

  test('null aiRisk renders em-dash', () => {
    const out = renderLegacyRelated({
      related: [{ id: 1, nameJa: 'x', aiRisk: null }],
      suppress: false,
    });
    assert.ok(out.includes('AI 影響 —'));
  });

  test('empty nameJa falls back to "#id"', () => {
    const out = renderLegacyRelated({
      related: [{ id: 99, nameJa: '', aiRisk: 5 }],
      suppress: false,
    });
    assert.ok(out.includes('>#99</a>'));
  });

  test('multiple rows render in order', () => {
    const out = renderLegacyRelated({
      related: [
        { id: 1, nameJa: 'A', aiRisk: 1 },
        { id: 2, nameJa: 'B', aiRisk: 2 },
        { id: 3, nameJa: 'C', aiRisk: 3 },
      ],
      suppress: false,
    });
    const liCount = (out.match(/<li>/g) || []).length;
    assert.equal(liCount, 3);
    assert.ok(out.indexOf('A</a>') < out.indexOf('B</a>'));
    assert.ok(out.indexOf('B</a>') < out.indexOf('C</a>'));
  });

  test('XSS payload in name escaped', () => {
    const out = renderLegacyRelated({
      related: [{ id: 1, nameJa: '<script>x</script>', aiRisk: 5 }],
      suppress: false,
    });
    assert.ok(!out.includes('<script>x</script>'));
    assert.ok(out.includes('&lt;script&gt;x&lt;/script&gt;'));
  });
});
