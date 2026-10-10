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
    // `:root` as an item of a selector list, wherever it sits: line start,
    // `html,:root{`, minified `body{}:root{`, or inside a template literal.
    // The old `^[ \t]*:root` form only caught it at the start of a line.
    // `:root .x{}` (a descendant selector) declares no token and is allowed.
    regex: /(?<![\w-]):root\s*(?:,[^{};]*)?\{/,
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

// Comments are prose, not CSS: the source files document the rule itself
// ("no :root, no raw values", "`:root{}` は canonical-css.ts 経由"). A `//`
// only opens a line comment at the start of a line or after whitespace or
// `;` `{` `}` `,` — after `:` (`https://`) it is part of a URL and is kept.
// The body of a `url(…)` is matched first and kept whole, so `url(//cdn)`,
// `url('//cdn')` and `url( //cdn)` never swallow the rest of the line.
function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(\burl\([^)\n]*\))|(^|[\s;{},])\/\/[^\n]*/gim, (match, url, lead) => url ?? lead);
}

function findViolations(content) {
  const code = stripComments(content);
  const violations = [];
  for (const { name, regex, hint } of VIOLATION_PATTERNS) {
    if (regex.test(code)) violations.push({ rule: name, hint });
  }
  return violations;
}

function checkFile(relPath) {
  // 2026-05-17 CI medium fix: normalize Windows backslashes to POSIX
  // forward-slashes before comparing against EXCEPTIONS (which is
  // authored in POSIX form). Windows runs were getting false-positive
  // violations because `src\pages\_index-css.ts` !== `src/pages/_index-css.ts`.
  const posixRel = relPath.split(path.sep).join('/');
  if (EXCEPTIONS.has(posixRel)) return [];
  const content = fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf8');
  return findViolations(content).map((violation) => ({ file: relPath, ...violation }));
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
  'src/pages/pro/models.astro',     // Feature, page-local
  'src/pages/pro/aiadoption.astro', // Feature, _ai-adoption-css.ts
  'src/pages/pro/aiadoption/[release].astro', // Feature, archived HAID releases; same _ai-adoption-css.ts via _HaidReleasePage.astro
  // Feature family: a model page is not one of §4.8's three Feature pages, but
  // it shares their page-local CSS rather than a class.
  'src/pages/pro/models/[model].astro',
]);

/** Follow shared Astro components so a route shell cannot bypass class enforcement. */
function hasClassCss(rel, root, seen = new Set()) {
  if (seen.has(rel)) return false;
  seen.add(rel);
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return false;
  const src = fs.readFileSync(file, 'utf-8');
  if (CLASS_IMPORTS.some(n => src.includes(n))) return true;
  const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  for (const specifier of imports) {
    let child;
    if (specifier.startsWith('.')) child = path.resolve(path.dirname(file), specifier);
    else if (specifier.startsWith('@/')) child = path.join(root, 'src', specifier.slice(2));
    else continue;
    for (const suffix of ['', '.ts', '.astro']) {
      const target = child + suffix;
      if (fs.existsSync(target) && fs.statSync(target).isFile() && hasClassCss(path.relative(root, target), root, seen)) return true;
    }
  }
  return false;
}

function checkClassMembership(files, root = PROJECT_ROOT) {
  return files.filter(rel => rel.startsWith('src/pages/') && rel.endsWith('.astro') &&
    !path.basename(rel).startsWith('_') && !CLASS_EXCEPTIONS.has(rel) && !hasClassCss(rel, root));
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

  if (noClass.some(f => f.startsWith('src/pages/pro/'))) {
    console.error('[check-page-class] FAIL — Pro routes must inherit real page-class CSS');
    process.exit(1);
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

if (require.main === module) main();

module.exports = { findViolations, checkClassMembership };
