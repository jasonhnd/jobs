#!/usr/bin/env node
/**
 * capture-seo-baseline.cjs — write the SEO baseline to tests/baseline/.
 *
 * Walks dist-astro/ + public/ via scripts/lib/seo-extract.cjs and writes
 * deterministic files that form the SEO contract:
 *
 *   urls.txt              every public URL the site exposes
 *   sitemap.xml           verbatim sitemap
 *   image-sitemap.xml     verbatim image sitemap
 *   seo-metadata.jsonl    title / description / canonical / robots / h1
 *   og-meta.jsonl         every og:* and twitter:* tag
 *   json-ld.jsonl         parsed JSON-LD payloads (schema.org)
 *   internal-links.jsonl  every internal href + every anchor id
 *   data-files.txt        every public/data.* path (excl. Dropbox conflicts)
 *   capture-meta.json     git commit / branch / capture timestamp
 *
 * Run order:
 *   1. npm run build              (produces dist-astro/)
 *   2. npm run capture:seo-baseline
 *
 * Re-running OVERWRITES tests/baseline/. Commit only when you intend the
 * new baseline to become the new contract.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { captureBaseline } = require('./lib/seo-extract.cjs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-astro');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'tests', 'baseline');

if (!fs.existsSync(DIST)) {
  console.error('[capture-seo-baseline] ERROR — dist-astro/ not found. Run `npm run build` first.');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

console.log('[capture-seo-baseline] scanning', path.relative(ROOT, DIST));
const capture = captureBaseline(DIST, PUBLIC);
console.log(`[capture-seo-baseline] found ${capture.htmlFileCount} HTML files`);

function writeFile(name, contents) {
  fs.writeFileSync(path.join(OUT, name), contents);
  console.log(`[capture-seo-baseline] wrote tests/baseline/${name}`);
}

writeFile('urls.txt', capture.urls.join('\n') + '\n');
writeFile('seo-metadata.jsonl', capture.seoLines.join('\n') + '\n');
writeFile('og-meta.jsonl', capture.ogLines.join('\n') + '\n');
writeFile('json-ld.jsonl', capture.ldLines.join('\n') + '\n');
writeFile('internal-links.jsonl', capture.linkLines.join('\n') + '\n');
writeFile('data-files.txt', capture.dataFiles.join('\n') + '\n');

if (capture.sitemap) {
  writeFile('sitemap.xml', capture.sitemap);
} else {
  console.warn('[capture-seo-baseline] WARN — dist-astro/sitemap.xml missing');
}
if (capture.imageSitemap) {
  writeFile('image-sitemap.xml', capture.imageSitemap);
} else {
  console.warn('[capture-seo-baseline] WARN — dist-astro/image-sitemap.xml missing');
}

let gitCommit = 'unknown';
let gitBranch = 'unknown';
try {
  gitCommit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim();
} catch {}

const meta = {
  capturedAt: new Date().toISOString(),
  gitCommit,
  gitBranch,
  distFileCount: capture.htmlFileCount,
  urlCount: capture.urls.length,
  dataFileCount: capture.dataFiles.length,
  capturedBy: 'scripts/capture-seo-baseline.cjs',
};
writeFile('capture-meta.json', JSON.stringify(meta, null, 2) + '\n');

console.log('[capture-seo-baseline] done.');
console.log(`  URLs:          ${capture.urls.length}`);
console.log(`  HTML files:    ${capture.htmlFileCount}`);
console.log(`  Data files:    ${capture.dataFiles.length}`);
console.log(`  Commit:        ${gitCommit.slice(0, 12)}`);
console.log(`  Branch:        ${gitBranch}`);
