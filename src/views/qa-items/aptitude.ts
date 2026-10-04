import type { QAItem } from '../qa-meta.js';

export const APTITUDE_ITEMS: ReadonlyArray<QAItem> = [
  // ── 適性 / 興味 (6) ──
  {
    slug: 'bunkei-osusume',
    question: '文系出身者向けの職業は？',
    short_answer: '人とコミュニケーションする職業や論理的思考を活かす分野。営業・販売・教育・士業・編集・コンサル等。',
    reasoning: '文系出身者の強みは (1) 言語表現力、(2) 文化・歴史的文脈の理解、(3) 対人スキル、(4) 論理的議論。これらを活かせるのは営業・コンサル・士業・編集・広告・教育・メディア系。理系職に比べ AI 影響 大の分野が含まれる傾向 (営業の一部、事務系等) があるため、AI を使いこなす側に立つ姿勢が重要。',
    selector: (d) => (d.sector?.id === 'shigyo' || d.sector?.id === 'hanbai' || d.sector?.id === 'service' || d.sector?.id === 'kyoiku' ? 1 : null),
    related_topics: ['ai-safe-interpersonal', 'hanbai-mirai'],
    og_eyebrow: 'Q&A · 文系',
  },
  {
    slug: 'rikei-osusume',
    question: '理系出身者向けの職業は？',
    short_answer: '研究・技術・データ分析を活かす分野。エンジニア・研究者・技師・医療技術職・データサイエンティスト等。',
    reasoning: '理系出身者の強みは (1) 数学的・論理的思考、(2) 実証データの扱い、(3) 専門技術知識。エンジニア (機械・電気・化学・建築・IT)・研究者・医師・薬剤師・データサイエンティスト・建築士などが代表的選択肢。IT 系は AI 影響度が高めですが、上流業務で AI を使いこなす側に立つことで優位性を保てます。',
    selector: (d) => (d.sector?.id === 'senmon' || d.sector?.id === 'it' || d.sector?.id === 'iryo' ? (d.stats?.salary_man_yen ?? 0) : null),
    related_topics: ['ai-frontier', 'investigative'],
    og_eyebrow: 'Q&A · 理系',
  },
  {
    slug: 'hito-mishiri-ok',
    question: '人見知りでもできる職業は？',
    short_answer: '一人で集中する作業が中心の職業。プログラマー・職人・研究者・データ分析・ライター・夜勤系等。',
    reasoning: '人見知りに向くのは (1) 一人で集中する作業時間が長い、(2) 対人緊張の場面が少ない、(3) コミュニケーションが書面・チャット中心の職業。プログラマー・職人・研究者・編集・ライター・夜勤の運転・警備等が該当。完全に対人ゼロは難しいが、「対人接触の質と量を選べる」職業を選ぶことで快適に働けます。',
    selector: (d) => (d.sector?.id === 'it' || d.sector?.id === 'seizo' || d.sector?.id === 'maint' ? -((d.ai_risk?.score ?? 0) * 100) : null),
    related_topics: ['investigative', 'realistic'],
    og_eyebrow: 'Q&A · 人見知り',
  },
  {
    slug: 'suugaku-nigate',
    question: '数学が苦手でもできる職業は？',
    short_answer: '言語・対人・身体技能が中心の職業。介護・保育・販売・接客・建設職人・芸術系等。',
    reasoning: '数学を要しない職業は身体的・対人的・芸術的領域に多い。介護福祉士・保育士・販売員・接客スタッフ・建設職人・美容師・調理師・クリエイター系などが該当。理系・金融系は数学を要するが、文系職や現場職は基礎的な計算能力で十分なことが多い。基礎を抑えれば数学的思考なしで活躍できる職業は多数あります。',
    selector: (d) => (d.sector?.id === 'fukushi' || d.sector?.id === 'service' || d.sector?.id === 'hanbai' || d.sector?.id === 'creative' ? 1 : null),
    related_topics: ['ai-safe-physical', 'social'],
    og_eyebrow: 'Q&A · 数学苦手',
  },
  {
    slug: 'eigo-ikasu',
    question: '英語が活きる職業は？',
    short_answer: '国際業務・翻訳・通訳・観光・外資系・研究・IT 上流職など。英語スキルが直接的に評価される分野。',
    reasoning: '英語スキルが直接価値になるのは (1) 翻訳・通訳、(2) 観光業 (インバウンド)、(3) 外資系企業、(4) 国際的研究・学術、(5) IT 系 (技術文書が英語)、(6) 商社・国際営業。生成 AI の翻訳精度が上がっているため、単純翻訳は AI 化が進む一方、ニュアンスや専門領域の理解が必要な業務は人間優位が続きます。',
    selector: (d) => {
      const title = d.title?.ja ?? '';
      if (title.includes('英語') || title.includes('翻訳') || title.includes('通訳') || title.includes('国際')) return 1;
      if (d.sector?.id === 'it' || d.sector?.id === 'creative') return (d.stats?.salary_man_yen ?? 0);
      return null;
    },
    related_topics: ['investigative', 'ai-frontier'],
    og_eyebrow: 'Q&A · 英語',
  },
  {
    slug: 'geijutsu-keikei',
    question: '美術・芸術系の職業は？',
    short_answer: 'クリエイティブ・メディアセクター中心。デザイナー・イラストレーター・写真家・調理師・芸能・音楽系等。',
    reasoning: '美術・芸術系職業は生成 AI の影響を直接的に受けつつあります。画像生成 AI で定型的なデザインは AI 化される一方、独自のスタイル・世界観・物理的工程 (撮影・調理) は人間優位が続く。AI ツールを使いこなすクリエイターとして自分の独自性を出すことが今後の方向性。完全 AI 化される領域と人間が必要な領域の分岐点を見極めることが重要。',
    selector: (d) => (d.sector?.id === 'creative' ? 1 : null),
    related_topics: ['artistic', 'ai-augmented'],
    og_eyebrow: 'Q&A · 芸術',
  },

];
