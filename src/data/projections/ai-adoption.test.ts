import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildAiAdoptionPayload,
  type Assumptions,
  type ModelDefinition,
  type Observation,
  type SourceDef,
} from './ai-adoption.js';

const generatedAt = '2026-06-24T00:00:00.000Z';

function observation(overrides: Partial<Observation> & Pick<Observation, 'id' | 'metric' | 'value' | 'used_by'>): Observation {
  return {
    entity: 'fixture',
    unit: 'users',
    period: '2026',
    as_of_date: '2026-06-20',
    published_at: '2026-06-20',
    source_key: 'fixture',
    source_name: 'Fixture source',
    source_url: 'https://example.test/source',
    collection_method: 'fixture',
    confidence: 'medium',
    stale_after_days: 10,
    note: '',
    ...overrides,
  };
}

function source(overrides: Partial<SourceDef> = {}): SourceDef {
  return {
    label: 'Fixture source',
    type: 'fixture',
    default_frequency: 'ad hoc',
    default_confidence: 'medium',
    stale_after_days: 10,
    ...overrides,
  };
}

const assumptions: Assumptions = {
  model_version: 'fixture-v1',
  period: '2026',
  primary_denominator_metric: 'global_internet_users',
  auxiliary_denominator_metric: 'global_population',
  parameters: {
    dev_multi_tool_overlap: { value: 0.25, label_ja: 'dev overlap', rationale_ja: 'fixture' },
    paid_consumer_arpu_annual_usd: { value: 12, label_ja: 'paid arpu', rationale_ja: 'fixture' },
    paid_multi_platform_overlap: { value: 0.1, label_ja: 'paid overlap', rationale_ja: 'fixture' },
    paid_dev_overlap_rate: { value: 0.2, label_ja: 'paid dev overlap', rationale_ja: 'fixture' },
    free_upper_layer_overlap_rate: { value: 0.1, label_ja: 'free overlap', rationale_ja: 'fixture' },
    passive_explicit_overlap_rate: { value: 0.2, label_ja: 'passive overlap', rationale_ja: 'fixture' },
  },
};

const model: ModelDefinition = {
  title_ja: 'Fixture adoption',
  subtitle_ja: 'Synthetic characterization fixture',
  layers: [
    { id: 'N_dev', label_ja: 'Dev', short_label_ja: 'Dev', formula_ja: 'fixture', rationale_ja: 'fixture', risk_ja: 'fixture', color: '#111111' },
    { id: 'N_pro', label_ja: 'Pro', short_label_ja: 'Pro', formula_ja: 'fixture', rationale_ja: 'fixture', risk_ja: 'fixture', color: '#222222' },
    { id: 'N_free', label_ja: 'Free', short_label_ja: 'Free', formula_ja: 'fixture', rationale_ja: 'fixture', risk_ja: 'fixture', color: '#333333' },
    { id: 'N_passive', label_ja: 'Passive', short_label_ja: 'Passive', formula_ja: 'fixture', rationale_ja: 'fixture', risk_ja: 'fixture', color: '#444444' },
    { id: 'N_unreached', label_ja: 'Unreached', short_label_ja: 'None', formula_ja: 'fixture', rationale_ja: 'fixture', risk_ja: 'fixture', color: '#555555' },
  ],
};

function buildFixturePayload() {
  const observations: Observation[] = [
    observation({
      id: 'internet',
      metric: 'global_internet_users',
      value: 1000.4,
      confidence: 'high',
      source_key: 'denominator',
      used_by: ['N_total'],
    }),
    observation({
      id: 'population',
      metric: 'global_population',
      value: 2000.1,
      source_key: 'denominator',
      used_by: ['N_population'],
    }),
    observation({
      id: 'dev-primary',
      metric: 'developer_active_users',
      value: 100.4,
      confidence: 'high',
      source_key: 'dev',
      used_by: ['N_dev'],
    }),
    observation({
      id: 'dev-secondary',
      metric: 'developer_active_users',
      value: 50.4,
      published_at: '2026-06-10',
      source_key: 'dev',
      used_by: ['N_dev'],
    }),
    observation({
      id: 'paid-arr',
      metric: 'vendor_arr_usd',
      value: 2400,
      unit: 'usd',
      confidence: 'high',
      source_key: 'paid',
      used_by: ['N_pro'],
    }),
    observation({
      id: 'free-platform-a',
      metric: 'platform_mau_proxy',
      value: 300,
      unique_user_factor: 0.8,
      confidence: 'low',
      published_at: '2026-05-01',
      source_key: 'free',
      used_by: ['N_free'],
    }),
    observation({
      id: 'free-platform-b',
      metric: 'platform_mau_proxy',
      value: 120,
      unique_user_factor: 0.5,
      source_key: 'free',
      used_by: ['N_free'],
    }),
    observation({
      id: 'passive-devices',
      metric: 'passive_eligible_devices',
      value: 800,
      availability_rate: 0.5,
      activation_rate: 0.9,
      confidence: 'high',
      source_key: 'passive',
      used_by: ['N_passive'],
    }),
  ];

  return buildAiAdoptionPayload({
    observations,
    sources: {
      denominator: source({ label: 'Denominator' }),
      dev: source({ label: 'Developer tools' }),
      paid: source({ label: 'Paid platforms' }),
      free: source({ label: 'Free platforms' }),
      passive: source({ label: 'Passive devices' }),
    },
    assumptions,
    model,
    generatedAt,
  });
}

test('ai-adoption applies overlap dedupe chain and residual rounding exactly', () => {
  // Arrange / Act
  const payload = buildFixturePayload();
  const layerSum =
    payload.totals.N_dev +
    payload.totals.N_pro +
    payload.totals.N_free +
    payload.totals.N_passive +
    payload.totals.N_unreached;

  // Assert
  assert.deepEqual(payload.totals, {
    N_total: 1000,
    N_population: 2000,
    N_dev: 113,
    N_pro: 144,
    N_free: 274,
    N_passive: 254,
    N_unreached: 215,
  });
  assert.equal(layerSum, payload.totals.N_total);
  assert.equal(payload.calculations.dev_raw, 151);
  assert.equal(payload.calculations.paid_gross_users, 200);
  assert.equal(payload.calculations.paid_after_platform_dedup, 180);
  assert.equal(payload.calculations.paid_dev_overlap, 36);
  assert.equal(payload.calculations.free_gross_users, 300);
  assert.equal(payload.calculations.free_upper_overlap, 26);
  assert.equal(payload.calculations.passive_gross_users, 360);
  assert.equal(payload.calculations.passive_explicit_overlap, 106);
});

test('ai-adoption weights freshness by confidence and rolls worst source status into layers', () => {
  // Arrange / Act
  const payload = buildFixturePayload();

  // Assert
  assert.equal(payload.freshness.score, 0.873);
  assert.equal(payload.freshness.status, 'fresh');
  assert.equal(payload.sources.find((row) => row.id === 'dev-secondary')?.freshness_status, 'review_needed');
  assert.equal(payload.sources.find((row) => row.id === 'free-platform-a')?.freshness_status, 'stale');
  assert.equal(payload.layers.find((layer) => layer.id === 'N_dev')?.freshness_status, 'review_needed');
  assert.equal(payload.layers.find((layer) => layer.id === 'N_free')?.freshness_status, 'stale');
  assert.equal(payload.layers.find((layer) => layer.id === 'N_unreached')?.freshness_status, 'stale');
});
