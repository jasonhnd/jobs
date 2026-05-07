/**
 * data.search.json projection — per docs/DATA_ARCHITECTURE.md §6.4 (v1.2.0).
 *
 * Status: Planned
 * Consumer: search page (mobile ③ 検索結果 + desktop), feeds FlexSearch / MiniSearch
 *
 * `workforce_band` and `category_size` are nearly identical (3-bucket worker
 * counts) but use slightly different thresholds — `workforce_band` uses the
 * canonical lib.bands thresholds (2万/10万); `category_size` preserves the
 * legacy 10万/100万 thresholds. Both are emitted for gradual migration.
 *
 * Migrated from scripts/projections/search.py.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import { riskBand, workforceBand } from '../lib/bands.js';

type LegacyCategorySize = 'small' | 'medium' | 'large' | null;

export interface SearchBuildResult {
  files: string[];
  documents: number;
}

function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

/**
 * Legacy 3-bucket worker count (kept under the name `category_size`).
 * Thresholds differ from `workforceBand` — preserved verbatim for back-compat.
 */
function bucketWorkersLegacy(
  workers: number | null | undefined,
): LegacyCategorySize {
  if (workers == null) return null;
  if (workers < 100_000) return 'small';
  if (workers <= 1_000_000) return 'medium';
  return 'large';
}

export async function buildSearch(
  indexes: Indexes,
  distRoot: string,
): Promise<SearchBuildResult> {
  const documents: unknown[] = [];
  const sortedIds = [...indexes.occById.keys()].sort((a, b) => a - b);

  for (const occId of sortedIds) {
    const occ = indexes.occById.get(occId)!;
    const stats = indexes.statsById.get(occId);
    const score = indexes.latestScoreByOcc.get(occId);
    const assignment = indexes.sectorByOcc.get(occId);

    documents.push({
      id: occId,
      title_ja: occ.title_ja,
      aliases_ja: occ.aliases_ja,

      // v1.1.0 additive — sector + canonical bands
      sector_id: assignment ? assignment.sector_id : null,
      risk_band: riskBand(score ? score.ai_risk : null),
      workforce_band: workforceBand(stats ? stats.workers ?? null : null),

      // Legacy
      category_size: bucketWorkersLegacy(stats ? stats.workers ?? null : null),
      ai_risk: score ? score.ai_risk : null,
    });
  }

  const payload = {
    schema_version: '1.2',
    generated_at: nowIso(),
    document_count: documents.length,
    documents,
  };

  const outPath = join(distRoot, 'data.search.json');
  await writeFile(
    outPath,
    JSON.stringify(payload) + '\n',
    'utf-8',
  );

  return { files: [outPath], documents: documents.length };
}
