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

初回 `/models` release（#125 / PR #131）は上記 4 summary section まで。Owner feedback により、次の **Phase 2c-deep** で詳細比較を足す。2c-deep の実装 PR は green gates だけでは merge しない。PR 自身の Vercel preview URL でレンダリングされた `/models` を Jason が確認し、承認してから merge する。

### 2c-deep. `/models` deep-dive addendum

目的は「モデル差を読める材料」を増やすことであり、スコア選択や正典化の規則は変えない。`pickLatestScore` は引き続き最新 `run_date` 規則のまま、`score_history` projection は引き続き `rationale_ja` を持たない。UI copy は既存 `/models` と同じく日本語のみ。`/models` は職業 detail page と揃えるため user-facing label set を使い、formal standard names は `/standard` のみに置く。

#### 1. Per-dimension drift table（D1-D10）

連続する AIOIS-10 batch pair ごとに、D1–D10 の平均差を 1 table で出す。対象 pair は `/models` の既存 drift pair と同じ chronological order（例: Opus 4.8 → Fable 5、Fable 5 → GPT 5.6 SOL）で、legacy single-axis batch は D1–D10 を持たないため除外する。

計算は `src/graph/aiois-drift.ts` の `computeDriftReport()` を再利用する。`dimDrift[k]` は `candidate.dims[k] - baseline.dims[k]` の平均、`dimAbsDrift[k]` は職業ごとの `|candidate.dims[k] - baseline.dims[k]|` の平均であり、table の drift / mean absolute drift はこの値を使う。before / after mean は `computeDriftReport()` に渡す同一の comparable score map から求め、別の page-local drift 式は作らない。共通職業数が pair 内で一致することを前提にし、欠損 D1–D10 を含む entry は pair 全体の比較対象から外す。

Columns:

| Column | Value |
|---|---|
| `pair` | `{baseline modelDisplay}（{baseline date}）→ {candidate modelDisplay}（{candidate date}）` |
| `dimension` | `D1` ... `D10` |
| `dimension_ja` | `src/templates/Aiois10Profile.ts` の user-facing D1–D10 label constants（職業 detail page と同じ表示名）から取得する。ここで別の固定 label list は持たない |
| `baseline_mean` | baseline の comparable occupations における当該 dimension 平均、2 桁表示 |
| `candidate_mean` | candidate の comparable occupations における当該 dimension 平均、2 桁表示 |
| `drift` | `candidate_mean - baseline_mean`。`computeDriftReport().dimDrift[index]` と一致させる |
| `mean_abs_drift` | `computeDriftReport().dimAbsDrift[index]`、2 桁表示 |
| `n` | pair の `comparedCount` |

Sort order は pair ごとに `abs(drift)` descending、tie は `dimension` ascending（D1 → D10）。色や矢印は drift の符号だけに従い、解釈文は次項の fixed template だけで生成する。

#### 2. Model tendency notes（Japanese, data-driven）

各 batch pair の D1–D10 aggregate から、短い日本語 note を固定テンプレートで生成する。自由作文、LLM 生成 prose、職業別 rationale の要約は禁止。入力は前項の per-dimension drift table と同じ `drift` / `dimension_ja` / `modelDisplay` のみ。

Selection:

- `abs(drift) >= 0.50` の dimension だけを mention 対象にする。
- 1 pair あたり最大 3 文。`abs(drift)` descending、tie は D1 → D10。
- `abs(drift) >= 0.75` は「大きく」、`0.50 <= abs(drift) < 0.75` は「やや」を使う。
- 閾値を満たす dimension がない場合は fallback 1 文だけ: `このペアでは、平均差が0.50以上のD1〜D10はありません。`

Templates:

| Condition | Template |
|---|---|
| `drift > 0` | `{candidateModel} は {baselineModel} より「{dimension_ja}（{dimension}）」を{degree}重く見ています（{drift:+0.00}）。` |
| `drift < 0` | `{candidateModel} は {baselineModel} より「{dimension_ja}（{dimension}）」を{degree}軽く見ています（{drift:-0.00}）。` |

Example shape: `Fable 5 は Opus 4.8 より「体・現場の仕事（D3）」を大きく重く見ています（+0.96）。` この文も実データから閾値を満たした場合だけ出す。

#### 3. Rationale side-by-side

最新 2 つの comparable AIOIS-10 batch pair について、divergence が大きい職業の両 batch `rationale_ja` を横並びで出す。`score_history` は no-rationale size rule を維持するため、rationale は専用 build-time projection **`data.models_deep.json`** で供給する。Astro build がこの projection を読んで `/models` HTML に必要部分だけ inline し、browser から `data.models_deep.json` を fetch しない。Astro page が `data/scores/` を直接読み込んで同じ抽出を再実装する方式は採用しない。

Selection:

- N = 8（5–10 の範囲内で、desktop でも mobile でも読み切れる上限）。
- 最新 pair の `computeDriftReport().rows` を `abs(dT)` descending、tie は `id` ascending で sort し、上位 8 件を採用する。
- 各 row は職業ページ `/{id}` へリンクする。表示名は既存 `titlesByOcc` / graph title を使う。
- `rationale_ja` がどちらかの batch で欠損する row は projection build で除外し、次順位を繰り上げる。8 件に満たない場合は存在する件数だけ表示する。

Projection contract（`public/data.models_deep.json`）:

```json
{
  "latest_pair": {
    "baseline": { "model": "claude-opus-4-8", "modelDisplay": "Claude Opus 4.8", "date": "2026-05-30" },
    "candidate": { "model": "claude-fable-5", "modelDisplay": "Claude Fable 5", "date": "2026-06-13" }
  },
  "rationale_pairs": [
    {
      "id": 123,
      "title_ja": "職業名",
      "href": "/123",
      "baseline_transformation": 4.2,
      "candidate_transformation": 5.4,
      "drift": 1.2,
      "baseline_rationale_ja": "前回 batch の rationale_ja。",
      "candidate_rationale_ja": "今回 batch の rationale_ja。"
    }
  ]
}
```

Payload bound: projection は最新 pair の rationale side-by-side に必要な最大 8 rows だけを持つ。`rationale_ja` は 1 batch あたり 220 UTF-8 bytes 目安、hard cap は 500 bytes。`data.models_deep.json` 全体は pretty-print しない JSON で **30 KB 以下**を gate にする。30 KB を超える場合は N を下げるのではなく、表示対象 field を見直して rationale 以外の payload を削る。

#### 4. Static SVG distribution charts

Chart は build-time で文字列生成した inline SVG のみ。client-side JS、hydration、外部画像 request は使わない。`/models` HTML に直接 inline し、既存 CSS / JS budget 内に収める。SVG の数値入力は `score_history` / drift pair と同じ comparable AIOIS-10 entries から作る。

Charts:

- Transformation histogram: 最新 2 つの AIOIS-10 batches を比較する。bucket width は `0.5`、domain は fixed `0.0–10.0`、bucket は `[0.0,0.5) ... [9.5,10.0]` の 20 bins。2 batch は同一 x 軸で adjacent bars（mobile で潰れる場合は overlaid outline + translucent fill）。y 軸は両 batch の最大 bin count を共通上限にする。
- Before/after scatter: 最新 pair の common occupations を 1 職業 1 point で描く。x 軸は baseline transformation、y 軸は candidate transformation、両軸 fixed `0–10`。`y=x` reference line を入れる。point color は candidate band（`riskBand`: low / mid / high）に従う。hover tooltip は使わず、上位 divergence の具体名は rationale side-by-side table で読む。

SVG accessibility:

- 各 SVG は `<svg role="img" aria-labelledby="...">` を持つ。
- `<title>` は chart の内容を日本語で短く書く（例: `最新2バッチのAI影響度分布`）。
- `<desc>` は batch 名、domain、bin width または軸定義を含める。
- SVG 直後に text fallback を置く。histogram は各 batch の mean / median / high-band share、scatter は common count / mean drift / band-cross count を日本語で表示する。

Rendering constraints:

- SVG viewBox は responsive。desktop は幅 100%、最大 960px、mobile は横スクロールではなく縮尺維持で読めるサイズにする。
- Axis labels と legend は日本語。legend は color だけに依存せず、text label（低 / 中 / 高、batch 名）を併記する。
- SVG と fallback を合わせた追加 HTML は 20 KB 以内を目安にし、`data.models_deep.json` とは別に追加 network request を発生させない。

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
