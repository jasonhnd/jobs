import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

import { isBotUserAgent, isShareUnfurlerUserAgent } from './middleware-helpers.js';
import {
  meOccupationOgRewriteTarget,
  noOccAliasRedirectTarget,
  shindanOccupationRedirectTarget,
  shindanShareRewriteTarget,
} from './shindan-share-route.js';

describe('shindan routing (#259 / #260 lock)', () => {
  test('/me/start 301s to /shindan and keeps query state', () => {
    assert.equal(
      noOccAliasRedirectTarget(new URL('https://mirai-shigoto.com/me/start'))?.toString(),
      'https://mirai-shigoto.com/shindan',
    );
    assert.equal(
      noOccAliasRedirectTarget(
        new URL('https://mirai-shigoto.com/me/start?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1'),
      )?.toString(),
      'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1',
    );
    assert.equal(noOccAliasRedirectTarget(new URL('https://mirai-shigoto.com/shindan')), null);
  });

  test('bare /shindan and occupation-less shares stay on /shindan', () => {
    assert.equal(shindanOccupationRedirectTarget(new URL('https://mirai-shigoto.com/shindan')), null);
    assert.equal(
      shindanOccupationRedirectTarget(
        new URL('https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1'),
      ),
      null,
    );
    const share = shindanShareRewriteTarget(
      new URL('https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1'),
    );
    assert.equal(
      share?.toString(),
      'https://mirai-shigoto.com/api/shindan-share?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1',
    );
  });

  test('occupation-bearing /shindan links map to /me without persisting gap', () => {
    const target = shindanOccupationRedirectTarget(
      new URL(
        'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133&gap=hidden_risk',
      ),
    );
    assert.equal(
      target?.toString(),
      'https://mirai-shigoto.com/me?id=133&self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1',
    );
    assert.equal(target?.searchParams.has('gap'), false);
  });

  test('/me?id= rewrites to the occupation page for score OG (#237)', () => {
    assert.equal(
      meOccupationOgRewriteTarget(new URL('https://mirai-shigoto.com/me?id=133'))?.toString(),
      'https://mirai-shigoto.com/133',
    );
    assert.equal(
      meOccupationOgRewriteTarget(new URL('https://mirai-shigoto.com/me?id=404'))?.toString(),
      'https://mirai-shigoto.com/occupations/404',
    );
    assert.equal(meOccupationOgRewriteTarget(new URL('https://mirai-shigoto.com/me')), null);
    assert.equal(isShareUnfurlerUserAgent('Twitterbot/1.0'), true);
    assert.equal(isShareUnfurlerUserAgent('Googlebot/2.1'), false);
  });

  test('social scrapers still match the share rewrite on occupation-bearing links', () => {
    const url = new URL(
      'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133',
    );
    assert.equal(isBotUserAgent('facebookexternalhit/1.1'), true);
    assert.equal(isBotUserAgent('Twitterbot/1.0'), true);
    assert.equal(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), false);
    assert.ok(shindanShareRewriteTarget(url));
    assert.ok(shindanOccupationRedirectTarget(url));
  });
});
