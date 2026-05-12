#!/usr/bin/env node
/**
 * Compare current build JSON-LD against baseline for a single URL.
 * Usage: node scripts/jsonld-diff.cjs [URL]    e.g. /ja/1
 */
const { extractJsonLd } = require('./lib/seo-extract.cjs');
const fs = require('node:fs');

const target = process.argv[2] || '/ja/1';
// Paths are dist-astro/ja/{id}.html (not directory + index.html).
const htmlPath = `dist-astro${target}.html`;
const html = fs.readFileSync(htmlPath, 'utf8');
const cur = extractJsonLd(html);

const baseline = fs
  .readFileSync('tests/baseline/json-ld.jsonl', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(JSON.parse)
  .find((o) => o.url === target);

if (!baseline) {
  console.error(`No baseline for ${target}`);
  process.exit(1);
}
const base = baseline.ld;

function flat(o, p = '') {
  const out = {};
  for (const k of Object.keys(o ?? {})) {
    const v = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flat(v, p + k + '.'));
    } else {
      out[p + k] = JSON.stringify(v);
    }
  }
  return out;
}

function byType(g) {
  return Object.fromEntries((g['@graph'] || []).map((n) => [n['@type'], n]));
}

const A = byType(cur);
const B = byType(base);
const allTypes = new Set([...Object.keys(A), ...Object.keys(B)]);
let diffs = 0;
for (const t of allTypes) {
  const sa = JSON.stringify(A[t]);
  const sb = JSON.stringify(B[t]);
  if (sa !== sb) {
    diffs++;
    console.log(`[${t}] full payload diff`);
    console.log(`  base: ${sb}`);
    console.log(`  cur:  ${sa}`);
  }
}
const curFlat = JSON.stringify(cur);
const baseFlat = JSON.stringify(base);
if (curFlat !== baseFlat) {
  console.log(`[whole graph] full diff (also overall structure):`);
  console.log(`  base length: ${baseFlat.length}`);
  console.log(`  cur length:  ${curFlat.length}`);
}
console.log(`---\n${diffs} type-level diffs on ${target}`);
