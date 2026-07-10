# Multi-Model Scoring — GPT-5.6 SOL 導入と多モデル比較の設計

Status: 設計ドラフト（レビュー待ち）
Date: 2026-07-10
Owner: Jason（承認ゲート） / conductor（分割・review） / loopcoder（実装）

新モデルが出るたびに AIOIS-10 スコアリングを再実行し、過去バッチと比較できる体制を恒久化する。第 1 弾として `gpt-5.6-sol` を追加する。スコアリング手順の正典は引き続き [`SCORING_RUNBOOK.md`](SCORING_RUNBOOK.md)、スコア選択規則は [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md) §7.4。本書はその上に載る差分設計だけを扱う。

## 決定事項（2026-07-10 Jason 確認済み）

1. **比較 UI は「職業詳細ページの比較ブロック + 全站モデル比較ページ」の両方を作る。**
2. **全量バッチ検収後、`gpt-5.6-sol` が正典スコアになる**（ランキング / band / 診断 / JSON-LD を駆動する単一値）。現行の「run_date 最新が勝つ」`pickLatestScore` 規則は変更しない。
3. **実行は Codex CLI サブスクリプション経由**。OpenAI API key / Batch API は使わない。

## 変わらないもの

以下は既存資産をそのまま使う。**変更禁止**（変更が必要になったら本書を先に改訂する）。

| 資産 | 役割 |
|---|---|
| `data/scores/<scope>_<model>_<date>.json` | append-only のバッチ置き場。過去バッチ（opus-4-7 / opus-4-8 / fable-5）は永久保持 |
| `scripts/assemble-scores.ts` | raw JSONL → score-run JSON の組み立て |
| `scripts/check-score-batch.ts` | バッチ検証 |
| `scripts/aiois-drift-report.ts` | baseline vs candidate の漂移レポート |
| `src/graph/score-strategy.ts` の `pickLatestScore` | 正典スコア選択（最新 run_date） |
| `SCORING_RUNBOOK.md` の pilot → drift → 承認 → full run の流れ | プロセスゲート |

## Phase 1 — Codex CLI runner と GPT-5.6 SOL バッチ

### 新規: `scripts/run-scoring-codex.ts`

`run-scoring.ts`（Anthropic Batches 専用）の兄弟スクリプト。実行エンジンだけを差し替え、**出力 JSONL 契約は完全に同一**にする: 1 行 = `{id, ai_risk, rationale_ja, confidence, aiois: {d1..d10, transformation, displacement}}`。契約が同じなので assemble / check / drift / ETL は無改修で流れる。

要件:

- 職業ごとに `codex exec` を呼び、AIOIS-10 プロンプト（既存 Fable 5 版を流用）+ 職業抽出テキストを渡す。
- **JSON 強制と再試行**: 出力を Zod で検証し、不正なら同一入力で最大 3 回リトライ。最終失敗は id を failures リストに記録して続行（全体を落とさない）。
- **断点続行（--resume）**: 556 件の逐次実行は数時間かかる。1 件完了ごとに JSONL へ追記し、再起動時は完了済み id をスキップ。
- **小並発**: 2〜4 プロセス程度の並列。サブスクリプションのレート制限に当たったら指数バックオフ。
- **監査トレイル**: 各呼び出しの生レスポンスを `.cache/scoring/<run>/raw/` に保存（API バッチの可監査性の代替）。
- プロンプトの監査コピーを `data/prompts/<date>_gpt-5.6-sol-aiois10.ja.md` として保存（既存慣例）。
- LOCAL dev tool。build / verify:gates / vercel.json には配線しない（`run-scoring.ts` と同じ扱い）。

### 実行手順（SCORING_RUNBOOK の流れをそのまま踏む）

1. pilot: 代表 30–50 件（`make-pilot-sample.ts` 流用）。産物は `.cache/scoring/` 配下、`data/scores/` には入れない。
2. `aiois-drift-report.ts` で `occupations_claude-fable-5_2026-06-13.json` を baseline に漂移レポートを出す。**クロスベンダーなので漂移は大きい可能性がある**。
3. Jason がレポートを見て全量実行を承認（このゲートは省略不可）。
4. 全量 556 件 → assemble → check → `data/scores/occupations_gpt-5.6-sol_<date>.json` として一括入庫。入庫した時点で `pickLatestScore` により全站の正典スコアが同時に GPT へ切り替わる（部分切替は起きない）。

### 実行タイミングの合意

pilot / 全量の実行はサブスクリプション額度と長時間ランを消費するため、**着手前に都度 Jason に確認**する（実装完了 ≠ 実行開始）。

## Phase 2 — 比較 UI（Phase 1 と独立、並行着工可）

GPT データが無くても既存 3 バッチ（opus-4-7 / opus-4-8 / fable-5）で開発・検証できる。GPT バッチ入庫後は自動で 1 列増える。

### 2a. `score_history` projection の復活

2026-05-13 の Step 12 dead projection cleanup で削除された `buildScoreHistory` を git 履歴から復元し、AIOIS-10 フィールド（d1..d10 / transformation / displacement）を含む形に更新する。ETL の `historyByOcc` は既に全履歴を保持しているので、projection は薄い書き出しのみ。出力サイズ規則: この projection には数値（transformation / displacement / D1–D10）と model / run date のみ載せ、`rationale_ja` は含めない（正典バッチの rationale は既存の詳細 projection が持っている）。

### 2b. 職業詳細ページの比較ブロック

各職業に、歴代バッチの一覧（モデル名 / run date / transformation / 正典との差分）。純日文。正典バッチの行を明示（「現行スコア」バッジ等）。デザインは全站の視覚統一規則（1080 幅等）に従う。

### 2c. `/models` 全站比較ページ

集計は `aiois-drift-report.ts` が export している純関数を流用する。内容:

- モデル別サマリ: 平均 transformation / displacement、D1–D10 平均、run date、対象件数
- バッチ間漂移: band 移動数、平均漂移
- 分岐が最大の職業ランキング（編集向けコンテンツとしても機能させる）
- 方法論注記: どのバッチが正典かの明示（`/methodology` `/standard` からリンク）

## リスクとトレードオフ（記録）

- **Codex CLI 経路の代償**: batch 割引なし・逐次で遅い・構造化出力の安定性が API より劣る。リトライ + 生レスポンス保存で補う。将来 OpenAI API key を持つことになったら `--provider openai` の Batch 経路を足す余地を残す（JSONL 契約が同じなので runner 追加だけで済む）。
- **正典切替は一回性の大変動**: 入庫日に 556 職業のスコア・ランキング・band・診断・JSON-LD が一斉に変わる。drift レポートが唯一の事前判断材料。
- **rationale_ja の品質**: GPT の日本語 rationale が現行の文体基準に合わない可能性。pilot レビュー項目に含める。

## 実装分割（issue 予定）

| # | 内容 | 依存 |
|---|---|---|
| 1 | `run-scoring-codex.ts`（JSONL 契約 + resume + retry + 監査保存）+ テスト | なし |
| 2 | `score_history` projection 復活 + データ契約テスト | なし |
| 3 | 職業詳細ページ比較ブロック | #2 |
| 4 | `/models` 比較ページ | #2 |
| 5 | pilot 実行 → drift レポート → Jason 承認 → 全量入庫 | #1（実行は都度承認） |
