# src/page-data/ — Build orchestration layer

Files in this directory are **page dataset builders**. They sit between
`src/views/` (pure functions over a graph) and `src/pages/` (Astro
binding shells).

## What lives here

A page-data module is allowed to:

- Call `loadGraph()` (and rely on its memoization)
- Compose multiple view functions into the dataset a specific Astro
  page family needs (`getStaticPaths` input + per-page props)
- Pre-compute cross-occupation maps that have to be transported via
  Astro's `getStaticPaths → component` boundary (Maps don't survive,
  so they're serialized to `Array<[K, V]>` here)
- Dynamically import view modules (Astro's static analysis
  expects this pattern inside `getStaticPaths`)

## What does NOT live here

- HTML / SafeHtml production — that's `src/templates/` or page-local
  `_*-renderers.ts` siblings under `src/pages/`
- Schema validation / parsing — that's `src/graph/loader.ts`
- Reading `public/data.*.json` — that should flow from the graph;
  any remaining fs reads here are transitional and tracked in the
  Phase E plan

## Why a separate layer

`src/views/` modules are pure functions `(graph, params) => result`.
Calling `loadGraph()` from a view inverts the data-flow direction:
the view becomes an orchestrator, not a consumer. The architecture
boundary gate (`scripts/check-architecture.cjs`) enforces this — a
module that initiates `loadGraph` belongs in `src/page-data/`, not
`src/views/`.

History: this directory was created in Phase E (2026-05-15) by
moving `occupation-page-data.ts` out of `src/views/`. The audit
that triggered Phase E identified two `src/views/*.ts` files that
were doing orchestration rather than pure view work; they live here
now.
