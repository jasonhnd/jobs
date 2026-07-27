// Tests for src/data/lib/rewrite-generated-module.ts — runs under `bun test`.
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rewriteGeneratedModule } from './rewrite-generated-module.js';

const CONTENT_DATE_EDIT = (date: string) => [{
  pattern: /CONTENT_DATE = '[^']*'/,
  replacement: `CONTENT_DATE = '${date}'`,
  expect: `CONTENT_DATE = '${date}'`,
}];

async function withTempFile<T>(
  contents: string | null,
  run: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'rewrite-generated-'));
  const path = join(dir, '_content-date.ts');
  try {
    if (contents !== null) await writeFile(path, contents, 'utf-8');
    return await run(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('rewriteGeneratedModule', () => {
  test('rewrites a stale value and confirms it landed on disk', async () => {
    await withTempFile("export const CONTENT_DATE = '2026-07-12';\n", async (path) => {
      const result = await rewriteGeneratedModule(path, CONTENT_DATE_EDIT('2026-07-26'));

      assert.equal(result.changed, true);
      assert.equal(await readFile(path, 'utf-8'), "export const CONTENT_DATE = '2026-07-26';\n");
      assert.equal(result.content, await readFile(path, 'utf-8'));
    });
  });

  test('reports unchanged only when the file already holds the value', async () => {
    await withTempFile("export const CONTENT_DATE = '2026-07-26';\n", async (path) => {
      const result = await rewriteGeneratedModule(path, CONTENT_DATE_EDIT('2026-07-26'));

      assert.equal(result.changed, false);
      assert.ok(result.content.includes("'2026-07-26'"));
    });
  });

  // Issue #219, failure mode 1: `.catch(() => '')` turned a read failure into
  // an empty string, so `''.replace(...)` was falsy and nothing was written —
  // while the log printed the newly computed date as "(unchanged)".
  test('a missing file throws instead of silently skipping the write', async () => {
    await withTempFile(null, async (path) => {
      await assert.rejects(
        () => rewriteGeneratedModule(path, CONTENT_DATE_EDIT('2026-07-26')),
        /cannot read .*committed and must exist/,
      );
    });
  });

  // Issue #219, failure mode 2: any reformatting made the regex a no-op, so
  // `updated === existing` and the stale value stayed while the log claimed
  // the new one. This is the mode CI cannot catch — no write, clean tree.
  test('a reformatted target throws instead of leaving the value stale', async () => {
    // Same constant, double quotes — the single-quote pattern matches nothing.
    const reformatted = 'export const CONTENT_DATE = "2026-07-12";\n';
    await withTempFile(reformatted, async (path) => {
      await assert.rejects(
        () => rewriteGeneratedModule(path, CONTENT_DATE_EDIT('2026-07-26')),
        /still does not contain .*matched nothing/s,
      );
      // And crucially: the stale value is still there, not half-written.
      assert.equal(await readFile(path, 'utf-8'), reformatted);
    });
  });

  test('applies every edit and validates each one', async () => {
    const source = "modelId: 'a';\nmodelDisplay: 'A';\nrunDate: '2026-01-01';\n";
    await withTempFile(source, async (path) => {
      const result = await rewriteGeneratedModule(path, [
        { pattern: /modelId: '[^']*'/, replacement: "modelId: 'claude-opus-5'", expect: "modelId: 'claude-opus-5'" },
        { pattern: /modelDisplay: '[^']*'/, replacement: "modelDisplay: 'Claude Opus 5'", expect: "modelDisplay: 'Claude Opus 5'" },
        { pattern: /runDate: '[^']*'/, replacement: "runDate: '2026-07-26'", expect: "runDate: '2026-07-26'" },
      ]);

      assert.equal(result.changed, true);
      const onDisk = await readFile(path, 'utf-8');
      assert.ok(onDisk.includes("modelId: 'claude-opus-5'"));
      assert.ok(onDisk.includes("modelDisplay: 'Claude Opus 5'"));
      assert.ok(onDisk.includes("runDate: '2026-07-26'"));
    });
  });

  test('one unmatched edit fails the whole rewrite', async () => {
    // modelId matches, runDate does not — a partial rewrite must not pass.
    const source = "modelId: 'a';\nrunDate: \"2026-01-01\";\n";
    await withTempFile(source, async (path) => {
      await assert.rejects(
        () => rewriteGeneratedModule(path, [
          { pattern: /modelId: '[^']*'/, replacement: "modelId: 'b'", expect: "modelId: 'b'" },
          { pattern: /runDate: '[^']*'/, replacement: "runDate: '2026-07-26'", expect: "runDate: '2026-07-26'" },
        ]),
        /runDate/,
      );
    });
  });
});
