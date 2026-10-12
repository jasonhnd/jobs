# Jason's decisions — jobs

Newest first. Only decisions Jason actually made; open questions live in
[HANDOVER.md](HANDOVER.md).

## 2026-10-12 — Leader moves to its own profile

- Decision: the jobs leader becomes a new Hermes profile `leader-jobs` with
  its own memory. The outgoing leader writes `docs/leader/` and stops.
- Why: the leader needs persistent memory that survives sessions and VM loss.

## 2026-10-12 — Concurrency limit replaced

- Decision: the "at most 2 running cards on the whole machine" rule is
  withdrawn. Hermes controls concurrency automatically (memory-based cap,
  auto-pause when memory is tight). The leader does not count cards; it does
  not add new cards while load stays above 6.
- Why: two cards was too few.

## 2026-10-12 — Board working rules

- Roles: one leader per project (inspects, splits cards, writes briefs,
  accepts, asks Jason; never writes code, never pushes work branches).
  Shared roles: `executor` (Sonnet), `reviewer` (Opus), `reader` (Sonnet,
  read-only), `batch` (Haiku: merging PRs and chores).
- No hard cards: split until each card has a focused change and a one-line
  acceptance. Do not use `--model`. Money, permissions, security, data
  migration, external commitments and releases are split small, asked to
  Jason first, and shown to Jason again after review passes.
- Everything goes to GitHub. Code cards: `--workspace worktree --branch
  kanban/<card id>` (no path). `git pull` in the main checkout before opening
  cards; keep the main checkout clean. Reader cards:
  `--workspace dir:/home/paseo/projects/jobs`; never scratch.
- Executors commit + push each step and open a PR to `preview`; "pushed and
  PR opened" is part of done. Never push directly to `preview` or other work
  branches.
- Card body = the executor's whole brief: goal, files allowed, forbidden
  actions, reproduction (bugs), acceptance commands and expected output, and
  "push to kanban/<card id>, open a PR to preview, then kanban_request_review
  to reviewer".
- Reviewer approval is not acceptance. The leader checks the PR against the
  requirement item by item, then opens a `batch` card saying "leader accepted,
  OK to merge" with the PR link.
- No deleting, spending, secret changes, or touching production data / the
  live site unless Jason says so.
- Questions to Jason: numbered, why it must be decided now, options A/B/C
  with pros/cons, and a separate "Recommend: X" with reason.
- Reply in simplified Chinese, plain words, conclusion first, short bullets.
- Why: the project moved from the Mac to this VM, and the VM may disappear.

## 2026-10-12 — Project moved to the VM

- Decision: development continues on this VM at `/home/paseo/projects/jobs`,
  branch `preview`, GitHub is the source of truth. Mac kanban cards are not
  migrated; the leader rebuilds cards from the current state. Files only
  under `/home`. `gh` is `/home/paseo/bin/gh`. Board commands always use
  `--board jobs`.

## 2026-10-10 — Release approval (「同意上线」)

- Decision: Jason replied 「同意上线」 for the ordinary / Pro redesign release
  (recorded 2026-10-10T07:57:17.595Z, see #906 / #907).
- Scope: release approval only. It is **not** a PS-05 waiver and not
  permission for an agent to merge. Jason merges #907 himself with a merge
  commit.
