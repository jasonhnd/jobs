import type { QAItem } from '../qa-meta.js';

export const LIFE_EXTRA_ITEMS: ReadonlyArray<QAItem> = [
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

];
