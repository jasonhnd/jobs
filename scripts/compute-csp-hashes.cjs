#!/usr/bin/env node
/**
 * compute-csp-hashes.cjs — post-build step that replaces the
 * `'unsafe-inline'` placeholder in vercel.json's CSP script-src directive
 * with SHA-256 hashes of every inline <script> block that ships in
 * dist-astro/.
 *
 * Why we need this (CODE-012, 2026-05-17):
 *   The vercel.json CSP was previously:
 *     script-src 'self' 'unsafe-inline' …
 *   which means any attacker who can inject a <script> tag into the
 *   DOM (e.g. via stored XSS in a profile, share text, or comment
 *   field) gets immediate code execution. CSP best practice is to
 *   remove `'unsafe-inline'` and instead pin only the specific inline
 *   scripts we author by their SHA-256 hash.
 *
 *   The site is fully static (Astro SSG → dist-astro/). Per-request
 *   nonces aren't an option without re-streaming every HTML response
 *   through the Edge runtime, so we use the hash strategy. Every inline
 *   <script> in our templates was deliberately refactored to a STATIC
 *   body (no `define:vars`, no template interpolation) so the same
 *   script content appears verbatim across every page — one hash per
 *   unique block, ~5-10 hashes total cover all 821+ pages.
 *
 * Algorithm:
 *   1. Walk dist-astro/ for every *.html.
 *   2. Extract every inline <script> block (no src= attribute).
 *      JSON-LD blocks (<script type="application/ld+json">) are
 *      data-only, not executable, so we skip them.
 *   3. Compute SHA-256 (base64) of each unique block content.
 *   4. Build the CSP script-src directive value with all hashes.
 *   5. Read vercel.json, replace the `'unsafe-inline'` placeholder
 *      in script-src with the computed `'sha256-…'` list, and rewrite
 *      vercel.json with the new value. style-src keeps `'unsafe-inline'`
 *      because inline <style> blocks are per-page and CSS-only XSS
 *      isn't the audit's concern (per ~/.claude/rules/web/security.md).
 *
 * Verification:
 *   When `--check` is passed, the script exits non-zero if vercel.json
 *   would change — useful as a CI guard against drift between source
 *   inline scripts and the committed CSP. Without `--check`, it
 *   rewrites vercel.json in place.
 *
 * Runs as the LAST step of `npm run build`. Pure node:fs / node:crypto —
 * adds no dependencies.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-astro');
const VERCEL_JSON = path.join(ROOT, 'vercel.json');

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const CSP_ENV_GATED_INLINE_SCRIPT_VARS = [
  'PUBLIC_GA4_MEASUREMENT_ID',
  'PUBLIC_X_PIXEL_ID',
  'PUBLIC_META_PIXEL_ID',
];
// Single definition, shared with compute-csp-hashes.test.ts — see that module
// for why the list exists and how to refresh it.
const { CSP_ANALYTICS_FALLBACK_HASHES } = require('./lib/csp-analytics-manifest.cjs');
const { walkFiles } = require('./lib/walk-files.cjs');

function missingCspInlineScriptEnv() {
  return CSP_ENV_GATED_INLINE_SCRIPT_VARS.filter((name) => !process.env[name]);
}

function scriptSrcTokens(cspValue) {
  const scriptSrc = cspValue
    .split(';')
    .map((s) => s.trim())
    .find((dir) => dir.startsWith('script-src '));
  return scriptSrc ? scriptSrc.split(/\s+/).slice(1) : [];
}

function hashTokens(tokens) {
  return tokens.filter(
    (token) =>
      token.startsWith("'sha256-") ||
      token.startsWith("'sha384-") ||
      token.startsWith("'sha512-"),
  );
}

if (!fs.existsSync(DIST)) {
  console.error(
    '[compute-csp-hashes] FAIL — dist-astro/ not found. ' +
      'Run `astro build` before this step.',
  );
  process.exit(1);
}

// ─── Walk dist-astro/ for all *.html files ──────────────────────────────────
// No skip set: every HTML file under dist-astro/ is hashed. An unreadable
// path fails this step instead of dropping that file from the hash set.
let files;
try {
  files = walkFiles(DIST, { ext: /\.html$/ });
} catch (err) {
  console.error(`[compute-csp-hashes] FAIL — ${err.message}`);
  process.exit(1);
}
if (files.length === 0) {
  // An empty build must not rewrite the CSP down to the fallback list.
  console.error('[compute-csp-hashes] FAIL — no .html files found under dist-astro/. Run `astro build` first.');
  process.exit(1);
}

// ─── Extract inline <script> / <style> bodies ───────────────────────────────
// One left-to-right scan, in the order the browser's tokenizer reads the
// page. At each step the earliest of these wins:
//   * `<!--` — an HTML comment. Skip to its `-->`; with no `-->` the rest of
//     the document is a comment, so stop. `<script>` text written inside a
//     comment is therefore never hashed (browsers do not execute it).
//   * `<script …>` / `<style …>` — a raw-text element. Its body runs to the
//     first matching close tag and is taken verbatim; a `<!--` inside a body
//     (e.g. the JS string "<!--") is just text and does NOT start a comment.
// The previous approach computed comment ranges over the raw HTML first, so a
// script body holding "<!--" opened a phantom comment that could swallow the
// next real script and drop its hash (CSP would then block it).
const OPEN_RE = /<!--|<(script|style)\b([^>]*)>/g;
const CLOSE_TAG = { script: '</script>', style: '</style>' };

function scanInlineBlocks(html) {
  const scripts = [];
  const styles = [];
  let pos = 0;
  for (;;) {
    OPEN_RE.lastIndex = pos;
    const m = OPEN_RE.exec(html);
    if (m === null) break;
    if (m[0] === '<!--') {
      const end = html.indexOf('-->', m.index + 4);
      if (end < 0) break;
      pos = end + 3;
      continue;
    }
    const tag = m[1];
    const bodyStart = m.index + m[0].length;
    const close = html.indexOf(CLOSE_TAG[tag], bodyStart);
    if (close < 0) break;
    const block = { attrs: m[2] || '', body: html.slice(bodyStart, close) };
    (tag === 'script' ? scripts : styles).push(block);
    pos = close + CLOSE_TAG[tag].length;
  }
  return { scripts, styles };
}

function extractInlineScripts(html) {
  const blocks = [];
  for (const { attrs, body } of scanInlineBlocks(html).scripts) {
    // Skip external scripts — they're already covered by the host
    // allowlist in script-src.
    if (/\bsrc\s*=/.test(attrs)) continue;
    // Skip data-only blocks (JSON-LD).
    if (/\btype\s*=\s*["']application\/ld\+json["']/.test(attrs)) continue;
    if (/\btype\s*=\s*["']application\/json["']/.test(attrs)) continue;
    blocks.push(body);
  }
  return blocks;
}

function extractInlineStyles(html) {
  return scanInlineBlocks(html).styles.map(({ body }) => body);
}

// ─── Walk all pages, collect every unique inline script + style body ──────
const uniqueBodies = new Map();
const uniqueStyleBodies = new Map();
// Map<body-text, { hash: string, samplePage: string, occurrences: number }>
function collectInto(map, body, file) {
  const entry = map.get(body);
  if (entry) {
    entry.occurrences += 1;
  } else {
    const hash = crypto.createHash('sha256').update(body, 'utf-8').digest('base64');
    map.set(body, {
      hash,
      samplePage: path.relative(DIST, file),
      occurrences: 1,
    });
  }
}
for (const file of files) {
  const html = fs.readFileSync(file, 'utf-8');
  for (const body of extractInlineScripts(html)) collectInto(uniqueBodies, body, file);
  for (const body of extractInlineStyles(html)) collectInto(uniqueStyleBodies, body, file);
}

const computedHashes = [...uniqueBodies.values()].map((e) => `'sha256-${e.hash}'`);
const hashes = [...new Set([...computedHashes, ...CSP_ANALYTICS_FALLBACK_HASHES])];
const styleHashes = [...uniqueStyleBodies.values()].map((e) => `'sha256-${e.hash}'`);

if (hashes.length === 0 && styleHashes.length === 0) {
  console.log(
    '[compute-csp-hashes] No inline <script> or <style> blocks found in dist-astro/. ' +
      'Skipping CSP rewrite.',
  );
  process.exit(0);
}

// ─── Patch vercel.json's CSP script-src directive ───────────────────────────
// We deliberately operate on the raw JSON TEXT (regex replace) rather than
// parse→stringify so the original compact one-line-per-header formatting is
// preserved. JSON.stringify(_, null, 2) blows that up to 6 lines per header
// entry, producing massive churn diffs that obscure the CSP change.
const vercelRaw = fs.readFileSync(VERCEL_JSON, 'utf-8');
const vercel = JSON.parse(vercelRaw);

const cspEntry = vercel.headers
  ?.find((h) => h.source === '/(.*)' && !h.has)
  ?.headers?.find((kv) => kv.key === 'Content-Security-Policy');

if (!cspEntry) {
  console.error('[compute-csp-hashes] FAIL — vercel.json has no CSP entry on /(.*).');
  process.exit(1);
}

const csp = cspEntry.value;
const missingEnv = missingCspInlineScriptEnv();
const allCspInlineScriptEnvPresent = missingEnv.length === 0;

if (allCspInlineScriptEnvPresent) {
  const computedHashSet = new Set(computedHashes);
  const missingFallbackHashes = CSP_ANALYTICS_FALLBACK_HASHES.filter(
    (hash) => !computedHashSet.has(hash),
  );
  if (missingFallbackHashes.length > 0) {
    console.error(
      '[compute-csp-hashes] FAIL — analytics CSP fallback manifest is stale.\n' +
        '  These manifest hash(es) were not found in a full-PUBLIC_*-env build:\n' +
        '  ' +
        missingFallbackHashes.join('\n  ') +
        '\n  Regenerate CSP_ANALYTICS_FALLBACK_HASHES if the analytics inline scripts changed.',
    );
    process.exit(1);
  }
}

// Rebuild script-src with `'self'` + computed hashes + the existing host
// allowlist (everything in script-src that starts with https:// is kept
// verbatim). Remove any `'unsafe-inline'` and any existing `'sha256-…'`
// tokens so re-runs are idempotent.
const directives = csp.split(';').map((s) => s.trim()).filter(Boolean);
// NOTE: style-src is INTENTIONALLY left on 'unsafe-inline' for now. Hashing
// inline `<style>` blocks looks identical to hashing inline `<script>` blocks,
// but browsers normalise CSS text (whitespace, comment stripping, source-map
// directives) before applying the CSP hash check — so the SHA-256 the build
// computes from the raw byte stream rarely matches what the browser actually
// hashes, and the styles get refused. A 2026-06-04 attempt broke every page
// (`pre.mirai-shigoto.com` rendered unstyled) before it could be reverted.
// Until we use real CSS-text normalisation OR move all styles to external
// files / nonces, leave style-src on 'unsafe-inline'.
const updatedDirectives = directives.map((dir) => {
  const [name, ...rest] = dir.split(/\s+/);
  if (name !== 'script-src') return dir;
  const keepers = rest.filter(
    (t) =>
      t !== "'unsafe-inline'" &&
      !t.startsWith("'sha256-") &&
      !t.startsWith("'sha384-") &&
      !t.startsWith("'sha512-"),
  );
  // Sort hash list so output is deterministic across runs.
  const sortedHashes = [...hashes].sort();
  return ['script-src', ...keepers, ...sortedHashes].join(' ');
});

const newCsp = updatedDirectives.join('; ');
const updated = newCsp !== csp;

if (CHECK_ONLY) {
  if (updated) {
    const foundHashes = new Set(hashTokens(scriptSrcTokens(csp)));
    const expectedHashes = new Set(hashTokens(scriptSrcTokens(newCsp)));
    const missingExpectedHashes = [...expectedHashes].filter((hash) => !foundHashes.has(hash));
    const extraFoundHashes = [...foundHashes].filter((hash) => !expectedHashes.has(hash));
    console.error(
      '[compute-csp-hashes] DRIFT — vercel.json CSP script-src does not match\n' +
        '  hashes of inline scripts in dist-astro/.\n' +
        '  Re-run `node scripts/compute-csp-hashes.cjs` to regenerate.',
    );
    if (missingExpectedHashes.length > 0) {
      console.error('\nMissing expected hash(es):\n  ' + missingExpectedHashes.join('\n  '));
    }
    if (extraFoundHashes.length > 0) {
      console.error('\nStale/extra hash(es):\n  ' + extraFoundHashes.join('\n  '));
    }
    if (missingEnv.length > 0) {
      console.error(
        '\nAnalytics env absent: ' +
          missingEnv.join(', ') +
          '. The committed analytics fallback manifest is already included in the expected set; ' +
          'no other hash drift is allowed.',
      );
    }
    console.error('\nExpected (computed from dist-astro/):');
    console.error('  ' + newCsp);
    console.error('\nFound (in vercel.json):');
    console.error('  ' + csp);
    process.exit(1);
  }
  console.log(
    `[compute-csp-hashes] OK — script-src has ${hashes.length} inline-script ` +
      `hash(es) and matches dist-astro/.`,
  );
  process.exit(0);
}

if (!updated) {
  console.log(
    `[compute-csp-hashes] OK — script-src/style-src already up to date ` +
      `(${hashes.length} inline-script + ${styleHashes.length} inline-style ` +
      `hash(es), ${files.length} HTML files scanned).`,
  );
  process.exit(0);
}

// In-place TEXT replacement so we don't reformat the rest of vercel.json.
// Locate the original CSP value string in the file by exact match and
// substitute the new one. The CSP value contains no characters that would
// break JSON encoding (alphanumeric + `;:'/ -=*` only), so we can splice
// the raw value directly between the surrounding `"` quotes. Escape both
// the old and new value for use as a literal string inside regex / replace.
const oldEncoded = JSON.stringify(csp);   // includes surrounding quotes
const newEncoded = JSON.stringify(newCsp);
if (vercelRaw.indexOf(oldEncoded) === -1) {
  console.error(
    '[compute-csp-hashes] FAIL — could not locate the existing CSP value ' +
      'as an exact substring of vercel.json. The file may have been edited ' +
      'in a way that breaks this in-place substitution.',
  );
  process.exit(1);
}
const out = vercelRaw.replace(oldEncoded, newEncoded);
fs.writeFileSync(VERCEL_JSON, out, 'utf-8');

console.log(
  `[compute-csp-hashes] UPDATED vercel.json — script-src now has ` +
    `${hashes.length} script + style-src now has ${styleHashes.length} style ` +
    `'sha256-…' hash(es) (was: 'unsafe-inline').`,
);
console.log('\n  Unique inline scripts found:');
for (const [body, entry] of uniqueBodies) {
  const preview = body.replace(/\s+/g, ' ').trim().slice(0, 70);
  console.log(
    `    sha256-${entry.hash}\n` +
      `      ${entry.occurrences}× pages (sample: ${entry.samplePage})\n` +
      `      preview: ${preview}…`,
  );
}
if (uniqueStyleBodies.size > 0) {
  console.log('\n  Unique inline styles found:');
  for (const [body, entry] of uniqueStyleBodies) {
    const preview = body.replace(/\s+/g, ' ').trim().slice(0, 70);
    console.log(
      `    sha256-${entry.hash}\n` +
        `      ${entry.occurrences}× pages (sample: ${entry.samplePage})\n` +
        `      preview: ${preview}…`,
    );
  }
}
