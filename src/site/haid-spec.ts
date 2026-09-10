/**
 * HAID — Human–AI Distance（人類と AI の距離 10 段階）v1.0.
 *
 * Single source of truth for the HAID specification: the ten levels, the four
 * relations they belong to, the three named relation boundaries, the terms,
 * the certainty labels and the v1.0 boundary rulings.
 *
 * Consumers:
 *   - src/pages/haid.astro                 — public standard page + JSON-LD DefinedTermSet
 *   - src/data/projections/haid-spec.ts    — public/data.haid-spec.json (machine-readable)
 *   - the quarterly /aiadoption release projection (follows in a later PR)
 *
 * Owner-signed 2026-09-11. Level numbers are permanent: a level is never
 * renumbered or reused; changing a definition bumps the major version, adding
 * a boundary ruling bumps the minor version. Future refinement branches
 * inward (e.g. 8.1) — it never appends an 11th level.
 */

export const HAID_SPEC_VERSION = '1.0';
/** Date the v1.0 definitions were frozen. Static on purpose (not the build clock). */
export const HAID_SPEC_DATE = '2026-09-11';
export const HAID_LICENSE = 'CC BY 4.0';
export const HAID_NAME_JA = '人類と AI の距離 10 段階';
export const HAID_NAME_EN = 'Human–AI Distance (HAID)';

export type HaidRelationId = 'none' | 'tool' | 'presence' | 'union';

export interface HaidRelation {
  readonly id: HaidRelationId;
  readonly order: number;
  readonly ja: string;
  readonly en: string;
  /** One-line reading of the relation, 常体. */
  readonly tagline_ja: string;
  readonly description_ja: string;
  /** Inclusive level range. */
  readonly levels: readonly [number, number];
}

export type HaidWindow = 'itu_3m' | 'none' | 'days_30' | 'days_7' | 'state' | 'counterfactual';

/** How well the 2026 anchors can pin the level. Reported with every number. */
export type HaidCertainty = 'measured' | 'residual' | 'lower_bound' | 'range' | 'none';

export interface HaidLevel {
  readonly level: number;
  readonly relation: HaidRelationId;
  readonly ja: string;
  readonly en: string;
  /** Operational criterion, 常体. Product-independent. */
  readonly criterion_ja: string;
  readonly criterion_en: string;
  readonly window: HaidWindow;
  readonly window_ja: string;
  readonly certainty_2026: HaidCertainty;
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
  /** Levels this case is ruled into. Empty = outside the definition of 生成 AI. */
  readonly levels: readonly number[];
  readonly note_ja?: string;
}

export const HAID_RELATIONS: readonly HaidRelation[] = [
  {
    id: 'none',
    order: 1,
    ja: '無縁',
    en: 'Unreached',
    tagline_ja: 'AI が届いていない',
    description_ja: 'インターネットに届いていない、または届いていても AI の出力に触れていない。',
    levels: [1, 2],
  },
  {
    id: 'tool',
    order: 2,
    ja: '道具',
    en: 'Tool',
    tagline_ja: '自分が呼ぶ',
    description_ja: '本人が呼んだときだけ AI が動く。呼ばなければ何も起きない。',
    levels: [3, 6],
  },
  {
    id: 'presence',
    order: 3,
    ja: '同席',
    en: 'Presence',
    tagline_ja: '向こうがいる',
    description_ja: '呼ばなくても本人の文脈に接し、先回りして動く。本人の名で外に出ることもある。',
    levels: [7, 8],
  },
  {
    id: 'union',
    order: 4,
    ja: '一体',
    en: 'Union',
    tagline_ja: '分けられない',
    description_ja: '記憶や関係の置き場が AI 側にあり、切り離すと日常が成り立たない。',
    levels: [9, 10],
  },
];

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
    certainty_2026: 'measured',
  },
  {
    level: 2,
    relation: 'none',
    ja: '圏内・未接触',
    en: 'In reach, untouched',
    criterion_ja: 'インターネットは利用するが、第 3 段階以上に該当しない。',
    criterion_en: 'Uses the internet but does not meet level 3 or above.',
    window: 'none',
    window_ja: '残差として算出',
    certainty_2026: 'residual',
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
    certainty_2026: 'lower_bound',
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
    certainty_2026: 'range',
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
    certainty_2026: 'range',
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
    certainty_2026: 'lower_bound',
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
    certainty_2026: 'none',
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
    certainty_2026: 'none',
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
    certainty_2026: 'none',
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
    certainty_2026: 'none',
  },
];

/** The three lines where the relation changes kind, not degree. Drawn heavier in every chart. */
export const HAID_BOUNDARIES: readonly HaidBoundary[] = [
  { from: 2, to: 3, ja: 'AI が届いた', en: 'AI arrives' },
  { from: 6, to: 7, ja: '呼ぶ側から、呼ばれる側へ', en: 'From calling to being called' },
  { from: 8, to: 9, ja: '道具から、自分の一部へ', en: 'From tool to part of oneself' },
];

export const HAID_TERMS: readonly HaidTerm[] = [
  {
    ja: '生成 AI',
    en: 'generative AI',
    definition_ja:
      '入力に応じて文章、画像、音声、コードなどの新しい内容を作り出すシステム。検索結果の並べ替え、おすすめ表示、迷惑メール判定、予測変換は含まない。',
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
    definition_ja:
      '本人が目的を伝え、生成 AI が複数の手順を自律的に実行して結果を返すこと。手順の途中を本人が逐一指示した場合は「話しかける」とみなす。',
  },
  {
    ja: '対価',
    en: 'payment',
    definition_ja:
      '本人または本人の所属組織が、その人の利用のために支払う金銭。広告視聴は含まない。段階ではなく属性として扱い、段階の分布とは別に報告する。',
  },
];

export const HAID_CERTAINTY_JA: Readonly<Record<HaidCertainty, string>> = {
  measured: '実測',
  residual: '残差',
  lower_bound: '下限のみ',
  range: '推定幅',
  none: 'データなし',
};

export const HAID_WINDOW_JA: Readonly<Record<HaidWindow, string>> = {
  itu_3m: 'ITU 定義・過去 3 か月',
  none: '残差',
  days_30: '過去 30 日',
  days_7: '過去 7 日',
  state: '状態',
  counterfactual: '反事実',
};

/** v1.0 boundary rulings. New rulings are added (minor version); existing ones are not moved. */
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

export function haidRelationOf(level: number): HaidRelation {
  const found = HAID_RELATIONS.find((r) => level >= r.levels[0] && level <= r.levels[1]);
  if (!found) throw new Error(`[haid] level ${level} has no relation`);
  return found;
}

export function haidBoundaryBefore(level: number): HaidBoundary | null {
  return HAID_BOUNDARIES.find((b) => b.to === level) ?? null;
}

/** Recommended citation, Japanese. `{quarter}` is filled by the release page. */
export const HAID_CITATION_JA =
  'mirai-shigoto.com「人類と AI の距離 10 段階（HAID）」v1.0';

export const HAID_CANONICAL_PATH = '/haid';
