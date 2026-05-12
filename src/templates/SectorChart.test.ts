/**
 * SectorChart.test.ts — pin the byte-for-byte output of the shared
 * SectorChart template. Three legacy `renderSectorChart` copies all
 * produced this exact string; the test asserts the consolidated
 * template preserves it so the SEO baseline diff stays clean.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderSectorChart } from './SectorChart.js';

describe('renderSectorChart', () => {
  test('empty breakdown returns empty SafeHtml', () => {
    assert.equal(renderSectorChart([], 'unused title'), '');
  });

  test('single row renders 100% bar', () => {
    const out = renderSectorChart([['IT', 5]], 'セクター内訳');
    assert.equal(
      out,
      '<div class="sector-chart">' +
        '<div class="sc-title">セクター内訳</div>' +
        '<div class="sb-row">' +
        '<span class="sb-label">IT</span>' +
        '<span class="sb-track"><span class="sb-fill" style="width:100%"></span></span>' +
        '<span class="sb-count">5件</span>' +
        '</div>' +
        '</div>',
    );
  });

  test('multi row bars are relative to the first (largest) bucket', () => {
    const out = renderSectorChart(
      [
        ['IT', 10],
        ['Finance', 5],
        ['Other', 2],
      ],
      'breakdown',
    );
    // 100%, 50%, 20% — floor (truncated) per Math.trunc.
    assert.ok(out.includes('style="width:100%"'));
    assert.ok(out.includes('style="width:50%"'));
    assert.ok(out.includes('style="width:20%"'));
  });

  test('escapes title + label XSS payloads', () => {
    const out = renderSectorChart([['<script>', 1]], '<i>title</i>');
    assert.ok(out.includes('&lt;script&gt;'));
    assert.ok(out.includes('&lt;i&gt;title&lt;/i&gt;'));
    assert.ok(!out.includes('<script>'));
  });
});
