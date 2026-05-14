/**
 * strict-load.ts — fail-fast filesystem + JSON loaders for build-time use.
 *
 * Replaces the "silent return [] on failure" pattern used by some legacy
 * loaders (sitemap, genre-hub, image-sitemap, sectors page). A read or parse
 * error in a release build should ABORT the build instead of producing
 * pages with empty content — silent degradation has historically masked
 * data-pipeline regressions until users noticed missing rankings or
 * sitemap entries.
 *
 * Escape hatch: setting ALLOW_PARTIAL_DATA=1 in the environment restores
 * the old "log + skip" semantics. Intended for ad-hoc local development
 * when working from a partial data tree (e.g. mid-ETL or after manually
 * deleting some detail files).
 *
 * Pure node:fs + Zod (already a dependency). Synchronous on purpose:
 * called from Astro frontmatter / getStaticPaths which run synchronously.
 */
import { readFileSync, readdirSync } from 'node:fs';
import type { z } from 'zod';

/**
 * True when the caller has opted into "log + skip" semantics.
 *
 * Default (unset / any value !== "1"): strict mode. Errors throw.
 * "1": permissive mode. Errors logged to stderr and the failing item is
 *      dropped. ONLY use for local development; CI / Vercel deploy must
 *      run in strict mode so silent data loss is caught before publish.
 */
export function allowPartialData(): boolean {
  return process.env.ALLOW_PARTIAL_DATA === '1';
}

/**
 * Read + JSON.parse + schema.parse a file path. Throws with a tagged
 * error message including the file path on any of:
 *   - file read failure (ENOENT, EACCES, …)
 *   - malformed JSON
 *   - schema mismatch (first 3 issues surfaced)
 *
 * The `tag` parameter shows up at the start of the error message so a
 * thrown error in a 800-page Astro build can be traced back to the right
 * loader without stack archaeology.
 */
export function strictReadJson<T>(
  filePath: string,
  schema: z.ZodSchema<T>,
  tag: string,
): T {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(
      `[${tag}] read failed: ${filePath}: ${(err as Error).message}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[${tag}] invalid JSON: ${filePath}: ${(err as Error).message}`,
    );
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`[${tag}] schema mismatch in ${filePath}: ${issues}`);
  }
  return parsed.data;
}

/**
 * Permissive variant — returns `null` on any failure, after logging to
 * stderr. Use behind `allowPartialData()` so prod builds default to
 * strict but local devs can opt in via ALLOW_PARTIAL_DATA=1.
 */
export function tryReadJson<T>(
  filePath: string,
  schema: z.ZodSchema<T>,
  tag: string,
): T | null {
  try {
    return strictReadJson(filePath, schema, tag);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error((err as Error).message);
    return null;
  }
}

/**
 * readdir + filter wrapper that throws (or returns `[]` under
 * ALLOW_PARTIAL_DATA) so the caller can fail-fast.
 *
 * Filter is applied BEFORE sort. Sort order is alphanumeric (matches
 * `Array.prototype.sort` default — fine for 0000.json…9999.json).
 */
export function strictReaddir(
  dirPath: string,
  filter: (name: string) => boolean,
  tag: string,
): string[] {
  try {
    return readdirSync(dirPath).filter(filter).sort();
  } catch (err) {
    if (allowPartialData()) {
      // eslint-disable-next-line no-console
      console.error(
        `[${tag}] readdir failed (ALLOW_PARTIAL_DATA=1, returning []): ${dirPath}: ${(err as Error).message}`,
      );
      return [];
    }
    throw new Error(
      `[${tag}] readdir failed: ${dirPath}: ${(err as Error).message}`,
    );
  }
}

/**
 * Iterate a directory of JSON files, parsing each with the given schema.
 * In strict mode any failure aborts. In permissive mode each failure
 * logs + skips the file. Order matches strictReaddir's alphanumeric sort.
 *
 * Returns: `{ items, skipped }`. `skipped` is always 0 in strict mode
 * (errors thrown instead), and >= 0 in permissive mode.
 */
export function strictLoadDir<T>(
  dirPath: string,
  filter: (name: string) => boolean,
  schema: z.ZodSchema<T>,
  tag: string,
): { items: T[]; skipped: number } {
  const files = strictReaddir(dirPath, filter, tag);
  const items: T[] = [];
  let skipped = 0;
  const permissive = allowPartialData();
  for (const f of files) {
    const filePath = `${dirPath}/${f}`;
    if (permissive) {
      const parsed = tryReadJson(filePath, schema, tag);
      if (parsed === null) {
        skipped += 1;
        continue;
      }
      items.push(parsed);
    } else {
      items.push(strictReadJson(filePath, schema, tag));
    }
  }
  return { items, skipped };
}
