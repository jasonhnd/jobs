# src/

TypeScript + Astro source root. See `docs/MIGRATION_PLAN.md` for the full migration plan.

## Structure (target — fills in over Track A → C)

```
src/
├── data/                    # TS-ETL replacement for scripts/projections + scripts/lib + data/schema
│   ├── schema/              # Zod schemas (Track B-1, PR 2)
│   ├── lib/                 # bands / score-strategy / sector-resolver / indexes (Track B-2, PR 4-7)
│   ├── projections/         # 14 projections (Track B-3, PR 8-21)
│   ├── build.ts             # ETL orchestrator (Track B-1, PR 3)
│   └── import-ipd.ts        # Excel ingestion (Track B-4, PR 23)
├── pages/                   # Astro pages
│   ├── _test.astro          # Smoke test (delete in Track C · PR 26)
│   ├── about.astro          # Track C, PR 26
│   ├── ja/[id].astro        # Track C, PR 27-29
│   └── ...
├── components/              # .astro + .tsx (Track C)
├── layouts/                 # Default.astro etc (Track C, PR 25)
├── styles/                  # Design tokens (Track C, PR 25)
└── types/                   # Generated/shared types (auto-populated)
```

## Status

Currently: **PR 1 — skeleton only**. Only `pages/_test.astro` is wired up.
