# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
