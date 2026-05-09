# `data/` — source-of-truth for the build pipeline

Every file here is INPUT to `npm run build:data`. The TypeScript ETL
(`src/data/build.ts`) reads from this directory, validates each file
against the matching Zod schema, and writes 12 projection families to
`public/data.*` (which the Astro build then bakes into `dist-astro/`).

## Layout

```
data/
├── occupations/       <padded>.json × 556    — one per occupation, source-of-truth
├── stats_legacy/      <padded>.json × 552    — labor-market stats (salary, workers, etc.)
├── scores/            <scope>_<model>_<date>.json — append-only AI risk score runs
├── labels/            <dimension>.ja-en.json × 7 — global skills/knowledge/abilities labels
├── sectors/
│   ├── sectors.ja-en.json                    — 16-sector taxonomy definitions
│   └── overrides.json                        — manual occ→sector overrides
├── prompts/           prompt.ja.md           — LLM scoring prompt template (audit trail)
├── rationales/        <batch>.json × 55      — staging area for hand-curated rationales
├── _archive/          translations-en/...    — archived EN translations (v1.4.0 retirement)
├── .archive/v0.6/                            — frozen v0.6 audit trail (do not modify)
├── .ipd_provenance.json                      — IPD xlsx hash + retrieved_at
└── .stats_legacy_provenance.json             — v0.6→v0.7 migration audit
```

Schemas (Zod) for every input file: **`src/data/schema/*.ts`**. The
schemas are the authoritative source for what each file is allowed to
contain — the docstring at the top of each schema file explains its
fields and null rules.

## How to update each kind of file

| Want to … | Edit | Then run |
|---|---|---|
| Add a new occupation (IPD update) | nothing — re-import via `npm run import:ipd` | `npm run build:data` |
| Fix a typo in one occupation | `data/occupations/<padded>.json` | `npm run build:data` |
| Re-categorize an occupation's sector | `data/sectors/overrides.json` | `npm run build:data` |
| Add a new sector | `data/sectors/sectors.ja-en.json` (incl. `mhlw_seed_codes`) | `npm run build:data` then audit `public/data.review_queue.json` |
| Add new AI risk scores | drop new file in `data/scores/` (never overwrite older runs) | `npm run build:data` |
| Update a label translation | `data/labels/<dimension>.ja-en.json` | `npm run build:data` |

## Worked example — one occupation

`data/occupations/0001.json` (a slim sketch — see `OccupationSchema` in
`src/data/schema/occupation.ts` for the full contract):

```json
{
  "id": 1,
  "schema_version": "1.2",
  "title": {
    "ja": "豆腐製造、豆腐職人",
    "aliases_ja": ["豆腐製造工", "豆腐職人"]
  },
  "classifications": {
    "mhlw_main": "12_072-06",
    "mhlw_all": ["12_072-06"],
    "jsoc_main": "H533",
    "jsoc_all": ["H533"]
  },
  "description": {
    "summary_ja": "豆腐店やメーカーの工場で、豆腐、油揚げ、生揚げを作る。",
    "what_it_is_ja": "...",
    "how_to_become_ja": "...",
    "working_conditions_ja": "..."
  },
  "tasks": ["...", "..."],
  "tasks_lead_ja": "...",
  "skills":     { /* per-skill numeric profile */ },
  "knowledge":  { /* per-knowledge numeric profile */ },
  "abilities":  { /* per-ability numeric profile */ },
  "work_activities":      { /* ... */ },
  "work_characteristics": { /* ... */ },
  "interests":            { /* ... */ },
  "work_values":          { /* ... */ },
  "education":            { /* ... */ },
  "employment_type":      { /* ... */ },
  "related_orgs":  [{ "name_ja": "全国豆腐連合会", "url": "http://..." }],
  "related_certs_ja": ["食品衛生責任者"],
  "url": "https://shigoto.mhlw.go.jp/User/Occupation/Detail/1"
}
```

The 12 numeric subdivisions (skills, knowledge, abilities, etc.) follow
the `OccupationSchema` null rules: a block is either fully populated OR
entirely null — never a half-populated dict with all-None values.

## What lives in `public/data.*`

NOT here. `public/data.*` is **generated** by `npm run build:data`
(reads `data/`, writes `public/`). It's gitignored and regenerated on
every Vercel deploy. If you want to know what shape the projections
take, see `src/data/projections/*.ts`.

## Archive policy

- `data/_archive/` — recoverable backups (e.g., translations dropped in
  v1.4.0). Move files BACK from here to restore.
- `data/.archive/v0.6/` — frozen audit trail of the v0.6 → v0.7 schema
  migration. Do not modify.

Both directories are intentionally tracked in git.
