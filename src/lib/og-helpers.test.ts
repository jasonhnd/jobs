/**
 * og-helpers.test.ts — drift guards between the OG edge function's
 * narrow runtime schemas and the canonical projection-schemas.
 *
 * Background: src/lib/og-helpers.ts defines DetailRecordSchema and
 * SectorsProjectionSchema as DELIBERATE narrow subsets of the full
 * src/data/lib/projection-schemas.ts schemas. The duplication exists
 * because the OG endpoint runs on Vercel Edge with strict bundle size
 * limits; importing the full DetailFileSchema (which references many
 * sub-schemas + zod validators) would bloat the per-cold-start payload.
 *
 * The risk of duplication is drift: a field rename in the projection
 * schema wouldn't fail the OG schema's safeParse (both use
 * `.passthrough()`), but the runtime fields the OG code reads would
 * disappear silently, and the next deploy would render broken cards.
 *
 * These tests pin the structural compatibility at build time:
 *   1. Real public/data.detail/0001.json validates against BOTH schemas.
 *   2. Real public/data.sectors.json validates against BOTH schemas.
 *   3. Every field the OG endpoint code path reads is present in the
 *      narrow schema's output AND in real data.
 *
 * If projection-schemas changes shape, this test fails BEFORE the OG
 * endpoint silently breaks in production.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DetailRecordSchema,
  SectorsProjectionSchema as OgSectorsProjectionSchema,
} from './og-helpers.js';
import {
  DetailFileSchema,
  SectorsProjectionSchema as ProjSectorsProjectionSchema,
} from '../data/lib/projection-schemas.js';

const REPO = process.cwd();

describe('og-helpers schema drift guard', () => {
  test('DetailRecordSchema accepts what DetailFileSchema produces for occupation #1', () => {
    const path = join(REPO, 'public', 'data.detail', '0001.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8'));

    // 1) The projection schema must accept the real file.
    const projResult = DetailFileSchema.safeParse(raw);
    assert.ok(
      projResult.success,
      `DetailFileSchema rejected /data.detail/0001.json — projection drifted: ${
        projResult.success ? '' : projResult.error.issues.slice(0, 3).map(i => i.message).join('; ')
      }`,
    );

    // 2) The OG narrow schema must also accept it.
    const ogResult = DetailRecordSchema.safeParse(raw);
    assert.ok(
      ogResult.success,
      `og-helpers.DetailRecordSchema rejected the same file — narrow schema drifted: ${
        ogResult.success ? '' : ogResult.error.issues.slice(0, 3).map(i => i.message).join('; ')
      }`,
    );

    // 3) Every field the OG runtime path actually reads must resolve.
    const d = ogResult.data;
    assert.equal(typeof d.id, 'number', 'OG card reads id');
    assert.ok(d.title?.ja, 'OG card reads title.ja for the occupation card subtitle');
    assert.equal(typeof d.ai_risk?.score, 'number', 'OG card reads ai_risk.score for the risk pill');
    assert.equal(typeof d.ai_risk?.rationale_ja, 'string', 'OG card reads ai_risk.rationale_ja for the rationale row');
    // stats may be missing for a handful of occupations — the OG card
    // handles null gracefully. Just assert the shape when present.
    if (d.stats) {
      const s = d.stats;
      const isNumOrNull = (v: unknown) => v === null || v === undefined || typeof v === 'number';
      assert.ok(isNumOrNull(s.workers),         'stats.workers number-or-null');
      assert.ok(isNumOrNull(s.salary_man_yen),  'stats.salary_man_yen number-or-null');
    }
  });

  test('SectorsProjectionSchema (og) accepts what projection-schemas produces', () => {
    const path = join(REPO, 'public', 'data.sectors.json');
    const raw = JSON.parse(readFileSync(path, 'utf-8'));

    const projResult = ProjSectorsProjectionSchema.safeParse(raw);
    assert.ok(
      projResult.success,
      `projection-schemas.SectorsProjectionSchema rejected /data.sectors.json: ${
        projResult.success ? '' : projResult.error.issues.slice(0, 3).map(i => i.message).join('; ')
      }`,
    );

    const ogResult = OgSectorsProjectionSchema.safeParse(raw);
    assert.ok(
      ogResult.success,
      `og-helpers.SectorsProjectionSchema rejected the same file: ${
        ogResult.success ? '' : ogResult.error.issues.slice(0, 3).map(i => i.message).join('; ')
      }`,
    );

    // Every sector record the OG code path reads.
    const projection = ogResult.data;
    assert.ok(Array.isArray(projection.sectors), 'sectors must be an array');
    assert.ok(projection.sectors.length >= 16, 'at least the 16 canonical sectors');
    for (const s of projection.sectors) {
      assert.equal(typeof s.id, 'string', `sector id is string (got ${typeof s.id} for ${JSON.stringify(s).slice(0, 80)})`);
      assert.equal(typeof s.ja, 'string', 'sector ja is string');
      // The OG code reads occupation_count + mean_ai_risk + total_workforce
      // and renders them in the sector card subtitle.
      assert.equal(typeof s.occupation_count, 'number', 'sector occupation_count is number');
      assert.equal(typeof s.mean_ai_risk, 'number', 'sector mean_ai_risk is number');
      assert.equal(typeof s.total_workforce, 'number', 'sector total_workforce is number');
    }
  });

  test('DetailRecordSchema is structurally a subset of DetailFileSchema (passthrough check)', () => {
    // If projection-schemas.DetailFileSchema accepts a value, then the
    // narrow og-helpers.DetailRecordSchema (which uses .passthrough() and
    // requires fewer fields) must also accept it. Sweep 8 sample
    // occupations covering edge cases (no stats, no scores, full data).
    const sampleIds = ['0001', '0050', '0100', '0250', '0400', '0500', '0552', '0556'];
    for (const id of sampleIds) {
      const raw = JSON.parse(
        readFileSync(join(REPO, 'public', 'data.detail', `${id}.json`), 'utf-8'),
      );
      const projOk = DetailFileSchema.safeParse(raw).success;
      const ogOk = DetailRecordSchema.safeParse(raw).success;
      assert.ok(
        projOk,
        `projection schema rejected /data.detail/${id}.json — fix projection first`,
      );
      assert.ok(
        ogOk,
        `og narrow schema rejected /data.detail/${id}.json — DetailRecordSchema needs to widen`,
      );
    }
  });
});
