/**
 * gates.test.ts — Design.md §19.1.
 *
 * The gates are only useful if the ratchet works: fail on `conformant`, warn on
 * `migrating`, silent on `legacy`. Each case is exercised against a synthetic
 * repo so the assertions do not depend on the real tree being clean.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLedger, surfaceStateFor } from './ledger.js';
import { findTypeScaleViolations } from './type-scale.js';
import { findColourViolations } from './color-tokens.js';
import { contrastRatio, luminance, requiredRatio, parseRoleTable, findContrastProblems } from './contrast.js';
import { stripComments } from './scan.js';
import { findSyncProblems } from './design-sync.js';

/** A minimal repo: a ledger with one surface in `state`, and one CSS file. */
function fixture(state: string, css: string): string {
  const root = mkdtempSync(join(tmpdir(), 'design-gate-'));
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'src/pages'), { recursive: true });
  writeFileSync(
    join(root, 'docs/DESIGN_CONFORMANCE.md'),
    [
      '| surface | 範囲 | ページ数 | 実装 | 状態 | 備考 |',
      '|---|---|---|---|---|---|',
      `| \`demo\` | x | 1 | \`demo.ts\` | \`${state}\` | — |`,
      '',
      '| surface | 主な対象ファイル |',
      '|---|---|',
      '| `demo` | `src/pages/demo.ts` |',
      '',
    ].join('\n'),
  );
  writeFileSync(join(root, 'src/pages/demo.ts'), css);
  return root;
}

describe('design gates — the per-surface ratchet (§19.1)', () => {
  const bad = 'export const CSS = `\n.x { font-size: 13px; color: #abcdef; }\n`;\n';

  test('conformant surface reports the violation', () => {
    const root = fixture('conformant', bad);
    try {
      const v = findTypeScaleViolations(root);
      assert.equal(v.length, 1);
      assert.equal(v[0]?.state, 'conformant');
      assert.equal(v[0]?.value, '13px');
      assert.equal(findColourViolations(root).length, 1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('migrating surface reports it as a warning, not a failure', () => {
    const root = fixture('migrating', bad);
    try {
      const v = findTypeScaleViolations(root);
      assert.equal(v.length, 1);
      assert.equal(v[0]?.state, 'migrating');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('legacy surface is ignored entirely', () => {
    const root = fixture('legacy', bad);
    try {
      assert.equal(findTypeScaleViolations(root).length, 0);
      assert.equal(findColourViolations(root).length, 0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('a scale token is not a violation', () => {
    const root = fixture('conformant', 'export const CSS = `\n.x { font-size: var(--t-sm); }\n`;\n');
    try { assert.equal(findTypeScaleViolations(root).length, 0); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('html { font-size: 16px } is the rem base, not a text role', () => {
    const root = fixture('conformant', 'export const CSS = `\nhtml { font-size: 16px; }\n`;\n');
    try { assert.equal(findTypeScaleViolations(root).length, 0); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('var() with a hex fallback is a token, not a raw colour', () => {
    const root = fixture('conformant', 'export const CSS = `\n.x { color: var(--fg, #241E18); }\n`;\n');
    try { assert.equal(findColourViolations(root).length, 0); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('a value quoted inside a comment is documentation', () => {
    const root = fixture('conformant', 'export const CSS = `\n/* font-size: 9px is banned */\n.x { font-size: var(--t-xs); }\n`;\n');
    try { assert.equal(findTypeScaleViolations(root).length, 0); }
    finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe('design gates — ledger parsing', () => {
  test('reads the real ledger and every surface has a valid state', () => {
    // Not pinned to a count: design-1.13 added `chrome`, and the ledger is
    // allowed to grow. What must hold is that every row parses.
    const s = readLedger();
    assert.ok(s.length >= 10, `expected at least 10 surfaces, got ${s.length}`);
    assert.ok(s.every((x) => ['conformant', 'migrating', 'legacy'].includes(x.state)));
    assert.ok(s.some((x) => x.name === 'chrome'), 'chrome surface must be in the ledger');
  });

  test('a file no surface claims returns null, so gates skip it', () => {
    assert.equal(surfaceStateFor('src/lib/urls.ts', readLedger()), null);
  });

  test('the strictest state wins when two surfaces share a file', () => {
    assert.equal(surfaceStateFor('src/lib/canonical-css.ts', readLedger()), 'conformant');
  });
});

describe('design gates — comment stripping keeps line numbers', () => {
  test('blanked comments do not shift the line a violation is reported on', () => {
    const out = stripComments('a\n/* x\ny */\nb');
    assert.equal(out.split('\n').length, 4);
    assert.equal(out.split('\n')[3], 'b');
  });
});

describe('check-contrast — the large-text rule (§2.2)', () => {
  test('22px and 18px do NOT qualify as large text', () => {
    assert.equal(requiredRatio(22, 400, 'sans'), 4.5);
    assert.equal(requiredRatio(18, 700, 'sans'), 4.5); // 18 < 18.66
  });

  test('the canon is stricter than WCAG for serif (§2.2 + §4.5)', () => {
    // WCAG would call 22px/700 large text. The shipped serif renders 400 and
    // 700 identically, so §2.2 says only Display and H1 qualify — H2 must
    // clear the full 4.5:1.
    assert.equal(requiredRatio(22, 700, 'serif'), 4.5);
    assert.equal(requiredRatio(22, 700, 'sans'), 3.0);
    assert.equal(requiredRatio(28, 400, 'serif'), 3.0); // H1, by size alone
  });

  test('24px, or 18.66px at weight 700 in sans, does qualify', () => {
    assert.equal(requiredRatio(24, 400, 'sans'), 3.0);
    assert.equal(requiredRatio(18.66, 700, 'sans'), 3.0);
  });

  test('luminance and ratio match the §2.2 measured table', () => {
    // --ink #241E18 on --cream #FAF6EE is recorded as 15.29 in §2.2.
    assert.ok(Math.abs(contrastRatio('#241E18', '#FAF6EE') - 15.29) < 0.05);
    // --orange-hot #c0411e on --cream-2 #F2EADB is recorded as 4.37 — below
    // 4.5, which is why §2.2-1 bans it there.
    assert.ok(Math.abs(contrastRatio('#c0411e', '#F2EADB') - 4.37) < 0.05);
    assert.ok(luminance('#FFFFFF') > luminance('#000000'));
  });

  test('the §4.7 role table parses and satisfies the contract', () => {
    assert.ok(parseRoleTable().length >= 30);
    assert.deepEqual(findContrastProblems(), []);
  });
});

describe('check-design-sync (§20.2)', () => {
  test('Design.md §21.2 and design-tokens.ts agree', () => {
    assert.deepEqual(findSyncProblems(), []);
  });
});
