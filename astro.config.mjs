// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

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

export default defineConfig({
  site: 'https://mirai-shigoto.com',
  output: 'static',
  outDir: './dist-astro',
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
      },
    },
  },
});
