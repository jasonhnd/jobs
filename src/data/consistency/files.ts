/** L3 consistency checks for projection files, occupation details, and references. */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadJson, readJsonOrFail, relPath, type Report } from './shared.js';

export async function checkPlannedFilesExist(distRoot: string, r: Report): Promise<void> {
  // All 13 projection families produced by src/data/build.ts. A missing
  // file here means a projection silently failed to write, which the build
  // step itself does not currently detect.
  const requiredFiles = [
    'data.treemap.json',
    'data.top10.json',
    'data.treemap.meta.json',
    'data.search.json',
    'data.sectors.json',
    'data.review_queue.json',
    'data.profile5.json',
    'data.worktypes.json',
    'data.transfer_paths.json',
    'data.score_history.json',
    'data.models_deep.json',
    'data.models_by_model.json',
    'data.holland.json',
    'data.labels/ja.json',
    // Removed in Step 12: data.featured.json (dead projection).
  ];
  const requiredDirs = [
    'data.detail',         // 556 per-occupation files
    'data.skills',         // 39 per-skill files + index
    // Removed in Step 12: data.tasks (556 dead files) and
    // data.score-history (old 552-file directory).
  ];
  for (const f of requiredFiles) {
    const p = join(distRoot, f);
    if (!existsSync(p)) {
      r.fail(`missing required projection file: ${relPath(p)}`);
    }
  }
  for (const d of requiredDirs) {
    const p = join(distRoot, d);
    if (!existsSync(p)) {
      r.fail(`missing required projection directory: ${relPath(p)}`);
    } else {
      // Directory should be non-empty.
      try {
        const entries = readdirSync(p);
        if (entries.length === 0) {
          r.fail(`projection directory is empty: ${relPath(p)}`);
        }
      } catch (err) {
        r.fail(`cannot read projection directory ${relPath(p)}: ${(err as Error).message}`);
      }
    }
  }
}

export async function checkNonEmptyJsonShape(
  distRoot: string,
  filename: string,
  expectKey: string,
  r: Report,
): Promise<void> {
  // Lightweight sanity: file exists, parses as JSON, has the expected
  // top-level key. Catches regressions like "projection wrote {} or [] only".
  const p = join(distRoot, filename);
  if (!existsSync(p)) return;  // existence already reported above
  const result = await readJsonOrFail<unknown>(r, p, `${filename} invalid JSON`);
  if (!result.ok) return;
  let data: typeof result.data;
  data = result.data;
  if (!data || typeof data !== 'object') {
    r.fail(`${filename} top-level must be an object/array (got ${typeof data})`);
    return;
  }
  if (!(expectKey in (data as Record<string, unknown>))) {
    r.fail(`${filename} missing expected top-level key: ${expectKey}`);
  }
}

export async function checkPerOccupationDir(
  distRoot: string,
  dirname: string,
  expectMin: number,
  r: Report,
): Promise<void> {
  // Sample-validate one file from a per-occupation directory.
  const dir = join(distRoot, dirname);
  if (!existsSync(dir)) return;  // existence already reported above
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch (err) {
    r.fail(`cannot read ${dirname}: ${(err as Error).message}`);
    return;
  }
  if (entries.length < expectMin) {
    r.fail(`${dirname} has ${entries.length} files, expected ≥ ${expectMin}`);
  }
  if (entries.length === 0) return;
  // Parse the first file to ensure it's valid JSON.
  const sample = join(dir, entries[0]!);
  const result = await readJsonOrFail(r, sample, `${dirname}/${entries[0]} sample invalid JSON`);
  if (!result.ok) return;
  const parsed = result.data;
  if (!parsed || typeof parsed !== 'object') {
    r.fail(`${dirname}/${entries[0]} sample is not an object`);
  }
}

export async function checkSearch(distRoot: string, r: Report, expectedCount: number): Promise<void> {
  const f = join(distRoot, 'data.search.json');
  if (!existsSync(f)) return;
  const result = await readJsonOrFail<{ documents?: Array<Record<string, unknown>> }>(r, f, `data.search.json is invalid JSON`);
  if (!result.ok) return;
  let data: typeof result.data;
  data = result.data;
  const docs = data.documents ?? [];
  if (expectedCount > 0 && docs.length !== expectedCount) {
    r.fail(`search document_count (${docs.length}) != total source occupations (${expectedCount})`);
  }
  const seen = new Set<number>();
  for (const d of docs) {
    const rid = d.id as number;
    if (seen.has(rid)) r.fail(`duplicate id in search: ${rid}`);
    seen.add(rid);
    if (!d.title_ja) r.fail(`id=${rid} search missing title_ja`);
  }
}

export async function checkDetailFiles(
  distRoot: string,
  r: Report,
  expectedIds: Set<number>,
): Promise<void> {
  const d = join(distRoot, 'data.detail');
  if (!existsSync(d)) return;
  const files = readdirSync(d).filter((f) => f.endsWith('.json')).sort();
  if (files.length !== expectedIds.size) {
    r.fail(`detail file count (${files.length}) != total source occupations (${expectedIds.size})`);
  }

  const fileIds = new Set<number>();
  for (const fname of files) {
    const stem = fname.replace(/\.json$/, '');
    const stemId = Number.parseInt(stem, 10);
    if (!Number.isFinite(stemId)) {
      r.fail(`detail file with non-int name: ${fname}`);
      continue;
    }
    const result = await readJsonOrFail<{ id?: number; title?: { ja?: string } }>(
      r, join(d, fname), `detail/${fname} invalid JSON`,
    );
    if (!result.ok) continue;
    let data: typeof result.data;
    data = result.data;
    if (data.id !== stemId) {
      r.fail(`detail/${fname} inner id ${data.id} != filename stem ${stemId}`);
    }
    if (!data.title || !data.title.ja) {
      r.fail(`detail/${fname} missing title.ja`);
    }
    if (stem.length !== 4) {
      r.fail(`detail/${fname} filename must be 4-digit zero-padded`);
    }
    fileIds.add(stemId);
  }

  const missing: number[] = [];
  for (const id of expectedIds) if (!fileIds.has(id)) missing.push(id);
  const extra: number[] = [];
  for (const id of fileIds) if (!expectedIds.has(id)) extra.push(id);
  if (missing.length > 0) r.fail(`detail/ missing ids: ${missing.slice(0, 5).join(', ')}`);
  if (extra.length > 0) r.fail(`detail/ has unknown ids: ${extra.slice(0, 5).join(', ')}`);
}

export async function checkLabels(distRoot: string, r: Report): Promise<void> {
  for (const lang of ['ja', 'en']) {
    const f = join(distRoot, 'data.labels', `${lang}.json`);
    if (!existsSync(f)) continue;
    const result = await readJsonOrFail<Record<string, unknown>>(r, f, `data.labels/${lang}.json invalid JSON`);
    if (!result.ok) continue;
    let data: typeof result.data;
    data = result.data;
    if (data.lang !== lang) {
      r.fail(`data.labels/${lang}.json has wrong lang field: ${data.lang}`);
    }
    const dims = Object.keys(data).filter(
      (k) => !['schema_version', 'lang', 'generated_at'].includes(k),
    );
    if (dims.length !== 7) {
      r.warn(`data.labels/${lang}.json has ${dims.length} dimensions, expected 7`);
    }
  }
}

export async function checkCrossProjectionIdReferences(distRoot: string, r: Report): Promise<void> {
  // Build the canonical id set from data.detail/<padded>.json filenames.
  const detailDir = join(distRoot, 'data.detail');
  if (!existsSync(detailDir)) return;
  let knownIds: Set<number>;
  try {
    knownIds = new Set(
      readdirSync(detailDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => Number.parseInt(f.replace(/\.json$/, ''), 10))
        .filter(Number.isFinite),
    );
  } catch (err) {
    r.fail(`cannot enumerate data.detail/: ${(err as Error).message}`);
    return;
  }

  // search.json: every documents[].id must be in knownIds.
  const searchPath = join(distRoot, 'data.search.json');
  if (existsSync(searchPath)) {
    try {
      const search = (await loadJson(searchPath)) as { documents?: Array<{ id?: number }> };
      const docs = search.documents ?? [];
      const dangling: number[] = [];
      for (const d of docs) {
        if (typeof d.id === 'number' && !knownIds.has(d.id)) dangling.push(d.id);
      }
      if (dangling.length > 0) {
        r.fail(
          `data.search.json has ${dangling.length} ids with no matching data.detail/ file: ${dangling.slice(0, 5).join(', ')}${dangling.length > 5 ? '…' : ''}`,
        );
      }
    } catch (err) {
      r.fail(`data.search.json id-cross-check failed: ${(err as Error).message}`);
    }
  }

  // transfer_paths.json: every paths[*].candidates[*].id must be in knownIds.
  const tpPath = join(distRoot, 'data.transfer_paths.json');
  if (existsSync(tpPath)) {
    try {
      const tp = (await loadJson(tpPath)) as {
        paths?: Record<string, { candidates?: Array<{ id?: number }> }>;
      };
      const pathsObj = tp.paths ?? {};
      const dangling = new Set<number>();
      for (const entry of Object.values(pathsObj)) {
        for (const c of entry.candidates ?? []) {
          if (typeof c.id === 'number' && !knownIds.has(c.id)) dangling.add(c.id);
        }
      }
      if (dangling.size > 0) {
        const sample = Array.from(dangling).slice(0, 5).join(', ');
        r.fail(
          `data.transfer_paths.json references ${dangling.size} candidate ids with no matching data.detail/ file: ${sample}${dangling.size > 5 ? '…' : ''}`,
        );
      }
    } catch (err) {
      r.fail(`data.transfer_paths.json id-cross-check failed: ${(err as Error).message}`);
    }
  }

  // (featured.json cross-check removed in Step 12 — projection deleted.)
}
