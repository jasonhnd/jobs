/**
 * Smart diff between TS-ETL output (`dist-ts/`) and Python-ETL output (`dist/`).
 *
 * Per docs/MIGRATION_PLAN.md §6.1:
 *   "diff dist/data.X.json dist-ts/data.X.json   ← 必须 0 差异
 *    (或仅排序、空白等已知差异)"
 *
 * Known accepted differences:
 *   - `generated_at`     — ISO timestamp varies by run wall-clock.
 *   - Floating-point representation: Python keeps `1.0`, JS may serialize as `1`.
 *     We normalize numbers via `JSON.parse(JSON.stringify(x))` round-trip so
 *     both sides drop trailing zeros consistently before comparison.
 *
 * Run:
 *   npx tsx src/data/diff-projections.ts <relative-file>
 *
 * Examples:
 *   npx tsx src/data/diff-projections.ts data.sectors.json
 *   npx tsx src/data/diff-projections.ts data.review_queue.json
 *
 * Exit code:
 *   0 — no semantic differences (or only known-accepted ones)
 *   1 — differences found
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { existsSync } from 'node:fs';

const REPO_ROOT = process.cwd();
const TS_DIST = join(REPO_ROOT, 'dist-ts');

// Resolve the Python ETL output dir, in order of freshness.
// `dist-py.next/` and `dist.next/` are atomic-stage dirs left over when
// a Python build couldn't swap (Dropbox lock etc.); they hold the freshest
// outputs. Fall back to `dist/` for normal cases.
const candidates = [
  join(REPO_ROOT, 'dist-py.next'),
  join(REPO_ROOT, 'dist.next'),
  join(REPO_ROOT, 'dist'),
];
const PY_DIST = candidates.find((p) => existsSync(p)) ?? candidates[candidates.length - 1]!;

const IGNORED_KEYS_AT_TOP_LEVEL = new Set(['generated_at']);

async function loadNormalized(path: string): Promise<unknown> {
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw);
  return stripIgnoredKeys(parsed);
}

function stripIgnoredKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripIgnoredKeys);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (IGNORED_KEYS_AT_TOP_LEVEL.has(k)) continue;
    out[k] = stripIgnoredKeys(v);
  }
  return out;
}

function deepEqual(a: unknown, b: unknown, path = '$'): string | null {
  if (Object.is(a, b)) return null;
  if (a === null || b === null) {
    return `${path}: ${stringify(a)} !== ${stringify(b)}`;
  }
  if (typeof a !== typeof b) {
    return `${path}: type mismatch (${typeof a} vs ${typeof b})`;
  }
  if (typeof a !== 'object') {
    return `${path}: ${stringify(a)} !== ${stringify(b)}`;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return `${path}: array vs object`;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return `${path}: array length ${a.length} vs ${b.length}`;
    }
    for (let i = 0; i < a.length; i += 1) {
      const r = deepEqual(a[i], b[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj).sort();
  const bKeys = Object.keys(bObj).sort();
  if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) {
    const onlyA = aKeys.filter((k) => !bKeys.includes(k));
    const onlyB = bKeys.filter((k) => !aKeys.includes(k));
    return `${path}: key sets differ (only-in-py: [${onlyA.join(',')}], only-in-ts: [${onlyB.join(',')}])`;
  }
  for (const k of aKeys) {
    const r = deepEqual(aObj[k], bObj[k], `${path}.${k}`);
    if (r) return r;
  }
  return null;
}

function stringify(v: unknown): string {
  const s = JSON.stringify(v);
  if (s === undefined) return String(v);
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: tsx src/data/diff-projections.ts <relative-file>');
    process.exit(2);
  }
  const rel = args[0]!;
  const pyPath = join(PY_DIST, rel);
  const tsPath = join(TS_DIST, rel);

  let pyData: unknown;
  let tsData: unknown;
  try {
    pyData = await loadNormalized(pyPath);
  } catch (err) {
    console.error(`Cannot read Python output: ${pyPath}: ${(err as Error).message}`);
    process.exit(2);
  }
  try {
    tsData = await loadNormalized(tsPath);
  } catch (err) {
    console.error(`Cannot read TS output: ${tsPath}: ${(err as Error).message}`);
    process.exit(2);
  }

  const diff = deepEqual(pyData, tsData);
  if (diff === null) {
    console.log(`✓ ${rel}: identical (ignoring generated_at)`);
    process.exit(0);
  } else {
    console.error(`✗ ${rel}: difference found`);
    console.error(`  ${diff}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('diff-projections crashed:', err);
  process.exit(2);
});
