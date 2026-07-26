#!/usr/bin/env node
/**
 * diff-seo-baseline.cjs — compare current dist-astro/ + public/ against
 * the committed tests/baseline/.
 *
 * Reports EXACTLY what changed:
 *   - URLs added / removed
 *   - data files added / removed
 *   - per-URL field changes (title, description, canonical, robots, h1)
 *   - per-URL og:* / twitter:* key changes
 *   - per-URL JSON-LD diffs (whole-payload semantic equality)
 *   - per-URL internal-link or anchor-id changes
 *   - sitemap.xml + image-sitemap.xml line diffs
 *
 * Run order:
 *   1. npm run build              (produces dist-astro/)
 *   2. npm run check:seo-baseline
 *
 * Exits 0 if clean, 1 if any drift detected.
 *
 * Intentional changes:
 *   When a URL change is intended (new page, retired page, renamed slug),
 *   run capture-seo-baseline.cjs to refresh the baseline and commit the
 *   diff with a CHANGELOG note explaining why. A baseline diff committed
 *   without explanation is a code review red flag.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { captureBaseline } = require('./lib/seo-extract.cjs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-astro');
const PUBLIC = path.join(ROOT, 'public');
const BASELINE = path.join(ROOT, 'tests', 'baseline');

const MAX_REPORTED = 30; // cap noisy diff lists; total counts always shown

if (!fs.existsSync(DIST)) {
  console.error('[diff-seo-baseline] ERROR — dist-astro/ not found. Run `npm run build` first.');
  process.exit(1);
}
if (!fs.existsSync(BASELINE)) {
  console.error('[diff-seo-baseline] ERROR — tests/baseline/ not found. Run capture-seo-baseline.cjs first.');
  process.exit(1);
}

// ─── baseline completeness ───────────────────────────────────────
// Every JSONL section below keys the baseline by URL and skips URLs it cannot
// find (`if (!base) continue` — additions are reported by the URL-set section).
// A missing or empty baseline file therefore made the whole section vacuous:
// zero comparisons, zero changes, a green ✓. Checking the manifest up front is
// what stops the gate from passing while comparing nothing. See issue #217.
const REQUIRED_BASELINE_FILES = [
  'urls.txt',
  'data-files.txt',
  'seo-metadata.jsonl',
  'og-meta.jsonl',
  'json-ld.jsonl',
  'internal-links.jsonl',
  'sitemap.xml',
  'image-sitemap.xml',
];

{
  const problems = [];
  for (const name of REQUIRED_BASELINE_FILES) {
    const p = path.join(BASELINE, name);
    if (!fs.existsSync(p)) {
      problems.push(`${name} — missing`);
    } else if (fs.statSync(p).size === 0) {
      problems.push(`${name} — empty`);
    }
  }
  if (problems.length > 0) {
    console.error('[diff-seo-baseline] ERROR — the committed SEO baseline is incomplete:');
    for (const problem of problems) console.error(`    ${problem}`);
    console.error('  A missing or empty baseline file passes vacuously, so this is fatal.');
    console.error('  Rebuild and re-capture: bun run build && bun run capture:seo-baseline');
    process.exit(1);
  }
}

// ─── helpers ─────────────────────────────────────────────────────

function readLines(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.length > 0);
}

function readText(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

// <lastmod> is stamped with the build date (src/views/sitemap.ts gives every
// entry `today`), so it changes on every build and is NOT a content signal.
// Normalize it out before diffing so the gate flags only real sitemap drift
// (added/removed URLs, changed priority/changefreq) — without this the SEO
// gate would false-fail on every new calendar day.
function normalizeSitemap(text) {
  return text === null ? null : text.replace(/<lastmod>[^<]*<\/lastmod>/g, '<lastmod>DATE</lastmod>');
}

function setDiff(currentArr, baselineArr) {
  const cur = new Set(currentArr);
  const base = new Set(baselineArr);
  const added = [...cur].filter((x) => !base.has(x)).sort();
  const removed = [...base].filter((x) => !cur.has(x)).sort();
  return { added, removed };
}

// A corrupt line used to be a warning: the affected URL was dropped from the
// map, so drift on it silently became undetectable. Treat it as fatal — a
// baseline that cannot be parsed is not a baseline.
function jsonlToMap(lines, source) {
  const out = new Map();
  lines.forEach((line, index) => {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (err) {
      console.error(`[diff-seo-baseline] ERROR — ${source} line ${index + 1} is not valid JSON: ${err.message}`);
      process.exit(1);
    }
    if (obj && typeof obj.url === 'string') out.set(obj.url, obj);
  });
  return out;
}

// Number of URLs actually compared. Reported per section so a comparison that
// covers nothing is visible in the log instead of reading as a clean pass.
function countCompared(curMap, baseMap) {
  let n = 0;
  for (const url of curMap.keys()) if (baseMap.has(url)) n += 1;
  return n;
}

function reportList(label, items) {
  if (items.length === 0) return;
  console.log(`  ${label} (${items.length}):`);
  for (const it of items.slice(0, MAX_REPORTED)) console.log(`    ${it}`);
  if (items.length > MAX_REPORTED) console.log(`    … and ${items.length - MAX_REPORTED} more`);
}

function shortValue(v) {
  if (v === null || v === undefined) return String(v);
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}

// ─── re-capture current state ────────────────────────────────────

console.log('[diff-seo-baseline] capturing current dist-astro/ …');
const current = captureBaseline(DIST, PUBLIC);

let failed = false;
function fail(section, n) {
  console.log(`✗ ${section} — ${n} drift(s)`);
  failed = true;
}
function ok(section, detail) {
  console.log(`✓ ${section}${detail ? ` — ${detail}` : ''}`);
}

// Shared reporting for the four URL-keyed JSONL sections. Zero comparisons is
// a failure, not a pass: it means the baseline and the current build share no
// URLs at all, so nothing was actually checked.
function reportKeyedSection(section, file, compared, changes, changeLabel) {
  if (compared === 0) {
    console.log(`✗ ${section} — compared 0 URLs against ${file}; the comparison is vacuous`);
    failed = true;
    return;
  }
  if (changes.length === 0) {
    ok(`${section} (${file})`, `${compared} URLs compared`);
    return;
  }
  console.log(`\n— ${section} drift — (${compared} URLs compared)`);
  reportList(changeLabel, changes);
  fail(section, changes.length);
}

// ─── 1. URL set ──────────────────────────────────────────────────

{
  const baseUrls = readLines(path.join(BASELINE, 'urls.txt'));
  const { added, removed } = setDiff(current.urls, baseUrls);
  if (added.length === 0 && removed.length === 0) {
    ok('URL set (urls.txt)', `${baseUrls.length} URLs`);
  } else {
    console.log(`\n— URL set drift —`);
    reportList('URLs ADDED   (in current, not in baseline)', added);
    reportList('URLs REMOVED (in baseline, not in current)', removed);
    fail('URL set', added.length + removed.length);
  }
}

// ─── 2. data file paths ──────────────────────────────────────────

{
  const baseFiles = readLines(path.join(BASELINE, 'data-files.txt'));
  const { added, removed } = setDiff(current.dataFiles, baseFiles);
  if (added.length === 0 && removed.length === 0) {
    ok('data file paths (data-files.txt)', `${baseFiles.length} files`);
  } else {
    console.log(`\n— data file paths drift —`);
    reportList('files ADDED', added);
    reportList('files REMOVED', removed);
    fail('data file paths', added.length + removed.length);
  }
}

// ─── 3. sitemap.xml + image-sitemap.xml ──────────────────────────

for (const name of ['sitemap.xml', 'image-sitemap.xml']) {
  const baseText = normalizeSitemap(readText(path.join(BASELINE, name)));
  const curText = normalizeSitemap(name === 'sitemap.xml' ? current.sitemap : current.imageSitemap);
  // baseText cannot be null: REQUIRED_BASELINE_FILES guarantees both sitemaps
  // are present and non-empty. The old `both absent → ok` branch let a build
  // that stopped emitting a sitemap pass as soon as someone re-captured the
  // baseline, which is the documented remediation — a silent ratchet-down.
  if (curText === null) {
    console.log(`\n— ${name} drift —`);
    console.log(`  present in baseline, missing from dist-astro/`);
    fail(name, 1);
    continue;
  }
  if (baseText === curText) {
    ok(name, `${baseText.split('\n').length} lines`);
    continue;
  }
  console.log(`\n— ${name} drift —`);
  const baseLines = (baseText || '').split('\n');
  const curLines = (curText || '').split('\n');
  const { added, removed } = setDiff(curLines, baseLines);
  reportList('lines ADDED', added);
  reportList('lines REMOVED', removed);
  fail(name, added.length + removed.length);
}

// ─── 4. seo-metadata.jsonl (field-level diff per URL) ────────────

{
  const baseMap = jsonlToMap(readLines(path.join(BASELINE, 'seo-metadata.jsonl')), 'baseline seo-metadata.jsonl');
  const curMap = jsonlToMap(current.seoLines, 'current seo-metadata');
  const changes = [];
  for (const [url, cur] of curMap.entries()) {
    const base = baseMap.get(url);
    if (!base) continue; // URL set diff already reports adds
    for (const field of ['title', 'description', 'canonical', 'robots', 'keywords']) {
      if (cur[field] !== base[field]) {
        changes.push(`${url}  ${field}: ${shortValue(base[field])} → ${shortValue(cur[field])}`);
      }
    }
    const curH1 = JSON.stringify(cur.h1Texts);
    const baseH1 = JSON.stringify(base.h1Texts);
    if (curH1 !== baseH1) {
      changes.push(`${url}  h1Texts: ${shortValue(base.h1Texts)} → ${shortValue(cur.h1Texts)}`);
    }
  }
  reportKeyedSection(
    'SEO metadata', 'seo-metadata.jsonl',
    countCompared(curMap, baseMap), changes, 'field changes',
  );
}

// ─── 5. og-meta.jsonl (per-URL key + value diff) ─────────────────

{
  const baseMap = jsonlToMap(readLines(path.join(BASELINE, 'og-meta.jsonl')), 'baseline og-meta.jsonl');
  const curMap = jsonlToMap(current.ogLines, 'current og-meta');
  const changes = [];
  for (const [url, cur] of curMap.entries()) {
    const base = baseMap.get(url);
    if (!base) continue;
    for (const group of ['og', 'twitter']) {
      const baseKeys = base[group] || {};
      const curKeys = cur[group] || {};
      const allKeys = new Set([...Object.keys(baseKeys), ...Object.keys(curKeys)]);
      for (const k of allKeys) {
        if (baseKeys[k] !== curKeys[k]) {
          changes.push(`${url}  ${k}: ${shortValue(baseKeys[k])} → ${shortValue(curKeys[k])}`);
        }
      }
    }
  }
  reportKeyedSection(
    'OG / Twitter meta', 'og-meta.jsonl',
    countCompared(curMap, baseMap), changes, 'changes',
  );
}

// ─── 6. json-ld.jsonl (whole-payload semantic diff) ──────────────

{
  const baseMap = jsonlToMap(readLines(path.join(BASELINE, 'json-ld.jsonl')), 'baseline json-ld.jsonl');
  const curMap = jsonlToMap(current.ldLines, 'current json-ld');
  const changes = [];
  for (const [url, cur] of curMap.entries()) {
    const base = baseMap.get(url);
    if (!base) continue;
    const curStr = JSON.stringify(cur.ld);
    const baseStr = JSON.stringify(base.ld);
    if (curStr !== baseStr) {
      changes.push(`${url}  (JSON-LD payload changed — see raw .jsonl for full diff)`);
    }
  }
  reportKeyedSection(
    'JSON-LD', 'json-ld.jsonl',
    countCompared(curMap, baseMap), changes, 'URLs with JSON-LD changes',
  );
}

// ─── 7. internal-links.jsonl (set diff per URL) ──────────────────

{
  const baseMap = jsonlToMap(readLines(path.join(BASELINE, 'internal-links.jsonl')), 'baseline internal-links.jsonl');
  const curMap = jsonlToMap(current.linkLines, 'current internal-links');
  const changes = [];
  for (const [url, cur] of curMap.entries()) {
    const base = baseMap.get(url);
    if (!base) continue;
    const hrefDiff = setDiff(cur.internalHrefs || [], base.internalHrefs || []);
    const anchorDiff = setDiff(cur.anchorIds || [], base.anchorIds || []);
    if (hrefDiff.added.length || hrefDiff.removed.length) {
      changes.push(`${url}  hrefs: +${hrefDiff.added.length} / -${hrefDiff.removed.length}`);
    }
    if (anchorDiff.added.length || anchorDiff.removed.length) {
      changes.push(`${url}  anchors: +${anchorDiff.added.length} / -${anchorDiff.removed.length}`);
    }
  }
  reportKeyedSection(
    'internal links + anchors', 'internal-links.jsonl',
    countCompared(curMap, baseMap), changes, 'changes',
  );
}

// ─── summary ─────────────────────────────────────────────────────

console.log('');
if (failed) {
  console.log('❌ SEO baseline drift detected.');
  console.log('   If the changes are intentional:');
  console.log('     1. Document why in CHANGELOG');
  console.log('     2. Refresh: npm run capture:seo-baseline');
  console.log('     3. Commit the new baseline together with the code change');
  console.log('   If the changes are accidental: fix the code, do NOT refresh.');
  process.exit(1);
}
console.log('✅ SEO baseline clean — no drift.');
