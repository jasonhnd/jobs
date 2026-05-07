// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
//
// Track D · PR 35 (Vercel switch):
//   - outDir → ./dist-astro/  (Vercel deploys this; vercel.json:outputDirectory matches)
//   - publicDir → ./dist/     (TS-ETL writes data.*.json here; Astro copies them into output)
//   - build.format: 'file'    (matches the legacy /ja/{id}.html URL shape)
//
// Data flow:
//   data/* → npm run build:data (TS-ETL) → dist/data.*.json
//   dist/ + src/pages/ → astro build → dist-astro/  (Vercel deploys this)
//
// See docs/MIGRATION_PLAN.md for the full migration plan.

export default defineConfig({
  site: 'https://mirai-shigoto.com',
  output: 'static',
  outDir: './dist-astro',
  publicDir: './dist',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [
    react(),
  ],
  vite: {
    resolve: {
      alias: {
        '@/data': new URL('./src/data', import.meta.url).pathname,
        '@/components': new URL('./src/components', import.meta.url).pathname,
        '@/layouts': new URL('./src/layouts', import.meta.url).pathname,
        '@/styles': new URL('./src/styles', import.meta.url).pathname,
        '@/types': new URL('./src/types', import.meta.url).pathname,
      },
    },
  },
});
