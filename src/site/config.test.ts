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
  assert.equal(siteConfig.siteName, '未来の仕事');
});

test('siteConfig.htmlLang / ogLocale stay consistent', () => {
  assert.equal(siteConfig.htmlLang, 'ja');
  assert.equal(siteConfig.ogLocale, 'ja_JP');
});

test('siteConfig.defaultOgImage points at the home OG endpoint', () => {
  assert.equal(siteConfig.defaultOgImage, 'https://mirai-shigoto.com/api/og?page=home');
});

test('the site has one name — no breadcrumb root, schema name or og:site_name may use the tagline (owner, 2026-09-21)', async () => {
  // 「日本の職業 AI 影響マップ」 is the tagline (home kicker, README, privacy footer
  // line). It was also the og:site_name and the breadcrumb root on 578 pages
  // while the nav, 826 <title>s and the WebSite schema said 「未来の仕事」.
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p); continue; }
      if (/\.(ts|astro)$/.test(e) && !/\.test\.ts$/.test(e)) files.push(p);
    }
  };
  walk('src');
  const offenders: string[] = [];
  for (const f of files) {
    // comments may mention the tagline; only code and markup are name slots
    const src = readFileSync(f, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const re of [/name['"]?\s*:\s*['"]日本の職業 AI 影響マップ['"]/g, /rel="up"[^>]*>日本の職業 AI 影響マップ</g, /href="\/"\s*>日本の職業 AI 影響マップ</g, /site_name.*日本の職業 AI 影響マップ/g, /Mirai-Shigoto['"`]/g]) {
      if (re.test(src)) offenders.push(`${f}: ${re.source}`);
    }
  }
  assert.deepEqual(offenders, [], 'use siteConfig.siteName (未来の仕事) for anything that names the site');
});
