/**
 * format-paragraphs.test.ts — pin the text-to-<p> transform.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { formatParagraphs } from './format-paragraphs.js';

describe('formatParagraphs', () => {
  test('null returns empty SafeHtml', () => {
    assert.equal(formatParagraphs(null), '');
  });

  test('empty string returns empty SafeHtml', () => {
    assert.equal(formatParagraphs(''), '');
  });

  test('undefined returns empty SafeHtml', () => {
    assert.equal(formatParagraphs(undefined), '');
  });

  test('single-line text → single <p>', () => {
    assert.equal(formatParagraphs('看護師は専門職です。'), '<p>看護師は専門職です。</p>');
  });

  test('blank-line-separated paragraphs split into multiple <p>', () => {
    const out = formatParagraphs('段落1\n\n段落2\n\n段落3');
    const pCount = (out.match(/<p>/g) || []).length;
    assert.equal(pCount, 3);
    assert.ok(out.includes('<p>段落1</p>'));
    assert.ok(out.includes('<p>段落2</p>'));
    assert.ok(out.includes('<p>段落3</p>'));
  });

  test('full-width space at line start (MHLW jobtag style) splits paragraph', () => {
    // \n　 (full-width space) marks an MHLW prose indent. Should split.
    const out = formatParagraphs('段落1\n　段落2');
    const pCount = (out.match(/<p>/g) || []).length;
    assert.equal(pCount, 2);
  });

  test('CRLF normalized to LF (Windows / legacy data)', () => {
    const out = formatParagraphs('段落1\r\n\r\n段落2');
    const pCount = (out.match(/<p>/g) || []).length;
    assert.equal(pCount, 2);
  });

  test('paragraph chunks joined with newline + 8 spaces (template-literal indent parity)', () => {
    const out = formatParagraphs('a\n\nb');
    assert.equal(out, '<p>a</p>\n        <p>b</p>');
  });

  test('XSS payload in text escaped', () => {
    const out = formatParagraphs('<script>alert(1)</script>');
    assert.ok(!out.includes('<script>alert(1)</script>'));
    assert.ok(out.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  test('empty chunks (multiple blank lines) filtered out', () => {
    const out = formatParagraphs('a\n\n\n\n\nb');
    const pCount = (out.match(/<p>/g) || []).length;
    assert.equal(pCount, 2);
  });

  test('trimming: leading/trailing whitespace on chunks removed', () => {
    const out = formatParagraphs('  a  \n\n  b  ');
    assert.ok(out.includes('<p>a</p>'));
    assert.ok(out.includes('<p>b</p>'));
    assert.ok(!out.includes('<p>  a  </p>'));
  });

  test('whitespace-only input produces single <p> with trimmed empty (legacy parity)', () => {
    // The function's fallback path wraps the trimmed input in <p>.
    // For pure-whitespace input, that emits `<p></p>` — preserved.
    const out = formatParagraphs('   ');
    assert.equal(out, '<p></p>');
  });
});
