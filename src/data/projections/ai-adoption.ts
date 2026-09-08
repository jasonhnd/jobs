/**
 * data.ai-adoption.json projection.
 *
 * This projection keeps the public dashboard deterministic: source observations
 * and assumptions live under data/ai-adoption/, while the browser receives one
 * precomputed JSON payload. The page renders the output; it does not own the
 * model, and it never re-expresses the groups as a 100% split.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { nowIso } from '../../lib/now.js';

const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
const LayerIdSchema = z.enum(['N_dev', 'N_pro', 'N_free', 'N_passive']);

const ObservationSchema = z
  .object({
    id: z.string(),
    metric: z.string(),
    entity: z.string(),
    value: z.number(),
    unit: z.string(),
    period: z.string(),
    as_of_date: z.string(),
    published_at: z.string(),
    source_key: z.string(),
    source_name: z.string(),
    source_url: z.string(),
    collection_method: z.string(),
    confidence: ConfidenceSchema,
    stale_after_days: z.number(),
    used_by: z.array(z.string()),
    note: z.string(),
    unique_user_factor: z.number().optional(),
    availability_rate: z.number().optional(),
    activation_rate: z.number().optional(),
  })
  .strict();

const SourceDefSchema = z
  .object({
    label: z.string(),
    type: z.string(),
    default_frequency: z.string(),
    default_confidence: ConfidenceSchema,
    stale_after_days: z.number(),
  })
  .strict();

const ParameterDefSchema = z
  .object({
    value: z.number(),
    label_ja: z.string(),
    rationale_ja: z.string(),
  })
  .strict();

const AssumptionsSchema = z
  .object({
    model_version: z.string(),
    period: z.string(),
    primary_denominator_metric: z.string(),
    auxiliary_denominator_metric: z.string(),
    parameters: z.record(z.string(), ParameterDefSchema),
  })
  .strict();

const ModelLayerSchema = z
  .object({
    id: LayerIdSchema,
    label_ja: z.string(),
    short_label_ja: z.string(),
    formula_ja: z.string(),
    rationale_ja: z.string(),
    risk_ja: z.string(),
    color: z.string(),
  })
  .strict();

const ModelDefinitionSchema = z
  .object({
    title_ja: z.string(),
    subtitle_ja: z.string(),
    layers: z.array(ModelLayerSchema),
  })
  .strict();

export type Confidence = z.infer<typeof ConfidenceSchema>;
export type FreshnessStatus = 'fresh' | 'review_needed' | 'stale';
export type LayerId = z.infer<typeof LayerIdSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type SourceDef = z.infer<typeof SourceDefSchema>;
export type ParameterDef = z.infer<typeof ParameterDefSchema>;
export type Assumptions = z.infer<typeof AssumptionsSchema>;
export type ModelLayer = z.infer<typeof ModelLayerSchema>;
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;

interface AiAdoptionBuildResult {
  files: string[];
  rows: number;
}

export interface AiAdoptionPayloadInput {
  observations: Observation[];
  sources: Record<string, SourceDef>;
  assumptions: Assumptions;
  model: ModelDefinition;
  generatedAt?: string;
}

// Display text (title/subtitle/layer labels/formula/rationale/risk) lives in
// model.json — the single source of truth. The projection reads it as-is.

function dataPath(name: string): string {
  return join(process.cwd(), 'data', 'ai-adoption', name);
}

async function readJson<T>(name: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(dataPath(name), 'utf-8');
  return schema.parse(JSON.parse(raw));
}

function assertFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`[ai-adoption] ${label} is not finite`);
  }
  return value;
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function metricSum(observations: readonly Observation[], metric: string): number {
  return observations
    .filter((o) => o.metric === metric)
    .reduce((sum, o) => sum + assertFiniteNumber(o.value, o.id), 0);
}

function metricValue(observations: readonly Observation[], metric: string): number {
  const matches = observations.filter((o) => o.metric === metric);
  if (matches.length !== 1) {
    throw new Error(`[ai-adoption] expected exactly one observation for metric ${metric}, got ${matches.length}`);
  }
  return assertFiniteNumber(matches[0]!.value, matches[0]!.id);
}

function parameter(assumptions: Assumptions, key: string): number {
  const value = assumptions.parameters[key]?.value;
  if (value == null) throw new Error(`[ai-adoption] missing assumption parameter ${key}`);
  return assertFiniteNumber(value, key);
}

function daysSince(date: string, now: Date): number {
  const t = Date.parse(date);
  if (!Number.isFinite(t)) return Infinity;
  const diff = now.getTime() - t;
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function freshnessStatus(ageDays: number, staleAfterDays: number): FreshnessStatus {
  if (ageDays <= staleAfterDays) return 'fresh';
  if (ageDays <= staleAfterDays * 1.5) return 'review_needed';
  return 'stale';
}

function layerObservationIds(layerId: LayerId, observations: readonly Observation[]): string[] {
  return observations.filter((o) => o.used_by.includes(layerId)).map((o) => o.id);
}

function statusForObservationIds(ids: readonly string[], enriched: readonly { id: string; freshness_status: FreshnessStatus }[]): FreshnessStatus {
  const statuses = ids
    .map((id) => enriched.find((o) => o.id === id)?.freshness_status)
    .filter((s): s is FreshnessStatus => s != null);
  if (statuses.includes('stale')) return 'stale';
  if (statuses.includes('review_needed')) return 'review_needed';
  return 'fresh';
}

function derivedValue(o: Observation, assumptions: Assumptions): number {
  if (o.metric === 'vendor_arr_usd') {
    return o.value / parameter(assumptions, 'paid_consumer_arpu_annual_usd');
  }
  if (o.metric === 'platform_mau_proxy') {
    return o.value * (o.unique_user_factor ?? 1);
  }
  if (o.metric === 'passive_eligible_devices') {
    return o.value * (o.availability_rate ?? 1) * (o.activation_rate ?? 1);
  }
  return o.value;
}

export function buildAiAdoptionPayload(input: AiAdoptionPayloadInput) {
  const { observations, sources, assumptions, model } = input;
  const displayModel = model;

  const generatedAt = input.generatedAt ?? nowIso();
  const now = new Date(generatedAt);

  // `updated_at` is the freshest underlying observation date (content-derived),
  // NOT the build clock. It feeds the /aiadoption JSON-LD `dateModified` and the
  // visible 更新 pill, so deriving it from the data keeps both stable across
  // rebuilds — they only advance when newer data lands, which is what "last
  // updated" should mean. Using nowIso() here made the SEO baseline drift on
  // every new UTC day even when nothing changed (2026-06-03).
  const dataAsOf =
    observations.map((o) => o.as_of_date).sort().at(-1) ?? generatedAt.slice(0, 10);

  const nTotal = metricValue(observations, assumptions.primary_denominator_metric);
  const nPopulation = metricValue(observations, assumptions.auxiliary_denominator_metric);
  // Denominators must be strictly positive: N_total caps the passive layer and
  // N_population − N_total is the published offline count, so a 0 here would
  // silently zero out or invert those. assertFiniteNumber only rules out
  // NaN/±Infinity, not 0.
  if (nTotal <= 0) {
    throw new Error(`[ai-adoption] primary denominator ${assumptions.primary_denominator_metric} must be > 0, got ${nTotal}`);
  }
  if (nPopulation <= 0) {
    throw new Error(`[ai-adoption] auxiliary denominator ${assumptions.auxiliary_denominator_metric} must be > 0, got ${nPopulation}`);
  }

  const devRaw = metricSum(observations, 'developer_active_users');
  const nDev = devRaw * (1 - parameter(assumptions, 'dev_multi_tool_overlap'));

  const paidGross = metricSum(observations, 'vendor_arr_usd') /
    parameter(assumptions, 'paid_consumer_arpu_annual_usd');
  const paidAfterPlatformDedup = paidGross * (1 - parameter(assumptions, 'paid_multi_platform_overlap'));
  const paidDevOverlap = Math.min(
    paidAfterPlatformDedup * parameter(assumptions, 'paid_dev_overlap_rate'),
    nDev * 0.75,
  );
  const nPro = Math.max(0, paidAfterPlatformDedup - paidDevOverlap);

  const freeGross = observations
    .filter((o) => o.metric === 'platform_mau_proxy')
    .reduce((sum, o) => sum + derivedValue(o, assumptions), 0);
  const freeUpperOverlap = (nDev + nPro) * parameter(assumptions, 'free_upper_layer_overlap_rate');
  const nFree = Math.max(0, freeGross - freeUpperOverlap);

  const passiveGross = observations
    .filter((o) => o.metric === 'passive_eligible_devices')
    .reduce((sum, o) => sum + derivedValue(o, assumptions), 0);
  const passiveExplicitOverlap = (nDev + nPro + nFree) * parameter(assumptions, 'passive_explicit_overlap_rate');
  const passiveUncapped = Math.max(0, passiveGross - passiveExplicitOverlap);
  const nPassive = clamp(passiveUncapped, 0, Math.max(0, nTotal - nDev - nPro - nFree));

  // Internet users that none of the four layers claims. This is a reconciliation
  // residual for the maintainer (it shows how much of N_total the model has
  // "explained"), NOT a published group: the page never presents the four
  // layers as a 100% split of anything, so it is not surfaced as a layer.
  const internetUsersNotInLayers = Math.max(0, nTotal - nDev - nPro - nFree - nPassive);

  const totals: Record<LayerId | 'N_total' | 'N_population', number> = {
    N_total: round(nTotal),
    N_population: round(nPopulation),
    N_dev: round(nDev),
    N_pro: round(nPro),
    N_free: round(nFree),
    N_passive: round(nPassive),
  };

  // The public headline numbers. Each one is a distinct population; they are
  // published side by side and are never summed into a "touch rate" or drawn
  // as a 100% chart. `self_users` is the people who open a generative-AI
  // product themselves (dev + paid + free, already de-duplicated by the
  // overlap chain above). `passive_only_users` are people whose device ships
  // an AI feature they may never open — kept separate, not added in.
  // `offline_people` is population − internet users: a standalone statement,
  // not a funnel residual.
  const summary = {
    self_users: totals.N_dev + totals.N_pro + totals.N_free,
    developer_users: totals.N_dev,
    paid_users: totals.N_pro,
    free_users: totals.N_free,
    passive_only_users: totals.N_passive,
    internet_users: totals.N_total,
    population: totals.N_population,
    offline_people: Math.max(0, totals.N_population - totals.N_total),
  };

  // age_days / freshness_status below are INTENTIONALLY wall-clock-relative:
  // they measure how stale each source is *as of now*, so they SHOULD advance
  // between builds even when the data is unchanged. That is why they use `now`
  // (not the content-derived dataAsOf above), and why they are excluded from the
  // SEO baseline (rendered freshness pills, not page metadata). Do NOT "fix" this
  // to a content date — staleness is meaningless without a moving reference.
  //
  // Freshness is per source only. There is deliberately no model-level
  // "health score": a single percentage read as a quality grade on the public
  // page, which it never was. A stale input is flagged on its own source card.
  const sourceRows = observations.map((o) => {
    const ageDays = daysSince(o.published_at, now);
    const sourceDef = sources[o.source_key];
    const status = freshnessStatus(ageDays, o.stale_after_days);
    return {
      id: o.id,
      metric: o.metric,
      entity: o.entity,
      value: o.value,
      derived_value: round(derivedValue(o, assumptions)),
      unit: o.unit,
      period: o.period,
      as_of_date: o.as_of_date,
      published_at: o.published_at,
      age_days: ageDays,
      source_key: o.source_key,
      source_label: sourceDef?.label ?? o.source_name,
      source_type: sourceDef?.type ?? o.collection_method,
      source_name: o.source_name,
      source_url: o.source_url,
      collection_method: o.collection_method,
      confidence: o.confidence,
      stale_after_days: o.stale_after_days,
      freshness_status: status,
      used_by: o.used_by,
      note: o.note,
    };
  });

  const layers = displayModel.layers.map((layer) => {
    const value = totals[layer.id];
    const ids = layerObservationIds(layer.id, observations);
    return {
      ...layer,
      value,
      source_ids: ids,
      freshness_status: statusForObservationIds(ids, sourceRows),
      inputs: sourceRows.filter((row) => ids.includes(row.id)),
    };
  });

  const payload = {
    schema_version: '0.2.0',
    model_version: assumptions.model_version,
    period: assumptions.period,
    generated_at: generatedAt,
    updated_at: dataAsOf,
    title_ja: displayModel.title_ja,
    subtitle_ja: displayModel.subtitle_ja,
    denominator: {
      primary_metric: assumptions.primary_denominator_metric,
      primary_value: totals.N_total,
      auxiliary_metric: assumptions.auxiliary_denominator_metric,
      auxiliary_value: totals.N_population,
    },
    totals,
    summary,
    layers,
    formulas: displayModel.layers.map((layer) => ({
      id: layer.id,
      label_ja: layer.label_ja,
      formula_ja: layer.formula_ja,
      rationale_ja: layer.rationale_ja,
      risk_ja: layer.risk_ja,
    })),
    assumptions,
    calculations: {
      dev_raw: round(devRaw),
      paid_gross_users: round(paidGross),
      paid_after_platform_dedup: round(paidAfterPlatformDedup),
      paid_dev_overlap: round(paidDevOverlap),
      free_gross_users: round(freeGross),
      free_upper_overlap: round(freeUpperOverlap),
      passive_gross_users: round(passiveGross),
      passive_explicit_overlap: round(passiveExplicitOverlap),
      internet_users_not_in_layers: round(internetUsersNotInLayers),
    },
    sources: sourceRows,
    source_definitions: sources,
  };

  return payload;
}

export async function buildAiAdoption(distRoot: string): Promise<AiAdoptionBuildResult> {
  const [observations, sources, assumptions, model] = await Promise.all([
    readJson('observations.json', z.array(ObservationSchema)),
    readJson('sources.json', z.record(z.string(), SourceDefSchema)),
    readJson('assumptions.json', AssumptionsSchema),
    readJson('model.json', ModelDefinitionSchema),
  ]);
  const payload = buildAiAdoptionPayload({
    observations,
    sources,
    assumptions,
    model,
    generatedAt: nowIso(),
  });

  const outPath = join(distRoot, 'data.ai-adoption.json');
  await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  return { files: [outPath], rows: payload.layers.length };
}
