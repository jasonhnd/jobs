import { afterEach, describe, test } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { startOAuthCallbackServer, writePrivateJson } from "./oauth-helpers.mjs";

const dirs = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function mode(file) {
  return fs.statSync(file).mode & 0o777;
}

function get(port, query) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/callback?${query}`, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    }).on("error", reject);
  });
}

describe("writePrivateJson", () => {
  test("tightens an existing 0644 file and 0755 directory to 0600 / 0700", () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "jobs-oauth-"));
    dirs.push(base);
    const dir = path.join(base, "config");
    const file = path.join(dir, "oauth-token.json");
    fs.mkdirSync(dir, { mode: 0o755 });
    fs.chmodSync(dir, 0o755);
    fs.writeFileSync(file, "{}", { mode: 0o644 });
    fs.chmodSync(file, 0o644);

    writePrivateJson(dir, file, { refresh_token: "r" });

    assert.equal(mode(dir), 0o700);
    assert.equal(mode(file), 0o600);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { refresh_token: "r" });
    assert.deepEqual(fs.readdirSync(dir), ["oauth-token.json"]); // no temp file left behind
  });
});

describe("startOAuthCallbackServer", () => {
  test("resolves the code for a callback with the issued state", async () => {
    const { port, code } = await startOAuthCallbackServer({ expectedState: "s1", timeoutMs: 5_000 });
    assert.equal(await get(port, "state=s1&code=abc"), 200);
    assert.equal(await code, "abc");
  });

  test("rejects a callback with a different state", async () => {
    const { port, code } = await startOAuthCallbackServer({ expectedState: "s1", timeoutMs: 5_000 });
    const rejected = assert.rejects(code, /state mismatch/);
    assert.equal(await get(port, "state=other&code=abc"), 400);
    await rejected;
  });

  test("gives up after the timeout instead of waiting forever", async () => {
    const { code } = await startOAuthCallbackServer({ expectedState: "s1", timeoutMs: 50 });
    await assert.rejects(code, /Timed out after 0\.05s waiting for the OAuth callback/);
  });

  test("reports a server error instead of crashing or hanging", async () => {
    const blocker = http.createServer();
    await new Promise((resolve) => blocker.listen(0, "127.0.0.1", resolve));
    try {
      await assert.rejects(
        startOAuthCallbackServer({ expectedState: "s1", timeoutMs: 5_000, port: blocker.address().port }),
        /EADDRINUSE|in use/,
      );
    } finally {
      blocker.close();
    }
  });
});
