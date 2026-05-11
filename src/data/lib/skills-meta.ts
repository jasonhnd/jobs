/**
 * skills-meta.ts — スキル hub の slug + IPD skill key + 表示メタ。
 *
 * 39 個ある IPD スキル軸から、reader value の高い 10 個を選んで hub 化。
 * 各 hub の data 源は public/data.skills/<ipd_key>.json (build:data 出力)。
 *
 * Pure-data モジュール (fs / Node-runtime imports なし) — Astro frontmatter
 * と Vercel Edge (api/og.tsx) 両方からインポート可能。
 */

export type SkillSlug =
  | 'critical-thinking'
  | 'problem-solving'
  | 'social-perceptiveness'
  | 'coordination'
  | 'instructing'
  | 'programming'
  | 'judgment'
  | 'quality-control'
  | 'time-management'
  | 'persuasion';

export interface SkillMeta {
  slug: SkillSlug;
  /** IPD `data/labels/skills.ja-en.json` のキー — public/data.skills/<key>.json と対応 */
  ipd_key: string;
  /** 短い JA 名 (URL slug の翻訳)。OG カードと breadcrumb 用 */
  short_ja: string;
  /** Hub タイトル (h1 + page title 用) */
  title_ja: string;
  /** SEO description / hub intro 用 (200 字程度) */
  description_ja: string;
  /** スキルが活きる典型的シチュエーション (3-5 項目) */
  use_cases_ja: ReadonlyArray<string>;
  /** 鍛え方ヒント (3-5 項目) */
  how_to_train_ja: ReadonlyArray<string>;
  og_eyebrow: string;
}

export const SKILL_META: ReadonlyArray<SkillMeta> = [
  {
    slug: 'critical-thinking',
    ipd_key: 'critical_thinking',
    short_ja: '批判的思考',
    title_ja: '批判的思考が核となる職業',
    description_ja:
      '情報を鵜呑みにせず、論理と推論で評価・吟味する力が中心となる職業群。' +
      '前提条件の妥当性を疑い、根拠に基づいて結論を導く能力が業務遂行に直結する。' +
      '研究・分析・教育・士業など、判断の質が成果を決める分野で重視される。',
    use_cases_ja: [
      '提案された解決策の論理穴を見抜く',
      '対立する仮説を比較検討して採否判断',
      'データの裏に隠れた偏りを察知する',
      '不完全な情報からも意思決定を進める',
    ],
    how_to_train_ja: [
      '主張に対して "なぜ？" "本当に？" を 3 段階繰り返す習慣',
      '反対意見も等しく検討するディベート練習',
      '統計リテラシー本でデータ批判の型を学ぶ',
    ],
    og_eyebrow: 'SKILL · CRITICAL THINKING',
  },
  {
    slug: 'problem-solving',
    ipd_key: 'complex_problem_solving',
    short_ja: '複雑な問題解決',
    title_ja: '複雑な問題解決が求められる職業',
    description_ja:
      '構造が複雑で、単純な手順では解けない問題に取り組む力が中心となる職業群。' +
      '問題の本質を見抜き、複数の制約条件下で最適解を導くプロセス全体をデザインする能力が必要。' +
      'システム設計・コンサル・医療診断・経営判断などで重視される。',
    use_cases_ja: [
      '複数のステークホルダーの利害が絡む案件を整理',
      '前例のない状況での意思決定',
      '原因と結果が遠く離れた問題のトレース',
      '部分最適と全体最適のトレードオフ判断',
    ],
    how_to_train_ja: [
      '日常の問題を "状況→原因→解決→検証" のフレームで分解',
      '異分野の知識を架橋する読書習慣',
      'ケーススタディ集で他者の解法を学ぶ',
    ],
    og_eyebrow: 'SKILL · COMPLEX PROBLEM SOLVING',
  },
  {
    slug: 'social-perceptiveness',
    ipd_key: 'social_perceptiveness',
    short_ja: '対人感受性',
    title_ja: '他者の反応を読む力が核となる職業',
    description_ja:
      '相手の感情・意図・反応を察知して、それに合わせて自分の行動を調整する能力が中心となる職業群。' +
      '言葉になっていないサインを読み取り、関係性の中で適切に振る舞う力が業務に直結する。' +
      '看護・介護・教育・営業・カウンセリングなどで重視される。',
    use_cases_ja: [
      '不安そうな顧客の表情から本音を引き出す',
      '生徒の "わかったふり" を見抜いて補足説明',
      '会議の場の空気を読んで発言タイミングを調整',
      '電話越しの相手の心情変化に対応',
    ],
    how_to_train_ja: [
      '会話中に相手の表情・声色を意識的に観察',
      'アクティブ・リスニング (傾聴) の研修受講',
      '異なる文化・年代の人と接する機会を増やす',
    ],
    og_eyebrow: 'SKILL · SOCIAL PERCEPTIVENESS',
  },
  {
    slug: 'coordination',
    ipd_key: 'coordination',
    short_ja: '調整・段取り',
    title_ja: '他者との調整が核となる職業',
    description_ja:
      '複数の人や部門の動きを合わせて、全体として円滑に進める力が中心となる職業群。' +
      '優先順位を判断し、必要なリソースを適切なタイミングで動かす段取り力が業務遂行を左右する。' +
      'プロジェクトマネジメント・施工管理・チーム運営などで重視される。',
    use_cases_ja: [
      '複数チームの作業順序とリソース配分を組む',
      '進捗のボトルネックを察知して再配分',
      '関係者の思惑を聞き取りながら合意形成',
      '突発的な変更に応じた段取り再構築',
    ],
    how_to_train_ja: [
      '小規模イベントの幹事を引き受ける経験',
      'ガントチャート・かんばんなど可視化ツールの活用',
      '"段取り 8 割" の現場で実践を積む',
    ],
    og_eyebrow: 'SKILL · COORDINATION',
  },
  {
    slug: 'instructing',
    ipd_key: 'instructing',
    short_ja: '指導',
    title_ja: '指導・教える力が核となる職業',
    description_ja:
      '相手の理解度に合わせて知識やスキルを伝え、習得まで導く力が中心となる職業群。' +
      '教える内容の専門性だけでなく、相手の躓きを察知して説明を変える調整力が必要。' +
      '教師・インストラクター・トレーナー・指導医・職人の親方などで重視される。',
    use_cases_ja: [
      '生徒の理解度を見て説明の抽象度を調整',
      '失敗を責めず次に活かせる形でフィードバック',
      '実演とヒントのバランスを取って自走を促す',
      '長期の習得計画を本人と合意しながら設計',
    ],
    how_to_train_ja: [
      '学んだことを 3 分以内で他人に説明する練習',
      '質問に答えるとき "結論→根拠→例" の順を意識',
      '教える相手の前提知識を必ず確認してから始める',
    ],
    og_eyebrow: 'SKILL · INSTRUCTING',
  },
  {
    slug: 'programming',
    ipd_key: 'programming',
    short_ja: 'プログラミング',
    title_ja: 'プログラミングが核となる職業',
    description_ja:
      'コンピュータに対する明確な手順記述 (コード) を通じて問題を解決する力が中心となる職業群。' +
      'アルゴリズムを構成する論理力と、エラー対処を含めた実装力の両方が業務に直結する。' +
      'IT エンジニア・データサイエンティスト・ゲーム開発・組込み系などで重視される。',
    use_cases_ja: [
      '業務要件を実装可能な仕様まで分解',
      '既存コードの読解とリファクタリング',
      '不具合の原因を再現させて切り分け',
      '性能・保守性・セキュリティのトレードオフ判断',
    ],
    how_to_train_ja: [
      '小さな自作プロジェクトで完成体験を積む',
      'OSS のコードを読む習慣',
      'AI とのペアプログラミングで伴走しながら本質を学ぶ',
    ],
    og_eyebrow: 'SKILL · PROGRAMMING',
  },
  {
    slug: 'judgment',
    ipd_key: 'judgment_decision_making',
    short_ja: '判断・意思決定',
    title_ja: '重要な判断・意思決定が核となる職業',
    description_ja:
      '不確実な状況下で、限られた情報をもとに重要な判断を下す力が中心となる職業群。' +
      '判断の影響範囲が大きく、後戻りしにくい意思決定の精度が成果を決める。' +
      '医師・経営者・パイロット・士業・指揮系統など、責任の重い職務で重視される。',
    use_cases_ja: [
      '緊急時に複数の選択肢から最善手を選ぶ',
      'リスクとリターンを天秤にかける投資判断',
      '長期と短期の利益のバランス',
      '組織にとっての最適解を導く政策判断',
    ],
    how_to_train_ja: [
      '小さな決定でも "なぜそう決めたか" を言語化',
      '判断の質と結果を分けて振り返る',
      'シナリオプランニングで先回り思考を養う',
    ],
    og_eyebrow: 'SKILL · JUDGMENT',
  },
  {
    slug: 'quality-control',
    ipd_key: 'quality_control_analysis',
    short_ja: '品質管理',
    title_ja: '品質管理・観察力が核となる職業',
    description_ja:
      '製品・サービスの品質を保つために、基準と実物を比較し続ける観察力が中心となる職業群。' +
      'わずかな差異やバラつきを察知し、原因まで遡って対処する精緻さが業務に直結する。' +
      '製造現場・検査技師・建設・食品衛生・調剤などで重視される。',
    use_cases_ja: [
      '製品の規格逸脱を目視・計測で検知',
      '不良品の原因を工程まで遡って特定',
      '検査基準の妥当性を継続的に見直す',
      '組織横断で品質意識を共有',
    ],
    how_to_train_ja: [
      '日常で "違和感" を言語化する習慣',
      '統計的品質管理 (QC) の基礎を学ぶ',
      '熟練者の検査プロセスを観察 + 質問',
    ],
    og_eyebrow: 'SKILL · QUALITY CONTROL',
  },
  {
    slug: 'time-management',
    ipd_key: 'time_management',
    short_ja: '時間管理',
    title_ja: '時間管理・優先順位付けが核となる職業',
    description_ja:
      '自分や他者の時間を効率的に配分し、複数の期限を守る力が中心となる職業群。' +
      '優先順位を素早く判断し、見積りと実態のずれを最小化する技術が業務遂行を左右する。' +
      '営業・コンサル・医療現場・編集・現場監督など、複数案件の同時進行が常態の職務で重視される。',
    use_cases_ja: [
      '緊急 vs 重要のマトリクスでタスクを並べ替え',
      '見積りの精度を実績で校正し続ける',
      '中断と復帰のコストを最小化',
      '他者の時間を尊重したスケジューリング',
    ],
    how_to_train_ja: [
      '週次で実績時間を計測 + 振り返り',
      'タイムボックス (ポモドーロ等) の試行',
      '見積りと実績の差分を毎週グラフ化',
    ],
    og_eyebrow: 'SKILL · TIME MANAGEMENT',
  },
  {
    slug: 'persuasion',
    ipd_key: 'persuasion',
    short_ja: '説得',
    title_ja: '説得・影響力が核となる職業',
    description_ja:
      '相手の認識や行動を変えるために、論理と感情の両面から働きかける力が中心となる職業群。' +
      '一方的な主張ではなく、相手の関心や懸念を踏まえて提案を組み立てる構成力が業務に直結する。' +
      '営業・販売・経営・士業・政治・広報などで重視される。',
    use_cases_ja: [
      '顧客の反対理由を引き出してそれに応える',
      '社内向けに新方針を浸透させる',
      '異なる立場の人を共通のゴールに向ける',
      '長期的な信頼関係を前提とした商談',
    ],
    how_to_train_ja: [
      '相手の "Yes" の前に出る "But" を予測',
      '価値観マップで利害が一致する点を探す',
      '一次情報 + ストーリーで主張を支える',
    ],
    og_eyebrow: 'SKILL · PERSUASION',
  },
];

export function getSkillMeta(slug: string): SkillMeta {
  const meta = SKILL_META.find((m) => m.slug === slug);
  if (!meta) {
    throw new Error(`Unknown skill slug: ${slug}. Known: ${SKILL_META.map((m) => m.slug).join(', ')}`);
  }
  return meta;
}
