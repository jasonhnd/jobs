# MBTI Content Line Sub-Spec

Status: sub-spec for review. Extends [`WORKTYPE_VIRALITY.md`](./WORKTYPE_VIRALITY.md)
section 4.C. This issue is documentation-only: no routes, data files, page code,
sitemap changes, or baselines are implemented here.

Base branch: `preview`. JA-only public surface; English spec with canonical JA
copy strings inline.

## 1. Purpose

Create an editorial content line for
「MBTIタイプ x AI時代の働き方」 that rides existing JA search demand for 16-type
queries and turns that attention into the site's own payoff:

1. known MBTI type recognition,
2. editorial framing about work in the AI era,
3. real occupation examples from the 556-occupation dataset with AIOIS-10
   AI-impact,
4. a clear CTA into `/shindan`.

This is a funnel into the diagnostic and occupation map. It is not a new
personality system and it must not change AIOIS-10, work-type scoring, or the
8-family / ~24-variant diagnostic.

## 2. Route And Phase-1 Scope

Route: `/mbti/<type>`.

- Canonical path uses lowercase type slugs: `/mbti/enfp`, `/mbti/infp`, etc.
- Visible type labels remain uppercase: `ENFP`, `INFP`, etc.
- Unsupported types are not generated in phase 1. If a later implementation
  chooses to accept uppercase paths, they must canonicalize or redirect to the
  lowercase URL and must not create duplicate canonicals.

Phase 1 is a small high-search subset, not all 16 types. Use the top five JA
search-volume types from the 2025-04-15 ListeningMind MBTI search analysis
(`https://jp.listeningmind.com/tutorial/mbti-search-trend/`):

| Phase | Type | JA common label | Volume rank | Build path |
| --- | --- | --- | ---: | --- |
| 1 | ENFP | 運動家 | 1 | `/mbti/enfp` |
| 1 | INFP | 仲介者 | 2 | `/mbti/infp` |
| 1 | ISFP | 冒険家 | 3 | `/mbti/isfp` |
| 1 | INFJ | 提唱者 | 4 | `/mbti/infj` |
| 1 | ISTP | 巨匠 | 5 | `/mbti/istp` |

Hold the remaining 11 types for later issues. `INTJ` is a good later candidate
because the same source notes broad keyword variety, but its search-volume rank
is 10, so it is not phase 1 if phase 1 is strictly volume-led.

## 3. Page Template

Each page follows the same information architecture.

### 3.1 Known-Type Framing

Goal: confirm the reader's existing search intent without pretending the site
has diagnosed them.

Required elements:

- H1 pattern: `ENFPのAI時代の働き方`
- Intro pattern: `ENFPとして検索してきた人へ。ここでは性格を決めつけず、AI時代に仕事で出やすい関心・動き方を、職業データと照らして見ていきます。`
- One guardrail line above the fold:
  `MBTIは性格の自己理解の入口です。このページは適職判定ではなく、職業データを見るための編集ガイドです。`

Do not ask the page to determine whether the reader is really that type. Do not
show diagnostic work-type family names or internal family codes in this framing.

### 3.2 Editorial Section

Section heading:

`AI時代の、このタイプの働き方`

This section is original editorial copy, 3-5 short paragraphs or 3 compact
cards. It may discuss:

- where this type's commonly searched self-image may help with AI-era work,
- where AI can reduce busywork or widen exploration,
- where overclaiming from personality labels can mislead,
- how to use the occupation examples as prompts for comparison, not as a verdict.

Copy must stay tentative and reader-facing. Use phrases like `〜しやすいかもしれない`,
`傾向として語られがち`, and `仕事選びでは実際の職務内容も見る` when making type-specific
claims.

### 3.3 Occupation Matches

Section heading:

`このタイプの関心と重なりやすい職業`

The connection is editorial + occupation tagging. It is not a score, not a
recommendation engine, and not an MBTI-to-work-type crosswalk.

For each phase-1 type, curate 6-8 occupation IDs from the active 556-occupation
dataset. Each occupation card must include:

- occupation name,
- link to the existing `/{id}` occupation page,
- AIOIS-10 Transformation score as the primary AI-impact value,
- Displacement-Risk when already shown by the occupation page data layer,
- one short editorial reason that explains the tag match,
- the standard AIOIS caveat nearby:
  `AI影響度は AIOIS-10 に基づくモデル出力であり、統計的な将来予測ではありません。`

Selection rules:

- Use existing occupation IDs and the active score data selected by the current
  loaders; do not hardcode a separate score source.
- Tag occupations with editorial tags such as `idea-generation`,
  `people-support`, `hands-on-craft`, `analysis`, `field-response`, or
  `systems-ops`. These tags only explain curation and must not be reused as
  diagnostic axes.
- Keep at least two different occupational domains per type so pages do not read
  like a narrow stereotype.
- Include at least one "surprising but plausible" occupation per type to create
  discovery value, but the reason must be grounded in the occupation page's
  visible data/copy.
- Do not claim `ENFPに向いている職業ランキング` or any equivalent deterministic
  ranking language.

### 3.4 CTA Into Diagnostic

Section heading:

`あなた自身の働き方タイプも見る`

Primary CTA:

`9問でAI時代の働き方タイプを見てみる`

Target: `/shindan`.

The CTA may carry a harmless source parameter only if the implementation already
has a policy for analytics-safe query parameters. It must not pre-fill a result,
family, variant, or occupation. The message is: MBTI is a familiar entry point;
`/shindan` is where the site asks its own work-preference questions.

## 4. Non-Goals And Guardrails

- No forced MBTI -> diagnostic family mapping.
- No MBTI -> AIOIS-10 scoring formula.
- No 16-type restructure of the site's 8-family / ~24-variant diagnostic.
- No new public type code that competes with MBTI or with the diagnostic result
  names.
- No English public pages in phase 1.
- No `適職保証`, `天職`, `必ず向いている`, or `相性が悪い職業` claims.
- No medical, mental-health, hiring, or employment-screening framing.

Canonical guardrail copy for the page footer or occupation block:

`このページは MBTI タイプを入口にした編集コンテンツです。性格検査、採用判定、適職保証ではありません。職業例は、仕事の特徴と AIOIS-10 の AI 影響度を見比べるための案内です。`

## 5. SEO And Implementation Conventions

### 5.1 Metadata

Each generated page must have:

- title pattern: `ENFPのAI時代の働き方｜職業データで見るAI影響度`
- meta description pattern:
  `ENFPタイプとして語られがちな働き方を、AI時代の職業データとAIOIS-10のAI影響度から読み解きます。適職判定ではなく、診断への入口です。`
- canonical URL: `https://mirai-shigoto.com/mbti/<lowercase-type>`
- `hreflang="ja"` and `x-default` following `BaseLayout` conventions,
- no personalized query-state canonicals.

When phase-1 pages ship, add only those five URLs to the sitemap and SEO
baselines. Do not add the remaining 11 type URLs until they are implemented.

### 5.2 Page Class / CSS

Follow the Page Class System used by existing static pages:

- use `BaseLayout` + `Footer`;
- rely on canonical tokens emitted globally by `src/lib/canonical-css.ts` via
  `Footer.astro`;
- do not define `:root` or page-local design tokens in the MBTI page CSS;
- keep page CSS class-scoped, e.g. `.mbti-page`, `.mbti-hero`, `.mbti-occupation`;
- pass `bun run check:page-class`.

### 5.3 JSON-LD

Each page must emit valid JSON-LD and pass `bun scripts/verify-jsonld.cjs`.

Minimum graph:

- `WebPage`
  - `@id`: `${canonical}#webpage`
  - `url`: canonical
  - `name`: page H1 or SEO title
  - `description`: meta description
  - `inLanguage`: `ja`
  - `breadcrumb`: `{ "@id": "${canonical}#breadcrumb" }`
- `BreadcrumbList`
  - Home -> `MBTIタイプ x AI時代の働き方` -> current type page

Optional:

- `ItemList` for the curated occupation links if the implementation also tests
  the node shape and keeps item URLs equal to existing `/{id}` canonicals.

Do not use schema types that imply a clinical personality assessment, job
placement service, or employment decision.

### 5.4 Verification

The phase-1 implementation PR must run or update the relevant gates:

- `bun test` for any content/schema helper,
- `bun run check:page-class`,
- `bun scripts/verify-jsonld.cjs` after build output exists,
- internal-link verification,
- sitemap / SEO baseline capture for the five new URLs.

## 6. Phase-1 Code Issue Decomposition

Open code issues after this sub-spec merges.

1. **`[mbti-data]` Phase-1 content contract and curation**
   - Add the five-type content source for ENFP, INFP, ISFP, INFJ, and ISTP.
   - Store visible labels, SEO copy, editorial blocks, occupation IDs, editorial
     tags, and per-occupation reason copy.
   - Add tests that every occupation ID exists, every page has 6-8 occupations,
     every type has at least two domains, and no unsupported type is accidentally
     routed.

2. **`[mbti-route]` Static `/mbti/[type]` pages**
   - Generate only the five phase-1 paths.
   - Render the template in section 3.
   - Link occupation cards to existing `/{id}` pages and surface AIOIS-10
     AI-impact from existing loaders.
   - Emit `WebPage` + `BreadcrumbList` JSON-LD and page-class-compliant CSS.

3. **`[mbti-seo]` Discoverability and baselines**
   - Add only phase-1 URLs to sitemap generation.
   - Add internal entry links from a conservative location such as `/gyakuten`,
     `/shindan`, or a future MBTI index only if that surface is approved.
   - Capture SEO, JSON-LD, internal-link, and sitemap baselines.

4. **`[mbti-expand]` Later type expansion**
   - Review Search Console / keyword data after phase 1.
   - Add more types in batches, not all remaining 11 by default.
   - Keep the same non-goal: expansion adds editorial pages, not a scoring map.
