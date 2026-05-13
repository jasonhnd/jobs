# data/.archive/v0.6/ — IPD 移行前のフリーズしたソースファイル

これらのファイルは v0.6.x までの **正典ソースデータ** だった。v0.7.0 (2026-05-04) からパイプラインは JILPT IPD v7.00 のソースデータに移行し、これらのファイルは **build_data.py / build_occupations.py / api/og.tsx / index.html のいずれからも読まれなくなった**。以下の目的で保管している:

- **監査トレイル** — git 履歴から v0.6.x の任意のデプロイを再現できる
- **移行 provenance** — `migrate_stats_legacy.py` / `migrate_translations.py` / `migrate_scores.py` がどのフィールドがどこから来たかを正確にドキュメントする
- **クロスバージョン差分** — アーキテクチャ世代をまたいでスコアやラベルを比較するとき

## 内容

| ファイル | 由来 | 置換先 |
|---|---|---|
| `data.json` | v0.6.x の `build_data.py`(legacy)による 552 レコードのフラット build 出力 | `dist/data.treemap.json`(552 records, array-of-objects)+ `dist/data.detail/<id>.json` × 556 |
| `occupations_full.json` | jobtag.mhlw.go.jp ページの raw スクレイプ(580 records、`ok=False` の 28 件含む) | `data/occupations/<padded>.json` × 556(JILPT IPD v7.00 xlsx 由来) |
| `occupations.json` | 旧バージョンの (id, title) 対の小さなインデックス | `data/occupations/<padded>.json`(タイトルは保持) |
| `ai_scores_2026-04-25.json` | Claude Opus 4.7 単一実行、v1.0 schema でのスコア | `data/scores/occupations_claude-opus-4-7_2026-04-25.json`(ScoreRun v2.0 schema、同じ 552 スコア + 完全な監査メタデータ) |
| `translations_2026-04-25.json` | Claude Opus 4.7 の単一ファイル翻訳 | `data/translations/en/<padded>.json` × 552 |

## v0.6.x 出力の再現

```
git checkout v0.6.x
python3 scripts/build_data.py   # v0.6 バージョン、data.json を直接読む
```

v0.7+ のパイプラインをこれらのファイルに対して **走らせないこと**。v0.7+ のスクリプト(`scripts/import_ipd.py`、`scripts/build_data.py`)は新しい `data/occupations/` 等のパスから読み、このアーカイブは完全に無視する。

## 編集禁止

これらのファイルは **フリーズ済み**。新しい作業はすべて IPD パイプラインを通す。削除された職業やラベルを復旧したい場合は、フィールドを新しい schema にコピーすること。v0.6.x ファイルを蘇生させないこと。

— 最終フリーズ: 2026-05-04(IPD 移行 Phase 4)
