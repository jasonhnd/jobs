# Ordinary / Pro split contract — stage 0

**Planning contract, JOB_0223 / Issue #892, 2026-10-08.** No routes, redirects,
public copy, analytics, or Design canon are implemented by this document.
The owner chose an ordinary edition on the main domain and a Pro edition under
`/pro`. Pro is currently free, public, searchable, and available for AI citation.
Future charging is a separate product/access decision.

## Evidence and decision precedence

Repository line citations below refer to the fetched `origin/preview` baseline
`583c584b57e4c17a108bd9003d925b7c63fa2cef`. Recheck lines when implementing.
The complete planning evidence is in the owner workspace at
`/Users/ms23m2/AgenticCoder/jobs/.cache/ux-2026-10-08/` (called **R** below):

| Evidence | Scope |
| --- | --- |
| `R/pro-split-roadmap.md:1-19,21-59` (JOB_0222) | Sequence, routing, shared data/body, occupation 404 exception |
| `R/pro-split-roadmap.md:61-129` | Redirect authorization, canonical, sitemap, JSON-LD, llms |
| `R/pro-split-roadmap.md:131-175` | Links, analytics, #577, free access, Design approval |
| `R/pro-split-roadmap.md:177-234` | Phases, screenshot matrix, local checks, preview isolation |
| `R/pro-split-roadmap.md:246-297` | Options 2A / 3A / 4 / 5 / 6B / 7A |
| `R/rankings-split-report.md:21-59,78-97` (JOB_0220) | All 39 rankings, eight retained URLs, sorting and migration risks |
| `R/REPORT.md:1-25,56-86` (JOB_0209) | Dated inventory and 25 representative surfaces; approximate 845 HTML pages |

The JOB_0223 brief records the subsequent decisions and overrides the roadmap's
unresolved recommendations: build Pro and move existing content first; then
simplify ordinary pages. Keep `/about`, `/privacy`, `/compliance` shared at their
root URLs, together with root infrastructure (2A). Apply canonical/noindex 3A,
including exclusion of the four noindex rankings from the future sitemap.
Sign new public Japanese by page family (6B). Freeze #577's old-path observation
before any production switch, then request separate owner promotion approval (7A).

**Pending owner decision:** redirect configuration authorization (option 4),
and ordinary visual approval / minimal Design scope (option 5). These do not
block this documentation card. They gate the corresponding implementation;
this document grants no configuration or production authority. GitHub Actions
remain disabled; use real local acceptance evidence and independent review
([AGENTS.md](../AGENTS.md), lines 65-73, 130-167). Do not restore workflows.

## PS-01: Final route and old-address policy

The generated [route manifest](pro-split/route-manifest.json) is the exhaustive
39-ranking list and the source-derived Astro **template** mapping. Its
`stage: planning-only` and `redirectAuthorization: pending-owner-decision`
are deliberate. `oldStatus` means the intended final status, not current HTTP.
Template parameters are valid generated pages only, never blanket redirect
patterns. Stage 1B must expand them against built valid URLs and verify exact
old/new sets before deploying configuration.

| Family | Ordinary final route | Pro final route | Old address after authorized cutover |
| --- | --- | --- | --- |
| 556 occupations | Existing `/<id>`; ID 404 at `/occupations/404` | `/pro/<id>` (including `/pro/404`) | 200; never redirect ordinary occupations to Pro |
| Eight selected rankings | `/rankings/<slug>` | `/pro/rankings/<same-slug>` | 200 |
| Other 31 rankings | No ordinary detail | `/pro/rankings/<same-slug>` | Each valid old page → matching Pro page, 301 |
| Ranking index | `/rankings` (eight selections) | `/pro/rankings` (all 39) | 200 |
| Home, map, sectors/index and 16 sectors, shindan, me | `/`, `/map`, `/sectors`, `/sectors/<sector>`, `/shindan`, `/me` | No duplicate required | 200 |
| Shared operational/legal pages | `/about`, `/privacy`, `/compliance` | Link the same root URLs | 200 |
| Compare/index and pairs | None | `/pro/compare`, `/pro/compare/<pair>` | Valid old pages → final matching URLs, 301 |
| 14 classification families, indexes and slugs | None | `/pro/{skills,interests,abilities,knowledge,values,education,training,work-styles,employment-types,life-balance,entry-paths,careers,licenses,explore}/...` | Valid old pages → final matching URLs, 301 |
| q, answers, models; indexes and all existing subpages | None | `/pro/q/...`, `/pro/answers/...`, `/pro/models/...` | Valid old pages → final matching URLs, 301 |
| methodology, data, standard, haid, gyakuten | None | `/pro/<same-path>` | Exact old pages → final matching URLs, 301 |
| aiadoption current and releases; yearly index and reports | None | `/pro/aiadoption`, `/pro/aiadoption/<release>`, `/pro/yearly/...` | Valid old pages → final matching URLs, 301 |
| New Pro entrance | None | `/pro` | New 200 page; no old URL |
| Infrastructure | `/api/*`, `/data.*.json`, `/sitemap.xml`, `/image-sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/robots.txt`, assets | Reuse root endpoints | Existing behavior; `/404` remains the noindex error document |

Eight ordinary slugs: `ai-risk-high`, `workers`, `ai-risk-low`, `high-demand`,
`salary-safe`, `short-hours`, `hourly-wage`, `salary`. The advertising landing
`/rankings/ai-risk-high` stays 200 throughout. Keep the complete RANKING_META and
sorting registry, because Pro, OG and `/me` position projections depend on it
(`src/views/rankings-meta.ts:124-176`, `src/data/projections/me-positions.ts:248-260`).

ID 404 is an occupation, distinct from the root error document
(`src/lib/urls.ts:10-26`, `src/pages/[...id].astro:43-67`,
`src/pages/404.astro:17-21`). Generate Pro using numeric IDs, not by prefixing
`occupationPath(404)` (which would incorrectly give `/pro/occupations/404`).
Unknown IDs/slugs and invalid classification paths return real 404s, without
redirects to Pro home or nonexistent targets. `/pro/404` must be 200 for the valid
occupation; `/404` and unknown paths must retain their error semantics.

Approved redirect implementation should use explicit `statusCode: 301` (not
`permanent: true`, which the current aliases use for 308). Authorization must
name the configuration scope in its Issue. No middleware workaround is
permitted to bypass approval. Create and verify target 200 pages first, then
activate redirects in the same tested deployment. Keep every redirect one hop,
same host on preview, with query values, repeated parameters, UTM/gclid/fbclid
and filter state preserved. Fragments are browser-side: preserve existing DOM
IDs and check anchors in a browser. Ordinary occupation `#sec-*` / `#chp-*`
links need compatible anchors plus links to matching Pro sections.

Model aliases flatten to the newest **dated run**, retaining `@date`: existing
`/models/<bare>` and new `/pro/models/<bare>` → `/pro/models/<model@date>`;
all old dated run pages → their matching Pro run. The manifest derives targets
from score batches and checks current aliases against `vercel.json`, using
`scripts/check-model-redirects.ts:44-80`. Explicit legacy aliases such as
`/ja/about/methodology` go straight to `/pro/methodology`; shared `/about`
aliases retain their meaning. Ordinary occupation aliases keep their ordinary
root targets: `/occ/:id` and `/occ/:id-:slug*` (the existing numeric-ID patterns)
still target `/:id`, while `/occ/404`, `/occ/404-:slug*`, `/ja/404` and
`/ja/404.html` still target `/occupations/404`. `/ja/about` and
`/ja/about/glossary` still target `/about` (`vercel.json:134-151,168-186`).
Expand `/ja/:path*` and `/en/:path*` against valid built routes using each current
destination's page family: root-retained families stay at root; migrated families
go in one hop to their final Pro URL. Never redirect ordinary occupation aliases
to Pro and never introduce a `/pro/:path*` blanket redirect. Preserve existing
specific-rule precedence, including ID 404, before expanding language wildcards.
Update the existing model-redirect gate at implementation time; do not disable it.

Retain redirects long term (at least one year). Cached permanent redirects
outlive code rollback; rollback planning must keep final Pro targets reachable.

## PS-02: Canonical, sitemap and crawler policy (3A)

| Content state | Canonical | Main HTML sitemap eligibility |
| --- | --- | --- |
| Stage 1A duplicate Pro occupations and rankings | Corresponding ordinary old URL: occupations `/<id>` (ID404 `/occupations/404`), rankings `/rankings/<slug>` | Ordinary canonical URLs only; no duplicate Pro entries |
| Stage 2 genuinely simplified ordinary occupation and complete Pro occupation | Each edition self-canonical | Both editions |
| Stage 1B onward: eight rankings with equivalent ordinary/Pro tables | Ordinary self; Pro points to ordinary | Ordinary only |
| Eight Pro rankings after separately verified substantial independent analysis | Each edition may self-canonical after content review | Both if indexable |
| After authorized stage 1B migration: 31 rankings and other complete pages | Final Pro URL self-canonical; never old 301 URL | Final indexable canonical URLs, preserving existing family eligibility |
| Stage 1B onward: four existing noindex rankings | Pro self-canonical + `noindex, follow` | Excluded under selected 3A |
| After stage 1B migration: model run subpages | Final Pro URL self-canonical, indexable | Still omitted under existing model-subpage policy |

Every manifest ranking has `phase1ProCanonical = oldPath` while its old page
is still 200 in stage 1A, including all 31 rankings scheduled to migrate.
`proCanonicalStage: "1B"` labels the existing `proCanonical` field as the policy
after the authorized migration: eight retained copies still point to their old
ranking URL, while 31 migrated copies self-canonicalize to `proPath`. No ranking
canonical points to an occupation URL. Noindex is inherited in both stages.

The four exclusions are `self-employed-typical`, `freelance-friendly`,
`ai-safe-young-workforce`, `ai-safe-short-hours`
(`src/views/rankings-meta.ts:97-113`; rendering: `src/pages/rankings/[type].astro:48`).
They currently remain in sitemap intentionally; 3A changes that future policy,
not the current source in this PR. Low traffic does not authorize more noindex.
Model subpages being absent from sitemap does not mean noindex
(`src/pages/models/[model].astro:82-90`).

Keep root sitemap/robots/llms entrances. Sitemap generation is explicit
(`src/views/sitemap.ts:151-276`), including the later careers (244-246), licenses
(250-252), q (256-258), answers (262-264), yearly (268-271) and explore (274-276)
entries in that same file. Moving Astro files does not update these URLs. Compare
sets, not the existing >=600 floor: 556 ordinary occupations; 556 Pro
occupations generated (stage-dependent sitemap inclusion); 39 Pro rankings;
eight ordinary rankings; 31 old ranking redirects; all valid migrated family
paths matched exactly. HTML sitemap entries must be 200, indexable canonical,
without query duplicates or redirects. Check machine-file entries separately
under their existing eligibility. Image sitemap can keep ordinary occupation
URLs and shared `/api/og?id` images (`src/views/image-sitemap.ts:83-85`).
The approximate 1,410 future HTML count is a planning estimate, not acceptance.

Separate page URL from canonical URL, and edition from access state. Update
canonical / `og:url` / existing Japanese alternates together
(`src/layouts/BaseLayout.astro:119-125,143`), plus occupation bindings/renderers
(`src/pages/_id-bindings.ts:324-328`, `src/pages/_id-renderers.ts:150-170`), ranking
bindings (`src/pages/rankings/_rankings-bindings.ts:40-67`) and model views
(`src/views/model-run-page.ts:88,142-143`). Both editions are Japanese; edition
switches are not hreflang language alternates. Query variants canonicalize to
unparameterized pages. Search engines may select another canonical; there is
no promise that both editions will be indexed.

Preview keeps host-dependent `X-Robots-Tag: noindex, nofollow`; production Pro
remains publicly crawlable. Do not blanket `/pro` with noindex, Disallow,
nosnippet or a login wall. Preview robots still permits crawl so noindex can
be seen (`middleware.ts:95-108`, `src/lib/middleware/geo-referral.ts:98-129`).

## PS-03: JSON-LD, llms, data and free access

Use distinct edition WebPage `@id`/URL, breadcrumbs, titles and descriptions.
Keep one WebSite, publisher/organization and Dataset identity. Occupation
entities keep the **ordinary canonical occupation URL + `#occupation`** as
stable identity across both edition WebPages, including the 404 exception.
This is separate from Pro page canonical. Ordinary JSON-LD includes only
its visible summary properties; Pro can include the full visible content.
Current nodes couple both identities to canonical
(`src/views/occupation-jsonld.ts:337-367`): extend the adapter and
`verify-occupation-routes.ts` assertions for the two URL roles.

ItemList page links follow edition to final URLs, while entity IDs remain
stable. Pro breadcrumbs use final Pro hubs. Remove ordinary FAQPage,
additionalProperty, ItemList and speakable targets when the matching visible
sections disappear. Current speakable targets are `.ai-fact`, `.risk-rationale`,
`.faq-ai-replacement .faq-answer` (`src/views/occupation-jsonld.ts:351`); use
real visible summary selectors on ordinary, preserve full sections on Pro.
Hidden complete prose or JSON-LD is not a substitute for ordinary simplification.

Generate `/llms.txt` and `/llms-full.txt` from their sources, not hand-edited
outputs (`src/site/geo-render.ts:79-144,170-178`, `src/site/geo-build.ts:26-45`).
Describe both editions, link full methods/standards/models/answers/data to Pro,
selected ranking entrance to ordinary, full ranking entrance to Pro. Keep one
facts/date/denominator/score definition/source set, and keep freshness checks.
llms/JSON-LD/speakable are descriptive outputs, not proof of actual AI citation.

Share existing data → ETL → JSON → graph/page-data → view/template → Astro.
Do not duplicate scoring data, overwrite runs or recalculate browser bands.
Use unrounded inputs for averages and displayed one-decimal values for the
existing <4.0 / 4.0–6.9 / >=7.0 bands (`docs/DATA_ARCHITECTURE.md:49-50`).
Ordinary summaries have at most three primary numbers (planned AI change,
salary, monthly hours), signed advice, similar occupations and a real Pro link.
Missing values remain missing. Pro retains model reasons verbatim, full data,
sources and chapters. Prefer a shared full occupation body and a separate
summary view model over copied page shells or many conditional fragments
(`src/pages/[...id].astro:13-33,50-65,87-119`).

Pro stays static, public and free: no login/payment SDK, dummy locks or false
paid structured-data claims. Future paid access needs a new permission/licence,
data/llms/cache and launch plan; hiding HTML alone cannot close public JSON.

## PS-04: Unified links and analytics classification

Implement one route-policy source for family/slug, ordinary/Pro paths,
canonical, noindex, sitemap eligibility, old route and redirect state. Keep URL
helpers in `src/lib/urls.ts`; avoid data-layer imports of rendering modules.
The stage-zero script is documentation tooling, not that runtime policy.

Cover desktop/mobile nav, Footer, breadcrumbs, switches, home body links,
search, 404 recommendations, occupation spokes, related rankings, compare,
classification/q/answers ItemLists, `/me` browser-generated links, diagnosis/share
landing, GEO and JSON-LD. Both frontmatter and inline browser scripts consume
the same mapping. Home ranking cards are at `src/index-source.html:388-647`;
other body entrances include `/gyakuten` at `src/index-source.html:57`,
`/compare` at `src/index-source.html:148` and the retained `/rankings` entrance
at `src/index-source.html:660`. Related-ranking href producers are at
`src/templates/Ranking.ts:255` and hub-card href producers at
`src/templates/Ranking.ts:419`; further producers include
`src/views/spoke-hub-graph.ts:162-167`, `src/pages/_me-inline.js:696` and
`src/pages/404.astro:235-238`.
Keep `/me`, `/shindan`, `/map`, `/sectors`, legal, API/data/assets and external
links in their intended root/external locations. No universal href prefixing.

Switch occupations by ID, selected rankings by slug. A Pro family without an
ordinary counterpart returns to ordinary home. Use real anchors without JS;
validate aria-current, keyboard focus and mobile-menu return behavior. Ordinary
menus prioritize occupation/diagnosis, eight rankings, map/sectors and Pro;
Pro groups full rankings, compare/classifications/questions and data/methods.
New Japanese navigation, summaries, title/meta/OG and explanations require
exact owner-signed strings/placeholders by family. The supplied CTA
`Pro で詳しく見る` is already specified; other roadmap draft strings are not
approval. This PR introduces no visitor-facing string.

`landingFamily` currently sees only root families
(`src/lib/middleware/geo-referral.ts:9-19`), so `/pro/rankings/...` becomes `other`.
Stage 1B must map valid Pro routes to the same logical family and track edition
separately. Include ordinary `/occupations/404` and Pro `/pro/404` as occupation,
while distinguishing the root error document. Test root/Pro, unknown paths and
prefix boundaries; do not strip arbitrary prefixes or count errors as occupations.
Keep browser `page_view` separate from middleware `page_delivery`
(`src/lib/middleware/mp-hit.ts:49-59`); do not alter measurement units or
hash-pinned analytics inline scripts for a path-classification change.

## PS-05: #577 freeze and comparison plan

[PR #577](https://github.com/jasonhnd/jobs/pull/577) merged at
2026-09-21T12:53:07Z (read via `gh pr view` on 2026-10-08). Its post-deployment
plan is a repeat GSC family comparison after approximately three weeks:
occupation CTR >=2.0% with impressions flat or increasing. **Merge time is not
deployment time.** Three weeks from September 21 is approximately October 12;
verify the actual deployment start before setting a production date.

Before migration/title/ordinary changes affect production, an authorized role
must freeze the last complete old-path GSC windows, fixed ranking slugs and
occupation IDs, clicks/impressions/CTR/position, deployment SHA/date and exclusion
set. Exclude the same four noindex rankings from both windows
(`src/views/rankings-meta.ts:104-107`). Preserve the prior before 7/25–8/23 and
after 9/1–9/19 definitions as history, not a new live measurement.

Moving 31 rankings, rewriting eight, or switching occupation canonicals treats
the old control. After cutover, aggregate old+new URLs by fixed slug/ID, annotate
edition, canonical consolidation and migration date, exclude the same four.
Without an untreated control, report migration outcomes rather than attributing
them to the title experiment. GSC access/results, actual deployment start and
advertising final-URL attribution are unverified here; PV/referrer counts are
not sessions or a replacement for title CTR. Development proceeds now;
production waits for the window/evidence and separate owner promotion approval.

## PS-06: Preview acceptance with analytics isolation

Set interception **before the first navigation** in local Microsoft Edge:
block service workers; route by exact host/path for Google tag/analytics and
analytics.google.com collectors, Google ads/doubleclick, Meta connect.facebook
and facebook `/tr`, Twitter ads/analytics/t.co pixels, Cloudflare beacon/collect,
Vercel `va.vercel-scripts`/vitals and same-origin `/_vercel/insights/*` and
`/_vercel/speed-insights/*`. Do not broadly block same-origin API or ordinary
links. Retain categorized abort counts, not secret query strings/tokens.

Browser interception **cannot block server → GA4 Measurement Protocol POSTs**.
`shouldSendMpHit` has no host input (`src/lib/middleware/mp-hit.ts:5-17,38-45`);
preview noindex does not suppress it. Zero browser collector requests alone
cannot establish server isolation.

- Rejected-consent screenshots: set `cookieConsent=rejected` before navigation,
  and verify the tested middleware SHA and its rejection branch.
- First-visit cookie-banner screenshots: keep real unselected consent and use
  an explicit test UA containing HeadlessChrome or Playwright. First prove its
  `classifyClientKind` result is `other_bot` and MP is suppressed on that SHA
  (`src/lib/middleware/client-kind.ts:25-26,99-105`, `mp-hit.ts:40-41`). Named AI
  crawler UAs are intentionally measured, so never impersonate them for QA.
- If deployment SHA/MP suppression cannot be proven, take first-visit evidence
  locally with empty analytics configuration and mark that preview state
  **unverified**. Do not read/copy GA4 secrets or change production envs.

Use local built output for full route/link/JSON-LD scans. Live pre/deployment
checks are one bounded pass, concurrency <=4; never script production crawling.
On 429/403 challenge/unavailability, record and stop that pass, diagnose with
read-only logs; do not accelerate retries or change WAF. A skipped topic Vercel
build is not rendered evidence. Stage 5 needs the tested preview deployment Ready.

## PS-07: Design approvals and pending ledger

Read [Design.md](Design.md) §0, §6.5, §19.4 and §20.6 first. This PR leaves
that canon unchanged. Minimum owner-approved proposals (roadmap section seven):

1. Extend the §6.5 scope table for ordinary and Pro density variants using
   existing classes; Pro entrance uses Hub. Cover new Pro/shared component
   paths in [DESIGN_CONFORMANCE.md](DESIGN_CONFORMANCE.md) and the gates.
2. Approve concrete edition navigation/Pro identification and summary-card
   compositions at 1440 / 768 / 375, using existing roles/tokens. If a new
   role/token is demonstrated necessary, propose only that addition, obtain
   approval and update canon before implementation. No autonomous version bump.

Occupation editions keep Detail; rankings/classifications/compare keep Hub;
Doc/Static/Feature and other families retain current assignments. Root map and
sector ownership stays unchanged. Migrated paths must remain in gate coverage,
including Feature exceptions and shared bodies; do not relabel conformant
surfaces as legacy to bypass checks. Keep 12px minimum, Display/H1/H2 heading
serif, H3+ sans, token-only styling, gutter/content-max and keyboard/contrast
contracts. The pending cross-surface work row is a task ledger, not a new
page class or a claim of completed migration.

## PS-08: Phase acceptance and screenshot matrix

Each implementation card records the current acceptance chain from
[AGENTS.md](../AGENTS.md), with five PUBLIC_* analytics values empty, frozen
install, unit pass/fail, typecheck, build, required built-artifact tests,
verify:gates, Chromium install and Playwright on a unique PLAYWRIGHT_PORT,
then clean `git diff --exit-code` and `git status --short`. Actions remain off.
No gate is removed or weakened; explain intentional SEO baseline changes.
Independent review precedes supervisor acceptance; executors do not merge.

| Phase | Required evidence / exit condition | Screenshot inventory (every visual change at 1440 / 768 / 375) |
| --- | --- | --- |
| 0 — contract (this card) | Manifest generation/check and regression tests; docs links; requested full local chain; decisions clearly scoped | Inventory baseline files, record provenance gaps. No visual change or new screenshot claim |
| 1A — Pro skeleton/shared body | 556 valid Pro occupations and 39 rankings 200; complete data/body preserved; duplicates temporarily canonical to ordinary; Pro gates cover all new/shared sources | `/pro`, `/pro/428`, `/pro/33`, `/pro/404`, `/pro/rankings/ai-risk-high` paired with ordinary pages; navigation/return and complete chapters |
| 1B — migration and machine exits | Owner redirect authorization; 31 old rankings 301/eight 200; all other valid old/new sets exact; aliases one hop; unknowns 404; canonical/JSON-LD/sitemap/llms/family agree | Pro entry-salary and a noindex ranking; compare detail; skills index/slug; q/answers; dated model; methodology/data/standard/haid; aiadoption current/history; yearly; gyakuten. At least one representative of each migrated family |
| 2 — ordinary occupations | Exact signed templates; truly short visible summary, <=3 primary numbers; missing data preserved; same data/bands in both editions; stable entity IDs; distinct content self-canonical; old anchors work | Ordinary/Pro pairs for high/mid/low, missing salary, long name and ID404; ordinary first screen and bottom CTA, Pro reasons/data/sources |
| 3 — eight ordinary rankings | Advertising URL remains 200; true displayed metric/sort; parameters/share/Pro links work; duplicate canonical policy preserved | All eight first screens; workers count, salary income, hourly-wage 160-hour conversion, high-demand existing demand-tier order |
| 4 — ordinary entrances | Signed home/map/sector explanation, concise menus; diagnosis algorithm unchanged; edition/link policy consistent | Home; map search/legend; sectors index plus sector near displayed 4.0 boundary; shindan → me → occupation → Pro; desktop nav and open mobile menu |
| 5 — independent deployed acceptance | Final preview SHA/URL Ready; one-pass HTTP 200/301/404, canonical/header/meta robots/JSON-LD; analytics isolation evidence; owner production approval requested separately | Final-head screenshot set and navigation journey; fresh-cookie banner and rejection states; critical light/dark and keyboard-focus states; preserve new-address rollback plan |

Route regression positive/negative cases: all 31/8 ranking statuses, ID404 vs
root error, unknown IDs/slugs, bare and dated model aliases without loops,
query/repeated parameters, fragments, OG/share/no-JS navigation, no unintended
third old-root copies, all four noindex inherited, other public Pro indexable,
preview response noindex with production canonical in artifacts. Numerical
implementation regressions retain 4.9667 / 6.9667 / 3.9667 and 0.3 floating
boundaries when touching rounding/band calculations; this documentation script
changes no numeric algorithm. Preserve all 39 sorting/filtering definitions.

Source baseline inventory checked on 2026-10-08: 50 PNGs (25 types ×375/1440)
exist at `R/screenshots/`; REPORT references `/tmp/JOB_0209/screenshots/` and
that directory also exists. The report names main snapshot `067c20e8`, but no
per-image deployed SHA proof or 768px set is supplied. File existence is not
visual review or proof of the final preview. Subsequent cards must verify SHA
and recapture missing baselines on controlled pre when necessary, label new
captures honestly, and avoid claiming the old observation was reproduced.

All new temporary files, build outputs, logs, screenshots, traces and browser
profiles/binaries go under `/tmp/<executing-card-id>/` (this card: JOB_0223).
Name screenshots by phase/edition/family/width/state and record the deployment
SHA/URL with them. Durable verification and limitations go in the PR/handoff;
temporary evidence may expire after card completion.

## Regenerate and verify the machine-readable contract

```sh
bun scripts/pro-split-manifest.ts --write
bun scripts/pro-split-manifest.ts --check
bun test scripts/pro-split-manifest.test.ts
bun run check:docs-links
```

The generator imports the real ranking/noindex registry, reads all public Astro
route templates, reuses occupationPath and the score-derived model redirect
checker, and checks current model aliases before emitting planned targets.
It rejects unexpected ranking counts and unclassified new families. Regenerate
only after reviewing source changes against approved policy; do not use it to
silently authorize new routes. It neither edits vercel.json nor creates runtime
routes. Exact valid dynamic slugs and live redirect behavior remain phase 1B/5
acceptance work.

## Stage 1A implementation record — JOB_0225 / Issue #894

The ordinary templates remain available. Shared complete renderers are
`src/pages/_OccupationPage.astro`, `src/pages/rankings/_RankingPage.astro` and
`src/pages/rankings/_RankingsIndex.astro`. New `/pro`, `/pro/<id>` (including
`/pro/404`), `/pro/rankings` and 39 ranking details are generated. Runtime
`src/site/route-policy.ts` consumes this manifest without activating planned
redirects or stage-1B canonicals. The manifest also inventories the four new
Astro route templates; `oldStatus` on pre-existing rows still describes the
planned final state, not stage-1A HTTP responses.

Pro copies use ordinary canonical / OG URL / Japanese alternates while their
JSON-LD WebPage, breadcrumbs and ItemList URLs identify the actual Pro pages.
Occupation entities retain ordinary `#occupation` identity. No Pro URL enters
either sitemap; the existing four noindex rankings inherit their policy. New
Japanese edition-navigation placeholders and Pro metadata markers require
owner signature before merge, as listed in the PR. The approved ordinary CTA
is `Pro で詳しく見る`. Stage 1B links/redirects, ordinary simplification, live
preview verification and production promotion remain separate work.

Stage-1A review follow-up: all 39 Pro ranking edition switches return to their
still-live `oldPath`, including the 31 planned migrations. This current return
policy is independent of the final ordinary subset: only the eight rows with
`ordinaryPath !== null` receive an ordinary-page Pro CTA. Pro ranking detail
WebPage/Article metadata and index WebPage metadata use the same `Pro |` title
and `Pro ·` description values as their actual HTML metadata. Ordinary
structured data remains unchanged.

## Stage 2 occupation implementation — Issue #897 / JOB_0230

Ordinary occupations now render `_OrdinaryOccupationPage.astro`, with a narrow
`occupation-summary.ts` projection from the same graph-owned records as Pro.
The hero has one aggregate change score and band, one three-band conclusion
and advice, annual salary and monthly hours, and one primary Pro action. Missing
statistics render an accessible data-missing dash. Similar occupations and seven
Pro chapter links follow; every existing `chp-*` / `sec-*` anchor and the model
history entry is retained as a real link to its Pro target. Legacy section links
become visible when their fragment is targeted; no full prose is hidden there.
The complete Pro body, model rationale, history, FAQ, data and sources remain.

Occupation pages in both editions are now self-canonical and the HTML sitemap
includes the exact 556 + 556 occupation set. The image sitemap continues to use
ordinary occupation URLs and shared images. Stable Occupation entity IDs remain
ordinary URL + `#occupation`; ordinary schema has only the visible score, salary
and hours, with no FAQPage or detailed dimensions, and speakable selects the
visible conclusion/advice. Pro schema retains the complete original entity.

This implements only the explicitly dispatched occupation phase: stage 1B
redirects and ranking canonical/sitemap policies are still inactive. No redirect,
workflow, analytics-script or Vercel state change is included. Public Japanese
summary templates and meta/OG descriptions are **unsigned candidate copy** from
Issue #897. Owner signature on the exact strings and rendered compositions is
required before merge; local renders do not prove deployment or indexing.
