/**
 * ranking-copy.test.ts — pin the editorial FAQ catalog. FAQS maps
 * each ranking slug to an array of [question, answer] tuples shown
 * at the bottom of every ranking detail page.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { FAQS } from './ranking-copy.js';

describe('FAQS — editorial copy catalog', () => {
  test('exported as a Record (non-empty)', () => {
    const slugs = Object.keys(FAQS);
    assert.ok(slugs.length > 0, 'FAQS is empty');
  });

  test('every entry is an array of [question, answer] tuples', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      assert.ok(Array.isArray(tuples), `${slug}: not an array`);
      for (const t of tuples) {
        assert.ok(Array.isArray(t), `${slug}: tuple not an array`);
        assert.equal(t.length, 2, `${slug}: tuple length != 2`);
        const [q, a] = t;
        assert.equal(typeof q, 'string', `${slug}: question not a string`);
        assert.equal(typeof a, 'string', `${slug}: answer not a string`);
        assert.ok(q.length > 0, `${slug}: empty question`);
        assert.ok(a.length > 0, `${slug}: empty answer`);
      }
    }
  });

  test('every entry has at least 1 FAQ (most have 4-6)', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      assert.ok(tuples.length >= 1, `${slug}: no FAQs`);
    }
  });

  test('questions contain Japanese characters (no English placeholders)', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      for (const [q] of tuples) {
        assert.match(q, /[぀-ヿ一-鿿]/, `${slug}: "${q}" has no JP chars`);
      }
    }
  });

  test('answers contain Japanese characters', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      for (const [, a] of tuples) {
        assert.match(a, /[぀-ヿ一-鿿]/, `${slug}: answer has no JP chars`);
      }
    }
  });

  test('questions end with a "？" (Japanese question mark) — pinned convention', () => {
    // Editorial convention: FAQ questions end with the full-width "？".
    // Pin so a future bulk edit can't silently change the format.
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      for (const [q] of tuples) {
        assert.ok(q.endsWith('？') || q.endsWith('?'), `${slug}: "${q}" missing ? at end`);
      }
    }
  });

  test('answers are at least 30 characters (editorial minimum)', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      for (const [q, a] of tuples) {
        assert.ok(a.length >= 30, `${slug}: "${q}" answer too short (${a.length} chars)`);
      }
    }
  });
});

describe('owner-signed ranking FAQs (#960)', () => {
  test('signed legacy batch 2 #21', () => {
    assert.deepEqual(FAQS['ai-risk-high'][0], ['AIで変わりやすい仕事の特徴は？', 'データ入力・定型処理・パターン認識が中心の業務はAI影響度が高い傾向にあります。反復的なルーティンワークほどスコアが高くなります。']);
  });

  test('signed legacy batch 2 #22', () => {
    assert.deepEqual(FAQS['ai-risk-high'][2], ['AIリスクが高い職業から転職するには？', '身体性・対人スキル・創造性を活かせる職種への転換が有効です。同じ業種の中で、AI影響度が低めの職業を探すのも一つの方法です。']);
  });

  test('signed legacy batch 2 #23', () => {
    assert.deepEqual(FAQS['ai-risk-low'][0], ['AIで変わりにくい仕事の共通点は？', '身体的な動作、対面での人間関係構築、高度な状況判断が必要な職業はAI代替が難しい傾向にあります。']);
  });

  test('signed legacy batch 2 #24', () => {
    assert.deepEqual(FAQS['ai-risk-low'][1], ['AI影響度が低い仕事なら、心配はいりませんか？', 'AI影響度は低めですが、少子高齢化や産業構造の変化など、ほかの要因も考える必要があります。']);
  });

  test('signed legacy batch 2 #25', () => {
    assert.deepEqual(FAQS['salary-safe'][0], ['年収が高くて、AIで変わりにくい仕事は？', '医師・法律専門家・建設系技術者などが代表的です。専門性と対人スキルの組み合わせが強みになっています。']);
  });

  test('signed legacy batch 2 #26', () => {
    assert.deepEqual(FAQS['aging-workforce'][1], ['平均年齢が高い職業は、これから先が厳しい？', '一概には言えません。継承課題はあるものの、需要側がまだ強い分野では中高年からの参入チャンスでもあります。']);
  });

  test('signed legacy batch 2 #27 (unchanged under R3)', () => {
    assert.deepEqual(FAQS['aging-workforce'][2], ['シニア中心の職業は AI 影響度が低い？', '熟練判断や対人信頼を要する分野で平均年齢も AI リスクも低い傾向。ただし業種ごとの個別確認が重要です。']);
  });

  test('signed legacy batch 2 #28', () => {
    assert.deepEqual(FAQS['ai-resistant-craft'][1], ['技能職への参入は今からでも遅くない？', '求人が多く人手不足の領域も多く、中途参入のルートが整備されている分野もあります。資格・徒弟制度の有無を確認しましょう。']);
  });

  test('signed legacy batch 2 #29', () => {
    assert.deepEqual(FAQS['ai-at-risk-but-paid'][0], ['「AI リスク高だが高年収」とはどういう状態？', 'AI で代替可能性が高い (8+/10) のに現状の年収はまだ高い職業群。いまの年収は高いものの、仕事の中身が大きく変わる可能性がある職業群です。']);
  });

  test('signed legacy batch 2 #30', () => {
    assert.deepEqual(FAQS['ai-augmented'][1], ['AI 補強域の職業は、どう変わる？', '完全代替されるリスクは低めですが、AI ツールを使いこなせるかどうかでパフォーマンス差が広がります。学習意欲が継続的に必要です。']);
  });
});
