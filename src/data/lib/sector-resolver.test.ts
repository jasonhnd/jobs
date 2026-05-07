import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  fnmatchCase,
  resolveSector,
  validateSectorDefinitions,
  SENTINEL_UNCATEGORIZED,
} from './sector-resolver.js';
import type { SectorDef } from '../schema/sector.js';

// ───── Helpers ─────

function makeSector(
  id: string,
  seeds: string[],
  ja = id,
  en = id,
): SectorDef {
  return {
    id,
    ja,
    en,
    hue: 'mid',
    description_ja: null,
    mhlw_seed_codes: seeds,
  };
}

// ───── fnmatchCase ─────

test('fnmatchCase: exact match', () => {
  assert.equal(fnmatchCase('12_072-06', '12_072-06'), true);
  assert.equal(fnmatchCase('12_072-06', '12_072-07'), false);
});

test('fnmatchCase: trailing star', () => {
  assert.equal(fnmatchCase('12_072-06', '12_*'), true);
  assert.equal(fnmatchCase('13_072-06', '12_*'), false);
});

test('fnmatchCase: prefix slash with star', () => {
  assert.equal(fnmatchCase('12_072-06', '12_072*'), true);
  assert.equal(fnmatchCase('12_073-06', '12_072*'), false);
});

test('fnmatchCase: ? matches single char', () => {
  assert.equal(fnmatchCase('A1', 'A?'), true);
  assert.equal(fnmatchCase('A12', 'A?'), false);
});

test('fnmatchCase: literal underscore and hyphen', () => {
  assert.equal(fnmatchCase('12_072-06', '12_072-06'), true);
  // Ensure we did NOT regex-treat the underscore/hyphen.
  assert.equal(fnmatchCase('12X072-06', '12_072-06'), false);
});

// ───── resolveSector ─────

const SECTORS: SectorDef[] = [
  makeSector('iryo', ['11_*', '12_072*'], '医療'),
  makeSector('kaigo', ['12_080*'], '介護'),
];

test('resolveSector: override wins', () => {
  const result = resolveSector(428, '11_001-02', SECTORS, { '0428': 'kaigo' });
  assert.equal(result.sector_id, 'kaigo');
  assert.equal(result.provenance, 'override');
});

test('resolveSector: no mhlw → uncategorized', () => {
  const result = resolveSector(1, null, SECTORS, {});
  assert.equal(result.sector_id, SENTINEL_UNCATEGORIZED);
  assert.equal(result.provenance, 'no-mhlw');
});

test('resolveSector: empty mhlw → uncategorized', () => {
  const result = resolveSector(1, '', SECTORS, {});
  assert.equal(result.sector_id, SENTINEL_UNCATEGORIZED);
  assert.equal(result.provenance, 'no-mhlw');
});

test('resolveSector: single-match auto', () => {
  const result = resolveSector(1, '12_080-99', SECTORS, {});
  assert.equal(result.sector_id, 'kaigo');
  assert.equal(result.provenance, 'auto');
  assert.deepEqual([...result.matched_seeds], ['12_080*']);
});

test('resolveSector: 0 matches → unmatched', () => {
  const result = resolveSector(1, '99_999-99', SECTORS, {});
  assert.equal(result.sector_id, SENTINEL_UNCATEGORIZED);
  assert.equal(result.provenance, 'unmatched');
});

test('resolveSector: multi-match → first wins, ambiguous flagged', () => {
  // Both iryo and a hypothetical second sector match.
  const ambiguous: SectorDef[] = [
    makeSector('iryo', ['12_*']),
    makeSector('alt', ['12_080*']),
  ];
  const result = resolveSector(1, '12_080-99', ambiguous, {});
  assert.equal(result.sector_id, 'iryo'); // first wins
  assert.equal(result.provenance, 'auto-ambiguous');
  assert.deepEqual([...result.candidates].sort(), ['alt', 'iryo']);
});

test('resolveSector: padded id matches override key', () => {
  const result = resolveSector(7, null, SECTORS, { '0007': 'iryo' });
  assert.equal(result.sector_id, 'iryo');
});

// ───── validateSectorDefinitions ─────

test('validateSectorDefinitions: clean = empty', () => {
  assert.deepEqual(validateSectorDefinitions(SECTORS), []);
});

test('validateSectorDefinitions: catches sentinel collision', () => {
  const bad = [makeSector('_uncategorized', ['*'])];
  const problems = validateSectorDefinitions(bad);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /collides with the SENTINEL/);
});

test('validateSectorDefinitions: catches duplicates', () => {
  const dup = [makeSector('iryo', ['11_*']), makeSector('iryo', ['12_*'])];
  const problems = validateSectorDefinitions(dup);
  assert.equal(problems.some((p) => p.includes('duplicate sector id: iryo')), true);
});

test('validateSectorDefinitions: warns on no seeds', () => {
  const noSeeds = [makeSector('orphan', [])];
  const problems = validateSectorDefinitions(noSeeds);
  assert.equal(problems.some((p) => p.includes('no mhlw_seed_codes')), true);
});
