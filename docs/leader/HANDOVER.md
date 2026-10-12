# Leader handover — jobs

Written 2026-10-12 by the outgoing VM leader for the `leader-jobs` profile.
Read [STATUS.md](STATUS.md) and [DECISIONS.md](DECISIONS.md) first.

## Questions waiting for Jason

Originals were asked in Chinese; the gist and recommendation are below.
None has been answered yet.

**Q1. When to release #907?**
- A. After the GSC freeze (card 2) is done, Jason merges #907.
- B. Waive PS-05 now and merge.
- C. Keep as is, no release yet.
- Recommend: **A**. The three-week point is 2026-10-13 23:42 JST; waiting a
  day or two for mature data is the lowest risk.

**Q2. Who exports the GSC data?**
- A. Jason exports the files and hands them to an agent for analysis.
- B. Give this VM read-only GSC access (touches credentials; needs explicit
  authorization).
- Recommend: **A**. No secrets involved.

**Q3. When to do cards 4–7?**
- A. After the release.
- B. In parallel now.
- Recommend: **A**. Anything merged into `preview` now invalidates the #907
  acceptance lock and forces re-verification.

**Q4. May card 1 be opened on its own now?**
- Recommend: **yes**. Every other card depends on it; it does not change the
  repository and costs nothing.

**Q5. Push timing conflicts with AGENTS.md.** New board rule: commit + push
each step. AGENTS.md: push only after the full local acceptance chain passes.
Must be settled before any code card.
- A. Follow the board rule (push every step). Pro: nothing lost if the VM
  dies. Con: violates AGENTS.md; unverified commits on the branch.
- B. Follow AGENTS.md (push only after acceptance). Pro: consistent with the
  repo. Con: work lives only on the VM until then.
- C. Push every step to `kanban/<id>`, open the PR as **draft**, mark ready
  after acceptance passes.
- Recommend: **C**. `kanban/*` branches do not trigger Vercel builds and are
  not merged into `preview`, so early pushes are safe and both goals are met.
  After Jason confirms, draft an Issue to amend AGENTS.md for Jason to sign.

## Proposed cards (not created)

All need to be rewritten to the 2026-10-12 card-body rules before creation
(goal, files allowed, forbidden, acceptance commands + expected output,
"push to kanban/<id>, PR to preview, kanban_request_review").

| # | Title | What | Acceptance | Priority | Notes under new rules |
|---|---|---|---|---|---|
| 1 | Set up jobs local acceptance on the VM | Install Bun 1.4.2, Node 24, Playwright Chromium under `/home` in a private dir on PATH; no global upgrades | Full AGENTS.md chain on clean `preview` exits 0; record counts, versions, log paths under `/home`; `git status` clean | P0 | Not a code card nor read-only; say where tools go and which role/workspace |
| 2 | GSC final freeze after PS-05 | After 10/13 23:42 JST and data maturity, export fixed 556 IDs + 35 ranking slugs old-path data and compare windows | Export files + table (clicks/impressions/CTR/position), 4 noindex slugs separate, cutoff and maturity stated, posted to #906 | P0 (depends on Q2) | Release-related: split small, ask Jason first |
| 3 | Pre-release recheck of #907 | Recheck SHAs/tree/full diff/`Vercel`/resolved threads; rerun acceptance on the VM | #907 body updated with VM output; any preview delta explained; no merge, no ready | P1 | Leader's own acceptance work, or split into reader checks; not executor |
| 4 | Fix `/pro/1` 375px 2px chipnav clip | Fix chipnav bounds; no Japanese copy changes | 375/768/1440 screenshots, left ≥ 0 and right ≤ viewport; new e2e test; full chain; Issue + PR | P2 | Code card: worktree + `kanban/<id>` |
| 5 | Update DESIGN_CONFORMANCE Pro-split row | Update line 41 to reflect merged stages; docs only | `bun run check:docs-links` passes; Issue + PR | P3 | Code card: worktree + `kanban/<id>` |
| 6 | Inventory old signed-wording leftovers | List places not yet on new signed copy (annual report, Q&A, ranking intros, FAQ, 404); list only | List with file locations filed as an Issue for Jason to sign copy | P3 | Assign to `reader`, `dir:` workspace |
| 7 | Route-rule headroom study | Investigate 2,048 cap headroom and consolidation options; no config change | Report with option risks, conclusion in an Issue | P3 | Assign to `reader`, `dir:` workspace |

## Recent topics and Jason's points

- Project just moved from the Mac to this VM; rebuild the board from current
  state, do not port old cards.
- New working rules and roles (see DECISIONS 2026-10-12). The outgoing leader
  listed which proposed cards would violate them (above, last column); the
  board itself was empty so nothing needed fixing.
- Concurrency: Hermes manages it; only hold new cards when load stays above 6
  (load was about 11 at handover time).
- Leader replaced by profile `leader-jobs`; this file is the handover.

## Next steps

1. Get Jason's answers to Q1–Q5.
2. If Q4 is yes: open card 1 (rewritten to the new rules).
3. After 2026-10-13 23:42 JST: per Q1/Q2, set up the GSC freeze.
4. After the freeze: recheck #907 (card 3), then Jason merges; afterwards
   confirm a production deployment exists for the exact merge SHA and do one
   bounded check (never crawl `mirai-shigoto.com`).
5. Post-release: cards 4–7, then the AGENTS.md push-timing amendment (Q5).

## Pitfalls

- Do not cite the 2026-10-10 Mac acceptance logs as fresh evidence; they are
  gone and certify only tree `bc343d9d`.
- Merging anything into `preview` before release breaks the #907 lock.
- `preview` is not the default branch: `Closes #N` does not auto-close Issues.
- Never use firewall Challenge actions; any Vercel write needs owner approval.
