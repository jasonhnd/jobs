# 開発ドキュメント

このディレクトリは、コードを変更する前に確認する開発者向けドキュメントの入口です。README はサイトの読者向け説明、`docs/` は実装・運用・変更手順の正典です。

## まず読むもの

- [`WORKFLOW.md`](WORKFLOW.md) — Issue-first / docs-first の開発順序。非自明な変更はここに従う。
- [`TOOLCHAIN.md`](TOOLCHAIN.md) — install / build / runtime の版と Vercel 三平面の正典。CI Bun と本機 Bun もここへ書く。§9（#301–#305）は `"bunVersion": "1.4.x"` を Function 実行へ載せた系列。`api/og` / `api/shindan-share` / middleware は Bun 1.4。
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — branch、PR、必須検証の contributor 向け要約。
- [`Design.md`](Design.md) — 色・文字・余白・レイアウト・ページ構造を定める UI/UX の正典。
- [`DESIGN_CONFORMANCE.md`](DESIGN_CONFORMANCE.md) — surface ごとの Design 適合状況、移行段階、完了チェックリストの台帳。
- [`MOBILE_SHAPES.md`](MOBILE_SHAPES.md) — モバイル再設計のページ構造と実装範囲を定めた仕様。
- [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md) — データソース、グラフ、projection、丸め、スコア選択、整合性ゲート。
- [`SCORING_RUNBOOK.md`](SCORING_RUNBOOK.md) — AIOIS-10 score batch の追加手順。Issue #9 の Fable 5 pilot → drift → full run → preview gate もここを正典にする。
- [`CONSENSUS_SCORE.md`](CONSENSUS_SCORE.md) — 公開スコアの 3 社旗艦平均、採用 run の条件、過去の中央値規則の履歴。
- [`MULTI_MODEL_SCORING.md`](MULTI_MODEL_SCORING.md) — 多モデル採点・比較 UI の初期設計と導入時の判断履歴。
- [`COVERAGE_REPORT.md`](COVERAGE_REPORT.md) — 未ロードのソースを 0% として補う coverage report の生成方法と対象範囲。
- [`WORKTYPE_DIAGNOSTIC.md`](WORKTYPE_DIAGNOSTIC.md) — Canonical design for `仕事タイプ診断` and the DIAG-1..9 implementation scope.
- [`WORKTYPE_VIRALITY.md`](WORKTYPE_VIRALITY.md) — 診断結果の naming / surfacing / entry / 拡散の設計。scoring 体系は変更しない。
- [`MBTI_CONTENT.md`](MBTI_CONTENT.md) — `WORKTYPE_VIRALITY.md` §4.C の sub-spec。`/mbti/<type>` content line（未実装）。
- [`ME_CONSOLIDATION.md`](ME_CONSOLIDATION.md) — 診断を `/me` に統合し、職業を最初に聞く形へ反転させる設計。`/shindan` は無職入口として残し、`?job=` 付きの旧リンクだけ `/me` へ 301 する。
- [`AIOIS-10.md`](AIOIS-10.md) — AIOIS-10 v1.0 の開発者向け入口。公開ページ `/standard` と score batch / prompt の橋渡し。
- [`HAID.md`](HAID.md) — HAID v1.0（人類と AI の距離 10 段階）の正本。オーナー署名済みの定義文を保持し、`/haid` と `src/site/haid-spec.ts` はここから写す。
- [`architecture.md`](architecture.md) — `src/data` / `src/graph` / `src/views` / `src/templates` / `src/pages` の層境界。
- [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md) — sitemap、JSON-LD、OG/Twitter meta、baseline 更新手順。
- [`EDGE_SECURITY.md`](EDGE_SECURITY.md) — Edge API と OG 画像生成の防御ルール。
- [`INCIDENT_RUNBOOK.md`](INCIDENT_RUNBOOK.md) — production 障害・攻撃時の即応手順と、repo 外の Vercel プラットフォーム状態の台帳・回放コマンド。

## スコア切替・旗艦更新の drift レポート

- [`CONSENSUS_SWITCH_DRIFT.md`](CONSENSUS_SWITCH_DRIFT.md) — 最新票から中央値へ切り替えた mms-6g の履歴レポート。
- [`FLAGSHIP_SWITCH_DRIFT.md`](FLAGSHIP_SWITCH_DRIFT.md) — 中央値から各社旗艦平均へ切り替えた際のスコア・リスク帯の変化。
- [`VENDOR_UPDATE_DRIFT_gpt-6-astra_2026-09-10.md`](VENDOR_UPDATE_DRIFT_gpt-6-astra_2026-09-10.md) — OpenAI 旗艦を GPT-6 Astra へ更新した際の drift レポート。
- [`VENDOR_UPDATE_DRIFT_grok-4.7_2026-09-22.md`](VENDOR_UPDATE_DRIFT_grok-4.7_2026-09-22.md) — xAI 旗艦を Grok 4.7 へ更新した際の drift レポート。
- [`VENDOR_UPDATE_DRIFT_claude-opus-5-5_2026-09-23.md`](VENDOR_UPDATE_DRIFT_claude-opus-5-5_2026-09-23.md) — Anthropic 旗艦を Claude Opus 5.5 へ更新した際の drift レポート。
- [`VENDOR_UPDATE_DRIFT_gpt-6-sol_2026-09-23.md`](VENDOR_UPDATE_DRIFT_gpt-6-sol_2026-09-23.md) — OpenAI 旗艦を GPT-6 Sol へ更新した際の drift レポート。
- [`VENDOR_UPDATE_DRIFT_gpt-6.1-sol_2026-10-01.md`](VENDOR_UPDATE_DRIFT_gpt-6.1-sol_2026-10-01.md) — OpenAI 旗艦を GPT-6.1 Sol へ更新した際の drift レポート。

## ドキュメント更新ルール

- コード変更で public contract、データ shape、SEO 出力、API 挙動、開発手順が変わる場合は、同じ PR で該当 docs を更新する。
- 仕様や受け入れ条件が未確定のまま実装しない。まず GitHub Issue に目的、範囲、文書影響、検証方法を書く。
- `CHANGELOG.md` はリリース履歴。設計判断や運用手順の本文は `docs/` に置き、CHANGELOG から参照する。
- 古いファイル名を参照するコードコメントが多いため、`DATA_ARCHITECTURE.md` と `architecture.md` は互換入口として維持する。

## フォントパイプライン

- Source fonts live under `assets/fonts-src/` with each upstream `OFL.txt`.
- `bun run build` runs `astro build`, then `scripts/subset-fonts.ts`, then the rendered-output gates and CSP hash rewrite.
- The subsetter scans `dist-astro/**/*.html` and emits content-hashed WOFF2 files under `dist-astro/fonts/`. It replaces the `<!-- self-hosted-font-assets -->` marker in `BaseLayout.astro` output with the preload links and one inline `<style>` that holds the `@font-face` rules. It does not write `font-faces.<hash>.css` or inject a stylesheet link for those rules. The font manifest records `stylesheet: { "delivery": "inline", "bytes": <CSS byte length> }` and does not record an `href`. Preload stays on the WOFF2 assets; weights and `font-display` are unchanged.
- Do not commit generated `dist-astro/fonts/*`; the immutable `/fonts/(.*)` cache header in `vercel.json` relies on content hashes.
