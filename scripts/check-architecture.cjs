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
  // Templates and pages get strict rules in later steps (3.5 / 8).
  // For now we ship the gate active on graph + views only — both are
  // brand-new code and we want their boundaries to never regress.
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

if (violations > 0) {
  console.error('');
  console.error(`[check-architecture] ${violations} boundary violation(s). See docs/architecture.md §6.2.`);
  process.exit(1);
}

console.log('[check-architecture] ✓ all enforced layer boundaries respected');
