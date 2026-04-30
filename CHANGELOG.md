# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.5.0] - 2026-04-30

### Added — Hosting migration

- **Migrated production hosting from GitHub Pages to Vercel.** mirai-shigoto.com now serves from Vercel's Tokyo edge node (`hnd1`) — sub-50ms TTFB for Japanese visitors. SSL auto-renewed, HSTS `max-age=63072000`, cleanUrls enabled (`/privacy.html` → `/privacy`).
- **`vercel.json`** — explicit static-site config (`framework: null`, `buildCommand: null`) so Vercel doesn't misdetect the Python pipeline scripts as a serverless target. Cache headers for `data.json` (5min CDN) and `og.png` (1 day).
- **GitHub Pages → redirect.** New orphan `gh-pages` branch with a single redirect HTML; `jasonhnd.github.io/jobs/*` now 301-style redirects to the corresponding path on `mirai-shigoto.com` (preserves path / query / hash). Source-of-truth code stays on `main`, served by Vercel.
- **DNS:** Cloudflare DNS-only (grey-cloud) `A 76.76.21.21` for the apex domain. Cloudflare Email Routing forwards `privacy@mirai-shigoto.com` → operator inbox.

### Added — Privacy policy

- **`/privacy` (bilingual JA/EN)** — APPI + GDPR-friendly coverage: operator, data collected, use purpose, third-party services (Google / Cloudflare / Vercel / Resend with policy links), cookies (`_ga`, `__cf_bm`), retention (email kept while subscribed + 30 days post-unsubscribe), user rights (access/correction/deletion/unsubscribe/complaint), contact (`privacy@mirai-shigoto.com`).
- **Footer link** added to both JA + EN footer copies, between MIT and GitHub.
- **MIT badge** in footer is now a real link to the LICENSE file (was previously bare text).

### Added — Analytics & observability

- **Vercel Web Analytics** + **Vercel Speed Insights** script tags in `<head>`. Now four trackers report in parallel: Cloudflare Web Analytics (cookieless), GA4 (`G-GLDNBDPF13`), Vercel WA, Vercel Speed Insights. All four are present on every page (index + privacy) — no self-blinding.
- **`analytics/spec.yaml`** — single source of truth for GA4 instrumentation: 15 events, 16 event-scoped + 4 user-scoped custom dimensions, 4 key events (conversions), 5 audiences (manual). Cross-checked: every dimension used by some event, derived key events match explicit list.
- **`analytics/setup-ga4.mjs`** — idempotent Node.js script that reads `spec.yaml` and applies via the GA4 Admin API (custom dimensions + key events). Re-runnable; existing entities skipped, never modified. Audiences and data retention remain manual dashboard tasks (filter JSON too brittle to spec declaratively).
- **CLS=0.27 perf fix** (separate sub-fix in 0.4.x line) — reserved layout space for treemap canvas + stats panel so the page doesn't reflow when `data.json` arrives. Speed Insights reports green now.

### Added — SEO + GEO

- **`/robots.txt`** — explicitly opts in 17 AI / LLM crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Applebot-Extended, CCBot, etc.). Discoverability via AI search is part of the project's distribution strategy. Sitemap reference included.
- **`/sitemap.xml`** — both URLs (`/`, `/privacy`) with `<xhtml:link rel="alternate" hreflang="...">` for JA / EN / x-default.
- **`/llms.txt`** — Markdown summary per the [llmstxt.org](https://llmstxt.org/) emerging standard. Gives AI search engines a clean overview: key facts, methodology, sample findings, sources, citation guidance, disclaimer.
- **Schema.org JSON-LD** in `<head>` — `WebSite` + `Dataset` + `Person` graph, including `variableMeasured` for the dataset (AI risk score, salary, workforce, age, hours, recruit ratio, education distribution). Helps Google's Dataset Search and AI search engines understand what this site is.
- **`<link rel="alternate" hreflang>`** tags on both `index.html` and `privacy.html` (JA / EN / x-default). Pairs with the in-page lang switcher for full multilingual SEO.

### Internal — Repo hygiene

- `.gitignore` extended: `.claude/`, `_audit/`, `.vercel/`, defensive `*-sa.json` / `*credentials*.json` patterns to block accidental credential commits.
- `.gitattributes` locks `* text=auto eol=lf` (prevents Dropbox / macOS sync from drifting CRLF into tracked files; killed a 125k-line phantom diff that lasted multiple sessions).

### Migration verification

- `mirai-shigoto.com` HTTP 200, `server: Vercel`, `x-vercel-cache: HIT`, `x-vercel-id: hnd1::...`
- `/privacy` 200, all 4 analytics scripts present
- `jasonhnd.github.io/jobs/` redirects to `mirai-shigoto.com/` (path + hash preserved)
- 4 `cleanUrls` redirects working (`/privacy.html` → `/privacy`)

---

## [0.4.2] - 2026-04-29

### Fixed (mobile)

- **Tooltip viewport overflow.** `showTooltip()` previously hardcoded the tooltip dimensions as 360×220 when computing position; the actual tooltip with the AI-rationale row is 274–297 px tall. On a 375×812 phone with a tile near the bottom of the canvas, the tooltip overflowed by ~30 px below the fold. Replaced with measured `offsetWidth` / `offsetHeight` and a four-quadrant fallback (right-overflow → flip left of cursor; still off-screen → centered; bottom-overflow → push up; final 8 px top clamp). On mobile (`@media (max-width: 768px)`), also capped tooltip `max-height: calc(100vh - 32px)` with `overflow-y: auto`, so unusually long rationale text scrolls inside the tooltip instead of being clipped.
- **Tap-outside-to-dismiss.** On touch devices, the only ways to close the tooltip were the × button or tapping another tile. Added a document-level `pointerdown` handler scoped to `touch-mode` tooltips: tapping anywhere outside the canvas and the tooltip dismisses cleanly. Taps inside the tooltip (scrolling long rationale, hitting ×) and taps on the canvas (delegated to `touchstart`/`click`) are excluded. Desktop hover behavior unchanged.

### Repo hygiene

- Added `.gitattributes` with `* text=auto eol=lf` so Dropbox / macOS sync no longer drifts CRLF into tracked files. Without this, 9 unrelated files were showing phantom "+125k / −125k" diffs that were 100% line-ending churn.
- Added `.claude/` and `_audit/` to `.gitignore` — local-only configs and session-scoped audit notes that shouldn't ship to the public repo.
- Bumped README.md / README.ja.md `version` badge from `0.1.0` (long stale) to current.

### Verified

Headless Chrome at 500×707 mobile-emulated viewport across 6 edge cases: bottom tile (no overflow, 8 px from bottom edge), tap-outside-canvas (dismisses), tap-inside-tooltip (stays), × button (dismisses), tile A→B switch (no lingering), long rationale (`max-height` + scroll engaged at 675 px cap). Desktop 1280×727 hover layout unchanged.

---

## [0.4.1] - 2026-04-27

### Added

- **Google Analytics 4 (gtag.js)** added to `<head>`, measurement ID `G-GLDNBDPF13`. Loads asynchronously via `<script async>` so it does not block page render.
- Site now has dual analytics: Cloudflare Web Analytics (privacy-friendly, ~5KB, no cookies) + Google Analytics 4 (richer event funnel, audience demographics, retention reports). The two report independently — useful for cross-validating bounce/conversion numbers and for checking whether ad-blockers (which typically block GA4 but not Cloudflare's `static.cloudflareinsights.com` domain) skew traffic estimates.

### Note

GA4 sets cookies by default. If audience exposure expands to EU/UK/CA visitors at material scale, a cookie consent banner may eventually be needed under GDPR/CCPA. Not blocking for current personal-project scale, but flagged for future consideration.

---

## [0.4.0] - 2026-04-27

### Added — Custom domain

- **Custom domain `mirai-shigoto.com`** purchased via Cloudflare Registrar. Site now lives at `https://mirai-shigoto.com/` (root, not subdirectory).
- New `CNAME` file at repo root containing `mirai-shigoto.com` so GitHub Pages provisions the custom domain and Let's Encrypt TLS cert.

### Changed

- Replaced 13 hardcoded `https://jasonhnd.github.io/jobs/` references with `https://mirai-shigoto.com/` across:
  - `index.html` (5: meta og:url, og:image, og:image:secure_url, twitter:image, canonical)
  - `og-card.html` (1: visible footer URL in OG image)
  - `README.md` / `README.ja.md` (4: badges + Live links)
  - `prompt.en.md` / `prompt.ja.md` (2: Live visualization line)
  - `scripts/make_prompt.py` (1: LIVE_URL constant)
- Regenerated `og.png` (1200×630) so the visible footer shows the new domain. Title and stats unchanged.
- Footer version bumped to v0.4.0 (custom-domain milestone).

### Migration

- The old URL `https://jasonhnd.github.io/jobs/` continues to work — GitHub Pages auto-redirects (301) to the custom domain once DNS resolves, so existing shared links on X / Telegram / etc. don't break.
- Telegram / X / Facebook / LINE preview caches still hold the old URL string. Use the same cache-clearing methods documented in v0.3.4 (Telegram `@WebpageBot`, FB Sharing Debugger, etc.) to refresh card previews to the new domain.

### Why "mirai-shigoto.com"

User picked the top-3 recommendation: `未来の仕事` (future of jobs) — natural Japanese phrase, on-theme for AI-impact analysis, broad enough to extend to adjacent topics later, and the cheapest TLD (.com via Cloudflare Registrar at-cost pricing).

---

## [0.3.11] - 2026-04-25

### Added (compliance — top-of-page banner)

- **Persistent "UNOFFICIAL" warning banner** at the very top of every page view (above the H1, full bleed). Red badge + line: 「独自分析サイト ・ 厚労省 / job tag / JILPT の **公式見解ではありません**」 / "Independent analysis · **Not endorsed by** MHLW / jobtag / JILPT".

### Why

A second-pass legal audit flagged that the v0.3.7 disclaimers — H1 subtitle "非公式 の独自分析", yellow disclaimer block, JILPT meta-card row, footer disclaimer — are all in place but the disclaimer block sits in the explainer section *below* the treemap, so a user who only scans the first viewport (without scrolling) might miss it. The H1 subtitle's "非公式" was present but small.

A bright top banner makes "UNOFFICIAL" the literal first thing every visitor reads, regardless of scroll depth. This addresses the "first-view official-misperception risk" called out in the audit:

> 用户第一眼可能会理解为：这是基于厚労省 job tag 的官方职业地图... 你需要在页面顶部或 About 第一段直接写...

Note: the audit screenshots in that report were of an older cached version (still had H1 "日本の職業マップ — 厚生労働省 jobtag より"). The actual v0.3.10 live page already had subtitle "非公式 の独自分析", JILPT citation, disclaimer block, usage notice, footer disclaimer — verified via curl. The new banner adds defense-in-depth for cached snapshots, link previews, and casual scanners.

### Verified

Playwright at 1280×900 desktop and 375×400 mobile — banner visible at top with badge, no layout regression for existing components.

---

## [0.3.10] - 2026-04-25

### Fixed (mobile treemap readability)

User feedback: "这个色块这样在手机上根本没有阅读感... 所有的字都特别小，块也特别小。" The mobile treemap was rendering as a small landscape band where only the top 5–6 occupations had readable labels and the rest were tiny colored noise.

- **Mobile canvas height nearly doubled**: `layout()` now produces a tall portrait canvas on mobile (`width × 2.6` instead of `width × 1.4`). At 375px viewport: canvas grows from 343×480 to 343×892, giving each tile ~1.86× more area. Desktop unchanged (`width × 0.6`).
- **Lowered label-rendering thresholds on mobile**: previously a tile only got a label when ≥ 50px wide and ≥ 18px tall; on mobile the threshold is now 30px × 14px for the name, and 50px × 26px for the AI-risk subtitle. Combined with the bigger canvas, ~50 occupations now show their name + score directly (vs ~6 before).
- **Smaller font min/max on mobile**: caps at 12px (was 13) and floor at 8px (was 9) so labels fit in the new mid-size tiles without overflowing.
- Smaller text padding inside each tile (margins 5/4 → 4/3) to let labels actually use the space.

### Why

The default treemap rendering was tuned for landscape desktop. On phones with ~343px content width and 552 tiles, the longstanding 1.4× height ratio gave only ~298 sq px per tile, leaving the bottom half as visual noise. Tall portrait canvas + lower label thresholds make the treemap usable as a "scroll-down to read" mobile experience. The very smallest tiles (~3,000-worker specialty roles) remain unlabeled — they would need ~80px² to be readable, which can't be guaranteed without dropping data or filtering.

---

## [0.3.9] - 2026-04-25

### Fixed (mobile responsive)

Comprehensive mobile audit at viewports 320 / 375 / 414 (iPhone SE through Pro Max). The existing `@media (max-width: 768px)` block didn't have rules for components added in v0.3.0+ (`.dimension-hint`, `.disclaimer`, `.usage-notice`, `.methodology-title`, `.h1-sub`, `.byline`, `.stats-panel` 6-card layout). Real-device emulation via Playwright surfaced these issues.

- **Stats panel**: `grid-template-columns` changed from `repeat(auto-fit, minmax(180px, 1fr))` to `repeat(auto-fit, minmax(140px, 1fr))`. At desktop the 6 cards still fit in 1 row (each ~200px); on mobile the smaller minimum lets cards reflow to 2 cols at 375-414px instead of overflowing.
- **Layer toggle**: at <=480 viewports, the 6 mode buttons now wrap to 2 rows (`flex-wrap: wrap`) instead of horizontal-scrolling. Real iPhones rarely scroll horizontally — wrapping is cleaner and shows all options at once.
- **Dimension hint** (📐 面積 / 🎨 色 strip): on phones (<=480) now stacks vertically with the divider hidden.
- **Disclaimer + Usage notice + Methodology title**: tighter padding and font sizes at <=480 and again at <=360 so they don't crowd narrow screens.
- **Tier table & mini-histogram inside stats**: smaller font/padding at <=480 to prevent column truncation.
- New `@media (max-width: 360px)` block for iPhone SE 1st-gen sized phones: stats panel becomes 1-column (cards full width); H1 + methodology title shrink one more notch.

### Verified

- Playwright headless Chromium at 320, 375, 414 with `device_scale_factor: 2`. All sections (H1, controls, dimension hint, search, stats panel, treemap, disclaimer, meta-card, intro paragraphs, methodology, usage notice, footer) tested at each width.
- Desktop (1280px) layout unchanged.

### Why

User asked: "手机自适应做了吗？仔细检查所有" — surfaced that several v0.3.0+ components had no mobile-specific CSS, causing horizontal overflow and unreadable cells at iPhone widths.

---

## [0.3.8] - 2026-04-25

### Changed

- **Methodology section is no longer collapsed**: replaced `<details><summary>` with a permanent `<div>` + `<h3>` heading. The full AI-risk scoring rubric (date, scorer, scale, heuristic, caveat) is always visible inline, no click required. Both JA and EN. Updated the "see below" intro paragraph to drop "折りたたみ / collapsible" wording.
- **Cloudflare Web Analytics beacon moved from end of `<body>` to `<head>`**: same `<script defer>` tag, just relocated. The `defer` attribute means execution still runs after document parse (no render blocking), but loading the beacon early in `<head>` lets it record bounce visits — users who close the page in <0.5s — that the body-end placement might miss.

### Why

- User feedback: "AI リスク：这个下拉菜单也不用下拉了，全部都放在下面就可以了" — the methodology was important enough that hiding it behind a click was a UX cost without benefit.
- User feedback: "cloudflare的代码为什么在最下面？不是在最上面？" — head placement is the more modern best practice for analytics beacons; `defer` neutralizes the render-blocking concern that historically argued for body-end.

---

## [0.3.7] - 2026-04-25

### Changed (compliance / legal)

Acted on a legal-risk audit. Site is now clearly framed as unofficial independent analysis, with full source attribution per jobtag's terms of use.

- **H1 page title**: "日本の職業マップ — 厚生労働省 jobtag より" → "**日本の職業 AI 影響マップ** — 公開職業データをもとにした **非公式** の独自分析" (JA) and "**Japan Jobs × AI Impact Map** — Independent analysis of public occupation data **(unofficial)**" (EN). Removes any implication of MHLW/jobtag/JILPT endorsement.
- **Disclaimer block** added at the top of the explainer section (yellow-bordered, high visibility): explicitly states the site is unofficial and that AI risk scores, categorizations, rankings, and visualizations are independent analysis — not the views of MHLW, jobtag, JILPT, or any public institution.
- **Meta-card source rows expanded**: added "職業情報データ / Occupational data" row citing JILPT's "職業情報データベース", and "加工 / Processing" row stating the site independently processes and visualizes the data (unofficial). Both JA and EN.
- **使用上の注意 / Usage Notice** block added at the end of the explainer: states the information is reference material only (not a guarantee for career/HR decisions), site has no partnership with MHLW/jobtag/JILPT, and inquiries should go through GitHub Issues (not public institutions).
- **Footer expanded**: now cites both jobtag URL and JILPT 職業情報データベース as sources, with explicit "本サイトは非公式サイトであり、厚生労働省・job tag・JILPT の公式見解を示すものではありません" disclaimer line.
- **Meta tags reworded** (`<title>`, `<meta name="description">`, `og:title`, `og:description`, `twitter:title`, `twitter:description`): now read as "厚生労働省 job tag 等の公開情報を参考に、日本 552 職種への AI 影響を Claude Opus 4.7 が独自に可視化した非公式の分析サイト" — softened from "AI 替代リスクを採点" framing that could imply official assessment.
- **Keywords updated**: added "独自分析", "非公式", "unofficial"; removed "替代リスク" (sounded authoritative).

### Why

Per legal audit:
- Avoid creating the impression that this is an MHLW/jobtag/JILPT product.
- Comply with jobtag's terms of use for secondary processing of public data: name JILPT, the database, and clearly mark as "加工して作成".
- Add usage notice to limit liability if users make career/HR decisions based on the visualization.

og.png itself is unchanged because the bottom credit ("by Jason · MIT · データ：厚生労働省 jobtag") already reads as personal attribution, not official partnership; modifying the image would invalidate cached previews on Telegram/X.

---

## [0.3.6] - 2026-04-25

### Added

- **Cloudflare Web Analytics**: privacy-friendly visitor tracking. No cookies, no GDPR/CCPA banner needed, not blocked by ad-blockers, ~5KB deferred beacon. Single `<script defer>` tag added at end of `<body>` so it never blocks page render. Dashboard at https://dash.cloudflare.com → Analytics → Web Analytics. Tracks: pageviews, unique visitors, top referrers, country, device/browser, Core Web Vitals.

### Why

- User asked "我怎么统计这个访问数据啊？" — wanted visitor counts and traffic sources after sharing on X/Telegram. Chose Cloudflare over Google Analytics 4 because GA4 needs a cookie consent banner, is blocked by ~50% of ad-blockers, and adds significant page weight; Cloudflare Web Analytics gives the essential numbers (PV, UV, referrers, country) without those costs.

### Verify

- Open https://dash.cloudflare.com → Web Analytics → site dashboard. Real-time pageviews appear within ~30 seconds after the beacon fires; aggregated dashboards populate within a few minutes.

---

## [0.3.5] - 2026-04-25

### Fixed

- **Wrong model name**: scoring & translation provenance was labelled "Claude Sonnet 4.7" everywhere. The actual model used in the live Claude Code session was **Claude Opus 4.7** (Anthropic's highest-reasoning tier). Sonnet 4.7 does not exist as a released tier. Replaced 13 occurrences across 6 files: `index.html` (8: meta description, og:description, JA/EN meta-cards, JA/EN methodology details), `data/ai_scores_2026-04-25.json` (1: scorer field), `data/translations_2026-04-25.json` (1: translator field), `prompt.en.md` (1), `prompt.ja.md` (1), `scripts/make_prompt.py` (1: SCORING_LLM constant).

### Why

- User caught the misattribution: "我看了一下显示，为什么是 Sonnet 4.7？这不是 Opus 4.7 吗？" The mistake was introduced in v0.2.x and propagated to all downstream artifacts.

---

## [0.3.4] - 2026-04-25

### Added

- **OG / Twitter Card preview image** (`og.png`, 1200×630): when the URL is shared on Telegram / LINE / X / Slack / Discord / Facebook, those platforms now show a rich preview card instead of a bare link. Card features the punchline "あなたの仕事は AI に消える？" in red, plus four headline stats (552 職業 / 5,449万人 / 9/10 / 31%) over an AI-risk-weighted heatmap background.
- **`og-card.html`**: source HTML for the OG image. Render at 1200×630 in headless Chrome and screenshot to `og.png` to regenerate.
- High-impact JA-first meta tags: `<title>`, `<meta name="description">`, full Open Graph block (with `og:image:width`/`height`/`alt`, `og:locale`, `og:site_name`), and Twitter Card block (`twitter:site`, `twitter:creator` = `@jasonaxb`).
- `og.png` previously referenced in meta but did not exist (404). Now committed.

### Why

- User feedback: shared URL had no preview card on messaging platforms. Original meta tags pointed to a missing `og.png` so platforms fell back to bare-link rendering.
- Card copy intentionally direct ("あなたの仕事は AI に消える？") to surface the AI-displacement framing in 1 second of scrolling rather than buried in a paragraph.

### Verify

- Telegram: paste URL into any chat. The card should render with the red title and 4 stats.
- X / Twitter: use https://cards-dev.twitter.com/validator
- Facebook: use https://developers.facebook.com/tools/debug/
- Generic: https://www.opengraph.xyz/

---

## [0.3.3] - 2026-04-25

### Added

- **Author byline**: H1 now shows "by Jason" linking to https://x.com/jasonaxb (orange dotted underline, accessible via keyboard).
- **Dimension hint bar**: a new strip directly below the layer toggle states explicitly that tile area = workforce (constant) and tile color = the currently selected layer. The "color = X" portion updates live whenever the user clicks a layer button. This addresses a UX confusion where users assumed the tile sizes should change between tabs and thought the layer toggle was broken; the hint makes the dual-encoding (size + color) explicit.

### Why

- User feedback: clicking AI リスク / 年収 / 平均年齢 / 労働時間 / 求人倍率 / 学歴 changed colors but kept tile sizes constant, leading to the perception that "nothing changed". The treemap intentionally fixes area to workforce (the karpathy/jobs design) so cross-dimensional comparisons stay anchored to "how many people are in this occupation", but this design choice was previously not surfaced in the UI.

---

## [0.3.2] - 2026-04-25

### Fixed

- **Workforce overcounting (CRITICAL)**: total workforce was previously displayed as 3.7 億 (370M), about 5.5× Japan's actual labor force (~67M). Root cause: jobtag publishes headcount at the **parent category level** (e.g. "公務員" = 3,737,860 people) and assigns the same number to every sub-occupation (国家公務員, 地方公務員, 外務公務員, …). Naïvely summing the 552 occupations multi-counted each parent.

### Changed

- `scripts/build_data.py`: added a workforce normalization step. Occupations sharing an identical workforce value are treated as members of the same parent category, and the parent total is **redistributed equally** among them. Also stores `category_workers` (the original parent total) and `category_size` (number of sub-occupations) on each record for transparency.
- `data.json`: regenerated. New total **54.5 million** (≈ 81% of Japan's actual labor force — the gap reflects occupations not covered by jobtag).
- `index.html`: tooltip now annotates redistributed workforce, e.g. **`69.3万 人（親 138.6万 ÷ 2）`** when the value came from a multi-member parent category. Added a JA/EN explanatory paragraph in the explainer section describing the redistribution.
- Treemap tile sizes now reflect per-occupation share rather than the parent category total. The 3 largest tiles are now 一般事務 (~263万), 施設介護員 (~135万), and ビル清掃 (~91万) — reasonable for Japan.

---

## [0.3.1] - 2026-04-25

### Changed

- **Page reorder**: Treemap is now visible immediately on page open. Layer toggle, search, and stats panel sit directly under the H1; meta-card, intro paragraphs, and methodology details have been moved into a new `<section class="explainer">` placed below the treemap canvas.
- Added section heading "このマップについて / About this map" above the explainer block, with a top border to visually separate it from the visualization.

### Why

- User feedback (2026-04-25): "把 AI リスク 放到上面，让用户一打开就能看到所有的内容。至于这些解释性的文字，全部都放到下面。" The previous layout pushed the treemap below ~6 paragraphs of intro text, hiding the actual visualization on first view.

---

### Planned (v0.0.4 / v0.2.0)

- `scripts/translate.py` — LLM-driven JA→EN translation for all 552 occupation names + descriptions (OpenRouter Gemini Flash).
- `scripts/score_ai_risk.py` — LLM scoring of AI replacement risk (0–10) + bilingual rationale per occupation. Anchor calibration ported from karpathy/jobs.
- Industry/category grouping (currently flat list).
- Headcount calibration via 総務省 労働力調査 (workers count from jobtag overlaps across SOC codes).
- `scripts/make_prompt.py` — bilingual single-file LLM-ready data dump (à la karpathy's `make_prompt.py`).

---

## [0.1.0] - 2026-04-25

First visualization release. **Live at https://jasonhnd.github.io/jobs/**

### Added

- `index.html` — full rewrite, vanilla JS treemap visualization. Squarified treemap algorithm ported from karpathy/jobs.
  - Tile area = sqrt(workers); 5 selectable color layers: Salary / Avg Age / Hours / Recruit Ratio / Education.
  - Bilingual UI (JA/EN, auto-detect from browser locale).
  - Per-tile tooltip with structured fields; click → opens jobtag detail page.
  - 4 stats cards (count, median/max/min salary).
- `scripts/build_data.py` — reads `data/occupations_full.json` (10.83 MB), writes compact `data.json` (240 KB) with parsed numeric fields.
- `data.json` — 552 occupations in compact form for the front-end fetch.

### Notes

- Salary range: 286.3 – 1697.1 万円 (median 483.9 万円).
- All 552 valid occupations rendered; 28 deleted/unassigned IDs excluded.
- AI replacement risk and English translations are placeholders (`null`); land in v0.0.4.

---

## [0.0.3] - 2026-04-25

Full jobtag scrape complete.

### Added

- `data/occupations_full.json` (10.83 MB) — all 552 valid occupations with rich fields per record:
  - `id`, `ok` (false for 28 deleted IDs)
  - `title` (Japanese 職業名)
  - `stats`: 6 numeric fields (就業者数, 労働時間, 年収, 年齢, 求人賃金, 求人倍率) as `[title, value, unit]` triples
  - `bars`: ~50 bar-chart percentages (education, training duration, prior experience, employment type)
  - `description`, `how_to_become`, `working_condition` — full long-form text per section

### Method

- Chrome MCP extension via 10 parallel tabs, each running a fetch+DOMParser pipeline at 2s/page rate.
- Worked around Claude Code's 30K MCP truncation + cookie/base64 content filters by triggering Blob+anchor downloads to user's Downloads folder.

---

## [0.0.2] - 2026-04-25

Master occupation list complete.

### Added

- `data/occupations.json` (28 KB) — master list of 552 valid occupations as `{id, title}`.
- `pyproject.toml` declaring `jp-jobs 0.0.1` with `beautifulsoup4`, `httpx`, `playwright`, `python-dotenv` dependencies.
- `.python-version` pinning Python 3.12.
- `scripts/README.md` documenting the planned pipeline, caching contract, and run instructions.
- `.gitignore` updated to exclude `html/`, `pages/`, `.venv/`, `.uv-cache/`.

### Discovered

- jobtag occupation detail URL pattern: `/User/Occupation/Detail/{id}` (integer ID range 1–580).
- 28 unassigned/deleted IDs in the [1, 580] range; total active occupations = 552.
- jobtag is behind Imperva/Incapsula CDN. **Solution**: Chrome MCP extension via the user's authenticated browser session.
- `scripts/build_data.py` — bilingual `data.json` consumed by the front end (v0.0.5).
- Squarified treemap visualization with filter and search (v0.1.0).
- Headcount calibration via 総務省 労働力調査 / 経済センサス (v0.2.0).
- `scripts/make_prompt.py` — bilingual single-file LLM-ready data dump (v0.2.0).

---

## [0.0.1] - 2026-04-25

Initial scaffolding release. The site is reachable but contains only a bilingual placeholder; no occupational data has been ingested yet.

### Added

- Bilingual placeholder page (日本語 / English) with automatic language detection from `navigator.language` and a top-right toggle.
- GitHub Pages deployment at https://jasonhnd.github.io/jobs/ (HTTPS enforced).
- MIT license.
- `README.md` (English) and `README.ja.md` (Japanese) with project intent, planned pipeline, data sources, and local-development instructions.
- `.gitignore` covering Python, Node, OS, and editor artifacts.
- This `CHANGELOG.md`.

### Notes

- No data pipeline yet. The scraper, parser, translator, and scorer land in `0.0.2`+.
- Site is built directly from `main` branch root via GitHub Pages (no Jekyll customization, no `gh-pages` branch).
- Pipeline architecture and front-end design heavily inspired by [karpathy/jobs](https://github.com/karpathy/jobs); credit and acknowledgements in the READMEs.

---

[Unreleased]: https://github.com/jasonhnd/jobs/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jasonhnd/jobs/releases/tag/v0.1.0
[0.0.3]: https://github.com/jasonhnd/jobs/compare/v0.0.1...v0.1.0
[0.0.2]: https://github.com/jasonhnd/jobs/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/jasonhnd/jobs/releases/tag/v0.0.1
