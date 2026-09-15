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

});

/**
 * Design.md §4.3 / §4.4 / §4.6 — the canonical heading contract, landed by
 * design-1.3 (#526). design-1.2 asserted the opposite here (zero references,
 * which is what made the token unit visually inert); step 2 consumes them by
 * design, so the assertion moved from "nothing references a token" to "the
 * heading rules reference the right ones".
 */
describe('canonical heading rules consume the tokens (§4.3)', () => {
  /**
   * `html body h2 {` also appears inside the grouped font-family rule
   * (`html body h1,\nhtml body h2 {`), so match every block for the tag and
   * take the one that actually sizes it — the per-level rule.
   */
  const headingBlock = (tag: string): string => {
    const blocks = [
      ...CANONICAL_CSS.matchAll(
        new RegExp(`html body ${tag} \\{([^}]*)\\}`, 'g'),
      ),
    ].map((m) => m[1] ?? '');
    const sized = blocks.find((b) => b.includes('font-size'));
    assert.ok(sized, `no canonical sizing rule for ${tag}`);
    return sized;
  };

  test('h1 / h2 / h3 / h4 size and line-height come from tokens', () => {
    assert.match(headingBlock('h1'), /font-size: var\(--t-h1\)/);
    assert.match(headingBlock('h1'), /line-height: var\(--lh-h1\)/);
    assert.match(headingBlock('h2'), /font-size: var\(--t-h2\)/);
    assert.match(headingBlock('h2'), /line-height: var\(--lh-h2\)/);
    assert.match(headingBlock('h3'), /font-size: var\(--t-h3\)/);
    assert.match(headingBlock('h3'), /line-height: var\(--lh-h3\)/);
    assert.match(headingBlock('h4'), /font-size: var\(--t-body\)/);
    assert.match(headingBlock('h4'), /line-height: var\(--lh-h4\)/);
  });

  test('no raw font-size survives in the canonical heading rules', () => {
    for (const tag of ['h1', 'h2', 'h3', 'h4']) {
      assert.doesNotMatch(
        headingBlock(tag),
        /font-size: *[0-9.]/,
        `${tag} still carries a raw font-size`,
      );
    }
  });

  test('!important stays on h1/h2/h3 and is absent on h4 (§4.9.1)', () => {
    // It suppresses 66 class-scoped page heading rules and comes off in
    // design-1.9. h4 is new in design-1.3 and must never gain one (§4.9).
    for (const tag of ['h1', 'h2', 'h3']) {
      assert.match(headingBlock(tag), /font-size: var\(--t-[a-z0-9]+\) !important/);
    }
    assert.doesNotMatch(headingBlock('h4'), /!important/);
  });

  test('serif is h1/h2 only; h3/h4 are sans (§4.4)', () => {
    assert.match(CANONICAL_CSS, /html body h1,\nhtml body h2 \{\n  font-family: var\(--font-serif\);/);
    assert.match(CANONICAL_CSS, /html body h3,\nhtml body h4 \{\n  font-family: var\(--font-sans\);/);
  });

  test('no font-weight is declared on the serif levels (§4.5)', () => {
    // The shipped serif renders 400/500/600/700 identically (595.97px each),
    // so declaring a weight there is a claim the font cannot honour.
    assert.doesNotMatch(headingBlock('h1'), /font-weight/);
    assert.doesNotMatch(headingBlock('h2'), /font-weight/);
    assert.match(headingBlock('h3'), /font-weight: 700/);
    assert.match(headingBlock('h4'), /font-weight: 700/);
  });

  test('body paragraphs use the body token', () => {
    const p = CANONICAL_CSS.match(/\bhtml body p \{([^}]*)\}/)?.[1] ?? '';
    assert.match(p, /font-size: var\(--t-body\)/);
    assert.match(p, /line-height: var\(--lh-body\)/);
  });
});
