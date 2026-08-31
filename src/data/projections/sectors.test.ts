import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { buildSectors, suggestSector } from './sectors.js';
import type { Indexes } from '../lib/indexes.js';
import type { SectorDef } from '../schema/sector.js';

function sector(overrides: Partial<SectorDef>): SectorDef {
  return {
    id: 'alpha',
    ja: 'アルファ',
    en: 'Alpha',
    hue: 'safe',
    description_ja: null,
    mhlw_seed_codes: [],
    ...overrides,
  };
}

describe('suggestSector', () => {
  const sectors = [
    sector({ id: 'medical', ja: '医療', en: 'Medical', mhlw_seed_codes: ['12_072*'] }),
    sector({ id: 'care', ja: '介護', en: 'Care', mhlw_seed_codes: ['12_*'] }),
  ];

  test('returns null when the MHLW code is missing or unmatched', () => {
    assert.equal(suggestSector(null, sectors), null);
    assert.equal(suggestSector(undefined, sectors), null);
    assert.equal(suggestSector('99_999', sectors), null);
  });

  test('prefers the first sector matching the most specific prefix glob', () => {
    assert.equal(suggestSector('12_072-06', sectors), 'medical');
  });

  test('normalizes hyphenated MHLW codes while walking shorter prefixes', () => {
    assert.equal(
      suggestSector('44-123-99', [
        sector({ id: 'transport', ja: '運輸', en: 'Transport', mhlw_seed_codes: ['44_123*'] }),
      ]),
      'transport',
    );
  });
});

describe('buildSectors aggregation', () => {
  test('uses compensated sums for sector totals and emits review hints', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'jobs-sectors-'));
    try {
      const sectors = [
        sector({ id: 'alpha', ja: 'アルファ', en: 'Alpha', mhlw_seed_codes: ['11_*'] }),
        sector({ id: 'beta', ja: 'ベータ', en: 'Beta', mhlw_seed_codes: ['22_*'] }),
      ];
      const indexes = {
        occById: new Map([
          [1, { id: 1, title_ja: '一', classifications: { mhlw_main: '11_001' } }],
          [2, { id: 2, title_ja: '二', classifications: { mhlw_main: '11_002' } }],
          [3, { id: 3, title_ja: '三', classifications: { mhlw_main: '11_003' } }],
          [4, { id: 4, title_ja: '未分類', classifications: { mhlw_main: '22-123-99' } }],
        ]),
        statsById: new Map([
          [1, { workers: 10_000_000_000_000_000 }],
          [2, { workers: 1 }],
          [3, { workers: 1 }],
        ]),
        canonicalScoreByOcc: new Map([
          [1, { ai_risk: 2.898 }],
          [2, { ai_risk: 2.673 }],
          [3, { ai_risk: 2.878 }],
        ]),
        sectors,
        sectorByOcc: new Map([
          [1, { sector_id: 'alpha', provenance: 'auto', matched_seeds: ['11_*'], candidates: ['alpha'] }],
          [2, { sector_id: 'alpha', provenance: 'auto', matched_seeds: ['11_*'], candidates: ['alpha'] }],
          [3, { sector_id: 'alpha', provenance: 'auto', matched_seeds: ['11_*'], candidates: ['alpha'] }],
          [4, { sector_id: '_uncategorized', provenance: 'unmatched', matched_seeds: [], candidates: [] }],
        ]),
        transById: new Map(),
        historyByOcc: new Map(),
        runsByModel: new Map(),
        labelsByDim: new Map(),
        sectorOverrides: new Map(),
      } as unknown as Indexes;

      await buildSectors(indexes, outDir);

      const sectorsPayload = JSON.parse(
        await readFile(join(outDir, 'data.sectors.json'), 'utf-8'),
      ) as {
        sectors: Array<{
          id: string;
          mean_ai_risk: number | null;
          total_workforce: number;
        }>;
      };
      const alpha = sectorsPayload.sectors.find((entry) => entry.id === 'alpha');
      assert.equal(alpha?.mean_ai_risk, 2.82);
      assert.equal(alpha?.total_workforce, 10_000_000_000_000_002);

      const queuePayload = JSON.parse(
        await readFile(join(outDir, 'data.review_queue.json'), 'utf-8'),
      ) as { uncategorized: Array<{ id: number; hint: string | null }> };
      assert.deepEqual(
        queuePayload.uncategorized.map((entry) => [entry.id, entry.hint]),
        [[4, 'beta']],
      );
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});
