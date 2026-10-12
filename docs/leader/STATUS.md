# Leader status — jobs

Snapshot: 2026-10-12 (UTC), written by the outgoing VM leader at handover.
Repository records must be English or Japanese (AGENTS.md), so these notes are
in English. Talk to Jason in simplified Chinese.

## What the project is

- mirai-shigoto.com: an unofficial Japanese site that overlays multi-model
  AI-impact scores (AIOIS-10) on 556 MHLW jobtag occupations (treemap,
  rankings, occupation pages, sectors, diagnosis).
- Astro static site + Bun, deployed on Vercel. `preview` = integration branch
  (alias `pre.mirai-shigoto.com`), `main` = production.

## Where it stands

- The ordinary / Pro split (stages 0–4) and the homepage `hub-card-grid` fix
  (#909) are all merged into `preview`. Head `85ba7f7e`, tree `bc343d9d`.
  - Ordinary edition: simplified home, 556 occupation pages, 8 rankings, map,
    sectors, diagnosis, owner-signed Japanese copy.
  - Pro edition under `/pro`: complete data, 39 rankings; public and free.
  - 2,001 explicit 301 rules for legacy research paths.
- Ready preview deployment `dpl_BSvngLhMEMnmRfZnqBzyLbNr9kKi` serves
  `85ba7f7e` on `pre.mirai-shigoto.com`.
- Release PR #907 (preview → main) is open as **draft**; Issue #906 tracks it.
- Production still serves the 2026-10-03 deployment of `bd44cb8c`. Main
  `067c20e8` was never deployed (a past main push produced no deployment).

## Kanban board `jobs`

- **Empty.** No cards have been created on this VM. The Mac-era cards were not
  migrated. Proposed cards are in [HANDOVER.md](HANDOVER.md); none are created
  until Jason confirms.

## Open on GitHub

| Item | State |
| --- | --- |
| Issue #906 | Open. Release preparation record (lock, evidence, pending conditions). |
| PR #907 | Open, draft, MERGEABLE, `Vercel` success. Human owner must merge with a merge commit. |

## Blocked / stuck

1. **PS-05 observation window.** Three-week point is
   2026-10-13T14:42:03Z (23:42 JST). A final frozen old-path GSC comparison
   is still needed after Google reporting matures. #907 must stay draft until
   then (or until Jason explicitly waives PS-05).
2. **The VM cannot run the acceptance chain yet.** No `bun`; `node` is v22
   (project needs 24); `node_modules` empty; no `vercel` CLI.
3. **Mac evidence is gone.** Logs under `/tmp/JOB_0249`, `/tmp/JOB_0250`,
   `/tmp/JOB_0251`, `/tmp/JOB_0253` were on the Mac. Only the numbers copied
   into #906 / #907 survive.
4. **AGENTS.md vs the new board rule** on when to push (see HANDOVER Q5).
   Code cards should not be opened until this is decided.

## Known deferred items (not blocking release)

- `/pro/1` at 375px: chipnav clipped by about 2px.
- Older signed-wording leftovers on some pages (annual report, Q&A, ranking
  intros, occupation FAQ, 404).
- Vercel route rules at 2,022 / 2,048.
- `docs/DESIGN_CONFORMANCE.md` line 41 still says the Pro split is "Pending
  implementation".
