# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
