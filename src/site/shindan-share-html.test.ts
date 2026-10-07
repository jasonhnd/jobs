import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { GET, HEAD, renderShindanShareResponse } from '../../api/shindan-share.js';
import { shindanShareRewriteTarget } from '../lib/shindan-share-route.js';
import { renderShindanShareHtml } from './shindan-share-html.js';
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

const DETAIL_133 = {
  id: 133,
  title: { ja: 'データ職業' },
  ai_risk: { score: 8.1 },
  stats: { workers: 1000, salary_man_yen: 500 },
};

function hangUntilAbort(init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    const abort = () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      reject(err);
    };
    if (!signal) {
      reject(new Error('expected an abort signal'));
      return;
    }
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

const fetchFixture: typeof fetch = async (input) => {
  const url = new URL(String(input));
  if (url.pathname === '/shindan') {
    return new Response(BASE_HTML, { headers: { 'Content-Type': 'text/html' } });
  }
  if (url.pathname === '/data.worktypes.json') {
    return Response.json(WORKTYPES);
  }
  if (url.pathname === '/data.detail/0133.json') {
    return Response.json(DETAIL_133);
  }
  return new Response('not found', { status: 404 });
};

const HOSTILE_TEXT = '\"><script>alert("share")</script>&amp;\'データ職業';
const ESCAPED_TEXT = '&quot;&gt;&lt;script&gt;alert(&quot;share&quot;)&lt;/script&gt;&amp;amp;\'データ職業';

describe('shindan share metadata escaping', () => {
  for (const [mode, baseHtml] of [
    ['replace', BASE_HTML],
    ['insert', '<!doctype html><html><head><title>Generic diagnostic</title></head><body>diagnostic shell</body></html>'],
  ] as const) {
    test(`${mode} escapes every metadata field without changing its text`, () => {
      const html = renderShindanShareHtml(baseHtml, {
        title: `Title ${HOSTILE_TEXT}`,
        description: `Description ${HOSTILE_TEXT}`,
        url: `https://example.test/shindan?value=${HOSTILE_TEXT}`,
        image: `https://example.test/api/og?value=${HOSTILE_TEXT}`,
      });

      assert.ok(html.includes(`<title>Title ${ESCAPED_TEXT}</title>`));
      for (const [attribute, key, value] of [
        ['name', 'description', `Description ${ESCAPED_TEXT}`],
        ['property', 'og:title', `Title ${ESCAPED_TEXT}`],
        ['property', 'og:description', `Description ${ESCAPED_TEXT}`],
        ['property', 'og:url', `https://example.test/shindan?value=${ESCAPED_TEXT}`],
        ['property', 'og:image', `https://example.test/api/og?value=${ESCAPED_TEXT}`],
        ['name', 'twitter:title', `Title ${ESCAPED_TEXT}`],
        ['name', 'twitter:description', `Description ${ESCAPED_TEXT}`],
        ['name', 'twitter:image', `https://example.test/api/og?value=${ESCAPED_TEXT}`],
      ]) {
        const tag = `<meta ${attribute}="${key}" content="${value}">`;
        assert.ok(html.includes(tag), key);
        assert.equal(html.match(new RegExp(`<meta ${attribute}="${key}"`, 'g'))?.length, 1, key);
      }
      assert.ok(html.includes('<meta name="robots" content="noindex, follow">'));
      assert.doesNotMatch(html, /<script\b/i);
      assert.ok(html.endsWith('</head><body>diagnostic shell</body></html>'));
    });
  }
});

describe('crawler-rendered shindan share HTML', () => {
  test('HEAD matches GET headers and never fetches a shell or job context', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', fetchFixture);
    const request = new Request('https://example.test/api/shindan-share?job=133');
    const get = await GET(request);
    const callsBeforeHead = fetchMock.mock.callCount();
    assert.ok(callsBeforeHead > 0);
    const head = HEAD(new Request(request.url, { method: 'HEAD' }));
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.deepEqual([...head.headers], [...get.headers]);
    assert.equal(fetchMock.mock.callCount(), callsBeforeHead);
  });

  for (const path of ['/shindan', '/data.worktypes.json', '/data.detail/0133.json']) {
    test(`immediate headers with a stalled body degrade: ${path}`, { timeout: 2_000 }, async () => {
      let signal: AbortSignal | undefined;
      let aborted = false;
      const started = performance.now();
      const response = await renderShindanShareResponse(new Request(
        'https://example.test/api/shindan-share?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133',
      ), async (input, init) => {
        if (new URL(String(input)).pathname !== path) return fetchFixture(input, init);
        signal = init?.signal ?? undefined;
        assert.ok(signal);
        return new Response(new ReadableStream({
          start(controller) {
            // Headers and a partial body arrive, but the stream never closes.
            controller.enqueue(new TextEncoder().encode(path === '/shindan' ? '<html>' : '{'));
            signal!.addEventListener('abort', () => {
              aborted = true;
              controller.error(new DOMException('aborted', 'AbortError'));
            }, { once: true });
          },
        }));
      }, 40);
      assert.ok(performance.now() - started < 500, 'must settle near the configured deadline');
      assert.equal(signal?.aborted, true);
      assert.equal(aborted, true, 'expiry must abort the underlying body read');
      if (path === '/shindan') {
        assert.equal(response.status, 502);
        assert.equal(await response.text(), 'Diagnostic share page unavailable');
      } else {
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /api\/og\?worktype=RPK/);
        if (path === '/data.detail/0133.json') assert.doesNotMatch(html, new RegExp(DETAIL_133.title.ja));
        else assert.doesNotMatch(html, /(?:job|gap)=/);
      }
    });
  }

  test('a body that ignores abort still settles at the deadline', { timeout: 2_000 }, async () => {
    let signal: AbortSignal | undefined;
    const started = performance.now();
    const response = await renderShindanShareResponse(
      new Request('https://example.test/api/shindan-share'),
      async (_input, init) => {
        signal = init?.signal ?? undefined;
        return new Response(new ReadableStream());
      },
      40,
    );
    assert.equal(response.status, 502);
    assert.equal(signal?.aborted, true);
    assert.ok(performance.now() - started < 500);
  });

  test('header latency consumes the same deadline as body reading', { timeout: 2_000 }, async () => {
    let bodyAborted = false;
    const response = await renderShindanShareResponse(
      new Request('https://example.test/api/shindan-share'),
      async (_input, init) => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return new Response(new ReadableStream({
          start(controller) {
            // Each phase fits within 100 ms, but together they do not.
            const timer = setTimeout(() => {
              controller.enqueue(new TextEncoder().encode(BASE_HTML));
              controller.close();
            }, 60);
            init?.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              bodyAborted = true;
              controller.error(new DOMException('aborted', 'AbortError'));
            }, { once: true });
          },
        }));
      },
      100,
    );
    assert.equal(response.status, 502);
    assert.equal(bodyAborted, true);
  });

  for (const failure of ['http', 'network', 'timeout'] as const) {
    test(`unavailable shell (${failure}) returns a plain 502`, { timeout: 2_000 }, async () => {
      const response = await renderShindanShareResponse(
        new Request('https://example.test/api/shindan-share'),
        async (_input, init) => {
          if (failure === 'timeout') return hangUntilAbort(init);
          if (failure === 'network') throw new Error('synthetic upstream failure');
          return new Response('upstream unavailable', { status: 503 });
        },
        failure === 'timeout' ? 40 : undefined,
      );
      assert.equal(response.status, 502);
      assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
      assert.equal(response.headers.get('cache-control'), null);
      assert.equal(await response.text(), 'Diagnostic share page unavailable');
    });
  }

  for (const failure of ['http', 'network', 'schema', 'timeout'] as const) {
    test(`optional worktypes failure (${failure}) preserves the base result`, { timeout: 2_000 }, async () => {
      const response = await renderShindanShareResponse(new Request(
        'https://example.test/api/shindan-share?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133',
      ), async (input, init) => {
        if (new URL(String(input)).pathname === '/data.worktypes.json') {
          if (failure === 'timeout') return hangUntilAbort(init);
          if (failure === 'network') throw new Error('synthetic projection failure');
          return failure === 'schema'
            ? Response.json({ occupations: {} })
            : new Response(null, { status: 404 });
        }
        // Keep job detail unavailable so the result is entirely base-only.
        if (new URL(String(input)).pathname.startsWith('/data.detail/')) {
          return new Response(null, { status: 404 });
        }
        return fetchFixture(input, init);
      }, failure === 'timeout' ? 40 : undefined);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /api\/og\?worktype=RPK&amp;variant=mediator&amp;axes=3-0%2F2-1%2F2-1/);
      assert.doesNotMatch(html, /(?:job|gap)=/);
      assert.doesNotMatch(html, /Generic diagnostic/);
    });
  }

  for (const failure of ['invalid-id', 'http', 'network', 'json', 'schema', 'empty-title', 'timeout'] as const) {
    test(`optional job detail failure (${failure}) does not reject a valid result`, { timeout: 2_000 }, async () => {
      const paths: string[] = [];
      const response = await renderShindanShareResponse(new Request(
        `https://example.test/api/shindan-share?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=${failure === 'invalid-id' ? 'bad' : '133'}`,
      ), async (input, init) => {
        const path = new URL(String(input)).pathname;
        paths.push(path);
        if (path.startsWith('/data.detail/')) {
          if (failure === 'timeout') return hangUntilAbort(init);
          if (failure === 'network') throw new Error('synthetic detail failure');
          if (failure === 'json') return new Response('{');
          if (failure === 'schema') return Response.json({ id: 133 });
          if (failure === 'empty-title') return Response.json({ ...DETAIL_133, title: { ja: '' } });
          return new Response(null, { status: 404 });
        }
        return fetchFixture(input, init);
      }, failure === 'timeout' ? 40 : undefined);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
      assert.doesNotMatch(html, new RegExp(DETAIL_133.title.ja));
      assert.match(html, /api\/og\?worktype=RPK/);
      if (failure === 'invalid-id') assert.ok(paths.every((path) => !path.startsWith('/data.detail/')));
      else assert.ok(paths.includes('/data.detail/0133.json'));
    });
  }

  for (const parameter of ['self', 'job', 'axes'] as const) {
    for (const placement of ['only', 'suffix'] as const) {
      test(`rejects a script payload in ${parameter} (${placement}) with a safe fallback`, async () => {
        const url = new URL('https://mirai-shigoto.com/shindan');
        url.search = new URLSearchParams({
          self: 'RPK', variant: 'mediator', axes: '3-0/2-1/2-1', job: '133',
        }).toString();
        url.searchParams.set(parameter, placement === 'only'
          ? HOSTILE_TEXT
          : `${url.searchParams.get(parameter)}${HOSTILE_TEXT}`);
        const fetchedPaths: string[] = [];
        const fixture: typeof fetch = async (input, init) => {
          fetchedPaths.push(new URL(String(input)).pathname);
          return fetchFixture(input, init);
        };
        const response = await renderShindanShareResponse(new Request(url), fixture);
        const html = await response.text();
        const fallbackUrl = new URL('https://mirai-shigoto.com/shindan');
        if (parameter === 'job') {
          fallbackUrl.search = 'self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1';
        }
        const fallback = await renderShindanShareResponse(new Request(fallbackUrl), fetchFixture);

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
        assert.equal(html, await fallback.text());
        assert.doesNotMatch(html, /<script\b/i);
        assert.ok(!html.includes(HOSTILE_TEXT));
        assert.ok(!html.includes(encodeURIComponent(HOSTILE_TEXT)));
        if (parameter === 'job') {
          assert.ok(!fetchedPaths.some((path) => path.startsWith('/data.detail/')));
          assert.doesNotMatch(html, /(?:job|gap)=/);
        }
      });
    }
  }

  test('escapes a hostile occupation title from validated detail JSON', async () => {
    const fixture: typeof fetch = async (input, init) => {
      if (new URL(String(input)).pathname === '/data.detail/0133.json') {
        return Response.json({ ...DETAIL_133, title: { ja: HOSTILE_TEXT } });
      }
      return fetchFixture(input, init);
    };
    const response = await renderShindanShareResponse(new Request(
      'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133',
    ), fixture);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.ok(html.includes(`<title>${ESCAPED_TEXT}`));
    for (const [attribute, key] of [
      ['name', 'description'],
      ['property', 'og:title'],
      ['property', 'og:description'],
      ['name', 'twitter:title'],
      ['name', 'twitter:description'],
    ]) {
      assert.ok(html.includes(`<meta ${attribute}="${key}" content="${ESCAPED_TEXT}`), key);
    }
    assert.match(html, /&amp;job=133&amp;gap=hidden_risk/);
    assert.doesNotMatch(html, /<script\b/i);
    assert.ok(!html.includes(HOSTILE_TEXT));
  });

  test('a fast upstream fetch carries an abort signal and returns the job share', async () => {
    const signals: AbortSignal[] = [];
    const response = await renderShindanShareResponse(new Request(
      'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1&job=133&gap=aligned',
    ), async (input, init) => {
      if (!init?.signal) throw new Error('missing abort signal');
      signals.push(init.signal);
      return fetchFixture(input, init);
    }, 1_000);
    const html = await response.text();
    const expectedImage = 'https://mirai-shigoto.com/api/og?worktype=RPK&amp;variant=mediator&amp;axes=3-0%2F2-1%2F2-1&amp;job=133&amp;gap=hidden_risk';

    assert.equal(response.status, 200);
    assert.equal(signals.length, 3);
    assert.ok(signals.every((signal) => !signal.aborted));
    assert.ok(html.includes(`<meta property="og:image" content="${expectedImage}">`));
    assert.match(html, /データ職業のAI影響度は8\.1\/10｜AI働き方診断/);
  });

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
    assert.match(html, /データ職業のAI影響度は8\.1\/10｜AI働き方診断/);
    assert.match(html, /データ職業のAI影響度は8\.1\/10。あなたの仕事は？/);
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

// Audit 2026-10-07 (#861).
describe('shindan share: job context only when the result kept the job', () => {
  const RESULT = 'https://mirai-shigoto.com/shindan?self=RPK&variant=mediator&axes=3-0%2F2-1%2F2-1';
  const FULL_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
  const SHORT_CACHE = 'public, max-age=0, s-maxage=60';

  async function render(query: string, fixture: typeof fetch = fetchFixture) {
    const paths: string[] = [];
    const response = await renderShindanShareResponse(new Request(`${RESULT}${query}`), async (input, init) => {
      paths.push(new URL(String(input)).pathname);
      return fixture(input, init);
    }, 200);
    return { response, html: await response.text(), paths };
  }

  for (const query of ['&job=133&gap=bogus', '&job=133&gap=__proto__', '&job=999']) {
    test(`dropped job (${query}) writes no occupation title and matches the base page`, async () => {
      const { response, html, paths } = await render(query);
      const base = await render('');
      assert.equal(response.status, 200);
      assert.doesNotMatch(html, new RegExp(DETAIL_133.title.ja));
      assert.doesNotMatch(html, /AI影響度は/);
      assert.equal(html, base.html);
      assert.ok(!paths.some((path) => path.startsWith('/data.detail/')));
      assert.equal(response.headers.get('cache-control'), FULL_CACHE, 'a deterministic drop is not degraded');
    });
  }

  test('a failed worktypes fetch does not borrow the raw ?job= for the title', async () => {
    const { response, html } = await render('&job=133', async (input, init) => {
      if (new URL(String(input)).pathname === '/data.worktypes.json') return new Response(null, { status: 503 });
      return fetchFixture(input, init);
    });
    assert.equal(response.status, 200);
    assert.doesNotMatch(html, new RegExp(DETAIL_133.title.ja));
    assert.doesNotMatch(html, /(?:job|gap)=/);
    assert.equal(response.headers.get('cache-control'), SHORT_CACHE);
  });

  test('a failed job detail fetch is cached briefly', async () => {
    const { response, html } = await render('&job=133', async (input, init) => {
      if (new URL(String(input)).pathname === '/data.detail/0133.json') return new Response(null, { status: 503 });
      return fetchFixture(input, init);
    });
    assert.equal(response.status, 200);
    assert.match(html, /job=133/);
    assert.equal(response.headers.get('cache-control'), SHORT_CACHE);
  });

  test('a normalized job id fetches the normalized detail file', async () => {
    const { response, html, paths } = await render('&job=0133');
    assert.ok(paths.includes('/data.detail/0133.json'));
    assert.match(html, /データ職業のAI影響度は8\.1\/10/);
    assert.equal(response.headers.get('cache-control'), FULL_CACHE);
  });
});

describe('shindan share: metadata is inserted literally', () => {
  for (const pattern of ["$'", '$`', '$&', '$1', '$$']) {
    test(`a title containing ${pattern} is not expanded as a replacement pattern`, () => {
      const title = `A ${pattern} B`;
      for (const baseHtml of [BASE_HTML, '<html><head><title>t</title></head><body>x</body></html>']) {
        const html = renderShindanShareHtml(baseHtml, {
          title, description: title, url: 'https://example.test/u', image: 'https://example.test/i',
        });
        const shown = title.replace(/&/g, '&amp;');
        assert.ok(html.includes(`<title>${shown}</title>`), html);
        assert.ok(html.includes(`<meta property="og:title" content="${shown}">`), html);
        assert.equal(html.match(/<\/head>/g)?.length, 1);
        assert.equal(html.match(/<title>/g)?.length, 1);
      }
    });
  }
});
