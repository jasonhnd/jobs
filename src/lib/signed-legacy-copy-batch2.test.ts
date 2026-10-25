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
