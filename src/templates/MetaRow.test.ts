/**
 * MetaRow.test.ts — pin the byte-for-byte output of the sector + band
 * chip row extracted from [id].astro.
 *
 * 2026-05-17 update: demand_band key mismatch fix.
 * Previously template used `'cool' | 'warm' | 'hot'`; now aligned to
 * `'cold' | 'normal' | 'hot'` matching data layer. Workforce_band
 * `'medium'` dead-defensive key also removed. ~273 occupations now
 * render their demand chip correctly. See MetaRow.ts file header.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderMetaRow } from './MetaRow.js';

describe('renderMetaRow', () => {
  test('all-null input returns empty SafeHtml (no <div>)', () => {
    assert.equal(
      renderMetaRow({
        sectorJa: null,
        sectorId: undefined,
        riskBand: null,
        workforceBand: null,
        demandBand: null,
      }),
      '',
    );
  });

  test('sector chip only — full byte-exact link', () => {
    const out = renderMetaRow({
      sectorJa: '医療',
      sectorId: 'healthcare',
      riskBand: null,
      workforceBand: null,
      demandBand: null,
    });
    assert.equal(
      out,
      '<div class="meta-row">' +
        '<a class="sector-chip" href="/sectors/healthcare">医療</a>' +
        '</div>',
    );
  });

  test('all three band labels: risk + workforce + demand', () => {
    const out = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: 'high',
      workforceBand: 'large',
      demandBand: 'hot',
    });
    assert.ok(out.includes('<span class="band band-high">AI 影響 高</span>'));
    assert.ok(out.includes('<span class="band band-high">規模 大</span>'));
    assert.ok(out.includes('<span class="band band-high">需要 過熱</span>'));
  });

  test('workforce_band only accepts "mid" (dead "medium" key removed 2026-05-17)', () => {
    const midOut = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: 'mid',
      demandBand: null,
    });
    assert.ok(midOut.includes('<span class="band band-mid">規模 中</span>'));

    // 'medium' was dead-defensive and now correctly drops to silent
    // empty (the data layer never emitted it anyway).
    const medOut = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: 'medium',
      demandBand: null,
    });
    assert.equal(medOut, '');
  });

  test('demand_band: cold/normal/hot all render correctly (was bug pre-2026-05-17)', () => {
    // Data layer emits cold/normal/hot (per src/data/lib/bands.ts).
    // Previously the template's lookup keys were cool/warm/hot —
    // ~273 occupations silently lost their demand chip. Now fixed.
    const cold = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: null,
      demandBand: 'cold',
    });
    assert.ok(cold.includes('<span class="band band-low">需要 安定</span>'));

    const normal = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: null,
      demandBand: 'normal',
    });
    assert.ok(normal.includes('<span class="band band-mid">需要 旺盛</span>'));

    const hot = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: null,
      demandBand: 'hot',
    });
    assert.ok(hot.includes('<span class="band band-high">需要 過熱</span>'));

    // Old legacy keys (cool/warm) no longer match → silent empty.
    const oldKey = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: null,
      demandBand: 'cool',
    });
    assert.equal(oldKey, '');
  });

  test('chip order: sector, then risk, then workforce, then demand', () => {
    const out = renderMetaRow({
      sectorJa: '医療',
      sectorId: 'healthcare',
      riskBand: 'mid',
      workforceBand: 'small',
      demandBand: 'hot',
    });
    const sectorAt = out.indexOf('sector-chip');
    const riskAt = out.indexOf('AI 影響');
    const workforceAt = out.indexOf('規模');
    const demandAt = out.indexOf('需要');
    assert.ok(sectorAt < riskAt && riskAt < workforceAt && workforceAt < demandAt);
  });

  test('XSS payload in sector name escaped', () => {
    const out = renderMetaRow({
      sectorJa: '<script>x</script>',
      sectorId: 'evil',
      riskBand: null,
      workforceBand: null,
      demandBand: null,
    });
    assert.ok(!out.includes('<script>x</script>'));
    assert.ok(out.includes('&lt;script&gt;x&lt;/script&gt;'));
  });

  test('unknown band value collapses chip silently', () => {
    const out = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: 'bogus',
      workforceBand: 'fake',
      demandBand: 'xyz',
    });
    assert.equal(out, ''); // no labels → no chips → empty row → empty SafeHtml
  });
});
