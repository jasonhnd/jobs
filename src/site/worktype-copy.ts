export const FAMILY_CODES = ['CPB', 'CPK', 'CDB', 'CDK', 'RPB', 'RPK', 'RDB', 'RDK'] as const;

export type FamilyCode = (typeof FAMILY_CODES)[number];
export type WorktypeAxis = 'A1' | 'A2' | 'A3';

export type PoleByAxis = {
  readonly A1: 'C' | 'R';
  readonly A2: 'P' | 'D';
  readonly A3: 'B' | 'K';
};

export type WorktypePole = PoleByAxis[WorktypeAxis];

export interface WorktypeFamily {
  readonly familyId: FamilyCode;
  readonly code: FamilyCode;
  readonly name: string;
  readonly identity: string;
  readonly strengths: string;
  readonly aiRelation: string;
  readonly empowerment: string;
  readonly transition: string;
  readonly share: string;
}

type WorktypeFamilies = {
  readonly [Code in FamilyCode]: WorktypeFamily & {
    readonly familyId: Code;
    readonly code: Code;
  };
};

export const FAMILIES = {
  CPB: {
    familyId: 'CPB',
    code: 'CPB',
    name: 'ふれあい創造家',
    identity: 'この結果では、人の反応を見ながら、手ざわりのある場や表現をつくるふれあい創造家タイプです。',
    strengths: '相手の空気を読み、現物や場の変化に合わせて、安心感と新しい体験を同時につくれます。',
    aiRelation: 'AIは下調べや案出しを手伝う相棒です。最後の価値は、手、表情、場づくりに残ります。',
    empowerment: '次の一手は、接客やケアの観察を言語化し、準備や発想出しをAIで軽くすることです。',
    transition: '創造性と対人接点が近い仕事ほど、あなたの持ち味が伝わりやすくなります。',
    share: '人のそばで、新しい体験を形にするタイプ。',
  },
  CPK: {
    familyId: 'CPK',
    code: 'CPK',
    name: '共感ストラテジスト',
    identity: 'この結果では、人の思いや背景をくみ取り、言葉と構想で道筋を描く共感ストラテジストタイプです。',
    strengths: '相手の迷いを整理し、納得して動ける問い、説明、合意の形に変えられます。',
    aiRelation: 'AIは要約やたたき台を速くします。人が担うのは、問いの立て方、意味づけ、相手への届き方です。',
    empowerment: '次の一手は、AIの下書きに自分の観察と判断を重ね、相談、教育、提案の質を上げることです。',
    transition: '人と知識をつなぐ役割で、あなたの共感力と構想力がいちばん働きます。',
    share: '相手の迷いをほどき、進む道を言葉にするタイプ。',
  },
  CDB: {
    familyId: 'CDB',
    code: 'CDB',
    name: 'ものづくり設計家',
    identity: 'この結果では、情報や条件を読み、現物の制約まで見ながら形に落とすものづくり設計家タイプです。',
    strengths: '仕様、素材、数字、現場感を行き来し、使える形にまとめる力があります。',
    aiRelation: 'AIは試作案や比較材料を広げます。最後に決めるのは、現物の条件、使う人、現場で起きることです。',
    empowerment: '次の一手は、AIで選択肢を増やしつつ、制約を読む目と検証の手順を磨くことです。',
    transition: '設計、制作、改善が近い仕事ほど、あなたの発想が実物の価値につながります。',
    share: '条件を読み、アイデアを現物に着地させるタイプ。',
  },
  CDK: {
    familyId: 'CDK',
    code: 'CDK',
    name: 'AI共創パイロット',
    identity: 'この結果では、AIやデータと組み、仮説を試しながら知的な成果へ進めるAI共創パイロットタイプです。',
    strengths: '複雑な情報を分解し、AIの出力を材料にして、速く考え、深く検証できます。',
    aiRelation: 'AIは高出力の相棒です。使うほど、問い、判断、検証をどう設計するかが価値になります。',
    empowerment: '次の一手は、AIに任せる部分と自分が確かめる部分を分け、成果物の品質を上げることです。',
    transition: '研究、開発、分析、企画のように、知識を組み替える仕事で力を発揮しやすいタイプです。',
    share: 'AIと並走し、問いと検証で成果を伸ばすタイプ。',
  },
  RPB: {
    familyId: 'RPB',
    code: 'RPB',
    name: '現場のケアマイスター',
    identity: 'この結果では、決まった流れの中で相手の小さな変化に気づき、現場で支えるケアマイスタータイプです。',
    strengths: '手順を安定させながら、人の状態や場の変化に合わせて丁寧に動けます。',
    aiRelation: 'AIは記録、連絡、準備を軽くします。信頼をつくる声かけや身体感覚は、人が担う価値です。',
    empowerment: '次の一手は、ケアや接客の観察を言葉にし、事務作業をAIで減らして相手を見る時間を増やすことです。',
    transition: '現場で人を支える仕事ほど、あなたの安定感と気づきが力になります。',
    share: '手順の中に、相手への気づきを重ねるタイプ。',
  },
  RPK: {
    familyId: 'RPK',
    code: 'RPK',
    name: '段取りコーディネーター',
    identity: 'この結果では、人と情報の流れを整え、抜け漏れなく前に進める段取りコーディネータータイプです。',
    strengths: '期限、書類、相手の事情を見ながら、関係者が迷わず動ける状態をつくれます。',
    aiRelation: 'AIはテンプレート、分類、返信案を補助します。人が担うのは、正確な確認と相手に合わせた調整です。',
    empowerment: '次の一手は、定型の連絡や整理をAIに任せ、例外確認と関係者への伝え方に集中することです。',
    transition: '事務、調整、サポートの仕事で、あなたの段取り力がチームの動きやすさにつながります。',
    share: '人と情報をつなぎ、仕事を前に進めるタイプ。',
  },
  RDB: {
    familyId: 'RDB',
    code: 'RDB',
    name: '現場フロウ・マスター',
    identity: 'この結果では、現場、手順、データを見ながら、作業の流れを整える現場フロウ・マスタータイプです。',
    strengths: '動き、順番、数量、品質のズレに気づき、現場が止まらないように整えられます。',
    aiRelation: 'AIは予測、最適化、記録確認を助けます。現場で起きる例外やその場の判断は、人の観察が支えます。',
    empowerment: '次の一手は、AIの予測やチェックを使いながら、現場判断と改善の声を増やすことです。',
    transition: '物流、検査、運用のように流れを扱う仕事で、あなたの安定した改善力が活きます。',
    share: '現場の流れを読み、ムダなく動ける状態に整えるタイプ。',
  },
  RDK: {
    familyId: 'RDK',
    code: 'RDK',
    name: 'AIオートメーター',
    identity: 'この結果では、定型情報を構造化し、AIに任せる部分を見極めるAIオートメータータイプです。',
    strengths: 'くり返し作業を分解し、手順、確認点、例外を整理して、仕事を軽くできます。',
    aiRelation: 'AIに渡しやすい領域が多いからこそ、確認、判断、例外対応、改善設計へ上がる余地があります。',
    empowerment: '次の一手は、自動化できる手順を切り出し、AIの出力をチェックする観点と判断基準を持つことです。',
    transition: '作業を抱え込まず、AIを使った確認役、改善役、例外判断役へ広げていくタイプです。',
    share: 'ルーティンをAIに渡し、確かめる力で前に進むタイプ。',
  },
} as const satisfies WorktypeFamilies;

export type VariantIdByFamily = {
  readonly CPB: 'atelier' | 'spark' | 'touch';
  readonly CPK: 'framer' | 'mentor' | 'story';
  readonly CDB: 'prototype' | 'craftmap' | 'constraint';
  readonly CDK: 'hacker' | 'architect' | 'researcher';
  readonly RPB: 'care' | 'hospitality' | 'steady';
  readonly RPK: 'router' | 'mediator' | 'operator';
  readonly RDB: 'flow' | 'inspector' | 'kaizen';
  readonly RDK: 'automation' | 'auditor' | 'optimizer';
};

export type WorktypeVariantId<Code extends FamilyCode = FamilyCode> = VariantIdByFamily[Code];

export interface WorktypeVariant<Code extends FamilyCode = FamilyCode> {
  readonly variantId: WorktypeVariantId<Code>;
  readonly familyId: Code;
  readonly name: string;
  readonly catch: string;
}

type WorktypeVariants = {
  readonly [Code in FamilyCode]: {
    readonly [Variant in WorktypeVariantId<Code>]: WorktypeVariant<Code> & {
      readonly variantId: Variant;
    };
  };
};

export const VARIANT_IDS_BY_FAMILY = {
  CPB: ['atelier', 'spark', 'touch'],
  CPK: ['framer', 'mentor', 'story'],
  CDB: ['prototype', 'craftmap', 'constraint'],
  CDK: ['hacker', 'architect', 'researcher'],
  RPB: ['care', 'hospitality', 'steady'],
  RPK: ['router', 'mediator', 'operator'],
  RDB: ['flow', 'inspector', 'kaizen'],
  RDK: ['automation', 'auditor', 'optimizer'],
} as const satisfies {
  readonly [Code in FamilyCode]: readonly WorktypeVariantId<Code>[];
};

export const VARIANTS = {
  CPB: {
    atelier: {
      variantId: 'atelier',
      familyId: 'CPB',
      name: 'アトリエ伴走家',
      catch: '相手の反応を見ながら、手ざわりのある体験をその場で磨きます。',
    },
    spark: {
      variantId: 'spark',
      familyId: 'CPB',
      name: 'ひらめき場づくり師',
      catch: '人が集まる場に小さな発見を入れ、空気を前向きに動かします。',
    },
    touch: {
      variantId: 'touch',
      familyId: 'CPB',
      name: '手ざわり表現家',
      catch: '言葉だけでは伝わらない感覚を、形や動きで届けます。',
    },
  },
  CPK: {
    framer: {
      variantId: 'framer',
      familyId: 'CPK',
      name: '共感フレーマー',
      catch: '相手の迷いをほどき、進むべき問いと言葉に組み直します。',
    },
    mentor: {
      variantId: 'mentor',
      familyId: 'CPK',
      name: '未来面談ナビ',
      catch: '対話の中から強みと選択肢を見つけ、次の一歩を一緒に描きます。',
    },
    story: {
      variantId: 'story',
      familyId: 'CPK',
      name: '意味づけストーリスト',
      catch: '事実や気持ちをつなぎ、納得して動ける物語に変えます。',
    },
  },
  CDB: {
    prototype: {
      variantId: 'prototype',
      familyId: 'CDB',
      name: '試作ブースター',
      catch: '図面、素材、現場条件を行き来して、早く形にして学びます。',
    },
    craftmap: {
      variantId: 'craftmap',
      familyId: 'CDB',
      name: '現物マッピング職人',
      catch: '数字や仕様を現物のクセまで落とし込み、使える設計に整えます。',
    },
    constraint: {
      variantId: 'constraint',
      familyId: 'CDB',
      name: '制約突破デザイナー',
      catch: '制約を敵にせず、条件の中から新しい形を見つけます。',
    },
  },
  CDK: {
    hacker: {
      variantId: 'hacker',
      familyId: 'CDK',
      name: 'AI先駆けハッカー',
      catch: 'AIを試しながら最短で仮説を形にし、次の打ち手を見つけます。',
    },
    architect: {
      variantId: 'architect',
      familyId: 'CDK',
      name: '共創アーキテクト',
      catch: '人の判断とAIの出力を組み合わせ、再現できる仕組みに設計します。',
    },
    researcher: {
      variantId: 'researcher',
      familyId: 'CDK',
      name: '深掘りリサーチャー',
      catch: '問いを掘り下げ、根拠を積み上げてAIの答えを磨きます。',
    },
  },
  RPB: {
    care: {
      variantId: 'care',
      familyId: 'RPB',
      name: 'ぬくもりケア職人',
      catch: '手順を守りながら、相手の小さな変化に気づいて支えます。',
    },
    hospitality: {
      variantId: 'hospitality',
      familyId: 'RPB',
      name: '現場ホスピタリスト',
      catch: 'その場の空気を整え、安心して頼れる接点をつくります。',
    },
    steady: {
      variantId: 'steady',
      familyId: 'RPB',
      name: '安心ルーティン守り人',
      catch: '毎日の流れを安定させ、必要なときにすぐ手を差し出します。',
    },
  },
  RPK: {
    router: {
      variantId: 'router',
      familyId: 'RPK',
      name: '抜け漏れルーター',
      catch: '人、期限、書類の流れを整理し、次に動く人へ迷わず渡します。',
    },
    mediator: {
      variantId: 'mediator',
      familyId: 'RPK',
      name: '調整ハブマネージャー',
      catch: '相手ごとの事情を読み、関係者が同じ地図を見られるように整えます。',
    },
    operator: {
      variantId: 'operator',
      familyId: 'RPK',
      name: 'テンプレ改善オペレーター',
      catch: '定型のやり取りをAIで軽くし、確認と例外対応に集中します。',
    },
  },
  RDB: {
    flow: {
      variantId: 'flow',
      familyId: 'RDB',
      name: '現場フロー管制官',
      catch: '動き、在庫、時間のズレを見つけ、現場の流れを止めずに整えます。',
    },
    inspector: {
      variantId: 'inspector',
      familyId: 'RDB',
      name: '精度チェック職人',
      catch: '手順とデータを照らし合わせ、見落としを減らして品質を守ります。',
    },
    kaizen: {
      variantId: 'kaizen',
      familyId: 'RDB',
      name: '動線カイゼン隊長',
      catch: '身体の動きと作業順を見直し、ムダを減らして働きやすくします。',
    },
  },
  RDK: {
    automation: {
      variantId: 'automation',
      familyId: 'RDK',
      name: '自動化レシピ職人',
      catch: 'くり返し作業を分解し、AIに渡せる手順へ整えます。',
    },
    auditor: {
      variantId: 'auditor',
      familyId: 'RDK',
      name: '例外チェック司令塔',
      catch: 'AIの出力を確かめ、ズレや例外を見つけて判断につなげます。',
    },
    optimizer: {
      variantId: 'optimizer',
      familyId: 'RDK',
      name: '業務アップデート設計者',
      catch: '今のやり方を抱え込まず、ツールとルールで仕事を軽くします。',
    },
  },
} as const satisfies WorktypeVariants;

export type WorktypeQuestion = {
  readonly [Axis in WorktypeAxis]: {
    readonly axis: Axis;
    readonly left: string;
    readonly right: string;
    readonly leftPole: PoleByAxis[Axis];
    readonly rightPole: PoleByAxis[Axis];
    readonly reverse: boolean;
  };
}[WorktypeAxis];

export const QUESTIONS = [
  {
    axis: 'A1',
    left: '新しいやり方を考えるほうが好き',
    right: '決まった手順を正確に進めるほうが好き',
    leftPole: 'C',
    rightPole: 'R',
    reverse: false,
  },
  {
    axis: 'A1',
    left: '答えが決まっていない課題に惹かれる',
    right: '正解が明確な課題に集中しやすい',
    leftPole: 'C',
    rightPole: 'R',
    reverse: false,
  },
  {
    axis: 'A1',
    left: '0から企画や表現を作るのが得意',
    right: '同じ作業を安定して改善するのが得意',
    leftPole: 'C',
    rightPole: 'R',
    reverse: false,
  },
  {
    axis: 'A2',
    left: '人の表情や空気を見て動く',
    right: '数字や資料を見て動く',
    leftPole: 'P',
    rightPole: 'D',
    reverse: false,
  },
  {
    axis: 'A2',
    left: '対話で合意を作る仕事が好き',
    right: '分析で答えを絞る仕事が好き',
    leftPole: 'P',
    rightPole: 'D',
    reverse: false,
  },
  {
    axis: 'A2',
    left: '相手に合わせて説明を変える',
    right: '情報を整理して正確に伝える',
    leftPole: 'P',
    rightPole: 'D',
    reverse: false,
  },
  {
    axis: 'A3',
    left: '現場で手を動かす仕事が合う',
    right: '知識や概念を扱う仕事が合う',
    leftPole: 'B',
    rightPole: 'K',
    reverse: false,
  },
  {
    axis: 'A3',
    left: '道具・移動・現物があるほうが集中できる',
    right: 'PC・文書・情報空間のほうが集中できる',
    leftPole: 'B',
    rightPole: 'K',
    reverse: false,
  },
  {
    axis: 'A3',
    left: '体感や観察から判断する',
    right: '理論や資料から判断する',
    leftPole: 'B',
    rightPole: 'K',
    reverse: false,
  },
] as const satisfies readonly WorktypeQuestion[];

export type GapKind = 'aligned' | 'hidden_strength' | 'hidden_risk';

export interface GapCopy {
  readonly label: string;
  readonly reading: string;
  readonly action: string;
}

export const GAP = {
  aligned: {
    label: '自然に力を出しやすい組み合わせ',
    reading: 'この職業は、あなたがふだん使いやすい働き方と近い領域があります。',
    action: 'AIで変わる作業を確認しながら、今の強みをどの業務で伸ばすか見てみましょう。',
  },
  hidden_strength: {
    label: 'まだ使い切っていない強みがあります',
    reading: 'あなたの得意な創造性、対人感覚、現場感が、この職業では一部眠っているかもしれません。',
    action: 'その強みを使える役割に広げるか、近い職業も比べてみましょう。',
  },
  hidden_risk: {
    label: '働き方を更新する余地があります',
    reading: 'この職業では、判断、人との接点、AIを使った進め方がこれから効きやすくなります。',
    action: '判断を加える練習、人との接点を増やす工夫、AI補助のワークフロー、近い職業との比較から始めましょう。',
  },
} as const satisfies Record<GapKind, GapCopy>;

export const SHARE = {
  hashtag: '#AI働き方診断',
  textTemplate: '#AI働き方診断 私は【{タイプ名}】でした！ {リンク}',
  challengeHooks: ['あなたの同僚は何タイプ?', '私のタイプ、当ててみて'],
  compareCta: '結果を比べる',
  copyLinkCta: 'リンクをコピー',
  xConsent: 'Xに投稿します',
} as const;

export const LABELS = {
  featureName: 'AI働き方診断',
  personalType: 'あなたのタイプ',
  occupationType: 'この職業のタイプ',
  gap: '自分 x 仕事のギャップ',
} as const;

export const RARITY = {
  familyTemplate: 'このタイプは職業データ全体の約{割合}%です。',
  pending: 'このタイプの割合は職業データから確認中です。',
} as const;

export const DISCLAIMER =
  'この診断は、仕事の好みと職業データを比べるための目安です。性格検査や適職保証ではありません。AI 影響度は AIOIS-10 に基づくモデル出力であり、統計的な将来予測ではありません。';
