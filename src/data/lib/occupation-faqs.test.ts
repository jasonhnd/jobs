/**
 * occupation-faqs.test.ts — pin the Q/A tuples emitted by the FAQ
 * builder used by both the on-page FAQ and the FAQPage JSON-LD node.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildOccupationFaqs,
  type OccupationFaqsInput,
} from './occupation-faqs.js';

const baseInput: OccupationFaqsInput = {
  nameJa: 'プログラマー',
  salaryMan: null,
  workers: null,
  recruitRatio: null,
  aiRisk: null,
  aiRationaleJa: '',
  howToBecomeJa: '',
  skillsTop10: [],
};

describe('buildOccupationFaqs', () => {
  test('all-null input returns empty array (no Q/A pairs)', () => {
    assert.deepEqual(buildOccupationFaqs(baseInput), []);
  });

  test('salary triggers one Q/A; > 500 万円 → "above national average"', () => {
    const out = buildOccupationFaqs({ ...baseInput, salaryMan: 600 });
    assert.equal(out.length, 1);
    const [q, a] = out[0];
    assert.equal(q, 'プログラマーの年収はいくらですか？');
    assert.ok(a.includes('約600万円'));
    assert.ok(a.includes('月収換算で約50万円')); // 600/12 = 50
    assert.ok(a.includes('上回る水準'));
  });

  test('salary < 420 万円 → "below national average"', () => {
    const out = buildOccupationFaqs({ ...baseInput, salaryMan: 400 });
    assert.ok(out[0][1].includes('下回る水準'));
  });

  test('salary 420-500 → "around national average"', () => {
    const out = buildOccupationFaqs({ ...baseInput, salaryMan: 460 });
    assert.ok(out[0][1].includes('同程度'));
  });

  test('aiRisk non-null emits TWO questions (risk + outlook), gated together', () => {
    const out = buildOccupationFaqs({
      ...baseInput,
      aiRisk: 5,
      aiRationaleJa: '判断業務が多い',
    });
    assert.equal(out.length, 2);
    assert.equal(out[0][0], 'プログラマーのAI代替リスクはどれくらいですか？');
    assert.equal(out[1][0], 'プログラマーの将来性はどうですか？');
    // Rationale appears inside the risk answer, with trailing 。 stripped.
    assert.ok(out[0][1].includes('「判断業務が多い」'));
  });

  test('aiRisk tiers: <=3 low / 4-6 mid / >=7 high', () => {
    const low = buildOccupationFaqs({ ...baseInput, aiRisk: 2 });
    const mid = buildOccupationFaqs({ ...baseInput, aiRisk: 5 });
    const high = buildOccupationFaqs({ ...baseInput, aiRisk: 8 });
    assert.ok(low[0][1].includes('低めで、AI に代替されにくい'));
    assert.ok(mid[0][1].includes('中程度で、業務の一部が'));
    assert.ok(high[0][1].includes('高めで、業務の多くが'));
  });

  test('aiRisk + workers + recruitRatio rolled into the outlook answer', () => {
    const out = buildOccupationFaqs({
      ...baseInput,
      aiRisk: 4,
      workers: 1234567,
      recruitRatio: 2.5,
    });
    const outlook = out[1][1];
    assert.ok(outlook.includes('AI影響度 4/10'));
    assert.ok(outlook.includes('就業者数は約1,234,567人'));
    assert.ok(outlook.includes('求人倍率 2.50 倍'));
  });

  test('howToBecome takes first sentence (split on 「。」)', () => {
    const out = buildOccupationFaqs({
      ...baseInput,
      howToBecomeJa: '専門学校または大学で学ぶ。実務経験を経て活躍する。',
    });
    assert.equal(out.length, 1);
    assert.ok(out[0][1].startsWith('専門学校または大学で学ぶ。'));
    assert.ok(!out[0][1].includes('実務経験を経て'));
  });

  test('howToBecome > 220 chars → truncated to 220 + ellipsis', () => {
    const longSentence = 'あ'.repeat(300);
    const out = buildOccupationFaqs({
      ...baseInput,
      howToBecomeJa: longSentence + '。',
    });
    assert.ok(out[0][1].includes('…'));
    // First 220 chars + '…' + '。' + suffix → first part of answer
    const start = out[0][1].slice(0, 221);
    assert.ok(start.endsWith('…'));
  });

  test('skillsTop10 emits Q with first 3 labels; ≥5 entries adds "加えて" tail', () => {
    const skills = [
      { labelJa: '対人交渉' },
      { labelJa: '判断' },
      { labelJa: '情報処理' },
      { labelJa: '創造性' },
      { labelJa: '専門知識' },
    ];
    const out = buildOccupationFaqs({ ...baseInput, skillsTop10: skills });
    assert.equal(out.length, 1);
    const ans = out[0][1];
    assert.ok(ans.includes('対人交渉、判断、情報処理'));
    assert.ok(ans.includes('加えて、創造性、専門知識'));
  });

  test('skillsTop10 with < 5 entries omits "加えて" tail', () => {
    const out = buildOccupationFaqs({
      ...baseInput,
      skillsTop10: [{ labelJa: 'a' }, { labelJa: 'b' }, { labelJa: 'c' }],
    });
    assert.ok(out[0][1].includes('a、b、c'));
    assert.ok(!out[0][1].includes('加えて'));
  });

  test('skillsTop10 with null labels filtered out before counting', () => {
    const out = buildOccupationFaqs({
      ...baseInput,
      skillsTop10: [{ labelJa: null }, { labelJa: null }, { labelJa: 'real' }],
    });
    assert.equal(out.length, 1);
    assert.ok(out[0][1].includes('real'));
  });

  test('skillsTop10 with ALL null labels → no Q emitted', () => {
    const out = buildOccupationFaqs({
      ...baseInput,
      skillsTop10: [{ labelJa: null }, { labelJa: null }],
    });
    assert.equal(out.length, 0);
  });

  test('full input emits up to 5 Q/A pairs (1 + 2 + 1 + 1)', () => {
    const out = buildOccupationFaqs({
      nameJa: '看護師',
      salaryMan: 480,
      workers: 1500000,
      recruitRatio: 3.2,
      aiRisk: 4,
      aiRationaleJa: '対人ケアが中心',
      howToBecomeJa: '看護学校に通う。',
      skillsTop10: [
        { labelJa: '看護' },
        { labelJa: '判断' },
        { labelJa: 'コミュニケーション' },
      ],
    });
    assert.equal(out.length, 5);
  });
});
