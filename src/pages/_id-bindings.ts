/**
 * src/pages/_id-bindings.ts — single-entry binding builder
 * for /[id]. Consolidates ~80 lines of `const x = …` declarations
 * that lived directly in [id].astro's frontmatter.
 *
 * Three categories of derivation collapse into one bundle:
 *
 *   1. **Display state** — riskStr / riskClass / 12-field
 *      buildOccupationDisplay output, ctxH2/howH2/condH2 headings,
 *      SEO + OG meta, pickRiskOneLineCallout copy, share text.
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

import { escapeHtml, unsafeReviewedHtml, type SafeHtml } from '@/lib/safe-html';
import { formatParagraphs } from '@/lib/format-paragraphs';
import { jaUrl } from '@/lib/urls';
import { pickRiskOneLineCallout } from '@/lib/risk-callout';
import { buildAiFactSummary } from '@/lib/ai-fact-summary';
import { SCORE_ATTRIBUTION } from '@/site/score-attribution';
import { buildOccupationSeo } from '@/views/occupation-seo';
import {
  buildOccupationDisplay,
  type OccupationDisplay,
} from '@/views/occupation-display';
import { renderProseSection } from '@/templates/ProseSection';
import { renderLegacyRelated } from '@/templates/LegacyRelated';
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
import type { Rec } from '@/views/occupation-detail';

const DESC_TRUNCATE = 240;

export interface IdPageBindingsInput {
  readonly rec: Rec;
  readonly related: ReadonlyArray<Rec>;
  readonly nameLookup: Record<number, string>;
  readonly datePublished: string;
  readonly dateModified: string;
  /** AI-impact rank (1 = most impacted), denominator, and site mean — for
   *  the citable fact block (Phase 1). null rank when unscored. */
  readonly aiRank: number | null;
  readonly scoredTotal: number;
  readonly siteMeanRisk: number;
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
  readonly mhlwUrl: string;
  readonly rationale: string;
  readonly oneLineText: string;
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

export function buildIdPageBindings(input: IdPageBindingsInput): IdPageBindings {
  const { rec, related, nameLookup, datePublished, dateModified, aiRank, scoredTotal, siteMeanRisk } =
    input;

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
  const oneLineText = pickRiskOneLineCallout(risk);
  const rationale = rationaleJa || descJa;

  // Citable fact block (Phase 1) — number-dense, attributed lead paragraph.
  const aiFactText = buildAiFactSummary({
    nameJa,
    aiRisk: risk,
    rank: aiRank,
    total: scoredTotal,
    meanRisk: siteMeanRisk,
    aiois: rec.aiois,
    salaryMan,
    workers,
    scoredDate: `${SCORE_ATTRIBUTION.runDate.slice(0, 4)}年${Number(SCORE_ATTRIBUTION.runDate.slice(5, 7))}月`,
  });
  const aiFactHtml: SafeHtml = aiFactText
    ? unsafeReviewedHtml(
        `<p class="ai-fact">${escapeHtml(aiFactText)}</p>`,
        'aiFactText is a data-assembled string, fully escapeHtml-d before insertion',
      )
    : ('' as SafeHtml);

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
  const aiRiskDetailHtml = renderOccupationAiRiskDetail(rec);
  const aioisHtml = renderOccupationAiois10(rec);
  const profileHtml = renderOccupationProfileRadar(rec);
  const topnHtml = renderOccupationTopn(rec);
  const faqHtml = renderOccupationFaq(rec);
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
  });

  // ─── GA4 funnel classification ────────────────────────────
  const riskTierJs: 'high' | 'mid' | 'low' =
    risk !== null && risk >= 7 ? 'high' : risk !== null && risk >= 5 ? 'mid' : 'low';

  return {
    ...display,
    id,
    canonical,
    nameJa,
    risk,
    mhlwUrl,
    rationale,
    oneLineText,
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
