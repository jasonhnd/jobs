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
 * Allowlist: external origins, the bare `#` placeholder and mailto/tel/
 * javascript: schemes are intentionally not checked here. Same-site
 * absolute URLs (any http/https/www spelling) and relative hrefs are.
 *
 * Exit codes: 0 = every internal href resolves, 1 = ≥1 broken link.
 */

const fs = require('node:fs');
const path = require('node:path');
const { extractInternalLinks } = require('./lib/seo-extract.cjs');

const DIST_ROOT = path.resolve(process.cwd(), 'dist-astro');
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
  // 2026-05-17 cross-platform: normalize Windows backslashes to
  // POSIX slashes before stripping .html — URLs are always POSIX,
  // so without this `path.relative` on Windows produced URLs like
  // `/ja\yearly\2026-report` that never matched any href set.
  const rel = path.relative(DIST_ROOT, absPath).split(path.sep).join('/');
  const noExt = rel.replace(/\.html$/, '');
  if (noExt === 'index') return '/';
  if (noExt.endsWith('/index')) return '/' + noExt.slice(0, -'/index'.length);
  return '/' + noExt;
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // left encoded: it then matches nothing and is reported
  }
}

/** Normalize a raw href (as returned by extractInternalLinks, which already
 *  maps same-site absolute URLs onto paths) to its routable path + fragment:
 *    - Relative hrefs (`./x`, `../x`, `x`) resolve against the linking page,
 *      as a browser would against its clean URL (2026-10-07, #867 — they
 *      used to be skipped, so a broken relative link passed).
 *    - The query string is dropped; the fragment is kept in its own field so
 *      the caller can validate it against the target page's ids (C4).
 *    - Path and fragment are percent-decoded: emitted files and ids are
 *      named in plain UTF-8, and `/ja/%E8%81%B7` is the same page as `/ja/職`.
 *    Returns null if the href targets something not in scope. */
function normalizeHref(rawHref, fromUrl) {
  if (!rawHref || rawHref === '#') return null;
  // Intra-page anchor: routable path is the linking page itself. Returning
  // null here used to drop all 841 of them (834 of which are the `#main-content`
  // skip link) from validation entirely — the verifier reported on anchors
  // while checking none that actually existed. See issue #217.
  if (rawHref.startsWith('#')) return { path: null, fragment: safeDecode(rawHref.slice(1)) };
  if (/^[a-z][a-z\d+.-]*:/i.test(rawHref) || rawHref.startsWith('//')) return null; // not internal
  let url;
  try {
    url = new URL(rawHref, `https://internal.invalid${fromUrl}`);
  } catch {
    return { path: rawHref, fragment: '' };
  }
  return {
    path: safeDecode(url.pathname) || '/',
    fragment: safeDecode(url.hash.slice(1)),
  };
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

// Escape hatch for anchor fragments that are known-broken and not yet fixable.
// Deliberately empty: at the time fragments became a hard failure the build
// emitted zero broken ones, so there was no backlog to grandfather. Adding an
// entry here needs a linked issue — it is a ratchet, and it only goes one way.
// Format: 'url#fragment', e.g. '/ja/156#dead-section'.
const KNOWN_BROKEN_FRAGMENTS = new Set([]);

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

/* ─────────────────────── route collection ─────────────────────── */

function requireBuildOutput() {
  if (!fs.existsSync(DIST_ROOT)) {
    console.error(`[verify-internal-links] ${DIST_ROOT} does not exist. Run \`pnpm build\` first.`);
    process.exit(2);
  }
}

function collectEmittedUrls(htmlFiles) {
  // Build the emitted URL set from dist-astro filenames.
  const emitted = new Set();
  for (const f of htmlFiles) emitted.add(pathToUrl(f));

  // Also count static assets emitted under dist-astro/ (sitemap.xml,
  // image-sitemap.xml, llms.txt etc). Anything reachable as a file is
  // a valid internal href target.
  collectAssetUrls(DIST_ROOT, emitted);
  return emitted;
}

function collectAssetUrls(dir, emitted) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) collectAssetUrls(p, emitted);
    else if (ent.isFile() && !ent.name.endsWith('.html')) {
      // Cross-platform: normalize Windows backslashes to POSIX
      // slashes (URLs are always POSIX).
      const rel = path.relative(DIST_ROOT, p).split(path.sep).join('/');
      emitted.add('/' + rel);
    }
  }
}

function collectAnchorIds(htmlFiles) {
  // Pre-build a Map<url, Set<id>> of anchor ids per emitted page.
  // Used for C4 fragment validation. Done in a separate pass so the
  // main link-scan loop stays simple.
  const anchorIds = new Map(); // url → Set<id>
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    anchorIds.set(pathToUrl(f), extractAnchorIds(html));
  }
  return anchorIds;
}

/* ─────────────────────── link validation ─────────────────────── */

function pageTargetExists(href, emitted) {
  return emitted.has(href) ||
    (href.endsWith('/') && emitted.has(href.slice(0, -1)));
}

function recordFailure(failures, target, fromUrl) {
  if (!failures.has(target)) failures.set(target, new Set());
  failures.get(target).add(fromUrl);
}

function validateInternalHref(raw, fromUrl, { emitted, anchorIds }, result) {
  const parsed = normalizeHref(raw, fromUrl);
  if (parsed === null) return;
  // path === null marks an intra-page anchor: the target page is the page
  // we are scanning, so it trivially exists and only the fragment matters.
  const { path: rawPath, fragment } = parsed;
  const href = rawPath === null ? fromUrl : rawPath;
  result.totalHrefs += 1;
  if (isAllowlisted(href)) { result.allowlistedHrefs += 1; return; }
  // Resolve the page path first.
  if (!pageTargetExists(href, emitted)) {
    recordFailure(result.failures, href, fromUrl);
    return;
  }
  // Page exists. If the href carries a fragment, verify the
  // target page actually has an element with that id.
  // C4 (2026-05-17): previously the fragment was discarded and
  // dead anchor links (`/ja/156#dead-section`) shipped silently.
  if (fragment) {
    result.totalFragments += 1;
    if (RUNTIME_FRAGMENT_PAGES.has(href)) return;
    const ids = anchorIds.get(href) || anchorIds.get(href + '/') ||
      anchorIds.get(href.replace(/\/$/, ''));
    if (!ids || !ids.has(fragment)) {
      recordFailure(result.fragmentFailures, `${href}#${fragment}`, fromUrl);
    }
  }
}

function scanInternalLinks(htmlFiles, targets) {
  const result = {
    failures: new Map(), // href → Set<urlsThatLinkToIt>
    fragmentFailures: new Map(), // 'url#frag' → Set<urlsThatLinkToIt>
    totalHrefs: 0,
    allowlistedHrefs: 0,
    totalFragments: 0,
  };

  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    const fromUrl = pathToUrl(f);
    const hrefs = extractInternalLinks(html);
    for (const raw of hrefs) {
      validateInternalHref(raw, fromUrl, targets, result);
    }
  }
  return result;
}

/* ─────────────────────── failure reporting ─────────────────────── */

function classifyBrokenHrefs(failures) {
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
  return { newBroken, sawKnown, stale };
}

function reportKnownBrokenHrefs(sawKnown, stale) {
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
}

function reportNewBrokenHrefs(newBroken) {
  if (newBroken.length > 0) {
    console.error(`\n❌ ${newBroken.length} NEW broken internal href(s):\n`);
    for (const [href, sources] of newBroken.sort()) {
      const srcArr = [...sources];
      console.error(`  ${href}`);
      console.error(`    linked from: ${srcArr.slice(0, 3).join(', ')}${srcArr.length > 3 ? ` (and ${srcArr.length - 3} more)` : ''}`);
    }
  }
}

function reportBrokenFragments(fragmentFailures) {
  // C4 (2026-05-17): broken fragment anchors. Treated as warnings on
  // first introduction (so this commit doesn't fail CI for pre-existing
  // dead fragments). Promote to hard failures in a follow-up after
  // running once and triaging the initial list.
  // Broken fragments now fail the gate. They were a warning from the 2026-05-17
  // C4 pass ("not yet a hard fail"), which meant a dead anchor could ship and
  // stay shipped forever. The backlog this deferral existed for is empty — the
  // build emits zero broken fragments — so there is nothing to grandfather and
  // KNOWN_BROKEN_FRAGMENTS below stays empty. See issue #217.
  const newFragmentFailures = [...fragmentFailures.entries()]
    .filter(([key]) => !KNOWN_BROKEN_FRAGMENTS.has(key))
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (newFragmentFailures.length > 0) {
    console.error(`\n❌ ${newFragmentFailures.length} broken anchor fragment(s) — target id does not exist:`);
    for (const [key, sources] of newFragmentFailures.slice(0, 30)) {
      const srcArr = [...sources];
      console.error(`  ${key}`);
      console.error(`    linked from: ${srcArr.slice(0, 2).join(', ')}${srcArr.length > 2 ? ` (and ${srcArr.length - 2} more)` : ''}`);
    }
    if (newFragmentFailures.length > 30) {
      console.error(`  ...and ${newFragmentFailures.length - 30} more (truncated)`);
    }
    console.error('  Fix the link or the target id. If the id is created at runtime by inline JS,');
    console.error('  add the page to RUNTIME_FRAGMENT_PAGES instead of adding it to the allowlist.');
  }
  return newFragmentFailures;
}

function reportResult(htmlFiles, { failures, fragmentFailures, totalHrefs, allowlistedHrefs, totalFragments }) {
  console.log(`[verify-internal-links] scanned ${htmlFiles.length} HTML files`);
  console.log(`[verify-internal-links] ${totalHrefs} internal hrefs (${allowlistedHrefs} allowlisted, ${totalFragments} with fragments)`);

  const { newBroken, sawKnown, stale } = classifyBrokenHrefs(failures);
  reportKnownBrokenHrefs(sawKnown, stale);
  reportNewBrokenHrefs(newBroken);
  const newFragmentFailures = reportBrokenFragments(fragmentFailures);

  if (newBroken.length > 0 || stale.length > 0 || newFragmentFailures.length > 0) {
    process.exit(1);
  }

  console.log(`\n✅ Internal-link integrity passed — every NEW href resolves; ${sawKnown.size} pre-known broken targets remain (TODO).`);
}

function main() {
  requireBuildOutput();
  const htmlFiles = walkHtmlFiles(DIST_ROOT);
  // A build directory with no pages would otherwise pass with "0 internal
  // hrefs" — the gate must not go green while checking nothing.
  if (htmlFiles.length === 0) {
    console.error(`[verify-internal-links] ${DIST_ROOT} contains no HTML files. Run \`bun run build\` first.`);
    process.exit(1);
  }
  const emitted = collectEmittedUrls(htmlFiles);
  const anchorIds = collectAnchorIds(htmlFiles);
  const result = scanInternalLinks(htmlFiles, { emitted, anchorIds });
  reportResult(htmlFiles, result);
}

main();
