/**
 * src/pages/sectors/_sectors-index-bindings.ts — bindings for sectors/index.astro.
 * Phase D audit #7 (2026-05-14): page frontmatter ≤30 lines per doc §2.5.
 */
import type { KnowledgeGraph } from '@/graph';
import { sectorIndexView, type SectorIndexEntry } from '@/views/sector';
import { OCCUPATION_COUNT } from '@/site/config';
import { SCORE_ATTRIBUTION } from '@/site/score-attribution';
import { CONTENT_DATE } from '@/lib/_content-date';

const SITE = 'https://mirai-shigoto.com';

export interface SectorsIndexBindings {
  readonly sectors: ReadonlyArray<SectorIndexEntry>;
  readonly canonical: string;
  readonly pageTitle: string;
  readonly ogTitle: string;
  readonly seoDesc: string;
  readonly keywords: string;
  readonly h1: string;
  readonly hList: string;
  readonly crumbRoot: string;
  readonly crumbSelf: string;
  readonly skipLabel: string;
  readonly jsonLd: string;
  /** OCCUPATION_COUNT.SCORED — user-facing occupation count. */
  readonly totalOcc: number;
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Math.trunc(n).toLocaleString('en-US');
}

export function riskClass(mean: number): 'low' | 'mid' | 'high' {
  if (mean <= 3.5) return 'low';
  if (mean >= 6.5) return 'high';
  return 'mid';
}

export function buildSectorsIndexBindings(graph: KnowledgeGraph): SectorsIndexBindings {
  const view = sectorIndexView(graph);
  const sectors = view.sectors;
  const totalOcc = view.totalOccupations;
  const canonical = `${SITE}/sectors`;
  // RA-003 (2026-05-18): user-facing copy uses OCCUPATION_COUNT.SCORED
  // (the 556 AI-scored occupations users see on the map) rather than the
  // raw 556 IPD dataset count, so adjacent pages don't disagree.
  const pageTitle = `全 16 業種｜${OCCUPATION_COUNT.SCORED} 職業を業界別に分類 | 未来の仕事`;
  const ogTitle = '全 16 業種｜業界別 職業ランキング・AI 影響度・年収';
  const seoDesc =
    `日本の${totalOcc}職業を 16 業界（医療・保健、IT・通信、士業、製造、建設 ほか）に分類。` +
    `業界別の AI 影響度ランキング・就業者数・年収・代表職業を一覧。${SCORE_ATTRIBUTION.modelDisplay} 独自分析（非公式）。`;
  const keywords = `業界別 職業, 業界 ランキング, AI 影響 業界, 仕事 業界, ${OCCUPATION_COUNT.SCORED} 職業, 業種`;
  const h1 = '全 16 業種';
  const hList = '業界 一覧';
  const crumbRoot = '未来の仕事';
  const crumbSelf = '業種';
  const skipLabel = '本文へスキップ';
  const itemList = sectors.map((s, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE}/sectors/${s.id}`,
    name: s.ja,
  }));
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: h1,
        description: seoDesc,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'ja',
        datePublished: '2026-05-05',
        dateModified: CONTENT_DATE,
        publisher: { '@id': `${SITE}/#organization` },
        breadcrumb: { '@id': `${canonical}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: crumbRoot, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: crumbSelf, item: canonical },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${canonical}#sectors`,
        name: hList,
        numberOfItems: sectors.length,
        itemListElement: itemList,
      },
    ],
  }, null, 2);
  return {
    sectors, canonical, pageTitle, ogTitle, seoDesc, keywords,
    h1, hList, crumbRoot, crumbSelf, skipLabel, jsonLd,
    totalOcc: OCCUPATION_COUNT.SCORED,
  };
}
