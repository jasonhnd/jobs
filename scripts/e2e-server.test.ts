// e2e-server.cjs hardening: bad %-escapes, sibling-directory prefix escape,
// loopback-only listen. The server runs from a temp copy with its own
// dist-astro/ fixture, on a free port.
import { after, before, describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as fs from 'node:fs';
import { createServer, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const SCRIPT = resolve(import.meta.dir, 'e2e-server.cjs');

let root = '';
let port = 0;
let child: ChildProcess | null = null;
let output = '';

const freePort = (): Promise<number> =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => done(typeof address === 'object' && address ? address.port : 0));
    });
  });

const get = (rawPath: string): Promise<{ status: number; body: string }> =>
  new Promise((done, fail) => {
    // `path` is sent verbatim, so malformed escapes reach the server as-is.
    const req = request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () => done({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', fail);
    req.end();
  });

before(async () => {
  root = mkdtempSync(join(tmpdir(), 'jobs-e2e-server-'));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(SCRIPT, join(root, 'scripts', 'e2e-server.cjs'));
  mkdirSync(join(root, 'dist-astro'));
  writeFileSync(join(root, 'dist-astro', 'index.html'), 'HOME');
  writeFileSync(join(root, 'dist-astro', '404.html'), 'NOT-FOUND');
  // A sibling whose name starts with "dist-astro" must not be reachable.
  mkdirSync(join(root, 'dist-astro-secret'));
  writeFileSync(join(root, 'dist-astro-secret', 'secret.txt'), 'SECRET');
  port = await freePort();
  child = spawn(process.execPath, [join(root, 'scripts', 'e2e-server.cjs')], {
    env: { ...process.env, E2E_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  const deadline = Date.now() + 10_000;
  while (!output.includes('serving') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  assert.match(output, /serving/, output);
});

after(() => {
  child?.kill('SIGKILL');
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('e2e-server request handling', () => {
  test('a malformed %-escape gets 400 and the server keeps serving', async () => {
    const bad = await get('/%E0%A4%A');
    assert.equal(bad.status, 400);
    const home = await get('/');
    assert.equal(home.status, 200);
    assert.equal(home.body, 'HOME');
    assert.equal(child?.exitCode, null, `server must still be running:\n${output}`);
  });

  test('an encoded ../ cannot reach a sibling directory that shares the dist-astro prefix', async () => {
    for (const path of ['/..%2Fdist-astro-secret%2Fsecret.txt', '/..%2F..%2Fdist-astro-secret%2Fsecret.txt']) {
      const res = await get(path);
      assert.equal(res.status, 404, path);
      assert.equal(res.body, 'NOT-FOUND', path);
    }
  });

  test('announces a loopback-only address', () => {
    assert.match(output, new RegExp(`http://127\\.0\\.0\\.1:${port}`));
  });
});

describe('e2e-server listen address', () => {
  test('listens on 127.0.0.1 only', () => {
    const calls: unknown[][] = [];
    runInNewContext(readFileSync(SCRIPT, 'utf8'), {
      __dirname: join(root || tmpdir(), 'scripts'),
      require: (name: string) =>
        name === 'node:http'
          ? { createServer: () => ({ listen: (...args: unknown[]) => calls.push(args) }) }
          : name === 'node:fs'
            ? fs
            : require(name),
      URL,
      process: { env: { E2E_PORT: '4999' } },
      console: { warn: () => {}, log: () => {} },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]![0], 4999);
    assert.equal(calls[0]![1], '127.0.0.1');
  });
});
