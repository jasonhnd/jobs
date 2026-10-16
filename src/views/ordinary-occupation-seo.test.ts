import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { buildOrdinaryOccupationSeo } from './ordinary-occupation-seo';
import { buildOccupationSeo } from './occupation-seo';
import { buildOccupationSummary } from './occupation-summary';
import { buildOccupationPageData } from '../page-data/occupation-page-data';
import { loadGeoFacts } from '../page-data/geo-facts-loader';
import { salaryStanding } from '../site/geo-facts';

const input = { id: 307, name_ja: '花火師', salary: 536, hours: 163, ai_risk: 2.8 };
const legacy = buildOccupationSeo({
  nameJa: input.name_ja, aiRisk: input.ai_risk,
  salaryStanding: { universe: 544, topPercent: 38 }, workers: 43928,
  aliasesJa: Array.from({ length: 10 }, (_, i) => String(i)),
});

// Full literals deliberately pin the signed wording, including the long name /391.
const signedCases = [
  [307, '花火師', '花火師の年収・労働時間・AIの影響｜未来の仕事', '花火師の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。'],
  [391, '科学捜査研究所鑑定技術職員', '科学捜査研究所鑑定技術職員の年収・労働時間・AIの影響｜未来の仕事', '科学捜査研究所鑑定技術職員の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。'],
  [518, '検察事務官', '検察事務官の年収・労働時間・AIの影響｜未来の仕事', '検察事務官の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。'],
  [182, '図書館司書', '図書館司書の年収・労働時間・AIの影響｜未来の仕事', '図書館司書の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。'],
  [127, 'ピアノ調律師', 'ピアノ調律師の年収・労働時間・AIの影響｜未来の仕事', 'ピアノ調律師の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。'],
  [203, '航空管制官', '航空管制官の年収・労働時間・AIの影響｜未来の仕事', '航空管制官の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。'],
  [94, '気象予報士', '気象予報士の年収・労働時間・AIの影響｜未来の仕事', '気象予報士の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。'],
  [224, '水族館飼育員', '水族館飼育員の年収・労働時間・AIの影響｜未来の仕事', '水族館飼育員の平均年収・月労働時間と、AIによる仕事の変化の目安を掲載。仕事内容やなり方・資格は、ページ内のリンクから詳しい解説へ。'],
] as const;

for (const [id, name_ja, title, description] of signedCases) {
  test(`/${id} uses the exact complete signed metadata`, () => {
    const seo = buildOrdinaryOccupationSeo(buildOccupationSummary({ ...input, id, name_ja }), legacy);
    assert.deepEqual(seo, { title, description, ogTitle: title, ogDescription: description, keywords: legacy.keywords });
  });
}

test('any combination of missing statistics preserves every legacy ordinary metadata byte', () => {
  for (let mask = 1; mask < 8; mask++) {
    const summary = buildOccupationSummary({
      ...input, salary: mask & 1 ? null : input.salary,
      hours: mask & 2 ? null : input.hours, ai_risk: mask & 4 ? null : input.ai_risk,
    });
    const oldDescription = summary.conclusion ?? summary.nameJa;
    assert.deepEqual(buildOrdinaryOccupationSeo(summary, legacy), {
      ...legacy, description: oldDescription, ogDescription: oldDescription,
    });
  }
});

test('availability follows summary normalization for null, zero, negative and non-finite data', () => {
  for (const field of ['salary', 'hours'] as const) {
    for (const value of [null, 0, -1, NaN, Infinity, -Infinity]) {
      const summary = buildOccupationSummary({ ...input, [field]: value });
      expect(summary[field]).toBe(null);
      assert.deepEqual(buildOrdinaryOccupationSeo(summary, legacy), {
        ...legacy, description: summary.conclusion, ogDescription: summary.conclusion,
      });
    }
  }
  for (const ai_risk of [null, NaN, Infinity, -Infinity]) {
    const summary = buildOccupationSummary({ ...input, ai_risk });
    expect(summary.score).toBe(null);
    assert.deepEqual(buildOrdinaryOccupationSeo(summary, legacy), {
      ...legacy, description: summary.nameJa, ogDescription: summary.nameJa,
    });
  }
  // A displayed AI score of zero is present; low/mid/high bands use one template.
  for (const ai_risk of [0, 3.9667, 6.9667, 10]) {
    const seo = buildOrdinaryOccupationSeo(buildOccupationSummary({ ...input, ai_risk }), legacy);
    expect(seo.title).toBe(signedCases[0][2]);
    expect(seo.description).toBe(signedCases[0][3]);
  }
});

test('keyword order/alias cap and the shared Pro SEO result are preserved without mutation', () => {
  const before = { ...legacy };
  const summary = buildOccupationSummary(input);
  const seo = buildOrdinaryOccupationSeo(Object.freeze(summary), Object.freeze(legacy));
  expect(seo.keywords).toBe('花火師, 0, 1, 2, 3, 4, 5, 6, 7');
  assert.deepEqual(legacy, before);
  expect(seo.description).not.toBe(legacy.description);
});

test('all 556 real occupations select 544 signed templates and 12 exact legacy fallbacks', async () => {
  const { allRecs } = await buildOccupationPageData();
  const facts = loadGeoFacts();
  const unchanged: number[] = [];
  expect(allRecs.length).toBe(556);
  for (const rec of allRecs) {
    const summary = buildOccupationSummary(rec);
    const oldSeo = buildOccupationSeo({
      nameJa: rec.name_ja, aiRisk: rec.ai_risk, salaryStanding: salaryStanding(facts, rec.id),
      workers: rec.workers, aliasesJa: rec.aliases_ja,
    });
    const seo = buildOrdinaryOccupationSeo(summary, oldSeo);
    if (summary.salary === null || summary.hours === null || summary.score === null) {
      unchanged.push(rec.id);
      const description = summary.conclusion ?? summary.nameJa;
      assert.deepEqual(seo, { ...oldSeo, description, ogDescription: description });
    } else {
      expect(seo.title).toBe(`${rec.name_ja}の年収・労働時間・AIの影響｜未来の仕事`);
    }
    if (rec.id === 404) {
      expect(summary.ordinaryPath).toBe('/occupations/404');
      expect(summary.proPath).toBe('/pro/404');
      assert.ok(seo.title.endsWith('の年収・労働時間・AIの影響｜未来の仕事'));
    }
  }
  assert.deepEqual(unchanged, [140, 141, 142, 144, 145, 148, 152, 153, 154, 250, 512, 514]);
});
