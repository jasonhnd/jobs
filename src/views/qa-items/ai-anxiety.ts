import type { QAItem } from '../qa-meta.js';
import { lowAi, highAi, lowAiSector } from './predicates.js';
import { CONSENSUS_FAQ_SENTENCE } from '../../site/consensus-copy.js';
import { displayScore } from '../../data/lib/banker-round.js';

export const AI_ANXIETY_ITEMS: ReadonlyArray<QAItem> = [
  // ── AI 不安系 (8) ──
  {
    slug: 'ai-de-kienai',
    question: 'AI でなくならない仕事は？',
    short_answer: '身体性・対人スキル・現場判断を要する仕事は AI で代替されにくく、長期的に残る可能性が高い。看護師・建設職人・介護福祉士・保育士・消防士などが代表例。',
    reasoning: `AI が苦手とするのは、(1) 物理的な世界での即興的判断 (建設現場・救急処置)、(2) 人間の感情を読み取り信頼関係を築く対人スキル (看護・介護・保育)、(3) 例外的な状況への適応 (緊急救急)。これらが業務の中核になっている職業ほど AI 影響度が低くなる傾向にあります。${CONSENSUS_FAQ_SENTENCE}職業選択の参考情報の一つとしてご活用ください。`,
    selector: lowAi,
    related_topics: ['ai-de-kieru', 'shokunin-mirai', 'hito-aite-shigoto'],
    og_eyebrow: 'Q&A · AI で残る仕事',
  },
  {
    slug: 'ai-de-kieru',
    question: 'AI で消える可能性が高い職業は？',
    short_answer: 'PC で完結するルーティンの事務処理・データ入力・レセプト処理などは AI 影響度が高く、業務再設計が見込まれる。一般事務・データ入力・経理事務員等。',
    reasoning: 'AI 影響度 8 以上の職業は、業務の大部分が AI で完結可能と評価されています。「職業自体が消える」というより「業務内訳が変わる」が現実的予測。担当者は AI 出力の評価・編集・例外対応にシフトし、定型業務は自動化される構造変化が進行します。再就職よりも職場での再設計が現実的選択。',
    selector: highAi,
    related_topics: ['ai-de-kienai', 'jimu-mirai', 'ai-augment-vs-replace'],
    og_eyebrow: 'Q&A · AI で消える',
  },
  {
    slug: 'ai-augment-vs-replace',
    question: 'AI 補強 vs 置き換え、何が違う？',
    short_answer: 'AI 補強 = 業務生産性が AI で向上する。AI 置き換え = 業務の大部分が AI で完結する。前者は AI 影響度 4-6、後者は 7+ で評価。',
    reasoning: 'AI 補強職業 (AI 影響度 4-6) は、AI ツールを使いこなすことで生産性が大きく上がる。業務の本質は人が担い、AI は付加部分を担当。一方、AI 置き換え職業 (7+) は業務の中核が AI で実行可能で、人の役割が「監督」にシフトする。どちらに該当するかでキャリア戦略が変わります。',
    selector: (d) => {
      const ai = d.ai_risk?.score;
      if (ai === null || ai === undefined) return null;
      if (displayScore(ai) < 4 || displayScore(ai) > 6) return null;
      return -Math.abs(ai - 5) * 100 + (d.stats?.salary_man_yen ?? 0);
    },
    related_topics: ['ai-de-kienai', 'ai-de-kieru', 'ai-jidai-osusume'],
    og_eyebrow: 'Q&A · 補強 vs 置換',
  },
  {
    slug: 'shikaku-mamoru',
    question: '国家資格は AI から守ってくれるか？',
    short_answer: '法律で「資格保有者しかできない」と定められた業務独占資格は AI 代替を防ぐ強い参入のかべになる。ただし業務内訳の AI 化は別途進行する。',
    reasoning: '医師・看護師・薬剤師・弁護士など業務独占資格を要する職業は、法的に AI が直接代替することができません。これは強力な参入のかべです。一方、業務の中身 (リサーチ・書類作成・診断補助等) は AI で大幅に効率化されます。「資格があれば安心」ではなく「資格 + AI を使いこなすスキル」が今後の優位性になります。',
    selector: (d) => {
      const certs = (d.related_certs_ja ?? []).length;
      const ai = d.ai_risk?.score ?? 99;
      if (certs < 1 || displayScore(ai) > 5) return null;
      return certs * 1000 - ai * 100;
    },
    related_topics: ['license-required', 'ai-de-kienai'],
    og_eyebrow: 'Q&A · 資格と AI',
  },
  {
    slug: 'genba-vs-jimu',
    question: '現場 vs 事務、どっち AI 安全？',
    short_answer: '現場系 (建設・製造・運輸・サービス) の方が AI 影響度が低い傾向。事務系は PC で完結するため AI 化が進みやすい。',
    reasoning: '現場系の職業は身体的作業・即興判断・対面対応が業務の核心で、AI で代替しにくい構造を持ちます。一方、事務系は書類作成・データ処理・記録などが PC で完結する場合が多く、AI 化との親和性が高い。ただし現場系は体力的負荷・労働時間長・安全リスク等の課題もあり、AI 安全性だけで判断すべきではありません。',
    selector: (d) => lowAiSector(d, ['kensetu', 'seizo', 'maint', 'noringyo', 'service']),
    related_topics: ['ai-de-kienai', 'jimu-mirai'],
    og_eyebrow: 'Q&A · 現場 vs 事務',
  },
  {
    slug: 'shokunin-mirai',
    question: '職人技は AI 時代も価値があるか？',
    short_answer: '伝統技能・手技・現場判断を伴う職人系は AI 代替が困難で、需要は継続。後継者不足が続くため、若手参入のチャンスでもある。',
    reasoning: '職人技の本質は、長年の経験で培われる手の感覚・素材判断・即興的調整であり、これらは AI に学習させることが難しい (デジタル化されたデータがないため)。少子高齢化で職人の高齢化が進む中、若手参入は需要側に強く歓迎されています。独立後の収益上限も大きいのが特徴。',
    selector: (d) => lowAiSector(d, ['seizo', 'kensetu', 'maint', 'keiseki']),
    related_topics: ['ai-resistant-craft', 'ai-de-kienai'],
    og_eyebrow: 'Q&A · 職人',
  },
  {
    slug: 'hito-aite-shigoto',
    question: '人を相手にする仕事は AI 時代に強い？',
    short_answer: '対人スキルは AI で代替されにくい本質的な人間優位領域。看護・介護・教育・販売・サービス系は AI 影響度が低い。',
    reasoning: '感情の機微を読み取る・信頼関係を築く・即興的に対応する対人スキルは、現状の AI で十分代替できないと評価されています。本サイトの AI 影響度評価でも、対人を中核とする職業 (看護師 4/10、保育士 3/10、介護福祉士 2/10 等) が低スコア群に集まっています。一方、感情労働の負荷が大きい点は別途考慮が必要。',
    selector: (d) => lowAiSector(d, ['iryo', 'fukushi', 'kyoiku', 'hanbai', 'service']),
    related_topics: ['ai-safe-interpersonal', 'kango-ai'],
    og_eyebrow: 'Q&A · 対人',
  },
  {
    slug: 'ai-jidai-osusume',
    question: 'AI 時代におすすめの仕事は？',
    short_answer: '低 AI 影響度 (3 以下) かつ需要が安定しているか拡大中の職業がおすすめ。介護・建設・医療系 + AI を使いこなす上流 IT 職。',
    reasoning: '「AI 時代におすすめ」は (1) AI で代替されにくい身体性・対人系、または (2) AI を使いこなす側に立つ高度知的業務の二極化方向で考えると整理しやすい。前者は介護福祉士・看護師・建設職人等。後者は AI エンジニア・データサイエンティスト・上流 SE 等。中間層の事務系は再設計が必要な分野です。',
    selector: lowAi,
    related_topics: ['ai-de-kienai', 'ai-frontier'],
    og_eyebrow: 'Q&A · おすすめ',
  },

];
