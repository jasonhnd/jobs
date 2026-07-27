#!/usr/bin/env node
/**
 * check-rendered-leaks.cjs — post-build sanity check that scans every page
 * in dist-astro/ for "leaked" text that shouldn't appear in the rendered
 * output. Complements check-nested-html-comments.cjs (which catches the
 * source-level pattern); this catches LEAKED text after rendering, including:
 *
 *   - Comment fragments left over from broken comment syntax
 *   - Astro / template tokens that escaped raw (e.g. `{ var }`, `<slot />`)
 *   - Source-only markers that should never reach the user (`TODO:`, `FIXME:`,
 *     `[FOOTER:START]` from old build markers)
 *   - Leftover developer artifacts
 *
 * Each pattern below is a SUSPICIOUS string that should not appear in any
 * rendered HTML body (we strip <script> + <style> + comments first to avoid
 * false positives — those are valid places for `<!--` etc.).
 *
 * Exits 0 if all clean, 1 if any page has any leak.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-astro');

// A check that cannot run must not report success. This used to exit 0, which
// made the standalone `bun run check:rendered-leaks` green on any machine
// without a build — and meant reordering the `build` chain would silently
// disarm the only guard against leaked `-->` / `TODO:` / `{props.x}` reaching
// rendered HTML. Inside `bun run build` this branch is unreachable: the script
// runs after `astro build`. See issue #217.
if (!fs.existsSync(DIST)) {
  console.error('[check-rendered-leaks] FAIL — dist-astro/ not found. Run `bun run build` first.');
  process.exit(1);
}

// Patterns that should NEVER appear in rendered, visible HTML.
// Each entry: [literal-or-regex, description]
const FORBIDDEN = [
  // Comment-syntax leak (the bug that triggered this script)
  [/-->/, 'literal `-->` token outside of an HTML comment (likely from nested comment leak)'],
  // Common comment-fragment leftovers when a comment closes prematurely
  [/\bbelow\)\.\s+The X follow CTA/, 'Phase 8 nested-comment leak (regression check)'],
  [/\bengagement block\.\s*-->/, 'Phase 8 comment tail leak'],
  // Source-only markers
  [/\bFOOTER:START\b/, 'build marker `FOOTER:START` leaked to output'],
  [/\bFOOTER:END\b/, 'build marker `FOOTER:END` leaked to output'],
  [/\bINCLUDE:\s*map-thumb\b/, 'INCLUDE marker leaked to output'],
  [/\b\/INCLUDE:\s*map-thumb\b/, 'INCLUDE close marker leaked to output'],
  // Astro template leak (unexpanded braces)
  [/\{[a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$]/, 'unexpanded Astro template expression (e.g. `{props.x...`)'],
  // TODO / FIXME visible in body
  [/^[^<]*\bTODO:/m, '`TODO:` visible in rendered text'],
  [/^[^<]*\bFIXME:/m, '`FIXME:` visible in rendered text'],
];

// Strip <script>, <style>, and HTML comments to focus on user-visible content
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Strip JSON-LD content embedded as <script type="application/ld+json"> — already removed above
    // Decode common HTML entities so 'patterns like `-->`' aren't masked by escape
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

// IMPORTANT: on this repo, the working tree lives under Dropbox which presents
// every entry as a symlink rather than a real file/dir. `Dirent.isDirectory()`
// returns false for those, so we use `fs.statSync()` (which follows the link)
// to determine the underlying type.
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.isDirectory()) walk(full, out);
    else if (stat.isFile() && e.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = walk(DIST);

// The same fail-open shape as a missing dist-astro/, and likelier: a partial or
// interrupted build leaves the directory in place with no HTML in it. Scanning
// zero pages then found zero leaks and reported OK.
if (files.length === 0) {
  console.error('[check-rendered-leaks] FAIL — dist-astro/ contains no HTML pages; there is nothing to scan.');
  console.error('  The build did not complete. Run `bun run build` and re-check.');
  process.exit(1);
}

const issues = [];

for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const body = visibleText(html);
  for (const [pat, desc] of FORBIDDEN) {
    const m = body.match(pat);
    if (m) {
      issues.push({
        file: path.relative(ROOT, f),
        match: m[0].length > 80 ? m[0].slice(0, 77) + '...' : m[0],
        desc,
      });
      // One leak per file is enough — no need to report further matches
      break;
    }
  }
}

if (issues.length === 0) {
  console.log(`[check-rendered-leaks] OK — scanned ${files.length} pages, no leaked tokens.`);
  process.exit(0);
} else {
  // De-duplicate by description so identical leaks across many pages roll up.
  const byDesc = new Map();
  for (const i of issues) {
    if (!byDesc.has(i.desc)) byDesc.set(i.desc, []);
    byDesc.get(i.desc).push(i);
  }
  console.error(`[check-rendered-leaks] FAIL — ${issues.length} page(s) have leaked tokens:\n`);
  for (const [desc, list] of byDesc.entries()) {
    console.error(`  ${desc}:`);
    console.error(`    ${list.length} page(s) affected. First example:`);
    console.error(`    ${list[0].file}: matched \`${list[0].match}\`\n`);
  }
  process.exit(1);
}
