# Scoring Runbook

本書は、AI 影響スコア batch を再実行・追加するときの開発者向け正典である。公開ページの基準説明は `/standard`、開発者向け AIOIS-10 入口は [`AIOIS-10.md`](AIOIS-10.md)、データ選択規則は [`DATA_ARCHITECTURE.md`](DATA_ARCHITECTURE.md) の「スコア選択」を正典にする。

## 現行 batch

> この 3 行は `data/scores/` から導出される事実であり、`bun scripts/check-geo-freshness.ts`
> が実データと突き合わせて検証する。batch を追加したら必ずここも更新すること
> —— 更新し忘れると gate が落ちる。手で書き換えたまま腐らせることはできない。

- モデル: `claude-opus-5`
- run date: `2026-07-26`
- Score output: `data/scores/occupations_claude-opus-5_2026-07-26.json`

- 標準: AIOIS-10 v1.0
- 対象: JILPT IPD v7.00 の 556 職業
- Schema: `src/data/schema/score-run.ts`
- トップ指標: `ai_risk` は AIOIS-10 の `aiois.transformation` と同じ値
- 公開表示箇所: `/methodology`, `/standard`, `/data`, 職業詳細ページ, JSON-LD, footer

現行 batch は 556 件すべてに `aiois.d1` から `aiois.d10`, `aiois.transformation`, `aiois.displacement` を持つ。今後 AIOIS-10 batch を追加する場合も、この構造を欠かしてはならない。

## 同じモデルで再採点する（issue #218）

**モデル id は何度でも使ってよい。一意でなければならないのは `(model, run_date)` の組み合わせである。**

`data/scores/` は append-only なので、修正 run でも後日の再採点でも、同じモデルが 2 つ以上の batch を持ちうる。公開ページはその前提で **run 単位**に URL を持つ:

| | 例 |
|---|---|
| run slug | `opus-5@2026-07-26` |
| ページ URL | `/models/opus-5@2026-07-26` |
| 生成元 | `runSlug()` — `src/site/score-attribution.ts` |

`model@date` の形は `src/site/model-editorial.ts` が編集文の key に使っているものと同じで、再 run が別 run の文章を引き継がないようにする意図も共通である。

再採点するときの決まりごと:

- **`run_date` を必ず変える。** 同じモデル id と同じ run date の batch を 2 つ置くと、`/models/<slug>` が衝突するため build が停止する。エラーはその条件をそのまま述べる。
- **既存 URL は変わらない。** batch を足しても、すでにある run のページ URL は動かない。増えるだけである。
- **裸の `/models/<model-slug>` は 308 リダイレクトとして残る。** 行き先はそのモデルの**最新 run**。`vercel.json` に置き、`bun scripts/check-model-redirects.ts`（`verify:gates` に組み込み済み）が `data/scores/` から期待値を導出して照合する。新しい batch を足したのにリダイレクトを更新し忘れると、この gate が stale として落ちる。

> #218 以前は `models-by-model` がモデル単位で slug の round-trip を検証していたため、同じモデルの 2 回目の run で build が `model slug round-trip failed` として停止していた。slug 生成は正常で、実際の原因は「1 モデルに 2 run」だったが、メッセージはそれを一切述べていなかった。

## Deployment boundary

Issue #9 の Fable 5 校正作業は、 production と pre を動かさないことを前提に進める。

- local branch で作業し、レビュー前に GitHub へ push しない。
- `main` へ push しない。
- Vercel が監視する branch / PR / alias を作らない。
- `pre.mirai-shigoto.com` の alias、project settings、環境変数、production promote は触らない。
- `vercel.json`, `package.json` の deploy command, `src/pages/*`, `src/components/Footer.astro`, `data/scores/*` は、文書だけの段階では変更しない。
- scoring raw output と pilot artifact は `.cache/scoring/issue-9/` 配下に置き、公開 bundle に入れない。
- full score batch を `data/scores/` に追加するのは、pilot が通り Jason の明示承認を得た後だけにする。

この境界を破る必要が出た場合は、先に Issue #9 に理由、影響範囲、検証方法、rollback を書き、別途承認を得る。

## Issue #9 scope

Issue #9 は、`claude-fable-5` を使って AIOIS-10 v1.0 の scoring run を校正する作業である。目的は「最新モデル名へ置換すること」ではなく、Opus 4.8 の現行 batch と比較できる append-only な scoring run を作ること。

Goals:

- `claude-fable-5` 用の AIOIS-10 scoring run 手順を追加する。
- 30-50 件の代表職業で pilot を実行する。
- Opus 4.8 vs Fable 5 の drift report を作る。
- Jason の pilot review 後にのみ、556 職業の full run へ進む。
- full run は append-only batch とし、旧 batch を上書き・削除しない。
- preview validation が通るまで production release は考えない。

Non-goals:

- production publish しない。
- pre 環境を更新しない。
- `data/scores/occupations_claude-opus-4-8_2026-05-30.json` を上書きしない。
- AIOIS-10 v1.0 の定義そのものを Issue #9 で変更しない。
- `claude-fable-5` が使えないときに `claude-opus-4-8` へ silent fallback しない。

## Required output contract

Fable 5 の raw JSONL は、1 職業 1 行の JSON object とする。Markdown fence、説明文、複数 object、配列 wrapper は禁止。

```json
{
  "id": 1,
  "ai_risk": 4.6,
  "rationale_ja": "職務の一部は情報処理で変化するが、現場判断と対人調整が残るため中程度にとどまる。",
  "confidence": 0.8,
  "aiois": {
    "d1": 4.8,
    "d2": 4.4,
    "d3": 5.0,
    "d4": 6.5,
    "d5": 5.8,
    "d6": 3.0,
    "d7": 4.2,
    "d8": 3.6,
    "d9": 2.8,
    "d10": 3.5,
    "transformation": 4.6,
    "displacement": 1.7
  }
}
```

（例の整合: transformation = mean(4.8, 4.4) = 4.6 = ai_risk。displacement = E×(1−M/10)×(0.6+0.4×(P+D10)/20) = 4.6×(1−4.9/10)×(0.6+0.4×(3.2+3.5)/20) ≈ 1.72 → 1.7。）

Hard requirements:

- `id` は `data/occupations/*.json` に存在する整数 ID。
- `ai_risk`, `confidence`, `aiois.*` は数値。数値文字列は禁止。
- `ai_risk` と `aiois.*` は 0-10、最大 1 桁小数。
- `confidence` は 0-1。
- `rationale_ja` は空でない日本語 1 文を基本にする。
- `aiois` は必須。legacy single-axis entry のように null / missing にしない。
- `aiois.d1` から `aiois.d10`、`transformation`、`displacement` の 12 field がすべて必須。
- `ai_risk === aiois.transformation` でなければならない。
- extra field は schema / assembler で fail させる。

## Scoring runner architecture (providers)

`scripts/run-scoring.ts` is the provider-independent entry point. Everything
that must not vary by vendor lives in `scripts/lib/scoring/`:

| Concern | File | Owned by |
| --- | --- | --- |
| The AIOIS-10 field set, formula re-computation, `ai_risk === transformation`, JSONL shape | `lib/scoring/contract.ts` | core |
| Error vocabulary + retry/backoff policy | `lib/scoring/errors.ts` | core |
| Retry accounting, audit trail, resume, concurrency, prompt assembly | `lib/scoring/core.ts` | core |
| Reaching a specific vendor | `lib/scoring/providers/<name>.ts` | provider |

A provider supplies transport only: how to reach the model, how to translate
`SCORE_OUTPUT_JSON_SCHEMA` into that vendor's native structured-output
mechanism (if it has one), how to map that vendor's error wording onto the
shared vocabulary, and how hard it may be hit. It has no way to express
"quietly use a different model" — that decision does not exist in the
vocabulary, which is how the no-silent-fallback rule is enforced structurally
rather than by convention.

Registered providers:

| `--provider` | Auth | Native schema | Notes |
| --- | --- | --- | --- |
| `codex` | Locally logged-in Codex CLI subscription | yes (`--output-schema`) | Shipped the gpt-5.6-sol batch; behaviour frozen and pinned by `run-scoring-codex.test.ts`. |
| `in-agent` | none | no | Scored by the agent session itself, as `claude-opus-4-8` and `claude-fable-5` were. Answers supplied as JSONL. |

```bash
bun scripts/run-scoring.ts --list-providers
```

### Adding a vendor

1. Write `scripts/lib/scoring/providers/<name>.ts` exporting a
   `ScoringProvider` (interface in `lib/scoring/provider.ts`). Typically
   40–80 lines.
2. Register it in `lib/scoring/providers/index.ts`.
3. Run `bun test scripts/lib/scoring`. `providers/conformance.test.ts`
   iterates the registry, so the new provider is picked up automatically and
   must prove it cannot weaken the contract, the error vocabulary, or the
   schema translation.

Nothing in `contract.ts`, `errors.ts`, or `core.ts` should need to change. If
it does, the seam is in the wrong place — move the seam rather than
special-casing the vendor.

`assemble-scores.ts --provider` records the vendor in `scorer.model_provider`.
It is inferred from known model-id prefixes (`gpt`/`o1`/`o3`, `claude`,
`gemini`) and **fails loudly for anything else** — a batch file is append-only
and its provider is rendered publicly as 提供元, so a new vendor must be named
explicitly rather than silently mislabelled.

### In-agent scoring flow

No API key and no child process — the running model answers its own prompts,
while still going through the same validation, audit trail, and resume logic as
any other provider.

```bash
# 1. Emit prompts (every pending occupation is reported as pending)
bun scripts/run-scoring.ts \
  --provider in-agent --model <model-id> \
  --prompt-file data/prompts/<date>_<model-id>-aiois10.ja.md \
  --out .cache/scoring/<run>/raw-scores.jsonl \
  --run-name <run> --ids 1,2,3

# 2. Write answers as JSON Lines (chunked files keep this to a few writes)
#    .cache/scoring/<run>/answers/chunk-01.jsonl

# 3. Validate and append
bun scripts/run-scoring.ts … --resume
```

Prompts are written to `.cache/scoring/<run>/prompts/<id>.txt` so the answers
are produced against the exact rubric + extract any other provider would have
been sent. Contract violations are rejected per id with the failing formula
named, and never reach the output JSONL.

## GPT-5.6-SOL / Codex-CLI scoring

This section is the Codex CLI path for `mms-5-prep` / Issue #141 and the gated GPT 5.6 SOL execution in Issue #126. It is added alongside the Fable 5 / Issue #9 path above; it does not replace the Fable 5 runbook.

Scope and boundary:

- Runner: `scripts/run-scoring.ts --provider codex` (equivalently `scripts/run-scoring-codex.ts`, kept as a compatibility entry with the same frozen behaviour).
- Model: `gpt-5.6-sol` (Codex path default). Provider: OpenAI.
- Auth: locally logged-in Codex CLI subscription. Do not use or commit an OpenAI API key for this path.
- Frozen prompt: `data/prompts/2026-07-12_gpt-5.6-sol-aiois10.ja.md`.
- Prompt version: `AIOIS-10-v1.0-gpt-5.6-sol`.
- Baseline for drift: `data/scores/occupations_claude-fable-5_2026-06-13.json` (latest AIOIS-10 batch), not Opus 4.8.
- Artifacts before full approval stay under `.cache/scoring/`; pilot/candidate artifacts must not be written to `data/scores/`.
- The full 556 batch may enter `data/scores/` only after owner approval. Adding it flips `pickLatestScore()` site-wide because the latest `run_date` becomes canonical.
- `scripts/run-scoring-codex.ts` is a LOCAL dev tool. Never wire it into `build`, `verify:gates`, CI, deploy commands, or `vercel.json`.

Methodology continuity:

GPT 5.6 SOL uses the same AIOIS-10 v1.0 output contract as Fable 5: strict JSONL, full `aiois.d1` through `aiois.d10`, `transformation`, `displacement`, and `ai_risk === aiois.transformation`. The formulas and field contract are unchanged, so `assemble:scores`, `check:score-batch`, `aiois-drift-report.ts`, and ETL need no contract changes.

The Codex runner consumes the prompt as a rubric only: `buildPrompt(rubric, occ)` appends the per-occupation extract and the runner's JSON output schema. The frozen prompt must not include occupation data, baseline scores, expected drift, or any alternate schema that conflicts with the runner.

Before touching the output JSONL or creating audit directories, the runner executes `codex exec --help` and requires the installed CLI to advertise `--model <MODEL>`. A failed probe or a CLI without explicit model selection is fatal: upgrade Codex and rerun. The runner never omits `--model` and never falls back to the local default model while labeling output with the requested model ID.

Explicit model-unavailable/provider-error/refusal responses and synthetic confidence-0 all-zero placeholders are rejected and retried. Raw responses remain under the run's `raw/` directory, with machine-readable rejection reasons in the adjacent `*.failures.jsonl` audit file; none of those responses may enter the output JSONL.

Runner flags:

- `--prompt-file <path>`: required rubric file.
- `--out <path>`: raw JSONL destination; pilot output should be under `.cache/scoring/`.
- `--model <id>`: optional; default is `gpt-5.6-sol`.
- `--concurrency <n>`: default 2, capped at max 4.
- `--ids 1,2,3`: score only selected IDs.
- `--limit N`: score the first N pending occupations after filtering.
- `--resume`: skip IDs already present in the output JSONL and append remaining rows.

Pilot setup (30-50 occupations):

```bash
bun scripts/make-pilot-sample.ts \
  --size 40 \
  --chunk 5 \
  --baseline data/scores/occupations_claude-fable-5_2026-06-13.json \
  --out .cache/scoring/issue-126/pilot
```

Pilot scoring via local Codex CLI:

```bash
bun scripts/run-scoring-codex.ts \
  --prompt-file data/prompts/2026-07-12_gpt-5.6-sol-aiois10.ja.md \
  --out .cache/scoring/issue-126/pilot/raw_gpt-5.6-sol_2026-07-12.jsonl \
  --model gpt-5.6-sol \
  --ids "$(jq -r '.ids | join(",")' .cache/scoring/issue-126/pilot/sample.json)" \
  --concurrency 2
```

For interrupted pilot/full runs, rerun the same command with `--resume`. Do not switch models after a failure. Model unavailable, refusal, tool failure, malformed JSON, missing AIOIS fields, bad decimals, formula mismatch, duplicate ID, or unknown ID are explicit errors to fix/retry with the same model; never silently fallback or invent a default score.

Pilot assemble/check/drift:

```bash
bun run assemble:scores \
  --mode aiois \
  --model gpt-5.6-sol \
  --date 2026-07-12 \
  --prompt-version AIOIS-10-v1.0-gpt-5.6-sol \
  --prompt-file data/prompts/2026-07-12_gpt-5.6-sol-aiois10.ja.md \
  --in .cache/scoring/issue-126/pilot/raw_gpt-5.6-sol_2026-07-12.jsonl \
  --out .cache/scoring/issue-126/pilot/occupations_gpt-5.6-sol_2026-07-12_pilot.json \
  --run-id issue-126-pilot-2026-07-12

bun run check:score-batch .cache/scoring/issue-126/pilot/occupations_gpt-5.6-sol_2026-07-12_pilot.json

bun scripts/aiois-drift-report.ts \
  --baseline data/scores/occupations_claude-fable-5_2026-06-13.json \
  --candidate .cache/scoring/issue-126/pilot/occupations_gpt-5.6-sol_2026-07-12_pilot.json \
  --out .cache/scoring/issue-126/pilot/drift_claude-fable-5_vs_gpt-5.6-sol_2026-07-12.md
```

Full run gate:

- Owner reviews the frozen prompt and this runbook section before merge.
- Owner separately approves any pilot scoring run because it consumes local Codex subscription quota.
- Owner reviews pilot artifacts and drift report before any 556-occupation full run.
- The approved full run writes raw/audit artifacts under `.cache/scoring/` first, then assembles one append-only batch at `data/scores/occupations_gpt-5.6-sol_<YYYY-MM-DD>.json`.
- Before landing the full batch, run `bun run typecheck`, `bun run build`, `bun run verify:gates`, and `bun run test`. The landing PR must acknowledge that `pickLatestScore()` flips all public projections/pages to GPT 5.6 SOL.

## Prompt requirements

Fable 5 prompt は、新規ファイルとして追加する。既存 Opus prompt を上書きしない。

推奨 path:

```text
data/prompts/2026-06-13_claude-fable-5-aiois10.ja.md
```

Prompt には最低限、以下を明記する。

- 使用モデル: `claude-fable-5`
- 標準: AIOIS-10 v1.0
- 対象: 日本の 556 職業
- 参照基準: `/standard` と `docs/AIOIS-10.md`
- 出力形式: strict JSONL, one line per occupation
- 必須 field: `id`, `ai_risk`, `rationale_ja`, `confidence`, full `aiois`
- `ai_risk` は `aiois.transformation` と一致
- 0-10 score は最大 1 桁小数
- fallback 禁止: model unavailable / refusal / tool failure は明示 error として扱う
- AIOIS-10 の定義や重みを勝手に変更しない

Prompt は versioned artifact なので、実行後の batch metadata に `prompt.prompt_file`, `prompt.prompt_sha256`, `prompt.prompt_version`, `prompt.rubric_source` を記録する。

## Execution mechanism (Issue #9)

Issue #9 の採点は、Anthropic API ではなく **claude-fable-5 セッション内採点**で行う。これは現行 Opus 4.8 batch と同じ方式である（`scripts/extract-occ-chunks.ts` の in-agent path: 実行中のモデル自身が chunk を読み JSONL を出力する。API key 不要）。`scripts/run-scoring.ts`（Batches API path）は本 issue では使わない。

実行規約:

- 採点 subagent は **claude-fable-5 上で実行**し、入力は「凍結 prompt + 職業 extract」のみとする。基準 batch（Opus 4.8 スコア）や drift 期待値を採点 subagent に渡さない（アンカリング防止）。
- 職業 extract は Opus run と同一の抽出形（`extract-occ-chunks.ts` の extractOcc: title + aliases + summary + what_it_is + working_conditions）を使い、モデル間の入力同一性を保つ。
- モデルは 1 職業 1 行の full AIOIS-10 JSONL を出力する。`transformation` / `displacement` / `ai_risk` は `/standard` の公式（Transformation = mean(D1,D2)、Displacement = E×(1−M/10)×(0.6+0.4×(P+D10)/20)、E=mean(D1,D2)、M=mean(D3..D7)、P=mean(D8,D9)、0-10 clamp）に従いモデル自身が計算して出力する。
- 検証側（assembler）は指数を再計算し、報告値が丸め境界（±0.05）を超えて乖離したら invalid として同 ID を retry する。**silent 補正はしない**。
- `ai_risk === aiois.transformation` は厳密一致。

Methodology delta（drift 解釈の前提）:

現行 Opus 4.8 batch の D2–D10 は O*NET 型ベクトル＋日本の労働統計からの決定的計算であり、LLM 判断は D1（と欠損ベクトル職の moat profile）に限られていた。Issue #9 の Fable 5 run は **D1–D10 全次元をモデルの意味判断で採点**する（Issue 本文の Required output structure / Prompt 要件に従う）。したがって、この Opus 4.8 → Fable 5 pair の drift は「モデル差」と「方式差（vector engine → semantic judgment）」の合成である。各 batch は機械可読な `scorer.scoring_method_id` を記録し、drift report は比較 pair の id が異なる場合だけ方式差を注記する。Fable 5 → GPT 5.6 のように両方が `aiois-semantic-judgment` の pair へ、この歴史的 caveat を引き継がない。

## Scoring phases

### Phase 0: setup

1. Issue #9 の本文と acceptance criteria を確認する。
2. local branch を作る。
3. `git status --short --branch` で未コミット差分を確認する。
4. `data/occupations/*.json` が 556 件あることを確認する。
5. 現行 batch が `claude-opus-4-8`, `2026-05-30`, AIOIS-10 v1.0, 556 件であることを確認する。
6. production/pre へ影響する設定を変更しないことを再確認する。

### Phase 1: documentation and prompt

1. 本 runbook を更新する。
2. Fable 5 prompt を新規作成する。
3. Prompt の output contract が本書の Required output contract と一致していることを確認する。
4. Prompt に silent fallback 禁止を明記する。
5. Prompt に AIOIS-10 field 欠落時は invalid とすることを明記する。

この phase では score batch を作らない。文書と prompt のみを review 可能にする。

### Phase 2: local tool hardening

`scripts/assemble-scores.ts` は、Fable 5 AIOIS-10 raw JSONL を受け取ったときに full `aiois` を保持し、欠落・不整合を fail させなければならない。

Required changes:

- `parseScoreLines()` が `aiois` object を読み取り、`scores[id].aiois` に保持する。
- Fable 5 / AIOIS mode では `aiois` missing を error にする。
- `d1` から `d10`, `transformation`, `displacement` の欠落を error にする。
- 各 AIOIS score が 0-10、最大 1 桁小数でない場合 error にする。
- `ai_risk !== aiois.transformation` の場合 error にする。
- `transformation` が `mean(d1,d2)`、`displacement` が `/standard` 公式の再計算値から ±0.05 を超えて乖離した場合 error にする（丸め境界の半端は許容）。
- output batch から `aiois` が落ちないことを test で固定する。
- existing legacy single-axis behavior が必要な場合は、明示 flag でのみ許可する。

Suggested CLI shape:

```bash
bun run assemble:scores \
  --mode aiois \
  --model claude-fable-5 \
  --date 2026-06-13 \
  --prompt-version AIOIS-10-v1.0-fable-5 \
  --prompt-file data/prompts/2026-06-13_claude-fable-5-aiois10.ja.md \
  --in .cache/scoring/issue-9/pilot/raw_claude-fable-5_2026-06-13.jsonl \
  --out .cache/scoring/issue-9/pilot/occupations_claude-fable-5_2026-06-13_pilot.json \
  --run-id issue-9-pilot-2026-06-13
```

Pilot output は `.cache/` 配下に置く。full run へ進むまで `data/scores/` に入れない。

### Phase 3: pilot sample

Pilot は 30-50 件とし、sample manifest を `.cache/scoring/issue-9/pilot/sample.json` に保存する。

Sample は少なくとも次を含む。

- 現行 Opus 4.8 の high band (`ai_risk >= 7.0`)
- mid band (`4.0 <= ai_risk < 7.0`)
- low band (`ai_risk < 4.0`)
- high attention / high dispute occupations
- physical / on-site work
- knowledge work
- interpersonal service work
- management / judgment-heavy work
- occupations with high `displacement`
- occupations where `transformation` and `displacement` differ sharply

Manifest field:

```json
{
  "issue": 9,
  "model": "claude-fable-5",
  "baseline_model": "claude-opus-4-8",
  "baseline_run_date": "2026-05-30",
  "sample_size": 40,
  "ids": [1, 2, 3],
  "selection_notes": {
    "high": "current ai_risk >= 7.0",
    "mid": "current ai_risk 4.0-6.9",
    "low": "current ai_risk < 4.0"
  }
}
```

### Phase 4: pilot scoring

Run only the pilot sample. Do not start a 556 full run before Jason review.

Failure handling:

- model unavailable: stop and report. Do not switch model.
- API refusal: record failed occupation ID and retry with the same model after prompt/input correction.
- malformed JSON: record line and retry same ID.
- missing AIOIS field: invalid, retry same ID.
- two-decimal score: invalid, retry same ID.
- `ai_risk !== aiois.transformation`: invalid, retry same ID.
- duplicate ID: invalid.
- unknown ID: invalid.

Allowed retries:

- Retry at most 2 times per failed occupation without changing the standard.
- Prompt clarification is allowed only to enforce existing output contract.
- Any rubric change requires updating this runbook and restarting the pilot.

### Phase 5: pilot validation

Pilot passes only if all conditions hold:

- sample count is 30-50.
- every sample has full AIOIS-10.
- no schema error.
- no coverage error within pilot manifest.
- no silent fallback.
- `ai_risk === aiois.transformation` for every row.
- drift report explains major changes.
- Jason manually approves the pilot.

Suggested local checks:

```bash
bun run test scripts/assemble-scores.test.ts
bun run typecheck
bun run check:score-batch .cache/scoring/issue-9/pilot/occupations_claude-fable-5_2026-06-13_pilot.json
```

`check:score-batch` currently expects candidate files shaped like full score batches. If it treats pilot coverage warnings as advisory, record that in the pilot report; do not reinterpret advisory coverage as full-run success.

### Phase 6: drift report

Add or extend a drift report script before full run. The report compares baseline Opus 4.8 to candidate Fable 5 on the same ID set.

Minimum output:

- compared ID count
- mean `ai_risk` / `transformation` drift
- mean `displacement` drift
- D1-D10 average drift
- low / mid / high band movement
- top 20 upward moves by `transformation`
- top 20 downward moves by `transformation`
- top 20 rank changes
- top `displacement` upward moves
- top `displacement` downward moves
- manual review list

Manual review list should include:

- absolute `transformation` drift >= 1.5
- absolute `displacement` drift >= 1.5
- any band crossing low/mid/high
- any rank movement >= 50 in full run or >= 10 in pilot
- any occupation where rationale contradicts AIOIS scores
- any occupation with low confidence

Suggested path:

```text
.cache/scoring/issue-9/pilot/drift_claude-opus-4-8_vs_claude-fable-5_2026-06-13.md
```

### Phase 7: full run

Full run starts only after pilot approval.

Full run requirements:

- output path: `data/scores/occupations_claude-fable-5_<YYYY-MM-DD>.json`
- new file only; never overwrite an existing score batch
- 556 occupations covered
- `run.run_date` is later than `2026-05-30`
- `scorer.model` is exactly `claude-fable-5`
- `scorer.model_provider` is `anthropic`
- `prompt.prompt_file` points to the frozen Fable 5 prompt
- every score has full `aiois`
- `ai_risk === aiois.transformation` for every score
- schema, coverage, drift, build, JSON-LD checks pass locally

Suggested checks:

```bash
bun run check:score-batch data/scores/occupations_claude-fable-5_<YYYY-MM-DD>.json
bun run test
bun run typecheck
bun run build
bun run verify:gates
```

Adding a newer full batch changes the canonical current score selected by `pickLatestScore()`. Therefore this step is not documentation-only and must not be pushed until preview is intentionally planned.

### Phase 8: preview validation

Preview validation is allowed only after full batch is intentionally added and Jason approves a preview run. Do not use or retarget `pre.mirai-shigoto.com` for this issue unless explicitly approved.

Preview pages:

- `/`
- `/map`
- `/rankings`
- `/standard`
- `/methodology`
- `/data`
- one low-risk occupation detail page
- one mid-risk occupation detail page
- one high-risk occupation detail page

Checks:

- page renders without 500 / hydration / console errors
- AIOIS-10 D1-D10 display correctly
- visible `AI 影響度` equals the selected score batch
- JSON-LD value matches visible page data
- footer wording matches the active model and run date
- methodology/data pages do not still claim Opus 4.8 when Fable 5 is active
- public data wording matches the actual score batch
- no preview alias is promoted to production

### Phase 9: release gate

Production release requires explicit approval after preview passes. Approval must be recorded with:

- full batch file name
- run date
- model
- prompt file and hash
- drift report path
- preview URL
- validation checklist result
- known residual risks

Without that approval, do not merge to `main`, do not push to production branch, and do not promote any deployment.

## Report template

Use this template for pilot and full-run reports.

```md
# Issue #9 scoring report

## Scope
- Phase:
- Model:
- Baseline:
- Candidate:
- IDs:

## Artifacts
- Prompt:
- Raw JSONL:
- Batch:
- Drift report:

## Validation
- Schema:
- Coverage:
- AIOIS completeness:
- ai_risk equals transformation:
- Fallback check:
- Tests:
- Build:
- JSON-LD:
- Preview:

## Drift summary
- Mean transformation drift:
- Mean displacement drift:
- Biggest upward moves:
- Biggest downward moves:
- Manual review list:

## Decision needed
- Proceed / revise / stop:
- Reason:
```

## Notes for current tooling

The current `ScoreEntrySchema` permits `aiois` to be nullish so legacy single-axis batches can still parse. That schema-level compatibility is not enough for Fable 5 AIOIS-10. The assembler and candidate validation must add an AIOIS-required mode for Issue #9.

~~`scripts/run-scoring.ts` currently defines a tool schema with only `ai_risk`, `rationale_ja`, and `confidence`. It cannot produce Fable 5 AIOIS-10 output.~~ Resolved: `run-scoring.ts` is now the provider-independent entry point and every provider emits the full AIOIS-10 contract (see "Scoring runner architecture" above). The former single-axis Anthropic Batches API implementation remains in git history (`git show 1d7d42a2:scripts/run-scoring.ts`) and is the natural starting point for a future `anthropic-api` provider.

`scripts/check-score-batch.ts` currently reports high-level drift on `ai_risk` bands. Issue #9 requires a deeper AIOIS drift report covering `displacement`, D1-D10 average drift, rank changes, and manual review candidates.

## Existing commands

The existing Opus-oriented local commands remain useful as references, but must be adapted for Fable 5 AIOIS output before Issue #9 scoring.

```bash
bun scripts/extract-occ-chunks.ts
bun scripts/run-scoring.ts --list-providers   # provider-independent scoring entry
bun scripts/assemble-scores.ts
bun scripts/make-pilot-sample.ts      # Issue #9 Phase 3: 抽样 manifest + pilot extract chunks
bun scripts/aiois-drift-report.ts     # Issue #9 Phase 6: AIOIS-10 深度 drift report
bun run build
bun run verify:gates
```

Provider credentials and model selection are local environment concerns. Credentials must never be committed.
