# 開発ワークフロー

本リポジトリは **Issue-first / docs-first** で進める。非自明な変更は、実装より先に目的、範囲、受け入れ条件、検証方法を Issue に残す。

ランタイム、パッケージマネージャ、CI Bun、Vercel の install / build / Function 平面のピンは [`TOOLCHAIN.md`](TOOLCHAIN.md) を正典とする。本機 Bun と `.github/workflows/ci.yml` の `bun-version` がずれている場合は、Issue や PR で推測せずそこへ書く。

## 記述言語

Issue、PR、commit message、`docs/` は **英語または日本語のみ**で書く。それ以外の言語は使わない。

理由は再現性である。この 3 つは、書いた本人以外——後任の担当者、外部のコントリビューター、コードを読む agent——が唯一の判断材料として読む記録になる。読めない言語で書かれた受け入れ条件は、検証できない受け入れ条件と同じである。

- **英語** — 既定。コード識別子、gate 名、外部 API の用語と混在しても破綻しない。
- **日本語** — サイトの公開コピー、JA-only の UI 文言、日本語の検索需要そのものを扱う場合。`docs/WORKFLOW.md` のように運用手順を書く場合も可。

会話やレビューでのやり取りは、この規則の対象外とする。規則が縛るのは**リポジトリと GitHub に残る記録**だけである。

既存の記録が他言語で書かれていた場合は、見つけた時点で英語に書き直す。

## 標準フロー

1. **Issue を作る**
   - 本文は英語または日本語で書く（[記述言語](#記述言語)）。
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
   - `quality`（GitHub UI では `CI / quality`）と `Vercel` が成功し、review conversation がすべて解決してから human merge する。

## 公開境界

- ローカル編集と commit は外部状態を変えない。
- GitHub への push と PR 作成は Vercel preview deployment を起動しうる。
- `main` は production の公開境界として扱い、通常の修正 PR は直接向けない。
- Preview、production alias、環境変数、project settings の変更は、Issue の範囲に明記された場合だけ行う。
- Preview alias `pre.mirai-shigoto.com` は `X-Robots-Tag: noindex, nofollow` を返す。production `mirai-shigoto.com` は index 対象のまま。静的 HTML の `robots` meta は `index, follow` を維持し、host 条件の応答ヘッダで上書きする。preview の `robots.txt` は crawl を許可したままにする（`Disallow: /` にすると Google が `noindex` を読めない）。

## ブランチの役割

- `preview` — 日常開発の integration branch。topic branch は最新の `preview` から作り、PR も `preview` を base にする。
- `main` — Vercel production の公開 branch。通常の topic branch を直接 merge せず、`preview` を head にした promotion PR だけを受け付ける。
- topic branch — 1 Issue / 1 focused change を原則とする。PR merge 後は、branch tip が merge 済み PR に対応することを確認して削除する。

## Preview から production への promotion

1. `preview` 上の CI、Vercel preview、対象機能の確認を完了する。
2. head=`preview`、base=`main` の promotion PR を作る。
3. PR 本文に含まれる変更、既知の制約、release note、production への影響、実行した検証を記録する。
4. `quality`（GitHub UI では `CI / quality`）と `Vercel` を成功させ、review conversation をすべて解決する。
5. Owner が production 反映を承認して human merge する。履歴と到達可能性を保つため、promotion PR は merge commit を使う。
6. Vercel production deployment、主要 URL、公開 score/model attribution を確認する。

緊急修正も原則として topic branch → `preview` → promotion PR の順を守る。例外が必要な場合は、Owner が理由、実行者、検証、後続の同期方法を Issue または PR に記録する。

## GitHub protection の rollout

Checked-in workflow の exact check name は `quality`、deployment check は `Vercel` とする。GitHub UI は workflow 名を付けて前者を `CI / quality` と表示するが、`gh pr checks --json name`、`.delivery.yml`、branch protection では exact name の `quality` を使う。`preview` と `main` の protection/ruleset ではこの 2 checks、pull request、review conversation resolution を必須にし、force push と branch deletion を禁止する。

新しい check 名を workflow の初回成功前に required にすると、まだ存在しない context を待ち続ける可能性がある。Repository の GitHub Actions が無効なら Owner が有効化し、workflow を `preview` に merge して、PR または branch push で `quality`（UI 表示 `CI / quality`）が成功したことを確認する。その後に `.delivery.yml` の `ci.checks` と protection を exact name で更新する。check 名を変更する場合も同じ順序で移行する。

## 基本検証

```bash
bun run test
bun run typecheck
bun run build
bun run verify:gates
git diff --exit-code
```

`bun run test` は clean checkout 用の projection fixture を先に生成してから unit tests を実行する。文書リンクだけの変更でも `bun run check:docs-links` を実行する。SEO baseline drift が出た場合は、意図した差分かを確認してから [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md) の手順に従う。
