# Japan Jobs × AI Risk

[![Live Site](https://img.shields.io/badge/live-jasonhnd.github.io%2Fjobs-ffb84d)](https://jasonhnd.github.io/jobs/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-lightgrey.svg)](CHANGELOG.md)
[![Pages](https://img.shields.io/github/deployments/jasonhnd/jobs/github-pages?label=pages)](https://github.com/jasonhnd/jobs/deployments)

> **🇯🇵 [日本語版 README はこちら](README.ja.md)**

A bilingual visualization of roughly **500 Japanese occupations** sourced from the Ministry of Health, Labour and Welfare's official 職業情報提供サイト (jobtag), overlaid with an **LLM-scored AI replacement risk** for each occupation.

Same dataset, two faces: 日本語 for the domestic audience, English for the international one. One toggle in the top right.

🔗 **Live:** https://jasonhnd.github.io/jobs/

---

## Status

`v0.1.0` — **scaffolding only**. The deployed page is a bilingual placeholder. No occupational data has been ingested yet. The scraper, parser, translator, and scorer all land in `0.2.0`+.

See the [CHANGELOG](CHANGELOG.md) for what's shipped and the [Roadmap](#roadmap) below for what's next.

---

## Why this exists

Andrej Karpathy's [karpathy/jobs](https://github.com/karpathy/jobs) explored the U.S. Bureau of Labor Statistics' Occupational Outlook Handbook (342 occupations) with LLM-scored AI exposure. There's a popular Chinese fork ([madeye/jobs](https://github.com/madeye/jobs)) but it relies on AI-synthesized occupation lists rather than government statistics, so the numbers don't ground out anywhere.

Japan has its own equivalent of the BLS OOH: **厚生労働省 jobtag** (約 500 職業), which ships structured fields for salary, education, headcount, and growth outlook. That's the foundation here.

The result is a clean, government-grounded counterpart to karpathy/jobs — for Japan, in two languages.

---

## Data sources

| Source | Purpose | URL |
| --- | --- | --- |
| 厚生労働省 職業情報提供サイト (job tag) | Primary occupational data: name, salary, education, headcount, growth outlook | https://shigoto.mhlw.go.jp/User/ |
| 総務省 労働力調査 (Labour Force Survey) | Headcount calibration & industry breakdown | https://www.stat.go.jp/data/roudou/ |
| 総務省 経済センサス (Economic Census) | Establishment-level industry distribution | https://www.stat.go.jp/data/e-census/ |

All sources are public Japanese government statistics. AI replacement scores are produced separately by an LLM and clearly labeled as model output rather than survey data.

---

## Methodology

A 5-step pipeline turns jobtag pages into the visualization on the site.

| # | Script | What it does | Output |
| --- | --- | --- | --- |
| 1 | `scripts/scrape_jobtag.py` | Polite, throttled fetch of every occupation page | `raw/*.html` |
| 2 | `scripts/parse.py` | Extract structured fields from raw HTML | `data/jobs.csv` |
| 3 | `scripts/translate.py` | LLM batch JA→EN translation for occupation/industry/description | bilingual columns added in place |
| 4 | `scripts/score_ai_risk.py` | LLM scoring (0–10) of AI replacement risk per occupation | `data/scores.csv` |
| 5 | `scripts/build_site_data.py` | Merge + emit a single bilingual artifact | `data.json` |

The front end (`index.html`) reads `data.json` and renders a treemap with filters; `?lang=ja` / `?lang=en` controls the active language.

### Planned `data.json` schema

```jsonc
{
  "version": "0.x.0",
  "generated_at": "YYYY-MM-DD",
  "occupations": [
    {
      "id": "string",
      "name": { "ja": "...", "en": "..." },
      "industry": { "ja": "...", "en": "..." },
      "description": { "ja": "...", "en": "..." },
      "salary_median_jpy": 0,
      "headcount": 0,
      "education_level": "高卒|専門|短大|大卒|院卒",
      "growth_outlook": "increasing|stable|declining",
      "ai_risk_score": 0.0,
      "ai_risk_rationale": { "ja": "...", "en": "..." },
      "source_url": "https://..."
    }
  ]
}
```

Fields and field names will be locked in `0.2.0` when the parser lands. Subject to refinement until then.

---

## Roadmap

### v0.1.0 — Scaffolding ✅ (current)

Bilingual placeholder, GitHub Pages deployment, license, READMEs, changelog.

### v0.2.0 — Pipeline

Scraper, parser, translation, scoring. Output: `data.json` for ~50 occupations as a smoke test.

### v0.3.0 — Visualization

Treemap with industry × AI risk × salary axes, filter UI, search, occupation detail drawer.

### v0.4.0 — Full dataset

All ~500 jobtag occupations, calibrated against 総務省 統計局 figures.

### v0.5.0 — Polish

Performance pass, accessibility, sharable URLs (`?lang=ja&filter=high-risk`), social-card metadata.

### v1.0.0 — Stable

Ready to share publicly. Citations, methodology page, data dump downloads.

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

---

## Local development

The site is currently a single static `index.html`, so any static server works:

```bash
git clone https://github.com/jasonhnd/jobs.git
cd jobs
python -m http.server 8000
# open http://localhost:8000/
```

When the pipeline lands you'll also need:

```bash
# Python 3.11+ recommended
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt   # to be added in v0.2.0
```

---

## Project structure

```text
jobs/
├── index.html           # bilingual front end
├── data.json            # (generated by pipeline, v0.2.0+)
├── scripts/             # (v0.2.0+) scraper, parser, scorer
├── raw/                 # (gitignored) raw scraped HTML
├── data/                # (v0.2.0+) intermediate CSVs
├── README.md            # English (this file)
├── README.ja.md         # 日本語
├── CHANGELOG.md
├── LICENSE              # MIT
└── .gitignore
```

---

## Contributing

The project is in early scaffolding. Once `v0.2.0` lands, contributions welcome via PR. For now:

- Issues for ideas, data-source suggestions, methodology questions are open.
- Translation refinements (especially Japanese terminology around 学歴 categories and 業種 boundaries) will be tracked under the `translation` label once the pipeline produces draft EN text.

---

## License

[MIT](LICENSE) © 2026 jasonhnd

---

## Acknowledgements

- [karpathy/jobs](https://github.com/karpathy/jobs) for the original BLS OOH × LLM scoring approach.
- 厚生労働省, 総務省 統計局 for publishing structured occupational data.
