# jobs <leader> handover (2026-10-10)

Outgoing <leader>: Paseo agent fbdeaa82-f75d-4fc2-97be-9b9029ba162e (took over from 507dd7b5 on 10/09 22:16 JST). Incoming: GPT-6.1-Sol <leader> (owner decision 10/10, switch run by AFC ff5ea28f).
Kanban <leader>: d8f2af9f-3270-4b5b-96d4-d7486f428693. AFC <leader>: d240b804-49d1-44ec-925c-703ab11fb675 (a73daf28 and 0be27268 are gone).
Detailed history: `.cache/handoff/SUPERVISOR_STATUS.md` (git-ignored, has a 10/10 section). Reusable brief parts: `.cache/briefs/`.
origin/preview = 16d2100b. Production (main) untouched since 067c20e8.

Standing rules worth knowing: no GitHub Actions (since 10/08) — merges need real local acceptance output in the PR, branch protection requires only `Vercel`. Visual checks on pre must abort analytics requests (pre ships real GA/ad IDs). Owner wants plain-language questions with A/B/C, each option's concrete consequence, a recommendation and a real example page. When the owner replies to a pending decision in any form, close it at once with `roles decide done <id> --note "用户原话：…"` (owner rule 10/10).

## In-flight cards
None. All jobs cards are done/accepted (last: JOB_0248).

## Pending decisions owned by me
None. d1009-221958-1 (owner: 1a) and d1009-232009-1 (owner: 2a) closed 10/10.

## Heartbeats
None existed under fbdeaa82; nothing to copy or delete.

## 現在在做什么、在等谁

### 已落地
- Ordinary/Pro split stages 0–4 all on preview (16d2100b):
  - Stage 0 contract #893, stage 1A /pro skeleton #895, stage 1B moves + ~2,000 exact 301s #899 (see 10/09 handover in git history).
  - Stage 2 ordinary occupation page #898 (JOB_0237 conflict fix, JOB_0238 merge 6676a6b7); pre check JOB_0240 passed (dpl_CTNN81YT).
  - Stage 3 ordinary 8 rankings #902 (JOB_0231, conflict fix JOB_0242, merge JOB_0243 e5e52cfd); owner signed d1009-221958-1 (A).
  - Stage 4 ordinary home/map/sectors/nav #903 (JOB_0232, conflict fix JOB_0244, merge JOB_0245 ba28c939); owner signed d1009-232009-1 (A).
  - Home ai-risk-high card switched to the signed title 「AIで大きく変わる仕事 TOP30」 #905 (JOB_0247/0248, 16d2100b) — <leader> decided, reversible.
- Whole-split pre acceptance JOB_0246 passed on dpl_CRWNK1Xm (ba28c939): 14 pages × 3 widths, nav/titles/8 cards/score parity/10 redirects. Evidence `.cache/ux-2026-10-08/stage5-pre-verify/`.

### 坏了
- Production still serves dpl_ALrYipSSmP4ajYQs5sknvB7GWazc (10/03); Vercel never built main 067c20e8 (JOB_0168). Owner chose C (d1005-160908-1): ship with the next main push and confirm a production deployment is actually created.
- Vercel route rules: ~2,022 of 2,048 used. Further moves need pattern rules — ask owner first.

### 未验证
- #905 home-card title on deployed pre (local render at 3 widths passed in JOB_0247; not re-checked on pre).
- Whether #856 lowered Vercel build minutes (`vercel usage`).

### 待做
- Promote the split to production: only after the #577 three-week window (~10/12) and explicit owner approval (preview→main promotion PR, owner merges). After the main push, verify a production deployment really exists (see 坏了).
- Known minor, deliberately not fixed: /pro/1 at 375px chipnav clipped by 2px (no real horizontal scroll; pre-existing Pro CSS `src/pages/_id-css.ts:68`).
- Leftover unsigned old-word sentences (annual report, Q&A bodies, ranking intros, occupation FAQ 将来性 clause) — listed in `src/lib/signed-band-copy.test.ts`; ask owner when Pro copy is reviewed. 404 page still links 「AIに奪われる仕事 TOP30」 (shared page, left as-is).

### 死路
- Hand-written JS lexers for analytics/architecture gates → replaced by @babel/parser AST (#868, #883).
- Stage-2 "first-screen sentence" redesign inside the old single site (d1008-095048-1..4) superseded by the ordinary/Pro split.
- Merging two signed PRs that touch the same baselines in parallel: the second always conflicts. Merge one, then run a conflict-fix executor card (regenerate baselines, never hand-splice) before the next merge card.

## Next step for the incoming <leader>
1. `bin/kanban supervise --project jobs` (if refused because fbdeaa82 still exists, ask Kanban <leader> d8f2af9f to run handover).
2. Around 10/12, ask the owner (A/B/C, plain words) whether to promote preview → main.
