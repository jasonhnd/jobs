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

> Superseded: 2c-deep の実装 PR #136 は owner preview review 後に withdrawn（未 merge）。統計 dashboard 方向ではなく訪問者向け特集ページへ設計を切り替えるため、本節は設計履歴として残し、実装対象は後続の **2c-v2** に置き換える。

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

### 2c-v2. `/models` 再設計 — 訪問者向け特集ページ

`/models` は統計 dashboard ではなく、一般訪問者が「AI の職業判断は信用できるのか」を読むための magazine-style feature page とする。Positioning copy は **「AIモデルは、あなたの仕事をどう見ているか」**。3 つの AI モデルが 556 職業を採点したら、どこで一致し、どこで割れたかを、統計表ではなく職業ごとの story と quote で見せる。

Target reader は、自分の仕事や近い職業について AI の見方がどれだけ安定しているかを知りたい site visitor。説明の軸は「AI の判断には personality があり、同じ職業でもモデルによって見え方が変わる」。operator 向けの drift analysis は `scripts/aiois-drift-report.ts` に残し、`/models` 本体では詳細統計を読ませない。

#### Page structure（上から下まで 6 parts 固定）

1. **Hero / 導入**
   - Hook copy を先に置く。例: `556 の職業を、3 つの AI モデルがそれぞれ採点した。結果は同じではなかった。`
   - 続けて 1 short paragraph だけ置き、読者への意味を説明する。AI の判断には personality があり、同じ occupation でも score が大きく変わることがある、という文脈に限定する。
   - Hero 内に平均値、drift 値、D1–D10、histogram 等の統計要素は置かない。

2. **登場モデル**
   - `data/scores/` にある scoring batch ごとに 1 profile card を出す。現時点は Opus 4.7 / Opus 4.8 / Fable 5。`gpt-5.6-sol` batch が入庫したら、batch file 追加だけで新 card が増える。
   - Card fields:

| Field | 表示 |
|---|---|
| `modelDisplay` | 読者向けモデル名（例: `Opus 4.8`、`Fable 5`） |
| `run_date` | 実行日 |
| `covered_count` | 対象職業数 |
| `personality_sentence` | drift aggregate から選ぶ、読者向け日本語 1 文 |

   - `personality_sentence` は data-informed selection で選ぶが、本文は計算テンプレートで生成しない。実装時は小さな checked-in config（例: `src/content/model-personality.ja.json`）に owner-reviewed の固定日本語文を置き、projection build は sentence id だけを選ぶ。
   - Selection rule: comparable AIOIS-10 adjacent pair から D1–D10 の aggregate drift を計算し、当該 model が candidate の場合は `candidate - baseline`、baseline の場合は次 pair の符号を反転して、その model らしさとして扱う。複数 pair が使える model は最新 adjacent pair を優先する。
   - Sentence driver は `abs(drift)` descending で 1 dimension を選ぶ。`abs(drift) >= 0.75` は strong、`0.50 <= abs(drift) < 0.75` は moderate。閾値未満なら neutral fallback sentence を使う。tie は dimension order ascending。
   - Config key は `{model, dimension, direction, strength}` または fallback を持つが、body copy には `D1`...`D10` code、drift value、`+0.96` のような内部数値を出さない。例文 shape: `現場仕事の変化を、他のモデルよりも重く見る傾向があります。`

3. **意見が一致した職業 / 割れた職業**
   - Contrast block として、全 comparable models が近く一致した occupation 約 3 件と、core story へ進む divergent intro を並べる。
   - Selection は最新 comparable AIOIS-10 pair に固定する。Consensus は `abs(dT)` ascending の上位 3 件、tie は `id` ascending。Divergent intro は同じ pair の `abs(dT)` descending を参照し、次 section の story cards へつなぐ。
   - 各 occupation name は `/{id}` の detail page に link する。ここでも raw table や per-dimension 値は出さない。

4. **分かれた職業のストーリー（core）**
   - 3–5 件の curated story cards を出す。Default は最新 comparable AIOIS-10 pair の `abs(dT)` descending、tie は `id` ascending。
   - Card fields:

| Field | 表示 |
|---|---|
| `title_ja` / `href` | 職業名。`/{id}` へ link |
| score comparison | 2 model の transformation score を静的に比較する paired score bars。CSS または inline SVG のみ、client JS なし |
| `baseline_rationale_ja` | baseline batch の `rationale_ja` を verbatim quote として表示 |
| `candidate_rationale_ja` | candidate batch の `rationale_ja` を verbatim quote として表示 |
| `editorial_sentence` | なぜ split したかを 1 文で読むための owner-reviewed 固定日本語 copy |

   - Quote layout は magazine quote として扱い、表形式の side-by-side table にはしない。`rationale_ja` は改稿・要約せず、projection に入った文字列をそのまま表示する。
   - `editorial_sentence` も computed prose ではない。実装時は checked-in config（例: `src/content/model-story-overrides.ja.json`）に occupation id ごとの固定文を置き、PR preview で owner review を受ける。
   - Curated override は小さな checked-in config で定義する。Config は `pinned_ids`（表示順を固定する ids）と `replace_ids`（自動上位から除外し、指定 id を入れる ids）を持つ。
   - Precedence: `pinned_ids` を先頭に置き、次に `replace_ids`、最後に automatic top `abs(dT)` rows を足して 3–5 件にする。同じ id は最初の出現だけ採用する。
   - Fallback: override id が最新 pair で non-comparable、`rationale_ja` 欠損、occupation graph 欠損のいずれかになった場合は build warning を出してその id を除外し、automatic top rows で穴埋めする。3 件未満になる場合は build を fail させる。

5. **CTA — 「あなたの職業では？」**
   - `/models` では search / filter UI を持たない。読者を occupation detail page と diagnostic へ送る funnel にする。
   - Copy は「あなたの職業では？」を軸にし、detail page の `score_history` block（mms-3）が職業単位の full comparison を担うことを明示する。
   - `score_history` の no-rationale rule は維持する。比較理由文は `/models` の story projection と既存 detail projection の責務であり、`score_history` に混ぜない。

6. **データについて（footer note）**
   - 1–2 lines max。表示するのは batch dates と methodology の所在だけ。
   - 例: `このページは 2026-05-xx / 2026-05-30 / 2026-06-13 の採点バッチをもとにしています。採点方法は /methodology と /standard を参照してください。`
   - Methodology section、集計の読み方、operator 向け drift 解説はここに置かない。

#### Removed from `/models`

2c-v2 の `/models` から以下は明示的に削除する。必要な分析は operator tool として `scripts/aiois-drift-report.ts` に残す。

- Batch-to-batch drift statistics table
- D1–D10 per-dimension drift table
- Template tendency notes
- Rationale side-by-side table
- Transformation histogram
- Before/after scatter
- Methodology section

#### Data channel

2c-v2 は build-time projection を使う。PR #136 branch の `src/data/projections/models-deep.ts` は starting point として流用してよいが、payload と page surface は本節の visitor-facing contract に合わせて作り直す。

Projection は latest comparable pair、consensus rows、story-card payload（score bars に必要な数値、両 batch の verbatim `rationale_ja`、editorial sentence id）を持つ。Astro build が projection を読み、必要 payload を `/models` HTML に non-pretty JSON として inline する。Browser から projection JSON を fetch しない。

Projection contract（build artifact name は実装時に決めてよいが、内容は 30 KB 以下）:

```json
{
  "generated_at": "2026-07-12T00:00:00.000Z",
  "latest_pair": {
    "baseline": { "model": "claude-opus-4-8", "modelDisplay": "Opus 4.8", "date": "2026-05-30" },
    "candidate": { "model": "claude-fable-5", "modelDisplay": "Fable 5", "date": "2026-06-13" },
    "compared_count": 556
  },
  "model_cards": [
    {
      "model": "claude-fable-5",
      "modelDisplay": "Fable 5",
      "date": "2026-06-13",
      "covered_count": 556,
      "personality_sentence_id": "fable5_d3_positive_strong"
    }
  ],
  "consensus": [
    { "id": 123, "title_ja": "職業名", "href": "/123", "delta_t": 0.02 }
  ],
  "stories": [
    {
      "id": 456,
      "title_ja": "職業名",
      "href": "/456",
      "baseline_transformation": 4.2,
      "candidate_transformation": 5.4,
      "baseline_rationale_ja": "前回 batch の rationale_ja。",
      "candidate_rationale_ja": "今回 batch の rationale_ja。",
      "editorial_sentence_id": "456_latest_pair_split"
    }
  ]
}
```

Payload bound: inline JSON は pretty-print しない。Projection 全体は **30 KB 以下**を gate にする。30 KB を超える場合は表示対象 field を削る。`score_history` は引き続き `rationale_ja` を持たず、`pickLatestScore` / canonical score selection は変更しない。

#### Rendering / copy constraints

| Constraint | Rule |
|---|---|
| Copy language | Page body は日本語のみ。Model slug、internal code、raw metric label を読者本文に出さない |
| Client runtime | `/models` は zero client-side JS。Hydration、client fetch、interactive chart library は使わない |
| Layout | 既存 design tokens と 1080 layout width に合わせる |
| Visual quality | Editorial anti-template quality を優先する。Hierarchy、quote blocks、paired score bars を使い、raw tables で読ませない |
| Extensibility | `gpt-5.6-sol` batch 入庫時、batch file 追加だけで new model card と latest-pair recalculation が走る。Page code の手修正は不要 |
| Approval gate | Doc PR merge 前に conductor review と owner approval を必須にする。2c-v2 code 実装は本 doc merge 後の `mms-4c-code` で別 dispatch |

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
