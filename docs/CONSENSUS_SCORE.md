# 総合スコア — 複数モデル中央値への正典切替（mms-6 設計）／3社の最新モデルの平均へ（mms-8 改訂）

Status: 設計承認（PR #363 merged 2026-08-31）。mms-6-doc のパラメータと確定文案は下記。
Status（mms-8）: 改訂 2 実装済み（preview 2026-09-09）。公開値は 3 社旗艦平均。deprecated 中央値エンジンは履歴として残置（owner A、#444）。
Date: 2026-08-31
Owner: Jason（承認ゲート） / conductor（本書・分割） / 実装は後続 dispatch

スコア選択規則の正典は実装後 [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md)「スコア選択」へ転記する。採点手順は引き続き [`SCORING_RUNBOOK.md`](SCORING_RUNBOOK.md)。/models の情報設計履歴は [`MULTI_MODEL_SCORING.md`](MULTI_MODEL_SCORING.md)。本書は「どのスコアを正典とするか」の規則変更だけを扱う。

## 背景 — なぜ切り替えるか

- 現行規則 `pickLatestScore()`（最新 run_date が正典）は、batch を 1 つ落とすたびに全站 556 職業のスコア・ランキング・band・診断・JSON-LD を一斉に書き換える。
- 職業ページはモデル別履歴を誠実に公開しているため、正典（最新 1 票）と履歴（多数意見)の矛盾がページ内で可視化されている。実例: 観光バスガイド `/111` は見出し 6.8（Opus 5）に対し、履歴は 3.4 / 4.3 / 4.2。最新票が 4 票中央値から 1.0 以上離れる職業は 556 中 100 件（18%）。
- この規則の下ではオーナー方針「モデルをどんどん入れる」が実行不能: 入れるたびに全站翻転、入れなければ鮮度喪失。

実測（comparable 4 batches × 556 職業）:

- Opus 5 着地時の正典変動: mean|Δ|=0.54、|Δ|≥0.5 が 264 職業、band 変化 106 件。
- 同じ着地を「全モデル中央値」で受けた場合の変動: |Δ|≥0.5 は 78 職業。票が増えるほどさらに安定する。

## 決定事項（2026-08-31 Jason 確認済み）

1. **正典スコアは comparable batch 群の中央値（総合値）とする。** 最新モデルの見解は職業ページの「最新観測」行に降格して掲載する。
2. **投票権は 1 モデル 1 票。** 同一モデルの再 run は最新 run のみ有効。`scoring_method_id: legacy-single-axis` の batch は不参加（現行の比較可否規則を踏襲）。
3. **票の有効期限は run_date から 6 ヶ月。**
4. **最低 5 票を保証する（floor）。** 有効票が 5 未満になる場合、期限切れ票を新しい順に補充して 5 票（存在数が 5 未満なら全票）を維持する。floor により 6 ヶ月超の票が計算に含まれる場合、データ注記へ自動で明記する（老化提示）。
5. **総合値に固有名を作らない。** 読者向けは「複数のAIによる総合」等の平文説明で統一し、文面はスロットごとに自然な日本語で書く（オーナー署名対象）。形式定義は /standard のみに置く。
6. **理由文は「総合値に最も近い票」の原文を掲載する。** 総合値 ±0.3 以内の票のうち最新 run を優先、±0.3 内に票がなければ最近接（tie は最新）。生成・要約・接合は行わない（従来どおり逐字引用のみ）。
7. **C 向け表面にモデル型番を出さない。** 職業ページ本文・FAQ・tooltip・共有文言は「AI」「複数のAI」「最新のAI」の語彙で書く。厳密な帰属（モデル名・run date）は履歴折りたたみ・/models・引用用ファクト・footer・JSON-LD に置く。
8. **切替はエンジン完成次第、現有 4 票で実施する。** 切替 release には旧正典 vs 総合の drift レポートと站内更新説明を必ず同梱する（可視変動は必ず叙事を伴う）。スコアリングのベンダーは OpenAI / Anthropic / xAI の 3 社に限定（Gemini は現時点で不採用）。切替後の第一拡充は Grok の入列。

## 総合値の算定規則（実装仕様）

- **パネル**: comparable batches（`aiois` あり）→ モデルごと最新 run → 6 ヶ月窓 → floor 5 補充。
- **窓の基準日は「最新 comparable run_date」**（壁時計は使わない）。有効票 = `run_date >= 最新run_dateの6ヶ月前`。build 再実行で日付経過だけでは結果が変わらない（決定論、`_content-date` と同思想）。票の失効は新 batch 着地の瞬間にのみ起こり、着地は必ず更新説明を伴うため、無叙事の静默変動は構造的に発生しない。
- **総合 transformation / displacement**: パネル各票の該当指数の中央値。偶数票は中央 2 票の平均。丸めは既存 banker rounding（表示 1 桁）。
- **D1–D10 表示**: 次元ごとにパネル中央値。総合 transformation を mean(D1,D2) から再計算しない（各値は独立に中央値を取る）。/standard に「各次元・各指数はそれぞれ中央値」と明記する。
- **riskBand / ランキング / 診断 / treemap**: 入力が総合値に変わるのみで、式・閾値・丸め規則は不変。
- **理由文選定**: 決定 6 のとおり。表示は無署名（決定 7）、帰属は履歴折りたたみ側に残る。
- **最新観測行**: |最新票 − 総合| ≥ 1.0（確定パラメータ）のとき職業ページに表示。文形は確定文案の「最新のAIは、この仕事の変化をより大きく（/小さく）見ています（X.X）」。モデル名は出さない。
- **SCORE_ATTRIBUTION**（build 時定数）は {票数, 最新採点日, 窓/floor 状態} のパネルメタデータへ置き換える。`src/graph/score-strategy.ts` に `pickConsensusScore()` として実装し、`pickLatestScore()` は「最新観測」抽出用に残す。

### 確定パラメータ（mms-6-doc、2026-08-31）

| パラメータ | 確定値 | 現データでの効き方 |
|---|---|---|
| 最新観測行の表示閾値 | \|Δ\| ≥ 1.0 | 100 職業（18%）に表示。閾値未満は履歴折りたたみのみ |
| 理由文の近接許容 | ±0.3 | 語り手分布: 最新モデル 45% / 次点 44% / 旧 2 票 計 10% |

実装は上表を逐字使用する。閾値・許容の変更は本書の改訂と切替説明を要する。

## 変わらないもの

| 資産 | 扱い |
|---|---|
| `data/scores/` append-only、run slug（`model@date`）と 308 redirect の生命周期 | 不変 |
| SCORING_RUNBOOK の pilot → drift → 承認 → full run ゲート | 不変（pilot は品質門として維持） |
| AIOIS-10 v1.0 rubric・アンカー・凍結プロンプト慣行 | 不変（rubric 変更は別次元の再基準化イベント） |
| /models per-run ページ、zero client JS、projection payload gate | 不変 |
| 「独自分析（非公式）」等の免責語彙 | 不変（合規スロットのため文言据え置き） |

## 切替日の影響実測

- 全站平均 5.23 → 4.68。|Δ|≥1.0 が 100 職業、riskBand 変化 133 件。ランキング再編一回。
- 切替当日の latest-vs-consensus 表は [`CONSENSUS_SWITCH_DRIFT.md`](CONSENSUS_SWITCH_DRIFT.md)（mms-6g）。`bun scripts/consensus-switch-drift.ts` で再生成する。
- 文言変更面: footer 署名、views/*.ts の FAQ テンプレ群、引用用ファクト、JSON-LD、OG。
- tests/baseline 全再生成 + 正典値ピン留め fixture の整理（mms-6f）。

## リスクと対応

- **切替日の一回性変動** → drift レポートと站内更新説明を同梱し、preview でオーナー確認後に本番昇格。
- **採点休止時のパネル停滞** → floor 5 + 老化提示で優雅に劣化（静默変動ゼロ、鮮度低下は注記で誠実に開示）。
- **全站平均が 0.55 下がりトーンが穏当化** → 事実として更新説明に記載（「最新モデル単票 → 多数決」の帰結）。

## 確定文案（mms-6-doc、2026-08-31）

後続 issue（mms-6c / 6d / 6e / 6g）は次の文字列を**逐字使用**する。プレースホルダ `{N}` `{X.X}` `{日付}` だけを実行時に埋める。免責語彙「独自分析（非公式）」は合規スロットのため残す。C 向け文にモデル型番（Claude / GPT / Opus / Fable / Grok 等）を入れない。C 向け文に内部語「正典」を出さない。公開値（読者に出す数字）と中央値（算出方法）を括弧で同一視しない。

### 職業ページ見出しラベル

```
複数のAIによる総合
```

### 最新観測行

`|最新票 − 総合| ≥ 1.0` のときだけ出す。モデル名は出さない。

大きく見るとき:

```
最新のAIは、この仕事の変化をより大きく見ています（{X.X}）
```

小さく見るとき:

```
最新のAIは、この仕事の変化をより小さく見ています（{X.X}）
```

`{X.X}` は最新票の Transformation（表示 1 桁）。向きは最新票 − 総合の符号。

### footer 署名行

```
AI 影響度：複数のAIモデルによる総合（AIOIS-10・最新採点 {日付}）
```

### FAQ 等テンプレの共通句

```
本サイトの AI 影響度は複数のAIモデルによる採点の総合値（独自分析・非公式）です。
```

### 引用用ファクトの帰属句

個別モデル名は書かない。票数・最新採点日・/models へ誘導する。

```
（出典：厚生労働省 jobtag ＋ AIOIS-10、複数のAIによる総合・{N}票、最新採点 {日付}。モデル別の内訳は /models）
```

### 老化提示の注記文

floor により 6 ヶ月超の票が総合値に含まれるとき、データ注記へ出す。

```
この総合値には、採点日から6ヶ月を超えた票が含まれています。
```

### /models hub カード見出し（mms-6e）

```
現行の総合
```

### 切替 release の站内更新説明（mms-6g。2026-09-06 用詞を引き締め）

見出し（`/data`）:

```
スコアの算出方法を変更しました
```

```
AI 影響度の算出方法を変更しました。これまでは、最新の1件の採点をサイト全体の公開値として採用していました。これからは、複数のAIによる採点の中央値を公開値とします。最新の採点が公開値から大きく外れる職業に限り、「最新のAIは…」という行でその見解を示します。

今回の変更では、全職業の平均は 5.23 から 4.68 になります。公開値が 1.0 以上変わる職業は 100、リスク帯が変わる職業は 133 です。新しいAIを1件追加しても、公開値全体が、その1件の採点で入れ替わらないようにするための変更です。
```

### 第 5 票着地の站内更新説明（mms-7c / #387）

見出し（`/data`）:

```
総合の票を1件増やしました
```

```
複数のAIによる総合に、採点を1件追加しました。公開値はこれまでどおり、複数の採点の中央値です。

今回の追加では、全職業の平均は 4.68 から 4.73 になります。公開値が 0.5 以上変わる職業は 32、リスク帯が変わる職業は 40 です。公開値が 1.0 以上変わる職業はありません。
```

モデル型番は C 向けに置かない。6g 切替説明は履歴として残す。

### /standard・/methodology・README の更新方針

実ページの書換は mms-6d / 6e。ここでは方針だけを固定する。

- **/standard** — AIOIS-10 の次元・式・EMFO は不変。総合切替後に「形式定義」節を 1 つ足す: 「本サイトの公開値は、各次元および変化の大きさ・仕事が減るリスクを、複数のAIによる採点の中央値として出します。総合の変化の大きさを mean(D1, D2) から再計算しません。」モデル型番は置かない。
- **/methodology** — 評価プロセス節の「1 台の現行モデルが判定」を「複数のAIが同一ルーブリックで判定し、公開値は中央値」に置換する。データソース行の「{model} 採点」は footer 署名行と同じ「複数のAIモデルによる総合（AIOIS-10・最新採点 {日付}）」に揃える。履歴上のクロスモデル検証節は帰属の記録としてモデル名を残してよい（決定 7 の例外: /methodology の履歴節）。「現行公開値も多モデル consensus ではなく、単一の active batch」の一文は削除し、総合値の説明に差し替える。
- **README「AIOIS-10 スコアの算出方法」** — 「サイトは最新の occupation run を active batch として選び」を「公開値は comparable batch 群の中央値（総合値）。個別モデルの採点は /models と履歴に残す」に置換する。face-validity 節の過去検証は履歴としてモデル名を残してよい。冒頭の「現行の active score batch が AIOIS-10 で採点した」は「複数のAIによる総合（AIOIS-10）」に置換する。

## 実装分割（issue 草案）

| # | id | 内容 | 依存 |
|---|----|------|------|
| 1 | mms-6-doc | 本書承認 + 確定パラメータ + 確定文案（本節） | なし |
| 2 | mms-6a | `pickConsensusScore()`（窓・floor・中央値・理由文セレクタ）+ 単体テスト | 1 |
| 3 | mms-6b | ETL/projection 接続: 正典系 projection を総合値へ、パネルメタ追加、payload gate 内 | 2 |
| 4 | mms-6c | 職業ページ表面: 総合見出し・無署名理由文・最新観測行・履歴折りたたみ（帰属あり） | 3 |
| 5 | mms-6d | 全站文言掃除: footer / FAQ テンプレ群 / 引用用ファクト / JSON-LD / OG（C 向け型番ゼロ規則） | 3 |
| 6 | mms-6e | /models hub 整合（「現行モデル」カード → 総合概況 + 最新採点）※hub 全面改修はスコープ外 | 3 |
| 7 | mms-6f | fixture/baseline 再生成、正典値ピン留めテスト整理 | 4, 5, 6 |
| 8 | mms-6g | 切替 release: drift レポート + 站内更新説明、preview オーナー承認 → 着地 | 7 |
| 9 | mms-7a | Grok 4.6 on in-agent（`grok-4.6`）+ prompt freeze。Vercel AI Gateway は使わない。bespoke xAI provider は作らない | 6g |
| 10 | mms-7b | Grok pilot 40 + 日本語品質審（オーナー署名） | 9 |
| 11 | mms-7c | Grok 全量 556 → 第 5 票として着地（総合微動 + 最新観測更新） | 6g, 10 |

## 採点ポリシー（SCORING_RUNBOOK へ転記する常設規則）

- ベンダー白名単: **OpenAI / Anthropic / xAI**（2026-08-31 オーナー決定。Gemini は現時点不採用）。
- 入列基準: 白名単ベンダーのフロンティア級モデル。同一ベンダー複数モデルの並存可（各 1 票）。非フロンティア・軽量版は不採、決定ログ 1 行のみ。
- pilot 40 の日本語品質審はオーナー署名ゲートとして維持（コスト門ではなく品質門）。
- 再採点の節奏は 6 ヶ月期限が自然に駆動する（票を面板に残したければ期限内に更新 run）。

## 改訂 2 — 3社の最新モデルの平均へ（mms-8、2026-09-08 決定）

Status: オーナー決定済み（2026-09-08）。実装は mms-8.x シリーズ完了（preview 2026-09-09）。deprecated 中央値エンジンは履歴として残置（owner A、#444）。
Owner: Jason（承認・署名ゲート）

現行の公開値は comparable AIOIS-10 票の中央値（`pickConsensusScore()`: 1 model id 1 票、基準日 = 最新 run_date の 6 ヶ月窓、不足は期限切れ票で floor 5 補充）。現行パネルは `claude-opus-4-8` 2026-05-30、`claude-fable-5` 2026-06-13、`gpt-5.6-sol` 2026-07-12、`claude-opus-5` 2026-07-26、`grok-4.6` 2026-09-07 の 5 票。`claude-opus-4-7`（2026-04-25）は `legacy-single-axis` のため投票しない。

### 決定事項（2026-09-08 Jason 確認済み）

1. 今後、各ベンダーはその時点の最上位（旗艦）モデル 1 件だけで採点する。ベンダーは現在 3 社: Anthropic（`anthropic`）/ OpenAI（`openai`）/ xAI（`xai`）。将来の追加はあり得る。Gemini は引き続き不採用。
2. 公開値 = 各ベンダーの最新 comparable run（1 社 1 件）の算術平均。中央値・6 ヶ月窓・floor 5 は廃止。同一ベンダーの旧 run は `data/scores/`・`/models`・職業ページ履歴に残るが公開値には入らない。
3. `claude-fable-5-1`（Claude Fable 5.1、2026-09-01 公開）が着地した時点で Anthropic の旗艦は `claude-opus-5` から Fable 5.1 へ。`gpt-6-astra`（GPT 6 Astra、2026-09-03 公開）が着地した時点で OpenAI の旗艦は `gpt-5.6-sol` から Astra へ。順序は **Fable 5.1 が先、GPT-6 Astra は Fable 5.1 着地後**（ハードゲート）。
4. 規則の切替は Fable 5.1 batch 着地日に同時に行い、站内更新説明 1 本で「算出方法の変更」と「採点 1 件追加」を説明する。Astra は後日別の更新説明。
5. `/models` hub はベンダー 3 列（各社の最新モデルを上、旧 run を折りたたみ下）。「分かれた職業」は 3 社の現旗艦の比較。
6. 読者面の語彙は「複数のAI」のまま。FAQ と `/standard` だけ「現在は3社の最新モデルの平均」と明記。中央値・票・floor は公開面から消す。
7. 最新観測行（「最新のAIは…」）は維持、閾値 |Δ| ≥ 1.0 不変。
8. 老化提示は維持。条件は「いずれかのベンダーの最新採点日が、パネル内最新 run_date より 6 ヶ月超前」。文言は「票」→「採点」。
9. 採点手順: Fable 5.1 は in-agent（Fable 5.1 セッション内、`--attest-model` 必須、effort high は無効化不可）、Astra はオーナー本機の Codex CLI（毎回 `--model gpt-6-astra`、effort high を明示）。両方とも pilot 40 → オーナーの日本語審 → 556。

### 旧規則との対応表

| 項目 | mms-6（中央値） | mms-8（旗艦平均） |
|---|---|---|
| 投票単位 | 1 model id 1 票 | 1 ベンダー 1 件（そのベンダーの最新 comparable run） |
| 集計 | 中央値（偶数票は中央 2 票の平均） | 算術平均 |
| 6 ヶ月窓 | あり（基準日 = 最新 run_date） | なし |
| floor | 5 票（期限切れ票で補充） | なし |
| 老化提示 | floor 補充が起きたとき | いずれかのベンダーの最新採点日が最新 run_date より 6 ヶ月超前のとき |
| 最新観測行 | \|最新票 − 総合\| ≥ 1.0 | 不変 |
| 理由文選定 | ±0.3 内の最新 run、なければ最近接 | 不変（パネル = 各社最新 run） |
| C 面型番ゼロ | 決定 7 | 不変 |
| 公開面の語彙 | 「複数のAI」「中央値」（/standard のみ） | 「複数のAI」のまま。FAQ と /standard に「現在は3社の最新モデルの平均」 |

### 算定規則（実装仕様 — mms-8.10 が逐字実装する）

1. comparable = 職業の履歴のうち `aiois` を持つ entry（`legacy-single-axis` は除外。従来どおり）。
2. ベンダー = entry の `provider`（batch の `scorer.model_provider`。`anthropic` / `openai` / `xai`）。
3. ベンダーごとに `date` が最大の entry を 1 件選ぶ（同日 tie は入力順の後勝ち）。これをパネルとし、`date` 昇順・同日は `model` 昇順で並べる。
4. transformation = パネルの `aiois.transformation` の算術平均（`src/data/lib/fsum.ts` の `fmean`）。displacement、d1〜d10 も同様に各々の算術平均。丸めない（表示層の banker rounding のみ）。総合 transformation を mean(D1, D2) から再計算しない。
5. anchor = パネル内の最大 `date`。cutoff = `subtractMonths(anchor, 6)`（月末は切り詰め）。`date < cutoff` のベンダーを `staleVendors` に入れる（境界日は stale ではない）。
6. 理由文 = パネル内で |transformation − 平均| ≤ 0.3 の entry のうち最新 `date`（同日は `model` 昇順先頭）。該当なしなら最近接（tie は同規則）。
7. latest = comparable 全体の `pickLatestScore`。latestDelta = latest.transformation − 平均。
8. comparable が空なら throw。`provider` を欠く entry があれば throw。
9. `SCORE_PANEL` = { vendorCount, latestRunDate, staleMonths: 6, staleVendorCount }。build 時に全職業のベンダー集合が一致することを検証し、不一致なら build を止める（旗艦 batch は 556 職業すべてを覆う）。

### 切替日の影響実測（設計時点、2026-09-08）

現行 5 票中央値 → 3 旗艦平均（Opus 5 / GPT 5.6 SOL / Grok 4.6）:

- 全站平均 4.73 → 4.98。|Δ|≥0.5 が 105 職業、|Δ|≥1.0 が 2 職業、band 変化 41。

旗艦入れ替えの感度（Anthropic を Opus 5 → Fable 5 で模擬）:

- 全站平均 4.98 → 4.63。|Δ|≥0.5 が 165 職業、band 変化 64。

最新観測行: Grok 基準で 15 職業（現行 10）。

実際の切替は Fable 5.1 batch 着地日に行い、実測は mms-8.28 が `docs/FLAGSHIP_SWITCH_DRIFT.md` に記録する。

### 切替日の影響実測（mms-8.28、2026-09-09）

5 票中央値（着地前）→ 3 社旗艦平均（Fable 5.1 / GPT 5.6 SOL / Grok 4.6）。数字は [`FLAGSHIP_SWITCH_DRIFT.md`](FLAGSHIP_SWITCH_DRIFT.md) の Summary 表と同一。

| 項目 | 着地前（中央値） | 着地後（旗艦平均） |
|---|---:|---:|
| 全職業平均 | 4.73 | 4.67 |
| \|Δ\| ≥ 0.5 | — | 32 |
| \|Δ\| ≥ 1.0 | — | 1 |
| リスク帯 low / mid / high | 162 / 357 / 37 | 173 / 352 / 31（変化 33 職業） |
| 最新観測行の表示 | — | 8 職業 |

### ベンダー更新の影響実測（mms-8.35、2026-09-10）

OpenAI 旗艦 GPT 5.6 SOL → GPT 6 Astra。公開値は 3 社旗艦平均のまま。数字は [`VENDOR_UPDATE_DRIFT_gpt-6-astra_2026-09-10.md`](VENDOR_UPDATE_DRIFT_gpt-6-astra_2026-09-10.md) の Summary 表と同一。

| 項目 | 着地前（旗艦平均） | 着地後（旗艦平均） |
|---|---:|---:|
| 全職業平均 | 4.67 | 4.69 |
| \|Δ\| ≥ 0.5 | — | 8 |
| \|Δ\| ≥ 1.0 | — | 0 |
| リスク帯 low / mid / high | 173 / 352 / 31 | 170 / 355 / 31（変化 17 職業） |
| 最新観測行の表示 | — | 15 職業 |

### 確定文案（mms-8）

後続 issue（8.17〜8.23、8.28、8.35）は次の文字列を逐字使用する。C 向け文にモデル型番を入れない。内部語「正典」「中央値」「票」「floor」を C 向け文に出さない。

プレースホルダ {N} {M} {X} {日付} {前} {後} {N05} {Nband} {N10} {V} は実行時に埋める。

オーナー署名: #409「このまま署名します」（2026-09-08）。**unchanged** 行は現行文のまま、確定欄に「そのまま」と記す。

#### `CONSENSUS_HEADLINE_LABEL`

そのまま。

```
複数のAIによる総合
```

#### `CONSENSUS_AGING_NOTE`

```
この総合値には、採点日から6ヶ月を超えた採点が含まれています。
```

#### `CONSENSUS_DIM_NOTE`

```
各次元は複数のAIによる採点の平均です。
```

#### `CONSENSUS_FAQ_SENTENCE`

そのまま。

```
本サイトの AI 影響度は複数のAIモデルによる採点の総合値（独自分析・非公式）です。
```

#### `CONSENSUS_FAQ_DETAIL`

```
現在は、3社のAIそれぞれの最新モデルによる採点の平均を公開値としています。
```

#### `CONSENSUS_STANDARD_FORMAL`

```
本サイトの公開値は、各次元および変化の大きさ・仕事が減るリスクを、現在は3社のAIそれぞれの最新モデルによる採点の平均として出します。総合の変化の大きさを mean(D1, D2) から再計算しません。
```

#### `MODELS_HUB_NOW_LABEL`

そのまま。

```
現行の総合
```

#### `MODELS_HUB_VENDOR_COUNT_LABEL`

```
採点した会社
```

#### `MODELS_HUB_VENDORS_HEADING`

```
各社の最新モデル
```

#### `MODELS_HUB_VENDORS_INTRO`

```
公開値は、3社それぞれの最新モデルによる採点の平均です。各社の以前のモデルは、カードの下で開けます。
```

#### `formatModelsHubHistorySummary({N})`

```
以前のモデル（{N}件）
```

#### `MODELS_HUB_HISTORY_EMPTY`

```
以前のモデルはありません
```

#### `formatModelsHubContrastCopy({N})`

```
3社の最新モデルが共通する {N} 職業を比べると、いくつかの職業をまったく違う角度から見ています。次のカードでは、差が大きかった職業を、3つのモデルの理由文そのままと一緒に読みます。
```

#### `formatModelsHubLead({M}, {X})`

```
3社のAIそれぞれの最新モデルによる採点を平均しています。これまで{M}つのAIモデルの採点を公開し、各回の対象は{X}です。AIの判断にはそれぞれの見方があり、同じ職業でも、現場性を重く見るか、手順化や自動化の進みやすさを重く見るかで、仕事の未来は違って見えます。
```

#### `/models` page description (SEO/OG/JSON-LD)

```
3社のAIそれぞれの最新モデルによる採点を平均した、各回{X}の結果から、判断が一致した職業・大きく分かれた職業を読むモデル比較ページです。
```

#### `MODELS_RUN_IN_PANEL_NOTE`

```
このモデルの採点は、現在の公開値（3社の最新モデルの平均）に含まれています。
```

#### `MODELS_RUN_HISTORY_NOTE`

```
このモデルの採点は履歴として公開しています。現在の公開値には含まれていません。
```

#### `formatScoreHistorySummary({N})`

```
モデル別の採点を表示（{N}件）
```

#### `formatScoreHistoryCurrentLine({日付})`

```
3社の最新モデルの平均 · 最新採点 {日付}
```

#### `formatConsensusCitation({日付})`

```
（出典：厚生労働省 jobtag ＋ AIOIS-10、複数のAIによる総合・3社の最新モデルの平均、最新採点 {日付}。モデル別の内訳は /models）
```

#### `formatConsensusFooterLine`

そのまま。

```
AI 影響度：複数のAIモデルによる総合（AIOIS-10・最新採点 {日付}）
```

#### `ANSWERS_HUB_PUBLIC_VALUE`

```
公開値: 複数のAIによる総合（3社の最新モデルの平均）
```

#### home FAQ answer (`geo-render.ts` L444)

```
現在の公開値は複数のAIによる総合（AIOIS-10、3社の最新モデルの平均、最新採点 {日付}）です。モデル別の内訳は /models。
```

#### `/methodology` L166

```
…のバッチファイルで保持し、公開値は、3社のAIそれぞれの最新モデルによる採点の平均です。個別モデルの採点は モデル比較 と履歴に残します。
```

#### `/methodology` L169

```
複数のAIが同一ルーブリックで 10 次元を判定し、公開値はその平均
```

#### `/methodology` L172

```
…凍結プロンプトを全職業に同一適用し、公開値はその平均です。
```

#### `/methodology` L203

```
…公開値は、複数のAIが同一ルーブリックで判定した採点の平均です。
```

#### `/methodology` L207

```
…10 次元の判定は複数のAIによるもので、公開値はその平均です。…
```

#### `/methodology` L103 JSON-LD description

```
…AIOIS-10 標準で複数のAIがどう採点し、公開値をその平均として出すか。…
```

#### `/methodology` L104 JSON-LD abstract (EN)

```
Published values are the mean of the latest model from each of three vendors.
```

#### `README.md` L9

```
…公開値は、3社のAIそれぞれの最新モデルによる採点の平均。個別モデルの採点は … と履歴に残します。
```

#### `README.md` L78

```
公開値は、3社のAIそれぞれの最新モデルによる採点の平均。
```

#### `README.md` L92

```
公開値は、3社のAIそれぞれの最新モデルによる採点の平均です。
```

#### `CONSENSUS_FLAGSHIP_SWITCH_NOTE_HEADING`

```
スコアの算出方法を変更し、採点を1件追加しました
```

#### `CONSENSUS_FLAGSHIP_SWITCH_NOTE_LEAD`

```
AI 影響度の算出方法を変更しました。これまでは、複数のAIによる採点の中央値を公開値としていました。これからは、3社のAIそれぞれの最新モデルによる採点の平均を公開値とします。あわせて、採点を1件追加しました。以前のモデルの採点は、モデル比較と各職業の履歴に残します。
```

#### `CONSENSUS_FLAGSHIP_SWITCH_NOTE_IMPACT`

```
今回の変更では、全職業の平均は {前} から {後} になります。公開値が 0.5 以上変わる職業は {N05}、リスク帯が変わる職業は {Nband} です。公開値が 1.0 以上変わる職業は{ありません／{N10} です}。
```

#### `CONSENSUS_VENDOR_UPDATE_NOTE_HEADING`

```
総合の採点を1件更新しました
```

#### `CONSENSUS_VENDOR_UPDATE_NOTE_LEAD`

```
3社のAIの最新モデルのうち、1社の採点を新しいモデルの採点に更新しました。公開値はこれまでどおり、3社の最新モデルによる採点の平均です。
```

#### `CONSENSUS_VENDOR_UPDATE_NOTE_IMPACT`

切替説明と同じ数字テンプレ。

```
今回の変更では、全職業の平均は {前} から {後} になります。公開値が 0.5 以上変わる職業は {N05}、リスク帯が変わる職業は {Nband} です。公開値が 1.0 以上変わる職業は{ありません／{N10} です}。
```

#### `geo-render.ts` EN (llms.txt L78/L173, table L88, L132, Dataset L340/L344)

```
mean of the latest model from each of {V} vendors / Vendors in the panel / vendor-flagship mean / version `vendor-mean:{V}:{date}`
```

### 実装分割（mms-8.x）

| # | id | 内容 | 依存 | オーナーの関与 |
|---|---|---|---|---|
| 8.1 | #408 | Design doc 「改訂 2」 in `docs/CONSENSUS_SCORE.md` | — | review |
| 8.2 | #409 | Copy signature table → 「確定文案（mms-8）」 | 8.1 | **sign** |
| 8.3 | #410 | `DATA_ARCHITECTURE.md` スコア選択 + `MULTI_MODEL_SCORING.md` 2c-v4 | 8.1 | |
| 8.4 | #411 | Frozen prompt Claude Fable 5.1 + body-hash test | 8.1 | |
| 8.5 | #412 | Frozen prompt GPT-6 Astra + body-hash test | 8.4 | |
| 8.6 | #413 | `SCORING_RUNBOOK.md` mms-8 section + providers table + `TOOLCHAIN.md` §10.1 | 8.4, 8.5 | |
| 8.7 | #414 | ROADMAP, CHANGELOG, display/slug/vendor tests | 8.6 | |
| 8.8 | #415 | `provider` on `ScoreHistEntry` / `ScoreHistoryEntry` (5 construction sites) | 8.7 | |
| 8.9 | #416 | `VENDOR_WHITELIST` / `isWhitelistedVendor` / `formatVendorDisplay` + `check-score-batch` advisory | 8.8 | |
| 8.10 | #417 | Engine `pickFlagshipMeanScore` + `toFlagshipCanonicalScoreEntry` + `flagshipPanelMeta` + unit tests (not wired) | 8.9 | |
| 8.11 | #418 | Live-data tests; deprecate `pickConsensusScore`; prove not wired | 8.10 | |
| 8.12 | #419 | Codex runner `--reasoning-effort` flag + audit + frozen-argv test + runbook flag doc | 8.6 | |
| 8.13 | #420 | Wire `indexes` / `loader` / `geo-facts` to the new engine; `flagshipByOcc` | 8.11 | |
| 8.14 | #421 | Detail projection fields `stale_vote` / `consensus_vendor_count` | 8.13 | |
| 8.15 | #422 | `SCORE_PANEL` v2 + build invariant + all readers compile | 8.14 | |
| 8.16 | #423 | `scripts/flagship-switch-drift.ts` + synthetic test | 8.15 | |
| 8.17 | #424 | `consensus-copy.ts` constants + direct consumers | 8.2, 8.15 | |
| 8.18 | #425 | `/standard`, `/methodology`, `/about` prose + JSON-LD | 8.17 | |
| 8.19 | #426 | README + `geo-render.ts` English + regenerate GEO files | 8.18 | |
| 8.20 | #427 | Per-run page `in_panel` note + `提供元` xAI | 8.17 | |
| 8.21 | #428 | `models-deep` projection v2 (vendor lanes, 3-way spread) | 8.20 | |
| 8.22 | #429 | `/models` view model | 8.21 | |
| 8.23 | #430 | `/models` page markup + CSS | 8.22 | |
| 8.24 | #431 | Baseline regeneration + pinned-test consolidation + all gates | 8.19, 8.23 | preview check |
| 8.25 | #432 | Fable 5.1 pilot 40 (in-agent) | 8.24 | **GO**, sign rationale |
| 8.26 | #433 | Fable 5.1 full 556 | 8.25 | **GO** |
| 8.27 | #434 | Land Fable 5.1 batch (file, 308, runbook, build, baseline) | 8.26 | |
| 8.28 | #435 | Switch note: drift doc, numbers, `/data` + `/models`, design-doc 実測 | 8.27 | |
| 8.29 | #436 | Preview checklist + promotion PR text | 8.28 | check, **promote** |
| 8.30 | #437 | `/models` content after Fable 5.1 (personality + story sentences) | 8.29 | **sign** |
| 8.31 | #438 | Astra entitlement preflight (owner's machine) — **gate: after 8.27** | 8.27, 8.12 | run on own machine |
| 8.32 | #439 | Astra pilot 40 incl. security-type occupations | 8.31 | **GO**, sign rationale |
| 8.33 | #440 | Astra full 556 | 8.32 | **GO** |
| 8.34 | #441 | `scripts/vendor-update-drift.ts` + synthetic test | 8.16 | |
| 8.35 | #442 | Land Astra batch + update note + promotion text | 8.33, 8.34 | check, **promote** |
| 8.36 | #443 | `/models` content after Astra | 8.35 | **sign** |
| 8.37 | #444 | Close-out: ROADMAP Done, CHANGELOG, deprecated-engine decision | 8.36 | decide |

### 採点ポリシーの改訂

- 入列単位はベンダー。各ベンダーは当時の最上位（旗艦）モデル 1 件で採点し、その最新 run だけが公開値に入る。同一ベンダーの旧モデルは履歴。
- ベンダー白名単は OpenAI / Anthropic / xAI（不変）。Gemini は不採用（不変）。
- pilot 40 の日本語品質審はオーナー署名ゲート（不変）。
- 範囲外: Mythos 5.1 / Sonnet 5 / Haiku / GPT-5.6 Terra・Luna / Daybreak・Cyber 特供 / Gemini / Vercel AI Gateway / 新しい HTTP provider。
