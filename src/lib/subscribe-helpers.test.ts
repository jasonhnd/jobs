/**
 * subscribe-helpers.test.ts — pin the /api/subscribe body-validation
 * contract. Mirror of feedback-helpers.test.ts's structure.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  parseSubscribeBody,
  resolveLang,
  EMAIL_RE,
  MAX_EMAIL_LEN,
  MAX_OCCUPATION_ID_LEN,
  MAX_SOURCE_LEN,
} from './subscribe-helpers.js';

describe('parseSubscribeBody — shape rejection', () => {
  test('null → invalid_body', () => {
    assert.deepEqual(parseSubscribeBody(null), { kind: 'error', code: 'invalid_body' });
  });

  test('array → invalid_body', () => {
    assert.deepEqual(parseSubscribeBody([]), { kind: 'error', code: 'invalid_body' });
  });

  test('scalar → invalid_body', () => {
    assert.deepEqual(
      parseSubscribeBody('hello' as unknown as object),
      { kind: 'error', code: 'invalid_body' },
    );
  });
});

describe('parseSubscribeBody — honeypot path', () => {
  test('honeypot filled → silent-success even with otherwise-valid body', () => {
    const r = parseSubscribeBody({
      email: 'real@example.com',
      htmlfield: 'spam',
    });
    assert.deepEqual(r, { kind: 'silent-success' });
  });

  test('honeypot empty → goes through normal validation', () => {
    const r = parseSubscribeBody({ email: 'real@example.com', htmlfield: '' });
    assert.equal(r.kind, 'ok');
  });
});

describe('parseSubscribeBody — email validation', () => {
  test('missing email → invalid_email', () => {
    assert.deepEqual(
      parseSubscribeBody({}),
      { kind: 'error', code: 'invalid_email' },
    );
  });

  test('empty-string email → invalid_email', () => {
    assert.deepEqual(
      parseSubscribeBody({ email: '' }),
      { kind: 'error', code: 'invalid_email' },
    );
  });

  test('email > MAX_EMAIL_LEN → invalid_email', () => {
    const long = 'x'.repeat(245) + '@example.com';
    assert.ok(long.length > MAX_EMAIL_LEN);
    assert.deepEqual(
      parseSubscribeBody({ email: long }),
      { kind: 'error', code: 'invalid_email' },
    );
  });

  test('malformed email (no @) → invalid_email', () => {
    assert.deepEqual(
      parseSubscribeBody({ email: 'no-at-sign' }),
      { kind: 'error', code: 'invalid_email' },
    );
  });

  test('valid email → ok with normalized (lowercased, trimmed)', () => {
    const r = parseSubscribeBody({ email: '  Foo@Example.COM  ' });
    assert.equal((r as { payload: { email: string } }).payload.email, 'foo@example.com');
  });
});

describe('parseSubscribeBody — lang resolution', () => {
  test('lang="en" → "en"', () => {
    const r = parseSubscribeBody({ email: 'a@b.com', lang: 'en' });
    assert.equal((r as { payload: { lang: string } }).payload.lang, 'en');
  });

  test('lang="ja" → "ja"', () => {
    const r = parseSubscribeBody({ email: 'a@b.com', lang: 'ja' });
    assert.equal((r as { payload: { lang: string } }).payload.lang, 'ja');
  });

  test('lang missing → defaults to "ja"', () => {
    const r = parseSubscribeBody({ email: 'a@b.com' });
    assert.equal((r as { payload: { lang: string } }).payload.lang, 'ja');
  });

  test('lang="zh" / unsupported → defaults to "ja"', () => {
    const r = parseSubscribeBody({ email: 'a@b.com', lang: 'zh' });
    assert.equal((r as { payload: { lang: string } }).payload.lang, 'ja');
  });
});

describe('parseSubscribeBody — content clipping', () => {
  test('occupation_id > MAX_OCCUPATION_ID_LEN → clipped', () => {
    const r = parseSubscribeBody({
      email: 'a@b.com',
      occupation_id: 'verylongoccupationidstring',
    });
    const got = (r as { payload: { occupation_id: string } }).payload.occupation_id;
    assert.equal(got.length, MAX_OCCUPATION_ID_LEN);
  });

  test('occupation_id missing → empty string (not null — matches subscribe.js shape)', () => {
    const r = parseSubscribeBody({ email: 'a@b.com' });
    assert.equal((r as { payload: { occupation_id: string } }).payload.occupation_id, '');
  });

  test('source > MAX_SOURCE_LEN → clipped', () => {
    const long = 'modal_t2_attribution_channel_extended_long_name';
    const r = parseSubscribeBody({ email: 'a@b.com', source: long });
    const got = (r as { payload: { source: string } }).payload.source;
    assert.equal(got.length, MAX_SOURCE_LEN);
  });

  test('source missing → "unknown" default', () => {
    const r = parseSubscribeBody({ email: 'a@b.com' });
    assert.equal((r as { payload: { source: string } }).payload.source, 'unknown');
  });
});

describe('parseSubscribeBody — happy path payload shape', () => {
  test('full happy-path body → exact normalized payload', () => {
    const r = parseSubscribeBody({
      email: 'TEST@example.com',
      lang: 'en',
      occupation_id: '156',
      source: 'modal_t2',
    });
    assert.deepEqual(r, {
      kind: 'ok',
      payload: {
        email: 'test@example.com',
        lang: 'en',
        occupation_id: '156',
        source: 'modal_t2',
      },
    });
  });
});

describe('resolveLang', () => {
  test('"en" → "en"', () => {
    assert.equal(resolveLang('en'), 'en');
  });

  test('"ja" → "ja"', () => {
    assert.equal(resolveLang('ja'), 'ja');
  });

  test('"zh" → "ja" (default)', () => {
    assert.equal(resolveLang('zh'), 'ja');
  });

  test('undefined → "ja"', () => {
    assert.equal(resolveLang(undefined), 'ja');
  });

  test('null → "ja"', () => {
    assert.equal(resolveLang(null as unknown as string), 'ja');
  });

  test('case-sensitive: "EN" → "ja"', () => {
    // resolveLang is strict equality to 'en' — uppercase doesn't count.
    // This pins behavior; if we ever want case-insensitive, the test
    // forces a deliberate change.
    assert.equal(resolveLang('EN'), 'ja');
  });
});

describe('EMAIL_RE — exported constant', () => {
  test('matches canonical addresses', () => {
    assert.ok(EMAIL_RE.test('foo@example.com'));
    assert.ok(EMAIL_RE.test('a@b.co'));
  });

  test('rejects malformed addresses', () => {
    assert.ok(!EMAIL_RE.test('no-at-sign'));
    assert.ok(!EMAIL_RE.test('@nodomain.com'));
    assert.ok(!EMAIL_RE.test('nodomain@'));
    assert.ok(!EMAIL_RE.test('two@@signs.com'));
  });
});
