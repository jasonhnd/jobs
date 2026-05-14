// Regression tests for interests.ts — same XSS contract as genre-hub /
// skills-hub. Highlight strings interpolate occupation names and the
// dominant sector pulled from a Map; both are data-driven.

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderHighlights, escapeHtml } from './InterestHub.js';

describe('interests.escapeHtml', () => {
  test('escapes the 5 HTML-significant characters', () => {
    assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#x27;');
  });
});

describe('interests.renderHighlights', () => {
  test('returns empty string for empty input', () => {
    assert.equal(renderHighlights([]), '');
  });

  test('escapes a stored-XSS payload smuggled via sector breakdown', () => {
    const payload = 'セクターは「<svg onload=alert(1)>」が 5 件と最多';
    const got = renderHighlights([payload]);
    assert.equal(got.includes('<svg'), false);
    assert.match(got, /&lt;svg/);
  });
});
