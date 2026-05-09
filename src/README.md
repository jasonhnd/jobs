# src/

TypeScript + Astro source root.

## Structure

```
src/
├── data/
│   ├── schema/              # Zod schemas — source of truth for data shapes
│   ├── lib/                 # bands / score-strategy / sector-resolver / indexes / now / fsum / python-round / rankings
│   ├── projections/         # 12 projections written by build.ts to public/data.*
│   ├── build.ts             # TS-ETL orchestrator (`npm run build:data`)
│   ├── import-ipd.ts        # IPD xlsx → data/occupations/*.json
│   └── test-consistency.ts  # L3 projection sanity (`npm run test:consistency`)
├── pages/                   # Astro routes
│   ├── index.astro          # /  (uses src/index-source.html via Fragment injection)
│   ├── about.astro / compliance.astro / privacy.astro / 404.astro
│   ├── map.astro            # /map
│   ├── sitemap.xml.ts       # /sitemap.xml (dynamic)
│   ├── image-sitemap.xml.ts # /image-sitemap.xml (dynamic)
│   └── ja/
│       ├── [id].astro       # /ja/{id}
│       ├── sectors/index.astro + [sector].astro
│       └── rankings/index.astro + [type].astro
├── components/              # Footer.astro, etc.
├── layouts/                 # BaseLayout.astro
├── lib/                     # canonical-css.ts (site-wide typography source)
└── index-source.html        # legacy raw HTML for /, embedded by index.astro
```
