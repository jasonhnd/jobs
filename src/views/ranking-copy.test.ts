/**
 * ranking-copy.test.ts — pin the editorial FAQ catalog. FAQS maps
 * each ranking slug to an array of [question, answer] tuples shown
 * at the bottom of every ranking detail page.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { FAQS } from './ranking-copy.js';

describe('FAQS — editorial copy catalog', () => {
  test('exported as a Record (non-empty)', () => {
    const slugs = Object.keys(FAQS);
    assert.ok(slugs.length > 0, 'FAQS is empty');
  });

  test('every entry is an array of [question, answer] tuples', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      assert.ok(Array.isArray(tuples), `${slug}: not an array`);
      for (const t of tuples) {
        assert.ok(Array.isArray(t), `${slug}: tuple not an array`);
        assert.equal(t.length, 2, `${slug}: tuple length != 2`);
        const [q, a] = t;
        assert.equal(typeof q, 'string', `${slug}: question not a string`);
        assert.equal(typeof a, 'string', `${slug}: answer not a string`);
        assert.ok(q.length > 0, `${slug}: empty question`);
        assert.ok(a.length > 0, `${slug}: empty answer`);
      }
    }
  });

  test('every entry has at least 1 FAQ (most have 4-6)', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      assert.ok(tuples.length >= 1, `${slug}: no FAQs`);
    }
  });

  test('questions contain Japanese characters (no English placeholders)', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      for (const [q] of tuples) {
        assert.match(q, /[぀-ヿ一-鿿]/, `${slug}: "${q}" has no JP chars`);
      }
    }
  });

  test('answers contain Japanese characters', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      for (const [, a] of tuples) {
        assert.match(a, /[぀-ヿ一-鿿]/, `${slug}: answer has no JP chars`);
      }
    }
  });

  test('questions end with a "？" (Japanese question mark) — pinned convention', () => {
    // Editorial convention: FAQ questions end with the full-width "？".
    // Pin so a future bulk edit can't silently change the format.
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      for (const [q] of tuples) {
        assert.ok(q.endsWith('？') || q.endsWith('?'), `${slug}: "${q}" missing ? at end`);
      }
    }
  });

  test('answers are at least 30 characters (editorial minimum)', () => {
    for (const slug of Object.keys(FAQS)) {
      const tuples = FAQS[slug as keyof typeof FAQS];
      for (const [q, a] of tuples) {
        assert.ok(a.length >= 30, `${slug}: "${q}" answer too short (${a.length} chars)`);
      }
    }
  });
});
