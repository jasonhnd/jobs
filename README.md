# Japan Jobs × AI Risk

[![Live Site](https://img.shields.io/badge/live-jasonhnd.github.io%2Fjobs-ffb84d)](https://mirai-shigoto.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.4.2-blue.svg)](CHANGELOG.md)
[![Pages](https://img.shields.io/github/deployments/jasonhnd/jobs/github-pages?label=pages)](https://github.com/jasonhnd/jobs/deployments)

> **🇯🇵 [日本語版 README はこちら](README.ja.md)**

A bilingual visualization of roughly **500 Japanese occupations** sourced from the Ministry of Health, Labour and Welfare's official 職業情報提供サイト (jobtag), overlaid with an **LLM-scored AI replacement risk** for each occupation.

Same dataset, two faces: 日本語 for the domestic audience, English for the international one. One toggle in the top right.

🔗 **Live:** https://mirai-shigoto.com/

---

## Status

`v0.1.0` — **first visualization release**. **552 Japanese occupations** scraped from MHLW jobtag are live in a squarified treemap with 5 selectable color layers (Salary / Avg Age / Hours / Recruit Ratio / Education). Bilingual UI (JA/EN, auto-detect), per-tile tooltips, click-through to jobtag detail pages. AI replacement risk and English translations remain `null` placeholders, landing in `v0.0.4`.

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

The pipeline is a Japan-localized mirror of [karpathy/jobs](https://github.com/karpathy/jobs)'s shape, with one extra translation step and bilingual outputs throughout.

| # | Script | What it does | Output |
| --- | --- | --- | --- |
| 1 | `scripts/list_occupations.py` | Parse the jobtag A–Z index into a master occupation list | `occupations.json` |
| 2 | `scripts/scrape_jobtag.py` | Polite, throttled fetch of every occupation page (httpx first, Playwright fallback) | `html/<slug>.html` |
| 3 | `scripts/parse.py` | BeautifulSoup → clean Markdown per occupation | `pages/<slug>.md` |
| 4 | `scripts/extract_fields.py` | Tabulate structured fields (年収, 学歴, 就業者数, 成長性) | `occupations.csv` |
| 5 | `scripts/translate.py` | LLM batch JA→EN for occupation, industry, descriptions | bilingual columns merged in place |
| 6 | `scripts/score_ai_risk.py` | LLM scoring (0–10) of AI replacement risk + rationale (JA + EN) | `scores.json` |
| 7 | `scripts/build_data.py` | Merge CSV + scores → single bilingual artifact | `data.json` |

Each step is incrementally cached: re-running skips work that already has output. Scoring uses OpenRouter (Gemini Flash by default), with the same 0–10 anchor calibration karpathy uses, ported to Japanese examples.

The front end (`index.html`) reads `data.json` and renders a squarified treemap with filters; `?lang=ja` / `?lang=en` controls the active language.

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

### v0.0.1 — Scaffolding ✅ (current)

Bilingual placeholder, GitHub Pages deployment, MIT license, READMEs, changelog.

### v0.0.2 — Scraper PoC

`scripts/list_occupations.py` (jobtag A–Z extractor) + `scripts/scrape_jobtag.py` (one occupation end-to-end as a smoke test).

### v0.0.3 — Full ingest

All ~500 jobtag pages cached locally + `scripts/parse.py` and `scripts/extract_fields.py` producing a clean CSV.

### v0.0.4 — Translation + scoring

`scripts/translate.py` (LLM batch JA→EN) and `scripts/score_ai_risk.py` (0–10 AI replacement scores). Anchors and rubric ported from [karpathy/jobs](https://github.com/karpathy/jobs/blob/main/score.py) with Japan-specific occupation examples.

### v0.0.5 — First `data.json`

`scripts/build_data.py` merges CSV + scores into a bilingual `data.json`. Visualization still placeholder.

### v0.1.0 — Visualization

Squarified treemap with industry × AI risk × salary axes, filter UI, search, occupation detail tooltip. `?lang=ja` / `?lang=en` URL switch.

### v0.2.0 — Polish

Headcount calibration via 総務省 統計局, performance pass, accessibility, shareable URLs, OG / Twitter Card metadata. Bilingual `prompt.md` artifact (à la karpathy's `make_prompt.py`).

### v1.0.0 — Stable

Public-ready. Methodology page, citations, data dump downloads.

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

When the pipeline lands you'll also need [uv](https://docs.astral.sh/uv/):

```bash
uv sync                              # install Python deps from pyproject.toml
uv run playwright install chromium   # one-time browser binary (jobtag is behind Imperva CDN)
```

Pipeline scripts live under `scripts/` — see [`scripts/README.md`](scripts/README.md) for the run sequence.

---

## Project structure

```text
jobs/
├── index.html             # bilingual front end (root, served by GitHub Pages)
├── data.json              # (v0.0.5+) compact bilingual data consumed by index.html
├── occupations.json       # (v0.0.2+) master occupation list from jobtag A–Z
├── occupations.csv        # (v0.0.3+) tabulated structured fields
├── scores.json            # (v0.0.4+) AI replacement scores + rationales
├── prompt.md              # (v0.2.0+) single-file LLM-ready data dump
├── scripts/               # (v0.0.2+) pipeline scripts
├── html/                  # (gitignored) raw scraped jobtag HTML
├── pages/                 # (gitignored) clean Markdown per occupation
├── README.md              # English (this file)
├── README.ja.md           # 日本語
├── CHANGELOG.md
├── LICENSE                # MIT
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
