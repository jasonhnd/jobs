import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  appendUntestedCoverage,
  isCoverageSourcePath,
  listCoverageSourceFiles,
  runAppendUntestedCoverage,
  untestedSourceFiles,
} from './append-untested-coverage.ts';

const F9_PATHS = [
  'src/data/build.ts',
  'src/data/import-ipd.ts',
  'src/data/test-consistency.ts',
  'src/data/projections/treemap.ts',
  'src/data/projections/transfer_paths.ts',
  'src/data/projections/search.ts',
  'src/data/projections/profile5.ts',
  'src/data/projections/skills.ts',
  'src/data/projections/holland.ts',
  'src/data/projections/labels.ts',
  'src/data/projections/haid-spec.ts',
  'middleware.ts',
  'api/og.tsx',
  'api/cron/measurement-sentinel.ts',
  'src/lib/canonical/doc.ts',
  'src/lib/canonical/static.ts',
  'src/lib/canonical/detail.ts',
  'src/lib/canonical/sector.ts',
  'src/lib/canonical/index.ts',
  'src/lib/og-renderers/map.ts',
  'src/lib/og-renderers/generic.ts',
  'src/views/interests.ts',
  'src/views/skills-hub.ts',
];

test('coverage source scan keeps F-9 files visible', () => {
  const files = new Set(listCoverageSourceFiles(process.cwd()));
  for (const relPath of F9_PATHS) {
    assert.equal(files.has(relPath), true, relPath);
  }
  assert.equal(files.has('scripts/append-untested-coverage.test.ts'), false);
  assert.equal(isCoverageSourcePath('src/pages/_home-css.ts'), true);
});

test('appends never-loaded files at 0% and leaves loaded records unchanged', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'coverage-untested-'));
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  writeFileSync(path.join(root, 'src', 'loaded.ts'), 'export const n = 1;\n');
  writeFileSync(path.join(root, 'src', 'loaded.test.ts'), 'test("x", () => {});\n');
  writeFileSync(path.join(root, 'src', 'blind.ts'), 'export const a = 1;\nexport const b = 2;\n');
  writeFileSync(path.join(root, 'middleware.ts'), 'export default function mw() {}\n');
  writeFileSync(path.join(root, 'scripts', 'gate.cjs'), 'module.exports = 1;\n');

  const lcov = [
    'TN:',
    'SF:src/loaded.ts',
    'DA:1,1',
    'LH:1',
    'LF:1',
    'end_of_record',
    '',
  ].join('\n');
  const missing = untestedSourceFiles(root, lcov);
  assert.deepEqual(
    missing.map((file) => file.path),
    ['middleware.ts', 'scripts/gate.cjs', 'src/blind.ts'],
  );
  assert.equal(missing.find((file) => file.path === 'src/blind.ts')?.lineCount, 2);

  const augmented = appendUntestedCoverage(lcov, missing);
  assert.match(augmented, /SF:src\/loaded\.ts\nDA:1,1\nLH:1\nLF:1/);
  assert.match(augmented, /SF:src\/blind\.ts\nDA:1,0\nDA:2,0\nLH:0\nLF:2/);
  assert.match(augmented, /SF:middleware\.ts\nDA:1,0\nLH:0\nLF:1/);
  assert.equal(augmented.includes('src/loaded.test.ts'), false);

  const lcovPath = path.join(root, 'lcov.info');
  writeFileSync(lcovPath, lcov);
  const summary = runAppendUntestedCoverage([lcovPath, '--root', root], root);
  assert.match(summary, /Bun lcov \(loaded files only\): 1 files, lines 1\/1 \(100\.0%\)/);
  assert.match(summary, /Augmented lcov \(never-loaded source at 0%\): 4 files, lines 1\/5 \(20\.0%\)/);
  assert.match(readFileSync(path.join(root, 'lcov.with-untested.info'), 'utf8'), /SF:scripts\/gate\.cjs/);
  assert.match(readFileSync(path.join(root, 'untested-files.txt'), 'utf8'), /src\/blind\.ts \(2 lines\)/);
});
