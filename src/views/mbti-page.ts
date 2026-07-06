import type { KnowledgeGraph, OccupationNode } from '@/graph';
import { asOccupationId } from '@/graph';
import { siteConfig } from '@/site/config';
import {
  PHASE1_MBTI_CONTENT,
  type MbtiContent,
} from './mbti-content.js';

const AIOIS_CAVEAT_JA =
  'AI影響度は AIOIS-10 に基づくモデル出力であり、統計的な将来予測ではありません。';

const PAGE_GUARDRAIL_JA =
  'このページは MBTI タイプを入口にした編集コンテンツです。性格検査、採用判定、適職保証ではありません。職業例は、仕事の特徴と AIOIS-10 の AI 影響度を見比べるための案内です。';

export interface MbtiOccupationCardView {
  readonly id: number;
  readonly nameJa: string;
  readonly sectorJa: string | null;
  readonly transformation: number;
  readonly displacement: number | null;
  readonly reasonJa: string;
}

export interface MbtiPageView {
  readonly content: MbtiContent;
  readonly canonical: string;
  readonly title: string;
  readonly description: string;
  readonly occupations: readonly MbtiOccupationCardView[];
  readonly aioisCaveatJa: string;
  readonly pageGuardrailJa: string;
  readonly jsonLd: string;
}

export function buildPhase1MbtiStaticPaths(graph: KnowledgeGraph) {
  return PHASE1_MBTI_CONTENT.map((content) => ({
    params: { type: content.slug },
    props: { page: buildMbtiPageView(content, graph) },
  }));
}

export function buildMbtiPageView(content: MbtiContent, graph: KnowledgeGraph): MbtiPageView {
  const canonical = `${siteConfig.origin}/mbti/${content.slug}`;
  const occupations = content.occupations.map((item) => {
    const id = asOccupationId(item.occupationId);
    const occupation = graph.occupations.get(id);
    if (!occupation) {
      throw new Error(`[mbti-page] ${content.slug}: occupation ${item.occupationId} is missing from graph`);
    }
    const aiois = occupation.aiRisk?.aiois;
    if (!aiois) {
      throw new Error(`[mbti-page] ${content.slug}: occupation ${item.occupationId} is missing active AIOIS-10`);
    }
    return {
      id: item.occupationId,
      nameJa: occupationName(occupation),
      sectorJa: sectorName(graph, id),
      transformation: aiois.transformation,
      displacement: aiois.displacement,
      reasonJa: item.reasonJa,
    };
  });

  return {
    content,
    canonical,
    title: content.seo.titleJa,
    description: content.seo.descriptionJa,
    occupations,
    aioisCaveatJa: AIOIS_CAVEAT_JA,
    pageGuardrailJa: PAGE_GUARDRAIL_JA,
    jsonLd: safeJsonForScript(buildMbtiJsonLd(content, canonical)),
  };
}

function occupationName(occupation: OccupationNode): string {
  return occupation.titleJa || `職業 ${Number(occupation.id)}`;
}

function sectorName(graph: KnowledgeGraph, occupationId: ReturnType<typeof asOccupationId>): string | null {
  const sectorId = graph.sectorOf(occupationId);
  if (!sectorId) return null;
  return graph.sectors.get(sectorId)?.nameJa ?? null;
}

function buildMbtiJsonLd(content: MbtiContent, canonical: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: content.knownTypeFraming.h1Ja,
        description: content.seo.descriptionJa,
        inLanguage: 'ja',
        isPartOf: { '@id': `${siteConfig.origin}/#website` },
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: siteConfig.siteName,
            item: `${siteConfig.origin}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'MBTIタイプ x AI時代の働き方',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: content.knownTypeFraming.h1Ja,
            item: canonical,
          },
        ],
      },
    ],
  };
}

function safeJsonForScript(value: unknown): string {
  const text = JSON.stringify(value) ?? 'null';
  return text
    .replace(/<\//g, '<\\/')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
