/**
 * Source file loaders for the TS ETL pipeline.
 *
 * Each loader reads from `data/` (the repo root data dir, sibling to `src/`),
 * validates against the corresponding Zod schema, and returns either the
 * parsed value or a structured error.
 *
 * Track B-1, MIGRATION_PLAN.md PR 3.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ZodTypeAny, infer as ZInfer } from 'zod';

const REPO_ROOT = process.cwd();
const DATA_ROOT = join(REPO_ROOT, 'data');

export interface LoadError {
  file: string;
  message: string;
}

export interface DirLoadResult<T> {
  /** Map keyed by the JSON file's basename without extension (e.g. "0428"). */
  byKey: Map<string, T>;
  errors: LoadError[];
  totalFiles: number;
  /** True when the directory itself was missing (treated as 0 files, not an error). */
  dirMissing: boolean;
}

export interface FileLoadResult<T> {
  data: T | null;
  error: LoadError | null;
}

/**
 * Read every `*.json` file in `data/<subdir>/` and validate each with `schema`.
 * Filenames starting with `.` are skipped.
 */
export async function loadJsonDir<S extends ZodTypeAny>(
  subdir: string,
  schema: S,
): Promise<DirLoadResult<ZInfer<S>>> {
  const dirPath = join(DATA_ROOT, subdir);
  const byKey = new Map<string, ZInfer<S>>();
  const errors: LoadError[] = [];

  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { byKey, errors: [], totalFiles: 0, dirMissing: true };
    }
    return {
      byKey,
      errors: [
        {
          file: dirPath,
          message: `Cannot read directory: ${(err as Error).message}`,
        },
      ],
      totalFiles: 0,
      dirMissing: false,
    };
  }

  const jsonFiles = entries.filter(
    (name) => name.endsWith('.json') && !name.startsWith('.'),
  );

  for (const filename of jsonFiles) {
    const filePath = join(dirPath, filename);
    const key = filename.replace(/\.json$/, '');
    const result = await loadJsonFile(filePath, schema);
    if (result.error) {
      errors.push(result.error);
    } else if (result.data !== null) {
      byKey.set(key, result.data);
    }
  }

  return { byKey, errors, totalFiles: jsonFiles.length, dirMissing: false };
}

/**
 * Read a single JSON file and validate against `schema`. Returns null with
 * an error entry on parse/validation failure (does NOT throw).
 */
export async function loadJsonFile<S extends ZodTypeAny>(
  filePath: string,
  schema: S,
): Promise<FileLoadResult<ZInfer<S>>> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    return {
      data: null,
      error: { file: filePath, message: `Read failed: ${(err as Error).message}` },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      data: null,
      error: { file: filePath, message: `Invalid JSON: ${(err as Error).message}` },
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return {
      data: null,
      error: { file: filePath, message: `Schema mismatch: ${issues}` },
    };
  }

  return { data: result.data as ZInfer<S>, error: null };
}

/**
 * Resolve a path relative to the data root.
 * Useful for files at known fixed paths (e.g. `sectors/sectors.ja-en.json`).
 */
export function dataPath(relative: string): string {
  return join(DATA_ROOT, relative);
}
