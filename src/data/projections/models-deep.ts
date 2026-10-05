/**
 * data.models_deep.json projection — visitor-facing /models feature payload.
 *
 * Carries only the compact fields needed by the static magazine page. It is
 * the sole public projection that exposes selected rationale_ja strings;
 * data.score_history.json intentionally remains rationale-free.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ModelsDeepProjectionSchema, type ModelsDeepProjectionShape } from '../../lib/projection-schemas.js';
import type { Indexes } from '../lib/indexes.js';
import { buildBatchSummaries, buildPairSummaries, selectPanel, occupationSpreads, panelEntry, buildLanes } from './models-deep/batches.js';
import { consensusRows, storyRows, automaticStoryIds, warnAboutOrphanedCuration } from './models-deep/stories.js';

export {
  selectPersonalitySentenceIdForTest,
  selectEditorialSentenceIdForTest,
  selectStoryIdsForTest,
  resolveStoryIdsForTest,
  selectConsensusRowsForTest,
  selectAutomaticStoryIdsForTest,
  reportOrphanedCuration,
  type ModelsStoryOverrideConfig,
  type OrphanedCurationReport,
} from './models-deep/stories.js';

export const MODEL_PROJECTION_MAX_BYTES = 30 * 1024;
export type ModelsDeepProjection = ModelsDeepProjectionShape;

export interface ModelsDeepBuildResult {
  files: string[];
  modelCards: number;
  consensus: number;
  stories: number;
  bytes: number;
}

export function buildModelsDeepPayload(indexes: Indexes, generatedAt = new Date().toISOString()): ModelsDeepProjection {
  const batches = buildBatchSummaries(indexes);
  const pairs = buildPairSummaries(indexes, batches);
  const panelBatches = selectPanel(batches);
  const { comparedCount, rows } = occupationSpreads(indexes, panelBatches);
  if (comparedCount < 1) {
    throw new Error('[models-deep] vendor panel has no occupation scored by every panel entry');
  }

  const payload: ModelsDeepProjection = {
    generated_at: generatedAt,
    panel: {
      entries: panelBatches.map((batch) => panelEntry(batch, pairs)),
      compared_count: comparedCount,
    },
    lanes: buildLanes(batches, panelBatches, pairs),
    consensus: consensusRows(rows),
    stories: storyRows(indexes, panelBatches, rows),
  };

  const parsed = ModelsDeepProjectionSchema.parse(payload);
  warnAboutOrphanedCuration(parsed, automaticStoryIds(rows));
  return parsed;
}

export function modelsDeepPayloadBytes(payload: ModelsDeepProjection): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf-8');
}

export async function buildModelsDeep(
  indexes: Indexes,
  distRoot: string,
): Promise<ModelsDeepBuildResult> {
  const payload = buildModelsDeepPayload(indexes);
  const bytes = modelsDeepPayloadBytes(payload);
  if (bytes > MODEL_PROJECTION_MAX_BYTES) {
    throw new Error(`[models-deep] projection is ${bytes} bytes; max is ${MODEL_PROJECTION_MAX_BYTES}`);
  }

  const outPath = join(distRoot, 'data.models_deep.json');
  await writeFile(outPath, JSON.stringify(payload) + '\n', 'utf-8');

  return {
    files: [outPath],
    modelCards: payload.lanes.length,
    consensus: payload.consensus.length,
    stories: payload.stories.length,
    bytes,
  };
}
