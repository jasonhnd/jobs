/**
 * src/views/genre-configs.ts — 9 ジャンル × 計 60 個のデータ駆動 hub の設定。
 *
 * 内訳: abilities 10 + knowledge 10 + values 8 + education 6 + training 5
 *      + work-styles 7 + employment-types 4 + life-balance 6 + entry-paths 5
 *
 * 各 genre は genre-hub.ts の buildGenreResult() で TOP 30 を計算する。
 * Pure-data モジュール、fs imports なし — Astro frontmatter と Edge Function
 * 両方からインポート可能。
 *
 * Migrated from src/data/lib/genre-configs.ts 2026-05-14 (Phase B, file #18 of 18).
 * Per docs/architecture.md §6.2, the 60 hub-config objects feed view-layer
 * URL emission (sitemap), graph traversal (spoke-hub-graph / hub-hub-graph),
 * and 9 × (index + [slug]) page families = 21 Astro pages. Every consumer is
 * an HTML / sitemap surface, so the canonical home is src/views/. The type
 * import `GenreHubConfig` / `DetailFileMin` still points at
 * src/views/genre-hub.ts (cross-dir bridge); genre-hub itself stays in
 * data/lib for Phase B because it owns the buildGenreBundle compute and is
 * tested there. A future Phase C pass can colocate the type with the data
 * or split genre-hub into a graph-layer ranker + a views-layer renderer.
 */
import type { GenreHubConfig, DetailFileMin } from './genre-hub.js';

// ─── G. 能力 (abilities) — 10 hub ────────────────────────

export const ABILITIES_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'stamina',
    short_ja: '持久力',
    title_ja: '持久力・スタミナが核となる職業',
    description_ja: '長時間の身体活動を維持するスタミナが業務の核心となる職業群。建設・運輸・救急・スポーツ系で求められる中心的な能力。',
    og_eyebrow: 'ABILITY · スタミナ',
    dimension_field: 'abilities_top5',
    dimension_key: 'stamina',
    characteristics_ja: ['長時間の身体活動を維持できる', '体力的負荷の繰り返しに耐性がある', '不規則な勤務にも対応'],
    how_to_develop_ja: ['日常的な有酸素運動', '長時間作業に慣れるトレーニング', '休息と栄養の自己管理'],
  },
  {
    slug: 'physical-strength',
    short_ja: '筋力',
    title_ja: '筋力が必要な職業',
    description_ja: '重量物の運搬・身体を使った作業など、筋力が業務遂行に直結する職業群。建設・運輸・農林・救急系で重要な能力。',
    og_eyebrow: 'ABILITY · 筋力',
    dimension_field: 'abilities_top5',
    dimension_key: 'static_strength',
    characteristics_ja: ['重量物を持ち上げ・運搬できる', '長時間の身体労働に耐える', '瞬発的な力も発揮できる'],
    how_to_develop_ja: ['定期的な筋力トレーニング', '正しい持ち方・動き方の学習', '身体機能の維持習慣'],
  },
  {
    slug: 'manual-dexterity-fine',
    short_ja: '細かい手作業',
    title_ja: '細かい手作業の職業',
    description_ja: '指先の精密な動きや繊細な手技が求められる職業群。歯科衛生士・美容師・職人・組立工等。',
    og_eyebrow: 'ABILITY · 手先の器用さ',
    dimension_field: 'abilities_top5',
    dimension_key: 'manual_dexterity',
    characteristics_ja: ['指先の精密な動きが得意', '繊細な作業を集中して継続できる', '視覚と手の協調性が高い'],
    how_to_develop_ja: ['楽器・手芸など指先を使う趣味', '熟練者の手技を観察し模倣', '反復練習による筋肉記憶'],
  },
  {
    slug: 'visualization',
    short_ja: '空間認識',
    title_ja: '空間認識・モノの見え方が要る職業',
    description_ja: '物体の構造・配置・回転を頭の中で操作できる空間認識力が業務に直結する職業群。建築士・デザイナー・パイロット・外科医等。',
    og_eyebrow: 'ABILITY · 空間認識',
    dimension_field: 'abilities_top5',
    dimension_key: 'visualization',
    characteristics_ja: ['3D 空間を頭の中で操作できる', '図面と実物を相互変換できる', 'パターン認識が早い'],
    how_to_develop_ja: ['3D モデリング・CAD の練習', 'パズル・建築模型などの趣味', '空間認知トレーニングアプリ'],
  },
  {
    slug: 'selective-attention',
    short_ja: '選択的注意',
    title_ja: '集中力・選択的注意が要る職業',
    description_ja: '複数の情報の中から必要なものに注意を集中する力が業務の中心となる職業群。航空管制・トレーダー・救急現場・品質検査等。',
    og_eyebrow: 'ABILITY · 集中',
    dimension_field: 'abilities_top5',
    dimension_key: 'selective_attention',
    characteristics_ja: ['ノイズの中で重要情報に注目できる', '長時間の集中を維持できる', '複数タスクの優先順位を即決'],
    how_to_develop_ja: ['マインドフルネス', 'ノイズ環境での読書練習', '時間管理ツールの活用'],
  },
  {
    slug: 'problem-sensitivity',
    short_ja: '問題察知力',
    title_ja: '問題察知力が要る職業',
    description_ja: '不具合・予兆・違和感を早期に察知する力が業務の核心となる職業群。整備士・検査技師・看護師・治安維持等。',
    og_eyebrow: 'ABILITY · 察知',
    dimension_field: 'abilities_top5',
    dimension_key: 'problem_sensitivity',
    characteristics_ja: ['わずかな違和感を見逃さない', '予兆段階での介入判断', '経験パターンとの照合が速い'],
    how_to_develop_ja: ['熟練者の「気づき」を言語化', '点検チェックリストの習慣化', 'ケース蓄積による直感のブラッシュアップ'],
  },
  {
    slug: 'oral-comprehension',
    short_ja: '言語理解',
    title_ja: '言語理解力が要る職業',
    description_ja: '話される言葉の意味を正確に把握する力が業務に直結する職業群。通訳・カウンセラー・教師・営業等。',
    og_eyebrow: 'ABILITY · 言語理解',
    dimension_field: 'abilities_top5',
    dimension_key: 'oral_comprehension',
    characteristics_ja: ['複雑な説明を即座に理解', '言葉のニュアンスを読み取る', '専門用語と平易な表現の橋渡し'],
    how_to_develop_ja: ['多様な分野の本を読む', '発言を要約する練習', '異文化・異年代との会話機会'],
  },
  {
    slug: 'inductive-reasoning',
    short_ja: '帰納的推論',
    title_ja: '帰納的推論が要る職業',
    description_ja: '個別の事例から一般法則を導く帰納的思考が業務の中心となる職業群。研究者・データサイエンティスト・診断医・刑事等。',
    og_eyebrow: 'ABILITY · 推論',
    dimension_field: 'abilities_top5',
    dimension_key: 'inductive_reasoning',
    characteristics_ja: ['複数事例からパターンを発見', '仮説生成と検証のサイクル', '不完全情報から結論を導く'],
    how_to_develop_ja: ['ベイズ推論・統計学の基礎', '推理小説・科学誌の読書', 'データ分析の実践'],
  },
  {
    slug: 'deductive-reasoning',
    short_ja: '演繹的推論',
    title_ja: '演繹的推論が要る職業',
    description_ja: '一般原則やルールから個別事例の結論を導く演繹的思考が業務の核心となる職業群。弁護士・公認会計士・システムエンジニア・医師等。',
    og_eyebrow: 'ABILITY · 演繹',
    dimension_field: 'abilities_top5',
    dimension_key: 'deductive_reasoning',
    characteristics_ja: ['ルール体系から答えを導ける', '前提条件の妥当性を検証できる', '論理的な反証可能性を意識する'],
    how_to_develop_ja: ['形式論理学・数学の学習', '法律・契約書の読解', 'プログラミングによるロジック構築'],
  },
  {
    slug: 'oral-expression',
    short_ja: '発話表現',
    title_ja: '発話表現力が要る職業',
    description_ja: '考えを言葉で的確に伝える発話表現力が業務の中心となる職業群。営業・教師・カウンセラー・士業・接客サービス等。',
    og_eyebrow: 'ABILITY · 発話',
    dimension_field: 'abilities_top5',
    dimension_key: 'oral_expression',
    characteristics_ja: ['複雑な内容を平易に説明できる', '相手の理解度に応じて語り方を変えられる', '緊張下でも論理を保てる'],
    how_to_develop_ja: ['プレゼン・スピーチの練習', '相手別に説明シナリオを書く', 'その場の議論・ディベート参加'],
  },
];

// ─── H. 知識 (knowledge) — 10 hub ────────────────────────

export const KNOWLEDGE_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'production-processing',
    short_ja: '生産・加工',
    title_ja: '生産・加工の知識を活かす職業',
    description_ja: '原料・工程・品質管理など、モノづくりの一連知識が業務に直結する職業群。製造業全般、食品加工、化学プラント等。',
    og_eyebrow: 'KNOWLEDGE · 生産加工',
    dimension_field: 'knowledge_top5',
    dimension_key: 'production_processing',
    characteristics_ja: ['工程と品質の関係を把握', '原料特性と加工条件を理解', '安全と効率を両立できる'],
    how_to_develop_ja: ['現場での OJT', '製造業向け資格 (技能士等)', '工程改善 (カイゼン) の事例研究'],
  },
  {
    slug: 'customer-service',
    short_ja: '顧客サービス',
    title_ja: '顧客サービス知識を活かす職業',
    description_ja: '顧客のニーズ把握・問題解決・関係構築の知識が業務の核心となる職業群。販売・接客・営業・コールセンター等。',
    og_eyebrow: 'KNOWLEDGE · 顧客サービス',
    dimension_field: 'knowledge_top5',
    dimension_key: 'customer_personal_service',
    characteristics_ja: ['顧客の本音を引き出せる', 'クレーム対応の型を持つ', 'リピート関係を構築する'],
    how_to_develop_ja: ['CS 関連書籍の読書', 'ロールプレイ研修', '優れた接客の観察と分析'],
  },
  {
    slug: 'mechanical-knowledge',
    short_ja: '機械',
    title_ja: '機械知識を活かす職業',
    description_ja: '機械の設計・動作原理・故障パターンの知識が業務の中心となる職業群。整備士・技術者・製造現場・操縦系等。',
    og_eyebrow: 'KNOWLEDGE · 機械',
    dimension_field: 'knowledge_top5',
    dimension_key: 'mechanical',
    characteristics_ja: ['機械の構造を理解', '故障診断ができる', '工具と治具を使いこなす'],
    how_to_develop_ja: ['機械整備の資格取得', '実機を分解・組立する経験', '機械工学の基礎知識'],
  },
  {
    slug: 'medical-knowledge',
    short_ja: '医学・生物学',
    title_ja: '医学・生物学知識を活かす職業',
    description_ja: '人体・疾病・治療法の知識が業務に直結する職業群。医師・看護師・薬剤師・臨床検査技師等。',
    og_eyebrow: 'KNOWLEDGE · 医学',
    dimension_field: 'knowledge_top5',
    dimension_key: 'medicine_dentistry',
    characteristics_ja: ['人体構造と機能を理解', '症状から疾患を推論', '治療法の長短を比較'],
    how_to_develop_ja: ['医学部・看護学校・薬学部', '国家資格取得', '継続的な医学知識のアップデート'],
  },
  {
    slug: 'mathematics-knowledge',
    short_ja: '数学',
    title_ja: '数学知識を活かす職業',
    description_ja: '統計・微積分・線形代数など数学的知識が業務の中心となる職業群。研究者・エンジニア・金融・データサイエンティスト等。',
    og_eyebrow: 'KNOWLEDGE · 数学',
    dimension_field: 'knowledge_top5',
    dimension_key: 'mathematics_kn',
    characteristics_ja: ['数式と現象の関係を把握', 'データから法則を抽出', '不確実性を定量的に扱う'],
    how_to_develop_ja: ['大学レベルの数学を学習', '統計検定・データ分析関連資格', '実務でのデータ活用'],
  },
  {
    slug: 'psychology-knowledge',
    short_ja: '心理学',
    title_ja: '心理学知識を活かす職業',
    description_ja: '人間の認知・感情・行動に関する心理学的知識が業務の中心となる職業群。カウンセラー・教師・人事・営業・看護等。',
    og_eyebrow: 'KNOWLEDGE · 心理学',
    dimension_field: 'knowledge_top5',
    dimension_key: 'psychology',
    characteristics_ja: ['行動の背景にある動機を読み取る', '集団心理と個人心理の違いを意識', 'バイアスを認識して判断する'],
    how_to_develop_ja: ['心理学の基礎書籍', '臨床・産業心理学関連資格', '実務での観察・記録の蓄積'],
  },
  {
    slug: 'law-government-knowledge',
    short_ja: '法律・行政',
    title_ja: '法律・行政知識を活かす職業',
    description_ja: '法令・行政手続・規制の知識が業務の中心となる職業群。弁護士・司法書士・行政書士・公務員・コンプライアンス担当等。',
    og_eyebrow: 'KNOWLEDGE · 法律',
    dimension_field: 'knowledge_top5',
    dimension_key: 'law_government',
    characteristics_ja: ['法令の条文と判例を読解できる', '手続きの順序と期限を厳守', '規制と現実の乖離を埋める'],
    how_to_develop_ja: ['法学部・法科大学院での学習', '士業国家資格の取得', '判例研究・実務経験の蓄積'],
  },
  {
    slug: 'computers-electronics-knowledge',
    short_ja: 'IT・電子',
    title_ja: 'IT・電子工学知識を活かす職業',
    description_ja: 'コンピューター・ネットワーク・電子工学の知識が業務に直結する職業群。エンジニア・SE・データサイエンティスト・組込み技術者等。',
    og_eyebrow: 'KNOWLEDGE · IT',
    dimension_field: 'knowledge_top5',
    dimension_key: 'computers_electronics',
    characteristics_ja: ['ハード・ソフトの全体像を把握', '抽象化と具体実装を行き来', '新技術を継続的に習得'],
    how_to_develop_ja: ['情報系学部・専門学校', '資格 (情報処理・ベンダー系)', 'OSS / 個人プロジェクトでの実装経験'],
  },
  {
    slug: 'japanese-language-knowledge',
    short_ja: '国語・日本語',
    title_ja: '国語・日本語知識を活かす職業',
    description_ja: '日本語の文法・語彙・文章構成の知識が業務に直結する職業群。教師・編集者・ライター・通訳・士業の文書業務等。',
    og_eyebrow: 'KNOWLEDGE · 国語',
    dimension_field: 'knowledge_top5',
    dimension_key: 'japanese_language',
    characteristics_ja: ['正確な文章を書き分けられる', '相手と場面に応じた語彙選択', '推敲・校正の精度が高い'],
    how_to_develop_ja: ['古典・近代文学の読書', '校正・編集の実務訓練', '専門領域の文章スタイル習得'],
  },
  {
    slug: 'sales-marketing-knowledge',
    short_ja: '営業・販売',
    title_ja: '営業・販売の知識を活かす職業',
    description_ja: '商品・市場・顧客行動・販売手法の知識が業務に直結する職業群。営業職・マーケター・店長・販売員・ECディレクター等。',
    og_eyebrow: 'KNOWLEDGE · 営業',
    dimension_field: 'knowledge_top5',
    dimension_key: 'sales_marketing',
    characteristics_ja: ['顧客課題と商品価値を結びつける', '購買心理と市場動向を読む', '数字とストーリーを両立させる'],
    how_to_develop_ja: ['営業・マーケティング関連資格', '優れた営業の同行・観察', 'デジタルマーケティング実践'],
  },
];

// ─── J. 価値観 (work_values) — 8 hub ─────────────────────

export const VALUES_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'achievement',
    short_ja: '達成感',
    title_ja: '達成感を重視する人に向く職業',
    description_ja: '目標達成・成果実現に充実感を覚える人に適した職業群。営業・経営・士業・技能職等、自分の成果が見える分野。',
    og_eyebrow: 'VALUES · 達成感',
    dimension_field: 'work_values_top5',
    dimension_key: 'achievement',
  },
  {
    slug: 'independence',
    short_ja: '自律性',
    title_ja: '自律性を重視する人に向く職業',
    description_ja: '自分のペース・判断で進められる仕事を好む人に適した職業群。フリーランス系・職人・研究者・自営業等。',
    og_eyebrow: 'VALUES · 自律性',
    dimension_field: 'work_values_top5',
    dimension_key: 'autonomy',
  },
  {
    slug: 'recognition',
    short_ja: '認知・評価',
    title_ja: '評価・認知を重視する人に向く職業',
    description_ja: '社会的評価・名声・昇進に価値を感じる人に適した職業群。芸能・スポーツ・士業・経営層等。',
    og_eyebrow: 'VALUES · 認知',
    dimension_field: 'work_values_top5',
    dimension_key: 'social_recognition',
  },
  {
    slug: 'relationships',
    short_ja: '人間関係',
    title_ja: '職場の人間関係を重視する人に向く職業',
    description_ja: 'チーム内の人間関係・協働を大切にする人に適した職業群。看護・教育・プロジェクト系等。',
    og_eyebrow: 'VALUES · 関係性',
    dimension_field: 'work_values_top5',
    dimension_key: 'good_relationships',
  },
  {
    slug: 'support',
    short_ja: '支援',
    title_ja: '手厚いサポート体制を重視する人に向く職業',
    description_ja: '上司や組織からのサポートを重視する人に適した職業群。安定的な大企業・公務員・チーム型業務等。',
    og_eyebrow: 'VALUES · 支援',
    dimension_field: 'work_values_top5',
    dimension_key: 'workplace_safety',
  },
  {
    slug: 'working-conditions',
    short_ja: '労働条件',
    title_ja: '安定的な労働条件を重視する人に向く職業',
    description_ja: '勤務時間・福利厚生・雇用安定性など労働条件を最優先にする人に適した職業群。公務員・大企業・規制産業等。',
    og_eyebrow: 'VALUES · 労働条件',
    dimension_field: 'work_values_top5',
    dimension_key: 'work_life_balance',
  },
  {
    slug: 'expertise',
    short_ja: '専門性',
    title_ja: '専門性を重視する人に向く職業',
    description_ja: '深い専門知識・技術を磨き続けることに価値を感じる人に適した職業群。医療・士業・研究・職人・高度専門技術職等。',
    og_eyebrow: 'VALUES · 専門性',
    dimension_field: 'work_values_top5',
    dimension_key: 'expertise',
  },
  {
    slug: 'self-growth',
    short_ja: '自己成長',
    title_ja: '自己成長を重視する人に向く職業',
    description_ja: '挑戦や学習を通じて自分を伸ばし続けることに価値を感じる人に適した職業群。コンサル・スタートアップ・専門職・教育系等。',
    og_eyebrow: 'VALUES · 成長',
    dimension_field: 'work_values_top5',
    dimension_key: 'self_growth',
  },
];

// ─── K. 学歴 (education) — 6 hub ─────────────────────────

function makeEduConfig(
  slug: string,
  short: string,
  title: string,
  desc: string,
  predicate: (d: DetailFileMin) => number | null,
): GenreHubConfig {
  return {
    slug,
    short_ja: short,
    title_ja: title,
    description_ja: desc,
    og_eyebrow: `EDUCATION · ${short}`,
    custom_filter: predicate,
  };
}

export const EDUCATION_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  makeEduConfig(
    'no-school-required',
    '学歴不問',
    '学歴不問で就ける職業',
    '高卒未満からでも就ける、学歴ハードルが最も低い職業群。実務経験と適性が評価軸となる現場職。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = ed['below_high_school'] ?? 0;
      return v >= 0.05 ? v : null;
    },
  ),
  makeEduConfig(
    'high-school-careers',
    '高卒',
    '高卒で目指せる職業',
    '高卒比率が高い職業群。建設・製造・運輸・サービス・公安系の現場職が中心。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = ed['high_school'] ?? 0;
      return v >= 0.3 ? v : null;
    },
  ),
  makeEduConfig(
    'vocational-school-careers',
    '専門学校卒',
    '専門学校卒で目指せる職業',
    '専門学校での技能習得が前提となる職業群。美容・調理・医療技術・IT 等。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = ed['vocational_school'] ?? 0;
      return v >= 0.15 ? v : null;
    },
  ),
  makeEduConfig(
    'university-careers',
    '大卒',
    '大卒以上が中心の職業',
    '大卒比率が高い職業群。専門知識・抽象思考・複雑な意思決定を要する分野。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = ed['university'] ?? 0;
      return v >= 0.5 ? v : null;
    },
  ),
  makeEduConfig(
    'graduate-school-careers',
    '大学院卒',
    '大学院卒中心の職業',
    '修士・博士課程修了が前提の高度専門職。研究・大学教員・専門医等。',
    (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const v = (ed['masters'] ?? 0) + (ed['doctorate'] ?? 0);
      return v >= 0.2 ? v : null;
    },
  ),
  makeEduConfig(
    'lifetime-learning',
    '生涯学習',
    '学歴より生涯学習が重要な職業',
    '初期学歴より継続的な学習・資格更新が重視される職業群。技能職・士業・専門職等。',
    (d) => {
      const certs = (d.related_certs_ja ?? []).length;
      const ai = d.ai_risk?.score;
      if (certs < 1) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 6) return null;
      return certs;
    },
  ),
];

// ─── L. 習熟期間 (training) — 5 hub ─────────────────────

/**
 * Helper for training-period genres.
 *
 * The data uses snake_case English keys (e.g. `1_to_2_years`) and groups
 * are sometimes split across multiple keys (1-3 years = 1_to_2_years +
 * 2_to_3_years). We use a custom_filter that selects items whose
 * `training_post_top5` contains ANY of the matching keys, ranked by score.
 */
function makeTrainingFilter(matchKeys: ReadonlyArray<string>): GenreHubConfig['custom_filter'] {
  return (d: DetailFileMin) => {
    const arr = d.training_post_top5;
    if (!arr) return null;
    let bestScore = -Infinity;
    for (const e of arr) {
      if (matchKeys.includes(e.key)) {
        if (e.score > bestScore) bestScore = e.score;
      }
    }
    return bestScore === -Infinity ? null : bestScore;
  };
}

export const TRAINING_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'quick-start',
    short_ja: '即一人前',
    title_ja: '入職後すぐ一人前になれる職業',
    description_ja: '入職後 1 年以内に一人前の業務遂行が可能な職業群。サービス・販売・軽作業・運輸の一部等。',
    og_eyebrow: 'TRAINING · 即一人前',
    custom_filter: makeTrainingFilter(['up_to_1_month', '1_to_6_months', '6_months_to_1_year', 'not_required']),
  },
  {
    slug: '1-3-years',
    short_ja: '1-3年',
    title_ja: '1-3 年で一人前になる職業',
    description_ja: '1-3 年の入職後訓練で独立業務が可能になる職業群。事務・営業・技術系の中堅水準。',
    og_eyebrow: 'TRAINING · 1-3年',
    custom_filter: makeTrainingFilter(['1_to_2_years', '2_to_3_years']),
  },
  {
    slug: '3-5-years',
    short_ja: '3-5年',
    title_ja: '3-5 年で熟達する職業',
    description_ja: '3-5 年の修行・経験で熟練レベルに到達する職業群。中堅職人・技術職・専門事務・営業の上位等。',
    og_eyebrow: 'TRAINING · 3-5年',
    custom_filter: makeTrainingFilter(['3_to_5_years']),
  },
  {
    slug: '5-10-years',
    short_ja: '5-10年',
    title_ja: '5-10 年の修行が必要な職業',
    description_ja: '5 年以上の長い修行を経て一人前となる職業群。職人・専門医・士業・職長等。',
    og_eyebrow: 'TRAINING · 5-10年',
    custom_filter: makeTrainingFilter(['5_to_10_years']),
  },
  {
    slug: 'lifelong-craft',
    short_ja: '生涯修行',
    title_ja: '生涯修行型の職業',
    description_ja: '10 年超または生涯にわたる継続学習が前提となる職業群。伝統工芸・最先端医療・士業の上位等。',
    og_eyebrow: 'TRAINING · 生涯',
    custom_filter: makeTrainingFilter(['over_10_years']),
  },
];

// ─── M. 業務形態 (work_characteristics) — 7 hub ─────────

export const WORK_STYLES_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'indoor-vs-outdoor',
    short_ja: '屋外作業',
    title_ja: '屋外作業中心の職業',
    description_ja: '主たる業務が屋外で行われる職業群。建設・農林・運輸・現場系等。天候や環境への対応が必要。',
    og_eyebrow: 'WORK · 屋外',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'outdoor_work',
  },
  {
    slug: 'desk-vs-genba',
    short_ja: '現場中心',
    title_ja: '現場中心の職業',
    description_ja: 'デスクワークではなく現場での身体作業が中心の職業群。製造・建設・サービス系等。',
    og_eyebrow: 'WORK · 現場',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'standing',
  },
  {
    slug: 'move-required',
    short_ja: '外回り型',
    title_ja: '移動が多い職業',
    description_ja: '営業・配達・訪問等で移動が業務の中心となる職業群。',
    og_eyebrow: 'WORK · 移動',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'walking_running',
  },
  {
    slug: 'shift-work',
    short_ja: 'シフト勤務',
    title_ja: 'シフト勤務 (24h・夜勤・早朝) の職業',
    description_ja: '24 時間体制・夜勤・早朝シフトが業務に組み込まれている職業群。医療・運輸・警備・ホテル・コンビニ等。',
    og_eyebrow: 'WORK · シフト',
    custom_filter: (d) => {
      // Shift-work isn't a single IPD key — approximate via sectors that
      // traditionally operate 24h or in shifts (medical, public safety,
      // service, transportation/maint).
      const sid = d.sector?.id ?? '';
      if (!['iryo', 'hoan', 'service', 'maint'].includes(sid)) return null;
      // Rank by workforce size as a rough proxy for "how many people in
      // shift-work jobs in this sector".
      return d.stats?.workers ?? 0;
    },
  },
  {
    slug: 'solo-vs-team',
    short_ja: 'チーム作業',
    title_ja: 'チーム作業中心の職業',
    description_ja: '複数人での協働が業務の中心となる職業群。建設現場・医療・プロジェクト系等。',
    og_eyebrow: 'WORK · チーム',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'teamwork',
  },
  {
    slug: 'high-physical-load',
    short_ja: '重労働型',
    title_ja: '体力負荷が高い職業',
    description_ja: '長時間の身体負荷が業務に伴う職業群。運輸・建設・介護・警備・製造等。',
    og_eyebrow: 'WORK · 体力',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'physical_proximity',
  },
  {
    slug: 'desk-sitting-work',
    short_ja: '座り仕事',
    title_ja: '座って行う仕事中心の職業',
    description_ja: 'デスクワーク・座位での業務が中心となる職業群。事務・IT・士業・コールセンター等。長時間着座への耐性が必要。',
    og_eyebrow: 'WORK · 座位',
    dimension_field: 'work_characteristics_top5',
    dimension_key: 'sitting',
  },
];

// ─── N. 雇用形態 (employment_type) — 4 hub ─────────────

export const EMPLOYMENT_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'full-time-mainstream',
    short_ja: '正社員',
    title_ja: '正社員が多い職業',
    description_ja: '正規雇用比率が高い職業群。安定的な雇用と福利厚生を求める人向け。',
    og_eyebrow: 'EMPLOY · 正社員',
    custom_filter: (d) => {
      const et = d.employment_type;
      if (!et) return null;
      const v = et['regular_employee'] ?? 0;
      return v >= 0.6 ? v : null;
    },
  },
  {
    slug: 'freelance-friendly',
    short_ja: 'フリーランス',
    title_ja: 'フリーランス・個人事業向きの職業',
    description_ja: '自営・フリーランス比率が高く、独立しやすい職業群。',
    og_eyebrow: 'EMPLOY · フリーランス',
    custom_filter: (d) => {
      const et = d.employment_type;
      if (!et) return null;
      const v = et['self_employed_freelance'] ?? 0;
      return v >= 0.15 ? v : null;
    },
  },
  {
    slug: 'part-time-mainstream',
    short_ja: 'パート・派遣',
    title_ja: 'パート・派遣が多い職業',
    description_ja: 'パートタイム・派遣の比率が高い職業群。短時間・柔軟な働き方の選択肢。',
    og_eyebrow: 'EMPLOY · パート',
    custom_filter: (d) => {
      const et = d.employment_type;
      if (!et) return null;
      const v = (et['part_time'] ?? 0) + (et['dispatched'] ?? 0);
      return v >= 0.2 ? v : null;
    },
  },
  {
    slug: 'public-employee',
    short_ja: '公務員',
    title_ja: '公務員系の職業',
    description_ja: '公的機関で働く職業群。保安・公安系を中心に、地方公務員・国家公務員職。',
    og_eyebrow: 'EMPLOY · 公務員',
    custom_filter: (d) => {
      // Approximate via sector_id == 'hoan' or large workforce + low ai
      const sid = d.sector?.id;
      if (sid === 'hoan') return 1;
      return null;
    },
  },
];

// ─── P. ライフバランス (life-balance) — 6 hub ────────────────

export const LIFE_BALANCE_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'child-care-balance',
    short_ja: '育児両立',
    title_ja: '育児と両立しやすい職業',
    description_ja: '労働時間が短く、シフト柔軟性のある、育児中の親が続けやすい職業群。',
    og_eyebrow: 'LIFE · 育児',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      const ai = d.ai_risk?.score;
      if (!hours || hours > 165) return null;
      if (ai !== null && ai !== undefined && ai > 6) return null;
      return -hours; // lower hours rank higher
    },
  },
  {
    slug: 'elderly-care-balance',
    short_ja: '介護両立',
    title_ja: '介護と両立しやすい職業',
    description_ja: '勤務時間の柔軟性・有給取得・リモート可能性で介護と両立しやすい職業群。',
    og_eyebrow: 'LIFE · 介護',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 170) return null;
      return -hours;
    },
  },
  {
    slug: 'health-friendly',
    short_ja: '体に優しい',
    title_ja: '体力に自信がない人にも続けられる職業',
    description_ja: '体力負荷が低く、長く続けられる職業群。事務系・専門職・知的労働中心。',
    og_eyebrow: 'LIFE · 健康',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 175) return null;
      return -hours;
    },
  },
  {
    slug: 'mental-health-friendly',
    short_ja: '精神負担小',
    title_ja: '精神的負担が軽い職業',
    description_ja: '対人ストレスや即断のプレッシャーが比較的少ない職業群。研究・技能・データ系等。',
    og_eyebrow: 'LIFE · 精神',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      const ai = d.ai_risk?.score;
      if (!hours || hours > 170) return null;
      if (ai === null || ai === undefined) return null;
      return -hours;
    },
  },
  {
    slug: 'hobby-balance',
    short_ja: '趣味両立',
    title_ja: '趣味・私生活と両立しやすい職業',
    description_ja: '労働時間が比較的短く、平日の余暇や週末の活動が確保しやすい職業群。',
    og_eyebrow: 'LIFE · 趣味',
    custom_filter: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 160) return null;
      return -hours;
    },
  },
  {
    slug: 'senior-friendly',
    short_ja: 'シニア活躍',
    title_ja: '60 代以降も続けやすい職業',
    description_ja: '平均年齢が高めで体力負荷が控えめ、AI 影響度も低く、定年後も継続しやすい職業群。経験・人脈が活きる分野。',
    og_eyebrow: 'LIFE · シニア',
    custom_filter: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score;
      if (!age || age < 45) return null;
      if (ai !== null && ai !== undefined && ai > 5) return null;
      return age;
    },
  },
];

// ─── Q. 入職経路 (entry-paths) — 5 hub ───────────────────

export const ENTRY_PATHS_CONFIGS: ReadonlyArray<GenreHubConfig> = [
  {
    slug: 'new-grad-mainstream',
    short_ja: '新卒採用',
    title_ja: '新卒採用が中心の職業',
    description_ja: '新卒一括採用が主流で、若年層からのキャリア形成が前提となる職業群。',
    og_eyebrow: 'ENTRY · 新卒',
    custom_filter: (d) => {
      const age = d.stats?.average_age;
      if (!age || age > 38) return null;
      return -age; // younger ranks higher
    },
  },
  {
    slug: 'mid-career-mainstream',
    short_ja: '転職組',
    title_ja: '転職組が多い職業',
    description_ja: '中途採用・転職での入職が主流の職業群。実務経験を活かした参入が一般的。',
    og_eyebrow: 'ENTRY · 中途',
    custom_filter: (d) => {
      const age = d.stats?.average_age;
      if (!age || age < 35) return null;
      return age; // older ranks higher (mature workforce)
    },
  },
  {
    slug: 'from-arbeit',
    short_ja: 'バイト出身',
    title_ja: 'バイト・派遣から正社員化が多い職業',
    description_ja: 'アルバイト・派遣からの正社員登用ルートが整備されている職業群。サービス・販売・製造等。',
    og_eyebrow: 'ENTRY · バイト',
    custom_filter: (d) => {
      // Approximation: large workforce + medium age + low cert
      const workers = d.stats?.workers ?? 0;
      const age = d.stats?.average_age ?? 99;
      const certs = (d.related_certs_ja ?? []).length;
      if (workers < 30000) return null;
      if (certs >= 2) return null;
      if (age > 50) return null;
      return workers;
    },
  },
  {
    slug: 'independent-typical',
    short_ja: '独立典型',
    title_ja: '独立・開業が典型の職業',
    description_ja: '独立・開業がキャリアの自然な到達点となる職業群。美容・調理・建設職人・士業等。',
    og_eyebrow: 'ENTRY · 独立',
    custom_filter: (d) => {
      const certs = (d.related_certs_ja ?? []).length;
      const ai = d.ai_risk?.score;
      if (certs === 0) return null;
      if (ai === null || ai === undefined) return null;
      if (ai > 6) return null;
      return certs;
    },
  },
  {
    slug: 'apprenticeship',
    short_ja: '徒弟制',
    title_ja: '徒弟制・OJT が中心の職業',
    description_ja: '師匠について長期的に技を継承する徒弟型キャリアが残る職業群。伝統工芸・建設職人・調理・美容等。形式教育より OJT が中心。',
    og_eyebrow: 'ENTRY · 徒弟',
    custom_filter: (d) => {
      const ed = d.education_distribution;
      const ai = d.ai_risk?.score;
      if (!ed) return null;
      const lowEdu = (ed['below_high_school'] ?? 0) + (ed['high_school'] ?? 0);
      if (lowEdu < 0.4) return null;
      if (ai !== null && ai !== undefined && ai > 5) return null;
      return lowEdu;
    },
  },
];

// ─── Genre catalogues (for index pages + cross-genre navigation) ──

export interface GenreCatalogue {
  path: string;
  label_ja: string;
  description_ja: string;
  configs: ReadonlyArray<GenreHubConfig>;
}

export const GENRE_CATALOGUES: ReadonlyArray<GenreCatalogue> = [
  { path: 'abilities', label_ja: '能力から探す', description_ja: 'IPD 52 能力軸から、各能力が核となる職業 TOP 30 を一覧。', configs: ABILITIES_CONFIGS },
  { path: 'knowledge', label_ja: '知識から探す', description_ja: 'IPD 33 知識領域から、各知識を活かす職業 TOP 30 を一覧。', configs: KNOWLEDGE_CONFIGS },
  { path: 'values', label_ja: '価値観から探す', description_ja: 'IPD 12 価値観軸から、各価値観に合う職業 TOP 30 を一覧。', configs: VALUES_CONFIGS },
  { path: 'education', label_ja: '学歴から探す', description_ja: '学歴別の職業群を 6 段階に分類して一覧。', configs: EDUCATION_CONFIGS },
  { path: 'training', label_ja: '習熟期間から探す', description_ja: '入職後の習熟期間別に職業を 5 段階で分類。', configs: TRAINING_CONFIGS },
  { path: 'work-styles', label_ja: '働き方から探す', description_ja: '屋内/屋外・移動・シフト等の働き方別に職業を分類。', configs: WORK_STYLES_CONFIGS },
  { path: 'employment-types', label_ja: '雇用形態から探す', description_ja: '正社員・フリーランス・パート・公務員の雇用形態別。', configs: EMPLOYMENT_CONFIGS },
  { path: 'life-balance', label_ja: 'ライフバランスから探す', description_ja: '育児・介護・健康・趣味との両立に向く職業群。', configs: LIFE_BALANCE_CONFIGS },
  { path: 'entry-paths', label_ja: '入職経路から探す', description_ja: '新卒・中途・バイト出身・独立型の入職経路別に分類。', configs: ENTRY_PATHS_CONFIGS },
];

export function getGenreByPath(path: string): GenreCatalogue | null {
  return GENRE_CATALOGUES.find((g) => g.path === path) ?? null;
}
