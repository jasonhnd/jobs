import { afterEach, beforeEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import middleware, { config } from '../../middleware.js';

const BROWSER = 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36';
const CONTEXT = Symbol.for('@vercel/request-context');
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };

function request(path = '/about', headers: Record<string, string> = {}, host = 'example.test'): Request {
  return new Request(`https://${host}${path}`, {
    headers: { host, 'user-agent': BROWSER, accept: 'text/html', ...headers },
  });
}

describe('middleware entry point', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalContext: unknown;
  let originalFetch: typeof fetch;
  let originalWarn: typeof console.warn;
  let pending: Promise<unknown>[];
  let calls: Array<{ url: URL; init: RequestInit }>;
  let warnings: unknown[][];
  let upstream: () => Promise<Response>;

  beforeEach(() => {
    // Swap the whole environment object: never read or save actual credential values.
    originalEnv = process.env;
    process.env = { PUBLIC_GA4_MEASUREMENT_ID: 'G-FIXTURE', GA4_MP_API_SECRET: 'synthetic fixture only' };
    originalContext = globals[CONTEXT];
    originalFetch = globalThis.fetch;
    originalWarn = console.warn;
    pending = [];
    calls = [];
    warnings = [];
    upstream = async () => new Response(null, { status: 204 });
    // Exercise the real Vercel next/rewrite/waitUntil helpers; avoid persistent module mocks.
    globals[CONTEXT] = { get: () => ({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) }) };
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, 'https://www.google-analytics.com');
      assert.equal(url.pathname, '/mp/collect');
      calls.push({ url, init: init ?? {} });
      return upstream();
    }) as typeof fetch;
    console.warn = (...args: unknown[]) => { warnings.push(args); };
  });

  afterEach(async () => {
    try {
      await Promise.all(pending);
    } finally {
      process.env = originalEnv;
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
      if (originalContext === undefined) delete globals[CONTEXT];
      else globals[CONTEXT] = originalContext;
    }
  });

  function assertUnmeasured(): void {
    assert.equal(calls.length, 0);
    assert.equal(pending.length, 0);
  }

  test('retains the Node runtime and excludes static/API paths from the matcher', () => {
    assert.equal(config.runtime, 'nodejs');
    const matcher = new RegExp(`^${config.matcher}$`);
    for (const path of ['/about', '/shindan', '/me', '/156', '/sectors/test']) assert.ok(matcher.test(path), path);
    for (const path of ['/api/og', '/_vercel/insights', '/_astro/app.js', '/data.treemap.json', '/robots.txt', '/fonts/test.woff2', '/card.png']) assert.equal(matcher.test(path), false, path);
  });

  test('redirects the retired no-occupation alias with query intact and no analytics', () => {
    const response = middleware(request('/me/start?self=5&variant=x'));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://example.test/shindan?self=5&variant=x');
    assert.equal(response.headers.get('x-robots-tag'), null);
    assertUnmeasured();
  });

  test('redirects human occupation-bearing diagnostic links before serving a share rewrite', () => {
    const response = middleware(request('/shindan?job=0156&self=5&variant=x&axes=1,2&ignored=drop'));
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://example.test/me?id=156&self=5&variant=x&axes=1%2C2');
    assertUnmeasured();
  });

  test('social scrapers keep diagnostic share metadata instead of receiving a human redirect', () => {
    const response = middleware(request('/shindan?job=156&self=5', { 'user-agent': 'Twitterbot/1.0' }));
    assert.equal(response.headers.get('x-middleware-rewrite'), 'https://example.test/api/shindan-share?job=156&self=5');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assertUnmeasured();
  });

  test('me occupation OG rewrites apply only to social unfurlers, including occupation 404', () => {
    for (const [id, target] of [['0156', '/156'], ['404', '/occupations/404']]) {
      const response = middleware(request(`/me?id=${id}`, { 'user-agent': 'Slackbot-LinkExpanding 1.0' }));
      assert.equal(response.headers.get('x-middleware-rewrite'), `https://example.test${target}`);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    }
    const human = middleware(request('/me?id=156', { 'x-shindan-shell-fetch': '1' }));
    assert.equal(human.headers.get('x-middleware-next'), '1');
    assert.equal(human.headers.get('x-middleware-rewrite'), null);
    assertUnmeasured();
  });

  test('share rewrites preserve queries on production without a preview robots tag', () => {
    const response = middleware(request('/shindan?self=5&variant=x', { 'x-shindan-shell-fetch': '1' }, 'mirai-shigoto.com'));
    assert.equal(response.headers.get('x-middleware-rewrite'), 'https://mirai-shigoto.com/api/shindan-share?self=5&variant=x');
    assert.equal(response.headers.get('x-robots-tag'), null);
    assertUnmeasured();
  });

  test('internal shell fetch returns the route response without double counting', () => {
    const response = middleware(request('/shindan', { 'x-shindan-shell-fetch': '1' }));
    assert.equal(response.headers.get('x-middleware-next'), '1');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assertUnmeasured();
  });

  test('missing measurement configuration passes through without fetching', () => {
    for (const env of [{}, { PUBLIC_GA4_MEASUREMENT_ID: 'G-FIXTURE' }, { GA4_MP_API_SECRET: 'fixture' }]) {
      process.env = env;
      assert.equal(middleware(request()).headers.get('x-middleware-next'), '1');
    }
    assertUnmeasured();
  });

  test('consent rejection, other bots, non-HTML, and excluded/scanner paths do not send hits', () => {
    for (const req of [
      request('/about', { cookie: 'cookieConsent=rejected' }),
      request('/about', { 'user-agent': 'Googlebot/2.1' }),
      request('/about', { accept: 'application/json' }),
      request('/api/test'), request('/_vercel/test'), request('/wp-admin/install.php'),
    ]) {
      assert.equal(middleware(req).headers.get('x-middleware-next'), '1');
    }
    assertUnmeasured();
  });

  test('schedules one page_delivery POST using cookie identity, trusted IP, and referral parameters', async () => {
    const response = middleware(request('/156', {
      cookie: '_ga=GA1.1.1234567890.1685600000', referer: 'https://chatgpt.com/',
      'x-real-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.1',
    }, 'mirai-shigoto.com'));
    assert.equal(response.headers.get('x-middleware-next'), '1');
    assert.equal(response.headers.get('x-robots-tag'), null);
    assert.equal(calls.length, 1);
    assert.equal(pending.length, 1);
    const { url, init } = calls[0]!;
    assert.equal(url.searchParams.get('measurement_id'), 'G-FIXTURE');
    assert.equal(url.searchParams.get('api_secret'), 'synthetic fixture only');
    assert.equal(init.method, 'POST');
    assert.equal(new Headers(init.headers).get('content-type'), 'application/json');
    assert.equal(init.keepalive, true);
    assert.ok(init.signal instanceof AbortSignal);
    const payload = JSON.parse(String(init.body));
    assert.equal(payload.client_id, '1234567890.1685600000');
    assert.equal(payload.ip_override, '203.0.113.9');
    assert.equal(payload.user_agent, BROWSER);
    assert.equal(payload.events.length, 1);
    assert.equal(payload.events[0].name, 'page_delivery');
    assert.partialDeepStrictEqual(payload.events[0].params, {
      page_location: 'https://mirai-shigoto.com/156', page_referrer: 'https://chatgpt.com/',
      client_kind: 'browser', agent_name: '(none)', ssrc: 'mw', engagement_time_msec: 1,
      geo_referrer_engine: 'chatgpt_search', geo_referrer_bucket: 'ai_engine',
      geo_referrer_host: 'chatgpt.com', geo_citation_candidate: 'true', geo_landing_family: 'occupation',
    });
    assert.equal(typeof payload.events[0].params.session_id, 'string');
    await Promise.all(pending);
    assert.deepEqual(warnings, []);
  });

  test('anonymous AI requests are measured with agent identity and no fabricated IP', async () => {
    const response = middleware(request('/about', { 'user-agent': 'GPTBot/1.0' }));
    assert.equal(response.headers.get('x-middleware-next'), '1');
    assert.equal(calls.length, 1);
    const payload = JSON.parse(String(calls[0]!.init.body));
    assert.equal(payload.ip_override, '');
    assert.partialDeepStrictEqual(payload.events[0].params, { client_kind: 'ai_agent', agent_name: 'gptbot', page_referrer: '' });
    assert.equal(typeof payload.client_id, 'string');
    await Promise.all(pending);
    assert.deepEqual(warnings, []);
  });

  test('share measurement uses the original result URL, not the API rewrite target', async () => {
    const response = middleware(request('/shindan?self=5'));
    assert.equal(response.headers.get('x-middleware-rewrite'), 'https://example.test/api/shindan-share?self=5');
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(String(calls[0]!.init.body)).events[0].params.page_location, 'https://example.test/shindan?self=5');
    await Promise.all(pending);
  });

  test('upstream 200 and 204 responses are silent', async () => {
    for (const status of [200, 204]) {
      upstream = async () => new Response(null, { status });
      middleware(request());
      await Promise.all(pending);
    }
    assert.equal(calls.length, 2);
    assert.deepEqual(warnings, []);
  });

  test('returns the route response immediately while delivery is still pending', async () => {
    let resolve!: (response: Response) => void;
    upstream = () => new Promise<Response>((done) => { resolve = done; });
    const response = middleware(request());
    assert.equal(response.headers.get('x-middleware-next'), '1');
    assert.equal(pending.length, 1);
    resolve(new Response(null, { status: 204 }));
    await Promise.all(pending);
  });

  test('logs an upstream rejection status without changing the user response', async () => {
    upstream = async () => new Response(null, { status: 503, statusText: 'Unavailable' });
    assert.equal(middleware(request()).headers.get('x-middleware-next'), '1');
    await Promise.all(pending);
    assert.deepEqual(warnings, [['[mp] non-2xx from GA4: 503 Unavailable']]);
  });

  test('handles Error and non-Error transport failures without rejecting waitUntil', async () => {
    for (const failure of [new TypeError('https://www.google-analytics.com/mp/collect?api_secret=synthetic-secret'), 'https://example.test/?api_secret=synthetic-secret']) {
      upstream = async () => { throw failure; };
      assert.equal(middleware(request()).headers.get('x-middleware-next'), '1');
      await Promise.all(pending);
    }
    assert.deepEqual(warnings, [['[mp] send failed: TypeError'], ['[mp] send failed: network-error']]);
  });
});
