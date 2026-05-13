/**
 * SectorPatterns.test.ts — pin the AI-impact distribution +
 * observations block on the sector hub.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderSectorPatterns } from './SectorPatterns.js';

const baseInput = {
  aiLowCount: 10,
  aiMidCount: 8,
  aiHighCount: 7,
  aiLowPct: 40,
  aiMidPct: 32,
  aiHighPct: 28,
  observations: ['観察1', '観察2'],
};

describe('renderSectorPatterns', () => {
  test('empty observations array returns empty SafeHtml (no <section>)', () => {
    assert.equal(
      renderSectorPatterns({ ...baseInput, observations: [] }),
      '',
    );
  });

  test('section + h2 + aria-label all present when observations non-empty', () => {
    const out = renderSectorPatterns(baseInput);
    assert.ok(out.includes('<section class="patterns" aria-label="データから見えるパターン">'));
    assert.ok(out.includes('<h2>データから見えるパターン</h2>'));
  });

  test('distribution bar has 3 sized spans with title attrs', () => {
    const out = renderSectorPatterns(baseInput);
    assert.ok(out.includes('<span class="dist-low" style="width:40%" title="AI 影響 低 (3 以下): 10 職業"></span>'));
    assert.ok(out.includes('<span class="dist-mid" style="width:32%" title="AI 影響 中 (4-6): 8 職業"></span>'));
    assert.ok(out.includes('<span class="dist-high" style="width:28%" title="AI 影響 高 (7+): 7 職業"></span>'));
  });

  test('legend shows counts + percentages with 0-decimal rounding', () => {
    const out = renderSectorPatterns({ ...baseInput, aiLowPct: 33.7, aiMidPct: 22.4 });
    // 33.7 → "34", 22.4 → "22" (toFixed(0) rounds to nearest).
    assert.ok(out.includes('低 (≤3): <strong>10</strong> 職業 (34%)'));
    assert.ok(out.includes('中 (4-6): <strong>8</strong> 職業 (22%)'));
  });

  test('observations rendered as <li> items in order', () => {
    const out = renderSectorPatterns({
      ...baseInput,
      observations: ['第一', '第二', '第三'],
    });
    const liCount = (out.match(/<li>/g) || []).length;
    assert.equal(liCount, 3);
    assert.ok(out.indexOf('第一') < out.indexOf('第二'));
    assert.ok(out.indexOf('第二') < out.indexOf('第三'));
  });

  test('XSS payload in observation escaped', () => {
    const out = renderSectorPatterns({
      ...baseInput,
      observations: ['<script>x</script>'],
    });
    assert.ok(!out.includes('<script>x</script>'));
    assert.ok(out.includes('&lt;script&gt;'));
  });

  test('integer percentage values render without decimal point', () => {
    const out = renderSectorPatterns(baseInput);
    assert.ok(out.includes('width:40%'));
    assert.ok(out.includes('width:32%'));
    assert.ok(out.includes('width:28%'));
    assert.ok(!out.includes('40.0'));
  });
});
