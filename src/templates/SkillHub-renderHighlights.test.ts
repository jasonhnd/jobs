// Regression tests for skills-hub.ts — same XSS contract as genre-hub.

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderHighlights, escapeHtml } from './SkillHub.js';

describe('skills-hub.escapeHtml', () => {
  test('escapes the 5 HTML-significant characters', () => {
    assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#x27;');
  });
});

describe('skills-hub.renderHighlights', () => {
  test('returns empty string for empty input', () => {
    assert.equal(renderHighlights([]), '');
  });

  test('escapes a stored-XSS payload smuggled via top occupation name', () => {
    const payload = '1 位は「<script>alert(1)</script>」（スキル 4.5）';
    const got = renderHighlights([payload]);
    assert.equal(got.includes('<script>'), false);
    assert.match(got, /&lt;script&gt;/);
  });
});
