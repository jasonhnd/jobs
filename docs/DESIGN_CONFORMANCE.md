# Design 適合台帳

[`Design.md`](Design.md) §20.4 の適合台帳。**surface 単位で規範への適合を宣言し、CI はその surface にのみ規範を強制する。**

対象規範: **Design v1.0**（制定 2026-09-14）

## 状態の意味

| 状態 | 意味 | CI の扱い |
|---|---|---|
| `conformant` | 当該版に適合済み | **強制** — 違反でビルド失敗 |
| `migrating` | 作業中 | 報告のみ（warning） |
| `legacy` | 未着手 | 対象外（info） |

**台帳は一方向にしか動かない。** `conformant` → `legacy` の差し戻しは、オーナー承認付きの MAJOR 改訂としてのみ許す（§20.4）。これが漂流を止めるラチェットである。

## 台帳

| surface | 範囲 | ページ数 | 実装 | 状態 | 備考 |
|---|---|---|---|---|---|
| `tokens` | `:root` トークン宣言 | — | `canonical-css.ts` | `legacy` | 最初の作業。トークン追加のみ、参照者ゼロ → **視覚変化なし** |
| `canonical-type` | 全 839 ページの h1/h2/h3 | 839 | `canonical-css.ts` | `legacy` | canonical の見出しをトークン参照へ。**`!important` は残す**。全站で h1 27.2→28 / h2 18.4→22 / h3 16→18 |
| `feature` | `/` `/models` `/aiadoption` | 3 | 個別 | `legacy` | **最終段（§4.9.1）。** canonical の `!important` 撤去 + `body.page-feature` 分岐 + `models-surface` 上書き削除。他の全 surface 完了が前提 |
| `interactive` | `/map` | 1 | `_map-css.ts` | `legacy` | `--font-serif` 再宣言あり（§18.4 違反）。行間 1.2 |
| `detail` | `/<id>` | 556 | `canonical/detail.ts` + `_id-css.ts` | `legacy` | `--ink-*` 系。規模最大のため後半に回す |
| `hub` | genre index / slug / rankings / q / compare 等 | ~37 | `canonical/hub.ts` | `legacy` | `--fg*` alias 系。第 2 層の扱いに注意（§2.1） |
| `sector` | `/sectors/*` | 17 | `canonical/sector.ts` | `legacy` | Hub とほぼ同じ。`palt` のみ差分 |
| `doc` | `/standard` `/methodology` `/about` `/data` `/haid` | 5 | `canonical/doc.ts` | `legacy` | 等幅が Menlo（`/aiadoption` の Osaka と不一致） |
| `static` | `/privacy` `/compliance` `/404` | 3 | **未配線** | `legacy` | `CANONICAL_STATIC_CSS` が import 0（§6.5.1）。配線と同時に移行する |
| `misc` | `/shindan` `/me` `/gyakuten` | 3 | 個別 | `legacy` | class 未所属。通常クラスへの収容で足りる見込み |

## 進捗

```
conformant   0 / 10 surface
migrating    0 / 10
legacy      10 / 10
```

**実装は未着手。** 本台帳は Design v1.0 発効（2026-09-14）時点の出発状態である。

## surface ごとの対象ファイル

移行担当が最初に開くファイル。ここに無いファイルに手を広げる場合は、その理由を PR に書く。

| surface | 主な対象ファイル |
|---|---|
| `tokens` | `src/lib/design-tokens.ts`（新設）, `src/lib/canonical-css.ts` |
| `feature` | `src/pages/index.astro`, `src/pages/_index-css.ts`, `src/pages/models.astro`, `src/pages/models/[model].astro`, `src/pages/aiadoption.astro`, `src/pages/_ai-adoption-css.ts`, `src/site/models-built.test.ts`（§19.2 のテスト書き換え） |
| `interactive` | `src/pages/map.astro`, `src/pages/_map-css.ts` |
| `detail` | `src/lib/canonical/detail.ts`, `src/pages/_id-css.ts`, `src/pages/[...id].astro` |
| `hub` | `src/lib/canonical/hub.ts`, `src/lib/rank-list-css.ts`, `src/templates/Hub.ts` |
| `sector` | `src/lib/canonical/sector.ts`, `src/pages/sectors/_sector-css.ts` |
| `doc` | `src/lib/canonical/doc.ts` |
| `static` | `src/lib/canonical/static.ts`（未配線・§6.5.1）, `src/pages/privacy.astro`, `src/pages/compliance.astro`, `src/pages/404.astro` |
| `misc` | `src/pages/shindan.astro`, `src/pages/_shindan-css.ts`, `src/pages/me.astro`, `src/pages/gyakuten.astro`, `src/pages/_gyakuten-css.ts` |

**共通:** 見出しの分岐は `src/lib/canonical-css.ts` 側に置く。ページ CSS に見出しのサイズ・書体・字重を書かない（Design.md §4.9）。

## 移行順序

[`Design.md`](Design.md) §19.5 が正典。**この順序は守ること。** 特に `feature` は最終段であり、繰り上げてはならない（§4.9.1）。

| # | surface | 視覚変化 | 前提 |
|---|---|---|---|
| 1 | ⬜ `tokens` | なし | — |
| 2 | ⬜ `canonical-type` | **あり・全站** | 1 |
| 3 | ⬜ `interactive` | あり | 2 |
| 4 | ⬜ `doc` + `static` | あり | 2 |
| 5 | ⬜ `hub` + `sector` | あり | 2 |
| 6 | ⬜ `detail` | あり | 2 |
| 7 | ⬜ `misc` | あり | 2 |
| 8 | ⬜ `feature` | あり | **3〜7 すべて完了** |
| 9 | ⬜ CI ゲート有効化 | なし | 8 |

### `feature` を最後に置く理由

canonical の `html body h1/h2/h3 { … !important }` が、ページ側の **class 付き見出し規則 66 箇所**を抑え込んでいる。`feature` はその `!important` の撤去を含むため、66 箇所が全部消えるまで実行できない。

繰り上げると、未移行 surface のページ側規則が一斉に復活し、**全站規模の視覚回帰**になる。

| surface | 削除すべき見出し規則 |
|---|---|
| `detail` | 10（`_id-css.ts` 8 / `canonical/detail.ts` 2） |
| `misc` | 7（`_shindan-css.ts` 5 / `me.astro` 2） |
| `hub` | 4（`templates/Hub.ts` 3 / `answers/index.astro` 1） |
| `sector` | 3（`sectors/_sector-css.ts` 3） |
| `doc` | 2（`canonical/doc.ts` 1 / `data.astro` 1） |
| `interactive` | 1（`_map-css.ts` 1） |

## 実装手順

[`Design.md`](Design.md) **§21** に手順書がある。着手前に必ず読む。特に:

- **§21.3 既存値 → トークンの対応表** — 75 種 803 箇所の置換規則。**機械適用は禁止**（役割優先）
- **§21.4 alias 層の扱い** — 第 2 層を第 1 層へ置換してはならない（色が変わる）
- **§21.5 検証手順** — 実行するコマンドと視覚回帰の範囲
- **§21.7 やってはいけないこと**

## 各 surface の移行時チェックリスト

移行完了を `conformant` と宣言する前に、すべて満たすこと。

- [ ] `font-size` がすべて `var(--t-*)`
- [ ] `color` がすべて `var(--*)`（生 hex / rgba なし）
- [ ] `padding` / `gap` が `var(--s-*)`、`border-radius` が `var(--r-*)`、`z-index` が `var(--z-*)`
- [ ] 見出しが 5 級のいずれか。H1 がちょうど 1 つ（§4.3）
- [ ] セリフが Display / H1 / H2 のみ（§4.4）
- [ ] サンセリフの字重が 400 / 600 / 700 のみ（§4.5）
- [ ] 等幅が `var(--font-mono)` 経由
- [ ] 前景色 × 字号がコントラスト契約を満たす（§2.2）
- [ ] `font-size` に `!important` なし（§4.9）
- [ ] ページ CSS に `:root{}` なし（§18.4）
- [ ] PC / SP のスクリーンショット差分を確認済み

## 履歴

| 日付 | surface | 変更 |
|---|---|---|
| 2026-09-14 | — | Design v1.0 制定。全 surface を `legacy` として台帳を開始 |
| 2026-09-14 | 順序 | `feature` を 2 番目から最終段へ（§4.9.1）。`canonical-type` を新設 |
