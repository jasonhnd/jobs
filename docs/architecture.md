# 層アーキテクチャ

本書は、古い `docs/architecture.md` 参照を壊さないための互換入口である。詳細なデータ契約は [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md)、機械的に強制される import 境界は `scripts/check-architecture.cjs` を正典とする。

## 5 層

1. `src/data/` — build-time ETL、schema、projection、純粋な data helper。
2. `src/graph/` — validated source から作る in-memory knowledge graph と graph query。
3. `src/views/` / `src/page-data/` — graph/projection から template が使う view model を作る。
4. `src/templates/` — SafeHtml を返す HTML template。データ取得をしない。
5. `src/pages/` — Astro route binding。load して view/template を呼び、layout に渡す。

## 境界ルール

- 下位層は上位層を import しない。
- `src/pages/` に business logic を溜めず、route binding を薄く保つ。
- `src/templates/` は graph や filesystem を直接読まない。
- `api/og.tsx`、`api/shindan-share.ts`、`middleware.ts` はいずれも `runtime: "nodejs"` を設定している。Vercel Function バンドルの依存ファイルに `.tsx` を含めない（入口ファイル自体の `.tsx` は可）。`check:architecture` は runtime を問わず、`api/**`（`_` で始まるファイル・ディレクトリとテストを除く）と `middleware.*` の全入口から依存を辿ってこれを検証する。
- 共通処理は既存の graph、view、page-data、data helper に置き、ページ内へ複製しない。

`bun run check:architecture` がこれらの境界を検証する。違反時は import を迂回せず、責務を正しい層へ切り出す。
