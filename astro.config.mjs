// @ts-check
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import { transform } from 'esbuild';

/**
 * Intercept only the home's verbatim `?url` script before Vite's asset loader.
 * Emit final minified bytes under their SHA-256 name and export that URL to
 * every importer. No post-naming mutation or Vite-private URL placeholders.
 * Without format/target, esbuild preserves classic-script scope and the
 * existing syntax target; it must not wrap or rename top-level declarations.
 * @returns {import('vite').Plugin}
 */
function minifyHomeScriptAsset() {
  const homeScript = fileURLToPath(new URL('./src/pages/_index-inline.js', import.meta.url));
  const homeImport = homeScript.replaceAll('\\', '/') + '?url';
  /** @type {import('vite').ResolvedConfig} */
  let config;
  return {
    name: 'minify-home-script-asset',
    apply: 'build',
    enforce: 'pre',
    configResolved(resolved) {
      config = resolved;
    },
    async load(id) {
      if (id !== homeImport) return;
      this.addWatchFile(homeScript);
      const source = await readFile(homeScript, 'utf-8');
      const { code } = await transform(source, { minify: true, loader: 'js' });
      const hash = createHash('sha256').update(code).digest('hex');
      const fileName = `${config.build.assetsDir}/_index-inline.${hash}.js`;
      this.emitFile({ type: 'asset', fileName, source: code });
      return { code: `export default ${JSON.stringify(config.base + fileName)};`, map: null };
    },
  };
}

// https://astro.build/config
//
// Architecture:
//   - outDir → ./dist-astro/   (Vercel deploys this; vercel.json:outputDirectory matches)
//   - publicDir → ./public/    (Astro default; SEO statics tracked here, plus TS-ETL
//                              data.*.json output written here at build time)
//   - build.format: 'file'     (emits /{id}.html; canonical paths are
//                              occupationPath() in src/lib/urls.ts: /{id},
//                              or /occupations/{id} for reserved ids)
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
    plugins: [minifyHomeScriptAsset()],
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
