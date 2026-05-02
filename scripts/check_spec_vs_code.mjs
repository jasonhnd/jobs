#!/usr/bin/env node
/**
 * check_spec_vs_code.mjs — verify analytics/spec.yaml stays in sync with
 * the actual gtag('event', ...) calls in index.html and build_occupations.py.
 *
 * Run:  npm run test:spec   (or)   node scripts/check_spec_vs_code.mjs
 *
 * Fails (exit 1) on any of:
 *   - event in spec marked NOT unimplemented but no emit found in code
 *   - emit in code but no entry in spec
 *
 * Events flagged `unimplemented: planned` in spec.yaml are tolerated as
 * "future intent" and don't fail the check, but they ARE listed.
 *
 * Sources scanned for emits:
 *   - index.html
 *   - scripts/build_occupations.py  (covers the 1,104 generated detail pages)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = resolve(REPO, "analytics/spec.yaml");
const SOURCES = ["index.html", "scripts/build_occupations.py"].map(p => resolve(REPO, p));

const spec = yaml.load(readFileSync(SPEC, "utf-8"));
const events = (spec && spec.events) || [];

const declared = new Map();
for (const e of events) declared.set(e.name, e);
const implemented = new Set([...declared.entries()].filter(([, e]) => !e.unimplemented).map(([n]) => n));
const flagged = new Set([...declared.entries()].filter(([, e]) => e.unimplemented).map(([n]) => n));

const emitRe = /gtag\(["']event["'],\s*["']([a-z_][a-z_0-9]*)["']/g;
// Also match the pattern: gtag("event", cond ? "X" : "Y", ...)
const ternaryRe = /gtag\(["']event["'],\s*[^,]+\?\s*["']([a-z_][a-z_0-9]*)["']\s*:\s*["']([a-z_][a-z_0-9]*)["']/g;

const emitted = new Set();
for (const path of SOURCES) {
  const text = readFileSync(path, "utf-8");
  for (const m of text.matchAll(emitRe)) emitted.add(m[1]);
  for (const m of text.matchAll(ternaryRe)) {
    emitted.add(m[1]);
    emitted.add(m[2]);
  }
}

const missing = [...implemented].filter(n => !emitted.has(n));
const extra = [...emitted].filter(n => !declared.has(n));

console.log(`Spec: ${declared.size} events declared (${implemented.size} live, ${flagged.size} unimplemented:planned)`);
console.log(`Code: ${emitted.size} distinct gtag emits found`);
if (flagged.size > 0) {
  console.log(`\nUnimplemented (tolerated): ${[...flagged].sort().join(", ")}`);
}

let failed = false;
if (missing.length) {
  failed = true;
  console.error(`\n✗ Spec lists ${missing.length} live events with no emit in code:`);
  for (const n of missing.sort()) console.error(`    - ${n}`);
}
if (extra.length) {
  failed = true;
  console.error(`\n✗ Code emits ${extra.length} events not declared in spec:`);
  for (const n of extra.sort()) console.error(`    - ${n}`);
}
if (failed) process.exit(1);

console.log("\n✓ spec ↔ code sync passes");
