import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { HAID_LEVELS_NOTE_JA } from '../site/haid-spec.js';
import type { HaidReleasePayload } from '../site/haid-release-types.js';
import { MAP_MIN_COLUMN_PCT, MAP_MIN_ROW_PCT, buildHaidReleasePageModel } from './haid-release.js';

function loadLatest(): HaidReleasePayload {
  return JSON.parse(readFileSync(join(process.cwd(), 'public', 'data.haid-latest.json'), 'utf-8'));
}

describe('HAID release page model (2026-q3 draft)', () => {
  const model = buildHaidReleasePageModel(loadLatest(), HAID_LEVELS_NOTE_JA);

  test('four columns left to right in relation order, widths sum to 100', () => {
    const cols = model.map.columns;
    assert.deepEqual(cols.map((c) => c.relation), ['none', 'tool', 'presence', 'union']);
    const total = cols.reduce((acc, c) => acc + c.widthPct, 0);
    assert.ok(Math.abs(total - 100) < 1e-9, `widths sum ${total}`);
    for (let i = 1; i < cols.length; i += 1) {
      assert.ok(Math.abs(cols[i].leftPct - (cols[i - 1].leftPct + cols[i - 1].widthPct)) < 1e-9);
    }
    assert.ok(cols[0].widthPct > cols[1].widthPct, '無縁 is wider than 道具 in 2026');
  });

  test('data-less relations get the minimum column and are hatched', () => {
    const [none, tool, presence, union] = model.map.columns;
    assert.equal(none.hatched, false);
    assert.equal(tool.hatched, false);
    assert.equal(presence.hatched, true);
    assert.equal(union.hatched, true);
    assert.equal(presence.widthPct, MAP_MIN_COLUMN_PCT);
    assert.equal(union.widthPct, MAP_MIN_COLUMN_PCT);
    for (const cell of [...presence.cells, ...union.cells]) {
      assert.equal(cell.hatched, true);
      assert.equal(cell.people, null);
      assert.equal(cell.inflated, true);
    }
  });

  test('rows inside a column stack from the top and sum to 100; tiny rows are raised to the minimum', () => {
    for (const col of model.map.columns) {
      const total = col.cells.reduce((acc, c) => acc + c.heightPct, 0);
      assert.ok(Math.abs(total - 100) < 1e-9, `${col.relation} rows sum ${total}`);
      let top = 0;
      for (const cell of col.cells) {
        assert.ok(Math.abs(cell.topPct - top) < 1e-9);
        assert.ok(cell.heightPct >= MAP_MIN_ROW_PCT - 1e-9);
        top += cell.heightPct;
      }
    }
    const six = model.map.columns[1].cells.find((c) => c.level === 6)!;
    assert.equal(six.inflated, true);
    assert.equal(six.heightPct, MAP_MIN_ROW_PCT);
  });

  test('levels are numbered 1..10 across the map, ids are dan-<level>', () => {
    const levels = model.map.columns.flatMap((c) => c.cells.map((cell) => cell.level));
    assert.deepEqual(levels, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(model.map.columns[1].cells.map((c) => c.id), ['dan-3', 'dan-4', 'dan-5', 'dan-6']);
  });

  test('the three boundaries sit on column edges; 2→3 is dashed because level 3 is a lower bound', () => {
    const b = model.map.boundaries;
    assert.deepEqual(b.map((x) => [x.from, x.to]), [[2, 3], [6, 7], [8, 9]]);
    assert.equal(b[0].leftPct, model.map.columns[1].leftPct);
    assert.equal(b[1].leftPct, model.map.columns[2].leftPct);
    assert.equal(b[2].leftPct, model.map.columns[3].leftPct);
    assert.equal(b[0].dashed, true);
    assert.equal(b[1].dashed, true, '6→7: level 6 is a lower bound');
    assert.equal(b[2].dashed, false);
  });

  test('map notes name the inflated levels and the dashed boundaries', () => {
    assert.ok(model.map.notes.some((n) => n.includes('第 6 段階と第 7〜10 段階')), model.map.notes.join(' | '));
    assert.ok(model.map.notes.some((n) => n.includes('第 3 段階は下限しか分からない')));
  });

  test('list rows: ten rows, group starts and boundaries in place, bars are N(≥k)/population', () => {
    const rows = model.list.rows;
    assert.equal(rows.length, 10);
    assert.deepEqual(rows.filter((r) => r.groupStart).map((r) => r.level), [1, 3, 7, 9]);
    assert.deepEqual(rows.filter((r) => r.boundaryBefore).map((r) => r.level), [3, 7, 9]);
    assert.equal(rows[0].barPct, 100);
    assert.ok(rows[1].barPct! < 100 && rows[1].barPct! > rows[3].barPct!);
    assert.equal(rows[6].barPct, null);
    assert.equal(rows[6].atLeastCertaintyJa, 'データなし');
    assert.equal(rows[2].atLeastCertaintyJa, '下限のみ');
    assert.equal(rows[3].atLeastRangeJa, '10 億〜25 億');
    assert.equal(rows[3].anchors.length, 3);
    assert.equal(rows[0].definitionHref, '/haid#level-1');
  });

  test('headline and fact block use 1 significant figure for estimates, 2 for the population', () => {
    assert.deepEqual(model.lead.population, { value: '83', unit: '億' });
    assert.deepEqual(model.lead.prompted, { value: '20', unit: '億' });
    assert.ok(model.fact.body.includes('人類 83 億 人のうち'));
    assert.ok(model.fact.body.includes('およそ 20 億 人'));
    assert.ok(model.fact.body.includes('およそ 8 億 人'));
    assert.ok(model.fact.body.includes('HAID v1.0'));
  });

  test('draft meta: 草稿 note, planned publish date, first round, next quarter label', () => {
    assert.equal(model.isDraft, true);
    assert.ok(model.draftNote);
    assert.ok(model.metaParts.some((m) => m.startsWith('公開予定 2026-10-24')));
    assert.ok(model.metaParts.includes('第 1 回'));
    assert.ok(model.delta.body.includes('2026-Q4'));
    assert.equal(model.path, '/aiadoption/2026-q3');
    assert.equal(model.seo.title, '人類と AI の距離 — 2026 年 第 3 四半期 | 未来の仕事');
  });

  test('anchor table lists every anchor with grade and placeholder flag', () => {
    assert.equal(model.anchorsTable.rows.length, 8);
    assert.ok(model.anchorsTable.rows.every((r) => r.placeholder));
    assert.ok(model.anchorsTable.rows.some((r) => r.valueJa === '3,400 万'));
  });
});
