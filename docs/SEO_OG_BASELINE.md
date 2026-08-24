# SEO / OG / Baseline 運用

本サイトは SEO 出力を snapshot baseline として管理する。URL、sitemap、JSON-LD、meta、OG/Twitter image の変更は検索流入と AI crawler 解釈に影響するため、コード変更と同じ PR で理由を文書化する。

## 管理対象

`tests/baseline/` に以下を保持する。

- `urls.txt`
- `data-files.txt`
- `sitemap.xml`
- `image-sitemap.xml`
- `seo-metadata.jsonl`
- `og-meta.jsonl`
- `json-ld.jsonl`
- `internal-links.jsonl`
- `capture-meta.json`

## sitemap lastmod

`src/pages/sitemap.xml.ts` は build clock ではなく、`src/views/sitemap.ts` の `latestContentDate()` が返す content-derived date を使う。現行では全 occupation の latest AI score `run_date` の最大値を sitemap `<lastmod>` にする。

理由: build clock を使うと、内容が変わっていない rebuild でも全 URL の `<lastmod>` が毎日変わり、baseline と検索エンジン向け signal が drift する。

## /aiadoption

`/aiadoption` の `dateModified` と画面上の更新表示は、`data.ai-adoption.json` の `updated_at` を使う。これは build clock ではなく、入力 observation の最新 `as_of_date` 由来。

OG/Twitter image は `https://mirai-shigoto.com/api/og?page=aiadoption` を使う。`page=home` へ戻る drift は accidental と見なす。

## Baseline 更新手順

1. まず通常検証を走らせる。

   ```bash
   bun run test
   bun run typecheck
   bun run build
   bun run verify:gates
   ```

2. `verify:gates` が drift を出したら、差分が意図したものか確認する。
3. 意図した変更なら `CHANGELOG.md` に理由を書く。
4. baseline を更新する。

   ```bash
   bun run capture:seo-baseline
   bun run verify:gates
   ```

5. code、docs、`tests/baseline/*` を同じ commit / PR に入れる。

## Preview host

`pre.mirai-shigoto.com` is the Vercel preview alias for the `preview` branch. Canonical URLs in HTML still point at `https://mirai-shigoto.com`, but the preview host itself must not be indexed: `vercel.json` sends `X-Robots-Tag: noindex, nofollow` when `Host` is `pre.mirai-shigoto.com`.

Do not put that header on the unconditioned `/(.*)` rule — that would noindex production. Do not `Disallow: /` on preview `robots.txt`; Google has to crawl the host to honour `noindex`.

## やってはいけないこと

- 理由なしに baseline だけ更新しない。
- `sitemap.xml` の URL 数が大きく減った状態を baseline にしない。
- JSON-LD の payload drift を「文字列差分が大きいから」で無視しない。代表 URL を開き、`dateModified`、`image`、`@type`、canonical を確認する。
