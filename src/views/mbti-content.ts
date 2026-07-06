/**
 * Phase-1 MBTI editorial content source.
 *
 * Data-only module for docs/MBTI_CONTENT.md section 6.1. It intentionally
 * creates no routes; future route code should consume PHASE1_MBTI_SLUGS and
 * getMbtiContentBySlug().
 */

export const MBTI_EDITORIAL_TAGS = [
  'idea-generation',
  'people-support',
  'hands-on-craft',
  'analysis',
  'field-response',
  'systems-ops',
] as const;

export type MbtiEditorialTag = (typeof MBTI_EDITORIAL_TAGS)[number];

export type Phase1MbtiLabel = 'ENFP' | 'INFP' | 'ISFP' | 'INFJ' | 'ISTP';
export type Phase1MbtiSlug = 'enfp' | 'infp' | 'isfp' | 'infj' | 'istp';

export interface MbtiOccupationCuration {
  readonly occupationId: number;
  readonly tag: MbtiEditorialTag;
  readonly reasonJa: string;
  readonly surprising?: true;
}

export interface MbtiContent {
  readonly label: Phase1MbtiLabel;
  readonly commonNameJa: string;
  readonly slug: Phase1MbtiSlug;
  readonly seo: {
    readonly titleJa: string;
    readonly descriptionJa: string;
  };
  readonly knownTypeFraming: {
    readonly h1Ja: string;
    readonly introJa: string;
    readonly guardrailJa: string;
  };
  readonly editorial: {
    readonly headingJa: string;
    readonly paragraphsJa: readonly string[];
  };
  readonly occupations: readonly MbtiOccupationCuration[];
}

const KNOWN_TYPE_GUARDRAIL_JA =
  'MBTIは性格の自己理解の入口です。このページは適職判定ではなく、職業データを見るための編集ガイドです。';

const EDITORIAL_HEADING_JA = 'AI時代の、このタイプの働き方';

function makeSeo(label: Phase1MbtiLabel): MbtiContent['seo'] {
  return {
    titleJa: `${label}のAI時代の働き方｜職業データで見るAI影響度`,
    descriptionJa:
      `${label}タイプとして語られがちな働き方を、AI時代の職業データとAIOIS-10のAI影響度から読み解きます。適職判定ではなく、診断への入口です。`,
  };
}

function makeKnownTypeFraming(label: Phase1MbtiLabel): MbtiContent['knownTypeFraming'] {
  return {
    h1Ja: `${label}のAI時代の働き方`,
    introJa:
      `${label}として検索してきた人へ。ここでは性格を決めつけず、AI時代に仕事で出やすい関心・動き方を、職業データと照らして見ていきます。`,
    guardrailJa: KNOWN_TYPE_GUARDRAIL_JA,
  };
}

const PHASE1_MBTI_CONTENT_SOURCE = [
  {
    label: 'ENFP',
    commonNameJa: '運動家',
    slug: 'enfp',
    seo: makeSeo('ENFP'),
    knownTypeFraming: makeKnownTypeFraming('ENFP'),
    editorial: {
      headingJa: EDITORIAL_HEADING_JA,
      paragraphsJa: [
        'ENFPは、新しい人や場から刺激を受けて案を広げるタイプとして語られがちです。AI時代には、下調べやたたき台をAIに任せることで、企画の切り口を検討しやすいかもしれない。',
        '一方で、興味の広さだけで仕事を決めると、納期、予算、現場安全のような条件を見落とすことがあります。仕事選びでは実際の職務内容も見る必要があります。',
        '下の職業例は判定ではなく、発想、人との調整、現場での反応を見る仕事を比べるための入口です。気になる職業は、仕事内容とAI影響度を合わせて確認してください。',
      ],
    },
    occupations: [
      {
        occupationId: 566,
        tag: 'idea-generation',
        reasonJa: '目的や参加者に合わせて企画を組み替える仕事で、発想と巻き込み方を比べやすい。',
      },
      {
        occupationId: 335,
        tag: 'idea-generation',
        reasonJa: '言葉で関心を動かす仕事で、AIの下書きを材料に表現を磨きやすい。',
      },
      {
        occupationId: 240,
        tag: 'analysis',
        reasonJa: '反応データを読みながら打ち手を変えるため、好奇心と検証の往復を見やすい。',
      },
      {
        occupationId: 125,
        tag: 'people-support',
        reasonJa: '相手の希望を聞き取り、当日の体験へつなぐ対人調整が中心になる。',
      },
      {
        occupationId: 219,
        tag: 'field-response',
        reasonJa: '場の安全と参加者の反応を見ながら、その場で案内を調整する。',
      },
      {
        occupationId: 522,
        tag: 'people-support',
        reasonJa: '課題意識を企画や運営に変える仕事で、人との合意づくりが重要になる。',
      },
      {
        occupationId: 234,
        tag: 'analysis',
        reasonJa: '社会課題への関心を、現地調査や事業性の確認に落とし込む意外な入口になる。',
        surprising: true,
      },
    ],
  },
  {
    label: 'INFP',
    commonNameJa: '仲介者',
    slug: 'infp',
    seo: makeSeo('INFP'),
    knownTypeFraming: makeKnownTypeFraming('INFP'),
    editorial: {
      headingJa: EDITORIAL_HEADING_JA,
      paragraphsJa: [
        'INFPは、価値観や言葉の細部を大切にするタイプとして語られがちです。AI時代には、要約や情報整理をAIに任せることで、相手の背景や意味づけに集中しやすいかもしれない。',
        'ただし、やさしさや理想だけで職業を選ぶと、制度、記録、期限、チーム内の役割を見落とすことがあります。仕事選びでは実際の職務内容も見ることが大切です。',
        '下の職業例は、支援、編集、調査のどこに関心が重なりやすいかを比べる材料です。適性の結論ではなく、次に見る職業ページを選ぶための案内です。',
      ],
    },
    occupations: [
      {
        occupationId: 412,
        tag: 'people-support',
        reasonJa: '相手の言葉にならない迷いを受け止め、学校内の支援につなげる。',
      },
      {
        occupationId: 136,
        tag: 'people-support',
        reasonJa: '価値観や経験を整理し、納得できる選択肢を一緒に探す。',
      },
      {
        occupationId: 210,
        tag: 'idea-generation',
        reasonJa: '著者の考えを読者へ届く形に整えるため、意味づけと構成力を見やすい。',
      },
      {
        occupationId: 358,
        tag: 'analysis',
        reasonJa: '専門情報を読み解き、使う人に伝わる文章へ変える役割がある。',
      },
      {
        occupationId: 409,
        tag: 'people-support',
        reasonJa: '制度と本人の希望をつなぎ、生活の困りごとを支える役割が大きい。',
      },
      {
        occupationId: 182,
        tag: 'analysis',
        reasonJa: '情報を分類し、利用者が必要な知識に出会える環境を整える。',
      },
      {
        occupationId: 516,
        tag: 'analysis',
        reasonJa: '心理の視点を矯正教育の現場で使うため、内面理解を実務に結びつける。',
        surprising: true,
      },
    ],
  },
  {
    label: 'ISFP',
    commonNameJa: '冒険家',
    slug: 'isfp',
    seo: makeSeo('ISFP'),
    knownTypeFraming: makeKnownTypeFraming('ISFP'),
    editorial: {
      headingJa: EDITORIAL_HEADING_JA,
      paragraphsJa: [
        'ISFPは、目の前の感覚や手ざわりから表現を作るタイプとして語られがちです。AI時代には、参考案や素材探しをAIに任せながら、最後の質感を試作しやすいかもしれない。',
        '一方で、感覚に合うかどうかだけで仕事を選ぶと、衛生管理、安全確認、納期のような見えにくい条件を見落とすことがあります。仕事選びでは実際の職務内容も見る必要があります。',
        '下の職業例は、美容、空間、素材、現場対応のどこに関心が重なりやすいかを見るためのものです。職業ページでは作業環境や必要な訓練も合わせて確認してください。',
      ],
    },
    occupations: [
      {
        occupationId: 116,
        tag: 'hands-on-craft',
        reasonJa: '髪型という見える形で、相手の気分や生活に合う表現を作る。',
      },
      {
        occupationId: 118,
        tag: 'hands-on-craft',
        reasonJa: '色や質感を手で調整し、その人らしい印象を現場で仕上げる。',
      },
      {
        occupationId: 349,
        tag: 'hands-on-craft',
        reasonJa: '花材の色や季節感を組み合わせ、短い時間で空間の表情を作る。',
      },
      {
        occupationId: 348,
        tag: 'hands-on-craft',
        reasonJa: '素材の手ざわりと模様を扱い、感覚を製品の設計に落とし込む。',
      },
      {
        occupationId: 352,
        tag: 'field-response',
        reasonJa: '本番の場を想定しながら、見た目と使いやすさを同時に整える。',
      },
      {
        occupationId: 420,
        tag: 'people-support',
        reasonJa: '香りや触れるケアを通じて、相手の状態に合わせた時間を作る。',
      },
      {
        occupationId: 307,
        tag: 'field-response',
        reasonJa: '感覚的な美しさだけでなく、火薬や安全管理を現場で扱う意外な手仕事になる。',
        surprising: true,
      },
      {
        occupationId: 227,
        tag: 'hands-on-craft',
        reasonJa: '動物の状態を見ながら、手先の技術で清潔さと見た目を整える。',
      },
    ],
  },
  {
    label: 'INFJ',
    commonNameJa: '提唱者',
    slug: 'infj',
    seo: makeSeo('INFJ'),
    knownTypeFraming: makeKnownTypeFraming('INFJ'),
    editorial: {
      headingJa: EDITORIAL_HEADING_JA,
      paragraphsJa: [
        'INFJは、人や社会の背景を読み取り、長い目線で支えるタイプとして語られがちです。AI時代には、資料整理や下調べをAIに任せることで、支援の設計や伝え方を検討しやすいかもしれない。',
        'ただし、理念だけで仕事を選ぶと、制度運用、記録、関係者調整の重さを見落とすことがあります。仕事選びでは実際の職務内容も見ることが欠かせません。',
        '下の職業例は、個別支援、地域づくり、発信、現地対応を横断して見比べるためのものです。どれも性格の結論ではなく、職業データを見るための手がかりです。',
      ],
    },
    occupations: [
      {
        occupationId: 408,
        tag: 'people-support',
        reasonJa: '医療と生活の間にある不安を整理し、支援につなげる役割が大きい。',
      },
      {
        occupationId: 568,
        tag: 'systems-ops',
        reasonJa: '子どもの支援方針をチームで整えるため、理念と運営を結びつける。',
      },
      {
        occupationId: 513,
        tag: 'field-response',
        reasonJa: '価値観だけでなく、現地事情と制度を読みながら支援を設計する。',
        surprising: true,
      },
      {
        occupationId: 400,
        tag: 'systems-ops',
        reasonJa: '地域の学びを企画し、人が参加し続けられる仕組みを作る。',
      },
      {
        occupationId: 185,
        tag: 'analysis',
        reasonJa: '資料の意味を読み解き、展示を通じて社会へ伝える仕事になる。',
      },
      {
        occupationId: 444,
        tag: 'idea-generation',
        reasonJa: '組織の思いを外へ届く言葉や企画に変える橋渡しを担う。',
      },
      {
        occupationId: 395,
        tag: 'people-support',
        reasonJa: '一人ひとりの学び方を見ながら、長期の成長を支える。',
      },
    ],
  },
  {
    label: 'ISTP',
    commonNameJa: '巨匠',
    slug: 'istp',
    seo: makeSeo('ISTP'),
    knownTypeFraming: makeKnownTypeFraming('ISTP'),
    editorial: {
      headingJa: EDITORIAL_HEADING_JA,
      paragraphsJa: [
        'ISTPは、実物を見て原因を探り、手を動かして直すタイプとして語られがちです。AI時代には、手順書やログ整理をAIに任せることで、現物の観察と判断に集中しやすいかもしれない。',
        '一方で、器用さだけで仕事を選ぶと、法令、安全基準、チーム内の引き継ぎを見落とすことがあります。仕事選びでは実際の職務内容も見る必要があります。',
        '下の職業例は、整備、検査、運用、調査のどこに関心が重なりやすいかを比べるための入口です。職業ページでは道具、現場条件、AI影響度を合わせて確認してください。',
      ],
    },
    occupations: [
      {
        occupationId: 197,
        tag: 'hands-on-craft',
        reasonJa: '不具合の原因を実物から読み、工具と判断で直していく。',
      },
      {
        occupationId: 206,
        tag: 'systems-ops',
        reasonJa: '安全基準と機体の状態を照らし、細かな点検を積み上げる。',
      },
      {
        occupationId: 233,
        tag: 'systems-ops',
        reasonJa: '機械の動きと制御のずれを見つけ、現場の稼働を戻す。',
      },
      {
        occupationId: 260,
        tag: 'analysis',
        reasonJa: '壊さずに内部状態を調べるため、観察と判断の精度が問われる。',
      },
      {
        occupationId: 511,
        tag: 'field-response',
        reasonJa: '機体操作と現場判断を合わせ、空から必要な情報を集める。',
      },
      {
        occupationId: 533,
        tag: 'analysis',
        reasonJa: 'デジタル上の痕跡をたどるため、機械いじりに近い分解思考を使う。',
        surprising: true,
      },
      {
        occupationId: 584,
        tag: 'hands-on-craft',
        reasonJa: 'データと素材の条件を調整し、試作物を現物として仕上げる。',
      },
      {
        occupationId: 33,
        tag: 'field-response',
        reasonJa: '水中という制約の強い現場で、装備と手順を使って対応する。',
      },
    ],
  },
] as const satisfies readonly MbtiContent[];

export const PHASE1_MBTI_CONTENT: readonly MbtiContent[] = PHASE1_MBTI_CONTENT_SOURCE;

export const PHASE1_MBTI_SLUGS = PHASE1_MBTI_CONTENT.map((entry) => entry.slug);

const MBTI_CONTENT_BY_SLUG: Readonly<Record<Phase1MbtiSlug, MbtiContent>> =
  PHASE1_MBTI_CONTENT.reduce((acc, entry) => {
    acc[entry.slug] = entry;
    return acc;
  }, {} as Record<Phase1MbtiSlug, MbtiContent>);

export function isPhase1MbtiSlug(slug: string): slug is Phase1MbtiSlug {
  return Object.hasOwn(MBTI_CONTENT_BY_SLUG, slug);
}

export function getMbtiContentBySlug(slug: string): MbtiContent | null {
  return isPhase1MbtiSlug(slug) ? MBTI_CONTENT_BY_SLUG[slug] : null;
}
