/**
 * src/views/occupation-definition.ts — build the opening
 * "{name}とは…です。" sentence for an occupation detail page.
 *
 * Extracted from src/pages/[id].astro (`makeDefinition` plus its
 * private `endsWithAny` helper and `NOUN_FINAL_ENDINGS` list). Pure
 * Japanese text shaping — no HTML, no Rec coupling. The page-level
 * adapter forwards just the three fields actually consumed: name,
 * MHLW jobtag summary, and sector name.
 *
 * The output sentence is consumed by:
 *   - <meta description> (via the page-level body)
 *   - Schema.org Occupation.description / WebPage.description
 *     (via src/templates/JsonLd's pageDesc fallback chain)
 *
 * Algorithm:
 *   1. If no summary → "{name}とは、{sector?}業界に属する職業です。"
 *      (sector-less fallback: "…日本の職業の一つです。")
 *   2. Take the first sentence of summary (split on 「。」).
 *   3. If summary starts with "{name}とは" or "{name}は", reuse it
 *      verbatim — wrap with です。 if it doesn't already end in
 *      です/ます/である, and append 職業です if it lacks a noun-final
 *      occupation marker.
 *   4. Otherwise prefix with "{name}とは、" and apply the same
 *      noun-final marker test.
 */

/** Suffixes that already function as occupation nouns. Sentences
 *  ending in one of these don't need the trailing 「職業」prefix. */
const NOUN_FINAL_ENDINGS: readonly string[] = [
  '職業', '仕事', '技術者', '職人', '担当者', '専門職', '技能職',
  'オペレーター', 'エンジニア', 'デザイナー', 'プログラマー',
  '従事者', '作業員', '者', '士', '員', '家', '師', '工',
];

function endsWithAny(s: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suf) => s.endsWith(suf));
}

export interface OccupationDefinitionInput {
  /** Japanese name (e.g. 「看護師」). Used as the subject of the
   *  generated sentence. Falsy → still produces a sentence with an
   *  empty subject; data invariant says it's always present. */
  readonly nameJa: string;
  /** MHLW jobtag summary text. Empty → falls back to a generic
   *  sector-based sentence. */
  readonly descJa: string;
  /** Sector display name for the no-summary fallback. Null → drops
   *  back to "{name}とは、日本の職業の一つです。" */
  readonly sectorJa: string | null;
}

export function makeOccupationDefinition(input: OccupationDefinitionInput): string {
  const name = input.nameJa.trim();
  const summary = input.descJa.trim();
  const sectorJa = input.sectorJa ?? '';

  if (!summary) {
    if (sectorJa) return `${name}とは、${sectorJa}業界に属する職業です。`;
    return `${name}とは、日本の職業の一つです。`;
  }

  let first = summary.split('。')[0].trim();
  if (!first) first = summary.replace(/[。.]+$/, '').trim();

  if (first.startsWith(`${name}とは`) || first.startsWith(`${name}は`)) {
    if (!first.endsWith('です') && !first.endsWith('ます') && !first.endsWith('である')) {
      return endsWithAny(first, NOUN_FINAL_ENDINGS) ? `${first}です。` : `${first}職業です。`;
    }
    return `${first}。`;
  }

  if (endsWithAny(first, NOUN_FINAL_ENDINGS)) return `${name}とは、${first}です。`;
  return `${name}とは、${first}職業です。`;
}
