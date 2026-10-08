import type { GeoFacts } from './geo-facts.js';
import { riskBandWord } from '../lib/risk.js';
import { formatScoreFixed1 } from '../lib/score-format.js';

export interface HomeKpiView {
  readonly occupationCount: string;
  readonly workforceMan: string;
  readonly meanAiImpact: string;
  readonly meanBand: string;
  readonly highImpactCount: string;
  readonly highImpactWagesTrillion: string;
  readonly bands: Readonly<Record<string, { count: string; sharePct: string }>>;
}

export function buildHomeKpiView(facts: GeoFacts): HomeKpiView {
  return {
    occupationCount: String(facts.occupationCount),
    workforceMan: Math.round(facts.totalWorkforce / 10_000).toLocaleString('en-US'),
    meanAiImpact: formatScoreFixed1(facts.meanAiImpactRaw),
    meanBand: riskBandWord(facts.meanAiImpactRaw) ?? '',
    highImpactCount: String(facts.highImpactCount),
    highImpactWagesTrillion: facts.highImpactAnnualWagesTrillion.toFixed(1),
    bands: Object.fromEntries(facts.fiveBandDistribution.map((band) => [
      band.key,
      { count: String(band.count), sharePct: String(band.sharePct) },
    ])),
  };
}

function sectorBandWord(raw: number, id: string): string {
  const word = riskBandWord(raw);
  if (!word) throw new Error(`home-facts-render: sector ${id} mean has no band word`);
  return word;
}

/** Bind every active-batch fact in the homepage fragment from one aggregate. */
export function bindHomeFacts(template: string, facts: GeoFacts): string {
  const view = buildHomeKpiView(facts);
  const replacements = new Map<string, string>([
    ['__OCCUPATION_COUNT_SCORED__', view.occupationCount],
    ['__ACTIVE_BATCH_WORKFORCE_MAN__', view.workforceMan],
    ['__ACTIVE_BATCH_MEAN_AI_IMPACT__', view.meanAiImpact],
    ['__ACTIVE_BATCH_MEAN_BAND__', view.meanBand],
    ['__ACTIVE_BATCH_HIGH_IMPACT_COUNT__', view.highImpactCount],
    ['__ACTIVE_BATCH_HIGH_IMPACT_WAGES_TRILLION__', view.highImpactWagesTrillion],
  ]);
  for (const band of facts.fiveBandDistribution) {
    const tokenKey = band.key.replace('-', '_');
    const value = view.bands[band.key];
    if (!value) throw new Error(`home-facts-render: missing view for band ${band.key}`);
    replacements.set(`__ACTIVE_BATCH_BAND_${tokenKey}_COUNT__`, value.count);
    replacements.set(`__ACTIVE_BATCH_BAND_${tokenKey}_PCT__`, value.sharePct);
  }
  // Each hub card names its sector. The word is the displayed mean, the same
  // mean the sector page prints — not a hardcoded 低/中 leftover.
  const sectorIds = [...template.matchAll(/__SECTOR_BAND_([a-z0-9]+)__/g)].map((match) => match[1]!);
  for (const id of new Set(sectorIds)) {
    const sector = facts.sectorsByMeanImpact.find((candidate) => candidate.id === id);
    if (!sector) throw new Error(`home-facts-render: no sector mean for ${id}`);
    replacements.set(`__SECTOR_BAND_${id}__`, sectorBandWord(sector.meanAiImpactRaw, id));
  }

  let output = template;
  for (const [placeholder, value] of replacements) {
    if (!output.includes(placeholder)) {
      throw new Error(`home-facts-render: homepage template missing ${placeholder}`);
    }
    output = output.replaceAll(placeholder, value);
  }
  if (/__ACTIVE_BATCH_[A-Z0-9_]+__/.test(output)) {
    throw new Error('home-facts-render: unresolved active-batch placeholder');
  }
  if (/__SECTOR_BAND_[a-z0-9]+__/.test(output)) {
    throw new Error('home-facts-render: unresolved sector band placeholder');
  }
  return output;
}
