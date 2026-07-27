/**
 * rewrite-generated-module.ts — in-place rewrite of a COMMITTED generated
 * module, with the failure modes made loud.
 *
 * `src/lib/_content-date.ts` and `src/site/_score-attribution.ts` are checked
 * in (so `bun run typecheck` resolves on a fresh clone) and overwritten by
 * `src/data/build.ts` on every run. The original inline implementation was:
 *
 *     const existing = await readFile(path, 'utf-8').catch(() => '');
 *     const updated = existing.replace(pattern, replacement);
 *     if (updated && updated !== existing) { write } else { log '(unchanged)' }
 *
 * which had two ways to leave the file stale while logging the NEWLY COMPUTED
 * value as "(unchanged)":
 *
 *   1. A read failure made `existing` empty, so `''.replace(...)` was `''` —
 *      falsy, so no write.
 *   2. Any reformatting of the target (quote style, spacing) made the regex a
 *      no-op, so `updated === existing` — no write.
 *
 * `CONTENT_DATE` is the `dateModified` for every JSON-LD payload across ~800
 * pages and, unlike `SCORE_ATTRIBUTION`, has no downstream cross-check. CI's
 * `git diff --exit-code` cannot catch it either: a write that never happened
 * leaves a clean tree. Issue #219.
 */
import { readFile, writeFile } from 'node:fs/promises';

export interface GeneratedModuleEdit {
  readonly pattern: RegExp;
  readonly replacement: string;
  /** Exact text the file must contain afterwards. Catches a no-op replace. */
  readonly expect: string;
}

export interface RewriteResult {
  /** False when the file already held the desired content. */
  readonly changed: boolean;
  /** Content confirmed to be on disk after the call. */
  readonly content: string;
}

/**
 * Apply `edits` to the file at `path`, or throw. Never reports success for a
 * file it did not actually bring up to date.
 */
export async function rewriteGeneratedModule(
  path: string,
  edits: readonly GeneratedModuleEdit[],
): Promise<RewriteResult> {
  const existing = await readFile(path, 'utf-8').catch(() => null);
  if (existing === null) {
    throw new Error(
      `[rewrite-generated-module] cannot read ${path}; it is committed and must exist. ` +
      'Refusing to continue with a stale generated value.',
    );
  }

  let updated = existing;
  for (const edit of edits) {
    updated = updated.replace(edit.pattern, edit.replacement);
  }
  for (const edit of edits) {
    if (!updated.includes(edit.expect)) {
      throw new Error(
        `[rewrite-generated-module] ${path} still does not contain ${JSON.stringify(edit.expect)} ` +
        `after rewriting. Pattern ${edit.pattern} matched nothing — the file was probably ` +
        'reformatted. Refusing to report success while the generated value is stale.',
      );
    }
  }

  const changed = updated !== existing;
  if (changed) {
    await writeFile(path, updated, 'utf-8');
  }

  // Confirm against the filesystem rather than trusting the in-memory string,
  // so callers log what a reader of the file would actually see.
  const onDisk = await readFile(path, 'utf-8').catch(() => null);
  if (onDisk !== updated) {
    throw new Error(`[rewrite-generated-module] wrote ${path} but re-reading returned different content`);
  }
  return { changed, content: updated };
}
