/**
 * safe-html.test.ts — pin the Layer 4 escape contract.
 *
 * The branded SafeHtml type can be bypassed at compile time (TS brand
 * isn't a runtime check), so the real safety guarantee lives in:
 *   1) html`...` always escapes interpolated string values
 *   2) escapeHtml() covers all 5 dangerous characters
 *   3) attribute helper htmlAttr() returns quoted + escaped output
 *   4) escape hatches (unsafeReviewedHtml / trustedCss) are visibly
 *      named so a code reviewer can grep them
 *
 * These tests pin each of those.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  escapeHtml,
  html,
  htmlList,
  joinSafeHtml,
  trustedCss,
  unsafeReviewedHtml,
  type SafeHtml,
} from './safe-html.js';

describe('safe-html — escape primitive', () => {
  test('escapes all 5 HTML-significant chars', () => {
    assert.equal(escapeHtml('&'), '&amp;');
    assert.equal(escapeHtml('<'), '&lt;');
    assert.equal(escapeHtml('>'), '&gt;');
    assert.equal(escapeHtml('"'), '&quot;');
    assert.equal(escapeHtml("'"), '&#x27;');
  });

  test('escapes a stored-XSS payload', () => {
    const xss = '<script>alert("oops")</script>';
    const out = escapeHtml(xss);
    assert.equal(out, '&lt;script&gt;alert(&quot;oops&quot;)&lt;/script&gt;');
    // No raw `<script>` survives.
    assert.ok(!out.includes('<script>'), 'raw <script> must not survive');
  });

  test('passes plain text through unchanged', () => {
    assert.equal(escapeHtml('日本の職業'), '日本の職業');
    assert.equal(escapeHtml('  spaces  '), '  spaces  ');
    assert.equal(escapeHtml(''), '');
  });

  test('escapes all occurrences (not just the first)', () => {
    assert.equal(escapeHtml('<<&&>>'), '&lt;&lt;&amp;&amp;&gt;&gt;');
  });
});

describe('safe-html — html`` template tag', () => {
  test('escapes interpolated string values', () => {
    const name = '<script>alert(1)</script>';
    const out = html`<p>${name}</p>`;
    assert.equal(out, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  test('html`` ALWAYS escapes interpolated strings, including SafeHtml (brand is type-only)', () => {
    // The TypeScript brand isn't visible at runtime, so html`` can't
    // tell a SafeHtml value apart from any other string. Safety-by-
    // default means it escapes every interpolated string. To compose
    // nested SafeHtml fragments without double-escaping, use the
    // dedicated joinSafeHtml / htmlList helpers (next describe block).
    const inner = html`<em>${'bold'}</em>`;
    const outer = html`<p>${inner}</p>`;
    assert.equal(outer, '<p>&lt;em&gt;bold&lt;/em&gt;</p>');
  });

  test('renders numbers and booleans as their string form', () => {
    assert.equal(html`count=${42}`, 'count=42');
    assert.equal(html`flag=${true}`, 'flag=true');
  });

  test('null and undefined render as empty string', () => {
    assert.equal(html`a${null}b${undefined}c`, 'abc');
  });

  test('arrays render with element-by-element escaping', () => {
    const items = ['<a>', '<b>'];
    assert.equal(html`x${items}y`, 'x&lt;a&gt;&lt;b&gt;y');
  });

  test('arrays of strings escape element-by-element inside html``', () => {
    // Note: arrays of SafeHtml also get re-escaped when fed to html``
    // (brand is type-only). Use joinSafeHtml to compose them safely.
    const escaped = html`<ul>${['<a>', '<b>']}</ul>`;
    assert.equal(escaped, '<ul>&lt;a&gt;&lt;b&gt;</ul>');
  });

  test('survives the canonical "<><\\"\'&>" payload', () => {
    const out = html`<p>${`<>"'&`}</p>`;
    assert.equal(out, '<p>&lt;&gt;&quot;&#x27;&amp;</p>');
  });
});

describe('safe-html — attribute values escape via html`` directly', () => {
  test('write quotes in the template literal — html`` escapes the interpolation', () => {
    const url = '/path?a=b&c=d';
    const out = html`<a href="${url}">link</a>`;
    assert.equal(out, '<a href="/path?a=b&amp;c=d">link</a>');
  });

  test('attribute injection (a quote in the value) is escaped', () => {
    const dangerous = 'a"><script>alert(1)</script><a href="x';
    const out = html`<a href="${dangerous}">x</a>`;
    assert.equal(
      out,
      '<a href="a&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;a href=&quot;x">x</a>',
    );
    // No raw </script> token escapes.
    assert.ok(!out.includes('<script>'), 'attribute-context injection must not break out');
  });
});

describe('safe-html — joinSafeHtml / htmlList (composition without re-escape)', () => {
  test('joinSafeHtml concatenates SafeHtml fragments with empty separator by default', () => {
    const a = html`<a/>`;
    const b = html`<b/>`;
    assert.equal(joinSafeHtml([a, b]), '<a/><b/>');
  });

  test('joinSafeHtml accepts a SafeHtml separator', () => {
    const a = html`<a/>`;
    const b = html`<b/>`;
    const sep = ', ' as SafeHtml;
    assert.equal(joinSafeHtml([a, b], sep), '<a/>, <b/>');
  });

  test('htmlList builds a <ul> from items, items NOT re-escaped after itemTpl', () => {
    const out = htmlList('numbers', [1, 2, 3], (n) => html`<li>${n}</li>`);
    assert.equal(out, '<ul class="numbers"><li>1</li><li>2</li><li>3</li></ul>');
  });

  test('htmlList returns empty SafeHtml for empty items (no empty <ul>)', () => {
    const out = htmlList<number>('numbers', [], (n) => html`<li>${n}</li>`);
    assert.equal(out, '');
  });

  test('htmlList itemTpl is responsible for escaping per-item user input', () => {
    // The user input is escaped INSIDE itemTpl by the html`` tag.
    const out = htmlList('xss', ['<x>'], (s) => html`<li>${s}</li>`);
    assert.equal(out, '<ul class="xss"><li>&lt;x&gt;</li></ul>');
  });

  test('htmlList escapes the className parameter (defense vs config drift)', () => {
    const out = htmlList('"><script>', ['x'], (s) => html`<li>${s}</li>`);
    assert.equal(out, '<ul class="&quot;&gt;&lt;script&gt;"><li>x</li></ul>');
  });
});

describe('safe-html — escape hatches', () => {
  test('unsafeReviewedHtml passes through unchanged (NO escaping)', () => {
    const raw = '<div>already-trusted</div>';
    assert.equal(
      unsafeReviewedHtml(raw, 'rendered by genre-hub.ts which audits its own escape'),
      raw,
    );
  });

  test('trustedCss passes CSS through (CSS escape rules differ from HTML)', () => {
    const css = '.a{color:#fff}';
    assert.equal(trustedCss(css), css);
  });
});
