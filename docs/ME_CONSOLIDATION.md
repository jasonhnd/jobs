# /me Consolidation — Occupation-First Diagnostic (Design)

Status: occupation-first `/me` shipped to production (2026-08-21, #273).
JA copy signed 2026-08-20. Share is measurement-led when a job is known (#237).
This consolidation (#233) does **not** wait on #236. SEO/GEO is a separate
programme and is parked until the owner starts it. Extends [`WORKTYPE_VIRALITY.md`](./WORKTYPE_VIRALITY.md)
and [`WORKTYPE_DIAGNOSTIC.md`](./WORKTYPE_DIAGNOSTIC.md). Those docs rework how the
diagnostic result is **named, surfaced and spread**, and leave the 3-axis /
8-family / 24-variant scoring system unchanged. This doc keeps that scoring system
and changes **which question the product asks first**, which is upstream of both.

Base branch: `preview`. Human-merge gate. JA-only site; English spec with JA copy
strings inline. Owner signed the `/me` strings in §4.6 on 2026-08-20.

Tracks issue #233 (closed 2026-08-22: product shipped; not blocked by #236).
Related and **independent**: #234 (entry number, closed 2026-08-22 on the
17-day cut; do not wait 28 days), #235 (rarity, closed),
#236 (SEO/GEO, parked), #237 (share, closed).

## 1. Why

### 1.1 The site asks the same person the same question in two places

`/me` and `/shindan` both used to ask the visitor for their occupation, both read
the same occupation index, both implement their own search widget, and neither
linked to the other. That is the problem this doc started from. After the 2026-08-17
lock, `/me` links to `/shindan` as the no-occupation 9-question entry; `/shindan`
is no longer a second occupation-first product.

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

- **D1 — `/me` is the single occupation-first "about me" surface.** The 9
  questions there are a deepening step against a known job, not a parallel
  identity product.
- **D2 — `/shindan` stays as the no-occupation 9-question entry.** It is not
  301'd away as a whole. Occupation-bearing old links (`?job=`) 301 to `/me`.
  Details in §5.
- **D3 — A no-occupation branch is a first-class entry, not a fallback.**
  「まだ仕事がない / 変えたい」. The public path is `/shindan` (`NO_OCC_PATH`).
  Rationale in §4.4.
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

Entered from screen 1 by an **explicit CTA, not automatic continuation**, placed
immediately after the score and ranking block rather than at the end of the page.
Shipped selectors on `/me` (#257): `#meQuizCta` / `#meQuizOpen` after
`#meRanksHead`; quiz is `#meQuiz` / `#meQuizForm` and stays hidden until the
CTA is clicked. `shindan_start` fires on that click. Screen 3 (#258) is
`#meGap` immediately after the quiz; `gap` is not stored in the URL.

Three reasons, in order of weight:

1. **It preserves the property that makes screen 1 work.** A visitor can stop after
   the score and still have received what they came for. 54s engagement says they
   do. Auto-continuation turns the 9 questions into a toll gate on a result the
   visitor already has.
2. **It is the only way to measure intent.** If everyone is pushed into screen 2,
   the funnel cannot distinguish "wanted the deeper answer" from "was carried
   there", and the reframed questions cannot be evaluated at all (§8).
3. **91% of sessions are mobile.** Scrolling a phone visitor into a quiz they did
   not request is hostile on a small screen.

The objection is that an explicit CTA is what already failed — the nav entry is a
CTA and `/shindan` still sees 67 sessions per 28 days (#234). The difference is
context: the nav entry is a **feature name** (「診断」) shown before the visitor has
any reason to want it. This CTA answers the question screen 1 has just raised in
the visitor's mind — *this job scores 7.2, does that apply to me?* — and appears at
the moment they are holding that question.

The same 9 items from `worktype-copy.ts` are used, unchanged.

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

**It keeps `/shindan` as that route** (owner lock 2026-08-17). A state inside
`/me` cannot serve three properties this branch needs: it is a distinct intent
worth entering directly, it is the landing target for every occupation-less share
link already in circulation (§5.3), and it is the one part of this flow with
plausible independent search demand — unlike our type vocabulary (#236).

`NO_OCC_PATH` in `src/site/no-occ-path.ts` is `/shindan`. `/me` screen 1 links
there. The brief `#259` alias `/me/start` 301s to `/shindan`. A later 転職-anchored
public name is still #236; rename = one constant plus a redirect.

### 4.5 `/gyakuten` does not become a peer surface

`WORKTYPE_VIRALITY.md` §1 calls `/shindan` and `/gyakuten` *"the two flagship,
share-driven surfaces"*, and §S4 keeps the 図鑑 / めくる / trophy→dare layer on the
grounds that *"it is the viral loop"*.

The data does not support that framing. `/gyakuten` takes **33 sessions and 19s
average engagement** — the lowest engagement of any surface measured, below
`/rankings` at 10s only because that page is a list people scan and leave.

A 図鑑 works on a collection mechanic: seeing the types you do not have creates a
reason to get them. That requires a population of people who already hold a type
and can compare. With 51 results produced in 28 days there is no such population,
so the loop has nothing to loop over. Its premise is not wrong, it is unfunded.

**Recommendation: keep the route, stop treating it as a flagship, and invest
nothing in it until the diagnostic has volume.**

- Keeping costs nothing — it is built, and removing it has SEO and inbound-link
  consequences that belong to #236, not here.
- It should not appear alongside `/me` in nav or entry work as though it were an
  equal destination; #234's entry work points at `/me`, not at `/gyakuten`.
- Its content is anchored to our own type vocabulary, which is exactly the pattern
  #236 concludes does not attract search demand. If it is ever reworked, that is
  the thing to change — not the game layer.

Screen 3 overlaps with the 24-type roster, but the overlap is not a reason to act
now: after consolidation, screen 3 is about *the visitor's own occupation* and the
roster is about *all types*. Whether the roster still earns a route is a question
worth asking once there is traffic to answer it with.

### 4.6 JA copy (owner-signed 2026-08-20)

Voice follows `WORKTYPE_VIRALITY.md` §S2: address 「あなた」, lead with the benefit,
no mechanism-describing framing. The strings below are the live `/me` copy.

**Screen 1 → screen 2 CTA**, placed directly under the score and ranking block:

> この仕事のAI影響度は分かりました。
> では、あなた自身はどうでしょう。
>
> `[ 9問で確かめる ]`

**Screen 2 intro:**

> 同じ仕事でも、向き合い方は人によって違います。
> 9問で、あなたとこの仕事の距離を見てみましょう。

**Screen 3 — gap headings.** The three `GAP` entries in `worktype-copy.ts` were
written for the old framing, where the occupation was one the visitor looked up.
Here it is *their own*, so the copy addresses それ directly:

| Kind | Old `/shindan` GAP | `/me` (signed) |
|---|---|---|
| `aligned` | 自然に力を出しやすい組み合わせ | この仕事は、あなたの得意な進め方に近いです |
| `hidden_strength` | まだ使い切っていない強みがあります | あなたの強みが、この仕事ではまだ眠っています |
| `hidden_risk` | 働き方を更新する余地があります | この仕事での進め方は、これから変えていけます |

`hidden_risk` deliberately avoids anything that reads as a warning about the
visitor's job. The site's disclaimer already states that AI 影響度 is model output
and not a statistical forecast; the result copy must not quietly promote it into a
prediction about someone's livelihood. Owner accepted this wording on 2026-08-20.

**No-occupation branch — entry on screen 1:**

> 仕事がまだ決まっていない方、変えたいと考えている方はこちら

**No-occupation branch — intro:**

> 今の仕事から選ばなくても大丈夫です。
> 9問であなたの働き方のタイプを見て、そこから合いそうな職業を探しましょう。

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

### 5.1 State shape

```
/me?id=<jobId>
/me?id=<jobId>&self=<code>&variant=<variantId>&axes=<pattern>
/shindan
/shindan?self=<code>&variant=<variantId>&axes=<pattern>     ← no-occupation result
```

`gap` is not carried on `/me`: it is derivable from `self` + the occupation's
code, and a stored value could contradict a re-derived one after a re-score.

### 5.2 Redirect rules

| Request | Behaviour |
|---|---|
| `/shindan` (no params) | stays — no-occupation 9-question entry |
| `/shindan?self=…` (no `job`) | stays; share rewrite to `/api/shindan-share` for OG |
| `/shindan?self=…&job=<id>&…` | humans 301 → `/me?id=<id>&self=…&variant=…&axes=…`; scrapers keep the share rewrite so OG is not lost |
| `/me/start` | 301 → `/shindan` (query preserved) |

Conditional mapping lives in routing middleware next to `shindanShareRewriteTarget`.
The path-only `/me/start` alias is also in `vercel.json` so the local e2e static
server follows it. Order: alias 301 → (if not a bot) occupation 301 → share
rewrite. Tests cover all three rows.

### 5.3 Old shares without an occupation

The gap step was used 4 times in 28 days, so nearly every result link already
shared carries `self` but no `job`. Those stay on `/shindan`, which is the
no-occupation entry.

### 5.4 SEO

`/shindan` stays in `sitemap.xml` (it is the public no-occupation entry). Result
URLs remain `noindex, follow` (`src/site/shindan-share-html.ts:65`). Nav and
`/gyakuten` / `/models` CTAs keep pointing at `/shindan`. Recapture SEO baselines
if `/me` hrefs or the retired `/me/start` page set change.

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
available. Owner ruled **measurement-led** (2026-08-20, #237): share text and
the `/api/og` worktype card lead with `{職業}のAI影響度は{点数}` when a job
is known. No-occupation `/shindan` shares stay identity-only because there is
no number. `WORKTYPE_VIRALITY.md` §S5 is amended in the same change.

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
   magnitude. Shipped in production (PR #251). Closed 2026-08-22 on the
   2026-08-16 17-day cut (~1.5×, not 10×). Owner: do not wait another 28 days.
2. **Observe** — let `/me` accumulate a usable sample. 17-day cut (2026-08-16):
   ~1.5× `me_open`, not 10×. Owner continued the series anyway.
3. **`[consolidate]`** — screens 2 and 3, the no-occupation branch, the redirect.
   Requires funnel instrumentation to exist first (§8). Shipped on `preview`
   (#256–#260, PRs #261–#265), promoted to production 2026-08-21 (#273).
4. **`[share]`** (#237) — measurement-led when a job is known; identity-only
   on the no-occupation `/shindan` result. Share text and worktype OG card
   decided together. Shipped to production (#273).
5. **`[seo]` / `[geo]`** (#236) — **not part of closing this consolidation.**
   Separate programme. Parked (owner 2026-08-22): do not start until asked.
   Page shape is settled, so #236 is unblocked, but #233 does not wait on it.

**#235 (rarity) is independent** and can be done at any point. **#234** closed
2026-08-22 on the existing measurement; do not hold a 28-day clock.

## 8. Measurement

Funnel instrumentation must exist **before** consolidation ships, or the redesign
cannot be evaluated against the baseline.

`shindan_start` and `shindan_step` ship on today's `/shindan` (#256). Start
fires once on the first answered question (not on a restored or shared
result). Each newly reached answered-count fires `shindan_step` with GA4
builtin `value` = 1..9 — no new event-scoped dimension. Completion remains
`shindan_result_view`. Abandonment is `shindan_start` without
`shindan_result_view`; per-question drop is the `value` series on
`shindan_step`. Any further event must stay registered in
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

## 9. Resolved and still open

Settled in review (2026-07-29):

| Question | Decision | Where |
|---|---|---|
| Screen 2 entry | Explicit CTA, placed after the score — not automatic continuation | §4.2 |
| No-occupation branch URL | `/shindan` (`NO_OCC_PATH`); `/me/start` 301s there | §4.4 |
| `/gyakuten` | Keep the route, drop the flagship framing, invest nothing until there is volume | §4.5 |
| JA copy | Owner signed 2026-08-20; live as §4.6 | §4.6 |

Shipped on `preview` (2026-08-20), production 2026-08-21 (#273):

| Unit | Issue | PR | Live check |
|---|---|---|---|
| Funnel events | #256 | #261 | `shindan_start` / `shindan_step` |
| 9 questions on `/me` | #257 | #262 | `#meQuizCta` after rankings |
| Gap as screen 3 | #258 | #263 | `#meGap`; `gap` not in the URL |
| No-occupation entry | #259 | #265 | `/shindan`; `/me/start` → `/shindan` |
| Occupation-bearing 301 | #260 | #265 | humans `/shindan?job=` → `/me`; scrapers keep OG |

Desktop top nav 「自分の現在地」 and `/me` cream body wash shipped as follow-ups (#267, #266). `#260`'s original table (bare `/shindan` 301, drop from sitemap) was superseded by the 2026-08-17 lock in D2.

This consolidation is complete. Independent of it:

1. **#234** — closed 2026-08-22. 17-day production cut: `me_open` ~1.5×, not
   10×; rankings path is real; compare `MeEntry` was 0 clicks. Owner: do
   not wait another 28 days.
2. **#236** — SEO/GEO programme. Parked 2026-08-22. Do not start until the
   owner asks. Not a closer for #233. A 転職 rename of `/shindan` and the
   24-type roster question stay there if they are ever picked up.
3. **Whether the 24-type roster still earns a route** — deliberately deferred.
