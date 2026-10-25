/** Owner-signed legacy-copy batch 2, rows #15–#20 (#959).
 * Card descriptions live in rankings-meta.ts and ranking/build.ts.
 * #18 stays (R3). #20 also covers the page title and h1.
 */
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const read = (file: string): string => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const count = (source: string, phrase: string): number => source.split(phrase).length - 1;

const SIGNED: ReadonlyArray<{
  label: string;
  file: string;
  pairs: ReadonlyArray<readonly [string, string, number]>;
}> = [
  {
    label: '15',
    file: 'views/rankings-meta.ts',
    pairs: [
      ['AIリスクが低く将来性のある職業', 'AIで仕事の中身が変わりにくい順です。', 1],
    ],
  },
  {
    label: '15',
    file: 'views/ranking/build.ts',
    pairs: [
      ['AIリスクが低く将来性のある職業', 'AIで仕事の中身が変わりにくい順です。', 1],
    ],
  },
  {
    label: '16',
    file: 'views/rankings-meta.ts',
    pairs: [
      ['年収が高くAI代替リスクが低い職業', 'AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。', 1],
    ],
  },
  {
    label: '16',
    file: 'views/ranking/build.ts',
    pairs: [
      ['年収が高くAI代替リスクが低い職業', 'AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。', 1],
    ],
  },
  {
    label: '17',
    file: 'views/rankings-meta.ts',
    pairs: [
      ['低 AI 影響かつ安定雇用率が高い職業', '低 AI 影響かつ正規雇用率が高い職業', 1],
    ],
  },
  {
    label: '17',
    file: 'views/ranking/build.ts',
    pairs: [
      ['低 AI 影響かつ正社員中心の安定職', '低 AI 影響かつ正規雇用率が高い職業', 1],
    ],
  },
  {
    label: '18',
    file: 'views/rankings-meta.ts',
    pairs: [
      ['', '資格不要かつ AI リスクも低い職業', 1],
    ],
  },
  {
    label: '18',
    file: 'views/ranking/build.ts',
    pairs: [
      ['', '資格不要かつ AI リスク低', 1],
    ],
  },
  {
    label: '19',
    file: 'views/rankings-meta.ts',
    pairs: [
      ['RANKING · 安定職', 'RANKING · 正規雇用', 1],
      ['RANKING · AI 安全 × ', 'RANKING · AI影響 少 × ', 6],
      ['RANKING · 大規模 × 安全', 'RANKING · 大規模', 1],
      ['RANKING · 低ストレス', 'RANKING · 短時間', 1],
    ],
  },
  {
    label: '20',
    file: 'views/rankings-meta.ts',
    pairs: [
      ['低ストレス安定職 TOP30', '短時間 × AI影響が少ない職業 TOP30', 1],
    ],
  },
  {
    label: '20',
    file: 'views/ranking/build.ts',
    pairs: [
      ['低ストレス安定職', '短時間 × AI影響が少ない職業 TOP30', 1],
    ],
  },
  {
    label: '20',
    file: 'views/ranking/rankings/intent.ts',
    pairs: [
      ['低ストレス安定職 TOP30【2026年版】| 未来の仕事', '短時間 × AI影響が少ない職業 TOP30【2026年版】| 未来の仕事', 1],
      ['低ストレス安定職 TOP${lowStressStable.length}', '短時間 × AI影響が少ない職業 TOP${lowStressStable.length}', 1],
    ],
  },
];

describe('signed legacy copy batch 2', () => {
  for (const { label, file, pairs } of SIGNED) {
    test(`#${label}: exact signed wording in ${file}`, () => {
      const source = read(file);
      for (const [oldCopy, newCopy, occurrences] of pairs) {
        if (oldCopy) assert.equal(count(source, oldCopy), 0, `retired: ${oldCopy}`);
        if (newCopy) assert.equal(count(source, newCopy), occurrences, `signed: ${newCopy}`);
      }
    });
  }
});
