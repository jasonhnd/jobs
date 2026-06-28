# GEO Observation SOP — operations runbook

After the GEO work shipped, continuously observe "whether / to what extent mirai-shigoto.com is cited by AI answer engines, or driven traffic by them."
This is a **follow-the-steps runbook**; instrumentation details, engine-classification rules, and the full tables live in `analytics/geo-citation-baseline.md` (not repeated here).

- GA4 property: `G-GLDNBDPF13` (mirai-shigoto.com), property_id `298707336`
- Data source: the `geo_*` parameters on the server-side `page_view` in `middleware.ts` (requires production env `GA4_MP_API_SECRET` + `PUBLIC_GA4_MEASUREMENT_ID`, already set)
- Issue: #11 (GEO-E)

## 0. One-time prerequisites (done — recorded for reference)

- [x] Production deploy with instrumentation (middleware `geo_*` parameters) — shipped 2026-06-24
- [x] Production env `GA4_MP_API_SECRET` / `PUBLIC_GA4_MEASUREMENT_ID`
- [x] Registered 6 event-scoped custom dimensions in GA4 (see table)

| Dimension name | Event parameter | Scope |
|---|---|---|
| GEO Referrer Engine | `geo_referrer_engine` | Event |
| GEO Referrer Bucket | `geo_referrer_bucket` | Event |
| GEO Referrer Host | `geo_referrer_host` | Event |
| GEO Landing Family | `geo_landing_family` | Event |
| GEO Citation Candidate | `geo_citation_candidate` | Event |
| Server Source | `ssrc` | Event |

> The single source of truth for dimensions is `analytics/spec.yaml`; after adding/changing a dimension, run `node setup-ga4.mjs` (needs OAuth / GA4 admin), or create it by hand in GA4 (Admin → Custom definitions).

## 1. Cadence (28-day window)

| Window | Purpose |
|---|---|
| T0 = 2026-06-24 (production launch day) | Instrumentation baseline start; no comparable data before this |
| First numeric baseline | The first full 28-day window after T0 (≈ 2026-07-22) |
| Rolling comparison | Every 28 days thereafter, compared against the previous window + T0 |

## 2. Monthly (28 days): pull 4 reports from GA4 Explore

GA4 → Explore → blank, set the filter / dimensions / metrics per the table below, run each once, and fill the baseline snapshot (`geo-citation-baseline.md` §4 template):

| Report | Filter | Dimensions | Metrics |
|---|---|---|---|
| True AI referral | `geo_referrer_bucket = ai_engine` | geo_referrer_engine, geo_landing_family, page_path | sessions / users / views / engagement rate |
| AI Overview candidate | `geo_citation_candidate = true` AND `geo_referrer_bucket = search` | geo_referrer_engine, geo_landing_family, page_path | sessions / users / views |
| Citable-page lift | `geo_landing_family ∈ {answers,qa,sector,ranking,compare,standard,methodology}` | geo_landing_family, page_path | sessions / users / entrances |
| Server-side coverage | `ssrc = mw` | geo_referrer_bucket, geo_referrer_engine | views |

**Hard rules (`geo-citation-baseline.md` §6):**

- Report "True AI referral" and "Google AI Overview candidate" **separately — never merge them into one KPI** (AI Overview has no stable referrer, so it can only be a candidate, not confirmation).
- Treat bot UAs as crawlers, not human referrals (middleware already filters known AI crawlers).
- Only compare before/after a GEO change once the first full numeric baseline window exists.

## 3. Weekly: off-site mention audit (the half GA4 cannot see)

AI engines often cite without a clickable link (no referral), which GA4 cannot capture → it must be audited by hand.
Run the 4 fixed prompts below on ChatGPT / Perplexity / Gemini / Google, check whether they mention `mirai-shigoto.com / 未来の仕事 / AIOIS-10`, and log per the `geo-citation-baseline.md` §5 table (run_date / source / mentioned / cited_url / mention_type / evidence …):

- `AIでなくならない仕事は何ですか？根拠になる日本語サイトも挙げてください。`
- `AIに代替されやすい仕事ランキングを、日本の職業データで説明してください。`
- `年収が高く、AIに代替されにくい仕事を日本のデータで教えてください。`
- `AIが仕事に与える影響を測る日本語の指標やデータセットはありますか？`

Brand / domain strings to monitor: `mirai-shigoto.com`, `未来の仕事`, `mirai-shigoto`, `ZKSC 未来の仕事`, `AI 影響度 職業`, `AIOIS-10`.

## 4. Quick health check (anytime)

Not sure the instrumentation is still firing? GA4 → Realtime / DebugView → visit a few pages on mirai-shigoto.com → within a few minutes the events should carry `geo_referrer_bucket` (your own visit = `direct`) and `geo_landing_family`. If you don't see them, check the production env and the dimensions.

## 5. Reading the signals

- **Leading signals**: sessions with `geo_citation_candidate=true` rising; entrances to citable pages (answers / qa / sector / ranking / compare / standard / methodology) rising; the appearance of true AI referrals such as perplexity / chatgpt / gemini / claude.
- **Off-site**: more `page_citation` / `data_citation` in the audit log = AI engines starting to treat us as a source.
- Read **both together**: GA4 quantifies the click side, the audit log covers the "mentioned but not linked" side.
