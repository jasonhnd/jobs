# データアーキテクチャ

本書は `src/data/`、`src/graph/`、`public/data.*` projection の実装契約をまとめる。読者向けの方法論は `/methodology` と `/standard`、開発者向けの境界は本書を正典とする。

## 全体像

- ソースデータは `data/occupations/`, `data/stats_legacy/`, `data/scores/`, `data/labels/`, `data/sectors/`, `data/ai-adoption/` に置く。
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
- `data.ai-adoption.json` — `/aiadoption` dashboard。
- `data.me-positions.json` — `/me` self-positioning tool。全職業 × 全 ranking の位置を持つ。

古い `data.featured.json`, `data.tasks/*`, `data.score-history/*` は runtime consumer がないため削除済み。`data.score_history.json` は multi-model comparison のため 2026-07 に単一 JSON projection として復活した。

`data.models_deep.json` は `/models` の visitor-facing magazine page 専用で、`score_history` の no-rationale rule を破らないための小さな例外 projection。職業 detail の full history とは別に、ページに出す story 分だけ `rationale_ja` を原文で持つ。本文 copy は `src/content/model-personality.ja.json` と `src/content/model-story-overrides.ja.json` が owner-reviewed surface で、projection は sentence id を選ぶだけにする。

`data.models_by_model.json` は batch ごとの static data page 専用で、`data/scores/` に occupations batch が追加されると `/models/{slug}` が自動生成される。slug は `src/site/score-attribution.ts` の `modelSlug()` / `modelIdFromSlug()` を正典とし、known batch list で一意に逆引きできない場合は build fail にする。drift は `src/graph/aiois-drift.ts` の `computeDriftReport()` を使い、page には reader-facing summary、movers 5 件、band crossing 5 件だけを出す。

## 数値契約

- 丸めの正典は `src/data/lib/banker-round.ts`。projection と ranking loader は同じ helper を使う。
- `riskBand()` の境界は `low < 4.0`, `mid 4.0-6.9`, `high >= 7.0`。consistency check もこの helper に従う。
- `profile5` は IPD の contributor 平均を `SOURCE_MAX = 5.0` で 0-100 に正規化し、100 を超える値は 100 に clamp する。radar の視覚上限と一致させるためで、7.0 で再スケールしない。
- worker total は compensated sum (`fsum`) を使い、丸めが必要な場所では banker rounding に寄せる。
- education / employment percentage は graph/ranking/detail 間で同じ 1 桁 banker rounding を使う。

## スコア選択

- `src/graph/score-strategy.ts` の `pickLatestScore()` が「現在スコア」の正典。
- 通常は `date` が最新の score entry を採用する。
- 同じ日付に legacy single-axis と AIOIS-10 entry が両方ある場合は AIOIS-10 を優先する。
- 両方 AIOIS-10、または両方 legacy の同日 tie は historical behavior として後勝ちにする。

## AI adoption

- `data/ai-adoption/` の observations、sources、assumptions、model から `data.ai-adoption.json` を作る。
- primary denominator と auxiliary denominator は 0 より大きくなければならない。0 は share/rate を壊すため build error にする。
- reached layer は個別に round し、`N_unreached` は `round(N_total) - reached layers` の残差で出す。公開値の 5 layer 合計が必ず total と一致するようにする。
- `updated_at` は build clock ではなく、観測データの最新 `as_of_date` から決める。JSON-LD と表示更新日を毎日 drift させないため。

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
