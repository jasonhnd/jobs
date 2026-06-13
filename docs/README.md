# 開発ドキュメント

このディレクトリは、コードを変更する前に確認する開発者向けドキュメントの入口です。README はサイトの読者向け説明、`docs/` は実装・運用・変更手順の正典です。

## まず読むもの

- [`WORKFLOW.md`](WORKFLOW.md) — Issue-first / docs-first の開発順序。非自明な変更はここに従う。
- [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md) — データソース、グラフ、projection、丸め、スコア選択、整合性ゲート。
- [`SCORING_RUNBOOK.md`](SCORING_RUNBOOK.md) — AIOIS-10 score batch の追加手順。Issue #9 の Fable 5 pilot → drift → full run → preview gate もここを正典にする。
- [`AIOIS-10.md`](AIOIS-10.md) — AIOIS-10 v1.0 の開発者向け入口。公開ページ `/standard` と score batch / prompt の橋渡し。
- [`architecture.md`](architecture.md) — `src/data` / `src/graph` / `src/views` / `src/templates` / `src/pages` の層境界。
- [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md) — sitemap、JSON-LD、OG/Twitter meta、baseline 更新手順。
- [`EDGE_SECURITY.md`](EDGE_SECURITY.md) — Edge API と OG 画像生成の防御ルール。

## ドキュメント更新ルール

- コード変更で public contract、データ shape、SEO 出力、API 挙動、開発手順が変わる場合は、同じ PR で該当 docs を更新する。
- 仕様や受け入れ条件が未確定のまま実装しない。まず GitHub Issue に目的、範囲、文書影響、検証方法を書く。
- `CHANGELOG.md` はリリース履歴。設計判断や運用手順の本文は `docs/` に置き、CHANGELOG から参照する。
- 古いファイル名を参照するコードコメントが多いため、`DATA_ARCHITECTURE.md` と `architecture.md` は互換入口として維持する。
