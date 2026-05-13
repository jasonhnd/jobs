# GA4 Funnel + Looker Studio — クイックビルドリファレンス

> 2026-05-06。`spec.yaml` と `setup-ga4.mjs` の付属ドキュメント。GA4 計測が対応する funnel exploration と Looker Studio ダッシュボードを、すばやく再構築できる設定値とともに列挙する。

`spec.yaml` + `setup-ga4.mjs` の自動化は **スキーマ**(イベント、ディメンション、key event)を扱う。本ドキュメントは **可視化**(funnel exploration、ダッシュボード)を扱う。可視化は GA4 の Admin API で公開されていないため、ダッシュボード UI から 1 回構築する必要がある。設定は property ごとに保存され、毎回の訪問時に再実行される。

---

## ✅ 構築済 — `mirai-shigoto` property で稼働中

### Funnel 1 — メインコンバージョン

GA4 → Explore → 「Funnel 1 — Main conversion」

| ステップ | ステップ名 | イベント | 実データ(28d、2026-05-06) |
|---|---|---|---|
| 1 | Session start | `session_start` | 2,892 users(100%) |
| 2 | Map loaded | `map_loaded` | 1,745(60.3%) |
| 3 | Tile click | `occupation_tile_click` | **80(4.6%) — 95% drop** |
| 4 | Detail page view | `result_view` | 74(92.5% completion) |

**主要所見(2026-05-06):** Map → Tile click のドロップは 95%。コンバージョンファネル内で ROI が最も高い最適化ポイント。

### Funnel 2 — Search CTR

GA4 → Explore → 「Funnel 2 — Search CTR」

| ステップ | ステップ名 | イベント |
|---|---|---|
| 1 | Typed query | `job_search_typed` |
| 2 | Search intent | `job_search_intent` |
| 3 | Search navigate | `job_search_navigate` |
| 4 | Detail page view | `result_view` |

**目的:** P0-A 変更(typed-signal と intent-signal の分離)を検証する。2026-05-06 以降の真の CTR 公式は `step3 / step2`。汚染されていた旧公式 `job_search_navigate / job_search_submit` は 22% を示していたが、新しいクリーンな公式はデータ蓄積後に > 50% に推移する見込み。

---

## 📋 未構築 — 必要時に UI で構築(各 ~5 分)

構築手順:
1. GA4 → 左サイドバー → Explore(`⊕` アイコン)
2. 「Funnel exploration」テンプレートをクリック
3. exploration を `Funnel N — <Name>` にリネーム
4. STEPS 見出し横の ✏ をクリック(または「Add concept」ボタン)
5. 各ステップ: テンプレートイベントを削除(X アイコン)→ chip クリック → 検索 → 下記イベントを選択 → Step 名を設定
6. フィルタ: STEPS 下の FILTERS パネルを使う(またはステップ単位のパラメータフィルタ)
7. 右上 Apply(または自動保存)

### Funnel 3 — モバイル第一画面

| ステップ | ステップ名 | イベント |
|---|---|---|
| 1 | Session start | `session_start` |
| 2 | Map loaded | `map_loaded` |
| 3 | Tile or chip | `occupation_tile_click`(`Or` 句: `popular_job_click`) |

**フィルタ**(右サイド FILTERS パネルでファネル全体に適用):
- `device_category` が `mobile` に完全一致

**目的:** P0-D F1/F2/F3(iOS キーボード + tap-vs-scroll + blur-timeout)を検証。デプロイ前後(2026-05-06)のコンバージョン率を比較する。

### Funnel 4 — MHLW jobtag への外部リンク

| ステップ | ステップ名 | イベント |
|---|---|---|
| 1 | Detail page view | `result_view` |
| 2 | Jobtag click | `jobtag_outbound_click` |

**目的:** コンプライアンス信号(MHLW ソースへの帰属チェーンが行使されている証拠)+ 私たちの分析後に公式ソースに進むユーザー数の計測。

### Funnel 5 — Sector hub ファネル

| ステップ | ステップ名 | イベント |
|---|---|---|
| 1 | Sector hub view | `page_view` |
| 2 | Tile or chip | `occupation_tile_click`(Or: `popular_job_click`) |
| 3 | Detail page view | `result_view` |

**Step 1 のフィルタ**(イベントパラメータ):
- `page_path` が `/sectors/` を含む

**目的:** sector hub は SEO の入口ページ群。専用ランディングページ経由の sector → detail のコンバージョンを計測する。

---

## Looker Studio Dashboard — 仕様

パス: <https://lookerstudio.google.com> → Create → Blank report → Data source: GA4 → property `mirai-shigoto`(id `298707336`)。

推奨名: `mirai-shigoto KPI Dashboard`。

| # | チャート種別 | タイトル | ディメンション / メトリクス |
|---|---|---|---|
| 1 | Scorecard | Active users(28d) | Active users、直近 28 日 |
| 2 | Scorecard | Real search CTR | `job_search_navigate` / `job_search_intent` |
| 3 | Time series | Sessions per day(90d) | Sessions、日付別 |
| 4 | Pie chart | Device split | `device_category` × Sessions |
| 5 | Table | Top 10 high-AI-risk occupations | `occupation_id`(`risk_tier`=`high` でフィルタ)、Event count |
| 6 | Table | Top 10 search queries | `query`(`job_search_typed` から)、Event count |
| 7 | Table | Top 10 jobtag-outbound occupations | `occupation_id`、`jobtag_outbound_click` count |
| 8 | Table | Sector hub traffic | `page_path`(`/sectors/` を含む)、Sessions |

注意:
- Looker Studio のデータ遅延は ~4 時間。リアルタイムが必要なら GA4 に戻る
- Top-10 テーブルは Rows = 10、降順ソート
- 上部に Date range control を追加して全チャートを統一スコープで制御

---

## 決定ログ(`analytics/README.md` にもミラー)

2026-05-06 時点で明示的に **やらない** と決定:

- Consent Mode v2 / GDPR cookie consent — サイトは JA-only で、計測可能な EU/UK トラフィックは無い。EU トラフィックが 5% を超えた場合のみ再検討
- A/B テストフレームワーク — ほとんどの UI 変更について統計的有意性を出すにはサイトトラフィックが低すぎる。現在の規模では before/after 比較で十分
