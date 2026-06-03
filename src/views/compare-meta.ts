/**
 * src/views/compare-meta.ts — 20 個の職業比較ペアの slug + occupation IDs + 表示メタ。
 *
 * Migrated from src/data/lib/compare-meta.ts 2026-05-14 (Phase B).
 * Lives under src/views/ per §6.2.
 *
 *
 * 各 hub は 2 職業を side-by-side で比較する。
 * data/occupations の id は実装時に lookup して固定 (build:data 時 schema 検証で
 * 存在性が保証されている)。
 *
 * Pure-data モジュール (fs / Node-runtime imports なし)。
 */

export type CompareSlug =
  | 'kango-vs-helper'
  | 'se-vs-programmer'
  | 'iryo-jimu-vs-ippan-jimu'
  | 'biyo-vs-riyo'
  | 'truck-vs-taxi'
  | 'denki-vs-haikan'
  | 'kango-vs-yakuzaishi'
  | 'shoubou-vs-keisatsu'
  | 'pt-vs-shika-eisei'
  | 'bengoshi-vs-kaikeishi'
  | 'tofu-vs-pan'
  | 'kyoshi-vs-hoikushi'
  | 'kaigo-vs-kea-mane'
  | 'kaikeishi-vs-zeirishi'
  | 'shihou-vs-gyousei'
  | 'web-marketer-vs-research'
  | 'data-scientist-vs-ai-engineer'
  | 'shika-vs-juui'
  | 'yochien-vs-hoikushi'
  | 'webdesigner-vs-illustrator';

export interface CompareMeta {
  slug: CompareSlug;
  /** 職業 A の data/occupations の id */
  occ_a_id: number;
  /** 職業 B の data/occupations の id */
  occ_b_id: number;
  /** Hub タイトル (例: "看護師 vs 訪問介護員") */
  title_ja: string;
  /** SEO description (200 字程度、両職業の比較観点 1 文) */
  description_ja: string;
  /** 比較の核心観点 (3-5 項目) */
  comparison_points_ja: ReadonlyArray<string>;
  /** どっちを選ぶべきかの判断ヒント (3 項目) */
  decision_hints_ja: ReadonlyArray<string>;
  og_eyebrow: string;
  /**
   * /compare hub での扱い。true の比較は冒頭の大カード枠で説明付きで表示し、
   * false / 未指定はその下の compact chip 一覧に入る (2026-06-04 双層改造)。
   */
  featured?: boolean;
}

export const COMPARE_META: ReadonlyArray<CompareMeta> = [
  {
    slug: 'kango-vs-helper',
    occ_a_id: 156, // 看護師
    occ_b_id: 133, // 訪問介護員
    title_ja: '看護師 vs 訪問介護員',
    description_ja:
      '医療現場の看護師と在宅・施設で支援を行う訪問介護員 (旧称ホームヘルパー) は、いずれも「人を支える」現場職だが、医療行為の範囲・必要な国家資格・年収・需要構造が大きく異なる。' +
      '両者の AI 影響度・年収・労働条件・必要スキルを比較し、自分に合うキャリア選択を考える。',
    comparison_points_ja: [
      '医療行為が行えるか (看護師は可、訪問介護員は不可)',
      '必須資格 (看護師は国家資格、訪問介護員は介護職員初任者研修)',
      '勤務形態 (病院シフト vs 訪問・施設)',
      '年収レンジと昇給ルート',
      '身体的・精神的負荷の違い',
    ],
    decision_hints_ja: [
      '医療判断に関わりたいかどうか',
      '長い学歴投資 (看護学校 3-4 年) を許容できるか',
      '訪問形態の自由度を重視するか',
    ],
    og_eyebrow: 'COMPARE · 医療職',
    featured: true,
  },
  {
    slug: 'se-vs-programmer',
    occ_a_id: 312, // システムエンジニア (情報システム開発)
    occ_b_id: 313, // プログラマー
    title_ja: 'システムエンジニア vs プログラマー',
    description_ja:
      'よく混同される SE とプログラマーの違いを、業務範囲・必要スキル・年収・AI 影響度の観点から整理。' +
      '上流設計と下流実装の役割分担、キャリアパスの違い、AI コーディング時代における立ち位置の変化を比較。',
    comparison_points_ja: [
      '業務範囲 (要件定義・設計 vs 実装中心)',
      '顧客折衝の頻度',
      '使うスキルの種類 (ドキュメント vs コード)',
      'AI コーディング時代の影響の受け方',
      'キャリアの上方向 (PM/アーキテクト vs テックリード)',
    ],
    decision_hints_ja: [
      '人と話す方が好きか、コードに集中したいか',
      '抽象設計と具体実装、どちらが性に合うか',
      'AI に任せられない部分をどう作るか',
    ],
    og_eyebrow: 'COMPARE · IT 職',
    featured: true,
  },
  {
    slug: 'iryo-jimu-vs-ippan-jimu',
    occ_a_id: 443, // 医療事務
    occ_b_id: 428, // 一般事務
    title_ja: '医療事務 vs 一般事務',
    description_ja:
      '事務職の中でも、医療現場特有の知識・レセプト業務を要する医療事務と、業界横断で潰しが効く一般事務を比較。' +
      'AI 影響度・年収・需給バランス・専門性の蓄積方法の違いを整理する。',
    comparison_points_ja: [
      '専門性 (医療レセプト知識 vs 業界横断スキル)',
      '転職時の汎用性',
      'AI 影響度の違い',
      '年収レンジ',
      '需給 (医療事務は人手不足傾向、一般事務は応募者過多)',
    ],
    decision_hints_ja: [
      '専門性の壁 vs 汎用性、どちらを取るか',
      'AI 化のスピードに対するヘッジ',
      '医療業界に長く居たいかどうか',
    ],
    og_eyebrow: 'COMPARE · 事務職',
    featured: true,
  },
  {
    slug: 'biyo-vs-riyo',
    occ_a_id: 116, // 美容師
    occ_b_id: 115, // 理容師
    title_ja: '美容師 vs 理容師',
    description_ja:
      'ともに国家資格を要する髪・身だしなみのプロ職。違いは法律上の業務範囲 (シェービングの可否)、客層、店舗形態、独立タイミングなど。' +
      '養成課程はほぼ同期間だが、その後のキャリアと AI 影響度の傾向を比較。',
    comparison_points_ja: [
      'シェービング (理容師のみ可)',
      '主たる客層 (美容師: 女性中心 / 理容師: 男性中心)',
      '店舗形態 (サロン vs 床屋)',
      '独立・開業のしやすさ',
      'AI 影響度 (両者とも低、身体技能職)',
    ],
    decision_hints_ja: [
      'シェービングを業務に含めたいか',
      'デザイン性 vs 速さ・回転率の重視度',
      '長期的な店舗ブランド戦略',
    ],
    og_eyebrow: 'COMPARE · 美容・理容',
  },
  {
    slug: 'truck-vs-taxi',
    occ_a_id: 477, // トラックドライバー
    occ_b_id: 188, // タクシー運転手
    title_ja: 'トラック運転手 vs タクシー運転手',
    description_ja:
      'プロドライバーの代表格 2 職業を、運ぶ対象 (荷物 vs 人)、勤務形態、年収体系、需要構造、自動運転による AI 影響度の観点で比較。' +
      '長距離走行と都市内走行のライフスタイル差も含めて整理。',
    comparison_points_ja: [
      '運ぶ対象 (荷物 vs 人)',
      '勤務形態 (長距離・夜間 vs 流し・配車)',
      '報酬体系 (歩合 vs 固定+歩合)',
      '自動運転による影響範囲',
      '対人スキル (タクシーは接客必須)',
    ],
    decision_hints_ja: [
      '人と話したい / 一人で集中したい',
      '長距離 OK / 都市内のみ希望',
      '自動運転リスクをどう見るか',
    ],
    og_eyebrow: 'COMPARE · ドライバー',
  },
  {
    slug: 'denki-vs-haikan',
    occ_a_id: 46, // 電気工事士
    occ_b_id: 47, // 配管工
    title_ja: '電気工事士 vs 配管工',
    description_ja:
      '建設・住宅メンテナンスの 2 大インフラ職。電気と水・ガス、それぞれの資格・現場・需要・年収を比較。' +
      'AI 影響度はともに低いが、必要な専門知識と独立しやすさには差がある。',
    comparison_points_ja: [
      '扱う対象 (電気 vs 水・ガス)',
      '資格 (電気工事士 第一種・第二種 vs 配管技能士)',
      '事故時の責任範囲',
      '住宅 vs 商業建築の現場',
      '独立・開業の典型ルート',
    ],
    decision_hints_ja: [
      '感電と水漏れ、リスクの性質が違う',
      'マンション・戸建て中心か、大規模建築か',
      '長期的に師匠を持って独立を目指すか',
    ],
    og_eyebrow: 'COMPARE · 建設職人',
  },
  {
    slug: 'kango-vs-yakuzaishi',
    occ_a_id: 156, // 看護師
    occ_b_id: 158, // 薬剤師
    title_ja: '看護師 vs 薬剤師',
    description_ja:
      'ともに医療系国家資格職だが、業務の中心 (患者ケア vs 調剤・服薬指導)、養成期間、年収、AI 影響度に差がある。' +
      '6 年制薬学部を経る薬剤師と 3-4 年看護課程の看護師、初期投資から将来性まで比較。',
    comparison_points_ja: [
      '養成期間 (3-4 年 vs 6 年)',
      '業務の中心 (ケア vs 薬学知識)',
      '勤務形態 (シフト vs 日勤中心が選べる)',
      '年収レンジ',
      'AI 影響度 (調剤の自動化 vs ケアの非代替性)',
    ],
    decision_hints_ja: [
      '直接の患者ケアに価値を感じるか',
      '6 年間の学費・時間投資が可能か',
      'シフト勤務をどう捉えるか',
    ],
    og_eyebrow: 'COMPARE · 医療職',
  },
  {
    slug: 'shoubou-vs-keisatsu',
    occ_a_id: 155, // 消防員
    occ_b_id: 140, // 警察官
    title_ja: '消防士 vs 警察官',
    description_ja:
      '日本の代表的な公安職 2 つを、ミッション (火災・救急 vs 治安・捜査)、採用ルート、勤務形態、生涯設計の観点で比較。' +
      'AI 影響度はともに低い対人・現場職である一方、訓練内容と昇進ルートには明確な差がある。',
    comparison_points_ja: [
      'ミッション (救う vs 守る・捜査)',
      '採用区分 (地方公務員)',
      '勤務形態 (24h 交代 vs 三交代)',
      '昇進ルート (階級制度)',
      '退職後のセカンドキャリア',
    ],
    decision_hints_ja: [
      '人を救うか守るか、ミッションの志向',
      '体力的な持続可能性',
      '危険業務手当・福利厚生の魅力度',
    ],
    og_eyebrow: 'COMPARE · 公安職',
  },
  {
    slug: 'pt-vs-shika-eisei',
    occ_a_id: 167, // 理学療法士 (PT)
    occ_b_id: 166, // 歯科衛生士
    title_ja: '理学療法士 vs 歯科衛生士',
    description_ja:
      'ともに医師・歯科医師の指示下で行う身体技能を伴う医療職。リハビリの理学療法士と口腔衛生の歯科衛生士、業務範囲・養成期間・年収・需要を比較。' +
      'いずれも AI 影響度は低い対人・身体技能職。',
    comparison_points_ja: [
      '対象 (運動機能 vs 口腔)',
      '養成期間 (PT 4 年 vs 衛生士 3 年)',
      '勤務先 (病院・施設 vs 歯科医院)',
      '年収レンジ',
      '高齢化に伴う需要増の方向性',
    ],
    decision_hints_ja: [
      '4 年大学 vs 3 年専門学校の選択',
      '長期リハビリ vs 短時間処置の業務スタイル',
      '独立開業を視野に入れるか',
    ],
    og_eyebrow: 'COMPARE · 医療技能',
  },
  {
    slug: 'bengoshi-vs-kaikeishi',
    occ_a_id: 89, // 弁護士
    occ_b_id: 90, // 公認会計士
    title_ja: '弁護士 vs 公認会計士',
    description_ja:
      '日本三大難関国家資格の 2 つを、試験合格後のキャリア・年収・AI 影響度・専門の深さで比較。' +
      '法と数値、扱う対象は異なるが、いずれも論理的思考と精緻さが求められる。',
    comparison_points_ja: [
      '試験合格率と勉強期間',
      '初任年収と中堅・パートナー段階',
      'クライアント (個人 vs 企業)',
      'AI 影響度 (リサーチ・監査の自動化進行)',
      '独立・開業の典型ルート',
    ],
    decision_hints_ja: [
      '法律の文言と判例 vs 数字と財務諸表',
      '訴訟・交渉の対人緊張感を許容できるか',
      'AI で代替されにくい付加価値の出し方',
    ],
    og_eyebrow: 'COMPARE · 士業',
  },
  {
    slug: 'tofu-vs-pan',
    occ_a_id: 1, // 豆腐職人
    occ_b_id: 2, // パン職人
    title_ja: '豆腐職人 vs パン職人',
    description_ja:
      '伝統的な日本食と西洋食の 2 大食品製造職人。原料・工程・店舗形態・独立タイミングが異なる。' +
      '両者とも AI 影響度は低いが、需要構造と継承課題には大きな差がある。',
    comparison_points_ja: [
      '原料 (大豆 vs 小麦・酵母)',
      '工程 (浸漬→凝固 vs 発酵→焼成)',
      '店舗形態 (小規模専門店 vs ベーカリー・カフェ併設)',
      '需要トレンド (健康・伝統 vs 多様化・嗜好品化)',
      '後継者問題と独立難度',
    ],
    decision_hints_ja: [
      '日本食文化への愛着度',
      '深夜・早朝勤務 (パン) を許容できるか',
      'ニッチ専門店 vs ベーカリー、ビジネスモデル選択',
    ],
    og_eyebrow: 'COMPARE · 食品職人',
  },
  {
    slug: 'kyoshi-vs-hoikushi',
    occ_a_id: 179, // 小学校教諭
    occ_b_id: 131, // 保育士
    title_ja: '小学校教諭 vs 保育士',
    description_ja:
      '子供と関わるプロフェッショナル 2 職業を、対象年齢・カリキュラム・必要資格・年収・AI 影響度の観点で比較。' +
      '教科指導の小学校教諭と全人発達支援の保育士、それぞれの専門性とキャリア設計の違いを整理。',
    comparison_points_ja: [
      '対象年齢 (6-12 歳 vs 0-6 歳)',
      '主目的 (教科指導 vs 生活・遊び・発達支援)',
      '必須資格 (教員免許 vs 保育士資格)',
      '勤務形態と長期休暇',
      '保護者対応の質的違い',
    ],
    decision_hints_ja: [
      '勉強を教えるか、生活を共に過ごすか',
      '長期休暇の有無への価値づけ',
      '対象年齢の好み・適性',
    ],
    og_eyebrow: 'COMPARE · 教育・保育',
    featured: true,
  },
  {
    slug: 'kaigo-vs-kea-mane',
    occ_a_id: 134, // 施設介護員
    occ_b_id: 132, // 介護支援専門員/ケアマネジャー
    title_ja: '施設介護員 vs ケアマネジャー',
    description_ja:
      '介護現場の最前線を担う施設介護員と、ケアプラン作成と多職種連携を担うケアマネジャー。同じ介護分野でも業務の中心・必要資格・年収・キャリアパスが大きく異なる。' +
      '現場志向と調整役志向、どちらが自分に合うかを比較。',
    comparison_points_ja: [
      '業務の中心 (直接介護 vs ケアプラン・調整)',
      '必須資格 (介護職員初任者研修 vs 介護支援専門員)',
      '年収レンジとキャリアの伸び方',
      '体力的負荷の違い',
      '事業所内での立ち位置',
    ],
    decision_hints_ja: [
      '直接的な身体介護を続けたいか、調整役に移りたいか',
      '介護経験 5 年でケアマネ資格に挑戦するか',
      'デスクワーク比率の許容度',
    ],
    og_eyebrow: 'COMPARE · 介護',
  },
  {
    slug: 'kaikeishi-vs-zeirishi',
    occ_a_id: 90, // 公認会計士
    occ_b_id: 92, // 税理士
    title_ja: '公認会計士 vs 税理士',
    description_ja:
      'ともに会計分野の国家資格職だが、業務の中心 (監査 vs 税務)・主クライアント (大企業 vs 中小・個人)・年収レンジ・AI 影響度に明確な差がある。' +
      '試験合格までの道のりと、資格取得後のキャリアパスを比較。',
    comparison_points_ja: [
      '業務の中心 (会計監査 vs 税務申告・税務相談)',
      '主クライアント (上場・大企業 vs 中小・個人)',
      '試験ルートと合格までの平均年数',
      '独立しやすさと事務所規模',
      'AI 影響度 (定型監査・申告書作成の自動化進行)',
    ],
    decision_hints_ja: [
      '法人 vs 個人、どちらの相手に向き合いたいか',
      '監査法人での組織キャリア vs 独立志向',
      '試験ルートの違い (一発合格 vs 科目合格制)',
    ],
    og_eyebrow: 'COMPARE · 士業',
    featured: true,
  },
  {
    slug: 'shihou-vs-gyousei',
    occ_a_id: 84, // 司法書士
    occ_b_id: 85, // 行政書士
    title_ja: '司法書士 vs 行政書士',
    description_ja:
      '名前が似ているが業務領域が大きく異なる 2 つの士業。司法書士は不動産登記・商業登記・裁判書類が中心、行政書士は許認可・契約書・遺言書が中心。' +
      '試験難度・年収・独立難度・AI 影響度を比較。',
    comparison_points_ja: [
      '業務領域 (登記・裁判 vs 許認可・契約)',
      '試験合格率 (司法書士 ≈ 4-5% vs 行政書士 ≈ 10-15%)',
      '独立後の典型的な年収',
      'クライアントの種類 (法人比率)',
      'AI 影響度 (書類作成の自動化進行)',
    ],
    decision_hints_ja: [
      '長期準備 (司法書士) vs 比較的短期 (行政書士)',
      '裁判書類への適性',
      'ダブル資格戦略の選択肢',
    ],
    og_eyebrow: 'COMPARE · 士業',
  },
  {
    slug: 'web-marketer-vs-research',
    occ_a_id: 240, // Webマーケティング
    occ_b_id: 456, // マーケティング・リサーチャー
    title_ja: 'Web マーケター vs マーケティング・リサーチャー',
    description_ja:
      'マーケティング領域の代表的な 2 職業。Web マーケターは広告運用・SEO・CRM など実行寄り、リサーチャーは市場調査・データ分析・戦略立案など分析寄り。' +
      '業務の手触り・必要スキル・AI 影響度・キャリアパスを比較。',
    comparison_points_ja: [
      '業務の中心 (実行・運用 vs 調査・分析)',
      '必要スキル (広告ツール・SEO vs 統計・調査設計)',
      '成果指標 (CV・ROAS vs インサイト・戦略提言)',
      'AI 影響度 (広告運用自動化 vs 分析の生成 AI 化)',
      'キャリアパス (CMO・自社ブランド vs ブランドマネ・コンサル)',
    ],
    decision_hints_ja: [
      '即時的な成果と試行錯誤を楽しめるか',
      '数字とロジックの分析を継続できるか',
      'AI を使いこなす上流業務に立ちたいか',
    ],
    og_eyebrow: 'COMPARE · マーケ',
  },
  {
    slug: 'data-scientist-vs-ai-engineer',
    occ_a_id: 323, // データサイエンティスト
    occ_b_id: 325, // AIエンジニア
    title_ja: 'データサイエンティスト vs AI エンジニア',
    description_ja:
      'AI 時代の象徴的な 2 職業を、業務の中心 (分析・統計 vs モデル実装・基盤構築)・必要スキル・年収・市場需要の観点で比較。' +
      '同じ「AI 関連」でも仕事の性質と必要バックグラウンドが大きく異なる。',
    comparison_points_ja: [
      '業務の中心 (データ分析・課題抽出 vs モデル開発・推論基盤)',
      '使う技術スタック (R/Python・統計 vs PyTorch/TF・MLOps)',
      '出力 (レポート・施策提言 vs 動くシステム・API)',
      '年収レンジと市場需要',
      'キャリアの先 (CDO/CIO vs ML プラットフォームリード)',
    ],
    decision_hints_ja: [
      '分析と提言が好きか、コードでシステムを動かしたいか',
      '統計学・実験設計に時間を投資できるか',
      'プロダクト責任を持つ立場に近づきたいか',
    ],
    og_eyebrow: 'COMPARE · AI 系',
    featured: true,
  },
  {
    slug: 'shika-vs-juui',
    occ_a_id: 159, // 歯科医師
    occ_b_id: 223, // 獣医師
    title_ja: '歯科医師 vs 獣医師',
    description_ja:
      '同じ 6 年制の医療系国家資格職。対象 (人 vs 動物)・養成課程の難度・開業形態・年収・AI 影響度に差がある。' +
      '専門医療の対象として「人」と「動物」を比較するキャリア視点で整理。',
    comparison_points_ja: [
      '対象 (人の口腔 vs 動物全般)',
      '養成課程 (歯学部 6 年 vs 獣医学部 6 年)',
      '開業形態 (歯科クリニック vs 動物病院)',
      '年収レンジと開業の経済性',
      '法律的責任の重さ',
    ],
    decision_hints_ja: [
      '人と接するか、動物と接するか',
      '飽和しつつある歯科 vs 多様化する動物医療',
      '小動物・大動物・産業動物の専門選択',
    ],
    og_eyebrow: 'COMPARE · 医療職',
  },
  {
    slug: 'yochien-vs-hoikushi',
    occ_a_id: 178, // 幼稚園教員
    occ_b_id: 131, // 保育士
    title_ja: '幼稚園教諭 vs 保育士',
    description_ja:
      'よく混同される 2 職業を、所管 (文科省 vs 厚労省)・対象年齢・必要資格・勤務時間・年収・AI 影響度の観点で比較。' +
      '幼保一元化が進む中、両資格保有 (認定こども園) のキャリアも視野に整理。',
    comparison_points_ja: [
      '所管省庁 (文科省 vs 厚労省)',
      '対象年齢 (3-6 歳 vs 0-6 歳)',
      '必須資格 (幼稚園教諭免許 vs 保育士資格)',
      '勤務時間 (教育時間 vs 11 時間保育)',
      '認定こども園での両資格活用',
    ],
    decision_hints_ja: [
      '教育要素 vs 養護要素の重視度',
      '認定こども園 (幼保一元化) で両資格を活かす道',
      '0-2 歳の乳児期と関わるかどうか',
    ],
    og_eyebrow: 'COMPARE · 幼児教育',
  },
  {
    slug: 'webdesigner-vs-illustrator',
    occ_a_id: 326, // Webデザイナー
    occ_b_id: 342, // イラストレーター
    title_ja: 'Web デザイナー vs イラストレーター',
    description_ja:
      'クリエイティブ職の 2 つを、業務の中心 (UI/UX 設計 vs 絵の制作)・働き方 (組織 vs フリーランス比率)・年収・AI 影響度の観点で比較。' +
      '生成 AI による直撃度の違いと、AI を使いこなすクリエイターとしての姿勢の違いも整理。',
    comparison_points_ja: [
      '業務の中心 (画面設計 vs 絵画・キャラ制作)',
      '雇用形態 (会社員中心 vs フリーランス比率高)',
      '年収の安定性',
      '生成 AI の直撃度 (UI 自動生成 vs 画像生成)',
      'ポートフォリオの作り方',
    ],
    decision_hints_ja: [
      'チーム制作 vs 一人制作、どちらが性に合うか',
      '安定収入 vs フリーランス志向',
      'AI を相棒にして独自性を出す心がまえ',
    ],
    og_eyebrow: 'COMPARE · クリエイティブ',
  },
];

export function getCompareMeta(slug: string): CompareMeta {
  const meta = COMPARE_META.find((m) => m.slug === slug);
  if (!meta) {
    throw new Error(`Unknown compare slug: ${slug}. Known: ${COMPARE_META.map((m) => m.slug).join(', ')}`);
  }
  return meta;
}
