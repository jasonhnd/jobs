import type { DetailFileMin } from '../genre-hub.js';
import { displayScore } from '../../data/lib/banker-round.js';

// Helper predicates
export const lowAi = (d: DetailFileMin) => {
  const ai = d.ai_risk?.score;
  if (ai === null || ai === undefined || displayScore(ai) > 4) return null;
  return -ai * 1000 + (d.stats?.workers ?? 0) / 1000;
};
export const highAi = (d: DetailFileMin) => {
  const ai = d.ai_risk?.score;
  if (ai === null || ai === undefined || displayScore(ai) < 7) return null;
  return ai * 1000 + (d.stats?.workers ?? 0) / 1000;
};
export const lowAiSector = (d: DetailFileMin, sectors: string[]) => {
  if (!sectors.includes(d.sector?.id ?? '')) return null;
  return lowAi(d);
};
