// Regression tests for genre-hub.ts — covers the audit's Critical #6.1:
// `renderHighlights` used to inject highlight strings unescaped into <li>,
// even though the strings interpolate data-driven values like the top
// occupation's `name_ja`. These tests pin the contract.
//
// We don't exercise loadAllDetails / buildGenreResult here — those are
// integration tests that need a real public/data.detail/ tree and are
// covered indirectly by `pnpm run build`.

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { renderHighlights, escapeHtml } from './genre-hub.js';

describe('genre-hub.escapeHtml', () => {
  test('escapes the 5 HTML-significant characters', () => {
    assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#x27;');
  });
});

describe('genre-hub.renderHighlights', () => {
  test('returns empty string for empty input', () => {
    assert.equal(renderHighlights([]), '');
  });

  test('escapes a stored-XSS payload smuggled in via occupation name', () => {
    // Simulates the audit's exact attack scenario: a malicious detail
    // JSON contributing a name_ja value to a highlight string.
    const payload = '1 位は「<script>alert(document.domain)</script>」（スコア 4.5）';
    const got = renderHighlights([payload]);
    assert.equal(got.includes('<script>'), false, 'must not pass <script> through unescaped');
    assert.match(got, /&lt;script&gt;alert\(document\.domain\)&lt;\/script&gt;/);
  });

  test('escapes <img onerror=…> attribute injection', () => {
    const payload = 'セクターは「<img src=x onerror=fetch(\'/x\')>」が 5 件と最多';
    const got = renderHighlights([payload]);
    assert.equal(got.includes('<img'), false);
    assert.match(got, /&lt;img/);
  });

  test('escapes ampersand-quote sequence', () => {
    const got = renderHighlights(['A & B "C"']);
    assert.match(got, /A &amp; B &quot;C&quot;/);
  });

  test('wraps non-empty items in highlights div + ul', () => {
    const got = renderHighlights(['safe text']);
    assert.match(got, /^<div class="highlights"><ul><li>safe text<\/li><\/ul><\/div>$/);
  });
});
