/**
 * sector-meta.test.ts — pin the 16-sector essay catalog + the pattern
 * derivation helper (computeSectorPatterns). The sector hub pages
 * read these directly; if a sector goes missing or a pattern
 * computation regresses, this gate catches it before SEO baseline.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  SECTOR_ESSAYS,
  computeSectorPatterns,
  computeSiteBaseline,
  getSectorEssay,
  type SectorId,
  type SectorOcc,
} from './sector-meta.js';

const ALL_SECTOR_IDS: ReadonlyArray<SectorId> = [
  'iryo', 'fukushi', 'kyoiku', 'hoan', 'noringyo',
  'senmon', 'it', 'shigyo', 'creative', 'jimu',
  'hanbai', 'service', 'seizo', 'maint', 'kensetu', 'keiseki',
];

describe('SECTOR_ESSAYS — coverage', () => {
  test('every SectorId has an essay entry', () => {
    for (const id of ALL_SECTOR_IDS) {
      assert.ok(SECTOR_ESSAYS[id], `missing essay for: ${id}`);
    }
  });

  test('all essays have non-empty ai_era_essay_ja with Japanese characters', () => {
    for (const id of ALL_SECTOR_IDS) {
      const e = SECTOR_ESSAYS[id];
      assert.ok(e.ai_era_essay_ja.length >= 100, `${id}: essay too short`);
      assert.match(e.ai_era_essay_ja, /[぀-ヿ一-鿿]/, `${id}: no Japanese chars`);
    }
  });

  test('all essays have ≥ 1 finding_hints_ja entry', () => {
    for (const id of ALL_SECTOR_IDS) {
      const e = SECTOR_ESSAYS[id];
      assert.ok(e.finding_hints_ja.length >= 1);
    }
  });

  test('essay.id matches the keyed entry', () => {
    for (const id of ALL_SECTOR_IDS) {
      assert.equal(SECTOR_ESSAYS[id].id, id);
    }
  });
});

describe('getSectorEssay — lookup', () => {
  test('returns the essay for each known SectorId', () => {
    for (const id of ALL_SECTOR_IDS) {
      const e = getSectorEssay(id);
      assert.ok(e !== null, `essay missing for ${id}`);
      assert.equal(e!.id, id);
    }
  });

  test('returns null for unknown sectorId', () => {
    assert.equal(getSectorEssay('not-a-real-sector'), null);
  });
});

describe('computeSiteBaseline — site-wide aggregates', () => {
  // computeSiteBaseline takes the full occupation list and returns
  // global means used as comparison baselines on sector hubs.
  function makeOcc(overrides: Partial<SectorOcc> = {}): SectorOcc {
    return {
      id: 1,
      title_ja: 'test',
      sector_id: 'iryo',
      ai_risk: 5,
      risk_band: 'mid',
      workers: 1000,
      salary_man_yen: 400,
      monthly_hours: 160,
      ...overrides,
    } as SectorOcc;
  }

  test('returns numeric aggregates on a non-empty list', () => {
    const occs = [makeOcc({ ai_risk: 3 }), makeOcc({ ai_risk: 7 })];
    const b = computeSiteBaseline(occs);
    assert.equal(typeof b.ai_risk_mean, 'number');
    assert.equal(typeof b.salary_mean, 'number');
    assert.equal(typeof b.hours_mean, 'number');
  });

  test('mean of [3, 7] ai_risk is 5', () => {
    const occs = [makeOcc({ ai_risk: 3 }), makeOcc({ ai_risk: 7 })];
    const b = computeSiteBaseline(occs);
    assert.equal(b.ai_risk_mean, 5);
  });
});

describe('computeSectorPatterns — per-sector observation derivation', () => {
  function makeOcc(overrides: Partial<SectorOcc> = {}): SectorOcc {
    return {
      id: 1,
      title_ja: 'test',
      sector_id: 'iryo',
      ai_risk: 5,
      risk_band: 'mid',
      workers: 1000,
      salary_man_yen: 400,
      monthly_hours: 160,
      ...overrides,
    } as SectorOcc;
  }

  test('returns a result object with observations array', () => {
    const baseline = computeSiteBaseline([makeOcc()]);
    const result = computeSectorPatterns([makeOcc()], baseline, 'テストセクター');
    assert.ok(Array.isArray(result.observations));
  });

  test('low/mid/high count the displayed value: low < 4.0 <= mid < 7.0 <= high (#864)', () => {
    const risks = [3.6, 3.9333333333333336, 3.9666666666666663, 6.933333333333334, 6.966666666666667, 3.0333333333333337, 7.5];
    const occs = risks.map((ai_risk, i) => makeOcc({ id: i + 1, ai_risk }));
    const result = computeSectorPatterns(occs, computeSiteBaseline(occs), 'テストセクター');
    // low: 3.6, 3.9 (3.9333), 3.0 (3.0333) · mid: 4.0 (3.9667), 6.9 (6.9333) · high: 7.0 (6.9667), 7.5
    assert.equal(result.ai_low_count, 3);
    assert.equal(result.ai_mid_count, 2);
    assert.equal(result.ai_high_count, 2);
  });

  test('every scored occupation lands in exactly one band for every k/30 mean (#864)', () => {
    const occs = Array.from({ length: 301 }, (_, k) => makeOcc({ id: k + 1, ai_risk: k / 30 }));
    const result = computeSectorPatterns(occs, computeSiteBaseline(occs), 'テストセクター');
    assert.equal(result.ai_low_count + result.ai_mid_count + result.ai_high_count, occs.length);
    assert.equal(Math.round(result.ai_low_pct + result.ai_mid_pct + result.ai_high_pct), 100);
  });

  test('empty sector still returns a valid result (does not throw)', () => {
    // The function emits structural observations (e.g. "no data") even
    // when the sector has zero occupations — assert it returns a valid
    // result rather than asserting a specific observation count.
    const baseline = computeSiteBaseline([makeOcc()]);
    const result = computeSectorPatterns([], baseline, 'テストセクター');
    assert.ok(Array.isArray(result.observations));
  });
});
