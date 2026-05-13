/**
 * ProseSection.test.ts — pin the generic prose section renderer.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderProseSection } from './ProseSection.js';

describe('renderProseSection', () => {
  test('null body returns empty SafeHtml (no <section>)', () => {
    assert.equal(
      renderProseSection({ h2: 'タイトル', sectionClass: 'how-to-become', bodyText: null }),
      '',
    );
  });

  test('empty body returns empty SafeHtml', () => {
    assert.equal(
      renderProseSection({ h2: 'タイトル', sectionClass: 'how-to-become', bodyText: '' }),
      '',
    );
  });

  test('single-paragraph body renders h2 + one <p>', () => {
    const out = renderProseSection({
      h2: 'なるには',
      sectionClass: 'how-to-become',
      bodyText: '専門学校で学ぶ。',
    });
    assert.ok(out.includes('<section class="how-to-become" aria-label="なるには">'));
    assert.ok(out.includes('<h2>なるには</h2>'));
    assert.ok(out.includes('<p>専門学校で学ぶ。</p>'));
  });

  test('multi-paragraph body splits on blank lines', () => {
    const out = renderProseSection({
      h2: '労働条件',
      sectionClass: 'working-conditions',
      bodyText: '段落1\n\n段落2',
    });
    const pCount = (out.match(/<p>/g) || []).length;
    assert.equal(pCount, 2);
  });

  test('XSS in h2 escaped (no script injection via heading)', () => {
    const out = renderProseSection({
      h2: '<script>',
      sectionClass: 'x',
      bodyText: 'b',
    });
    assert.ok(out.includes('&lt;script&gt;'));
    assert.ok(!out.includes('<h2><script></h2>'));
  });

  test('XSS in body escaped via formatParagraphs', () => {
    const out = renderProseSection({
      h2: 'x',
      sectionClass: 'y',
      bodyText: '<script>x</script>',
    });
    assert.ok(out.includes('&lt;script&gt;'));
    assert.ok(!out.includes('<p><script>x</script></p>'));
  });

  test('XSS in sectionClass escaped (no class breakout)', () => {
    const out = renderProseSection({
      h2: 'x',
      sectionClass: '"><script>',
      bodyText: 'b',
    });
    assert.ok(!out.includes('"><script>'));
    assert.ok(out.includes('&quot;&gt;&lt;script&gt;'));
  });
});
