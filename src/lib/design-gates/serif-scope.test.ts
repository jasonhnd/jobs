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
  ['src/pages/rankings/index.astro', '.ic-headline'],
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
      for (const b of bodies) assert.ok(!/font-serif|serif/.test(b), `${needle} { ${b.trim()} }`);
    });
  }
});
