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
import {
  HAID_BOUNDARIES,
  HAID_CANONICAL_PATH,
  HAID_CERTAINTY_JA,
  HAID_GRADE_JA,
  HAID_LEVELS,
  HAID_RELATIONS,
  haidBoundaryBefore,
  type HaidRelationId,
} from '../site/haid-spec.js';
import {
  HAID_RELEASE_ANCHORS_JA,
  HAID_RELEASE_DELTA_JA,
  HAID_RELEASE_SWITCH_JA,
  HAID_RELEASE_FACT_JA,
  HAID_RELEASE_LEAD_TEMPLATE_JA,
  HAID_RELEASE_LEGEND_JA,
  HAID_RELEASE_LIST_JA,
  HAID_RELEASE_MAP_NOTE_JA,
  HAID_RELEASE_META_JA,
  HAID_RELEASE_PROVENANCE_JA,
  HAID_RELEASE_SEO_JA,
  fillTemplate,
} from '../site/haid-release-copy.js';
import { formatPeopleJa, formatPeopleJaText, formatShareJa, type PeopleJa } from '../site/haid-release-format.js';
import type { HaidReleaseCertainty } from '../data/schema/haid-release.js';
import { HAID_RELEASE_BASE_PATH, type HaidReleasePayload } from '../site/haid-release-types.js';

/** Minimum width (%) for a relation column with no data, and minimum row height (%). */
export const MAP_MIN_COLUMN_PCT = 4;
export const MAP_MIN_ROW_PCT = 6;

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

const HEADLINE_SIG = 1;
const TABLE_SIG = 2;

function quarterEndOf(release: string): string {
  const m = /^(\d{4})-q([1-4])$/.exec(release);
  if (!m) return '9999-12-31';
  const q = Number(m[2]);
  const month = q * 3;
  return `${m[1]}-${String(month).padStart(2, '0')}-${q === 1 || q === 4 ? 31 : 30}`;
}

function nextQuarterLabel(release: string): string {
  const m = /^(\d{4})-q([1-4])$/.exec(release);
  if (!m) return release;
  const y = Number(m[1]);
  const q = Number(m[2]);
  return q === 4 ? `${y + 1}-Q1` : `${y}-Q${q + 1}`;
}

function levelListJa(levels: readonly number[]): string {
  // "第 6 段階と第 7〜10 段階" — collapse consecutive runs.
  const runs: Array<[number, number]> = [];
  for (const l of [...levels].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && last[1] === l - 1) last[1] = l;
    else runs.push([l, l]);
  }
  return runs.map(([a, b]) => (a === b ? `第 ${a} 段階` : `第 ${a}〜${b} 段階`)).join('と');
}

/** Release id → 日本語ラベル for the switcher (the page reads the other payloads' label_ja). */
export type ReleaseLabels = Readonly<Record<string, string>>;

export function releaseLabelJa(release: string): string {
  const m = /^(\d{4})-q([1-4])$/.exec(release);
  return m ? `${m[1]} 年 第 ${m[2]} 四半期` : release;
}

export function buildHaidReleasePageModel(
  p: HaidReleasePayload,
  levelsNoteJa: string,
  labels: ReleaseLabels = {},
): HaidReleasePageModel {
  const population = p.population;
  const byLevel = new Map(p.levels.map((l) => [l.level, l]));
  const anchorById = new Map(p.anchors.map((a) => [a.id, a]));
  const inflated: number[] = [];

  // ── map columns ──
  const relationPeople = HAID_RELATIONS.map((r) => {
    const levels = p.levels.filter((l) => l.relation === r.id);
    const people = levels.reduce((acc, l) => acc + (l.n.display ?? 0), 0);
    const hatched = levels.every((l) => l.n.certainty === 'none');
    return { r, levels, people, hatched };
  });
  const hatchedCount = relationPeople.filter((x) => x.hatched).length;
  const dataWidth = 100 - hatchedCount * MAP_MIN_COLUMN_PCT;
  const dataPeople = relationPeople.filter((x) => !x.hatched).reduce((acc, x) => acc + x.people, 0);

  let left = 0;
  const columns: MapColumn[] = relationPeople.map(({ r, levels, people, hatched }) => {
    const widthPct = hatched ? MAP_MIN_COLUMN_PCT : (people / dataPeople) * dataWidth;
    // rows
    const rowsRaw = levels.map((l) => ({
      l,
      pct: hatched ? 100 / levels.length : people > 0 ? ((l.n.display ?? 0) / people) * 100 : 100 / levels.length,
    }));
    let raised = 0;
    for (const row of rowsRaw) {
      if (!hatched && row.pct < MAP_MIN_ROW_PCT) {
        raised += MAP_MIN_ROW_PCT - row.pct;
        row.pct = MAP_MIN_ROW_PCT;
        inflated.push(row.l.level);
      }
    }
    if (raised > 0) {
      const big = rowsRaw.filter((row) => row.pct > MAP_MIN_ROW_PCT);
      const bigSum = big.reduce((acc, row) => acc + row.pct, 0);
      for (const row of big) row.pct -= raised * (row.pct / bigSum);
    }
    if (hatched) for (const row of rowsRaw) inflated.push(row.l.level);
    let top = 0;
    const cells: MapCell[] = rowsRaw.map((row) => {
      const cell: MapCell = {
        level: row.l.level,
        id: `dan-${row.l.level}`,
        ja: row.l.ja,
        relation: r.id,
        topPct: top,
        heightPct: row.pct,
        certainty: row.l.n.certainty,
        certaintyJa: HAID_CERTAINTY_JA[row.l.n.certainty],
        people: row.l.n.certainty === 'none' || row.l.n.display === null ? null : formatPeopleJa(row.l.n.display, TABLE_SIG),
        shareJa: row.l.n.certainty === 'none' || row.l.n.share === null ? null : formatShareJa(row.l.n.share),
        inflated: inflated.includes(row.l.level),
        hatched: row.l.n.certainty === 'none',
      };
      top += row.pct;
      return cell;
    });
    const col: MapColumn = { relation: r.id, ja: r.ja, leftPct: left, widthPct, hatched, cells };
    left += widthPct;
    return col;
  });

  const boundaries: MapBoundaryLine[] = HAID_BOUNDARIES.map((b) => {
    const col = columns.find((c) => c.cells.some((cell) => cell.level === b.to));
    const dashed =
      byLevel.get(b.from)?.n_at_least.certainty === 'lower_bound' || byLevel.get(b.to)?.n_at_least.certainty === 'lower_bound';
    return { from: b.from, to: b.to, ja: b.ja, leftPct: col?.leftPct ?? 0, dashed };
  });

  const notes: string[] = [];
  const inflatedSorted = [...new Set(inflated)].sort((a, b) => a - b);
  if (inflatedSorted.length > 0) {
    // Name the two reasons separately: a tiny level (drawn at the minimum
    // row) and the data-less levels (drawn at the minimum column).
    const hatchedLevels = new Set(columns.filter((c) => c.hatched).flatMap((c) => c.cells.map((cell) => cell.level)));
    const tiny = inflatedSorted.filter((l) => !hatchedLevels.has(l));
    const dataless = inflatedSorted.filter((l) => hatchedLevels.has(l));
    const parts = [tiny, dataless].filter((g) => g.length > 0).map(levelListJa);
    notes.push(fillTemplate(HAID_RELEASE_MAP_NOTE_JA.inflated, { levels: parts.join('と') }));
  }
  for (const b of boundaries) {
    if (b.dashed) {
      const lb = byLevel.get(b.to)?.n_at_least.certainty === 'lower_bound' ? b.to : b.from;
      notes.push(fillTemplate(HAID_RELEASE_MAP_NOTE_JA.lowerBound, { level: String(lb) }));
    }
  }
  for (const l of p.levels) {
    if (l.n_at_least.clamped) {
      notes.push(fillTemplate(HAID_RELEASE_MAP_NOTE_JA.clamped, { level: String(l.level), next: String(l.level + 1) }));
    }
  }

  // ── list rows ──
  const rows: ListRow[] = HAID_LEVELS.map((spec) => {
    const l = byLevel.get(spec.level)!;
    const rel = HAID_RELATIONS.find((r) => r.id === spec.relation)!;
    const b = haidBoundaryBefore(spec.level);
    const isGroupStart = rel.levels[0] === spec.level;
    const d = l.n_at_least.display;
    const rangeJa =
      l.n_at_least.certainty === 'range' && l.n_at_least.low !== null && l.n_at_least.high !== null
        ? `${formatPeopleJaText(l.n_at_least.low, TABLE_SIG)}〜${formatPeopleJaText(l.n_at_least.high, TABLE_SIG)}`
        : null;
    return {
      level: spec.level,
      id: `list-${spec.level}`,
      ja: spec.ja,
      en: spec.en,
      relation: spec.relation,
      boundaryBefore: b ? { from: b.from, to: b.to, ja: b.ja } : null,
      groupStart: isGroupStart ? { ja: rel.ja, tagline: rel.tagline_ja, range: `第 ${rel.levels[0]}〜${rel.levels[1]} 段階` } : null,
      barPct: d === null ? null : (d / population) * 100,
      atLeast: d === null ? null : formatPeopleJa(d, TABLE_SIG),
      atLeastCertainty: l.n_at_least.certainty,
      atLeastCertaintyJa: HAID_CERTAINTY_JA[l.n_at_least.certainty],
      atLeastRangeJa: rangeJa,
      exactly: l.n.certainty === 'none' || l.n.display === null ? null : formatPeopleJa(l.n.display, TABLE_SIG),
      exactlyLabel: fillTemplate(HAID_RELEASE_LIST_JA.exactly, { level: String(spec.level) }),
      criterionJa: spec.criterion_ja,
      windowJa: spec.window_ja,
      methodJa: l.method_ja,
      anchors: l.anchors.map((id) => anchorRow(anchorById.get(id)!)),
      clamped: l.n_at_least.clamped,
      definitionHref: `${HAID_CANONICAL_PATH}#level-${spec.level}`,
    };
  });

  // ── headline figures ──
  const promptedRaw = byLevel.get(4)!.n_at_least.display ?? 0;
  const weeklyRaw = byLevel.get(5)!.n_at_least.display ?? 0;
  const unreachedRaw = byLevel.get(1)!.n.display ?? 0;
  const populationJa = formatPeopleJa(population, TABLE_SIG);
  const promptedJa = formatPeopleJa(promptedRaw, HEADLINE_SIG);
  const leadTemplate = HAID_RELEASE_LEAD_TEMPLATE_JA;
  const [before, rest] = leadTemplate.split('{population}');
  const [middle, after] = rest.split('{prompted}');

  const metaParts = [
    p.label_ja,
    fillTemplate(HAID_RELEASE_META_JA.asOf, { asOf: p.as_of }),
    p.published_at
      ? fillTemplate(HAID_RELEASE_META_JA.published, { published: p.published_at })
      : fillTemplate(HAID_RELEASE_META_JA.plannedPublish, { planned: p.planned_publish }),
    fillTemplate(HAID_RELEASE_META_JA.round, { n: String(p.round) }),
    fillTemplate(HAID_RELEASE_META_JA.spec, { version: p.spec_version }),
  ];

  // ── release switcher ──
  const latestId = [...p.releases].sort().at(-1) ?? p.release;
  const isLatest = p.release === latestId;
  const switcher = {
    label: HAID_RELEASE_SWITCH_JA.label,
    permalink: HAID_RELEASE_SWITCH_JA.permalink,
    items: [...p.releases].sort().reverse().map((id) => ({
      release: id,
      labelJa: id === p.release ? p.label_ja : labels[id] ?? releaseLabelJa(id),
      href: id === latestId ? HAID_RELEASE_BASE_PATH : `${HAID_RELEASE_BASE_PATH}/${id}`,
      current: id === p.release,
      latest: id === latestId,
    })),
  };

  // ── 数字の出どころと計算 ──
  const P = HAID_RELEASE_PROVENANCE_JA;
  const people = (v: number) => formatPeopleJaText(v, TABLE_SIG);
  const pct = (r: number) => `${Math.round(r * 1000) / 10}%`;
  const marketJa = (m: string) => (m === 'cn' ? P.marketCn : m === 'row' ? P.marketRow : P.marketWorld);
  const midPct = (low: number, mid: number, high: number) => (high <= low ? 50 : Math.round(Math.min(100, Math.max(0, ((mid - low) / (high - low)) * 100)) * 10) / 10);
  const levelCards: ProvenanceCard[] = HAID_LEVELS.map((spec, i) => {
    const l = byLevel.get(spec.level)!;
    const d = l.derivation;
    const split = d.method === 'market_union_topdown';
    const inputs: ProvenanceInput[] = d.terms.map((t) => ({
      id: t.id,
      entityJa: t.entity_ja,
      metricJa: t.metric_ja,
      valueJa: people(t.value),
      grade: t.grade,
      marketJa: split ? marketJa(t.market) : null,
      kind: t.kind,
      flags: [...(t.stale ? [P.flagStale] : []), ...(t.narrower_window ? [P.flagWeekly] : [])],
      picked: d.method === 'max_single' && t.value === d.max,
    }));
    const inputGroups: { labelJa: string | null; items: ProvenanceInput[] }[] = [];
    for (const t of inputs) {
      const g = inputGroups.find((x) => x.labelJa === t.marketJa);
      if (g) g.items.push(t);
      else inputGroups.push({ labelJa: t.marketJa, items: [t] });
    }
    const steps: ProvenanceStep[] = [];
    let range: ProvenanceRange | null = null;
    let howJa: string;
    switch (d.method) {
      case 'single':
        howJa = P.howSingle;
        break;
      case 'max_single': {
        const maxTerm = d.terms.find((t) => t.value === d.max)!;
        howJa = fillTemplate(P.howMaxSingle, { count: String(d.terms.length) });
        steps.push({ label: P.stepPicked, text: fillTemplate(P.stepPickedText, { term: `${maxTerm.entity_ja} ${maxTerm.metric_ja}`, max: people(d.max!) }) });
        break;
      }
      case 'sum_minus_overlap':
        howJa = P.howSumRange;
        steps.push({ label: P.marketWorld, text: fillTemplate(P.stepSumText, { count: String(d.terms.length), sum: people(d.sum!), ratePct: pct(d.overlap_rate!), mid: people(d.mid!) }) });
        range = { lowJa: people(d.low!), highJa: people(d.high!), midJa: people(d.mid!), lowFromJa: `${P.rangeLow}（${P.rangeFromMax}）`, highFromJa: `${P.rangeHigh}（${P.rangeFromSum}）`, midRuleJa: P.rangeMidOverlap, midPct: midPct(d.low!, d.mid!, d.high!) };
        break;
      case 'market_union_topdown': {
        howJa = P.howMarketUnion;
        const parts: string[] = [];
        for (const b of d.markets ?? []) {
          if (b.union_anchor) {
            const u = d.terms.find((t) => t.id === b.union_anchor)!;
            steps.push({ label: marketJa(b.market), text: fillTemplate(P.stepMarketUnionText, { unionTerm: u.entity_ja, union: people(b.union) }) });
          } else {
            steps.push({ label: marketJa(b.market), text: fillTemplate(P.stepMarketSumText, { count: String(b.products.length), sum: people(b.sum ?? 0), ratePct: pct(b.overlap_rate ?? 0), union: people(b.union) }) });
          }
          parts.push(people(b.union));
        }
        steps.push({ label: P.stepBottomUp, text: fillTemplate(P.stepBottomUpText, { parts: parts.join(' + '), bottomUp: people(d.bottom_up ?? 0) }) });
        for (const t of d.terms.filter((x) => x.kind === 'top_down')) {
          steps.push({ label: P.stepTopDown, text: fillTemplate(P.stepTopDownText, { share: pct(t.share ?? 0), baseLabel: t.base_label_ja ?? '', base: people(t.base_value ?? 0), topDown: people(t.value), term: t.entity_ja }) });
        }
        const bottomIsLow = (d.bottom_up ?? 0) <= (d.top_down ?? 0);
        range = {
          lowJa: people(d.low!), highJa: people(d.high!), midJa: people(d.mid!),
          lowFromJa: `${P.rangeLow}（${bottomIsLow ? P.rangeFromBottomUp : P.rangeFromTopDown}）`,
          highFromJa: `${P.rangeHigh}（${bottomIsLow ? P.rangeFromTopDown : P.rangeFromBottomUp}）`,
          midRuleJa: P.rangeMidGeo,
          midPct: midPct(d.low!, d.mid!, d.high!),
        };
        if (d.raw_sum !== null) steps.push({ label: P.stepRawSum, text: fillTemplate(P.stepRawSumText, { rawSum: people(d.raw_sum) }) });
        break;
      }
      default:
        howJa = P.howNone;
    }
    const notes: string[] = [];
    for (const t of d.terms) {
      if (t.narrower_window) notes.push(fillTemplate(P.noteWeekly, { term: `${t.entity_ja} ${t.metric_ja}` }));
      if (t.stale) notes.push(fillTemplate(P.noteStale, { term: `${t.entity_ja} ${t.metric_ja}` }));
    }
    if (d.floored_to !== null) {
      const v = { next: String(spec.level + 1), nextValue: people(d.floored_to) };
      notes.push(d.computed === null ? fillTemplate(P.noteFlooredNone, v) : fillTemplate(P.noteFloored, { ...v, computed: people(d.computed) }));
    }
    const dv = l.n_at_least.display;
    const atLeastJa = l.n_at_least.certainty === 'none' || dv === null ? '—' : `${people(dv)}${l.n_at_least.certainty === 'lower_bound' ? '+' : ''}`;
    const nextDv = i + 1 < HAID_LEVELS.length ? byLevel.get(spec.level + 1)!.n_at_least.display ?? 0 : 0;
    const exactlyJa = l.n.certainty === 'none' || dv === null || l.n.display === null
      ? null
      : fillTemplate(P.exactly, { k: String(spec.level), a: people(dv), b: people(nextDv), n: people(l.n.display) });
    return {
      level: spec.level, levels: [spec.level], levelJa: fillTemplate(P.levelOne, { k: String(spec.level) }), ja: spec.ja,
      certainty: l.n_at_least.certainty, certaintyJa: HAID_CERTAINTY_JA[l.n_at_least.certainty],
      howJa, inputs, inputGroups, steps, range, atLeastLabelJa: fillTemplate(P.atLeast, { k: String(spec.level) }), atLeastJa, exactlyJa, notes,
    };
  });
  // Trailing levels with nothing at all (no data, no nesting) collapse into one card.
  const isEmpty = (c: ProvenanceCard) => c.certainty === 'none' && c.inputs.length === 0 && c.notes.length === 0;
  let tail = levelCards.length;
  while (tail > 0 && isEmpty(levelCards[tail - 1])) tail -= 1;
  const provenanceCards: ProvenanceCard[] = levelCards.slice(0, tail);
  if (tail < levelCards.length - 1) {
    const group = levelCards.slice(tail);
    const first = group[0];
    provenanceCards.push({ ...first, levels: group.map((c) => c.level), levelJa: fillTemplate(P.levelSpan, { from: String(first.level), to: String(group[group.length - 1].level) }), ja: '', atLeastLabelJa: '' });
  } else if (tail === levelCards.length - 1) {
    provenanceCards.push(levelCards[tail]);
  }

  // ── 前回との変動 ──
  const prevById = new Map((p.previous_levels ?? []).map((x) => [x.level, x]));
  const deltaRows: DeltaRow[] = p.previous_levels === null ? [] : HAID_LEVELS.map((spec) => {
    const now = byLevel.get(spec.level)!;
    const prev = prevById.get(spec.level)!;
    const a = prev.n_at_least_display;
    const b = now.n_at_least.display;
    const aNone = prev.n_at_least_certainty === 'none';
    const bNone = now.n_at_least.certainty === 'none';
    let kind: DeltaRow['kind'];
    let delta: number | null = null;
    const gradesNow = [...new Set(now.anchors.map((id) => anchorById.get(id)?.grade).filter((g): g is 'A' | 'B' | 'C' | 'D' => g !== undefined))].sort();
    const gradesPrev = [...prev.anchor_grades].sort();
    const gradesChanged = gradesNow.length !== gradesPrev.length || gradesNow.some((g, i) => g !== gradesPrev[i]);
    const idsNow = [...now.anchors].sort();
    const idsPrev = [...prev.anchor_ids].sort();
    const anchorsChanged = idsNow.length !== idsPrev.length || idsNow.some((id, i) => id !== idsPrev[i]);
    if (aNone || bNone || a === null || b === null) kind = 'none';
    else if (prev.n_at_least_certainty !== now.n_at_least.certainty || gradesChanged || anchorsChanged) kind = 'method';
    else {
      delta = b - a;
      kind = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    }
    const kindJa = { up: HAID_RELEASE_DELTA_JA.up, down: HAID_RELEASE_DELTA_JA.down, flat: HAID_RELEASE_DELTA_JA.flat, method: HAID_RELEASE_DELTA_JA.methodChanged, none: HAID_RELEASE_DELTA_JA.noData }[kind];
    const deltaJa = delta === null ? kindJa : delta === 0 ? '±0' : `${delta > 0 ? '+' : '−'}${formatPeopleJaText(Math.abs(delta), TABLE_SIG)}`;
    return {
      level: spec.level,
      ja: spec.ja,
      previous: aNone || a === null ? null : formatPeopleJa(a, TABLE_SIG),
      now: bNone || b === null ? null : formatPeopleJa(b, TABLE_SIG),
      delta,
      deltaJa,
      kind,
      kindJa,
    };
  });

  const paymentValue = p.payment.certainty === 'lower_bound' ? p.payment.count?.low ?? null : p.payment.count?.mid ?? null;
  const payment = p.payment.certainty === 'none' || paymentValue === null
    ? HAID_RELEASE_LIST_JA.paymentNone
    : p.payment.certainty === 'lower_bound'
      ? fillTemplate(HAID_RELEASE_LIST_JA.paymentLower, { n: formatPeopleJaText(paymentValue, HEADLINE_SIG) })
      : fillTemplate(HAID_RELEASE_LIST_JA.paymentAbout, { n: formatPeopleJaText(paymentValue, HEADLINE_SIG) });

  const factValues = {
    population: formatPeopleJaText(population, TABLE_SIG),
    unreached: formatPeopleJaText(unreachedRaw, TABLE_SIG),
    prompted: formatPeopleJaText(promptedRaw, HEADLINE_SIG),
    weekly: formatPeopleJaText(weeklyRaw, HEADLINE_SIG),
    version: p.spec_version,
    asOf: p.as_of,
    label: p.label_ja,
  };

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

function anchorRow(a: HaidReleasePayload['anchors'][number], quarterEnd = '9999-12-31'): AnchorRow {
  const cutoff = new Date(quarterEnd);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return {
    id: a.id,
    stale: new Date(a.as_of) < cutoff,
    kind: a.kind ?? 'product',
    marketJa: a.market === 'cn' ? HAID_RELEASE_PROVENANCE_JA.marketCn : a.market === 'row' ? HAID_RELEASE_PROVENANCE_JA.marketRow : HAID_RELEASE_PROVENANCE_JA.marketWorld,
    entityJa: a.entity_ja,
    metricJa: a.metric_ja,
    valueJa: formatPeopleJaText(a.value, TABLE_SIG),
    asOf: a.as_of,
    grade: a.grade,
    gradeJa: HAID_GRADE_JA[a.grade],
    sourceName: a.source_name,
    sourceUrl: a.source_url,
    placeholder: a.status === 'placeholder',
  };
}
