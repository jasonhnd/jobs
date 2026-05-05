# Changelog

mirai-shigoto.com — full per-release notes at <https://github.com/jasonhnd/jobs/releases>

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · pre-1.0 SemVer.

> Pre-0.6.0 detailed entries are preserved in [`docs/CHANGELOG-archive.md`](docs/CHANGELOG-archive.md).

---

## [Unreleased]

### Convergence to single-URL responsive architecture

- **Direction C visual + voice converged to PC** (commits `7f8ce55` → `3da1729`):
  warm-cream palette, Noto Serif JP headings, italic terracotta accent,
  hero copy rewritten as emotional vision ("AIの時代でも、あなたらしい働き方を。"),
  CTA softened, theme toggle hidden (single theme).
- **Detail-page strict per-language separation** (`d33eda4`): each `/<lang>/<id>`
  page renders ONLY its language; no cross-language bleed in H1, breadcrumb,
  page title, JSON-LD.
- **OG card regenerated** in Direction C (`d33eda4` → `og.png`).
- **Lang-switch button uses relative href** (`351a9a2`): preview / staging
  domains stay within their environment instead of jumping to production.
- **Schema-1.1 rich data integrated into PC detail page** (`58349ee`):
  5-axis radar (340x340 desktop, 280x280 mobile), top-10 skills + top-5
  knowledge + top-5 abilities, transfer-paths career suggestions (replaces
  legacy "same risk-band 5"), sector chip + risk/workforce/demand bands,
  related orgs + certs, AI model + scored_at + IPD provenance footnote.
  JSON-LD enriched with alternateName / industry / occupationalCategory /
  skills / qualifications.
- **`/m/` pipeline removed**: 1127 mobile HTML files + mobile templates +
  mobile build scripts + mobile-only CSS deleted. `vercel.json` `/m/*`
  redirects removed. `MOBILE_DESIGN.md` archived (preserved as Direction C
  token reference). Single URL `/<lang>/<id>` now serves all viewports
  via CSS `@media` adaptation. No 301 redirects added — `/m/` was only
  one day live with no SEO assets to preserve.

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
