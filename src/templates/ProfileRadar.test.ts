/**
 * ProfileRadar.test.ts — pin the byte-for-byte output of the 5-axis
 * radar template extracted from [id].astro.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderProfileRadar } from './ProfileRadar.js';

describe('renderProfileRadar', () => {
  test('all-null input returns empty SafeHtml', () => {
    assert.equal(
      renderProfileRadar({
        creative: null,
        social: null,
        judgment: null,
        physical: null,
        routine: null,
      }),
      '',
    );
  });

  test('all-zero input returns empty SafeHtml (no <section> for empty radar)', () => {
    assert.equal(
      renderProfileRadar({
        creative: 0,
        social: 0,
        judgment: 0,
        physical: 0,
        routine: 0,
      }),
      '',
    );
  });

  test('any single non-zero axis renders the full radar block', () => {
    const out = renderProfileRadar({
      creative: 50,
      social: null,
      judgment: null,
      physical: null,
      routine: null,
    });
    assert.ok(out.includes('<section class="profile" aria-label="5 次元プロファイル">'));
    assert.ok(out.includes('<h2>5 次元プロファイル</h2>'));
    assert.ok(out.includes('<svg class="radar-svg" viewBox="0 0 340 340"'));
    assert.ok(out.includes('<dl class="radar-legend">'));
  });

  test('all five axis labels appear inside the SVG and the legend', () => {
    const out = renderProfileRadar({
      creative: 80,
      social: 60,
      judgment: 70,
      physical: 50,
      routine: 40,
    });
    for (const label of ['創造性', '対人', '判断', '身体', '定型']) {
      // Once in <text> inside SVG, once in <dt> in legend → at least 2 occurrences.
      const occurrences = (out.match(new RegExp(label, 'g')) || []).length;
      assert.ok(occurrences >= 2, `expected ≥2 occurrences of ${label}, got ${occurrences}`);
    }
  });

  test('legend renders truncated integer dd values', () => {
    const out = renderProfileRadar({
      creative: 87.9,
      social: 12.3,
      judgment: 0,
      physical: 0,
      routine: 0,
    });
    // Truncation (not rounding): 87.9 → 87, 12.3 → 12.
    assert.ok(out.includes('<dd>87</dd>'));
    assert.ok(out.includes('<dd>12</dd>'));
    assert.ok(out.includes('<dd>0</dd>'));
    assert.ok(!out.includes('<dd>88</dd>'));
  });

  test('grid backdrop renders four concentric pentagons', () => {
    const out = renderProfileRadar({
      creative: 100,
      social: 100,
      judgment: 100,
      physical: 100,
      routine: 100,
    });
    // 4 grid polygons + 1 data polygon = 5.
    const polygonCount = (out.match(/<polygon /g) || []).length;
    assert.equal(polygonCount, 5);
    // 4 grid polygons have the rgba stroke.
    const gridCount = (out.match(/stroke="rgba\(36,30,24,0\.10\)"/g) || []).length;
    assert.equal(gridCount, 4);
  });

  test('viewBox + chart-data polygon use pinned geometry constants', () => {
    const out = renderProfileRadar({
      creative: 100,
      social: 0,
      judgment: 0,
      physical: 0,
      routine: 0,
    });
    // First axis (i=0) at value 100% → cos(-π/2)=0, sin(-π/2)=-1 →
    // x=cx+0=170.0, y=cy-130=40.0 → "170.0,40.0".
    assert.ok(out.includes('170.0,40.0'));
    // Fill colour pinned.
    assert.ok(out.includes('fill="rgba(217,107,61,0.18)"'));
    assert.ok(out.includes('stroke="#D96B3D"'));
  });
});
