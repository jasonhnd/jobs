import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { dataPath, loadJsonDir, loadJsonFile } from './loaders.js';

const schema = z.object({ value: z.number() });

async function withRoot(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'loaders-test-'));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

describe('JSON loaders', () => {
  test('distinguishes a missing directory from a non-directory path', async () => {
    await withRoot(async (root) => {
      assert.deepEqual(await loadJsonDir('missing', schema, root), {
        byKey: new Map(), errors: [], totalFiles: 0, dirMissing: true,
      });
      await writeFile(join(root, 'file'), 'content');
      const result = await loadJsonDir('file', schema, root);
      assert.equal(result.dirMissing, false);
      assert.equal(result.totalFiles, 0);
      assert.equal(result.byKey.size, 0);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0]!.file, join(root, 'file'));
      assert.match(result.errors[0]!.message, /^Cannot read directory:/);
    });
  });

  test('sorts valid files across concurrency slices and retains structured failures', async () => {
    await withRoot(async (root) => {
      const dir = join(root, 'records');
      await mkdir(dir);
      for (let i = 20; i >= 0; i--) {
        await writeFile(join(dir, `${String(i).padStart(2, '0')}.json`), JSON.stringify({ value: i }));
      }
      await writeFile(join(dir, '.hidden.json'), 'invalid');
      await writeFile(join(dir, 'ignored.txt'), 'invalid');
      await writeFile(join(dir, 'bad-json.json'), '{');
      await writeFile(join(dir, 'bad-schema.json'), '{"value":"wrong"}');
      await symlink(join(root, 'absent'), join(dir, 'broken.json'));
      const result = await loadJsonDir('records', schema, root);
      assert.equal(result.dirMissing, false);
      assert.equal(result.totalFiles, 24);
      assert.deepEqual([...result.byKey], Array.from({ length: 21 }, (_, i) => [String(i).padStart(2, '0'), { value: i }]));
      assert.deepEqual(result.errors.map((error) => error.file), ['bad-json.json', 'bad-schema.json', 'broken.json'].map((name) => join(dir, name)));
      assert.match(result.errors[0]!.message, /^Invalid JSON:/);
      assert.match(result.errors[1]!.message, /^Schema mismatch: value:/);
      assert.match(result.errors[2]!.message, /^Read failed:/);
    });
  });

  test('limits schema diagnostics to five issues, including nested paths', async () => {
    await withRoot(async (root) => {
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

  test('resolves fixed paths beneath the repository data root', () => {
    assert.equal(dataPath('sectors/example.json'), join(process.cwd(), 'data', 'sectors/example.json'));
  });
});
