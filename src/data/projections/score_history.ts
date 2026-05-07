/**
 * data.score-history/<padded>.json projection — per docs/DATA_ARCHITECTURE.md §6.9.
 *
 * Status: Future (skipped by default)
 * Consumer: future "score evolution" page
 * Shape: { id, history: [{date, model, score, rationale_ja}] }
 *
 * Migrated from scripts/projections/score_history.py.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';

export interface ScoreHistoryBuildResult {
  files: string[];
  dir: string;
  fileCount: number;
}

export async function buildScoreHistory(
  indexes: Indexes,
  distRoot: string,
): Promise<ScoreHistoryBuildResult> {
  const outDir = join(distRoot, 'data.score-history');
  await mkdir(outDir, { recursive: true });

  const writtenFiles: string[] = [];

  // Iterate Map in insertion order, matching Python dict iteration.
  for (const [occId, hist] of indexes.historyByOcc) {
    if (hist.length === 0) continue;
    const payload = {
      id: occId,
      schema_version: '1.0',
      history: hist.map((e) => ({
        date: e.date,
        model: e.model,
        score: e.ai_risk,
        rationale_ja: e.rationale_ja,
      })),
    };
    const padded = String(occId).padStart(4, '0');
    const filePath = join(outDir, `${padded}.json`);
    await writeFile(
      filePath,
      JSON.stringify(payload) + '\n',
      'utf-8',
    );
    writtenFiles.push(filePath);
  }

  return {
    files: writtenFiles,
    dir: outDir,
    fileCount: writtenFiles.length,
  };
}
