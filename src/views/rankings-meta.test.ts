/**
 * rankings-meta.test.ts — guards the single-source-of-truth contract
 * for the 9 ranking slugs.
 *
 * Drift cases caught:
 *   • Adding a slug to RankingSlug union without adding it to RANKING_META
 *   • Adding a RANKING_META entry whose slug isn't in the union
 *   • api/og.tsx reverting back to a hardcoded RANKING_CARDS list
 *     (drift detector reads og.tsx source and asserts the import line)
 *   • src/views/ranking.ts reverting back to a hardcoded ALL_RANKINGS
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { RANKING_META } from './rankings-meta.js';
import { ALL_RANKINGS } from './ranking.js';

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

test('OG card configs: src/views/og-cards.ts derives RANKING_CARDS from RANKING_META (no hardcoded slug list)', () => {
  // The previous bug was a literal RANKING_CARDS object hardcoded
  // with the 9 slugs — adding a 10th ranking would silently break
  // /api/og?ranking=<new-slug> until someone remembered to update
  // both files. Step 9 part 1 (2026-05-13) moved the 5 OG card
  // dicts out of api/og.tsx and into src/views/og-cards.ts, but
  // the same drift risk applies: the new file must keep building
  // RANKING_CARDS from RANKING_META, not by hand.
  const og = readFileSync('api/og.tsx', 'utf8');
  const cards = readFileSync('src/views/og-cards.ts', 'utf8');

  // (a) api/og.tsx must consume the views/og-cards module.
  assert.ok(
    og.includes("src/views/og-cards") || og.includes('og-cards'),
    'api/og.tsx must import the OG card configs from src/views/og-cards — drift risk reverted?',
  );

  // (b) src/views/og-cards.ts must import + reference RANKING_META.
  assert.ok(
    cards.includes('rankings-meta'),
    'src/views/og-cards.ts must import from src/views/rankings-meta — drift risk reverted?',
  );
  assert.ok(
    cards.includes('RANKING_META'),
    'src/views/og-cards.ts must reference RANKING_META — drift risk reverted?',
  );

  // (c) Neither file should contain a hardcoded `'ai-risk-high'`
  //     literal (signature of the pre-refactor 9-slug duplicate).
  const ogHardcoded = (og.match(/['"]ai-risk-high['"]/g) ?? []).length;
  const cardsHardcoded = (cards.match(/['"]ai-risk-high['"]/g) ?? []).length;
  assert.equal(
    ogHardcoded + cardsHardcoded,
    0,
    `Hardcoded "ai-risk-high" literals: og.tsx=${ogHardcoded}, og-cards.ts=${cardsHardcoded} — drift detected`,
  );
});

test('ranking subsystem: does NOT contain hardcoded ALL_RANKINGS literal array', () => {
  // The literal `'ai-risk-high', 'AIに奪われる仕事 TOP30'` line is the
  // canonical signature of the pre-refactor hardcoded duplicate. If it
  // reappears in the ranking subsystem, drift was reverted.
  //
  //   Phase B  (2026-05-14): rankings.ts moved data/lib → views.
  //   CODE-010 (2026-05-17): views/ranking.ts split into views/ranking/*
  //                          (this test now scans both the barrel and
  //                          the config module where RANKING_META is
  //                          imported).
  const barrel = readFileSync('src/views/ranking.ts', 'utf8');
  const config = readFileSync('src/views/ranking/config.ts', 'utf8');

  // The barrel must re-export from the new module; the config module
  // is the canonical home of the ALL_RANKINGS derivation.
  assert.ok(
    config.includes('rankings-meta'),
    'src/views/ranking/config.ts must import RANKING_META from rankings-meta.js',
  );
  assert.ok(
    barrel.includes('./ranking/index.js') || barrel.includes('./ranking/'),
    'src/views/ranking.ts must re-export from ./ranking/ (the split subsystem)',
  );

  // Detect the old hardcoded pattern by name+desc colocation across
  // any file in the ranking subsystem (legacy barrel + new modules).
  const all = barrel + '\n' + config;
  const hardcodedPatternMatches = all.match(
    /\['ai-risk-high',\s*'AIに奪われる仕事 TOP30'/,
  );
  assert.equal(
    hardcodedPatternMatches,
    null,
    'ranking subsystem contains the hardcoded ALL_RANKINGS literal — drift reverted',
  );
});
