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
    assert.equal(rows[3].atLeastRangeJa, '9.6 億〜20 億');
    assert.equal(rows[3].anchors.length, 13);
    assert.equal(rows[0].definitionHref, '/haid#level-1');
  });

  test('headline and fact block use 1 significant figure for estimates, 2 for the population', () => {
    assert.deepEqual(model.lead.population, { value: '83', unit: '億' });
    assert.deepEqual(model.lead.prompted, { value: '10', unit: '億' });
    assert.ok(model.fact.body.includes('人類 83 億 人のうち'));
    assert.ok(model.fact.body.includes('およそ 10 億 人'), model.fact.body);
    assert.ok(model.fact.body.includes('およそ 9 億 人'), model.fact.body);
    assert.ok(model.fact.body.includes('HAID v1.0'));
  });

  test('draft meta: 草稿 note, planned publish date, round number, permalink, latest canonical', () => {
    assert.equal(model.isDraft, true);
    assert.ok(model.draftNote);
    assert.ok(model.metaParts.some((m) => m.startsWith('公開予定 2026-10-24')));
    assert.ok(model.metaParts.includes('第 2 回'));
    assert.equal(model.round, 2);
    assert.equal(model.isLatest, true);
    assert.equal(model.path, '/aiadoption/2026-q3');
    assert.equal(model.canonicalPath, '/aiadoption');
    assert.equal(model.seo.title, '人類と AI の距離 — 2026 年 第 3 四半期 | 未来の仕事');
  });

  test('switcher lists every release newest first; the latest points at /aiadoption', () => {
    const items = model.switcher.items;
    assert.deepEqual(items.map((i) => i.release), ['2026-q3', '2026-q2']);
    assert.equal(items[0].current, true);
    assert.equal(items[0].latest, true);
    assert.equal(items[0].href, '/aiadoption');
    assert.equal(items[1].href, '/aiadoption/2026-q2');
    assert.equal(items[1].labelJa, '2026 年 第 2 四半期');
  });

  test('前回との変動 compares N(≥k) with 2026-q2 and flags method changes and missing data', () => {
    assert.ok(model.delta.body.includes('2026 年 第 2 四半期'));
    const rows = model.delta.rows;
    assert.equal(rows.length, 10);
    const byLevel = Object.fromEntries(rows.map((r) => [r.level, r]));
    assert.equal(byLevel[1].kind, 'flat');
    assert.equal(byLevel[4].kind, 'method', 'both range, but Q2 cited grade-C panels and Q3 grade-B announcements');
    assert.equal(byLevel[2].kind, 'method', 'level 2: DataReportal (C) → ITU (A)');
    assert.equal(byLevel[4].deltaJa, '数え方が変わった');
    assert.equal(byLevel[3].kind, 'none', 'Q2 had no level-3 data');
    assert.equal(byLevel[5].kind, 'none');
    assert.equal(byLevel[6].kind, 'method', 'level 6: GitHub Copilot (Q2) → Codex (Q3), a different anchor');
    assert.equal(byLevel[7].kind, 'none');
  });

  test('数字の出どころと計算 builds one card per level: inputs → steps → result', () => {
    const cards = model.provenance.cards;
    assert.equal(model.provenance.rules.length, 3);
    assert.deepEqual(cards.map((c) => c.levelJa), ['第 1 段階', '第 2 段階', '第 3 段階', '第 4 段階', '第 5 段階', '第 6 段階', '第 7〜10 段階']);
    const by = Object.fromEntries(cards.map((c) => [c.level, c]));
    assert.equal(by[1].howJa, '公表値が 1 つなので、そのまま使う。');
    assert.equal(by[1].inputs[0].entityJa, '国連 世界人口推計');
    assert.equal(by[1].inputs[0].valueJa, '83 億');
    assert.equal(by[1].atLeastJa, '83 億');
    assert.equal(by[1].exactlyJa, 'ちょうどこの段階 n(1) = 83 億 − 60 億 = 23 億');
    assert.equal(by[3].howJa, '2 件の公表値は重なりが分からないため、最大の 1 社を下限とする。');
    assert.equal(by[3].steps[0].label, '最大の 1 社');
    assert.equal(by[3].steps[0].text, 'Google 検索の AI による概要 月間利用者 25 億');
    assert.equal(by[3].inputs.find((t) => t.picked)!.entityJa, 'Google 検索の AI による概要');
    assert.deepEqual(by[3].inputs.find((t) => t.entityJa === 'Meta AI')!.flags, ['古い']);
    assert.ok(by[3].notes.some((n) => n.includes('Meta AI') && n.includes('12 か月より古い')), by[3].notes.join('|'));
    assert.equal(by[3].atLeastJa, '25 億+');
    assert.equal(by[4].howJa, '市場ごとに積み上げ、独立した上からの推計（人口 × 利用率）と突き合わせる。');
    assert.deepEqual(by[4].steps.map((s) => s.label), ['中国以外', '中国', '積み上げ', '上から', '参考']);
    assert.equal(by[4].steps[0].text, '7 社を足すと 35 億。重なり率 58% を引いて 15 億');
    assert.equal(by[4].steps[1].text, 'QuestMobile の重複除去済み合計をそのまま使う → 5 億');
    assert.equal(by[4].steps[2].text, '15 億 + 5 億 = 20 億');
    assert.ok(by[4].steps[3].text.startsWith('国連 世界人口推計 15〜64 歳人口（2026 年） 54 億 × 利用率 17.8% = 9.6 億'), by[4].steps[3].text);
    assert.equal(by[4].steps[4].text, '重なりを引かない単純合計は 42 億');
    assert.deepEqual(by[4].range, { lowJa: '9.6 億', highJa: '20 億', midJa: '14 億', lowFromJa: '低（上から）', highFromJa: '高（積み上げ）', midRuleJa: '中 = √(低 × 高)', midPct: 41.2 });
    assert.equal(by[4].inputs.find((t) => t.id === 'chatgpt_weekly_2026')!.marketJa, '中国以外');
    assert.deepEqual(by[4].inputGroups.map((g) => [g.labelJa, g.items.length]), [['中国以外', 7], ['中国', 5], ['世界', 1]]);
    assert.deepEqual(by[1].inputGroups.map((g) => g.labelJa), [null]);
    assert.deepEqual(by[4].inputs.find((t) => t.id === 'chatgpt_weekly_2026')!.flags, ['7 日口径']);
    assert.equal(by[4].inputs.find((t) => t.id === 'questmobile_ai_native_union_2026_05')!.kind, 'union');
    assert.ok(by[4].notes.some((n) => n.includes('ChatGPT 週間利用者 は 7 日口径')), by[4].notes.join('|'));
    assert.equal(by[4].exactlyJa, 'ちょうどこの段階 n(4) = 14 億 − 9 億 = 4.7 億');
    assert.equal(by[1].inputs[0].marketJa, null, 'market shown only on the split level');
    assert.deepEqual(by[7].levels, [7, 8, 9, 10]);
    assert.equal(by[7].howJa, 'この段階以上の人数を示す公表値がない。');
    assert.equal(by[7].atLeastJa, '—');
    assert.equal(by[7].exactlyJa, null);
    assert.equal(by[7].ja, '');
  });

  test('an archived release is not latest and gets its own canonical', () => {
    const q2: HaidReleasePayload = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data.haid-2026-q2.json'), 'utf-8'));
    const a = buildHaidReleasePageModel(q2, HAID_LEVELS_NOTE_JA, { '2026-q3': '2026 年 第 3 四半期' });
    assert.equal(a.isLatest, false);
    assert.equal(a.round, 1);
    assert.equal(a.canonicalPath, '/aiadoption/2026-q2');
    assert.ok(a.delta.body.includes('2026-Q3'));
    assert.equal(a.delta.rows.length, 0);
    assert.equal(a.map.columns[1].cells.find((c) => c.level === 3)?.hatched, true, 'Q2 level 3 is データなし inside the 道具 column');
    assert.equal(a.map.columns[1].cells.find((c) => c.level === 5)?.people, null);
    assert.ok(a.fact.body.includes('第 5 段階以上はこの回は公開データなし'), a.fact.body);
    const p3 = a.provenance.cards.find((c) => c.level === 3)!;
    assert.deepEqual(p3.levels, [3], 'a nested-only level keeps its own card');
    assert.equal(p3.inputs.length, 0);
    assert.equal(p3.notes[0], '公表値はないが、N(≥4) = 21 億 を下回れないため、21 億 に合わせた。');
    assert.equal(p3.atLeastJa, '—');
    const p4 = a.provenance.cards.find((c) => c.level === 4)!;
    assert.equal(p4.range?.midRuleJa, '中 = 高 × (1 − 重なり率)');
    assert.equal(a.provenance.cards[a.provenance.cards.length - 1].levelJa, '第 7〜10 段階');
    assert.ok(!a.fact.body.includes('3,000 万'));
  });

  test('anchor table lists every anchor with grade and placeholder flag', () => {
    assert.equal(model.anchorsTable.rows.length, 21);
    assert.ok(model.anchorsTable.rows.find((r) => r.id === 'meta_ai_monthly_2025')!.stale, 'Meta AI 2025-05 is 古い');
    assert.equal(model.anchorsTable.rows.find((r) => r.id === 'questmobile_ai_native_union_2026_05')!.marketJa, '中国');
    assert.ok(model.anchorsTable.rows.every((r) => r.placeholder));
    assert.ok(model.anchorsTable.rows.some((r) => r.valueJa === '5,000 万'));
    assert.ok(model.list.paymentNote.includes('少なくとも 5,000 万 人'), model.list.paymentNote);
  });
});
