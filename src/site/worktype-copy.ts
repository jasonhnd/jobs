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
    identity: 'あなたは、人の反応を受け取りながら、手ざわりのある場や表現をつくる人です。',
    strengths: '空気の変化に気づき、相手が安心できる温度のまま、新しい体験へ連れていけます。',
    aiRelation: 'AIには下調べや案出しを任せて大丈夫。最後に効くのは、あなたの手つき、表情、場を見る目線です。',
    empowerment: '今日見えた小さな反応を一つメモして、準備やアイデア出しだけAIに預けてみよう。',
    transition: '人と向き合いながら何かを形にする仕事で、あなたの持ち味は伝わりやすくなります。',
    share: '人のそばで、新しい体験をやわらかく形にします。',
  },
  CPK: {
    familyId: 'CPK',
    code: 'CPK',
    name: '寄りそい案内人',
    identity: 'あなたは、相手の思いや背景をくみ取り、進む道をいっしょに見つける人です。',
    strengths: '迷いを急かさず整理して、納得して動ける問い、説明、合意の形に変えられます。',
    aiRelation: 'AIの要約や下書きは頼れる道具です。そこに、あなたの問い方と届く言葉を重ねるほど強くなります。',
    empowerment: 'AIに下書きを任せて、あなたは問いの立て方と伝わり方に集中しよう。',
    transition: '相談、教育、提案のように、人と知識をつなぐ役割で力を出しやすいタイプです。',
    share: '迷いをほどき、次の一歩を言葉にします。',
  },
  CDB: {
    familyId: 'CDB',
    code: 'CDB',
    name: 'ものづくり設計家',
    identity: 'あなたは、情報や条件を読み、現物の制約まで見ながら形に落とせる人です。',
    strengths: '仕様、素材、数字、現場感を行き来して、ちゃんと使える形へまとめる力があります。',
    aiRelation: 'AIは試作案や比較材料を広げてくれます。仕上げを決めるのは、あなたが見る現物の条件です。',
    empowerment: '選択肢づくりはAIに広げてもらい、あなたは制約を読む目と試す順番を磨こう。',
    transition: '設計、制作、改善が近い仕事ほど、あなたの発想は実物の価値につながります。',
    share: '条件を読み、アイデアを現物に着地させます。',
  },
  CDK: {
    familyId: 'CDK',
    code: 'CDK',
    name: 'AI二人三脚',
    identity: 'あなたは、AIやデータと並んで走り、仮説を試しながら成果を育てる人です。',
    strengths: '複雑な情報を分けて考え、AIの出力を材料にしながら、速さと深さを両立できます。',
    aiRelation: 'AIは遠慮なく使っていい相棒です。使うほど、あなたの問い、判断、検証の設計が価値になります。',
    empowerment: 'AIに任せる範囲を先に決めて、あなたが確かめる観点を一行で書き出してみよう。',
    transition: '研究、開発、分析、企画のように、知識を組み替える仕事で力を発揮しやすいタイプです。',
    share: 'AIと並走し、問いと検証で成果を伸ばします。',
  },
  RPB: {
    familyId: 'RPB',
    code: 'RPB',
    name: 'そばで支える人',
    identity: 'あなたは、決まった流れの中でも相手の小さな変化に気づき、そばで支えられる人です。',
    strengths: '手順を安定させながら、人の状態や場の空気に合わせて丁寧に動けます。',
    aiRelation: 'AIには記録、連絡、準備を軽くしてもらいましょう。信頼をつくる声かけは、あなたの役目です。',
    empowerment: '事務作業を一つAIで減らして、相手の表情を見る時間を少し増やしてみよう。',
    transition: '現場で人を支える仕事ほど、あなたの安定感と気づきが力になります。',
    share: '手順の中に、相手への気づきを重ねます。',
  },
  RPK: {
    familyId: 'RPK',
    code: 'RPK',
    name: '段取りの世話役',
    identity: 'あなたは、人と情報の流れを整え、みんなが迷わず動けるように世話を焼ける人です。',
    strengths: '期限、書類、相手の事情を見ながら、抜け漏れを減らして仕事を前に進められます。',
    aiRelation: 'AIはテンプレート、分類、返信案で助けてくれます。あなたは正確な確認と相手に合わせた調整に残れます。',
    empowerment: '定型の連絡はAIにたたき台を作らせて、例外確認とひと言の気配りに時間を戻そう。',
    transition: '事務、調整、サポートの仕事で、あなたの段取り力がチームの動きやすさにつながります。',
    share: '人と情報をつなぎ、仕事を前に進めます。',
  },
  RDB: {
    familyId: 'RDB',
    code: 'RDB',
    name: '現場を回す人',
    identity: 'あなたは、現場、手順、データを見ながら、作業の流れを止めずに回せる人です。',
    strengths: '動き、順番、数量、品質のズレに気づき、現場が無理なく動く状態へ整えられます。',
    aiRelation: 'AIの予測や記録確認は役に立ちます。現場で起きる例外は、あなたの観察が受け止めます。',
    empowerment: '予測やチェックはAIに並走させて、あなたは現場の違和感を一つ改善案に変えてみよう。',
    transition: '物流、検査、運用のように流れを扱う仕事で、あなたの安定した改善力が活きます。',
    share: '現場の流れを読み、動きやすい状態に整えます。',
  },
  RDK: {
    familyId: 'RDK',
    code: 'RDK',
    name: '手放し上手',
    identity: 'あなたは、くり返しの仕事をほどいて、AIに渡せる形へ整えられる人です。',
    strengths: '手順、確認点、例外を分けて考え、抱え込んでいた作業を軽くできます。',
    aiRelation: 'AIに渡せる作業が多いほど、あなたの確認力、判断力、改善の目が前に出てきます。',
    empowerment: 'まずAIに渡せる作業を一つ切り出す。そこからあなたの確認力が効いてきます。',
    transition: '作業を抱え込まず、確認役、改善役、例外判断役へ広げていけるタイプです。',
    share: 'ルーティンを手放し、確かめる力で前に進みます。',
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

export type WorktypeVariantBucket = 'balance' | 'mixed' | 'sweep';

export const VARIANT_BUCKETS_BY_FAMILY = {
  CPB: { balance: 'atelier', mixed: 'touch', sweep: 'spark' },
  CPK: { balance: 'mentor', mixed: 'story', sweep: 'framer' },
  CDB: { balance: 'craftmap', mixed: 'constraint', sweep: 'prototype' },
  CDK: { balance: 'architect', mixed: 'researcher', sweep: 'hacker' },
  RPB: { balance: 'steady', mixed: 'hospitality', sweep: 'care' },
  RPK: { balance: 'router', mixed: 'mediator', sweep: 'operator' },
  RDB: { balance: 'inspector', mixed: 'kaizen', sweep: 'flow' },
  RDK: { balance: 'optimizer', mixed: 'auditor', sweep: 'automation' },
} as const satisfies {
  readonly [Code in FamilyCode]: Readonly<Record<WorktypeVariantBucket, WorktypeVariantId<Code>>>;
};

export const VARIANTS = {
  CPB: {
    atelier: {
      variantId: 'atelier',
      familyId: 'CPB',
      name: 'アトリエ伴走家',
      catch: 'あなたは相手の反応を見ながら、体験の手ざわりをその場で磨けます。',
    },
    spark: {
      variantId: 'spark',
      familyId: 'CPB',
      name: 'ひらめき場づくり師',
      catch: '人が集まる場に、あなたは小さな発見を差し込んで空気を動かします。',
    },
    touch: {
      variantId: 'touch',
      familyId: 'CPB',
      name: '手ざわり表現家',
      catch: 'あなたは言葉だけでは届かない感覚を、形や動きで渡せます。',
    },
  },
  CPK: {
    framer: {
      variantId: 'framer',
      familyId: 'CPK',
      name: '問い直し役',
      catch: 'あなたは相手の迷いをほどき、いま必要な問いへ置き直せます。',
    },
    mentor: {
      variantId: 'mentor',
      familyId: 'CPK',
      name: '未来面談ナビ',
      catch: '対話の中で、あなたは強みと選択肢を見つけて次の一歩を描きます。',
    },
    story: {
      variantId: 'story',
      familyId: 'CPK',
      name: '物語づくり職人',
      catch: 'あなたは事実と気持ちをつなぎ、納得して動ける物語に変えます。',
    },
  },
  CDB: {
    prototype: {
      variantId: 'prototype',
      familyId: 'CDB',
      name: '試して学ぶ職人',
      catch: 'あなたは図面、素材、現場条件を行き来して、まず形にして学びます。',
    },
    craftmap: {
      variantId: 'craftmap',
      familyId: 'CDB',
      name: '現物マッピング職人',
      catch: '数字や仕様を、あなたは現物のクセまで落とし込んで使える設計にします。',
    },
    constraint: {
      variantId: 'constraint',
      familyId: 'CDB',
      name: '制約くぐり職人',
      catch: '条件が厳しいほど、あなたはくぐり抜ける形を探し出します。',
    },
  },
  CDK: {
    hacker: {
      variantId: 'hacker',
      familyId: 'CDK',
      name: 'AI先駆けハッカー',
      catch: 'あなたはAIをすぐ試し、仮説を形にしながら次の打ち手を見つけます。',
    },
    architect: {
      variantId: 'architect',
      familyId: 'CDK',
      name: '仕組みづくり職人',
      catch: 'あなたは人の判断とAIの出力をつなぎ、続けられる仕組みにします。',
    },
    researcher: {
      variantId: 'researcher',
      familyId: 'CDK',
      name: '深掘りリサーチャー',
      catch: '問いが浅いままなら、あなたは根拠を積み上げて答えを磨きます。',
    },
  },
  RPB: {
    care: {
      variantId: 'care',
      familyId: 'RPB',
      name: 'ぬくもりケア職人',
      catch: 'あなたは手順を守りながら、相手の小さな変化に気づいて支えます。',
    },
    hospitality: {
      variantId: 'hospitality',
      familyId: 'RPB',
      name: 'その場の安心係',
      catch: 'その場が少し不安なとき、あなたは空気を整えて安心をつくれます。',
    },
    steady: {
      variantId: 'steady',
      familyId: 'RPB',
      name: '安心ルーティン守り人',
      catch: '毎日の流れを安定させ、あなたは必要なときにすぐ手を差し出します。',
    },
  },
  RPK: {
    router: {
      variantId: 'router',
      familyId: 'RPK',
      name: '抜け漏れ見張り番',
      catch: 'あなたは人、期限、書類の流れを見張り、迷わず次へ渡せます。',
    },
    mediator: {
      variantId: 'mediator',
      familyId: 'RPK',
      name: 'まとめ役',
      catch: '事情がばらばらでも、あなたは関係者が同じ地図を見られるように整えます。',
    },
    operator: {
      variantId: 'operator',
      familyId: 'RPK',
      name: '定型かるく係',
      catch: 'あなたは定型のやり取りを軽くして、確認と例外対応に余白を戻します。',
    },
  },
  RDB: {
    flow: {
      variantId: 'flow',
      familyId: 'RDB',
      name: '流れの見張り番',
      catch: 'あなたは動き、在庫、時間のズレを見つけ、流れが止まる前に整えます。',
    },
    inspector: {
      variantId: 'inspector',
      familyId: 'RDB',
      name: '精度チェック職人',
      catch: '手順とデータを照らし合わせ、あなたは見落としを減らして品質を守ります。',
    },
    kaizen: {
      variantId: 'kaizen',
      familyId: 'RDB',
      name: '動線カイゼン隊長',
      catch: 'あなたは身体の動きと作業順を見直し、ムダを減らして働きやすくします。',
    },
  },
  RDK: {
    automation: {
      variantId: 'automation',
      familyId: 'RDK',
      name: '自動化レシピ職人',
      catch: 'あなたはくり返し作業を分解し、AIに渡せる手順へ整えます。',
    },
    auditor: {
      variantId: 'auditor',
      familyId: 'RDK',
      name: '例外の見張り番',
      catch: 'AIが出した答えに、あなたはズレや例外がないか目を配れます。',
    },
    optimizer: {
      variantId: 'optimizer',
      familyId: 'RDK',
      name: '仕事かるく係',
      catch: '今のやり方を抱え込まず、あなたはツールとルールで仕事を軽くします。',
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
    reading: 'あなたの{strengths}という強みが、この職業では一部眠っているかもしれません。',
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
  textTemplate: '#AI働き方診断 私は【{タイプ名}】。{一言} {リンク}',
  challengeHooks: ['あなたの1枚もめくってみる?', '同僚と図鑑をめくり合おう'],
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

/**
 * Issue #235. The previous wording — 「このタイプは職業データ全体の約{割合}%です。」
 * — appears right after the visitor answers nine questions about their own
 * preferences, so a bare percentage reads as "only X% of people are like me".
 * It never meant that: it is the share of the 556 scored **occupations** whose
 * AIOIS-derived profile lands in this family. There is no user distribution to
 * report — results are never sent to a server — so that reading does not just
 * overstate the figure, it describes data the site does not hold.
 *
 * The count leads because 「{n}職」 names the unit and cannot be read as a
 * number of people, and the frame (職業データの中で) is set before any figure.
 * Guarded by worktype-rarity.test.ts.
 */
export const RARITY = {
  familyTemplate: '職業データの中で、このタイプに近い働き方の職業は{件数}職（全体の約{割合}%）です。',
  pending: 'このタイプに当てはまる職業数は職業データから確認中です。',
} as const;

export const DISCLAIMER =
  'この診断は、仕事の好みと職業データを比べるための目安です。性格検査や適職保証ではありません。AI 影響度は AIOIS-10 に基づくモデル出力であり、統計的な将来予測ではありません。';
