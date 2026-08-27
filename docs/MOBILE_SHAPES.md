# MOBILE_SHAPES.md — Mobile-First Page Shapes (Build Spec)

Status: owner-approved direction (2026-08-27), based on the hi-fi mockups in
`mockups/` and live-site captures taken the same day. This document is the
single referee for the mobile redesign programme: every implementation issue
references sections here, and every PR is reviewed against it.

Audience: **any coding agent with zero prior context.** Do not improvise
beyond what is written here; where this doc says "unchanged", treat the
existing code as the spec.

## 0. Hard process gates (read first)

1. **Base branch is `preview`. Every PR targets `preview`.**
2. **Never push, merge, or PR to `main`. Never trigger a production deploy.**
   The owner reviews the finished state on `preview` and personally decides
   promotion. No exceptions, regardless of how green the checks are.
3. One issue = one PR. Keep PRs reviewable; do not bundle issues.
4. Before opening a PR, run and pass:
   - `bun run typecheck`
   - `bun run test` (bun unit tests)
   - `bun run verify:gates`
   - `bun run test:e2e` (Playwright; update visual/SEO baselines only where
     the diff is exactly the intended change of your issue, and list every
     updated baseline file in the PR description)
   - If your change touches meta/JSON-LD/hrefs: `bun run capture:seo-baseline`
     per `docs/SEO_OG_BASELINE.md` conventions.
   - If your change adds/edits any inline `<script>`: `bun run check:csp-hashes`
     and follow §3.6.
5. Every PR description must include **before/after screenshots at 390×844**
   (iPhone logical size) of the affected first screen, plus one desktop
   (≥1280px) screenshot proving desktop did not regress.
6. JA copy: strings listed in Appendix A are working copy already seen by the
   owner in mockups. Any string NOT in Appendix A must not be invented —
   reuse existing site strings. The owner signs final copy at PR review.

## 1. Why (one paragraph of context)

91% of sessions are mobile. 97% of entries land on inner pages from search:
`/rankings` 38.1% of sessions at ~10s engagement, `/compare` 34.4% at ~7s,
occupation pages are the most-viewed surface (~22k views, ~40s), `/me` holds
54s. Diagnosis: hub first screens currently serve the crawler (`.ai-fact`
citation block), the site's own stats, or the site's own type vocabulary —
not the visitor's question. The redesign makes every first screen deliver
the page's promised payload, folds depth into reachable chapters, and adds
one global action (job-name lookup). Corridor pages (rankings/compare/Q&A)
are measured by **continuation into occupation pages ("turn-in rate")**, not
by dwell time.

## 2. The five shapes — route → template map

Design 5 shapes, not 800 pages. Issues change templates ("molds"); a build
regenerates every page of that mold.

| Shape | Routes | Pages | Template (the only files to touch) |
|---|---|---|---|
| **Entry** (词条) | `/<id>` occupation pages | 556 | `src/pages/[...id].astro`, `src/pages/_RiskCard.astro`, `src/pages/_id-bindings.ts`, `src/pages/_id-css.ts` |
| **List** (名单) | `/rankings/<type>` | 39 | `src/pages/rankings/[type].astro`, `src/pages/rankings/_rankings-bindings.ts`, `src/templates/Ranking.ts` |
| | `/q/<q>` (49), `/sectors/*` (16), theme hubs (`/interests /skills /abilities /knowledge /values /education /training /work-styles /employment-types /life-balance /entry-paths /careers /licenses`, ~100+) | ~165 | phase 2 only — see §4.6; do not touch in wave 1 |
| **Duel** (并排) | `/compare/<pair>` | 20 | `src/pages/compare/[pair].astro`, `src/pages/compare/_compare-bindings.ts` |
| **Tool** | `/me`, `/shindan` (`/map` is OUT OF SCOPE) | 3 | `src/pages/me.astro`, `src/pages/shindan.astro` |
| **Home** | `/` | 1 | `src/index-source.html`, `src/pages/_index.css`, `src/pages/_index-bindings.ts`, `src/pages/_index-inline.js` |
| **Global** | all pages | — | `src/layouts/BaseLayout.astro` (cookie bar), `src/components/MobileNav.astro` (top bar + search overlay), `src/lib/canonical-css.ts` (shared styles) |

The shape rule, identical everywhere: **first screen = the payload the page
was searched for; depth folds below; every occupation mention is a door.**

## 3. Global invariants (apply to every issue)

### 3.1 Type floor (hard minimums, CSS px at 390px viewport)

| Text role | Size |
|---|---|
| Long-form prose (chapter bodies, answers, hints) | **16px**, line-height ≥1.75 (matches current Entry pages) |
| List-row primary label (job name) | **≥15.5px** |
| Verdict numbers | ≥40px (serif) |
| Captions / metadata (sector, salary-in-row, sub lines) | **≥12px** (target 13px = `--m-text-caption`) |
| Disclaimers, cookie bar, foot-notes | ≥11.5px |
| UPPERCASE Latin mono eyebrows only | ≥10.5px (token `--m-text-mono-stat` is 11px) |
| Any `<input>`/`<select>`/`<textarea>` | **≥16px** (below 16 iOS Safari force-zooms on focus) |

Tokens live in `styles/mobile-tokens.css`. Do not shrink any existing text
below its current size; the redesign gains first-screen density by
**reordering and folding, never by shrinking type**.

### 3.2 Touch targets

Every tappable element ≥44×44 CSS px effective hit area. List rows are
tappable across the **entire row** (wrap the row in the anchor, or absolutely
position a full-row overlay link), not just the name text.

### 3.3 The unified job-row atom

One visual grammar for every occupation mention (ranking rows, similar jobs,
transfer/escape candidates, search results, TOP10 cards may adapt):

```
┌──────────────────────────────────────────────┐
│ [rank/→]  職業名 (15.5px, 600)     [pill] ›  │
│           セクター · 補足 (12.5px muted)      │
└──────────────────────────────────────────────┘
```

- Pill = existing risk-band classes (`low/mid/high` → sage/amber/terracotta,
  see `.m-risk-*` in `styles/mobile-tokens.css`), mono numerals `X.X/10`.
- Whole row is the link (§3.2). Card: white bg, 1px `--m-color-muted-2`-ish
  border at ~30% alpha, radius 12, 8px gap between rows.
- Reference render: `mockups/shots/frame-02.png`.

### 3.4 Compact cookie consent bar (spec for issue W0-1)

Current banner (`BaseLayout.astro`, `#cookieBanner`) covers ~1/3 of the
first screen incl. the thumb zone. Replace the **presentation only**:

- Single sticky bottom bar, total height ≤48px + `env(safe-area-inset-bottom)`.
- Layout: text `解析のためCookieを使用します。` + link `詳細` (to
  `/privacy`) + spacer + `拒否する` (ghost) + `同意する` (accent bg).
  Button **labels, element ids (`cookieBanner`/`cookieReject`/`cookieAccept`)
  and the consent inline script stay byte-identical** — the script body is
  CSP-hashed; only markup text around it and CSS change.
- Reference: bottom of `mockups/shots/frame-02.png`.

### 3.5 Content / SEO / GEO invariants

- **No content deletion.** Every existing block stays in the DOM (folded is
  fine). `<details>` content is indexable; that is the approved mechanism.
- `.ai-fact` citation blocks: keep the full text; move visually below the
  payload / into a folded chapter. Where cheap, keep the block early in DOM
  order and fold it visually (position weight for citation engines).
- JSON-LD blocks, `<title>`, meta descriptions, H1 text, canonical URLs,
  breadcrumbs, hreflang: **unchanged** unless an issue explicitly lists a
  string change (Appendix A).
- Scoring, AIOIS-10, 3-axis/8-family/24-variant system: untouched.
- `/shindan` routing locks (2026-08-17, `docs/ME_CONSOLIDATION.md` §5):
  untouched. `/map`: untouched this programme.
- Existing GA4 events keep firing exactly as today (`me_entry_click`,
  `shindan_start`, `result_view`, `occupation_tile_click`, …).

### 3.6 CSP & inline scripts

House rule (see `vercel.json` + `compute-csp-hashes` tooling): inline
scripts must have **static bodies** (no per-page interpolation) so one
sha256 covers all pages. If you add an inline script (search overlay,
desktop-open-details helper), keep the body static, run
`bun run check:csp-hashes`, and update hashes the way the repo already does.
Prefer extending existing hashed asset files (`_index-inline.js`,
`_me-inline.js`, `_shindan.js`) where the page already loads one.

### 3.7 Analytics

Any new event must be registered in `analytics/spec.yaml`
(`bun run check:analytics-config` gates this). New events in this programme
(all with the single param `language: 'ja'`, **no new custom dimensions, no
query text**):

| Event | Fires when |
|---|---|
| `list_row_click` | a List-shape row is tapped (rankings wave 1; Q&A etc. wave 4) |
| `search_overlay_open` | top-bar search icon opens the overlay |
| `search_overlay_navigate` | a search result row is tapped |

### 3.8 Desktop non-regression

These are mobile-first reorders of shared templates, so desktop DOM order
changes too. Rule: desktop (≥900px) must remain **visually equivalent or
better**; where a mobile-first DOM order would visibly degrade desktop, use
CSS (`grid-template-areas`, `order`) to preserve the desktop arrangement.
Chapters (`<details>`) render **open** on desktop via the §4.3 helper.

## 4. Shape specs

### 4.1 List shape v1 — rankings template (issue W1-2)

Files: `src/pages/rankings/[type].astro`, `_rankings-bindings.ts`,
`src/templates/Ranking.ts`. Reference: `mockups/shots/frame-02.png`,
before/after `mockups/shots/pair-1.png`.

First screen, top to bottom (390×844 must show H1 + summary + rows 1–4 at
minimum):

1. Top bar (48px, existing `MobileNav`) — untouched here.
2. Breadcrumb (existing, one line).
3. `<h1>` — **text unchanged** (fear-first titles stay; they are the door
   sign, the room's voice is the verdict).
4. One-line summary (new element, class `rk-sum`): `1位は{TOP1名}（{score}/10）
   · TOP{N}平均 {mean}/10 · {YYYY年M月}更新`. Data: first item +
   `safeMean` already computed for `renderHighlights` / stats; content date
   from `CONTENT_DATE`. This **replaces** the `.sub` + `.intro` position on
   mobile; `.intro` prose moves into the folded block (below).
5. The ranked list (`.rank-list`) immediately. Row = §3.3 atom; keep
   per-ranking extra columns (salary, demand pill etc. — the existing
   `ExtraCol` mechanism). Rank numbers 1–3 accent-colored (exists).
   Make the whole row tappable (§3.2) — today only the name is a link.
6. After the list, a folded block `<details class="chap">` titled
   `このランキングの読み方・出典` containing, in order: the former `.intro`
   paragraph, the `.ai-fact` block (full text, unchanged), the stats `<dl>`
   cards, remaining highlights, the sector chart.
7. Then unchanged: `MeEntry` strip, FAQ, cross-hub links, related rankings,
   escape-routes.

Also in this issue: fire `list_row_click` on row taps (§3.7); type floor
§3.1; JSON-LD/H1/meta untouched (§3.5).

### 4.2 Entry shape — first screen (issue W2-4a)

Files: `src/pages/[...id].astro`, `src/pages/_RiskCard.astro`,
`_id-bindings.ts`, `_id-css.ts`. References: `mockups/shots/frame-03.png`
(low-risk 看護師), `frame-04.png` (high-risk 経理事務), pairs 2–3.

First screen, top to bottom:

1. Top bar, breadcrumb (existing).
2. `<h1>` name + one meta line `{セクター} · 就業者 約{X}万人`.
3. **Verdict card** (rework of `_RiskCard.astro`; numbers move to the top,
   type copy moves out — see §4.3):
   - Label `AI影響度（変化の大きさ）` + big number `{transformation}/10`
     (serif ≥40px, risk-band color) and beside it
     `仕事が減るリスク {displacement}/10` (serif ~26px).
   - Rank line: `556職中 第{rank}位 · 先月比 {±Δ} · {YYYY年M月}採点`.
     `rank` = existing `rankInUniverse`/`rankUniverseTotal`. `先月比`:
     derive `prevDelta` from the score-history entries already passed to
     the page (`scoreHistoryArr` in `getStaticPaths` props): latest
     transformation − previous transformation; omit the segment when
     history has <2 entries.
   - One human sentence: reuse **`rec.ai_rationale_ja`** verbatim
     (fallback: the existing risk-band callout from
     `buildOccupationDisplay`). No new prose is written for this.
   - Facts line: `年収 約{salary}万円 · 就業者 約{workers}万人 · 月{hours}h`
     (skip null fields).
   - Share affordance: keep the existing `data-page-share-trigger` link,
     placed at the card's top-right.
   - **Doors row — varies by score band** (bands follow the existing
     `riskTierJs` cutoffs: high ≥7; low <5; mid otherwise):
     - high: solid `AIで変わる作業を見る` → `#sec-ai-detail`; ghost
       `移り先の候補` → `#sec-transfer` (fallback `#sec-similar` when the
       transfer section is empty for this occupation)
     - low: solid `なぜ守られやすいか` → `#sec-ai-detail`; ghost
       `似た仕事` → `#sec-similar`
     - mid: solid `スコアの中身` → `#sec-aiois`; ghost `似た仕事` →
       `#sec-similar`
     - Unscored occupations (`ai_risk === null`): number area shows
       `未採点`, doors = mid variant minus score anchor, no share.
   - Anchor ids added in this issue by wrapping the existing fragments:
     `#sec-aiois` (aioisHtml), `#sec-ai-detail` (aiRiskDetailHtml),
     `#sec-similar` (sameRiskHtml + legacyRelatedHtml), `#sec-transfer`
     (transferHtml).
4. The existing `MeEntry` block becomes the quiz door directly under the
   card (copy unchanged: `この仕事のAI影響度は分かりました。… 9問で確かめる`
   — it already exists on `/me`; on Entry pages keep the current MeEntry
   strings and tracking).
5. AIOIS disclaimer line (existing string, `AIOIS-10はモデル出力の目安で…`)
   stays **within one screen of the numbers**, small (≥11.5px) but visible.
6. The former type-verdict content (family name, identity, 3-cell task
   grid, one-line) **moves into the `スコアの中身` region** (in 4a it can
   sit directly under `#sec-aiois`; 4b relocates it into the chapter). It is
   not deleted — #237 ruled recipients recognise job+number, not our type
   vocabulary, so the number leads and the type deepens.
7. Desktop (§3.8): keep a two-column verdict card ≥900px (numbers left or
   right per current visual balance) via grid areas; mobile stacks
   numbers-first.

### 4.3 Entry shape — chaptered body (issue W2-4b, after 4a is merged and
owner-reviewed)

Files: `src/pages/[...id].astro`, `_id-css.ts`, plus one small static
inline helper (§3.6) or an addition to the existing hashed page script
(`_IdPageScript.astro`) to open all chapters on ≥900px viewports.

Wrap the existing body fragments into seven `<details class="chap">`
chapters, preserving DOM content byte-for-byte inside:

| Chapter (summary text) | Contains (existing fragments) |
|---|---|
| `スコアの中身` | scoreHistoryHtml, aioisHtml, aiRiskDetailHtml, profileHtml (radar), topnHtml (ranking positions), the relocated type block |
| `この仕事とは` | ctx section |
| `なるには・資格` | howSection, orgsCertsHtml |
| `待遇と働き方` | condSection, StatsGrid |
| `似た仕事・移り先` | transferHtml, sameRiskHtml, legacyRelatedHtml |
| `よくある質問` | faqHtml (already details-based; nest as-is) |
| `出典と数字` | aiFactHtml (full text), JobtagAnchor, relatedHubsHtml, map-back link |

- A sticky chip nav (horizontal scroll, sticky under the 48px top bar,
  `z-index` below the top bar) with the seven titles; tapping a chip opens
  that chapter and scrolls to it. Keep the §4.2 anchor ids working.
- Mobile default: all chapters closed (`この仕事とは` may open — owner
  taste call at PR review). Desktop ≥900px: all open (helper sets `open`
  attributes; CSS hides the summary chevrons).
- `.ai-fact` stays complete inside `出典と数字`; if trivially possible keep
  its DOM position early and visually relocate (§3.5), otherwise document
  in the PR that DOM order changed.
- Reference: scrolled view of `mockups/shots/frame-03.png`.

### 4.4 Duel shape — compare template (issue W1-3)

Files: `src/pages/compare/[pair].astro`, `_compare-bindings.ts`.
References: `mockups/shots/frame-05.png`, `pair-4.png`.

1. Compact `<h1>` (text unchanged).
2. **Pinned versus bar** replacing `.versus-hero`'s mobile behavior: grid
   `1fr 34px 1fr`, each side = job name (serif, links to its Entry page) +
   AI pill; sticky under the top bar (`top: 48px`), bottom border 2px ink.
   It must remain visible at every scroll depth. Desktop may keep the
   current hero card look (§3.8) — pinning is required only <900px.
3. Metric rows immediately after (from the existing compare table data):
   `年収中央値 / 仕事が減るリスク / 就業者数 / 月間労働時間 / 必要資格 /
   求人倍率` … one row per metric, both values side by side.
   **Win-highlight rule:** color the better side (accent) only where
   "better" is objective and doom-free: 年収 higher; 月間労働時間 shorter;
   求人倍率 higher. AI scores and 就業者数 stay neutral.
4. Fold into `<details class="chap">` after the rows: intro paragraph,
   `比較すべき主要観点`/`選び方の判断ヒント` lists, `.ai-fact` (unchanged
   text), FAQ stays as-is. Skills TOP5 comparison stays visible (it is
   comparison payload).
5. **Copy fix (approved):** the sub line currently reads
   `AI 影響度・年収・労働条件・必要スキルを side-by-side で比較` — replace
   `side-by-side` with `並べて` (JA-only site; leftover English is a bug).
6. `MeEntry`, escape-routes, related pairs: positions unchanged.

### 4.5 Tool touch-ups (issue W3-6)

`/me` (`src/pages/me.astro`, `_me-inline.js`) — flow, quiz, gap, share,
URLs all unchanged. Presentation only:

- Search input placeholder must not truncate at 390px. Use
  `気になる職業を入力（例：看護師、営業）` (shorter than today's).
- Replace the empty dashed `#meEmpty` box with: 5 example chips
  (`事務職 経理 営業 看護師 保育士` — tapping a chip runs the same select
  path as typing) + hint `タップですぐ表示されます` + a small "what you
  get" card: `職業を選ぶと、ここに出ます：① AI影響度と556職中の位置
  ② 全39ランキングでの順位 ③ 似た5職業`.
- Reference: `mockups/shots/frame-07.png`, `pair-6.png`.

`/shindan` (`src/pages/shindan.astro`, `_shindan-css.ts`) — one page, nine
questions, all signed copy unchanged. Presentation only:

- Compress the head (kicker + H1 + one sub line) and move the `9問/3軸/556`
  stats card below the questions (or into a details) so **Q1 with both
  choice buttons is fully visible in the first 844px** including top bar.
- Optional enhancement (only if trivial within the existing hashed
  `_shindan.js`): thin progress indicator `n / 9問`.
- Reference: `mockups/shots/frame-08.png`, `pair-7.png`.

### 4.6 List shape v2 — rollout (issue W4-9, **gated**: opens only after
W1-2 ships and the owner reviews wave-1 numbers)

Apply §4.1 to the remaining List-shape templates:

- `/q/[q]` (49): payload = **the answer**. First screen: H1 (question,
  unchanged) → one-sentence answer line (serif, 16.5px) derived from data
  already in the page's fact block (e.g.
  `事務系を中心に10職。最も高いのはデータ入力（9.4/10）、10職の平均は8.7/10です。`)
  → the job list (rows = §3.3) → folded 読み方・出典 (the `.ai-fact`) →
  related questions. Reference: `mockups/shots/frame-09.png`, `pair-8.png`.
- `/sectors/*` (16) and theme hubs (~100+): same reorder — payload list
  first, prose/stats folded. One PR per template family; reuse the wave-1
  CSS and row atom; keep each template's own extras.

### 4.7 Home (issue W3-5)

Files: `src/index-source.html`, `_index.css`, `_index-bindings.ts`,
`_index-inline.js`. Mechanism: `index-source.html` is a raw body fragment
with `__PLACEHOLDER__` substitution in `_index-bindings.ts` (see
`__OCCUPATION_COUNT_SCORED__`). References: `mockups/shots/frame-01.png`,
`pair-5.png`. **Mobile (<768px) presentation only; desktop hero/treemap
untouched.**

Mobile first screen order:

1. Hero: eyebrow `日本の556職業 × AI · 毎月更新` (count via placeholder) +
   H1 `あなたの仕事は、AIでどう変わる？` + search bar — **submit button
   label changes `診断` → `調べる`** (`#mhSearchBtn` in `index-source.html`;
   this is an approved copy change; desktop `#dhSearchBtn` is out of scope
   this wave) + existing example chips (add `保育士` to match mockup or
   keep current five — implementer's choice, note in PR).
2. TOP10 horizontal swipe (exists: `#mTop10`) — restyle rows to the §3.3
   pill grammar if not already.
3. **今月の変動 module (new):** two columns ↑上がった / ↓下がった, 2–3 rows
   each, from the movers view already used by `src/pages/rankings/index.astro`
   (`loadRankingMovers(graph)` → take top movers by |Δ| on transformation).
   Inject via a new `__HOME_MOVERS__` placeholder in `_index-bindings.ts`.
   Links go to the occupation pages; module links to `/rankings#movers`.
4. Four door cards: ランキング (39) → `/rankings`; 比較する (20) →
   `/compare`; 職業マップ (static mini-heatmap thumb, no canvas) → `/map`;
   自分の現在地 → `/me` (with the existing `me_entry_click` tracking
   attributes, `data-entry-source="home_door"` — register nothing new; the
   event exists).
5. The shipped 診断 entry band moves **below** the door cards (it stays on
   the page; it stops being the second screen-filling block).
6. Everything below (KPI band, treemap section, hub sections) unchanged in
   content and order; treemap canvas remains desktop-only behavior as today.

### 4.8 Global search overlay (issue W3-7) — the only newly built component

Files: `src/components/MobileNav.astro` (+ a static inline script or a new
hashed asset), styles in `canonical-css.ts`. References:
`mockups/shots/frame-06.png`, `pair-9.png`.

- Top bar gains a search icon button (44×44) between brand and burger,
  **mobile top bar only** (desktop `TopNav.astro` untouched).
- Tap → full-screen overlay (`role="dialog"`, `aria-modal`, focus moves to
  input, `閉じる` button + Esc close, background scroll locked — mirror the
  drawer's focus management in `MobileNav.astro`).
- Input ≥16px. Data: fetch `/data.search.json` on first open (documents:
  `{id, title_ja, aliases_ja[], sector_id, risk_band, ai_risk}`; 556 docs,
  schema v1.2). Match = substring over `title_ja` + `aliases_ja`,
  case/width-normalized (NFKC).
  **Fact: the corpus has no kana readings today.** Phase 1 ships without
  reading-match (IME users convert to kanji; aliases catch common variants).
  Add a `hiragana reading` field to the corpus **only if** the source data
  under `src/data/` already carries readings — investigate and report in
  the PR; do not invent readings and do not block on this.
- Result rows = §3.3 atom (name, sector, risk pill), tap → occupation page.
  Fire `search_overlay_open` / `search_overlay_navigate` (§3.7).
- Below results: `最近見た` (localStorage `ms.search.recent`, max 5, only
  when `cookieConsent === 'accepted'` — mirror `ms.compare.recent` in
  `compare/[pair].astro`).
- Empty state (`見つからないとき`): three door buttons — 業種から探す →
  `/sectors`, ランキング → `/rankings`, 自分の現在地 → `/me`. Never a dead
  end.
- Hint line: `読みがな・別名でも探せます（556職業）` — adjust to
  `別名でも探せます` if phase 1 ships without readings (keep honest).
- The 28-row drawer stays untouched.

## 5. Metrics, baselines, stop rules

Definitions (GA4, cuts per 28 days unless noted):

- **Turn-in rate (corridor→room):** sessions landing on `/rankings/*` or
  `/compare/*` that reach any occupation page or `/me` in the same session.
  Baseline: engagement 10s / 7s and near-zero measured continuation —
  capture the exact pre-change number for 2 weeks before wave 1 merges
  (use existing `result_view` + landing-page dimension; no new events
  needed beyond §3.7).
- **Search overlay usage:** `search_overlay_open` / sessions;
  `search_overlay_navigate` / `search_overlay_open`.
- **Entry depth:** unchanged `result_view`, plus chapter-open rate if
  cheap (no new dimension — skip if it needs one).
- **Existing funnels** (`analytics/funnel-reference.md`) keep working.

Stop rules: after W1-2 (rankings), hold wave 4 until the owner reviews
turn-in movement. If the rate does not move, the List rollout (W4-9) does
not open — the programme stops there by design, with waves 0–3 still
standing on their own merits.

## 6. Waves & issue index

| Wave | Issues | Gate |
|---|---|---|
| 0 | W0-1 cookie bar | none — ship first |
| 1 | W1-2 rankings, W1-3 compare | after W0-1 |
| 2 | W2-4a entry first screen → W2-4b chapters | 4b opens after 4a is merged + owner look |
| 3 | W3-5 home, W3-6 tools, W3-7 search overlay | after wave 1 merges |
| 4 | W4-9 List rollout (Q&A/sectors/themes) | **owner reviews wave-1 numbers first** |

Every wave lands on `preview` only (§0). The owner reviews the whole state
on `preview` and triggers promotion; nothing in this programme touches
`main`.

## 7. Mockups

`mockups/` (repo-relative; open `mockups/mobile-redesign.html` at 100% zoom
for true device scale; `mockups/before-after.html` for live-vs-redesign):
frames 01–09 map to §§4.7, 4.1, 4.2(low), 4.2(high), 4.4, 4.8, 4.5(/me),
4.5(/shindan), 4.6(Q&A). Real 2026-07-26 scores; a few illustrative values
(see `mockups/README.md`).

## Appendix A — JA strings introduced/changed by this programme

Owner-visible working copy (from the approved mockups). Final sign-off at
PR review. Everything not listed here: reuse existing strings.

| Where | String |
|---|---|
| Home mobile search button (`#mhSearchBtn`) | `診断` → **`調べる`** |
| Compare sub line | `side-by-side` → **`並べて`** |
| Cookie bar text | `解析のためCookieを使用します。` + link `詳細`（buttons unchanged: `拒否する` / `同意する`） |
| Rankings summary line | `1位は{名}（{score}/10） · TOP{N}平均 {mean}/10 · {YYYY年M月}更新` |
| Rankings folded block title | `このランキングの読み方・出典` |
| Entry chapter titles | `スコアの中身` / `この仕事とは` / `なるには・資格` / `待遇と働き方` / `似た仕事・移り先` / `よくある質問` / `出典と数字` |
| Entry door labels | `AIで変わる作業を見る` / `移り先の候補` / `なぜ守られやすいか` / `似た仕事` / `スコアの中身` |
| Entry rank line | `556職中 第{n}位 · 先月比 {±Δ} · {YYYY年M月}採点`（`556` = `rankUniverseTotal`） |
| Entry unscored state | `未採点` |
| /me placeholder | `気になる職業を入力（例：看護師、営業）` |
| /me chips hint | `タップですぐ表示されます` |
| /me preview card | `職業を選ぶと、ここに出ます：① AI影響度と556職中の位置 ② 全39ランキングでの順位 ③ 似た5職業` |
| Search overlay hint | `別名でも探せます（556職業）`（readings 対応後は `読みがな・別名でも探せます（556職業）`） |
| Search overlay empty state | `見つからないとき` + `業種から探す` / `ランキング` / `自分の現在地` |
| Search overlay close | `閉じる` |
| Home movers module | `今月の変動 · {M}月スコア改定` / `↑上がった` / `↓下がった` |
| Home door cards | `ランキング`（`AI・年収・需要で並べる`）/ `比較する`（`2つの仕事を並べて見る`）/ `職業マップ`（`{N}職業の俯瞰`）/ `自分の現在地`（`職業を入れて全39榜の位置` → use existing nav copy `職業を入力 → 全 39 ランキングでの位置`） |
| Q&A answer line (wave 4, pattern) | `{要約}。最も高いのは{名}（{score}/10）、{N}職の平均は{mean}/10です。` |

## Appendix B — File pointer index (verified 2026-08-27)

- Tokens: `styles/mobile-tokens.css` (site-wide since v1.2.0; body 15 /
  caption 13 / mono 11; `--m-device-width: 390px`).
- Top bar + drawer: `src/components/MobileNav.astro` (48px bar; drawer
  focus management to mirror for the overlay).
- Cookie banner + consent script: `src/layouts/BaseLayout.astro` (ids
  `cookieBanner` / `cookieReject` / `cookieAccept`).
- Shared CSS: `src/lib/canonical-css.ts`.
- Rankings: `src/pages/rankings/[type].astro` → bindings
  `_rankings-bindings.ts` → renderers `src/templates/Ranking.ts`
  (`renderRankItem`, `renderHighlights`, stats/sector/FAQ/JSON-LD).
- Compare: `src/pages/compare/[pair].astro` (+ `escape-routes`,
  `ms.compare.recent` localStorage pattern in its bodyEnd script).
- Entry: `src/pages/[...id].astro` → `_RiskCard.astro` (current order:
  type copy first, numbers in side column — 4a inverts), `_id-bindings.ts`
  (`rankInUniverse`, `aiFactHtml`, `riskTierJs`, disclaimer const),
  `_id-css.ts`, `_IdPageScript.astro`, section renderers
  `_id-renderers.ts` + `src/templates/*`.
- Entry data: `rec.ai_rationale_ja` (verdict sentence source);
  `scoreHistoryArr` (先月比); `public/data.score_history.json`.
- /me: `src/pages/me.astro` + `_me-inline.js` (combobox = overlay
  prototype). /shindan: `src/pages/shindan.astro`, `_shindan-css.ts`,
  `_shindan.js`.
- Home: `src/index-source.html` (mobile hero `#mhSearchBtn` label `診断`;
  TOP10 `#mTop10`; placeholder pattern `__OCCUPATION_COUNT_SCORED__`) +
  `src/pages/_index-bindings.ts` (`HOME_BODY_HTML`) + `_index.css` +
  `_index-inline.js`.
- Movers view: `loadRankingMovers(graph)` as used in
  `src/pages/rankings/index.astro` (`renderRankingsMovers`).
- Search corpus: `public/data.search.json` — `documents[]` with `id`,
  `title_ja`, `aliases_ja[]`, `sector_id`, `risk_band`, `ai_risk`;
  **no readings field** (verified).
- Analytics: `analytics/spec.yaml`; gate `bun run check:analytics-config`.
- Gates: `bun run typecheck` / `test` / `verify:gates` / `test:e2e` /
  `capture:seo-baseline` / `check:csp-hashes`.
- E2E specs: `tests/e2e/` (`a11y`, `analytics`, `home-css-loading`,
  `occupation-route-ownership`, `smoke`, `visual`).
- GA4/funnel docs: `analytics/funnel-reference.md`,
  `docs/ME_CONSOLIDATION.md` (§1.3 traffic table, §5 routing locks).
