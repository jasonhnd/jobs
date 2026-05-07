/**
 * data.sectors.json + data.review_queue.json projection — per docs/DATA_ARCHITECTURE.md §6.11.
 *
 * Status: Planned
 * Consumers:
 *   - mobile frontend (② 職業マップ treemap grouping, ③ 検索 sector chips,
 *     ④/⑤ 詳細 sector tag, 関連職業 candidate pool)
 *   - data ops (review_queue.json — surfaces unmatched / ambiguous occupations
 *     so the operator can edit data/sectors/overrides.json or extend
 *     data/sectors/sectors.ja-en.json seed_codes)
 *
 * Migrated from scripts/projections/sectors.py.
 *
 * Output format intentionally byte-equivalent to the Python output:
 *   - data.sectors.json: compact JSON (no spaces, no indent), trailing newline.
 *   - data.review_queue.json: pretty-printed (2-space indent), trailing newline.
 *   - generated_at: ISO8601 UTC seconds — will differ between runs (skipped in diff).
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';
import type { SectorDef } from '../schema/sector.js';
import { SENTINEL_UNCATEGORIZED } from '../lib/sector-resolver.js';
import { fsum } from '../lib/fsum.js';
import { pythonRound } from '../lib/python-round.js';

interface SectorOutEntry {
  id: string;
  ja: string;
  hue: string;
  description_ja: string | null;
  occupation_count: number;
  mean_ai_risk: number | null;
  total_workforce: number;
  sample_titles_ja: string[];
}

interface UncategorizedEntry {
  id: number;
  padded: string;
  title_ja: string;
  mhlw_main: string | null;
  jsoc_main: string | null;
  provenance: string;
  hint: string | null;
}

interface AmbiguousEntry {
  id: number;
  padded: string;
  title_ja: string;
  mhlw_main: string | null;
  winner_sector_id: string;
  candidate_sector_ids: string[];
}

export interface SectorsBuildResult {
  files: string[];
  sectors: number;
  uncategorized: number;
  ambiguous: number;
  skipped?: string;
}

function nowIso(): string {
  // Match Python's `dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")`
  // → "2026-05-07T16:07:05+00:00"
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

function padded(occId: number): string {
  return String(occId).padStart(4, '0');
}

/**
 * Best-effort hint: which sector LIKELY matches given a partial MHLW code.
 *
 * Pure heuristic — strips the trailing parts of the MHLW code one at a time
 * and returns the first sector whose seed_codes would match a prefix glob.
 * Used only to populate the review_queue 'hint' column for the operator.
 */
function suggestSector(
  mhlwMain: string | null | undefined,
  sectors: readonly SectorDef[],
): string | null {
  if (!mhlwMain) return null;

  const parts = mhlwMain.replace(/-/g, '_').split('_');
  const candidates: string[] = [];

  for (let n = parts.length; n >= 1; n -= 1) {
    const prefix = parts.slice(0, n).join('_');
    for (const s of sectors) {
      for (const seed of s.mhlw_seed_codes) {
        const seedNoStar = seed.replace(/\*+$/, '');
        if (
          mhlwMain.startsWith(seedNoStar) ||
          prefix.startsWith(seedNoStar)
        ) {
          if (!candidates.includes(s.id)) {
            candidates.push(s.id);
          }
        }
      }
    }
    if (candidates.length > 0) {
      return candidates[0]!;
    }
  }
  return null;
}

/**
 * Build data.sectors.json + data.review_queue.json into `distRoot`.
 */
export async function buildSectors(
  indexes: Indexes,
  distRoot: string,
): Promise<SectorsBuildResult> {
  if (indexes.sectors.length === 0) {
    return {
      files: [],
      sectors: 0,
      uncategorized: 0,
      ambiguous: 0,
      skipped: 'no sectors defined in data/sectors/sectors.ja-en.json',
    };
  }

  // ───── Aggregate stats per sector ─────
  // Collect per-sector raw values; sum them with fsum at emit time so the
  // result matches Python 3.12+ sum() (Neumaier compensation).
  const counts = new Map<string, number>();
  const riskValues = new Map<string, number[]>();
  const workforceValues = new Map<string, number[]>();
  const sampleTitles = new Map<string, string[]>();

  const incCount = (m: Map<string, number>, k: string) =>
    m.set(k, (m.get(k) ?? 0) + 1);
  const pushVal = (m: Map<string, number[]>, k: string, v: number) => {
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(v);
  };

  for (const [occId, occ] of indexes.occById) {
    const assignment = indexes.sectorByOcc.get(occId);
    if (!assignment) continue;
    const sid = assignment.sector_id;

    incCount(counts, sid);
    if (!sampleTitles.has(sid)) sampleTitles.set(sid, []);
    const titles = sampleTitles.get(sid)!;
    if (titles.length < 6) titles.push(occ.title_ja);

    const score = indexes.latestScoreByOcc.get(occId);
    if (score) {
      pushVal(riskValues, sid, score.ai_risk);
    }

    const stats = indexes.statsById.get(occId);
    if (stats && stats.workers != null) {
      pushVal(workforceValues, sid, stats.workers);
    }
  }

  // ───── Build sectors payload ─────
  const sectorsOut: SectorOutEntry[] = [];

  const meanRiskFor = (sid: string): number | null => {
    const vs = riskValues.get(sid);
    if (!vs || vs.length === 0) return null;
    return roundTo2(fsum(vs) / vs.length);
  };
  const totalWorkforceFor = (sid: string): number => {
    const vs = workforceValues.get(sid);
    return vs ? Math.round(fsum(vs)) : 0;
  };

  for (const s of indexes.sectors) {
    sectorsOut.push({
      id: s.id,
      ja: s.ja,
      hue: s.hue,
      description_ja: s.description_ja ?? null,
      occupation_count: counts.get(s.id) ?? 0,
      mean_ai_risk: meanRiskFor(s.id),
      total_workforce: totalWorkforceFor(s.id),
      sample_titles_ja: sampleTitles.get(s.id) ?? [],
    });
  }

  if (counts.has(SENTINEL_UNCATEGORIZED)) {
    const sid = SENTINEL_UNCATEGORIZED;
    sectorsOut.push({
      id: sid,
      ja: '未分類',
      hue: 'warm',
      description_ja:
        'MHLW コードがマッピングに合致しなかった職業（dist/data.review_queue.json で確認）',
      occupation_count: counts.get(sid) ?? 0,
      mean_ai_risk: meanRiskFor(sid),
      total_workforce: totalWorkforceFor(sid),
      sample_titles_ja: sampleTitles.get(sid) ?? [],
    });
  }

  const sectorsPayload = {
    schema_version: '1.0',
    generated_at: nowIso(),
    sector_count: indexes.sectors.length,
    sectors: sectorsOut,
  };

  const sectorsPath = join(distRoot, 'data.sectors.json');
  // Match Python: `json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"`
  await writeFile(
    sectorsPath,
    JSON.stringify(sectorsPayload) + '\n',
    'utf-8',
  );

  // ───── Build review_queue ─────
  const uncategorizedEntries: UncategorizedEntry[] = [];
  const ambiguousEntries: AmbiguousEntry[] = [];
  let assigned = 0;

  const sortedOccIds = [...indexes.occById.keys()].sort((a, b) => a - b);
  for (const occId of sortedOccIds) {
    const occ = indexes.occById.get(occId)!;
    const a = indexes.sectorByOcc.get(occId);
    if (!a) continue;

    if (a.sector_id !== SENTINEL_UNCATEGORIZED) {
      assigned += 1;
    }

    if (a.sector_id === SENTINEL_UNCATEGORIZED) {
      uncategorizedEntries.push({
        id: occId,
        padded: padded(occId),
        title_ja: occ.title_ja,
        mhlw_main: occ.classifications.mhlw_main ?? null,
        jsoc_main: occ.classifications.jsoc_main ?? null,
        provenance: a.provenance,
        hint: suggestSector(occ.classifications.mhlw_main, indexes.sectors),
      });
    } else if (a.provenance === 'auto-ambiguous') {
      ambiguousEntries.push({
        id: occId,
        padded: padded(occId),
        title_ja: occ.title_ja,
        mhlw_main: occ.classifications.mhlw_main ?? null,
        winner_sector_id: a.sector_id,
        candidate_sector_ids: [...a.candidates],
      });
    }
  }

  const queuePayload = {
    schema_version: '1.0',
    generated_at: nowIso(),
    summary: {
      total_occupations: indexes.occById.size,
      assigned,
      uncategorized: uncategorizedEntries.length,
      ambiguous: ambiguousEntries.length,
      override_count: indexes.sectorOverrides.size,
    },
    uncategorized: uncategorizedEntries,
    ambiguous: ambiguousEntries,
    instructions:
      'To resolve an entry: edit data/sectors/overrides.json with ' +
      '{"<padded>": "<sector_id>"} and rebuild. To resolve many at once, ' +
      "extend the relevant sector's mhlw_seed_codes in " +
      'data/sectors/sectors.ja-en.json.',
  };

  const queuePath = join(distRoot, 'data.review_queue.json');
  // Match Python: `json.dumps(payload, ensure_ascii=False, indent=2) + "\n"`
  await writeFile(
    queuePath,
    JSON.stringify(queuePayload, null, 2) + '\n',
    'utf-8',
  );

  return {
    files: [sectorsPath, queuePath],
    sectors: indexes.sectors.length,
    uncategorized: uncategorizedEntries.length,
    ambiguous: ambiguousEntries.length,
  };
}

/** Round to 2 decimal places, matching Python's `round(x, 2)`. */
function roundTo2(x: number): number {
  return pythonRound(x, 2);
}
