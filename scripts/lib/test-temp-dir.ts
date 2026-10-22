import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = fileURLToPath(new URL('../../.cache/', import.meta.url));

/** Create an isolated fixture directory; the caller removes it during teardown. */
export function createTestTempDir(prefix: string): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  return mkdtempSync(join(CACHE_DIR, prefix));
}
