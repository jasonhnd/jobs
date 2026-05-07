/**
 * rankings.ts — data utilities for the ja/rankings/* pages.
 *
 * Mirrors scripts/build_rankings.py:
 *   - load_occupations()  → loadOccupations()
 *   - top-N sort/filter rules per ranking type → buildRankings()
 *   - global stats / sector insights for the hub page → buildHubData()
 *
 * Source: dist/data.treemap.json (552 records). The Python source loads from
 * dist/data.detail/*.json, but treemap exposes the same fields under slightly
 * different names (name_ja → title_ja, hours → monthly_hours, age → average_age).
 *
 * Reads the file via fs at import time (Astro frontmatter).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const TREEMAP_PATH = join(REPO_ROOT, 'dist', 'data.treemap.json');

export const TOP_N = 30;

export interface Occupation {
  id: number;
  title_ja: string | null;
  ai_risk: number | null;
  risk_band: string | null;
  workers: number | null;
  salary: number | null;
  monthly_hours: number | null;
  average_age: number | null;
  recruit_wage: number | null;
  demand_band: string | null;
  sector_id: string;
  sector_ja: string;
}

interface TreemapRecord {
  id: number;
  name_ja: string | null;
  salary: number | null;
  workers: number | null;
  hours: number | null;
  age: number | null;
  recruit_wage: number | null;
  ai_risk: number | null;
  risk_band: string | null;
  demand_band: string | null;
  sector_id: string;
  sector_ja: string;
}

let cached: Occupation[] | null = null;

export function loadOccupations(): Occupation[] {
  if (cached) return cached;
  const raw = readFileSync(TREEMAP_PATH, 'utf-8');
  const records = JSON.parse(raw) as TreemapRecord[];
  cached = records.map((d) => ({
    id: d.id,
    title_ja: d.name_ja ?? null,
    ai_risk: d.ai_risk ?? null,
    risk_band: d.risk_band ?? null,
    workers: d.workers ?? null,
    salary: d.salary ?? null,
    monthly_hours: d.hours ?? null,
    average_age: d.age ?? null,
    recruit_wage: d.recruit_wage ?? null,
    demand_band: d.demand_band ?? null,
    sector_id: d.sector_id ?? '',
    sector_ja: d.sector_ja ?? '',
  }));
  return cached;
}

// ---------------------------------------------------------------------------
// Constants and metadata (mirrors scripts/build_rankings.py).
// ---------------------------------------------------------------------------

export const DEMAND_SCORE: Record<string, number> = {
  hot: 4,
  warm: 3,
  cool: 2,
  cold: 1,
};

export const DEMAND_JA: Record<string, string> = {
  hot: '需要高',
  warm: 'やや高',
  cool: '安定',
  cold: '低',
};

export type RankingSlug =
  | 'ai-risk-high'
  | 'ai-risk-low'
  | 'salary-safe'
  | 'workers'
  | 'salary'
  | 'entry-salary'
  | 'young-workforce'
  | 'short-hours'
  | 'high-demand';

export const ALL_RANKINGS: ReadonlyArray<readonly [RankingSlug, string, string]> = [
  ['ai-risk-high', 'AIに奪われる仕事 TOP30', 'AI影響度が高い職業ランキング'],
  ['ai-risk-low', 'AI影響が少ない仕事 TOP30', 'AIリスクが低く将来性のある職業'],
  ['salary-safe', '高年収×低AIリスク TOP30', '年収が高くAI代替リスクが低い職業'],
  ['workers', '就業者数ランキング TOP30', '日本で最も就業者が多い職業'],
  ['salary', '年収ランキング TOP30', '年収が最も高い職業'],
  ['entry-salary', '初任給ランキング TOP30', '初任給が高い職業'],
  ['young-workforce', '平均年齢が若い職業 TOP30', '若手が活躍する職業'],
  ['short-hours', '労働時間が短い職業 TOP30', 'ワークライフバランスに優れた職業'],
  ['high-demand', '人手不足の職業 TOP30', '求人需要が高い職業'],
];

export const FAQS: Record<RankingSlug, ReadonlyArray<readonly [string, string]>> = {
  'ai-risk-high': [
    ['AIに奪われやすい仕事の特徴は？', 'データ入力・定型処理・パターン認識が中心の業務はAI代替リスクが高い傾向にあります。反復的なルーティンワークほどスコアが高くなります。'],
    ['AIリスクが高い仕事は将来なくなりますか？', '「なくなる」のではなく「変わる」可能性が高いです。AIはタスクの一部を代替・補助しますが、職業そのものが消滅するとは限りません。'],
    ['AIリスクが高い職業から転職するには？', '身体性・対人スキル・創造性を活かせる職種への転換が有効です。同セクター内でより安全な職業を探すのも一つの方法です。'],
  ],
  'ai-risk-low': [
    ['AIに奪われない仕事の共通点は？', '身体的な動作、対面での人間関係構築、高度な状況判断が必要な職業はAI代替が難しい傾向にあります。'],
    ['AI影響度が低い仕事は将来安泰ですか？', 'AI代替リスクは低いですが、少子高齢化や産業構造変化など他の要因も考慮が必要です。'],
    ['AIリスクが低くて年収も高い職業は？', '医師・弁護士・建設系専門職などが該当します。「高年収×低AIリスク」ランキングもご覧ください。'],
  ],
  'salary-safe': [
    ['年収が高くてAIに奪われにくい仕事は？', '医師・法律専門家・建設系技術者などが代表的です。専門性と対人スキルの組み合わせが強みになっています。'],
    ['高年収×低AIリスクの職業に就くには？', '多くが国家資格や高度な専門教育を必要としますが、建設・保安分野では実務経験重視のキャリアパスもあります。'],
    ['AIリスクが低くても年収に差があるのはなぜ？', '必要な資格の難易度、労働条件、需給バランスなどが年収を左右します。'],
  ],
  workers: [
    ['日本で最も就業者が多い職業は？', '一般事務職が最も多く、次いで販売・接客系の職業が続きます。生活に密接な職業ほど就業者が多い傾向です。'],
    ['就業者が多い職業のAIリスクは？', '事務・販売系は比較的AI影響度が高い傾向にあり、大規模な職業構造の変化が予想されます。'],
    ['就業者数と求人数は比例しますか？', '必ずしも比例しません。就業者が多くても離職率が低ければ求人は少なく、人手不足の分野では就業者が少なくても求人が多い場合があります。'],
  ],
  salary: [
    ['日本で最も年収が高い職業は？', '医師・パイロット・弁護士など高度な専門資格を必要とする職業が上位に入ります。'],
    ['高年収の職業に共通する特徴は？', '高度な資格・長期の教育投資・強い参入障壁のいずれかを持つ職業が多い傾向にあります。'],
    ['AI時代でも高年収を維持できる職業は？', '身体性や対人関係が重要な高専門職はAI影響度が低く、高年収を維持しやすいと考えられます。'],
  ],
  'entry-salary': [
    ['初任給が高い職業は？', 'IT系エンジニア・医療系専門職・法律系など、即戦力としての専門知識が評価される職業が上位です。'],
    ['初任給と平均年収の関係は？', '初任給が高い職業は平均年収も高い傾向にありますが、昇給カーブは職種によって大きく異なります。'],
    ['新卒で高い初任給を得るには？', '理工系・医療系の専門学位、IT関連の資格やスキルが評価される傾向にあります。'],
  ],
  'young-workforce': [
    ['若い人が多い職業の特徴は？', 'IT・クリエイティブ・サービス業など、比較的新しい産業や体力を要する職種で平均年齢が低い傾向にあります。'],
    ['平均年齢が低い職業は離職率が高い？', '一概には言えませんが、若年層が多い職種では業界内の流動性が高い傾向にあります。'],
    ['若い人が多い職業のAIリスクは？', 'IT系は高め、サービス・建設系は低めと、業種によって二極化しています。'],
  ],
  'short-hours': [
    ['残業が少ない職業は？', '教育系・公務系・一部の専門職で月間労働時間が短い傾向にあります。データは統計上の平均値です。'],
    ['労働時間が短くて年収が高い職業は？', '医師（一部の科）・大学教員・法律専門家などが該当しますが、個人差が大きい点に注意が必要です。'],
    ['ワークライフバランスの良い職業の見つけ方は？', '労働時間だけでなく、勤務時間帯の柔軟性やリモートワーク可否なども合わせて検討すると良いでしょう。'],
  ],
  'high-demand': [
    ['今、最も求人が多い職業は？', '介護・建設・IT系が人手不足の傾向が強く、求人需要が高い状態が続いています。'],
    ['人手不足の職業は年収が上がる？', '需要と供給のバランスから、人手不足の職業では賃金上昇圧力が生じやすい傾向にあります。'],
    ['求人需要が高い職業に転職するメリットは？', '採用されやすく待遇改善の交渉もしやすい傾向にあります。ただし人手不足の理由も確認が重要です。'],
  ],
};

// ---------------------------------------------------------------------------
// Sort / filter rules per ranking (mirrors scripts/build_rankings.py:main).
// ---------------------------------------------------------------------------

function byKeyDesc<T>(items: T[], key: (o: T) => number | null | undefined, tie: (o: T) => number = () => 0): T[] {
  return [...items].sort((a, b) => {
    const av = key(a) ?? 0;
    const bv = key(b) ?? 0;
    if (bv !== av) return bv - av;
    return tie(a) - tie(b);
  });
}

function byKeyAsc<T>(items: T[], key: (o: T) => number | null | undefined, tie: (o: T) => number = () => 0): T[] {
  return [...items].sort((a, b) => {
    const av = key(a) ?? 0;
    const bv = key(b) ?? 0;
    if (av !== bv) return av - bv;
    return tie(a) - tie(b);
  });
}

export interface RankingResult {
  slug: RankingSlug;
  items: Occupation[];
  /** Stats prepared for the page header `<dl class="stats">`. */
  statBlocks: ReadonlyArray<readonly [string, string]>;
  /** Optional extra metric per item, rendered before salary. Mirrors extra_col_fn. */
  extraColFn?: (o: Occupation) => string[];
  /** Whether to show the salary chip. */
  showSalary: boolean;
  faqItems: ReadonlyArray<readonly [string, string]>;
  // Page metadata (mirrors render_page args).
  title: string;
  seoDesc: string;
  h1Text: string;
  /** Allowed to contain inline <strong> markup; rendered raw. */
  subText: string;
  introText: string;
}

function safeMean(items: Occupation[], key: keyof Occupation): number {
  const vals = items
    .map((o) => o[key])
    .filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Math.trunc(n).toLocaleString('en-US');
}

export interface RankingsBundle {
  results: Map<RankingSlug, RankingResult>;
  hub: {
    globalStats: ReadonlyArray<readonly [string, string]>;
    insights: string[];
    cards: Array<{ slug: RankingSlug; name: string; desc: string; count: number; preview: string }>;
  };
}

export function buildRankings(): RankingsBundle {
  const occs = loadOccupations();
  const scored = occs.filter((o) => o.ai_risk !== null);
  const withSalary = occs.filter((o) => o.salary && o.ai_risk !== null);

  const allMeanRisk = safeMean(scored, 'ai_risk');
  const allMeanSalary = safeMean(occs.filter((o) => o.salary), 'salary');
  const allWorkers = occs.reduce((s, o) => s + (o.workers ?? 0), 0);

  // 1. AI risk high — sort -ai_risk, id asc
  const aiHigh = byKeyDesc(scored, (o) => o.ai_risk, (o) => o.id).slice(0, TOP_N);
  const meanHigh = safeMean(aiHigh, 'ai_risk');

  // 2. AI risk low — sort ai_risk asc, id asc
  const aiLow = byKeyAsc(scored, (o) => o.ai_risk, (o) => o.id).slice(0, TOP_N);
  const meanLow = safeMean(aiLow, 'ai_risk');

  // 3. Salary x safe — filter ai_risk<=5, sort -salary then ai_risk then id
  const salarySafe = withSalary
    .filter((o) => (o.ai_risk ?? 0) <= 5)
    .sort((a, b) => {
      const sa = a.salary ?? 0;
      const sb = b.salary ?? 0;
      if (sb !== sa) return sb - sa;
      const ra = a.ai_risk ?? 0;
      const rb = b.ai_risk ?? 0;
      if (ra !== rb) return ra - rb;
      return a.id - b.id;
    })
    .slice(0, TOP_N);
  const meanSalarySS = safeMean(salarySafe, 'salary');
  const meanRiskSS = safeMean(salarySafe, 'ai_risk');

  // 4. Workers
  const byWorkers = byKeyDesc(
    occs.filter((o) => o.workers),
    (o) => o.workers,
  ).slice(0, TOP_N);
  const totalWorkersTop = byWorkers.reduce((s, o) => s + (o.workers ?? 0), 0);

  // 5. Salary (pure)
  const bySalary = byKeyDesc(
    occs.filter((o) => o.salary),
    (o) => o.salary,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanSalaryTop = safeMean(bySalary, 'salary');

  // 6. Entry salary
  const byEntry = byKeyDesc(
    occs.filter((o) => o.recruit_wage),
    (o) => o.recruit_wage,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanEntry = safeMean(byEntry, 'recruit_wage');

  // 7. Young workforce
  const byYoung = byKeyAsc(
    occs.filter((o) => o.average_age),
    (o) => o.average_age,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanAgeYoung = safeMean(byYoung, 'average_age');

  // 8. Short hours
  const byHours = byKeyAsc(
    occs.filter((o) => o.monthly_hours),
    (o) => o.monthly_hours,
    (o) => o.id,
  ).slice(0, TOP_N);
  const meanHours = safeMean(byHours, 'monthly_hours');

  // 9. High demand
  let withDemand = occs.filter((o) => o.demand_band && (DEMAND_SCORE[o.demand_band] ?? 0) >= 3);
  if (withDemand.length < TOP_N) {
    withDemand = occs.filter((o) => o.demand_band);
  }
  const byDemand = [...withDemand]
    .sort((a, b) => {
      const ds = (DEMAND_SCORE[b.demand_band ?? ''] ?? 0) - (DEMAND_SCORE[a.demand_band ?? ''] ?? 0);
      if (ds !== 0) return ds;
      const ss = (b.salary ?? 0) - (a.salary ?? 0);
      if (ss !== 0) return ss;
      return a.id - b.id;
    })
    .slice(0, TOP_N);
  const hotCount = byDemand.filter((o) => o.demand_band === 'hot').length;
  const warmCount = byDemand.filter((o) => o.demand_band === 'warm').length;

  // ---- Build per-ranking page metadata ----

  const results = new Map<RankingSlug, RankingResult>();

  results.set('ai-risk-high', {
    slug: 'ai-risk-high',
    items: aiHigh,
    showSalary: true,
    faqItems: FAQS['ai-risk-high'],
    title: 'AIに奪われる仕事ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `AI影響度が最も高い職業TOP${TOP_N}。平均スコア${meanHigh.toFixed(1)}/10。AI代替リスク・年収・就業者数を一覧比較。Claude Opus 4.7独自分析（非公式）。`,
    h1Text: `AIに奪われる仕事 TOP${TOP_N}`,
    subText: `AI 影響度が最も <strong>高い</strong> 職業ランキング（${scored.length} 職業中）`,
    introText: '厚労省の職業データに基づき、Claude Opus 4.7がタスクレベルでAI影響度を分析。10段階中スコアが高い職業ほど、業務の多くがAIで代替・補助される可能性があります。ただし「仕事がなくなる」という意味ではありません。',
    statBlocks: [
      ['対象職業数', `${scored.length}`],
      ['TOP30 平均 AI 影響', `${meanHigh.toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiHigh, 'salary'))} 万円`],
      ['TOP30 平均年齢', `${safeMean(aiHigh, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('ai-risk-low', {
    slug: 'ai-risk-low',
    items: aiLow,
    showSalary: true,
    faqItems: FAQS['ai-risk-low'],
    title: 'AI影響が少ない仕事ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `AIに代替されにくい職業TOP${TOP_N}。平均スコア${meanLow.toFixed(1)}/10。将来性が高くAIリスクの低い仕事を年収・就業者数と共に一覧。`,
    h1Text: `AI影響が少ない仕事 TOP${TOP_N}`,
    subText: `AI 影響度が最も <strong>低い</strong> 職業ランキング（${scored.length} 職業中）`,
    introText: '身体性・対人関係・創造性が求められる職業はAIによる代替が難しく、スコアが低くなる傾向があります。「AIに奪われない仕事」をお探しの方に、将来性の高い職業を年収データと共に紹介します。',
    statBlocks: [
      ['対象職業数', `${scored.length}`],
      ['TOP30 平均 AI 影響', `${meanLow.toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(aiLow, 'salary'))} 万円`],
      ['TOP30 平均年齢', `${safeMean(aiLow, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('salary-safe', {
    slug: 'salary-safe',
    items: salarySafe,
    showSalary: true,
    faqItems: FAQS['salary-safe'],
    title: '高年収×低AIリスクの職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `年収が高くAI代替リスクが低い職業TOP${TOP_N}。平均年収${Math.trunc(meanSalarySS)}万円・平均AI影響${meanRiskSS.toFixed(1)}/10。将来性と収入を両立できる仕事を一覧。`,
    h1Text: `高年収×低AIリスク TOP${TOP_N}`,
    subText: '年収が高く、かつ AI 影響度が <strong>5以下</strong> の職業',
    introText: '高い年収を得ながらAIに代替されにくい——そんな職業を探している方へ。AI影響度5以下（10段階）かつ年収が高い順にランキングしました。',
    statBlocks: [
      ['TOP30 平均年収', `${Math.trunc(meanSalarySS)} 万円`],
      ['TOP30 平均 AI 影響', `${meanRiskSS.toFixed(1)} / 10`],
      ['TOP30 平均年齢', `${safeMean(salarySafe, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('workers', {
    slug: 'workers',
    items: byWorkers,
    showSalary: true,
    faqItems: FAQS['workers'],
    title: '就業者数が多い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `日本で最も就業者が多い職業TOP${TOP_N}。合計${fmtInt(totalWorkersTop)}人。年収・AI影響度と合わせて比較。厚労省データに基づく独自分析。`,
    h1Text: `就業者数ランキング TOP${TOP_N}`,
    subText: '日本で最も <strong>就業者が多い</strong> 職業',
    introText: '厚労省の職業情報データベース（job tag）に基づく就業者数ランキング。最も多くの人が従事している職業をAI影響度・年収データと共に一覧できます。',
    statBlocks: [
      ['TOP30 合計就業者数', `${fmtInt(totalWorkersTop)} 人`],
      ['TOP30 平均 AI 影響', `${safeMean(byWorkers, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byWorkers, 'salary'))} 万円`],
    ],
  });

  results.set('salary', {
    slug: 'salary',
    items: bySalary,
    showSalary: true,
    faqItems: FAQS['salary'],
    title: '年収が高い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `日本で最も年収が高い職業TOP${TOP_N}。平均年収${Math.trunc(meanSalaryTop)}万円。AI影響度・就業者数も合わせて比較。`,
    h1Text: `年収ランキング TOP${TOP_N}`,
    subText: '年収が最も <strong>高い</strong> 職業ランキング',
    introText: '厚労省の職業情報データベースに基づく年収ランキング。年収が高い職業をAI影響度・就業者数と共に一覧できます。',
    statBlocks: [
      ['TOP30 平均年収', `${Math.trunc(meanSalaryTop)} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(bySalary, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年齢', `${safeMean(bySalary, 'average_age').toFixed(1)} 歳`],
      ['TOP30 平均月間労働', `${Math.trunc(safeMean(bySalary, 'monthly_hours'))} 時間`],
    ],
  });

  results.set('entry-salary', {
    slug: 'entry-salary',
    items: byEntry,
    showSalary: true,
    extraColFn: (o) => (o.recruit_wage ? [`<span class="rl-extra">初任給 ${Math.trunc(o.recruit_wage)}万円</span>`] : []),
    faqItems: FAQS['entry-salary'],
    title: '初任給が高い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `初任給が最も高い職業TOP${TOP_N}。平均初任給${Math.trunc(meanEntry)}万円。年収・AI影響度も合わせて比較。就活・転職の参考に。`,
    h1Text: `初任給ランキング TOP${TOP_N}`,
    subText: '初任給が最も <strong>高い</strong> 職業ランキング',
    introText: '新卒・未経験からのスタート時の給与が高い職業をランキング。平均年収やAI影響度も合わせて確認できます。',
    statBlocks: [
      ['TOP30 平均初任給', `${Math.trunc(meanEntry)} 万円`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byEntry, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byEntry, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  results.set('young-workforce', {
    slug: 'young-workforce',
    items: byYoung,
    showSalary: true,
    extraColFn: (o) => (o.average_age ? [`<span class="rl-extra">${o.average_age.toFixed(1)}歳</span>`] : []),
    faqItems: FAQS['young-workforce'],
    title: '平均年齢が若い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `平均年齢が最も低い職業TOP${TOP_N}。平均${meanAgeYoung.toFixed(1)}歳。若手が活躍する職業を年収・AI影響度と共に一覧。`,
    h1Text: `平均年齢が若い職業 TOP${TOP_N}`,
    subText: '平均年齢が最も <strong>低い</strong> 職業ランキング',
    introText: '若い世代が多く活躍する職業をランキング。IT・クリエイティブ・サービス業など、比較的新しい産業や体力を要する職種で平均年齢が低い傾向にあります。',
    statBlocks: [
      ['TOP30 平均年齢', `${meanAgeYoung.toFixed(1)} 歳`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byYoung, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byYoung, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  results.set('short-hours', {
    slug: 'short-hours',
    items: byHours,
    showSalary: true,
    extraColFn: (o) => (o.monthly_hours ? [`<span class="rl-extra">月${Math.trunc(o.monthly_hours)}h</span>`] : []),
    faqItems: FAQS['short-hours'],
    title: '労働時間が短い職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `月間労働時間が最も短い職業TOP${TOP_N}。平均${Math.trunc(meanHours)}時間。ワークライフバランスに優れた職業を年収・AI影響度と共に一覧。`,
    h1Text: `労働時間が短い職業 TOP${TOP_N}`,
    subText: '月間労働時間が最も <strong>短い</strong> 職業ランキング',
    introText: 'ワークライフバランスを重視する方向けに、月間労働時間が短い職業をランキング。年収やAI影響度も合わせて確認できます。',
    statBlocks: [
      ['TOP30 平均月間労働', `${Math.trunc(meanHours)} 時間`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byHours, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byHours, 'ai_risk').toFixed(1)} / 10`],
      ['TOP30 平均年齢', `${safeMean(byHours, 'average_age').toFixed(1)} 歳`],
    ],
  });

  results.set('high-demand', {
    slug: 'high-demand',
    items: byDemand,
    showSalary: true,
    extraColFn: (o) => {
      const db = o.demand_band ?? '';
      const label = DEMAND_JA[db];
      return label ? [`<span class="demand-pill ${escapeHtml(db)}">${escapeHtml(label)}</span>`] : [];
    },
    faqItems: FAQS['high-demand'],
    title: '人手不足の職業ランキング TOP30【2026年版】| 未来の仕事',
    seoDesc: `求人需要が最も高い職業TOP${TOP_N}。「需要高」${hotCount}件・「やや高」${warmCount}件。転職・就活の参考に。`,
    h1Text: `人手不足の職業 TOP${TOP_N}`,
    subText: '求人需要が最も <strong>高い</strong> 職業ランキング',
    introText: '人手不足が深刻な職業を求人需要の高い順にランキング。採用されやすく待遇改善も期待できる職業を年収・AI影響度と共に確認できます。',
    statBlocks: [
      ['「需要高」職業数', `${hotCount}`],
      ['「やや高」職業数', `${warmCount}`],
      ['TOP30 平均年収', `${Math.trunc(safeMean(byDemand, 'salary'))} 万円`],
      ['TOP30 平均 AI 影響', `${safeMean(byDemand, 'ai_risk').toFixed(1)} / 10`],
    ],
  });

  // ---- Hub data ----

  const globalStats: Array<readonly [string, string]> = [
    ['総職業数', '556'],
    ['全体平均 AI 影響', `${allMeanRisk.toFixed(1)} / 10`],
    ['全体平均年収', `${Math.trunc(allMeanSalary)} 万円`],
    ['総就業者数', `${Math.round(allWorkers / 10000)} 万人`],
  ];

  const sectorRisks = new Map<string, number[]>();
  for (const o of scored) {
    const sid = o.sector_ja || '';
    if (sid) {
      const arr = sectorRisks.get(sid) ?? [];
      arr.push(o.ai_risk ?? 0);
      sectorRisks.set(sid, arr);
    }
  }
  const sectorMeanRisks = new Map<string, number>();
  for (const [s, v] of sectorRisks.entries()) {
    if (v.length > 0) sectorMeanRisks.set(s, v.reduce((a, b) => a + b, 0) / v.length);
  }
  let highestRiskSector = '';
  let lowestRiskSector = '';
  let maxMean = -Infinity;
  let minMean = Infinity;
  for (const [s, m] of sectorMeanRisks.entries()) {
    if (m > maxMean) {
      maxMean = m;
      highestRiskSector = s;
    }
    if (m < minMean) {
      minMean = m;
      lowestRiskSector = s;
    }
  }

  const insights = [
    `<strong>${escapeHtml(highestRiskSector)}</strong>セクターはAI影響度平均${(sectorMeanRisks.get(highestRiskSector) ?? 0).toFixed(1)}と全セクターで最高`,
    `<strong>${escapeHtml(lowestRiskSector)}</strong>セクターはAI影響度平均${(sectorMeanRisks.get(lowestRiskSector) ?? 0).toFixed(1)}と最も低い`,
    `年収上位30職業の平均AI影響度は<strong>${safeMean(bySalary, 'ai_risk').toFixed(1)}/10</strong>と中程度`,
    '就業者数上位は事務・販売系が占めるが、AI影響度は<strong>高め</strong>の傾向',
    'AI影響度が低い職業ほど<strong>身体性・対人スキル</strong>を求められる傾向',
  ];

  const cards: RankingsBundle['hub']['cards'] = [
    { slug: 'ai-risk-high', name: 'AIに奪われる仕事 TOP30', desc: 'AI影響度が高い職業ランキング', count: aiHigh.length, preview: makePreview(aiHigh, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'ai-risk-low', name: 'AI影響が少ない仕事 TOP30', desc: 'AIリスクが低く将来性のある職業', count: aiLow.length, preview: makePreview(aiLow, (o) => `AI影響 ${o.ai_risk}/10`) },
    { slug: 'salary-safe', name: '高年収×低AIリスク TOP30', desc: '年収が高くAI代替リスクが低い職業', count: salarySafe.length, preview: makePreview(salarySafe, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'workers', name: '就業者数ランキング TOP30', desc: '日本で最も就業者が多い職業', count: byWorkers.length, preview: makePreview(byWorkers, (o) => `${fmtInt(o.workers)}人`) },
    { slug: 'salary', name: '年収ランキング TOP30', desc: '年収が最も高い職業', count: bySalary.length, preview: makePreview(bySalary, (o) => `${Math.trunc(o.salary ?? 0)}万円`) },
    { slug: 'entry-salary', name: '初任給ランキング TOP30', desc: '初任給が高い職業', count: byEntry.length, preview: makePreview(byEntry, (o) => `初任給 ${Math.trunc(o.recruit_wage ?? 0)}万円`) },
    { slug: 'young-workforce', name: '平均年齢が若い職業 TOP30', desc: '若手が活躍する職業', count: byYoung.length, preview: makePreview(byYoung, (o) => `平均${(o.average_age ?? 0).toFixed(1)}歳`) },
    { slug: 'short-hours', name: '労働時間が短い職業 TOP30', desc: 'ワークライフバランスに優れた職業', count: byHours.length, preview: makePreview(byHours, (o) => `月${Math.trunc(o.monthly_hours ?? 0)}時間`) },
    { slug: 'high-demand', name: '人手不足の職業 TOP30', desc: '求人需要が高い職業', count: byDemand.length, preview: makePreview(byDemand, (o) => DEMAND_JA[o.demand_band ?? ''] ?? '') },
  ];

  return { results, hub: { globalStats, insights, cards } };
}

function makePreview(items: Occupation[], metric: (o: Occupation) => string): string {
  if (items.length === 0) return '';
  const top = items[0];
  const name = top.title_ja ?? '';
  return `\u{1F947} ${name}（${metric(top)}）`;
}

// ---------------------------------------------------------------------------
// HTML rendering helpers (mirrors the Python render_* functions). Astro can
// `set:html` the strings these return — they all escape user data.
// ---------------------------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function riskBand(score: number | null): 'low' | 'mid' | 'high' {
  if (score === null) return 'mid';
  if (score <= 3) return 'low';
  if (score <= 6) return 'mid';
  return 'high';
}

export function renderRankItem(
  o: Occupation,
  showSalary: boolean,
  extraCols: string[] | null,
): string {
  const title = o.title_ja ?? `#${o.id}`;
  const score = o.ai_risk;
  const scoreStr = score === null ? '—' : `${score}/10`;
  const band = riskBand(score);
  const sector = o.sector_ja || '';
  const salary = o.salary;
  const workers = o.workers;

  const statsParts: string[] = [
    `<span class="risk-pill ${band}">${escapeHtml(scoreStr)}</span>`,
  ];
  if (extraCols) statsParts.push(...extraCols);
  if (showSalary && salary) {
    statsParts.push(`<span class="rl-salary">${Math.trunc(salary)}万円</span>`);
  }
  if (workers) {
    statsParts.push(`<span class="rl-workers">${fmtInt(workers)}人</span>`);
  }

  const sectorHtml = sector ? `<span class="rl-sector">${escapeHtml(sector)}</span>` : '';
  return (
    `<li>` +
    `<div class="rl-main">` +
    `<a class="rl-name" href="/ja/${o.id}">${escapeHtml(title)}</a>` +
    `${sectorHtml}` +
    `</div>` +
    `<div class="rl-stats">${statsParts.join('')}</div>` +
    `</li>`
  );
}

export function renderHighlights(items: Occupation[], slug: RankingSlug): string {
  if (items.length === 0) return '';
  const top = items[0];
  const name = top.title_ja ?? '';
  const hl: string[] = [];

  if (slug === 'ai-risk-high' || slug === 'ai-risk-low') {
    hl.push(`1位は「${name}」（AI影響度 ${top.ai_risk}/10）`);
  } else if (slug === 'salary') {
    hl.push(`1位は「${name}」（年収 ${Math.trunc(top.salary ?? 0)}万円）`);
  } else if (slug === 'entry-salary') {
    hl.push(`1位は「${name}」（初任給 ${Math.trunc(top.recruit_wage ?? 0)}万円）`);
  } else if (slug === 'young-workforce') {
    hl.push(`1位は「${name}」（平均年齢 ${(top.average_age ?? 0).toFixed(1)}歳）`);
  } else if (slug === 'short-hours') {
    hl.push(`1位は「${name}」（月間 ${Math.trunc(top.monthly_hours ?? 0)}時間）`);
  } else if (slug === 'high-demand') {
    hl.push(`1位は「${name}」（求人需要：${DEMAND_JA[top.demand_band ?? ''] ?? ''}）`);
  } else {
    hl.push(`1位は「${name}」`);
  }

  // Top sector
  const sectorCounts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) sectorCounts.set(o.sector_ja, (sectorCounts.get(o.sector_ja) ?? 0) + 1);
  }
  let topSector = '';
  let topSectorCnt = 0;
  for (const [s, c] of sectorCounts.entries()) {
    if (c > topSectorCnt) {
      topSectorCnt = c;
      topSector = s;
    }
  }
  if (topSector) {
    hl.push(`TOP${items.length}の中で「${topSector}」セクターが${topSectorCnt}件と最多`);
  }

  const meanSal = safeMean(items, 'salary');
  const meanRisk = safeMean(items, 'ai_risk');
  if (meanSal > 0) {
    hl.push(`TOP${items.length}の平均年収は${Math.trunc(meanSal)}万円、平均AI影響度は${meanRisk.toFixed(1)}/10`);
  }

  const itemsHtml = hl.map((h) => `<li>${escapeHtml(h)}</li>`).join('');
  return `<div class="highlights"><ul>${itemsHtml}</ul></div>`;
}

export function renderSectorChart(items: Occupation[]): string {
  const counts = new Map<string, number>();
  for (const o of items) {
    if (o.sector_ja) counts.set(o.sector_ja, (counts.get(o.sector_ja) ?? 0) + 1);
  }
  if (counts.size === 0) return '';
  const ordered = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = ordered[0][1];
  const rows = ordered.slice(0, 6).map(([sec, cnt]) => {
    const pct = Math.trunc((cnt / maxCount) * 100);
    return (
      `<div class="sb-row">` +
      `<span class="sb-label">${escapeHtml(sec)}</span>` +
      `<span class="sb-track"><span class="sb-fill" style="width:${pct}%"></span></span>` +
      `<span class="sb-count">${cnt}件</span>` +
      `</div>`
    );
  }).join('');
  return (
    `<div class="sector-chart">` +
    `<div class="sc-title">セクター内訳（TOP${items.length}）</div>` +
    `${rows}` +
    `</div>`
  );
}

export function renderFaqHtml(faqItems: ReadonlyArray<readonly [string, string]>): string {
  if (faqItems.length === 0) return '';
  const details = faqItems.map(([q, a]) =>
    `<details><summary>${escapeHtml(q)}</summary>` +
    `<div class="faq-a">${escapeHtml(a)}</div></details>`,
  ).join('');
  return (
    `<section class="faq" aria-label="よくある質問">` +
    `<h2>よくある質問</h2>` +
    `${details}` +
    `</section>`
  );
}

export function renderRelatedRankings(currentSlug: RankingSlug): string {
  const items = ALL_RANKINGS
    .filter(([slug]) => slug !== currentSlug)
    .map(([slug, name, desc]) =>
      `<li><a href="/ja/rankings/${slug}">` +
      `${escapeHtml(name)}` +
      `<span class="rr-desc">${escapeHtml(desc)}</span>` +
      `</a></li>`,
    ).join('');
  return `<ul class="related-rankings">${items}</ul>`;
}

// ---------------------------------------------------------------------------
// JSON-LD per ranking page (mirrors render_jsonld).
// ---------------------------------------------------------------------------

const SITE = 'https://mirai-shigoto.com';
const DATE_PUBLISHED = '2026-05-06';
const DATE_MODIFIED = '2026-05-06';

export function renderJsonLd(
  canonical: string,
  title: string,
  description: string,
  items: Occupation[],
  faqItems: ReadonlyArray<readonly [string, string]> | null,
): string {
  const itemList = items.map((o, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE}/ja/${o.id}`,
    name: o.title_ja ?? `#${o.id}`,
  }));

  const graph: unknown[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': `${SITE}/#website` },
      inLanguage: 'ja',
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      publisher: { '@id': `${SITE}/#organization` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
    },
    {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      headline: title,
      description,
      image: `${SITE}/og.png`,
      url: canonical,
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      author: { '@id': `${SITE}/#organization` },
      publisher: { '@id': `${SITE}/#organization` },
      inLanguage: 'ja',
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      isPartOf: { '@id': `${canonical}#webpage` },
      articleSection: 'ランキング',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'ランキング', item: `${SITE}/ja/rankings` },
        { '@type': 'ListItem', position: 3, name: title, item: canonical },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#list`,
      name: title,
      numberOfItems: itemList.length,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: itemList,
    },
  ];

  if (faqItems && faqItems.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faqItems.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

export function renderHubJsonLd(): string {
  const canonical = `${SITE}/ja/rankings`;
  const seoDesc = '日本556職業をAI影響度・年収・初任給・就業者数・労働時間・求人需要で10の視点でランキング。AIに奪われやすい仕事、高年収×低AIリスクの職業などを一覧。';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: '職業ランキング',
        description: seoDesc,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'ja',
        datePublished: DATE_PUBLISHED,
        dateModified: DATE_MODIFIED,
        publisher: { '@id': `${SITE}/#organization` },
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '未来の仕事', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'ランキング', item: canonical },
        ],
      },
    ],
  }, null, 2);
}
