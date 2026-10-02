import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { heatBg, radarAxis, radarPoints, CANONICAL_DOC_CSS } from './doc.js';
import { CANONICAL_DETAIL_CSS } from './detail.js';
import { CANONICAL_HUB_CSS } from './hub.js';
import { CANONICAL_SECTOR_CSS } from './sector.js';
import { CANONICAL_STATIC_CSS } from './static.js';
import * as canonical from './index.js';

describe('canonical document helpers', () => {
  test('heat backgrounds include all band boundaries and invert only moat direction', () => {
    for (const [value, band] of [[-1, 0], [0, 0], [1.99, 0], [2, 1], [3.99, 1], [4, 2], [5.99, 2], [6, 3], [7.99, 3], [8, 4], [10, 4], [11, 4]] as const) {
      assert.equal(heatBg(value, 'up'), `var(--risk-soft-${band})`);
      assert.equal(heatBg(value, 'moat'), `var(--risk-soft-${4 - band})`);
      assert.equal(heatBg(value, 'friction'), `color-mix(in oklab, var(--risk-soft-2) ${30 + band * 16}%, var(--paper))`);
    }
  });

  test('radar points start at the top, run clockwise, and format one decimal', () => {
    assert.equal(radarPoints([10, 5, 0, 2.5], 10, 20, 10), '10.0,10.0 15.0,20.0 10.0,20.0 7.5,20.0');
    assert.equal(radarPoints([-5, 15, 10, 5], 10, 20, 10), '10.0,20.0 20.0,20.0 10.0,30.0 5.0,20.0');
    assert.equal(radarPoints([], 10, 20, 10), '');
    assert.equal(radarPoints([10], 10, 20, 10), '10.0,10.0');
    assert.equal(radarPoints([10, 10, 10], 10, 20, 10), '10.0,10.0 18.7,25.0 1.3,25.0');
    assert.equal(radarPoints([10, 5], 10, 20, 0), '10.0,20.0 10.0,20.0');
  });

  test('radar axes reach the full-radius cardinal and non-cardinal endpoints', () => {
    for (const [i, x, y] of [[0, 10, 10], [1, 20, 20], [2, 10, 30], [3, 0, 20]] as const) {
      const actual = radarAxis(i, 4, 10, 20, 10);
      assert.ok(Math.abs(actual.x - x) < 1e-12);
      assert.ok(Math.abs(actual.y - y) < 1e-12);
    }
    const triangle = radarAxis(1, 3, 10, 20, 10);
    assert.ok(Math.abs(triangle.x - (10 + 5 * Math.sqrt(3))) < 1e-12);
    assert.ok(Math.abs(triangle.y - 25) < 1e-12);
    assert.deepEqual(radarAxis(0, 4, 10, 20, 0), { x: 10, y: 20 });
  });
});

describe('canonical page-class CSS contracts', () => {
  test('barrel exposes the four page-class styles without changing their values', () => {
    assert.deepEqual({ ...canonical }, { CANONICAL_DETAIL_CSS, CANONICAL_HUB_CSS, CANONICAL_SECTOR_CSS, CANONICAL_STATIC_CSS });
  });

  for (const [name, css] of Object.entries({
    doc: CANONICAL_DOC_CSS, detail: CANONICAL_DETAIL_CSS, hub: CANONICAL_HUB_CSS,
    sector: CANONICAL_SECTOR_CSS, static: CANONICAL_STATIC_CSS,
  })) {
    test(`${name} shares canonical width, gutter, fonts, and externally defined tokens`, () => {
      const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
      assert.match(rules, /#wrapper\{[^}]*max-width:var\(--content-max\)[^}]*padding:[^}]*var\(--gutter\)/);
      assert.match(rules, /font-family:var\(--font-sans\)/);
      assert.doesNotMatch(rules, /:root\s*\{/);
      assert.doesNotMatch(rules, /font-size:[^;}]*!important/);
      assert.match(rules, /h1\{/);
      assert.match(rules, /h2\{/);
      assert.match(rules, /@media[^}]*#wrapper\{[^}]*var\(--gutter\)/);
    });
  }

  test('hub, sector, and static hero rules stay scoped away from site chrome', () => {
    for (const css of [CANONICAL_HUB_CSS, CANONICAL_SECTOR_CSS, CANONICAL_STATIC_CSS]) {
      const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
      assert.match(rules, /:where\(main\) header\{/);
      assert.doesNotMatch(rules, /(?:^|\})\s*header\s*\{/);
    }
    assert.match(CANONICAL_SECTOR_CSS, /font-feature-settings:"palt"/);
    assert.match(CANONICAL_SECTOR_CSS, /h1\{flex-direction:column;align-items:flex-start/);
    for (const css of [CANONICAL_DETAIL_CSS, CANONICAL_STATIC_CSS]) {
      assert.match(css, /\.theme-toggle\{display:none !important\}/);
    }
    assert.match(CANONICAL_DOC_CSS, /\.radar \.poly\{[^}]*var\(--accent\)/);
  });
});
