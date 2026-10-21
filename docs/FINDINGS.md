# Findings releases

Issue #934 introduces one **unsigned draft**, issue 1 for the 2026-10-01
GPT-6.1 SOL vendor update. It is authorized for preview review only. Template
and rights signatures and a separate owner production approval are still
required. No automatic publication or historical backfill is implemented.

`data/findings/<issue>/manifest.json` fixes the event identity, revision,
before/after vendor seats, source commit, input hashes, prompt references and
download byte lengths/hashes. The accompanying minimal occupation snapshot
and IPD provenance snapshot were generated from the repository at that
commit. In particular, the download date comes from
`data/.ipd_provenance.json`, never the build clock. Source notes are not part
of the repository.

`src/site/findings/data.ts` reads only those pinned score batches and frozen
occupation/source fields. It uses the canonical flagship means and shared
drift traversal: raw occupation means, one-decimal displayed endpoints,
integer-tenths deltas, display-based bands and half-even aggregate rounding.
It requires full coverage, one seat per provider, one changed seat and
agreement with the hash-pinned archival report. It does not read today's
latest panel. An input/hash/coverage disagreement fails the build.

Four static CSV endpoints share the same computed release model as the HTML
and JSON-LD. Their columns follow the release schema exactly. Salary,
employment counts, rationales and source database text are absent. The
provenance table separates site-owned analysis, processed IPD fields and
factual attribution; MIT does not sublicense third-party material.

Adding another issue must retain the old inputs and CSV hashes. A changed
old export fails rather than overwriting an existing revision. Corrections
require a new revision and a reviewed correction record, keeping r1 intact.
The initial template and rights copy live in `src/content/findings*.ja.json`;
their exact bytes and rendered copy are guarded by tests. Template variables
are constrained release data, not editorial or model-generated prose.

Draft pages have self-canonicals and noindex. Drafts are excluded from the
sitemap, both llms files and published release selection. This first draft
creates no feed endpoint, subscription link or autodiscovery tag. The preview
host's existing noindex response policy is unchanged. Publication dates are
absent until a real publication record exists; the bibliography keeps its
URL placeholder until publication and its access-date placeholder in static
HTML. Only copying fills the reader's local current date.

Local acceptance includes no-JavaScript rendering, exact clipboard payloads,
three widths, the minimum text size, CSV integrity, structured-data/body
agreement, discovery exclusion and protected-HTML comparison. Ordinary
homepage, occupation and ranking source files are outside this change.
