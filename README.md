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

A Python build pipeline (requires [uv](https://docs.astral.sh/uv/)) ingests government source data from MHLW jobtag, joins it with LLM-generated AI replacement risk scores, validates everything through Pydantic, and produces the static assets served by Vercel. Scripts live in `scripts/` and are incrementally cached — re-runs skip work that already has output. See [`scripts/README.md`](scripts/README.md) for per-script details.

---

## Production stack

| Layer | What |
| --- | --- |
| Hosting | Vercel (Tokyo edge) — auto-deploys from `main` |
| Domain | `mirai-shigoto.com` (Cloudflare Registrar → Vercel) |
| Email | Resend via Edge Functions (`api/subscribe.js`, `api/feedback.js`) |
| Analytics | Cloudflare WA, GA4, Vercel WA, Vercel Speed Insights ([spec](analytics/spec.yaml)) |
| SEO | `robots.txt`, `sitemap.xml`, [`/llms.txt`](https://mirai-shigoto.com/llms.txt), Schema.org structured data |
| Visual spec | [`docs/Design.md`](docs/Design.md) — single source of truth for design tokens and theme |

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

## Repository structure

```text
jobs/
├── index.html              # treemap front end (served by Vercel)
├── privacy.html            # privacy policy
├── ja/<id>.html            # per-occupation detail pages
├── ja/sectors/<slug>.html  # sector hub pages
├── api/                    # Vercel Edge Functions (OG image, subscribe, feedback)
├── analytics/              # GA4 instrumentation spec + sync script
├── data/                   # source data (per-occupation JSON, scores, labels)
├── dist/                   # built projections (treemap, detail, search, labels)
├── scripts/                # Python build pipeline
├── docs/                   # specs (Design.md) + archived changelogs
├── vercel.json             # static-site config
├── CHANGELOG.md            # release history
└── README.md / README.ja.md
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
