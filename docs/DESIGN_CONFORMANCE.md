# Design 適合台帳

[`Design.md`](Design.md) §20.4 の適合台帳。**surface 単位で規範への適合を宣言し、CI はその surface にのみ規範を強制する。**

対象規範: **Design v1.1**（制定 2026-09-14 / 改訂 2026-09-17）

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
| `feature` | `/` `/models` `/aiadoption` | 3 | `canonical-css.ts`（`body.page-feature`）+ 個別 | `conformant` | 2026-09-15 完了（#532、3 回に分けて実施）。`!important` 全廃・Display 分岐・H1 重複解消・ページ CSS 224 箇所のトークン化 |
| `interactive` | `/map` | 1 | `_map-css.ts` + `_map-inline.js` | `conformant` | 2026-09-15 完了（#527）。`:root` 撤去、タイル 11.2px→12px・省略記号廃止（截断率 PC 54%→0 / SP 73%→0）、見出し規則 3 件除去 |
| `detail` | `/<id>` | 556 | `canonical/detail.ts` + `_id-css.ts` + 関連ビュー 2 | `conformant` | 2026-09-15 完了（#530）。12px 未満 24 種を是正、`--ink-3` 文字色 31 箇所を `--ink-meta` へ（§2.2）、字重 800/900/500 を 19 箇所是正 |
| `hub` | genre index / slug / rankings / q / compare 等 | ~37 | `canonical/hub.ts` + `rank-list-css.ts` + `templates/Hub.ts` | `conformant` | 2026-09-15 完了（#529）。第 2 層 alias は使用箇所数まで不変（検証済） |
| `sector` | `/sectors/*` | 17 | `canonical/sector.ts` + `sectors/_sector-css.ts` | `conformant` | 2026-09-15 完了（#529）。`palt` は §6.5 の意図的差分として維持 |
| `doc` | `/standard` `/methodology` `/about` `/data` `/haid` | 5 | `canonical/doc.ts` | `conformant` | 2026-09-15 完了（#528）。等幅を `--font-mono` に統一（CDP 実測で `/aiadoption` の Osaka と一致）、見出し規則除去、39 箇所を役割別トークン化 |
| `static` | `/privacy` `/compliance` `/404` | 3 | `canonical/static.ts` | `conformant` | 2026-09-15 完了（#528）。`CANONICAL_STATIC_CSS` を 3 ページへ配線（§6.5.1）、`/about` を範囲から除外（§6.5.3）、34 箇所をトークン化 |
| `chrome` | 全 839 ページ共通のクロム（top-nav / footer / cookie banner / skip-link / mobile nav） | 839 | `canonical-css.ts` | `conformant` | 2026-09-17 新設・完了（design-1.13）。どの page class にも属さないがサイト全体に描画されるため独立 surface とした |
| `misc` | `/shindan` `/me` `/gyakuten` | 3 | **Hub class** + 個別 | `conformant` | 2026-09-15 完了（#531）。3 ページとも Hub class に収容し `CANONICAL_HUB_CSS` を配線。見出し規則 21 件除去 |

## 進捗

```
conformant  11 / 11 surface
migrating    0 / 11
legacy       0 / 11
```

**全 10 surface が `conformant`。移行完了（2026-09-15）。**

- ページ標題はサイト全体で **2 値**のみ（H1 28px / Display `clamp(32px,6vw,40px)`）
- `font-size` の `!important` は `src/` から**全廃**
- ページ CSS に見出しの字号・書体・字重を書く箇所は **0**
- 本文サイズ以下で 12px 未満の描画は、**サイト共通 footer を除き 0**

> **オーナー裁定（2026-09-17）と対応**
>
> 1. ~~未所属の範囲~~ → **`chrome` surface として新設・移行済み**（design-1.13）。
>    生 `font-size` 30 箇所をトークン化、`z-index: 9999` `10000` `500` を §9.3 の
>    6 段へ収容。**全 839 ページで 12px 未満の描画が 0 になった。**
> 2. **正典にトークンが無い値** — `/map` の背面幕 `rgba(36,30,24,0.40)`、シートの
>    **上向き**影、SVG data URI 内の `stroke`。
> 3. **`check-contrast` の除外** — `[aria-hidden]` の装飾グリフ（パンくずの区切り等）。
> 4. **統計数値の書体** — §4.7 は serif（討論 4）。`/<id>` は準拠済みだが
>    `/aiadoption` `/` `/models` は sans。トークン化ではなくブランド判断のため未着手。
> 5. **裸の `<small>`** — UA 既定 0.8em のため `--t-xs` の親の中で 9.6px に落ちる。
>    `check-type-scale` は宣言値のみを見る。継承後の実効値検査は未実装。
>
> **CI ゲート稼働後に判明した残件（2026-09-16・#533）**
>
> - ~~§18.7 class 所属~~ → **解消済み**（2026-09-17 / design-1.14）。`answers/*`
>   `rankings/*` `compare/*` `skills/*` `interests/*` の 10 ページに Hub class、
>   `sectors/index` に Sector class を配線。`models/[model]` は Feature 家族として
>   明示的に例外登録。`check-page-class` の §18.7 検査が OK になった。
> - ~~`check-color-tokens` は報告のみ~~ → **§2.5 新設（v1.1）で失敗ゲートに昇格**
>   （2026-09-17 / design-1.15）。調色板トークン由来の色調 65 箇所を `color-mix()` へ
>   移行し、以後は生で書くとビルドが落ちる。残る 52 箇所はブランド色・グラデーション
>   の停止色・中性の影であり、調色板に基色が無いため `drift:design` の報告のまま。

> **§2.2 コントラスト契約の実装追随（2026-09-17）**
>
> `check-contrast` は**宣言された役割 × 背景の 32 組**を見るゲートであり、実際に描画
> された前景色は見ていない。axe-core で 28 ページ × 2 視口を実測したところ、契約を
> 満たさない前景/背景の組み合わせが **46 種**残っていた。ゲートが緑でも実装は未達で
> あったということで、これは surface 移行ではなく §2.2 そのものの実装追随である。
> 実測は **46 種 → 0 種**、axe の WCAG 2.0/2.1 A+AA 違反は **3 種 → 0 種**。
>
> 根本原因は 5 つで、いずれも個々の色の選択ミスではなく仕組みの問題だった。
>
> 1. **文字への `opacity`** — `--fg2` は cream で 4.57 と余裕が無く、`opacity: .92`
>    でも契約を割る。§2.2 の表は alpha を掛けた後の色を見られない。ページ側に複製
>    された footer ブロックの `opacity` は正典側が同プロパティを宣言していないため
>    上書きされず生き残っていた（7 ファイル）。
> 2. **`--orange` の文字利用** — §2.2 規則 3 の明文違反が 170 宣言。`--orange-hot`
>    へ寄せた。例外は §2.2 規則 5 が認める図形 2 宣言（ブランドマーク）のみ。
> 3. **`--orange` を白字ボタンの背景に** — §2.2 規則 4 が「現状違反」として名指し
>    していた主 CTA 群。22 ブロックの背景を `--orange-hot` にした。
> 4. **`--fg3` の文字利用** — §2.2 規則 5 の明文違反が 37 宣言。`--ink-meta` へ。
>    `[aria-hidden]` の区切りグリフは規則 5 の「罫」として除外した。
> 5. **§2.3 の飽和色を文字色に使っていた** — マップタイル名の白字（band 1/2/3 で
>    3.43 / 2.74 / 3.48）、`/<id>` のスコア数字のインライン連続グラデーション
>    （28px で 2.57、§4 役割表は「統計数値（大）→ `--ink`」）、HAID の次元コード。
>    §2.3 の飽和色は「塗り」であって文字色ではない。
>
> あわせて §2.3「ピルの配色」の**是正値を実装に反映**した（`--risk-pill-low-fg`
> `#48705F`→`#446a5a` 4.16→4.53 / `--risk-pill-mid-fg` `#8A6A2A`→`#826427`
> 4.11→4.52）。討論 5（2026-09-14）で確定済みだったが未実装だった。自前の
> `color-mix()` / `rgba()` で作っていたピル 4 種（`.band-low/mid/high` `.tc-risk`
> `.status-stale`）も §2.3 が 4.5:1 を保証する 3 ペアに寄せた。
>
> 視覚回帰: 18 ページ × 2 視口で**寸法差ゼロ**（レイアウト移動なし）。差分は
> 0.14〜3.1% の画素で、すべて色の置換に対応する。
>
> **オーナー判断が要る残件**
>
> - **`--risk-0`（`#0F8A66`）には契約を満たす文字色が調色板に存在しない。** 白 4.33 /
>   `--ink` 3.81 が上限で、4.5 に届くのは純黒（4.85）のみ。現在 band 0 の職業は
>   **0 件**のため描画されず実害は無いが、採点の更新で band 0 が現れた時点でタイル名が
>   契約を割る。§2.3 は `[確定]` なので濃度の変更はオーナー承認が要る。暫定として
>   band 0 は従来どおり白字のままにしてある。
> - **Design.md の「現状」記述が古くなった。** §2.2 規則 4 の「現状違反: トップの
>   『気になる職業から始める』等、主 CTA すべてが該当する」は解消済み、§2.3 ピル表の
>   「現行 前景」列は是正値と一致した。§20.6 により実装に合わせて正典を書き換えない
>   ため未修正のまま残してある。§2.2 の `[移行中]` → `[確定]` 昇格とあわせてオーナー
>   裁定を求める。

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
| `chrome` | `src/lib/canonical-css.ts` |
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
| 8 | ✅ `feature` | あり | **3〜7 すべて完了**（#532・3 PR に分割） |
| 9 | ✅ CI ゲート有効化 | なし | 8 |

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
| 2026-09-17 | 色 | **Design v1.1 / §2.5 新設**（オーナー裁定）。色調は既存トークンから `color-mix()` で作る。65 箇所を移行し `check-color-tokens` を失敗ゲートへ昇格。トークンは 1 つも増えていない（#532 系 design-1.15） |
| 2026-09-16 | ゲート | `check-type-scale` / `check-contrast` / `check-design-sync` を実装し `verify:gates` へ接続。`check-page-class` に §18.7 class 所属検査（警告）を追加。`check-color-tokens` は `drift:design` の報告として実装（正典にアルファ・色調トークンが無いため）。実装時に **type-scale が 14 件の見落としを検出**（`canonical/detail.ts` と `sector.ts` の**裸 `h1{}`** を含む。#532 の検証 grep はセレクタ前置を要求していたため裸要素セレクタを取りこぼしていた）。すべて是正済み（#533） |
| 2026-09-15 | `feature` | ページ CSS の font-size 224 箇所を役割別トークン化（`/aiadoption` 43 / `/models` 系 27 / `/` 152）。禁止字重 28 箇所是正。裸 `<small>` が `--t-xs` の親で 9.6px に落ちる問題を是正。`migrating` → `conformant`。**全 10 surface 完了**（#532） |
| 2026-09-15 | `feature` | **canonical の `font-size: … !important` を全廃**（§4.9.1）。前提として残存していた class 付き見出し規則 20 件（hub 系ルート・#529 の対象ファイル外）と `models-surface` 覆盖 9 件を除去。`body.page-feature h1 = --t-display` を canonical に追加（特異度 0,0,1,2 で勝つため `!important` 不要）。`/` の H1 重複を解消（§4.3-1）、SEO ベースライン更新。`assertHeroSizeBeatsCanonical` を適合アサーションへ書き換え（§19.2）。`legacy` → `migrating`（#532） |
| 2026-09-15 | `misc` | `/shindan` `/me` `/gyakuten` を **Hub class** に収容し `CANONICAL_HUB_CSS` を配線（§6.5）。ページ側見出し規則 21 件除去（正典の計数は 7）、87 箇所を役割別トークン化、禁止字重 6 箇所是正。`check-page-class` の `_shindan-css.ts` 例外を削除（`:root{}` はもう無い）。`legacy` → `conformant`（#531） |
| 2026-09-15 | `detail` | 556 ページ。ページ側見出し規則 10 件除去、`font-weight` 800/900/500 を 19 箇所是正（§4.5）、**12px 未満 24 種を是正**（最小は `.aio-tag` 8.06px）、**`--ink-3` の文字利用 31 箇所を `--ink-meta` へ**（§2.2 で `--ink-3` は Display/H1 のみ）、`--orange` のテキスト利用と `--cream-2` 上の `--orange-hot` を是正。ヒーロー統計は主 `--t-h1` / 次 `--t-h3`（オーナー裁定）。`legacy` → `conformant`（#530） |
| 2026-09-15 | `hub` + `sector` | ~54 ルート。ページ側見出し規則 7 件除去（`Hub.ts` 3 / `answers/index` 1 / `_sector-css` 3）、73 箇所を役割別トークン化、角丸を §8.2 へ。**第 2 層 alias は 1 箇所も置換していない**（使用箇所数の前後比較で検証）。`legacy` → `conformant`（#529） |
| 2026-09-15 | `doc` + `static` | 等幅を `var(--font-mono)` に統一（`/aiadoption` は UA 既定 monospace = Osaka に落ちていた。CDP `getPlatformFontsForNode` で実測・是正）。`CANONICAL_STATIC_CSS` を 3 ページへ配線（§6.5.1）、`/about` を Static の範囲から除外（§6.5.3）、H3 以下のセリフを廃止（§4.4）、12px 未満 3 箇所を是正、73 箇所を役割別トークン化。`legacy` → `conformant`（#528） |
