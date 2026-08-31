/**
 * occupation-seo.test.ts — pin the SEO + OG meta derivation for
 * occupation detail pages.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildOccupationSeo, type OccupationSeoInput } from './occupation-seo.js';

const baseInput: OccupationSeoInput = {
  nameJa: '看護師',
  aiRisk: null,
  salaryMan: null,
  workers: null,
  aliasesJa: [],
};

describe('buildOccupationSeo', () => {
  test('title with salary leads with the yen figure then AI impact (#276)', () => {
    const { title } = buildOccupationSeo({ ...baseInput, aiRisk: 3, salaryMan: 536.5 });
    assert.equal(title, '看護師の年収約536万円｜AI影響3/10｜未来の仕事');
  });

  test('title banker-rounds even-count medians to one decimal', () => {
    const { title } = buildOccupationSeo({ ...baseInput, aiRisk: 4.25, salaryMan: 500 });
    assert.equal(title, '看護師の年収約500万円｜AI影響4.2/10｜未来の仕事');
  });

  test('title without salary still carries AI impact', () => {
    const { title } = buildOccupationSeo({ ...baseInput, aiRisk: 6 });
    assert.equal(title, '看護師のAI影響6/10｜未来の仕事');
  });

  test('title with null aiRisk uses 未評価', () => {
    const { title } = buildOccupationSeo({ ...baseInput, aiRisk: null, salaryMan: 480 });
    assert.equal(title, '看護師の年収約480万円｜AI影響未評価｜未来の仕事');
  });

  test('description leads with jobtag salary, then workers, then AI-impact tier', () => {
    const { description } = buildOccupationSeo({
      ...baseInput,
      aiRisk: 5,
      salaryMan: 480,
      workers: 1500000,
    });
    assert.equal(
      description,
      '看護師の平均年収は約480万円（厚生労働省 jobtag）。就業者は1,500,000人。看護師のAI影響度は10段階中5と中程度です。仕事の中身がAIで変わる度合いであり、失業の確率ではありません。将来性やなり方、必要なスキルを詳しく解説。',
    );
  });

  test('description tier: aiRisk <= 3 → 低め', () => {
    const { description } = buildOccupationSeo({ ...baseInput, aiRisk: 2 });
    assert.ok(description.includes('10段階中2と低め'));
  });

  test('description tier: aiRisk 4-6 → 中程度', () => {
    const { description } = buildOccupationSeo({ ...baseInput, aiRisk: 5 });
    assert.ok(description.includes('10段階中5と中程度'));
  });

  test('description tier: aiRisk >= 7 → 高め', () => {
    const { description } = buildOccupationSeo({ ...baseInput, aiRisk: 8 });
    assert.ok(description.includes('10段階中8と高め'));
  });

  test('description never says AI代替リスク', () => {
    const { description } = buildOccupationSeo({ ...baseInput, aiRisk: 8, salaryMan: 500 });
    assert.ok(!description.includes('代替リスク'));
  });

  test('description with null aiRisk uses "AI影響度を分析" and skips the unemployment disclaimer', () => {
    const { description } = buildOccupationSeo({ ...baseInput, aiRisk: null });
    assert.ok(description.startsWith('看護師のAI影響度を分析。'));
    assert.ok(!description.includes('失業の確率'));
  });

  test('description omits salary and workers clauses when both are absent', () => {
    const { description } = buildOccupationSeo({ ...baseInput, aiRisk: 5 });
    assert.ok(!description.includes('年収'));
    assert.ok(!description.includes('就業者'));
  });

  test('description always ends with the 将来性 tail', () => {
    const { description } = buildOccupationSeo({ ...baseInput, aiRisk: 5 });
    assert.ok(description.endsWith('将来性やなり方、必要なスキルを詳しく解説。'));
  });

  test('ogTitle truncated at 120 chars', () => {
    const longName = 'あ'.repeat(150);
    const { ogTitle } = buildOccupationSeo({ ...baseInput, nameJa: longName, aiRisk: 5 });
    assert.equal(ogTitle.length, 120);
  });

  test('ogDescription truncated at 300 chars', () => {
    const longName = 'あ'.repeat(400);
    const { ogDescription } = buildOccupationSeo({ ...baseInput, nameJa: longName, aiRisk: 5 });
    assert.equal(ogDescription.length, 300);
  });

  test('keywords: nameJa first, then up to 8 aliases', () => {
    const aliases = Array.from({ length: 12 }, (_, i) => `alias${i + 1}`);
    const { keywords } = buildOccupationSeo({ ...baseInput, aliasesJa: aliases });
    const kwTerms = keywords.split(', ');
    assert.equal(kwTerms[0], '看護師');
    assert.equal(kwTerms.length, 9); // nameJa + 8 aliases
  });

  test('keywords drops falsy terms (empty alias strings)', () => {
    const { keywords } = buildOccupationSeo({
      ...baseInput,
      aliasesJa: ['real', '', 'another'],
    });
    assert.equal(keywords, '看護師, real, another');
  });
});
