/**
 * legacy-island-contract.test.ts — drift guards for the runtime data
 * contracts the legacy island (src/index-source.html + src/pages/map.astro)
 * depends on.
 *
 * Background: per architecture.md Step 11, the two legacy files are
 * INTENTIONALLY preserved. map.astro:6 explicitly states "Do NOT refactor
 * the inline JS to React or split into modules" — the single IIFE owns
 * a non-trivial set of mobile-scroll-to-top + atomic-render fixes that
 * a split would risk breaking.
 *
 * What we CAN do: pin the runtime data contracts these files fetch
 * client-side at runtime. If a projection changes shape, these tests
 * fail at build time BEFORE the legacy island silently breaks for
 * real users at runtime.
 *
 * Contracts pinned:
 *   - /data.treemap.json  — fetched by map.astro and the desktop homepage treemap
 *   - /data.top10.json    — fetched by the mobile homepage TOP 10 carousel
 *   - /data.search.json   — fetched by map.astro for the search box
 *   - /data.sectors.json  — fetched by map.astro for the chip rail
 *
 * Each test reads the actual file output by `pnpm run build:data` and
 * asserts the fields the inline JS reads exist with the expected types.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.cwd();

function loadJson<T = unknown>(rel: string): T {
  return JSON.parse(readFileSync(join(REPO, 'public', rel), 'utf-8')) as T;
}

describe('legacy island runtime data contract', () => {
  test('/data.treemap.json — fields the map.astro IIFE reads', () => {
    const arr = loadJson<unknown[]>('data.treemap.json');
    assert.ok(Array.isArray(arr), 'treemap.json must be an array');
    assert.ok(arr.length >= 550, `expected at least 550 records (got ${arr.length})`);

    // Sample first record + a few mid-range — covers shape + null-handling.
    for (const idx of [0, 100, arr.length - 1]) {
      const r = arr[idx] as Record<string, unknown>;
      // map.astro reads: id, name_ja, ai_risk, salary, workers,
      // sector_id, sector_ja, risk_band, workforce_band.
      assert.equal(typeof r.id, 'number', `record[${idx}].id is number`);
      assert.equal(typeof r.name_ja, 'string', `record[${idx}].name_ja is string`);
      // ai_risk can be null (occupation not yet scored).
      assert.ok(
        r.ai_risk === null || typeof r.ai_risk === 'number',
        `record[${idx}].ai_risk null-or-number`,
      );
      // salary / workers similarly nullable in source.
      assert.ok(
        r.salary === null || typeof r.salary === 'number',
        `record[${idx}].salary null-or-number`,
      );
      assert.ok(
        r.workers === null || typeof r.workers === 'number',
        `record[${idx}].workers null-or-number`,
      );
      // Sector fields are required for chip filtering (no null).
      assert.equal(typeof r.sector_id, 'string', `record[${idx}].sector_id is string`);
      assert.equal(typeof r.sector_ja, 'string', `record[${idx}].sector_ja is string`);
    }
  });

  test('/data.top10.json — fields the mobile homepage TOP 10 carousel reads', () => {
    const arr = loadJson<unknown[]>('data.top10.json');
    assert.ok(Array.isArray(arr), 'top10.json must be an array');
    assert.equal(arr.length, 10, `expected exactly 10 records (got ${arr.length})`);

    for (const [idx, recAny] of arr.entries()) {
      const r = recAny as Record<string, unknown>;
      assert.equal(typeof r.id, 'number', `record[${idx}].id is number`);
      assert.equal(typeof r.name_ja, 'string', `record[${idx}].name_ja is string`);
      assert.ok(r.salary === null || typeof r.salary === 'number', `record[${idx}].salary null-or-number`);
      assert.ok(r.workers === null || typeof r.workers === 'number', `record[${idx}].workers null-or-number`);
      assert.equal(typeof r.ai_risk, 'number', `record[${idx}].ai_risk is number`);
      assert.equal(typeof r.ai_rationale_ja, 'string', `record[${idx}].ai_rationale_ja is string`);
    }
  });

  test('/data.search.json — fields the map.astro search IIFE reads', () => {
    const file = loadJson<Record<string, unknown>>('data.search.json');
    assert.equal(typeof file.schema_version, 'string', 'schema_version present');
    assert.equal(typeof file.document_count, 'number', 'document_count present');
    assert.ok(Array.isArray(file.documents), 'documents array present');

    const docs = file.documents as Array<Record<string, unknown>>;
    assert.ok(docs.length >= 550, `expected >= 550 documents (got ${docs.length})`);

    for (const idx of [0, 100, docs.length - 1]) {
      const d = docs[idx]!;
      // map.astro search reads: id, title_ja, aliases_ja[].
      assert.equal(typeof d.id, 'number', `documents[${idx}].id is number`);
      assert.equal(typeof d.title_ja, 'string', `documents[${idx}].title_ja is string`);
      assert.ok(Array.isArray(d.aliases_ja), `documents[${idx}].aliases_ja is array`);
      // sector_id used for any sector-scoped autocomplete.
      assert.equal(typeof d.sector_id, 'string', `documents[${idx}].sector_id is string`);
    }
  });

  test('/data.sectors.json — fields the map.astro chip rail reads', () => {
    const file = loadJson<Record<string, unknown>>('data.sectors.json');
    assert.ok(Array.isArray(file.sectors), 'sectors array present');
    const sectors = file.sectors as Array<Record<string, unknown>>;
    assert.ok(sectors.length >= 16, `expected >= 16 sectors (got ${sectors.length})`);

    for (const s of sectors) {
      // map.astro chip rail reads: id, ja.
      assert.equal(typeof s.id, 'string', `sector ${JSON.stringify(s).slice(0, 60)}: id is string`);
      assert.equal(typeof s.ja, 'string', `sector id=${s.id}: ja is string`);
    }
  });
});
