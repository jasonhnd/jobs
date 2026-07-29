# /me Consolidation — Occupation-First Diagnostic (Design)

Status: draft for review. Extends [`WORKTYPE_VIRALITY.md`](./WORKTYPE_VIRALITY.md)
and [`WORKTYPE_DIAGNOSTIC.md`](./WORKTYPE_DIAGNOSTIC.md). Those docs rework how the
diagnostic result is **named, surfaced and spread**, and leave the 3-axis /
8-family / 24-variant scoring system unchanged. This doc keeps that scoring system
and changes **which question the product asks first**, which is upstream of both.

Base branch: `preview`. Human-merge gate. JA-only site; English spec with JA copy
strings inline (owner finalizes JA copy in review).

Tracks issue #233. Related: #234 (entry), #235 (rarity), #236 (SEO), #237 (share).

## 1. Why

### 1.1 The site asks the same person the same question in two places

`/me` and `/shindan` both ask the visitor for their occupation, both read the same
occupation index (`data.search.json` + `data.treemap.json`), both implement their
own search widget (`meInput`, `shindanJobInput`), and **neither links to the
other**:

```
me.astro      → /shindan links: 0
_me-inline.js → /shindan links: 0
shindan.astro → /me links:      0
_shindan.js   → /me links:      0
```

### 1.2 `/me` is already the occupation-first shape

`/me` today: enter an occupation → `meStatRisk` (AI impact) + `meStatWorkers` /
`meStatSalary` / `meStatSector` + ranking positions (`meRankList`) + similar
occupations (`meSimilar`).

That is the inverted flow this doc proposes. It exists, and it is the best
performing interactive surface on the site.

### 1.3 The numbers (GA4, 28 days to 2026-07-27)

| Page | Sessions | Share | Avg engagement |
|---|---|---|---|
| `/rankings` | 6,368 | 38.1% | 10s |
| `/compare` | 5,741 | 34.4% | 7s |
| `/map` | 1,650 | 9.9% | 41s |
| `/me` | 160 | 1.0% | **54s** |
| `/shindan` | 67 | 0.4% | 49s |
| `/gyakuten` | 33 | 0.2% | 19s |

`/me`: 160 sessions produced 161 `me_select_job` events — essentially everyone who
arrives completes the core action.

`/shindan`: 67 sessions → 35 saw a result (51%) → **4** used the occupation-gap
step → 1 shared.

### 1.4 Why the gap step is unused, and why merging fixes it for free

The gap step is the only part of `/shindan` that connects the visitor to the
site's actual asset. It sits at **position 11** of the result page, after ten
other blocks, and it asks the visitor to type their occupation — a second time if
they have already used `/me`.

In the merged flow the occupation is known from screen 1. **The gap needs no extra
input step at all.** The last step of `/shindan` is the first step of `/me`.

This is the core economic argument for consolidation: it is not that a merged page
would be tidier, it is that the merge deletes the input step that is suppressing
the feature.

## 2. Decisions

- **D1 — `/me` is the single "about me" surface.** The diagnostic becomes a
  deepening step inside it, not a parallel route.
- **D2 — `/shindan` 301s to `/me`.** Details and the share-link exception in §5.
- **D3 — A no-occupation branch is a first-class entry, not a fallback.**
  「まだ仕事がない / 変えたい」. Rationale in §4.4.
- **D4 — The 9 questions are reframed from identity to divergence.** Same items,
  same axes, same scoring. What changes is what the result claims: not *"you are
  X"* but *"you and this occupation differ on axis Y"*.
- **D5 — Scoring is unchanged.** No re-score, no re-map of the 556 occupations, no
  change to AIOIS-10 or to the 8-family / 24-variant system.

## 3. Non-goals

- Not restructuring 3 axes / 8 families / 24 variants into 16 types
  (`WORKTYPE_VIRALITY.md` §3 rules this out; the reasoning still holds).
- Not a hard MBTI → work-type mapping.
- No change to AIOIS-10 scoring or occupation-data integrity.
- Not solving discovery. Consolidation makes the product correct; it does not make
  more people see it. See §7.
- JA-only. No English UI copy.

## 4. Information architecture

### 4.1 Screen 1 — where you stand (exists today)

Occupation input → AI impact score, ranking positions, similar occupations.

Unchanged apart from what follows it. A visitor who stops here has already
received the thing they came for; 54s engagement indicates they do.

### 4.2 Screen 2 — do you fit it (the 9 questions, relocated)

Entered optionally from screen 1. Same 9 items from `worktype-copy.ts`.

The framing changes. Today the questions produce an identity label that restates
the visitor's own answers back to them — a visitor who picks
「人の表情や空気を見て動く」 is told 「空気の変化に気づき…」. Nothing in that result
is information they did not already have.

In the merged flow the questions are asked **against a known occupation**, so the
output is a comparison rather than a description.

### 4.3 Screen 3 — the divergence

The occupation's type code is already derived from AIOIS dimensions
(`src/data/projections/worktypes.ts`):

```
a1 = d6 − d2
a2 = d5 + 0.5·d4 − d1
a3 = d3 − (d1 + d4 + d6) / 3
```

split at the population median. The visitor's code comes from the 9 questions.
`computeGap(selfCode, jobCode)` already compares them and classifies the result as
`aligned` / `hidden_strength` / `hidden_risk` (`GAP` in `worktype-copy.ts`).

All of that logic exists and is reused as-is. The change is position: this is the
payoff of the flow rather than an optional footer.

### 4.4 The no-occupation branch

Screen 1 requires an occupation from the 556-row index. Students, job-seekers,
people between roles and people whose job is not in the index cannot start.

This branch is **not** a fallback for a lookup failure. 「仕事を変えたい」 is
plausibly a stronger intent than 「今の仕事は大丈夫か」, and it connects directly to
data the site already has — similar occupations, transfer paths, the rankings.

Shape (to be detailed in the code issue):

- Entry from screen 1: 「まだ仕事がない / 変えたい」
- Skips to the 9 questions with no occupation set
- Result maps the visitor's type onto occupations rather than onto a single job —
  i.e. the existing "representative occupations for this family" surface, which
  `/shindan` already renders (`shindanOccupations`), plus AI impact per occupation

This branch also receives the old share links that carry no occupation — see §5.3.

## 5. URLs and redirects

This is the part that can silently break existing shares. State shapes today:

| Route | Params |
|---|---|
| `/me` | `?id=<jobId>` |
| `/shindan` | `?self=<code>&variant=<variantId>&axes=<pattern>` and optionally `&job=<jobId>&gap=<kind>` |

`/shindan?self=…` is additionally intercepted before static routing by
`shindanShareRewriteTarget()` (`src/lib/shindan-share-route.ts`), which rewrites to
`/api/shindan-share` so the Edge renderer can emit per-result OG metadata. A blanket
`/shindan → /me` redirect in `vercel.json` would bypass that and break every result
link already shared.

### 5.1 Merged state shape

`/me` carries occupation and, when present, diagnostic state:

```
/me?id=<jobId>
/me?id=<jobId>&self=<code>&variant=<variantId>&axes=<pattern>
/me?self=<code>&variant=<variantId>&axes=<pattern>     ← no-occupation branch
```

`gap` is not carried: it is derivable from `self` + the occupation's code, and a
stored value could contradict a re-derived one after a re-score.

### 5.2 Redirect rules

| Request | Behaviour |
|---|---|
| `/shindan` (no params) | 301 → `/me` |
| `/shindan?self=…&job=<id>&…` | 301 → `/me?id=<id>&self=…&variant=…&axes=…` |
| `/shindan?self=…` (no `job`) | 301 → `/me?self=…&variant=…&axes=…` → no-occupation branch |

Because the mapping is conditional on query parameters, it belongs in the routing
middleware alongside the existing share rewrite, not in `vercel.json` `redirects`
(which matches on path). The existing `shindanShareRewriteTarget` and the new
redirect must be ordered deliberately and covered by tests — a crawler or a social
scraper hitting a shared link must still reach OG metadata, not a redirect chain
that loses it.

### 5.3 Old shares without an occupation

The gap step was used 4 times in 28 days, so nearly every result link already
shared carries `self` but no `job`. Those land on the no-occupation branch from
§4.4, which is a coherent destination rather than an error state. This is a reason
to build that branch in the same change as the redirect, not after it.

### 5.4 SEO

`/shindan` is in `sitemap.xml` (1 entry) and must be removed from it when the
redirect lands. Result URLs are `noindex, follow`
(`src/site/shindan-share-html.ts:65`) — correct, and unchanged. Re-capture SEO
baselines; `verify-internal-links` will flag any in-repo `/shindan` link left
behind (`gyakuten.astro:235,338`, `models.astro:284`, `TopNav.astro:37`,
`MobileNav.astro:65`).

## 6. Where this contradicts WORKTYPE_VIRALITY.md

Recorded explicitly so the two docs do not silently disagree.

**§S5 — single share hero.** That doc fixes the share unit as one memorable
identity (variant name + one line), with axes / family / rarity kept inside the
page. Implemented today as
`'#AI働き方診断 私は【{タイプ名}】。{一言} {リンク}'`.

The reasoning in §1 problem 1 — that a proprietary code carries zero recognition to
a share recipient — is sound and this doc does not revert it. The gap is that §S5
chose between *identity name* and *family＋variant＋code*, **both of which are our
own vocabulary**. It did not consider the AI-impact score, because at the time the
result did not reliably contain one.

After consolidation a score is present on screen 1, so the option becomes
available and should be re-decided. Tracked in #237; not settled by this doc.

**§4.B — entry.** That doc plans entry via global nav plus a homepage first-screen
band. The nav entry shipped (`TopNav.astro:37`, `MobileNav.astro:65`) and `/shindan`
still sees 67 sessions per 28 days; the homepage band did not ship, and `/` is 2.9%
of traffic. The traffic actually lands on `/rankings` and `/compare` (71% of
entering sessions), which that doc does not mention. Tracked in #234.

## 7. Sequencing

**Entry (#234) precedes consolidation.**

At 160 sessions per 28 days — about 6 visitors a day — a consolidated `/me` would
produce roughly 85 completions in a 28-day window. That is not enough to tell
whether the reframed questions retain or repel people, whether the share rate moved,
or whether a free gap step gets used: at that sample, a two-visitor swing is the
size of the effect being measured.

The usual objection — *do not send traffic to a product that is not finished* —
does not apply here, because `/me` today is already the best-performing surface on
the site. It is not half-built; it is well-built and unseen. Routing traffic to it
is not spending traffic on an experiment.

Order:

1. **`[entry]`** (#234) — in-content entry from `/rankings` and `/compare` into
   `/me`, attached to occupation context. The only step that changes the order of
   magnitude.
2. **Observe** — let `/me` accumulate a usable sample.
3. **`[consolidate]`** — screens 2 and 3, the no-occupation branch, the redirect.
   Requires funnel instrumentation to exist first (§8).
4. **`[share]`** (#237) — only meaningful once a score is on screen 1.
5. **`[seo]`** (#236) — only decidable once the page shape is settled.

**#235 (rarity) is independent** and can be done at any point.

## 8. Measurement

Funnel instrumentation must exist **before** consolidation ships, or the redesign
cannot be evaluated against the baseline.

Currently there is no `shindan_start` event and no per-question event, so quiz
abandonment cannot be measured at all — only the completion endpoint
(`shindan_result_view`) is visible. Any event added must be registered in
`analytics/spec.yaml`; `scripts/check-analytics-spec.ts` enforces this in
`verify:gates` (#231).

Baseline to beat, per 28 days:

| Metric | Today |
|---|---|
| `/me` sessions | 160 |
| `/shindan` sessions | 67 |
| Result completion | 51% |
| Occupation-gap use | 4 |
| Shares | 1 session, 4 events |
| Engagement | `/me` 54s, `/shindan` 49s |

## 9. Open questions for review

1. Screen 2 entry: automatic continuation after screen 1, or an explicit CTA? An
   automatic continuation risks pushing the 54s visitor into a quiz they did not
   ask for.
2. Does the no-occupation branch need its own URL, or is a state within `/me`
   enough? A distinct URL is shareable and indexable; a state is simpler.
3. Does `/gyakuten` (33 sessions, 19s) stay a separate route after consolidation?
   It is the 24-type roster and overlaps with screen 3's output.
4. JA copy for screens 2 and 3, and for the no-occupation branch — owner finalizes.
