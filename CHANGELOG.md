# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned

- `scripts/scrape_jobtag.py` — scraper for 厚生労働省 jobtag (~500 occupations).
- `scripts/parse.py` — parse raw HTML into structured fields (年収, 学歴, 就業者数, 成長性).
- `scripts/translate.py` — LLM-driven JA→EN translation for occupation names, industries, descriptions.
- `scripts/score_ai_risk.py` — LLM scoring of AI replacement risk (0–10) per occupation.
- `scripts/build_site_data.py` — bilingual `data.json` consumed by the front end.
- Treemap visualization with filter and search.
- Headcount calibration via 総務省 労働力調査 / 経済センサス.

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
