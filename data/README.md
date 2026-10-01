# `data/` — build パイプラインの正典ソース

ここにあるすべてのファイルは `npm run build:data` の **入力**。TypeScript ETL (`src/data/build.ts`) reads this directory, validates each file against its Zod schema, and writes the projections defined by `runProjection(...)` in that file to `public/data.*` (the Astro build then copies them into `dist-astro/`). The projection-family count lives in `src/data/build.ts` and is not fixed in this README.

## レイアウト

```
data/
├── occupations/       <padded>.json × 556    — 職業ごと 1 ファイル、正典ソース
├── stats_legacy/      <padded>.json          — labour-market stats (pay, workforce, and so on). The file count is whatever is in this directory (the `stats_legacy` log from `src/data/build.ts`).
├── scores/            <scope>_<model>_<date>.json — AI risk スコア実行(append-only)
├── labels/            <dimension>.ja-en.json × 7 — グローバルな skills/knowledge/abilities ラベル
├── sectors/
│   ├── sectors.ja-en.json                    — 16 sector の分類定義
│   └── overrides.json                        — 手動の occ→sector オーバーライド
├── prompts/           *.ja.md                — LLM scoring-prompt templates (audit trail). Filenames are the `*.ja.md` files in `data/prompts/`.
├── rationales/        <batch>.json × 55      — 手動キュレーション rationale のステージング領域
├── _archive/          translations-en/...    — アーカイブされた EN 翻訳(v1.4.0 で廃止)
├── .archive/v0.6/                            — フリーズした v0.6 監査トレイル(編集禁止)
├── .ipd_provenance.json                      — IPD xlsx ハッシュ + retrieved_at
└── .stats_legacy_provenance.json             — v0.6→v0.7 移行監査
```

各入力ファイルの Zod スキーマ: **`src/data/schema/*.ts`**。スキーマは各ファイルの許容内容に関する正典 — 各スキーマファイル先頭のドキュメンテーションがフィールドと null 規則を説明する。

## 各種ファイルの更新方法

| やりたいこと | 編集対象 | 実行コマンド |
|---|---|---|
| 新しい職業を追加(IPD 更新) | 何も編集しない — `npm run import:ipd` で再インポート | `npm run build:data` |
| 1 つの職業の typo 修正 | `data/occupations/<padded>.json` | `npm run build:data` |
| 職業の sector を再分類 | `data/sectors/overrides.json` | `npm run build:data` |
| 新しい sector を追加 | `data/sectors/sectors.ja-en.json`(`mhlw_seed_codes` を含む) | `npm run build:data` 後 `public/data.review_queue.json` を監査 |
| 新しい AI risk スコアを追加 | `data/scores/` に新しいファイルを置く(古い実行を上書きしない) | `npm run build:data` |
| ラベル翻訳を更新 | `data/labels/<dimension>.ja-en.json` | `npm run build:data` |

## 職業レコードの形

コピー用の部分 JSON は置かない。形がまた古くなるため、現行レコードは [`occupations/0001.json`](occupations/0001.json) を、契約は [`src/data/schema/occupation.ts`](../src/data/schema/occupation.ts) の `OccupationSchema` を直接見る。

現行の必須メタは `ipd_id` と `ingested_at`、`schema_version` は `7.00`、名称は `title_ja` と `aliases_ja`、`tasks` は `TaskSchema` のオブジェクト配列（文字列の配列ではない）。数値サブディビジョンはスキーマの null 規則に従う: 各ブロックは完全に埋まっているか、完全に null か、どちらか。

## `public/data.*` には何があるか

ここではない。`public/data.*` は `npm run build:data` によって **生成** される(`data/` を読み、`public/` に書く)。gitignored で、Vercel デプロイのたびに再生成される。projection の形を知りたければ、`src/data/projections/*.ts` を参照。

## アーカイブポリシー

- `data/_archive/` — 復旧可能なバックアップ(例: v1.4.0 で削除された翻訳)。ここから戻すことで復元できる。
- `data/.archive/v0.6/` — v0.6 → v0.7 schema 移行のフリーズした監査トレイル。編集禁止。

両ディレクトリとも意図的に git で追跡されている。
