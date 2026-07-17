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
   - `CI / quality` と `Vercel` が成功し、review conversation がすべて解決してから human merge する。

## 公開境界

- ローカル編集と commit は外部状態を変えない。
- GitHub への push と PR 作成は Vercel preview deployment を起動しうる。
- `main` は production の公開境界として扱い、通常の修正 PR は直接向けない。
- Preview、production alias、環境変数、project settings の変更は、Issue の範囲に明記された場合だけ行う。

## ブランチの役割

- `preview` — 日常開発の integration branch。topic branch は最新の `preview` から作り、PR も `preview` を base にする。
- `main` — Vercel production の公開 branch。通常の topic branch を直接 merge せず、`preview` を head にした promotion PR だけを受け付ける。
- topic branch — 1 Issue / 1 focused change を原則とする。PR merge 後は、branch tip が merge 済み PR に対応することを確認して削除する。

## Preview から production への promotion

1. `preview` 上の CI、Vercel preview、対象機能の確認を完了する。
2. head=`preview`、base=`main` の promotion PR を作る。
3. PR 本文に含まれる変更、既知の制約、release note、production への影響、実行した検証を記録する。
4. `CI / quality` と `Vercel` を成功させ、review conversation をすべて解決する。
5. Owner が production 反映を承認して human merge する。履歴と到達可能性を保つため、promotion PR は merge commit を使う。
6. Vercel production deployment、主要 URL、公開 score/model attribution を確認する。

緊急修正も原則として topic branch → `preview` → promotion PR の順を守る。例外が必要な場合は、Owner が理由、実行者、検証、後続の同期方法を Issue または PR に記録する。

## GitHub protection の rollout

Checked-in workflow の job context は `CI / quality`、deployment check は `Vercel` とする。`preview` と `main` の protection/ruleset ではこの 2 checks、pull request、review conversation resolution を必須にし、force push と branch deletion を禁止する。

新しい check 名を workflow の初回成功前に required にすると、まだ存在しない context を待ち続ける可能性がある。Repository の GitHub Actions が無効なら Owner が有効化し、workflow を `preview` に merge して、PR または branch push で `CI / quality` が成功したことを確認する。その後に `.delivery.yml` の `ci.checks` と protection を更新する。check 名を変更する場合も同じ順序で移行する。

## 基本検証

```bash
bun run test
bun run typecheck
bun run build
bun run verify:gates
git diff --exit-code
```

`bun run test` は clean checkout 用の projection fixture を先に生成してから unit tests を実行する。文書リンクだけの変更でも `bun run check:docs-links` を実行する。SEO baseline drift が出た場合は、意図した差分かを確認してから [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md) の手順に従う。
