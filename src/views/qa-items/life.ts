import type { QAItem } from '../qa-meta.js';

export const LIFE_ITEMS: ReadonlyArray<QAItem> = [
  // ── ライフ条件 (6) ──
  {
    slug: 'ikuji-ryouritsu',
    question: '育児と両立しやすい職業は？',
    short_answer: '労働時間が短く、シフト柔軟性のある職業。保育士・看護師パート・事務系時短・在宅可能な IT 系等。',
    reasoning: '育児両立の鍵は (1) 労働時間 (月 150 時間以下が目安)、(2) 急な早退・休みへの対応、(3) 保育園との時間調整、(4) 学校行事への参加可能性。看護師パートや病棟以外の医療職、保育士、事務系時短勤務、リモート可能な IT 系等が現実的。一方、給与は時間に比例するため経済面の調整も必要。',
    selector: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 165) return null;
      return -hours;
    },
    related_topics: ['child-care-balance', 'shufu-fukki'],
    og_eyebrow: 'Q&A · 育児両立',
  },
  {
    slug: 'kaigo-ryouritsu',
    question: '介護と両立しやすい職業は？',
    short_answer: 'リモート可能・時間融通・有給取得しやすい職業。IT 系・専門職 (士業)・公務員系 + 短時間勤務枠等。',
    reasoning: '親の介護は突発的な対応が必要なため、(1) リモートワーク可能、(2) 急な休みに対応できる組織、(3) フルタイムだが時間裁量が大きい、の 3 条件が重要。IT エンジニア・士業・コンサル・公務員等が比較的対応しやすい。製造現場・接客系は時間拘束が強く介護両立が難しい場合が多い。',
    selector: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 170) return null;
      return -hours;
    },
    related_topics: ['elderly-care-balance', 'over-50-katsuyaku'],
    og_eyebrow: 'Q&A · 介護両立',
  },
  {
    slug: 'female-long',
    question: '女性が長く続けられる職業は？',
    short_answer: '産休・育休制度 + 復帰支援が整備された分野 + ライフイベント対応がしやすい分野。医療・教育・公務員・大企業職等。',
    reasoning: 'ライフイベント (出産・育児・介護) を経て長く続けやすい職業の条件は、(1) 制度が整備された業界、(2) 同じ立場の女性同僚が多い、(3) 短時間勤務・時短勤務の選択肢、(4) ブランクからの復帰を支援する仕組み。看護師・保育士・教師・公務員・大企業総合職などが該当。男女比率の偏りも参考に。',
    selector: (d) => {
      const ai = d.ai_risk?.score ?? 99;
      if (ai > 5) return null;
      return -ai * 100;
    },
    related_topics: ['ikuji-ryouritsu', 'shufu-fukki'],
    og_eyebrow: 'Q&A · 女性',
  },
  {
    slug: 'zaitaku-shigoto',
    question: '在宅でできる職業は？',
    short_answer: 'IT エンジニア・WEB デザイナー・ライター・コンサル・士業の一部・コールセンターなど、PC で完結する業務中心の職業。',
    reasoning: '在宅 (リモートワーク) 可能性は職業ごとに大きく差があります。IT 系・クリエイティブ系・士業 (一部) は 100% リモートも可能。営業・コンサルは部分リモート。看護・介護・建設・運輸など現場必要型は在宅困難。在宅志向なら職業選択時に「主たる業務が PC で完結するか」を確認することが重要。',
    selector: (d) => (d.sector?.id === 'it' || d.sector?.id === 'creative' || d.sector?.id === 'shigyo' ? 1 : null),
    related_topics: ['ai-frontier', 'freelance-friendly'],
    og_eyebrow: 'Q&A · 在宅',
  },
  {
    slug: 'fukugyou-ok',
    question: '副業可能な職業は？',
    short_answer: 'フリーランス比率が高い分野 + 専門スキルが個人で完結する職業。IT・クリエイティブ・士業・教育系等。',
    reasoning: '副業可能性は (1) 本業の就業規則、(2) 個人で完結するスキル、(3) 副業相手 (クライアント) の存在、で決まります。IT エンジニア・WEB デザイナー・ライター・士業系 (一部)・教育系 (個別指導) などは副業との親和性が高い。一方、製造業・公務員・金融など本業規則が厳しい分野は注意が必要。',
    selector: (d) => {
      const et = d.employment_type;
      if (!et) return null;
      const free = et['self_employed_freelance'] ?? 0;
      return free >= 0.1 ? free : null;
    },
    related_topics: ['freelance-friendly', 'self-employed-typical'],
    og_eyebrow: 'Q&A · 副業',
  },
  {
    slug: 'shougai-mochi-ok',
    question: '持病があっても続けられる職業は？',
    short_answer: '体力負荷が低く、シフト柔軟性のある職業。事務職 (時短)・専門職・在宅可能職・IT 系等。持病の種類により向き不向きあり。',
    reasoning: '持病を持つ方が長く続けられる職業は、(1) 体力負荷が低い (デスクワーク中心)、(2) 通院・休養日が確保できる勤務形態、(3) 在宅勤務可能、(4) シフト交代が柔軟、の条件で考えると見つけやすい。IT エンジニア・ライター・事務職 (一部)・コンサル・士業の一部などが該当。一方、夜勤・現場系は体調管理が難しい場合が多い。',
    selector: (d) => {
      const hours = d.stats?.monthly_hours;
      if (!hours || hours > 165) return null;
      return -hours;
    },
    related_topics: ['health-friendly', 'mental-health-friendly'],
    og_eyebrow: 'Q&A · 持病',
  },

];
