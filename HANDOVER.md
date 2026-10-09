# jobs <leader> handover (2026-10-09)

Outgoing <leader>: Paseo agent 507dd7b5 (took over from 2581d6c3 on 10/06). Kanban <leader>: 0be27268; AFC <leader>: a73daf28.
Detailed notes: `.cache/handoff/SUPERVISOR_STATUS.md` (git-ignored). Reusable brief parts: `.cache/briefs/process.txt`, `.cache/briefs/redesign-ctx.txt`.
origin/preview = bc7678c9. Production (main) untouched since 067c20e8.
Rules that changed this week: GitHub Actions are off for jasonhnd repos (since 10/08) — no CI; merges need the real local acceptance output in the PR, branch protection requires only `Vercel` (JOB_0218, d1008-181508-1). Visual checks on pre must abort analytics requests (pre ships real GA/ad IDs).
Owner is very sensitive to unclear questions: every A/B/C must say what the thing is, why the options exist, the concrete consequence of each, and the recommendation with reason; use a real example page (owner complaints 10/09).

## 現在在做什么、在等谁

### 已落地
- Full-repo bug audit (owner request 10/07): audit cards JOB_0171–0175, JOB_0182; reports in `.cache/audit-2026-10-07/`. Fixes merged to preview: #865 #868 #869 #870 #871 #872 #873 #875 #877 #879 #882 #883 #885 #887 (JOB_0176–0208 range); pre screenshot checks JOB_0203, JOB_0208 passed.
- Three-band score words 「変化 小さい／中くらい／大きい」 site-wide + signed sentences/thresholds: #889 (JOB_0212/0214/0215; d1008-001638-1, d1008-061236-1/-2); pre check JOB_0217 passed.
- No-Actions merge process docs: #891 (JOB_0219/0221). Branch protection change: JOB_0218.
- Ordinary/Pro split, owner direction 10/08 (d1008-175348-1 /pro on same domain; d1008-175348-2 two pages per occupation; d1008-201609-1 + d1008-202939-1 eight ordinary rankings; d1008-202037-1 ordinary = home/occupation/8 rankings/map/sectors/shindan; d1008-212333-1 keep current design, subtract only):
  - Stage 0 contract docs `docs/PRO_SPLIT.md`, `docs/pro-split/route-manifest.json`: #893 (JOB_0223/0224).
  - Stage 1A /pro skeleton (Pro hub, 556 Pro occupations, 39 Pro rankings, EditionNav): #895 (JOB_0225/0226; copy signed d1009-001014-1).
  - Stage 1B content moved to /pro + ~2,000 exact 301s in vercel.json (owner authorized d1008-214048-1): #899 = bc7678c9 (JOB_0233/0235); live pre check JOB_0236 passed (85 old URLs, 185 HTTP checks). Evidence `.cache/ux-2026-10-08/stage1b-pre-verify/`.

### 坏了
- Production still serves dpl_ALrYipSSmP4ajYQs5sknvB7GWazc (10/03); Vercel never built main 067c20e8 (JOB_0168). Owner chose C (d1005-160908-1): ship with the next main push and confirm a production deployment is actually created.
- Vercel route rules: 2,022 of 2,048 used after #899 (JOB_0233). Any further moves need pattern rules instead of per-page 301s — ask the owner first.

### 未验证
- Stage 2 ordinary occupation page (PR #898, owner signed d1009-202854-1 A+A): reviewed and locally verified, but not merged (conflicted with #899). JOB_0237 is resolving the 12 conflicts (in review); JOB_0238 merges after the <leader> writes 「可以合」 on JOB_0237. After merge, send a pre screenshot check (block analytics).
- Stage 3 ordinary 8 rankings: JOB_0231 (in review). New Japanese (incl. ai-risk-high title candidate 「AIで大きく変わる仕事 TOP30」) needs owner signature before merge — show one real page as the example.
- Stage 4 ordinary home/map/sectors/navigation: JOB_0232 (in progress). Same signature rule.
- Whether #856 lowered Vercel build minutes (`vercel usage`).

### 待做
- After stages 2–4 merge: final pre acceptance for the whole split (roadmap stage 5, `.cache/ux-2026-10-08/pro-split-roadmap.md`).
- Production promotion of the split: only after the #577 three-week window (~10/12) and explicit owner approval (roadmap option 7A, decided by <leader>).
- Leftover unsigned old-word sentences (annual report, Q&A bodies, ranking intros, occupation FAQ 将来性 clause) — listed in `src/lib/signed-band-copy.test.ts`; ask owner when Pro copy is reviewed.

### 死路
- Hand-written JS lexers for the analytics / architecture gates kept missing edge cases; replaced by @babel/parser AST (#868, #883). Do not go back to regex scanning.
- Stage-2 "first-screen sentence" redesign within the old single site (d1008-095048-1..4) was superseded by the ordinary/Pro split (closed as stale 10/08).
