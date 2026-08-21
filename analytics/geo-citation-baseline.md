# GEO Citation Measurement Baseline

Issue: #11 (instrumentation). Product follow-up: #236.  
Owner surface: `analytics/spec.yaml`, `middleware.ts`, GA4, off-site mention log

This document defines the baseline for measuring whether GEO work causes
mirai-shigoto.com to be cited or visited from AI answer engines. The numeric
baseline starts with the first complete reporting window after this
instrumentation is deployed; before this change the site did not have a
stable AI-referrer segment.

## 1. GA4 Referrer Tracking

Server-side `page_delivery` hits from `middleware.ts` attach these parameters.

**The event is `page_delivery`, not `page_view` (#253).** `page_view` means "a
person viewed a page" and is emitted client-side only; `page_delivery` means "we
served a page" and is emitted by the middleware only. Every filter below reads
`page_delivery`. See ANALYTICS.md §計測単位 for the contract.

| Parameter | Purpose |
| --- | --- |
| `client_kind` | `browser` or `ai_agent`. Scanners and SEO crawlers (`other_bot`) are refused before send and never appear. |
| `agent_name` | Canonical AI agent id when `client_kind = ai_agent`: `gptbot`, `chatgpt_user`, `oai_searchbot`, `claudebot`, `claude_user`, `perplexitybot`, `google_extended`, `bytespider`, and so on. `(none)` for browsers. |
| `geo_referrer_engine` | Normalized source engine, such as `perplexity`, `chatgpt_search`, `gemini`, `bing_copilot`, `claude`, `google_search`, `bing_search`, `internal`, `direct`, `other_external`. |
| `geo_referrer_bucket` | Coarse source bucket: `ai_engine`, `search`, `internal`, `direct`, `external`. |
| `geo_referrer_host` | Referring hostname only, without path or query. |
| `geo_landing_family` | Landing page family: `occupation`, `answers`, `qa`, `sector`, `ranking`, `compare`, `standard`, `methodology`, `map`, `other`. |
| `geo_citation_candidate` | `true` for exact AI-engine referrals and for search referrals to citable landing families where an AI Overview-style citation is plausible. |
| `ssrc` | Measurement Protocol source marker. `mw` means Vercel Edge middleware. |

The corresponding GA4 event-scoped custom dimensions are declared in
`analytics/spec.yaml`. From the repository root, install the locked analytics
dependencies, preview the validated spec, and then apply it:

```bash
corepack pnpm@11.9.0 --dir analytics install --frozen-lockfile
GA4_PROPERTY_ID=298707336 corepack pnpm@11.9.0 --dir analytics run setup:dry
GA4_PROPERTY_ID=298707336 corepack pnpm@11.9.0 --dir analytics run setup
```

## 2. Engine Classification

Exact AI-engine referrals:

| Engine | Referrer rule |
| --- | --- |
| Perplexity | `perplexity.ai` |
| ChatGPT Search | `chatgpt.com`, `chat.openai.com` |
| Gemini | `gemini.google.com`, `bard.google.com` |
| Bing Copilot | `copilot.microsoft.com`, or `bing.com` with `/chat` referrer path |
| Claude | `claude.ai` |
| Other AI search | `you.com`, `phind.com`, `komo.ai`, `andisearch.com` |

Search referrals:

| Engine | Referrer rule | Baseline use |
| --- | --- | --- |
| Google Search | `google.*` referrers | Count as search. If the landing family is citable, mark `geo_citation_candidate=true`. |
| Bing Search | `bing.com` referrers outside `/chat` | Count as search. If the landing family is citable, mark `geo_citation_candidate=true`. |

Important limitation: Google AI Overview does not expose a stable dedicated
referrer. Treat the Google Search + citable landing-family segment as a
candidate segment, not proof of AI Overview citation.

## 3. Citable Landing Families

The candidate citation segment includes these page families because they are
designed to be quoted, summarized, or linked by AI answers:

- `answers`
- `qa`
- `sector`
- `ranking`
- `compare`
- `standard`
- `methodology`

Occupation detail pages are tracked separately as `occupation`. They can still
receive AI-engine referrals, but they are not counted in the AI Overview
candidate segment unless a later issue explicitly makes them citable landing
families.

## 4. Baseline Report

Run the baseline report on a fixed cadence:

| Window | Use |
| --- | --- |
| T0 instrumentation baseline | First deployment where the new dimensions exist. Historical values are not comparable. |
| First numeric baseline | First complete 28-day window after deployment. |
| Ongoing comparison | Rolling 28-day window, compared with the prior 28 days and with T0. |

GA4 Explore or Looker Studio tables:

| Report | Filter | Dimensions | Metrics |
| --- | --- | --- | --- |
| Exact AI referrals | `geo_referrer_bucket = ai_engine` | `geo_referrer_engine`, `geo_landing_family`, `page_path` | Sessions, users, page views, engagement rate |
| AI Overview candidates | `geo_citation_candidate = true` and `geo_referrer_bucket = search` | `geo_referrer_engine`, `geo_landing_family`, `page_path` | Sessions, users, page views |
| Citable page lift | `geo_landing_family in answers,qa,sector,ranking,compare,standard,methodology` | `geo_landing_family`, `page_path` | Sessions, users, entrances |
| Server-side coverage | `event = page_delivery` and `client_kind = browser` | `geo_referrer_bucket`, `geo_referrer_engine` | Event count |
| **AI crawl** | `event = page_delivery` and `client_kind = ai_agent` | `agent_name`, `geo_landing_family`, `page_path` | Event count |
| **Tracking-prevention rate** | none | `geo_landing_family` | `page_delivery` (client_kind=browser) ÷ `page_view` |

Read the last two as **event counts, never sessions**. Deliveries that cannot
join a real gtag.js session share a deterministic per-day bucket identity, so
their session and user counts are an artefact of that bucketing. The event count
is exact; the session count is not a population.

Baseline snapshot template:

| Window start | Window end | Exact AI-engine sessions | AI Overview candidate sessions | Citable-page sessions | Top AI engine | Top cited page |
| --- | --- | ---: | ---: | ---: | --- | --- |
| T0 deploy date | T0 + 27 days | Fill from GA4 | Fill from GA4 | Fill from GA4 | Fill from GA4 | Fill from GA4 |

## 5. Off-site Brand and Domain Mentions

Maintain a weekly off-site citation log outside GA4. The log can live in a
spreadsheet or issue comment; use this schema so weeks remain comparable:

| Column | Meaning |
| --- | --- |
| `run_date` | Date the check was performed. |
| `source` | `google_search`, `bing_search`, `perplexity`, `chatgpt`, `gemini`, `claude`, `manual_web`, `gsc_links`, or SEO-tool source. |
| `query_or_report` | Prompt, search query, or report name. |
| `mentioned` | `true` if mirai-shigoto.com, 未来の仕事, or ZKSC is mentioned. |
| `cited_url` | Exact URL cited, if any. |
| `referring_url` | External page or answer URL when available. |
| `mention_type` | `domain`, `brand`, `page_citation`, `data_citation`, `unlinked_mention`. |
| `evidence` | Short excerpt or screenshot/file reference. |
| `notes` | Follow-up action or confidence note. |

Monitor these brand/domain strings:

- `mirai-shigoto.com`
- `未来の仕事`
- `mirai-shigoto`
- `ZKSC 未来の仕事`
- `AI 影響度 職業`
- `AIOIS-10`

Fixed AI-answer audit prompts:

| Prompt family | Japanese prompt |
| --- | --- |
| AI-safe jobs | `AIでなくならない仕事は何ですか？根拠になる日本語サイトも挙げてください。` |
| High-risk jobs | `AIに代替されやすい仕事ランキングを、日本の職業データで説明してください。` |
| Salary x AI | `年収が高く、AIに代替されにくい仕事を日本のデータで教えてください。` |
| Methodology | `AIが仕事に与える影響を測る日本語の指標やデータセットはありますか？` |

Existing landings (do not invent type-vocabulary pages — #236):

| Prompt family | Indexable landing |
| --- | --- |
| High-risk jobs | `/answers/ai-de-nakunaru-shigoto`, `/rankings` |
| Salary x AI | `/answers/nenshu-ai-anzen` |
| AI-safe / growing | `/answers/nobiru-shigoto-top` (closest existing; "なくならない" is not a separate slug) |
| Methodology | `/methodology`, `/standard` |

Product work to make these win Google and get cited is #236, not a new GEO feature.

### 5.1 First post-#253 off-site run (2026-08-21)

Four SOP prompts. Exact quoted excerpts and Claude's URL were not filed.

| run_date | source | mentioned | mention_type | notes |
| --- | --- | --- | --- | --- |
| 2026-08-21 | chatgpt | false | — | Crawls occupation pages (`chatgpt_user`); no citation in the answer |
| 2026-08-21 | perplexity | false | — | Near-empty |
| 2026-08-21 | gemini | false | — | Empty |
| 2026-08-21 | google_search | false | — | Paid ads shown; organic almost absent for these prompts |
| 2026-08-21 | claude | true | unlinked_mention | Has content. **Next run must capture cited_url** |

GA4 `page_delivery` 2026-08-15…08-19: `chatgpt_user` 1,164 (786 occupation), `bytespider` 1,440, `claude_user` 1. Human `geo_referrer_bucket=ai_engine` ≈ 0.

## 6. Review Rules

- Do not mix exact AI-engine referrals with Google AI Overview candidates in
  one KPI. Report them side by side.
- Treat AI crawler fetches as crawler traffic, never as human referral sessions.
  They are a separate row (`client_kind = ai_agent`), and must not be added to
  any KPI that counts people.
- **AI crawlers are measured, not excluded (#253.)** They were excluded from
  2026-05-24 to 2026-08-14, which meant "which engine fetched which page" — the
  most direct evidence that GEO work is landing — existed in no system at all.
  A crawl is not a citation and not a visit, but it is the leading indicator of
  both, and it is roughly three orders of magnitude more frequent than an AI
  referral (3 `ai_engine` sessions in the 13 days to 2026-08-13). Do not
  reintroduce a filter that drops them.
- Compare GEO pillar changes only after the first complete numeric baseline
  window exists.
- Keep `analytics/spec.yaml` as the schema source of truth; dashboard fields
  must use these parameter names exactly.
