# Japan Jobs × AI Risk

[![Live Site](https://img.shields.io/badge/live-mirai--shigoto.com-ffb84d)](https://mirai-shigoto.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Hosting: Vercel](https://img.shields.io/badge/hosting-Vercel%20(hnd1)-000)](https://vercel.com)

> **🇯🇵 [日本語版 README はこちら](README.ja.md)**

![Japan Jobs × AI Risk — bilingual treemap of 552 occupations from Japan's MHLW jobtag, overlaid with LLM-scored AI replacement risk](og.png)

A bilingual visualization of **552 Japanese occupations** sourced from the Ministry of Health, Labour and Welfare's official 職業情報提供サイト (jobtag), each overlaid with an **LLM-scored AI replacement risk** (0–10) plus per-occupation rationale in 日本語 and English.

🔗 **Live:** **<https://mirai-shigoto.com/>**

---

## What this is

A single squarified treemap that lets you see — at a glance — which Japanese occupations are most exposed to AI replacement, weighted by how many people actually work in each one.

The dataset is grounded in published Japanese government statistics (jobtag, 労働力調査, 経済センサス). The risk overlay is produced separately by an LLM and clearly labeled as model output, not a survey result. The site is deliberately bilingual: same dataset, two faces — 日本語 for the domestic audience, English for international readers — switchable in the top-right.

This project is **not affiliated with** 厚生労働省, the Japan Institute for Labour Policy and Training (JILPT), or any government body. It is independent analysis.

---

## What you'll see

When you land on [mirai-shigoto.com](https://mirai-shigoto.com/) you get:

- **A treemap of 552 occupations**, sized by headcount and colored by AI replacement risk (default). Big tile = lots of people in that occupation. Red tile = high AI exposure. Green tile = low AI exposure.
- **Six color layers**, switchable from the toolbar: AI Risk, Annual Salary, Average Age, Working Hours, Recruit Ratio (有効求人倍率), Education Level. Tile size never changes — only what the color encodes does.
- **Colorblind-safe palette** (viridis) toggle.
- **Light / dark mode** with `prefers-color-scheme` detection on first visit, plus a sun / moon toggle that persists your choice across sessions.
- **Bilingual UI** — 日本語 / English with browser-locale auto-detect. Every label, tooltip, and detail page exists in both languages.
- **Live search** by occupation name in either language.
- **Hover (desktop) or tap (mobile)** any tile for a tooltip with risk score, salary, headcount, and the LLM's rationale.
- **552 dedicated detail pages** at `/ja/<id>.html` and `/en/<id>.html` — each with full risk reasoning, breakdown by salary / age / hours / recruit ratio / education, structured `Occupation` JSON-LD for search engines.
- **Social share buttons** — X, LINE, Hatena Bookmark, LinkedIn, Copy Link, native Web Share API on mobile.
- **A no-cookie analytics layer** alongside Google Analytics, so the site works whether or not you allow cookies.

The site is designed to be readable on a 360 px phone and on a 4K desktop with the same content density.

---

## Why this exists

In 2024 Andrej Karpathy published [karpathy/jobs](https://github.com/karpathy/jobs) — a treemap of the 342 occupations in the U.S. Bureau of Labor Statistics' Occupational Outlook Handbook, each scored 0–10 for AI exposure by an LLM. It was a clean, government-grounded artifact: real BLS occupations, real BLS workforce numbers, with model-generated risk as the only synthetic layer on top.

A popular Chinese fork ([madeye/jobs](https://github.com/madeye/jobs)) adapted the format but changed the foundation — the occupation list itself was AI-synthesized rather than government-published. That breaks the chain of provenance: the numbers no longer ground out anywhere checkable.

Japan has its own equivalent of the BLS OOH: **厚生労働省 職業情報提供サイト (job tag)**, covering ~500 職業 with structured fields for salary, education, headcount, and growth outlook. That dataset has existed for years, and **no one had built the Karpathy treatment for it** — government-grounded, bilingual, with LLM-scored AI exposure.

This project is that missing artifact. Karpathy's idea, ported to Japan, with a translation step added so the same dataset reads in two languages.

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

Scoring runs in `scripts/score_ai_risk.py`. For each occupation:

1. **Input bundle** — occupation name (JA + EN), industry, jobtag's 仕事内容 description, structured fields (salary, headcount, education distribution, growth outlook).
2. **Prompt** — the calibration anchors above, plus the input bundle, plus a structured output instruction (JSON: `score: int`, `rationale_ja: str`, `rationale_en: str`).
3. **Model** — [OpenRouter](https://openrouter.ai) with Gemini Flash by default. Configurable; a swap to Claude Sonnet or GPT-4o is one config line.
4. **Output** — the model's score + bilingual rationale, cached per-occupation. Re-running skips occupations that already have a stored result.
5. **Aggregation** — `scripts/build_data.py` merges scores into `data.json`, the single artifact the front end reads.

Each rationale is one to three sentences explaining *why* the score landed where it did — what parts of the work the LLM thinks it can already do, what parts it can't.

### Limits — what this score is and isn't

Treat the score as **the current frontier LLM's structured opinion about the occupation**, not as ground truth. Specifically:

- **It is model output, not survey data.** Workforce headcounts and salary numbers are real statistics. The risk score is generated text, lightly structured.
- **It is sensitive to prompt phrasing.** A different rubric, different anchors, or even different word choice in the worked examples can shift scores by 1–2 points across the dataset. The published anchors and prompt are stable, but they are one possible calibration, not the only one.
- **It reflects "current LLM consensus" — and that consensus drifts.** Re-scoring with a newer model can move scores. Older models were systematically more pessimistic about creative work; newer ones are more pessimistic about office work. The score is a snapshot.
- **Bilingual rationales can diverge.** The Japanese and English rationales are produced in the same call from the same context, but the model occasionally emphasizes different aspects in each language. This is a feature (each language audience reads natural prose) and a limitation (the two are not strict translations).
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

The build pipeline is a Japan-localized port of [karpathy/jobs](https://github.com/karpathy/jobs)'s shape, with one extra translation step and bilingual outputs throughout.

| # | Script | What it does | Output |
| --- | --- | --- | --- |
| 1 | `scripts/list_occupations.py` | Parse the jobtag A–Z index into a master occupation list | `occupations.json` |
| 2 | `scripts/scrape_jobtag.py` | Polite, rate-limited fetch of every occupation page (httpx first, Playwright fallback for Imperva-protected pages) | `html/<slug>.html` |
| 3 | `scripts/parse.py` | BeautifulSoup → clean Markdown per occupation | `pages/<slug>.md` |
| 4 | `scripts/extract_fields.py` | Tabulate structured fields (年収, 学歴, 就業者数, 成長性) | `occupations.csv` |
| 5 | `scripts/translate.py` | LLM batch JA→EN for occupation names, industries, descriptions | bilingual columns merged in place |
| 6 | `scripts/score_ai_risk.py` | LLM scoring (0–10) of AI replacement risk + JA/EN rationale (see [methodology](#how-ai-replacement-risk-is-scored)) | `scores.json` |
| 7 | `scripts/build_data.py` | Merge CSV + scores → single bilingual artifact | `data.json` |
| 8 | `scripts/build_occupations.py` | Generate 1,104 static detail pages (JA + EN) from `data.json` | `ja/<id>.html`, `en/<id>.html` |

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
| SEO / GEO | `robots.txt` opts in 17 LLM crawlers; `sitemap.xml` covers 1,104 URLs with hreflang pairs; [`/llms.txt`](https://mirai-shigoto.com/llms.txt) per [llmstxt.org](https://llmstxt.org/); Schema.org `WebSite` + `Dataset` + `Person` graph in `<head>`. | Built for both Google search and AI search engines. |
| Theme | Light / dark with `prefers-color-scheme` + manual toggle | No-flash inline script. `localStorage` persistence. Treemap palette + canvas background swap per theme. |
| Visual spec | [`Design.md`](Design.md) | Single source of truth for design tokens, theme system, breakpoints, treemap rendering, tooltip rules, per-component standards. Visual changes update this file first, code follows. |

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

# Run the 8-step pipeline in order — each step is incrementally cached
uv run python scripts/list_occupations.py
uv run python scripts/scrape_jobtag.py
uv run python scripts/parse.py
uv run python scripts/extract_fields.py
uv run python scripts/translate.py
uv run python scripts/score_ai_risk.py
uv run python scripts/build_data.py
uv run python scripts/build_occupations.py
```

Pipeline scripts have inline docstrings and skip work that already has output. See [`scripts/README.md`](scripts/README.md) for run-order details and per-script flags.

---

## Repository structure

```text
jobs/
├── index.html             # bilingual treemap front end (root, served by Vercel)
├── privacy.html           # bilingual privacy policy → /privacy via cleanUrls
├── ja/<id>.html           # 552 per-occupation detail pages (Japanese)
├── en/<id>.html           # 552 per-occupation detail pages (English)
├── api/
│   ├── subscribe.js       # Edge Function — email opt-in (Resend audiences)
│   └── feedback.js        # Edge Function — bottom-of-page feedback form
├── analytics/
│   ├── spec.yaml          # GA4 instrumentation spec — events, dimensions, key events
│   ├── setup-ga4.mjs      # idempotent script that applies the spec via GA4 Admin API
│   └── README.md          # how to run the spec sync
├── data.json              # compact bilingual data, consumed by every page
├── occupations.json       # master occupation list from jobtag A–Z
├── occupations.csv        # tabulated structured fields
├── scores.json            # AI replacement scores + bilingual rationales
├── prompt.en.md /         # single-file LLM-ready data dump (one for each language)
│   prompt.ja.md
├── og.png                 # 1200×630 social card
├── robots.txt             # opts in major LLM crawlers
├── sitemap.xml            # 1,104 URLs with hreflang pairs
├── llms.txt               # per llmstxt.org — what AI search engines see
├── scripts/               # ingest + build pipeline (Python) + seo-check.sh
│   ├── list_occupations.py
│   ├── scrape_jobtag.py
│   ├── parse.py
│   ├── extract_fields.py
│   ├── translate.py
│   ├── score_ai_risk.py
│   ├── build_data.py
│   ├── build_occupations.py
│   ├── seo-check.sh
│   ├── make_prompt.py
│   └── README.md
├── vercel.json            # static-site config — cleanUrls, redirects, headers
├── Design.md              # visual single source of truth
├── README.md              # English (this file)
├── README.ja.md           # 日本語
├── CHANGELOG.md           # release history (the only doc updated per-release)
├── LICENSE                # MIT
├── .gitattributes         # `* text=auto eol=lf`
└── .gitignore
```

---

## Citation

If you reference this site in writing, the following formats work:

### Inline (article / blog / social)

> *Source: Japan Jobs × AI Risk (mirai-shigoto.com), an independent visualization of MHLW jobtag data with LLM-scored AI replacement risk. Workforce numbers from MHLW; risk scores are model output, not statistics.*

### APA

> Mirai Shigoto. (2026). *Japan Jobs × AI Risk: A bilingual visualization of 552 Japanese occupations with LLM-scored AI replacement risk* [Web visualization]. <https://mirai-shigoto.com/>

### BibTeX

```bibtex
@misc{japan_jobs_ai_risk,
  author       = {{Mirai Shigoto}},
  title        = {Japan Jobs × AI Risk: A bilingual visualization of 552 Japanese occupations with LLM-scored AI replacement risk},
  year         = {2026},
  howpublished = {\url{https://mirai-shigoto.com/}},
  note         = {Workforce data from MHLW jobtag; AI risk scores are LLM-generated and not survey statistics. Source code: \url{https://github.com/jasonhnd/jobs}}
}
```

### Schema.org Dataset (machine-readable)

A `Dataset` JSON-LD block is embedded in the home page `<head>` describing `variableMeasured`, `creator`, `license`, and `isBasedOn` linking to the underlying MHLW source. Search engines and LLMs will pick it up automatically; you don't need to write it yourself.

When citing the **dataset**, please credit MHLW (jobtag) for workforce / salary / education numbers and this project only for the AI risk scoring + bilingual presentation layer.

---

## Contributing

Contributions are welcome via GitHub Issues and Pull Requests:

- **Issues** — methodology questions, data-source suggestions, calibration feedback ("score X seems off — here's why"), translation refinements (especially around 学歴 categories and 業種 boundaries).
- **PRs** — bug fixes, translation improvements, new color layers, accessibility improvements. Visual / responsive changes must update [`Design.md`](Design.md) first; the doc is the spec.
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
- **[Design.md](Design.md)** — visual spec: design tokens, theme system, responsive breakpoints, treemap rules, per-component standards.
- **[`analytics/spec.yaml`](analytics/spec.yaml)** — GA4 instrumentation: every event, parameter, dimension, and key event the site sends.
- **[`/privacy`](https://mirai-shigoto.com/privacy)** — bilingual privacy policy (APPI + GDPR-friendly).
- **[`/llms.txt`](https://mirai-shigoto.com/llms.txt)** — what AI search engines see when they index the site.
- **[`scripts/README.md`](scripts/README.md)** — pipeline run order and per-script flags.
