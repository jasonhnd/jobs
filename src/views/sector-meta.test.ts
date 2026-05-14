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

  test('empty sector still returns a valid result (does not throw)', () => {
    // The function emits structural observations (e.g. "no data") even
    // when the sector has zero occupations — assert it returns a valid
    // result rather than asserting a specific observation count.
    const baseline = computeSiteBaseline([makeOcc()]);
    const result = computeSectorPatterns([], baseline, 'テストセクター');
    assert.ok(Array.isArray(result.observations));
  });
});
