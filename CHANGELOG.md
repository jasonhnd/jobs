# Changelog

mirai-shigoto.com — full per-release notes at <https://github.com/jasonhnd/jobs/releases>

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · pre-1.0 SemVer.

> Pre-0.6.0 detailed entries are preserved in [`docs/CHANGELOG-archive.md`](docs/CHANGELOG-archive.md).

---

## [Unreleased]

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
