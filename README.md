# Japan Jobs × AI Risk

Visualization of ~500 Japanese occupations (from 厚生労働省 jobtag) with an LLM-scored AI replacement risk overlay. Bilingual UI (日本語 / English).

**Live site:** https://jasonhnd.github.io/jobs/

## Status

Scaffolding only. The data pipeline has not been built yet. Current `index.html` is a bilingual placeholder.

## Planned pipeline

| Step | Script | Output |
| --- | --- | --- |
| 1 | `scripts/scrape_jobtag.py` | `raw/*.html` |
| 2 | `scripts/parse.py` | `data/jobs.csv` |
| 3 | `scripts/translate.py` | bilingual fields (`name_ja` / `name_en`, etc.) |
| 4 | `scripts/score_ai_risk.py` | `data/scores.csv` |
| 5 | `scripts/build_site_data.py` | `data.json` consumed by `index.html` |

## Data sources

- 厚生労働省 職業情報提供サイト（job tag） — https://shigoto.mhlw.go.jp/User/
- 総務省 労働力調査 — headcount calibration
- 総務省 経済センサス — industry distribution

## Local preview

Any static server works:

```bash
python -m http.server 8000
# open http://localhost:8000/
```

## License

TBD.
