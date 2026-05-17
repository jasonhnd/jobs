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

function main() {
  const files = walkSources(SRC_DIR);
  /** @type {Array<{file: string, rule: string, hint: string}>} */
  const allViolations = [];
  for (const file of files) {
    allViolations.push(...checkFile(file));
  }

  console.log(`[check-page-class] Scanned ${files.length} source files`);
  console.log(`[check-page-class] Exceptions (Interactive class + canonical sources): ${EXCEPTIONS.size}`);

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
