// Tests for scripts/lib/walk-files.cjs. Uses a temp directory, never data/.
import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { runInNewContext } from 'node:vm';

const { walkFiles } = require('./walk-files.cjs') as {
  walkFiles: (
    dir: string,
    options: { ext: RegExp; skip?: Set<string>; skipHidden?: boolean },
  ) => string[];
};

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function makeTemp(): string {
  const root = mkdtempSync(join(tmpdir(), 'jobs-walk-files-'));
  fixtures.push(root);
  return root;
}

function rels(root: string, files: string[]): string[] {
  return files.map((file) => relative(root, file)).sort();
}

describe('walkFiles', () => {
  test('collects matching files depth-first and skips other extensions', () => {
    const root = makeTemp();
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'b.html'), '<p>b</p>');
    writeFileSync(join(root, 'c.astro'), '---\n---\n');
    writeFileSync(join(root, 'notes.txt'), 'no');
    writeFileSync(join(root, 'sub', 'a.html'), '<p>a</p>');
    writeFileSync(join(root, 'sub', 'a.txt'), 'no');

    const files = walkFiles(root, { ext: /\.(astro|html)$/ });
    assert.deepEqual(rels(root, files), ['b.html', 'c.astro', 'sub/a.html']);
  });

  test('skip and skipHidden ignore entries before stat', () => {
    const root = makeTemp();
    writeFileSync(join(root, 'keep.html'), '<p>keep</p>');
    mkdirSync(join(root, 'vendor'));
    symlinkSync(join(root, 'missing-vendor-target'), join(root, 'vendor', 'broken.html'));
    symlinkSync(join(root, 'missing-hidden-target'), join(root, '.broken.html'));
    mkdirSync(join(root, '.secret'));
    writeFileSync(join(root, '.secret', 'page.html'), '<p>hidden</p>');

    const files = walkFiles(root, {
      ext: /\.html$/,
      skip: new Set(['vendor']),
      skipHidden: true,
    });
    assert.deepEqual(rels(root, files), ['keep.html']);
  });

  test('fails with the path when the directory does not exist', () => {
    const root = makeTemp();
    const missing = join(root, 'does-not-exist');
    assert.throws(
      () => walkFiles(missing, { ext: /\.html$/ }),
      (err: Error) => {
        assert.match(err.message, /walk-files: cannot read directory/);
        assert.match(err.message, /does-not-exist/);
        assert.match(err.message, /ENOENT/);
        return true;
      },
    );
  });

  test('fails with the path when an entry cannot be stat', () => {
    const root = makeTemp();
    writeFileSync(join(root, 'ok.html'), '<p>ok</p>');
    symlinkSync(join(root, 'missing-target'), join(root, 'gone.html'));
    assert.throws(
      () => walkFiles(root, { ext: /\.html$/ }),
      (err: Error) => {
        assert.match(err.message, /walk-files: cannot stat/);
        assert.match(err.message, /gone\.html/);
        assert.match(err.message, /ENOENT/);
        return true;
      },
    );
  });

  test('fails when a directory cannot be read', () => {
    const root = makeTemp();
    const locked = join(root, 'locked');
    mkdirSync(locked);
    writeFileSync(join(locked, 'x.html'), '<p>x</p>');
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const isolatedModule = { exports: {} as { walkFiles: typeof walkFiles } };
    // Root can read chmod(000) directories. Inject a deterministic failure into
    // an isolated copy of the real module without changing the shared fs object.
    runInNewContext(fs.readFileSync(new URL('./walk-files.cjs', import.meta.url), 'utf8'), {
      module: isolatedModule,
      RegExp,
      require: (id: string) => id === 'node:fs' ? {
        ...fs,
        readdirSync: (dir: string) => {
          if (dir === locked) throw denied;
          return fs.readdirSync(dir);
        },
      } : require(id),
    });
    assert.throws(
      () => isolatedModule.exports.walkFiles(root, { ext: /\.html$/ }),
      (err: Error & { code?: string; cause?: unknown }) => {
        assert.match(err.message, /walk-files: cannot read directory/);
        assert.ok(err.message.includes(locked));
        assert.match(err.message, /EACCES/);
        assert.equal(err.code, 'EACCES');
        assert.equal(err.cause, denied);
        return true;
      },
    );
  });
});
