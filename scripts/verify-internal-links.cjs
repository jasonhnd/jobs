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

// Known-broken internal hrefs that the gate tolerates without
// failing. Currently empty — the initial 2026-05-13 snapshot of
// 36 broken hrefs all got fixed in the same commit by:
//   - extending normalizeHref to drop URLs with raw `<` `>` ` `
//     (1 false positive: `/ja/<id>` was inside an inline-script
//     doc comment, never a real link)
//   - filtering qa.related_topics in hub-hub-graph.ts to only
//     emit edges into actual QA_ITEMS slugs (fixed 33 cross-
//     genre stale references)
//   - dropping 2 dead CURATED_PAIRS entries that referenced
//     non-existent life-balance slugs
//
// Any new broken href that lands here fails the gate immediately.
// Use this set only as a deliberate, time-boxed escape hatch with
// a tracking comment.
const KNOWN_BROKEN_HREFS = new Set();

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

/** Normalize a raw href to its routable path + optional fragment:
 *    - Strip the SITE origin (already done by extractInternalLinks).
 *    - Strip query string but PRESERVE fragment in a separate field.
 *    Returns null if the href targets something not in scope.
 *    Returns { path, fragment } so the caller can validate the
 *    fragment against the target page's anchor id set.
 *    2026-05-17 C4 fix: fragments were previously stripped entirely,
 *    meaning broken `#section-foo` links to non-existent anchors
 *    slipped past the verifier silently. */
function normalizeHref(rawHref) {
  if (!rawHref || rawHref === '#') return null;
  if (rawHref.startsWith('#')) return null;        // intra-page anchor
  if (rawHref.startsWith('mailto:')) return null;
  if (rawHref.startsWith('tel:')) return null;
  if (rawHref.startsWith('javascript:')) return null;
  if (rawHref.includes('<') || rawHref.includes('>') || rawHref.includes(' ')) {
    return null;
  }
  let h = rawHref;
  if (h.startsWith(SITE)) h = h.slice(SITE.length) || '/';
  if (!h.startsWith('/')) return null;             // not internal
  const qIdx = h.indexOf('?');
  if (qIdx >= 0) h = h.slice(0, qIdx);
  let fragment = '';
  const hIdx = h.indexOf('#');
  if (hIdx >= 0) {
    fragment = h.slice(hIdx + 1);
    h = h.slice(0, hIdx);
  }
  return { path: h || '/', fragment };
}

/** Extract all `id="..."` anchor target ids from an HTML document.
 *  Used by the C4 fragment validator. Misses dynamically-generated
 *  ids (set by inline JS), which the verifier tolerates by treating
 *  any fragment in /map and /  as runtime-defined. */
function extractAnchorIds(html) {
  const ids = new Set();
  // Match id="..." and id='...'. Skip empty ids.
  const re = /\sid=(?:"([^"]+)"|'([^']+)')/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1] || m[2];
    if (id) ids.add(id);
  }
  return ids;
}

// 2026-05-17 C4: pages whose fragments are generated at runtime by
// inline JS rather than being present in the static HTML. Verifier
// can't statically prove these, so they're skipped for fragment
// validation only (the page itself is still validated).
const RUNTIME_FRAGMENT_PAGES = new Set([
  '/',          // squarified treemap hash deep-links (`#<occ_id>`)
  '/map',       // mobile treemap, same shape
]);

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

  // Pre-build a Map<url, Set<id>> of anchor ids per emitted page.
  // Used for C4 fragment validation. Done in a separate pass so the
  // main link-scan loop stays simple.
  const anchorIds = new Map(); // url → Set<id>
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    anchorIds.set(pathToUrl(f), extractAnchorIds(html));
  }

  // Scan every page for broken hrefs.
  const failures = new Map(); // href → Set<urlsThatLinkToIt>
  const fragmentFailures = new Map(); // 'url#frag' → Set<urlsThatLinkToIt>
  let totalHrefs = 0;
  let allowlistedHrefs = 0;
  let totalFragments = 0;

  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    const fromUrl = pathToUrl(f);
    const hrefs = extractInternalLinks(html);
    for (const raw of hrefs) {
      const parsed = normalizeHref(raw);
      if (parsed === null) continue;
      const { path: href, fragment } = parsed;
      totalHrefs += 1;
      if (isAllowlisted(href)) { allowlistedHrefs += 1; continue; }
      // Resolve the page path first.
      let pageOk = emitted.has(href);
      if (!pageOk && href.endsWith('/') && emitted.has(href.slice(0, -1))) pageOk = true;
      if (!pageOk) {
        if (!failures.has(href)) failures.set(href, new Set());
        failures.get(href).add(fromUrl);
        continue;
      }
      // Page exists. If the href carries a fragment, verify the
      // target page actually has an element with that id.
      // C4 (2026-05-17): previously the fragment was discarded and
      // dead anchor links (`/ja/156#dead-section`) shipped silently.
      if (fragment) {
        totalFragments += 1;
        if (RUNTIME_FRAGMENT_PAGES.has(href)) continue;
        const ids = anchorIds.get(href) || anchorIds.get(href + '/') ||
          anchorIds.get(href.replace(/\/$/, ''));
        if (!ids || !ids.has(fragment)) {
          const key = `${href}#${fragment}`;
          if (!fragmentFailures.has(key)) fragmentFailures.set(key, new Set());
          fragmentFailures.get(key).add(fromUrl);
        }
      }
    }
  }

  console.log(`[verify-internal-links] scanned ${htmlFiles.length} HTML files`);
  console.log(`[verify-internal-links] ${totalHrefs} internal hrefs (${allowlistedHrefs} allowlisted, ${totalFragments} with fragments)`);

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

  // C4 (2026-05-17): broken fragment anchors. Treated as warnings on
  // first introduction (so this commit doesn't fail CI for pre-existing
  // dead fragments). Promote to hard failures in a follow-up after
  // running once and triaging the initial list.
  if (fragmentFailures.size > 0) {
    console.warn(`\n⚠️  ${fragmentFailures.size} broken anchor fragment(s) — first-pass warning, not yet a hard fail:`);
    const sorted = [...fragmentFailures.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [key, sources] of sorted.slice(0, 30)) {
      const srcArr = [...sources];
      console.warn(`  ${key}`);
      console.warn(`    linked from: ${srcArr.slice(0, 2).join(', ')}${srcArr.length > 2 ? ` (and ${srcArr.length - 2} more)` : ''}`);
    }
    if (sorted.length > 30) {
      console.warn(`  ...and ${sorted.length - 30} more fragment failures (truncated)`);
    }
  }

  if (newBroken.length > 0 || stale.length > 0) {
    process.exit(1);
  }

  console.log(`\n✅ Internal-link integrity passed — every NEW href resolves; ${sawKnown.size} pre-known broken targets remain (TODO).`);
}

main();
