#!/usr/bin/env node
/**
 * scripts/check-page-class.cjs — Page Class System 守護 (Design.md §18.7)
 *
 * 検証項目:
 *   1. ページの inline `<style>` ブロックに `:root{...}` 宣言が **含まれない**
 *      (canonical-css.ts が Footer.astro 経由で global emit するため)
 *   2. ページの inline `<style>` に `:root[data-theme]{...}` も含まれない
 *      (NEUTRALIZED 状態の dead code、Design.md §3.5)
 *   3. ページの inline `<style>` に `@media (prefers-color-scheme: ...)` の
 *      `:root` 上書きブロックが含まれない (同 NEUTRALIZED dead code)
 *
 * Exception リスト (interactive class):
 *   - src/pages/_index-css.ts
 *   - src/pages/_map-css.ts
 *   この 2 ファイルは独自の token (例: --shadow-card) を持つため canonical 化対象外。
 *
 * 違反検出時: console にレポート + exit 1。CI gate として package.json から呼ぶ。
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

// Interactive class — token を個別保持してよい (それぞれ Page class が "Interactive")
const EXCEPTIONS = new Set([
  'src/pages/_index-css.ts',
  'src/pages/_map-css.ts',
  'src/pages/_shindan-css.ts',
  // canonical-css.ts と canonical/*.ts は token / class CSS の正典そのもの
  'src/lib/canonical-css.ts',
  'src/lib/canonical/detail.ts',
  'src/lib/canonical/hub.ts',
  'src/lib/canonical/sector.ts',
  'src/lib/canonical/static.ts',
]);

/**
 * Walk a directory and return all .astro / .ts files (excluding tests).
 */
function walkSources(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSources(full, results);
    } else if (entry.isFile()) {
      const rel = path.relative(PROJECT_ROOT, full);
      if (rel.endsWith('.test.ts')) continue;
      if (rel.endsWith('.astro') || rel.endsWith('.ts')) {
        results.push(rel);
      }
    }
  }
  return results;
}

const VIOLATION_PATTERNS = [
  {
    name: ':root{} token re-declaration',
    regex: /^[ \t]*:root\s*{/m,
    hint: 'Tokens are emitted globally by canonical-css.ts via Footer.astro. Remove this :root{...} block.',
  },
  {
    name: ':root[data-theme] override block',
    regex: /:root\s*\[\s*data-theme/,
    hint: 'data-theme is NEUTRALIZED (Design.md §3). Remove this dead [data-theme] override.',
  },
  {
    name: '@media (prefers-color-scheme) :root override',
    regex: /@media\s*\([^)]*prefers-color-scheme[^)]*\)\s*{[\s\S]*?:root/,
    hint: 'prefers-color-scheme :root overrides are NEUTRALIZED dead code (Design.md §3.5). Remove.',
  },
];

function checkFile(relPath) {
  // 2026-05-17 CI medium fix: normalize Windows backslashes to POSIX
  // forward-slashes before comparing against EXCEPTIONS (which is
  // authored in POSIX form). Windows runs were getting false-positive
  // violations because `src\pages\_index-css.ts` !== `src/pages/_index-css.ts`.
  const posixRel = relPath.split(path.sep).join('/');
  if (EXCEPTIONS.has(posixRel)) return [];
  const content = fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf8');
  const violations = [];
  for (const { name, regex, hint } of VIOLATION_PATTERNS) {
    if (regex.test(content)) {
      violations.push({ file: relPath, rule: name, hint });
    }
  }
  return violations;
}

// ─── §18.7 class membership ───────────────────────────────────────
// Every routed page must belong to a page class (Design.md §6.5 / §18.7).
// Membership is real when the page imports its class CSS — §6.5.1's lesson was
// that a class declared but never imported is the worst of the options.
const CLASS_IMPORTS = [
  'CANONICAL_DOC_CSS',
  'CANONICAL_HUB_CSS',
  'CANONICAL_SECTOR_CSS',
  'CANONICAL_STATIC_CSS',
  'CANONICAL_DETAIL_CSS',
  // Aggregates that begin with a class CSS and append page-specific rules —
  // e.g. `GENRE_HUB_CSS = CANONICAL_HUB_CSS + HUB_PAGE_SPECIFIC_CSS`. Importing
  // one is class membership just as directly.
  'GENRE_HUB_CSS',
  'SECTOR_PAGE_CSS',
];

// Pages that legitimately carry their own class CSS instead of importing one.
const CLASS_EXCEPTIONS = new Set([
  'src/pages/index.astro',      // Interactive + Feature, _index.css
  'src/pages/map.astro',        // Interactive, _map-css.ts
  'src/pages/models.astro',     // Feature, page-local
  'src/pages/aiadoption.astro', // Feature, _ai-adoption-css.ts
  // Feature family: a model page is not one of §4.8's three Feature pages, but
  // it shares their page-local CSS rather than a class.
  'src/pages/models/[model].astro',
]);

function checkClassMembership(files) {
  const missing = [];
  for (const rel of files) {
    if (!rel.startsWith('src/pages/')) continue;
    if (!rel.endsWith('.astro')) continue;
    if (path.basename(rel).startsWith('_')) continue;
    if (CLASS_EXCEPTIONS.has(rel)) continue;
    const src = fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8');
    if (!/BaseLayout/.test(src)) continue; // not a rendered page
    if (CLASS_IMPORTS.some((n) => src.includes(n))) continue;
    // A page may also inherit its class from a sibling _*-css.ts it imports.
    if (/from '\.\/_[a-z0-9-]+-css'/.test(src) || /_[a-z0-9-]+-css'/.test(src)) continue;
    missing.push(rel);
  }
  return missing;
}

function main() {
  const files = walkSources(SRC_DIR);
  /** @type {Array<{file: string, rule: string, hint: string}>} */
  const allViolations = [];
  for (const file of files) {
    allViolations.push(...checkFile(file));
  }

  console.log(`[check-page-class] Scanned ${files.length} source files`);
  console.log(`[check-page-class] Exceptions (Interactive class + canonical sources): ${EXCEPTIONS.size}`);

  // §18.7 is still `[移行中]` in the canon: the rule is agreed, the
  // implementation is not complete. Pages that import no class CSS are
  // reported, not failed — assigning them to a class is its own unit, and a
  // gate that fails on known-open work just gets muted.
  const noClass = checkClassMembership(files);
  if (noClass.length > 0) {
    console.warn(
      `[check-page-class] \u00a718.7 WARN — ${noClass.length} page(s) import no page-class CSS:`,
    );
    for (const f of noClass) console.warn(`    ${f}`);
    console.warn('    Import a CANONICAL_*_CSS (or an aggregate of one) to make membership real (\u00a76.5.1).');
  } else {
    console.log('[check-page-class] \u00a718.7 class membership: OK');
  }

  if (allViolations.length === 0) {
    console.log('[check-page-class] ✓ Page Class System invariants respected');
    process.exit(0);
  }

  console.error('[check-page-class] ✗ Page Class System violations:\n');
  for (const v of allViolations) {
    console.error(`  ${v.file}`);
    console.error(`    rule: ${v.rule}`);
    console.error(`    hint: ${v.hint}`);
    console.error('');
  }
  console.error(`Total violations: ${allViolations.length}`);
  console.error('');
  console.error('Reference: Design.md §18.7 Page Class System.');
  process.exit(1);
}

main();
