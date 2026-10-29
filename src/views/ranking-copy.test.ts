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

  test('signed legacy batch 2 Q&A part 2 (#961)', () => {
    const faq = (slug: keyof typeof FAQS) => FAQS[slug];
    const answer = (slug: keyof typeof FAQS, question: string) => {
      const hit = faq(slug).find(([q]) => q === question);
      assert.ok(hit, `${slug}: missing ${question}`);
      return hit[1];
    };

    assert.equal(
      answer('ai-stable-employment', '正規雇用率が高くて、AI影響が少ない職業は？'),
      '医療・福祉・建設・公安系など、低 AI 影響かつ正社員が中心の分野。',
    );
    // Item 32 reuses signed item 7 from #957, accepted in PR #967.
    // Exact source: https://github.com/jasonhnd/jobs/blob/b22a62c35547187aa1989ce4dc88c4aeba262856/src/views/ranking/rankings/intent.ts#L105
    // Independently pinned as row 7 in src/lib/signed-legacy-copy-batch2.test.ts.
    assert.equal(
      answer('ai-safe-high-demand', '人手不足で、AI影響が少ない職業の特徴は？'),
      '求人が多く、AI 影響度も低めの職業です。介護・建設・医療系が中心で、未経験から入るルートがある分野もあります。',
    );
    assert.equal(
      answer('ai-safe-short-hours', '労働時間が短くて AI影響が少ない職業は？'),
      '教育系・公務系・一部の専門職で、月間労働時間が短く AI 影響度も低い職業が該当します。',
    );
    assert.equal(
      answer('ai-safe-short-hours', '短時間 × AI影響が少ない × 高年収の職業はある？'),
      '医師の一部の科や大学教員、士業の一部が該当しますが、いずれも参入難度が高い専門職です。',
    );
    assert.equal(
      answer('ai-safe-short-hours', '短時間で働ける職業の見分け方は？'),
      '勤務時間の柔軟性、リモート可能性、シフトの安定性も合わせて確認すると見えやすくなります。',
    );
    assert.equal(
      answer('ai-safe-young-workforce', '若手中心 × AI影響が少ない職業の特徴は？'),
      'IT 補助系・サービス系・現場系で平均年齢が低く、対人や身体性で AI への強さも持つ職業群です。',
    );
    assert.equal(
      answer('ai-safe-young-workforce', '新卒で、AI影響が少ない分野は？'),
      '看護・介護・建設技能職・教育系などのAI 影響度が低めで、求人も多い領域です。',
    );
    assert.equal(
      answer('ai-safe-no-license', '資格を取った方がいい？'),
      '選べる仕事の幅が広がりますが、無資格でも始めて働きながら資格取得するルートも一般的です。',
    );
    assert.equal(
      answer('ai-safe-physical', '身体性 × AI影響が少ないの代表例は？'),
      '建設職人・整備士・農林漁業・配管工・電気工事士など、製造・建設・メンテナンス系が中心です。',
    );
    assert.equal(
      answer('ai-safe-interpersonal', '対人 × AI影響が少ないの代表例は？'),
      '看護師・介護福祉士・保育士・教師・販売員・接客スタッフなどです。',
    );
    assert.equal(
      answer('no-license-required', '無資格で就けて AI影響が少ない職業は？'),
      '建設技能職・運輸・対人サービス・農林水産系などの一部で、資格不要かつ AI 影響度も低い職業が存在します。',
    );
    assert.equal(
      answer('no-license-required', '資格なしで始めた仕事からのキャリアアップは？'),
      '勤務しながら関連資格取得、実績ベースの独立、管理職昇進など複数のルートがあります。',
    );
    assert.equal(
      answer('high-school-ok', '高卒で AI に強い職業は？'),
      '身体技能・対人スキル中心の職業は学歴ハードルが低く AI 影響度も低めです。本ランキングは AI 影響度も併記しています。',
    );
    assert.equal(
      answer('university-required', '大卒で、年収が高い分野は？'),
      '医師・士業・公務員・大企業総合職など、教育投資のリターンが見込める分野が候補です。',
    );
    assert.equal(
      answer('public-sector', '公的機関・公務員系職業の特徴は？'),
      '保安・公安・公共サービス系で、安定雇用・年功的昇進・福利厚生が手厚い反面、業務範囲は法令で定められています。',
    );
    assert.equal(
      answer('public-sector', '公務員系は AI に置き換わる？'),
      '法的な存在意義から職業自体が消えるリスクは低めですが、業務内訳のうち事務的な部分は AI 化が進行する見込みです。',
    );
    assert.equal(
      answer('large-workforce-stable', '大規模 × AI影響が少ない職業の意義は？'),
      '日本全体の労働人口に占める比重が大きく、かつ AI 影響度も低い職業群です。',
    );
    assert.equal(
      answer('low-stress-stable', '労働時間が短く、AI影響が少ない職業は？'),
      '労働時間が短く AI 影響度も低い職業群。教育系・専門職の一部・公務系の一部などです。',
    );

    const catalog = Object.values(FAQS).flat().map(([q, a]) => `${q}\n${a}`).join('\n');
    for (const retired of [
      '正規雇用率が高くて AI 安全な職業は？',
      '長期的なキャリア安定性が期待できる職業群です。',
      '人手不足かつ AI 安全な職業の魅力は？',
      '「鉄板」キャリア候補',
      '採用されやすく賃金交渉余地もあり。',
      '短時間 × 安全 × 高年収は両立できる？',
      '短時間で安全な職業の見分け方は？',
      '新卒で狙うべき安全分野は？',
      '低 AI リスク × 安定需要',
      '資格を取った方が安全？',
      '長期的なキャリア安全度を上げますが',
      '無資格 × 安全からのキャリアアップは？',
      'AI 安全度も併記',
      '大卒で安定 × 高年収な分野は？',
      '「日本の中軸を支える」',
      '低ストレスで安定的な職業は？',
    ]) {
      assert.equal(catalog.includes(retired), false, retired);
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
