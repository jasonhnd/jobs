import type { QAItem } from '../qa-meta.js';

export const SECTOR_FUTURE_ITEMS: ReadonlyArray<QAItem> = [
  // ── 業種別未来 (6) ──
  {
    slug: 'kango-ai',
    question: '看護師は AI に置き換わる？',
    short_answer: '看護師の AI 影響度は 4/10。診療補助・記録は AI で効率化されるが、患者ケア・観察判断・処置の手技は AI 代替が困難。需要も高齢化で拡大。',
    reasoning: '看護師の業務は (1) 患者の状態観察と判断、(2) 医療処置の手技、(3) 患者・家族とのコミュニケーション、(4) 記録と申し送り、の 4 つに大別。このうち (4) は AI 化が大きく進みますが、(1)-(3) は身体的・対人的要素が中核で AI 代替困難。少子高齢化で需要は拡大継続見込み。長期的に安定したキャリアの代表格。',
    selector: (d) => (d.title?.ja?.includes('看護') ? 1 : null),
    related_topics: ['hito-aite-shigoto', 'iryo-jimu-vs-ippan-jimu'],
    og_eyebrow: 'Q&A · 看護師',
  },
  {
    slug: 'it-engineer-ai',
    question: 'IT エンジニアは AI で変わるか？',
    short_answer: 'AI コーディングで業務生産性が大きく上がる。下流のコーディング作業の AI 化が進む一方、上流設計・アーキテクチャ・意思決定は人間の役割として残る。',
    reasoning: 'IT・通信セクターの AI 影響度は全業種で最高 (平均 8.14/10)。AI コーディングで定型実装は AI が担うようになり、人間は要件定義・設計・コードレビュー・複雑な判断にシフト。上流職 (アーキテクト・テックリード) ほど安全度が高く、下流職 (実装中心) ほど影響を受けやすい。「AI を使いこなす側」に立つことが重要。',
    selector: (d) => (d.sector?.id === 'it' ? (d.ai_risk?.score ?? 0) * 100 + (d.stats?.salary_man_yen ?? 0) : null),
    related_topics: ['ai-frontier', 'ai-augment-vs-replace'],
    og_eyebrow: 'Q&A · IT',
  },
  {
    slug: 'jimu-mirai',
    question: '事務系は本当に消えるのか？',
    short_answer: '一般事務・経理・受付など PC で完結する定型業務は AI 化が顕著。職業自体は残るが、業務内訳が「判断・例外処理」に再編される。',
    reasoning: '事務・公務セクターは AI 影響度平均 7.53/10 (全業種で 2 番目に高い)。同時に労働力人口に占める割合も最大。職業が「消える」のではなく「業務内訳が再設計される」過程と理解すべき。AI が実行する定型業務と、人が担う判断・関係調整・例外処理が分業化される。担当者は AI 出力の評価・編集スキルが必要に。',
    selector: (d) => (d.sector?.id === 'jimu' ? (d.ai_risk?.score ?? 0) * 100 : null),
    related_topics: ['ai-de-kieru', 'iryo-jimu-vs-ippan-jimu'],
    og_eyebrow: 'Q&A · 事務系',
  },
  {
    slug: 'hanbai-mirai',
    question: '販売職の未来は？',
    short_answer: 'EC・セルフレジで定型販売は AI 化が進む一方、専門販売・対面接客・営業職は AI 代替が難しく価値が高まる。二極化が進行。',
    reasoning: 'スーパー・コンビニのレジは AI 化が進む一方、化粧品カウンセリング・宝飾品販売・住宅営業など専門販売は対面接客の価値が際立つ。EC は商品データ自動生成等で部分自動化される。販売職全体としては「定型販売」と「専門販売・営業」の二極化が進み、後者の市場価値が相対的に高まります。',
    selector: (d) => (d.sector?.id === 'hanbai' ? (d.ai_risk?.score ?? 0) : null),
    related_topics: ['ai-safe-interpersonal', 'hanbai-mirai'],
    og_eyebrow: 'Q&A · 販売',
  },
  {
    slug: 'driver-mirai',
    question: 'ドライバー職は自動運転で消える？',
    short_answer: '高速道路の長距離輸送は自動運転 AI で 2030 年代に部分代替が見込まれるが、市街地・配達・タクシーの完全代替は時間軸が長い。',
    reasoning: 'トラック運転手の AI 影響度は中程度。高速道路の定速走行は自動化が現実的だが、市街地での例外対応・配達先での荷下ろし・タクシーの接客は人間優位が続きます。完全自動化までの過渡期では「人 + AI」の体制が長く続く見込み。代替されるのは「運転」部分で、関連業務 (顧客対応・配車調整・整備) は残ります。',
    selector: (d) => (d.title?.ja?.includes('運転') || d.title?.ja?.includes('ドライバー') ? 1 : null),
    related_topics: ['truck-vs-taxi', 'ai-resistant-craft'],
    og_eyebrow: 'Q&A · ドライバー',
  },
  {
    slug: 'kyouiku-ai',
    question: '教師は AI で代替される？',
    short_answer: '個別学習・採点・教材生成は AI で効率化されるが、生徒のモチベーション喚起・社会性育成・複雑な状況判断は教師の役割として残る。',
    reasoning: '教育系の AI 影響度は中程度。AI による個別最適化学習は強力なツールになりますが、生徒の感情ケア・問題行動への対応・保護者対応・チーム指導など教師の本質的役割は AI 代替困難。特に保育士・幼稚園教諭は AI 影響度が低く、対人スキルが本質。学校教師は AI ツールを使いこなしつつ、人としての関わりに注力する役割にシフト。',
    selector: (d) => (d.sector?.id === 'kyoiku' ? 1 : null),
    related_topics: ['hito-aite-shigoto', 'kyoshi-vs-hoikushi'],
    og_eyebrow: 'Q&A · 教師',
  },

];
