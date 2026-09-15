/**
 * design-tokens.test.ts — pin the Design v1.0 token values against the canon.
 *
 * The table below is transcribed independently from docs/Design.md §21.2. It
 * exists so a value cannot be changed in design-tokens.ts alone: editing the
 * module without editing this table fails the suite, and editing both is a
 * visible, reviewable act. Until `check-design-sync` lands (§19.1) this is the
 * only mechanical guard on the values.
 *
 * It also pins the two properties that make migration step 1 visually inert:
 * every declaration reaches the single `:root` in canonical-css.ts, and this
 * module declares no `:root` of its own (§18.4).
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  BREAKPOINTS,
  DESIGN_TOKENS,
  DESIGN_TOKENS_CSS,
  DESIGN_VERSION,
  MEDIA,
} from './design-tokens.js';
import { CANONICAL_CSS } from './canonical-css.js';

/** docs/Design.md §21.2 — transcribed by hand, on purpose. */
const CANON: Record<string, string> = {
  // §4.2 type scale
  '--t-display': 'clamp(32px, 6vw, 40px)',
  '--t-h1': '28px',
  '--t-h2': '22px',
  '--t-h3': '18px',
  '--t-body': '16px',
  '--t-sm': '14px',
  '--t-xs': '12px',
  // §4.6 line height
  '--lh-display': '1.15',
  '--lh-h1': '1.25',
  '--lh-h2': '1.35',
  '--lh-h3': '1.4',
  '--lh-h4': '1.5',
  '--lh-body': '1.75',
  '--lh-dense': '1.4',
  // §4.4 monospace
  '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
  // §2.1 AA-safe negative text
  '--red-text': '#ad4d32',
  // §8.1 spacing
  '--s-1': '4px',
  '--s-2': '8px',
  '--s-3': '12px',
  '--s-4': '16px',
  '--s-5': '24px',
  '--s-6': '32px',
  '--s-7': '48px',
  '--s-8': '64px',
  // §8.2 radius
  '--r-sm': '6px',
  '--r-md': '10px',
  '--r-lg': '16px',
  '--r-pill': '999px',
  // §8.3 shadow
  '--sh-card': '0 1px 0 rgba(0,0,0,0.03), 0 6px 18px rgba(120,80,30,0.04)',
  '--sh-raised': '0 1px 0 rgba(0,0,0,0.03), 0 12px 28px rgba(120,80,30,0.06)',
  '--sh-accent': '0 4px 14px rgba(217,107,61,0.28)',
  // §9.3 z-index
  '--z-base': '0',
  '--z-raised': '10',
  '--z-sticky': '100',
  '--z-overlay': '200',
  '--z-modal': '300',
  '--z-toast': '400',
  // §10 motion
  '--dur-fast': '120ms',
  '--dur-base': '200ms',
  '--ease': 'cubic-bezier(0.2, 0, 0, 1)',
};

describe('design-tokens — values match docs/Design.md §21.2', () => {
  test('version is declared as 1.0 (§20.2)', () => {
    assert.equal(DESIGN_VERSION, '1.0');
  });

  for (const [name, value] of Object.entries(CANON)) {
    test(`${name} is ${value}`, () => {
      assert.equal(DESIGN_TOKENS[name], value);
    });
  }

  test('no token exists outside the canon table', () => {
    assert.deepEqual(
      Object.keys(DESIGN_TOKENS).sort(),
      Object.keys(CANON).sort(),
    );
  });

  test('no step of the type scale drops below the 12px floor (§4.2)', () => {
    const fixed = Object.entries(DESIGN_TOKENS)
      .filter(([name]) => name.startsWith('--t-'))
      .map(([, value]) => value)
      .filter((value) => value.endsWith('px'));
    for (const value of fixed) {
      assert.ok(
        Number.parseFloat(value) >= 12,
        `${value} is below the 12px site-wide minimum`,
      );
    }
  });
});

describe('design-tokens — breakpoints (§9.2)', () => {
  test('three steps only, at 599 / 600 / 900', () => {
    assert.deepEqual(BREAKPOINTS, { sp: 599, tb: 600, pc: 900 });
  });

  test('tb closes exactly below pc, leaving no gap or overlap', () => {
    assert.equal(MEDIA.sp, '(max-width: 599px)');
    assert.equal(MEDIA.tb, '(min-width: 600px) and (max-width: 899px)');
    assert.equal(MEDIA.pc, '(min-width: 900px)');
  });
});

describe('design-tokens — emission into canonical-css', () => {
  test('declares no :root of its own (§18.4)', () => {
    assert.ok(!DESIGN_TOKENS_CSS.includes(':root'));
  });

  test('every token reaches the canonical :root exactly once', () => {
    for (const [name, value] of Object.entries(CANON)) {
      const decl = `${name}: ${value};`;
      const hits = CANONICAL_CSS.split(decl).length - 1;
      assert.equal(hits, 1, `${decl} appears ${hits}× in CANONICAL_CSS`);
    }
  });

  test('generated CSS carries the version comment (§20.2)', () => {
    assert.ok(CANONICAL_CSS.includes(`/* Design v${DESIGN_VERSION} */`));
  });

  test('step 1 is inert — no selector consumes a new token yet', () => {
    // Declarations live on the left of a `:` inside :root; a consumer would
    // appear as var(--token). Zero references is what makes this unit
    // revertible with no visual consequence (§21.2).
    for (const name of Object.keys(CANON)) {
      assert.ok(
        !CANONICAL_CSS.includes(`var(${name})`),
        `${name} is referenced — step 1 must stay reference-free`,
      );
    }
  });
});
