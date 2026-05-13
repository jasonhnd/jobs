#!/usr/bin/env node
/**
 * build-og-renderers.cjs — pre-compile `api/og-renderers/*.tsx` to `*.js`.
 *
 * Why this exists
 * ──────────────────────────────────────────────────────────────────────
 * Vercel's Edge Function bundler compiles the entry `.tsx` file
 * (api/og.tsx) but does NOT compile dependency `.tsx` files — it only
 * resolves `.js → .ts` for relative imports, not `.js → .tsx`. The
 * Step 9 OG-endpoint refactor extracted 4 JSX renderers into
 * api/og-renderers/*.tsx and broke ~25 consecutive preview deploys
 * with:
 *
 *   The Edge Function "middleware" is referencing unsupported modules:
 *     - __vc__ns__/2/api/og.js: ./og-renderers/generic.tsx,
 *       ./og-renderers/map.tsx, ./og-renderers/sector.tsx,
 *       ./og-renderers/occupation.tsx
 *
 * Both "move into api/" and "use explicit .tsx extension in imports"
 * failed — the bundler simply refuses to follow .tsx for deps.
 *
 * Resolution: compile the four .tsx files to .js with esbuild before
 * Vercel runs its own bundler. The compiled .js files sit alongside
 * the .tsx sources (gitignored), and api/og.tsx imports them as
 * `./og-renderers/<name>.js`. Vercel's bundler finds an actual file
 * at that exact path and bundles cleanly.
 *
 * Output
 * ──────
 *   api/og-renderers/generic.js
 *   api/og-renderers/map.js
 *   api/og-renderers/sector.js
 *   api/og-renderers/occupation.js
 *
 * Each file is ESM, target ES2022, JSX compiled via the automatic
 * runtime (so no `import { jsx } from 'react/jsx-runtime'` boilerplate
 * is required in the source). External imports (`@vercel/og`, the
 * sibling og-helpers under src/lib/) stay external — esbuild does NOT
 * bundle them, since Vercel's own bundler will follow those imports.
 *
 * Wired into `pnpm build` as the FIRST step so the .js files exist
 * before astro / vercel touch anything.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src', 'lib', 'og-renderers');
const OUT_DIR = path.join(ROOT, 'api', 'og-renderers');

const SOURCES = ['generic.tsx', 'map.tsx', 'sector.tsx', 'occupation.tsx'];

async function main() {
  const entryPoints = SOURCES.map((f) => path.join(SRC_DIR, f));
  for (const ep of entryPoints) {
    if (!fs.existsSync(ep)) {
      console.error(`[build-og-renderers] missing source: ${ep}`);
      process.exit(1);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // bundle: false keeps each .tsx as its own .js with imports preserved.
  // The compiled .js files import `@vercel/og` and `../og-helpers.js`
  // (now resolved to `../../src/lib/og-helpers.js` from the OUT_DIR
  // perspective — esbuild rewrites the relative path appropriately).
  // Vercel's downstream bundler still follows those imports, but they're
  // .ts / npm-package imports which Vercel handles fine.
  await esbuild.build({
    entryPoints,
    outdir: OUT_DIR,
    bundle: false,
    format: 'esm',
    target: 'es2022',
    platform: 'neutral',
    jsx: 'automatic',
    sourcemap: false,
    logLevel: 'info',
  });

  // esbuild keeps the `../og-helpers.js` import path verbatim from the
  // source, but since the .js output now lives at OUT_DIR (api/og-renderers)
  // not SRC_DIR (src/lib/og-renderers), `../og-helpers.js` would resolve
  // to api/og-helpers.js which doesn't exist. Rewrite to the proper
  // ../../src/lib/og-helpers.js path. (Faster + safer than asking esbuild
  // to bundle helpers — they stay external for tree-shaking.)
  const outputs = SOURCES.map((f) => path.join(OUT_DIR, f.replace(/\.tsx$/, '.js')));
  for (const out of outputs) {
    if (!fs.existsSync(out)) {
      console.error(`[build-og-renderers] expected output missing: ${out}`);
      process.exit(1);
    }
    let txt = fs.readFileSync(out, 'utf8');
    txt = txt.replace(/from\s+["']\.\.\/og-helpers\.js["']/g, 'from "../../src/lib/og-helpers.js"');
    fs.writeFileSync(out, txt);
  }

  console.log(`[build-og-renderers] compiled ${SOURCES.length} renderers → ${OUT_DIR}/*.js`);
}

main().catch((err) => {
  console.error('[build-og-renderers] failed:', err);
  process.exit(1);
});
