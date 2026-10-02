/**
 * Append never-loaded source files to a Bun lcov report.
 *
 * `bun test --coverage` omits files that no test imported. This script does
 * not execute those files. It records each missing source file at 0% so the
 * report shows the blind spot instead of dropping it.
 *
 * Usage:
 *   bun scripts/append-untested-coverage.ts <lcov.info> [--root <dir>]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE_DIRS = ['src', 'scripts', 'api'] as const;
const SOURCE_FILES = ['middleware.ts'] as const;
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export function isCoverageTestFile(relPath: string): boolean {
  return /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(relPath);
}

export function isCoverageSourcePath(relPath: string): boolean {
  const normalized = relPath.split(path.sep).join('/');
  if (isCoverageTestFile(normalized)) return false;
  if (!SOURCE_EXTS.has(path.posix.extname(normalized))) return false;
  if ((SOURCE_FILES as readonly string[]).includes(normalized)) return true;
  return SOURCE_DIRS.some((dir) => normalized === dir || normalized.startsWith(`${dir}/`));
}

export function countFileLines(text: string): number {
  if (text.length === 0) return 0;
  const parts = text.split('\n');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts.length;
}

export function listCoverageSourceFiles(root: string): string[] {
  const found: string[] = [];

  function walk(absDir: string): void {
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (isCoverageSourcePath(rel)) found.push(rel);
    }
  }

  for (const dir of SOURCE_DIRS) {
    const abs = path.join(root, dir);
    try {
      if (statSync(abs).isDirectory()) walk(abs);
    } catch {
      // optional tree
    }
  }
  for (const file of SOURCE_FILES) {
    const abs = path.join(root, file);
    try {
      if (statSync(abs).isFile() && isCoverageSourcePath(file)) found.push(file);
    } catch {
      // optional file
    }
  }
  found.sort();
  return found;
}

export function normalizeCoveragePath(sfPath: string, root: string): string {
  const trimmed = sfPath.trim();
  const asPosix = trimmed.split(path.sep).join('/');
  if (path.posix.isAbsolute(asPosix) || path.win32.isAbsolute(trimmed)) {
    const rel = path.relative(root, trimmed).split(path.sep).join('/');
    if (!rel.startsWith('..')) return rel;
  }
  return asPosix.replace(/^\.\//, '');
}

export function coveredPathsFromLcov(lcov: string, root: string): Set<string> {
  const covered = new Set<string>();
  for (const line of lcov.split('\n')) {
    if (line.startsWith('SF:')) covered.add(normalizeCoveragePath(line.slice(3), root));
  }
  return covered;
}

export function lcovLineTotals(lcov: string): { files: number; hit: number; found: number } {
  let files = 0;
  let hit = 0;
  let found = 0;
  for (const line of lcov.split('\n')) {
    if (line.startsWith('SF:')) files += 1;
    else if (line.startsWith('LH:')) hit += Number(line.slice(3)) || 0;
    else if (line.startsWith('LF:')) found += Number(line.slice(3)) || 0;
  }
  return { files, hit, found };
}

export function zeroCoverageRecord(relPath: string, lineCount: number): string {
  const lines = [`TN:`, `SF:${relPath}`];
  for (let line = 1; line <= lineCount; line += 1) lines.push(`DA:${line},0`);
  lines.push('LH:0', `LF:${lineCount}`, 'end_of_record', '');
  return lines.join('\n');
}

export function appendUntestedCoverage(
  lcov: string,
  missing: readonly { path: string; lineCount: number }[],
): string {
  const base = lcov.length === 0 || lcov.endsWith('\n') ? lcov : `${lcov}\n`;
  return base + missing.map((file) => zeroCoverageRecord(file.path, file.lineCount)).join('');
}

export function untestedSourceFiles(
  root: string,
  lcov: string,
): { path: string; lineCount: number }[] {
  const covered = coveredPathsFromLcov(lcov, root);
  return listCoverageSourceFiles(root)
    .filter((relPath) => !covered.has(relPath))
    .map((relPath) => ({
      path: relPath,
      lineCount: countFileLines(readFileSync(path.join(root, relPath), 'utf8')),
    }));
}

function percent(hit: number, found: number): string {
  if (found === 0) return 'n/a';
  return `${((hit / found) * 100).toFixed(1)}%`;
}

export function formatCoverageSummary(
  before: { files: number; hit: number; found: number },
  missing: readonly { path: string; lineCount: number }[],
): string {
  const addedLines = missing.reduce((sum, file) => sum + file.lineCount, 0);
  const afterFound = before.found + addedLines;
  const rows = [
    `Bun lcov (loaded files only): ${before.files} files, lines ${before.hit}/${before.found} (${percent(before.hit, before.found)})`,
    `Augmented lcov (never-loaded source at 0%): ${before.files + missing.length} files, lines ${before.hit}/${afterFound} (${percent(before.hit, afterFound)})`,
    `Never-loaded source files: ${missing.length}`,
    ...missing.map((file) => `${file.path} (${file.lineCount} lines)`),
  ];
  return `${rows.join('\n')}\n`;
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  return argv[index + 1];
}

export function runAppendUntestedCoverage(argv: readonly string[], cwd = process.cwd()): string {
  const lcovArg = argv.find((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--root');
  if (!lcovArg) {
    throw new Error('usage: bun scripts/append-untested-coverage.ts <lcov.info> [--root <dir>]');
  }
  const root = path.resolve(cwd, argValue(argv, '--root') ?? '.');
  const lcovPath = path.resolve(cwd, lcovArg);
  const lcov = readFileSync(lcovPath, 'utf8');
  const missing = untestedSourceFiles(root, lcov);
  const augmented = appendUntestedCoverage(lcov, missing);
  const outDir = path.dirname(lcovPath);
  writeFileSync(path.join(outDir, 'lcov.with-untested.info'), augmented);
  const summary = formatCoverageSummary(lcovLineTotals(lcov), missing);
  writeFileSync(path.join(outDir, 'untested-files.txt'), summary);
  return summary;
}

if (import.meta.main) {
  process.stdout.write(runAppendUntestedCoverage(process.argv.slice(2)));
}
