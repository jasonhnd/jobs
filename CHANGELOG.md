# Changelog

mirai-shigoto.com — full per-release notes at <https://github.com/jasonhnd/jobs/releases>

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · pre-1.0 SemVer.

> Pre-0.6.0 detailed entries are preserved in [`docs/CHANGELOG-archive.md`](docs/CHANGELOG-archive.md).

---

## [Unreleased]

### Footer — site-wide unification (all pages identical)

Aligns every page's footer to one canonical 3-layer structure (导航 chips + 法务 chips + footer-meta) so 404 / about / compliance / privacy / index / 556 detail / 17 sector / 10 ranking — every single HTML — renders the exact same footer HTML and CSS.

- **Two-row chip layout everywhere**:
  - Row 1 (导航): `トップ / セクター / ランキング`
  - Row 2 (法务/规约): `データについて / コンプライアンス / プライバシー`
- **Unified footer-meta** (was inconsistent — `© mirai-shigoto.com` on detail/sector/ranking, brief disclaimer on about/privacy, missing entirely on 404):
  - `v1.3.0 · MIT`
  - 出典：厚生労働省・独立行政法人 労働政策研究・研修機構（JILPT）
  - 独立分析サイト免責 + 「詳細は コンプライアンス ページをご確認ください」
- **404.html — full footer + expanded こちらもどうぞ**:
  - Was: 1-row chip footer with no footer-meta + 3 helpful links (about / compliance / privacy)
  - Now: standard 2-row footer + meta, plus 9 helpful links (sectors hub / rankings hub / 4 ranking pages / about / compliance / privacy)
- **Design.md §7.10 — spec rewritten as the canonical 6-chip 2-row spec** (was the v1.2.2 single-row 3/4-chip spec). Single-source-of-truth doc updated first per the Design.md authority rule, then HTML synced.
- **CSS — `.nowrap` added to all 5 static pages** so 「独立行政法人 労働政策研究・研修機構（JILPT）」 and 「公式見解ではありません」 don't break across lines on mobile. Build scripts updated identically.
- **Generated pages regenerated**: 556 detail (build_occupations.py) + 17 sector (build_sector_hubs.py) + 10 ranking (build_rankings.py).

### Rankings — expand from 4 to 9 ranking pages + enriched hub

- **5 new ranking pages**: salary, entry-salary, young-workforce, short-hours, high-demand
- **Enriched all 9 pages**: 3–4 stat panels, auto-generated highlights, sector distribution chart, FAQ section (3 Q&A each with FAQPage JSON-LD)
- **Enriched hub page**: global stats (556 occupations overview), 9 cards with #1 preview, cross-ranking insights section
- **New CSS components**: demand-pill, rl-extra, highlights, sector-chart, faq accordion, insights
- **SEO**: FAQPage schema on all 9 ranking pages, expanded meta descriptions
- **Build**: `build_rankings.py` outputs 10 HTML pages (323 KB total)

### Analytics — five-part optimization round (Tier 1 + Tier 2 + privacy/perf)

Following the GA4 optimization audit on 2026-05-06, applies five changes
to the instrumentation layer. All purely additive or non-breaking; no
existing event removed, no analytics URL changed.

- **③ Spec hygiene** (`analytics/spec.yaml`):
  - Removed three orphan event-scoped dimensions from spec —
    `open_method`, `close_method`, `time_open_ms`. They were leftovers from
    the modal lifecycle (deleted 2026-05-02). The actual dimensions on the
    GA4 property are kept (don't archive — preserves historical data); the
    spec just no longer tries to sync them, eliminating four `WARN` lines
    on every `npm run setup:dry`.
  - Added `email_submit_header` to the explicit `key_events:` list so it
    matches the derived (conversion: true) set. Previously caused a
    `derived != explicit` warning.

- **⑥ `jobtag_outbound_click` event wired** (`scripts/build_occupations.py`):
  - The 出典 link "厚生労働省 job tag — {occupation}" on every detail
    page now fires `gtag('event', 'jobtag_outbound_click', {...})` on
    click before navigating. Records `occupation_id`, `ai_risk_score`,
    `language`. Compliance signal: proves the attribution chain
    (our analysis → official MHLW source) is being used. Re-running
    `build:occ` regenerates all 556 detail pages. Spec event promoted
    from `unimplemented: planned` → live.

- **⑫ Search query PII sanitizer** (`index.html`):
  - New `sanitizeSearchQuery(q)` runs before any query string is sent
    in `job_search_typed` / `job_search_intent` events. Drops:
    1. Strings > 30 chars (suspect; typical occupation names are 2-12 chars)
    2. Strings containing 10+ consecutive digits (phone / ID)
    3. Strings containing `@<alphanumeric>` (email)
  - Returns `""` (empty) on hit, so the EVENT still fires (count is
    preserved for CTR / volume metrics) but the query CONTENT is not
    logged to GA4. Trades some search-term analytics fidelity for
    PII safety.

- **⑬ Defer gtag.js across all entry points** (5 files):
  - `index.html` was already deferred (loaded inside `window.load`).
  - `about.html`, `privacy.html`, `compliance.html`, `404.html`,
    and the sector-hub template (`scripts/build_sector_hubs.py`) were
    using `<script async>` which still costs ~64 KB / 265 ms during
    initial render. All moved to the same deferred-load pattern as
    `index.html`. Sector hubs regenerated via `build_sector_hubs.py`.
  - `scripts/build_occupations.py` template was already deferred
    (~556 detail pages unchanged).
  - LCP improvement primarily on the static pages (about / privacy /
    compliance / 404) and 17 sector hubs.

- **⑭ `tooltip_view` event with 10% sampling** (`index.html`):
  - Tooltip on desktop hover now fires `gtag('event', 'tooltip_view',
    {...})` with `Math.random() < 0.10` sampling — 10% of all hovers.
  - Full-rate would dwarf every other event (tooltips fire on every
    desktop hover, dozens per session). 10% gives a representative
    signal for "which occupations attract attention" analysis.
  - Multiply tooltip_view counts by 10 when extrapolating to total
    tooltip volume.
  - Spec event promoted from `unimplemented: planned` → live;
    description updated with the sampling note.

### Files

- `analytics/spec.yaml` — three event_scoped_dimensions removed,
  `email_submit_header` added to key_events, `tooltip_view` and
  `jobtag_outbound_click` promoted from `unimplemented: planned`,
  description updates.
- `index.html` — `sanitizeSearchQuery()` helper added, called from both
  `fireSearchIntent()` and the `job_search_typed` debounced emit;
  `tooltip_view` 10% sampled emit added at the end of `showTooltip()`.
- `about.html`, `privacy.html`, `compliance.html`, `404.html` — gtag.js
  loader changed from `<script async>` to deferred-via-`window.load`.
- `scripts/build_occupations.py` — 出典 link gains `onclick`
  `gtag('event', 'jobtag_outbound_click', ...)`. Regenerated all
  556 `ja/<id>.html` files.
- `scripts/build_sector_hubs.py` — same deferred-gtag pattern as the
  static pages. Regenerated 16 sector hubs + 1 sector index.
- Build artifacts: `sitemap.xml`, `scripts/.occ_manifest.json`,
  `scripts/.sector_manifest.json`, `dist/data.*` updated.

### Operator follow-up

Manual GA4 dashboard tasks (script can't do these) tracked separately
in the optimization audit doc. Most important:
- Set Event data retention to 14 months (currently default 2 mo)
- Enable all Enhanced Measurement toggles
- Build the 5 audiences declared in `spec.yaml:audiences_manual`

### Dangling MOBILE_DESIGN.md ref cleanup — DEAD CODE markers (no behavior change)

**Doc/comment-only. No runtime change.** Follow-up to the doc split:
when `docs/MOBILE_DESIGN.md` was deleted, 11 source files retained
comment-only references to it. None of them imported or read the doc;
all references were docstrings or inline explanatory comments. All
updated in place to remove the broken reference and add a clear
`DEAD CODE since vX.Y.Z` marker so a future reader knows what to do.

**No `scripts/templates/mobile/*.py` was deleted** — the directory is
verified-dead (no `m/` output dir exists, sitemap.xml has 0 mentions,
vercel.json has 0 `/m/` rules, only one mention in `build_occupations.py`
is an attribution comment for a copied algorithm), but deletion is
deferred to an explicit follow-up cleanup PR; this pass marks status
without removing source. Same for `scripts/translate_descriptions.py`
(EN translations archived to `data/_archive/translations-en/` in v1.4.0)
and `styles/mobile-tokens.json` (0 known consumers, but the parallel
`.css` IS live).

Per-file changes:

- **`scripts/templates/mobile/{home,explore,search,detail,compare,ranking,about}.py`**
  (7 files) — top docstring "[number] [name] — `/m/{ja,en}/<path>` per
  MOBILE_DESIGN.md §X" rewritten to "[number] [name] — `/m/{ja,en}/<path>`.
  DEAD CODE since v1.2.0." plus a paragraph explaining the v1.1.0
  origin, v1.2.0 retirement, MOBILE_DESIGN.md deletion date, and that
  `Design-Mobile.md` is the current spec but for the responsive
  single-URL design (NOT this `/m/*` template). `explore.py` got an
  extra disambiguation note that the new `Design-Mobile.md §4 /map`
  page is unrelated to this old `/m/*/map` template. `detail.py` got
  an extra note that `build_occupations.py` line ~258 holds an
  algorithm copy that remains live and won't break.
- **`scripts/templates/mobile/detail.py:47`** — secondary inline
  comment on `QUOTE_BY_SECTOR_JA` updated from "(v1.1.x — see
  MOBILE_DESIGN.md §8)" to "(v1.1.x — DEAD CODE since v1.2.0; spec
  doc MOBILE_DESIGN.md deleted 2026-05-06)".
- **`scripts/dev-server.py`** — comment above the `/m/{ja,en}/*`
  routing block (lines 80-99 in current file) rewritten to a
  multi-line DEAD CODE marker explaining the block is unreachable
  in production (no `m/` dir built, no vercel.json rules, sitemap
  zero mentions) and is safe to delete in cleanup.
- **`scripts/translate_descriptions.py`** — header docstring "Per
  docs/MOBILE_DESIGN.md §9.3 + DATA_ARCHITECTURE.md §2.4 (v1.1.0
  extension)" rewritten to "DEAD CODE since v1.4.0 (JA-only)" with
  full explanation of the EN archive in v1.4.0 and that
  DATA_ARCHITECTURE.md §2.4 is still-live for reference.
- **`styles/mobile-tokens.json`** — `$meta.description` field
  rewritten to drop the MOBILE_DESIGN.md ref and explicitly note
  that this `.json` mirror has 0 known consumers (the parallel
  `.css` is the live token source).
- **`styles/mobile-tokens.css`** — header comment block fully
  rewritten. Removed `Spec : docs/MOBILE_DESIGN.md §2 (tokens)` and
  `Editing rule (per docs/MOBILE_DESIGN.md §15):` lines. Added new
  Origin/Scope notes documenting that this file was authored as a
  v1.1.0 mobile-only token set but PROMOTED in v1.2.0 PC convergence
  to be the **live site-wide token source** (referenced from
  index.html / about.html / privacy.html / compliance.html / 404.html
  and all 556 ja/<id>.html pages via the `synced from
  styles/mobile-tokens.css` comment pattern). The "mobile-tokens"
  filename is now historical; the file is desktop-and-mobile.
  Filename retained because 559+ HTML files quote it; renaming would
  require a coordinated repo-wide sweep + production verification.
- **`scripts/build_occupations.py:258`** — attribution comment
  "Algorithm copied from scripts/templates/mobile/detail.py to
  ensure visual parity." extended with a parenthetical noting the
  source template is DEAD CODE since v1.2.0 but the copy here is
  independent and remains live.

After this pass: 26 remaining mentions of `MOBILE_DESIGN.md` across
13 files, all intentional (history records in CHANGELOG / Design.md
/ Design-Mobile.md, plus DEAD CODE explanatory markers in the code
files above).

### Design doc split — `Design.md` (desktop + shared) / `Design-Mobile.md` (mobile)

**Doc-only. No code yet.** With the `/map` page spec landing in §16
the mobile content in `docs/Design.md` had grown past half the
document. Split into two peer files so each device has a clear
authority boundary, and the archived v1.1.0 `MOBILE_DESIGN.md`
that was orphaned for 4 months gets retired.

Decisions (Q1 = C / Q2 = A / Q3 = B):

- **`docs/Design.md`** keeps desktop-only sections (§6.1 Desktop
  tooltip, §7.12 Desktop Hero, §7.14 404) **plus the cross-device
  shared layer** that both files reference: §1 principles, §2
  tokens (color / typography / spacing), §3 theme system, §4
  responsive breakpoint definitions, §5 treemap visualization,
  §6.4 viewport overflow handling, §7 generic components, §9-§13
  motion / a11y / assets / palette guidelines.
- **`docs/Design-Mobile.md`** (NEW) is the mobile authority. §1
  was old §7.11 Mobile Hero (Variant C). §2 was old §6.2 / §6.3
  / §6.5 / §6.6 / §6.7 — full touch-mode tooltip behavior
  (touch-mode entry, tap-outside, close-button hit area, CTA
  contract, scroll-vs-tap state machine). §3 was old §8 — all
  mobile responsive rules across ≤768 / ≤480 / ≤360 / ≤540. §4
  was the §16 `/map` page spec, renumbered to §4.0–§4.14.
- Migrated sections in `Design.md` are now **stub headings with
  cross-doc links** — section numbers stay (§6.2, §6.3, §6.5,
  §6.6, §6.7, §7.11, §8, §16) so any external references don't
  break, but their bodies say "moved to Design-Mobile.md §X".
  Section numbers preserved means downstream PRs that reference
  them keep working.
- §7.12 Desktop Hero had two intra-doc references (`§7.11` for
  mobile hero pairing, `§6.7` for the touch state machine
  constants `TAP_SLOP_PX=10` / `TAP_MAX_MS=500`). Both updated
  to point to `Design-Mobile.md §1` and `§2.5` respectively.
- `docs/MOBILE_DESIGN.md` deleted (Q1 = C). It documented the
  v1.1.0 `/m/ja/*` and `/m/en/*` URL architecture that was
  fully retired in v1.2.0 (single-URL responsive). After v1.4.0
  killed the EN UI, MOBILE_DESIGN.md had been an
  orphan-since-2026-01 archive with zero active references in
  HTML / CSS / runtime code. Stale doc-references in
  `scripts/dev-server.py`, `scripts/translate_descriptions.py`,
  `scripts/templates/mobile/*.py`, and `styles/mobile-tokens.json`
  remain as comment-only mentions — those scripts/templates are
  themselves dead code from the v1.1.0 era and a follow-up
  cleanup PR should retire them or update the comments.
- `docs/Design.md` head, §0 适用范围, and §0.1 (was "与
  MOBILE_DESIGN.md 的关系", now "与 Design-Mobile.md 的分工")
  all rewritten to reflect the new two-file model. The §0.1
  table now describes a content-split (desktop-only + shared vs.
  mobile-only) rather than the old design-language-split (data
  dashboard vs. Direction C Warm Editorial).
- `docs/Design.md` §15 修订历史 + `docs/Design-Mobile.md` §6
  修订历史 both record this split with date 2026-05-06 + the
  Q1/Q2/Q3 decisions inline.

**Net effect on Design.md.** ~1118 lines → 734 lines. Mobile
content extracted to a 451-line peer file. No semantic content
lost; cross-references all updated.

### `/map` 独立页（mobile-first）— design spec only

**Design only. No code yet.** Spec written into `docs/Design.md` §16
(`/map` 页规范, mobile-first 独立页) — implementation to follow in a
separate change.

**IA decision.** Move the 552-occupation treemap off the mobile
homepage and into a dedicated `/map` page. Mobile homepage gets a
preview card (inline SVG thumbnail + CTA) instead of the embedded
canvas. Desktop `index.html` embedded treemap is **completely
unchanged** — the split is mobile-only IA surgery; desktop users who
land on `/map` directly see the same mobile-first layout
(`max-width: 900px`, centered).

**`/map` page structure** (mobile-first, desktop-tolerant):

- Three-layer sticky head (header / search / sector chips + sort
  dropdown), total ~148px.
- Search behavior identical to `§7.12` desktop hero (autocomplete →
  jump to `/ja/<id>`); not a map-scoped filter.
- Sector segmented treemap (D4 = C): each sector is its own
  squarified treemap stacked vertically with collapse toggle.
  Single-sector chip view auto-expands. `min cell size = 44×44px`
  touch target; below threshold → merge into sector-tail "その他".
  Fallback (D4 = A): single squarified treemap with pinch-zoom if
  segmented turns out too costly.
- Tap cell → bottom sheet (D2/D3) showing job name / ranking
  badge (Top 50 only) / AI影響度 / 年収 / 就業者数 / "詳細を見る"
  CTA / ✕. Drag-to-dismiss + backdrop tap + ✕. iOS safe-area aware.

**URL state** (D5 = B). `URLSearchParams` two-way binding, no
router. `?sector=` / `?sort=` / `?job=` deep links. `?job=12345`
auto-opens the bottom sheet on load. Filter changes use
`history.replaceState` (don't pollute back stack).

**SEO.** Dedicated `<title>` / `<meta description>` / `og:image`
(`/api/og?page=map`) / `Dataset` + `ItemList` schema (Top 50 by
ranking). Single canonical `/map` regardless of query.

**Analytics.** Four new GA4 events: `map_open` (params: referrer),
`map_filter` (sector, sort), `map_cell_tap` (job_id, sector, rank),
`map_detail_click` (job_id). Standard 4-tracker analytics in
`<head>` (CF / GA4 / Vercel WA / Speed Insights — same hard rule
as every other page).

**Build.** `scripts/build_occupations.py` gets a new
`generate_map_thumbnail()` step that writes
`dist/map-thumb.snippet.html` (inline SVG, < 4KB, Top 30 by area
+ "その他" tail, 5-tier color quantization). `index.html`
includes via `{{INCLUDE map-thumb}}` placeholder + sed replace.

**Performance.** Mobile homepage stops paying the treemap cost:
the existing `<link rel="preload" href="/data.treemap.json">`
gets `media="(min-width: 769px)"` so only desktop preloads.
`/map` page does its own preload in its own `<head>`. Treemap
render runs in `requestIdleCallback` so the sticky head stays
interactive during fetch.

**Closure.** Detail page `/ja/<id>` gets a "← 職業マップへ"
link above footer (always jumps to bare `/map`, no query). Site
footer (`§7.13`) gets a "職業マップ" entry next to "About".
`sitemap.xml` adds `/map` (priority 0.9) + 10-12
`/map?sector=*` derivative URLs (priority 0.7).

**Out of scope.** Dark-mode-specific design (inherits §3),
landscape-specific layout, PWA / service worker, multilingual
(JA-only stays locked from v1.4.0).

**Pending.** §16.13 a11y "リスト表示に切り替え" toggle (screen
reader / keyboard fallback for the treemap canvas) is suspended;
`/map` ships with the minimum a11y line (`role="img"` + label,
native `<button>`/`<select>` for chips, focus-visible, reduced-
motion respect) and the list-view toggle decision is deferred.

### Analytics automation — OAuth user-credential path + spec validation fixes

The `setup-ga4.mjs` script had never actually been run successfully against
the production GA4 property (`298707336`). The service-account auth path
documented in `analytics/README.md` got blocked by GA4's cross-org
validation quirk (`此电子邮件地址没有对应的 Google 账号` error). This
change adds an OAuth user-credential path so the script can act as the
GA4 admin (Jason) directly, bypassing the service-account block.

After this change, **all 30 event-scoped custom dimensions, all 4
user-scoped custom dimensions, and 7 Key Events (including
`job_search_intent`)** are now actually configured on the live GA4
property — not just declared in `spec.yaml`.

- **`analytics/oauth-init.mjs`** — new file. One-time OAuth Desktop-app
  flow with localhost callback. Reads
  `~/.config/mirai-shigoto/oauth-client.json` (the `client_secret_*.json`
  downloaded from GCP OAuth client setup), spins up a localhost HTTP
  server on a random port, opens the browser to Google consent, captures
  the auth code, exchanges for a refresh token, writes
  `~/.config/mirai-shigoto/oauth-token.json` (perms 600). Run once via
  `npm run oauth-init`; after that all script invocations are
  non-interactive.

- **`analytics/setup-ga4.mjs`** — `getAuthClient()` now tries the OAuth
  user-credential token first and falls back to the existing
  `GOOGLE_APPLICATION_CREDENTIALS` service-account path. New OAuth flow
  is documented in the file header and as the preferred quickstart in
  `analytics/README.md`.

- **`analytics/package.json`** — new `npm run oauth-init` script.

- **`analytics/spec.yaml`** — fixed five entries that GA4 Admin API
  rejected on first apply:
  - `occupation_name_ja` / `occupation_name_en` display names had
    parentheses (`Occupation (JA)` → `Occupation JA`); GA4 only allows
    alphanumeric + space + underscore in display names.
  - `time_open_ms` display name had parentheses
    (`Modal Open Duration (ms)` → `Modal Open Duration ms`).
  - `freetext_length` display name had a hyphen
    (`Feedback Free-Text Length` → `Feedback Freetext Length`).
  - `source` and `intent_source` descriptions were >150 characters
    (GA4 `description` field max is 150). Both rewritten compact while
    still listing all enum values.

- **`analytics/README.md`** — restructured. New "OAuth quick start
  (~5 min, recommended)" section comes first; service-account setup is
  now labeled "legacy path (~10 minutes)" and demoted below. Documents
  the GA4 service-account block that motivated the OAuth path so the
  next operator doesn't repeat the same dead-end debugging.

### Operator follow-ups (manual, GA4 dashboard)

- The old `job_search_submit` event (now renamed to `job_search_typed`
  in code, demoted from Key Event in spec) was never actually marked as
  a Key Event on the live property in the first place — verified during
  this run. No demotion action required.
- Data retention (Admin → Data Settings → Data Retention → Event data
  retention: 14 months) and Enhanced Measurement still must be set
  manually per `analytics/README.md`.

### Search autocomplete on mobile — P0-D iOS keyboard + touch fixes

User-reported on iPhone: (1) when the soft keyboard opens, the autocomplete
dropdown gets pushed half off-screen behind the keyboard, leaving only ~1.5
items visible; (2) any finger contact on the dropdown immediately navigates
to whichever item was touched, so the user can never scroll to browse other
options. Both blockers are gone in this change.

Three coordinated fixes (must ship together — any single one in isolation
leaves a still-broken flow):

- **F1 — visualViewport-aware max-height** (`index.html`):
  - Root cause: iOS Safari's `100vh` does **not** shrink when the keyboard
    opens (documented platform behavior). Fixed `max-height: 360px` on
    `.search-suggest` left half the dropdown behind the keyboard.
  - Fix: new `fitDropdownToViewport()` reads `window.visualViewport.height`
    (which **does** reflect the keyboard) and writes
    `suggestEl.style.maxHeight = max(160, vViewportHeight - inputBottom - 12)`.
    Listeners on `visualViewport.resize` / `visualViewport.scroll` keep the
    height in sync as the keyboard animates / the user scrolls. Also called
    from the input's `focus` handler so the first open is already correctly
    sized.
  - Falls back gracefully on older browsers — if `window.visualViewport` is
    undefined the function no-ops and the original CSS max-height takes over.

- **F2 — tap-vs-scroll touch state machine** (`index.html`):
  - Root cause: original `touchstart` listener (registered with
    `{ passive: false }`) called `selectFromEvent` immediately, which
    `e.preventDefault()`'d and ran `navigateToJob(rec, "suggest_click")` →
    `window.location.href = …`. Any first finger contact = navigation. The
    user had no opportunity to scroll without committing.
  - Fix: mirror the canvas pattern documented in Design.md §6.7. `touchstart`
    is now `{ passive: true }` and only records `{ x, y, t0, target }` —
    no preventDefault, native scrolling proceeds normally. `touchend` reads
    `changedTouches[0]` and only triggers nav when displacement
    `Math.hypot(dx, dy) < TAP_SLOP_PX (10px)` **and** duration
    `dt < TAP_MAX_MS (500ms)`. Drags (= scroll intent) and long-presses
    no-op so the user can browse freely.
  - Constants `TAP_SLOP_PX = 10` / `TAP_MAX_MS = 500` match §6.7 exactly so
    the whole site shares one touch-decision threshold. Desktop `mousedown`
    path is untouched.
  - `touchcancel` resets state for system interruptions (alerts, gestures).

- **F3 — defer blur-hide while a touch gesture is active** (`index.html`):
  - Root cause: on iOS, touching the dropdown blurs the `<input>` (because
    the touch target is outside the input). The 150 ms blur-hide timer then
    fires mid-gesture and removes `.visible`, killing the scroll.
  - Fix: a new closure-scoped `touchActiveOnDropdown` flag is set true on
    `touchstart` and cleared 350 ms after `touchend` (the grace window
    covers `navigateToJob` before the page actually changes). The blur-hide
    callback now early-returns if the flag is true, so the dropdown stays
    visible for the full duration of any in-flight gesture.

### Files

- `index.html` — `attachSuggest` rewritten to share `touchActiveOnDropdown` /
  `touchState` across the new touchstart / touchend / touchcancel handlers;
  `fitDropdownToViewport()` added at the end of the same closure;
  blur-hide and focus handlers updated to participate.
- `docs/Design.md` — §7.12 sub-points for F1 / F2 / F3 added; revision
  history row appended for 2026-05-06.

### Verification (manual, real-device)

- iPhone Safari (iOS 17+): keyboard up → dropdown sits flush above keyboard,
  all results scrollable; finger drag scrolls without selecting; tap < 500 ms
  navigates as expected.
- Android Chrome: same gesture set, no regression.
- Desktop Chrome / Safari / Firefox: mouse / keyboard interactions unchanged.

---

### English UI removal — site is now JA-only (BREAKING)

The English UI was retired. The site renders only Japanese; legacy `/en/*` URLs
301-redirect to their `/ja/*` equivalents.

**Why:** GA4 + Vercel analytics showed almost zero EN sessions sustained over
three months. Maintaining 1112 EN HTML pages, 51 in-page i18n spans, and a JS
language-switcher infrastructure was a meaningful tax for traffic that didn't
exist. JA-only is closer to the actual audience and keeps the surface
maintainable.

- **Source data preserved** — `data/translations/en/` (552 files) was moved to
  `data/_archive/translations-en/` (still in repo, not deleted). EN fields
  (`*_en`, `aliases_en`, `summary_en`, `rationale_en`, `sector.en`, etc.) on
  `data/occupations/*.json` were left in place. The build pipeline simply
  stops reading them. EN can be resurrected by reverting the build scripts
  and restoring the archive folder.

- **Build pipeline (Phase 1)** — strips EN code paths from
  `scripts/build_occupations.py`, `scripts/build_sector_hubs.py`,
  `scripts/build_data.py`, plus the seven affected `scripts/projections/*.py`
  (labels, search, detail, treemap, sectors, featured, tasks, skills).
  Single-language `render_html(rec, related)` replaces the previous
  `render_html(rec, lang, related)`; `OUT_DIR_EN` removed; sitemap helpers
  drop EN parallel rows.

- **Generated output (Phase 2)** — re-running `npm run build`:
  - `ja/<id>.html` × 556 (was 556 + en/<id>.html × 556 = 1112)
  - `ja/sectors/<id>.html` × 16 + `ja/sectors/index.html` × 1 (was ×2)
  - `dist/data.detail/<id>.json` × 556 — schema bumped 1.1 → 1.2; dropped
    `title.en`, `aliases_en`, `desc_en`, `rationale_en`, `sector.en`
  - `dist/data.search.json` — schema bumped 1.1 → 1.2; dropped `title_en` /
    `aliases_en` per record
  - `dist/data.sectors.json` — dropped `sector.en`
  - `dist/data.treemap.json` — dropped `name_en`, `ai_rationale_en`
  - `dist/data.labels/ja.json` — only this file (no `en.json`)
  - `sitemap.xml`: 1152 → 579 URLs
  - `git rm` of 573 files in `en/` (556 detail + 16 sector hubs + 1 index)

- **Root HTML (Phase 3)** — `index.html`, `about.html`, `privacy.html`,
  `compliance.html`, `404.html`:
  - All `data-i18n="ja|en"` paired spans collapsed to JA text.
  - All `class="active"` JA + plain EN `<p>` / `<div>` pairs collapsed.
  - All three `<button data-set="en">English</button>` switchers removed
    (with their JA counterparts and surrounding `.lang-switch` containers).
  - `setLang()` / `?lang=en` URL handling removed; `let lang = "ja"` →
    `const lang = "ja"`.
  - `hreflang="en"` and `hreflang="x-default"` `<link>` tags removed;
    `og:locale:alternate="en_US"` removed.
  - FAQPage Schema.org JSON-LD (10 questions) translated EN → JA;
    `inLanguage` arrays narrowed `["ja", "en"]` → `["ja"]`.
  - Footer EN sector list (16 `<li>`) deleted from `index.html`.
  - EN footer-links blocks (`<a href="/about?lang=en">…`) deleted from all
    five files. Page titles narrowed (e.g. `'コンプライアンス / Compliance — …'`
    → `'コンプライアンス — …'`).

- **SEO/redirect layer (Phase 4)** —
  - `vercel.json`: removed two legacy `/occ/<id> → /en/<id>` redirects;
    added catch-all `/en/:path* → /ja/:path*` permanent (301). Covers
    `/en/523`, `/en/sectors/it`, `/en/sectors`.
  - `api/og.tsx`: removed `lang=en` parameter handling; OG card now JA-only
    with no EN sub-name. `npx tsc --noEmit` passes.
  - `llms.txt` / `llms-full.txt`: site description, sitemap URL count,
    sector taxonomy table, and FAQ updated; new FAQ entry "Is there an
    English version of the site?" → "No, retired in v1.4.0; /en/*
    301-redirects".

- **Files** — `scripts/projections/*.py` × 8, `scripts/build_*.py` × 3,
  `scripts/test_data_consistency.py`, `index.html`, `about.html`,
  `privacy.html`, `compliance.html`, `404.html`, `vercel.json`,
  `api/og.tsx`, `llms.txt`, `llms-full.txt`,
  `docs/Design.md` (§0 banner + §0.1 routes + §6.6 + §7.10 + §7.12 + §7.13
  + §15 revision row), `docs/MOBILE_DESIGN.md` (archive banner update).
  Source backup at `data/_archive/translations-en/`.

- **Verified locally** —
  - `npm run build` clean (build_data + build_occupations + build_sector_hubs)
  - 5 root HTML pages serve 200; no `[data-i18n]`, no `/en/`, no
    `?lang=en` in any served HTML
  - Treemap renders 552 JA tiles, no console errors
  - Hero text reads cleanly with no EN remnants

### Search autocomplete — P0 GA4 funnel + UX fixes

GA4 path-exploration showed `job_search_submit → job_search_navigate` at only
22% CTR. Investigation revealed the denominator was conflating two distinct
user intents — visual filter ("typed 医 to dim non-medical tiles") and
navigate ("typed 看護師 to open that page"). The 22% number was unusable as
a real search-CTR, and the autocomplete UX itself had two latent issues
(no pre-selection, no keyboard hint). This change unblocks decision-making
on the search funnel.

- **P0-A — split typed signal from intent signal** (`index.html`,
  `analytics/spec.yaml`):
  - Renamed `job_search_submit` → `job_search_typed`. Same trigger (typing
    paused 800 ms), same params, but **demoted from Key Event** — kept as
    a tool for surfacing popular queries / dataset coverage gaps, NOT as a
    CTR denominator.
  - Added `job_search_intent` (Key Event, KPI #1). Fires only when the user
    shows clear navigate-intent on the autocomplete: form submit (Enter or
    button), arrow-key navigation, mouse hover ≥ 500 ms, or
    mousedown / touchstart on a suggestion. Deduped per distinct query.
    `intent_source` param distinguishes `submit | arrow_keys | hover | click`.
  - **Real search CTR formula** (effective 2026-05-06):
    `job_search_navigate / job_search_intent`. Stays close to 100% when
    the autocomplete UX is good; drops when users engage but can't find /
    don't commit. Replaces the polluted
    `job_search_navigate / job_search_submit` ratio that had been showing
    22% in GA4 path-exploration reports.
  - **Operator action required**: re-run `node analytics/setup-ga4.mjs`
    to register the new event name and the new Key Event mapping in GA4.
    Existing `job_search_submit` data continues to live in GA4 history;
    going forward, the same payload is recorded under `job_search_typed`.

- **P0-B — autocomplete first item auto-highlights on render**
  (`index.html`, `docs/Design.md` §7.12):
  - `render(q)` now sets `focusedIdx = 0` and adds `.focused` to the first
    candidate. User can type and hit Enter immediately — no need to press
    ↓ first. `rankMatches` already guarantees the first candidate is the
    highest-relevance match (exact → starts-with → contains → name length
    ascending), so first-item navigation is the right default.

- **P0-C — keyboard hint row at top of dropdown**
  (`index.html`, `docs/Design.md` §7.12):
  - Adds a non-interactive `.ss-hint` row at the top of `.search-suggest`
    showing「↑↓ で選択 · Enter で開く」/「↑↓ to select · Enter to open」.
  - **Desktop only** — gated by
    `matchMedia("(hover: none) and (pointer: coarse)")`. Touch devices
    keep the dropdown compact (no hint).
  - `pointer-events: none` on the hint, plus
    `closest("li[data-job-id]")` in keydown / mousedown handlers, ensure
    the hint is ignored by both keyboard and pointer selection paths.

### Files

- `index.html` — autocomplete `attachSuggest`, `wireSearchSubmit`,
  search-typed analytics block, `.ss-hint` CSS rule.
- `analytics/spec.yaml` — `job_search_submit` → `job_search_typed`
  renamed and demoted; `job_search_intent` added; `intent_source`
  parameter defined; `key_events` list updated.
- `docs/Design.md` — §7.12 autocomplete sub-points 5.1 / 5.2 added,
  GA4 event list expanded with `job_search_typed` + `job_search_intent`
  + new CTR formula; revision history row appended.

---

## [1.3.0] - 2026-05-06

SEO/GEO sector cluster · 32 sector hub pages · 2 sectors index · homepage sector navigation · detail-page title + H2 intent-keyword expansion · dynamic sector OG cards · llms-txt sector taxonomy · CDN cache headers · keyword coverage gap closure.

### Sector hub pages — 32 new SEO landing pages

- **16 sector hubs × 2 langs = 32 static pages** at `/<lang>/sectors/<sector_id>`
  (e.g. `/ja/sectors/it`, `/en/sectors/iryo`). Each hub aggregates the
  occupations belonging to one of the 16 consumer-friendly sectors and surfaces
  TOP 5 highest-AI-impact, TOP 5 lowest-AI-impact, TOP 5 by workforce, plus the
  full sorted occupation list. Direct internal links to all detail pages.
- **SEO targeting** — title template
  `{sector}の職業一覧 — N職業｜AI 影響度ランキング・年収・就業者数 | 未来の仕事`
  captures sector-intent queries (`IT 業界 AI 影響`, `医療系 仕事 将来性`)
  that the per-occupation detail pages alone could not.
- **Schema.org JSON-LD per hub** — WebPage + BreadcrumbList + ItemList
  (occupations enumerated with rank). hreflang ja/en/x-default + canonical +
  Open Graph + Twitter Card on every hub. Full 4-tracker analytics block
  (Cloudflare WA / GA4 / Vercel WA / Speed Insights) per
  `feedback_analytics_consistency.md`.
- **`scripts/build_sector_hubs.py`** — generator reads
  `data/sectors/sectors.ja-en.json` + `dist/data.detail/*.json`, groups by
  sector, emits hub HTML, writes `scripts/.sector_manifest.json`, rewrites
  `sitemap.xml` with the 32 hub URLs in addition to the 6 statics + 1112
  occupation URLs (1150 total).
- **`scripts/dev-server.py`** — added `cleanUrls` rewrite for
  `/<lang>/sectors/<sector_id>` so local previews resolve to the `.html` file.
- **`scripts/build_occupations.py`** — sitemap rewriter now reads
  `.sector_manifest.json` and re-injects sector URLs whenever it runs, so the
  sector entries survive any future occupation rebuild.
- **Phase 2 — homepage sector navigation** (`index.html`): pre-rendered
  `<nav class="sector-nav">` block sits between the treemap and the data
  attribution, listing all 16 sectors as pill chips with occupation counts.
  Both `ja/` and `en/` link sets emitted statically and toggled via the
  existing `data-i18n` mechanism — first paint shows the entry list with no
  fetch. Direction C tokens (`--bg2` surface, `--bg3` pill, `--accent`
  hover). Each pill is an internal link straight into a sector hub, closing
  the homepage → hub → detail traffic funnel.
- **Phase 10 — SEO keyword coverage gap closure** — site-wide audit found
  4 pages missing intent keywords; all 4 patched in this commit:
  - `about.html` — added `<meta name="keywords">` covering 算出方法 / データ出典 /
    厚生労働省 jobtag / JILPT / Claude Opus 4.7 / methodology / scoring rubric
  - `compliance.html` — added keywords covering 著作権帰属 / 二次利用 / 派生作品 /
    商標 / MIT / attribution / derivative work
  - `privacy.html` — added keywords covering 個人情報保護 / Cookie / 第三者提供 /
    GA4 / Cloudflare / APPI / GDPR / privacy policy
  - `404.html` — added `<link rel="canonical">` (was missing — minor hygiene
    even on `noindex` pages); kept noindex policy intact
  - **Sector hub H2 sector-name embed** — the 3 TOP-5 H2s
    (`AI 影響 が高い職業 TOP 5` / `AI 影響 が低い職業 TOP 5` / `就業者数 TOP 5`)
    rewritten to lead with the sector name (`IT・通信 の AI 影響 が高い職業
    TOP 5` etc.). Same H2-keyword strategy as Phase 7 detail pages but applied
    to the 32 sector hubs. Captures `{sector} AI 影響` / `{sector} 就業者数`
    long-tail queries at H2 strength.
- **Phase 9 — sector dynamic OG cards** (`api/og.tsx` extended) — sector hubs
  now ship a dedicated 1200×630 social preview rendered at request time:
  - new query branch `/api/og?sector=<sector_id>&lang=<ja|en>` reads
    `/data.sectors.json`, finds the sector, and renders a card with the
    sector name (Noto Serif JP, 104px), an INDUSTRY SECTOR eyebrow tinted
    by the sector's hue (sage / gold / terracotta from Direction C palette),
    a 14px hue-tinted left border, the 3 most-populous sample titles, and
    a stats row with occupation count + mean AI risk + total workforce.
  - `scripts/build_sector_hubs.py`: per-hub `og:image` and `twitter:image`
    retargeted from the site-wide `/og.png` to the dynamic endpoint, so
    every X / LINE / Slack / Discord share of a sector hub URL now shows
    a card that's actually about *that* sector.
  - The 2 sectors-index pages keep `/og.png` (site-wide brand card) since
    a "16 sectors at once" card has weaker share-card legibility than
    the brand mark.
  - Card cached at the CDN with `s-maxage=86400, stale-while-revalidate=
    604800` so cold edges don't thunder against the @vercel/og runtime.
- **Phase 8 — llms.txt + llms-full.txt surface sector hierarchy** —
  the GEO companion files (read by ChatGPT, Claude, Perplexity, Gemini for
  retrieval / citation) now describe the new sector cluster:
  - `llms.txt` Pages section adds sectors index URLs, the 16 sector IDs
    with occupation counts, and the per-occupation detail URL pattern.
  - `llms-full.txt` gets a new §2.5 Sector taxonomy table (16 sectors
    × ja/en name × occupation count × mean AI risk) plus cross-sector
    observations (IT highest at 8.1, Construction lowest at 2.0,
    Office & Public Service largest by workforce). §7 Technical architecture
    updated with the 3-tier URL surface (home → sector hubs → detail) and
    the new sitemap totals (1152 URLs).
  AI search engines now have explicit pointers to the sector hubs instead
  of having to discover them via sitemap crawl alone.
- **Phase 7 — H2 headings embed occupation name** (`scripts/build_occupations.py`):
  detail-page H2s now incorporate the occupation name to match the long-tail
  intent queries the Phase 4 title rewrite anchored on:
  - JA: `この職業について` → `{name}とは`,  `なるには（経路・資格）` → `{name}になるには・必要な資格`,  `労働条件・働き方` → `{name}の労働条件・働き方`
  - EN: `About this occupation` → `What is a {name}?`,  `How to enter the field` → `How to become a {name}`,  `Working conditions` → `Working conditions for {name}`
  Effect: the page surfaces `{職業名} とは`, `{職業名} になるには`,
  `{職業名} 労働条件` keywords in H2 (next-strongest signal after H1 / title)
  on top of the title-level coverage. Applied to all 1112 detail pages.
- **Phase 6 — Vercel cache headers for SEO assets** (`vercel.json`):
  added `Cache-Control` for `/sitemap.xml` (`max-age=300, s-maxage=600` — 5 min
  browser, 10 min CDN), `/robots.txt` (10 min / 1 hr), and `/llms.txt` /
  `/llms-full.txt` (10 min / 1 hr) plus explicit `Content-Type` for sitemap
  and llms-txt. Previously sitemap relied on default 1-hour CDN TTL — slow
  feedback loop after content changes. Now changes are visible to crawlers
  within 10 minutes of deploy.
- **Phase 5 — sectors index page (hub-of-hubs)** — new `/ja/sectors` and
  `/en/sectors` listing all 16 sectors as cards (name + count + mean AI risk
  + total workforce + 3 sample titles), each linking into its dedicated
  sector hub. Fixes the previously dangling "セクター / Sectors" breadcrumb
  step that landed back on the homepage; now it's a real intermediate page.
  Schema.org JSON-LD: WebPage + BreadcrumbList + ItemList of 16 hub URLs.
  Sitemap entries added with `priority=0.8` (between hubs at 0.7 and home
  at 1.0). Hub-page breadcrumb's "セクター / Sectors" link retargeted from
  `/<lang>/` to `/<lang>/sectors`.
- **Phase 4 — detail-page title intent-keyword expansion**
  (`scripts/build_occupations.py`): old template was
  `{name} — AI 影響 X/10｜mirai-shigoto.com`, only matching AI-impact intent.
  New template adds the three highest-volume long-tail intents around an
  occupation page:
  - JA: `{name} — AI 影響 X/10・将来性・年収・なるには｜未来の仕事`
  - EN: `{name} — AI Impact X/10: Outlook, Salary, Career Path | Mirai Shigoto`
  Effect: a single page now competes for `{職業名} 将来性`, `{職業名} なるには`,
  `{職業名} 年収` queries in addition to `{職業名} AI 影響`. Applied to all
  1112 detail pages.

### Custom 404 page

- **`/404.html`** — new static error page at root. Vercel auto-serves this with
  HTTP 404 for any unmatched route; previously unmatched paths fell through to
  Vercel's default white page. Direction C tokens (sage / terracotta / warm
  cream serif), oversized "404" with rotated italic accent on the middle "0",
  primary CTA back to home, 3 secondary links (About / Compliance / Privacy),
  bilingual ja/en (default ja, `?lang=en` switches), full 4-tracker analytics
  block per `feedback_analytics_consistency.md`, `noindex, follow` meta.
  Fires a `page_not_found` GA4 event with the attempted path + referrer so we
  can spot dead inbound links. **Deliberately omits the global "non-official"
  top banner** (Design.md §7.1) — a 404 is a navigation dead-end, not branded
  content; the banner's red-tone block fights the oversized "404" for visual
  primacy and the disclaimer is irrelevant context for someone who just hit a
  broken URL.

### Footer chip strictification + complete GitHub link severance (site-wide)

User policy: footer chips are **exactly 3 on index** (`データについて / コンプライアンス / プライバシー`) and **exactly 4 on every other page** (`トップ / データについて / コンプライアンス / プライバシー`). No exceptions, no extras.

- **Removed `変更履歴 / Changelog` chip** from `index.html` footer-links (was the 4th chip on index — now 3).
- **Removed `算出方法 / Methodology` chip** from sector-hub footer (template `scripts/build_sector_hubs.py` + 32 regenerated hubs — was the 5th chip, now 4). Methodology content still lives at `/llms-full.txt`; just no longer surfaced from the footer.
- **404 / about / privacy** chip rows realigned to the 4-chip canonical (some were missing `コンプライアンス` or `データについて`).
- **All `github.com` URLs purged from served surfaces:**
  - footer-meta `MIT` links (5 static pages + detail + sector templates) → plain text "MIT"
  - `index.html` JSON-LD: removed `sameAs: [github.com/...]` from Organization + Dataset schemas; stripped Karpathy URL from `measurementTechnique`; removed Karpathy citation from Dataset citations; removed GitHub URL from FAQ "is data downloadable" answer
  - `about.html` body: rewrote "Scoring scale" Sources row to describe the in-house rubric without linking to karpathy/jobs; replaced "Please use GitHub Issues for inquiries" sentence with "Do not contact public institutions" guidance
  - `compliance.html` body: bug-report / feature-request / score-dispute CTA repointed from GitHub Issues to `mailto:privacy@mirai-shigoto.com`
  - `llms.txt`: dropped `[GitHub repository]` and `[CHANGELOG]` link bullets, removed Karpathy URL from methodology line, removed Karpathy bullet from Sources
  - `llms-full.txt`: removed `Source code: github.com/...` bullet, dropped GitHub URL from rubric anchor description, dropped GitHub link from FAQ "is data downloadable", removed `DATA_ARCHITECTURE.md` GitHub link from technical section, replaced `MIT — see github.com/.../LICENSE` with plain `MIT.`, removed GitHub bullet from Contact section
  - `scripts/make_prompt.py`: deleted `KARPATHY_URL` and `REPO_URL` constants and all 4 usages; replaced "Source: github.com/..." line with nothing; replaced "Scoring scale: Ported anchors from karpathy/jobs" with description of in-house rubric. Regenerated `data/prompts/prompt.{ja,en}.md`.
- **Final audit:** `grep -rln 'github\.com' --include='*.html' --include='*.txt' --include='*.md'` returns 0 hits across all 1147 served HTML files, both `llms.txt` / `llms-full.txt`, and both prompt MD files. Same wave as the v1.2.1 banner removal — completing the cleanup of developer-facing surfaces from the visitor primary path.

---

### Footer overhaul — pill chips + GitHub link removal (site-wide)

- **Visual:** all footers across the site rewritten from a flat
  `<a>トップ</a> · <a>データについて</a> · …` middot list to a two-tier layout:
  a row of **pill chips** for navigation links (independent border, padding,
  and hover highlight per chip) followed by a smaller `.footer-meta` line for
  version / license / source attribution. User feedback: the middot list
  became unreadable on mobile when wrapping, with visual weight smeared
  across all links — chips give each link its own hit area and visual
  container.
- **GitHub link removed from every footer** — the standalone `<a>GitHub</a>`
  chip is gone from the index footer, mobile burger menu, about / compliance /
  privacy / 404 footers, all 1112 detail-page footers (template +
  regenerated), and all 32 sector-hub footers (template + regenerated). The
  `MIT` license link still points to the GitHub LICENSE since it's a
  functional license citation rather than navigation; content-body
  references to GitHub Issues (compliance dispute filing, about contact)
  remain functional content. Same cleanup wave as the recent removal of the
  "non-official" top banner — pruning developer-facing surfaces from the
  visitor primary path.
- **Files touched:** `index.html`, `about.html`, `compliance.html`,
  `privacy.html`, `404.html`, `scripts/build_occupations.py` (template +
  1112 regenerated pages), `scripts/build_sector_hubs.py` (template + 32
  regenerated pages), `docs/Design.md` §7.10 rewritten with the new
  two-tier spec.
- **`docs/Design.md` §7.14** — new component spec for the 404 page (layout,
  tokens, copy, SEO meta). Scope list in §0 updated to include `404.html`.
- **`scripts/dev-server.py`** — mirrors Vercel: any path that resolves to a
  non-existent file (after the existing cleanUrl rewrites) now serves
  `404.html` with HTTP 404 instead of the SimpleHTTPServer plain-text default.

---

## [1.2.0] - 2026-05-05

Convergence to single-URL responsive architecture · Direction C unified · schema-1.1 rich detail integration · `/m/` pipeline removed.

### Direction C convergence (PC adopts mobile design language)

- **Visual + voice migration** (`7f8ce55` → `3da1729`) — warm-cream palette
  (`#FAF6EE` bg / `#241E18` ink / `#D96B3D` terracotta / `#6E9B89` sage),
  Noto Serif JP headings, italic terracotta accent on signature words.
  Hero rewritten from utility question ("あなたの仕事は AI 時代にどう変わる？")
  to emotional vision ("AIの時代でも、あなたらしい働き方を。"). CTA softened
  ("AI 影響度をチェック" → "気になる職業から始める"). Theme toggle hidden —
  single Direction C theme.
- **Detail-page strict per-language** (`d33eda4`) — each `/<lang>/<id>` renders
  ONLY its language; H1, breadcrumb, page title, JSON-LD all single-language.
- **Lang-switch relative href** (`351a9a2`) — switching JA↔EN on a detail
  page stays on the current domain (no preview→production leakage).
- **Hero Japanese phrase-break** (`70c8a84`, `3fd1270`) — 3-line semantic
  layout on mobile: "AIの時代でも、" / "あなたらしい" (italic terracotta) /
  "働き方を。"; collapses to one line ≥769px.
- **Mobile search "診断" inline CTA** (`3fd1270`) — pill-shaped terracotta
  button inside the search input on mobile-hero, mirrors desktop submit
  behavior.
- **Mobile compact top bar** (`3fd1270`) — sticky brand "未来の仕事" + chart-line
  SVG mark + hamburger menu (lang switch + about/compliance/privacy/GitHub).
  Replaces verbose h1 + lang switcher on small viewports.
- **TOP 10 horizontal-swipe carousel** (`107c395`, `3fd1270`) — mobile-only
  `.m-top10` section right under the hero. Cards built client-side from the
  treemap projection sorted by `ai_risk` desc, top 10. Card content: rank
  pill, occupation name (serif + sub-language), big terracotta score, tag,
  AI rationale (2-line clamp), workers + salary stats. Native CSS
  `scroll-snap-type: x mandatory` for swipe; progress bar + N/10 counter.
- **Mobile autocomplete suggest dropdown** (`13e25ac`) — `attachSuggest()`
  refactor wires the same dropdown logic to both `#searchInputDesktop` and
  `#searchInputMobile`. Touch-event support for iOS/Android.
- **Treemap "職業マップ" section header** (`3fd1270`) — mobile-only header
  above the canvas: serif title + sans subtitle "全 552 職業 ・ 面積＝就業者数
  ・ 色＝AI影響".
- **EN homepage Japanese-bleed fix** (`3da1729`) — chips, search placeholders,
  salary tier labels (JS-generated) all localize correctly. Salary tiers
  use ¥XM / ¥X.XM in English (no "万" leak).

### Schema-1.1 rich data integration into desktop detail (Push 1)

- **Adapter expansion** (`58349ee`) — `_load_legacy_shape_corpus()` carries 13
  new fields from `dist/data.detail/<id>.json` v1.1: aliases (ja/en),
  classifications, sector, risk/workforce/demand bands, ai_risk
  metadata (model + scored_at), skills_top10, knowledge_top5, abilities_top5,
  tasks_count + tasks_lead_ja, related_orgs, related_certs_ja,
  data_source_versions. Module loads `dist/data.profile5.json` and
  `dist/data.transfer_paths.json` once at main entry.
- **6 new detail-page sections**:
  - Sector chip + risk/workforce/demand band badges under H1
  - 5-axis profile radar SVG (340×340 desktop / 280×280 mobile, algorithm
    parity with retired mobile detail.py)
  - Top-N: skills 10 / knowledge 5 / abilities 5 in 3-column grid
  - Transfer paths: 3-up career-change candidate cards from
    `data.transfer_paths.json` (replaces legacy "same risk-band 5")
  - Industry organizations + certifications side-by-side
  - Provenance footnote: AI model + scored_at + IPD source version
- **JSON-LD enrichment** — `alternateName` aggregates JA/EN names + aliases;
  `industry` from sector; `occupationalCategory` from MHLW classifications;
  `skills` from skills_top10 labels; `qualifications` from related_certs_ja.
- **`<meta name="keywords">`** — name + top-8 aliases for additional SEO
  signal on Bing/Yandex.
- Page size 30→46 KB (+50%) per detail; trade-off accepted for feature parity.

### `/m/` pipeline removal (Push 2)

- **1140 files deleted** — `m/ja/*.html` × 556, `m/en/*.html` × 556, `m/islands/*.js` × 3,
  static index pages × 12, all 8 mobile template files, `mobile_render.py`,
  `i18n.py`, `mobile_strings.json`, `build_mobile.py`, `build_mobile_detail.py`,
  `mobile-components.css`, `mobile-screen-*.css` × 7.
- **Kept**: `styles/mobile-tokens.css` + `mobile-tokens.json` as Direction C
  design-token reference (cited by index.html / build_occupations.py CSS
  comments). `scripts/lib/bands.py` and friends kept (used by data
  projections).
- **Configuration**: `vercel.json` `/m/*` redirect/header rules removed.
  `docs/MOBILE_DESIGN.md` archived (banner header marks it as v1.1.0
  history + Direction C token reference). `docs/Design.md` §0 updated to
  describe single-URL architecture.
- **No 301 redirects added** — `/m/` was only one day live with no SEO
  assets, no external backlinks. `/m/*` paths now return 404 (acceptable).

### OG / SNS sharing

- **Static homepage `og.png` regenerated** (`d33eda4`) in Direction C: warm-cream
  background, italic terracotta "AIの時代でも、**あなたらしい**働き方を。", soft
  warm-circle backdrop + paper grain. Stats: 552 / 5,449万人 / 5次元 / 独自
  (no fear framing).
- **Dynamic `/api/og?id=N&lang=L` Edge Function rewritten** (`3bf0787`) —
  cream background, white risk-block with colored border (sage / gold /
  terracotta tier), Noto Serif JP for occupation name, "UNOFFICIAL" pill in
  terracotta. Risk-band palette aligned with mobile-tokens.css.
- **Homepage meta tags Direction C voice** (`4163cd0`) — `<title>`, `og:title`,
  `og:description`, `twitter:title`, `twitter:description`, `og:site_name`
  ("未来の仕事 — Mirai Shigoto（非公式）"), `og:image:alt` all rewritten.
- **Detail-page `og:site_name`** (`4163cd0`) — JA: "未来の仕事 — Mirai Shigoto
  （非公式）" / EN: "Mirai Shigoto — Future of Work (unofficial)".
- **`og:image` absolute production URL** (`aa9b4be`) — strict OG-spec compliance
  for Twitter / LinkedIn. Brief `f2e26dc` experiment with relative URLs
  reverted before production merge.

### Operational

- **Two-environment workflow** documented and tested:
  `preview` branch → `https://pre.mirai-shigoto.com` (verified during this
  release) → merge to `main` → `https://mirai-shigoto.com`. The preview
  domain was set up with custom subdomain bound to the `preview` Git branch
  via Vercel project domain configuration with `gitBranch: "preview"`.

---

## [1.1.0] - 2026-05-05

Mobile-web pivot · 8 dedicated `/m/{ja,en}/*` screens · sector taxonomy subsystem · multi-axis bands · 5次元 profile · transfer-paths recommendations · bilingual (JA + EN).

- **Mobile-web v1.1.0 — Direction C: Warm Editorial** — 6 unique static screens + 1 detail-page family at `/m/{ja,en}/`: ① ホーム (`index`) / ② 職業マップ (`map`) / ③ 検索結果 (`search`) / ④⑤ 詳細 (`<id>`, 556 occupations × 2 langs = 1,112 detail HTML, canonical → desktop) / ⑥ 比較 (`compare`) / ⑦ ランキング (`ranking`) / ⑩ About (`about`). Numbering ① through ⑩ corresponds to the user-flow screen IDs in MOBILE_DESIGN.md (⑧⑨ reserved for future); on disk that's 6 unique static templates. Sage green + テラコッタ橙 + 暖米底, Noto Serif JP + Plus Jakarta Sans + JetBrains Mono. 6 static × 2 langs = 12 entry pages + 1,112 detail HTML = 1,124 mobile pages total.
- **Sector taxonomy subsystem (§6.11 + D-014)** — 16 consumer-friendly sectors (`data/sectors/sectors.ja-en.json`) with MHLW seed_codes + manual override file (`data/sectors/overrides.json`). 100% auto-derivation: 556/556 occupations classified with 3 manual overrides, 0 uncategorized, 0 ambiguous. Distribution range 14-63 occupations per sector. New projection `data.sectors.json` (~3 KB gz) + ops `data.review_queue.json`.
- **Multi-axis bands** (`scripts/lib/bands.py`) — `risk_band` (low/mid/high), `workforce_band` (small/mid/large), `demand_band` (cold/normal/hot) attached to every record in treemap / search / detail projections. Single-source thresholds shared by all 3 projections.
- **5次元 profile projection** (`data.profile5.json`, ~8 KB gz) — derives 創造性 / 対人 / 判断 / 体力 / 反復性 from existing IPD work_characteristics + skills + abilities + work_activities. 0-100 scale. Renders as 5-axis radar SVG on detail pages.
- **Transfer paths projection** (`data.transfer_paths.json`, ~22 KB gz) — for each occupation, top-4 lower-risk peers from the same sector, ranked by cosine similarity over the IPD skills vector. 437 primary recommendations, 61 fallback (no safer in sector), 58 no-skills.
- **Bilingual JA + EN** — 120-key i18n dictionary (`scripts/i18n/mobile_strings.json`), 100% coverage in both languages. Per-page lang switcher links to the same screen in the other language.
- **EN long-form translation script** (`scripts/translate_descriptions.py`) — Anthropic Claude API runner for `what_it_is_en` / `how_to_become_en` / `working_conditions_en`. `--dry-run` / `--limit N` / `--force` flags. NOT yet run (pending API key); detail pages currently show JA-only fallback notice on EN side.
- **Build pipeline** — new `scripts/build_mobile.py` (orchestrator for 6 static screens × 2 langs) + `scripts/build_mobile_detail.py` (1112 detail pages from `dist/data.detail/<id>.json`). Both reuse `scripts/lib/{i18n,mobile_render}.py`.
- **Islands (vanilla JS, ≤ 2 KB each)** — `m/islands/ranking-tabs.js` (tab toggle), `m/islands/search.js` (live filter + sector chips + URL state), `m/islands/compare.js` (URL-driven A/B compare).
- **Static MPA + View Transitions API** — chose static multi-page architecture over SPA (per MOBILE_DESIGN.md §7 + DATA_ARCHITECTURE.md A.8). Page transitions use the browser-native View Transitions API + `<link rel="prefetch">` instead of a JS router. Zero SPA framework.
- **Documentation** — new `docs/MOBILE_DESIGN.md` (11 sections: design philosophy, tokens, 8-screen contracts, primitives, mobile detail SEO strategy, islands architecture, i18n strategy). Updated `docs/Design.md` (§0.1 cross-reference for the dual-design-system world). Updated `docs/DATA_ARCHITECTURE.md` (§6.11 sector subsystem, D-014 decision, A.8 background, v1.1.0 revision).
- **Vercel rewrites** — added `/data.{sectors,profile5,transfer_paths}.json` rewrites + `/m/*` cache headers + `/styles/*` cache + `/m` → `/m/ja/` redirect. Mirrored in `scripts/dev-server.py`.
- **Tests** — new `scripts/test_sector_subsystem.py` (24 unit tests for resolver + bands, all green). `scripts/test_data_consistency.py` extended with sector coverage + band distribution checks.

[Full notes →](https://github.com/jasonhnd/jobs/releases/tag/v1.1.0)

---

## [0.7.0] - 2026-05-04

IPD v7.00 source migration · per-occupation source files · 9 projection families · 4 new occupations · ScoreRun v2.0 · architecture documentation.

- **IPD v7.00 as canonical source** — switched from web-scraped `data/occupations_full.json` (580 records) to JILPT IPD v7.00 download (`scripts/import_ipd.py`). 556 occupations now have full O*NET-style profiles: 39 skills + 33 knowledge + 35 abilities + 39 work characteristics + 41 work activities + 6 Holland Code interests + 11 work values, plus up to 37 tasks per occupation with execution rate + importance scores. License-confirmed (jobtag TOS Article 9 — secondary use OK with attribution).
- **4 new occupations** — `ブロックチェーン・エンジニア (581)`, `声優 (582)`, `産業医 (583)`, `3D プリンター技術者 (584)` added from IPD v7.00 (jobtag's March 2026 update). Detail pages render with graceful "data unavailable" placeholders for missing AI scores / stats.
- **9-family projection layer** — `scripts/build_data.py` orchestrator with atomic dist swap + Pydantic validation gates: `treemap` / `detail/<id>` / `search` / `labels` (Implemented & default-emitted), plus `tasks/<id>` / `skills/<key>` / `holland` / `featured` / `score-history/<id>` (function-coded, behind `--enable-future`).
- **ScoreRun v2.0 schema** — AI score files now carry full audit metadata: model + provider + temperature + run_id + duration + input_data_sha256 + prompt_version + prompt_sha256. Reproducibility is no longer "trust the date in the filename".
- **Per-occupation source files** — `data/occupations_full.json` (single 11 MB file) replaced by `data/occupations/<padded>.json` × 556. Git diffs show exactly which occupation changed.
- **Stats patch layer** — `data/stats_legacy/<padded>.json` × 552 keeps salary/workforce/age/recruit data physically separate from IPD source (which doesn't ship those fields). Same data, cleaner architecture.
- **Translations decoupled** — single `data/translations_2026-04-25.json` → `data/translations/en/<padded>.json` × 552. Adding a new language is "create a directory".
- **7 label dictionaries** — `data/labels/<dim>.ja-en.json` for the 204 standard skill/knowledge/ability/work-characteristic/work-activity/interest/work-value labels (O*NET-aligned EN, draft v0.1).
- **Frontend cutover** — `index.html` now reads `/data.treemap.json` (~80 KB gz, was 275 KB gz), `api/og.tsx` reads `/data.detail/<id>.json` per request (was full dataset fetch), `scripts/build_occupations.py` reads from `dist/data.detail/`. Vercel + dev-server rewrites map `/data.*` URLs to physical `dist/` paths.
- **Architecture documentation** — full target spec with status matrix, data provenance, ID/path rules, validation policy, decision records (D-001 to D-013), and migration runbooks at [`docs/DATA_ARCHITECTURE.md`](docs/DATA_ARCHITECTURE.md).
- **Legacy archive** — `data/.archive/v0.6/` preserves pre-IPD source files (`data.json`, `occupations_full.json`, `ai_scores_2026-04-25.json`, `translations_2026-04-25.json`) for audit trail.
- **CI gate** — `.github/workflows/data-validation.yml` runs L1 schema + L2 consistency + L3 projection sanity on every PR.
- **Dependencies** — `pyproject.toml` adds `openpyxl>=3.1` (xlsx parsing) + `pydantic>=2.5` (schema validation).
- **Bumped to 1,112 detail pages** (556 × 2 languages) — sitemap regenerated.
- **`/data.json` → 301 → `/data.treemap.json`** for backward compat.

[Full notes →](https://github.com/jasonhnd/jobs/releases/tag/v0.7.0)

---

## [0.6.0] - 2026-05-03

Theme system, 552 per-occupation pages, dynamic OG cards, GA4 funnel, Design.md, Resend backend.

- **Theme system** — light / dark / system with no-flash inline detection; vibrant light-mode treemap palette; taller desktop canvas; larger tooltip.
- **552 per-occupation pages** — `/ja/<id>` and `/en/<id>` (1,104 static HTML files), each with Schema.org `Occupation` JSON-LD, hreflang pairs, related-occupations block.
- **Pure-numeric URLs** — old `/occ/<id>-<slug>` 301-redirects to `/ja/<id>` / `/en/<id>`. Single-language pages, no in-page toggle.
- **Dynamic per-occupation OG cards** — `api/og.tsx` Vercel Edge Function renders 1200×630 PNGs on demand; CDN-cached.
- **3 GA4 funnel events** — `job_search_submit`, `result_view`, `occupation_tile_click`. All marked Key Events.
- **Design.md** — visual single source of truth for tokens, theme system, breakpoints, treemap rules, tooltip behavior.
- **Backend Edge Functions** — `api/subscribe.js` + `api/feedback.js` (Resend audiences + transactional).
- **Footer share buttons** — X / LINE / Hatena / LinkedIn / Copy / Web Share API.
- **SEO health probe** — `scripts/seo-check.sh` daily probe.
- **Performance** — preload `data.json`, defer SR fallback list, defer GTM. LCP < 1.6 s on 4G, INP < 80 ms, CLS = 0.

[Full notes →](https://github.com/jasonhnd/jobs/releases/tag/v0.6.0)

---

## [0.5.0] - 2026-04-30

Hosting migration, privacy policy, SEO/GEO infrastructure, full analytics setup.

- **Vercel migration** — production serves from `hnd1` Tokyo edge node; cleanUrls, HSTS preload, custom-domain TLS auto-renewed.
- **Bilingual privacy policy** — APPI + GDPR-friendly `/privacy` page.
- **4-tracker analytics** — Cloudflare WA + GA4 + Vercel WA + Vercel Speed Insights, all parallel, all every page.
- **SEO + GEO** — robots.txt opts in 17 AI/LLM crawlers; sitemap + llms.txt + Schema.org WebSite/Dataset/Person.
- **Repo hygiene** — `.gitattributes` LF lock killed a phantom 125k-line CRLF diff.

[Full notes →](https://github.com/jasonhnd/jobs/releases/tag/v0.5.0)

---

## [0.4.x series] - 2026-04-27 to 2026-04-29

- **v0.4.2** — Mobile tooltip viewport overflow fixes + tap-outside dismiss + repo hygiene.
- **v0.4.1** — Google Analytics 4 (gtag.js); now dual-tracked with Cloudflare WA.
- **v0.4.0** — Custom domain `mirai-shigoto.com` + 13 hardcoded URL references migrated.

[Per-version notes →](https://github.com/jasonhnd/jobs/releases?q=v0.4)

---

## [0.3.x series] - 2026-04-25 to 2026-04-27

12 audit-driven iterations: page reorder (treemap-first), workforce-overcounting fix, OG/Twitter card, byline + dimension hint, Cloudflare Web Analytics, model attribution fix (Opus 4.7), legal disclaimers + JILPT attribution, expanded methodology, mobile responsive audit, mobile treemap readability, top-of-page UNOFFICIAL banner.

[Per-version notes →](https://github.com/jasonhnd/jobs/releases?q=v0.3)

---

## [0.2.x series] - 2026-04-25

AI risk scoring (Claude Opus 4.7) + EN translations + intro polish + real workforce sizing + metadata fixes. v0.2.0 → v0.2.3.

[Per-version notes →](https://github.com/jasonhnd/jobs/releases?q=v0.2)

---

## [0.1.0] - 2026-04-25

First visualization release. Squarified treemap of 552 Japanese occupations from MHLW jobtag, with 5 selectable color layers and bilingual UI (JA/EN).

[Full notes →](https://github.com/jasonhnd/jobs/releases/tag/v0.1.0)

---

## [0.0.x series] - 2026-04-25

Pre-visualization scaffolding: bilingual placeholder, jobtag scrape pipeline, master occupation list (552 valid IDs from the 1–580 range). v0.0.1 → v0.0.3.

[Per-version notes →](https://github.com/jasonhnd/jobs/releases?q=v0.0)

---

## Versioning policy

Pre-1.0: minor versions for substantive changes (features OR breaking changes), patch for fixes only. Cadence is intentionally fast while the product shape is still being explored. Detailed per-release notes preserved in [GitHub Releases](https://github.com/jasonhnd/jobs/releases).

---

[Unreleased]: https://github.com/jasonhnd/jobs/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/jasonhnd/jobs/releases/tag/v0.6.0
[0.5.0]: https://github.com/jasonhnd/jobs/releases/tag/v0.5.0
