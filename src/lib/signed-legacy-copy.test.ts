/** Owner-signed legacy-copy batch 1 (2026-10-21, #927).
 * Labels follow the signature: #1–#27 plus #26a/#26b/#26c.
 * Exact counts prevent partial rewrites; #12 is scoped by function below.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

const read = (file: string): string => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const count = (source: string, phrase: string): number => source.split(phrase).length - 1;
const functionBody = (source: string, name: string): string =>
  source.split(`export function ${name}(`)[1]!.split('\nexport function ')[0]!;

const SIGNED: ReadonlyArray<{
  label: string;
  file: string;
  pairs: ReadonlyArray<readonly [string, string, number]>;
}> = [
  {
    "label": "1",
    "file": "pages/404.astro",
    "pairs": [
      [
        "16 セクターから探す",
        "業種から探す",
        1
      ],
      [
        "業界別 {OCCUPATION_COUNT.SCORED} 職業",
        "業種別 {OCCUPATION_COUNT.SCORED} 職業",
        1
      ]
    ]
  },
  {
    "label": "2",
    "file": "pages/404.astro",
    "pairs": [
      [
        "AIリスク・年収・就業者数",
        "仕事の変化・働く人の数・収入など",
        1
      ]
    ]
  },
  {
    "label": "3",
    "file": "pages/404.astro",
    "pairs": [
      [
        "AIに奪われる仕事 TOP30",
        "AIで大きく変わる仕事 TOP30",
        1
      ],
      [
        "AI影響度が高い職業",
        "仕事がなくなる順ではなく、AIで仕事の中身が大きく変わる順です。",
        1
      ]
    ]
  },
  {
    "label": "4",
    "file": "pages/404.astro",
    "pairs": [
      [
        "将来性のある職業",
        "AIで仕事の中身が変わりにくい順です。点が低いほど、変わる部分が少ない仕事です。",
        1
      ]
    ]
  },
  {
    "label": "5",
    "file": "pages/404.astro",
    "pairs": [
      [
        "収入と安定を両立",
        "AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。右の点数は順位とは別です。",
        1
      ]
    ]
  },
  {
    "label": "6",
    "file": "pages/404.astro",
    "pairs": [
      [
        "最も人が多い職業",
        "就業者数が多い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。",
        1
      ]
    ]
  },
  {
    "label": "7",
    "file": "pages/404.astro",
    "pairs": [
      [
        "← マップへ戻る",
        "← トップへ戻る",
        1
      ]
    ]
  },
  {
    "label": "8",
    "file": "views/sector-faqs.ts",
    "pairs": [
      [
        "${nameJa}業界の将来性は？",
        "${nameJa}業界は、AIでどのくらい変わる？",
        1
      ]
    ]
  },
  {
    "label": "9",
    "file": "views/sector-faqs.ts",
    "pairs": [
      [
        "AIに代替されにくい職業が多く、将来性が比較的高い",
        "AIで仕事の中身が変わる部分が小さい職業が多い",
        1
      ]
    ]
  },
  {
    "label": "10",
    "file": "views/sector-faqs.ts",
    "pairs": [
      [
        "職業選択時には個別の代替リスクの確認が重要な",
        "職業ごとの点数の確認が大切な",
        1
      ]
    ]
  },
  {
    "label": "11",
    "file": "views/sector-faqs.ts",
    "pairs": [
      [
        "特に AI リスクが低い職業として",
        "特に点数が低い職業として",
        1
      ]
    ]
  },
  {
    "label": "12",
    "file": "lib/ai-fact-summary.ts",
    "pairs": [
      [
        "${sector.nameJa}の引用用ファクト：GEO-Aの全${facts.occupationCount}職業データでは、",
        "${sector.nameJa}の引用用ファクト：本サイトの全${facts.occupationCount}職業データでは、",
        1
      ],
      [
        "${subjectJa}の引用用ファクト：GEO-Aの全${facts.occupationCount}職業データでは、",
        "${subjectJa}の引用用ファクト：本サイトの全${facts.occupationCount}職業データでは、",
        1
      ]
    ]
  },
  {
    "label": "13",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "高齢化に伴う需要増も相まって長期的に安定したキャリアが築ける。",
        "高齢化に伴い、需要が増えている職業も多い。",
        1
      ]
    ]
  },
  {
    "label": "14",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "福祉・介護セクターは AI 時代の「安全地帯」として位置づけられる。",
        "福祉・介護セクターは、AI で仕事の中身が変わる部分が比較的小さい職業が多い分野。",
        1
      ]
    ]
  },
  {
    "label": "15",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "長期的なキャリア安定性と社会的意義の両方が確保できる職業群。",
        "社会的意義の大きい職業群でもある。",
        1
      ]
    ]
  },
  {
    "label": "16",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "学校教員は資格・公務員的安定性も併せ持つ。",
        "学校教員は資格が必要な職業でもある。",
        1
      ]
    ]
  },
  {
    "label": "17",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "保安・公安セクターは AI 時代でも需要が安定する公的職業群。",
        "保安・公安セクターは、警察・消防・自衛などの公的職業群。",
        1
      ]
    ]
  },
  {
    "label": "18",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "地方公務員・国家公務員としての雇用安定性と福利厚生も大きな魅力。",
        "",
        0
      ]
    ]
  },
  {
    "label": "19",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "を要する職業は AI 安全度が高い。",
        "を要する職業は、AI で変わる部分が比較的小さい。",
        1
      ]
    ]
  },
  {
    "label": "20",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "製造・職人セクターは AI 時代の安定軸の一つ。",
        "製造・職人セクターは、工程によって AI の影響が大きく分かれる分野。",
        1
      ]
    ]
  },
  {
    "label": "21",
    "file": "views/sector-meta.ts",
    "pairs": [
      [
        "は AI で代替不可能。",
        "は AI で置き換えにくい。",
        2
      ]
    ]
  },
  {
    "label": "22",
    "file": "views/qa-items/ai-anxiety.ts",
    "pairs": [
      [
        "AI 影響度 4-6",
        "AI 影響度 4.0〜6.9",
        2
      ],
      [
        "7+ で評価。",
        "7.0 以上に多い。",
        1
      ],
      [
        "(7+)",
        "(7.0 以上)",
        1
      ]
    ]
  },
  {
    "label": "23",
    "file": "views/qa-items/ai-anxiety-extra.ts",
    "pairs": [
      [
        "AI 失業リスクへの対処は",
        "AI による仕事の変化への対処は",
        1
      ],
      [
        "AI 影響度 4 以下の",
        "AI 影響度 4 未満の",
        1
      ],
      [
        "長期的に安定。",
        "現実的です。",
        1
      ]
    ]
  },
  {
    "label": "24",
    "file": "views/qa-items/ai-anxiety-extra.ts",
    "pairs": [
      [
        "AI 影響度 4-6",
        "AI 影響度 4.0〜6.9",
        2
      ]
    ]
  },
  {
    "label": "25",
    "file": "views/qa-items/career.ts",
    "pairs": [
      [
        "5 年スパンで見れば安定するケースが多い。",
        "5 年スパンで見れば、収入が戻るケースもある。",
        1
      ]
    ]
  },
  {
    "label": "26",
    "file": "pages/pro/yearly/2026-report.astro",
    "pairs": [
      [
        "",
        "この年報は 2026-05-30 時点の記録です。区分は当時の整数での区切りで、現在の区分（4未満／4.0〜6.9／7.0以上）とは異なります。",
        1
      ]
    ]
  },
  {
    "label": "26a",
    "file": "pages/pro/yearly/2026-report.astro",
    "pairs": [
      [
        "ケアの仕事は AI 時代の安全地帯",
        "ケアの仕事は AI 影響が低めで、需要も高い",
        1
      ]
    ]
  },
  {
    "label": "26b",
    "file": "pages/pro/yearly/2026-report.astro",
    "pairs": [
      [
        "長く投資する価値が出やすい領域です。",
        "",
        0
      ]
    ]
  },
  {
    "label": "26c",
    "file": "pages/pro/yearly/2026-report.astro",
    "pairs": [
      [
        "長期 (10 年+) で安定する分野は 2 つ",
        "長期 (10 年+) で見て、AI の影響を受けにくい分野は 2 つ",
        1
      ]
    ]
  },
  {
    "label": "27",
    "file": "views/compare-meta.ts",
    "pairs": [
      [
        "初期投資から将来性まで比較。",
        "初期投資から AI での変化まで比較。",
        1
      ]
    ]
  }
];

describe('signed legacy copy batch 1', () => {
  for (const { label, file, pairs } of SIGNED) {
    test(`#${label}: exact signed wording in ${file}`, () => {
      let source = read(file);
      if (label === '12') {
        source = ['buildSectorGeoFactSummary', 'buildCompareGeoFactSummary']
          .map((name) => functionBody(source, name)).join('\n');
      }
      for (const [oldCopy, newCopy, occurrences] of pairs) {
        if (oldCopy) assert.equal(count(source, oldCopy), 0, `retired: ${oldCopy}`);
        if (newCopy) assert.equal(count(source, newCopy), occurrences, `signed: ${newCopy}`);
      }
    });
  }

  test('#12 preserves both ranking set prefixes and the occupation fact function', () => {
    const source = read('lib/ai-fact-summary.ts');
    const set = functionBody(source, 'buildOccupationSetGeoFactSummary');
    assert.equal(count(set, 'GEO-Aの全${facts.occupationCount}職業データでは、'), 1);
    assert.equal(count(set, 'GEO-Aの全${facts.occupationCount}職業データから、'), 1);
    assert.equal(count(source, '本サイトの全${facts.occupationCount}職業データでは、'), 2);
    assert.equal(createHash('sha256').update(functionBody(source, 'buildOccupationGeoFactSummary')).digest('hex'),
      'c41cf14d50931250e2b22c48e68f2020168a451887d8740784216357121c99e9');
    assert.equal(createHash('sha256').update(functionBody(source, 'buildOccupationSetGeoFactSummary')).digest('hex'),
      '03f97a45647dfe15b2600db62010580d9a4efc8d39c6ec4805be7f0364d5ec52');
  });

  test('#26 retains the historical distribution instead of recalculating it', () => {
    const source = read('pages/pro/yearly/2026-report.astro');
    assert.ok(source.includes('大（7 以上）= 約 2% / 中（4〜6）= 約 58% / 小（3 以下）= 約 39%'));
    assert.ok(source.includes('556 職業の 58%（325 職業）が AI 影響 4〜6'));
    assert.ok(source.includes('AI 影響 4 以下が約 170。'));
    const snapshot = source.indexOf('数値は当時のものです:</p>');
    const note = source.indexOf('この年報は 2026-05-30 時点の記録です。');
    assert.ok(snapshot < note && note < source.indexOf('<ul>', snapshot));
  });
});
