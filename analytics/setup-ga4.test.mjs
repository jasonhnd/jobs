import { afterEach, describe, test } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { listKeyEvents, parseModes } from "./ga4-admin-helpers.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "setup-ga4.mjs");
const homes = [];
afterEach(() => {
  for (const dir of homes.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * Runs setup-ga4.mjs with an empty HOME and no credentials. Only --dry-run
 * modes are exercised: nothing here may reach the GA4 Admin API.
 */
function run(...args) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "jobs-setup-ga4-"));
  homes.push(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.GOOGLE_APPLICATION_CREDENTIALS;
  delete env.GA4_PROPERTY_ID;
  delete env.GA4_AUTH;
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", timeout: 20_000, env });
}

describe("setup-ga4.mjs local modes", () => {
  test("--dry-run validates the spec without authenticating", () => {
    const result = run("--dry-run");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /DRY RUN/);
    assert.doesNotMatch(result.stdout + result.stderr, /Authenticating|FATAL/);
  });

  test("--dry-run --check is refused with a clear message, not a TypeError", () => {
    const result = run("--dry-run", "--check");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--check and --dry-run cannot be combined/);
    assert.doesNotMatch(result.stderr, /TypeError|Cannot read properties of null/);
  });

  test("--discover --dry-run does not authenticate", () => {
    const result = run("--discover", "--dry-run");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /\[dry-run\] would list accessible accounts and properties/);
    assert.doesNotMatch(result.stdout + result.stderr, /Authenticating|No authentication configured|FATAL/);
  });
});

describe("parseModes", () => {
  test("reads the three flags", () => {
    assert.deepEqual(parseModes(["--check"]), { discover: false, dryRun: false, check: true });
    assert.deepEqual(parseModes(["--discover", "--dry-run"]), { discover: true, dryRun: true, check: false });
  });
});

describe("listKeyEvents", () => {
  const parent = "properties/1";
  const admin = (keyEventsList, conversionList = async () => ({ data: { conversionEvents: [{ eventName: "legacy" }] } })) => ({
    properties: { keyEvents: { list: keyEventsList }, conversionEvents: { list: conversionList } },
  });

  test("returns key events from the current API", async () => {
    const names = await listKeyEvents(admin(async () => ({ data: { keyEvents: [{ eventName: "a" }] } })), parent);
    assert.deepEqual(names, ["a"]);
  });

  test("falls back to conversionEvents only when keyEvents is not found", async () => {
    const notFound = Object.assign(new Error("Requested entity was not found."), { code: 404 });
    const names = await listKeyEvents(admin(async () => { throw notFound; }), parent);
    assert.deepEqual(names, ["legacy"]);
  });

  test("rethrows auth and permission errors instead of swallowing them", async () => {
    for (const [code, message] of [[401, "invalid_grant"], [403, "The caller does not have permission"]]) {
      const error = Object.assign(new Error(message), { code });
      let fellBack = false;
      await assert.rejects(
        listKeyEvents(admin(async () => { throw error; }, async () => { fellBack = true; return { data: {} }; }), parent),
        (thrown) => thrown === error,
      );
      assert.equal(fellBack, false);
    }
  });
});
