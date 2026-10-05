import personalityCopy from '../../../content/model-personality.ja.json';
import type { PairSummary } from './batches.js';

const STRONG_THRESHOLD = 0.75;
const MODERATE_THRESHOLD = 0.5;
export const AIOIS_DIM_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'] as const;

type Strength = 'strong' | 'moderate';
type Direction = 'positive' | 'negative';

function modelKey(model: string): string {
  return model.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function fallbackPersonalityId(model: string): string {
  const specific = `${modelKey(model)}_neutral`;
  if (specific in personalityCopy.sentences) return specific;
  return 'default_neutral';
}

export function choosePersonalityId(
  model: string,
  dimDrifts: readonly number[],
  sign: 1 | -1,
  availableIds: ReadonlySet<string>,
): string {
  const fallback = availableIds.has(`${modelKey(model)}_neutral`) ? `${modelKey(model)}_neutral` : 'default_neutral';
  const signedDrifts = dimDrifts.map((value, index) => ({
    dim: AIOIS_DIM_KEYS[index]!,
    value: value * sign,
    abs: Math.abs(value),
  }));
  signedDrifts.sort((a, b) => b.abs - a.abs || AIOIS_DIM_KEYS.indexOf(a.dim) - AIOIS_DIM_KEYS.indexOf(b.dim));
  const driver = signedDrifts[0];
  if (!driver || driver.abs < MODERATE_THRESHOLD) return fallback;

  const strength: Strength = driver.abs >= STRONG_THRESHOLD ? 'strong' : 'moderate';
  const direction: Direction = driver.value >= 0 ? 'positive' : 'negative';
  const specific = `${modelKey(model)}_${driver.dim}_${direction}_${strength}`;
  if (availableIds.has(specific)) return specific;
  const generic = `default_${driver.dim}_${direction}_${strength}`;
  if (availableIds.has(generic)) return generic;
  return fallback;
}

export function personalityIdForModel(
  model: string,
  pairs: readonly PairSummary[],
): string {
  const pair = [...pairs].reverse().find((candidatePair) =>
    candidatePair.candidate.model === model || candidatePair.base.model === model,
  );
  if (!pair) return fallbackPersonalityId(model);

  const sign = pair.candidate.model === model ? 1 : -1;
  return choosePersonalityId(model, pair.report.dimDrift, sign, new Set(Object.keys(personalityCopy.sentences)));
}

