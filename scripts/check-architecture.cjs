#!/usr/bin/env node
/**
 * check-architecture.cjs — enforce the 5-layer architecture boundaries
 * defined in docs/architecture.md (境界ルール), plus the Edge-function dependency
 * constraint added in the 2026-05-14 decision-log entry.
 *
 * Two enforcement passes:
 *
 *   1. Per-layer forbidden-import grep
 *      (src/graph, src/views, src/templates, src/pages)
 *
 *   2. Transitive import-graph walk from every Vercel Function entry
 *      (`api/**`, `middleware.*`), whatever its runtime. Any `.tsx` file
 *      reachable as a *dependency* fails the gate (docs/architecture.md
 *      境界ルール) — Vercel's Edge bundler has no TSX loader for deps
 *      and would 500 the deploy with "unsupported modules".
 *
 * Each layer's directory has a set of FORBIDDEN import targets. Every
 * import / re-export / dynamic import() / require() in .ts/.tsx/.js/.mjs/
 * .cjs/.astro files is resolved to a path and judged by where it lands.
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
 * Wired into the Vercel build gate via `pnpm run verify:gates` (2026-05-29,
 * after GitHub Actions was removed 2026-05-28). Standalone: `pnpm run check:architecture`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// ─── boundary definitions ────────────────────────────────────────

/**
 * Each rule:
 *   { layer, dir, forbidden: [{ target, reason }] }
 *
 * Type-only imports (`import type { ... } from '...'`) never trigger a
 * layer violation — they are erased before runtime.
 */
// 2026-10-07 (#867): rules name the forbidden TARGET, not a substring of the
// import specifier. Every specifier is first resolved to an absolute path
// (relative, `@/…` tsconfig alias, `src/…`) and then judged by the directory
// or file it lands in. The previous substring list missed every spelling it
// did not enumerate — `@/components/…`, `../components/…`, `@/data/projections`
// from views, `'fs'` without the `node:` prefix — and each new alias silently
// widened the hole.
//
//   dir(rel)     — target lies inside this directory (rel to repo root)
//   file(rel)    — target is this module, any extension (`.ts`, `.js`, …)
//   builtin(n)   — Node built-in `n` or a sub-path of it, with or without `node:`
//   ext(e)       — target file has this extension (e.g. Astro components)
const dir = (rel) => ({ kind: 'dir', rel });
const file = (rel) => ({ kind: 'file', rel });
const builtin = (name) => ({ kind: 'builtin', name });
const ext = (value) => ({ kind: 'ext', value });

const RULES = [
  {
    layer: 'Graph (src/graph/)',
    dir: 'src/graph',
    forbidden: [
      { target: dir('src/views'),      reason: 'graph must not import view functions (one-way data flow: graph → view)' },
      { target: dir('src/templates'),  reason: 'graph is pre-rendering; it does not know HTML exists' },
      { target: dir('src/pages'),      reason: 'graph must not import page-level code' },
      { target: dir('src/components'), reason: 'graph must not import UI components' },
      { target: dir('src/layouts'),    reason: 'graph must not import layouts (HTML producers)' },
      { target: ext('.astro'),         reason: 'graph must not import Astro components' },
    ],
  },
  {
    layer: 'Views (src/views/)',
    dir: 'src/views',
    forbidden: [
      { target: dir('src/templates'),        reason: 'views are pure data; HTML production is a template concern' },
      { target: dir('src/pages'),            reason: 'views are upstream of pages; pages import views, not the other way' },
      { target: dir('src/components'),       reason: 'views must not produce HTML or import UI' },
      { target: dir('src/layouts'),          reason: 'views must not import layouts' },
      { target: ext('.astro'),               reason: 'views must not import Astro components' },
      { target: dir('src/data/projections'), reason: 'projections are legacy; views should query the graph instead' },
      // Phase E (2026-05-15) — direct fs/loadGraph forbidden. Views are
      // pure functions `(graph, params) => result`; orchestrators that
      // initiate loadGraph or read public/data.* files belong in
      // src/page-data/.
      { target: builtin('fs'),               reason: 'views must be pure — fs I/O belongs in src/page-data/ (Phase E)' },
      { target: file('src/graph/loader'),    reason: 'views receive graph as a param — only src/page-data/ initiates loadGraph (Phase E)' },
      // 2026-05-17 R2 (deep audit C2) — close the strict-load loophole.
      // Indirect fs is no longer a valid escape hatch for the views layer.
      { target: file('src/lib/strict-load'), reason: 'views must not read fs even indirectly via strict-load; use src/page-data/ loaders (R2)' },
    ],
  },
  {
    layer: 'Page data (src/page-data/)',
    dir: 'src/page-data',
    forbidden: [
      // page-data is build orchestration: it bridges the graph + view
      // layers to the dataset shape an Astro page family needs. It
      // legitimately initiates loadGraph and may read public/data.*
      // files. It does NOT produce HTML / SafeHtml — that's a template
      // or page-local renderer concern.
      { target: dir('src/templates'),        reason: 'page-data prepares datasets, not HTML — template usage stays in pages/' },
      { target: dir('src/components'),       reason: 'page-data must not produce UI' },
      { target: dir('src/layouts'),          reason: 'page-data must not import layouts' },
      { target: ext('.astro'),               reason: 'page-data must not import Astro components' },
      { target: dir('src/data/projections'), reason: 'page-data should consume the graph; projection JSON is read through the page-data lazy loaders, not imported' },
    ],
  },
  {
    layer: 'Templates (src/templates/)',
    dir: 'src/templates',
    forbidden: [
      // Templates are leaf layer for HTML production. They produce
      // SafeHtml from typed inputs; they don't fetch data, don't query
      // the graph, and don't know about routing.
      { target: builtin('fs'),               reason: 'templates must not do I/O — data flows in via function args' },
      { target: dir('src/graph'),            reason: 'templates take typed props; querying the graph from a template inverts the data-flow direction' },
      { target: dir('src/views'),            reason: 'templates take typed props; calling view functions inverts the data-flow direction' },
      { target: dir('src/pages'),            reason: 'templates must not import page-level code' },
      { target: dir('src/data/projections'), reason: 'templates must not read projection JSON — that is a view-layer concern' },
      { target: dir('src/data/lib'),         reason: 'templates must not depend on legacy data helpers — Step 12 cleanup verified no live imports' },
    ],
  },
  {
    layer: 'Pages (src/pages/)',
    dir: 'src/pages',
    forbidden: [
      // Pages are the binding layer. They consume views + templates and
      // emit Astro markup; they do NOT define new rendering logic or
      // bypass the graph by reading projection JSON directly. Per-page
      // sibling helpers (_*-bindings.ts / _*-renderers.ts / _*-css.ts)
      // still live under src/pages but the boundary rule applies to
      // them too — they're page-scoped glue, not a new layer.
      { target: dir('src/data/projections'), reason: 'pages must consume views, not raw projections' },
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

// Imports are read from a real AST (#881). The hand-written comment / regex
// tokenizer this replaces had to guess whether a `/` opened a regex literal,
// and every guess had a counter-example that blanked real code — e.g.
// `if (true) /[//]/.test('x'); const fs = require('fs');` hid the require
// (review of #875). @babel/parser has no such guess: comments are not in the
// AST, and a string or regex that merely contains `require('fs')` is a
// literal, never a call.
//
// What is parsed (same split as scripts/lib/analytics-spec/ast.ts):
//   .ts .tsx .mts .cts .js .jsx .mjs .cjs   the whole file
//   .astro                                  the frontmatter and each JS `<script>` body
// Any other extension (.json, .css, …) holds no module references.
//
// Fail closed: a region that does not parse, and a `require()` / `import()`
// whose argument is not a string literal, are violations with file:line.

/** `<script type="…">` that is not JS (JSON-LD and the like) — not parsed. */
const NON_JS_SCRIPT = /\btype\s*=\s*["']?(?!(?:text\/javascript|module|application\/javascript)["'\s>])[^"'\s>]+/i;

/** 1-based line of a character offset. */
function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) if (source.charCodeAt(i) === 10 /* \n */) line += 1;
  return line;
}

/** The JS regions of an .astro file: frontmatter plus each JS `<script>` body.
 *  `<!-- … -->` and `{/* … *\/}` comments in the markup are skipped, so a
 *  commented-out `<script>` is not read. */
function astroRegions(source) {
  const regions = [];
  let from = 0;
  const front = source.match(/^\s*---[^\n]*\n/);
  if (front) {
    const close = source.indexOf('\n---', front[0].length - 1);
    const end = close < 0 ? source.length : close + 1;
    regions.push({ start: front[0].length, code: source.slice(front[0].length, end) });
    from = close < 0 ? end : end + 3;
  }
  const tag = /<!--|\{\s*\/\*|<script\b([^>]*)>/gi;
  tag.lastIndex = from;
  for (let m = tag.exec(source); m; m = tag.exec(source)) {
    if (m[0] === '<!--' || m[0].startsWith('{')) {
      const closer = m[0] === '<!--' ? '-->' : '*/';
      const end = source.indexOf(closer, m.index + m[0].length);
      tag.lastIndex = end < 0 ? source.length : end + closer.length;
      continue;
    }
    const bodyStart = m.index + m[0].length;
    if (/\/\s*$/.test(m[1] || '')) continue; // `<script … />` (Astro set:html) has no body
    const close = source.slice(bodyStart).search(/<\/script\s*>/i);
    const bodyEnd = close < 0 ? source.length : bodyStart + close;
    if (!NON_JS_SCRIPT.test(m[1] || '')) regions.push({ start: bodyStart, code: source.slice(bodyStart, bodyEnd) });
    tag.lastIndex = bodyEnd;
  }
  return regions;
}

/** Parser plugins for a file, or null if the extension holds no JS. */
function pluginsFor(file) {
  if (/\.[cm]?ts$/.test(file)) return ['typescript'];
  if (file.endsWith('.tsx')) return ['typescript', 'jsx'];
  if (/\.(?:[cm]?js|jsx)$/.test(file)) return ['jsx'];
  if (file.endsWith('.astro')) return ['typescript'];
  return null;
}

const NOT_CHILDREN = new Set([
  'type', 'start', 'end', 'loc', 'range', 'extra',
  'leadingComments', 'trailingComments', 'innerComments', 'comments',
]);

/** Depth-first visit of every node, type annotations included (an
 *  `import('…')` type is a module reference too). */
function visitNodes(node, visit) {
  visit(node);
  for (const key of Object.keys(node)) {
    if (NOT_CHILDREN.has(key)) continue;
    const value = node[key];
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (child && typeof child.type === 'string') visitNodes(child, visit);
    }
  }
}

/** The module a `require()` / `import()` argument names. A template literal
 *  with `${…}` holes keeps its static prefix (`../templates/` already names a
 *  forbidden layer); anything else is unknowable. */
function callTarget(arg) {
  if (arg && arg.type === 'StringLiteral') return { target: arg.value, isPrefix: false };
  if (arg && arg.type === 'TemplateLiteral') {
    const prefix = arg.quasis[0].value.cooked;
    if (arg.expressions.length === 0) return { target: prefix, isPrefix: false };
    if (prefix) return { target: prefix, isPrefix: true };
  }
  return null;
}

/** Module references in one parsed program. */
function collectReferences(program, imports, problems) {
  const add = (node, target, isTypeOnly, isPrefix = false) =>
    imports.push({ line: node.loc.start.line, target, isTypeOnly, isPrefix });
  visitNodes(program, (node) => {
    switch (node.type) {
      case 'ImportDeclaration':
        add(node, node.source.value, node.importKind === 'type');
        break;
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
        if (node.source) add(node, node.source.value, node.exportKind === 'type');
        break;
      case 'TSImportEqualsDeclaration':
        if (node.moduleReference.type === 'TSExternalModuleReference') {
          add(node, node.moduleReference.expression.value, node.importKind === 'type');
        }
        break;
      case 'TSImportType': {
        // `import('…').T` in a type position: erased at runtime, but the
        // function walk below still follows it like any type-only import.
        const arg = node.argument.type === 'TSLiteralType' ? node.argument.literal : node.argument;
        if (arg.type === 'StringLiteral') add(node, arg.value, true);
        break;
      }
      case 'ImportExpression':
      case 'CallExpression': {
        const isImport = node.type === 'ImportExpression' || node.callee.type === 'Import';
        const isRequire = node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require';
        if (!isImport && !isRequire) break;
        const kind = isImport ? 'import()' : 'require()';
        const ref = callTarget(node.type === 'ImportExpression' ? node.source : node.arguments[0]);
        if (ref) add(node, ref.target, false, ref.isPrefix);
        else problems.push({
          line: node.loc.start.line,
          message: `non-literal ${kind} argument — the gate cannot tell which module it loads.\n` +
            '    Use a string literal (a template literal needs a static directory prefix).',
        });
        break;
      }
      default:
        break;
    }
  });
}

/**
 * Extract every module reference from a TS / JS / Astro source. Returns
 * { imports: [{ line, target, isTypeOnly, isPrefix }], problems: [{ line, message }] }.
 * `problems` are fail-closed violations: unparseable code or a non-literal
 * `require()` / `import()` argument.
 */
function extractImports(source, file) {
  const imports = [];
  const problems = [];
  const plugins = pluginsFor(file);
  if (plugins === null) return { imports, problems };
  const regions = file.endsWith('.astro') ? astroRegions(source) : [{ start: 0, code: source }];
  for (const region of regions) {
    let ast;
    try {
      ast = parse(region.code, {
        sourceType: 'unambiguous',
        plugins,
        startLine: lineAt(source, region.start),
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        allowImportExportEverywhere: true,
        allowUndeclaredExports: true,
        errorRecovery: false,
      });
    } catch (err) {
      const line = err.loc ? err.loc.line : lineAt(source, region.start);
      const message = String(err.message).replace(/\s*\(\d+:\d+\)$/, '');
      problems.push({ line, message: `cannot parse: ${message}\n    The gate cannot see this file's imports; fix the syntax.` });
      continue;
    }
    collectReferences(ast.program, imports, problems);
  }
  return { imports, problems };
}

// ─── import resolution ───────────────────────────────────────────

/** tsconfig `compilerOptions.paths`, read at runtime so this gate cannot drift
 *  from the real alias table. Handles both the wildcard form (`@/lib/*`) and
 *  the exact form (`@/graph` → a specific index file). */
function loadPathAliases() {
  const tsconfigPath = path.join(ROOT, 'tsconfig.json');
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
  } catch (err) {
    console.error(`[check-architecture] FAIL — cannot parse tsconfig.json: ${err.message}`);
    console.error('  Import resolution needs its path aliases; without them every `@/…` import is invisible.');
    process.exit(1);
  }
  const paths = (raw.compilerOptions && raw.compilerOptions.paths) || {};
  const aliases = Object.entries(paths).map(([pattern, targets]) => ({
    pattern,
    wildcard: pattern.endsWith('/*'),
    // '@/lib/*' → '@/lib/' so a spec can be matched by prefix.
    prefix: pattern.endsWith('/*') ? pattern.slice(0, -1) : null,
    targets: targets.map((t) => path.resolve(ROOT, t.replace(/\/\*$/, ''))),
  }));
  if (aliases.length === 0) {
    console.error('[check-architecture] FAIL — tsconfig.json declares no path aliases.');
    console.error('  Either the config moved or this gate is reading the wrong file; both make import resolution unsound.');
    process.exit(1);
  }
  return aliases;
}

const PATH_ALIASES = loadPathAliases();

/** Candidate on-disk bases an `@/…` specifier could map to, in alias order. */
function aliasCandidates(spec) {
  const out = [];
  for (const alias of PATH_ALIASES) {
    if (alias.wildcard) {
      if (spec.startsWith(alias.prefix)) {
        const suffix = spec.slice(alias.prefix.length);
        for (const target of alias.targets) out.push(path.join(target, suffix));
      }
    } else if (spec === alias.pattern) {
      out.push(...alias.targets);
    }
  }
  return out;
}

/** Probe a base path the way TypeScript's "Bundler" moduleResolution does:
 *  a `.js` / `.jsx` specifier may name a `.ts` / `.tsx` source, `.mjs` a
 *  `.mts` and `.cjs` a `.cts`; an extensionless one tries every source
 *  extension, then `/index`. The literal path is tried last. */
const SOURCE_EXTENSIONS = {
  '.js': ['.ts', '.tsx', '.js', '.jsx'],
  '.jsx': ['.tsx', '.jsx'],
  '.mjs': ['.mts', '.mjs'],
  '.cjs': ['.cts', '.cjs'],
  '.ts': ['.ts'],
  '.tsx': ['.tsx'],
  '.mts': ['.mts'],
  '.cts': ['.cts'],
};
const ANY_SOURCE = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function isFile(p) {
  return fs.existsSync(p) && fs.statSync(p).isFile();
}

function probeFile(base) {
  const extName = path.extname(base);
  const stripped = SOURCE_EXTENSIONS[extName] ? base.slice(0, -extName.length) : base;
  const candidates = SOURCE_EXTENSIONS[extName] || ANY_SOURCE;
  for (const candidate of candidates) {
    if (isFile(stripped + candidate)) return stripped + candidate;
  }
  if (isFile(base)) return base;
  // `./foo` → `./foo/index.{ts,tsx,js}` resolution.
  for (const candidate of ['.ts', '.tsx', '.js']) {
    const idx = path.join(stripped, 'index' + candidate);
    if (isFile(idx)) return idx;
  }
  return null;
}

/** Resolve an import specifier to a real file. Returns an absolute path, or
 *  null for npm packages, node: built-ins and anything that does not exist.
 *
 *  Aliased imports used to return null here alongside npm packages, so the
 *  BFS below stopped dead at the first `@/…` import and every `.tsx` behind it
 *  became invisible to the gate. See issue #217. */
function resolveImport(fromDir, spec) {
  if (spec.startsWith('.')) return probeFile(path.resolve(fromDir, spec));
  if (spec.startsWith('@/')) {
    for (const base of aliasCandidates(spec)) {
      const hit = probeFile(base);
      if (hit) return hit;
    }
    return null;
  }
  return null; // npm package or node: built-in
}

/** Where an import points, for the layer rules. Unlike resolveImport this
 *  never gives up on a local specifier: a target that does not exist (yet)
 *  or a template-literal prefix still names a directory, and an `@/x`
 *  without a tsconfig alias is read as `src/x` so it cannot hide a layer.
 *  Returns { file } for a local path or { builtin } for a bare specifier. */
function importTarget(fromFile, imp) {
  const spec = imp.target.split('?')[0];
  const fromDir = path.dirname(fromFile);
  let base = null;
  if (spec.startsWith('.')) base = path.resolve(fromDir, spec);
  else if (spec.startsWith('@/')) base = aliasCandidates(spec)[0] || path.join(SRC, spec.slice(2));
  else if (spec.startsWith('src/')) base = path.join(ROOT, spec);
  else if (spec.startsWith('/')) base = path.join(ROOT, spec);
  if (base === null) return { builtin: spec.replace(/^node:/, '') };
  if (imp.isPrefix) return { file: base };
  if (spec.startsWith('@/')) {
    for (const candidate of aliasCandidates(spec)) {
      const hit = probeFile(candidate);
      if (hit) return { file: hit };
    }
  }
  return { file: probeFile(base) || base };
}

const stripModuleExt = (p) => p.replace(/\.(?:[cm]?[jt]sx?|astro|json)$/, '');

function isInside(target, dirAbs) {
  return target === dirAbs || target.startsWith(dirAbs + path.sep);
}

function matchesForbidden(resolved, forbidden) {
  const { kind } = forbidden;
  if (kind === 'builtin') {
    return resolved.builtin !== undefined &&
      (resolved.builtin === forbidden.name || resolved.builtin.startsWith(forbidden.name + '/'));
  }
  if (resolved.file === undefined) return false;
  if (kind === 'dir') return isInside(resolved.file, path.join(ROOT, forbidden.rel));
  if (kind === 'file') return stripModuleExt(resolved.file) === path.join(ROOT, forbidden.rel);
  if (kind === 'ext') return resolved.file.endsWith(forbidden.value);
  throw new Error(`unknown forbidden-target kind ${kind}`);
}

// ─── layer enforcement ────────────────────────────────────────────

// Test files are exempt from the layer rules: drift-detection tests
// legitimately need fs to read source files and assert imports stay
// consistent. The production code in the same dir is still scanned.
function isScannable(p) {
  if (/\.test\.[cm]?[jt]sx?$/.test(p)) return false;
  if (p.endsWith('.d.ts')) return false;
  return /\.(?:[cm]?[jt]sx?|astro)$/.test(p);
}

function checkLayerRules() {
  let layerViolations = 0;
  for (const rule of RULES) {
    const files = walkFiles(path.join(ROOT, rule.dir), isScannable);
    if (files.length === 0) {
      console.log(`[check-architecture] SKIP ${rule.layer} — directory empty or missing`);
      continue;
    }
    console.log(`[check-architecture] ${rule.layer} — scanning ${files.length} files`);
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      const { imports, problems } = extractImports(fs.readFileSync(file, 'utf-8'), file);
      for (const { line, message } of problems) {
        console.error(`  ✗ ${rel}:${line}\n    ${message}`);
        layerViolations += 1;
      }
      for (const imp of imports) {
        // type-only imports never trigger boundary violations (TS-only construct)
        if (imp.isTypeOnly) continue;
        const resolved = importTarget(file, imp);
        for (const f of rule.forbidden) {
          if (!matchesForbidden(resolved, f.target)) continue;
          const where = resolved.file ? ` (resolves to ${path.relative(ROOT, resolved.file)})` : '';
          console.error(
            `  ✗ ${rel}:${imp.line}\n` +
            `    forbidden import: '${imp.target}'${where}\n` +
            `    reason: ${f.reason}`,
          );
          layerViolations += 1;
        }
      }
    }
  }
  return layerViolations;
}

// ─── Vercel Function transitive dep walker ────────────────────────
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
// Rule (docs/architecture.md 境界ルール): no Vercel Function bundle may
// contain a `.tsx` dependency, whatever its runtime. The entry .tsx itself
// is fine — only its transitive deps are constrained.
//
// 2026-10-07 (#867): the walk used to run only for entries marked
// `runtime: 'edge'` / `@vercel/edge`. Every entry moved to nodejs/Bun
// (TOOLCHAIN §9), so the walk silently checked nothing — and a middleware
// that lost its `runtime` key (platform default: Edge) still read as "no
// Edge entries". It now walks every function, independent of runtime.

/**
 * Discover Vercel Function entry points:
 *
 *   1. Every source file under `api/` (recursively) — Vercel routes each one
 *      as a function. Files or directories whose name starts with `_` are
 *      helpers Vercel does not route, and tests / type declarations are not
 *      bundled; those are reached (if at all) as dependencies.
 *
 *   2. `middleware.{ts,js,mjs}` at the repo root.
 *
 * `EDGE_ENTRIES_ADDITIONAL` (comma-separated) adds entries; the
 * `EDGE_ENTRIES_OVERRIDE` escape hatch replaces discovery and is logged.
 * The names predate the runtime-independent walk and are kept for
 * compatibility with existing runbooks.
 */
function discoverFunctionEntries() {
  const isEntry = (p) => {
    const rel = path.relative(ROOT, p).split(path.sep);
    if (rel.some((segment) => segment.startsWith('_') || segment.startsWith('.'))) return false;
    if (/\.test\.[cm]?[jt]sx?$/.test(p) || p.endsWith('.d.ts')) return false;
    return /\.(?:[cm]?[jt]sx?)$/.test(p);
  };
  const detected = walkFiles(path.join(ROOT, 'api'), isEntry);
  for (const name of ['middleware.ts', 'middleware.js', 'middleware.mjs']) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) detected.push(p);
  }

  const parseList = (value) => value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => path.resolve(ROOT, p));

  const additional = process.env.EDGE_ENTRIES_ADDITIONAL;
  if (additional) {
    return [...new Set([...detected, ...parseList(additional)])].sort();
  }

  const override = process.env.EDGE_ENTRIES_OVERRIDE;
  if (override !== undefined) {
    const forced = parseList(override);
    console.warn(
      `[check-architecture] WARN: EDGE_ENTRIES_OVERRIDE is set — scanning ` +
        `${forced.length} forced entries (auto-detected ${detected.length} ignored). ` +
        `Prefer EDGE_ENTRIES_ADDITIONAL if you only need to ADD entries.`,
    );
    return forced;
  }

  return detected.sort();
}

/** BFS over the import graph rooted at `entryFile`. Collects every
 *  reachable file. Skips npm-package + node: imports. Type-only
 *  imports DO count — at runtime Vercel sees them as `.tsx` references
 *  to resolve, regardless of whether the bundler tree-shakes them. */
function walkImportClosure(entryFile) {
  const visited = new Set();
  // A local (`./`, `../`, `@/…`) specifier that resolves to nothing means the
  // walk lost coverage: the alias table moved, the target is gone, or its
  // extension is one the probe does not know. Collected and reported as a
  // failure rather than a brittle "expected N deps" floor.
  const unresolved = [];
  // Unparseable files and non-literal require()/import() in the closure.
  const problems = [];
  const queue = [entryFile];
  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    if (!fs.existsSync(file)) continue;
    const extracted = extractImports(fs.readFileSync(file, 'utf-8'), file);
    for (const problem of extracted.problems) problems.push({ ...problem, from: path.relative(ROOT, file) });
    for (const imp of extracted.imports) {
      // An interpolated template literal names no single file to follow.
      if (imp.isPrefix) continue;
      const resolved = resolveImport(path.dirname(file), imp.target);
      if (resolved) {
        if (!visited.has(resolved)) queue.push(resolved);
      } else if (imp.target.startsWith('@/') || imp.target.startsWith('.')) {
        unresolved.push({ spec: imp.target, from: path.relative(ROOT, file) });
      }
    }
  }
  return { visited, unresolved, problems };
}

function checkFunctionTsxDeps() {
  const entries = discoverFunctionEntries();
  if (entries.length === 0) {
    console.error('  ✗ no Vercel function entries found under api/** or middleware.*');
    console.error('    Discovery is broken or the override is empty; the .tsx dependency walk would check nothing.');
    return 1;
  }

  let functionViolations = 0;
  for (const entry of entries) {
    const entryRel = path.relative(ROOT, entry);
    // Only reachable for an entry named explicitly via EDGE_ENTRIES_ADDITIONAL
    // / _OVERRIDE — auto-discovery never yields a path it did not just read.
    if (!fs.existsSync(entry)) {
      console.error(`  ✗ ${entryRel}`);
      console.error('    Function entry named explicitly but not found on disk. Fix the path or drop it from the override.');
      functionViolations += 1;
      continue;
    }
    const { visited: closure, unresolved, problems } = walkImportClosure(entry);
    console.log(`[check-architecture] function entry ${entryRel} — scanning ${closure.size - 1} transitive deps`);
    for (const { from, line, message } of problems) {
      console.error(`  ✗ ${from}:${line} (reachable from function entry ${entryRel})\n    ${message}`);
      functionViolations += 1;
    }
    for (const { spec, from } of unresolved) {
      console.error(`  ✗ ${from}`);
      console.error(`    unresolvable import \`${spec}\` reachable from function entry ${entryRel}.`);
      console.error('    The import walk cannot follow it, so any .tsx behind it goes unchecked.');
      console.error('    Fix the path, or add the alias to tsconfig.json compilerOptions.paths.');
      functionViolations += 1;
    }
    for (const file of closure) {
      if (file === entry) continue; // entry .tsx is fine
      if (!file.endsWith('.tsx')) continue;
      const rel = path.relative(ROOT, file);
      console.error(
        `  ✗ ${rel}\n` +
        `    JSX (.tsx) file reachable from function entry ${entryRel}.\n` +
        `    reason: Vercel Function bundles must not contain .tsx dependencies\n` +
        `            (docs/architecture.md 境界ルール; the Edge bundler has no TSX\n` +
        `            loader for deps). Rewrite as plain .ts using \`createElement\`\n` +
        `            (or move the JSX into the entry file itself). See the\n` +
        `            2026-05-14 decision-log entry for the incident write-up.`,
      );
      functionViolations += 1;
    }
  }
  return functionViolations;
}

function main() {
  const violations = checkLayerRules() + checkFunctionTsxDeps();
  if (violations > 0) {
    console.error('');
    console.error(`[check-architecture] ${violations} boundary violation(s). See docs/architecture.md §6.2.`);
    process.exit(1);
  }
  console.log('[check-architecture] ✓ all enforced layer boundaries respected');
}

main();
