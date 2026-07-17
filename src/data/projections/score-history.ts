/**
 * data.score_history.json projection — per docs/MULTI_MODEL_SCORING.md Phase 2a.
 *
 * Consumer: comparison UI (multi-model scoring).
 * Shape: { occupation_id -> [{ model, date, transformation, displacement, dims }] }
 *
 * This projection intentionally carries numbers plus model/date only. The
 * score rationale remains in the canonical detail projection.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Aiois10 } from '../../graph/types.js';
import { ScoreHistoryProjectionSchema } from '../../lib/projection-schemas.js';
import type { Indexes } from '../lib/indexes.js';

const AIOIS_DIM_KEYS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'] as const;

type AioisDimKey = typeof AIOIS_DIM_KEYS[number];
type ScoreHistoryDims = Record<AioisDimKey, number>;

export interface ScoreHistoryEntry {
  model: string;
  date: string;
  transformation: number;
  displacement: number | null;
  dims: ScoreHistoryDims | null;
}

export type ScoreHistoryPayload = Record<string, ScoreHistoryEntry[]>;

export interface ScoreHistoryBuildResult {
  files: string[];
  occupations: number;
  entries: number;
}

function dimsFromAiois(aiois: Aiois10): ScoreHistoryDims {
  const dims = {} as ScoreHistoryDims;
  for (const key of AIOIS_DIM_KEYS) {
    dims[key] = aiois[key];
  }
  return dims;
}

export function buildScoreHistoryPayload(indexes: Indexes): ScoreHistoryPayload {
  const payload: ScoreHistoryPayload = {};
  const sortedIds = [...indexes.latestScoreByOcc.keys()].sort((a, b) => a - b);

  for (const occId of sortedIds) {
    const history = indexes.historyByOcc.get(occId);
    if (!history || history.length === 0) {
      throw new Error(`[score-history] latest score exists but history is missing for occupation ${occId}`);
    }

    payload[String(occId)] = history.map((entry): ScoreHistoryEntry => {
      if (entry.aiois == null) {
        return {
          model: entry.model,
          date: entry.date,
          transformation: entry.ai_risk,
          displacement: null,
          dims: null,
        };
      }

      return {
        model: entry.model,
        date: entry.date,
        transformation: entry.aiois.transformation,
        displacement: entry.aiois.displacement,
        dims: dimsFromAiois(entry.aiois),
      };
    });
  }

  return ScoreHistoryProjectionSchema.parse(payload);
}

export async function buildScoreHistory(
  indexes: Indexes,
  distRoot: string,
): Promise<ScoreHistoryBuildResult> {
  const payload = buildScoreHistoryPayload(indexes);
  const outPath = join(distRoot, 'data.score_history.json');
  await writeFile(outPath, JSON.stringify(payload) + '\n', 'utf-8');

  return {
    files: [outPath],
    occupations: Object.keys(payload).length,
    entries: Object.values(payload).reduce((sum, history) => sum + history.length, 0),
  };
}
