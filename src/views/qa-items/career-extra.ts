import type { QAItem } from '../qa-meta.js';

export const CAREER_EXTRA_ITEMS: ReadonlyArray<QAItem> = [
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
