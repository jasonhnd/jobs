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
| `tokens` | `:root` トークン宣言 | — | `design-tokens.ts` + `canonical-css.ts` | `conformant` | 2026-09-14 完了（#525）。40 トークンを追加。参照者ゼロ → **視覚変化なし** |
| `canonical-type` | 全 839 ページの h1/h2/h3/h4 + p | 839 | `canonical-css.ts` | `conformant` | 2026-09-15 完了（#526）。h1 27.2→28 / h2 18.4→22 / h3 16→18 sans700 / h4 新設 16px sans700。**`!important` は h1/h2/h3 に残存**（撤去は design-1.9）|
| `feature` | `/` `/models` `/aiadoption` | 3 | 個別 | `legacy` | **最終段（§4.9.1）。** canonical の `!important` 撤去 + `body.page-feature` 分岐 + `models-surface` 上書き削除。他の全 surface 完了が前提 |
| `interactive` | `/map` | 1 | `_map-css.ts` + `_map-inline.js` | `conformant` | 2026-09-15 完了（#527）。`:root` 撤去、タイル 11.2px→12px・省略記号廃止（截断率 PC 54%→0 / SP 73%→0）、見出し規則 3 件除去 |
| `detail` | `/<id>` | 556 | `canonical/detail.ts` + `_id-css.ts` + 関連ビュー 2 | `conformant` | 2026-09-15 完了（#530）。12px 未満 24 種を是正、`--ink-3` 文字色 31 箇所を `--ink-meta` へ（§2.2）、字重 800/900/500 を 19 箇所是正 |
| `hub` | genre index / slug / rankings / q / compare 等 | ~37 | `canonical/hub.ts` + `rank-list-css.ts` + `templates/Hub.ts` | `conformant` | 2026-09-15 完了（#529）。第 2 層 alias は使用箇所数まで不変（検証済） |
| `sector` | `/sectors/*` | 17 | `canonical/sector.ts` + `sectors/_sector-css.ts` | `conformant` | 2026-09-15 完了（#529）。`palt` は §6.5 の意図的差分として維持 |
| `doc` | `/standard` `/methodology` `/about` `/data` `/haid` | 5 | `canonical/doc.ts` | `conformant` | 2026-09-15 完了（#528）。等幅を `--font-mono` に統一（CDP 実測で `/aiadoption` の Osaka と一致）、見出し規則除去、39 箇所を役割別トークン化 |
| `static` | `/privacy` `/compliance` `/404` | 3 | `canonical/static.ts` | `conformant` | 2026-09-15 完了（#528）。`CANONICAL_STATIC_CSS` を 3 ページへ配線（§6.5.1）、`/about` を範囲から除外（§6.5.3）、34 箇所をトークン化 |
| `misc` | `/shindan` `/me` `/gyakuten` | 3 | **Hub class** + 個別 | `conformant` | 2026-09-15 完了（#531）。3 ページとも Hub class に収容し `CANONICAL_HUB_CSS` を配線。見出し規則 21 件除去 |

## 進捗

```
conformant   9 / 10 surface
migrating    0 / 10
legacy       1 / 10
```

**step 7 完了。残るは `feature`（step 8・最終段）のみ。**
§4.9.1 の前提（他の全 surface 完了）が満たされたため、canonical の `!important` 撤去に着手できる。

> **未所属の範囲（2026-09-15 時点）:** `canonical-css.ts` の footer / cookie banner / skip-link
> ブロックに生 `font-size` が 36 箇所、`z-index: 9999` `10000`（§9.3 で禁止）が残っている。
> これらは台帳のどの surface の範囲にも入っていない。オーナー判断待ち。
>
> **正典にトークンが無い値（#527 で判明）:** `/map` には (a) 背面幕 `rgba(36,30,24,0.40)`、
> (b) シートの**上向き**影 `0 -8px 24px`（§8.3 の 3 種はすべて下向きで表現できない）、
> (c) SVG data URI 内の `stroke='%237A6F5E'`（data URI 内では `var()` が使えない）が残る。
> `check-color-tokens`（§19.1・未実装）はこれらを検出する。トークン追加か許容宣言か、
> design-1.10 着手前にオーナー判断が要る。

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
| `static` | `src/lib/canonical/static.ts`, `src/pages/privacy.astro`, `src/pages/compliance.astro`, `src/pages/404.astro` |
| `misc` | `src/pages/shindan.astro`, `src/pages/_shindan-css.ts`, `src/pages/me.astro`, `src/pages/gyakuten.astro`, `src/pages/_gyakuten-css.ts`（すべて Hub class） |

**共通:** 見出しの分岐は `src/lib/canonical-css.ts` 側に置く。ページ CSS に見出しのサイズ・書体・字重を書かない（Design.md §4.9）。

## 移行順序

[`Design.md`](Design.md) §19.5 が正典。**この順序は守ること。** 特に `feature` は最終段であり、繰り上げてはならない（§4.9.1）。

| # | surface | 視覚変化 | 前提 |
|---|---|---|---|
| 1 | ✅ `tokens` | なし | — |
| 2 | ✅ `canonical-type` | **あり・全站** | 1 |
| 3 | ✅ `interactive` | あり | 2 |
| 4 | ✅ `doc` + `static` | あり | 2 |
| 5 | ✅ `hub` + `sector` | あり | 2 |
| 6 | ✅ `detail` | あり | 2 |
| 7 | ✅ `misc` | あり | 2 |
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
| 2026-09-14 | `tokens` | `src/lib/design-tokens.ts` 新設（40 トークン + 断点定数 + `DESIGN_VERSION`）。`canonical-css.ts` の `:root` から emit。純粋な追加・参照者ゼロ・視覚変化なし。`legacy` → `conformant`（#525） |
| 2026-09-15 | `canonical-type` | canonical の h1/h2/h3/h4/p をトークン参照へ。h3/h4 をサンセリフ 700 に切替（§4.4）、セリフから `font-weight` を削除（§4.5）。**全 839 ページに視覚変化。** `legacy` → `conformant`（#526） |
| 2026-09-15 | `interactive` | `/map`。`:root` 撤去（§18.4）、font-size 33 箇所・角丸 20 箇所・z-index 9 箇所を役割別にトークン化、タイルラベルを「全文か非表示か」に（§5.7・実測閾値）、ページ側見出し規則 3 件除去。`legacy` → `conformant`（#527） |
| 2026-09-15 | `misc` | `/shindan` `/me` `/gyakuten` を **Hub class** に収容し `CANONICAL_HUB_CSS` を配線（§6.5）。ページ側見出し規則 21 件除去（正典の計数は 7）、87 箇所を役割別トークン化、禁止字重 6 箇所是正。`check-page-class` の `_shindan-css.ts` 例外を削除（`:root{}` はもう無い）。`legacy` → `conformant`（#531） |
| 2026-09-15 | `detail` | 556 ページ。ページ側見出し規則 10 件除去、`font-weight` 800/900/500 を 19 箇所是正（§4.5）、**12px 未満 24 種を是正**（最小は `.aio-tag` 8.06px）、**`--ink-3` の文字利用 31 箇所を `--ink-meta` へ**（§2.2 で `--ink-3` は Display/H1 のみ）、`--orange` のテキスト利用と `--cream-2` 上の `--orange-hot` を是正。ヒーロー統計は主 `--t-h1` / 次 `--t-h3`（オーナー裁定）。`legacy` → `conformant`（#530） |
| 2026-09-15 | `hub` + `sector` | ~54 ルート。ページ側見出し規則 7 件除去（`Hub.ts` 3 / `answers/index` 1 / `_sector-css` 3）、73 箇所を役割別トークン化、角丸を §8.2 へ。**第 2 層 alias は 1 箇所も置換していない**（使用箇所数の前後比較で検証）。`legacy` → `conformant`（#529） |
| 2026-09-15 | `doc` + `static` | 等幅を `var(--font-mono)` に統一（`/aiadoption` は UA 既定 monospace = Osaka に落ちていた。CDP `getPlatformFontsForNode` で実測・是正）。`CANONICAL_STATIC_CSS` を 3 ページへ配線（§6.5.1）、`/about` を Static の範囲から除外（§6.5.3）、H3 以下のセリフを廃止（§4.4）、12px 未満 3 箇所を是正、73 箇所を役割別トークン化。`legacy` → `conformant`（#528） |
