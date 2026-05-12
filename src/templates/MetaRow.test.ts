/**
 * MetaRow.test.ts — pin the byte-for-byte output of the sector + band
 * chip row extracted from [id].astro.
 *
 * NOTE on the demand_band bug:
 * The template intentionally checks `'cool' | 'warm' | 'hot'` while
 * data ships `'cold' | 'normal' | 'hot'`. These tests preserve the
 * legacy behaviour (drop cold/normal silently). Fixing this is a
 * separate, baseline-rebasing concern — see MetaRow.ts file header.
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
        '<a class="sector-chip" href="/ja/sectors/healthcare">医療</a>' +
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

  test('workforce_band accepts both "mid" and "medium" (defensive parity)', () => {
    const midOut = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: 'mid',
      demandBand: null,
    });
    const medOut = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: 'medium',
      demandBand: null,
    });
    // Both render the same label + same band-mid class.
    assert.ok(midOut.includes('<span class="band band-mid">規模 中</span>'));
    assert.ok(medOut.includes('<span class="band band-mid">規模 中</span>'));
  });

  test('demand_band BUG PARITY: cold/normal render no chip; cool/warm/hot do', () => {
    // Data layer emits cold/normal/hot, but the template's lookup
    // keys are cool/warm/hot — so 273 occupations silently lose the
    // demand chip on live today. Preserved for SEO-baseline parity.
    const data = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: null,
      demandBand: 'cold',
    });
    assert.equal(data, ''); // no chip → row collapses to empty
    const dataN = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: null,
      demandBand: 'normal',
    });
    assert.equal(dataN, '');

    // Labelled keys DO render today (a small slice of occupations).
    const labelled = renderMetaRow({
      sectorJa: null,
      sectorId: undefined,
      riskBand: null,
      workforceBand: null,
      demandBand: 'warm',
    });
    assert.ok(labelled.includes('<span class="band band-mid">需要 旺盛</span>'));
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
