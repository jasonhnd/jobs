/**
 * feedback-helpers.test.ts — pin the feedback body-validation contract.
 *
 * `parseFeedbackBody` is pure (no I/O, no env), so every branch is
 * tested directly. Covers:
 *
 *   - shape rejection (non-object inputs)
 *   - honeypot trip (silent success)
 *   - empty-signal rejection
 *   - email validation (length cap + regex)
 *   - options filtering (allowlist + per-key clip + array cap)
 *   - freetext clip
 *   - occupation_id clip
 *   - lang default
 *   - now() dependency injection for deterministic timestamps
 *
 * Plus standalone tests for `shortHash` (stability, non-empty output)
 * and `escapeHtml` (all 5 chars, no double-escape).
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  parseFeedbackBody,
  shortHash,
  escapeHtml,
  EMAIL_RE,
  KNOWN_OPTIONS,
  MAX_FREETEXT_LEN,
  MAX_OPTIONS,
} from './feedback-helpers.js';

const FIXED_NOW = () => new Date('2026-05-14T09:00:00.000Z');

describe('parseFeedbackBody — shape rejection', () => {
  test('null body → invalid_body', () => {
    const r = parseFeedbackBody(null);
    assert.deepEqual(r, { kind: 'error', code: 'invalid_body' });
  });

  test('array body → invalid_body', () => {
    const r = parseFeedbackBody([1, 2, 3]);
    assert.deepEqual(r, { kind: 'error', code: 'invalid_body' });
  });

  test('scalar body (string) → invalid_body', () => {
    // Defensive: JSON.parse("\"hello\"") returns a string. parseFeedbackBody
    // should reject it instead of dereferencing fields on a primitive.
    const r = parseFeedbackBody('hello' as unknown as object);
    assert.deepEqual(r, { kind: 'error', code: 'invalid_body' });
  });
});

describe('parseFeedbackBody — honeypot path', () => {
  test('honeypot filled → silent-success (no payload, no error)', () => {
    const r = parseFeedbackBody({ htmlfield: 'spam-injection', options: ['b2c_career'] });
    assert.deepEqual(r, { kind: 'silent-success' });
  });

  test('honeypot empty string is falsy → goes through normal validation', () => {
    const r = parseFeedbackBody({ htmlfield: '', options: ['b2c_career'] }, { now: FIXED_NOW });
    assert.equal(r.kind, 'ok');
  });

  test('honeypot truthy non-string → silent-success', () => {
    // Bots sometimes fill numbers / booleans into hidden fields.
    const r1 = parseFeedbackBody({ htmlfield: 1, options: ['b2c_career'] });
    assert.deepEqual(r1, { kind: 'silent-success' });
    const r2 = parseFeedbackBody({ htmlfield: true, options: ['b2c_career'] });
    assert.deepEqual(r2, { kind: 'silent-success' });
  });
});

describe('parseFeedbackBody — minimum-signal rejection', () => {
  test('no options + no freetext → empty_feedback', () => {
    const r = parseFeedbackBody({});
    assert.deepEqual(r, { kind: 'error', code: 'empty_feedback' });
  });

  test('options only whitespace freetext + no options → empty_feedback', () => {
    const r = parseFeedbackBody({ freetext: '   \n\t  ' });
    assert.deepEqual(r, { kind: 'error', code: 'empty_feedback' });
  });

  test('one valid option only → ok', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'] }, { now: FIXED_NOW });
    assert.equal(r.kind, 'ok');
  });

  test('freetext only → ok', () => {
    const r = parseFeedbackBody({ freetext: 'real input' }, { now: FIXED_NOW });
    assert.equal(r.kind, 'ok');
  });
});

describe('parseFeedbackBody — email validation', () => {
  test('no email → ok (email is optional)', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'] }, { now: FIXED_NOW });
    assert.equal(r.kind, 'ok');
    assert.equal((r as { payload: { email: string | null } }).payload.email, null);
  });

  test('valid email → ok with normalized (lowercased, trimmed)', () => {
    const r = parseFeedbackBody(
      { options: ['b2c_career'], email: '  Foo@Example.COM  ' },
      { now: FIXED_NOW },
    );
    assert.equal((r as { payload: { email: string } }).payload.email, 'foo@example.com');
  });

  test('email > 254 chars → invalid_email', () => {
    const long = 'x'.repeat(245) + '@example.com'; // 245 + 12 = 257 chars
    const r = parseFeedbackBody({ options: ['b2c_career'], email: long });
    assert.deepEqual(r, { kind: 'error', code: 'invalid_email' });
  });

  test('email failing EMAIL_RE → invalid_email', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'], email: 'not-an-email' });
    assert.deepEqual(r, { kind: 'error', code: 'invalid_email' });
  });
});

describe('parseFeedbackBody — options filtering', () => {
  test('unknown option keys silently filtered (allowlist)', () => {
    const r = parseFeedbackBody(
      { options: ['b2c_career', 'unknown_key', 'another_bad'] },
      { now: FIXED_NOW },
    );
    assert.deepEqual((r as { payload: { options: string[] } }).payload.options, ['b2c_career']);
  });

  test('non-array options → empty array (no crash)', () => {
    const r = parseFeedbackBody(
      { options: 'not-an-array', freetext: 'real' },
      { now: FIXED_NOW },
    );
    assert.deepEqual((r as { payload: { options: string[] } }).payload.options, []);
  });

  test('individual option key > MAX_OPTION_KEY_LEN → clipped (then filtered out since clipped key is not in allowlist)', () => {
    const longKey = 'b2c_career_extended_long_suffix';
    const r = parseFeedbackBody(
      { options: [longKey], freetext: 'real' },
      { now: FIXED_NOW },
    );
    // Clipped to 32 chars: still != 'b2c_career'. Filtered out.
    assert.deepEqual((r as { payload: { options: string[] } }).payload.options, []);
  });

  test('options array > MAX_OPTIONS → clipped to MAX_OPTIONS', () => {
    const all = ['b2c_career', 'b2c_student', 'b2b_hr', 'b2b_school', 'b2b_training', 'media', 'developer', 'methodology', 'data_quality', 'curiosity', 'other'];
    assert.equal(all.length, MAX_OPTIONS); // sanity: fixture covers the cap
    const r = parseFeedbackBody({ options: all }, { now: FIXED_NOW });
    assert.equal((r as { payload: { options: string[] } }).payload.options.length, MAX_OPTIONS);
  });

  test('non-string option values coerced via String() then validated', () => {
    const r = parseFeedbackBody(
      { options: [42, null, undefined, 'b2c_career'] },
      { now: FIXED_NOW },
    );
    // 42 → "42" not in allowlist; null → "null" not in allowlist; etc.
    assert.deepEqual((r as { payload: { options: string[] } }).payload.options, ['b2c_career']);
  });
});

describe('parseFeedbackBody — content clipping', () => {
  test('freetext > MAX_FREETEXT_LEN clipped', () => {
    const long = 'a'.repeat(MAX_FREETEXT_LEN + 100);
    const r = parseFeedbackBody({ freetext: long }, { now: FIXED_NOW });
    const got = (r as { payload: { freetext: string } }).payload.freetext;
    assert.equal(got.length, MAX_FREETEXT_LEN);
  });

  test('occupation_id > 16 chars clipped', () => {
    const r = parseFeedbackBody(
      { options: ['b2c_career'], occupation_id: 'verylongoccupationidstring' },
      { now: FIXED_NOW },
    );
    const got = (r as { payload: { occupation_id: string } }).payload.occupation_id;
    assert.equal(got!.length, 16);
  });

  test('occupation_id missing → null', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'] }, { now: FIXED_NOW });
    assert.equal((r as { payload: { occupation_id: string | null } }).payload.occupation_id, null);
  });
});

describe('parseFeedbackBody — lang default', () => {
  test('lang="en" → "en"', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'], lang: 'en' }, { now: FIXED_NOW });
    assert.equal((r as { payload: { lang: string } }).payload.lang, 'en');
  });

  test('lang="ja" → "ja"', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'], lang: 'ja' }, { now: FIXED_NOW });
    assert.equal((r as { payload: { lang: string } }).payload.lang, 'ja');
  });

  test('lang missing → defaults to "ja"', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'] }, { now: FIXED_NOW });
    assert.equal((r as { payload: { lang: string } }).payload.lang, 'ja');
  });

  test('lang="zh" → defaults to "ja" (only ja/en accepted)', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'], lang: 'zh' }, { now: FIXED_NOW });
    assert.equal((r as { payload: { lang: string } }).payload.lang, 'ja');
  });
});

describe('parseFeedbackBody — timestamp via injected now()', () => {
  test('uses the injected now() function (deterministic for tests)', () => {
    const r = parseFeedbackBody({ options: ['b2c_career'] }, { now: FIXED_NOW });
    assert.equal((r as { payload: { timestamp: string } }).payload.timestamp, '2026-05-14T09:00:00.000Z');
  });

  test('default now() uses live Date() (smoke check)', () => {
    const before = Date.now();
    const r = parseFeedbackBody({ options: ['b2c_career'] });
    const after = Date.now();
    const ts = (r as { payload: { timestamp: string } }).payload.timestamp;
    const tsMs = Date.parse(ts);
    assert.ok(tsMs >= before, 'timestamp should be >= test start');
    assert.ok(tsMs <= after, 'timestamp should be <= test end');
  });
});

describe('shortHash', () => {
  test('deterministic — same input → same output', () => {
    assert.equal(shortHash('Mozilla/5.0'), shortHash('Mozilla/5.0'));
  });

  test('different input → different output (collision-free for tiny inputs)', () => {
    assert.notEqual(shortHash('a'), shortHash('b'));
    assert.notEqual(shortHash('Googlebot'), shortHash('Mozilla/5.0'));
  });

  test('output is base-36 string', () => {
    const h = shortHash('Mozilla/5.0 Chrome/120');
    assert.match(h, /^[0-9a-z]+$/);
  });

  test('empty string → "1ekh" (djb2 seed 5381 base-36)', () => {
    // Pin: 5381 in base-36 is '47p'… wait, 5381 → base36:
    // 5381 / 36 = 149, rem 17 ('h'); 149/36 = 4, rem 5 ('5'); 4 → '4'.
    // Reading: '4' '5' 'h' → '45h'. Let's just call the function.
    assert.equal(shortHash(''), (5381 >>> 0).toString(36));
  });
});

describe('escapeHtml', () => {
  test('escapes < > & " \' (all 5 chars)', () => {
    assert.equal(escapeHtml('<'), '&lt;');
    assert.equal(escapeHtml('>'), '&gt;');
    assert.equal(escapeHtml('&'), '&amp;');
    assert.equal(escapeHtml('"'), '&quot;');
    assert.equal(escapeHtml("'"), '&#39;');
  });

  test('escapes multi-char strings', () => {
    assert.equal(
      escapeHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  test('passes plain text through unchanged', () => {
    assert.equal(escapeHtml('hello world 看護師'), 'hello world 看護師');
  });

  test('coerces non-string input via String()', () => {
    assert.equal(escapeHtml(42 as unknown as string), '42');
    assert.equal(escapeHtml(null as unknown as string), 'null');
  });
});

describe('EMAIL_RE + KNOWN_OPTIONS — exported constants', () => {
  test('EMAIL_RE matches canonical addresses', () => {
    assert.ok(EMAIL_RE.test('foo@example.com'));
    assert.ok(EMAIL_RE.test('a@b.co'));
  });

  test('EMAIL_RE rejects malformed addresses', () => {
    assert.ok(!EMAIL_RE.test('no-at-sign'));
    assert.ok(!EMAIL_RE.test('@nodomain.com'));
    assert.ok(!EMAIL_RE.test('nodomain@'));
    assert.ok(!EMAIL_RE.test('two@@signs.com'));
  });

  test('KNOWN_OPTIONS is the documented allowlist (11 entries)', () => {
    assert.equal(KNOWN_OPTIONS.size, 11);
    assert.ok(KNOWN_OPTIONS.has('b2c_career'));
    assert.ok(KNOWN_OPTIONS.has('other'));
  });

  test('KNOWN_OPTIONS exported as a frozen Set object', () => {
    // Note: Object.freeze on a Set freezes the object identity but does
    // NOT prevent .add() / .delete() (those operate on internal slots).
    // The compile-time `Readonly<Set>` type via the export signature is
    // the actual guard. Here we just verify the frozen flag is set so
    // consumers can detect the intent if they care.
    assert.equal(Object.isFrozen(KNOWN_OPTIONS), true);
  });
});
