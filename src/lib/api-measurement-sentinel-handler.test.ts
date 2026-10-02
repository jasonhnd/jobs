import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

// Neither module mocks nor synthetic credentials escape into the unit suite.
// Pass only PATH and a marker: never inherit real credentials into the child.
if (process.env.SENTINEL_HANDLER_TEST_CHILD !== '1') {
  test('measurement sentinel handler cases in an isolated process', () => {
    const result = spawnSync(process.execPath, [
      'test', fileURLToPath(import.meta.url), '--coverage', '--coverage-reporter=text',
    ], {
      env: { PATH: process.env.PATH, SENTINEL_HANDLER_TEST_CHILD: '1' },
      encoding: 'utf8', timeout: 30_000,
    });
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
  });
} else {
  // @ts-expect-error bun:test is a runtime-only module in the pinned runner
  const { mock } = await import('bun:test');
  const syntheticEnv = {
    CRON_SECRET: 'test-cron-secret', PUBLIC_GA4_MEASUREMENT_ID: 'G-TEST000000',
    GA4_MP_API_SECRET: 'test-mp-secret', GCP_WIF_AUDIENCE: 'test-wif-audience',
    GCP_SA_EMAIL: 'sentinel@example.test', GA4_PROPERTY_ID: '123456',
  };
  let oidcCalls = 0;
  let oidcFailure: unknown;
  mock.module('@vercel/functions/oidc', () => ({
    getVercelOidcToken: async () => {
      oidcCalls++;
      if (oidcFailure !== undefined) throw oidcFailure;
      return 'test-oidc-token';
    },
  }));
  const { GET } = await import('../../api/cron/measurement-sentinel.js');
  const { STS_URL, impersonationUrl, runReportUrl } = await import('./measurement-sentinel-reconcile.js');
  const calls: { url: URL; init: RequestInit }[] = [];
  const logs: unknown[][] = [];
  type Reply = () => Response | Promise<Response>;
  let replies: Reply[] = [];
  const report = (yesterday = 100, dayBefore = 100) => ({ rows: [
    { dimensionValues: [{ value: 'yesterday' }], metricValues: [{ value: String(yesterday) }] },
    { dimensionValues: [{ value: 'dayBefore' }], metricValues: [{ value: String(dayBefore) }] },
  ] });
  const json = (body: unknown, status = 200): Reply => () => Response.json(body, { status });
  const healthyReplies = (): Reply[] => [
    json({ validationMessages: [] }), json({ access_token: 'test-federated-token' }),
    json({ accessToken: 'test-sa-token' }), json(report()),
  ];
  const request = (authorization: string | null = 'Bearer test-cron-secret') => GET(new Request(
    'https://example.test/api/cron/measurement-sentinel',
    { headers: authorization === null ? {} : { Authorization: authorization } },
  ));

  describe('measurement sentinel handler', () => {
    beforeEach(() => {
      Object.assign(process.env, syntheticEnv);
      calls.length = 0;
      logs.length = 0;
      oidcCalls = 0;
      oidcFailure = undefined;
      replies = healthyReplies();
      console.error = (...args: unknown[]) => { logs.push(args); };
      globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const expected = [
          'https://www.google-analytics.com/debug/mp/collect', STS_URL,
          impersonationUrl(syntheticEnv.GCP_SA_EMAIL), runReportUrl(syntheticEnv.GA4_PROPERTY_ID),
        ][calls.length];
        // Assert the stage, but omit the query containing the synthetic secret.
        assert.equal(`${url.origin}${url.pathname}`, expected);
        calls.push({ url, init });
        const reply = replies.shift();
        assert.ok(reply, 'Unexpected extra network request');
        return reply();
      };
    });

    async function assertFailure(failures: string[], expectedCalls: number) {
      const response = await request();
      assert.equal(response.status, 500);
      assert.equal(response.headers.get('content-type'), 'application/json');
      const body = await response.text();
      assert.deepEqual(JSON.parse(body), { ok: false, failures });
      assert.equal(calls.length, expectedCalls);
      assert.deepEqual(logs, [[`[sentinel] measurement chain unhealthy: ${failures.join('; ')}`]]);
      const exposed = body + JSON.stringify(logs);
      for (const value of [
        syntheticEnv.CRON_SECRET, syntheticEnv.GA4_MP_API_SECRET,
        'test-oidc-token', 'test-federated-token', 'test-sa-token', 'private exception detail',
      ]) assert.ok(!exposed.includes(value), 'Failure output must contain reason codes only');
    }

    for (const authorization of [null, 'Bearer wrong', 'Basic test-cron-secret']) {
      test(`rejects unauthorized request (${authorization ?? 'absent'}) before any I/O`, async () => {
        const response = await request(authorization);
        assert.equal(response.status, 401);
        assert.equal(await response.text(), 'Unauthorized');
        assert.deepEqual(calls, []);
        assert.deepEqual(logs, []);
        assert.equal(oidcCalls, 0);
      });
    }
    for (const secret of [undefined, '']) {
      test(`fails closed for ${secret === undefined ? 'unset' : 'empty'} cron secret`, async () => {
        if (secret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = secret;
        const response = await request();
        assert.equal(response.status, 401);
        assert.equal(await response.text(), 'Unauthorized');
        assert.deepEqual(calls, []);
        assert.deepEqual(logs, []);
        assert.equal(oidcCalls, 0);
      });
    }

    test('runs debug, federation, impersonation and report phases in order', async () => {
      const response = await request();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/json');
      assert.deepEqual(await response.json(), { ok: true });
      assert.deepEqual(logs, []);
      assert.equal(calls.length, 4);
      assert.equal(replies.length, 0);
      assert.equal(oidcCalls, 1);
      for (const { init } of calls) {
        assert.equal(init.method, 'POST');
        assert.ok(init.signal instanceof AbortSignal);
        assert.equal(init.signal.aborted, false);
      }
      const debug = calls[0];
      assert.equal(debug.url.searchParams.get('measurement_id'), syntheticEnv.PUBLIC_GA4_MEASUREMENT_ID);
      assert.equal(debug.url.searchParams.get('api_secret'), syntheticEnv.GA4_MP_API_SECRET);
      assert.equal(new Headers(debug.init.headers).get('content-type'), 'application/json');
      const canary = JSON.parse(String(debug.init.body));
      assert.equal(canary.client_id, 'sentinel.1');
      assert.equal(canary.events[0].name, 'page_delivery');
      assert.equal(canary.events[0].params.page_location, 'https://mirai-shigoto.com/__measurement-sentinel');
      const sts = new URLSearchParams(String(calls[1].init.body));
      assert.equal(sts.get('audience'), syntheticEnv.GCP_WIF_AUDIENCE);
      assert.equal(sts.get('subject_token'), 'test-oidc-token');
      assert.equal(new Headers(calls[1].init.headers).get('content-type'), 'application/x-www-form-urlencoded');
      assert.equal(new Headers(calls[2].init.headers).get('authorization'), 'Bearer test-federated-token');
      assert.deepEqual(JSON.parse(String(calls[2].init.body)), {
        scope: ['https://www.googleapis.com/auth/analytics.readonly'], lifetime: '300s',
      });
      assert.equal(new Headers(calls[3].init.headers).get('authorization'), 'Bearer test-sa-token');
      const reportBody = JSON.parse(String(calls[3].init.body));
      assert.deepEqual(reportBody.metrics, [{ name: 'eventCount' }]);
      assert.equal(reportBody.dimensionFilter.filter.stringFilter.value, 'page_delivery');
      assert.deepEqual(reportBody.dateRanges.map((range: { name: string }) => range.name), ['yesterday', 'dayBefore']);
    });

    test('missing phase-one environment stops before network or OIDC', async () => {
      delete process.env.PUBLIC_GA4_MEASUREMENT_ID;
      delete process.env.GA4_MP_API_SECRET;
      await assertFailure(['env:PUBLIC_GA4_MEASUREMENT_ID:missing', 'env:GA4_MP_API_SECRET:missing'], 0);
      assert.equal(oidcCalls, 0);
    });
    test('missing phase-two environment stops after a healthy debug response', async () => {
      delete process.env.GCP_WIF_AUDIENCE;
      delete process.env.GCP_SA_EMAIL;
      delete process.env.GA4_PROPERTY_ID;
      await assertFailure([
        'phase2-env:GCP_WIF_AUDIENCE:missing', 'phase2-env:GCP_SA_EMAIL:missing', 'phase2-env:GA4_PROPERTY_ID:missing',
      ], 1);
      assert.equal(oidcCalls, 0);
    });
    test('debug HTTP error stops reconciliation', async () => {
      replies[0] = () => new Response('{', { status: 503 });
      await assertFailure(['debug-endpoint:http-503'], 1);
      assert.equal(oidcCalls, 0);
    });
    test('debug validation errors discard free-text descriptions', async () => {
      replies[0] = json({ validationMessages: [{
        validationCode: 'VALUE_INVALID', fieldPath: 'events', description: 'test-mp-secret',
      }] });
      await assertFailure(['debug-endpoint:VALUE_INVALID:events'], 1);
      assert.equal(oidcCalls, 0);
    });
    for (const error of [new DOMException('private exception detail', 'AbortError'), 'private exception detail']) {
      test(`debug rejection (${typeof error}) is redacted and stops phase two`, async () => {
        replies[0] = () => { throw error; };
        await assertFailure([`debug-endpoint:${error instanceof Error ? error.name : 'network-error'}`], 1);
        assert.equal(oidcCalls, 0);
      });
    }
    test('malformed successful debug JSON keeps the existing empty-validation verdict', async () => {
      replies[0] = () => new Response('{');
      assert.equal((await request()).status, 200);
      assert.equal(calls.length, 4);
    });

    for (const [label, reply] of [
      ['missing', json({}, 403)], ['empty', json({ access_token: '' }, 403)],
      ['non-string', json({ access_token: 123 }, 403)], ['null', json(null, 403)],
      ['malformed JSON', () => new Response('{', { status: 403 })],
    ] as const) {
      test(`STS ${label} token stops impersonation`, async () => {
        replies[1] = reply;
        await assertFailure(['reconcile:sts-http-403'], 2);
      });
    }
    for (const [label, reply] of [
      ['missing', json({}, 403)], ['malformed JSON', () => new Response('{', { status: 403 })],
    ] as const) {
      test(`impersonation ${label} token stops the report`, async () => {
        replies[2] = reply;
        await assertFailure(['reconcile:impersonate-http-403'], 3);
      });
    }
    test('report HTTP error preserves its status reason', async () => {
      replies[3] = json({ rows: 'invalid' }, 429);
      await assertFailure(['reconcile:report-http-429'], 4);
    });
    for (const reply of [json({ rows: 'invalid' }), () => new Response('{')]) {
      test('invalid report body returns a shape failure', async () => {
        replies[3] = reply;
        await assertFailure(['reconcile:report-shape'], 4);
      });
    }
    for (const [yesterday, expected] of [
      [0, 'reconcile:zero-deliveries(dayBefore=100)'],
      [39, 'reconcile:drop-gt-60pct(yesterday=39,dayBefore=100)'],
    ] as const) {
      test(`unhealthy report (${yesterday}) returns the reconciliation verdict`, async () => {
        replies[3] = json(report(yesterday));
        await assertFailure([expected], 4);
      });
    }
    for (const error of [new Error('private exception detail'), 'private exception detail']) {
      test(`OIDC rejection (${typeof error}) is redacted before STS`, async () => {
        oidcFailure = error;
        await assertFailure([`reconcile:${error instanceof Error ? error.name : 'network-error'}`], 1);
        assert.equal(oidcCalls, 1);
      });
    }
    test('reconciliation network rejection is redacted', async () => {
      replies[1] = () => { throw new TypeError('private exception detail'); };
      await assertFailure(['reconcile:TypeError'], 2);
    });
  });
}
