# データアーキテクチャ

本書は `src/data/`、`src/graph/`、`public/data.*` projection の実装契約をまとめる。読者向けの方法論は `/methodology` と `/standard`、開発者向けの境界は本書を正典とする。

## 全体像

- ソースデータは `data/occupations/`, `data/stats_legacy/`, `data/scores/`, `data/labels/`, `data/sectors/`, `data/haid-release/` に置く。
- `src/data/lib/indexes.ts` がソースを読み、Zod schema と重複 ID 検査を通して build-time index を作る。
- `src/graph/` はページ・view が読む in-memory knowledge graph。projection と view の間で同じ派生値を使うため、丸めやスコア選択の helper はここか `src/data/lib/` に集約する。
- `src/data/build.ts` は projection を staging dir に書き、全 projection 成功後に `public/` へ atomic promote する。Astro build は `public/` を `dist-astro/` にコピーする。

## Projection

現在の主要 projection は以下。

- `data.treemap.json` / `data.treemap.meta.json` — map と legacy island が読む compact summary。
- `data.top10.json` — mobile TOP 10 carousel が読む ai_risk 上位 10 件の slim 6-field payload。
- `data.detail/<id>.json` — 職業詳細ページと OG occupation card が読む per-occupation detail。
- `data.search.json` — treemap full payload を canvas 接近まで deferred にするための lightweight on-demand search index。
- `data.sectors.json` / `data.review_queue.json` — sector hub と mapping review。
- `data.profile5.json` — 5 軸 radar profile。graph layer でも同じ計算を持つ。
- `data.transfer_paths.json` — sector 内のより安全な転職候補。
- `data.score_history.json` — multi-model comparison 用の per-occupation score history。model/date と transformation/displacement/D1-D10 の数値のみを持ち、`rationale_ja` は含めない。

Occupation detail canonicals normally use `/{id}`. ID `404` is reserved by
the custom not-found document, so that occupation uses `/occupations/404`.
`src/lib/urls.ts` is the only source of truth for this mapping; URL producers
must call `occupationPath()` or `jaUrl()` rather than interpolate an ID.
- `data.models_deep.json` — `/models` feature page 用の compact projection。最新 comparable pair、モデルカードの personality sentence id、一致職業、3〜5 件の story card（選抜された両 batch の `rationale_ja` 原文と editorial sentence id）だけを持つ。30KB 以下、browser fetch なしで HTML に inline する。
- `data.models_by_model.json` — `/models/{slug}` per-model data page 用の projection。各 score batch の profile、変化指数分布、上位・下位職業、前回 batch との差分、prev/next nav を持つ。`rationale_ja` は含めず、Astro は該当 model payload だけを HTML に inline する。1 page payload は 24KB 以下。
- `data.skills/*`, `data.holland.json`, `data.labels/ja.json` — hub 系ページの入力。
- `data.ai-adoption.json` — **停止スタブ**（aiadoption-1.5）。旧 5 層モデルの出力先だった URL を、後継 `data.haid-latest.json` への案内だけを持つ固定 JSON として残す。301 は張らない（`vercel.json` を触らない、オーナー裁定 2026-09-21）。
- `data.haid-spec.json` — `/haid` の HAID v1.0 定義（10 段階・4 関係・3 境目・用語・境界事例）。数字を持たない。正典は `src/site/haid-spec.ts`、文言の正本は `docs/HAID.md`。（haid-1.3 で生成）
- `data.haid-<yyyy-qN>.json` / `data.haid-latest.json` — HAID の四半期リリース（`/aiadoption`）。段階ごとの N(≥k)（低・中・高・display・clamped）、n(k)（display・share・確度）、錨点、重なり率、対価。`latest` は最新回のコピーに `releases` 一覧を足したもの。（aiadoption-1.2 で生成）
- `data.me-positions.json` — `/me` self-positioning tool。全職業 × 全 ranking の位置を持つ。

古い `data.featured.json`, `data.tasks/*`, `data.score-history/*` は runtime consumer がないため削除済み。`data.score_history.json` は multi-model comparison のため 2026-07 に単一 JSON projection として復活した。

`data.models_deep.json` は `/models` の visitor-facing magazine page 専用で、`score_history` の no-rationale rule を破らないための小さな例外 projection。職業 detail の full history とは別に、ページに出す story 分だけ `rationale_ja` を原文で持つ。本文 copy は `src/content/model-personality.ja.json` と `src/content/model-story-overrides.ja.json` が owner-reviewed surface で、projection は sentence id を選ぶだけにする。職業別 editorial sentence id は baseline/candidate の model と run date を両方含む exact-pair key とし、未 review の pair では必ず `default_latest_pair_split` に fallback する。

`data.models_by_model.json` は batch ごとの static data page 専用で、`data/scores/` に occupations batch が追加されると `/models/{slug}` が自動生成される。slug は `src/site/score-attribution.ts` の `modelSlug()` / `modelIdFromSlug()` を正典とし、known batch list で一意に逆引きできない場合は build fail にする。drift は `src/graph/aiois-drift.ts` の `computeDriftReport()` を使い、page には reader-facing summary、movers 5 件、band crossing 5 件だけを出す。

## 数値契約

- 丸めの正典は `src/data/lib/banker-round.ts`。projection と ranking loader は同じ helper を使う。
- `riskBand()` は表示値（`displayScore()`、banker rounding 小数 1 桁）で判定する。境界は `low < 4.0`, `mid 4.0-6.9`, `high >= 7.0`。3社平均の 3.9666… は表示が 4.0 なので `mid`。帯に付く色と文言（低め / 中程度 / 高め など）はこの helper と、同じ規則の UI 側 `riskClass()` だけから決める。view・テンプレート・ブラウザ側スクリプトに独自の閾値を置かない。consistency check もこの helper に従う。
- 平均などの集計値は丸め前の値で計算し、表示するときだけ丸める（例: 全職業平均 4.5535 → 4.55）。集計値に付ける色・文言も、表示した値から決める。業種・関心タイプの平均に付ける文言は 3.5 / 5.5 / 7.0 区切りの別尺度のまま（比べるのは表示値）。
- `profile5` は IPD の contributor 平均を `SOURCE_MAX = 5.0` で 0-100 に正規化し、100 を超える値は 100 に clamp する。radar の視覚上限と一致させるためで、7.0 で再スケールしない。
- worker total は compensated sum (`fsum`) を使い、丸めが必要な場所では banker rounding に寄せる。
- education / employment percentage は graph/ranking/detail 間で同じ 1 桁 banker rounding を使う。

## スコア選択

- ScoreRun v2.2 は `scorer.scoring_method_id` を必須とする。値は `legacy-single-axis`、`aiois-vector-semantic-hybrid`、`aiois-semantic-judgment` のいずれかで、説明文の `scorer.scoring_method` から推測しない。
- drift report は比較する 2 batch の `scoring_method_id` だけを方法差の根拠にする。同じ id の pair には方法変更を帰属させない。

- 公開値は、各ベンダー（`scorer.model_provider`）の最新 comparable AIOIS-10 run を 1 件ずつ集め、その算術平均とする。規則の正典は [`CONSENSUS_SCORE.md`](CONSENSUS_SCORE.md)「改訂 2」。
- `src/graph/score-strategy.ts` の `pickFlagshipMeanScore()` が公開値（treemap / ランキング / band / 診断 / detail 見出し / JSON-LD / OG）を供給する（mms-8.10 / 8.13）。`pickConsensusScore()`（中央値）は切替 drift レポート専用に残し、公開面から呼ばない。`pickLatestScore()` は最新観測行と `/models`・`score_history` 用に残す。
- 1 ベンダー 1 件。ベンダー内では **`run.backfill` でない** run のうち最新 `run_date` の run（同日 tie は入力順の後勝ち）。窓と floor は廃止。いずれかのベンダーの最新採点日が、パネル内の最新 `run_date` より 6 ヶ月超前なら `staleVendors` に記録し、表示層が老化提示を出す。
- `run.backfill: true` の batch（追跡採点、[`CONSENSUS_SCORE.md`](CONSENSUS_SCORE.md)「改訂 3」）は、公開値・`pickLatestScore()`・`SCORE_ATTRIBUTION`・`CONTENT_DATE`・movers・`/models` パネルのいずれにも入らない。履歴面（職業ページ履歴、`score_history`、`/models` レーンの以前のモデル、per-run ページ、裸 slug 308）にはそのまま出る。
- transformation / displacement / D1–D10 はそれぞれ独立に算術平均（`src/data/lib/fsum.ts` の `fmean`）。総合 transformation を mean(D1, D2) から再計算しない。丸めは表示層の banker rounding のみ（`src/data/lib/banker-round.ts`）。
- 職業 detail は正典値に加え `consensus_transformation` / `latest_transformation` / `latest_delta` / `stale_vote` / `consensus_vendor_count` を持つ。最新観測行の表示閾値は表示層（mms-6c）。
- `SCORE_ATTRIBUTION` は `backfill` でない最新 run（最新観測・深層用）。`SCORE_PANEL` はベンダー数・最新採点日・老化ベンダー数（`vendorCount` / `latestRunDate` / `staleMonths` / `staleVendorCount`）。
- build は全職業のパネルのベンダー集合が同一であることを検証する（旗艦 batch は 556 職業すべてを覆う。不一致は build 停止）。
- 同じ日付に legacy single-axis と AIOIS-10 entry が両方ある場合、`pickLatestScore()` は AIOIS-10 を優先する。両方 AIOIS-10、または両方 legacy の同日 tie は historical behavior として後勝ちにする。

## HAID（人類と AI の距離 10 段階）

- 文言の正本は `docs/HAID.md`。コードの単一ソースは `src/site/haid-spec.ts`（haid-1.2）。`data.haid-spec.json` はその直列化で、四半期の人数は別 projection にする。
- 段階番号は固定。定義変更は大版、境界事例の追加は小版。`HAID_SPEC_DATE` は定義変更時だけ動かす（build clock を使わない）。
- 詳細は [`HAID.md`](HAID.md)。

### HAID release（四半期の現状。aiadoption-1.1）

- 1 回 = 1 ディレクトリ `data/haid-release/<yyyy-qN>/`。追加のみで、過去の回は書き換えない（`/models` の batch と同じ扱い）。
- `anchors.json` — 錨点 1 行 1 件。`value` は人数のみ（端末数・契約数は錨点にしない）、`window` は `itu_3m` / `days_30` / `days_7` / `state` / `cumulative`、`grade` は A〜D、`status` は `placeholder`（出典と未照合）か `verified`。`market` は `cn` / `row`（中国以外）/ `world`（製品群は市場をまたいでほとんど重ならないため、重なりは市場の中でだけ引く）。`kind` は `product`（1 製品の利用者）/ `union`（パネルの重複除去済み合計）/ `top_down`（`share` × `base_anchor` の人口。値は projection が検算する）/ `base`（人口。段階からは引用不可）。回の四半期末から 12 か月より古い錨点は `stale`（古い）と印を付け、ある段階の錨点が全部古いと build が止まる。
- `overlap.json` — 第 4・5 段階だけの重なり率（`rate` / `low` / `high`、調査ベース）を**市場ごと**（`cn` / `row` / `world`）に持つ。他の段階には持たせない。
- `release.json` — 段階ごとの入力は**数字ではなく方法**（aiadoption-1.6）。`method` は `single`（錨点 1 件の公表値）／`max_single`（最大の 1 社 = 下限）／`sum_minus_overlap`（低 = 最大の 1 社、高 = 単純合計、中 = 合計 × (1 − 重なり率)。第 4・5 段階のみ）／`market_union_topdown`（aiadoption-1.7c、オーナー裁定 2026-09-22: 市場ごとに積み上げる。`kind: union` の錨点がある市場はその重複除去済み値をそのまま使い、無い市場は製品の合計 × (1 − その市場の重なり率)。積み上げ合計 = 下から、`kind: top_down` の錨点（公表利用率 × `kind: base` の人口）= 上から。低 = 小さいほう、高 = 大きいほう、中 = 幾何平均。単純合計は `raw_sum` として参考表示のみ）／`none`。`certainty` は method が決める（single → measured / residual、max_single → lower_bound、sum_minus_overlap → range、none → none）。錨点の口径は段階の口径に収まること（7 日の値は 30 日の段階の下限として使える。逆は不可。`cumulative`（累計利用者）は表に載せるだけで、どの段階にも引用できない）。回の `as_of`（引用された錨点の最新日付）はその回の四半期の中に落ちなければならず、外れると projection が止まる（オーナー指摘 2026-09-22: Q2 の錨点だけで組んだ Q3 は Q3 ではない）。N(≥k) の数値と n(k) は projection が計算し、`derivation`（terms・max・sum・overlap_rate・low/mid/high・floored_to）として出力に残す。ページの「数字の出どころと計算」はこの trace を式に直して表示する。`status` は `draft` か `final`。
- スキーマと不変条件は `src/data/schema/haid-release.ts`（`loadHaidRelease()`）。`final` の回は placeholder の錨点・重なり率を 1 件も持てず、`published_at` が必須。`draft` は placeholder を許す（オーナー裁定 2026-09-21: 2026-Q3 は草稿で先に組み、10 月の照合後に値だけ差し替える）。
- N(≥k) の単調性は入力の不変条件にしない（第 3 段階の下限が第 4 段階の推定を下回ることがある）。projection が入れ子で clamp し、clamp したことを出力に記録する。
- projection（`src/data/projections/haid-release.ts`、aiadoption-1.2）の導出規則: `display(k)` は measured / residual / range なら `mid`、lower_bound なら `low`、none なら `null`。上から下へ `display(k) ≥ display(k+1)` に clamp し `clamped: true` を残す。`n(k) = display(k) − display(k+1)`（`display(11) = 0`）なので n(1..10) の合計は必ず総人口に一致する。n(k) の確度は、N(≥k) が none なら none、第 2 段階は残差（仕様どおり）、それ以外は N(≥k) と N(≥k+1) の弱いほう。`as_of` は引用された錨点の最新 `as_of`（引用されない錨点は無視）。数値は人数のまま持ち、有効数字（見出し 1 けた・表 2 けた）はページ側で丸める。

## AI adoption（旧 5 層モデル、2026-09-22 停止）

- `data/ai-adoption/` と `src/data/projections/ai-adoption.ts` は aiadoption-1.5 で削除した。分母の異なる人群を 1 つの利用率に足していた点が HAID 制定の動機（`HAID.md`）。
- 旧観測集（2026-Q2）の錨点は `data/haid-release/2026-q2/anchors.json` に C 等級として引き継いだ。`data.ai-adoption.json` は上記の停止スタブ。

## Ranking と me-positions

- ranking の正典は `src/views/ranking/index.ts` からの `buildRankings()`。
- `data.me-positions.json` は各 ranking の full sorted universe を持つため、同じ filter/sort を local RANKERS としてミラーする。
- drift guard が canonical TOP-N と local full-universe prefix を比較し、ズレたら build を失敗させる。
- `universe_size` は hardcode ではなく実際の occupation count から導出する。

## 検証

- `bun run test` — unit tests。
- `bun run typecheck` — TypeScript。
- `bun run build` — ETL + Astro + rendered leak / CSP hash checks。
- `bun run test:consistency` — built projection の L3 sanity check。
- `bun run verify:gates` — consistency、architecture、internal links、JSON-LD、SEO baseline。
