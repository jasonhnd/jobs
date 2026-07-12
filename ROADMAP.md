# ROADMAP

<!--
Template for loopcoder work units.

Fields:
- id: Stable short identifier used by depends_on.
- title: Short human-readable work unit title.
- scope: Brief description of what is included in the work unit.
- depends_on: List of work unit ids that must finish first; use [] when none.
-->

## Active — multi-model scoring, /models deep-dive (2026-07-12)

Owner feedback on the first /models release (PR #131): not detailed enough.
Four approved deep-dive directions: per-dimension drift, model tendency notes,
rationale side-by-side for divergent occupations, static SVG distribution charts.
Doc-first: the design addendum merges before the code issue is dispatched.
The implementation PR is NOT merged on green gates alone — the owner reviews the
PR's own Vercel preview URL and approves before it lands on `preview`.

```yaml
- id: mms-4b-doc
  title: Design addendum — /models deep-dive sections
  scope: >
    Update docs/MULTI_MODEL_SCORING.md with a Phase 2c-deep spec covering:
    (1) D1-D10 per-dimension drift table (before/after means, drift, sorted
    by |drift|); (2) data-driven Japanese "model tendency" notes generated
    from aggregates via fixed sentence templates, no free-form prose;
    (3) rationale_ja side-by-side for top-divergence occupations, including
    the data-channel decision (a dedicated build-time projection or direct
    data/scores read at build; the score_history projection keeps its
    no-rationale rule); (4) static build-time SVG charts (two-batch score
    histogram + before/after scatter), zero client-side JS.
  depends_on: []

- id: mms-4b-code
  title: /models deep-dive implementation
  scope: >
    Implement Phase 2c-deep exactly per the merged design addendum: extend
    /models with the four sections, regenerate baselines, keep a11y/SEO/
    internal-link gates green. Merge gate: owner approves the rendered PR
    preview URL first.
  depends_on:
    - mms-4b-doc
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
