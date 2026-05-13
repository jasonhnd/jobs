# `data/` — build パイプラインの正典ソース

ここにあるすべてのファイルは `npm run build:data` の **入力**。TypeScript ETL(`src/data/build.ts`)がこのディレクトリから読み、対応する Zod スキーマで各ファイルを検証し、12 の projection ファミリーを `public/data.*` に書き出す(その後 Astro build がそれを `dist-astro/` に焼き込む)。

## レイアウト

```
data/
├── occupations/       <padded>.json × 556    — 職業ごと 1 ファイル、正典ソース
├── stats_legacy/      <padded>.json × 552    — 労働市場統計(年収、就業者数等)
├── scores/            <scope>_<model>_<date>.json — AI risk スコア実行(append-only)
├── labels/            <dimension>.ja-en.json × 7 — グローバルな skills/knowledge/abilities ラベル
├── sectors/
│   ├── sectors.ja-en.json                    — 16 sector の分類定義
│   └── overrides.json                        — 手動の occ→sector オーバーライド
├── prompts/           prompt.ja.md           — LLM スコアリングプロンプトテンプレート(監査トレイル)
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

## 実例 — 1 つの職業

`data/occupations/0001.json`(slim スケッチ — フル契約は `src/data/schema/occupation.ts` の `OccupationSchema` を参照):

```json
{
  "id": 1,
  "schema_version": "1.2",
  "title": {
    "ja": "豆腐製造、豆腐職人",
    "aliases_ja": ["豆腐製造工", "豆腐職人"]
  },
  "classifications": {
    "mhlw_main": "12_072-06",
    "mhlw_all": ["12_072-06"],
    "jsoc_main": "H533",
    "jsoc_all": ["H533"]
  },
  "description": {
    "summary_ja": "豆腐店やメーカーの工場で、豆腐、油揚げ、生揚げを作る。",
    "what_it_is_ja": "...",
    "how_to_become_ja": "...",
    "working_conditions_ja": "..."
  },
  "tasks": ["...", "..."],
  "tasks_lead_ja": "...",
  "skills":     { /* skill ごとの数値プロファイル */ },
  "knowledge":  { /* knowledge ごとの数値プロファイル */ },
  "abilities":  { /* ability ごとの数値プロファイル */ },
  "work_activities":      { /* ... */ },
  "work_characteristics": { /* ... */ },
  "interests":            { /* ... */ },
  "work_values":          { /* ... */ },
  "education":            { /* ... */ },
  "employment_type":      { /* ... */ },
  "related_orgs":  [{ "name_ja": "全国豆腐連合会", "url": "http://..." }],
  "related_certs_ja": ["食品衛生責任者"],
  "url": "https://shigoto.mhlw.go.jp/User/Occupation/Detail/1"
}
```

12 個の数値サブディビジョン(skills、knowledge、abilities 等)は `OccupationSchema` の null 規則に従う: 各ブロックは完全に埋まっているか、もしくは完全に null か、どちらか。半分埋まったすべて None 値の辞書にはならない。

## `public/data.*` には何があるか

ここではない。`public/data.*` は `npm run build:data` によって **生成** される(`data/` を読み、`public/` に書く)。gitignored で、Vercel デプロイのたびに再生成される。projection の形を知りたければ、`src/data/projections/*.ts` を参照。

## アーカイブポリシー

- `data/_archive/` — 復旧可能なバックアップ(例: v1.4.0 で削除された翻訳)。ここから戻すことで復元できる。
- `data/.archive/v0.6/` — v0.6 → v0.7 schema 移行のフリーズした監査トレイル。編集禁止。

両ディレクトリとも意図的に git で追跡されている。
