# scripts/ — Pipeline (planned, lands in v0.0.2+)

This directory will hold the 7-step data pipeline that turns 厚生労働省 jobtag pages into the bilingual `data.json` consumed by the front end. **None of the scripts are implemented yet** — `v0.0.1` is scaffolding only.

The shape mirrors [karpathy/jobs](https://github.com/karpathy/jobs) (read in full and adapted for Japan), with one extra translation step for bilingual outputs.

## Planned scripts

| # | Script | Reads | Writes | Lands in |
| --- | --- | --- | --- | --- |
| 1 | `list_occupations.py` | `jobtag_index.html` (saved manually via Playwright) | `occupations.json` | v0.0.2 |
| 2 | `scrape_jobtag.py` | `occupations.json` | `html/<slug>.html` × ~500 | v0.0.2 |
| 3 | `parse.py` | `html/<slug>.html` | `pages/<slug>.md` | v0.0.3 |
| 4 | `extract_fields.py` | `html/<slug>.html` | `occupations.csv` | v0.0.3 |
| 5 | `translate.py` | `occupations.csv` (JA fields) | `occupations.csv` (+ EN columns) | v0.0.4 |
| 6 | `score_ai_risk.py` | `pages/<slug>.md` | `scores.json` | v0.0.4 |
| 7 | `build_data.py` | `occupations.csv` + `scores.json` | `../data.json` | v0.0.5 |

A future `make_prompt.py` (v0.2.0) will mirror karpathy's `make_prompt.py` to emit a bilingual single-file LLM-ready data dump.

## Important: jobtag is behind Imperva CDN

`https://shigoto.mhlw.go.jp/` is fronted by Imperva/Incapsula bot protection. Plain `httpx` / `curl` requests return a JavaScript challenge page (HTTP 200 with an iframe pointing to `/_Incapsula_Resource?...`), **not** the real HTML.

**Implication for `scrape_jobtag.py`:** must use Playwright with a real Chromium binary (same approach karpathy uses for BLS). Do **not** waste effort on `httpx` first — it will silently return challenge pages and we'll mistake them for real data.

A representative test on `2026-04-25`:

```text
$ curl -A "Mozilla/5.0 ... Chrome/130.0.0.0 ..." https://shigoto.mhlw.go.jp/User/
<html style="height:100%"><head>...
<script src="/_Incapsula_Resource?SWJIYLWA=..."></script>
</head>...<iframe id="main-iframe" src="/_Incapsula_Resource?SWUDNSAI=...">
Request unsuccessful. Incapsula incident ID: ...
</iframe></body></html>
```

## Caching contract

Each step is incrementally cached:

- `list_occupations.py` — one-shot, regenerates `occupations.json`.
- `scrape_jobtag.py` — skips any occupation where `html/<slug>.html` already exists.
- `parse.py` / `extract_fields.py` — read from `html/`, idempotent, fast.
- `translate.py` / `score_ai_risk.py` — incremental save after each LLM call (resume on interrupt).
- `build_data.py` — pure merge, no API calls.

`html/`, `pages/`, and any `.env` are gitignored. Outputs that should be tracked: `occupations.json`, `occupations.csv`, `scores.json`, `data.json`.

## How to run (once implemented)

```bash
# One-time setup
uv sync
uv run playwright install chromium

# Pipeline
uv run python -m scripts.list_occupations
uv run python -m scripts.scrape_jobtag         # ~500 pages, ~10 min
uv run python -m scripts.parse                  # offline, fast
uv run python -m scripts.extract_fields         # offline, fast
uv run python -m scripts.translate              # OpenRouter, paid
uv run python -m scripts.score_ai_risk          # OpenRouter, paid
uv run python -m scripts.build_data             # offline, fast
```

OpenRouter key required in `.env`:

```text
OPENROUTER_API_KEY=sk-or-...
```
