# 開発ワークフロー

本リポジトリは **Issue-first / docs-first** で進める。非自明な変更は、実装より先に目的、範囲、受け入れ条件、検証方法を Issue に残す。

## 標準フロー

1. **Issue を作る**
   - ユーザーまたは運用への影響、対象範囲、範囲外、受け入れ条件を書く。
   - データ、SEO、API、デザイン、開発手順への影響を明記する。
2. **契約文書を更新する**
   - Public contract や運用手順が変わる場合は、対応する `docs/` を同じ変更に含める。
   - 次の実装者が文書だけで判断できる粒度にする。
3. **コードを変更する**
   - 既存の層境界と canonical helper を優先する。
   - 数値処理、SEO、Edge endpoint のローカル再実装を避ける。
4. **検証する**
   - 対象テスト、typecheck、build を変更リスクに応じて実行する。
   - URL、SEO、JSON-LD、生成物、gate に触れた場合は `verify:gates` まで実行する。
5. **PR を作る**
   - Base branch は `preview` とし、Issue を `Closes #...` でリンクする。
   - 変更内容、文書/baseline 影響、実行した検証を本文に残す。

## 公開境界

- ローカル編集と commit は外部状態を変えない。
- GitHub への push と PR 作成は Vercel preview deployment を起動しうる。
- `main` は production の公開境界として扱い、通常の修正 PR は直接向けない。
- Preview、production alias、環境変数、project settings の変更は、Issue の範囲に明記された場合だけ行う。

## 基本検証

```bash
bun test src scripts
bun run typecheck
bun run build
bun run verify:gates
```

文書リンクだけの変更でも `bun run check:docs-links` を実行する。SEO baseline drift が出た場合は、意図した差分かを確認してから [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md) の手順に従う。
