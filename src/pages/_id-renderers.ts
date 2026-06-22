/**
 * src/pages/_id-renderers.ts — Rec → SafeHtml adapters for
 * every section template the /[id] page renders.
 *
 * Extracted from src/pages/[id].astro. Each function is a thin
 * snake_case → camelCase → template adapter that reads only the
 * Rec fields it needs and forwards the narrow input shape the
 * template expects.
 *
 * Page-local sibling rather than a view module: the architecture
 * boundary gate (scripts/check-architecture.cjs) forbids views/
 * from importing templates/ — these adapters bridge data shapes
 * to template inputs, which is conceptually page binding, not
 * view-layer data preparation. The leading `_` prefix tells Astro
 * not to route this file as a page.
 */

import type { Rec, TopNEntry } from '@/views/occupation-detail';
import { makeOccupationDefinition } from '@/views/occupation-definition';
import { buildOccupationFaqs } from '@/views/occupation-faqs';
import { renderMetaRow } from '@/templates/MetaRow';
import { renderProfileRadar } from '@/templates/ProfileRadar';
import { renderTopn } from '@/templates/Topn';
import { renderOccFaq } from '@/templates/OccFaq';
import { renderTransfer } from '@/templates/Transfer';
import { renderOrgsCerts } from '@/templates/OrgsCerts';
import { renderAiRiskDetail } from '@/templates/AiRiskDetail';
import { renderAiois10Profile } from '@/templates/Aiois10Profile';
import { renderOccupationJsonLd } from '@/views/occupation-jsonld';
import { jaUrl } from '@/lib/urls';
import type { SafeHtml } from '@/lib/safe-html';
import type { GeoFacts } from '@/site/geo-facts';

const TRANSFER_TOP_N = 5;

/** Build the FAQ Q/A tuples for one occupation. Used by both the
 *  on-page OccFaq block and the JsonLd FAQPage node. */
export function buildOccupationFaqTuples(
  rec: Rec,
  geoFacts?: GeoFacts,
): readonly (readonly [string, string])[] {
  return buildOccupationFaqs({
    id: rec.id,
    nameJa: rec.name_ja || '',
    salaryMan: rec.salary,
    workers: rec.workers,
    recruitRatio: rec.recruit_ratio,
    aiRisk: rec.ai_risk,
    aiRationaleJa: rec.ai_rationale_ja || '',
    howToBecomeJa: rec.how_to_become_ja || '',
    skillsTop10: (rec.skills_top10 ?? []).map((s) => ({ labelJa: s.label_ja ?? null })),
    geoFacts,
  });
}

/** Build the opening "{name}とは…です。" sentence. */
export function makeOccupationDefinitionFromRec(rec: Rec): string {
  return makeOccupationDefinition({
    nameJa: rec.name_ja || '',
    descJa: rec.desc_ja || '',
    sectorJa: rec.sector?.ja ?? null,
  });
}

export function renderOccupationMetaRow(rec: Rec): SafeHtml {
  return renderMetaRow({
    sectorJa: rec.sector?.ja ?? null,
    sectorId: rec.sector?.id,
    riskBand: rec.risk_band ?? null,
    workforceBand: rec.workforce_band ?? null,
    demandBand: rec.demand_band ?? null,
  });
}

export function renderOccupationProfileRadar(rec: Rec): SafeHtml {
  // Phase E follow-up (2026-05-16): profile5 now arrives via `rec.profile5`,
  // computed eagerly by graph/profile5.ts at loadGraph() time. No fs read.
  return renderProfileRadar(rec.profile5);
}

export function renderOccupationTopn(rec: Rec): SafeHtml {
  const adapt = (items: TopNEntry[] | undefined) =>
    (items ?? []).map((it) => ({ labelJa: it.label_ja ?? null, score: it.score ?? null }));
  return renderTopn({
    skills: adapt(rec.skills_top10),
    knowledge: adapt(rec.knowledge_top5),
    abilities: adapt(rec.abilities_top5),
  });
}

export function renderOccupationFaq(rec: Rec, geoFacts?: GeoFacts): SafeHtml {
  return renderOccFaq(buildOccupationFaqTuples(rec, geoFacts));
}

export function renderOccupationTransfer(
  rec: Rec,
  nameLookup: Record<number, string>,
): SafeHtml {
  // Phase E follow-up (2026-05-17): transferCandidates arrives via
  // `rec.transferCandidates`, pre-computed by graph/transfer-paths at
  // loadGraph() time. No fs read. Empty `candidates` (no_skills /
  // no_similar_in_sector fallbacks) renders to an empty fragment so
  // the page skips the section gracefully.
  const candidates = rec.transferCandidates.candidates;
  if (candidates.length === 0) return '' as SafeHtml;
  const cards = candidates.slice(0, TRANSFER_TOP_N).map((c) => ({
    id: c.id,
    name: nameLookup[c.id] || c.title_ja || '?',
    aiRisk: c.ai_risk,
    similarity: c.similarity,
  }));
  return renderTransfer(cards);
}

export function renderOccupationOrgsCerts(rec: Rec): SafeHtml {
  return renderOrgsCerts({
    orgs: (rec.related_orgs ?? []).map((o) => ({
      nameJa: o.name_ja ?? null,
      url: o.url ?? null,
    })),
    certs: rec.related_certs_ja ?? [],
  });
}

export function renderOccupationAiRiskDetail(rec: Rec): SafeHtml {
  return renderAiRiskDetail({
    aiRisk: rec.ai_risk,
    rationaleLongJa: rec.ai_rationale_long_ja,
    displaceableTasksJa: rec.ai_displaceable_tasks_ja ?? [],
    resilientTasksJa: rec.ai_resilient_tasks_ja ?? [],
    horizon5yJa: rec.ai_horizon_5y_ja,
  });
}

/** Render the per-occupation AIOIS-10 10-dimension + 2-index breakdown. */
export function renderOccupationAiois10(rec: Rec): SafeHtml {
  return renderAiois10Profile(rec.aiois);
}

/**
 * Render the Schema.org JSON-LD `<script type="application/ld+json">`
 * payload for one occupation. Pre-resolves every fallback chain
 * (pageName, pageDesc, classificationMain, skillLabels) so the
 * underlying template walks a flat narrow input.
 *
 * `datePublished` + `dateModified` are passed in so the page-level
 * constants stay in [id].astro (versioning, not page logic).
 */
export function renderOccupationJsonLdFromRec(
  rec: Rec,
  options: { readonly datePublished: string; readonly dateModified: string; readonly geoFacts?: GeoFacts },
): string {
  const id = rec.id;
  const nameJa = rec.name_ja || '';
  const risk = rec.ai_risk;
  const rationaleJa = rec.ai_rationale_ja || '';
  const descJa = rec.desc_ja || '';
  const cls = rec.classifications ?? {};
  const classificationMain =
    (cls.mhlw_main as string | null | undefined) ||
    (cls.jsoc_main as string | null | undefined) ||
    null;
  const skillLabels = (rec.skills_top10 ?? [])
    .map((s) => s.label_ja)
    .filter((s): s is string => Boolean(s));

  return renderOccupationJsonLd({
    id,
    canonical: jaUrl(id),
    pageName:
      risk !== null ? `${nameJa} — AI 影響 ${risk}/10` : `${nameJa} — mirai-shigoto.com`,
    pageDesc: makeOccupationDefinitionFromRec(rec) || rationaleJa || descJa || nameJa,
    nameJa,
    aliasesJa: rec.aliases_ja ?? [],
    sectorJa: rec.sector?.ja ?? null,
    aiRisk: risk,
    mhlwUrl: rec.url,
    salaryMan: rec.salary,
    workers: rec.workers,
    age: rec.age,
    hours: rec.hours,
    recruitRatio: rec.recruit_ratio,
    hourlyWage: rec.hourly_wage,
    classificationMain,
    skillLabels,
    relatedCertsJa: rec.related_certs_ja ?? [],
    tasksLeadJa: rec.tasks_lead_ja || '',
    howToBecomeJa: rec.how_to_become_ja || '',
    faqs: buildOccupationFaqTuples(rec, options.geoFacts),
    datePublished: options.datePublished,
    dateModified: options.dateModified,
    aiois10: rec.aiois
      ? {
          transformation: rec.aiois.transformation,
          d1: rec.aiois.d1, d2: rec.aiois.d2, d3: rec.aiois.d3, d4: rec.aiois.d4, d5: rec.aiois.d5,
          d6: rec.aiois.d6, d7: rec.aiois.d7, d8: rec.aiois.d8, d9: rec.aiois.d9, d10: rec.aiois.d10,
        }
      : null,
  });
}
