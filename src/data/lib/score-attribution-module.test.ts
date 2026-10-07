import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rewriteGeneratedModule } from './rewrite-generated-module.js';
import { scoreAttributionEdits, type ScoreAttributionModuleValues } from './score-attribution-module.js';

const COMMITTED = `export const SCORE_ATTRIBUTION_DATA = {
  modelId: 'gpt-6.1-sol',
  modelDisplay: 'GPT 6.1 SOL',
  runDate: '2026-10-01',
} as const;

export const SCORE_PANEL_DATA = {
  vendorCount: 3,
  latestRunDate: '2026-10-01',
  staleMonths: 6,
  staleVendorCount: 0,
} as const;
`;

const VALUES: ScoreAttributionModuleValues = {
  modelId: 'gpt-6.1-sol',
  modelDisplay: 'GPT 6.1 SOL',
  runDate: '2026-10-01',
  vendorCount: 3,
  latestRunDate: '2026-10-01',
  staleMonths: 6,
  staleVendorCount: 0,
};

async function rewrite(initial: string, values: ScoreAttributionModuleValues): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'score-attribution-module-'));
  const path = join(dir, '_score-attribution.ts');
  try {
    await writeFile(path, initial, 'utf-8');
    await rewriteGeneratedModule(path, scoreAttributionEdits(values));
    return await readFile(path, 'utf-8');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Evaluate the object literal the module exports, as a JS reader would. */
function exported(source: string, name: string): Record<string, unknown> {
  const match = new RegExp(`export const ${name} = (\\{[\\s\\S]*?\\}) as const;`).exec(source);
  assert.ok(match, `${name} not found`);
  return new Function(`return (${match[1]});`)() as Record<string, unknown>;
}

describe('scoreAttributionEdits (#863)', () => {
  test('writes string values as JSON string literals', async () => {
    const out = await rewrite(COMMITTED, VALUES);
    assert.match(out, /modelId: "gpt-6\.1-sol"/);
    assert.match(out, /runDate: "2026-10-01"/);
    assert.deepEqual(exported(out, 'SCORE_ATTRIBUTION_DATA'), {
      modelId: 'gpt-6.1-sol', modelDisplay: 'GPT 6.1 SOL', runDate: '2026-10-01',
    });
  });

  test('a quote, backslash or $ in a value stays data, not code', async () => {
    const hostile = { ...VALUES, modelId: "x', evil: (globalThis.pwned = 1), y: '$&\\", modelDisplay: 'A "B" $1' };
    const out = await rewrite(COMMITTED, hostile);
    const data = exported(out, 'SCORE_ATTRIBUTION_DATA');
    assert.equal(data.modelId, hostile.modelId);
    assert.equal(data.modelDisplay, hostile.modelDisplay);
    assert.deepEqual(Object.keys(data), ['modelId', 'modelDisplay', 'runDate']);
    assert.equal((globalThis as { pwned?: number }).pwned, undefined);
  });

  test('is idempotent on its own output', async () => {
    const once = await rewrite(COMMITTED, VALUES);
    const twice = await rewrite(once, VALUES);
    assert.equal(twice, once);
    const hostile = { ...VALUES, modelId: 'a"b\\c' };
    const h1 = await rewrite(COMMITTED, hostile);
    assert.equal(await rewrite(h1, hostile), h1);
    assert.equal(exported(await rewrite(h1, VALUES), 'SCORE_ATTRIBUTION_DATA').modelId, 'gpt-6.1-sol');
  });
});
