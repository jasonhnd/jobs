# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added (toward v0.0.2)

- `pyproject.toml` declaring `jp-jobs 0.0.1` with `beautifulsoup4`, `httpx`, `playwright`, `python-dotenv` dependencies.
- `.python-version` pinning Python 3.12.
- `scripts/README.md` documenting the planned 7-step pipeline, caching contract, and run instructions.
- `.gitignore` updated to exclude `html/`, `pages/`, `.venv/`, `.uv-cache/`.

### Notes

- **jobtag is behind Imperva/Incapsula CDN.** Direct `httpx` / `curl` requests return JavaScript challenge pages (HTTP 200 with `/_Incapsula_Resource?...` iframe), not real HTML. `scrape_jobtag.py` must use Playwright + real Chromium, mirroring karpathy's BLS workaround. Tested 2026-04-25.

### Planned

- `scripts/list_occupations.py` — extract jobtag A–Z index into `occupations.json` (v0.0.2).
- `scripts/scrape_jobtag.py` — Playwright-based scraper for 厚生労働省 jobtag (~500 occupations) (v0.0.2).
- `scripts/parse.py` — BeautifulSoup → clean Markdown per occupation (v0.0.3).
- `scripts/extract_fields.py` — tabulate structured fields (年収, 学歴, 就業者数, 成長性) (v0.0.3).
- `scripts/translate.py` — LLM-driven JA→EN translation for occupation names, industries, descriptions (v0.0.4).
- `scripts/score_ai_risk.py` — LLM scoring of AI replacement risk (0–10) + bilingual rationale (v0.0.4).
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

[Unreleased]: https://github.com/jasonhnd/jobs/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/jasonhnd/jobs/releases/tag/v0.0.1
