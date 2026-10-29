/**
 * Pins Pro ranking card names for signed legacy batch 2 R1/R2 (#1003).
 * Slugs stay the same. R3 wording on the same lines stays.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { RANKING_META } from './rankings-meta.js';
import { buildRankings } from './ranking/index.js';
import { topCountText } from './ranking/build.js';

const CARD_NAMES: ReadonlyArray<readonly [slug: string, nameJa: string, hubName: string]> = [
  ['ai-risk-high', 'AIで大きく変わる仕事 TOP30', 'AIで大きく変わる仕事 TOP30'],
  ['ai-stable-employment', 'AI影響が少ない × 正規雇用率高 TOP30', 'AI影響が少ない × 正規雇用率高'],
  ['ai-safe-high-demand', '高需要 × AI影響が少ない TOP30', '高需要 × AI影響が少ない'],
  ['ai-safe-short-hours', '低労働時間 × AI影響が少ない TOP30', '低労働時間 × AI影響が少ない'],
  ['ai-safe-young-workforce', '若手中心 × AI影響が少ない TOP30', '若手中心 × AI影響が少ない'],
  ['ai-safe-no-license', '無資格 × AI影響が少ない TOP30', '無資格 × AI影響が少ない'],
  ['ai-safe-physical', '身体性 × AI影響が少ない TOP30', '身体性 × AI影響が少ない'],
  ['ai-safe-interpersonal', '対人 × AI影響が少ない TOP30', '対人 × AI影響が少ない'],
  ['no-license-required', '無資格で就ける × AI影響が少ない職業 TOP30', '無資格で就ける × AI影響が少ない'],
  ['large-workforce-stable', '大規模就業 × AI影響が少ない TOP30', '大規模就業 × AI影響が少ない'],
];

const RETIRED = [
  'AIに奪われる仕事',
  'AI 安全',
  'AI安全',
] as const;

test('R1/R2: RANKING_META name_ja uses the signed card names', () => {
  for (const [slug, nameJa] of CARD_NAMES) {
    const row = RANKING_META.find((meta) => meta.slug === slug);
    assert.ok(row, slug);
    assert.equal(row.name_ja, nameJa, slug);
  }
});

test('R1/R2: hub cards use the signed names', () => {
  const { hub } = buildRankings(() => []);
  for (const [slug, , hubName] of CARD_NAMES) {
    const card = hub.cards.find((entry) => entry.slug === slug);
    assert.ok(card, slug);
    assert.equal(card.name, topCountText(hubName, card.count), slug);
  }
});

test('R1/R2: card sources keep each new string once and drop the retired phrases', () => {
  const meta = readFileSync(new URL('./rankings-meta.ts', import.meta.url), 'utf8');
  const build = readFileSync(new URL('./ranking/build.ts', import.meta.url), 'utf8');
  for (const [, nameJa, hubName] of CARD_NAMES) {
    assert.equal(meta.split(nameJa).length - 1, 1, nameJa);
    assert.equal(build.split(hubName).length - 1, 1, hubName);
  }
  for (const phrase of RETIRED) {
    assert.equal(meta.split(phrase).length - 1, 0, `rankings-meta.ts still has ${phrase}`);
    assert.equal(build.split(phrase).length - 1, 0, `build.ts still has ${phrase}`);
  }
});

test('R3: AIリスク wording on the renamed cards stays', () => {
  const meta = RANKING_META.find((row) => row.slug === 'no-license-required');
  assert.equal(meta?.description_ja, '資格不要かつ AI リスクも低い職業');
  const { hub } = buildRankings(() => []);
  const card = hub.cards.find((entry) => entry.slug === 'no-license-required');
  assert.equal(card?.desc, '資格不要かつ AI リスク低');
});
