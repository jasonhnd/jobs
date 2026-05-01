# Japan Jobs × AI Risk

[![Live Site](https://img.shields.io/badge/live-mirai--shigoto.com-ffb84d)](https://mirai-shigoto.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.6.0-blue.svg)](CHANGELOG.md)
[![Hosting: Vercel](https://img.shields.io/badge/hosting-Vercel%20(hnd1)-000)](https://vercel.com)

> **🇯🇵 [日本語版 README はこちら](README.ja.md)**

A bilingual visualization of roughly **500 Japanese occupations** sourced from the Ministry of Health, Labour and Welfare's official 職業情報提供サイト (jobtag), overlaid with an **LLM-scored AI replacement risk** for each occupation.

Same dataset, two faces: 日本語 for the domestic audience, English for the international one. One toggle in the top right.

🔗 **Live:** https://mirai-shigoto.com/

---

## Status

`v0.6.0` — **production**. The full pipeline is live: **552 Japanese occupations** with LLM-scored AI replacement risk (0–10), English translations, and a complete bilingual UI on a custom domain.

What's shipped:

- **Custom domain** `mirai-shigoto.com` on Vercel's Tokyo edge (`hnd1`) — sub-50 ms TTFB for Japanese visitors.
- **Squarified treemap** of all 552 occupations with 6 color layers (AI risk / Salary / Avg Age / Hours / Recruit Ratio / Education) and a colorblind-safe viridis toggle.
- **Bilingual UI** (日本語 / English, browser-locale auto-detect, per-page hreflang).
- **Light + dark mode** with `prefers-color-scheme` detection, no-flash inline script, persistent `localStorage` choice, and a sun / moon toggle. Treemap palette and canvas background switch per theme.
- **552 per-occupation static pages** (1,104 HTML files: JA + EN), each with Schema.org `Occupation` JSON-LD, full risk rationale, and the same 4 analytics scripts as the home page.
- **Email-collection backend** — `api/subscribe.js` + `api/feedback.js` Vercel Edge Functions (Tokyo edge), backed by Resend.
- **Privacy policy** at `/privacy` (bilingual, APPI + GDPR-friendly), Cloudflare Email Routing for `privacy@mirai-shigoto.com`.
- **Analytics**: Cloudflare Web Analytics + GA4 + Vercel Web Analytics + Vercel Speed Insights — four trackers in parallel for cross-validation.
- **SEO + GEO**: `robots.txt` (opts in 17 LLM crawlers), `sitemap.xml` (1,104 URLs with hreflang), `llms.txt` (per [llmstxt.org](https://llmstxt.org/)), Schema.org `WebSite` + `Dataset` + `Person` graph.
- **`Design.md`** — single-source-of-truth visual spec covering tokens, theme system, responsive breakpoints, treemap rules, and per-component standards.

Performance budget held: LCP < 1.6 s on 4G, INP < 80 ms, CLS = 0. Bundle under the 80 KB microsite budget.

See the [CHANGELOG](CHANGELOG.md) for the full history and [`Design.md`](Design.md) for the visual spec.

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

Past releases (see [CHANGELOG.md](CHANGELOG.md) for detail):

- **v0.0.1 – v0.0.5** — scaffolding, scraper, parser, translation, scoring, first `data.json`. ✅
- **v0.1.0 – v0.3.x** — squarified treemap, bilingual UI, search, layer toggle, mobile pass, OG / hreflang, top banner. ✅
- **v0.4.x** — custom domain `mirai-shigoto.com`, GA4, mobile tooltip fixes. ✅
- **v0.5.0** — Vercel migration, bilingual privacy policy, four-tracker analytics, SEO + GEO (robots / sitemap / llms.txt / JSON-LD). ✅
- **v0.6.0** — light/dark theme, vibrant light palette, 552 per-occupation pages, Resend backend, footer share buttons, `Design.md` spec. ✅ (current)

What's next:

### v0.7.x — Newsletter operationalization

Email funnel end-to-end. Audiences split by language (JA / EN), tagged by occupation_id when the address is captured from a per-occupation modal. Welcome email + segmented monthly digest. Unsubscribe flow tested against the privacy policy claims.

### v0.8.x — Content depth

Methodology long-read on `/methodology` explaining the LLM scoring rubric, anchors, validation against BLS-ported scores, and known calibration drift. Add a `?embed=1` mode that strips chrome for embedding the treemap in third-party articles.

### v0.9.x — Data dump exports

Public `data.json` already exists; add CSV and Parquet exports under `/exports/`, plus a one-click "Cite this dataset" widget that produces BibTeX / APA / Schema.org Dataset JSON. Versioned snapshots so academic citations stay stable.

### v1.0.0 — Stable

Public-launch threshold: methodology peer-reviewed by ≥ 2 outside readers, score-stability check across two independent LLMs, accessibility audit (WCAG AA), at least one external citation in published writing, and the OPC validation plan's quality-impressions threshold met.

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
├── index.html             # bilingual treemap front end (root, served by Vercel)
├── privacy.html           # bilingual privacy policy → /privacy via cleanUrls
├── ja/<id>.html           # 552 per-occupation pages (Japanese)
├── en/<id>.html           # 552 per-occupation pages (English)
├── api/
│   ├── subscribe.js       # Edge Function — email opt-in (Resend audiences)
│   └── feedback.js        # Edge Function — bottom-of-page feedback form
├── analytics/
│   ├── spec.yaml          # GA4 instrumentation spec (events / dimensions / key events)
│   ├── setup-ga4.mjs      # idempotent script that applies spec via GA4 Admin API
│   └── README.md          # how to run the spec sync
├── data.json              # compact bilingual data consumed by every page
├── occupations.json       # master occupation list from jobtag A–Z
├── occupations.csv        # tabulated structured fields
├── scores.json            # AI replacement scores + rationales (JA + EN)
├── prompt.en.md /         # single-file LLM-ready data dump
│   prompt.ja.md
├── og.png                 # 1200×630 social card
├── robots.txt /           # SEO / GEO discoverability
│   sitemap.xml /
│   llms.txt
├── scripts/               # ingest + build pipeline (Python) + seo-check.sh
├── vercel.json            # static-site config (cleanUrls, redirects, headers)
├── Design.md              # visual single source of truth — tokens, theme, breakpoints
├── README.md              # English (this file)
├── README.ja.md           # 日本語
├── CHANGELOG.md
├── LICENSE                # MIT
├── .gitattributes         # `* text=auto eol=lf`
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
