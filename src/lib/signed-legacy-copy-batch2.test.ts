/** Owner-signed legacy-copy batch 2 (#957), Pro ranking descriptions in intent rankings.
 * Rows #7–#12. Exact counts prevent a partial rewrite of intent.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const source = readFileSync(new URL('../views/ranking/rankings/intent.ts', import.meta.url), 'utf8');
const count = (phrase: string): number => source.split(phrase).length - 1;

const SIGNED: ReadonlyArray<readonly [string, string, number]> = [
  [
    '7',
    '求人が多く、AI 影響度も低めの職業です。介護・建設・医療系が中心で、未経験から入るルートがある分野もあります。',
    1,
  ],
  [
    '8',
    '労働時間が短く AI 影響度も低い職業 TOP${TOP_N} を一覧。',
    1,
  ],
  [
    '9 short-hours',
    '労働時間が短く、かつ AI 影響度も低い職業をランキング。教育・公務・専門職の一部が該当します。',
    1,
  ],
  [
    '9 young',
    '若手が多く活躍し、かつ AI 影響度も低い職業をランキング。新卒・第二新卒のキャリア選択の参考に。',
    1,
  ],
  [
    '9 no-license',
    '関連国家資格を要さず、AI 影響度も低い職業群。実務経験で勝負できる分野を中心にランキング。',
    1,
  ],
  [
    '9+10 regulated',
    '複数の関連国家資格を要し、かつ AI 影響度も低い職業群。法律で業務範囲が定められた高度専門職が中心です。',
    1,
  ],
  [
    '11',
    '月間労働時間 165 時間以下かつ AI 影響度 5 以下の職業 TOP${lowStressStable.length} を一覧。',
    1,
  ],
  [
    '12',
    '労働時間が短く、AI 影響度も低い職業群です。教育・公務・専門職の一部が該当します。',
    1,
  ],
];

const RETIRED = [
  '採用されやすく賃金交渉余地もあり、かつ AI 代替リスクが低い「鉄板」キャリア候補。介護・建設・医療系が中心で、未経験参入のルートも整備されています。',
  'ワークライフバランスと将来性を両立する職業を一覧。',
  'AI 代替リスクも低い',
  '法的に守られた業務範囲を持つ高度専門職が中心です。',
  '長く続けやすい安定職を一覧。',
  '労働時間が短く、かつ AI 代替リスクも低い「長く続けやすい」職業群。教育・公務・専門職の一部が該当します。',
];

describe('signed legacy copy batch 2 (#957)', () => {
  for (const [label, phrase, occurrences] of SIGNED) {
    test(`#${label}: exact signed wording`, () => {
      assert.equal(count(phrase), occurrences, phrase);
    });
  }

  test('retired intent descriptions stay out of intent.ts', () => {
    for (const phrase of RETIRED) assert.equal(count(phrase), 0, phrase);
  });
});

/** Owner-signed #956 rows #1, #2, #4, #5, #6, and #13; row #3 stays unchanged. */
const read_956 = (file: string): string => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const count_956 = (source: string, phrase: string): number => source.split(phrase).length - 1;

const SIGNED_956: ReadonlyArray<{
  label: string;
  file: string;
  phrase: string;
}> = [
  {
    label: '1',
    file: 'views/ranking/rankings/high-risk.ts',
    phrase: '仕事がなくなる順ではなく、AIで仕事の中身が大きく変わる順です。',
  },
  {
    label: '2',
    file: 'views/ranking/rankings/high-risk.ts',
    phrase: '手技・経験的判断・身体的調整を要する技能職は AI で置き換えにくく、製造・建設・メンテ・農林の現場職は AI 影響度が低めです。',
  },
  {
    label: '4',
    file: 'views/ranking/rankings/low-risk.ts',
    phrase: 'AIで仕事の中身が変わりにくい順です。点が低いほど、変わる部分が少ない仕事です。',
  },
  {
    label: '5',
    file: 'views/ranking/rankings/low-risk.ts',
    phrase: '身体性・対人関係・創造性が求められる職業はAIで置き換えにくく、スコアが低くなる傾向があります。年収データと合わせて紹介します。',
  },
  {
    label: '6',
    file: 'views/ranking/rankings/low-risk.ts',
    phrase: 'AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。右の点数は順位とは別です。',
  },
  {
    label: '13',
    file: 'views/ranking/rankings/workforce.ts',
    phrase: '就業者数 5 万人以上かつ AI 影響度 5 以下の職業 TOP${largeWorkforceStable.length} を一覧。',
  },
];

const RETIRED_956: ReadonlyArray<readonly [string, string]> = [
  ['views/ranking/rankings/high-risk.ts', 'AI影響度が最も高い職業TOP'],
  ['views/ranking/rankings/high-risk.ts', 'AI代替リスク・年収・就業者数を一覧比較。複数のAIモデルによる採点の総合値（独自分析・非公式）。'],
  ['views/ranking/rankings/high-risk.ts', '現場職が低 AI 影響度のまま安定する傾向にあります。'],
  ['views/ranking/rankings/low-risk.ts', 'AIに代替されにくい職業TOP'],
  ['views/ranking/rankings/low-risk.ts', '将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。'],
  ['views/ranking/rankings/low-risk.ts', '「AIに奪われない仕事」をお探しの方に、将来性の高い職業を年収データと共に紹介します。'],
  ['views/ranking/rankings/low-risk.ts', '年収が高くAI代替リスクが低い職業TOP'],
  ['views/ranking/rankings/low-risk.ts', '将来性と収入を両立できる仕事を一覧。'],
  ['views/ranking/rankings/workforce.ts', '日本の労働市場の安定軸を一覧。'],
];

describe('signed legacy copy batch 2 (#956)', () => {
  for (const { label, file, phrase } of SIGNED_956) {
    test(`#${label}: exact signed wording in ${file}`, () => {
      assert.equal(count_956(read_956(file), phrase), 1, phrase);
    });
  }

  test('retired ranking descriptions stay out of the three files', () => {
    for (const [file, phrase] of RETIRED_956) assert.equal(count_956(read_956(file), phrase), 0, `${file} ${phrase}`);
  });

  test('#3 ai-augmented intro stays unchanged', () => {
    assert.equal(
      count_956(read_956('views/ranking/rankings/high-risk.ts'), 'AI が業務を一部肩代わりする「補強域」の職業。完全代替されるリスクは低いが、AI ツールを使いこなせるかでパフォーマンス差が広がります。'),
      1,
    );
  });
});
