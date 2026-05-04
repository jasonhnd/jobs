# data/.archive/v0.6/ — frozen pre-IPD source files

These files were the **canonical source data** through v0.6.x. Starting v0.7.0
(2026-05-04), the pipeline migrated to JILPT IPD v7.00 source data and these
files are **no longer read by build_data.py / build_occupations.py / api/og.tsx /
index.html**. They are kept here for:

- **Audit trail** — reproducibility of any v0.6.x deploy from git history
- **Migration provenance** — `migrate_stats_legacy.py` / `migrate_translations.py`
  / `migrate_scores.py` document exactly what fields came from where
- **Cross-version diffs** — when comparing scores or labels across architecture
  generations

## Contents

| File | Origin | Replaced by |
|---|---|---|
| `data.json` | flat 552-record build output of v0.6.x `build_data.py` (legacy) | `dist/data.treemap.json` (552 records, array-of-objects) + `dist/data.detail/<id>.json` × 556 |
| `occupations_full.json` | raw scrape of jobtag.mhlw.go.jp pages (580 records, including 28 with `ok=False`) | `data/occupations/<padded>.json` × 556 (sourced from JILPT IPD v7.00 xlsx) |
| `occupations.json` | tiny early-version index of (id, title) pairs | `data/occupations/<padded>.json` (titles preserved) |
| `ai_scores_2026-04-25.json` | Claude Opus 4.7 single-run scores in v1.0 schema | `data/scores/occupations_claude-opus-4-7_2026-04-25.json` (ScoreRun v2.0 schema, same 552 scores + full audit metadata) |
| `translations_2026-04-25.json` | Claude Opus 4.7 single-file translations | `data/translations/en/<padded>.json` × 552 |

## Reproducing v0.6.x output

```
git checkout v0.6.x
python3 scripts/build_data.py   # v0.6 version, would read data.json directly
```

Do NOT run the v0.7+ pipeline against these files; the v0.7+ scripts
(`scripts/import_ipd.py`, `scripts/build_data.py`) read from the new
`data/occupations/` etc. paths and ignore this archive entirely.

## Do not edit

These files are **frozen**. Any new work goes through the IPD pipeline. If you
need to recover a deleted occupation or label, copy the field into the
new schema, do not resurrect a v0.6.x file.

— Last frozen: 2026-05-04 (Phase 4 of IPD migration)
