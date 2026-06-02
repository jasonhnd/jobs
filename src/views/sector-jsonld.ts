/**
 * src/views/sector-jsonld.ts — Schema.org JSON-LD structured
 * data for the sector hub page (`/sectors/{sector}`).
 *
 * Step 10 reclassification (2026-05-13): moved out of src/templates/
 * with src/views/occupation-jsonld.ts — JSON-LD is data, not HTML,
 * so it belongs in the view layer per architecture.md §5.
 *
 * Sister of src/views/occupation-jsonld (occupation detail). Builds a
 * `@graph` with 4 fixed nodes:
 *
 *   WebPage        — page identity
 *   Article        — content classification (articleSection: セクター)
 *   BreadcrumbList — 3-level (home → sectors → this sector)
 *   ItemList       — every occupation in the sector
 *
 * Plus an optional 5th FAQPage when `faqs` is non-empty.
 *
 * Returns a pretty-printed (2-space) JSON string consumed by
 * `<script type="application/ld+json">`.
 */

// ─── Internal Schema.org types ───────────────────────────────

interface JsonLdListItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  url?: string;
  item?: string;
}

interface JsonLdWebPage {
  '@type': 'WebPage';
  '@id': string;
  url: string;
  name: string;
  description: string;
  inLanguage: string;
  isPartOf: { '@id': string };
  datePublished: string;
  dateModified: string;
  publisher: { '@id': string };
  breadcrumb: { '@id': string };
}

interface JsonLdArticle {
  '@type': 'Article';
  '@id': string;
  headline: string;
  description: string;
  image: string;
  url: string;
  datePublished: string;
  dateModified: string;
  author: { '@id': string };
  publisher: { '@id': string };
  inLanguage: string;
  mainEntityOfPage: { '@id': string };
  isPartOf: { '@id': string };
  articleSection: string;
}

interface JsonLdBreadcrumbList {
  '@type': 'BreadcrumbList';
  '@id': string;
  itemListElement: JsonLdListItem[];
}

interface JsonLdItemList {
  '@type': 'ItemList';
  '@id': string;
  name: string;
  numberOfItems: number;
  itemListOrder: string;
  itemListElement: JsonLdListItem[];
}

interface JsonLdFAQPage {
  '@type': 'FAQPage';
  '@id': string;
  inLanguage: string;
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: { '@type': 'Answer'; text: string };
  }>;
}

type JsonLdGraphNode =
  | JsonLdWebPage
  | JsonLdArticle
  | JsonLdBreadcrumbList
  | JsonLdItemList
  | JsonLdFAQPage;

// ─── Public input shape ──────────────────────────────────────

/** One occupation entry inside the ItemList node. */
export interface SectorJsonLdOccupation {
  readonly id: number;
  /** Empty / null → falls back to "#{id}" inside ListItem.name. */
  readonly titleJa: string | null;
}

/** Pre-resolved inputs for the sector hub JSON-LD graph. */
export interface SectorJsonLdInput {
  /** Canonical absolute URL for this sector page. */
  readonly canonical: string;
  /** Sector display name in Japanese, e.g. "医療". */
  readonly nameJa: string;
  /** Sector id, used to build the OG image URL. */
  readonly sectorId: string;
  /** Site origin (https://mirai-shigoto.com — passed in to keep
   *  the template host-agnostic for staging environments). */
  readonly siteOrigin: string;
  /** Number of occupations in this sector. */
  readonly occupationCount: number;
  /** Every occupation in the sector (sorted by the caller). */
  readonly occupations: ReadonlyArray<SectorJsonLdOccupation>;
  /** Pre-built FAQ Q/A tuples; empty → FAQPage node skipped. */
  readonly faqs: ReadonlyArray<readonly [string, string]>;
  /** Breadcrumb leaf labels — passed in so the i18n boundary
   *  stays at the page. */
  readonly breadcrumbRoot: string;
  readonly breadcrumbSectors: string;
  readonly datePublished: string;
  readonly dateModified: string;
}

const ARTICLE_SECTION = 'セクター';
const ITEM_LIST_ORDER = 'https://schema.org/ItemListOrderDescending';

export function renderSectorJsonLd(input: SectorJsonLdInput): string {
  const {
    canonical, nameJa, sectorId, siteOrigin, occupationCount, occupations, faqs,
    breadcrumbRoot, breadcrumbSectors, datePublished, dateModified,
  } = input;

  const pageDesc = `${nameJa} 業界の ${occupationCount} 職業を AI 影響度・年収・就業者数で一覧。`;

  const itemListElement: JsonLdListItem[] = occupations.map((o, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${siteOrigin}/${o.id}`,
    name: o.titleJa || `#${o.id}`,
  }));

  const graph: JsonLdGraphNode[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: `${nameJa} の職業一覧`,
      description: pageDesc,
      isPartOf: { '@id': `${siteOrigin}/#website` },
      inLanguage: 'ja',
      datePublished,
      dateModified,
      publisher: { '@id': `${siteOrigin}/#organization` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
    },
    {
      '@type': 'Article',
      '@id': `${canonical}#article`,
      headline: `${nameJa} の職業 — ${occupationCount}職業の AI 影響度・年収・就業者数`,
      description: pageDesc,
      image: `${siteOrigin}/api/og?sector=${sectorId}`,
      url: canonical,
      datePublished,
      dateModified,
      author: { '@id': `${siteOrigin}/#organization` },
      publisher: { '@id': `${siteOrigin}/#organization` },
      inLanguage: 'ja',
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      isPartOf: { '@id': `${canonical}#webpage` },
      articleSection: ARTICLE_SECTION,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: breadcrumbRoot, item: `${siteOrigin}/` },
        { '@type': 'ListItem', position: 2, name: breadcrumbSectors, item: `${siteOrigin}/sectors` },
        { '@type': 'ListItem', position: 3, name: nameJa, item: canonical },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${canonical}#occupations`,
      name: `${nameJa} の職業`,
      numberOfItems: itemListElement.length,
      itemListOrder: ITEM_LIST_ORDER,
      itemListElement,
    },
  ];

  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      inLanguage: 'ja',
      mainEntity: faqs.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}
