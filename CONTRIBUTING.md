# コントリビューションガイド

Issue と Pull Request を歓迎します。非自明な変更は、実装前に目的・範囲・受け入れ条件・検証方法を GitHub Issue に残してください。詳細な運用は [`docs/WORKFLOW.md`](docs/WORKFLOW.md) を正典とします。Node / Bun / Astro / Vercel の版と三平面は [`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md) を正典とします。Install / `bun test` / ETL は Bun **1.4.0**（CI と Vercel `installCommand` は `bunx bun@1.4.0`）。Builds の Node 24 は `.nvmrc` + CI `24.x` + Vercel default（**`engines.node` は置かない** — `bunVersion` と衝突する）。`vercel.json` は `"bunVersion": "1.4.x"`。`api/og` は `runtime: "nodejs"`（Bun 1.4）。`api/shindan-share` と middleware はまだ Edge（§9 #304–#305）。

## ブランチと Pull Request

1. 最新の `preview` から topic branch を作る。
2. 変更と必要なテスト・文書を同じ branch に含める。
3. `preview` を base に PR を作り、関連 Issue を `Closes #...` でリンクする。
4. Repository checks の rollout 完了後は `quality`（GitHub UI では `CI / quality`）と `Vercel` を通し、review conversation をすべて解決してから human merge を行う。

通常の変更を `main` へ直接送らないでください。`main` は production branch であり、`preview → main` の promotion PR だけを受け付けます。

## 必須検証

```bash
bun install --frozen-lockfile
bun run test
bun run typecheck
bun run build
bun run verify:gates
git diff --exit-code
```

`bun run test` は clean checkout でも projection fixture を利用できるよう、最初に `build:data` を実行します。`bun run build` は CSP hash などの tracked configuration を更新することがあります。最後の `git diff --exit-code` が失敗した場合は、生成差分が意図した変更か確認し、必要なファイルを同じ PR に含めてください。

文書のみの変更でも `bun run check:docs-links` を実行します。SEO baseline が変わる変更は [`docs/SEO_OG_BASELINE.md`](docs/SEO_OG_BASELINE.md) に従ってください。

## 変更時の注意

- 公開 UI は日本語を正本とし、repository content は英語または日本語で記述する。
- score batch は append-only とし、既存 run を上書きしない。
- URL、数値、SEO、Edge API は既存の canonical helper と schema を再利用する。
- secret、生成済み `dist-astro/`、個人用設定を commit しない。
