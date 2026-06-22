import type { GeoFacts, GeoOccupationSummary } from '../site/geo-facts.js';

const SITE = 'https://mirai-shigoto.com';
const TOP_N = 30;

export type GeoAnswerTopicSlug =
  | 'ai-de-nakunaru-shigoto'
  | 'nenshu-ai-anzen'
  | 'nobiru-shigoto-top';

export interface GeoAnswerTopicConfig {
  readonly slug: GeoAnswerTopicSlug;
  readonly titleJa: string;
  readonly h1Ja: string;
  readonly questionJa: string;
  readonly shortAnswerJa: string;
  readonly introJa: string;
  readonly itemReasonJa: string;
  readonly selector: (occupation: GeoOccupationSummary) => boolean;
  readonly sorter: (a: GeoOccupationSummary, b: GeoOccupationSummary) => number;
}

export interface GeoAnswerTopicResult {
  readonly config: GeoAnswerTopicConfig;
  readonly canonical: string;
  readonly seoDesc: string;
  readonly items: readonly GeoOccupationSummary[];
  readonly jsonLd: string;
}

function byId(a: GeoOccupationSummary, b: GeoOccupationSummary): number {
  return a.id - b.id;
}

function byAiImpactDesc(a: GeoOccupationSummary, b: GeoOccupationSummary): number {
  return (b.aiImpact - a.aiImpact) || ((b.workers ?? 0) - (a.workers ?? 0)) || byId(a, b);
}

function bySalarySafe(a: GeoOccupationSummary, b: GeoOccupationSummary): number {
  return ((b.salaryMan ?? 0) - (a.salaryMan ?? 0)) || (a.aiImpact - b.aiImpact) || byId(a, b);
}

function byRecruitRatio(a: GeoOccupationSummary, b: GeoOccupationSummary): number {
  return ((b.recruitRatio ?? 0) - (a.recruitRatio ?? 0)) || (a.aiImpact - b.aiImpact) || byId(a, b);
}

export const GEO_ANSWER_TOPIC_CONFIGS: readonly GeoAnswerTopicConfig[] = [
  {
    slug: 'ai-de-nakunaru-shigoto',
    titleJa: 'AIでなくなる可能性が高い仕事 TOP30',
    h1Ja: 'AIでなくなる可能性が高い仕事 TOP30',
    questionJa: 'AIでなくなる可能性が高い仕事は？',
    shortAnswerJa: 'AI影響度が高い仕事は、職業そのものが即座になくなるというより、定型業務や情報処理がAIに置き換わりやすい仕事です。',
    introJa: 'AI影響度の高い順に、業務再設計が必要になりやすい職業を並べます。スコアは「消える確率」ではなく、仕事の中身がどれだけAIで変わるかの指標です。',
    itemReasonJa: 'AI影響度が高い順',
    selector: () => true,
    sorter: byAiImpactDesc,
  },
  {
    slug: 'nenshu-ai-anzen',
    titleJa: '年収が高くAIに強い仕事 TOP30',
    h1Ja: '年収が高くAIに強い仕事 TOP30',
    questionJa: '年収が高くAIに代替されにくい仕事は？',
    shortAnswerJa: '高年収とAI安全度を両立しやすいのは、AI影響度が中程度以下で、専門性・対人判断・制度上の壁がある仕事です。',
    introJa: 'AI影響度5.0以下の職業から、年収中央値が高い順に並べます。収入とAI安全度を同時に見たい人向けの入口です。',
    itemReasonJa: 'AI影響度5.0以下、年収中央値が高い順',
    selector: (occupation) => occupation.aiImpact <= 5 && occupation.salaryMan !== null,
    sorter: bySalarySafe,
  },
  {
    slug: 'nobiru-shigoto-top',
    titleJa: '伸びる可能性が高い仕事 TOP30',
    h1Ja: '伸びる可能性が高い仕事 TOP30',
    questionJa: 'これから伸びる仕事は？',
    shortAnswerJa: '求人倍率が高く、AI影響度が相対的に低い仕事は、人手不足とAI耐性が重なり、今後も需要が続きやすい候補です。',
    introJa: '求人倍率がある職業を、求人倍率の高い順に並べます。AI影響度も併記し、伸びやすさとAIによる変化の両方を確認できるようにしています。',
    itemReasonJa: '求人倍率が高い順',
    selector: (occupation) => occupation.recruitRatio !== null,
    sorter: byRecruitRatio,
  },
] as const;

export function getGeoAnswerTopicConfig(slug: string): GeoAnswerTopicConfig | null {
  return GEO_ANSWER_TOPIC_CONFIGS.find((config) => config.slug === slug) ?? null;
}

export function buildGeoAnswerTopic(facts: GeoFacts, slug: string): GeoAnswerTopicResult | null {
  const config = getGeoAnswerTopicConfig(slug);
  if (!config) return null;
  const items = facts.occupations
    .filter(config.selector)
    .sort(config.sorter)
    .slice(0, TOP_N);
  const canonical = `${SITE}/answers/${config.slug}`;
  const seoDesc = `${config.questionJa}${config.shortAnswerJa} GEO-A ${facts.occupationCount}職業データに基づくTOP${items.length}。`;
  return {
    config,
    canonical,
    seoDesc,
    items,
    jsonLd: renderGeoAnswerTopicJsonLd(facts, config, canonical, seoDesc, items),
  };
}

export function buildGeoAnswerTopics(facts: GeoFacts): readonly GeoAnswerTopicResult[] {
  return GEO_ANSWER_TOPIC_CONFIGS.map((config) => buildGeoAnswerTopic(facts, config.slug))
    .filter((topic): topic is GeoAnswerTopicResult => topic !== null);
}

function renderItemList(items: readonly GeoOccupationSummary[]) {
  return items.map((occupation, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `${SITE}/${occupation.id}`,
    name: occupation.nameJa,
    item: { '@id': `${SITE}/${occupation.id}#occupation` },
  }));
}

export function renderGeoAnswerTopicJsonLd(
  facts: GeoFacts,
  config: GeoAnswerTopicConfig,
  canonical: string,
  seoDesc: string,
  items: readonly GeoOccupationSummary[],
): string {
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: config.h1Ja,
      description: seoDesc,
      inLanguage: 'ja',
      isPartOf: { '@id': `${SITE}/#website` },
      mainEntity: { '@id': `${canonical}#itemlist` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
      datePublished: facts.attribution.runDate,
      dateModified: facts.attribution.runDate,
      publisher: { '@id': `${SITE}/#organization` },
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['.ai-fact', '.answer-lead'],
      },
    },
    {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      url: canonical,
      headline: config.h1Ja,
      description: seoDesc,
      inLanguage: 'ja',
      datePublished: facts.attribution.runDate,
      dateModified: facts.attribution.runDate,
      author: { '@id': `${SITE}/#organization` },
      publisher: { '@id': `${SITE}/#organization` },
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      isPartOf: { '@id': `${canonical}#webpage` },
      articleSection: 'AI回答トピック',
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#itemlist`,
      name: config.h1Ja,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: items.length,
      itemListElement: renderItemList(items),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '日本の職業 AI 影響マップ', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'AI回答トピック', item: `${SITE}/answers` },
        { '@type': 'ListItem', position: 3, name: config.h1Ja, item: canonical },
      ],
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

export function renderGeoAnswerIndexJsonLd(facts: GeoFacts): string {
  const canonical = `${SITE}/answers`;
  const topics = buildGeoAnswerTopics(facts);
  const graph = [
    {
      '@type': 'CollectionPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: 'AI回答トピック',
      description: 'AIでなくなる仕事、年収とAI安全度、伸びる仕事をGEO-Aデータから探す入口。',
      inLanguage: 'ja',
      isPartOf: { '@id': `${SITE}/#website` },
      mainEntity: { '@id': `${canonical}#itemlist` },
      datePublished: facts.attribution.runDate,
      dateModified: facts.attribution.runDate,
      publisher: { '@id': `${SITE}/#organization` },
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#itemlist`,
      name: 'AI回答トピック',
      numberOfItems: topics.length,
      itemListElement: topics.map((topic, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: topic.canonical,
        name: topic.config.h1Ja,
      })),
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}
