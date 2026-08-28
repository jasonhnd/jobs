/**
 * src/pages/_id-bindings.ts — single-entry binding builder
 * for /[id]. Consolidates ~80 lines of `const x = …` declarations
 * that lived directly in [id].astro's frontmatter.
 *
 * Three categories of derivation collapse into one bundle:
 *
 *   1. **Display state** — riskStr / riskClass / 12-field
 *      buildOccupationDisplay output, ctxH2/howH2/condH2 headings,
 *      SEO + OG meta, work-type verdict copy, share text.
 *
 *   2. **Section HTML** — every Rec → SafeHtml adapter
 *      (renderOccupationMetaRow / ProfileRadar / Topn / Faq /
 *      Transfer / OrgsCerts / Provenance / AiRiskDetail / JsonLd)
 *      plus the two ProseSection calls (how / cond) and the
 *      LegacyRelated fallback.
 *
 *   3. **Context block HTML** — definition <p> + body paragraphs
 *      glue that the page used to assemble inline.
 *
 *  The `spokeViews` block (sameRiskHtml + relatedHubsHtml) stays
 *  out of this bundle because it's awaited separately from a
 *  dynamic import in the page frontmatter.
 *
 *  Page-local sibling (`_`-prefix → not routed).
 */

import { join } from 'node:path';
import { escapeHtml, unsafeReviewedHtml, type SafeHtml } from '@/lib/safe-html';
import { formatParagraphs } from '@/lib/format-paragraphs';
import { jaUrl } from '@/lib/urls';
import {
  buildOccupationGeoFactSummary,
  renderAiFactParagraph,
} from '@/lib/ai-fact-summary';
import { loadGeoFacts } from '@/page-data/geo-facts-loader';
import { findGeoOccupation, type GeoFacts } from '@/site/geo-facts';
import { strictReadJson } from '@/lib/strict-load';
import { buildOccupationSeo } from '@/views/occupation-seo';
import {
  buildOccupationDisplay,
  type OccupationDisplay,
} from '@/views/occupation-display';
import {
  WorktypesDataSchema,
  type WorktypesData,
} from '@/data/schema/worktypes';
import { FAMILIES } from '@/site/worktype-copy';
import { OCCUPATION_COUNT } from '@/site/config';
import { renderProseSection } from '@/templates/ProseSection';
import { renderLegacyRelated } from '@/templates/LegacyRelated';
import {
  renderScoreHistoryComparison,
  type ScoreHistoryComparisonEntry,
} from '@/templates/ScoreHistoryComparison';
import {
  makeOccupationDefinitionFromRec,
  renderOccupationMetaRow,
  renderOccupationProfileRadar,
  renderOccupationTopn,
  renderOccupationFaq,
  renderOccupationTransfer,
  renderOccupationOrgsCerts,
  renderOccupationAiRiskDetail,
  renderOccupationAiois10,
  renderOccupationJsonLdFromRec,
} from './_id-renderers';
import { pickRiskOneLineCallout } from '@/lib/risk-callout';
import { CONTENT_DATE } from '@/lib/_content-date';
import type { Rec } from '@/views/occupation-detail';

const DESC_TRUNCATE = 240;
const WORKTYPES_PATH = join(process.cwd(), 'public', 'data.worktypes.json');
const AIOIS_MODEL_DISCLAIMER =
  'AIOIS-10はモデル出力の目安で、統計的な将来予測や適職保証ではありません。';

let worktypesCache: WorktypesData | null = null;

function loadWorktypesData(): WorktypesData {
  if (!worktypesCache) {
    worktypesCache = strictReadJson(
      WORKTYPES_PATH,
      WorktypesDataSchema,
      'id-bindings.worktypes',
    );
  }
  return worktypesCache;
}

export interface VerdictDoor {
  readonly href: string;
  readonly label: string;
  readonly kind: 'solid' | 'ghost';
}

export interface VerdictBinding {
  readonly scored: boolean;
  readonly transformationDisp: string;
  readonly displacementDisp: string | null;
  readonly rankLine: string;
  readonly sentence: string;
  readonly facts: string;
  readonly doors: ReadonlyArray<VerdictDoor>;
  readonly showShare: boolean;
}

/** Latest − previous transformation. Omit when the history has fewer than 2 rows. */
export function derivePrevDelta(
  history: ReadonlyArray<{ readonly date: string; readonly transformation: number }>,
): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1]!;
  const prev = sorted[sorted.length - 2]!;
  return latest.transformation - prev.transformation;
}

export function formatPrevDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return '±0';
  const body = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  return rounded > 0 ? `+${body}` : `-${body}`;
}

export function formatScoredMonthJa(date: string | undefined): string {
  const src = date ?? CONTENT_DATE;
  const m = /^(\d{4})-(\d{2})/.exec(src);
  if (!m) return `${src}採点`;
  return `${m[1]}年${Number(m[2])}月採点`;
}

export function formatVerdictRankLine(opts: {
  readonly rank: number | null;
  readonly total: number;
  readonly prevDelta: number | null;
  readonly scoredAtJa: string;
}): string {
  const parts: string[] = [];
  if (opts.rank !== null) parts.push(`${opts.total}職中 第${opts.rank}位`);
  if (opts.prevDelta !== null) parts.push(`先月比 ${formatPrevDelta(opts.prevDelta)}`);
  parts.push(opts.scoredAtJa);
  return parts.join(' · ');
}

/** Local copy of the ai-fact 万人 rule — issue #323 allows duplicating it. */
function fmtWorkersMan(workers: number): string {
  if (workers >= 100_000) return `約${Math.round(workers / 10_000)}万人`;
  if (workers >= 10_000) return `約${Math.round(workers / 1000) / 10}万人`;
  return `約${Math.round(workers / 1000)}千人`;
}

export function formatVerdictFacts(opts: {
  readonly salaryMan: number | null | undefined;
  readonly workers: number | null | undefined;
  readonly hours: number | null | undefined;
}): string {
  const parts: string[] = [];
  if (opts.salaryMan) parts.push(`年収 約${Math.trunc(opts.salaryMan)}万円`);
  if (opts.workers) parts.push(`就業者 ${fmtWorkersMan(opts.workers)}`);
  if (opts.hours) parts.push(`月${Math.trunc(opts.hours)}h`);
  return parts.join(' · ');
}

export function verdictSentence(rationaleJa: string, risk: number | null): string {
  const t = rationaleJa.trim();
  return t ? t : pickRiskOneLineCallout(risk);
}

export function buildVerdictDoors(opts: {
  readonly risk: number | null;
  readonly hasTransfer: boolean;
}): ReadonlyArray<VerdictDoor> {
  if (opts.risk === null) {
    return [{ href: '#sec-similar', label: '似た仕事', kind: 'ghost' }];
  }
  const ghostSimilar: VerdictDoor = { href: '#sec-similar', label: '似た仕事', kind: 'ghost' };
  if (opts.risk >= 7) {
    const ghost: VerdictDoor = opts.hasTransfer
      ? { href: '#sec-transfer', label: '移り先の候補', kind: 'ghost' }
      : ghostSimilar;
    return [
      { href: '#sec-aiois', label: 'AIで変わる作業を見る', kind: 'solid' },
      ghost,
    ];
  }
  if (opts.risk < 5) {
    return [
      { href: '#sec-aiois', label: 'なぜ守られやすいか', kind: 'solid' },
      ghostSimilar,
    ];
  }
  return [
    { href: '#sec-aiois', label: 'スコアの中身', kind: 'solid' },
    ghostSimilar,
  ];
}

function fmtScoreDisp(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(1).replace(/\.0$/, '');
}

export interface WorktypeHeroBinding {
  readonly worktypeFamilyCode: string;
  readonly worktypeFamilyId: string;
  readonly worktypeFamilyName: string;
  readonly worktypeIdentity: string;
  readonly worktypeAiRelation: string;
  readonly worktypeHumanValue: string;
  readonly worktypeNextStep: string;
  readonly worktypeOneLine: string;
}

export interface IdPageBindingsInput {
  readonly rec: Rec;
  readonly related: ReadonlyArray<Rec>;
  readonly nameLookup: Record<number, string>;
  readonly scoreHistory?: ReadonlyArray<ScoreHistoryComparisonEntry>;
  readonly prevDelta?: number | null;
  readonly datePublished: string;
  readonly dateModified: string;
}

/** Everything [id].astro's body needs to render, derived in one
 *  pure pass from the page props. The spoke-view HTML
 *  (`sameRiskHtml` / `relatedHubsHtml`) is awaited separately and
 *  not part of this bundle. */
export interface IdPageBindings extends OccupationDisplay {
  // Identity / hero
  readonly id: number;
  readonly canonical: string;
  readonly nameJa: string;
  readonly risk: number | null;
  readonly aioisTransformation: number | null;
  readonly aioisDisplacement: number | null;
  readonly mhlwUrl: string;
  readonly rationale: string;
  readonly rankInUniverse: number | null;
  readonly rankUniverseTotal: number;
  readonly prevDelta: number | null;
  readonly aioisModelDisclaimer: string;
  readonly worktype: WorktypeHeroBinding;
  readonly verdict: VerdictBinding;
  /** Citable fact block — number-dense, attributed lead paragraph (Phase 1,
   *  docs/SEO_GEO_STRATEGY.md). Empty SafeHtml when unscored. */
  readonly aiFactHtml: SafeHtml;

  // SEO + OG meta
  readonly title: string;
  readonly seoDesc: string;
  readonly ogTitle: string;
  readonly ogDesc: string;
  readonly keywords: string;

  // Section headings + context body HTML
  readonly ctxH2: string;
  readonly howH2: string;
  readonly condH2: string;
  readonly ctxHtml: SafeHtml;

  // Pre-rendered section HTML (one per template).
  readonly metaRowHtml: SafeHtml;
  readonly scoreHistoryHtml: SafeHtml;
  readonly aiRiskDetailHtml: SafeHtml;
  readonly aioisHtml: SafeHtml;
  readonly profileHtml: SafeHtml;
  readonly topnHtml: SafeHtml;
  readonly faqHtml: SafeHtml;
  readonly transferHtml: SafeHtml;
  readonly orgsCertsHtml: SafeHtml;
  readonly howSection: SafeHtml;
  readonly condSection: SafeHtml;
  readonly legacyRelatedHtml: SafeHtml;

  // Schema.org JSON-LD payload (pretty-printed string — JSON, not HTML).
  readonly jsonLd: string;

  /** Three-bucket GA4 funnel classification for the
   *  `result_view` event's `risk_tier` param. Note: distinct
   *  cutoffs from the 5-band callout copy. */
  readonly riskTierJs: 'high' | 'mid' | 'low';
}

export function canonicalOccupationRank(facts: GeoFacts, occupationId: number): number | null {
  return findGeoOccupation(facts, occupationId)?.aiImpactRank ?? null;
}

function buildWorktypeHeroBinding(id: number): WorktypeHeroBinding {
  const data = loadWorktypesData();
  const record = data.occupations[String(id)];
  if (!record) {
    throw new Error(`[id-bindings.worktypes] occupation ${id} missing from data.worktypes.json`);
  }
  const family = FAMILIES[record.code];
  return {
    worktypeFamilyCode: record.code,
    worktypeFamilyId: record.familyId,
    worktypeFamilyName: family.name,
    worktypeIdentity: family.identity,
    worktypeAiRelation: family.aiRelation,
    worktypeHumanValue: family.strengths,
    worktypeNextStep: family.empowerment,
    worktypeOneLine: family.share,
  };
}

export function buildIdPageBindings(input: IdPageBindingsInput): IdPageBindings {
  const { rec, related, nameLookup, datePublished, dateModified } = input;
  const geoFacts = loadGeoFacts();

  // ─── Field extraction ──────────────────────────────────────
  const id = rec.id;
  const canonical = jaUrl(id);
  const nameJa = rec.name_ja || '';
  const risk = rec.ai_risk;
  const rationaleJa = rec.ai_rationale_ja || '';
  const descJa = (rec.desc_ja || '').slice(0, DESC_TRUNCATE);
  const longWhatJa = rec.what_it_is_ja || '';
  const longHowJa = rec.how_to_become_ja || '';
  const longCondJa = rec.working_conditions_ja || '';
  const salaryMan = rec.salary;
  const workers = rec.workers;
  const age = rec.age;
  const hours = rec.hours;
  const recruit = rec.recruit_ratio;
  const hourly = rec.hourly_wage;
  const mhlwUrl = rec.url;
  const aliases = rec.aliases_ja ?? [];

  // ─── Display + SEO + callout ───────────────────────────────
  const display = buildOccupationDisplay({
    aiRisk: risk,
    salaryMan,
    workers,
    age,
    hours,
    recruitRatio: recruit,
    hourlyWage: hourly,
  });
  const seo = buildOccupationSeo({
    nameJa,
    aiRisk: risk,
    salaryMan,
    workers,
    aliasesJa: aliases,
  });
  const rationale = rationaleJa || descJa;
  const worktype = buildWorktypeHeroBinding(id);
  // Hero, FAQ, JSON-LD, and GEO surfaces share this canonical rank.
  // loadGeoFacts applies the documented risk/workforce/id comparator.
  const rankInUniverse = canonicalOccupationRank(geoFacts, id);
  const rankUniverseTotal = geoFacts.occupationCount || OCCUPATION_COUNT.SCORED;
  const aioisTransformation = rec.aiois?.transformation ?? risk;
  const aioisDisplacement = rec.aiois?.displacement ?? null;
  const history = input.scoreHistory ?? [];
  const prevDelta = input.prevDelta !== undefined ? input.prevDelta : derivePrevDelta(history);
  const latestHistoryDate = history.length === 0
    ? undefined
    : [...history].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;

  // Citable fact block (Phase 1) — number-dense, attributed lead paragraph.
  const aiFactHtml = renderAiFactParagraph(buildOccupationGeoFactSummary({ facts: geoFacts, occupationId: id }));

  // ─── Section headings + context HTML ──────────────────────
  const ctxH2 = `${nameJa}とは`;
  const ctxP = longWhatJa || descJa || rationaleJa;
  const howH2 = `${nameJa}になるには・必要な資格`;
  const condH2 = `${nameJa}の労働条件・働き方`;

  const definition = makeOccupationDefinitionFromRec(rec);
  const ctxBodyHtml: SafeHtml = ctxP ? formatParagraphs(ctxP) : ('' as SafeHtml);
  const ctxHtml = unsafeReviewedHtml(
    `<p class="definition">${escapeHtml(definition)}</p>\n        ${ctxBodyHtml}`.trimEnd(),
    'definition is escapeHtml-d; ctxBodyHtml is SafeHtml from formatParagraphs; concat is byte-identical to pre-Phase-E output',
  );

  // ─── Section HTML adapters ────────────────────────────────
  const howSection = renderProseSection({
    h2: howH2,
    sectionClass: 'how-to-become',
    bodyText: longHowJa,
  });
  const condSection = renderProseSection({
    h2: condH2,
    sectionClass: 'working-conditions',
    bodyText: longCondJa,
  });
  const metaRowHtml = renderOccupationMetaRow(rec);
  const scoreHistoryHtml = renderScoreHistoryComparison(input.scoreHistory ?? []);
  const aiRiskDetailHtml = renderOccupationAiRiskDetail(rec);
  const aioisHtml = renderOccupationAiois10(rec);
  const profileHtml = renderOccupationProfileRadar(rec);
  const topnHtml = renderOccupationTopn(rec);
  const faqHtml = renderOccupationFaq(rec, geoFacts);
  const transferHtml = renderOccupationTransfer(rec, nameLookup);
  const orgsCertsHtml = renderOccupationOrgsCerts(rec);
  const legacyRelatedHtml = renderLegacyRelated({
    related: related.map((r) => ({
      id: r.id,
      nameJa: r.name_ja || '',
      aiRisk: r.ai_risk,
    })),
    suppress: Boolean(transferHtml),
  });

  // ─── JSON-LD ──────────────────────────────────────────────
  const jsonLd = renderOccupationJsonLdFromRec(rec, {
    datePublished,
    dateModified,
    geoFacts,
  });

  // ─── GA4 funnel classification ────────────────────────────
  const riskTierJs: 'high' | 'mid' | 'low' =
    risk !== null && risk >= 7 ? 'high' : risk !== null && risk >= 5 ? 'mid' : 'low';

  const scored = risk !== null;
  const verdict: VerdictBinding = {
    scored,
    transformationDisp: scored ? fmtScoreDisp(aioisTransformation) : '未採点',
    displacementDisp: scored ? fmtScoreDisp(aioisDisplacement) : null,
    rankLine: formatVerdictRankLine({
      rank: rankInUniverse,
      total: rankUniverseTotal,
      prevDelta,
      scoredAtJa: formatScoredMonthJa(latestHistoryDate),
    }),
    sentence: verdictSentence(rationaleJa, risk),
    facts: formatVerdictFacts({ salaryMan, workers, hours }),
    doors: buildVerdictDoors({ risk, hasTransfer: Boolean(transferHtml) }),
    showShare: scored,
  };

  return {
    ...display,
    id,
    canonical,
    nameJa,
    risk,
    aioisTransformation,
    aioisDisplacement,
    mhlwUrl,
    rationale,
    rankInUniverse,
    rankUniverseTotal,
    prevDelta,
    aioisModelDisclaimer: AIOIS_MODEL_DISCLAIMER,
    worktype,
    verdict,
    aiFactHtml,
    title: seo.title,
    seoDesc: seo.description,
    ogTitle: seo.ogTitle,
    ogDesc: seo.ogDescription,
    keywords: seo.keywords,
    ctxH2,
    howH2,
    condH2,
    ctxHtml,
    metaRowHtml,
    scoreHistoryHtml,
    aiRiskDetailHtml,
    aioisHtml,
    profileHtml,
    topnHtml,
    faqHtml,
    transferHtml,
    orgsCertsHtml,
    howSection,
    condSection,
    legacyRelatedHtml,
    jsonLd,
    riskTierJs,
  };
}
