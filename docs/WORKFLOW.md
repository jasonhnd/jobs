# 開発ワークフロー

本リポジトリは **Issue-first / docs-first** で進める。非自明な変更は、実装より先に目的、範囲、受け入れ条件、検証方法を Issue に残す。

ランタイム、パッケージマネージャ、保存された CI 設定の Bun、Vercel の install / build / Function 平面のピンは [`TOOLCHAIN.md`](TOOLCHAIN.md) を正典とする。本機 Bun と `.github/workflows/ci.yml` の `bun-version` がずれている場合は、Issue や PR で推測せずそこへ書く。

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
   - push 前に実装担当がローカルで下記の必須チェーン全体を実行する（文書のみの変更は `bun run check:docs-links`。Issue が全体を要求する場合は全体を実行する）。
   - 各 command の実出力、exit code、test の pass/fail 数、skip を PR 本文に貼る。
5. **PR を作る**
   - Base branch は `preview` とし、Issue を `Closes #...` でリンクする。
   - 変更内容、文書/baseline 影響、実行した検証を本文に残す。
   - `Vercel` が成功し、review conversation がすべて解決してから、監督者（オーナー、またはオーナーが `preview` への merge を委任した監督 agent）が diff、独立レビュー、PR 本文のローカル必須検証の実出力を確認して merge する。実装担当（executor）は merge しない。

## 公開境界

- ローカル編集と commit は外部状態を変えない。
- GitHub への push と PR 作成は、`preview` / `main` への push と、HEAD commit message に `[vercel-build]` を含む topic branch の push でだけ Vercel preview deployment を起動する。それ以外の topic branch は `scripts/vercel-ignore-build.sh`（Ignored Build Step）が skip し、`Vercel` check は「Canceled by Ignored Build Step」の成功扱いになる（branch protection の変更は不要）。検証は実装担当のローカル必須チェーンが担い、監督者が PR 本文の実出力を確認する。Vercel の `buildCommand` は `bun run build` のみ（Issue #855）。
- `main` は production の公開境界として扱い、通常の修正 PR は直接向けない。
- Preview、production alias、環境変数、project settings の変更は、Issue の範囲に明記された場合だけ行う。
- Preview alias `pre.mirai-shigoto.com` は `X-Robots-Tag: noindex, nofollow` を返す。production `mirai-shigoto.com` は index 対象のまま。静的 HTML の `robots` meta は `index, follow` を維持し、host 条件の応答ヘッダで上書きする。preview の `robots.txt` は crawl を許可したままにする（`Disallow: /` にすると Google が `noindex` を読めない）。

## Vercel 操作の権限境界（agent / MCP / CLI）

ローカルの coding agent（Claude Code / Codex / Gemini CLI / Grok）は、Vercel MCP（`https://mcp.vercel.com`）と認証済み Vercel CLI を通じて owner 相当の権限を持つ。この節は [公開境界](#公開境界) の原則を Vercel 操作面へ拡張し、agent が承認なしで行える操作を定める。

**承認不要（読み取り・診断）** — deployment 状態、build log、usage、Web Analytics、firewall overview、alert 一覧などの読み取りは自由に行ってよい。障害調査での log 取得も含む。

**Owner の明示承認が必要（状態変更）** — 次の操作は、実行前に Owner の指示または承認を得る。

- `promote` / `rollback` / `redeploy` など、serving 状態を変える deployment 操作
- 環境変数の追加・変更・削除
- firewall ルールの変更と `publish`
- rolling release 設定の変更
- alias / domain / DNS / project settings の変更
- `vercel api` での書き込み（POST / PATCH / PUT / DELETE）

**恒久禁止** — firewall の Challenge 系 action は使わない。AI crawler を遮断し、GEO 方針（[`EDGE_SECURITY.md`](EDGE_SECURITY.md) 参照）を破壊するためである。rate limit の超過時 action は `log` または `deny`（429）のみとする。

git 側の境界は [標準フロー](#標準フロー) と promotion 手順に従う。この節はそれを Vercel 平面に対応させたものである。

## ブランチの役割

- `preview` — 日常開発の integration branch。topic branch は最新の `preview` から作り、PR も `preview` を base にする。
- `main` — Vercel production の公開 branch。通常の topic branch を直接 merge せず、`preview` を head にした promotion PR だけを受け付ける。
- topic branch — 1 Issue / 1 focused change を原則とする。PR merge 後は、branch tip が merge 済み PR に対応することを確認して削除する。

## Preview から production への promotion

1. `preview` 上のローカル必須検証、Vercel preview、対象機能の確認を完了する。
2. head=`preview`、base=`main` の promotion PR を作る。
3. PR 本文に含まれる変更、既知の制約、release note、production への影響、実行した検証を記録する。
4. 監督者が head=`preview`、base=`main` を手動確認し、ローカル検証の実出力と `Vercel` の成功を確認する。review conversation をすべて解決する。保存された `Enforce preview-to-main promotion` は Actions 停止中には動かない。
5. Owner が production 反映を承認して human merge する。履歴と到達可能性を保つため、promotion PR は merge commit を使う。
6. Vercel production deployment、主要 URL、公開 score/model attribution を確認する。

緊急修正も原則として topic branch → `preview` → promotion PR の順を守る。例外が必要な場合は、Owner が理由、実行者、検証、後続の同期方法を Issue または PR に記録する。

## GitHub protection の rollout

**2026-10-08 から GitHub Actions は無効**であり、`quality` は実行されない。`preview` と `main` の required check は `Vercel` のみとなった（JOB_0218）。pull request、review conversation resolution、force push と branch deletion の禁止など、その他の protection は維持する。`.github/workflows/**` は変更せず保存する。

Actions または CI 要件の復旧は、先に Owner の明示承認を得る。承認後の rollout では、保存された workflow の exact check name `quality`（UI 表示 `CI / quality`）が初回成功したことを確認してから required に戻す。存在しない context を先に required にして待ち続けないようにする。復旧まで、監督者はローカル検証の実出力と promotion の head を手動確認する。

## 基本検証

PR を開く前の必須チェーンは [`AGENTS.md`](../AGENTS.md) の Acceptance commands および [`CONTRIBUTING.md`](../CONTRIBUTING.md) の必須検証と同一である。リポジトリルートで次を実行する。コード変更は短い部分集合では受け入れない。文書のみの変更は `bun run check:docs-links` を実行して実出力を PR に貼る。Issue が全チェーンを要求する場合はそれに従う。

```bash
export PUBLIC_GA4_MEASUREMENT_ID='' PUBLIC_X_PIXEL_ID='' PUBLIC_META_PIXEL_ID=''
export PUBLIC_CF_BEACON_TOKEN='' PUBLIC_GOOGLE_ADS_ID=''
bun install --frozen-lockfile
bun run test          # read the "N pass" / "N fail" lines, not only the last line
bun run typecheck
bun run build
REQUIRE_BUILT_ARTIFACTS=1 bun test scripts/home-css-loading.test.ts src/site/models-built.test.ts scripts/home-js-asset.test.ts
bun run verify:gates
bun x playwright install --with-deps chromium   # the browser binary is not a package dependency
bun x playwright test --reporter=line           # local rendered-output checks
git diff --exit-code
```

五つの `PUBLIC_*` は空文字で上書きする。unset では足りない。`.env*`（例: `.env.local`）が本番の tracker ID を供給し得る。ID があるとビルドがトラッカーブロックを出し、`vercel.json` の CSP hash が変わり、ローカルのテスト流量が本番 analytics に入る。本番 HTML や実プレビューから ID を拾って埋めない。

空の GA4 markup でビルドした上のローカルチェーンでは、analytics specs（`tests/e2e/analytics.spec.ts`）は自分で skip する。analytics の専用確認（`bun run test:e2e` / `scripts/run-e2e.sh`）は隔離した仮想 GA4 ID（`PUBLIC_GA4_MEASUREMENT_ID=G-E2E0000000`）だけで markup を出し、残りの四つ（`PUBLIC_X_PIXEL_ID`、`PUBLIC_META_PIXEL_ID`、`PUBLIC_CF_BEACON_TOKEN`、`PUBLIC_GOOGLE_ADS_ID`）は空のままにする。本番 ID は使わない。

`bun run test` は clean checkout 用の projection fixture を先に生成してから unit tests を実行する。文書リンクだけの変更でも `bun run check:docs-links` を実行する。Playwright defaults to port 4321. For parallel workspaces, use `PLAYWRIGHT_PORT=<available port>` with a distinct port for each suite; never reuse another workspace's server. An explicit override disables server reuse. SEO baseline drift が出た場合は、意図した差分かを確認してから [`SEO_OG_BASELINE.md`](SEO_OG_BASELINE.md) の手順に従う。
