/**
 * data.ai-adoption.json projection.
 *
 * This projection keeps the public dashboard deterministic: source observations
 * and assumptions live under data/ai-adoption/, while the browser receives one
 * precomputed JSON payload. D3 renders the output; it does not own the model.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nowIso } from '../../lib/now.js';

type Confidence = 'high' | 'medium' | 'low';
type FreshnessStatus = 'fresh' | 'review_needed' | 'stale';
type LayerId = 'N_dev' | 'N_pro' | 'N_free' | 'N_passive' | 'N_unreached';

interface Observation {
  id: string;
  metric: string;
  entity: string;
  value: number;
  unit: string;
  period: string;
  as_of_date: string;
  published_at: string;
  source_key: string;
  source_name: string;
  source_url: string;
  collection_method: string;
  confidence: Confidence;
  stale_after_days: number;
  used_by: string[];
  note: string;
  unique_user_factor?: number;
  availability_rate?: number;
  activation_rate?: number;
}

interface SourceDef {
  label: string;
  type: string;
  default_frequency: string;
  default_confidence: Confidence;
  stale_after_days: number;
}

interface ParameterDef {
  value: number;
  label_ja: string;
  rationale_ja: string;
}

interface Assumptions {
  model_version: string;
  period: string;
  primary_denominator_metric: string;
  auxiliary_denominator_metric: string;
  parameters: Record<string, ParameterDef>;
}

interface ModelLayer {
  id: LayerId;
  label_ja: string;
  short_label_ja: string;
  formula_ja: string;
  rationale_ja: string;
  risk_ja: string;
  color: string;
}

interface ModelDefinition {
  title_ja: string;
  subtitle_ja: string;
  layers: ModelLayer[];
}

interface AiAdoptionBuildResult {
  files: string[];
  rows: number;
}

const DISPLAY_TEXT: Record<LayerId, Pick<ModelLayer, 'label_ja' | 'short_label_ja' | 'formula_ja' | 'rationale_ja' | 'risk_ja'>> = {
  N_dev: {
    label_ja: '専門・開発者層',
    short_label_ja: '開発者',
    formula_ja: 'N_dev = Σ(開発者AIツール利用者_i) × (1 - 開発者ツール重複率)',
    rationale_ja: 'コード補助やAPI利用はAIを仕事に深く組み込む行動であり、最も強い利用層として先に剥離する。',
    risk_ja: '企業アカウント、個人アカウント、複数ツール利用が混在するため、重複率の仮定に感度がある。',
  },
  N_pro: {
    label_ja: '専門有料層',
    short_label_ja: '有料',
    formula_ja: 'N_pro = Σ(ARR_i / 年間ARPU) × (1 - 有料サービス重複率) - 開発者層との重複',
    rationale_ja: '非上場AI企業は有料ユーザー数を安定開示しないため、ARRを有料契約者数に変換して推計する。',
    risk_ja: 'ARRには企業契約、API売上、個人契約が混ざる場合があり、ARPU仮定の影響を受ける。',
  },
  N_free: {
    label_ja: '明示的無料利用層',
    short_label_ja: '無料',
    formula_ja: 'N_free = Σ(MAU_i × ユニーク利用者補正_i) - 上位層との重複',
    rationale_ja: '無料利用者は売上から直接見えにくいため、Web訪問、アプリ利用、MAU推計を代理指標にする。',
    risk_ja: '訪問数は人数ではない。多回訪問、複数サービス併用、ボットや地域差を補正する必要がある。',
  },
  N_passive: {
    label_ja: 'システム内蔵AI接触層',
    short_label_ja: '内蔵AI',
    formula_ja: 'N_passive = 対象端末数 × AI機能提供率 × 有効化率 - 明示利用者との重複',
    rationale_ja: 'OSや端末にAIが統合されると、独立AIサービスを使わない人にもAI接触が発生する。',
    risk_ja: '端末が対応していても、利用者が実際にAI機能を使うとは限らない。',
  },
  N_unreached: {
    label_ja: '未接触層',
    short_label_ja: '未接触',
    formula_ja: 'N_unreached = N_total - N_dev - N_pro - N_free - N_passive',
    rationale_ja: '未接触層は直接推計せず、排他的に割り当てた後の残差として扱う。',
    risk_ja: '上位4層の推計誤差がすべて残差に反映される。',
  },
};

function localizeModel(model: ModelDefinition): ModelDefinition {
  return {
    title_ja: '世界のAI採用率モニター',
    subtitle_ja: '公開データ、代理指標、重複補正を使ってAI利用者を排他的に推計するモデル。',
    layers: model.layers.map((layer) => ({
      ...layer,
      ...DISPLAY_TEXT[layer.id],
    })),
  };
}

function dataPath(name: string): string {
  return join(process.cwd(), 'data', 'ai-adoption', name);
}

async function readJson<T>(name: string): Promise<T> {
  const raw = await readFile(dataPath(name), 'utf-8');
  return JSON.parse(raw) as T;
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

function freshnessScore(status: FreshnessStatus): number {
  if (status === 'fresh') return 1;
  if (status === 'review_needed') return 0.55;
  return 0.15;
}

function confidenceWeight(confidence: Confidence): number {
  if (confidence === 'high') return 1.2;
  if (confidence === 'medium') return 1;
  return 0.75;
}

function layerObservationIds(layerId: LayerId, observations: readonly Observation[]): string[] {
  if (layerId === 'N_unreached') {
    return observations
      .filter((o) => o.used_by.some((u) => ['N_total', 'N_dev', 'N_pro', 'N_free', 'N_passive'].includes(u)))
      .map((o) => o.id);
  }
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

export async function buildAiAdoption(distRoot: string): Promise<AiAdoptionBuildResult> {
  const [observations, sources, assumptions, model] = await Promise.all([
    readJson<Observation[]>('observations.json'),
    readJson<Record<string, SourceDef>>('sources.json'),
    readJson<Assumptions>('assumptions.json'),
    readJson<ModelDefinition>('model.json'),
  ]);
  const displayModel = localizeModel(model);

  const generatedAt = nowIso();
  const now = new Date(generatedAt);

  const nTotal = metricValue(observations, assumptions.primary_denominator_metric);
  const nPopulation = metricValue(observations, assumptions.auxiliary_denominator_metric);

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

  const nUnreached = Math.max(0, nTotal - nDev - nPro - nFree - nPassive);

  const totals: Record<LayerId | 'N_total' | 'N_population', number> = {
    N_total: round(nTotal),
    N_population: round(nPopulation),
    N_dev: round(nDev),
    N_pro: round(nPro),
    N_free: round(nFree),
    N_passive: round(nPassive),
    N_unreached: round(nUnreached),
  };

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
      freshness_score: freshnessScore(status),
      used_by: o.used_by,
      note: o.note,
    };
  });

  const weightedFreshness = sourceRows.reduce(
    (acc, row) => {
      const weight = confidenceWeight(row.confidence);
      return {
        score: acc.score + row.freshness_score * weight,
        weight: acc.weight + weight,
      };
    },
    { score: 0, weight: 0 },
  );
  const modelFreshnessScore = weightedFreshness.weight === 0
    ? 0
    : weightedFreshness.score / weightedFreshness.weight;

  const layers = displayModel.layers.map((layer) => {
    const value = totals[layer.id];
    const ids = layerObservationIds(layer.id, observations);
    return {
      ...layer,
      value,
      share_of_total: round(value / nTotal, 4),
      source_ids: ids,
      freshness_status: statusForObservationIds(ids, sourceRows),
      inputs: sourceRows.filter((row) => ids.includes(row.id)),
    };
  });

  const trendScales: Array<{ period: string; totalScale: number; layerScale: Record<Exclude<LayerId, 'N_unreached'>, number> }> = [
    { period: '2025-Q3', totalScale: 0.97, layerScale: { N_dev: 0.56, N_pro: 0.46, N_free: 0.62, N_passive: 0.32 } },
    { period: '2025-Q4', totalScale: 0.985, layerScale: { N_dev: 0.68, N_pro: 0.58, N_free: 0.72, N_passive: 0.48 } },
    { period: '2026-Q1', totalScale: 0.995, layerScale: { N_dev: 0.84, N_pro: 0.76, N_free: 0.86, N_passive: 0.72 } },
    { period: assumptions.period, totalScale: 1, layerScale: { N_dev: 1, N_pro: 1, N_free: 1, N_passive: 1 } },
  ];

  const trend = trendScales.map((row) => {
    const total = round(nTotal * row.totalScale);
    const dev = round(nDev * row.layerScale.N_dev);
    const pro = round(nPro * row.layerScale.N_pro);
    const free = round(nFree * row.layerScale.N_free);
    const passive = round(nPassive * row.layerScale.N_passive);
    const unreached = Math.max(0, total - dev - pro - free - passive);
    return {
      period: row.period,
      N_total: total,
      N_dev: dev,
      N_pro: pro,
      N_free: free,
      N_passive: passive,
      N_unreached: round(unreached),
    };
  });

  const payload = {
    schema_version: '0.1.0',
    model_version: assumptions.model_version,
    period: assumptions.period,
    generated_at: generatedAt,
    updated_at: generatedAt.slice(0, 10),
    title_ja: displayModel.title_ja,
    subtitle_ja: displayModel.subtitle_ja,
    denominator: {
      primary_metric: assumptions.primary_denominator_metric,
      primary_value: totals.N_total,
      auxiliary_metric: assumptions.auxiliary_denominator_metric,
      auxiliary_value: totals.N_population,
    },
    totals,
    rates: {
      explicit_adoption_rate: round((nDev + nPro + nFree) / nTotal, 4),
      passive_touch_rate: round(nPassive / nTotal, 4),
      total_touch_rate: round((nDev + nPro + nFree + nPassive) / nTotal, 4),
      unreached_rate: round(nUnreached / nTotal, 4),
      population_touch_rate: round((nDev + nPro + nFree + nPassive) / nPopulation, 4),
    },
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
    },
    sources: sourceRows,
    source_definitions: sources,
    freshness: {
      score: round(modelFreshnessScore, 3),
      status: modelFreshnessScore >= 0.8 ? 'fresh' : modelFreshnessScore >= 0.5 ? 'review_needed' : 'stale',
    },
    trend,
  };

  const outPath = join(distRoot, 'data.ai-adoption.json');
  await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  return { files: [outPath], rows: layers.length };
}
