import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { renderShindanShareResponse } from '../../api/shindan-share.js';
import { shindanShareRewriteTarget } from '../lib/shindan-share-route.js';
import { FAMILY_CODES } from './worktype-copy.js';

const BASE_HTML = `<!doctype html><html><head>
<title>Generic diagnostic</title>
<meta name="description" content="generic description">
<meta name="robots" content="index, follow">
<meta property="og:title" content="Generic diagnostic">
<meta property="og:description" content="generic description">
<meta property="og:url" content="https://mirai-shigoto.com/shindan">
<meta property="og:image" content="https://mirai-shigoto.com/api/og?page=shindan">
<meta name="twitter:title" content="Generic diagnostic">
<meta name="twitter:description" content="generic description">
<meta name="twitter:image" content="https://mirai-shigoto.com/api/og?page=shindan">
</head><body>diagnostic shell</body></html>`;

const WORKTYPES = {
  schema_version: '1.0',
  families: Object.fromEntries(FAMILY_CODES.map((code) => [
    code,
    { familyId: code, count: 1, pct: 12.5 },
  ])),
  variants: Object.fromEntries(FAMILY_CODES.map((code) => [code, {}])),
  occupations: {
    '133': { code: 'CDB', familyId: 'CDB', exposure: 2, rarityPct: 12.5 },
  },
};

const fetchFixture: typeof fetch = async (input) => {
  const url = new URL(String(input));
  if (url.pathname === '/shindan') {
    return new Response(BASE_HTML, { headers: { 'Content-Type': 'text/html' } });
  }
  if (url.pathname === '/data.worktypes.json') {
    return Response.json(WORKTYPES);
  }
  return new Response('not found', { status: 404 });
};

describe('crawler-rendered shindan share HTML', () => {
  test('no-JS result-plus-job request receives matching OG and Twitter images', async () => {
    const request = new Request(
      'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133&gap=aligned',
    );
    const response = await renderShindanShareResponse(request, fetchFixture);
    const html = await response.text();
    const expectedImage = 'https://mirai-shigoto.com/api/og?worktype=RPK&amp;variant=mediator&amp;axes=3-0%2F2-1%2F2-1&amp;job=133&amp;gap=hidden_risk';

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.match(html, /<meta name="robots" content="noindex, follow">/);
    assert.ok(html.includes(`<meta property="og:image" content="${expectedImage}">`));
    assert.ok(html.includes(`<meta name="twitter:image" content="${expectedImage}">`));
    assert.match(html, /自分 x 仕事のギャップ: 働き方を更新する余地があります/);
    assert.doesNotMatch(html, /gap=aligned/);
  });

  test('invalid axis state safely keeps generic metadata and noindex', async () => {
    const request = new Request(
      'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=answers',
    );
    const response = await renderShindanShareResponse(request, fetchFixture);
    const html = await response.text();

    assert.match(html, /<title>Generic diagnostic<\/title>/);
    assert.match(html, /api\/og\?page=shindan/);
    assert.match(html, /<meta name="robots" content="noindex, follow">/);
  });

  test('malformed worktypes JSON falls back to the validated base result', async () => {
    for (const malformedBody of ['{', '{"occupations":']) {
      const malformedFixture: typeof fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname === '/shindan') {
          return new Response(BASE_HTML, { headers: { 'Content-Type': 'text/html' } });
        }
        if (url.pathname === '/data.worktypes.json') {
          return new Response(malformedBody, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('not found', { status: 404 });
      };
      const response = await renderShindanShareResponse(new Request(
        'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=3&gap=aligned',
      ), malformedFixture);
      const html = await response.text();
      const expectedBaseImage = 'https://mirai-shigoto.com/api/og?worktype=RPK&amp;variant=mediator&amp;axes=3-0%2F2-1%2F2-1';

      assert.equal(response.status, 200, malformedBody);
      assert.ok(html.includes(`<meta property="og:image" content="${expectedBaseImage}">`));
      assert.ok(html.includes(`<meta name="twitter:image" content="${expectedBaseImage}">`));
      assert.doesNotMatch(html, /(?:job|gap)=/);
    }
  });

  test('routing middleware only rewrites result queries and preserves their state', () => {
    assert.equal(shindanShareRewriteTarget(new URL('https://mirai-shigoto.com/shindan')), null);
    assert.equal(shindanShareRewriteTarget(new URL('https://mirai-shigoto.com/about?self=RPK')), null);

    const target = shindanShareRewriteTarget(new URL(
      'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=3&gap=aligned',
    ));
    assert.equal(
      target?.toString(),
      'https://mirai-shigoto.com/api/shindan-share?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=3&gap=aligned',
    );
  });
});
