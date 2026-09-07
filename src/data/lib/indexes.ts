/**
 * Build-time in-memory indexes — per docs/DATA_ARCHITECTURE.md §7.3.
 *
 * Loaded once by build.ts; passed to all projection modules.
 * Replaces the SQL JOIN that a database would do at query time.
 *
 * Available indexes:
 *   occByid              Map<number, Occupation>
 *   transById            Map<number, TranslationEN>
 *   statsById            Map<number, StatsLegacy>
 *   historyByOcc         Map<number, ScoreHistEntry[]>      sorted by date
 *   latestScoreByOcc     Map<number, ScoreHistEntry>      最新観測
 *   consensusByOcc       Map<number, ConsensusScore>
 *   canonicalScoreByOcc  Map<number, ScoreHistEntry>      正典（総合）
 *   runsByModel          Map<string, ScoreRun[]>
 *   labelsByDim          Map<string, Map<string, LabelEntry>>
 *   sectors              SectorDef[]
 *   sectorOverrides      Map<string, string>                 padded_id → sector_id
 *   sectorByOcc          Map<number, SectorAssignment>       derived per-occupation
 *
 * ─── Location decision (Phase D/E follow-up, 2026-05-16) ──────────────────
 *
 * Stays in `src/data/lib/` (NOT `src/lib/` or `src/graph/`).
 *
 * Rationale: this module is the build-pipeline data join core. 9 projection
 * modules under `src/data/projections/*.ts` all import it; no consumer
 * outside the build pipeline does — the only external referent is
 * `src/graph/equivalence.test.ts`, which asserts the legacy Indexes shape
 * is byte-equivalent to what loadGraph() now produces (test by design).
 *
 * The 5-layer architecture (architecture.md §2) treats `src/data/` as
 * Layer 1's build pipeline — exactly where this belongs. Moving to
 * `src/graph/` would couple Layer 2 to projection internals; moving to
 * `src/lib/` would conflate ETL plumbing with UI helpers.
 *
 * If/when projection retirement reduces the consumer count to zero, this
 * file becomes deletable — not movable. Do not relocate.
 */
import {
  LabelsFileSchema,
  OccupationSchema,
  ScoreRunSchema,
  SectorOverridesSchema,
  SectorsFileSchema,
  StatsLegacySchema,
  TranslationENSchema,
  type LabelEntry,
  type Occupation,
  type ScoreRun,
  type SectorDef,
  type StatsLegacy,
  type TranslationEN,
} from '../schema/index.js';
import { dataPath, loadJsonDir, loadJsonFile, type LoadError } from '../loaders.js';

/**
 * Insert into an id-keyed map; record a structured error when the id is
 * already taken. Catches both fixable bugs (two files with the same id) and
 * file-name vs. id mismatches that would otherwise be silently overwritten.
 *
 * Exported for unit testing. Used internally by buildIndexes().
 */
export function insertById<T>(
  map: Map<number, T>,
  id: number,
  value: T,
  errors: LoadError[],
  subdir: string,
): void {
  if (map.has(id)) {
    errors.push({
      file: dataPath(subdir),
      message: `duplicate id ${id} in ${subdir}/`,
    });
    return;
  }
  map.set(id, value);
}
import {
  resolveSector,
  validateSectorDefinitions,
  type SectorAssignment,
} from '../../graph/sector-resolver.js';
import {
  pickLatestScore,
  pickConsensusScore,
  toCanonicalScoreEntry,
  type ScoreHistEntry,
  type ConsensusScore,
} from '../../graph/score-strategy.js';

export interface Indexes {
  occById: Map<number, Occupation>;
  transById: Map<number, TranslationEN>;
  statsById: Map<number, StatsLegacy>;
  historyByOcc: Map<number, ScoreHistEntry[]>;
  latestScoreByOcc: Map<number, ScoreHistEntry>;
  /** Median consensus of comparable AIOIS-10 votes (mms-6b). */
  consensusByOcc: Map<number, ConsensusScore>;
  /** Consensus flattened to ScoreHistEntry for projection drop-in. */
  canonicalScoreByOcc: Map<number, ScoreHistEntry>;
  runsByModel: Map<string, ScoreRun[]>;
  labelsByDim: Map<string, Map<string, LabelEntry>>;
  sectors: SectorDef[];
  sectorOverrides: Map<string, string>;
  sectorByOcc: Map<number, SectorAssignment>;
}

export interface BuildIndexesResult {
  indexes: Indexes;
  errors: LoadError[];
}

/**
 * Load + validate all source data; build all derived indexes.
 *
 * Errors during file loading are collected (not thrown). The caller decides
 * whether to fail the build.
 */
export async function buildIndexes(): Promise<BuildIndexesResult> {
  const errors: LoadError[] = [];

  // ───── Per-occupation file dirs ─────
  const occResult = await loadJsonDir('occupations', OccupationSchema);
  errors.push(...occResult.errors);
  const occById = new Map<number, Occupation>();
  for (const occ of occResult.byKey.values()) {
    insertById(occById, occ.id, occ, errors, 'occupations');
  }

  const transResult = await loadJsonDir('translations/en', TranslationENSchema);
  if (!transResult.dirMissing) errors.push(...transResult.errors);
  const transById = new Map<number, TranslationEN>();
  for (const t of transResult.byKey.values()) {
    insertById(transById, t.id, t, errors, 'translations/en');
  }

  const statsResult = await loadJsonDir('stats_legacy', StatsLegacySchema);
  errors.push(...statsResult.errors);
  const statsById = new Map<number, StatsLegacy>();
  for (const s of statsResult.byKey.values()) {
    insertById(statsById, s.id, s, errors, 'stats_legacy');
  }

  // ───── Score runs ─────
  const scoreResult = await loadJsonDir('scores', ScoreRunSchema);
  if (!scoreResult.dirMissing) errors.push(...scoreResult.errors);
  const runsByModel = new Map<string, ScoreRun[]>();
  for (const run of scoreResult.byKey.values()) {
    if (!runsByModel.has(run.scorer.model)) {
      runsByModel.set(run.scorer.model, []);
    }
    runsByModel.get(run.scorer.model)!.push(run);
  }

  // Build score history per occupation (only consider scope='occupations').
  const historyByOcc = new Map<number, ScoreHistEntry[]>();
  for (const run of scoreResult.byKey.values()) {
    if (run.scope !== 'occupations') continue;
    for (const [occIdStr, entry] of Object.entries(run.scores)) {
      const occId = Number.parseInt(occIdStr, 10);
      if (!Number.isFinite(occId)) {
        errors.push({
          file: dataPath('scores'),
          message: `non-int score key '${occIdStr}' in run ${run.run.run_id}`,
        });
        continue;
      }
      if (!historyByOcc.has(occId)) historyByOcc.set(occId, []);
      historyByOcc.get(occId)!.push({
        model: run.scorer.model,
        date: run.run.run_date,
        ai_risk: entry.ai_risk,
        rationale_ja: entry.rationale_ja,
        confidence: entry.confidence,
        aiois: entry.aiois ?? null,
      });
    }
  }

  // Sort each occ's history by date ascending.
  for (const [, hist] of historyByOcc) {
    hist.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Latest score per occupation (最新観測 / attribution). Canonical public
  // scores are consensusByOcc / canonicalScoreByOcc (mms-6b).
  const latestScoreByOcc = new Map<number, ScoreHistEntry>();
  const consensusByOcc = new Map<number, ConsensusScore>();
  const canonicalScoreByOcc = new Map<number, ScoreHistEntry>();
  for (const [occId, hist] of historyByOcc) {
    latestScoreByOcc.set(occId, pickLatestScore(hist));
    try {
      const consensus = pickConsensusScore(hist);
      consensusByOcc.set(occId, consensus);
      canonicalScoreByOcc.set(occId, toCanonicalScoreEntry(consensus));
    } catch {
      // Occupations with no comparable AIOIS-10 votes stay off the canonical map.
    }
  }

  // Cross-reference sanity.
  const unknownScoreIds: number[] = [];
  for (const occId of historyByOcc.keys()) {
    if (!occById.has(occId)) unknownScoreIds.push(occId);
  }
  if (unknownScoreIds.length > 0) {
    const sample = unknownScoreIds.slice(0, 5).join(', ');
    const ellipsis = unknownScoreIds.length > 5 ? '...' : '';
    errors.push({
      file: dataPath('scores'),
      message: `scores reference unknown occupation ids: [${sample}${ellipsis}]`,
    });
  }

  // ───── Labels ─────
  const labelsByDim = new Map<string, Map<string, LabelEntry>>();
  const labelDimensions = [
    'abilities',
    'interests',
    'knowledge',
    'skills',
    'work_activities',
    'work_characteristics',
    'work_values',
  ];
  for (const dim of labelDimensions) {
    const result = await loadJsonFile(
      dataPath(`labels/${dim}.ja-en.json`),
      LabelsFileSchema,
    );
    if (result.error) {
      errors.push(result.error);
      continue;
    }
    if (result.data) {
      const inner = new Map<string, LabelEntry>();
      for (const [key, entry] of Object.entries(result.data.labels)) {
        inner.set(key, entry);
      }
      labelsByDim.set(result.data.dimension, inner);
    }
  }

  // ───── Sectors ─────
  let sectors: SectorDef[] = [];
  const sectorsResult = await loadJsonFile(
    dataPath('sectors/sectors.ja-en.json'),
    SectorsFileSchema,
  );
  if (sectorsResult.error) {
    errors.push(sectorsResult.error);
  } else if (sectorsResult.data) {
    sectors = sectorsResult.data.sectors;
  }

  let sectorOverridesObj: Record<string, string> = {};
  const overridesResult = await loadJsonFile(
    dataPath('sectors/overrides.json'),
    SectorOverridesSchema,
  );
  if (overridesResult.error) {
    errors.push(overridesResult.error);
  } else if (overridesResult.data) {
    sectorOverridesObj = overridesResult.data.overrides;
  }
  const sectorOverrides = new Map<string, string>(Object.entries(sectorOverridesObj));

  for (const problem of validateSectorDefinitions(sectors)) {
    errors.push({
      file: dataPath('sectors/sectors.ja-en.json'),
      message: problem,
    });
  }

  // Per-occupation sector assignment.
  const sectorByOcc = new Map<number, SectorAssignment>();
  if (sectors.length > 0) {
    for (const [occId, occ] of occById) {
      sectorByOcc.set(
        occId,
        resolveSector(occId, occ.classifications.mhlw_main, sectors, sectorOverridesObj),
      );
    }
  }

  return {
    indexes: {
      occById,
      transById,
      statsById,
      historyByOcc,
      latestScoreByOcc,
      consensusByOcc,
      canonicalScoreByOcc,
      runsByModel,
      labelsByDim,
      sectors,
      sectorOverrides,
      sectorByOcc,
    },
    errors,
  };
}
