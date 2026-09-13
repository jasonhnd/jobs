/**
 * HAID — Human–AI Distance（人類と AI の距離 10 段階）v1.0.
 *
 * Single source of truth for the definitions. Every string is copied
 * byte-for-byte from docs/HAID.md (owner-signed 2026-09-11 / 2026-09-13).
 * Consumers: src/pages/haid.astro (haid-1.4), src/data/projections/haid-spec.ts (haid-1.3).
 *
 * Level numbers are permanent. A definition change bumps the major version;
 * an added ruling bumps the minor version. Never append an 11th level.
 * No count, no certainty, no date other than HAID_SPEC_DATE lives here.
 */

export const HAID_SPEC_VERSION = '1.0';
/** Date v1.0 was frozen. Static on purpose — never the build clock. */
export const HAID_SPEC_DATE = '2026-09-11';
export const HAID_LICENSE = 'CC BY 4.0';
export const HAID_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const HAID_NAME_JA = '人類と AI の距離 10 段階';
export const HAID_NAME_EN = 'Human–AI Distance (HAID)';
export const HAID_CANONICAL_PATH = '/haid';
export const HAID_CITATION_JA = 'mirai-shigoto.com「人類と AI の距離 10 段階（HAID）」v1.0';

export type HaidRelationId = 'none' | 'tool' | 'presence' | 'union';
export type HaidWindow = 'itu_3m' | 'residual' | 'days_30' | 'days_7' | 'state' | 'counterfactual';
export type HaidGrade = 'A' | 'B' | 'C' | 'D';
export type HaidCertainty = 'measured' | 'residual' | 'lower_bound' | 'range' | 'none';

export interface HaidRelation {
  readonly id: HaidRelationId;
  readonly order: 1 | 2 | 3 | 4;
  readonly ja: string;            // 無縁 / 道具 / 同席 / 一体
  readonly en: string;            // Unreached / Tool / Presence / Union
  readonly tagline_ja: string;    // 一言 column of the 4 つの関係 table
  readonly description_ja: string;// 説明 column
  readonly levels: readonly [number, number]; // inclusive range
}

export interface HaidLevel {
  readonly level: number;         // 1..10, permanent
  readonly relation: HaidRelationId;
  readonly ja: string;            // 名称
  readonly en: string;            // English
  readonly criterion_ja: string;  // 判定
  readonly criterion_en: string;
  readonly window: HaidWindow;
  readonly window_ja: string;     // 観測窓 (verbatim from the table)
  readonly grades: readonly HaidGrade[];
  readonly measurement_ja: string;// 測り方 (verbatim from the table)
}

export interface HaidBoundary {
  readonly from: number;
  readonly to: number;
  readonly ja: string;
  readonly en: string;
}

export interface HaidTerm {
  readonly ja: string;
  readonly en: string;
  readonly definition_ja: string;
}

export interface HaidCase {
  readonly case_ja: string;
  readonly levels: readonly number[]; // [] = 対象外
  readonly note_ja?: string;
}

export const HAID_RELATIONS: readonly HaidRelation[] = [
  { id: 'none',     order: 1, ja: '無縁', en: 'Unreached', tagline_ja: 'AI が届いていない', description_ja: 'インターネットに届いていない、または届いていても AI の出力に触れていない。', levels: [1, 2] },
  { id: 'tool',     order: 2, ja: '道具', en: 'Tool',      tagline_ja: '自分が呼ぶ',        description_ja: '本人が呼んだときだけ AI が動く。呼ばなければ何も起きない。', levels: [3, 6] },
  { id: 'presence', order: 3, ja: '同席', en: 'Presence',  tagline_ja: '向こうがいる',      description_ja: '呼ばなくても本人の文脈に接し、先回りして動く。本人の名で外に出ることもある。', levels: [7, 8] },
  { id: 'union',    order: 4, ja: '一体', en: 'Union',     tagline_ja: '分けられない',      description_ja: '記憶や関係の置き場が AI 側にあり、切り離すと日常が成り立たない。', levels: [9, 10] },
] as const;

export const HAID_WINDOW_JA: Readonly<Record<HaidWindow, string>> = {
  itu_3m: 'ITU 定義・過去 3 か月',
  residual: '残差として算出',
  days_30: '過去 30 日',
  days_7: '過去 7 日',
  state: '状態として判定',
  counterfactual: '反事実で判定',
};

export const HAID_GRADE_JA: Readonly<Record<HaidGrade, string>> = {
  A: '政府・国際機関の統計',
  B: '事業者の公式発表',
  C: '第三者パネル',
  D: '調査',
};

export const HAID_CERTAINTY_JA: Readonly<Record<HaidCertainty, string>> = {
  measured: '実測',
  residual: '残差',
  lower_bound: '下限のみ',
  range: '推定幅',
  none: 'データなし',
};

export const HAID_LEVELS: readonly HaidLevel[] = [
  {
    level: 1,
    relation: 'none',
    ja: '未到達',
    en: 'Not reached',
    criterion_ja: 'インターネットを利用していない。',
    criterion_en: 'Does not use the internet.',
    window: 'itu_3m',
    window_ja: 'ITU 定義・過去 3 か月',
    grades: ['A'],
    measurement_ja: 'A 国際機関の統計（ITU・国連）',
  },
  {
    level: 2,
    relation: 'none',
    ja: '圏内・未接触',
    en: 'In reach, untouched',
    criterion_ja: 'インターネットは利用するが、第 3 段階以上に該当しない。',
    criterion_en: 'Uses the internet but does not meet level 3 or above.',
    window: 'residual',
    window_ja: '残差として算出',
    grades: ['A'],
    measurement_ja: 'A 国際機関の統計から残差で出す',
  },
  {
    level: 3,
    relation: 'tool',
    ja: '見せられている',
    en: 'Shown',
    criterion_ja: '頼んでいないのに、生成 AI が作った内容を見せられた。',
    criterion_en: 'Was shown generative-AI output without asking for it.',
    window: 'days_30',
    window_ja: '過去 30 日',
    grades: ['B'],
    measurement_ja: 'B 事業者の公表値。上限は測れず、下限として扱う',
  },
  {
    level: 4,
    relation: 'tool',
    ja: '使うことがある',
    en: 'Uses sometimes',
    criterion_ja: '自分の意思で生成 AI に入力し、応答を受け取った。',
    criterion_en: 'Deliberately prompted a generative AI and received a response.',
    window: 'days_30',
    window_ja: '過去 30 日に 1 回以上',
    grades: ['B', 'C', 'D'],
    measurement_ja: 'B を錨に、C 第三者パネルで補い、D 調査で交差検証',
  },
  {
    level: 5,
    relation: 'tool',
    ja: '日常の道具',
    en: 'Everyday tool',
    criterion_ja: '自分の意思で生成 AI に入力し、応答を受け取った。',
    criterion_en: 'Deliberately prompted a generative AI and received a response.',
    window: 'days_7',
    window_ja: '過去 7 日に 1 回以上',
    grades: ['B', 'C', 'D'],
    measurement_ja: 'B を錨に、C 第三者パネルで補い、D 調査で交差検証',
  },
  {
    level: 6,
    relation: 'tool',
    ja: '任せている',
    en: 'Delegates',
    criterion_ja: '目的だけを伝え、複数手順の作業を生成 AI に実行させ、結果を自分で確かめた。',
    criterion_en: 'Gave only the goal, had the AI carry out a multi-step task, and checked the result.',
    window: 'days_30',
    window_ja: '過去 30 日に 1 回以上',
    grades: ['B'],
    measurement_ja: 'B 事業者の公表値。現時点ではコーディング用エージェントのみ',
  },
  {
    level: 7,
    relation: 'presence',
    ja: '常に横にいる',
    en: 'Always alongside',
    criterion_ja: '呼ばなくても本人の予定・連絡・記録などの文脈に接し、先回りして動く AI を日常的に使っている。',
    criterion_en: 'Routinely uses an AI that, unprompted, has access to their calendar, messages or records and acts ahead of them.',
    window: 'days_30',
    window_ja: '過去 30 日',
    grades: ['D'],
    measurement_ja: 'D 調査のみ。事業者の公表値は存在しない',
  },
  {
    level: 8,
    relation: 'presence',
    ja: '自分の名で動く',
    en: 'Acts in their name',
    criterion_ja: '本人の名で外部（送信・購入・予約・交渉）に接する AI を使い、本人は結果を確認している。',
    criterion_en: 'Uses an AI that deals with the outside world in their name (sending, buying, booking, negotiating); the person reviews the outcome.',
    window: 'days_30',
    window_ja: '過去 30 日に 1 回以上',
    grades: ['D'],
    measurement_ja: 'D 調査のみ。事業者の公表値は存在しない',
  },
  {
    level: 9,
    relation: 'union',
    ja: '自分より自分を知る',
    en: 'Knows them better than they do',
    criterion_ja: '記憶・嗜好・人間関係の主たる保管場所が、本人の頭や紙ではなく AI 側にある。',
    criterion_en: 'The primary store of their memories, preferences and relationships is on the AI side, not in their head or on paper.',
    window: 'state',
    window_ja: '状態として判定',
    grades: ['D'],
    measurement_ja: 'D 調査のみ。事業者の公表値は存在しない',
  },
  {
    level: 10,
    relation: 'union',
    ja: '分けられない',
    en: 'Inseparable',
    criterion_ja: '明日 AI が消えたとき、本人の一日が成り立たない。',
    criterion_en: 'If the AI vanished tomorrow, their day would not hold together.',
    window: 'counterfactual',
    window_ja: '反事実で判定',
    grades: ['D'],
    measurement_ja: 'D 調査のみ。事業者の公表値は存在しない',
  },
];

export const HAID_BOUNDARIES: readonly HaidBoundary[] = [
  { from: 2, to: 3, ja: 'AI が届いた',              en: 'AI arrives' },
  { from: 6, to: 7, ja: '呼ぶ側から、呼ばれる側へ',  en: 'From calling to being called' },
  { from: 8, to: 9, ja: '道具から、自分の一部へ',    en: 'From tool to part of oneself' },
] as const;

export const HAID_TERMS: readonly HaidTerm[] = [
  {
    ja: '生成 AI',
    en: 'generative AI',
    definition_ja: '入力に応じて文章、画像、音声、コードなどの新しい内容を作り出すシステム。検索結果の並べ替え、おすすめ表示、迷惑メール判定、予測変換は含まない。',
  },
  {
    ja: '触れる',
    en: 'exposed',
    definition_ja: '本人が頼んでいないのに、生成 AI が作った内容を見せられること。',
  },
  {
    ja: '話しかける',
    en: 'prompt',
    definition_ja: '本人が自分の意思で生成 AI に入力し、応答を受け取ること。文字、音声、画像のいずれでもよい。',
  },
  {
    ja: '任せる',
    en: 'delegate',
    definition_ja: '本人が目的を伝え、生成 AI が複数の手順を自律的に実行して結果を返すこと。手順の途中を本人が逐一指示した場合は「話しかける」とみなす。',
  },
  {
    ja: '対価',
    en: 'payment',
    definition_ja: '本人または本人の所属組織が、その人の利用のために支払う金銭。広告視聴は含まない。段階ではなく属性として扱う。',
  },
] as const;

export const HAID_CASES: readonly HaidCase[] = [
  { case_ja: '検索結果の AI による概要を見た', levels: [3] },
  { case_ja: 'メッセージアプリの中で AI に自分から質問した', levels: [4] },
  { case_ja: '1 行ずつのコード補完を使った', levels: [4] },
  { case_ja: 'コーディングエージェントに「このバグを直して」と任せ、差分を確認した', levels: [6] },
  { case_ja: '会社が AI アシスタントを契約したが、本人は開いていない', levels: [2, 3], note_ja: '見せられていれば第 3 段階。' },
  { case_ja: '会社契約の AI アシスタントを週に使っている', levels: [5], note_ja: '対価は属性として別に記録する。' },
  { case_ja: '画像を生成した', levels: [4] },
  { case_ja: 'メール本文を AI に下書きさせ、自分で直して送った', levels: [4, 5], note_ja: '送ったのは本人。頻度で 4 か 5。' },
  { case_ja: 'AI が本人名義で返信を送り、本人は後で読んだ', levels: [8] },
  { case_ja: '予測変換・迷惑メール判定・おすすめ表示', levels: [], note_ja: '生成 AI に含めない。' },
];

export const HAID_LEAD_JA: readonly [string, string] = [
  '「AI をどれだけの人が使っているか」を 1 つの利用率で答えると、分母と分子の取り方しだいで数字が動きます。HAID は代わりに、人と生成 AI の関係を行動で判定できる 10 の段階に分け、それぞれの段階にいる人数の分布として報告します。',
  '段階は位置であって、優劣ではありません。上の段階ほど「進んでいる」わけでも、下の段階が「遅れている」わけでもありません。測るのは人であり、端末や契約の数ではありません。',
];

export const HAID_LEVELS_NOTE_JA =
  '第 7 段階から上は、2026 年時点では公開データで人数を推定できません。これは基準の欠陥ではなく、現状の報告そのものです。段階の定義は、人数がゼロでも変えません。';

export function haidRelationOf(level: number): HaidRelation {
  const rel = HAID_RELATIONS.find((r) => level >= r.levels[0] && level <= r.levels[1]);
  if (!rel) throw new RangeError(`HAID level out of range: ${level}`);
  return rel;
}

export function haidBoundaryBefore(level: number): HaidBoundary | null {
  return HAID_BOUNDARIES.find((b) => b.to === level) ?? null;
}
