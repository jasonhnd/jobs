/** Unsigned stage-3 samples, Issue #901. Never changes the shared Pro registry. */
export const ORDINARY_RANKING_SLUGS = [
  'ai-risk-high', 'workers', 'ai-risk-low', 'high-demand', 'salary-safe',
  'short-hours', 'hourly-wage', 'salary',
] as const;
export type OrdinaryRankingSlug = typeof ORDINARY_RANKING_SLUGS[number];

export const ORDINARY_RANKING_COPY = {
  search: '自分の仕事を探す',
  pro: 'Pro で詳しく見る',
  allPro: '全39ランキングは Pro で',
  indexTitle: '職業ランキング',
  indexLead: '仕事の変化・働く人の数・収入など、8つのランキングで仕事を比べられます。',
  indexScoreReading: '点数は、AIで仕事の中身が変わる度合い（0〜10）です。仕事がなくなる順位ではありません。',
  scoreReading: '点数は0〜10。7以上は「変化 大きい」、4未満は「変化 小さい」です。',
  hourlyNote: '時給は、求人の月額賃金を160時間で割った換算値です。実測の時給ではありません。',
  highTitle: 'AIで大きく変わる仕事 TOP30',
} as const;

export const ORDINARY_RANKING_LEADS: Readonly<Record<OrdinaryRankingSlug, string>> = {
  'ai-risk-high': '仕事がなくなる順ではなく、AIで仕事の中身が大きく変わる順です。',
  'ai-risk-low': 'AIで仕事の中身が変わりにくい順です。点が低いほど、変わる部分が少ない仕事です。',
  workers: '就業者数が多い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。',
  salary: '年収が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。',
  'short-hours': '労働時間が短い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。',
  'hourly-wage': '換算時給が高い順に並べました。右の点数はAIで変わる度合いで、順位とは別です。',
  'high-demand': '求人需要の区分が高い順です。同じ区分では、年収が高い順に並べています。右の点数はAIで変わる度合い（0〜10）で、順位とは別です。',
  'salary-safe': 'AIで変わる度合いが5以下の仕事を、年収が高い順に並べました。右の点数は順位とは別です。',
};

export function isOrdinaryRankingSlug(slug: string): slug is OrdinaryRankingSlug {
  return (ORDINARY_RANKING_SLUGS as readonly string[]).includes(slug);
}
