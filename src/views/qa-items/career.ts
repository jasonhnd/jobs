import type { QAItem } from '../qa-meta.js';

export const CAREER_ITEMS: ReadonlyArray<QAItem> = [
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

];
