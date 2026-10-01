/**
 * test-consistency.ts — L3 projection sanity per docs/DATA_ARCHITECTURE.md §7.6.
 *
 * Validates the BUILT projections in public/ (post `npm run build:data`).
 * Source-data L1 + L2 validation is done inside build.ts.
 *
 * Usage:
 *   npm run test:consistency
 *   tsx src/data/test-consistency.ts
 *   tsx src/data/test-consistency.ts --dist-root path/to/dir
 *
 * Exit code: 0 = all checks pass, 1 = at least one error.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Report, relPath } from './consistency/shared.js';
import {
  checkPlannedFilesExist,
  checkNonEmptyJsonShape,
  checkPerOccupationDir,
  checkSearch,
  checkDetailFiles,
  checkLabels,
  checkCrossProjectionIdReferences,
} from './consistency/files.js';
import {
  checkTreemap,
  checkTop10,
  checkSectors,
  checkReviewQueue,
  checkTreemapV110,
} from './consistency/treemap.js';
import {
  checkScoreHistory,
  checkModelsDeep,
  checkModelsByModel,
} from './consistency/models.js';

const REPO = process.cwd();

function getDistRoot(): string {
  const argIdx = process.argv.indexOf('--dist-root');
  if (argIdx >= 0 && process.argv[argIdx + 1]) {
    return process.argv[argIdx + 1]!;
  }
  return join(REPO, 'public');
}

function reportAndExit(r: Report): never {
  for (const line of r.info) console.log(line);
  if (r.warnings.length > 0) {
    console.log('\nWARNINGS:');
    for (const w of r.warnings) console.log(`  [WARN] ${w}`);
  }
  if (r.errors.length > 0) {
    console.log('\nERRORS:');
    for (const e of r.errors) console.log(`  [FAIL] ${e}`);
    process.exit(1);
  }
  console.log('\n[OK] projections pass L3 consistency checks');
  process.exit(0);
}

async function main(): Promise<void> {
  const distRoot = getDistRoot();
  const r = new Report();

  if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
    r.fail(`dist root does not exist: ${distRoot}`);
    reportAndExit(r);
  }

  console.log(`Checking projections in ${relPath(distRoot)}\n`);

  await checkPlannedFilesExist(distRoot, r);
  const treemapRecords = await checkTreemap(distRoot, r);
  await checkTop10(distRoot, treemapRecords, r);

  // Source occupation count
  const occDir = join(REPO, 'data', 'occupations');
  const allOccIds = new Set<number>();
  if (existsSync(occDir)) {
    for (const f of readdirSync(occDir)) {
      if (!f.endsWith('.json')) continue;
      const id = Number.parseInt(f.replace(/\.json$/, ''), 10);
      if (Number.isFinite(id)) allOccIds.add(id);
    }
  }

  await checkSearch(distRoot, r, allOccIds.size);
  await checkDetailFiles(distRoot, r, allOccIds);
  await checkLabels(distRoot, r);
  await checkScoreHistory(distRoot, r, allOccIds);
  await checkModelsDeep(distRoot, r, allOccIds);
  await checkModelsByModel(distRoot, r, allOccIds);

  const sectorIds = await checkSectors(distRoot, r);
  await checkReviewQueue(distRoot, r);
  checkTreemapV110(treemapRecords, sectorIds, r);

  // Lightweight existence + shape checks for the projections that don't
  // have deep dedicated checks above. Catches "projection silently wrote
  // an empty / malformed file" regressions.
  await checkNonEmptyJsonShape(distRoot, 'data.holland.json', 'rows', r);
  await checkNonEmptyJsonShape(distRoot, 'data.profile5.json', 'profiles', r);
  await checkNonEmptyJsonShape(distRoot, 'data.worktypes.json', 'occupations', r);
  await checkNonEmptyJsonShape(distRoot, 'data.transfer_paths.json', 'paths', r);
  await checkPerOccupationDir(distRoot, 'data.skills', 30, r);
  // Step 12 removed: data.featured.json (dead projection),
  // data.tasks (556 dead files), data.score-history (old 552-file dir).

  // Cross-projection invariants — every id referenced by the search /
  // transfer_paths projections must point at an occupation that
  // actually has a detail file. Catches dangling references that would
  // produce 404 fetches at runtime.
  await checkCrossProjectionIdReferences(distRoot, r);

  reportAndExit(r);
}

main().catch((err) => {
  console.error('test-consistency crashed:', err);
  process.exit(1);
});
