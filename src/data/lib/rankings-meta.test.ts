/**
 * rankings-meta.test.ts — guards the single-source-of-truth contract
 * for the 9 ranking slugs.
 *
 * Drift cases caught:
 *   • Adding a slug to RankingSlug union without adding it to RANKING_META
 *   • Adding a RANKING_META entry whose slug isn't in the union
 *   • api/og.tsx reverting back to a hardcoded RANKING_CARDS list
 *     (drift detector reads og.tsx source and asserts the import line)
 *   • src/data/lib/rankings.ts reverting back to a hardcoded ALL_RANKINGS
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { RANKING_META } from './rankings-meta.js';
import { ALL_RANKINGS } from './rankings.js';

test('RANKING_META: every slug is unique', () => {
  const slugs = RANKING_META.map((m) => m.slug);
  assert.equal(
    new Set(slugs).size,
    slugs.length,
    `duplicate slug detected: ${slugs.filter((s, i) => slugs.indexOf(s) !== i).join(', ')}`,
  );
});

test('RANKING_META: every entry has all required fields', () => {
  for (const m of RANKING_META) {
    assert.ok(m.slug, `missing slug: ${JSON.stringify(m)}`);
    assert.ok(m.name_ja, `missing name_ja: ${m.slug}`);
    assert.ok(m.description_ja, `missing description_ja: ${m.slug}`);
    assert.ok(m.og_eyebrow, `missing og_eyebrow: ${m.slug}`);
  }
});

test('rankings.ts: ALL_RANKINGS is derived from RANKING_META, not hardcoded', () => {
  const fromMeta = RANKING_META.map((m) => [m.slug, m.name_ja, m.description_ja]);
  const fromAll = ALL_RANKINGS.map(([slug, name, desc]) => [slug, name, desc]);
  assert.deepEqual(
    fromAll,
    fromMeta,
    'ALL_RANKINGS does not match RANKING_META — somebody likely re-introduced a hardcoded copy in rankings.ts',
  );
});

test('api/og.tsx: imports RANKING_META instead of duplicating slug list', () => {
  // Static check on og.tsx source. The previous bug was a literal
  // RANKING_CARDS object hardcoded with the 9 slugs — adding a 10th
  // ranking would silently break /api/og?ranking=<new-slug> until
  // someone remembered to update both files.
  const source = readFileSync('api/og.tsx', 'utf8');
  assert.ok(
    source.includes('rankings-meta'),
    "api/og.tsx must import from src/data/lib/rankings-meta — drift risk reverted?",
  );
  assert.ok(
    source.includes('RANKING_META'),
    "api/og.tsx must reference RANKING_META — drift risk reverted?",
  );
  // Sanity: og.tsx should NOT have a hardcoded `'ai-risk-high'` literal
  // outside of the import path (a regression would put all 9 slugs back
  // in a literal Record).
  const hardcodedSlugCount = (source.match(/['"]ai-risk-high['"]/g) ?? []).length;
  assert.ok(
    hardcodedSlugCount === 0,
    `api/og.tsx contains ${hardcodedSlugCount} hardcoded "ai-risk-high" literal(s) — drift detected`,
  );
});

test('rankings.ts: does NOT contain hardcoded ALL_RANKINGS literal array', () => {
  // The literal `'ai-risk-high', 'AIに奪われる仕事 TOP30'` line is the
  // canonical signature of the pre-refactor hardcoded duplicate. If it
  // reappears in rankings.ts, drift was reverted.
  const source = readFileSync('src/data/lib/rankings.ts', 'utf8');
  assert.ok(
    source.includes('rankings-meta'),
    "rankings.ts must import RANKING_META from rankings-meta.js",
  );
  // Detect the old hardcoded pattern by name+desc colocation.
  const hardcodedPatternMatches = source.match(
    /\['ai-risk-high',\s*'AIに奪われる仕事 TOP30'/,
  );
  assert.equal(
    hardcodedPatternMatches,
    null,
    'rankings.ts contains the hardcoded ALL_RANKINGS literal — drift reverted',
  );
});
