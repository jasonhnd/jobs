/**
 * src/views/occupation-jsonld.ts — Schema.org JSON-LD structured
 * data for the occupation detail page (`/{id}`).
 *
 * Step 10 reclassification (2026-05-13): moved out of src/templates/.
 * JSON-LD output is a JSON STRING (data), not HTML. Per
 * docs/architecture.md §5 "cross-cutting concern = another form of view", a
 * typed-data → serialized-data function is a view, not a template.
 *
 * Extracted from src/pages/[id].astro (`renderJsonLd` plus its
 * JsonLd* type cluster). Builds a `@graph` with up to four nodes:
 *
 *   WebPage       — page-level identity + metadata
 *   Occupation    — the canonical entity, additionalProperty bag for
 *                   AI risk, workforce size, etc.
 *   BreadcrumbList — 2-level (home → occupation)
 *   FAQPage       — optional, only when faqs are non-empty
 *
 * Returns a pretty-printed (2-space) JSON string. Consumer embeds it
 * verbatim inside `<script type="application/ld+json">…</script>`.
 *
 * Narrow input rather than the page-local Rec — the adapter at the
 * page boundary pre-resolves all fallback chains (pageName,
 * pageDesc, classificationMain, skillLabels) so the template just
 * walks a flat shape.
 */

// ─── Internal Schema.org types (private to this module) ─────────

interface JsonLdPropertyValue {
  '@type': 'PropertyValue';
  name: string;
  value: number;
  unitText?: string;
  description?: string;
  minValue?: number;
  maxValue?: number;
}

interface JsonLdMonetaryAmountDistribution {
  '@type': 'MonetaryAmountDistribution';
  name: string;
  currency: string;
  duration: string;
  median: number;
}

interface JsonLdOccupation {
  '@type': 'Occupation';
  '@id': string;
  name: string;
  description: string;
  occupationLocation: { '@type': 'Country'; name: string };
  occupationalCategory: string;
  /** Legacy parity: null mhlwUrl ships as `"sameAs": null` (JSON
   *  keeps null). Undefined drops the key. Therefore the type
   *  widens to `string | null | undefined` not `string?`. */
  sameAs: string | null | undefined;
  additionalProperty: JsonLdPropertyValue[];
  isPartOf: { '@id': string };
  alternateName?: string | string[];
  industry?: string;
  skills?: string[];
  qualifications?: string[];
  estimatedSalary?: JsonLdMonetaryAmountDistribution;
  workHours?: string;
  responsibilities?: string;
  educationRequirements?: string;
  experienceRequirements?: string;
}

interface JsonLdWebPage {
  '@type': 'WebPage';
  '@id': string;
  url: string;
  name: string;
  description: string;
  inLanguage: string;
  isPartOf: { '@id': string };
  primaryImageOfPage?: string;
  about?: { '@id': string };
  breadcrumb?: { '@id': string };
  mainEntity?: { '@id': string };
  datePublished?: string;
  dateModified?: string;
  publisher?: { '@id': string };
  author?: { '@id': string };
}

interface JsonLdBreadcrumbList {
  '@type': 'BreadcrumbList';
  '@id': string;
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }>;
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
  | JsonLdOccupation
  | JsonLdBreadcrumbList
  | JsonLdFAQPage;

// ─── Public input shape ─────────────────────────────────────────

/** Pre-resolved inputs for the occupation JSON-LD graph. Adapter
 *  flattens all fallback chains so the template walks linearly. */
export interface OccupationJsonLdInput {
  readonly id: number;
  /** Canonical absolute URL for this page, e.g.
   *  `https://mirai-shigoto.com/42`. Used as the base for all
   *  `@id` fragment URIs in the graph. */
  readonly canonical: string;
  /** Pre-resolved page title (e.g. "看護師 — AI 影響 6/10"). */
  readonly pageName: string;
  /** Pre-resolved page description, with full fallback chain
   *  already applied (definition || rationale || desc || name). */
  readonly pageDesc: string;
  readonly nameJa: string;
  readonly aliasesJa: readonly string[];
  /** Sector display name, used as Occupation.industry. Null → omit. */
  readonly sectorJa: string | null;
  readonly aiRisk: number | null;
  /** MHLW jobtag canonical URL — Occupation.sameAs. Passed through
   *  verbatim: a `null` value ships as `"sameAs": null` (kept by
   *  JSON.stringify), `undefined` drops the key entirely. The page
   *  adapter forwards `rec.url` raw to preserve this distinction. */
  readonly mhlwUrl: string | null | undefined;
  /** Annual salary in 万円 (ten-thousand yen). Multiplied by 10_000
   *  before being placed in estimatedSalary.median. */
  readonly salaryMan: number | null;
  readonly workers: number | null;
  readonly age: number | null;
  readonly hours: number | null;
  readonly recruitRatio: number | null;
  readonly hourlyWage: number | null;
  /** Pre-resolved classification (mhlw_main ?? jsoc_main ?? null).
   *  When null, occupationalCategory falls back to String(id). */
  readonly classificationMain: string | null;
  /** Pre-filtered (no null/empty) skill labels. Empty → omit. */
  readonly skillLabels: readonly string[];
  readonly relatedCertsJa: readonly string[];
  readonly tasksLeadJa: string;
  readonly howToBecomeJa: string;
  /** Pre-built FAQ Q/A tuples (already filtered for empties). */
  readonly faqs: ReadonlyArray<readonly [string, string]>;
  readonly datePublished: string;
  readonly dateModified: string;
  /** AIOIS-10 profile: the Transformation rollup (equals the headline aiRisk)
   *  plus the ten orthogonal dimensions D1–D10, each 0–10. Emitted as
   *  additionalProperty PropertyValues so the flagship multidimensional
   *  scoring is machine-readable (the page already shows it visually). null /
   *  undefined for legacy or unscored occupations → the AIOIS block is omitted.
   *  Displacement is intentionally not emitted here. */
  readonly aiois10?: {
    readonly transformation: number;
    readonly d1: number; readonly d2: number; readonly d3: number; readonly d4: number; readonly d5: number;
    readonly d6: number; readonly d7: number; readonly d8: number; readonly d9: number; readonly d10: number;
  } | null;
}

/** Canonical AIOIS-10 dimension labels (English, from docs/AIOIS-10.md §3).
 *  Used for the machine-readable additionalProperty names; the page renders
 *  the Japanese labels (see src/templates/Aiois10Profile.ts). */
const AIOIS_DIMS: ReadonlyArray<readonly [key: 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'd8' | 'd9' | 'd10', name: string]> = [
  ['d1', 'AIOIS-10 D1 · Cognitive–Generative Exposure'],
  ['d2', 'AIOIS-10 D2 · Routine–Procedural Exposure'],
  ['d3', 'AIOIS-10 D3 · Manual–Physical Demand'],
  ['d4', 'AIOIS-10 D4 · Judgment & Accountability'],
  ['d5', 'AIOIS-10 D5 · Social & Emotional Intelligence'],
  ['d6', 'AIOIS-10 D6 · Creative & Original Intelligence'],
  ['d7', 'AIOIS-10 D7 · Regulatory & Safety Barrier'],
  ['d8', 'AIOIS-10 D8 · Economic Feasibility'],
  ['d9', 'AIOIS-10 D9 · Institutional & Labor-Market Context'],
  ['d10', 'AIOIS-10 D10 · Labor-Demand Trajectory'],
];

// Static identifiers shared across all occupation pages.
const BREADCRUMB_ROOT = '日本の職業 AI 影響マップ';
const HOME_URL = 'https://mirai-shigoto.com/';
const WEBSITE_REF = 'https://mirai-shigoto.com/#website';
const ORG_REF = 'https://mirai-shigoto.com/#organization';
const DATASET_REF = 'https://mirai-shigoto.com/#dataset';

const AI_RISK_DESCRIPTION =
  'Claude Opus 4.8 による独自 LLM 推定。仕事がどれだけ AI で変わるかを表し、職が消える確率ではありません。';

export function renderOccupationJsonLd(input: OccupationJsonLdInput): string {
  const {
    id,
    canonical,
    pageName,
    pageDesc,
    nameJa,
    aliasesJa,
    sectorJa,
    aiRisk,
    mhlwUrl,
    salaryMan,
    workers,
    age,
    hours,
    recruitRatio,
    hourlyWage,
    classificationMain,
    skillLabels,
    relatedCertsJa,
    tasksLeadJa,
    howToBecomeJa,
    faqs,
    datePublished,
    dateModified,
    aiois10,
  } = input;

  // additionalProperty — AI risk + numeric stats.
  const additional: JsonLdPropertyValue[] = [];
  if (aiRisk !== null) {
    additional.push({
      '@type': 'PropertyValue',
      name: 'AI risk score (0-10)',
      value: aiRisk,
      description: AI_RISK_DESCRIPTION,
    });
  }
  if (workers) {
    additional.push({ '@type': 'PropertyValue', name: 'Workforce size', value: workers, unitText: 'persons' });
  }
  if (age) {
    additional.push({ '@type': 'PropertyValue', name: 'Average age', value: age, unitText: 'years' });
  }
  if (hours) {
    additional.push({ '@type': 'PropertyValue', name: 'Monthly working hours', value: hours, unitText: 'hours' });
  }
  if (recruitRatio !== null && recruitRatio !== undefined) {
    additional.push({ '@type': 'PropertyValue', name: 'Effective recruit ratio', value: recruitRatio });
  }
  if (hourlyWage) {
    additional.push({ '@type': 'PropertyValue', name: 'Hourly wage', value: hourlyWage, unitText: 'JPY/hour' });
  }
  // AIOIS-10 — flagship multidimensional AI-impact profile. The headline
  // `aiRisk` already equals the Transformation rollup; we additionally expose
  // Transformation explicitly plus the ten orthogonal dimensions so the
  // structured data reflects the framework the page is built around (and that
  // llms.txt consumers can read). Displacement is deliberately omitted.
  if (aiois10) {
    additional.push({
      '@type': 'PropertyValue',
      name: 'AIOIS-10 Transformation index',
      value: aiois10.transformation,
      minValue: 0,
      maxValue: 10,
      description: 'How much AI reshapes the work (mean of D1 and D2); equal to the headline AI-risk score.',
    });
    for (const [key, name] of AIOIS_DIMS) {
      additional.push({ '@type': 'PropertyValue', name, value: aiois10[key], minValue: 0, maxValue: 10 });
    }
  }

  // Occupation node — the core entity.
  const occupationNode: JsonLdOccupation = {
    '@type': 'Occupation',
    '@id': `${canonical}#occupation`,
    name: nameJa,
    description: pageDesc,
    occupationLocation: { '@type': 'Country', name: 'Japan' },
    // Fall back to the Japanese sector name (a meaningful taxonomy term) when
    // neither MHLW nor JSOC classifications are available — the previous bare
    // String(id) value emitted a numeric occupation id as the category, which
    // is meaningless to consumers of the structured-data graph.
    occupationalCategory: classificationMain ?? sectorJa ?? String(id),
    sameAs: mhlwUrl,
    additionalProperty: additional,
    isPartOf: { '@id': DATASET_REF },
  };
  if (aliasesJa.length) {
    occupationNode.alternateName = aliasesJa.length > 1 ? [...aliasesJa] : aliasesJa[0];
  }
  if (sectorJa) occupationNode.industry = sectorJa;
  if (skillLabels.length) occupationNode.skills = [...skillLabels];
  // PRESERVED LEGACY KEY ORDER: `qualifications` is assigned here
  // (before estimatedSalary) but `educationRequirements` is assigned
  // later (after responsibilities). JSON.stringify preserves object
  // insertion order, so SEO baseline byte-equivalence depends on
  // keeping these two assignments split — merging them changes the
  // key order in the rendered JSON-LD and triggers diff drift.
  if (relatedCertsJa.length) occupationNode.qualifications = [...relatedCertsJa];
  if (salaryMan) {
    occupationNode.estimatedSalary = {
      '@type': 'MonetaryAmountDistribution',
      name: 'Annual salary (estimated mean from MHLW jobtag)',
      currency: 'JPY',
      duration: 'P1Y',
      median: Math.trunc(salaryMan * 10000),
    };
  }
  if (hours) {
    const annualHours = Math.trunc(hours * 12);
    occupationNode.workHours = `月平均 ${Math.trunc(hours)} 時間（年間約 ${annualHours} 時間）`;
  }
  if (tasksLeadJa) occupationNode.responsibilities = tasksLeadJa.slice(0, 600);
  if (relatedCertsJa.length) {
    occupationNode.educationRequirements = '関連資格：' + relatedCertsJa.join('、');
  }
  if (howToBecomeJa) {
    const firstHow = howToBecomeJa.split('。')[0].trim();
    if (firstHow && firstHow.length <= 240) {
      occupationNode.experienceRequirements = `${firstHow}。`;
    }
  }

  // Build the graph.
  const graphNodes: JsonLdGraphNode[] = [
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: pageName,
      description: pageDesc,
      isPartOf: { '@id': WEBSITE_REF },
      about: { '@id': `${canonical}#occupation` },
      mainEntity: { '@id': `${canonical}#occupation` },
      primaryImageOfPage: `https://mirai-shigoto.com/api/og?id=${id}`,
      inLanguage: 'ja',
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
      datePublished,
      dateModified,
      publisher: { '@id': ORG_REF },
      author: { '@id': ORG_REF },
    },
    occupationNode,
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: BREADCRUMB_ROOT, item: HOME_URL },
        { '@type': 'ListItem', position: 2, name: nameJa, item: canonical },
      ],
    },
  ];

  if (faqs.length) {
    graphNodes.push({
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

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graphNodes }, null, 2);
}
