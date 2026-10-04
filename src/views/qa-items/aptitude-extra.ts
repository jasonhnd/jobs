import type { QAItem } from '../qa-meta.js';

export const APTITUDE_EXTRA_ITEMS: ReadonlyArray<QAItem> = [
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

];
