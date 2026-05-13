#!/usr/bin/env node
/**
 * verify-internal-links.cjs — every internal `<a href="…">` on the
 * built site must resolve to a real emitted file (or a known
 * non-HTML asset).
 *
 * The "broken internal link" bug class:
 *   - Hub page links to /ja/sectors/iryo, but that slug got renamed
 *     to /ja/sectors/healthcare. 404 stays unnoticed until a user
 *     clicks through OR Google Search Console reports it days later.
 *   - A view config typo emits /ja/skills/communicashion instead of
 *     /ja/skills/communication.
 *
 * Build-time check: walk dist-astro/ recursively for .html files,
 * extract every internal href, resolve against the actual emitted
 * URL set, fail loud on miss.
 *
 * Complements:
 *   - check:seo-baseline (drift detection on the URL set + anchors,
 *     but doesn't validate that every href POINTS into the set)
 *   - check:rendered-leaks (text leak detection — different bug class)
 *
 * Allowlist: external origins (http*://), anchor-only fragments (#x),
 * mailto/tel: schemes — these are intentionally not checked here.
 *
 * Exit codes: 0 = every internal href resolves, 1 = ≥1 broken link.
 */

const fs = require('node:fs');
const path = require('node:path');
const { extractInternalLinks } = require('./lib/seo-extract.cjs');

const DIST_ROOT = path.resolve(process.cwd(), 'dist-astro');
const SITE = 'https://mirai-shigoto.com';

// Hrefs allowed to point at routes we don't emit (proxied / API).
const HREF_PREFIX_ALLOWLIST = [
  '/api/og',   // OG endpoint (Vercel Edge function, served by api/og.tsx).
  '/data.',    // Static JSON dumps under public/data.*.json (build artifacts).
];

// Known-broken internal hrefs as of 2026-05-13. Captured here so the
// new gate ships green and prevents NEW broken links from accumulating;
// each entry is a real production bug that needs follow-up. The gate
// will fail loud if:
//   (a) a broken href appears that is NOT in this set (a new regression);
//   (b) a href in this set is no longer broken (entry should be deleted).
//
// TODOs for each entry — most are stale slug references in Q&A inline
// link copy (links to /ja/q/* slugs that were renamed) and one literal
// `/ja/<id>` placeholder leaking into the home-page render.
const KNOWN_BROKEN_HREFS = new Set([
  '/ja/<id>',                              // literal placeholder leaked from home-page template
  '/ja/life-balance/flex',                 // slug renamed; Q&A inline link stale
  '/ja/life-balance/remote-friendly',      // slug renamed
  '/ja/q/30s-early',
  '/ja/q/30s-late',
  '/ja/q/40s',
  '/ja/q/50s',
  '/ja/q/60s-shinia',
  '/ja/q/ai-augmented',
  '/ja/q/ai-frontier',
  '/ja/q/ai-resistant-craft',
  '/ja/q/ai-safe-high-demand',
  '/ja/q/ai-safe-interpersonal',
  '/ja/q/ai-safe-physical',
  '/ja/q/artistic',
  '/ja/q/career-change',
  '/ja/q/child-care-balance',
  '/ja/q/deductive-reasoning',
  '/ja/q/elderly-care-balance',
  '/ja/q/enterprising',
  '/ja/q/freelance-friendly',
  '/ja/q/health-friendly',
  '/ja/q/high-salary-high-demand',
  '/ja/q/high-school-careers',
  '/ja/q/investigative',
  '/ja/q/iryo-jimu-vs-ippan-jimu',
  '/ja/q/kyoshi-vs-hoikushi',
  '/ja/q/license-required',
  '/ja/q/mental-health-friendly',
  '/ja/q/no-school-required',
  '/ja/q/realistic',
  '/ja/q/self-employed-typical',
  '/ja/q/shinsotsu',
  '/ja/q/shufu-fukki',
  '/ja/q/social',
  '/ja/q/truck-vs-taxi',
]);

/* ─────────────────────────── helpers ─────────────────────────── */

function walkHtmlFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkHtmlFiles(p));
    } else if (ent.isFile() && ent.name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

function pathToUrl(absPath) {
  const rel = path.relative(DIST_ROOT, absPath);
  const noExt = rel.replace(/\.html$/, '');
  if (noExt === 'index') return '/';
  if (noExt.endsWith('/index')) return '/' + noExt.slice(0, -'/index'.length);
  return '/' + noExt;
}

/** Normalize a raw href to its routable path:
 *    - Strip the SITE origin (already done by extractInternalLinks).
 *    - Strip query string + fragment.
 *    - Trailing slash → drop for "/" preservation handled separately.
 *    Returns null if the href targets something not in scope. */
function normalizeHref(rawHref) {
  if (!rawHref || rawHref === '#') return null;
  if (rawHref.startsWith('#')) return null;        // intra-page anchor
  if (rawHref.startsWith('mailto:')) return null;
  if (rawHref.startsWith('tel:')) return null;
  if (rawHref.startsWith('javascript:')) return null;
  let h = rawHref;
  if (h.startsWith(SITE)) h = h.slice(SITE.length) || '/';
  if (!h.startsWith('/')) return null;             // not internal
  // Strip query + fragment.
  const qIdx = h.indexOf('?');
  if (qIdx >= 0) h = h.slice(0, qIdx);
  const hIdx = h.indexOf('#');
  if (hIdx >= 0) h = h.slice(0, hIdx);
  return h || '/';
}

/** Returns true if href matches a prefix-allowlist entry. */
function isAllowlisted(href) {
  for (const prefix of HREF_PREFIX_ALLOWLIST) {
    if (href.startsWith(prefix)) return true;
  }
  return false;
}

/* ─────────────────────────── main ─────────────────────────── */

function main() {
  if (!fs.existsSync(DIST_ROOT)) {
    console.error(`[verify-internal-links] ${DIST_ROOT} does not exist. Run \`pnpm build\` first.`);
    process.exit(2);
  }

  const htmlFiles = walkHtmlFiles(DIST_ROOT);

  // Build the emitted URL set from dist-astro filenames.
  const emitted = new Set();
  for (const f of htmlFiles) emitted.add(pathToUrl(f));

  // Also count static assets emitted under dist-astro/ (sitemap.xml,
  // image-sitemap.xml, llms.txt etc). Anything reachable as a file is
  // a valid internal href target.
  function walkAllFiles(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walkAllFiles(p);
      else if (ent.isFile() && !ent.name.endsWith('.html')) {
        const rel = path.relative(DIST_ROOT, p);
        emitted.add('/' + rel);
      }
    }
  }
  walkAllFiles(DIST_ROOT);

  // Scan every page for broken hrefs.
  const failures = new Map(); // href → Set<urlsThatLinkToIt>
  let totalHrefs = 0;
  let allowlistedHrefs = 0;

  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    const fromUrl = pathToUrl(f);
    const hrefs = extractInternalLinks(html);
    for (const raw of hrefs) {
      const href = normalizeHref(raw);
      if (href === null) continue;
      totalHrefs += 1;
      if (isAllowlisted(href)) { allowlistedHrefs += 1; continue; }
      if (emitted.has(href)) continue;
      // Try /x/ → /x (Astro emits flat .html files, but href may carry a
      // trailing slash from some templates).
      if (href.endsWith('/') && emitted.has(href.slice(0, -1))) continue;
      // Not found.
      if (!failures.has(href)) failures.set(href, new Set());
      failures.get(href).add(fromUrl);
    }
  }

  console.log(`[verify-internal-links] scanned ${htmlFiles.length} HTML files`);
  console.log(`[verify-internal-links] ${totalHrefs} internal hrefs (${allowlistedHrefs} allowlisted)`);

  // Split failures into (a) genuinely-new (gate fails) vs (b) already
  // known broken (logged as warning, gate stays green).
  const newBroken = [];
  const sawKnown = new Set();
  for (const [href, sources] of failures) {
    if (KNOWN_BROKEN_HREFS.has(href)) {
      sawKnown.add(href);
    } else {
      newBroken.push([href, sources]);
    }
  }

  // Stale KNOWN_BROKEN_HREFS entries (no longer broken). These should be
  // deleted from the set when the underlying bug is fixed.
  const stale = [...KNOWN_BROKEN_HREFS].filter((h) => !sawKnown.has(h));

  if (sawKnown.size > 0) {
    console.log(`\n⚠️  ${sawKnown.size} known-broken href(s) — entries pre-snapshotted as production bugs, NOT a regression:`);
    for (const href of [...sawKnown].sort()) {
      console.log(`    ${href}`);
    }
  }

  if (stale.length > 0) {
    console.error(`\n❌ ${stale.length} entries in KNOWN_BROKEN_HREFS are no longer broken — please remove from the set:`);
    for (const href of stale.sort()) {
      console.error(`    ${href}`);
    }
  }

  if (newBroken.length > 0) {
    console.error(`\n❌ ${newBroken.length} NEW broken internal href(s):\n`);
    for (const [href, sources] of newBroken.sort()) {
      const srcArr = [...sources];
      console.error(`  ${href}`);
      console.error(`    linked from: ${srcArr.slice(0, 3).join(', ')}${srcArr.length > 3 ? ` (and ${srcArr.length - 3} more)` : ''}`);
    }
  }

  if (newBroken.length > 0 || stale.length > 0) {
    process.exit(1);
  }

  console.log(`\n✅ Internal-link integrity passed — every NEW href resolves; ${sawKnown.size} pre-known broken targets remain (TODO).`);
}

main();
