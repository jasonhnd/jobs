# Japan Jobs × AI Risk

[![Live Site](https://img.shields.io/badge/live-mirai--shigoto.com-ffb84d)](https://mirai-shigoto.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Hosting: Vercel](https://img.shields.io/badge/hosting-Vercel%20(hnd1)-000)](https://vercel.com)

> **🇯🇵 [日本語版 README はこちら](README.ja.md)**

![Japan Jobs × AI Risk — treemap of 552 occupations from Japan's MHLW jobtag, overlaid with LLM-scored AI replacement risk](og.png)

A visualization of **552 Japanese occupations** sourced from the Ministry of Health, Labour and Welfare's official 職業情報提供サイト (jobtag), each overlaid with an **LLM-scored AI replacement risk** (0–10) plus per-occupation rationale. The site UI is in Japanese, targeting the domestic audience.

🔗 **Live:** **<https://mirai-shigoto.com/>**

---

## What this is

A single squarified treemap that lets you see — at a glance — which Japanese occupations are most exposed to AI replacement, weighted by how many people actually work in each one.

The dataset is grounded in published Japanese government statistics (jobtag, 労働力調査, 経済センサス). The risk overlay is produced separately by an LLM and clearly labeled as model output, not a survey result. The site is in Japanese, targeting the domestic audience.

This project is **not affiliated with** 厚生労働省, the Japan Institute for Labour Policy and Training (JILPT), or any government body. It is independent analysis.

---

## What you'll see

When you land on [mirai-shigoto.com](https://mirai-shigoto.com/) you get:

- **A treemap of 552 occupations**, sized by headcount and colored by AI replacement risk (default). Big tile = lots of people in that occupation. Red tile = high AI exposure. Green tile = low AI exposure.
- **Six color layers**, switchable from the toolbar: AI Risk, Annual Salary, Average Age, Working Hours, Recruit Ratio (有効求人倍率), Education Level. Tile size never changes — only what the color encodes does.
- **Colorblind-safe palette** (viridis) toggle.
- **Direction C warm editorial theme** — warm-cream palette, Noto Serif JP headings, terracotta accents. `prefers-color-scheme` detection is built-in; the manual light/dark toggle is currently hidden.
- **Live search** by occupation name.
- **Hover (desktop) or tap (mobile)** any tile for a tooltip with risk score, salary, headcount, and the LLM's rationale.
- **556 dedicated detail pages** at `/ja/<id>.html` (552 + 4 newer occupations like 声優 / ブロックチェーン・エンジニア / 産業医 / 3D プリンター技術者) — each with full risk reasoning, 5-axis profile radar, breakdown by salary / age / hours / recruit ratio / education, transfer-path recommendations, structured `Occupation` JSON-LD for search engines.
- **17 sector hub pages** at `/ja/sectors/` — an index of all 16 industry sectors, each linking to a dedicated hub aggregating TOP 5 high/low AI-impact occupations, TOP 5 by workforce, and a full sorted list.
- **Dedicated pages** for About (`/about`), Compliance (`/compliance`), Privacy (`/privacy`), and a custom 404.
- **Social share buttons** — X, LINE, Hatena Bookmark, LinkedIn, Copy Link, native Web Share API on mobile.
- **A no-cookie analytics layer** alongside Google Analytics, so the site works whether or not you allow cookies.

The site is designed to be readable on a 360 px phone and on a 4K desktop with the same content density.

---

## Why this exists

In 2024 Andrej Karpathy published [karpathy/jobs](https://github.com/karpathy/jobs) — a treemap of the 342 occupations in the U.S. Bureau of Labor Statistics' Occupational Outlook Handbook, each scored 0–10 for AI exposure by an LLM. It was a clean, government-grounded artifact: real BLS occupations, real BLS workforce numbers, with model-generated risk as the only synthetic layer on top.

A popular Chinese fork ([madeye/jobs](https://github.com/madeye/jobs)) adapted the format but changed the foundation — the occupation list itself was AI-synthesized rather than government-published. That breaks the chain of provenance: the numbers no longer ground out anywhere checkable.

Japan has its own equivalent of the BLS OOH: **厚生労働省 職業情報提供サイト (job tag)**, covering ~500 職業 with structured fields for salary, education, headcount, and growth outlook. That dataset has existed for years, and **no one had built the Karpathy treatment for it** — government-grounded, with LLM-scored AI exposure.

This project is that missing artifact. Karpathy's idea, ported to Japan.

---

## How AI replacement risk is scored

This is the most important — and most contestable — part of the project, so it gets the most space.

### The 0–10 scale

Each occupation gets a single integer **AI replacement risk score from 0 (negligible exposure) to 10 (substantial near-term exposure)**. The score answers: *"How much of this occupation's day-to-day work could a current frontier LLM (with tools, agents, and reasonable integration) plausibly do, today, if deployed in a typical Japanese workplace?"*

Anchors at the extremes:

- **0–2 (low)** — physical, embodied, or trust-bearing work where automation is hard or socially unacceptable: nurses, caregivers, electricians, divers, kindergarten teachers.
- **3–4 (low-mid)** — supervisory, hands-on, or relationship-heavy roles where AI assists but doesn't replace: chefs, mechanics, school teachers.
- **5–6 (mid)** — knowledge work where AI handles meaningful portions but humans still drive: salespeople, HR, mid-level designers, paralegals.
- **7–8 (high)** — text- and analysis-heavy office work where AI can already do most of the cognitive load: clerks, accountants, translators, junior copywriters.
- **9–10 (highest)** — pure information-processing roles dominated by structured-text in / structured-text out: general clerks, data entry, basic banking window work, simple-template editorial.

These anchors are **ported from Karpathy's published rubric**, with Japan-specific worked examples substituted in. The intent is for a Japanese reader to see the same 0–10 scale Karpathy uses on US occupations, with familiar Japanese job titles at each anchor.

### How a score is produced

Scoring runs as a Claude Code session driven by `scripts/make_prompt.py` (which builds the prompt bundle from current source data). For each occupation:

1. **Input bundle** — occupation name (JA + EN), industry, jobtag's 仕事内容 description, structured fields (salary, headcount, education distribution, growth outlook).
2. **Prompt** — the calibration anchors above, plus the input bundle, plus a structured output instruction (JSON: `score: int`, `rationale_ja: str`, `rationale_en: str`).
3. **Model** — [OpenRouter](https://openrouter.ai) with Gemini Flash by default. Configurable; a swap to Claude Sonnet or GPT-4o is one config line.
4. **Output** — the model's score + rationale, cached per-occupation. Re-running skips occupations that already have a stored result.
5. **Aggregation** — `scripts/build_data.py` joins IPD source data + AI scores + translations + stats into 9 projection families under `dist/` (treemap, detail, search, labels — see [docs/DATA_ARCHITECTURE.md](docs/DATA_ARCHITECTURE.md)). The front end reads `dist/data.treemap.json`.

Each rationale is one to three sentences explaining *why* the score landed where it did — what parts of the work the LLM thinks it can already do, what parts it can't.

### Limits — what this score is and isn't

Treat the score as **the current frontier LLM's structured opinion about the occupation**, not as ground truth. Specifically:

- **It is model output, not survey data.** Workforce headcounts and salary numbers are real statistics. The risk score is generated text, lightly structured.
- **It is sensitive to prompt phrasing.** A different rubric, different anchors, or even different word choice in the worked examples can shift scores by 1–2 points across the dataset. The published anchors and prompt are stable, but they are one possible calibration, not the only one.
- **It reflects "current LLM consensus" — and that consensus drifts.** Re-scoring with a newer model can move scores. Older models were systematically more pessimistic about creative work; newer ones are more pessimistic about office work. The score is a snapshot.
- **Japanese and English rationales can diverge.** The JA and EN rationales are produced in the same call from the same context, but the model occasionally emphasizes different aspects in each language. The EN rationales are retained in the source data but are no longer displayed on the site (EN UI was retired in v1.4.0).
- **No claim of validity beyond face validity.** There is no follow-up survey of practitioners, no comparison against actual displacement rates, no confidence interval. A future stable release will add cross-LLM consistency checks; this one does not.

The dashboard exists to make a published academic exercise concrete and clickable for a Japanese audience — not to predict anyone's specific job.

---

## Data sources

| Source | Role | URL |
| --- | --- | --- |
| 厚生労働省 職業情報提供サイト (job tag) | Primary occupational data — name, salary, education distribution, headcount, growth outlook, 仕事内容 description | <https://shigoto.mhlw.go.jp/User/> |
| 総務省 労働力調査 (Labour Force Survey) | Headcount calibration & cross-industry validation | <https://www.stat.go.jp/data/roudou/> |
| 総務省 経済センサス (Economic Census) | Establishment-level industry distribution | <https://www.stat.go.jp/data/e-census/> |

All three are public Japanese government statistics. The site does not republish raw rows from any of them — it only consumes structured fields per occupation and presents the same fields with a model-generated score on top.

---

## Pipeline

The build pipeline is a Japan-localized port of [karpathy/jobs](https://github.com/karpathy/jobs)'s shape, with JA-focused outputs.

| # | Script | What it does | Output |
| --- | --- | --- | --- |
| 1 | `scripts/import_ipd.py` | Ingest JILPT IPD v7.00 xlsx (downloaded from job tag) into per-occupation source JSON | `data/occupations/<padded>.json` × 556 |
| 2 | `scripts/migrate_stats_legacy.py` | One-shot port of v0.6.x salary/workforce/age scrape into the new patch layer | `data/stats_legacy/<padded>.json` × 552 |
| 3 | `scripts/migrate_translations.py` | One-shot port of v0.6.x English translations into per-occupation files | `data/translations/en/<padded>.json` × 552 |
| 4 | `scripts/migrate_scores.py` | One-shot port of v0.6.x ai_scores into ScoreRun v2.0 schema with full audit metadata | `data/scores/occupations_<model>_<date>.json` |
| 5 | `scripts/build_labels.py` | Generate 7 dimension label files (skills/knowledge/abilities/...) from IPD 細目 sheet | `data/labels/<dim>.ja-en.json` × 7 |
| 6 | `scripts/make_prompt.py` | Build single-file Markdown bundles of all occupations for LLM scoring runs | `data/prompts/prompt.{ja,en}.md` |
| 7 | `scripts/build_data.py` | Load all sources + Pydantic-validate + atomic build of 9 projection families to `dist/` | `dist/data.treemap.json`, `dist/data.detail/`, `dist/data.search.json`, `dist/data.labels/` (and 5 future-coded families behind `--enable-future`) |
| 8 | `scripts/build_occupations.py` | Generate 556 static detail pages from `dist/data.detail/<id>.json` | `ja/<id>.html` |
| 9 | `scripts/build_sector_hubs.py` | Generate 17 sector hub pages (16 sectors + 1 index) from `dist/data.detail/` + `data/sectors/` | `ja/sectors/<id>.html`, `ja/sectors/index.html` |

Each step is incrementally cached: re-running skips work that already has output.

---

## Production stack

| Layer | What | Notes |
| --- | --- | --- |
| Hosting | Vercel (Tokyo edge `hnd1`) | Sub-50 ms TTFB for Japanese visitors. Auto-deploys from `main`. |
| Domain | `mirai-shigoto.com` (Cloudflare Registrar) | DNS-only / grey-cloud `A 76.76.21.21` to Vercel. |
| Email backend | Resend (full access key) | Two Edge Functions: `api/subscribe.js` (audience opt-in), `api/feedback.js` (transactional). Both run at the Tokyo edge. |
| Email routing | Cloudflare Email Routing | `privacy@mirai-shigoto.com` → operator inbox. |
| Analytics | 4 trackers in parallel | Cloudflare Web Analytics (cookieless), GA4 (`G-GLDNBDPF13`), Vercel Web Analytics, Vercel Speed Insights. Cross-validated. Spec: [`analytics/spec.yaml`](analytics/spec.yaml). |
| SEO / GEO | `robots.txt` opts in 17 LLM crawlers; `sitemap.xml` covers 579 URLs; [`/llms.txt`](https://mirai-shigoto.com/llms.txt) per [llmstxt.org](https://llmstxt.org/); Schema.org `WebSite` + `Dataset` + `Person` graph in `<head>`. | Built for both Google search and AI search engines. |
| Theme | Direction C warm editorial (single theme) | `prefers-color-scheme` built-in; manual toggle hidden. Warm-cream palette, Noto Serif JP headings, terracotta accents. |
| Visual spec | [`docs/Design.md`](docs/Design.md) | Single source of truth for design tokens, theme system, breakpoints, treemap rendering, tooltip rules, per-component standards. Visual changes update this file first, code follows. |

---

## Disclaimer

> **本サイトは非公式サイトです / This site is unofficial.**
>
> This is independent analysis. It is **not affiliated with**, **endorsed by**, or **representative of the views of** 厚生労働省 (the Ministry of Health, Labour and Welfare), the Japan Institute for Labour Policy and Training (JILPT), 総務省 (the Ministry of Internal Affairs and Communications), or job tag itself.
>
> The AI replacement risk scores are **model output**, not survey statistics. They are produced by a large language model against a published rubric and should be read as the model's structured opinion, not as a forecast of any individual's career. See [methodology](#how-ai-replacement-risk-is-scored) for the full limits.
>
> Workforce headcounts, salary medians, age distributions, and education distributions are sourced from public Japanese government statistics, but the site presents them in a non-authoritative form (a visualization, not a primary publication). For decisions, consult the official sources.

---

## Local development

The site itself is a single static `index.html` plus a build pipeline. To just view the existing build:

```bash
git clone https://github.com/jasonhnd/jobs.git
cd jobs
python -m http.server 8000
# open http://localhost:8000/
```

To re-run the full pipeline (you'll need [uv](https://docs.astral.sh/uv/) and an [OpenRouter](https://openrouter.ai) API key):

```bash
uv sync                              # install Python deps from pyproject.toml
uv run playwright install chromium   # one-time browser binary (jobtag is behind Imperva CDN)
export OPENROUTER_API_KEY=sk-or-...

# v0.7+ pipeline (one-shot ingest + idempotent build):
uv run python scripts/import_ipd.py            # IPD xlsx → data/occupations/<id>.json × 556
uv run python scripts/build_labels.py          # IPD 細目 → data/labels/<dim>.ja-en.json × 7
uv run python scripts/make_prompt.py           # build prompt bundles for AI scoring
# (run scoring via Claude Code session against data/prompts/, write to data/scores/)
uv run python scripts/build_data.py            # join + Pydantic-validate → dist/data.*  (atomic)
uv run python scripts/build_occupations.py     # dist/data.detail/<id>.json → ja/<id>.html
uv run python scripts/build_sector_hubs.py     # dist/data.detail/ + sectors → ja/sectors/*.html
uv run python scripts/test_data_consistency.py # L3 sanity gate
```

Pipeline scripts have inline docstrings and skip work that already has output. See [`scripts/README.md`](scripts/README.md) for run-order details and per-script flags.

---

## Repository structure

```text
jobs/
├── index.html             # treemap front end (root, served by Vercel)
├── about.html             # about page → /about via cleanUrls
├── compliance.html        # compliance page → /compliance via cleanUrls
├── privacy.html           # privacy policy → /privacy via cleanUrls
├── 404.html               # custom 404 error page
├── ja/<id>.html           # 556 per-occupation detail pages (Japanese)
├── ja/sectors/            # 17 sector hub pages
│   ├── index.html         # sectors index (all 16 sectors)
│   └── <sector_id>.html   # per-sector hub (× 16)
├── api/
│   ├── og.tsx             # Edge Function — dynamic 1200×630 OG image per occupation + sector
│   ├── subscribe.js       # Edge Function — email opt-in (Resend audiences)
│   └── feedback.js        # Edge Function — bottom-of-page feedback form
├── analytics/
│   ├── spec.yaml          # GA4 instrumentation spec — events, dimensions, key events
│   ├── setup-ga4.mjs      # idempotent script that applies the spec via GA4 Admin API
│   └── README.md          # how to run the spec sync
├── data/                  # SOURCE data (hand-curated, AI-curated; per-occupation files)
│   ├── occupations/<padded>.json     # 556 per-occupation source records (IPD v7.00)
│   ├── stats_legacy/<padded>.json    # 552 salary/workforce/age patch layer
│   ├── translations/en/<padded>.json # 552 English translations (archived; not displayed)
│   ├── scores/                        # AI scoring runs (append-only)
│   ├── sectors/                       # sector taxonomy (16 sectors + overrides)
│   ├── labels/<dim>.ja-en.json       # 7 dimension label dictionaries
│   ├── schema/                        # Pydantic models for source validation
│   ├── prompts/                       # LLM-ready Markdown bundles
│   └── .archive/v0.6/                 # frozen pre-IPD source files (audit trail)
├── dist/                  # BUILT projections (generated by scripts/build_data.py)
│   ├── data.treemap.json             # main dataset for index.html (~80 KB gz)
│   ├── data.detail/<padded>.json     # per-occupation detail (~3.5 KB gz each)
│   ├── data.search.json              # search index over 556 occupations
│   ├── data.sectors.json             # sector taxonomy with aggregated stats
│   ├── data.profile5.json            # 5-axis profile scores per occupation
│   ├── data.transfer_paths.json      # career transfer recommendations
│   └── data.labels/ja.json           # flat label dictionary
├── styles/                # CSS design tokens (Direction C)
├── og.png                 # 1200×630 social card (default; per-occupation via api/og)
├── robots.txt             # opts in major LLM crawlers
├── sitemap.xml            # 579 URLs
├── llms.txt               # per llmstxt.org — what AI search engines see
├── scripts/               # IPD ingest + projection build pipeline (Python) + seo-check.sh
│   ├── import_ipd.py            # one-shot: IPD xlsx → data/occupations/<id>.json × 556
│   ├── migrate_*.py             # one-shot v0.6 → v0.7 migrators (kept for audit)
│   ├── build_labels.py          # one-shot: IPD 細目 → data/labels/*.ja-en.json × 7
│   ├── make_prompt.py           # build LLM scoring prompt bundles
│   ├── build_data.py            # orchestrator: source → 9 projection families in dist/
│   ├── build_occupations.py     # dist/data.detail/<id>.json → ja/<id>.html
│   ├── build_sector_hubs.py     # sector hubs: ja/sectors/*.html (16 hubs + 1 index)
│   ├── lib/                     # indexes / score_strategy / atomic_write
│   ├── projections/             # 9 projection modules (treemap, detail, search, labels, ...)
│   ├── test_data_consistency.py # L3 projection sanity gate
│   ├── seo-check.sh
│   └── README.md
├── vercel.json            # static-site config — cleanUrls, redirects, headers
├── docs/                  # specs (Design.md = visual SSOT) + archived CHANGELOG
├── README.md              # English (this file)
├── README.ja.md           # 日本語
├── CHANGELOG.md           # release history (the only doc updated per-release)
├── LICENSE                # MIT
├── .gitattributes         # `* text=auto eol=lf`
├── .vercelignore          # excludes non-deployed dirs from Vercel builds
└── .gitignore
```

---

## Citation

If you reference this site in writing, the following formats work:

### Inline (article / blog / social)

> *Source: Japan Jobs × AI Risk (mirai-shigoto.com), an independent visualization of MHLW jobtag data with LLM-scored AI replacement risk. Workforce numbers from MHLW; risk scores are model output, not statistics.*

### APA

> Mirai Shigoto. (2026). *Japan Jobs × AI Risk: A visualization of 552 Japanese occupations with LLM-scored AI replacement risk* [Web visualization]. <https://mirai-shigoto.com/>

### BibTeX

```bibtex
@misc{japan_jobs_ai_risk,
  author       = {{Mirai Shigoto}},
  title        = {Japan Jobs × AI Risk: A visualization of 552 Japanese occupations with LLM-scored AI replacement risk},
  year         = {2026},
  howpublished = {\url{https://mirai-shigoto.com/}},
  note         = {Workforce data from MHLW jobtag; AI risk scores are LLM-generated and not survey statistics. Source code: \url{https://github.com/jasonhnd/jobs}}
}
```

### Schema.org Dataset (machine-readable)

A `Dataset` JSON-LD block is embedded in the home page `<head>` describing `variableMeasured`, `creator`, `license`, and `isBasedOn` linking to the underlying MHLW source. Search engines and LLMs will pick it up automatically; you don't need to write it yourself.

When citing the **dataset**, please credit MHLW (jobtag) for workforce / salary / education numbers and this project only for the AI risk scoring and presentation layer.

---

## Contributing

Contributions are welcome via GitHub Issues and Pull Requests:

- **Issues** — methodology questions, data-source suggestions, calibration feedback ("score X seems off — here's why").
- **PRs** — bug fixes, new color layers, accessibility improvements. Visual / responsive changes must update [`docs/Design.md`](docs/Design.md) first; the doc is the spec.
- **Score disputes** — If you think a specific occupation's score is meaningfully wrong, open an issue with: occupation name, current score, your proposed score, and *why* (what work it does that the model is over- or under-weighting). These get reviewed in batches.

---

## License

[MIT](LICENSE) © 2026 mirai-shigoto.com

The MIT license covers the source code in this repository. The underlying MHLW jobtag data is published by 厚生労働省 under their own terms; consult <https://shigoto.mhlw.go.jp/User/> for usage conditions on the primary data.

---

## Acknowledgements

- **[karpathy/jobs](https://github.com/karpathy/jobs)** — for the original BLS OOH × LLM scoring template that this project ports to Japan.
- **厚生労働省 職業情報提供サイト (job tag)** and **総務省 統計局** — for publishing structured occupational and labour-force data that the public can build on.
- **独立行政法人 労働政策研究・研修機構 (JILPT)** — for the underlying 職業情報データベース that job tag draws from.
- **[OpenRouter](https://openrouter.ai)** — for the unified LLM API that makes batch scoring across multiple model providers practical.
- **Vercel, Cloudflare, Resend** — for the infrastructure that lets a single-developer side project run with sub-50 ms latency to Japanese visitors.

---

## See also

The README explains *what this is*. These files explain *how it works in detail* — and they are the ones that get updated as the project evolves:

- **[CHANGELOG.md](CHANGELOG.md)** — release history. The only documentation file updated per-release.
- **[docs/Design.md](docs/Design.md)** — visual spec: design tokens, theme system, responsive breakpoints, treemap rules, per-component standards.
- **[`analytics/spec.yaml`](analytics/spec.yaml)** — GA4 instrumentation: every event, parameter, dimension, and key event the site sends.
- **[`/privacy`](https://mirai-shigoto.com/privacy)** — privacy policy (APPI + GDPR-friendly).
- **[`/llms.txt`](https://mirai-shigoto.com/llms.txt)** — what AI search engines see when they index the site.
- **[`scripts/README.md`](scripts/README.md)** — pipeline run order and per-script flags.
