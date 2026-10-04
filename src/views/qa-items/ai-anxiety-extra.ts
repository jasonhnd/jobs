import type { QAItem } from '../qa-meta.js';

export const AI_ANXIETY_EXTRA_ITEMS: ReadonlyArray<QAItem> = [
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

];
