/**
 * config.test.ts — pin the canonical site-identity values.
 *
 * These constants are referenced by SEO baseline + JSON-LD verifier
 * + analytics config check. A silent edit here (e.g. AI fixing
 * "branding" without realising it's load-bearing) would ripple
 * through every page's canonical / og:url / Schema.org JSON-LD.
 * The test makes the invariant explicit.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { siteConfig } from './config.js';

test('siteConfig.origin pins production origin', () => {
  assert.equal(siteConfig.origin, 'https://mirai-shigoto.com');
  assert.ok(!siteConfig.origin.endsWith('/'), 'origin must not have trailing slash');
});

test('siteConfig.siteName pins Japanese hub title', () => {
  assert.equal(siteConfig.siteName, '日本の職業 AI 影響マップ');
});

test('siteConfig.htmlLang / ogLocale stay consistent', () => {
  assert.equal(siteConfig.htmlLang, 'ja');
  assert.equal(siteConfig.ogLocale, 'ja_JP');
});

test('siteConfig.defaultOgImage points at the home OG endpoint', () => {
  assert.equal(siteConfig.defaultOgImage, 'https://mirai-shigoto.com/api/og?page=home');
});
