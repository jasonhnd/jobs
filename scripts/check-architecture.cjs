#!/usr/bin/env node
/**
 * check-architecture.cjs — enforce the 5-layer architecture boundaries
 * defined in docs/architecture.md §6.2, plus the Edge-function dependency
 * constraint added in the 2026-05-14 decision-log entry.
 *
 * Two enforcement passes:
 *
 *   1. Per-layer forbidden-import grep
 *      (src/graph, src/views, src/templates, src/pages)
 *
 *   2. Transitive import-graph walk from each Vercel Edge Function
 *      entry (`api/og.tsx`, `middleware.ts`, `api/feedback.js`,
 *      `api/subscribe.js`). Any `.tsx` file reachable as a *dependency*
 *      fails the gate — Vercel's Edge bundler has no TSX loader for
 *      deps and would 500 the deploy with "unsupported modules".
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
// 2026-05-14 Phase D audit (final cleanup): patterns now include the
// relative-path form (e.g. '../templates/' alongside 'src/templates'),
// because the previous substring matcher missed relative imports —
// `from '../templates/Ranking.js'` did NOT contain the substring
// 'src/templates' and silently bypassed the gate. Adding the relative
// form catches both styles.
const RULES = [
  {
    layer: 'Graph (src/graph/)',
    dir: path.join(SRC, 'graph'),
    forbidden: [
      { pattern: 'src/views',            reason: 'graph must not import view functions (one-way data flow: graph → view)' },
      { pattern: '@/views',              reason: 'graph must not import view functions' },
      { pattern: '../views/',            reason: 'graph must not import view functions (relative-path form)' },
      { pattern: 'src/templates',        reason: 'graph is pre-rendering; it does not know HTML exists' },
      { pattern: '@/templates',          reason: 'graph is pre-rendering; it does not know HTML exists' },
      { pattern: '../templates/',        reason: 'graph is pre-rendering; it does not know HTML exists (relative)' },
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
      { pattern: '../templates/',        reason: 'views are pure data; HTML production is a template concern (relative)' },
      { pattern: 'src/pages',            reason: 'views are upstream of pages; pages import views, not the other way' },
      { pattern: 'src/components',       reason: 'views must not produce HTML or import UI' },
      { pattern: 'src/layouts',          reason: 'views must not import layouts' },
      { pattern: '.astro',               reason: 'views must not import Astro components' },
      { pattern: 'src/data/projections', reason: 'projections are legacy; views should query the graph instead' },
      { pattern: '../data/projections',  reason: 'projections are legacy; views should query the graph instead (relative)' },
      { pattern: 'src/pages/sitemap',    reason: 'views must not import page-level sitemap logic' },
      // Phase E (2026-05-15) — direct fs/loadGraph forbidden. Views are
      // pure functions `(graph, params) => result`; orchestrators that
      // initiate loadGraph or read public/data.* files belong in
      // src/page-data/. Indirect fs through src/lib/strict-load.ts is
      // still allowed (blessed primitive — strict-load is the typed
      // loader, not raw fs).
      { pattern: 'node:fs',              reason: 'views must be pure — fs I/O belongs in src/page-data/ (Phase E)' },
      { pattern: 'node:fs/promises',     reason: 'views must be pure — fs I/O belongs in src/page-data/ (Phase E)' },
      { pattern: '@/graph/loader',       reason: 'views receive graph as a param — only src/page-data/ initiates loadGraph (Phase E)' },
      { pattern: '../graph/loader',      reason: 'views receive graph as a param — only src/page-data/ initiates loadGraph (Phase E, relative)' },
    ],
  },
  {
    layer: 'Page data (src/page-data/)',
    dir: path.join(SRC, 'page-data'),
    forbidden: [
      // page-data is build orchestration: it bridges the graph + view
      // layers to the dataset shape an Astro page family needs. It
      // legitimately initiates loadGraph and may read public/data.*
      // files. It does NOT produce HTML / SafeHtml — that's a template
      // or page-local renderer concern.
      { pattern: 'src/templates',        reason: 'page-data prepares datasets, not HTML — template usage stays in pages/' },
      { pattern: '@/templates',          reason: 'page-data prepares datasets, not HTML — template usage stays in pages/' },
      { pattern: '../templates/',        reason: 'page-data prepares datasets, not HTML — template usage stays in pages/ (relative)' },
      { pattern: 'src/components',       reason: 'page-data must not produce UI' },
      { pattern: 'src/layouts',          reason: 'page-data must not import layouts' },
      { pattern: '.astro',               reason: 'page-data must not import Astro components' },
      { pattern: 'src/data/projections', reason: 'page-data should consume the graph; projection JSON read is allowed via @/page-data lazy loaders only' },
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
      { pattern: '../graph/',            reason: 'templates take typed props; querying the graph from a template inverts the data-flow direction (relative)' },
      { pattern: 'src/views',            reason: 'templates take typed props; calling view functions inverts the data-flow direction' },
      { pattern: '@/views',              reason: 'templates take typed props; calling view functions inverts the data-flow direction' },
      { pattern: '../views/',            reason: 'templates take typed props; calling view functions inverts the data-flow direction (relative)' },
      { pattern: 'src/pages',            reason: 'templates must not import page-level code' },
      { pattern: 'src/data/projections', reason: 'templates must not read projection JSON — that is a view-layer concern' },
      { pattern: '../data/projections',  reason: 'templates must not read projection JSON (relative)' },
      { pattern: 'src/data/lib',         reason: 'templates must not depend on legacy data helpers — Step 12 cleanup verified no live imports' },
      { pattern: '@/data/lib',           reason: 'templates must not depend on legacy data helpers — Step 12 cleanup verified no live imports' },
      { pattern: '../data/lib',          reason: 'templates must not depend on legacy data helpers (relative)' },
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
      { pattern: '../data/projections',  reason: 'pages must consume views, not raw projections (relative)' },
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
 *
 * Handles BOTH single-line and multi-line static imports:
 *
 *   import { a, b } from './foo.js';
 *   import {
 *     a,
 *     b,
 *   } from './foo.js';
 *
 * Implementation: scan the WHOLE source with the `s` flag on the static-
 * import regex so `[^'"]*` can match across newlines between `import` and
 * `from`. Track each match's starting line via offset → line lookup.
 */
function extractImports(source) {
  const out = [];

  // Pre-compute line-start offsets for {start-offset → line-number} lookup.
  const lineStarts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source.charCodeAt(i) === 10 /* \n */) lineStarts.push(i + 1);
  }
  const offsetToLine = (off) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (lineStarts[mid] <= off) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  // Static imports (single-line OR multi-line, with optional `type`):
  //   import [type] { a, b, c } from '...';
  //   import [type] * as x from '...';
  //   import [type] default, { a } from '...';
  // The `m` flag makes `^` match line-start so we only catch real import
  // statements (not the word "import" used inside docstrings). The
  // `[^'"]*?` portion can still span newlines (newlines are inside the
  // negated char class) so multi-line imports work.
  //
  // 2026-05-14 Phase D audit lesson: the previous regex used
  // `(^|[\s;])import` which allowed `import` to be preceded by any
  // whitespace including a newline. That false-matched docstring
  // sentences like "templates cannot import view-layer values" when the
  // file's next actual import was a `from '../views/...'` (the lazy
  // `[^'"]*?` spanned the whole comment-then-real-import range, and the
  // `type` keyword inside the actual import fell INSIDE the lazy match
  // instead of being captured as group 2 — so isTypeOnly came back
  // false). Anchoring to line-start with the `m` flag fixes this cleanly.
  const staticRe = /^[ \t]*import\s+(type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]/gm;
  let m;
  while ((m = staticRe.exec(source)) !== null) {
    out.push({ line: offsetToLine(m.index), target: m[2], isTypeOnly: !!m[1] });
  }

  // Bare side-effect imports: `import '...';`
  const bareRe = /(^|[\s;])import\s*['"]([^'"]+)['"]/g;
  while ((m = bareRe.exec(source)) !== null) {
    const fromIdx = m.index + m[1].length;
    out.push({ line: offsetToLine(fromIdx), target: m[2], isTypeOnly: false });
  }

  // Dynamic imports: `import('...')`
  const dynRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(source)) !== null) {
    out.push({ line: offsetToLine(m.index), target: m[1], isTypeOnly: false });
  }

  // Legacy CommonJS `require('...')` — historical pages-layer files
  // (sitemap.xml.ts etc) may still use require. Skip in this gate
  // since they only appear in static-asset paths; if needed, expand
  // the matcher above.
  return out;
}

// ─── enforcement ──────────────────────────────────────────────────

let violations = 0;

// Test files are exempt from the layer rules: drift-detection tests
// legitimately need fs to read source files and assert imports stay
// consistent. The production code in the same dir is still scanned.
function isScannable(p) {
  if (p.endsWith('.test.ts')) return false;
  if (p.endsWith('.test.tsx')) return false;
  return p.endsWith('.ts') || p.endsWith('.astro') || p.endsWith('.tsx');
}

for (const rule of RULES) {
  const files = walkFiles(rule.dir, isScannable);
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

/**
 * Auto-discover Vercel Edge Function entry points. Two file-location
 * conventions count:
 *
 *   1. Anything under `api/` at the repo root — Vercel auto-routes
 *      these as functions (a file in api/ IS an entry by definition).
 *
 *   2. A file named `middleware.{ts,js}` at the repo root — Vercel's
 *      Edge Middleware convention.
 *
 * Among those candidates, the file qualifies as an EDGE entry (vs.
 * a Node serverless function) iff its source matches at least one of:
 *
 *   - `export const config = { ..., runtime: 'edge', ... }`     ← `api/*`
 *   - `import { ... } from '@vercel/edge'`                       ← middleware.ts
 *
 * The previous hardcoded `EDGE_ENTRIES = [...]` list rotted whenever
 * a new Edge function was added — auto-detection eliminates that
 * drift surface. If the discovery misses a new file, fall back to
 * the explicit override `EDGE_ENTRIES_OVERRIDE` env var (comma-
 * separated paths) for emergency unblock.
 */
function discoverEdgeEntries() {
  const candidates = [];

  // 1. api/* files (Vercel function convention).
  const apiDir = path.join(ROOT, 'api');
  if (fs.existsSync(apiDir)) {
    for (const ent of fs.readdirSync(apiDir, { withFileTypes: true })) {
      if (!ent.isFile()) continue;
      if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(ent.name)) continue;
      candidates.push(path.join(apiDir, ent.name));
    }
  }

  // 2. middleware.{ts,js,mjs} at the repo root (Edge Middleware convention).
  for (const name of ['middleware.ts', 'middleware.js', 'middleware.mjs']) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) candidates.push(p);
  }

  // Detect edge-runtime via source-content inspection. We want a low
  // false-positive rate (don't flag a Node serverless function as
  // Edge), so we look for two unambiguous markers:
  //
  //   `runtime: 'edge'` / `runtime: "edge"` inside an export-const-
  //   config statement, OR an import from `@vercel/edge` (the only
  //   package exposing Edge-specific helpers).
  const EDGE_MARKER_RE =
    /runtime\s*:\s*['"]edge['"]|from\s+['"]@vercel\/edge['"]/;

  const detected = [];
  for (const file of candidates) {
    const source = fs.readFileSync(file, 'utf-8');
    if (EDGE_MARKER_RE.test(source)) {
      detected.push(file);
    }
  }

  // Emergency override: if discovery is broken for whatever reason
  // (e.g. a new Vercel convention this script doesn't know about),
  // EDGE_ENTRIES_OVERRIDE='path1,path2' replaces the detected list.
  const override = process.env.EDGE_ENTRIES_OVERRIDE;
  if (override) {
    return override
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => path.resolve(ROOT, p));
  }

  return detected.sort();
}

const EDGE_ENTRIES = discoverEdgeEntries();

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
