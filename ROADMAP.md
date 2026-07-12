# ROADMAP

<!--
Template for loopcoder work units.

Fields:
- id: Stable short identifier used by depends_on.
- title: Short human-readable work unit title.
- scope: Brief description of what is included in the work unit.
- depends_on: List of work unit ids that must finish first; use [] when none.
-->

## Active — multi-model scoring, /models v2 redesign (2026-07-12)

Owner rejected the deep-dive direction after reviewing the PR #136 preview:
/models was built as a data/statistics dashboard, but the owner wants a
**visitor-facing magazine-style feature page** ("AIモデルは、あなたの仕事を
どう見ているか"). Approved v2 direction: magazine narrative structure,
curated occupation stories funneling to detail pages, ALL statistics detail
(per-dim drift table, template tendency notes, rationale table, histogram,
scatter, methodology) removed from the page — drift analysis stays in the
`aiois-drift-report` script layer only. Zero client JS unchanged.

mms-4b (deep-dive) is superseded: issue #135 / PR #136 stay open as reference
until the v2 page ships, then close unmerged. The `data.models_deep.json`
projection infra on the PR #136 branch is a reuse candidate.

Doc-first: the v2 design section merges before the code issue is dispatched.
The design doc PR is shown to the owner before merge. The implementation PR
is NOT merged on green gates alone — the owner reviews the PR's own Vercel
preview URL and approves before it lands on `preview`.

```yaml
- id: mms-4c-doc
  title: Design rewrite — /models v2 visitor-facing feature page
  scope: >
    Rewrite the /models design in docs/MULTI_MODEL_SCORING.md: mark 2c-deep
    as superseded (implementation withdrawn) and add a 2c-v2 section
    specifying the magazine-style page: (1) hero hook copy; (2) model
    profile cards with reader-language one-line "personality" summaries
    derived from drift data, no internal notation in body copy; (3) consensus
    vs divergent occupations contrast; (4) 3-5 curated divergent-occupation
    story cards with two-model score visual, verbatim rationale_ja quotes,
    one-line editorial "why split" copy, automatic top-divergence selection
    with curated override list; (5) CTA to occupation detail score-history
    blocks and the diagnostic; (6) minimal footer data note. Data channel:
    build-time projection (models_deep-style, <=30KB, inlined, never fetched
    client-side). Japanese-only copy, zero client JS, anti-template editorial
    design per site standards, auto-extends when a new batch lands.
  depends_on: []

- id: mms-4c-code
  title: /models v2 implementation
  scope: >
    Rebuild the /models page per the merged 2c-v2 design section: replace
    the current dashboard sections with the magazine structure, wire the
    projection, regenerate baselines, keep a11y/SEO/internal-link gates
    green. Merge gate: owner approves the rendered PR preview URL first.
  depends_on:
    - mms-4c-doc
```

## Pending — gated operations (not dispatchable)

```yaml
- id: mms-5-exec
  title: Execute gpt-5.6-sol scoring (issue #126)
  scope: >
    Pilot 30-50 occupations -> drift report -> owner approval -> full 556
    batch into data/scores/. Consumes Codex CLI subscription quota and runs
    for hours on the operator machine; each run starts only on an explicit
    owner go-ahead. Landing the full batch flips the site-wide canonical
    score to gpt-5.6-sol.
  depends_on: []
```
