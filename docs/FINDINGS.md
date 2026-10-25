# Findings releases

Issue 1, the 2026-10-01 GPT-6.1 SOL vendor update, is signed template and
rights copy. Signing makes its three HTML pages indexable and lists them in
the sitemap, `llms.txt`, and `llms-full.txt`. A signature is not production
approval. Preview builds do not record a publication instant, and this change
does not merge to main.

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
The template and rights copy live in `src/content/findings*.ja.json`; their
exact bytes and rendered copy are guarded by tests. Template variables are
constrained release data, not editorial or model-generated prose. The rights
citation sentence is the signed text in the source JSON. Rendering does not
rewrite it.

## Publication instant

`first_published_on` stays null until the day a preview-to-main promotion is
prepared. In that preview state:

- The page label 公開日 renders `—`.
- JSON-LD omits `datePublished`. `dateModified` stays the manifest
  `modified_on` (a date, not an expanded instant).
- Atom 1.0 (RFC 4287) still emits the entry. `atom:published` is optional, so
  a null `first_published_on` omits that element. `atom:updated` uses
  `modified_on`. A date-only value expands to `YYYY-MM-DDT00:00:00+09:00`
  for the Atom timestamp only.
- `{{issue_url}}` is replaced by the canonical issue URL once status is
  `signed` or `published`. `{{accessed_on}}` stays in static HTML; copying
  fills the reader's local date.
- Literal `{{...}}` must not appear on the publication-date fields.

An empty feed is valid only when nothing is signed. A signed issue with a
null publication instant is still an entry.

Record the instant with:

```
bun scripts/publish-findings-issue.ts <issue_id> <rfc3339-with-timezone>
```

The script refuses a missing timezone and a second, different instant. Do not
run it for a preview-only change. After it runs, status becomes `published`,
and JSON-LD `datePublished`, the 公開日 label, and `atom:published` use that
same zoned instant.

## Discovery

`status: draft`, or a missing template or rights signature, keeps the pages
`noindex` and out of the sitemap, both llms files, and the Atom feed. A
signed issue is discoverable even while `first_published_on` is null.

The feed is `/pro/findings/atom.xml`. Its id is the series URL, the self link
is the feed URL, the entry id and alternate link are the issue URL, the title
is T43, and the summary is T42. The index page links the feed with the signed
購読 label. Each of the three HTML pages advertises it with
`<link rel="alternate" type="application/atom+xml">`. The feed and the CSV
downloads are not sitemap URLs.

Findings text is appended after `renderLlmsTxt` / `renderLlmsFullTxt`. The
homepage JSON-LD call stays `renderHomeJsonLd(facts)`, so the shared facts
object does not gain Findings copy. The preview host middleware still sends
`X-Robots-Tag: noindex, nofollow` when the request host is the preview host.
