import { afterEach, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

// seo-check.sh is a manual probe (not in CI). These tests never reach the
// network: argument and host-guard cases run with a stub `curl` that only
// records its arguments, and behavioural cases talk to local Bun servers.
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'seo-check.sh');
const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function stubCurl(): { dir: string; log: string } {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'jobs-seo-check-')));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const log = join(dir, 'curl.log');
  writeFileSync(log, '');
  writeFileSync(join(dir, 'curl'), `#!/bin/sh\necho "$@" >> "${log}"\nexit 7\n`);
  chmodSync(join(dir, 'curl'), 0o755);
  return { dir, log };
}

function runWithStub(args: string[]) {
  const stub = stubCurl();
  const env: Record<string, string | undefined> = { ...process.env, PATH: `${stub.dir}:${process.env.PATH}` };
  delete env.ALLOW_PROD;
  const result = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', timeout: 20_000, env });
  return { ...result, curlCalls: readFileSync(stub.log, 'utf8') };
}

describe('seo-check.sh guards (no network)', () => {
  const productionSpellings = [
    'https://mirai-shigoto.com',
    'https://mirai-shigoto.com.',
    'https://mirai-shigoto.com./',
    'https://MIRAI-SHIGOTO.COM/',
    'HTTPS://www.mirai-shigoto.com:443/path',
  ];
  for (const base of productionSpellings) {
    test(`refuses production spelled ${base} before any request`, () => {
      const result = runWithStub([base]);
      assert.equal(result.status, 2, result.stdout);
      assert.match(result.stderr, /refusing production host/);
      assert.equal(result.curlCalls, '');
    });
  }

  // curl accepts these and connects to mirai-shigoto.com, but a host parser
  // that disagrees with curl's reads them as a different (or empty) host.
  // Anything that is not plain `http(s)://host[:port][/path]` is refused.
  const nonStandardBases = [
    'https:///mirai-shigoto.com',
    'https:////mirai-shigoto.com/',
    'https://%6dirai-shigoto.com',
    'https://mirai-shigoto%2ecom',
    'https://user@www.mirai-shigoto.com:443/',
    'https://pre.mirai-shigoto.com@mirai-shigoto.com/',
    'https://mirai-shigoto.com#top',
    'https://mirai-shigoto.com?x=1',
    'https:/mirai-shigoto.com',
    'https:\\\\mirai-shigoto.com',
    'https://[::1]/',
    'mirai-shigoto.com',
    'ftp://mirai-shigoto.com/',
    ' https://mirai-shigoto.com',
  ];
  for (const base of nonStandardBases) {
    test(`rejects non-standard base ${JSON.stringify(base)} before any request`, () => {
      const result = runWithStub([base]);
      assert.equal(result.status, 2, result.stdout);
      assert.match(result.stderr, /usage: /);
      assert.equal(result.curlCalls, '');
    });
  }

  const badArgs: ReadonlyArray<readonly string[]> = [
    ['http://127.0.0.1:9', '--sample', 'abc'],
    ['http://127.0.0.1:9', '--sample', '0'],
    ['http://127.0.0.1:9', '--sample', '-3'],
    ['http://127.0.0.1:9', '--sample'],
    ['http://127.0.0.1:9', '--samples', '5'],
  ];
  for (const args of badArgs) {
    test(`rejects ${args.slice(1).join(' ')} before any request`, () => {
      const result = runWithStub([...args]);
      assert.equal(result.status, 2, result.stdout);
      assert.match(result.stderr, /usage: /);
      assert.equal(result.curlCalls, '');
    });
  }
});

interface Server { url: string; hits: string[] }

interface Reply { status?: number; headers?: Record<string, string>; body?: string }

async function serve(routes: Record<string, () => Reply>): Promise<Server> {
  const hits: string[] = [];
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    hits.push(pathname);
    const route = routes[pathname];
    const reply = route ? route() : { status: 404, body: 'not found' };
    response.writeHead(reply.status ?? 200, reply.headers ?? {});
    response.end(request.method === 'HEAD' ? undefined : reply.body ?? '');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => server.close());
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits };
}

const PAGE_HEADERS = { 'content-type': 'text/html', 'strict-transport-security': 'max-age=1', 'x-vercel-id': 'hnd1::x' };

function page(path: string): Reply {
  const html = `<!doctype html><html lang="ja"><head>
<title>未来の仕事 — AI とあなたの仕事の未来を職業ごとに読み解くサイトのテストページ</title>
<meta name="description" content="${'説明'.repeat(30)}">
<meta name="viewport" content="width=device-width">
<link rel="canonical" href="https://mirai-shigoto.com${path}">
<link rel="alternate" hreflang="ja" href="https://mirai-shigoto.com${path}">
<link rel="alternate" hreflang="x-default" href="https://mirai-shigoto.com${path}">
<meta property="og:type" content="website"><meta property="og:title" content="t">
<meta property="og:description" content="d"><meta property="og:url" content="u"><meta property="og:image" content="i">
<meta name="twitter:card" content="summary">
<link rel="dns-prefetch" href="//x"><link rel="preconnect" href="https://x">
<script type="application/ld+json">{"@type": "WebPage"}</script>
<!-- cloudflareinsights.com googletagmanager.com _vercel/insights _vercel/speed-insights -->
</head><body></body></html>`;
  return { headers: PAGE_HEADERS, body: html };
}

function runAsync(args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const env: Record<string, string | undefined> = { ...process.env };
    delete env.ALLOW_PROD;
    const child = spawn('bash', [SCRIPT, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

describe('seo-check.sh against a local site', () => {
  test('expects ja + x-default hreflang, samples home + N, and does not follow redirects', async () => {
    const elsewhere = await serve({ '/': () => ({ body: 'elsewhere' }) });
    const locs = ['/', '/a', '/b', '/c', '/d', '/redirect'];
    const site = await serve({
      '/robots.txt': () => ({ body: 'User-agent: *\nSitemap: https://mirai-shigoto.com/sitemap.xml\n' }),
      '/sitemap.xml': () => ({ body: `<urlset>${['/a', '/', '/b', '/c', '/d', '/redirect']
        .map((p) => `<url><loc>https://mirai-shigoto.com${p}</loc></url>`).join('')}</urlset>` }),
      '/llms.txt': () => ({ body: 'Key facts' }),
      '/llms-full.txt': () => ({ body: 'methodology' }),
      ...Object.fromEntries(locs.filter((p) => p !== '/redirect').map((p) => [p, () => page(p)])),
      '/redirect': () => ({ status: 302, headers: { location: `${elsewhere.url}/` } }),
    });

    const sampled = await runAsync([site.url, '--sample', '2']);
    assert.match(sampled.stdout, /sampling: home \+ 2 of 5 other URLs/);
    assert.match(sampled.stdout, new RegExp(`== Page: ${site.url}/ ==`));
    assert.equal((sampled.stdout.match(/== Page: /g) ?? []).length, 3, sampled.stdout);
    assert.match(sampled.stdout, /hreflang: ja \+ x-default/);
    assert.doesNotMatch(sampled.stdout, /recommend 3|ja\/en/);

    const full = await runAsync([site.url]);
    assert.match(full.stdout, new RegExp(`== Page: ${site.url}/redirect ==[\\s\\S]*?HTTP 302`));
    assert.deepEqual(elsewhere.hits, []);
  });
});
