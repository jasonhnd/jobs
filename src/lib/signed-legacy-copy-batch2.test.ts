/** Owner-signed legacy-copy batch 2 (#956), Pro ranking descriptions.
 * Rows #1, #2, #4, #5, #6, and #13. Row #3 stays as written.
 * Exact counts prevent a partial rewrite of the three ranking files.
 */
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const read = (file: string): string => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const count = (source: string, phrase: string): number => source.split(phrase).length - 1;

const SIGNED: ReadonlyArray<{
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

const RETIRED: ReadonlyArray<readonly [string, string]> = [
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
  for (const { label, file, phrase } of SIGNED) {
    test(`#${label}: exact signed wording in ${file}`, () => {
      assert.equal(count(read(file), phrase), 1, phrase);
    });
  }

  test('retired ranking descriptions stay out of the three files', () => {
    for (const [file, phrase] of RETIRED) assert.equal(count(read(file), phrase), 0, `${file} ${phrase}`);
  });

  test('#3 ai-augmented intro stays unchanged', () => {
    assert.equal(
      count(read('views/ranking/rankings/high-risk.ts'), 'AI が業務を一部肩代わりする「補強域」の職業。完全代替されるリスクは低いが、AI ツールを使いこなせるかでパフォーマンス差が広がります。'),
      1,
    );
  });
});
