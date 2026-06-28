// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

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
// Astro components. The only React consumer is api/og.tsx (Vercel Edge
// function bundled separately from Astro) which calls `createElement` from
// the `react` package directly — that's a runtime-only dep, not an Astro
// integration. Dropping @astrojs/react removes a 142KB unreferenced
// client.js from dist-astro/_astro/ and saves an unused build pass.

export default defineConfig({
  site: 'https://mirai-shigoto.com',
  output: 'static',
  outDir: './dist-astro',
  trailingSlash: 'never',
  compressHTML: false,
  build: {
    format: 'file',
  },
  vite: {
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
