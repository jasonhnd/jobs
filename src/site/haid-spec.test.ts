import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  HAID_BOUNDARIES,
  HAID_CANONICAL_PATH,
  HAID_CASES,
  HAID_GRADE_JA,
  HAID_LEAD_JA,
  HAID_LEVELS,
  HAID_LEVELS_NOTE_JA,
  HAID_RELATIONS,
  HAID_SPEC_DATE,
  HAID_SPEC_VERSION,
  HAID_TERMS,
  HAID_WINDOW_JA,
  haidBoundaryBefore,
  haidRelationOf,
} from './haid-spec.js';

describe('HAID spec invariants', () => {
  test('exactly 10 levels numbered 1..10 in order', () => {
    assert.equal(HAID_LEVELS.length, 10);
    for (let i = 0; i < HAID_LEVELS.length; i += 1) {
      assert.equal(HAID_LEVELS[i].level, i + 1);
    }
  });

  test('ja and en are unique across levels; 4 and 5 share criterion and differ in window', () => {
    const ja = HAID_LEVELS.map((l) => l.ja);
    const en = HAID_LEVELS.map((l) => l.en);
    assert.equal(ja.length, new Set(ja).size);
    assert.equal(en.length, new Set(en).size);
    assert.equal(HAID_LEVELS[3].criterion_ja, HAID_LEVELS[4].criterion_ja);
    assert.equal(HAID_LEVELS[3].criterion_en, HAID_LEVELS[4].criterion_en);
    assert.notEqual(HAID_LEVELS[3].window, HAID_LEVELS[4].window);
  });

  test('4 relations tile 1..10 with no gap or overlap', () => {
    assert.equal(HAID_RELATIONS.length, 4);
    HAID_RELATIONS.forEach((r, i) => {
      assert.equal(r.order, i + 1);
    });
    let next = 1;
    for (const r of HAID_RELATIONS) {
      assert.equal(r.levels[0], next);
      assert.ok(r.levels[1] >= r.levels[0]);
      next = r.levels[1] + 1;
    }
    assert.equal(next, 11);
    for (const level of HAID_LEVELS) {
      assert.equal(haidRelationOf(level.level).id, level.relation);
    }
    assert.throws(() => haidRelationOf(0), RangeError);
    assert.throws(() => haidRelationOf(11), RangeError);
  });

  test('3 boundaries sit on the first level of relations 2..4', () => {
    assert.equal(HAID_BOUNDARIES.length, 3);
    for (let i = 0; i < HAID_BOUNDARIES.length; i += 1) {
      const boundary = HAID_BOUNDARIES[i];
      const relation = HAID_RELATIONS[i + 1];
      assert.equal(boundary.to, relation.levels[0]);
      assert.equal(boundary.from + 1, boundary.to);
    }
    assert.equal(haidBoundaryBefore(3)?.ja, 'AI が届いた');
    assert.equal(haidBoundaryBefore(5), null);
  });

  test('every level has a known window, grades, measurement and criterion_en', () => {
    for (const level of HAID_LEVELS) {
      assert.ok(level.window in HAID_WINDOW_JA);
      assert.ok(level.grades.length >= 1);
      for (const grade of level.grades) {
        assert.ok(grade in HAID_GRADE_JA);
      }
      assert.ok(level.measurement_ja.length > 0);
      assert.ok(level.criterion_en.length > 0);
    }
  });

  test('grade bands: 1–2 A, 3 and 6 B, 7–10 D-only survey', () => {
    assert.deepEqual([...HAID_LEVELS[0].grades], ['A']);
    assert.deepEqual([...HAID_LEVELS[1].grades], ['A']);
    assert.deepEqual([...HAID_LEVELS[2].grades], ['B']);
    assert.deepEqual([...HAID_LEVELS[5].grades], ['B']);
    for (const level of HAID_LEVELS.filter((l) => l.level >= 7)) {
      assert.deepEqual([...level.grades], ['D']);
      assert.ok(level.measurement_ja.startsWith('D 調査のみ'));
    }
  });

  test('no per-level certainty field', () => {
    for (const level of HAID_LEVELS) {
      const keys = Object.keys(level);
      assert.ok(!keys.includes('certainty'));
      assert.ok(!keys.includes('certainty_2026'));
    }
  });

  test('ten rulings; referenced levels in 1..10; one 対象外', () => {
    assert.equal(HAID_CASES.length, 10);
    let empty = 0;
    for (const ruling of HAID_CASES) {
      if (ruling.levels.length === 0) empty += 1;
      for (const n of ruling.levels) {
        assert.ok(n >= 1 && n <= 10);
      }
    }
    assert.equal(empty, 1);
  });

  test('version, frozen date, canonical path, lead opener', () => {
    assert.match(HAID_SPEC_VERSION, /^\d+\.\d+$/);
    assert.equal(HAID_SPEC_DATE, '2026-09-11');
    assert.equal(HAID_CANONICAL_PATH, '/haid');
    assert.ok(HAID_LEAD_JA[0].startsWith('「AI をどれだけの人が使っているか」'));
  });

  test('byte-identity against docs/HAID.md', () => {
    const doc = readFileSync('docs/HAID.md', 'utf8');
    for (const level of HAID_LEVELS) {
      assert.ok(doc.includes(level.criterion_ja), level.criterion_ja);
      assert.ok(doc.includes(level.ja), level.ja);
    }
    for (const boundary of HAID_BOUNDARIES) {
      assert.ok(doc.includes(boundary.ja), boundary.ja);
    }
    for (const term of HAID_TERMS) {
      assert.ok(doc.includes(term.definition_ja), term.definition_ja);
    }
    assert.ok(doc.includes(HAID_LEAD_JA[0]));
    assert.ok(doc.includes(HAID_LEAD_JA[1]));
    assert.ok(doc.includes(HAID_LEVELS_NOTE_JA));
  });
});
