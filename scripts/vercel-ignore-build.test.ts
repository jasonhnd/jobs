import { test, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const SCRIPT = resolve('scripts/vercel-ignore-build.sh');
const SKIP = 0;
const BUILD = 1;

let root = '';
let docsRepo = '';
let codeRepo = '';
let singleCommitRepo = '';

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
}

function makeRepo(name: string, files: string[], singleCommit = false): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, 'seed.txt'), 'seed\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'seed');
  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), 'change\n');
  }
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'change');
  if (singleCommit) {
    // A root commit has no HEAD^, which is the shallow-clone case.
    git(dir, 'checkout', '-q', '--orphan', 'only');
    git(dir, 'commit', '-q', '-m', 'root');
  }
  return dir;
}

function run(cwd: string, ref: string | undefined, message: string | undefined): number | null {
  const env: Record<string, string> = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };
  if (ref !== undefined) env.VERCEL_GIT_COMMIT_REF = ref;
  if (message !== undefined) env.VERCEL_GIT_COMMIT_MESSAGE = message;
  return spawnSync('bash', [SCRIPT], { cwd, env, encoding: 'utf8' }).status;
}

before(() => {
  root = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'vercel-ignore-'));
  docsRepo = makeRepo('docs', ['docs/NOTES.md']);
  codeRepo = makeRepo('code', ['src/page.ts']);
  singleCommitRepo = makeRepo('single', ['src/page.ts'], true);
});

after(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

test('topic branch is skipped even when code changed', () => {
  assert.equal(run(codeRepo, 'feature/x', 'feat: x'), SKIP);
});

test('topic branch with [vercel-build] in the commit message builds', () => {
  assert.equal(run(codeRepo, 'feature/x', 'ci: preview [vercel-build]'), BUILD);
});

test('[vercel-build] has no effect on preview and main (normal rules apply)', () => {
  assert.equal(run(docsRepo, 'preview', 'docs: x [vercel-build]'), SKIP);
  assert.equal(run(docsRepo, 'main', 'docs: x [vercel-build]'), SKIP);
});

test('preview and main skip documentation-only changes', () => {
  assert.equal(run(docsRepo, 'preview', 'docs: x'), SKIP);
  assert.equal(run(docsRepo, 'main', 'docs: x'), SKIP);
});

test('preview and main build when code changed', () => {
  assert.equal(run(codeRepo, 'preview', 'feat: x'), BUILD);
  assert.equal(run(codeRepo, 'main', 'feat: x'), BUILD);
});

test('empty or missing ref is not treated as a topic branch (fail-safe build)', () => {
  assert.equal(run(codeRepo, '', 'feat: x'), BUILD);
  assert.equal(run(codeRepo, undefined, undefined), BUILD);
});

test('preview with no usable diff base builds (fail-safe)', () => {
  assert.equal(run(singleCommitRepo, 'preview', 'feat: x'), BUILD);
});

test('vercel.json buildCommand only runs the build', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as { buildCommand: string };
  assert.equal(cfg.buildCommand, 'rm -rf dist-astro node_modules/.astro && bun run build');
});
