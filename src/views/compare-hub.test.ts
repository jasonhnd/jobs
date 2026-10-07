import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildCompareBundle, type DetailFile } from './compare-hub.js';
import { COMPARE_META } from './compare-meta.js';
import { CONSENSUS_FAQ_SENTENCE } from '../site/consensus-copy.js';

const meta = COMPARE_META[0]!;

function firstPair(a: Partial<DetailFile>, b: Partial<DetailFile>) {
  return buildCompareBundle((id) => ({ id, ...(id === meta.occ_a_id ? a : b) }))
    .results.get(meta.slug)!;
}

test('compare bundle loads both sides in catalogue order and maps every index card', () => {
  const calls: number[] = [];
  const bundle = buildCompareBundle((id) => {
    calls.push(id);
    return { id, title: { ja: `Occupation ${id}` }, ai_risk: { score: id / 100 } };
  });
  assert.deepEqual(calls, COMPARE_META.flatMap((m) => [m.occ_a_id, m.occ_b_id]));
  assert.deepEqual([...bundle.results.keys()], COMPARE_META.map((m) => m.slug));
  assert.equal(bundle.hub.cards.length, COMPARE_META.length);
  for (const [index, m] of COMPARE_META.entries()) {
    const result = bundle.results.get(m.slug)!;
    assert.strictEqual(result.meta, m);
    assert.equal(result.a.id, m.occ_a_id);
    assert.equal(result.b.id, m.occ_b_id);
    assert.deepEqual(bundle.hub.cards[index], {
      slug: m.slug, title_ja: m.title_ja, description_ja: m.description_ja,
      a_name: `Occupation ${m.occ_a_id}`, b_name: `Occupation ${m.occ_b_id}`,
      a_risk: m.occ_a_id / 100, b_risk: m.occ_b_id / 100,
      featured: m.featured === true,
    });
  }
  assert.ok(bundle.hub.cards.some((card) => card.featured));
  assert.ok(bundle.hub.cards.some((card) => !card.featured));
});

test('compare sides preserve source data and limit skills without mutating the input', () => {
  const skills = Array.from({ length: 7 }, (_, i) => ({ key: `skill-${i}`, label_ja: `Skill ${i}`, score: i }));
  const a: DetailFile = {
    id: meta.occ_a_id, title: { ja: 'A' }, ai_risk: { score: 3.45, rationale_ja: 'Rationale' },
    risk_band: 'low', description: { summary_ja: 'Summary' },
    stats: { salary_man_yen: 501.9, workers: 12345.7, monthly_hours: 160, average_age: 40.25, recruit_ratio: 1.234 },
    sector: { id: 'sector-a', ja: 'Sector A' }, related_certs_ja: ['Cert 1', 'Cert 2', 'Cert 3'], skills_top10: skills,
  };
  const before = structuredClone(a);
  const result = firstPair(a, {
    title: { ja: 'B' }, ai_risk: { score: 5.5 },
    stats: { salary_man_yen: 400.2, workers: 2000, monthly_hours: 170, average_age: 39, recruit_ratio: 1.1 },
    sector: { id: 'sector-b', ja: 'Sector B' }, related_certs_ja: ['Cert B'],
  });
  assert.deepEqual(result.a, {
    id: a.id, name_ja: 'A', ai_risk: 3.45, risk_band: 'low', rationale_ja: 'Rationale', summary_ja: 'Summary',
    salary: 501.9, workers: 12345.7, monthly_hours: 160, average_age: 40.25, recruit_ratio: 1.234,
    sector_id: 'sector-a', sector_ja: 'Sector A', related_certs_ja: a.related_certs_ja, top_skills: skills.slice(0, 5),
  });
  assert.deepEqual(result.rows, [
    { label: 'AI 影響度', a_val: '3.5/10 変化 小さい', b_val: '5.5/10 変化 中くらい', note: 'A は B より -2.0' },
    { label: '年収 (平均)', a_val: '501 万円', b_val: '400 万円', note: 'A は B より +101.7 万円' },
    { label: '就業者数', a_val: '12,345 人', b_val: '2,000 人', note: '' },
    { label: '月労働時間', a_val: '160 時間', b_val: '170 時間', note: 'A は B より -10 時間' },
    { label: '平均年齢', a_val: '40.3 歳', b_val: '39.0 歳', note: 'A は B より +1.3 歳' },
    { label: '求人倍率', a_val: '1.23 倍', b_val: '1.10 倍', note: 'A は B より +0.1 倍' },
    { label: 'セクター', a_val: 'Sector A', b_val: 'Sector B', note: '異なるセクター' },
    { label: '関連資格', a_val: 'Cert 1、Cert 2 他', b_val: 'Cert B', note: '' },
  ]);
  assert.deepEqual(a, before);
});

test('compare absent and null fields use placeholders and omit unavailable FAQs', () => {
  const result = firstPair({}, { title: {}, ai_risk: null, stats: null, sector: null, skills_top10: null });
  for (const side of [result.a, result.b]) {
    assert.deepEqual(side, {
      id: side.id, name_ja: `#${side.id}`, ai_risk: null, risk_band: null, rationale_ja: null, summary_ja: null,
      salary: null, workers: null, monthly_hours: null, average_age: null, recruit_ratio: null,
      sector_id: null, sector_ja: null, related_certs_ja: [], top_skills: [],
    });
  }
  assert.deepEqual(result.rows.map((row) => [row.a_val, row.b_val, row.note]),
    Array.from({ length: 8 }, (_, i) => [i === 2 ? '— 人' : '—', i === 2 ? '— 人' : '—', '']));
  assert.equal(result.faqItems.length, 2);
  assert.deepEqual(result.faqItems[0], [`#${meta.occ_a_id} と #${meta.occ_b_id} の違いは？`, meta.description_ja]);
  assert.ok(result.faqItems[1]![1].includes(meta.decision_hints_ja.join('。')));
});

test('compare equal and nearly equal values suppress difference notes', () => {
  const result = firstPair(
    { ai_risk: { score: 4 }, stats: { salary_man_yen: 500, monthly_hours: 160, average_age: 40, recruit_ratio: 1 }, sector: { id: 'same' }, related_certs_ja: ['One', 'Two'] },
    { ai_risk: { score: 4 }, stats: { salary_man_yen: 500, monthly_hours: 160.005, average_age: 40, recruit_ratio: 1.005 }, sector: { id: 'same' } },
  );
  assert.ok(result.rows.every((row) => row.note === ''));
  assert.equal(result.rows[7]!.a_val, 'One、Two');
  assert.equal(result.faqItems.length, 4);
  assert.ok(result.faqItems[1]![1].includes('両者とも 4/10 変化 中くらい'));
  // #884: a gap under 1 万円 used to print 「約 0 万円高い」.
  assert.ok(!result.faqItems[2]![1].includes('約 0 万円'));
  assert.ok(result.faqItems[2]![1].startsWith('両者の年収は同程度です（'));
});

test('compare salary FAQ says 同程度 when the gap truncates to 0 万円 (#884)', () => {
  const result = firstPair(
    { stats: { salary_man_yen: 500.9 } },
    { stats: { salary_man_yen: 500.1 } },
  );
  const answer = result.faqItems.find(([q]) => q === '年収はどちらが高い？')![1];
  assert.match(answer, /^両者の年収は同程度です（#\d+: 500 万円、#\d+: 500 万円）。/);
  assert.doesNotMatch(answer, /約 0 万円/);
});

for (const [aRisk, bRisk, aSalary, bSalary, riskWinner, salaryWinner] of [
  [2.24, 7.26, 600.9, 500.1, 'A', 'A'],
  [7.26, 2.24, 500.1, 600.9, 'B', 'B'],
] as const) {
  test(`compare FAQs select ${riskWinner} for lower risk and ${salaryWinner} for higher salary`, () => {
    const result = firstPair(
      { title: { ja: 'A' }, ai_risk: { score: aRisk }, stats: { salary_man_yen: aSalary } },
      { title: { ja: 'B' }, ai_risk: { score: bRisk }, stats: { salary_man_yen: bSalary } },
    );
    assert.equal(result.faqItems.length, 4);
    assert.ok(result.faqItems[1]![1].startsWith(`${riskWinner} (2.2/10 変化 小さい)`));
    assert.ok(result.faqItems[1]![1].endsWith(CONSENSUS_FAQ_SENTENCE));
    assert.ok(result.faqItems[2]![1].startsWith(`${salaryWinner} の方が約 100 万円`));
  });
}

test('compare zero values are retained and one-sided missing values omit their FAQs', () => {
  const result = firstPair(
    { ai_risk: { score: 0 }, stats: { salary_man_yen: 0, workers: 0, monthly_hours: 0, average_age: 0, recruit_ratio: 0 } },
    { ai_risk: { score: null }, stats: { salary_man_yen: null } },
  );
  assert.deepEqual(result.rows.map((row) => row.a_val), ['0/10 変化 小さい', '0 万円', '0 人', '0 時間', '0.0 歳', '0.00 倍', '—', '—']);
  assert.ok(result.rows.every((row) => row.note === ''));
  assert.equal(result.faqItems.length, 2);
});

test('compare injected loader failures propagate instead of producing partial cards', () => {
  const failure = new Error('Fixture unavailable');
  assert.throws(() => buildCompareBundle(() => { throw failure; }), (error) => error === failure);
});

test('AI row difference and FAQ compare the printed values, not the raw means (#864)', () => {
  const aiNote = (a: number, b: number) =>
    firstPair({ ai_risk: { score: a } }, { ai_risk: { score: b } }).rows.find((row) => row.label === 'AI 影響度')!;
  // tofu-vs-pan: prints 4.3 vs 4.4, raw difference −0.1667
  assert.deepEqual(aiNote(4.266666666666667, 4.433333333333334), { label: 'AI 影響度', a_val: '4.3/10 変化 中くらい', b_val: '4.4/10 変化 中くらい', note: 'A は B より -0.1' });
  // data-scientist-vs-ai-engineer: prints 6.4 vs 5.3, raw difference 1.1667
  assert.equal(aiNote(6.433333333333334, 5.266666666666667).note, 'A は B より +1.1');
  // yochien-vs-hoikushi: prints 3.3 vs 3.2, raw difference 0.0333 printed "+0.0"
  assert.equal(aiNote(3.266666666666667, 3.2333333333333334).note, 'A は B より +0.1');
  // same printed value → no note
  assert.equal(aiNote(4.266666666666667, 4.3).note, '');
  assert.equal(aiNote(5, 3).note, 'A は B より +2.0');

  const faq = firstPair({ ai_risk: { score: 4.266666666666667 } }, { ai_risk: { score: 4.3 } }).faqItems
    .find(([q]) => q === 'AI 影響度はどちらが低い？')!;
  assert.match(faq[1], /^両者とも 4\.3\/10 変化 中くらい で同程度の AI 影響度。/);
});
