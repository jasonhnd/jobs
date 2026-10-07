/**
 * bypass.test.ts — the 2026-10-07 build-gate audit (#866).
 *
 * Every case here is a spelling that made a Design gate report OK while the
 * violation shipped: a colour in a property the gate did not read, a colour
 * syntax it did not parse, a canon section it could not find, a token it could
 * not resolve. The audit reproduced each one with rc=0. A gate that is blind
 * to a spelling is not a gate for that spelling.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readLedger } from './ledger.js';
import { findTypeScaleViolations } from './type-scale.js';
import { findColourViolations } from './color-tokens.js';
import { findHeadingRuleViolations } from './heading-rules.js';
import { auditContrast, findContrastProblems } from './contrast.js';
import { findSyncProblems } from './design-sync.js';

const REAL = process.cwd();

/** The real palette, so derivability is judged against the shipped tokens. */
const PALETTE = [
  'export const CSS = `:root {',
  '  --paper: #FFFFFF;',
  '  --ink: #241E18;',
  '  --orange: #D96B3D;',
  '  --orange-hot: #c0411e;',
  '  --fg2: #7A6F5E;',
  '}`;',
].join('\n');

const LEDGER = (files: readonly string[], state = 'conformant'): string =>
  [
    '| surface | 範囲 | ページ数 | 実装 | 状態 | 備考 |',
    '|---|---|---|---|---|---|',
    `| \`demo\` | x | 1 | \`demo.ts\` | \`${state}\` | — |`,
    '',
    '| surface | 主な対象ファイル |',
    '|---|---|',
    `| \`demo\` | ${files.map((f) => `\`${f}\``).join(', ')} |`,
    '',
  ].join('\n');

/** A synthetic repo: the ledger claims every file written. */
function repo(files: Record<string, string>, extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'design-bypass-'));
  const all: Record<string, string> = {
    'src/lib/canonical-css.ts': PALETTE,
    'docs/DESIGN_CONFORMANCE.md': LEDGER(Object.keys(files)),
    ...files,
    ...extra,
  };
  for (const [path, body] of Object.entries(all)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

function withRepo<T>(files: Record<string, string>, fn: (root: string) => T, extra: Record<string, string> = {}): T {
  const root = repo(files, extra);
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

const css = (body: string): string => `export const CSS = \`\n${body}\n\`;\n`;

// ── P1-2 check-color-tokens ─────────────────────────────────────────────────

describe('check-color-tokens — every property, every colour syntax (#866 P1-2)', () => {
  const failing = (body: string) =>
    withRepo({ 'src/pages/demo.ts': css(body) }, (root) =>
      findColourViolations(root).filter((v) => v.derivable));

  test('a palette tint in box-shadow fails (Hub.ts:436 escaped this way)', () => {
    const v = failing('.qa[open] { box-shadow: 0 4px 14px rgba(217,107,61,0.08); }');
    assert.equal(v.length, 1);
    assert.equal(v[0]?.property, 'box-shadow');
  });

  test('a palette tint in a custom property fails (_index.css:19 escaped this way)', () => {
    const v = failing('.root { --border: rgba(36, 30, 24, 0.10); }');
    assert.equal(v.length, 1);
    assert.equal(v[0]?.property, '--border');
  });

  test('outline and border-*-color are read', () => {
    assert.equal(failing('.a { outline: 2px solid #D96B3D; }').length, 1);
    assert.equal(failing('.a { border-top-color: #d96b3d; }').length, 1);
  });

  test('property names are case-insensitive and may have space before the colon', () => {
    assert.equal(failing('.a { BOX-SHADOW : 0 0 2px rgba(217,107,61,.2); }').length, 1);
    assert.equal(failing('.a { Color : #D96B3D; }').length, 1);
  });

  test('a raw hex equal to a palette token is derivable — it IS the token', () => {
    const v = failing('.a { color: #7A6F5E; }');
    assert.equal(v.length, 1);
  });

  test('8-digit hex, 4-digit hex and space-syntax rgb() of a palette colour fail', () => {
    assert.equal(failing('.a { color: #D96B3D80; }').length, 1);
    assert.equal(failing('.a { color: #FFF8; }').length, 1);
    assert.equal(failing('.a { color: rgb(217 107 61 / 0.5); }').length, 1);
    assert.equal(failing('.a { color: rgba(217 107 61 / 50%); }').length, 1);
  });

  test('hsl() / hsla() / oklch() are parsed and compared by RGB', () => {
    assert.equal(failing('.a { color: hsl(0, 0%, 100%); }').length, 1);
    assert.equal(failing('.a { color: hsla(17.69, 67.24%, 54.51%, 0.5); }').length, 1);
    assert.equal(failing('.a { color: hsl(17.69deg 67.24% 54.51% / .5); }').length, 1);
    assert.equal(failing('.a { color: oklch(1 0 0); }').length, 1);
    assert.equal(failing('.a { color: oklch(65% 0.1508 42.16 / 0.4); }').length, 1);
  });

  test('an off-palette colour in a new syntax is still SEEN (reported, not failed)', () => {
    withRepo({ 'src/pages/demo.ts': css('.a { color: hsl(200 50% 50%); background: oklch(0.5 0.1 200); }') }, (root) => {
      const v = findColourViolations(root);
      assert.equal(v.length, 2);
      assert.ok(v.every((x) => !x.derivable));
    });
  });

  test('neutral black/white is exempt on the newly read properties only', () => {
    assert.equal(failing('.a { box-shadow: 0 1px 0 rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,.5); }').length, 0);
    withRepo({ 'src/pages/demo.ts': css('.a { box-shadow: 0 1px 0 rgba(0,0,0,0.03); }') }, (root) => {
      assert.equal(findColourViolations(root).length, 0);
    });
    // `color`/`background` were always read; white there is --paper and stays a failure.
    assert.equal(failing('.a { background: rgba(255,255,255,.5); }').length, 1);
  });

  test('a JS object key holding a hex string is not a CSS declaration', () => {
    withRepo({ 'src/pages/demo.ts': "export const C = { CPB: '#D96B3D', RDK: '#7A6F5E' };\n" }, (root) => {
      assert.equal(findColourViolations(root).length, 0);
    });
  });

  test('a Satori style object (quoted value on a colour property) is still read', () => {
    withRepo({ 'src/pages/demo.ts': "export const S = { color: '#D96B3D' };\n" }, (root) => {
      assert.equal(findColourViolations(root).filter((v) => v.derivable).length, 1);
    });
  });

  test('a token, color-mix() of a token, or var() with a fallback passes', () => {
    assert.equal(failing('.a { box-shadow: 0 4px 14px color-mix(in srgb, var(--orange) 8%, transparent); }').length, 0);
    assert.equal(failing('.a { --border: color-mix(in srgb, var(--ink) 10%, transparent); }').length, 0);
    assert.equal(failing('.a { color: var(--bg2, #FFFFFF); }').length, 0);
  });

  test('the palette is defined in canonical-css.ts :root; a rule there is still checked', () => {
    const canon = 'export const CSS = `\n:root {\n  --orange: #D96B3D;\n}\n.banner {\n  color: #D96B3D;\n}\n`;\n';
    withRepo({}, (root) => {
      const v = findColourViolations(root).filter((x) => x.derivable);
      assert.deepEqual(v.map((x) => [x.selector, x.property]), [['.banner', 'color']]);
    }, { 'src/lib/canonical-css.ts': canon, 'docs/DESIGN_CONFORMANCE.md': LEDGER(['src/lib/canonical-css.ts']) });
  });

  test('the homepage first-paint palette copy is exempt only while it equals the token', () => {
    const copy = (v: string) => `:root {\n  --fg2: ${v};\n  --border: color-mix(in srgb, var(--fg) 10%, transparent);\n}\n`;
    withRepo({ 'src/pages/_index.css': copy('#7A6F5E') }, (root) => {
      assert.deepEqual(findColourViolations(root), []);
    });
    // Drifted from canonical-css.ts: no longer a copy, so it is judged like any raw colour.
    withRepo({ 'src/pages/_index.css': copy('#D96B3D') }, (root) => {
      assert.equal(findColourViolations(root).filter((x) => x.derivable).length, 1);
    });
    // The same declaration outside :root is not covered.
    withRepo({ 'src/pages/_index.css': '.x {\n  --fg2: #7A6F5E;\n}\n' }, (root) => {
      assert.equal(findColourViolations(root).filter((x) => x.derivable).length, 1);
    });
  });

  test('a data URI blanks only the URI, not the declarations after it on the line', () => {
    const line =
      ".a { background: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E\"); color: #D96B3D; }";
    const v = failing(line);
    assert.equal(v.length, 1);
    assert.equal(v[0]?.property, 'color');
  });
});

// ── P1-3 check-design-sync ─────────────────────────────────────────────────

describe('check-design-sync — fails closed (#866 P1-3)', () => {
  const realDoc = readFileSync(join(REAL, 'docs/Design.md'), 'utf-8');
  const syncWith = (doc: string) =>
    withRepo({}, (root) => findSyncProblems(root), { 'docs/Design.md': doc });

  test('the real canon still agrees', () => {
    assert.deepEqual(findSyncProblems(), []);
  });

  test('a renamed §21.2 heading is a failure, not an empty pass', () => {
    const p = syncWith(realDoc.replace('## §21.2 step 1', '## § 21.2 step 1'));
    assert.ok(p.some((x) => x.kind === 'parse'), JSON.stringify(p));
  });

  test('an empty §21.2 table is a failure', () => {
    const start = realDoc.indexOf('## §21.2');
    const end = realDoc.indexOf('## §21.3');
    const p = syncWith(`${realDoc.slice(0, start)}## §21.2 step 1\n\n(empty)\n\n${realDoc.slice(end)}`);
    assert.ok(p.some((x) => x.kind === 'parse'), JSON.stringify(p));
  });

  test('an unreadable version sentence is a failure', () => {
    const p = syncWith(realDoc.replaceAll('Design v1.2（制定', 'Design v1.2 （制定'));
    assert.ok(p.some((x) => x.kind === 'version' || x.kind === 'parse'), JSON.stringify(p));
  });

  test('a token present in the module but absent from §21.2 is missing-in-doc', () => {
    const p = syncWith(realDoc.replace(' / `--r-pill: 999px`', ''));
    assert.deepEqual(p.map((x) => [x.kind, x.token]), [['missing-in-doc', '--r-pill']]);
  });

  test('the --s-* range is expanded and its middle steps compared', () => {
    const p = syncWith(realDoc.replace('（4 / 8 / 12 / 16 / 24 / 32 / 48 / 64）', '（4 / 8 / 12 / 15 / 24 / 32 / 48 / 64）'));
    assert.deepEqual(p.map((x) => [x.kind, x.token, x.doc]), [['value', '--s-4', '15px']]);
  });

  test('a range whose list disagrees with its endpoint is a parse failure', () => {
    const p = syncWith(realDoc.replace('（4 / 8 / 12 / 16 / 24 / 32 / 48 / 64）', '（4 / 8 / 12 / 16 / 24 / 32 / 48 / 60）'));
    assert.ok(p.some((x) => x.kind === 'parse' && x.token === '--s-8'), JSON.stringify(p));
  });

  test('--sh-* is compared against the §8.3 table', () => {
    const p = syncWith(realDoc.replace(
      '| `--sh-accent` | `0 4px 14px rgba(217,107,61,0.28)`',
      '| `--sh-accent` | `0 4px 14px rgba(217,107,61,0.30)`',
    ));
    assert.deepEqual(p.map((x) => [x.kind, x.token]), [['value', '--sh-accent']]);
  });
});

// ── P1-4 check-contrast ────────────────────────────────────────────────────

describe('check-contrast — an unresolvable token fails (#866 P1-4)', () => {
  const realDoc = readFileSync(join(REAL, 'docs/Design.md'), 'utf-8');
  const realCss = readFileSync(join(REAL, 'src/lib/canonical-css.ts'), 'utf-8');
  const withRow = (row: string) => {
    const doc = realDoc.replace(/(## §4\.7[^\n]*\n[\s\S]*?\n\|[^\n]*\|\n\|[-| ]+\|\n)/, `$1${row}\n`);
    assert.notEqual(doc, realDoc, 'fixture did not insert the row');
    return withRepo({}, (root) => auditContrast(root), {
      'docs/Design.md': doc,
      'src/lib/canonical-css.ts': realCss,
    });
  };

  test('the real table resolves every row and reports how many pairs it checked', () => {
    const a = auditContrast();
    assert.deepEqual(a.unresolved, []);
    assert.deepEqual(a.problems, []);
    assert.ok(a.checked >= 90, `checked=${a.checked}`);
    assert.deepEqual(findContrastProblems(), []);
  });

  test('an undefined colour token is unresolved, not skipped', () => {
    const a = withRow('| 試験 | `--t-body` | sans | 400 | `--ink-9` | — |');
    assert.deepEqual(a.unresolved.map((u) => u.token), ['--ink-9']);
  });

  test('an undefined size token is unresolved, not skipped', () => {
    const a = withRow('| 試験 | `--t-nope` | sans | 400 | `--ink` | — |');
    assert.deepEqual(a.unresolved.map((u) => u.token), ['--t-nope']);
  });

  test('--paper as a foreground stays the one documented exception', () => {
    const a = withRow('| 試験 | `--t-sm` | sans | 700 | `--paper` | — |');
    assert.deepEqual(a.unresolved, []);
  });
});

// ── P1-5 check-type-scale / check-heading-rules ────────────────────────────

describe('check-type-scale — font shorthand, case, spacing, real tokens (#866 P1-5)', () => {
  const sizes = (body: string) =>
    withRepo({ 'src/pages/demo.ts': css(body) }, (root) =>
      findTypeScaleViolations(root).map((v) => v.value));

  test('the size inside a font: shorthand is checked', () => {
    assert.deepEqual(sizes('.a { font: 400 10px/1 sans-serif; }'), ['10px']);
    assert.deepEqual(sizes('.a { font: italic bold 13px Georgia, serif; }'), ['13px']);
  });

  test('a shorthand built from tokens, or a keyword-only one, passes', () => {
    assert.deepEqual(sizes('.a { font: 700 var(--t-sm)/1.4 var(--font-sans); }'), []);
    assert.deepEqual(sizes('.a { font: inherit; }'), []);
  });

  test('FONT-SIZE in capitals and a space before the colon are read', () => {
    assert.deepEqual(sizes('.a { FONT-SIZE: 13px; }'), ['13px']);
    assert.deepEqual(sizes('.a { font-size : 13px; }'), ['13px']);
  });

  test('a --t-* token that does not exist is not a scale step', () => {
    assert.deepEqual(sizes('.a { font-size: var(--t-huge); }'), ['var(--t-huge)']);
    assert.deepEqual(sizes('.a { font-size: var(--t-sm); }'), []);
  });

  test('.js files are scanned (src/pages/_map-inline.js was invisible)', () => {
    withRepo({ 'src/pages/demo.js': "el.innerHTML = '<style>.a { font-size: 13px }</style>';\n" }, (root) => {
      assert.equal(findTypeScaleViolations(root).length, 1);
    });
  });

  test('the 404 numeral exemption covers that rule only', () => {
    const page = [
      '<style>',
      '.four-oh-four { font-size: clamp(5rem, 18vw, 9rem); }',
      '.four-oh-four-x { font-size: 13px; }',
      '</style>',
    ].join('\n');
    withRepo({ 'src/pages/404.astro': page }, (root) => {
      assert.deepEqual(findTypeScaleViolations(root).map((v) => v.selector), ['.four-oh-four-x']);
    });
  });
});

describe('check-heading-rules — shorthand, case, selectors, line numbers (#866 P1-5 / P2)', () => {
  const hits = (body: string) =>
    withRepo({ 'src/pages/demo.ts': css(body) }, (root) => findHeadingRuleViolations(root));

  test('font: shorthand on a heading is §4.9 type', () => {
    const v = hits('h2 { font: 900 2rem serif }');
    assert.equal(v.length, 1);
    assert.deepEqual(v[0]?.declarations, ['font: 900 2rem serif']);
  });

  test('capitals and a space before the colon are read', () => {
    assert.equal(hits('H2 { FONT-SIZE : 2rem }').length, 1);
  });

  test('`summary` exempts the summary element, not any class containing the word', () => {
    assert.equal(hits('.summary-card h2 { font-size: 2rem }').length, 1);
    assert.equal(hits('.faq summary h3 { font-size: 2rem }').length, 0);
  });

  test('a ${…} interpolation in the rule body does not hide the rule', () => {
    const v = hits('.card h2 { color: ${c}; font-size: 2rem }');
    assert.equal(v.length, 1);
    assert.equal(v[0]?.selector, '.card h2');
  });

  test(':where() and :is() around a heading are headings; :not() is not', () => {
    assert.equal(hits(':where(h2) { font-size: 2rem }').length, 1);
    assert.equal(hits('.x :is(h1, h3) { font-weight: 700 }').length, 1);
    assert.equal(hits('.x :not(h2) { font-weight: 700 }').length, 0);
  });

  test('the reported line is the selector line', () => {
    // css() puts the body on line 2.
    const v = hits('.a { margin: 0 }\n\n.card h2 {\n  font-size: 2rem\n}');
    assert.equal(v.length, 1);
    assert.equal(v[0]?.line, 4);
    assert.equal(v[0]?.selector, '.card h2');
    const first = hits('h3 { font-weight: 700 }');
    assert.equal(first[0]?.line, 2);
    assert.equal(first[0]?.selector, 'h3');
  });
});

// ── P2 ledger ──────────────────────────────────────────────────────────────

describe('ledger — an empty or unparseable ledger fails (#866 P2)', () => {
  test('no surfaces parsed throws instead of letting every gate skip every file', () => {
    withRepo({}, (root) => {
      assert.throws(() => readLedger(root), /DESIGN_CONFORMANCE/);
    }, { 'docs/DESIGN_CONFORMANCE.md': '# ledger\n\n(nothing here)\n' });
  });

  test('surfaces with no file table throws too', () => {
    const states = LEDGER(['src/pages/demo.ts']).split('\n\n')[0] ?? '';
    withRepo({}, (root) => {
      assert.throws(() => readLedger(root), /DESIGN_CONFORMANCE/);
    }, { 'docs/DESIGN_CONFORMANCE.md': `${states}\n` });
  });
});
