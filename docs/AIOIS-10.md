# AIOIS-10

サイト上の公開正典は `/standard`、その実装ソースは [`src/pages/standard.astro`](../src/pages/standard.astro) である。このファイルは、公開標準と score batch、prompt、開発手順をつなぐ開発者向け入口として維持する。

## 現行契約

- 標準: AIOIS-10 v1.0
- 対象: JILPT IPD v7.00 の 556 職業
- Active batch の選択と表示名: [`src/site/score-attribution.ts`](../src/site/score-attribution.ts)
- Score schema: [`src/data/schema/score-run.ts`](../src/data/schema/score-run.ts)
- Batch 追加手順: [`SCORING_RUNBOOK.md`](SCORING_RUNBOOK.md)
- データ選択規則: [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md) の「スコア選択」

モデル名と run date はこの文書へ複製しない。`data/scores/` の active occupations batch と build-time attribution を正典とし、モデル更新時の文書 drift を避ける。

各 AIOIS-10 batch は `aiois.d1` から `aiois.d10`、`transformation`、`displacement` を持ち、`ai_risk` は `aiois.transformation` と一致しなければならない。ユーザー向け説明文と SEO/GEO 出力は `/standard`、`src/pages/standard.astro`、生成される `public/llms*.txt` を正典にする。
