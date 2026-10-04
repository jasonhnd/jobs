/**
 * middleware-helpers.test.ts — pin the GA4 server-side measurement
 * decision logic. The helper exports are pure or deterministic
 * functions, so tests run without spinning up the Edge runtime.
 */

import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  landingFamily,
  isGoogleHost,
  classifyGeoReferral,
  shouldWithholdFromIndex,
} from './geo-referral.js';

describe('classifyGeoReferral — GEO referral baseline classification', () => {
  const pageUrl = (pathname: string) => new URL(`https://mirai-shigoto.com${pathname}`);

  test('known AI engines classify into the ai_engine bucket', () => {
    const cases = [
      ['https://perplexity.ai/search?q=jobs', 'perplexity'],
      ['https://chatgpt.com/c/abc', 'chatgpt_search'],
      ['https://chat.openai.com/c/abc', 'chatgpt_search'],
      ['https://gemini.google.com/app/abc', 'gemini'],
      ['https://bard.google.com/chat', 'gemini'],
      ['https://copilot.microsoft.com/chats/abc', 'bing_copilot'],
      ['https://bing.com/chat?q=jobs', 'bing_copilot'],
      ['https://claude.ai/chat/abc', 'claude'],
      ['https://you.com/search?q=jobs', 'you_com'],
      ['https://phind.com/search?q=jobs', 'phind_com'],
      ['https://komo.ai/search?q=jobs', 'komo_ai'],
      ['https://andisearch.com/?q=jobs', 'andisearch_com'],
    ] as const;

    for (const [referer, engine] of cases) {
      const result = classifyGeoReferral(pageUrl('/156'), referer);
      assert.equal(result.geo_referrer_engine, engine, referer);
      assert.equal(result.geo_referrer_bucket, 'ai_engine', referer);
      assert.equal(result.geo_citation_candidate, 'true', referer);
    }
  });

  test('Google search hosts classify as search, but Google product subdomains do not', () => {
    assert.equal(isGoogleHost('google.com'), true);
    assert.equal(isGoogleHost('google.co.jp'), true);
    assert.equal(isGoogleHost('mail.google.com'), false);
    assert.equal(isGoogleHost('docs.google.com'), false);
    assert.equal(isGoogleHost('drive.google.com'), false);

    for (const referer of [
      'https://google.com/search?q=jobs',
      'https://google.co.jp/search?q=jobs',
      'https://www.google.com/search?q=jobs',
    ]) {
      const result = classifyGeoReferral(pageUrl('/answers/ai-risk'), referer);
      assert.equal(result.geo_referrer_engine, 'google_search', referer);
      assert.equal(result.geo_referrer_bucket, 'search', referer);
      assert.equal(result.geo_citation_candidate, 'true', referer);
    }

    for (const referer of [
      'https://mail.google.com/mail/u/0/#inbox',
      'https://docs.google.com/document/d/abc/edit',
      'https://drive.google.com/file/d/abc/view',
    ]) {
      const result = classifyGeoReferral(pageUrl('/answers/ai-risk'), referer);
      assert.equal(result.geo_referrer_engine, 'other_external', referer);
      assert.equal(result.geo_referrer_bucket, 'external', referer);
      assert.equal(result.geo_citation_candidate, 'false', referer);
    }
  });

  test('Bing /chat classifies as Copilot; normal Bing paths classify as search', () => {
    const chat = classifyGeoReferral(pageUrl('/answers/ai-risk'), 'https://bing.com/chat?q=jobs');
    assert.equal(chat.geo_referrer_engine, 'bing_copilot');
    assert.equal(chat.geo_referrer_bucket, 'ai_engine');
    assert.equal(chat.geo_citation_candidate, 'true');

    for (const referer of [
      'https://bing.com/search?q=jobs',
      'https://www.bing.com/search?q=jobs',
    ]) {
      const result = classifyGeoReferral(pageUrl('/answers/ai-risk'), referer);
      assert.equal(result.geo_referrer_engine, 'bing_search', referer);
      assert.equal(result.geo_referrer_bucket, 'search', referer);
      assert.equal(result.geo_citation_candidate, 'true', referer);
    }
  });

  test('same-site referer classifies as internal; empty referer classifies as direct', () => {
    const internal = classifyGeoReferral(pageUrl('/answers/ai-risk'), 'https://mirai-shigoto.com/156');
    assert.equal(internal.geo_referrer_engine, 'internal');
    assert.equal(internal.geo_referrer_bucket, 'internal');
    assert.equal(internal.geo_citation_candidate, 'false');

    const wwwInternal = classifyGeoReferral(pageUrl('/answers/ai-risk'), 'https://www.mirai-shigoto.com/156');
    assert.equal(wwwInternal.geo_referrer_engine, 'internal');
    assert.equal(wwwInternal.geo_referrer_bucket, 'internal');
    assert.equal(wwwInternal.geo_citation_candidate, 'false');

    const direct = classifyGeoReferral(pageUrl('/answers/ai-risk'), '');
    assert.equal(direct.geo_referrer_engine, 'direct');
    assert.equal(direct.geo_referrer_bucket, 'direct');
    assert.equal(direct.geo_referrer_host, '(direct)');
    assert.equal(direct.geo_citation_candidate, 'false');
  });

  test('search referrals only become candidates on citable landing families', () => {
    const cases = [
      ['/answers/ai-risk', 'answers'],
      ['/q/will-ai-replace-programmers', 'qa'],
      ['/sectors/healthcare', 'sector'],
      ['/rankings/ai-risk-low', 'ranking'],
      ['/compare/programmer-vs-designer', 'compare'],
      ['/standard', 'standard'],
      ['/methodology', 'methodology'],
    ] as const;

    for (const [pathname, family] of cases) {
      assert.equal(landingFamily(pathname), family);
      const result = classifyGeoReferral(pageUrl(pathname), 'https://google.com/search?q=jobs');
      assert.equal(result.geo_referrer_bucket, 'search', pathname);
      assert.equal(result.geo_landing_family, family, pathname);
      assert.equal(result.geo_citation_candidate, 'true', pathname);
    }

    const occupation = classifyGeoReferral(pageUrl('/156'), 'https://google.com/search?q=jobs');
    assert.equal(landingFamily('/156'), 'occupation');
    assert.equal(occupation.geo_referrer_bucket, 'search');
    assert.equal(occupation.geo_landing_family, 'occupation');
    assert.equal(occupation.geo_citation_candidate, 'false');
  });
});

test('shouldWithholdFromIndex: only the production host is indexable', () => {
  assert.equal(shouldWithholdFromIndex('mirai-shigoto.com'), false);
  assert.equal(shouldWithholdFromIndex('MIRAI-SHIGOTO.COM'), false);
  assert.equal(shouldWithholdFromIndex('mirai-shigoto.com:443'), false);
});

test('shouldWithholdFromIndex: preview, deployment and alias hosts are withheld', () => {
  for (const host of [
    'pre.mirai-shigoto.com',
    'www.mirai-shigoto.com',
    'jobs-85xboe97k-zkscio.vercel.app',
    'jobs-git-preview-zkscio.vercel.app',
    'status.mirai-shigoto.com',
    'localhost:4321',
  ]) {
    assert.equal(shouldWithholdFromIndex(host), true, `${host} must be withheld`);
  }
});

test('shouldWithholdFromIndex: an absent or empty Host is withheld, not indexed', () => {
  // Fail closed for indexing: an unidentifiable request is not production.
  assert.equal(shouldWithholdFromIndex(null), true);
  assert.equal(shouldWithholdFromIndex(undefined), true);
  assert.equal(shouldWithholdFromIndex(''), true);
});

test('shouldWithholdFromIndex: a subdomain cannot spoof its way to indexable', () => {
  assert.equal(shouldWithholdFromIndex('evil-mirai-shigoto.com'), true);
  assert.equal(shouldWithholdFromIndex('mirai-shigoto.com.evil.test'), true);
});
