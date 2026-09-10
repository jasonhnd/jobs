import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  HAID_BOUNDARIES,
  HAID_CASES,
  HAID_CERTAINTY_JA,
  HAID_LEVELS,
  HAID_RELATIONS,
  HAID_SPEC_VERSION,
  HAID_WINDOW_JA,
  haidBoundaryBefore,
  haidRelationOf,
} from './haid-spec.js';

describe('HAID spec invariants', () => {
  test('exactly ten levels numbered 1..10 in order', () => {
    assert.equal(HAID_LEVELS.length, 10);
    HAID_LEVELS.forEach((lv, i) => assert.equal(lv.level, i + 1));
  });

  test('level names and criteria are unique per level number', () => {
    const ja = new Set(HAID_LEVELS.map((l) => l.ja));
    const en = new Set(HAID_LEVELS.map((l) => l.en));
    assert.equal(ja.size, 10);
    assert.equal(en.size, 10);
    // Levels 4 and 5 deliberately share a criterion and differ only by window.
    assert.equal(HAID_LEVELS[3]?.criterion_ja, HAID_LEVELS[4]?.criterion_ja);
    assert.notEqual(HAID_LEVELS[3]?.window, HAID_LEVELS[4]?.window);
  });

  test('four relations tile 1..10 contiguously in order', () => {
    assert.equal(HAID_RELATIONS.length, 4);
    let expectedStart = 1;
    HAID_RELATIONS.forEach((r, i) => {
      assert.equal(r.order, i + 1);
      assert.equal(r.levels[0], expectedStart);
      assert.ok(r.levels[1] >= r.levels[0]);
      expectedStart = r.levels[1] + 1;
    });
    assert.equal(expectedStart, 11);
    for (const lv of HAID_LEVELS) {
      assert.equal(haidRelationOf(lv.level).id, lv.relation);
    }
  });

  test('the three named boundaries sit exactly on relation edges', () => {
    assert.equal(HAID_BOUNDARIES.length, 3);
    const edges = HAID_RELATIONS.slice(1).map((r) => r.levels[0]);
    assert.deepEqual(HAID_BOUNDARIES.map((b) => b.to), edges);
    for (const b of HAID_BOUNDARIES) {
      assert.equal(b.from + 1, b.to);
      assert.equal(haidBoundaryBefore(b.to)?.ja, b.ja);
    }
    assert.equal(haidBoundaryBefore(5), null);
  });

  test('every level carries a known window and certainty label', () => {
    for (const lv of HAID_LEVELS) {
      assert.ok(lv.window in HAID_WINDOW_JA, `window ${lv.window}`);
      assert.ok(lv.certainty_2026 in HAID_CERTAINTY_JA, `certainty ${lv.certainty_2026}`);
      assert.ok(lv.window_ja.length > 0);
    }
    // Presence and Union have no 2026 anchors: the spec must say so, not guess.
    for (const lv of HAID_LEVELS.filter((l) => l.level >= 7)) {
      assert.equal(lv.certainty_2026, 'none');
    }
    assert.equal(HAID_LEVELS[0]?.certainty_2026, 'measured');
  });

  test('boundary rulings only reference existing levels', () => {
    assert.ok(HAID_CASES.length >= 8);
    for (const c of HAID_CASES) {
      for (const lv of c.levels) {
        assert.ok(lv >= 1 && lv <= 10, `${c.case_ja} -> ${lv}`);
      }
    }
    // At least one ruling explicitly excludes non-generative features.
    assert.ok(HAID_CASES.some((c) => c.levels.length === 0));
  });

  test('version string is a frozen major.minor', () => {
    assert.match(HAID_SPEC_VERSION, /^\d+\.\d+$/);
  });
});
