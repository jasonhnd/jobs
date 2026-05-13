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
  test('title format: {name}の将来性・年収・AI影響度【N/10】｜未来の仕事', () => {
    const { title } = buildOccupationSeo({ ...baseInput, aiRisk: 6 });
    assert.equal(title, '看護師の将来性・年収・AI影響度【6/10】｜未来の仕事');
  });

  test('title with null aiRisk uses 「—」 in brackets', () => {
    const { title } = buildOccupationSeo({ ...baseInput, aiRisk: null });
    assert.equal(title, '看護師の将来性・年収・AI影響度【—】｜未来の仕事');
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

  test('description with null aiRisk uses "AI影響度を分析" generic copy', () => {
    const { description } = buildOccupationSeo({ ...baseInput, aiRisk: null });
    assert.ok(description.startsWith('看護師のAI影響度を分析。'));
  });

  test('description joins salary + workers data clauses with 「・」', () => {
    const { description } = buildOccupationSeo({
      ...baseInput,
      aiRisk: 5,
      salaryMan: 480,
      workers: 1500000,
    });
    assert.ok(description.includes('年収480万円・就業者1,500,000人'));
  });

  test('description omits data clause when both salaryMan and workers absent', () => {
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
