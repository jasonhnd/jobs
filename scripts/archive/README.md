# Historical cached development helpers

Sanitized backup for Issue #922. Files retain their original path relative to `.cache/` below `cached-helpers/`.
These are historical source artifacts, not supported entrypoints. Do not execute them: they may contain obsolete scoring, deployment, merge or branch-deletion commands. This backup executed none of them.
Local paths and private identifiers have been replaced by placeholders; manual adaptation and current authorization are required before any future use.

| Original cached path | Purpose | Bytes |
| --- | --- | ---: |
| `handoff/2026-09-24-band-rule/verify_band_rule.py` | Historical numerical band-rule verification. | 7676 |
| `handoff/merge-queue.sh` | Historical sequential PR queue controller (inactive). | 1893 |
| `mms-829-preview-check.mjs` | Historical preview browser verification. | 14921 |
| `scoring/mms-12-full/start-after-opus.sh` | Historical dependent scoring-run trigger (inactive). | 1466 |
| `scoring/mms-8f-full/score_chunks.py` | Historical chunked in-session scoring helper (inactive). | 5409 |
| `scoring/mms-8f-pilot/run-chunk.sh` | Historical pilot scoring chunk wrapper (inactive). | 2033 |
| `scoring/mms-8g-full/finish.sh` | Historical scoring assembly/finalization helper (inactive). | 2112 |
| `scoring/mms-9-full/score_one.py` | Historical single-occupation scoring helper (inactive). | 3187 |
| `scoring/mms-9-pilot/score_one.py` | Historical single-occupation scoring helper (inactive). | 2057 |

Skipped exact GitHub/repository duplicates:

- `handoff/2026-09-23-mms-11-12/opus55_score_chunks.py` (exact Git blob already reachable in fetched GitHub refs).

The cached `etl/build-manifest.json` is omitted: `src/data/promote.ts` regenerates it during `bun run build:data`; it records build IDs, finish time and promoted entries, rather than unique source data.
Other cached Markdown is outside this Issue. The generator and verifier are in `scoring_archive.py`.
