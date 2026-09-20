# Design 適合台帳

[`Design.md`](Design.md) §20.4 の適合台帳。**surface 単位で規範への適合を宣言し、CI はその surface にのみ規範を強制する。**

対象規範: **Design v1.2**（制定 2026-09-14 / 改訂 2026-09-20）

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
| `og` | OG 画像レンダラ（1200×630 PNG） | — | `src/lib/og-renderers/` | `legacy` | 2026-09-17 新設（design-1.18）。**意図的に `legacy`。** Satori のスタイルオブジェクトで PNG を組む別媒体であり、§4.2 の**網頁**字階（12px 下限・7 段）は 1200×630 の画像に 適用されない。一方 §2.3 の影響度色は参照しており、色の正典は共通。台帳に**在る**こと が重要で、不在は「きれい」と読めてしまう（design-1.16） |

## 進捗

```
conformant  11 / 12 surface
migrating    0 / 12
legacy       1 / 12   (og — 別媒体。design-1.18 で意図的に legacy)
```

**全 10 surface が `conformant`。移行完了（2026-09-15）。**

- ページ標題はサイト全体で **2 値**のみ（H1 28px / Display `clamp(32px,6vw,40px)`）
- `font-size` の `!important` は `src/` から**全廃**
- ~~ページ CSS に見出しの字号・書体・字重を書く箇所は **0**~~ → **誤り。48 箇所あった**
  （2026-09-17 実測 / design-1.16）。§4.9 は移行中の手書き grep で担保しており、
  機械的なゲートが存在しなかった。`check-heading-rules` 新設。
- ~~本文サイズ以下で 12px 未満の描画は、**サイト共通 footer を除き 0**~~ → **誤り。
  15 種が残っていた**（最小は `/compare` の 10.88px、`/aiadoption` の SVG 軸ラベル
  10px）。当時の計測が台帳の claim する全ページではなく標本ページに対してだった。

> **オーナー裁定（2026-09-17）と対応**
>
> 1. ~~未所属の範囲~~ → **`chrome` surface として新設・移行済み**（design-1.13）。
>    生 `font-size` 30 箇所をトークン化、`z-index: 9999` `10000` `500` を §9.3 の
>    6 段へ収容。~~**全 839 ページで 12px 未満の描画が 0 になった。**~~ → この
>    結論は標本ページに対するもので、全 839 ページでは成立していなかった（design-1.16）。
> 2. **正典にトークンが無い値** — `/map` の背面幕 `rgba(36,30,24,0.40)`、シートの
>    **上向き**影、SVG data URI 内の `stroke`。
> 3. ~~**`check-contrast` の除外**~~ → **§2.2 規則 7 として明文化**（v1.2 / design-1.19）。
>    `aria-hidden="true"` の装飾グリフは規則 5 の「罫」にあたり契約の対象外。
>    ただし**「`aria-hidden` を付ければ契約を回避できる」ではない** — 読み上げ
>    られるべき文字に付けるのは §11 と WCAG 1.3.1 の違反で、そちらで落ちる。
> 4. ~~**統計数値の書体**~~ → **解消済み**（2026-09-17 / design-1.12）。`.metric-value`
>    `.impact-number` `.explain-number` `.stat dd` の 4 宣言を `--font-serif` +
>    `tabular-nums` にした。ブランド判断ではなく 4 宣言の問題だった。
> 5. **裸の `<small>`** — UA 既定 0.8em のため `--t-xs` の親の中で 9.6px に落ちる。
>    `check-type-scale` は宣言値のみを見る。継承後の実効値検査は未実装。
>    ~~**実測（2026-09-17・28 ページ × 2 視口）: 該当する実描画は 0。**~~
>    → **この記述は誤り。実測せずに書いた。** design-1.20 でブラウザ実測したところ
>    `/haid` の `<small>` が **11.6667px** で残っていた（UA 既定 0.83em × 親 14px）。
>    正典側に `html body small { font-size: var(--t-xs) }` を置いて解消し、
>    `design-contract.spec.ts` が全 16 ページ × 2 視口で 12px 下限を実測で守る。
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
> **2026-09-20 追記（design-1.21）。** もう半分の盲点が残っていた。`check-contrast` は
> 「その色のコントラストが足りるか」しか見ず、「その役割にその色を使ってよいか」は
> 見ていない。§4.7 が `--ink` と定める見出し・`h1 .accent`・`strong`/`em`・統計数値の
> **82 箇所**が `--accent-deep` / `--orange-hot` / `--fg2` / 生 hex で塗られたまま緑だった
> （`/` の統計「高影響職業の賃金 105.7兆」が安全緑、など）。`check-role-color` を新設し、
> §4.7 の役割 → トークンの対応を CSS 実装と照合する。canvas 内の文字（`/` の treemap）は
> 引き続きどのゲートにも見えない — §5.7 のオーナー裁定を参照。
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

> ~~**未所属の範囲（2026-09-15 時点）**~~ → **解消済み**（design-1.13）。上の
> オーナー裁定 1 と同じ件で、記述が二重に残っていた。
>
> ~~**正典にトークンが無い値（#527 で判明）**~~ → **3 件とも決着**（2026-09-17 / design-1.19）。
>
> | | 状態 |
> |---|---|
> | (a) 背面幕 `rgba(36,30,24,0.40)` | **既に解消していた。** design-1.15 で `color-mix(in srgb, var(--ink) 40%, transparent)` になっており、`color-tokens.ts` の例外だけが死んで残っていた。撤去 |
> | (b) シートの上向き影 | **§8.3 に `--sh-sheet` を追加**（v1.2・MINOR）。方向だけでなく**色調も**反していた — `rgba(0,0,0,·)` は §8.3 が「暖色キャンバス上で濁る」として禁じている中性グレーである。cookie バナーの上向き影も同じトークンへ |
> | (c) data URI 内の `stroke` | **例外として §2.4 に明文化。ただし条件付き** — 書いた値が調色板トークンの値と一致することを `check-color-tokens` が照合する。危険なのは hex を書くこと自体ではなく、**トークンを動かしたときアイコンだけ静かに取り残されること**である |

> **ゲートの被覆範囲（2026-09-17 / design-1.16）**
>
> どのゲートも最初に `surfaceStateFor(file)` を引き、台帳がどの surface にも割り
> 当てていないファイル（`null`）を**スキップ**する。これは未移行の範囲を対象外に
> 保つための意図的な設計だが、裏を返すと**台帳の「対象ファイル」表が、ゲートが
> site のどこまで見えるかを静かに決めている**。
>
> 台帳が `conformant 11/11 surface` と読める状態で実測した結果:
>
> ```
> 272  走査対象のソースファイル
>  28  いずれかの surface が claim している
> 244  どの surface にも属さず、全ゲートがスキップ
> ```
>
> スキップ側に含まれていたもの: `src/pages/_index.css`（75 KB のトップページ
> スタイルシート。表が名指ししていたのは `src/pages/_index-css.ts` という別の
> 3.5 KB のファイルだった）、`TopNav.astro`、`Footer.astro`、`src/pages/<hub>/` の
> ほぼ全ルート。
>
> その隙間に隠れていた実数:
>
> | | 件数 |
> |---|---|
> | 生 `font-size` 宣言 | **255**（ゲートが見えていたのは 1） |
> | 12px 未満の実描画 | **15 種** |
> | ページ CSS の見出し規則（§4.9） | **48**（うち 35 がスキップ側） |
>
> **これは同じ失敗の 3 度目である。** §18.7 は class 所属を宣言しながら配線されて
> いなかった（design-1.14 で解消）。`check-contrast` は宣言された役割だけを見て
> 実際に描画された色を見ていなかった（2026-09-17 の §2.2 実装追随で解消）。そして
> 台帳は範囲を宣言しながらゲートがそこへ届いていなかった。**範囲を宣言することと、
> 範囲を被覆することは別である。**
>
> 対応（design-1.16）:
>
> 1. 台帳のパスは末尾 `/` で**ディレクトリを claim できる**ようにした。表は移行担当
>    向けの文書として読める長さを保ったまま、配下の全ファイルに届く。
> 2. `check-surface-coverage` 新設 — 設計宣言を含むファイルがどの surface にも属して
>    いなければ報告する。`legacy` は正直な「まだ」であり構わない。**許されないのは
>    「不在」であり、不在は「きれい」と読めてしまう。**
> 3. `check-heading-rules` 新設 — §4.9 を機械化。`h1 .h1-sub` のように主語が見出しで
>    ない規則は対象外（宣言が乗る要素で判定する）。
>
> design-1.16 では claim 済みファイル内の §4.9 違反 12 件を除去した。実際に描画が
> 変わったのは 2 件のみで、いずれも §4.4「セリフは h1/h2 のみ」の適用である
> （`/<id>` の `.topn-block h3` `.org-cert-block h3`: serif → sans）。残りは特異性で
> 正典に負けていたか、§4.5 によりセリフ上で無効な字重宣言だった。
>
> **判明した機構:** Astro の page `<style>` は `[data-astro-cid-…]` 属性付きで
> スコープされるため特異性が (0,0,1,1) になり、正典の `html body h3`(0,0,0,3) を
> **上回る**。ページ側の見出し規則は死んでいるのではなく生きていた。
>
> 被覆の残り（31 ファイル / 938 宣言）は `check-surface-coverage` が報告し続ける。
> hub / sector ほかを claim して違反を潰す作業は後続の PR で行い、最後に本ゲートを
> `DESIGN_COVERAGE_STRICT=1` で失敗ゲートへ昇格させる。

> **`hub` の被覆（2026-09-17 / design-1.17）**
>
> design-1.16 が報告した被覆の穴のうち、`hub` の分を閉じた。台帳の `hub` 行が
> claim していたのは共有モジュール 3 本だけで、**実際に描画される 19 のルート
> ディレクトリはどのゲートからも見えていなかった**。
>
> | | before | after |
>|---|---|---|
> | claim 済みファイル（全 surface） | 28 | **127** |
> | `hub` 範囲の生 `font-size` | **223** | **0** |
> | `hub` 範囲のページ側見出し規則（§4.9） | **31** | **0** |
> | `hub` 範囲の生 rgba 色調（§2.5） | **11** | **0** |
>
> 223 宣言は §4.7 の役割表で 1 件ずつ割り当てた。数値の近さで機械適用していない
> （§21.3）。同じ 15.2px でも役割で行き先が違う例:
>
> ```
> .sub            h1 直下の副題    → --t-h3    （リード文・副題）
> .sop-cite       注記            → --t-sm    （補助説明・注記）
> .cci-name       カード内の職業名  → --t-sm
> .cc-typeahead input  フォーム入力 → --t-body （16px 必須・iOS の自動ズーム回避）
> ```
>
> 12px 下限（§4.2）を割っていた実描画もここで消えた（`.duel-bar .risk-pill` 11px、
> `.cc-recent-note` `.ccq-vs` `.cci-vs-row` 11.2px、`.rxh-genre` 11.2px ほか）。
>
> **ページ側 footer ブロックの削除。** `chrome` が footer を持つのは design-1.13
> からで、ページ側の複製は正典が宣言する性質については特異性で負けて死んでいる。
> ところが**正典が宣言していない性質については生きて勝つ** — #552 で見つかった
> `opacity: .92` がまさにそれだった。トークン化して延命させるのではなく削除した
> （`rankings/index` `rankings/[type]` の 2 ファイル、計 16 規則）。
>
> **`src/views/` を `hub` に入れた影響。** 関連職業・関連ハブのフラグメントは
> hub 由来だが、描画されるのは詳細ページと業種ページである。`.same-risk-neighbors h2`
> の見出し規則を外した結果、`/<id>` のその区画見出しが 16.8px → 22px（正典の h2）に
> なり、同ページの他の区画見出しと揃った。
>
> 視覚回帰（20 ページ × 2 視口）は hub 系で 8〜33% の画素が動く。これは字号の
> 再割り当てで各行が数 px ずつ縦に動き、`>8/255` 指標が位置ずれに寛容でないため
> であって、構造は不変である（高さ差は最大 −146px、大半は ±50px 未満）。claim して
> いないページ（`/` `/map` など）は footer のビルド時刻ノイズ 35 画素のみ。

> **被覆を閉じ、ゲートを失敗へ昇格（2026-09-17 / design-1.18）**
>
> design-1.16 が穴を測り、design-1.17 が `hub` を閉じた。本単位で残りを閉じる。
>
> | | design-1.16 前 | 1.16 | 1.17 | **1.18** |
> |---|---|---|---|---|
> | claim 済みファイル | 28 | 28 | 127 | **274（全件）** |
> | ゲート未達（生 font-size） | 255 | 243 | 20 | **0** |
> | ページ側見出し規則（§4.9） | 48 | 36 | 5 | **0** |
> | 生 rgba 色調（§2.5） | — | — | 13 | **0** |
>
> `check-surface-coverage` は **`DESIGN_COVERAGE_WARN=1` を付けない限り失敗する**。
> design-1.16 で報告のみにしたのは 244 ファイルが未 claim だったからであって、
> そのままにすれば**このゲートが防ぐべき状態そのものを温存する**ことになる。
> 台帳から `og` 行を外して失敗する（exit 1）ことを確認済み。
>
> **新設 `og` surface（`legacy`）。** OG 画像レンダラは Satori のスタイル
> オブジェクトで 1200×630 の PNG を組む別媒体であり、§4.2 の**網頁**字階
> （12px 下限・7 段）は適用されない。一方 §2.3 の影響度色は参照している。
> `legacy` は「まだ」という正直な申告であり、ゲートは無視する。**不在にしない
> ことが要点**で、不在は「きれい」と読めてしまう。
>
> **`check-surface-coverage` 自身の誤検出を 1 件修正。** `color:` を素で拾って
> いたため、`src/data/projections/ai-adoption.ts` の Zod スキーマ
> （`color: z.string()`）とデータ受け渡し（`color: l.color`）を「設計宣言 3 件」と
> 数えていた。値が**色か寸法に見えること**を条件に加え、あわせて camelCase の
> `fontSize` 等を対象に入れた（OG レンダラは CSS ではないが設計判断ではある）。
>
> **`_index.css` は claim するだけでほぼ無風だった。** design-1.9c が 152 宣言を
> 既に役割で割り当てており、生 `font-size` は 0 件。**ゲートに見えていなかった
> だけで、中身は正しかった。** これは穴の性質をよく表している — 問題は実装では
> なく、実装が検査されていなかったことである。
>
> 残った §4.9 違反は `_index.css` の 1 件だけで、`h1, h2, h3, .dh-title,
> .mobile-hero-title` という**見出しと非見出しが同居する選択器**だった。
> 一括削除はできないので分割した。h3 をここに並べることは §4.4（h3 はサンセリフ）
> と矛盾しており、実際には特異性で正典に負けて死んでいた宣言である。
>
> 視覚回帰（12 ページ × 2 視口）: `/sectors` 14.0% PC / 34.6% SP（高さ −29 / −219）、
> `/haid` 6.0% / 14.2%、`/` 1.2% / 1.7%。`/sectors` はカード内の字号が役割へ
> 収束したもので、**カード枚数は前後とも 32 で不変**。他の 9 ページは footer の
> ビルド時刻ノイズ（119 画素）のみ。

> **正典 v1.2 と、検査器自身の盲点（2026-09-17 / design-1.19）**
>
> 積み残しの正典側を片付ける単位。§20.1 の判定（「今まで通っていたページが CI で
> 落ちるか」）ではすべて追加・明確化のため **MINOR**。§20.2 の 3 箇所を v1.2 に
> 揃え、§20.3 に追記した。
>
> | 変更 | 種別 |
> |---|---|
> | §8.3 に `--sh-sheet` 追加（下端から立ち上がる面） | MINOR |
> | §2.4 に data URI 内の色の例外を明文化（**値の照合付き**） | MINOR |
> | §2.2 規則 7 に `aria-hidden` 装飾グリフの対象外を明文化 | MINOR |
> | §2.2 と「ピルの配色」を `[移行中]` → `[確定]` | PATCH（規則は不変） |
> | §2.4 の実測値を現況へ、§2.2 規則 4 の「現状違反」注記を解消済みに | PATCH |
>
> **`[確定]` の意味を書いておく。** ここでの昇格は「二度と破れない」ではなく
> **「規則・実装・検査の 3 つが揃った」**である。§2.2 は 2026-09-14 に合意済み
> だったが、実装が届かず（46 種の未達）、ゲートもサイト全体に届いていなかった
> （272 ファイル中 28）。両方が揃ったので状態が動いた。
>
> ### 検査器自身の盲点をもう 1 つ見つけた
>
> `stripComments` が `xmlns='http://www.w3.org/2000/svg'` の `//` を行コメントの
> 開始と解釈し、**その行の残りを全部消していた**。data URI を含む行がすべて
> 対象外になっていたということで、実測すると **74 ファイル・313 行**が截断され、
> うち 6 行は URL の後ろに設計宣言を持っていた。
>
> これで**同じ形の欠陥は 4 件目**になる。
>
> | # | 宣言していたこと | 実際 |
> |---|---|---|
> | 1 | §18.7 の page class 所属 | 配線されていなかった（design-1.14） |
> | 2 | `check-contrast` がコントラストを守る | 宣言された役割しか見ていなかった（#552） |
> | 3 | 台帳が surface の範囲を持つ | ゲートが届いていなかった（design-1.16〜1.18） |
> | 4 | `stripComments` がコメントだけを消す | URL の `//` 以降も消していた（本単位） |
>
> **共通するのは「報告が緑なのは、問題が無いからではなく、見えていないから」**
> という形である。4 件とも、規則の側ではなく検査の側の欠陥だった。
>
> ### data URI の条件付き例外
>
> `var()` は data URI の内側で解決されないので、値を書き出すしかない。**しかし
> 書いた値が調色板と一致することは機械的に確かめられる。** `check-color-tokens`
> が照合するようにした（`--fg2` を指す `%237A6F5E` が 4 箇所）。値をわざと
> ずらして `exit 1` を確認済み。
>
> `rel="icon"` の favicon は対象外とした。4 色の方形は**ブランド標識**であり、
> LINE の `#06C755` と同じく調色板に基色を持たない類である。
>
> 視覚回帰（10 ページ × 2 視口）: 全ページで **PC 約 12,000 画素 / SP 約 3,400 画素**
> という**一定量**、高さ変化はゼロ。これは cookie バナーの影の帯そのもので、
> 他は動いていない。

> **描画を読むゲートを CI に戻す（2026-09-17 / design-1.20）**
>
> 「毎回バグが出るのは無限に続くのか」という問いに対する構造的な答え。**続かない。
> 4 件の盲点はすべて同じ原因で、その原因はここで塞がる。**
>
> | 検査器が読んでいたもの | 真実がある場所 | 通り抜けたもの |
> |---|---|---|
> | 宣言された役割 × 背景 | 描画された画素 | コントラスト 46 種（#552） |
> | 宣言された `font-size` | 継承後の計算値 | `<small>` の 11.67px |
> | 台帳の範囲表 | ファイルツリー | 244 ファイル（design-1.16） |
> | テキスト中の `//` | 実際の構文 | 313 行（design-1.19） |
>
> **共通するのは「ソースを読んでいたが、契約は描画についてのものだった」。**
>
> ### 描画を読む層は存在していた。動いていなかっただけである
>
> `tests/e2e/` は 21 spec あり、`a11y.spec.ts` は axe を回す。ところが
> `playwright.config.ts` に「GitHub Actions was removed 2026-05-28, so E2E is not
> part of any automated CI」と書かれていた。**動かない検査は腐る。**
>
> | 実測した腐り方 | |
> |---|---|
> | 47 URL 中 **16 が 404**（ルートから `/ja/` 接頭辞が外れた後、spec が未追随） | a11y は 11 中 **7** が 404 ページを走査していた |
> | axe の `color-contrast` が**無効化されていた** | 「documented edge cases、per-commit blocker ではない」という注記付きで。46 種はここを通った |
> | `compare-duel` が `h1 ≤ 18.5px` を要求 | §4.8 が h1 = 28px にしたのは #526。以後ずっと矛盾していた |
>
> **404 を走査する spec は「合格」する。** 違反が無いのはページが無いからで、
> これは失敗より悪い — 検査していない安全を報告する。
>
> ### 対応
>
> 1. **`_visit.ts`** — 全ナビゲーションが 200 を断言して通る。ルートが動いたら
>    ビルドが落ちる。空振りの合格を**構造的に不可能**にする。
> 2. **`color-contrast` を再有効化。** 設計 pass は #552 で完了し §2.2 は `[確定]`。
>    描画画素を読む唯一の検査を、それを最も必要とする契約の上で切っておく理由がない。
> 3. **`design-contract.spec.ts` 新設** — 16 ページ × 2 視口で §4.2 の 12px 下限を
>    **実測**。ソース走査では原理的に見えない継承・計算値を押さえる。
> 4. **CI に配線**（`.github/workflows/ci.yml`）。これが再発を止める部分である。
>
> ### そこで見つかった実描画の違反 2 件
>
> | | 原因 |
> |---|---|
> | `/haid` の `<small>` 11.67px | UA 既定 0.83em。正典に `html body small` を追加 |
> | `/aiadoption` の軸ラベル 10px | d3-axis が軸グループに `font-size: 10px` を書き、CSS 側で上書きしていなかった。SVG の `<text>` も文字である |
>
> ### 残る 2 件は**製品の判断**であり、数値を緩めて緑にはしない
>
> どちらも `preview` 時点で既に失敗しており、本移行による回帰ではない。
> `test.fixme` で実測値とともに記録した（**`color-contrast` を切ったのと同じ轍を
> 踏まないため、規則の無効化ではなく個別の記録にしてある**）。
>
> | | 実測 | 判断が要る点 |
> |---|---|---|
> | `/shindan` 390 の第 1 問 | Q1 が y=725、最後の選択肢が y=905。第 1 画面は 844 で **61px 超過** | 第 1 問を折り返し上に置くか、前置きを削るか |
>
> ### h1 の欠落は修正した（判断ではなく基準線であるため）
>
> トップページの `<h1 class="dh-title">` は `.desktop-hero` の中にあり、**768px 以下
> では祖先が `display:none`** になる。可視の標題 `.mobile-hero-title` は `<h2>` だった。
> つまり **Google がクロールする視口に、可視の h1 が 1 つも無かった。**
>
> `visual.spec.ts` はもともと正しい形（「各断点に可視の h1 が 1 つ」）を前提に書かれ
> ており、その前提のまま落ち続けていた。`<h2>` → `<h1>` にして解消。§4.8 により
> Feature ページの標題は Display 段なので、SP で 22px → 32px、768px で 40px になる
> （デスクトップの 40px と揃う）。

## surface ごとの対象ファイル

移行担当が最初に開くファイル。ここに無いファイルに手を広げる場合は、その理由を PR に書く。

| surface | 主な対象ファイル |
|---|---|
| `tokens` | `src/lib/design-tokens.ts`（新設）, `src/lib/canonical-css.ts` |
| `feature` | `src/pages/index.astro`, `src/pages/_index.css`, `src/index-source.html`, `src/pages/_index-css.ts`, `src/pages/models.astro`, `src/pages/models/[model].astro`, `src/pages/aiadoption.astro`, `src/pages/_ai-adoption-css.ts`, `src/site/models-built.test.ts`（§19.2 のテスト書き換え） |
| `interactive` | `src/pages/map.astro`, `src/pages/_map-css.ts` |
| `detail` | `src/lib/canonical/detail.ts`, `src/pages/_id-css.ts`, `src/pages/[...id].astro`, `src/pages/_RiskCard.astro`, `src/pages/_StatsGrid.astro`, `src/pages/_JobtagAnchor.astro`, `src/pages/_IdPageScript.astro` |
| `hub` | `src/lib/canonical/hub.ts`, `src/lib/rank-list-css.ts`, `src/templates/Hub.ts`, `src/views/`, `src/pages/rankings/`, `src/pages/compare/`, `src/pages/skills/`, `src/pages/interests/`, `src/pages/answers/`, `src/pages/q/`, `src/pages/yearly/`, `src/pages/abilities/`, `src/pages/careers/`, `src/pages/education/`, `src/pages/employment-types/`, `src/pages/entry-paths/`, `src/pages/explore/`, `src/pages/knowledge/`, `src/pages/licenses/`, `src/pages/life-balance/`, `src/pages/training/`, `src/pages/values/`, `src/pages/work-styles/`, `src/lib/ai-fact-css.ts` |
| `sector` | `src/lib/canonical/sector.ts`, `src/pages/sectors/` |
| `doc` | `src/lib/canonical/doc.ts`, `src/pages/_haid-css.ts`, `src/pages/haid.astro`, `src/pages/standard.astro`, `src/pages/methodology.astro`, `src/pages/about.astro`, `src/pages/data.astro` |
| `static` | `src/lib/canonical/static.ts`, `src/pages/privacy.astro`, `src/pages/compliance.astro`, `src/pages/404.astro` |
| `chrome` | `src/lib/canonical-css.ts`, `src/components/TopNav.astro`, `src/components/Footer.astro`, `src/components/MobileNav.astro`, `src/components/MeEntry.astro`, `src/layouts/BaseLayout.astro` |
| `misc` | `src/pages/shindan.astro`, `src/pages/_shindan-css.ts`, `src/pages/me.astro`, `src/pages/gyakuten.astro`, `src/pages/_gyakuten-css.ts`（すべて Hub class） |
| `og` | `src/lib/og-renderers/` |

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
| 2026-09-20 | canon + `tokens` | **design-1.21（第 2 回レビュー）。** §4.7 に行内強調行、§2.3 `--risk-0` → `#0F8663` + タイル前景列、§5.7 に `/` canvas のオーナー裁定、§21.2 に risk 15 トークン（`canonical-css.ts` の字面宣言から移動）。版番号は据え置き（オーナー裁定）。§20.2 表・§0・台帳ヘッダの版号漂移 3 箇所を是正 |
| 2026-09-20 | `interactive` `og` `feature` | 調色板の硬編碼 7 箇所 → トークン（OG ×2、`/map` 凡例、inline script ×2 は `:root` から読む、`/` 地図プレビュー SVG の fill 31 個）。`/map` のタイル前景は `--risk-fg-N` |
| 2026-09-20 | `feature`（`/`） | canvas treemap: `fmtRisk` を `banker-round.ts` の移植に（556 中 439 タイルが生の浮動小数を表示していた）、ラベルを段別前景色に（白 0.92 は band 2 で 2.18:1）、`:has()` の裏に隠れていた `.num`/`.denom` を削除。375px で 192px はみ出していた 今月の変動 第 2 列を `min-width:0` で収容 |
| 2026-09-20 | 全 surface | §4.7 が `--ink` と定める **82 箇所**を是正（`h1 .accent` 19 / 見出し 24 / `strong`・`em` 25 / 統計 2 / FAQ 1 ほか。`--accent-deep`・`--orange-hot`・`--fg2`・生 hex）。合成斜体 18 箇所を全廃。`.risk-pill` の生 `12px` 角丸 6 箇所 → `--r-md`。movers 文言を「仕事が減るリスク」へ |
| 2026-09-20 | ゲート | `check-role-color` 新設・`verify:gates` へ接続。§4.7 の役割 → トークンを CSS 実装と照合（`check-contrast` の残り半分） |
