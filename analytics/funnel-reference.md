# GA4 Funnel + Looker Studio — Quick-build Reference

> 2026-05-06. Companion doc to `spec.yaml` and `setup-ga4.mjs`. Lists the
> funnel explorations and Looker Studio dashboards the GA4 instrumentation
> is designed to support, with exact configurations for fast rebuild.

The `spec.yaml` + `setup-ga4.mjs` automation handles **schema** (events,
dimensions, key events). This doc handles **visualizations** (funnel
explorations, dashboards) which GA4's Admin API doesn't expose. Build them
once via the dashboard UI; they're saved per-property and rerun on every
visit.

---

## ✅ Built — Live on `mirai-shigoto` property

### Funnel 1 — Main conversion

GA4 → Explore → "Funnel 1 — Main conversion"

| Step | Step name | Event | Live data (28d, 2026-05-06) |
|---|---|---|---|
| 1 | Session start | `session_start` | 2,892 users (100%) |
| 2 | Map loaded | `map_loaded` | 1,745 (60.3%) |
| 3 | Tile click | `occupation_tile_click` | **80 (4.6%) — 95% drop** |
| 4 | Detail page view | `result_view` | 74 (92.5% completion) |

**Key finding (2026-05-06):** Map → Tile click drop is 95%. This is the
highest-ROI optimization point in the conversion funnel.

### Funnel 2 — Search CTR

GA4 → Explore → "Funnel 2 — Search CTR"

| Step | Step name | Event |
|---|---|---|
| 1 | Typed query | `job_search_typed` |
| 2 | Search intent | `job_search_intent` |
| 3 | Search navigate | `job_search_navigate` |
| 4 | Detail page view | `result_view` |

**Purpose:** Validates the P0-A change (split typed-signal from
intent-signal). The real CTR formula post-2026-05-06 is
`step3 / step2`. The polluted formula `job_search_navigate /
job_search_submit` previously showed 22%; the new clean one should
trend > 50% once data accumulates.

---

## 📋 Unbuilt — Build via UI when needed (~5 min each)

How to build:
1. GA4 → left sidebar → Explore (`⊕` icon)
2. Click "Funnel exploration" template
3. Rename exploration to match `Funnel N — <Name>`
4. Click ✏ next to STEPS heading (or "Add concept" button)
5. For each step: delete template events (X icon) → click chip → search → pick the event below → set the Step name
6. For filters: use the FILTERS panel below STEPS (or per-step parameter filter)
7. Top-right Apply (or auto-saves)

### Funnel 3 — Mobile first-screen

| Step | Step name | Event |
|---|---|---|
| 1 | Session start | `session_start` |
| 2 | Map loaded | `map_loaded` |
| 3 | Tile or chip | `occupation_tile_click` (with `Or` clause: `popular_job_click`) |

**Filter** (apply to whole funnel via right-side FILTERS panel):
- `device_category` exactly matches `mobile`

**Purpose:** Validates P0-D F1/F2/F3 (iOS keyboard + tap-vs-scroll +
blur-timeout). Compare conversion rate before vs after deploy
(2026-05-06).

### Funnel 4 — Outbound to MHLW jobtag

| Step | Step name | Event |
|---|---|---|
| 1 | Detail page view | `result_view` |
| 2 | Jobtag click | `jobtag_outbound_click` |

**Purpose:** Compliance signal (proves attribution chain to MHLW source
is being exercised) + measures how many users continue to the official
source after our analysis.

### Funnel 5 — Sector hub funnel

| Step | Step name | Event |
|---|---|---|
| 1 | Sector hub view | `page_view` |
| 2 | Tile or chip | `occupation_tile_click` (Or: `popular_job_click`) |
| 3 | Detail page view | `result_view` |

**Filter on Step 1** (event parameter):
- `page_path` contains `/sectors/`

**Purpose:** Sector hubs are the SEO entry surface. Measures the
sector → detail conversion through the dedicated landing pages.

---

## Looker Studio Dashboard — Spec

Path: <https://lookerstudio.google.com> → Create → Blank report → Data
source: GA4 → property `mirai-shigoto` (id `298707336`).

Suggested name: `mirai-shigoto KPI Dashboard`.

| # | Chart type | Title | Dimension(s) / Metric(s) |
|---|---|---|---|
| 1 | Scorecard | Active users (28d) | Active users, last 28 days |
| 2 | Scorecard | Real search CTR | `job_search_navigate` / `job_search_intent` |
| 3 | Time series | Sessions per day (90d) | Sessions, by date |
| 4 | Pie chart | Device split | `device_category` × Sessions |
| 5 | Table | Top 10 high-AI-risk occupations | `occupation_id` (filter `risk_tier`=`high`), Event count |
| 6 | Table | Top 10 search queries | `query` (from `job_search_typed`), Event count |
| 7 | Table | Top 10 jobtag-outbound occupations | `occupation_id`, `jobtag_outbound_click` count |
| 8 | Table | Sector hub traffic | `page_path` (contains `/sectors/`), Sessions |

Notes:
- Looker Studio data lag is ~4 hours; for realtime go back to GA4.
- For Top-10 tables, set Rows = 10, sort descending.
- Add a Date range control at the top to scope all charts uniformly.

---

## Decisions log (mirrored in `analytics/README.md`)

These have been explicitly **decided not to do** as of 2026-05-06:

- Consent Mode v2 / GDPR cookie consent — site is JA-only with no
  measurable EU/UK traffic. Revisit only if EU traffic exceeds 5%.
- A/B testing framework — site traffic too low for statistical
  significance on most UI changes; before/after comparisons suffice
  at current scale.
