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

function jsonlToMap(lines) {
  const out = new Map();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj.url === 'string') out.set(obj.url, obj);
    } catch (err) {
      console.warn('[diff-seo-baseline] WARN — JSONL parse failed:', err.message);
    }
  }
  return out;
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
function ok(section) {
  console.log(`✓ ${section}`);
}

// ─── 1. URL set ──────────────────────────────────────────────────

{
  const baseUrls = readLines(path.join(BASELINE, 'urls.txt'));
  const { added, removed } = setDiff(current.urls, baseUrls);
  if (added.length === 0 && removed.length === 0) {
    ok('URL set (urls.txt)');
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
    ok('data file paths (data-files.txt)');
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
  if (baseText === null && curText === null) {
    ok(`${name} (both absent)`);
    continue;
  }
  if (baseText === curText) {
    ok(name);
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
  const baseMap = jsonlToMap(readLines(path.join(BASELINE, 'seo-metadata.jsonl')));
  const curMap = jsonlToMap(current.seoLines);
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
  if (changes.length === 0) {
    ok('SEO metadata (seo-metadata.jsonl)');
  } else {
    console.log(`\n— SEO metadata drift —`);
    reportList('field changes', changes);
    fail('SEO metadata', changes.length);
  }
}

// ─── 5. og-meta.jsonl (per-URL key + value diff) ─────────────────

{
  const baseMap = jsonlToMap(readLines(path.join(BASELINE, 'og-meta.jsonl')));
  const curMap = jsonlToMap(current.ogLines);
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
  if (changes.length === 0) {
    ok('OG / Twitter meta (og-meta.jsonl)');
  } else {
    console.log(`\n— OG / Twitter meta drift —`);
    reportList('changes', changes);
    fail('OG / Twitter meta', changes.length);
  }
}

// ─── 6. json-ld.jsonl (whole-payload semantic diff) ──────────────

{
  const baseMap = jsonlToMap(readLines(path.join(BASELINE, 'json-ld.jsonl')));
  const curMap = jsonlToMap(current.ldLines);
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
  if (changes.length === 0) {
    ok('JSON-LD (json-ld.jsonl)');
  } else {
    console.log(`\n— JSON-LD drift —`);
    reportList('URLs with JSON-LD changes', changes);
    fail('JSON-LD', changes.length);
  }
}

// ─── 7. internal-links.jsonl (set diff per URL) ──────────────────

{
  const baseMap = jsonlToMap(readLines(path.join(BASELINE, 'internal-links.jsonl')));
  const curMap = jsonlToMap(current.linkLines);
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
  if (changes.length === 0) {
    ok('internal links + anchors (internal-links.jsonl)');
  } else {
    console.log(`\n— internal links / anchors drift —`);
    reportList('changes', changes);
    fail('internal links / anchors', changes.length);
  }
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
