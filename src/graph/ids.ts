/**
 * Branded ID types for the knowledge graph.
 *
 * Each node kind has its own ID type so the type system refuses to swap
 * (e.g., pass a SectorId where an OccupationId is expected) even though
 * they're all strings or numbers at runtime. See docs/architecture.md §2.2
 * and §4 decision #3.
 *
 * Constructors (`asXxxId`) are the SINGLE boundary where a raw value
 * becomes a branded one. Use them when:
 *   - loading from source files (raw JSON keys → branded IDs)
 *   - parsing URL params (Astro params are `string` by default)
 *   - reading runtime input (form, env, fetch response)
 *
 * Internal graph code passes branded IDs around without casting.
 *
 * Runtime cost: zero. Brand is purely a type-level marker; the wrapped
 * value is the bare number/string at runtime.
 */

declare const __brand: unique symbol;

type Brand<TBase, TTag extends string> = TBase & { readonly [__brand]: TTag };

// ─── Node ID types ───────────────────────────────────────────────

export type OccupationId          = Brand<number, 'OccupationId'>;
export type SectorId              = Brand<string, 'SectorId'>;
export type SkillId               = Brand<string, 'SkillId'>;
export type KnowledgeId           = Brand<string, 'KnowledgeId'>;
export type AbilityId             = Brand<string, 'AbilityId'>;
export type InterestId            = Brand<string, 'InterestId'>;
export type WorkValueId           = Brand<string, 'WorkValueId'>;
export type WorkCharacteristicId  = Brand<string, 'WorkCharacteristicId'>;
export type WorkActivityId        = Brand<string, 'WorkActivityId'>;

// ─── Constructors (the only allowed cast point) ──────────────────

export function asOccupationId(n: number): OccupationId {
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new RangeError(`OccupationId out of range: ${n} (expected integer 1-999)`);
  }
  return n as OccupationId;
}

export function asSectorId(s: string): SectorId {
  if (!/^[a-z][a-z0-9_]*$/.test(s)) {
    throw new RangeError(`SectorId malformed: '${s}' (expected lowercase slug)`);
  }
  return s as SectorId;
}

// Dimension label IDs share the same shape — keys are stable label slugs
// (e.g., "reading_comprehension", "realistic", "physical_strength"). The
// label files own the canonical key set; constructors do not re-validate
// because the SchemaSchema in src/data/schema/labels.ts already does.

export function asSkillId(s: string): SkillId                           { return s as SkillId; }
export function asKnowledgeId(s: string): KnowledgeId                   { return s as KnowledgeId; }
export function asAbilityId(s: string): AbilityId                       { return s as AbilityId; }
export function asInterestId(s: string): InterestId                     { return s as InterestId; }
export function asWorkValueId(s: string): WorkValueId                   { return s as WorkValueId; }
export function asWorkCharacteristicId(s: string): WorkCharacteristicId { return s as WorkCharacteristicId; }
export function asWorkActivityId(s: string): WorkActivityId             { return s as WorkActivityId; }
