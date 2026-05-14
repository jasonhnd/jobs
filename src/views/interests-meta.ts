/**
 * src/views/interests-meta.ts — RIASEC (Holland Code) 6 タイプの
 * メタデータ。
 *
 * Migrated from src/data/lib/interests-meta.ts 2026-05-14 as part
 * of Phase B (data/lib retirement). Lives under src/views/ because
 * the file is a typed configuration table — exactly what the views
 * layer is for per architecture.md §6.2 ("pure data, typed
 * projections").
 *
 * Pure-data モジュール、fs / Node-runtime imports なし — Astro frontmatter
 * (Node SSG) と Vercel Edge Functions (api/og.tsx) 両方からインポート可能。
 *
 * 単一の真理源: 新タイプ追加 (現状 6 で固定だが将来の拡張余地)、slug
 * 変更、表示名変更はすべてここから。
 *
 * RIASEC は John Holland の職業興味 6 類型理論。data/occupations の
 * `interests` ブロックに R/I/A/S/E/C 6 dim の score (0-5) があり、
 * data.holland.json (build:data 出力) で全 occ × 6 dim の columnar 表現
 * になっている。
 */

export type InterestType = 'realistic' | 'investigative' | 'artistic' | 'social' | 'enterprising' | 'conventional';

export interface InterestMeta {
  slug: InterestType;
  /** RIASEC の 1 文字 (R/I/A/S/E/C) — data.holland.json の cols に対応 */
  letter: 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
  /** 日本語ラベル (例: "現実的") */
  name_ja: string;
  /** SEO / OG カード用の長めのタイトル */
  title_ja: string;
  /** タイプの説明 (1 段落、200 字程度) */
  description_ja: string;
  /** 向いている人の特徴 (3-5 項目) */
  characteristics_ja: ReadonlyArray<string>;
  /** 代表的な職業のヒント (向いていそうな職業ジャンル、3-5 個) */
  typical_fields_ja: ReadonlyArray<string>;
  /** OG カードの eyebrow 文字列 */
  og_eyebrow: string;
}

export const INTEREST_META: ReadonlyArray<InterestMeta> = [
  {
    slug: 'realistic',
    letter: 'R',
    name_ja: '現実的',
    title_ja: '現実的タイプ (R) におすすめの職業',
    description_ja:
      '物・道具・機械を扱う仕事を好み、屋外や現場での身体的活動に充実感を覚えるタイプ。' +
      '具体的で目に見える成果を重視し、抽象的な議論より手を動かして問題を解決する方が得意。' +
      '機械操作・修理・建設・農林水産・運転・身体技能を要する職業との適合性が高い傾向。',
    characteristics_ja: [
      '体を動かす仕事を好む',
      '具体的・目に見える成果を重視',
      '機械や道具の扱いが得意',
      '抽象的な議論より実践を好む',
      '屋外・現場での作業に抵抗がない',
    ],
    typical_fields_ja: ['建設・土木', '製造・職人', '運輸・操縦', '農林水産', '保安・公安'],
    og_eyebrow: 'INTEREST · REALISTIC',
  },
  {
    slug: 'investigative',
    letter: 'I',
    name_ja: '研究的',
    title_ja: '研究的タイプ (I) におすすめの職業',
    description_ja:
      '観察・分析・思考を通じて知識を深めることに価値を感じるタイプ。' +
      '抽象概念の操作や論理的推論に強く、ルーチンワークより新しい問いに取り組むことを好む。' +
      '研究・科学・医療・データ分析・学術系の職業との適合性が高い傾向。',
    characteristics_ja: [
      '観察と分析が得意',
      '抽象的・論理的思考を楽しむ',
      '新しい問題に取り組むことを好む',
      '一人で集中して作業する時間を必要とする',
      '実証データや事実を重視',
    ],
    typical_fields_ja: ['医療・保健', '専門・技術', 'IT・通信', '教育・指導', '製造 (R&D)'],
    og_eyebrow: 'INTEREST · INVESTIGATIVE',
  },
  {
    slug: 'artistic',
    letter: 'A',
    name_ja: '芸術的',
    title_ja: '芸術的タイプ (A) におすすめの職業',
    description_ja:
      '創造性と自己表現を重視するタイプ。' +
      '形式的な構造より自由な発想を好み、独自の美意識やオリジナリティの追求に価値を感じる。' +
      'クリエイティブ・メディア・デザイン・芸能・文筆・調理など、表現性の高い職業との適合性が高い傾向。',
    characteristics_ja: [
      '自己表現と創造性を重視',
      '形式的な制約より自由を好む',
      '独自の視点・美意識を持つ',
      '感性で判断することが多い',
      'ルーチンワークが苦手',
    ],
    typical_fields_ja: ['クリエイティブ・メディア', '芸能', 'デザイン', '調理・パティシエ', '文筆・編集'],
    og_eyebrow: 'INTEREST · ARTISTIC',
  },
  {
    slug: 'social',
    letter: 'S',
    name_ja: '社会的',
    title_ja: '社会的タイプ (S) におすすめの職業',
    description_ja:
      '人と関わり、教える・助ける・癒すことに価値を感じるタイプ。' +
      '他者の感情やニーズを察知することが得意で、対人支援や教育・医療・福祉の現場でやりがいを感じる。' +
      '看護・介護・保育・教育・カウンセリング・接客などの職業との適合性が高い傾向。',
    characteristics_ja: [
      '人と関わることを好む',
      '他者の感情やニーズに敏感',
      '教える・助ける・癒すことにやりがいを感じる',
      'チームでの協力作業が得意',
      '言葉によるコミュニケーションを重視',
    ],
    typical_fields_ja: ['医療・保健', '福祉・介護', '教育・指導', 'サービス・接客', '販売'],
    og_eyebrow: 'INTEREST · SOCIAL',
  },
  {
    slug: 'enterprising',
    letter: 'E',
    name_ja: '企業的',
    title_ja: '企業的タイプ (E) におすすめの職業',
    description_ja:
      'リーダーシップ・説得・経営を通じて目標を達成することに価値を感じるタイプ。' +
      '人を動かす・成果を上げる・組織を率いることに充実感を覚え、競争的な環境を厭わない。' +
      '営業・経営・士業・販売・起業・リーダー職との適合性が高い傾向。',
    characteristics_ja: [
      '人を動かす・説得することが得意',
      '目標達成への意欲が高い',
      'リーダーシップを発揮したい',
      '競争的な環境を厭わない',
      '成果と評価を重視',
    ],
    typical_fields_ja: ['士業・経営', '販売・営業', 'サービス・接客', '金融', '起業・自営'],
    og_eyebrow: 'INTEREST · ENTERPRISING',
  },
  {
    slug: 'conventional',
    letter: 'C',
    name_ja: '慣習的',
    title_ja: '慣習的タイプ (C) におすすめの職業',
    description_ja:
      '規則・記録・正確性を重視するタイプ。' +
      '構造化された環境で精密に作業することが得意で、ルーチンや手順を守ることに安心感を覚える。' +
      '事務・経理・管理・技術文書・データ管理など、几帳面さが活きる職業との適合性が高い傾向。',
    characteristics_ja: [
      '正確性・几帳面さを重視',
      '規則や手順を守ることが得意',
      '構造化された環境で力を発揮',
      '記録やデータの管理が好き',
      '突発的な変化より安定を好む',
    ],
    typical_fields_ja: ['事務・公務', '経理・会計', '専門・技術 (品質管理)', '士業 (法務事務)', '銀行・金融事務'],
    og_eyebrow: 'INTEREST · CONVENTIONAL',
  },
];

/**
 * slug → meta lookup. Throws if slug is unknown (caller should validate first).
 */
export function getInterestMeta(slug: string): InterestMeta {
  const meta = INTEREST_META.find((m) => m.slug === slug);
  if (!meta) {
    throw new Error(`Unknown interest slug: ${slug}. Known: ${INTEREST_META.map((m) => m.slug).join(', ')}`);
  }
  return meta;
}
