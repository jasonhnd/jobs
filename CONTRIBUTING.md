# コントリビューションガイド

Issue と Pull Request を歓迎します。非自明な変更は、実装前に目的・範囲・受け入れ条件・検証方法を GitHub Issue に残してください。詳細な運用は [`docs/WORKFLOW.md`](docs/WORKFLOW.md) を正典とします。Node / Bun / Astro / Vercel の版と三平面は [`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md) を正典とします。Install / `bun test` / ETL は Bun **1.4.2**（保存された CI 設定は `bun-version: 1.4.2`。Vercel は `bunVersion: "1.4.x"` のビルドイメージ Bun で `bun install --frozen-lockfile`）。Builds の Node 24 は `.nvmrc` + 保存された CI 設定 `24.x` + Vercel default（**`engines.node` は置かない** — `bunVersion` と衝突する）。`vercel.json` は `"bunVersion": "1.4.x"`。`api/og` / `api/shindan-share` / middleware は `runtime: "nodejs"`（Bun 1.4）。OG/share は named `GET`。middleware は `@vercel/functions`。

GitHub Actions は **2026-10-08 から無効**です。`quality` は実行されず required check から外れ、`Vercel` は `preview` / `main` で必須のままです。workflow ファイルは保存します。Actions や CI 要件を復旧する前に、オーナーの明示承認を得てください。

## ブランチと Pull Request

1. 最新の `preview` から topic branch を作る。
2. 変更と必要なテスト・文書を同じ branch に含める。
3. `preview` を base に PR を作り、関連 Issue を `Closes #...` でリンクする。
4. push 前に実装担当が下記のローカル必須検証を実行し、command、exit code、pass/fail 数、skip を含む実出力を PR 本文に貼る。`Vercel` を通し、review conversation をすべて解決してから、監督者（オーナー、またはオーナーが `preview` への merge を委任した監督 agent）が diff、独立レビュー、ローカル検証の実出力を確認して merge する。実装担当は merge しない。`main` への promotion は監督者が head=`preview`、base=`main`、検証の実出力と `Vercel` 成功を手動確認し、オーナー本人が承認して merge commit で merge する。CI の head guard は実行されない。

通常の変更を `main` へ直接送らないでください。`main` は production branch であり、`preview → main` の promotion PR だけを受け付けます。

## 必須検証

PR を開く前に、リポジトリルートで [`AGENTS.md`](AGENTS.md) の Acceptance commands と同一のチェーンを実行する。コード変更は短い部分集合では受け入れない。文書のみの変更は `bun run check:docs-links` を実行し、実出力を PR 本文に貼る。Issue が全チェーンを要求する場合はそれに従う。

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

五つの `PUBLIC_*` は空文字で上書きする。unset では足りない。`.env*`（例: `.env.local`）が本番の tracker ID を供給し、ビルドがトラッカーブロックを出して `vercel.json` の CSP hash を変え、ローカルのテスト流量を本番 analytics に送る。本番 HTML や実プレビューから ID を拾って埋めない。

空の GA4 markup でビルドした上のローカルチェーンでは、analytics specs（`tests/e2e/analytics.spec.ts`）は自分で skip する。analytics の専用確認（`bun run test:e2e` / `scripts/run-e2e.sh`）は隔離した仮想 GA4 ID（`PUBLIC_GA4_MEASUREMENT_ID=G-E2E0000000`）だけで markup を出し、残りの四つ（`PUBLIC_X_PIXEL_ID`、`PUBLIC_META_PIXEL_ID`、`PUBLIC_CF_BEACON_TOKEN`、`PUBLIC_GOOGLE_ADS_ID`）は空のままにする。本番 ID は使わない。

`bun run test` は clean checkout でも projection fixture を利用できるよう、最初に `build:data` を実行します。`bun run build` は CSP hash などの tracked configuration を更新することがあります。最後の `git diff --exit-code` が失敗した場合は、生成差分が意図した変更か確認し、必要なファイルを同じ PR に含めてください。文書のみの変更でも `bun run check:docs-links` を実行します。Playwright defaults to port 4321. For parallel workspaces, use `PLAYWRIGHT_PORT=<available port>` with a distinct port for each suite; never reuse another workspace's server. An explicit override disables server reuse. SEO baseline が変わる変更は [`docs/SEO_OG_BASELINE.md`](docs/SEO_OG_BASELINE.md) に従ってください。

## 変更時の注意

- 公開 UI は日本語を正本とし、repository content は英語または日本語で記述する。
- UI・CSS・markup に触れる変更は [`docs/Design.md`](docs/Design.md)（Design v1.2）を正典とする。実装前に §0 早見カードを読む。`font-size` / `color` / `padding` / `border-radius` / `z-index` に生の値を書かず、トークンを `var()` で参照する。段・役割・トークンを増やす場合は先に `docs/Design.md` を更新し、版の変更はオーナー承認を得る（§19.4 / §20）。surface ごとの移行状況と完了チェックリストは [`docs/DESIGN_CONFORMANCE.md`](docs/DESIGN_CONFORMANCE.md) にあり、移行 PR では同じ PR で台帳の行を更新する。
- score batch は append-only とし、既存 run を上書きしない。
- URL、数値、SEO、Edge API は既存の canonical helper と schema を再利用する。
- secret、生成済み `dist-astro/`、個人用設定を commit しない。
