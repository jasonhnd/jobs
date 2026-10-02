#!/usr/bin/env node
/**
 * check-nested-html-comments.cjs — guard against the nested HTML comment bug
 * that leaked literal text onto the home page (commit 3a44f0c9).
 *
 * HTML comments cannot nest:
 *   <!-- foo <!-- bar --> baz -->
 *   ^^^^^^^^^^^^^^^^^^^^^^      ← parser sees this as a single comment ending at first '-->'
 *                          ^^^^  ← " baz -->" leaks as visible text
 *
 * This script scans every .astro / .html file under src/ and fails the build
 * if any HTML comment body contains a literal `<!--`. Catches the exact
 * pattern that broke the home page, plus any future variant.
 *
 * Wired into package.json `build` script so every `npm run build` runs it.
 * Exit 0 = clean. Exit 1 = at least one nested comment found, build halts.
 */
const fs = require('node:fs');
const path = require('node:path');
const { walkFiles } = require('./lib/walk-files.cjs');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const SKIP = new Set(['node_modules', 'dist', 'dist-astro', '.git', '.astro', 'analytics']);
const EXT = /\.(astro|html)$/;

// skipHidden keeps the previous dot-entry filter. walk-files fails the scan
// when a path it would have opened cannot be read, instead of skipping it.
let files;
try {
  files = walkFiles(SRC_DIR, { ext: EXT, skip: SKIP, skipHidden: true });
} catch (err) {
  console.error(`[check-nested-html-comments] FAIL — ${err.message}`);
  process.exit(1);
}

// Match every HTML comment, then check if its body contains '<!--'.
// Astro components can have JS-style /* ... */ inside the frontmatter, but
// those aren't HTML comments — only inspect content AFTER the frontmatter
// fence (--- ... ---). For .html, scan everything.
function bodyForScan(text, file) {
  if (!file.endsWith('.astro')) return text;
  // Astro frontmatter: between two '---' fences at the start of the file.
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return m ? text.slice(m[0].length) : text;
}

function lineOf(text, idx) {
  return text.slice(0, idx).split('\n').length;
}

const COMMENT_RE = /<!--([\s\S]*?)-->/g;
const issues = [];

for (const f of files) {
  const full = fs.readFileSync(f, 'utf8');
  const scan = bodyForScan(full, f);
  const offset = full.length - scan.length;
  let m;
  while ((m = COMMENT_RE.exec(scan)) !== null) {
    if (m[1].includes('<!--')) {
      issues.push({
        file: path.relative(ROOT, f),
        line: lineOf(full, m.index + offset),
        snippet: m[0].length > 100 ? m[0].slice(0, 97) + '...' : m[0],
      });
    }
  }
}

if (issues.length === 0) {
  console.log(`[check-nested-html-comments] OK — scanned ${files.length} files, no nested HTML comments.`);
  process.exit(0);
} else {
  console.error(`[check-nested-html-comments] FAIL — ${issues.length} nested HTML comment(s) detected:\n`);
  for (const i of issues) {
    console.error(`  ${i.file}:${i.line}`);
    console.error(`    ${i.snippet.replace(/\n/g, '\\n')}\n`);
  }
  console.error('  HTML comments cannot nest. The first `-->` closes the comment, leaking the rest as visible text.');
  console.error('  Fix: rewrite the comment without literal `<!--` / `-->` in its body. Use prose references instead.');
  process.exit(1);
}
