#!/usr/bin/env node
/**
 * check-analytics-config.cjs — pre-build consistency guard for the
 * analytics/CSP/env triple.
 *
 * Catches the failure modes that took down GA4 on 2026-05-11:
 *
 *   1. Code references `https://foo.com/bar` in a <script src=...> or
 *      a `fetch(...)` call, but vercel.json CSP doesn't list `foo.com`
 *      in `script-src` / `connect-src`. Browser silently blocks → no data.
 *
 *   2. Code reads `import.meta.env.PUBLIC_XYZ` but `.env.example`
 *      doesn't document `PUBLIC_XYZ`. Future deploys will have undocumented
 *      env dependencies that nobody knows how to configure.
 *
 * Runs as the FIRST step of `npm run build`. Exits non-zero on any
 * violation so CI / `pnpm run build` fails BEFORE astro renders any HTML.
 *
 * Pure node:fs — adds no dependencies (mirrors check-lockfile-sync.cjs
 * convention). Parses CSP via string scanning, not full grammar — the
 * patterns we care about are simple `https://host` tokens.
 */
const fs = require('node:fs');
const path = require('node:path');
const { walkFiles } = require('./lib/walk-files.cjs');

const ROOT = path.resolve(__dirname, '..');

// ─── 1. Hard-coded list of analytics origins each code surface references ─

/**
 * Origins that source files reference today. The source-of-truth for
 * this list is grep'ing the codebase, but we hard-code here for the
 * check to stay zero-deps and not have to walk every file. If you add
 * a new tracker, add its origins here AND in vercel.json CSP.
 */
const REQUIRED_SCRIPT_SRC_ORIGINS = [
  // GA4 (gtag.js loaded dynamically in BaseLayout.astro + src/index-source.html)
  'https://*.googletagmanager.com',
  'https://www.google-analytics.com',
  // Cloudflare Web Analytics
  'https://static.cloudflareinsights.com',
  // Vercel Web Analytics + Speed Insights (first-party path, but still listed)
  'https://va.vercel-scripts.com',
  // X (Twitter) Ads pixel
  'https://static.ads-twitter.com',
  // Meta (Facebook/Instagram) Pixel — fbevents.js
  'https://connect.facebook.net',
];

const REQUIRED_CONNECT_SRC_ORIGINS = [
  // GA4 collect endpoints
  'https://*.google-analytics.com',
  'https://www.googletagmanager.com',
  // Google Ads conversion + remarketing beacons (gtag config('AW-…'))
  'https://googleads.g.doubleclick.net',
  'https://www.googleadservices.com',
  // Cloudflare Web Analytics report
  'https://cloudflareinsights.com',
  'https://*.cloudflareinsights.com',
  // Vercel Speed Insights vitals
  'https://vitals.vercel-insights.com',
  // X Ads tracking
  'https://analytics.twitter.com',
  'https://t.co',
  // Meta Pixel tracking + signals endpoints
  'https://www.facebook.com',
  'https://connect.facebook.net',
];

const REQUIRED_FRAME_SRC_ORIGINS = [];

// ─── 2. PUBLIC_* env vars the codebase reads at build time ────────────────

/**
 * Where PUBLIC_* env can be read. Every source file under these roots is
 * scanned, not a hand-kept list: until #862 only BaseLayout.astro and
 * middleware.ts were read, so a PUBLIC_* read in src/lib/middleware/ or api/
 * could ship without an .env.example entry.
 */
const PUBLIC_ENV_SCAN_ROOTS = ['src', 'api', 'middleware.ts'];

/**
 * The runtime server surface (Vercel Functions and Routing Middleware). Its
 * server-only env must be documented too. Build-time knobs read by src/data
 * or src/lib (BUILD_DATA_*, ALLOW_PARTIAL_DATA) are not deployment env, so
 * they are outside this list on purpose.
 */
const SERVER_ENV_SCAN_ROOTS = ['middleware.ts', 'api', 'src/lib/middleware'];

const SOURCE_EXT = /\.(?:ts|tsx|js|jsx|mjs|cjs|astro|html)$/;

/** `import.meta.env.NAME`, `process.env.NAME`, and `process.env['NAME']`. */
const ENV_READ = /(?:import\.meta\.env|process\.env)(?:\.([A-Z][A-Z0-9_]*)|\[\s*['"`]([A-Z][A-Z0-9_]*)['"`]\s*\])/g;

// ─── Helpers ──────────────────────────────────────────────────────────────

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/**
 * Repo-relative source files under `roots`; tests excluded. A root with a
 * source extension is a single file (always included, so a missing one fails
 * when it is read); any other root is a directory, skipped if absent.
 */
function sourceFiles(roots) {
  const out = [];
  for (const root of roots) {
    if (SOURCE_EXT.test(root)) {
      out.push(root);
      continue;
    }
    let files;
    try {
      files = walkFiles(path.join(ROOT, root), { ext: SOURCE_EXT, skip: new Set(['node_modules']) });
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    for (const file of files) {
      if (!/\.test\./.test(file)) out.push(path.relative(ROOT, file));
    }
  }
  return [...new Set(out)].sort();
}

/**
 * Env names each file reads, as [file, name] pairs. A file that cannot be
 * read fails the guard with its error code only — the message may carry
 * file contents or paths that do not belong in a build log.
 */
function envReads(files) {
  const reads = [];
  for (const file of files) {
    let content;
    try {
      content = readFile(file);
    } catch (err) {
      fail([`Cannot read required ${file} for env checks (${err.code || 'read error'}).`]);
    }
    for (const match of content.matchAll(ENV_READ)) reads.push([file, match[1] || match[2]]);
  }
  return reads;
}

function fail(messages) {
  console.error('[check-analytics-config] FAIL');
  for (const m of messages) console.error(`  • ${m}`);
  console.error('');
  console.error('  This guard is documented in scripts/check-analytics-config.cjs.');
  console.error('  Background: prevents the 2026-05-11 GA4 outage class of regression.');
  process.exit(1);
}

// ─── Step A: parse vercel.json CSP ────────────────────────────────────────

const vercelJson = JSON.parse(readFile('vercel.json'));
const cspEntry = vercelJson.headers
  ?.find((h) => h.source === '/(.*)')?.headers
  ?.find((kv) => kv.key === 'Content-Security-Policy');
if (!cspEntry) {
  fail(['vercel.json missing Content-Security-Policy header on /(.*) route.']);
}

const cspValue = cspEntry.value;
const cspDirectives = new Map();
for (const part of cspValue.split(';').map((s) => s.trim()).filter(Boolean)) {
  const [name, ...sources] = part.split(/\s+/);
  cspDirectives.set(name, sources);
}

// ─── Step B: assert every required origin is in CSP ──────────────────────

const violations = [];

function checkDirective(directiveName, requiredOrigins) {
  const got = cspDirectives.get(directiveName) ?? [];
  for (const origin of requiredOrigins) {
    if (!got.includes(origin)) {
      violations.push(
        `CSP ${directiveName} missing required analytics origin: ${origin}\n` +
        `    Add it to vercel.json's "Content-Security-Policy" value.\n` +
        `    Current ${directiveName}: ${got.join(' ')}`,
      );
    }
  }
}

checkDirective('script-src', REQUIRED_SCRIPT_SRC_ORIGINS);
checkDirective('connect-src', REQUIRED_CONNECT_SRC_ORIGINS);
checkDirective('frame-src', REQUIRED_FRAME_SRC_ORIGINS);

// ─── Step B.5: CODE-012 — script-src must NOT include 'unsafe-inline' ─────
// Inline scripts are pinned by SHA-256 hashes computed in
// scripts/compute-csp-hashes.cjs. If 'unsafe-inline' creeps back in (e.g. a
// developer reverted the hardening to debug something), fail loudly.
const scriptSrcTokens = cspDirectives.get('script-src') ?? [];
if (scriptSrcTokens.includes("'unsafe-inline'")) {
  violations.push(
    `CSP script-src contains 'unsafe-inline' (CODE-012 regression).\n` +
    `    Inline scripts must be hashed via scripts/compute-csp-hashes.cjs.\n` +
    `    If you must temporarily re-enable 'unsafe-inline' to debug, also\n` +
    `    update this guard so the build still passes — but DO NOT ship it.`,
  );
}

// ─── Step C: every PUBLIC_* env referenced in code is in .env.example ─────

const envExample = readFile('.env.example');
// A name counts as documented only on its own `NAME=` line. A substring test
// let `GA4_MP_API_SECRET=` document `API_SECRET`, and `# NAME=` (commented
// out) document `NAME`.
const envDeclared = new Set();
for (const match of envExample.matchAll(/^([A-Z][A-Z0-9_]*)\s*=/gm)) {
  envDeclared.add(match[1]);
}

// middleware.ts is the one file this guard cannot run without.
try {
  readFile('middleware.ts');
} catch (err) {
  fail([`Cannot read required middleware.ts for server env checks (${err.code || 'read error'}).`]);
}

const publicEnvReferenced = new Set();
for (const [, name] of envReads(sourceFiles(PUBLIC_ENV_SCAN_ROOTS))) {
  if (name.startsWith('PUBLIC_')) publicEnvReferenced.add(name);
}

for (const ref of publicEnvReferenced) {
  if (!envDeclared.has(ref)) {
    violations.push(
      `Code references ${ref} but .env.example does not document it.\n` +
      `    Add a "${ref}=" entry (with a comment explaining what it is) to .env.example.`,
    );
  }
}

// ─── Step D: server-only env of the runtime surface is documented ─────────

const reportedServerEnv = new Set();
for (const [file, name] of envReads(sourceFiles(SERVER_ENV_SCAN_ROOTS))) {
  // PUBLIC_* is covered by step C.
  if (name.startsWith('PUBLIC_') || envDeclared.has(name)) continue;
  const key = `${file}|${name}`;
  if (reportedServerEnv.has(key)) continue;
  reportedServerEnv.add(key);
  violations.push(
    `${file} references process.env.${name} but .env.example does not document it.\n` +
    `    Add a "${name}=" entry to .env.example (server-only env, no PUBLIC_ prefix).`,
  );
}

// ─── Report ──────────────────────────────────────────────────────────────

if (violations.length > 0) {
  fail(violations);
}

const checks = [
  `${REQUIRED_SCRIPT_SRC_ORIGINS.length} script-src origins ok`,
  `${REQUIRED_CONNECT_SRC_ORIGINS.length} connect-src origins ok`,
  `${REQUIRED_FRAME_SRC_ORIGINS.length} frame-src origins ok`,
  `${publicEnvReferenced.size} PUBLIC_* env vars documented`,
];
console.log(`[check-analytics-config] OK — ${checks.join(', ')}.`);
process.exit(0);
