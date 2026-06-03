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

// ─── 2. PUBLIC_* env vars the codebase reads at build time ────────────────

/** Files (relative to repo root) that may reference PUBLIC_* env. */
const ENV_SCAN_FILES = [
  'src/layouts/BaseLayout.astro',
  // 2026-05-18 (RA-??): src/index-source.html was previously scanned because
  // the homepage bypassed BaseLayout and inlined its own analytics + env
  // hardcodes. After the BaseLayout migration, index-source.html is now
  // body-only (no env refs), so it's no longer in this list.
  // 2026-06-03 gates audit: middleware.ts reads PUBLIC_GA4_MEASUREMENT_ID via
  // process.env (it's an Edge function, not an Astro source) — without this
  // entry, removing that var from .env.example would slip past Step C and
  // also past Step D (which skips PUBLIC_* on the assumption Step C covered
  // it). The Step C regex below matches `process.env.PUBLIC_*` too.
  'middleware.ts',
  // Add new entry points here as they start reading PUBLIC_* env.
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
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
const publicEnvDeclared = new Set();
for (const match of envExample.matchAll(/^(PUBLIC_[A-Z0-9_]+)\s*=/gm)) {
  publicEnvDeclared.add(match[1]);
}

const publicEnvReferenced = new Set();
for (const file of ENV_SCAN_FILES) {
  let content;
  try {
    content = readFile(file);
  } catch (err) {
    violations.push(`Cannot read scan file ${file}: ${err.message}`);
    continue;
  }
  // Astro `.astro` files read PUBLIC_* via `import.meta.env`; Vercel Edge
  // functions (middleware.ts, api/*) read it via `process.env`. Match both
  // forms so the audit covers the full surface.
  for (const match of content.matchAll(/(?:import\.meta\.env|process\.env)\.(PUBLIC_[A-Z0-9_]+)/g)) {
    publicEnvReferenced.add(match[1]);
  }
}

for (const ref of publicEnvReferenced) {
  if (!publicEnvDeclared.has(ref)) {
    violations.push(
      `Code references ${ref} but .env.example does not document it.\n` +
      `    Add a "${ref}=" entry (with a comment explaining what it is) to .env.example.`,
    );
  }
}

// ─── Step D: assert middleware.ts has its env documented ──────────────────

const middleware = (() => {
  try {
    return readFile('middleware.ts');
  } catch {
    return null;
  }
})();
if (middleware) {
  for (const match of middleware.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    const name = match[1];
    if (name.startsWith('PUBLIC_')) {
      // Already covered by step C if it's in ENV_SCAN_FILES; skip here.
      continue;
    }
    if (!envExample.includes(`${name}=`)) {
      violations.push(
        `middleware.ts references process.env.${name} but .env.example does not document it.\n` +
        `    Add a "${name}=" entry to .env.example (server-only env, no PUBLIC_ prefix).`,
      );
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────────────

if (violations.length > 0) {
  fail(violations);
}

const checks = [
  `${REQUIRED_SCRIPT_SRC_ORIGINS.length} script-src origins ok`,
  `${REQUIRED_CONNECT_SRC_ORIGINS.length} connect-src origins ok`,
  `${publicEnvReferenced.size} PUBLIC_* env vars documented`,
];
console.log(`[check-analytics-config] OK — ${checks.join(', ')}.`);
process.exit(0);
