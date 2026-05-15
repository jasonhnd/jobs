/**
 * SectorPatterns.test.ts — pin the AI-impact distribution +
 * observations block on the sector hub.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderSectorPatterns } from './SectorPatterns.js';
import { html, unsafeReviewedHtml } from '../lib/safe-html.js';

const baseInput = {
  aiLowCount: 10,
  aiMidCount: 8,
  aiHighCount: 7,
  aiLowPct: 40,
  aiMidPct: 32,
  aiHighPct: 28,
  observations: [html`観察1`, html`観察2`],
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
      observations: [html`第一`, html`第二`, html`第三`],
    });
    const liCount = (out.match(/<li>/g) || []).length;
    assert.equal(liCount, 3);
    assert.ok(out.indexOf('第一') < out.indexOf('第二'));
    assert.ok(out.indexOf('第二') < out.indexOf('第三'));
  });

  test('observations pass through unescaped — SafeHtml contract', () => {
    // observations are SafeHtml; the template trusts them and forwards
    // raw. Editorial `<strong>` markup (built via html`` in
    // src/views/sector-meta.ts) must render as actual emphasis, not as
    // literal `<strong>` text. Per the SafeHtml contract, escaping
    // responsibility lives at the SafeHtml producer, not here.
    const out = renderSectorPatterns({
      ...baseInput,
      observations: [html`平均年収 ${1234} 万円は <strong>+100 万円</strong> 高い`],
    });
    assert.ok(out.includes('<strong>+100 万円</strong>'));
    assert.ok(!out.includes('&lt;strong&gt;'));

    // The escape-hatch case: an audited raw SafeHtml is also forwarded
    // verbatim. Only callers of unsafeReviewedHtml are responsible for
    // their content.
    const out2 = renderSectorPatterns({
      ...baseInput,
      observations: [unsafeReviewedHtml('<em>audited</em>', 'unit test')],
    });
    assert.ok(out2.includes('<em>audited</em>'));
  });

  test('integer percentage values render without decimal point', () => {
    const out = renderSectorPatterns(baseInput);
    assert.ok(out.includes('width:40%'));
    assert.ok(out.includes('width:32%'));
    assert.ok(out.includes('width:28%'));
    assert.ok(!out.includes('40.0'));
  });
});
