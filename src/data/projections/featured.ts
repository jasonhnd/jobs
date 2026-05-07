/**
 * data.featured.json projection — per docs/DATA_ARCHITECTURE.md §6.8.
 *
 * Status: Future (skipped by default — `--enable-future` in Python)
 * Consumer: mobile homepage hero ("today's pick" / "high AI risk occupations")
 *
 * Strategy: 'top_ai_risk_with_workforce' picks 12 records:
 *   - ai_risk >= 7 AND workers >= 50_000
 *   - sorted by ai_risk desc, then workers desc
 *
 * Migrated from scripts/projections/featured.py.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Indexes } from '../lib/indexes.js';

const STRATEGY = 'top_ai_risk_with_workforce';
const PICK_COUNT = 12;

export interface FeaturedBuildResult {
  files: string[];
  picked: number;
  candidatePool: number;
}

interface CandidateEntry {
  id: number;
  title_ja: string;
  ai_risk: number;
  workers: number;
  salary_man_yen: number | null;
  rationale_ja: string;
  summary_ja: string | null;
  url: string;
}

function nowIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
  );
}

export async function buildFeatured(
  indexes: Indexes,
  distRoot: string,
): Promise<FeaturedBuildResult> {
  const candidates: CandidateEntry[] = [];
  // Iterate in occById insertion order; matches Python `for oid in indexes.occ_by_id`.
  for (const [occId, occ] of indexes.occById) {
    const score = indexes.latestScoreByOcc.get(occId);
    const stats = indexes.statsById.get(occId);
    if (!score || !stats || stats.workers == null) continue;
    if (score.ai_risk < 7 || stats.workers < 50_000) continue;
    candidates.push({
      id: occId,
      title_ja: occ.title_ja,
      ai_risk: score.ai_risk,
      workers: stats.workers,
      salary_man_yen: stats.salary_man_yen ?? null,
      rationale_ja: score.rationale_ja,
      summary_ja: occ.description.summary_ja ?? null,
      url: occ.url,
    });
  }

  // Sort: ai_risk desc, then workers desc. Stable sort.
  candidates.sort((a, b) => {
    if (b.ai_risk !== a.ai_risk) return b.ai_risk - a.ai_risk;
    return (b.workers ?? 0) - (a.workers ?? 0);
  });
  const picks = candidates.slice(0, PICK_COUNT);

  const payload = {
    schema_version: '1.0',
    generated_at: nowIso(),
    strategy: STRATEGY,
    occupations: picks,
  };

  const outPath = join(distRoot, 'data.featured.json');
  await writeFile(
    outPath,
    JSON.stringify(payload) + '\n',
    'utf-8',
  );

  return {
    files: [outPath],
    picked: picks.length,
    candidatePool: candidates.length,
  };
}
