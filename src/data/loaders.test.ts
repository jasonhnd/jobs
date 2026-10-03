// Error branches of src/data/loaders.ts. Fixtures live under os.tmpdir().
// The default-root case only reads a missing directory; it does not write into data/.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdir, mkdtemp, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

import { dataPath, loadJsonDir, loadJsonFile } from './loaders.js';

const rowSchema = z.object({ id: z.number() });
const wideSchema = z.object({
  a: z.string(),
  b: z.string(),
  c: z.string(),
  d: z.string(),
  e: z.string(),
  f: z.string(),
});

async function withTemp<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'loaders-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('loadJsonFile', () => {
  test('returns the parsed value when the file matches the schema', async () => {
    await withTemp(async (dir) => {
      const file = join(dir, 'ok.json');
      await writeFile(file, '{"id":7}');
      const result = await loadJsonFile(file, rowSchema);
      assert.equal(result.error, null);
      assert.deepEqual(result.data, { id: 7 });
    });
  });

  test('reports a missing file as a read failure', async () => {
    await withTemp(async (dir) => {
      const file = join(dir, 'missing.json');
      const result = await loadJsonFile(file, rowSchema);
      assert.equal(result.data, null);
      assert.equal(result.error?.file, file);
      assert.match(result.error?.message ?? '', /^Read failed:/);
    });
  });

  test('reports a directory path as a read failure', async () => {
    await withTemp(async (dir) => {
      const result = await loadJsonFile(dir, rowSchema);
      assert.equal(result.data, null);
      assert.match(result.error?.message ?? '', /^Read failed:/);
    });
  });

  test('reports invalid JSON without throwing', async () => {
    await withTemp(async (dir) => {
      const file = join(dir, 'bad.json');
      await writeFile(file, '{');
      const result = await loadJsonFile(file, rowSchema);
      assert.equal(result.data, null);
      assert.equal(result.error?.file, file);
      assert.match(result.error?.message ?? '', /^Invalid JSON:/);
    });
  });

  test('reports a schema mismatch and keeps only the first five issues', async () => {
    await withTemp(async (dir) => {
      const file = join(dir, 'wide.json');
      await writeFile(file, '{}');
      const result = await loadJsonFile(file, wideSchema);
      assert.equal(result.data, null);
      const message = result.error?.message ?? '';
      assert.match(message, /^Schema mismatch: /);
      const parts = message.slice('Schema mismatch: '.length).split('; ');
      assert.equal(parts.length, 5);
      assert.equal(parts.some((part) => part.startsWith('a:')), true);
      assert.equal(parts.some((part) => part.startsWith('f:')), false);
    });
  });
});

describe('loadJsonDir', () => {
  test('a missing directory is empty rather than an error', async () => {
    await withTemp(async (dir) => {
      const result = await loadJsonDir('no-such-subdir', rowSchema, dir);
      assert.equal(result.dirMissing, true);
      assert.equal(result.totalFiles, 0);
      assert.equal(result.errors.length, 0);
      assert.equal(result.byKey.size, 0);
    });
  });

  test('the default root still points at the repository data directory', async () => {
    const result = await loadJsonDir('__job0050_missing_subdir__', rowSchema);
    assert.equal(result.dirMissing, true);
    assert.equal(result.errors.length, 0);
    assert.equal(dataPath('sectors/sectors.ja-en.json'), join(process.cwd(), 'data', 'sectors/sectors.ja-en.json'));
  });

  test('a path that is not a directory is a directory-read error', async () => {
    await withTemp(async (dir) => {
      const blocker = join(dir, 'not-a-dir');
      await writeFile(blocker, 'x');
      const result = await loadJsonDir('not-a-dir', rowSchema, dir);
      assert.equal(result.dirMissing, false);
      assert.equal(result.totalFiles, 0);
      assert.equal(result.byKey.size, 0);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0]?.file, blocker);
      assert.match(result.errors[0]?.message ?? '', /^Cannot read directory:/);
    });
  });

  test('loads json files in sorted order and skips other names', async () => {
    await withTemp(async (dir) => {
      const sub = join(dir, 'batch');
      await mkdir(sub, { recursive: true });
      await writeFile(join(sub, 'b.json'), '{"id":2}');
      await writeFile(join(sub, 'a.json'), '{"id":1}');
      await writeFile(join(sub, '.hidden.json'), '{"id":9}');
      await writeFile(join(sub, 'notes.txt'), '{"id":8}');
      // Distinct from a.json: the default macOS volume is case-insensitive.
      await writeFile(join(sub, 'skip.JSON'), '{"id":7}');
      const result = await loadJsonDir('batch', rowSchema, dir);
      assert.equal(result.dirMissing, false);
      assert.equal(result.totalFiles, 2);
      assert.equal(result.errors.length, 0);
      assert.deepEqual([...result.byKey.keys()], ['a', 'b']);
      assert.equal(result.byKey.get('a')?.id, 1);
      assert.equal(result.byKey.get('b')?.id, 2);
    });
  });

  test('keeps valid files when a sibling is invalid JSON or the wrong shape', async () => {
    await withTemp(async (dir) => {
      const sub = join(dir, 'batch');
      await mkdir(sub, { recursive: true });
      await writeFile(join(sub, 'ok.json'), '{"id":1}');
      await writeFile(join(sub, 'bad.json'), '{');
      await writeFile(join(sub, 'shape.json'), '{"id":"nope"}');
      const result = await loadJsonDir('batch', rowSchema, dir);
      assert.equal(result.totalFiles, 3);
      assert.deepEqual([...result.byKey.keys()], ['ok']);
      assert.equal(result.errors.length, 2);
      const byFile = Object.fromEntries(result.errors.map((err) => [err.file, err.message]));
      assert.match(byFile[join(sub, 'bad.json')] ?? '', /^Invalid JSON:/);
      assert.match(byFile[join(sub, 'shape.json')] ?? '', /^Schema mismatch:/);
    });
  });

  test('a json-named directory is a per-file read failure', async () => {
    await withTemp(async (dir) => {
      const sub = join(dir, 'batch');
      await mkdir(join(sub, 'oops.json'), { recursive: true });
      await writeFile(join(sub, 'ok.json'), '{"id":1}');
      const result = await loadJsonDir('batch', rowSchema, dir);
      assert.deepEqual([...result.byKey.keys()], ['ok']);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0]?.file, join(sub, 'oops.json'));
      assert.match(result.errors[0]?.message ?? '', /^Read failed:/);
    });
  });

  test('reads past the concurrency window of 16 and stays sorted', async () => {
    await withTemp(async (dir) => {
      const sub = join(dir, 'batch');
      await mkdir(sub, { recursive: true });
      for (let i = 16; i >= 0; i -= 1) {
        const name = `file-${String(i).padStart(2, '0')}.json`;
        await writeFile(join(sub, name), JSON.stringify({ id: i }));
      }
      const result = await loadJsonDir('batch', rowSchema, dir);
      assert.equal(result.errors.length, 0);
      assert.equal(result.totalFiles, 17);
      const keys = [...result.byKey.keys()];
      assert.equal(keys.length, 17);
      assert.deepEqual(keys, [...keys].sort());
      assert.equal(result.byKey.get('file-00')?.id, 0);
      assert.equal(result.byKey.get('file-16')?.id, 16);
    });
  });
});

 describe('additional loader edge cases', () => {
  test('sorts valid files across concurrency slices and retains structured failures', async () => {
    await withTemp(async (root) => {
      const dir = join(root, 'records');
      await mkdir(dir);
      for (let i = 20; i >= 0; i--) {
        await writeFile(join(dir, `${String(i).padStart(2, '0')}.json`), JSON.stringify({ id: i }));
      }
      await writeFile(join(dir, '.hidden.json'), 'invalid');
      await writeFile(join(dir, 'ignored.txt'), 'invalid');
      await writeFile(join(dir, 'bad-json.json'), '{');
      await writeFile(join(dir, 'bad-schema.json'), '{"id":"wrong"}');
      await symlink(join(root, 'absent'), join(dir, 'broken.json'));
      const result = await loadJsonDir('records', rowSchema, root);
      assert.equal(result.dirMissing, false);
      assert.equal(result.totalFiles, 24);
      assert.deepEqual([...result.byKey], Array.from({ length: 21 }, (_, i) => [String(i).padStart(2, '0'), { id: i }]));
      assert.deepEqual(result.errors.map((error) => error.file), ['bad-json.json', 'bad-schema.json', 'broken.json'].map((name) => join(dir, name)));
      assert.match(result.errors[0]!.message, /^Invalid JSON:/);
      assert.match(result.errors[1]!.message, /^Schema mismatch: id:/);
      assert.match(result.errors[2]!.message, /^Read failed:/);
    });
  });

  test('limits schema diagnostics to five issues, including nested paths', async () => {
    await withTemp(async (root) => {
      const path = join(root, 'invalid.json');
      await writeFile(path, '{"nested":{}}');
      const nested = z.object({ nested: z.object(Object.fromEntries(
        ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => [key, z.number()]),
      )) });
      const result = await loadJsonFile(path, nested);
      assert.equal(result.data, null);
      assert.equal(result.error!.file, path);
      assert.match(result.error!.message, /^Schema mismatch: nested.a:/);
      assert.equal(result.error!.message.split('; ').length, 5);
      assert.equal(result.error!.message.includes('nested.f:'), false);
    });
  });

});
