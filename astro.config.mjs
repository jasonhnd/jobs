// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { transform } from 'esbuild';

/**
 * Minify `.js` files that Vite emits as plain assets.
 *
 * A `?url` import hands the file to Vite's asset pipeline, not its JS
 * pipeline: the bytes are hashed and copied verbatim, so minification never
 * runs. `src/pages/index.astro` loads `_index-inline.js` that way, and the
 * homepage was shipping all 101 KB of it — comments, indentation and all
 * (47 KB after minification; 29.5 KB → 15.0 KB over the wire). Lighthouse
 * flagged it as `unminified-javascript` on 2026-09-21.
 *
 * `generateBundle` runs after Rollup has named the asset, so the emitted file
 * keeps the hash derived from the *source* bytes. That is still correct as a
 * cache key — any source edit rotates it — but it does mean the first deploy
 * after this change reuses the current hash, so already-cached clients keep
 * the un-minified copy until their `immutable` entry expires.
 *
 * `transform()` is called without `format`/`target`, so the file stays a
 * classic script with its top-level declarations intact (page JS relies on
 * script scope) and no syntax is down-levelled.
 */
function minifyEmittedJsAssets() {
  return {
    name: 'minify-emitted-js-assets',
    apply: 'build',
    /**
     * @param {unknown} _options
     * @param {Record<string, any>} bundle
     */
    async generateBundle(_options, bundle) {
      for (const emitted of Object.values(bundle)) {
        if (emitted.type !== 'asset' || !emitted.fileName.endsWith('.js')) continue;
        const source =
          typeof emitted.source === 'string'
            ? emitted.source
            : Buffer.from(emitted.source).toString('utf-8');
        const { code } = await transform(source, { minify: true, loader: 'js' });
        emitted.source = code;
      }
    },
  };
}

// https://astro.build/config
//
// Architecture:
//   - outDir → ./dist-astro/   (Vercel deploys this; vercel.json:outputDirectory matches)
//   - publicDir → ./public/    (Astro default; SEO statics tracked here, plus TS-ETL
//                              data.*.json output written here at build time)
//   - build.format: 'file'     (legacy /ja/{id}.html URL shape preserved)
//
// Data flow:
//   data/* → npm run build:data (src/data/build.ts) → public/data.*.json
//   public/ + src/pages/ → astro build → dist-astro/   (Vercel deploys this)
//
// public/ contents:
//   - Tracked: og.png, robots.txt, llms.txt, llms-full.txt   (SEO statics)
//   - Untracked: data.*.json, data.detail/, data.labels/, ... (TS-ETL output;
//                regenerated on every build, see .gitignore)
//
// No React integration: the site has no client:* directives and no .jsx/.tsx
// Astro components. The only React consumer is api/og.tsx (Vercel Function,
// Bun 1.4 via runtime nodejs + bunVersion) which calls `createElement` from
// the `react` package directly — that's a runtime-only dep, not an Astro
// integration. Dropping @astrojs/react removes a 142KB unreferenced
// client.js from dist-astro/_astro/ and saves an unused build pass.

export default defineConfig({
  site: 'https://mirai-shigoto.com',
  output: 'static',
  outDir: './dist-astro',
  trailingSlash: 'never',
  compressHTML: true,
  build: {
    format: 'file',
  },
  vite: {
    plugins: [minifyEmittedJsAssets()],
    resolve: {
      alias: {
        // fileURLToPath returns a real OS path on every platform.
        // .pathname returns "/C:/..." on Windows (leading slash before drive
        // letter), which breaks Vite alias resolution.
        '@/data': fileURLToPath(new URL('./src/data', import.meta.url)),
        '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@/layouts': fileURLToPath(new URL('./src/layouts', import.meta.url)),
        '@/graph': fileURLToPath(new URL('./src/graph', import.meta.url)),
        '@/views': fileURLToPath(new URL('./src/views', import.meta.url)),
        '@/templates': fileURLToPath(new URL('./src/templates', import.meta.url)),
        '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      },
    },
  },
});
