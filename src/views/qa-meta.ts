/**
 * src/views/qa-meta.ts — 49 Q&A hub の質問・回答・例選定ロジック。
 *
 * 各 Q&A は:
 *   - question: h1 になる質問
 *   - short_answer: 150 字のリード回答
 *   - reasoning: 300-500 字の根拠展開
 *   - selector: 該当例を選ぶ predicate
 * から成る。
 *
 * Migrated from src/data/lib/qa-meta.ts 2026-05-14 (Phase B).
 * Lives under src/views/ per §6.2.
 *
 * Pure-data モジュール。
 */
import type { DetailFileMin } from './genre-hub.js';
import { SCORE_ATTRIBUTION } from '../site/score-attribution.js';

export interface QAItem {
  slug: string;
  question: string;
  short_answer: string;
  reasoning: string;
  /** Predicate that returns sort score, or null to exclude */
  selector: (d: DetailFileMin) => number | null;
  related_topics: ReadonlyArray<string>;
  og_eyebrow: string;
}

// Helper predicates
const lowAi = (d: DetailFileMin) => {
  const ai = d.ai_risk?.score;
  if (ai === null || ai === undefined || ai > 4) return null;
  return -ai * 1000 + (d.stats?.workers ?? 0) / 1000;
};
const highAi = (d: DetailFileMin) => {
  const ai = d.ai_risk?.score;
  if (ai === null || ai === undefined || ai < 7) return null;
  return ai * 1000 + (d.stats?.workers ?? 0) / 1000;
};
const lowAiSector = (d: DetailFileMin, sectors: string[]) => {
  if (!sectors.includes(d.sector?.id ?? '')) return null;
  return lowAi(d);
};

export const QA_ITEMS: ReadonlyArray<QAItem> = [
  // ── AI 不安系 (8) ──
  {
    slug: 'ai-de-kienai',
    question: 'AI でなくならない仕事は？',
    short_answer: '身体性・対人スキル・現場判断を要する仕事は AI で代替されにくく、長期的に残る可能性が高い。看護師・建設職人・介護福祉士・保育士・消防士などが代表例。',
    reasoning: `AI が苦手とするのは、(1) 物理的な世界での即興的判断 (建設現場・救急処置)、(2) 人間の感情を読み取り信頼関係を築く対人スキル (看護・介護・保育)、(3) 例外的な状況への適応 (緊急救急)。これらが業務の中核になっている職業ほど AI 影響度が低くなる傾向にあります。本サイトの AI 影響度は ${SCORE_ATTRIBUTION.modelDisplay} による独自分析 (非公式) で、職業選択の参考情報の一つとしてご活用ください。`,
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
      if (ai < 4 || ai > 6) return null;
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
      if (certs < 1 || ai > 5) return null;
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
  // ── キャリア相談 (9) ──
  {
    slug: 'shinso-osusume',
    question: '新卒におすすめの職業は？',
    short_answer: '長期的に安定し AI に強い分野 (医療・福祉・建設) または AI を使いこなす側 (上流 IT) が新卒向け。専門教育投資のリターンが大きい。',
    reasoning: '新卒は長期キャリア形成の起点なので、20-30 年スパンで考えるべきです。AI 影響度の低い分野 (看護・介護・建設職人等) は需要が継続的に拡大見込み。一方、IT 系は「使いこなす側」に立つことで影響を受けない。最も避けたいのは AI 影響 大 + 専門性が育ちにくい中間層業務。資格や専門性で参入のかべを作れる分野を選ぶことを推奨。',
    selector: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score ?? 99;
      if (!age || age > 35 || ai > 5) return null;
      return -age * 100;
    },
    related_topics: ['shinsotsu', 'ai-jidai-osusume'],
    og_eyebrow: 'Q&A · 新卒',
  },
  {
    slug: 'tenshoku-30s',
    question: '30 代の転職、何が現実的？',
    short_answer: 'これまでの専門性 + マネジメント素地が評価される時期。完全未経験より、関連分野への横展開や上位職へのステップアップが現実的。',
    reasoning: '30 代の転職は即戦力評価で年収アップが期待できますが、業界をまたぐ完全な異業種転職は難度が高くなります。同業界での専門性深化 (上流職への移動) や、関連分野での横展開 (経理→ファイナンス、SE→PM 等) が成功率高い。30 代後半は転職回数も気にされるため、次の転職が「最後」になる前提で慎重に選択。',
    selector: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score ?? 99;
      if (!age || age < 30 || age > 45 || ai > 5) return null;
      return d.stats?.salary_man_yen ?? 0;
    },
    related_topics: ['30s-early', '30s-late'],
    og_eyebrow: 'Q&A · 30代転職',
  },
  {
    slug: 'tenshoku-40s',
    question: '40 代の転職、AI を考慮してどう選ぶ？',
    short_answer: '体力面と AI 影響度を両軸で評価。低 AI + 専門性蓄積分野 (士業・建設管理・医療系・指導職) が 40 代後半まで現実的選択肢。',
    reasoning: '40 代の転職は、(1) 蓄積した専門性で評価される分野、(2) 60 代まで続けられる業務、(3) AI 化が進みにくい本質的価値を出せる分野、を重視すべき。具体的には士業 (弁護士・公認会計士)・建設管理・専門医・指導職等。AI 影響 大の事務系から低 AI の対人・現場系への横展開も選択肢ですが、年収が下がるのを受け入れる場面が多い。',
    selector: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score ?? 99;
      if (!age || age < 40 || age > 55 || ai > 4) return null;
      return d.stats?.salary_man_yen ?? 0;
    },
    related_topics: ['40s', '50s'],
    og_eyebrow: 'Q&A · 40代転職',
  },
  {
    slug: 'over-50-katsuyaku',
    question: '50 代以上で活躍できる職業は？',
    short_answer: '経験・人脈・指導力が評価される分野。コンサルタント・専門医・士業・職人指導・公務員・シニア向け再就職分野等。',
    reasoning: '50 代以降は (1) 蓄積した専門性 + 人脈をフル活用、(2) 体力的に持続可能、(3) AI 影響度が低い分野が現実的。コンサルタント・士業・指導職 (技能継承)・公務員 + 退職後の継続雇用・シニア向け再就職 (清掃・警備・教育補助等) が代表的選択肢。「経験は AI で代替されない」ことを軸に選択。',
    selector: (d) => {
      const age = d.stats?.average_age;
      const ai = d.ai_risk?.score ?? 99;
      if (!age || age < 45 || ai > 4) return null;
      return age;
    },
    related_topics: ['50s', '60s-shinia'],
    og_eyebrow: 'Q&A · シニア',
  },
  {
    slug: 'tenshoku-yasashii',
    question: '他業種から転職しやすい職業は？',
    short_answer: '人手不足分野 (介護・建設・運輸・IT) は中途歓迎。資格不要で始められる職業や、未経験者を育てる仕組みがある分野が現実的。',
    reasoning: '転職難度は (1) 業界の人手不足度、(2) 入職時の必要資格・経験、(3) 中途採用の体制、で決まります。介護福祉・建設職人・運輸・IT 系は人手不足が顕著で中途歓迎。資格は働きながら取得可能な分野も多い。一方、士業・専門医など資格・年限が厳格な分野は中途参入が困難。長期的なキャリア設計と短期収入の両立で選択。',
    selector: (d) => {
      const ai = d.ai_risk?.score ?? 99;
      const recruit = d.stats?.recruit_ratio ?? 0;
      if (ai > 5 || recruit < 1.5) return null;
      return recruit;
    },
    related_topics: ['career-change', 'ai-safe-high-demand'],
    og_eyebrow: 'Q&A · 転職しやすい',
  },
  {
    slug: 'career-change-mirai',
    question: 'キャリアチェンジに向く職業は？',
    short_answer: '人手不足 + AI 安全 + 資格不要 (もしくは短期取得可能) の交差点が現実的。介護・建設・運輸・対人サービス系。',
    reasoning: '異業種からのキャリアチェンジでは、(1) 異分野経験を活かせる、(2) 入職ハードルが低い、(3) 長期需要が見込まれる、の 3 条件が現実的選択軸。介護・建設・運輸・対人サービスは未経験参入のルートが整備されており、長期需要も強い。年収面の一時的ダウンは避けにくいが、5 年スパンで見れば安定するケースが多い。',
    selector: (d) => {
      const ai = d.ai_risk?.score ?? 99;
      const certs = (d.related_certs_ja ?? []).length;
      if (ai > 5 || certs > 2) return null;
      return -ai * 100;
    },
    related_topics: ['career-change', 'tenshoku-yasashii'],
    og_eyebrow: 'Q&A · キャリアチェンジ',
  },
  {
    slug: 'blank-fukki',
    question: 'ブランクから復帰しやすい職業は？',
    short_answer: '業界全体が人手不足な分野 + 資格が一度取れば失効しない分野。看護・保育・介護・事務系 (短時間勤務枠) 等。',
    reasoning: '出産・育児・介護でブランクが空いた人に向く職業は、(1) 業界全体が人手不足、(2) 短時間勤務枠が整備されている、(3) 取得済資格を活かせる、の 3 条件が現実的。看護師・保育士・介護福祉士は復職支援研修も整備されている。事務系は短時間パート枠が多いが、AI 化進行で再設計を意識する必要あり。',
    selector: (d) => {
      const ai = d.ai_risk?.score ?? 99;
      const recruit = d.stats?.recruit_ratio ?? 0;
      if (ai > 5 || recruit < 1.2) return null;
      return recruit * (d.related_certs_ja ?? []).length;
    },
    related_topics: ['shufu-fukki', 'ai-safe-high-demand'],
    og_eyebrow: 'Q&A · 復帰',
  },
  {
    slug: 'hoshou-nashi-tenshoku',
    question: '経済的余裕がない状態で転職するなら？',
    short_answer: '即収入が必要な状況では人手不足分野 + 短期間で就職決定可能な業界 (介護・運輸・サービス) が現実的。',
    reasoning: '失業中で経済的余裕がない場合、長期準備型の士業や専門資格より、(1) 採用決定が早い、(2) 未経験 OK、(3) 入職後すぐ働ける、分野が必要。介護・タクシー・配送・警備・清掃などは入職決定が早く、初任給は低めだが収入は早期確保できます。同時並行で長期的なキャリア再設計も検討。',
    selector: (d) => {
      const recruit = d.stats?.recruit_ratio ?? 0;
      const certs = (d.related_certs_ja ?? []).length;
      if (recruit < 1.5 || certs > 1) return null;
      return recruit;
    },
    related_topics: ['ai-safe-high-demand', 'tenshoku-yasashii'],
    og_eyebrow: 'Q&A · 緊急転職',
  },
  {
    slug: 'tenshoku-kaisuu-ooi',
    question: '転職回数が多くても OK な職業は？',
    short_answer: '人手不足分野 + 業界全体で中途中心の分野 (建設・介護・IT・営業) は転職回数の影響が小さい。',
    reasoning: '伝統的に終身雇用前提の大企業では転職回数が嫌われますが、人手不足分野や中途中心の業界では実質的に問題になりにくい。建設業界・介護業界・IT 業界・営業職などは転職そのものが標準的キャリアパスの一部。「なぜ転職したか」を語れることの方が重要で、回数自体は二次的問題。',
    selector: (d) => {
      const ai = d.ai_risk?.score ?? 99;
      const recruit = d.stats?.recruit_ratio ?? 0;
      if (recruit < 1.2 || ai > 6) return null;
      return recruit;
    },
    related_topics: ['career-change', 'tenshoku-yasashii'],
    og_eyebrow: 'Q&A · 転職回数',
  },
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
  // ── 適性 / 興味 追加 (4) ──
  {
    slug: 'naiko-osusume',
    question: '内向型 (HSP) に向く職業は？',
    short_answer: '一人で深く集中する作業が中心の職業。研究者・エンジニア・職人・編集・ライター・データ分析等。',
    reasoning: '内向型・HSP 気質の人は、刺激の多い環境で消耗しやすく、深い集中と内省が得意。これを活かせるのは (1) 一人作業時間が長い、(2) 静かな環境、(3) 緻密な作業、(4) 書面コミュニケーション中心の職業。研究者・プログラマー・職人・編集・図書館司書・データ分析職などが該当。完全に対人ゼロは難しいが、対人接触の量と質を選べる職業を選ぶことで快適に働けます。',
    selector: (d) => {
      const sid = d.sector?.id ?? '';
      if (!['it', 'seizo', 'maint', 'senmon', 'creative'].includes(sid)) return null;
      const ai = d.ai_risk?.score ?? 99;
      return -ai * 100;
    },
    related_topics: ['hito-mishiri-ok', 'investigative'],
    og_eyebrow: 'Q&A · 内向型',
  },
  {
    slug: 'gaiko-osusume',
    question: '外向型に向く職業は？',
    short_answer: '人と話すこと・チームを動かすことから活力を得る職業。営業・接客・販売・教師・カウンセラー・経営者等。',
    reasoning: '外向型は対人接触からエネルギーを得る性格傾向で、(1) チームで動く、(2) 顧客と頻繁に会う、(3) 人前で話す、(4) 関係構築が成果に直結する職業に向きます。営業・販売・接客・サービス・教育・人事・経営層・コンサル等が代表的選択肢。AI 時代でも「対人スキル」は人間優位の核心領域なので、長期的にも安定。一方、感情労働への耐性も別途必要。',
    selector: (d) => {
      const sid = d.sector?.id ?? '';
      if (!['hanbai', 'service', 'kyoiku', 'shigyo'].includes(sid)) return null;
      const ai = d.ai_risk?.score ?? 99;
      if (ai > 6) return null;
      return -ai * 100 + (d.stats?.salary_man_yen ?? 0) / 100;
    },
    related_topics: ['social', 'enterprising'],
    og_eyebrow: 'Q&A · 外向型',
  },
  {
    slug: 'kanjou-roudou-sukunai',
    question: '感情労働が少ない職業は？',
    short_answer: '対人接客中心ではない職業。製造・整備・建設・農林・物流系、業務対象が「物」や「自然」中心の分野。',
    reasoning: '感情労働とは「業務上、自分の感情を管理して提示することを求められる労働」で、対人接客職に多い。長期的にバーンアウトを招きやすいのが課題。これを避けたい場合、業務対象が「物」(製造・整備・建設)、「自然」(農林水産) 中心の職業を選ぶと感情労働の比重が下がる。IT・士業はクライアント対応で感情労働が一定残るため別カテゴリ。完全ゼロは難しいが、比率の調整は可能。',
    selector: (d) => {
      const sid = d.sector?.id ?? '';
      if (!['seizo', 'maint', 'kensetu', 'noringyo'].includes(sid)) return null;
      const ai = d.ai_risk?.score ?? 99;
      return -ai * 100;
    },
    related_topics: ['mental-health-friendly', 'hito-mishiri-ok'],
    og_eyebrow: 'Q&A · 感情労働',
  },
  {
    slug: 'ronri-shiko-ikasu',
    question: '論理的思考が活きる職業は？',
    short_answer: 'ルール体系から答えを導き、矛盾を発見する力が業務の核心となる職業。士業・エンジニア・研究者・コンサル・診断医等。',
    reasoning: '論理的思考が直接的な価値となるのは、(1) 複雑な前提から結論を導く (士業・コンサル・研究)、(2) システムの一貫性を保つ (エンジニア・建築士)、(3) 不整合を発見する (会計士・監査・品質管理)、(4) 仮説検証 (医師・データ分析) の業務。AI が論理処理を補強する時代になっても「前提設定」「枠組み構築」は人間の役割として残ります。',
    selector: (d) => {
      const sid = d.sector?.id ?? '';
      if (!['shigyo', 'it', 'senmon'].includes(sid)) return null;
      return d.stats?.salary_man_yen ?? 0;
    },
    related_topics: ['investigative', 'deductive-reasoning'],
    og_eyebrow: 'Q&A · 論理思考',
  },
  // ── ライフ条件 追加 (3) ──
  {
    slug: 'tsuukin-friendly',
    question: '通勤負担が軽い職業は？',
    short_answer: '在宅勤務可・近隣勤務型・直行直帰型の職業。IT 系・士業・営業・地域密着サービス・自営業等。',
    reasoning: '通勤負担が軽い職業は、(1) 在宅勤務が可能 (IT・コンサル・士業)、(2) 直行直帰が一般的 (営業・配達・訪問介護)、(3) 地域密着で自宅近隣勤務 (店舗系・建設職人・農業) の 3 タイプ。長時間通勤は健康・QOL を損ねるため、職業選択時に「主な勤務場所」を確認することが重要。リモート可能性は今後さらに二極化が進む見込み。',
    selector: (d) => {
      const sid = d.sector?.id ?? '';
      if (!['it', 'shigyo', 'creative', 'noringyo'].includes(sid)) return null;
      // Rank by salary (higher quality remote-friendly jobs first), then by
      // workforce size as tie-breaker so the listing isn't arbitrary.
      return (d.stats?.salary_man_yen ?? 0) + (d.stats?.workers ?? 0) / 100000;
    },
    related_topics: ['zaitaku-shigoto', 'freelance-friendly'],
    og_eyebrow: 'Q&A · 通勤',
  },
  {
    slug: 'yakin-nashi',
    question: '夜勤がない職業は？',
    short_answer: 'デイタイム勤務中心の職業。事務系・営業・士業・IT・教育・小売 (一部) など、24h 体制ではない分野。',
    reasoning: '夜勤は健康リスクが高いため、避けたい人は多い。夜勤がない職業は (1) 事務・公務・士業 (基本的に日勤)、(2) 教育・保育 (午前-夕方)、(3) IT 系 (障害対応の当番除く)、(4) 製造業の日勤工場、(5) 小売の日勤専従。一方、看護師・警察官・消防士・運輸・コンビニ・ホテル等は夜勤が業務に組み込まれています。家族の時間を優先する場合の重要な選択基準。',
    selector: (d) => {
      const sid = d.sector?.id ?? '';
      if (!['shigyo', 'it', 'kyoiku', 'senmon'].includes(sid)) return null;
      // Rank by workforce size — surface the largest "no-night-shift" jobs.
      return d.stats?.workers ?? 0;
    },
    related_topics: ['ikuji-ryouritsu', 'health-friendly'],
    og_eyebrow: 'Q&A · 夜勤',
  },
  {
    slug: 'dokushin-friendly',
    question: '独身・単身でも続けやすい職業は？',
    short_answer: '転勤が少なく、人間関係が業務に強く依存しない職業。フリーランス系・専門職・地域密着型・在宅可能職等。',
    reasoning: '独身者にとって長く続けやすい職業の条件は、(1) 転勤頻度が低い (転勤族は単身赴任がない)、(2) 「家族持ちが標準」とされない職場文化、(3) 業務でフルタイム拘束されすぎない (友人関係維持の余地)、(4) 福利厚生が個人単位で機能する。フリーランス系・専門職・公務員 (単身向け制度あり)・小規模企業・地域密着型サービスなどが向きます。',
    selector: (d) => {
      const et = d.employment_type;
      if (!et) return null;
      const free = (et['self_employed_freelance'] ?? 0) + (et['regular_employee'] ?? 0) * 0.3;
      return free >= 0.2 ? free : null;
    },
    related_topics: ['freelance-friendly', 'female-long'],
    og_eyebrow: 'Q&A · 独身',
  },
  // ── AI 不安系 追加 (3) ──
  {
    slug: 'ai-shitsugyou-yobou',
    question: 'AI で失業しないためには？',
    short_answer: '(1) AI 影響度の低い職業を選ぶ、(2) 現職で AI を使いこなす側に立つ、(3) 業務再設計を主導する立場へ移る、の 3 戦略。',
    reasoning: 'AI 失業リスクへの対処は (1) 「移る」: AI 影響度 4 以下の身体性・対人系職業に移る、(2) 「使う」: AI ツールを業務に取り入れて生産性を倍化させる、(3) 「設計する」: AI による業務再設計を主導する立場 (DX 推進・AI ガバナンス) に移行、の 3 つ。最も現実的なのは現職で AI を使いこなす側に立つ戦略。完全に AI から逃げるよりも、AI と共存するスキルセットを育てる方が長期的に安定。',
    selector: (d) => {
      const ai = d.ai_risk?.score;
      if (ai === null || ai === undefined || ai > 4) return null;
      return -ai * 1000 + (d.stats?.workers ?? 0) / 1000;
    },
    related_topics: ['ai-de-kienai', 'ai-jidai-osusume'],
    og_eyebrow: 'Q&A · AI 失業対策',
  },
  {
    slug: 'ai-skill-mi-ni-tsukeru',
    question: 'AI 時代に身につけるべきスキルは？',
    short_answer: '(1) AI ツール使いこなし、(2) 課題定義・前提設計、(3) 出力評価・編集、(4) 対人交渉・関係構築の 4 領域。',
    reasoning: 'AI 時代に価値を保つスキルは、(1) ChatGPT・Claude・Copilot 等のツールを業務に組み込む実践力、(2) 「何を解くべきか」を定義し、AI に正しい問いを投げる課題設定力、(3) AI 出力を批判的に評価し、目的に合わせて編集する判断力、(4) AI で代替されにくい対人交渉・信頼構築・組織調整。これらは職業を問わず普遍的に価値があり、20-30 年スパンで投資する価値があります。',
    selector: (d) => {
      const ai = d.ai_risk?.score;
      if (ai === null || ai === undefined) return null;
      if (ai < 4 || ai > 7) return null;
      return d.stats?.salary_man_yen ?? 0;
    },
    related_topics: ['ai-augment-vs-replace', 'ai-frontier'],
    og_eyebrow: 'Q&A · AI スキル',
  },
  {
    slug: 'ai-hoshou-shoku',
    question: 'AI を補佐として使える職業は？',
    short_answer: 'AI 影響度 4-6 の「補強域」職業。営業・士業・診断・コンサル・編集等、人の判断 + AI ツールが鍵となる分野。',
    reasoning: 'AI を補佐として使い、生産性を倍化できる職業は AI 影響度 4-6 帯に集中します。営業 (リサーチ・提案書作成を AI 化)、士業 (条文検索・書類起案)、医師 (診断補助・文献検索)、コンサル (分析・レポート)、編集者 (素案生成・ファクトチェック) などが代表例。AI 完全代替が難しい本質判断 + AI で増強可能な周辺業務という構造です。',
    selector: (d) => {
      const ai = d.ai_risk?.score;
      if (ai === null || ai === undefined) return null;
      if (ai < 4 || ai > 6) return null;
      return -Math.abs(ai - 5) * 100 + (d.stats?.salary_man_yen ?? 0);
    },
    related_topics: ['ai-augmented', 'ai-augment-vs-replace'],
    og_eyebrow: 'Q&A · AI 補佐',
  },
  // ── キャリア相談 追加 (4) ──
  {
    slug: 'gakureki-konpurekkusu',
    question: '学歴コンプレックスを乗り越える職業選択は？',
    short_answer: '学歴より実績・資格・経験が評価される分野。技能職・国家資格職・営業・起業・スポーツ・芸能等。',
    reasoning: '学歴の影響が小さい職業は、(1) 国家資格が学歴ハードルを実質的に置き換える (看護師・士業の一部)、(2) 実績・売上が評価軸になる (営業・経営)、(3) 技能の習熟度が直接評価される (職人・技能職)、(4) 結果が客観的に出る (スポーツ・研究)。一方、新卒大企業ルートでは学歴フィルターが残るため、別ルートでキャリアを作る発想が現実的。中途採用市場では学歴より直近実績が重視されます。',
    selector: (d) => {
      const ed = d.education_distribution;
      if (!ed) return null;
      const lowEdu = (ed['below_high_school'] ?? 0) + (ed['high_school'] ?? 0);
      if (lowEdu < 0.3) return null;
      return lowEdu;
    },
    related_topics: ['high-school-careers', 'no-school-required'],
    og_eyebrow: 'Q&A · 学歴',
  },
  {
    slug: 'mikeiken-it',
    question: '未経験から IT エンジニアになるには？',
    short_answer: '(1) 基礎学習 3-6 ヶ月、(2) ポートフォリオ作成、(3) 未経験歓迎の SES・受託会社入社、(4) 2-3 年で実力を高める道筋が現実的。',
    reasoning: '未経験 IT 転職の現実的ルートは、(1) Progate・Udemy 等で 3-6 ヶ月学習 (HTML/CSS/JS or Python)、(2) GitHub にアプリやコードを公開してポートフォリオ化、(3) 未経験歓迎の SES・受託・自社開発の入門ポジションに応募、(4) 入社後 2-3 年で実力をつけ、より良い会社へ転職、の流れ。AI 時代は「コードを書く」だけでなく「AI と協働できる」エンジニアが求められる方向です。',
    selector: (d) => (d.sector?.id === 'it' ? (d.stats?.salary_man_yen ?? 0) : null),
    related_topics: ['career-change-mirai', 'it-engineer-ai'],
    og_eyebrow: 'Q&A · 未経験 IT',
  },
  {
    slug: 'nenshu-up',
    question: '確実に年収を上げるキャリア戦略は？',
    short_answer: '(1) 専門性深化 + (2) 業界選択 + (3) 大手志向 + (4) 適切なタイミングの転職、の組み合わせ。',
    reasoning: '年収が上がる構造は (1) 業界・職種の天井 (IT・金融・コンサル・士業は年収天井が高い)、(2) 企業規模 (大企業が中小より高め)、(3) 専門性の希少度 (代替不能なほど高給)、(4) タイミング (3-5 年で転職すると年収レンジが上がりやすい)。逆に上がりにくいのは小規模企業の事務職や、業界ごと低成長な分野。AI 時代は「AI を使いこなす上流職」がさらに高給化する方向。',
    selector: (d) => {
      const sal = d.stats?.salary_man_yen;
      if (!sal || sal < 600) return null;
      return sal;
    },
    related_topics: ['high-salary-high-demand', 'ai-frontier'],
    og_eyebrow: 'Q&A · 年収アップ',
  },
  {
    slug: 'kaigai-iju-shoku',
    question: '海外移住に向く職業は？',
    short_answer: 'リモートで完結する職業 (IT 系・ライター・コンサル) または海外で需要の高い専門職 (医師・看護師・研究者・日本食調理人)。',
    reasoning: '海外移住可能な職業は 2 タイプ。(1) リモート完結型: IT エンジニア・WEB デザイナー・ライター・コンサル等、日本企業に居ながら海外居住が可能。(2) 現地需要型: 医療職 (現地資格再取得が必要)・研究者・日本食調理人・日本語教師等、現地で需要があり就労ビザが取りやすい職業。前者は収入維持しやすく、後者はその国の文化に深く関われる利点があります。',
    selector: (d) => {
      const sid = d.sector?.id ?? '';
      if (['it', 'creative', 'shigyo'].includes(sid)) return d.stats?.salary_man_yen ?? 0;
      return null;
    },
    related_topics: ['zaitaku-shigoto', 'eigo-ikasu'],
    og_eyebrow: 'Q&A · 海外移住',
  },
];

export function selectExamples(items: ReadonlyArray<DetailFileMin>, qa: QAItem, n: number = 10): ReadonlyArray<DetailFileMin> {
  const scored = items
    .map((d) => ({ d, score: qa.selector(d) }))
    .filter((x): x is { d: DetailFileMin; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.d);
}
