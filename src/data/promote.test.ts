// Fault injection for the transactional promote extracted from build.ts.
// Every fixture lives under os.tmpdir(). Nothing here writes into data/ or public/.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';

import { promoteStagedOutputs } from './promote.js';

function errno(message: string, code?: string): NodeJS.ErrnoException {
  const err = new Error(message) as NodeJS.ErrnoException;
  if (code !== undefined) err.code = code;
  return err;
}

function collectLogs() {
  const logs: unknown[][] = [];
  const warns: unknown[][] = [];
  const errors: unknown[][] = [];
  const text = (bucket: unknown[][]) => bucket.map((args) => args.map(String).join(' ')).join('\n');
  return {
    logs,
    warns,
    errors,
    log: (...args: unknown[]) => { logs.push(args); },
    warn: (...args: unknown[]) => { warns.push(args); },
    error: (...args: unknown[]) => { errors.push(args); },
    text,
  };
}

async function writeTree(root: string, files: Record<string, string>): Promise<void> {
  for (const [rel, contents] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, contents);
  }
}

async function fixture(trees: { out?: Record<string, string>; stage?: Record<string, string> }) {
  const root = await mkdtemp(join(tmpdir(), 'promote-'));
  const stageDir = join(root, 'stage');
  const outDir = join(root, 'out');
  const cacheDir = join(root, 'cache');
  await mkdir(stageDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  if (trees.out) await writeTree(outDir, trees.out);
  if (trees.stage) await writeTree(stageDir, trees.stage);
  return { root, stageDir, outDir, cacheDir };
}

async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(current: string, prefix: string): Promise<void> {
    let names: string[];
    try {
      names = await readdir(current);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    for (const name of names.sort()) {
      const full = join(current, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if ((await stat(full)).isDirectory()) await walk(full, rel);
      else out[rel] = await readFile(full, 'utf8');
    }
  }
  await walk(dir, '');
  return out;
}

function isStep2(stageDir: string, from: string, to: string): boolean {
  return from.startsWith(stageDir + sep) && !to.includes('.backup-');
}

describe('promoteStagedOutputs', () => {
  test('a mid-promote failure restores the previous output byte for byte', async () => {
    const dirs = await fixture({
      out: {
        'data.detail/nested.txt': 'OLD-NEST',
        'data.a.json': 'OLD-A',
        'data.b.json': 'OLD-B',
        'robots.txt': 'SEO-KEEP',
      },
      stage: {
        'data.detail/nested.txt': 'NEW-NEST',
        'data.a.json': 'NEW-A',
        'data.b.json': 'NEW-B',
        'data.new.json': 'NEW-ONLY',
      },
    });
    const before = await snapshot(dirs.outDir);
    const ops: string[] = [];
    const seen = collectLogs();
    const order = ['data.detail', 'data.a.json', 'data.b.json', 'data.new.json'];
    try {
      await assert.rejects(
        () => promoteStagedOutputs({
          ...dirs,
          sleep: async () => { throw new Error('ENOSPC must not be retried'); },
          log: seen.log,
          warn: seen.warn,
          error: seen.error,
          fs: {
            readdir: async (path) => (path === dirs.stageDir ? order : readdir(path)),
            rename: async (from, to) => {
              if (isStep2(dirs.stageDir, from, to)) {
                const name = basename(to);
                if (name === 'data.a.json') {
                  ops.push(`fail ${name}`);
                  throw errno('injected ENOSPC', 'ENOSPC');
                }
                ops.push(`promote ${name}`);
              }
              await rename(from, to);
            },
          },
        }),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.match(err.message, /injected ENOSPC/);
          return true;
        },
      );

      // data.detail was fully promoted (new bytes on disk) before the failure.
      assert.deepEqual(ops, ['promote data.detail', 'fail data.a.json']);
      assert.deepEqual(await snapshot(dirs.outDir), before);
      assert.equal((await snapshot(dirs.outDir))['data.detail/nested.txt'], 'OLD-NEST');
      assert.equal((await snapshot(dirs.outDir))['robots.txt'], 'SEO-KEEP');
      assert.equal(seen.text(seen.errors).includes('also failed'), false);
      assert.match(seen.text(seen.errors), /rolling back 4 entries/);
      const sentinel = JSON.parse(await readFile(join(dirs.cacheDir, 'build-manifest.partial.json'), 'utf8'));
      assert.equal(sentinel.status, 'in_progress');
      await access(dirs.stageDir);
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('rollback removes a new entry and skips a backup that was never created', async () => {
    const dirs = await fixture({
      out: { 'data.old.json': 'OLD', 'robots.txt': 'SEO' },
      stage: { 'data.new.json': 'NEW', 'data.fail.json': 'FAIL', 'data.old.json': 'NEW-OLD' },
    });
    const before = await snapshot(dirs.outDir);
    const order = ['data.new.json', 'data.fail.json', 'data.old.json'];
    try {
      await assert.rejects(
        () => promoteStagedOutputs({
          ...dirs,
          sleep: async () => { throw new Error('should not retry'); },
          ...silent(),
          fs: {
            readdir: async (path) => (path === dirs.stageDir ? order : readdir(path)),
            rename: async (from, to) => {
              if (isStep2(dirs.stageDir, from, to) && basename(to) === 'data.fail.json') {
                throw errno('injected ENOSPC', 'ENOSPC');
              }
              await rename(from, to);
            },
          },
        }),
        /injected ENOSPC/,
      );
      assert.deepEqual(await snapshot(dirs.outDir), before);
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('a failure while backing up the first entry leaves every previous file in place', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A', 'robots.txt': 'SEO' },
      stage: { 'data.a.json': 'NEW-A' },
    });
    const before = await snapshot(dirs.outDir);
    const seen = collectLogs();
    try {
      await assert.rejects(
        () => promoteStagedOutputs({
          ...dirs,
          sleep: async () => { throw new Error('should not retry'); },
          log: seen.log,
          warn: seen.warn,
          error: seen.error,
          fs: {
            rename: async (from, to) => {
              if (to.includes('.backup-')) throw errno('cannot backup', 'ENOSPC');
              await rename(from, to);
            },
          },
        }),
        /cannot backup/,
      );
      assert.deepEqual(await snapshot(dirs.outDir), before);
      assert.equal(seen.text(seen.errors).includes('also failed'), false);
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('a non-Error promote failure still restores the previous output', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A' },
      stage: { 'data.a.json': 'NEW-A' },
    });
    const before = await snapshot(dirs.outDir);
    const seen = collectLogs();
    try {
      await assert.rejects(
        () => promoteStagedOutputs({
          ...dirs,
          log: seen.log,
          warn: seen.warn,
          error: seen.error,
          fs: {
            rename: async (from, to) => {
              if (isStep2(dirs.stageDir, from, to)) throw 'disk-full-string';
              await rename(from, to);
            },
          },
        }),
        (err: unknown) => {
          assert.equal(err, 'disk-full-string');
          return true;
        },
      );
      assert.deepEqual(await snapshot(dirs.outDir), before);
      assert.match(seen.text(seen.errors), /disk-full-string/);
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('an error without a code is not retried', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A' },
      stage: { 'data.a.json': 'NEW-A' },
    });
    const before = await snapshot(dirs.outDir);
    let slept = 0;
    try {
      await assert.rejects(
        () => promoteStagedOutputs({
          ...dirs,
          sleep: async () => { slept += 1; },
          ...silent(),
          fs: {
            rename: async (from, to) => {
              if (isStep2(dirs.stageDir, from, to)) throw errno('no-code');
              await rename(from, to);
            },
          },
        }),
        /no-code/,
      );
      assert.equal(slept, 0);
      assert.deepEqual(await snapshot(dirs.outDir), before);
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('a failed rollback is logged and the original error is rethrown', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A', 'data.b.json': 'OLD-B' },
      stage: { 'data.a.json': 'NEW-A', 'data.b.json': 'NEW-B' },
    });
    const seen = collectLogs();
    const order = ['data.a.json', 'data.b.json'];
    try {
      await assert.rejects(
        () => promoteStagedOutputs({
          ...dirs,
          log: seen.log,
          warn: seen.warn,
          error: seen.error,
          fs: {
            readdir: async (path) => (path === dirs.stageDir ? order : readdir(path)),
            rename: async (from, to) => {
              if (from.includes('.backup-')) throw 'rollback-string';
              if (isStep2(dirs.stageDir, from, to) && basename(to) === 'data.b.json') {
                throw errno('injected ENOSPC', 'ENOSPC');
              }
              await rename(from, to);
            },
          },
        }),
        /injected ENOSPC/,
      );
      const logged = seen.text(seen.errors);
      assert.match(logged, /rollback of data\.a\.json also failed/);
      assert.match(logged, /rollback of data\.b\.json also failed/);
      assert.match(logged, /rollback-string/);
      const names = await readdir(dirs.outDir);
      assert.equal(names.includes('data.a.json'), false);
      assert.equal(names.some((name) => name.startsWith('data.a.json.backup-')), true);
      const backup = names.find((name) => name.startsWith('data.a.json.backup-'));
      assert.equal(await readFile(join(dirs.outDir, backup ?? ''), 'utf8'), 'OLD-A');
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('promotes entries, drops data orphans, and keeps non-data files', async () => {
    const dirs = await fixture({
      out: {
        'data.a.json': 'OLD-A',
        'data.detail/nested.txt': 'OLD-NEST',
        'data.stale.json': 'STALE',
        'data-legacy.json': 'LEGACY',
        'data.keep.backup-manual': 'MANUAL-BACKUP',
        'robots.txt': 'SEO',
        'llms.txt': 'LLMS',
        'og.png': 'PNG',
      },
      stage: {
        'data.a.json': 'NEW-A',
        'data.detail/nested.txt': 'NEW-NEST',
        'data.new.json': 'NEW-ONLY',
      },
    });
    try {
      await promoteStagedOutputs({ ...dirs, ...silent() });
      const after = await snapshot(dirs.outDir);
      assert.equal(after['data.a.json'], 'NEW-A');
      assert.equal(after['data.detail/nested.txt'], 'NEW-NEST');
      assert.equal(after['data.new.json'], 'NEW-ONLY');
      assert.equal(after['robots.txt'], 'SEO');
      assert.equal(after['llms.txt'], 'LLMS');
      assert.equal(after['og.png'], 'PNG');
      assert.equal(after['data.keep.backup-manual'], 'MANUAL-BACKUP');
      assert.equal('data.stale.json' in after, false);
      assert.equal('data-legacy.json' in after, false);
      assert.equal(Object.keys(after).some((name) => name.includes('.backup-') && name !== 'data.keep.backup-manual'), false);
      const manifest = JSON.parse(await readFile(join(dirs.cacheDir, 'build-manifest.json'), 'utf8'));
      assert.equal(manifest.status, 'ok');
      assert.deepEqual(manifest.promoted_entries, ['data.a.json', 'data.detail', 'data.new.json']);
      await assert.rejects(access(join(dirs.cacheDir, 'build-manifest.partial.json')));
      await assert.rejects(access(dirs.stageDir));
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('warns when a previous build left a partial sentinel', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD' },
      stage: { 'data.a.json': 'NEW' },
    });
    const seen = collectLogs();
    try {
      await writeFile(join(dirs.cacheDir, 'build-manifest.partial.json'), 'STALE-SENTINEL');
      await promoteStagedOutputs({ ...dirs, log: seen.log, warn: seen.warn, error: seen.error });
      assert.match(seen.text(seen.warns), /STALE-SENTINEL/);
      assert.match(seen.text(seen.warns), /partial-promote sentinel/);
      assert.equal((await snapshot(dirs.outDir))['data.a.json'], 'NEW');
      await assert.rejects(access(join(dirs.cacheDir, 'build-manifest.partial.json')));
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('warns on an unexpected sentinel read error and still promotes', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD' },
      stage: { 'data.a.json': 'NEW' },
    });
    const seen = collectLogs();
    try {
      await promoteStagedOutputs({
        ...dirs,
        log: seen.log,
        warn: seen.warn,
        error: seen.error,
        fs: {
          readFile: async (path, encoding) => {
            if (path.endsWith('build-manifest.partial.json')) throw errno('locked', 'EPERM');
            return readFile(path, encoding);
          },
        },
      });
      assert.match(seen.text(seen.warns), /partial-sentinel read unexpected error/);
      assert.equal((await snapshot(dirs.outDir))['data.a.json'], 'NEW');
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('an empty stage removes orphaned data entries and leaves other files', async () => {
    const dirs = await fixture({
      out: {
        'data.stale.json': 'STALE',
        'data-legacy.json': 'LEGACY',
        'robots.txt': 'SEO',
        'data.keep.backup-manual': 'MANUAL-BACKUP',
      },
    });
    const seen = collectLogs();
    try {
      await promoteStagedOutputs({ ...dirs, log: seen.log, warn: seen.warn, error: seen.error });
      const after = await snapshot(dirs.outDir);
      assert.equal(after['robots.txt'], 'SEO');
      assert.equal(after['data.keep.backup-manual'], 'MANUAL-BACKUP');
      assert.equal('data.stale.json' in after, false);
      assert.equal('data-legacy.json' in after, false);
      assert.match(seen.text(seen.logs), /removing 2 orphaned/);
      const manifest = JSON.parse(await readFile(join(dirs.cacheDir, 'build-manifest.json'), 'utf8'));
      assert.deepEqual(manifest.promoted_entries, []);
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('EXDEV falls back to copy and still publishes the new output', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A', 'data.detail/nested.txt': 'OLD-NEST', 'robots.txt': 'SEO', 'data.stale.json': 'STALE' },
      stage: { 'data.a.json': 'NEW-A', 'data.detail/nested.txt': 'NEW-NEST', 'data.new.json': 'NEW-ONLY' },
    });
    try {
      await promoteStagedOutputs({
        ...dirs,
        ...silent(),
        fs: {
          rename: async () => { throw errno('cross-device', 'EXDEV'); },
        },
      });
      const after = await snapshot(dirs.outDir);
      assert.equal(after['data.a.json'], 'NEW-A');
      assert.equal(after['data.detail/nested.txt'], 'NEW-NEST');
      assert.equal(after['data.new.json'], 'NEW-ONLY');
      assert.equal(after['robots.txt'], 'SEO');
      assert.equal('data.stale.json' in after, false);
      assert.equal(Object.keys(after).some((name) => name.includes('.backup-')), false);
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('retries EBUSY and then promotes', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A' },
      stage: { 'data.a.json': 'NEW-A' },
    });
    const delays: number[] = [];
    try {
      await promoteStagedOutputs({
        ...dirs,
        ...silent(),
        sleep: async (ms) => { delays.push(ms); },
        fs: {
          rename: async (from, to) => {
            if (isStep2(dirs.stageDir, from, to)) {
              const attempt = delays.length;
              if (attempt < 2) throw errno('busy', 'EBUSY');
            }
            await rename(from, to);
          },
        },
      });
      assert.deepEqual(delays, [100, 300]);
      assert.equal((await snapshot(dirs.outDir))['data.a.json'], 'NEW-A');
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('retries once through the default timer', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A' },
      stage: { 'data.a.json': 'NEW-A' },
    });
    let attempts = 0;
    try {
      await promoteStagedOutputs({
        ...dirs,
        ...silent(),
        fs: {
          rename: async (from, to) => {
            if (isStep2(dirs.stageDir, from, to)) {
              attempts += 1;
              if (attempts === 1) throw errno('busy', 'EACCES');
            }
            await rename(from, to);
          },
        },
      });
      assert.equal(attempts, 2);
      assert.equal((await snapshot(dirs.outDir))['data.a.json'], 'NEW-A');
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('exhausting EPERM retries rolls the previous output back', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A', 'robots.txt': 'SEO' },
      stage: { 'data.a.json': 'NEW-A' },
    });
    const before = await snapshot(dirs.outDir);
    const delays: number[] = [];
    try {
      await assert.rejects(
        () => promoteStagedOutputs({
          ...dirs,
          ...silent(),
          sleep: async (ms) => { delays.push(ms); },
          fs: {
            rename: async (from, to) => {
              if (isStep2(dirs.stageDir, from, to)) throw errno('still busy', 'EPERM');
              await rename(from, to);
            },
          },
        }),
        /still busy/,
      );
      assert.deepEqual(delays, [100, 300, 900]);
      assert.deepEqual(await snapshot(dirs.outDir), before);
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('a backup-cleanup failure is a warning and the new output stays', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A' },
      stage: { 'data.a.json': 'NEW-A' },
    });
    const seen = collectLogs();
    try {
      await promoteStagedOutputs({
        ...dirs,
        log: seen.log,
        warn: seen.warn,
        error: seen.error,
        fs: {
          rm: async (path, options) => {
            if (path.includes('.backup-')) throw new Error('cleanup boom');
            await rm(path, options);
          },
        },
      });
      assert.equal((await snapshot(dirs.outDir))['data.a.json'], 'NEW-A');
      assert.match(seen.text(seen.warns), /backup cleanup failed for data\.a\.json/);
      assert.match(seen.text(seen.warns), /cleanup boom/);
      const names = await readdir(dirs.outDir);
      assert.equal(names.some((name) => name.startsWith('data.a.json.backup-')), true);
      const manifest = JSON.parse(await readFile(join(dirs.cacheDir, 'build-manifest.json'), 'utf8'));
      assert.equal(manifest.status, 'ok');
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });

  test('sentinel and stage removal failures do not fail the promote', async () => {
    const dirs = await fixture({
      out: { 'data.a.json': 'OLD-A' },
      stage: { 'data.a.json': 'NEW-A' },
    });
    try {
      await promoteStagedOutputs({
        ...dirs,
        ...silent(),
        fs: {
          rm: async (path, options) => {
            if (path.endsWith('build-manifest.partial.json') || path === dirs.stageDir) {
              throw new Error('rm ignored');
            }
            await rm(path, options);
          },
        },
      });
      assert.equal((await snapshot(dirs.outDir))['data.a.json'], 'NEW-A');
      const sentinel = await readFile(join(dirs.cacheDir, 'build-manifest.partial.json'), 'utf8');
      assert.match(sentinel, /in_progress/);
      await access(dirs.stageDir);
      const manifest = JSON.parse(await readFile(join(dirs.cacheDir, 'build-manifest.json'), 'utf8'));
      assert.equal(manifest.status, 'ok');
    } finally {
      await rm(dirs.root, { recursive: true, force: true });
    }
  });
});

function silent() {
  const sink = () => {};
  return { log: sink, warn: sink, error: sink };
}
