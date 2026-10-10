/**
 * serif-scope.test.ts — Design.md §4.4 rule 1 / §4.7 regression guard.
 *
 * Serif is Display / H1 / H2 plus the two numeric statistic roles. H3 and
 * lower headings and body text are sans. These selectors were serif leftovers
 * (JOB_0087 observation 1–2); this pins them so they cannot drift back.
 * The numeric roles (`.score-num`, `.stats dd`, rank counters) are NOT listed:
 * they are serif by §4.7.
 */
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './scan.js';

const ROOT = process.cwd();

/** [file, selector-prefix] — every rule whose selector contains this must not use serif. */
const SANS_ONLY: ReadonlyArray<readonly [string, string]> = [
  ['src/pages/rankings/_RankingsIndex.astro', '.ic-headline'],
  ['src/pages/_index.css', '.hub-subgroup-title'],
  ['src/pages/_id-css.ts', '.v-line'],
  ['src/pages/_id-css.ts', '.verdict-lede'],
  ['src/pages/_id-css.ts', '.faq-answer'],
  ['src/pages/_id-css.ts', '.ai-rationale-long'],
  ['src/pages/_id-css.ts', '.ai-task-block ul'],
  ['src/pages/_id-css.ts', '.ai-horizon'],
  ['src/pages/_id-css.ts', 'section.context p'],
  ['src/pages/_id-css.ts', '.cert-list li'],
  ['src/templates/Hub.ts', '.qa-item summary'],
];

function rulesFor(file: string, needle: string): string[] {
  const src = stripComments(readFileSync(join(ROOT, file), 'utf-8'));
  const out: string[] = [];
  for (const m of src.matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
    if ((m[1] ?? '').includes(needle)) out.push(m[2] ?? '');
  }
  return out;
}

describe('serif scope — H3 and body text are sans (§4.4 / §4.7)', () => {
  for (const [file, needle] of SANS_ONLY) {
    test(`${needle} in ${file} has rules and none use --font-serif`, () => {
      const bodies = rulesFor(file, needle);
      assert.ok(bodies.length > 0, `selector ${needle} no longer found in ${file}`);
      for (const b of bodies) assert.ok(!/--font-serif/.test(b), `${needle} { ${b.trim()} }`);
    });
  }
});

/** Declaration values of `prop` across every rule whose selector list contains exactly `needle` (empty if never set). */
function valuesOf(file: string, needle: string, prop: string): string[] {
  const src = stripComments(readFileSync(join(ROOT, file), 'utf-8'));
  const bodies: string[] = [];
  for (const m of src.matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
    // Exact selector only: `.faq-answer b` is a descendant, not the role itself.
    const sels = (m[1] ?? '').split(',').map((x) => x.trim().replace(/\s+/g, ' '));
    if (sels.includes(needle)) bodies.push(m[2] ?? '');
  }
  const re = new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;}]+)`, 'g');
  return bodies.flatMap((b) => [...b.matchAll(re)].map((m) => (m[1] ?? '').trim()));
}

describe('role pins — §4.7 roles, not just "not serif"', () => {
  test('.hub-subgroup-title leaves font/size/weight/colour to the canonical h3', () => {
    for (const prop of ['font-family', 'font-size', 'font-weight', 'color']) {
      assert.deepEqual(valuesOf('src/pages/_index.css', '.hub-subgroup-title', prop), [], prop);
    }
  });

  test('.ic-headline is the small-section role: --t-h3 sans 700 --ink', () => {
    const f = 'src/pages/rankings/_RankingsIndex.astro';
    assert.deepEqual(valuesOf(f, '.ic-headline', 'font-family'), ['var(--font-sans)']);
    assert.deepEqual(valuesOf(f, '.ic-headline', 'font-size'), ['var(--t-h3)']);
    assert.deepEqual(valuesOf(f, '.ic-headline', 'font-weight'), ['700']);
    assert.deepEqual(valuesOf(f, '.ic-headline', 'color'), ['var(--ink)']);
  });

  test('body-text roles on /<id> use --ink', () => {
    for (const sel of ['.v-line', '.faq-answer', '.ai-risk-detail .ai-rationale-long', 'section.context p']) {
      assert.deepEqual(valuesOf('src/pages/_id-css.ts', sel, 'color'), ['var(--ink)'], sel);
    }
  });

  test('.verdict-lede is the lead-text role: --t-h3 --ink-2', () => {
    assert.deepEqual(valuesOf('src/pages/_id-css.ts', '.verdict-lede', 'font-size'), ['var(--t-h3)']);
    assert.deepEqual(valuesOf('src/pages/_id-css.ts', '.verdict-lede', 'color'), ['var(--ink-2)']);
  });
});
