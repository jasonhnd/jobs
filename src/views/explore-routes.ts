/**
 * src/views/explore-routes.ts — 7 個の Level-2 entry routes 定義。
 *
 * 顶層 → 中層への "探し方" 入口。各 route は複数 genre index を集約する。
 *
 * Migrated from src/data/lib/explore-routes.ts 2026-05-14 (Phase B).
 * Lives under src/views/ per §6.2.
 */

export interface ExploreRoute {
  slug: string;
  short_ja: string;
  title_ja: string;
  description_ja: string;
  intro_ja: string;
  /** 含む genre の list */
  genres: ReadonlyArray<{
    path: string;
    label: string;
    desc: string;
  }>;
  og_eyebrow: string;
}

export const EXPLORE_ROUTES: ReadonlyArray<ExploreRoute> = [
  {
    slug: 'by-industry',
    short_ja: '業種で探す',
    title_ja: '業種から職業を探す',
    description_ja: '日本の 552 職業を 16 業種で分類。各業種の AI 影響度や代表職業を確認できる。',
    intro_ja: '医療・福祉・教育・建設・IT・事務・販売・サービスなど、16 の業種別に職業を整理。各業種には TOP 5 ランキング・全職業一覧・FAQ・パターン観察を含みます。',
    genres: [
      { path: 'sectors', label: '16 業種一覧', desc: '医療・福祉・建設・IT・事務など 16 業種の職業群' },
    ],
    og_eyebrow: 'EXPLORE · 業種',
  },
  {
    slug: 'by-ranking',
    short_ja: 'ランキングで探す',
    title_ja: 'ランキングから職業を探す',
    description_ja: 'AI 影響度・年収・初任給・労働時間・需要・組み合わせ等、39 のランキングで職業を比較できる。',
    intro_ja: '高年収 × AI 安全、人手不足、伝統技能で AI 抗性が高い等、39 種類のランキングで職業を多角的に比較。各ランキングは TOP 30 で AI 影響度・年収を併記。',
    genres: [
      { path: 'rankings', label: '39 ランキング', desc: 'AI 影響度・年収・需要・組み合わせ等の TOP 30 ランキング' },
    ],
    og_eyebrow: 'EXPLORE · ランキング',
  },
  {
    slug: 'find-your-fit',
    short_ja: '自分に合う仕事を見つける',
    title_ja: '自分に合う仕事を見つける',
    description_ja: '質問・キャリア段階・興味タイプ・価値観の 4 軸から自分に合う職業を探せる。',
    intro_ja: '49 のよくある質問に答える形、年代・キャリア段階別の persona、RIASEC 興味タイプ、IPD 価値観など、自己理解の 4 軸から自分に向く仕事を探せます。',
    genres: [
      { path: 'q', label: 'Q&A 49 個', desc: '具体的な質問への回答 (AI でなくならない仕事？等)' },
      { path: 'careers', label: 'キャリア段階 10', desc: '新卒・転職・シニア・主婦復職等の persona 別' },
      { path: 'interests', label: '興味タイプ 6 (RIASEC)', desc: 'Holland Code で見る職業適性' },
      { path: 'values', label: '価値観 8', desc: '達成感・自律性・関係性等を重視する人向け' },
    ],
    og_eyebrow: 'EXPLORE · 適職',
  },
  {
    slug: 'by-skill-and-license',
    short_ja: 'スキル・資格から探す',
    title_ja: 'スキル・資格から職業を探す',
    description_ja: 'スキル・資格・能力・知識・学歴の 5 軸で、自分の強みが活きる職業を探せる。',
    intro_ja: 'IPD のスキル・能力・知識軸 + 関連資格 + 学歴の組み合わせから、現在持っているスキルや今後身につけるべき能力で職業を絞り込めます。',
    genres: [
      { path: 'skills', label: 'スキル 10', desc: '批判的思考・問題解決・対人スキル・プログラミング等' },
      { path: 'licenses', label: '資格 15 カテゴリー', desc: '医療・福祉・法務・会計・建設・IT 等の資格別' },
      { path: 'abilities', label: '能力 10', desc: '持久力・筋力・空間認識・推論力等' },
      { path: 'knowledge', label: '知識 10 領域', desc: '生産・顧客サービス・機械・医学・数学等' },
      { path: 'education', label: '学歴 6 段階', desc: '高卒未満から大学院卒まで' },
    ],
    og_eyebrow: 'EXPLORE · スキル資格',
  },
  {
    slug: 'by-work-style',
    short_ja: '働き方から探す',
    title_ja: '働き方から職業を探す',
    description_ja: '業務形態・雇用形態・習熟期間・ライフバランス・入職経路の 5 軸で働き方から仕事を選べる。',
    intro_ja: '屋外/屋内・シフト勤務・正社員 vs フリーランス・育児両立・新卒 vs 中途等、働き方の特性で職業を分類。ライフスタイルとの相性を重視する人向け。',
    genres: [
      { path: 'work-styles', label: '業務形態 7', desc: '屋外・現場・移動・シフト・チーム・座り仕事等' },
      { path: 'employment-types', label: '雇用形態 4', desc: '正社員・フリーランス・パート・公務員' },
      { path: 'training', label: '習熟期間 5', desc: '即一人前・1-3年・3-5年・5-10年・生涯' },
      { path: 'life-balance', label: 'ライフバランス 6', desc: '育児・介護・健康・精神負担・趣味・シニア' },
      { path: 'entry-paths', label: '入職経路 5', desc: '新卒・中途・バイト出身・独立・徒弟制' },
    ],
    og_eyebrow: 'EXPLORE · 働き方',
  },
  {
    slug: 'compare',
    short_ja: '職業を比較する',
    title_ja: '職業を比較する',
    description_ja: '迷いやすい 20 の職業ペアを side-by-side で比較できる。',
    intro_ja: '看護師 vs 訪問介護員、SE vs プログラマー、医療事務 vs 一般事務など、迷いやすい職業ペアを並べて比較。AI 影響度・年収・労働条件・必要スキルを並べて意思決定の助けに。',
    genres: [
      { path: 'compare', label: '比較 20 ペア', desc: '迷いやすい職業ペアの side-by-side 比較' },
    ],
    og_eyebrow: 'EXPLORE · 比較',
  },
  {
    slug: 'methodology-trust',
    short_ja: '方法論・信頼性',
    title_ja: '方法論・信頼性を確認する',
    description_ja: '本サイトの AI 影響度評価方法、用語、データソース、年次レポートを確認できる。',
    intro_ja: '本サイトの独自分析がどう行われているか、用語の定義、データの出典、年次レポート (2026 年版・5 年変化・10 年予測) を公開しています。透明性を重視する独立サイトです。',
    genres: [
      { path: 'about/methodology', label: 'AI 影響度評価の方法論', desc: 'Claude Opus 4.7 によるタスクレベル評価ロジック' },
      { path: 'about/glossary', label: '用語集', desc: '本サイト独自用語の定義' },
      { path: 'about/data-sources', label: 'データソース一覧', desc: '厚労省・JILPT・統計調査の出典' },
      { path: 'yearly', label: '年次レポート', desc: '2026 年版・5 年変化・10 年予測' },
    ],
    og_eyebrow: 'EXPLORE · 信頼性',
  },
];
