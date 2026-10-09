/**
 * View model for the HAID current-state page (/aiadoption and
 * /aiadoption/<release>). Pure: payload in, layout + strings out.
 *
 * The map is a treemap of humanity drawn at build time as percentages:
 *   columns  = the four relations, left → right = far → near AI, width ∝ people
 *   rows     = the levels inside a relation, top → bottom, height ∝ people
 * Relations with no data at all (同席・一体 in 2026) get a minimum column so
 * they exist on the map; a level below the minimum row height is raised to
 * it. Both are declared in `inflated` so the page can say so (docs/HAID.md
 * 確度と図示の規則). The three relation boundaries are the column edges;
 * an edge next to a 下限のみ level is drawn dashed instead of solid.
 */

import type { HaidRelationId } from '../site/haid-spec.js';
import { HAID_CANONICAL_PATH } from '../site/haid-spec.js';
import {
  HAID_RELEASE_ANCHORS_JA,
  HAID_RELEASE_DELTA_JA,
  HAID_RELEASE_FACT_JA,
  HAID_RELEASE_LEGEND_JA,
  HAID_RELEASE_LIST_JA,
  HAID_RELEASE_META_JA,
  HAID_RELEASE_PROVENANCE_JA,
  HAID_RELEASE_SEO_JA,
  fillTemplate,
} from '../site/haid-release-copy.js';
import type { PeopleJa } from '../site/haid-release-format.js';
import type { HaidReleaseCertainty } from '../data/schema/haid-release.js';
import { HAID_RELEASE_BASE_PATH, type HaidReleasePayload } from '../site/haid-release-types.js';
import {
  MAP_MIN_COLUMN_PCT,
  MAP_MIN_ROW_PCT,
  anchorRow,
  buildHaidReleaseDeltaRows,
  buildHaidReleaseHeadline,
  buildHaidReleaseLevelCards,
  buildHaidReleaseListRows,
  buildHaidReleaseMapBoundaries,
  buildHaidReleaseMapColumns,
  buildHaidReleaseMapNotes,
  buildHaidReleasePaymentText,
  buildHaidReleaseSwitcher,
  collapseEmptyProvenanceTail,
  nextQuarterLabel,
  quarterEndOf,
  releaseLabelJa,
} from './haid-release-steps.js';

export { MAP_MIN_COLUMN_PCT, MAP_MIN_ROW_PCT, releaseLabelJa };

export interface MapCell {
  readonly level: number;
  readonly id: string;             // dan-<level>
  readonly ja: string;
  readonly relation: HaidRelationId;
  readonly topPct: number;
  readonly heightPct: number;
  readonly certainty: HaidReleaseCertainty;
  readonly certaintyJa: string;
  readonly people: PeopleJa | null;     // n(k), 2 s.f.
  readonly shareJa: string | null;
  readonly inflated: boolean;
  readonly hatched: boolean;            // データなし
}

export interface MapColumn {
  readonly relation: HaidRelationId;
  readonly ja: string;
  readonly leftPct: number;
  readonly widthPct: number;
  readonly hatched: boolean;
  readonly cells: readonly MapCell[];
}

export interface MapBoundaryLine {
  readonly from: number;
  readonly to: number;
  readonly ja: string;
  readonly leftPct: number;
  readonly dashed: boolean;
}

export interface ListRow {
  readonly level: number;
  readonly id: string;             // list-<level>
  readonly ja: string;
  readonly en: string;
  readonly relation: HaidRelationId;
  readonly boundaryBefore: { readonly from: number; readonly to: number; readonly ja: string } | null;
  readonly groupStart: { readonly ja: string; readonly tagline: string; readonly range: string } | null;
  readonly barPct: number | null;       // N(≥k) / population
  readonly atLeast: PeopleJa | null;    // N(≥k), 2 s.f.
  readonly atLeastCertainty: HaidReleaseCertainty;
  readonly atLeastCertaintyJa: string;
  readonly atLeastRangeJa: string | null; // "12〜25 億" for range
  readonly exactly: PeopleJa | null;    // n(k)
  readonly exactlyLabel: string;
  readonly criterionJa: string;
  readonly windowJa: string;
  readonly methodJa: string;
  readonly anchors: readonly AnchorRow[];
  readonly clamped: boolean;
  readonly definitionHref: string;
}

export interface AnchorRow {
  readonly id: string;
  readonly stale: boolean;
  readonly kind: 'product' | 'union' | 'top_down' | 'base';
  readonly marketJa: string;
  readonly entityJa: string;
  readonly metricJa: string;
  readonly valueJa: string;
  readonly asOf: string;
  readonly grade: string;
  readonly gradeJa: string;
  readonly sourceName: string;
  readonly sourceUrl: string | null;
  readonly placeholder: boolean;
}

export interface DeltaRow {
  readonly level: number;
  readonly ja: string;
  readonly previous: PeopleJa | null;
  readonly now: PeopleJa | null;
  /** signed people difference; null when not comparable */
  readonly delta: number | null;
  readonly deltaJa: string;       // "+1.2 億" / "−5.8 億" / label
  readonly kind: 'up' | 'down' | 'flat' | 'method' | 'none';
  readonly kindJa: string;
}

export interface ReleaseSwitchItem {
  readonly release: string;
  readonly labelJa: string;
  readonly href: string;
  readonly current: boolean;
  readonly latest: boolean;
}

export interface ProvenanceInput {
  readonly id: string;
  readonly entityJa: string;
  readonly metricJa: string;
  readonly valueJa: string;       // "10 億"
  readonly grade: 'A' | 'B' | 'C' | 'D';
  /** shown only when the level is split by market */
  readonly marketJa: string | null;
  readonly kind: 'product' | 'union' | 'top_down' | 'base';
  /** "古い" / "7 日口径" */
  readonly flags: readonly string[];
  /** the term the method actually took (max_single) */
  readonly picked: boolean;
}

export interface ProvenanceStep {
  readonly label: string;
  readonly text: string;
}

export interface ProvenanceRange {
  readonly lowJa: string;
  readonly highJa: string;
  readonly midJa: string;
  readonly lowFromJa: string;
  readonly highFromJa: string;
  readonly midRuleJa: string;
  /** 0–100, position of mid between low and high */
  readonly midPct: number;
}

export interface ProvenanceCard {
  /** first level of the card; 7 for the 7〜10 group */
  readonly level: number;
  readonly levels: readonly number[];
  readonly levelJa: string;        // "第 4 段階" / "第 7〜10 段階"
  readonly ja: string;             // level name; '' for the group
  readonly certainty: HaidReleaseCertainty;
  readonly certaintyJa: string;
  readonly howJa: string;
  readonly inputs: readonly ProvenanceInput[];
  /** inputs grouped by market when the level is split; one unlabeled group otherwise */
  readonly inputGroups: readonly { readonly labelJa: string | null; readonly items: readonly ProvenanceInput[] }[];
  readonly steps: readonly ProvenanceStep[];
  readonly range: ProvenanceRange | null;
  readonly atLeastLabelJa: string; // "N(≥4)"
  readonly atLeastJa: string;      // "15 億" / "20 億+" / "—"
  readonly exactlyJa: string | null; // "ちょうどこの段階 n(4) = …"
  readonly notes: readonly string[];
}

export interface HaidReleasePageModel {
  readonly release: string;
  readonly round: number;
  readonly provenance: { readonly heading: string; readonly intro: string; readonly rules: readonly string[]; readonly cards: readonly ProvenanceCard[]; readonly cols: { readonly inputs: string; readonly calc: string; readonly result: string } };
  readonly isLatest: boolean;
  readonly switcher: { readonly label: string; readonly items: readonly ReleaseSwitchItem[]; readonly permalink: string };
  readonly labelJa: string;
  readonly version: string;
  readonly isDraft: boolean;
  readonly asOf: string;
  readonly path: string;
  readonly canonicalPath: string;
  readonly specVersion: string;
  readonly specHref: string;
  readonly h1: string;
  readonly lead: { readonly before: string; readonly population: PeopleJa; readonly middle: string; readonly prompted: PeopleJa; readonly after: string };
  readonly metaParts: readonly string[];
  readonly draftNote: string | null;
  readonly legend: { readonly area: string; readonly relations: readonly { readonly id: HaidRelationId; readonly ja: string; readonly hatched: boolean }[]; readonly hatch: string; readonly axis: string };
  readonly map: { readonly columns: readonly MapColumn[]; readonly boundaries: readonly MapBoundaryLine[]; readonly notes: readonly string[] };
  readonly list: { readonly heading: string; readonly intro: string; readonly rows: readonly ListRow[]; readonly levelsNote: string; readonly paymentNote: string };
  readonly delta: { readonly heading: string; readonly body: string; readonly rows: readonly DeltaRow[]; readonly cols: { readonly level: string; readonly previous: string; readonly now: string; readonly delta: string } };
  readonly anchorsTable: { readonly heading: string; readonly intro: string; readonly rows: readonly AnchorRow[] };
  readonly fact: { readonly label: string; readonly body: string };
  readonly seo: { readonly title: string; readonly description: string; readonly ogTitle: string; readonly ogDescription: string; readonly keywords: string };
}

/** Release id → 日本語ラベル for the switcher (the page reads the other payloads' label_ja). */
export type ReleaseLabels = Readonly<Record<string, string>>;

export function buildHaidReleasePageModel(
  p: HaidReleasePayload,
  levelsNoteJa: string,
  labels: ReleaseLabels = {},
): HaidReleasePageModel {
  const byLevel = new Map(p.levels.map((l) => [l.level, l]));
  const anchorById = new Map(p.anchors.map((a) => [a.id, a]));
  const { columns, inflated } = buildHaidReleaseMapColumns(p);
  const boundaries = buildHaidReleaseMapBoundaries(columns, byLevel);
  const notes = buildHaidReleaseMapNotes(p, columns, boundaries, inflated, byLevel);
  const rows = buildHaidReleaseListRows(p, byLevel, anchorById);
  const {
    before,
    middle,
    after,
    populationJa,
    promptedJa,
    metaParts,
    factValues,
  } = buildHaidReleaseHeadline(p, byLevel);
  const { isLatest, switcher } = buildHaidReleaseSwitcher(p, labels);
  const provenanceCards = collapseEmptyProvenanceTail(buildHaidReleaseLevelCards(byLevel));
  const deltaRows = buildHaidReleaseDeltaRows(p, byLevel, anchorById);
  const payment = buildHaidReleasePaymentText(p);
  const P = HAID_RELEASE_PROVENANCE_JA;
  const seoValues = { label: p.label_ja, population: factValues.population, prompted: factValues.prompted };

  return {
    release: p.release,
    round: p.round,
    provenance: {
      heading: P.heading,
      intro: P.intro,
      rules: P.rules,
      cards: provenanceCards,
      cols: { inputs: P.colInputs, calc: P.colCalc, result: P.colResult },
    },
    isLatest,
    switcher,
    labelJa: p.label_ja,
    version: p.version,
    isDraft: p.status === 'draft',
    asOf: p.as_of,
    path: `${HAID_RELEASE_BASE_PATH}/${p.release}`,
    canonicalPath: isLatest ? HAID_RELEASE_BASE_PATH : `${HAID_RELEASE_BASE_PATH}/${p.release}`,
    specVersion: p.spec_version,
    specHref: HAID_CANONICAL_PATH,
    h1: '人類と AI の距離',
    lead: { before, population: populationJa, middle, prompted: promptedJa, after },
    metaParts,
    draftNote: p.status === 'draft' ? HAID_RELEASE_META_JA.draftNote : null,
    legend: {
      area: fillTemplate(HAID_RELEASE_LEGEND_JA.area, { population: factValues.population }),
      relations: columns.map((c) => ({ id: c.relation, ja: c.ja, hatched: c.hatched })),
      hatch: HAID_RELEASE_LEGEND_JA.hatch,
      axis: HAID_RELEASE_LEGEND_JA.axis,
    },
    map: { columns, boundaries, notes },
    list: {
      heading: HAID_RELEASE_LIST_JA.heading,
      intro: HAID_RELEASE_LIST_JA.intro,
      rows,
      levelsNote: levelsNoteJa,
      paymentNote: fillTemplate(HAID_RELEASE_LIST_JA.payment, { payment }),
    },
    delta: {
      heading: HAID_RELEASE_DELTA_JA.heading,
      body: p.previous === null
        ? fillTemplate(HAID_RELEASE_DELTA_JA.first, { next: nextQuarterLabel(p.release) })
        : fillTemplate(HAID_RELEASE_DELTA_JA.intro, { previous: labels[p.previous] ?? releaseLabelJa(p.previous) }),
      rows: deltaRows,
      cols: { level: HAID_RELEASE_DELTA_JA.colLevel, previous: HAID_RELEASE_DELTA_JA.colPrevious, now: HAID_RELEASE_DELTA_JA.colNow, delta: HAID_RELEASE_DELTA_JA.colDelta },
    },
    anchorsTable: {
      heading: HAID_RELEASE_ANCHORS_JA.heading,
      intro: HAID_RELEASE_ANCHORS_JA.intro,
      rows: p.anchors.map((a) => anchorRow(a, quarterEndOf(p.release))),
    },
    fact: {
      label: fillTemplate(HAID_RELEASE_FACT_JA.label, { label: p.label_ja }),
      body: fillTemplate(byLevel.get(5)!.n_at_least.certainty === 'none' ? HAID_RELEASE_FACT_JA.bodyNoWeekly : HAID_RELEASE_FACT_JA.body, factValues),
    },
    seo: {
      title: fillTemplate(HAID_RELEASE_SEO_JA.title, seoValues),
      description: fillTemplate(HAID_RELEASE_SEO_JA.description, seoValues),
      ogTitle: fillTemplate(HAID_RELEASE_SEO_JA.ogTitle, seoValues),
      ogDescription: fillTemplate(HAID_RELEASE_SEO_JA.ogDescription, seoValues),
      keywords: HAID_RELEASE_SEO_JA.keywords,
    },
  };
}
