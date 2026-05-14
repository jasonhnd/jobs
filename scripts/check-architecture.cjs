#!/usr/bin/env node
/**
 * check-architecture.cjs — enforce the 5-layer architecture boundaries
 * defined in docs/architecture.md §6.2.
 *
 * Each layer's directory has a set of FORBIDDEN import paths. Static
 * grep over .ts and .astro files catches violations before they reach
 * a code review.
 *
 * The gate is PROGRESSIVE: only the layers that have been built so far
 * (src/graph/, src/views/) are strictly enforced. src/templates/ and
 * src/pages/ ship with relaxed rules until their Phase B migrations
 * complete. Each new layer turns on stricter rules as it's introduced.
 *
 * Exits 0 if clean, 1 if any violation. Output points at the file +
 * line so the offending import can be opened directly.
 *
 * Run order:
 *   1. (none — purely static)
 *   2. pnpm run check:architecture
 *
 * Integrated into .github/workflows/* by a downstream commit.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// ─── boundary definitions ────────────────────────────────────────

/**
 * Each rule:
 *   { layer, dir, forbidden: [{ pattern, reason }] }
 *
 * `pattern` matches the import target (e.g. 'node:fs', '../../templates/...').
 * Use a substring match (case-sensitive). For type-only imports — those
 * that look like `import type { ... } from '...';` — the rule is skipped
 * unless `noTypeImports` is set.
 */
const RULES = [
  {
    layer: 'Graph (src/graph/)',
    dir: path.join(SRC, 'graph'),
    forbidden: [
      { pattern: 'src/views',            reason: 'graph must not import view functions (one-way data flow: graph → view)' },
      { pattern: '@/views',              reason: 'graph must not import view functions' },
      { pattern: 'src/templates',        reason: 'graph is pre-rendering; it does not know HTML exists' },
      { pattern: '@/templates',          reason: 'graph is pre-rendering; it does not know HTML exists' },
      { pattern: 'src/pages',            reason: 'graph must not import page-level code' },
      { pattern: 'src/components',       reason: 'graph must not import UI components' },
      { pattern: 'src/layouts',          reason: 'graph must not import layouts (HTML producers)' },
      { pattern: '.astro',               reason: 'graph must not import Astro components' },
    ],
  },
  {
    layer: 'Views (src/views/)',
    dir: path.join(SRC, 'views'),
    forbidden: [
      { pattern: 'src/templates',        reason: 'views are pure data; HTML production is a template concern' },
      { pattern: '@/templates',          reason: 'views are pure data; HTML production is a template concern' },
      { pattern: 'src/pages',            reason: 'views are upstream of pages; pages import views, not the other way' },
      { pattern: 'src/components',       reason: 'views must not produce HTML or import UI' },
      { pattern: 'src/layouts',          reason: 'views must not import layouts' },
      { pattern: '.astro',               reason: 'views must not import Astro components' },
      { pattern: 'src/data/projections', reason: 'projections are legacy; views should query the graph instead' },
      { pattern: 'src/pages/sitemap',    reason: 'views must not import page-level sitemap logic' },
      // Direct fs/promises imports are tolerated for now — the migration
      // is gradual and some view helpers may still need them transitionally.
      // Tighten when Step 11 completes.
    ],
  },
  {
    layer: 'Templates (src/templates/)',
    dir: path.join(SRC, 'templates'),
    forbidden: [
      // Templates are leaf layer for HTML production. They produce
      // SafeHtml from typed inputs; they don't fetch data, don't query
      // the graph, and don't know about routing.
      { pattern: 'node:fs',              reason: 'templates must not do I/O — data flows in via function args' },
      { pattern: 'node:fs/promises',     reason: 'templates must not do I/O' },
      { pattern: 'src/graph',            reason: 'templates take typed props; querying the graph from a template inverts the data-flow direction' },
      { pattern: '@/graph',              reason: 'templates take typed props; querying the graph from a template inverts the data-flow direction' },
      { pattern: 'src/views',            reason: 'templates take typed props; calling view functions inverts the data-flow direction' },
      { pattern: '@/views',              reason: 'templates take typed props; calling view functions inverts the data-flow direction' },
      { pattern: 'src/pages',            reason: 'templates must not import page-level code' },
      { pattern: 'src/data/projections', reason: 'templates must not read projection JSON — that is a view-layer concern' },
      { pattern: 'src/data/lib',         reason: 'templates must not depend on legacy data helpers — Step 12 cleanup verified no live imports' },
      { pattern: '@/data/lib',           reason: 'templates must not depend on legacy data helpers — Step 12 cleanup verified no live imports' },
    ],
  },
  {
    layer: 'Pages (src/pages/)',
    dir: path.join(SRC, 'pages'),
    forbidden: [
      // Pages are the binding layer. They consume views + templates and
      // emit Astro markup; they do NOT define new rendering logic or
      // bypass the graph by reading projection JSON directly. Per-page
      // sibling helpers (_*-bindings.ts / _*-renderers.ts / _*-css.ts)
      // still live under src/pages but the boundary rule applies to
      // them too — they're page-scoped glue, not a new layer.
      { pattern: 'src/data/projections', reason: 'pages must consume views, not raw projections' },
      { pattern: '@/data/projections',   reason: 'pages must consume views, not raw projections' },
    ],
  },
];

// ─── scanning helpers ────────────────────────────────────────────

function walkFiles(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && predicate(p)) out.push(p);
    }
  }
  walk(dir);
  return out;
}

/**
 * Extract every `import ... from '...'` (and dynamic `import('...')`) target
 * from a TS or Astro source. Returns array of { line, target, isTypeOnly }.
 */
function extractImports(source) {
  const out = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Static imports: `import [type] [...] from '...';`
    let m = /^\s*import\s+(type\s+)?[^'"]*from\s*['"]([^'"]+)['"]/.exec(line);
    if (m) {
      out.push({ line: i + 1, target: m[2], isTypeOnly: !!m[1] });
      continue;
    }
    // Bare side-effect imports: `import '...';`
    m = /^\s*import\s*['"]([^'"]+)['"]/.exec(line);
    if (m) {
      out.push({ line: i + 1, target: m[1], isTypeOnly: false });
      continue;
    }
    // Dynamic imports: `import('...')`
    const dynRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let dm;
    while ((dm = dynRe.exec(line)) !== null) {
      out.push({ line: i + 1, target: dm[1], isTypeOnly: false });
    }
  }
  return out;
}

// ─── enforcement ──────────────────────────────────────────────────

let violations = 0;

for (const rule of RULES) {
  const files = walkFiles(rule.dir, (p) => p.endsWith('.ts') || p.endsWith('.astro') || p.endsWith('.tsx'));
  if (files.length === 0) {
    console.log(`[check-architecture] SKIP ${rule.layer} — directory empty or missing`);
    continue;
  }
  console.log(`[check-architecture] ${rule.layer} — scanning ${files.length} files`);
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const source = fs.readFileSync(file, 'utf-8');
    const imports = extractImports(source);
    for (const imp of imports) {
      // type-only imports never trigger boundary violations (TS-only construct)
      if (imp.isTypeOnly) continue;
      for (const f of rule.forbidden) {
        if (imp.target.includes(f.pattern)) {
          console.error(
            `  ✗ ${rel}:${imp.line}\n` +
            `    forbidden import: '${imp.target}'\n` +
            `    reason: ${f.reason}`,
          );
          violations += 1;
        }
      }
    }
  }
}

// ─── Edge Function transitive dep walker ──────────────────────────
//
// Vercel's Edge Function bundler has separate loader sets for ENTRY
// files vs DEPENDENCY files. Entry loader set handles .tsx (JSX);
// dep loader set has .js / .ts only. A `.tsx` file imported (even
// transitively) by an Edge entry fails with "unsupported modules"
// and blocks the deploy.
//
// This trap cost 27 consecutive preview deploys 2026-05-13/14
// (commits 3d50a8b3..33783386). See docs/architecture.md decision
// log 2026-05-14 for the full incident write-up.
//
// Rule: any `.tsx` file reachable from an Edge Function entry via
// `import` is forbidden. Entry .tsx itself is fine — only its
// transitive deps are constrained.

/** Edge Function entry points. Vercel auto-detects these by file
 *  location (api/*) and by the root middleware.ts convention. Add to
 *  this list when a new Edge function lands. */
const EDGE_ENTRIES = [
  path.join(ROOT, 'api', 'og.tsx'),
  path.join(ROOT, 'middleware.ts'),
];

/** Try to resolve a relative ESM-style import (e.g. `./foo.js`) to a
 *  real file on disk. Mirrors TypeScript's "Bundler" moduleResolution:
 *  strip `.js` and try `.ts` / `.tsx`, then the literal path, then
 *  /index variants. Returns absolute path or null if unresolvable
 *  (npm package, node: built-in, broken path). */
function resolveRelativeImport(fromDir, spec) {
  if (!spec.startsWith('.')) return null; // npm package or node: import
  let base = path.resolve(fromDir, spec);
  // Strip trailing .js / .ts / .tsx so we can probe each extension.
  base = base.replace(/\.(js|mjs|cjs|tsx|ts)$/, '');
  for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.cjs']) {
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
      return base + ext;
    }
  }
  // `./foo` → `./foo/index.{ts,tsx,js}` resolution.
  for (const ext of ['.ts', '.tsx', '.js']) {
    const idx = path.join(base, 'index' + ext);
    if (fs.existsSync(idx) && fs.statSync(idx).isFile()) {
      return idx;
    }
  }
  return null;
}

/** BFS over the import graph rooted at `entryFile`. Collects every
 *  reachable file. Skips npm-package + node: imports. Type-only
 *  imports DO count — at runtime Vercel sees them as `.tsx` references
 *  to resolve, regardless of whether the bundler tree-shakes them. */
function walkImportClosure(entryFile) {
  const visited = new Set();
  const queue = [entryFile];
  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf-8');
    const imports = extractImports(source);
    for (const imp of imports) {
      const resolved = resolveRelativeImport(path.dirname(file), imp.target);
      if (resolved && !visited.has(resolved)) {
        queue.push(resolved);
      }
    }
  }
  return visited;
}

function checkEdgeFunctionTsxDeps() {
  let edgeViolations = 0;
  for (const entry of EDGE_ENTRIES) {
    if (!fs.existsSync(entry)) {
      console.log(`[check-architecture] Edge entry — SKIP ${path.relative(ROOT, entry)} (missing)`);
      continue;
    }
    const entryRel = path.relative(ROOT, entry);
    const closure = walkImportClosure(entry);
    console.log(`[check-architecture] Edge entry ${entryRel} — scanning ${closure.size - 1} transitive deps`);
    for (const file of closure) {
      if (file === entry) continue; // entry .tsx is fine
      if (!file.endsWith('.tsx')) continue;
      const rel = path.relative(ROOT, file);
      console.error(
        `  ✗ ${rel}\n` +
        `    JSX (.tsx) file reachable from Edge entry ${entryRel}.\n` +
        `    reason: Vercel Edge bundler has no TSX loader for dependencies.\n` +
        `            Rewrite as plain .ts using \`createElement\` (or move the\n` +
        `            JSX into the entry file itself). See docs/architecture.md\n` +
        `            decision log 2026-05-14 for the incident write-up.`,
      );
      edgeViolations += 1;
    }
  }
  return edgeViolations;
}

violations += checkEdgeFunctionTsxDeps();

if (violations > 0) {
  console.error('');
  console.error(`[check-architecture] ${violations} boundary violation(s). See docs/architecture.md §6.2.`);
  process.exit(1);
}

console.log('[check-architecture] ✓ all enforced layer boundaries respected');
