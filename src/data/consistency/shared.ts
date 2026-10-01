/** Shared reporting and JSON I/O for the L3 consistency checks. */
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';

const REPO = process.cwd();

export class Report {
  errors: string[] = [];
  warnings: string[] = [];
  info: string[] = [];
  fail(msg: string): void { this.errors.push(msg); }
  warn(msg: string): void { this.warnings.push(msg); }
  note(msg: string): void { this.info.push(msg); }
}

export async function loadJson(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw);
}

export function relPath(p: string): string {
  try {
    return relative(REPO, p) || p;
  } catch {
    return p;
  }
}

/**
 * Preserve the caller's diagnostic prefix. The tagged result distinguishes a
 * read/parse failure from valid JSON values such as null, false, or zero.
 * Type parameters retain the existing shape assertions; this does not validate
 * or change the accepted projection schemas. Callers keep separate data
 * declarations and assignments to retain Bun's existing property-error text.
 */
export async function readJsonOrFail<T = unknown>(
  r: Report,
  path: string,
  errorPrefix: string,
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await loadJson(path) as T };
  } catch (err) {
    r.fail(`${errorPrefix}: ${(err as Error).message}`);
    return { ok: false };
  }
}
