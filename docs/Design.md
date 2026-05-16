# Design.md — mirai-shigoto.com デザイン仕様（PC + 共有基盤）

> 当サイト **PC 版 + クロスデバイス共有基盤** デザインの唯一の正典 (single source of truth)。
> PC 側の視覚 / インタラクション / レスポンシブ動作の変更は、**まず本ファイルを更新**、コードは追従する。
> コードと本ファイルが矛盾した場合、**本ファイルが優先**。コードは修正されるべき逸脱とみなす。
>
> **モバイル版（≤768px）専用仕様は [Design-Mobile.md](./Design-Mobile.md)**: モバイル hero、tooltip touch-mode、モバイルレスポンシブ規則、`/map` 独立ページ。共通 token / テーマ / ブレークポイント / treemap 視覚 / 共通コンポーネントは本ファイル、モバイルファイルは参照経由で再利用する。
>
> **v1.4.0 以降 JA-only アーキテクチャ**: 英語 UI は廃止。すべての `/en/*` URL は vercel.json により 301 → `/ja/*` リダイレクト。索引、詳細、sector hub、`api/og.tsx`、`llms.txt` 全てが日本語単一言語に縮減。原データは `data/_archive/translations-en/` に保管（将来の復旧用）。
>
> **v1.2.0 以降 単一 URL アーキテクチャ**: v1.1.0 で導入された `/m/ja/*` 系統は全廃、モバイル体験はメイン URL `/ja/<id>` に統合、CSS `@media` で自動応答。Direction C デザイン言語は PC にも合流（視覚 + 文言）、詳細は §0.1 / §0.2。廃止された `MOBILE_DESIGN.md` は 2026-05-06 削除（v1.1.0 で廃止された `/m/*` アーキテクチャの遺物、4 ヶ月間 active 参照ゼロ）。

---

## 0. 適用範囲

本ファイルが規定する **「ある UI が定義済みかどうか」「変更可能か」「どの値が canonical か」** は、以下のページに対して有効：

- [`src/pages/index.astro`](../src/pages/index.astro) — トップページ treemap（PC 段；モバイル段は Design-Mobile.md §3）
- [`src/pages/about.astro`](../src/pages/about.astro)、[`privacy.astro`](../src/pages/privacy.astro)、[`compliance.astro`](../src/pages/compliance.astro)、[`404.astro`](../src/pages/404.astro)（既存の静的ページ、PC + 共有）
- [`src/pages/ja/[id].astro`](../src/pages/ja/[id].astro) によって build される 556 個の職業詳細ページ `ja/<id>.html`（v1.4.0 以降 JA-only；PC 段；モバイル段は Design-Mobile.md §3）
- 16 個の hub ページ（[`ja/sectors/*`](../src/pages/ja/sectors/)、[`ja/skills/*`](../src/pages/ja/skills/)、[`ja/abilities/*`](../src/pages/ja/abilities/)、[`ja/knowledge/*`](../src/pages/ja/knowledge/)、[`ja/values/*`](../src/pages/ja/values/)、[`ja/work-styles/*`](../src/pages/ja/work-styles/)、[`ja/training/*`](../src/pages/ja/training/)、[`ja/life-balance/*`](../src/pages/ja/life-balance/)、[`ja/education/*`](../src/pages/ja/education/)、[`ja/employment-types/*`](../src/pages/ja/employment-types/)、[`ja/entry-paths/*`](../src/pages/ja/entry-paths/)、[`ja/licenses/*`](../src/pages/ja/licenses/)、[`ja/careers/*`](../src/pages/ja/careers/)、[`ja/rankings/*`](../src/pages/ja/rankings/)、[`ja/compare/*`](../src/pages/ja/compare/)、[`ja/interests/*`](../src/pages/ja/interests/)、[`ja/q/*`](../src/pages/ja/q/)、[`ja/explore/*`](../src/pages/ja/explore/)、[`ja/yearly/*`](../src/pages/ja/yearly/)）

> **`map.html`**（モバイル先行の独立職業マップページ）の完全な仕様は [Design-Mobile.md §4](./Design-Mobile.md#4-map-ページ仕様mobile-first-独立ページ) にある。PC で `/map` にアクセスした際は同じレイアウトを再利用（max-width 900px センター揃え）。

> 現行設計は v0.4.x シリーズに端を発し、PC 版の現バージョンは v1.x（§15 改訂履歴を参照）。

### 0.1 Design-Mobile.md との分担

2026-05-06 より、単一の Design.md を 2 つの peer ファイルに分割。「デバイス専用 vs 共有基盤」の軸で役割を分けた：

| ファイル | 何を管理するか |
|---|---|
| **Design.md**（本ファイル） | PC 専用 + クロスデバイス共有基盤（カラー token / フォント / 間隔 / テーマ / ブレークポイント / treemap 視覚 / 共通コンポーネント / PC hero / インタラクション動効 / アクセシビリティ / palette ガイドライン） |
| **[Design-Mobile.md](./Design-Mobile.md)** | モバイル専用（`@media (max-width: 768px)` 以下）：Mobile Hero (Variant C)、Tooltip touch-mode、モバイルレスポンシブ規則、`/map` 独立ページ |

**共有内容は Design.md にしか出現しない**。Design-Mobile.md は参照経由で再利用、token / テーマなど共有基盤が二箇所同期される問題を避ける。

クロスデバイスコンポーネント（同じコンポーネントが両端で異なる挙動を取るもの）：本ファイルは desktop の挙動 + 共有視覚を記述、モバイルの挙動は Design-Mobile.md の対応セクションを参照。例：
- Tooltip: 本ファイル §6.1 (Desktop hover) + §6.4 (viewport overflow、共有) / Design-Mobile.md §2 (touch-mode 全体)
- Hero: 本ファイル §7.12 (Desktop) / Design-Mobile.md §1 (Mobile)
- レスポンシブ: 本ファイル §4 (ブレークポイント定義) / Design-Mobile.md §3 (モバイル各段階の詳細規則)

以降の minor / major 調整は、各ファイルの末尾「改訂履歴」にパッチ形式で追加する。

---

### 0.2 現在の世代状態（2026-05-13 Phase A 導入）

> **これは本ファイル全体の読み方の前提**。各章を読む前にまず本セクションを読むこと。

過去 12 ヶ月で、サイトのビジュアル設計は 3 世代の進化を経た。**仕様は長らく Gen 1 のみを記述しており**、§2 カラー token、§3 テーマシステム、§2.4 wrapper 1400px などのセクションは実装と乖離していた。本セクションは「現在の真実」と「歴史 / 監査待ち」の境界を明示する。以降の各章は 🟢 LIVE / ⚠️ Gen-3 監査待ち / 🔴 DEPRECATED のステータスタグを掲示する。

#### 0.2.1 世代対照テーブル

| 世代 | 時期 | ビジュアル方向 | 命名規約 | 現在の去就 |
|---|---|---|---|---|
| **Gen 1** | v0.4.x – v1.0.x | Dark + Light デュアルテーマ、中性グレー + アンバー `#ffb84d / #d97706` | `--bg / --fg / --accent` 短名 | 🔴 DEPRECATED。仕様の §15.LEGACY のみに保存 |
| **Gen 2** | v1.1.0 – v1.2.0 | Direction C: Warm Editorial 単一テーマ、cream + terracotta + sage | `--m-color-*` 長プレフィックス | 🔴 DEPRECATED。[`styles/mobile-tokens.css`](../styles/mobile-tokens.css) は consumer ゼロ、Phase C で削除予定 |
| **Gen 3** | v1.2.0 – 現在 | 単一テーマ Warm Editorial + 語義トークン | `--cream / --ink / --orange / --green-deep` **主**、`--bg / --fg / --accent` **alias** として保持 | 🟢 LIVE。リファレンス実装: [`src/pages/ja/_id-css.ts`](../src/pages/ja/_id-css.ts)（commit a9f6ed79 で抽出） |

#### 0.2.2 軸別ステータス

| 軸 | ステータス | 詳細 |
|---|---|---|
| ビジュアル方向（配色 / 字体 / 編集風格） | 🟢 LIVE: Gen 3 — Direction C: Warm Editorial 単一テーマ | §1, §2 |
| デュアルテーマ切替 | ⚠️ NEUTRALIZED: `data-theme` no-op、切替ボタン `display:none` | §3 |
| Token 命名 | 🟢 LIVE: 2 層構造 — 語義 + alias | §2.1 |
| 旧 Gen 1 dark+amber token / 1400px wrapper / システムフォント規範 | 🔴 DEPRECATED | §15 LEGACY 表 |
| 旧 Gen 2 `--m-*` プレフィックス token | 🔴 DEPRECATED | §18.3 で禁止明示 |
| スタイル帰属アーキテクチャ（誰が token を宣言し、誰が組み立てるか） | 🟢 LIVE (Phase A 新増) | §18 |
| §5 Treemap 視覚 | ⚠️ Dark 配色関数経路 deprecated、Light 経路 LIVE、完全監査は Phase B 待ち | §5 |
| §6.1 Desktop hover tooltip | ⚠️ 監査待ち: treemap は `/map` 独立ページに移行、desktop hover tooltip が今もアクティブか要検証 | §6.1 |
| §7 共通コンポーネント | 🟢 LIVE: §7.10 footer (v1.3.x) / §7.12 desktop hero / §7.13 follow+share / §7.14 404 は最新かつ最もクリーンな契約 | §7 |

#### 0.2.3 Gen 1 規範と Gen 3 実装の実質差異

| 次元 | Gen 1 規範の主張 | Gen 3 実装の現実 |
|---|---|---|
| 背景色 | `--bg: #0b0d10 (dark) / #fafafa (light)` | `--bg: #FAF6EE`（単一テーマ） |
| アクセントカラー | `--accent: #ffb84d / #d97706`（アンバー） | `--accent: #D96B3D`（テラコッタ） |
| フォント方針 | 「システムフォント優先、web フォント不導入」 | Google Fonts (Noto Serif JP + Plus Jakarta Sans) + ローカル Hiragino Mincho |
| Wrapper max-width | desktop 1400px | desktop 1080px |
| カード radius | 8px（`--radius-card`） | 12-14px（transfer / topn / radar） |
| テーマ切替 | 三態（system / light / dark）+ 可視 toggle | 単一テーマ + toggle `display:none` |
| 命名方針 | 短名のみ（`--bg/--fg/--accent`） | 語義名 primary + alias 保持の 2 層 |

#### 0.2.4 本仕様を引用する際のルール

1. **🟢 LIVE タグのある節のみを「今動いている標準」として直接引用可能**
2. **⚠️ タグの節は Phase B で監査される。引用前にコードと照合し、コードの値を採用すること**
3. **🔴 タグの節は歴史記録、新規コードでは決して引用しない**
4. ステータスが不明確なセクションを引用しなければならない場合、必ず実装ファイル（`_id-css.ts` など）で値を検証し、本仕様にフィードバック PR を出す

---

## 1. コア原則

各原則は以下の構造で記述する：**原則** → **なぜ**（過去の事案 / 根拠）→ **どこに適用するか** → **やらないこと**（アンチパターン例）。

### 1.1 自己診断パス優先、ただしデータはブランド資産

**原則**：第一画面は、不安型トラフィックに対し最短の検索エントリーポイント（検索ボックス + ホットチップ）を提供する。ユーザーは 1 ステップで自分の職業詳細ページに到達できる。treemap はサイトの視覚的差別化資産として、2 画面目（モバイル）または同画面下半部（PC）に保持される。

**なぜ**：2026-04 の X Ads 第 1 回ラウンドで 491 link clicks の流入があったが、サイト内クリック率は 7.1% に留まった。診断：ユーザーは「自分の職業はどうなるか？」を聞きに来ているのに、サイトは「探索型 552 職業地図」体験を強要していた。展示型から問い合わせツールへの昇格が必要だった（§7.12 desktop hero、§7.13 follow+share 統一の根拠）。

**視覚重量配分**：
- 検索 hero ─ 視覚焦点を占める
- treemap ─ ブランドコアとして残るが、補助的役割に降格
- 周辺要素（タグ / 説明 / フッター）─ 二次レベルに退く

**やらないこと**：
- ❌ 検索ボックスを treemap より下に配置する
- ❌ 統計パネル（stats panel）で第一画面を占有する
- ❌ "treemap が美しいから上に置きたい" という審美論で IA を覆す

### 1.2 デュアルテーマは装飾ではない（⚠️ NEUTRALIZED 状態）

**原則（Gen 1）**：light / dark は両方とも一級市民、すべてのコンポーネントが両配色下で美しくなければならない。**システム追従**をデフォルト、ユーザーが明示的に切替えたら localStorage で永続化。

**現状（2026-05-13）**：v1.2.0 で Direction C: Warm Editorial 単一テーマに合流したため、本原則は **⚠️ NEUTRALIZED** 状態にある。実装上は `data-theme` を no-op に強制、切替ボタンを `display:none` で隠している。**しかし原則自体は仕様として保持**：dark mode を将来再開する際の硬性条件（§3.3）として機能する。

**なぜ保持するか**：すべての新規コンポーネントが「将来 dark mode が戻った場合に壊れない構造」で書かれることを保証するため。具体的には：
- 色は必ず token（`var(--ink)` 等）経由で指定、`color: #241E18` のような hardcode 禁止
- `color: #fff` のように白を直書きせず `color: var(--paper)` を使う

**やらないこと**：
- ❌ 「単一テーマだから token を使う必要はない」とハードコード値を書く
- ❌ Gen 1 仕様の `--bg: #0b0d10` を Gen 3 コードで使う

### 1.3 モバイル優先 ≠ モバイル専用

**原則**：設計は PC（≥768px）では「データ密度高め」で提示、モバイル（<768px）では「重要情報の可読性」を保証する。両端ともポリッシュ完了が必要。

**なぜ**：v1.1.0 で `/m/*` URL アーキテクチャを設けたが、PC 体験との分裂で運用コストが膨れ、メイン URL に合流した（v1.2.0、§15）。「モバイル専用 URL」「PC 専用 URL」の分離は維持コストが品質向上を上回る。

**適用**：
- ブレークポイントは §4 に定義された 5 段階のみを使用
- 768px は JS `isMobile = window.innerWidth < 768` と CSS `@media (max-width: 768px)` が同期する境界
- 同じコンポーネントが PC で「データ密度高」、モバイルで「タッチ最適化」表現を取る場合、本仕様 / Design-Mobile.md にそれぞれ記述

**やらないこと**：
- ❌ 「モバイル UA だけ別レイアウト」を JS で分岐させる
- ❌ 768px 以外の新ブレークポイントを勝手に導入（§4 改定 PR が先）

### 1.4 暖色 = 高リスク、寒色 = 低リスク（視覚意味契約）

**原則**：当サイトの視覚意味契約。**反転不可**。色覚配慮モード（viridis）は代替案であって、意味の方向を変えるものではない。

**なぜ**：treemap は AI risk score を主要ビジュアルメッセージとして伝える。暖色 = 危機 / 緊張、寒色 = 安心 / 落ち着き は西洋・東洋とも文化跨ぎで通じる強い暗黙シグナル。これを反転すると視覚的読解負荷が跳ね上がる。

**実装**：
- `greenRedCSSLight` 関数（[`src/data/lib/treemap-colors.ts`](../src/data/lib/treemap-colors.ts)）が t=0 から t=1 へ green → orange → red を出力
- Risk pill / band は `--green-deep` (low) / `--orange / --orange-hot` (mid-high) / `--red` (extreme) を使う

**やらないこと**：
- ❌ AI risk 0-2 を赤系で表示
- ❌ AI risk 9-10 を緑系で表示
- ❌ 色覚配慮 toggle で「青 = 高リスク」を許容

### 1.5 変更は必ず Design.md を先に動かす

**原則**：コード上の一時実験は「設計」にはカウントしない。本ファイル記述の状態が採択された時点で初めて正式設計とみなす。

**なぜ**：過去複数回、コードに先行して導入された「実験的」CSS が事実上の標準と化し、後から仕様を追従させる順序で 4 つの token 語彙系が同時並行する状況になった（§0.2 参照）。**仕様を先に動かす**ことで、token / 命名 / 値の決定主導権を本ファイルに保持する。

**適用フロー**：§14 で詳細記述。要約：

1. 同 PR 内で本ファイルとコードを同時修正
2. 視覚レイヤー変更は before/after スクリーンショット（≥768 + ≤480 各 1 枚）を添付
3. §15 改訂履歴に 1 行追記

**やらないこと**：
- ❌ コードだけ修正して仕様を「あとで更新する」と保留
- ❌ Slack / Notion / 別ドキュメントで「事実上の標準」を作る
- ❌ Phase A で生成された `_id-css.ts` のような実装ファイルを spec の代替とする（§18.2 はあくまで実装、§2.1 が本物）

### 1.6 Token は 2 層、新コードは語義名のみ（Phase A 新増原則）

**原則**：すべての視覚 token は §2.1 第 1 層（語義名、`--cream / --ink / --orange / --green-deep` 等）と第 2 層（alias 短名、`--bg / --fg / --accent` 等）の 2 層で管理する。

- **新規コード**は **第 1 層語義名のみ** を使う
- **既存コード**（hub ページ inline `:root`、footer partial、`canonical-css.ts` の render-function selectors）は alias を保持
- 第 2 層 alias の RGB 値は第 1 層語義の同名色と **厳密には等しくない**（歴史値、§2.1 警告）。「整える」目的で統一しない

**なぜ**：Gen 2 → Gen 3 過渡期に 4 つの token 語彙が並存（Gen 1 短名、Gen 2 `--m-*`、Gen 3 語義名 + alias）。各 hub ページが独自の :root を写し直したため、ピクセル単位の漂移が発生（`--fg2: #7A6F5E` vs `--ink-3: #8a7a6a` の差など）。alias 層を「歴史値の凍結」として明示することで、新規コードを汚染せずに段階的移行を実現する。

**やらないこと**：
- ❌ 新コンポーネントで `var(--bg2)` を使う（`var(--paper)` を使う）
- ❌ 「`--fg2` と `--ink-2` が違うのは混乱するから統一しよう」と alias の RGB を変更する → footer / hub ページの視覚崩壊
- ❌ Gen 2 の `--m-color-*` プレフィックスを新コードで使う

---

## 2. デザイントークン

**ステータス：** 🟢 LIVE (Gen 3) — 2026-05-13 Phase A で全面書き直し。Token は **2 層構造**: 語義色板 (primary) + alias 短名 (legacy + クロスページ共通)。

### 2.1 カラー

#### 第 1 層 — 語義色板（primary、新コードはこれのみを使う）

命名はカラーの**語義役割**を表現する（背景 / 文字といったレイアウト役割ではない）。新規コンポーネントは必ずこの層のみを参照する。

| Token | 値 | 用途 |
|---|---|---|
| `--cream`        | `#FAF6EE` | メインキャンバス、ページ背景 |
| `--cream-2`      | `#F2EADB` | 次次サーフェス、TL;DR カード底、top-banner 凹み |
| `--paper`        | `#FFFFFF` | 浮上サーフェス（radar / FAQ / transfer / topn / ai-risk-detail カード） |
| `--ink`          | `#241E18` | プライマリ文字、見出し |
| `--ink-2`        | `#5a4a3a` | 本文段落、definition |
| `--ink-3`        | `#8a7a6a` | 三次文字、breadcrumb、副情報、tc-meta |
| `--ink-4`        | `#b0a090` | プレースホルダ、aria-hidden セパレータ |
| `--orange`       | `#D96B3D` | プライマリ accent、CTA、risk-high pill、risk 7-8 数字 |
| `--orange-hot`   | `#c0411e` | section h2、topn h3、risk 9-10 数字、faq `b` 強調 |
| `--orange-soft`  | `#fce4d2` | one-line callout 底色 |
| `--green`        | `#5fa050` | sector chip 底色、risk 0-2 数字 |
| `--green-deep`   | `#48705F` | 暖背景上の見出し色、topn h3 (transfer 段)、ai-task h3 |
| `--red`          | `#c95a3a` | risk 9-10 数字 最深档 |
| `--purple`       | `#8b5fb0` | 予備色、現時点 [`_id-css.ts`](../src/pages/ja/_id-css.ts) で宣言済みだが未使用 |
| `--purple-soft`  | `#ddd5fb` | 予備 |
| `--line`         | `rgba(36,30,24,0.06)`  | 細セパレータ（dotted、faq-answer border-top） |
| `--line-strong`  | `rgba(36,30,24,0.12)`  | 強セパレータ、org-cert-block border、map-back-link border |

#### 第 2 層 — Alias 短名（legacy + クロスページ共通、新コードは原則使わない）

Gen 2 時期に 16 個の hub ページが inline で写した token 名、および footer partial / `canonical-css.ts` の render-function selectors が依拠している短名。`_id-css.ts` と将来の `canonical-tokens.css` で **必ず第 1 層にマッピング**（または歴史固定値を保持）する。

| Alias | 等価 / 値 | 用途 |
|---|---|---|
| `--bg`          | `--cream` (`#FAF6EE`)            | body 背景 |
| `--bg2`         | `--paper` (`#FFFFFF`)            | カード / surface |
| `--bg3`         | `--cream-2` (`#F2EADB`)          | top-banner / 凹み |
| `--fg`          | `--ink` (`#241E18`)              | プライマリ文字 |
| `--fg2`         | `#7A6F5E`                        | 副文字 — **歴史値、`--ink-2` と厳密には不等** |
| `--fg3`         | `#A39785`                        | 三次文字 — 同上、`--ink-3` と厳密には不等 |
| `--accent`      | `--orange` (`#D96B3D`)           | プライマリ accent |
| `--accent-2`    | `#6E9B89`                        | sage — 歴史値、`--green` と近いが RGB 異なる |
| `--accent-deep` | `--green-deep` (`#48705F`)       | 暖背景上の見出し |
| `--border`      | `rgba(36,30,24,0.10)`            | デフォルト surface border — 歴史値、`--line-strong` と異なる |

> **重要警告**：`--fg2 / --fg3 / --accent-2 / --border` の具体 RGB は語義層の同類名 token と **厳密に等しくない**。これは Gen 2 → Gen 3 過渡期の残滓で、本番ページと footer partial に既デプロイ済み。**「整える」目的で統一してはならない**、サイト全体の色が微妙に変化する。新規コンポーネントは第 1 層語義名を直接使い、根本から alias を回避する。

#### 編集ルール

1. **新コンポーネント CSS**: **第 1 層のみ** を参照（`--cream / --ink / --orange / --green-deep` 等）
2. **クロス hub 共通コンポーネント**（footer / breadcrumb / カード基底 / `canonical-css.ts` footer）: alias を使ってよい（既にデプロイされた契約）
3. **alias の等価マッピング変更**：本セクションの表を更新 + 全リポ grep で整合確認 + `pnpm run check:seo-baseline` の baseline diff 検証
4. **新色の導入**：まず第 1 層に追加、必要に応じて alias を補う
5. すべての token は `styles/canonical-tokens.css`（Phase C で作成予定）に統一して宣言。page-local CSS は token を参照するのみで、`:root{}` で再宣言しない（§18 を参照）

#### 既知の色漂移問題

以下は本仕様策定時点（2026-05-13）で確認されている、現行コードに存在する色漂移：

| 漂移箇所 | 内容 | 解決 |
|---|---|---|
| 16 hub ページの inline `:root{}` | 各ページが Gen 2 短名 + cream 値を独自に複写 | Phase D で各 hub ページが `_*-css.ts` に抽出される際、`:root{}` ブロックを削除し canonical token を引く |
| `about.astro` / `privacy.astro` / `compliance.astro` の `:root` ブロック | `@media (prefers-color-scheme: light)` + `[data-theme]` の二重宣言が残存、いずれも cream 値に強制 (dead code) | Phase D で削除、§3 ニュートラライズに合致させる |
| `font-feature-settings:"palt"` 不統一 | sectors / rankings の body に存在、skills / compare に無し | Phase D で `canonical-tokens.css` に統一宣言（CJK パワー字幅、本文段落に統一適用） |
| カード border 色不統一 | `var(--border)` (`rgba(36,30,24,0.10)`) と `rgba(0,0,0,0.04)` が混在 | 新コードは `--line-strong` 統一、既存は Phase D で監査 |

#### Treemap 配色関数

> **ステータス**：⚠️ Dark 経路 deprecated（`data-theme` は §3 で neutralized）、Light 経路 LIVE。完全監査は Phase B 待ち（`greenRedCSSDark` が現在も参照されているか / 削除可能か検証）。下表は参考として保持。

| テーマ | 関数 | t=0 アンカー | t=0.5 アンカー | t=1 アンカー |
|---|---|---|---|---|
| Dark（🔴 dead-code 疑い） | `greenRedCSSDark` | `rgb(30, 180, 40)` 森林緑 | `rgb(230, 160, 20)` アンバー | `rgb(255, 30, 15)` 鮮紅 |
| Light（🟢 LIVE） | `greenRedCSSLight` | `rgb(15, 195, 105)` 鮮翠 | `rgb(235, 115, 25)` 焼橙 | `rgb(235, 40, 55)` 鮮紅 |

`t` は `boostContrast(clamp(t))` で処理された正規化リスクスコア（0=低リスク、1=高リスク）。

#### Treemap 透明度（baseAlpha）

| 状態 | Light（LIVE） |
|---|---|
| Dimmed（検索 miss） | 0.18 |
| Hover | 1.0 |
| 通常 | 0.95 |

> Light モード alpha は高く（≥0.85）保つ必要がある — 白底が低 alpha を「洗い流す」ため、対比階層が崩壊する。

---

### 2.2 タイポグラフィ

**ステータス：** 🟢 LIVE (Gen 3) — Gen 1 の「システムフォント優先、web フォント不導入」方針は撤回された。

#### フォントスタック

```css
--font-serif: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", Georgia, serif;
--font-sans:  "Plus Jakarta Sans", "Hiragino Sans", -apple-system,
              BlinkMacSystemFont, "Yu Gothic UI", "Segoe UI", Roboto, sans-serif;
```

- **macOS / Windows ではローカルフォント優先**：Hiragino Mincho ProN / Yu Mincho（OS 同梱、ネットワーク待ち時間ゼロ）
- **その他環境では Google Fonts**：Noto Serif JP + Plus Jakarta Sans を [`BaseLayout.astro:99-102`](../src/layouts/BaseLayout.astro:99) で読込、weight 400/500/600/700 を各 2 ファミリーロード
- **`<head>` で preconnect**：`fonts.googleapis.com` / `fonts.gstatic.com` への TCP/TLS をパースと並行で温める

#### なぜ Mincho serif

Direction C: Warm Editorial の根幹。serif は本サイトの「編集的 / 出版的 / 厚みのある」トーンを担う。具体的に：
- 見出し（h1 / section h2 / topn h3）
- 本文段落（section.context / how-to-become / working-conditions / ai-risk-detail）
- transfer-card 名称、faq summary、topn item 名称
- TL;DR （definition）以外の長文要素

sans-serif（Plus Jakarta Sans）は **データ表示 + 補助情報** に限定：
- stat dt / dd
- breadcrumb
- meta-row（sector chip / risk band）
- footer chip
- TL;DR definition（短い宣言文）

#### フォントサイズ標準（[`_id-css.ts`](../src/pages/ja/_id-css.ts) 実装基準）

| 用途 | 値 | 実装箇所 |
|---|---|---|
| h1 | `clamp(1.9rem, 1.5rem + 1.4vw, 3.2rem)`、weight 700、letter-spacing -0.015em、line-height 1.06 | `_id-css.ts:62` |
| h1 .h1-sub | 0.66em（h1 相対）、color `--ink-3`、weight 500 | `_id-css.ts:64` |
| section > h2 | mobile 1.1rem / ≥900 1.5rem、serif、weight 700、color `--orange-hot` | `_id-css.ts:124` |
| topn h3 | mobile 0.92rem / ≥900 1rem、serif、color `--orange-hot` | `_id-css.ts:161` |
| 本文段落（serif） | mobile 0.92rem / ≥900 1rem、line-height mobile 1.85 / ≥900 1.95、color `--ink-2` | `_id-css.ts:131` |
| TL;DR / definition（sans） | mobile 0.85rem / ≥900 0.92rem、weight 500 | `_id-css.ts:134` |
| breadcrumb | 0.74rem、sans、color `--ink-3` | `_id-css.ts:53` |
| meta-row | 0.78rem、color `--ink-3` | `_id-css.ts:67` |
| stat dd（数値） | mobile 1.2rem / ≥900 1.65rem、weight 800、letter-spacing -0.02em | `_id-css.ts:118` |
| stat dt（ラベル） | mobile 0.7rem / ≥900 0.78rem、color `--ink-3`、weight 400 | `_id-css.ts:116` |
| risk-card 数字 | mobile 2.4rem / ≥900 3.2rem、weight 900、letter-spacing -0.04em | `_id-css.ts:79` |
| topn item | 0.82rem | `_id-css.ts:164` |
| footer chip | 0.78rem（詳細は §7.10） | `partials/footer.html` |
| footer-meta | 0.7rem（≤540: 0.66rem） | `partials/footer.html` |

#### Line-height

- 本文 / intro（serif）：mobile 1.85 / ≥900 1.95（CJK 長文の可読性確保）
- カード / 緊密テキスト（sans）：1.6 - 1.65
- 見出し：1.06 - 1.45

#### Letter-spacing

- h1：-0.015em（タイトル詰め）
- stat dd：-0.02em（数値詰め）
- risk-card 数字：-0.04em（大数字詰め）
- mono / uppercase ラベル：0.05 - 0.08em（広げ）
- 本文 / 段落：default（0）

#### `font-feature-settings`

- **本文段落（CJK 長文）**: `"palt"` を適用 → 約物パワー字幅でレイアウト緊密化
- **データ表示の数値**: `font-variant-numeric: tabular-nums` を必ず指定（列揃え）

#### やらないこと

- ❌ web フォントを 2 ファミリー以上追加する（現在 Noto Serif JP + Plus Jakarta Sans 上限）
- ❌ Mincho serif の代わりに Gothic / sans を見出しに使う（編集的トーンが崩壊）
- ❌ 本文段落で sans を使う（TL;DR の definition だけが例外）
- ❌ 数値列で `tabular-nums` を忘れる（揃わずに気持ち悪い）

---

### 2.3 間隔 & 角丸

**ステータス：** 🟢 LIVE (Gen 3) — [`_id-css.ts`](../src/pages/ja/_id-css.ts) 実装基準。Gen 1 の `--radius-card: 8px` は廃止。

#### 内部 padding

| 次元 | mobile | ≥640 | ≥900（desktop） | 実装箇所 |
|---|---|---|---|---|
| カード padding（標準） | `14px 16px`（transfer / topn） | — | `20px 22px`（transfer）、`22px 24px`（stats） | `_id-css.ts:128,159,176,114` |
| カード padding（narrow card / wide content） | `18px 20px`（section.context 系） | — | `28px 32px`（narrow card 系） | `_id-css.ts:128` |
| topn-block padding | `16px 18px` | — | `20px 22px` | `_id-css.ts:159` |
| stats > div padding | `14px 16px` | — | `22px 24px` | `_id-css.ts:114` |

#### Section 間隔

| マージン | mobile | ≥900 |
|---|---|---|
| section margin-top | 26px | 44px |
| section > h2 margin-bottom | 12px | 18px |

#### Grid gap

| Grid | mobile gap | ≥640 gap | ≥900 gap |
|---|---|---|---|
| stats grid | 10px | 16px | 16px |
| transfer-grid | 8px | 12px (≥768) | 12px |
| topn-grid | 14px | — | 18px |
| org-cert-grid | 14px | 18px (≥768) | 18px |

#### 角丸

| サイズ | 値 | 用途 |
|---|---|---|
| sm | 10px | one-line callout 右上 / definition / cert-list li |
| md | 12px | transfer-card / topn-block / org-cert-block / faq-item / デフォルトカード |
| lg | 14px | radar-wrap / ai-risk-detail / topn-block (≥900) / stats > div (≥900) / risk-card |
| pill | 999px | sector-chip / band / map-back-link / footer chip |
| 部分角丸 | `0 10px 10px 0` | one-line callout（左側に強調帯を視覚的に作る） |

#### 影

| 名前 | 値 | 用途 |
|---|---|---|
| カード（軽） | `0 1px 0 rgba(0,0,0,0.03), 0 6px 18px rgba(120,80,30,0.04)` | radar-wrap / topn-block / ai-risk-detail / section.context 系 / faq-item |
| transfer hover | `0 1px 0 rgba(0,0,0,0.03), 0 12px 28px rgba(217,107,61,0.10)` | transfer-card:hover/focus-visible |
| stats カード | `0 4px 12px rgba(120,80,30,0.04)` | dl.stats > div |
| risk-card | `0 4px 14px rgba(201,90,58,0.08)` | プライマリ risk 数字カード |
| 404 CTA hover | `0 4px 14px rgba(217,107,61,0.28)` | .cta-primary:hover（§7.14） |

#### Border

- デフォルト surface：`--line-strong` (`rgba(36,30,24,0.12)`)
- カード軽 border：`rgba(0,0,0,0.04)`（transfer / topn / radar / ai-risk-detail / faq-item）
- transfer-card hover：`rgba(217,107,61,0.30)`（`--orange` の 28% alpha）
- 強調 surface：**Gen 1 の「3-4px 実心左条」は廃止**。`0 10px 10px 0` 部分角丸で左上角を直角にすることで視覚的等価表現に置換

#### やらないこと

- ❌ カード radius に 8px を使う（Gen 1 値、新規は 12 / 14px）
- ❌ カードに左帯 `border-left: 4px solid var(--accent)` を新たに付ける（廃止された Gen 1 パターン）
- ❌ 影を 3 重以上重ねる（パフォーマンス + 美的に過剰）

---

### 2.4 レイアウト寸法

**ステータス：** 🟢 LIVE (Gen 3) — Gen 1 の 1400px wrapper は廃止。

```
#wrapper max-width:
  mobile (default):   480px
  ≥640px:             640px
  ≥900px (desktop):   1080px

#wrapper padding:
  mobile: env(safe-area-inset-top,12px) 18px env(safe-area-inset-bottom,24px)
  ≥640:   18px 24px 32px
  ≥900:   24px 32px 48px

読み物エリアの narrow card max-width: 820px
  適用: section.context / section.how-to-become / section.working-conditions /
        ai-risk-detail / radar-wrap / faq-list
  desktop (≥900) 内で margin-left:auto / margin-right:auto により中央配置
```

#### iOS safe-area

`env(safe-area-inset-top,12px)` / `env(safe-area-inset-bottom,24px)` で iOS のノッチと home indicator を回避する。標準を `12px / 24px` に設定し、safe-area が無い環境でも自然な padding になる。

#### 16 hub ページの不整合

hub ページ（sectors / skills / compare / rankings 等 16 個）の `#wrapper max-width: 980px` は Gen 2 歴史値で、本セクションの 1080px とは異なる。**Phase D で各ページが `_<name>-css.ts` に抽出される際、1080px に統一する**。

#### やらないこと

- ❌ 1400px wrapper を使う（Gen 1、廃止済み）
- ❌ desktop で 1080px を超える要素幅（フルブリードのインスタを除く、それは別途宣言）
- ❌ narrow card 中で 820px を超える本文（CJK 可読性の上限）

---

## 3. テーマシステム

**ステータス（2026-05-13）：** ⚠️ NEUTRALIZED — Gen 2（v1.2.0）以降、Direction C: Warm Editorial は**単一テーマ**。`data-theme` 属性は no-op、テーマ切替ボタンは [`_id-css.ts:45`](../src/pages/ja/_id-css.ts:45) で `display: none !important` により非表示。Gen 1 の三態テーマモデルは廃止。本セクションは現在の実際の挙動 + 将来 dark mode を復活する際の硬性条件を記述する。

### 3.1 実際の挙動（LIVE）

`prefers-color-scheme` および `[data-theme="light/dark"]` セレクタは CSS 上で **強制的に同一の cream 配色に解決される**。[`_id-css.ts:40`](../src/pages/ja/_id-css.ts:40) を参照：

```css
:root[data-theme="light"],:root[data-theme="dark"]{
  --bg:#FAF6EE;--bg2:#FFFFFF;--bg3:#F2EADB;
  --fg:#241E18;--fg2:#7A6F5E;--fg3:#A39785;
  --accent:#D96B3D;--accent-2:#6E9B89;--accent-deep:#48705F;
  --border:rgba(36,30,24,0.10)
}
```

効果：ユーザーが何を選んでも、ページは常に Warm Editorial cream で表示される。

### 3.2 保持された scaffold（LIVE だが効果なし）

- [`BaseLayout.astro:75-84`](../src/layouts/BaseLayout.astro:75) には no-flash inline script があり、`localStorage.theme` を読んで `<html>` に `data-theme` 属性を書き続ける — 表示には影響しない、将来の dark variant のために残してある
- 一部ページに切替ボタン DOM が残るが、すべて `display: none !important` で非表示
- GA4 `theme_change` イベントは **fire しない**（可視 UI がないため）

### 3.3 将来 dark mode を復活する際の硬性条件（PLANNED）

dark mode を再起動する場合、以下の条件を **回避不可**：

1. §2.1 第 1 層に dark バリアント token を追加：`--cream-dark / --ink-on-dark / --orange-on-dark` 等。**`--bg / --fg` alias の値は変更しない**
2. `prefers-color-scheme: dark` および `[data-theme="dark"]` の CSS rule で alias マッピングを dark コンテキスト用に再構築（alias を dark token にマップ）
3. Treemap canvas で `greenRedCSSDark` 関数を再有効化（現在 dead code 疑い、§2.1 参照）
4. `_id-css.ts:45` の `display: none` を削除、GA4 `theme_change` イベント配線を復活
5. すべてのページの `_*-css.ts` を同期更新（hub ページの抽出が終わってからでないと dark mode 再起動できない）

### 3.4 切替ボタン仕様（🔴 非表示、Gen 1 歴史として保持）

以下の仕様は参照用。現在は **レンダリングされない**。§3.3 の経路を通って dark mode が復活した場合、この仕様に従って実装する：

- 位置：`<h1>` 内の `.lang-switch` 直前
- 形状：32×32 円形（`border-radius: 999px`）、内に 14×14 SVG アイコン
- アイコン：light モードは 🌙（icon-moon）、dark モードは ☀（icon-sun）
- Hover：`color: var(--accent)`, `border-color: var(--accent)`
- Focus：`outline: 2px solid var(--accent); outline-offset: 2px`

### 3.5 やらないこと

- ❌ 新コードで `@media (prefers-color-scheme: dark) { ... }` を書く（dead branch、ノイズになる）
- ❌ 既存ページ（about / privacy / compliance）の `@media (prefers-color-scheme: light) { ... }` を残す — Phase D で削除
- ❌ 「いつか dark mode が戻るから」と二重宣言を新規追加（§3.3 の正規ルートで戻す）

---

## 4. レスポンシブブレークポイント

**ステータス：** 🟢 LIVE — Gen 1 から変わらない。

| ブレークポイント | 名称 | 適用対象 |
|---|---|---|
| `≥768px` | desktop | PC、タブレット横向き |
| `≤768px` | mobile | スマホ横向き / タブレット縦向き |
| `≤540px` | small-mobile | 通常スマホ縦向き |
| `≤480px` | compact-mobile | やや狭いスマホ |
| `≤360px` | tiny-mobile | iPhone SE 第 1 世代等 |

### 4.1 JS / CSS 同期境界

JS 内の `isMobile = window.innerWidth < 768` と CSS の `@media (max-width: …)` は **768px の境界で同期する**。両者の境界がズレると、JS で「PC」と判定した状態で CSS は「mobile」を当てる事故が発生する。

### 4.2 ブレークポイントを追加するルール

新ブレークポイントを導入する場合：

1. 本セクションを先に更新（PR で）
2. 全コード（CSS + JS）の `@media` / `window.innerWidth` を grep して整合確認
3. 新ブレークポイントが意味する設計判断（何が変わるか）を §3.x または Design-Mobile.md §3 に記述

### 4.3 やらないこと

- ❌ 1 つのコンポーネントのために独自ブレークポイントを宣言（例：`@media (max-width: 612px)`）
- ❌ JS で `window.innerWidth < 700` のような中途半端な境界判定

---

## 5. Treemap 視覚化

**ステータス：** 🟢 LIVE（共有視覚契約） + ⚠️ Dark 経路 deprecated（§2.1）。完全監査は Phase B 待ち。

### 5.1 高さ比率

| デバイス | 高さ = 幅 × n |
|---|---|
| Desktop（≥768px） | **w × 1.05** |
| Mobile（<768px） | w × 2.6 |

- Desktop 1.05 は 552 個の tile のうち小 tile が職業名を表示できる縦の余裕を確保するため
- Mobile 2.6 は画面が狭く縦展開が必要なため

### 5.2 ラベル可視閾値

| 閾値 | Desktop | Mobile |
|---|---|---|
| `labelMinW` | 50px | 30px |
| `labelMinH` | 18px | 14px |
| `subInfoMinW`（副情報） | 70px | 50px |
| `subInfoMinH` | 32px | 26px |
| `fontMin` | 9px | 8px |
| `fontMax` | 13px | 12px |

### 5.3 Tile 文字色

- メインラベル：`rgba(255,255,255,0.92)`（hover 時は `#fff`）
- 副情報（risk score）：`rgba(255,255,255,0.55)`

> Light モードで白文字 × 濃色 tile はいけている（alpha=0.95 で底色が濃いから）。**黒文字に変えてはならない** — dark モードとの視覚一貫性が崩れる。

### 5.4 Hover 枠

`strokeStyle: "#fff"`, `lineWidth: 2`, hover tile の周囲に描画（両テーマ共に白）。

### 5.5 Canvas 背景

- Light（LIVE）：`#FAF6EE`（`--cream` と同値、シームレス接続）
- Dark（🔴 deprecated）：`#0b0d10`（参考、現在は使われない）

### 5.6 GAP（tile 間隔）

`GAP = 1px`（半 px を tile 両側に振る）、tile 間の視覚的明瞭な分離を保証。

### 5.7 やらないこと

- ❌ Tile 文字色を黒に変える
- ❌ Canvas 背景を `--paper` (#FFFFFF) にする（cream とのシームレスが崩れる）
- ❌ GAP を 2px 以上にする（tile 数が多いと画面が斑模様になる）

---

## 6. Tooltip

### 6.1 Desktop（hover-mode）

> **ステータス**：⚠️ 監査待ち — treemap が `/map` 独立ページに移行したため、本セクションが今もアクティブか要検証（Phase B）。

```
position:    fixed
background:  var(--paper)
border:      1px solid var(--line-strong)
radius:      8px
padding:     14px 16px
font-size:   0.92rem
line-height: 1.55
max-width:   400px
shadow:      0 8px 32px rgba(36,30,24,0.16)
opacity transition: 0.12s
pointer-events: none  /* hover モードはクリック不可 */

.tt-title {
  font-weight: 600
  font-size:   1.06rem
  color:       var(--ink)
  margin-bottom: 8px
}
```

### 6.2 Mobile（touch-mode）

> **本ファイルから移出済み**。Mobile tooltip の全挙動（touch-mode 入口、tap-outside、close button、CTA、touch ステートマシン）は [Design-Mobile.md §2](./Design-Mobile.md#2-mobile-tooltip-行為) を参照。

### 6.3 Tap-outside 挙動（Mobile）

> [Design-Mobile.md §2.2](./Design-Mobile.md#22-tap-outside-行為) 参照。

### 6.4 ビューポートはみ出し処理

JS は `window.innerWidth` / `innerHeight` に応じて tooltip 位置を動的調整し、ビューポートを超えないようにする。詳細は `index.html` 内 `positionTooltip()` ロジック（v0.4.2 で導入）。

> 本セクションは desktop / mobile 共有ロジック、本ファイルに保持。

### 6.5 Close button（`.tt-close`）タッチターゲット

> [Design-Mobile.md §2.3](./Design-Mobile.md#23-close-button-tt-close-觸摸目標) 参照。

### 6.6 Tooltip CTA（`.tt-cta`）

> [Design-Mobile.md §2.4](./Design-Mobile.md#24-tooltip-cta-tt-cta) 参照。

### 6.7 Touch 挙動契約（scroll vs tap）

> [Design-Mobile.md §2.5](./Design-Mobile.md#25-touch-行為契約scroll-vs-tap) 参照。定数 `TAP_SLOP_PX = 10` / `TAP_MAX_MS = 500` は §7.12 desktop hero search autocomplete のタッチステートマシンでも再利用、全サイトで統一。

---

## 7. コンポーネント仕様

各コンポーネントは以下の構造で記述：**何のためか** → **DOM 構造** → **トークン参照** → **状態（hover / focus / disabled）** → **やらないこと**。

### 7.1 Top Banner（先頭の「非公式」警告バー）

**ステータス：** 🟢 LIVE（一部ページ。404 ページには **表示しない**、§7.14 参照）。

```
background: linear-gradient(90deg, rgba(255,80,80,0.18), rgba(255,138,61,0.14))
border-bottom: 2px solid rgba(255,80,80,0.55)
padding:    9px 20px (≤480: 8px 12px)
font-size:  0.82rem (≤480: 0.74rem)
gap:        12px (≤480: 8px)

.badge {
  background: #ff5050  /* high-risk-marker、§2.1 の語義色版に未統合の歴史値 */
  color:      #fff
  padding:    3px 10px
  radius:     4px
  font-size:  0.74rem
  font-weight: 800
  letter-spacing: 0.08em
  shadow:     0 1px 4px rgba(255,80,80,0.3)
}
```

**やらないこと**：
- ❌ Banner 内に複数行の文章を入れる（1 行で読み切れる長さに留める）
- ❌ Banner を 404 ページに表示（§7.14、CTA との視覚競合）

### 7.2 Stats Panel（統計パネル）

```
grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))
gap: 12px → 8px (≤480) → 6px (≤360)
≤480: 強制 repeat(2, 1fr)
≤360: 強制 1fr（1 列）
```

### 7.3 Stat Block

```
background:  var(--paper)
border:      1px solid rgba(0,0,0,0.04)
radius:      12px (mobile) / 14px (≥900)
padding:     14px 16px (mobile) → 22px 24px (≥900)
shadow:      0 4px 12px rgba(120,80,30,0.04)

.stat-label (dt) { font 0.7rem (≥900: 0.78rem), color var(--ink-3), weight 400 }
.stat-value (dd) { font 1.2rem (≥900: 1.65rem), weight 800, color var(--ink), letter-spacing -0.02em }
.stat-sub        { font 0.72rem (≤480: 0.68rem), color var(--ink-3) }
```

**「ラベル下に値」順序**：DOM 順序は dd（値）→ dt（ラベル）、CSS で `order:1`/`order:2` を使って **視覚上は値が上、ラベルが下**（数値を視覚的フォーカスに）。

### 7.4 Meta Card（データソースブロック）

- 左側 `0 10px 10px 0` 角丸 + `--orange` 部分背景でアクセント（Gen 1 の「3px 左帯」は廃止）
- `grid-template-columns: max-content 1fr`（≤768 は `1fr` に）
- meta-label 大文字 + letter-spacing
- 色契約：label = `var(--ink-3)`、value = `var(--ink)`、link = `var(--orange)`

### 7.5 Disclaimer

**注意**：Gen 1 の `border-left: 4px solid var(--accent)` は廃止された。Gen 3 では one-line callout パターンに置換（§7.5b 参照）。

#### 7.5b One-line Callout（Gen 3 統一パターン）

```
margin:        0 0 16px
padding:       13px 16px (≥900: 16px 18px)
background:    var(--orange-soft)  /* #fce4d2 */
border-left:   3px solid var(--orange)
border-radius: 0 10px 10px 0  /* 左上角を直角にして左帯を視覚化 */
font-size:     0.92rem (≥900: 1rem)
line-height:   1.6
color:         var(--ink)
font-weight:   500

b {
  color: var(--orange-hot)
  font-weight: 800
}
```

### 7.6 Layer Toggle（色覚配慮 chip グループ）

- デフォルト flex-wrap、desktop で横並び
- ≤768：`flex-wrap: nowrap; overflow-x: auto`（横スクロール）
- ≤480：再び `flex-wrap: wrap`（複数行に。スクロールはやりすぎ）
- 選択状態：`border-color: var(--orange); color: var(--orange)`

### 7.7 Gradient Legend（左低リスク → 右高リスク）

- 高さ 8px、幅は容器に追従
- gradient：`linear-gradient(to right, low-risk-color, mid, high)`
- 左右にラベル：`低リスク` / `高リスク`

### 7.8 Share Buttons（フッターソーシャル共有）

```
size:    32×32 (≤540: 36×36 — タッチターゲット拡大)
shape:   円形（radius 999px）
icon:    16×16 SVG, fill: currentColor
default: var(--paper) bg, var(--ink-3) icon

hover（各プラットフォームブランド色オーバーライド）:
  X:        #000
  LINE:     #06C755
  Hatena:   #00A4DE
  LinkedIn: #0A66C2
  Facebook: #1877F2
  Copy / Native: var(--orange), color #1a1206
```

### 7.9 Skip Link

```
.skip-link {
  position: absolute; left: -9999px;
  background: var(--orange); color: #000;
  padding: 8px 14px;
  z-index: 100;
  on focus → left: 8px; top: 8px
}
```

### 7.10 Footer

**サイト全体統一仕様（v1.3.x 以降 — 2 行 chip + footer-meta の 3 層構造）**：footer は **ナビゲーション chip 行 + 法務 / 規約 chip 行 + footer-meta** の 3 層構造、全サイト（index / about / compliance / privacy / 404 / 556 detail / 17 sector / 9 ranking）で **完全一致**。

**単一情報源（v1.3.x patch — partial アーキテクチャ）**：footer の HTML 実体は 8 箇所のコピペ（5 静的 HTML + 3 Python ジェネレータ）を 1 ファイル `partials/footer.html` に収束。footer 変更の唯一のやり方：

1. `partials/footer.html` を編集
2. `npm run build:footer`（= `python3 scripts/build_partials.py`）を実行 — 5 静的ページの `<!-- FOOTER:START --> ... <!-- FOOTER:END -->` マーカー間が置換される
3. `npm run build`（build:footer / build:occ / build:sectors / build:rankings を含む）を実行 — 587 生成ページが `FOOTER_PARTIAL = (REPO / "partials" / "footer.html").read_text()` で partial を直接読み、対応位置にレンダリング

**静的ページのマーカー間で footer を手修正しない**、次の build で上書きされる。**build スクリプト内に footer HTML をハードコードしない**、必ず `{FOOTER_PARTIAL}` で挿入する。

#### 版面

```html
<footer>
  <div class="footer-links">          <!-- 第 1 行：ナビ chip（pill 角丸 border） -->
    <a href="/">トップ</a>
    <a href="/ja/sectors">セクター</a>
    <a href="/ja/rankings">ランキング</a>
  </div>
  <div class="footer-links">          <!-- 第 2 行：法務 / 規約 chip -->
    <a href="/about">データについて</a>
    <a href="/compliance">コンプライアンス</a>
    <a href="/privacy">プライバシー</a>
  </div>
  <div class="footer-meta">           <!-- 第 3 層：版数 / 出典 / 免責（小文字） -->
    v1.3.0 · MIT<br />
    出典：厚生労働省・<span class="nowrap">独立行政法人 労働政策研究・研修機構（JILPT）</span><br />
    <em>※ 本サイトは独自分析サイトであり、<br />厚生労働省・job tag・JILPT の<span class="nowrap">公式見解ではありません</span>。<br />詳細は <a href="/compliance">コンプライアンス</a> ページをご確認ください。</em>
  </div>
</footer>
```

#### chip スタイル

```css
footer .footer-links {
  display: flex; flex-wrap: wrap; gap: 8px;
  justify-content: center; align-items: center;
  margin-bottom: 14px;
}
footer .footer-links a {
  color: var(--fg2);   /* alias: 歴史値 #7A6F5E */
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.78rem;
  text-decoration: none;
  transition: color 150ms, border-color 150ms, background 150ms;
}
footer .footer-links a:hover {
  color: var(--accent);   /* = --orange */
  border-color: var(--accent);
  background: rgba(217,107,61,0.06);
}
footer .footer-meta { color: var(--fg2); font-size: 0.7rem; line-height: 1.65; opacity: 0.92; text-wrap: pretty; }
footer .footer-meta a { color: var(--accent); }
footer .footer-meta .nowrap { white-space: nowrap; }
@media (max-width: 540px) {
  footer .footer-meta { font-size: 0.66rem; line-height: 1.6; word-break: keep-all; overflow-wrap: anywhere; }
}
```

#### リンク契約（v1.3.x 以降 — 厳密 2 行 6 chip ルール + GitHub 完全切断）

- ✅ **全サイト全ページ**（index / 404 / about / compliance / privacy / 556 detail / 17 sector / 9 ranking）：**ちょうど 2 行 6 chip**
  - 第 1 行：`トップ / セクター / ランキング`（ナビ 3 件セット）
  - 第 2 行：`データについて / コンプライアンス / プライバシー`（法務 / 規約 3 件セット）
- ✅ **footer-meta**：`v1.3.0 · MIT` + 出典 + 独立分析サイト免責声明 + コンプライアンスリンク（全サイト完全一致、compliance.html 自身の自己参照リンクも含む）
- ❌ **禁止**：追加 chip 一切。index にあった「変更履歴 / Changelog」と sector hub にあった「算出方法 / Methodology」は v1.2.2 で削除済み。旧 4 chip 単行版本は v1.3.x で退役
- ❌ **禁止**：サイト内のいかなる `<a href="https://github.com/...">` — 全サイト GitHub リンク完全切断（footer-meta の `MIT` リンク、JSON-LD の `sameAs`、content body の GitHub Issues 参照、llms.txt / llms-full.txt 内の source code 参照、make_prompt.py が生成する prompt files 全て含む）；`MIT` は footer-meta で純テキストに
- ✅ **自己参照 chip は意図的**：`/about` / `/compliance` / `/privacy` ページの footer は自身に対応する chip を表示（一貫性を「自己リンク無し」より優先）、クリックでカレントページがリロード

#### 理由

- 旧 3 / 4 chip 単行版本はナビ（トップ）と法務（コンプライアンス）を 1 行に混ぜていた、視覚重みが不明瞭。ユーザーフィードバック「footer もサイトナビゲーション口にすべき」
- 「ナビ + 法務」2 行分割後、第 1 行が detail ページからのサイト戻り口を担う、第 2 行は法務 / 規約本職に専念
- pill chip は border + padding で各リンクに独立 hit area + 視覚容器を与え、hover ハイライトが個別 chip 単位で明確
- footer-meta は全ページで「版数 + 出典 + 独立分析免責 + コンプライアンスリンク」の 4 件セットに統一、各ページの disclaimer 内容飛散を防止。ユーザーフィードバック「すべてのページの footer は全く同じであるべき」
- GitHub リンク除去は「非公式」banner 除去と同一波のクリーンアップ：開発者向け要素をビジター主路から剥離

### 7.11 Mobile Hero（Variant C, mobile-only）

> **本ファイルから移出済み**。Mobile Hero 完全仕様は [Design-Mobile.md §1](./Design-Mobile.md#1-mobile-hero-variant-c-mobile-only) 参照。Chip 名簿は本ファイル §7.12 desktop hero と同一セット（事務職 / 経理 / 営業 / カスタマーサポート / 看護師）、いずれかの変更は両端で同期。

---

### 7.12 Desktop Hero（Stage 1, search-first）

PC（≥769px）専用第一画面 hero ブロック。mobile（≤768px）では `display: none`、モバイルは §7.11（Design-Mobile.md §1）を継続使用。

**目的**：サイトを「探索型 552 職業地図サイト」から「自己診断型 AI 影響度クエリツール」へ転換、不安型トラフィックに最短のクエリ入口を提供。

**構造**（DOM 順、上から下へ）：

1. `.desktop-hero-utility` — トップ小ユーティリティバー：サイト brand 副文「日本の職業 AI 影響マップ (非公式)」+ lang switch + theme toggle（`#themeToggleDesktop`）。font 0.8rem、max-width 1400 コンテナ内に置く
2. `h2.dh-title` — 「あなたの仕事はAI 時代にどう変わる？」H2 大見出し、「AI 時代」を `var(--orange)` 着色、font `clamp(1.7rem, 1.2rem + 1.2vw, 2.4rem)`、weight 700
3. `.dh-lead` — 3 行説明：「職業名を入力すると、AI による影響度と変化しやすい作業を確認できます。 / 転職、リスキリング、キャリアの見直しの参考に。」font 0.95rem、max-width 540px
4. `.desktop-hero-search` — 検索フォーム：入力欄（`#searchInputDesktop`）+「AI 影響度をチェック」ボタン、max-width 560px
5. `.search-suggest` — 入力時のリアルタイム下プルダウン候補（top 8）：各 `<li>` は職業名 + AI 影響度を表示、ソート順は (exact match → starts-with → contains → length asc)。キーボード ↑↓ + Enter で選択可、マウスクリックで遷移
   - **先頭候補自動ハイライト（v1.3.1, P0-B）**：render() 時に第 1 候補が自動的に `.focused` クラスを付与（`focusedIdx = 0`）、ユーザーは Enter を打ち終わるだけで **↓ を押さなくても** 第 1 候補に遷移できる。`rankMatches` は「正確 → 前置 → 包含 + 名称長 asc」の 3 層ソート、第 1 候補のヒット率が最高
   - **キーボードヒント行（v1.3.1, P0-C）**：dropdown 上部に `.ss-hint` 非インタラクティブ行を挿入、文言「↑↓ で選択 · Enter で開く」。`matchMedia("(hover: none) and (pointer: coarse)")` が false（非タッチデバイス）時のみレンダリング、タッチデバイスは緊密にヒント無し。`pointer-events: none` でヒントが click/keyboard で選ばれないことを保証、keydown / mousedown は `li[data-job-id]` セレクタでこれをスキップ
   - **タッチ tap-vs-scroll ステートマシン（v1.3.1, P0-D F2）**：mobile で `touchstart` は起点 + タイムスタンプを記録するのみ（`{ passive: true }`、`preventDefault` **しない**、ブラウザネイティブスクロールに渡す）、`touchend` で変位と継続時間を計算。変位 < 10px **かつ** 時間 < 500ms で tap とみなす → `navigateToJob` を発火、それ以外はスクロール / 長押しとみなす → no-op。定数 `TAP_SLOP_PX = 10` / `TAP_MAX_MS = 500` は [Design-Mobile.md §2.5](./Design-Mobile.md#25-touch-行為契約scroll-vs-tap) canvas タッチステートマシンと一致（同一閾値セットを全サイト適用）。Desktop 挙動は変えない、`mousedown` で即時 `selectFromEvent`
   - **iOS キーボード適応高さ（v1.3.1, P0-D F1）**：iOS Safari の `100vh` はキーボード起動時に **縮まない**（既知挙動）、結果 `max-height: 360px` の dropdown がキーボードに半分隠れる。`fitDropdownToViewport()` は `window.visualViewport` API で `resize` / `scroll` を監視、`suggestEl.style.maxHeight` を `visualViewport.height - inputBottom - 12px` に動的設定、下限 160px。Focus 時にも 1 回呼び、初回オープン時の貼り付きを保証。`visualViewport` がない古いブラウザは CSS デフォルト max-height にフォールバック
   - **スクロール期間中は非表示にしない（v1.3.1, P0-D F3）**：iOS では dropdown に指が触れると `<input>` がフォーカスを失い、150ms blur-hide がスクロール途中で dropdown を閉じてしまう。`touchActiveOnDropdown` フラグを追加：touchstart で true、touchend 350ms 後に false。Blur-hide はこのフラグをチェック、true の時は隠さない。350ms 窓は navigateToJob の遷移完了をカバー
6. `.desktop-hero-popular-label` + `.desktop-hero-chips` — 5 個の固定 chip（§7.11 と共通）：**事務職 / 経理 / 営業 / カスタマーサポート / 看護師**

**Desktop 挙動**（`min-width: 769px`）：`.desktop-hero { display: block }`。同時に **旧** `#wrapper > header > h1` / `.controls` / `.dimension-hint` / `.search-row` を非表示（これらは hero に置換されたが、DOM は SEO / アクセシビリティのために残す、`display: none`）

**Mobile 挙動**（`max-width: 768px`）：`.desktop-hero { display: none }`、モバイルは [Design-Mobile.md §1](./Design-Mobile.md#1-mobile-hero-variant-c-mobile-only) `.mobile-hero` を継続使用

**インタラクション契約（1 ステップ直達）**：

- 入力欄 typing → `applyFilter()` ライブで treemap をハイライト + リアルタイム dropdown 候補レンダリング
- Enter / 「AI 影響度をチェック」ボタンクリック → top match の `/ja/<id>` に遷移
- chip クリック → `CHIP_TO_JOB` マッピングで対応職業詳細ページに遷移：
  - `事務職 → 一般事務` (id=428)
  - `経理 → 経理事務` (id=430)
  - `営業 → 営業事務` (id=431)
  - `カスタマーサポート → コールセンターオペレーター` (id=64)
  - `看護師 → 看護師` (id=156, 完全一致)
- dropdown li クリック / キーボード Enter → 対応 `/ja/<id>` に遷移
- マッチ無し → 遷移せず、`.search-noresult`「該当する職業が見つかりません」を表示

**GA4 イベント**：
- `popular_job_click` — chip → 詳細ページ遷移
- `job_search_typed` — ユーザーが入力して 800ms 一時停止（v1.3.1 以前は `job_search_submit` だったが、「視覚フィルタ意図」と「遷移意図」の 2 種ユーザーを混合計測しており、CTR 分母が汚染。本イベントは「人気検索ワード / データ欠落」統計用に保持、**CTR 分母として使わない**）
- `job_search_intent` — ユーザーが autocomplete に対し明示的な遷移意図を示す。発火源 `intent_source` は 4 種：`submit`（Enter / ボタン）、`arrow_keys`（↑↓）、`hover`（マウスホバー ≥ 500ms）、`click`（mousedown / touchstart）。各クエリで 1 回だけ重複排除
- `job_search_navigate` — 実際に `/ja/<id>` に遷移（Enter / button / suggest item）
- **本物の検索 CTR = `job_search_navigate` ÷ `job_search_intent`**（v1.3.1 以降、2026-05-06 P0-A）

**chips 名簿は v1**：§7.11 と共通の 5 chips、片方の変更は両端で同期。GA4 データ安定（2-3 週間）後に top-clicked / top-searched で置換するべき

---

### 7.13 Footer Follow + Share（Stage 1、全サイト統一）

トップページ + 556 個の `/ja/<id>` 詳細ページが **統一** で同じ footer follow + share ブロックを使用（v1.4.0 以降 JA-only）。視覚 2 層：

1. **Follow CTA（突出）**：オレンジブロック `.follow-cta`、リンク `https://x.com/miraishigotocom`
   - 内容：📬 icon +「X でフォローする / 毎日の職業分析を受け取る」
   - GA4 イベント：`x_follow_click`（詳細ページは `occupation_id` パラメータ付き）
2. **Share divider**：「このページをシェア」— 横線 + 中央テキスト
3. **Share buttons row（小アイコン）**：6 個の円形 32×32（mobile 36×36）ボタン
   - X / LINE / Hatena / LinkedIn / **Facebook（Stage 1 新増）** / Copy
   - **Native**（`navigator.share()`）はサポートデバイスのみ表示（デフォルト hidden）
   - 各 hover は対応プラットフォームブランド色（X #000 / LINE #06C755 / Hatena #00A4DE / LinkedIn #0A66C2 / Facebook #1877F2 / Copy var(--orange)）
   - GA4 イベント：`share_click`、パラメータ `platform`、`language`、`occupation_id`（詳細ページ）

**UTM 契約**：すべての share URL は `?utm_source=<platform>&utm_medium=<social|im|copylink|share_api>&utm_campaign=footer_share&utm_content=site|occ` を必ず付ける

### 7.14 404 エラーページ（`/404.html`）

Vercel 静的デプロイは未マッチルートで root `/404.html` を返し HTTP 404 を発する。本ページはサイト最終フォールバック、Direction C ビジュアル言語の継承 + 4-tracker analytics + JA-only を必須とする。

**他静的ページとの差異**：本ページは §7.1 top-banner を **挂けない**。理由：404 着地ユーザーは URL を間違えたため、「素早く本道に戻す」誘導が必要であって、ブランド disclaimer ではない。banner の赤高対比ブロックは大文字 404 と視覚を奪い合い、ページがシステムエラーに「私たちも非公式です」免責が積み重なる読み心地になり、情報階層が混乱する。

**版面**：

```
（top-banner 無し）

#wrapper { max-width 560px; margin: 0 auto; padding 28px 28px 80px; }
  .top-bar （← マップへ戻る ｜ theme-toggle）

  .four-oh-four
    font-family: var(--font-serif)         /* Hiragino Mincho / Yu Mincho / Noto Serif JP */
    font-size:   clamp(5rem, 18vw, 9rem)
    font-weight: 700
    line-height: 0.9
    letter-spacing: -0.04em
    color:       var(--ink)
    margin:      24px 0 4px

    .four-oh-four .accent  /* 中央の "0" */
      color: var(--orange)
      font-style: italic
      display: inline-block
      transform: translateY(-4%) rotate(-6deg)   /* 編集的傾き、テンプレ感の回避 */

  h1.title { 1.4rem · serif · weight 600 · margin-bottom 8px }
  p.subtitle { 0.95rem · color var(--ink-3) · margin-bottom 24px }

  .cta-primary  /* プライマリ CTA、トップへ */
    display:        inline-flex
    align-items:    center
    gap:            8px
    background:     var(--orange)
    color:          #fff
    padding:        12px 22px
    border-radius:  6px
    font-weight:    600
    font-size:      0.95rem
    text-decoration: none
    transition:     transform 150ms ease, box-shadow 150ms ease
    hover:          transform translateY(-1px); box-shadow 0 4px 14px rgba(217,107,61,0.28)

  .helpful-links     /* 二次リンクリスト */
    margin-top:    32px
    border-top:    1px solid var(--line-strong)
    padding-top:   18px
    a              { color var(--ink) · border-bottom 1px solid var(--line-strong) · padding 10px 0 · display block }
    a:hover        { color var(--orange) · border-bottom-color var(--orange) }

  footer  /* about.html フッターと同じ */
```

**再利用**：§7.10 footer 簡略版（全サイト統一）

**再利用しない**：§7.1 top-banner（本セクション「他静的ページとの差異」参照）、share buttons（404 は共有されるべきでない）、follow CTA（プライマリ CTA との視覚競合回避）

**SEO**：
- `<meta name="robots" content="noindex, follow">` — エラーページはインデックス対象外
- `<link rel="canonical">` 設定しない
- `lang="ja"` デフォルト
- 4-tracker analytics 引き続き付与（`feedback_analytics_consistency.md` 参照）

**文言**：
- 大字 `404` → h1「ページが見つかりません」→ 副「指定された URL は存在しないか、変更された可能性があります。」
- プライマリ CTA：「トップへ戻る →」 → `/`
- 二次リンク 4 個：データについて (`/about`) · 利用規約 (`/compliance`) · プライバシー (`/privacy`) · お問い合わせ (`mailto:privacy@mirai-shigoto.com`)
- 検索ボックスは置かない（トップに既存、二重入口で希釈を避ける）

**dev-server**：`scripts/dev-server.py` は cleanUrl 書換後の存在チェック後、存在しない path に対し `404.html` の内容 + HTTP 404 でフォールバック（Vercel 挙動のミラー）

---

## 8. モバイル端自適規則まとめ

> **本ファイルから移出済み**。モバイルレスポンシブ規則全套（≤768 / ≤480 / ≤360 / ≤540 各段階詳細）は [Design-Mobile.md §3](./Design-Mobile.md#3-移动端响应式规则汇总) 参照。本ファイル §4 はブレークポイントの **定義** のみを保持（768 / 480 / 360 / 540 閾値）、各段階で具体的に何をするかは Design-Mobile.md に委ねる。

---

## 9. インタラクション & モーション

### 9.1 トランジション

- テーマ切替ボタン（隠れているが規格保持）：`transition: color 150ms ease, border-color 150ms ease`
- Tooltip 表示 / 隠し：`opacity 0.12s`
- Tile hover：CSS トランジションなし（canvas 直接再描画）
- transfer-card hover：`transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease`
- footer chip hover：`color 150ms, border-color 150ms, background 150ms`
- faq-item summary::after rotate：`transform 200ms ease, color 200ms ease`

### 9.2 Hover 挙動

- リンク：`text-decoration: underline` または dotted → solid border-bottom
- ボタン：色を `var(--orange)` に
- Tile：白枠 + alpha 上昇
- transfer-card：`transform: translateY(-2px)` + border-color を `--orange` 30% alpha に
- faq-item summary：`color: var(--orange)`

### 9.3 Focus 挙動（キーボードアクセシビリティ）

- すべての button / link 既定：`:focus-visible` で `outline 2px solid var(--orange)`、`offset 2px`
- 例外：カスタム chip 型ボタンは border 色変化で outline を代替してよい（視覚フィードバックは必須）

### 9.4 Reduced Motion

- 現在 `prefers-reduced-motion` の明示監視は無し。すべての transition <200ms は許容範囲
- **将来拡張**：>300ms のアニメーションを追加する場合、`@media (prefers-reduced-motion: reduce)` で必ず無効化
- `/map` ページの bottom sheet 入場アニメ（280ms、§Design-Mobile.md §4.5）は **既に reduced motion 対応**

---

## 10. アクセシビリティ

- **コントラスト**：light モード fg/bg コントラスト比 ≥4.5:1（WCAG AA）、fg2/bg2 ≥3:1
- **タッチターゲット**：≤540px ですべての button ≥36×36px（モバイル share-btn は順守済み）。tooltip close button は 44×44 hit area（§Design-Mobile.md §2.3）
- **言語マーク**：すべてのテキストブロックに適切な `lang` 属性（v1.4.0 以降 JA-only なので、ページレベル `lang="ja"` で十分）
- **可視 focus**：すべてのインタラクティブ要素 `:focus-visible` で可視フィードバック
- **スキップリンク**：ページ先頭の `.skip-link` で `#main` にジャンプ
- **色のみに頼らない情報伝達**：treemap ラベルは risk 数字（`9/10` 等）を同時表示、色だけに依存しない
- **色覚配慮モード**：`色覚配慮` toggle で viridis palette に切替（青 → 青緑 → 緑 → 黄）

---

## 11. アセット / アイコン

- **テーマ切替（隠れている）**：inline SVG（`icon-sun` / `icon-moon`）、14×14
- **Share buttons**：inline SVG、各プラットフォーム 1 個 16×16 icon
- **アイコンフォント / icon library を導入しない**（ペイロードと開発体験のため）
- **favicon**：inline SVG（4 色 treemap-tile）、[`BaseLayout.astro:189-192`](../src/layouts/BaseLayout.astro:189) に data: URL でハードコード
- **OG card**：`api/og.tsx`（Satori JSX）で動的生成、`?page=home` / `?page=map` / `?page=ranking` / `?occupation_id=<id>` で分岐

---

## 12. フォントサイズ / カラー / 間隔の使用ガイドライン

- **マジックナンバーを使わない**：ある数値を ≥3 回再利用するなら token（CSS 変数または JS 定数）に昇格
- **未リスト色を導入しない**：新色が必要な場合（新コンポーネント）、必ず §2.1 第 1 層に追加
- **単位を混用しない**：コンポーネント内 padding / font / radius は px / rem を使い、em は避ける
- **inline `style=""` を書かない**（デバッグ以外）

### 12.1 token を増やす判断基準

新 token を追加する前に、以下を確認：

1. 既存 token で代用できないか？（よくある追加：`--ink-2` と `--ink-3` の差異が必要 → 既にある）
2. 値が再利用される頻度（≥3 回が目安）
3. 命名は語義役割を表現しているか？（「主背景」「カード底」ではなく「cream」「paper」）
4. alias 層に追加する必要があるか？（hub ページの inline `:root` で参照する場合のみ）

### 12.2 数値リテラルの直書き許容

以下は token 化せずに直書きしてよい：

- 単発の `padding: 1px 0` のような小調整
- アニメ keyframes 内の中間値
- 1 つのコンポーネントでしか使われない specific 値

token 化が **必要** な例：
- 色 → 必ず token
- 主要間隔（card padding、section margin） → token
- フォントサイズ刻度 → token
- 角丸スケール → token

---

## 13. Treemap palette 変更ガイドライン

`greenRedCSSLight` のアンカーを修正する際：

1. §2.1「Treemap 配色関数」表を必ず同期更新
2. 検証必須：低リスク / 中リスク / 高リスクの 3 段が light モードで視覚的に明確に区別できる
3. 推奨サンプル：
   - 低リスク（大量従事者、通常緑系領域）
   - 中リスク（オレンジ系領域）
   - 高リスク（赤系領域）
4. light モード alpha=0.95 は `#FAF6EE` 背景との契約、アンカー調整なしに alpha だけ変更しない

---

## 14. 本ファイルの変更フロー

1. PR 説明に「本変更は Design.md §X.Y に関係」を明記
2. 同一 PR 内で Design.md とコードを同時修正（片方だけの修正は許可しない）
3. 視覚レイヤー変更は before/after スクリーンショット添付（≥768 + ≤480 各 1 枚）
4. §15 改訂履歴に追加：日付 / 該当章 / 一文の理由
5. token / 命名変更の場合：`pnpm run check:seo-baseline` を実行し、baseline を必要に応じて refresh

---

## 15. 改訂履歴

| 日付 | 章節 | 変更 | 理由 |
|---|---|---|---|
| 2026-05-01 | — | 初版起草 | v0.4.x 既存設計を正式仕様として固化 |
| 2026-05-01 | §2.1 | Light treemap アンカーを明るく | ユーザーフィードバック「コントラスト不足、彩度を上げて」：緑 `(0,140,75)` → `(15,195,105)`；赤 `(200,35,45)` → `(235,40,55)`；橙微調整 `(230,110,20)` → `(235,115,25)` |
| 2026-05-01 | §6.1 | Tooltip サイズ拡大 | 0.82rem / 360px は PC で小さく読みづらく、0.92rem / 400px に変更。title は 0.95→1.06rem、hardcode `#fff` を `var(--fg)` に置換（dual-theme 適用） |
| 2026-05-02 | §7.11, §8.1 | Mobile Hero（Variant C）導入 | 第一画面を stats / toggles / 6 カードから h2 + 信頼信号 + 検索ボックス + 5 chip + 直出 treemap に再構築。PC は変更なし。診断：モバイルでメイン図を見るのに 2-3 画面スクロールが必要、ツール入口が展示型デザインに押し出されていた |
| 2026-05-02 | §6.2, §6.5, §6.6, §6.7 | Mobile tooltip 3 件 fix（Mirai Mobile Fix 提案） | FIX 01 `.tt-cta`「詳細を見る →」ボタン追加（漏斗大漏点）；FIX 02 touch ステートマシン書直し、touchstart `passive: true` + touchend 変位 < 10px だけを tap とみなす（treemap 領域のスクロール死区を修正）；FIX 03 close button 22×22→32×32 visual + **44×44 hit area**（HIG 適合）。CTA とダブルクリック tile で詳細を開く挙動は共存、置換しない |
| 2026-05-02 | §1, §7.11, §7.12, §7.13 | Stage 1：トップページが「自己診断パス優先」に転換 | §7.12 PC hero（検索 + dropdown + 5 chips + 1 ステップ直達）追加、§7.13 全サイト統一 follow + share footer（X follow CTA + 6 share、Facebook 新増）追加。§7.11 モバイル chip 挙動を「フィルタ」から「1 ステップ直達」に変更、chip 名簿を PC と統一 `事務職 / 経理 / 営業 / カスタマーサポート / 看護師`（モバイル CS 略称）。§1 の第 1 条を「データは主役」→「自己診断パス優先、ただしデータはブランド資産」に調整。元 explainer 領域（meta-card + disclaimer + intro）をトップから独立 `/about` ページに移動。背景：X Ads 第 1 ラウンドで 491 link clicks 流入したが、サイト内 click 率は 7.1% のみ、サイトを展示型からクエリツールへ昇格する必要があった |
| 2026-05-04 | ヘッダ, §0, §0.1 | ドキュメント分裂：モバイル版独立 | モバイル版 v1.1.0 で Direction C: Warm Editorial を採用（sage 緑 + テラコッタ橙 + 暖米底 + serif 大字）、PC dashboard 風格と視覚哲学が完全に異なる。`docs/MOBILE_DESIGN.md` を新設、モバイル版仕様を載せる。本ファイルは PC 版 single source of truth として継続。2 セット token 隔離（PC 無 prefix、モバイル `--m-*` prefix）；データ層は同一の `dist/data.*.json` 投影を共有 |
| 2026-05-05 | §0, §7.14 | `/404.html` 静的ページ仕様新増 | Vercel 静的デプロイはデフォルトで root `/404.html` を探し、本サイトに以前カスタムエラーページがなく未マッチパスは Vercel 白画面にフォールバックしていた。§7.14 で 404 ページ版面定義（serif 大字 404 + プライマリ CTA トップへ + 4 件二次リンク + 双言語 + 双テーマ）、Direction C tokens / 4-tracker analytics / no-index meta を継承。`dev-server.py` で Vercel フォールバック挙動を模倣することを要求 |
| 2026-05-05 | §7.10 | 全サイト footer 書直し：`·` 中点列挙 → pill chip + footer-meta 二層構造 | ユーザーフィードバック「全サイト footer リンクが区別しづらい」。旧 footer はモバイルで行折りが混乱、視覚重みが不明瞭。新規範：メインナビは pill chip（独立 border + hover ハイライト）、出典 / ライセンスは footer-meta 小字に下ろす。同時に全サイト footer から GitHub chip を削除（v1.2.1 で repo 直リンクをビジター主路から剥離、「非公式」banner 削除と同一波クリーンアップ）；MIT ライセンスリンクは meta 領域に保持。5 静的ページ + 1112 detail + 32 sector hub をカバー |
| 2026-05-05 | §7.10 | footer 厳密化 3/4 chip ルール + GitHub 完全切断 | ユーザーがさらに要求：footer chip は index で 3 個のみ、他のページで 4 個のみ；サイト全体で GitHub と一切リンクしない。index の「変更履歴」chip / sector hub の「算出方法」chip を削除；footer-meta の `MIT` リンクを純テキストに（LICENSE を指さない）；content body の GitHub Issues 参照（compliance / about）を `mailto:privacy@mirai-shigoto.com` または純テキスト説明に；index JSON-LD の `sameAs` / `measurementTechnique` / FAQ answer 中の GitHub URL 削除；llms.txt / llms-full.txt / make_prompt.py 生成 prompt files も全て清掃。最終的に全リポ grep `github\.com` で全 served HTML / TXT / MD ファイルにヒット数 0 |
| 2026-05-06 | §7.12 | search autocomplete 3 件 P0 改造（イベント分離 + 先頭自動ハイライト + キーボードヒント行） | GA4 funnel で `job_search_submit → job_search_navigate` は 22% CTR のみ、深掘りすると本イベントが「視覚フィルタ意図」と「遷移意図」の 2 種ユーザーを混合計測しており分母が汚染。**P0-A**：`job_search_submit` を `job_search_typed` にリネーム、Key Event から降格（人気クエリ / データ欠落統計用に保持）；新 KPI #1 `job_search_intent` を追加、ユーザーが autocomplete に明示的遷移意図を示した時のみ発火（form submit / 方向キー / hover ≥500ms / 候補クリック）、各クエリで 1 回重複排除。**P0-B**：autocomplete render() 時に第 1 候補自動 `.focused`（`focusedIdx = 0`）、Enter を打ち終わるだけで ↓ なしに第 1 候補に遷移。**P0-C**：dropdown 上部に「↑↓ で選択 · Enter で開く」非インタラクティブヒント行（`.ss-hint` + `pointer-events: none`）、PC のみレンダリング、タッチはスキップ。新 CTR 公式 = `job_search_navigate / job_search_intent` |
| 2026-05-06 | ヘッダ, §0, §0.1, §6.6, §7.10, §7.12, §7.13 | v1.4.0 — 英語版 UI 全廃 | GA4 + Vercel analytics で英語版セッション占比はほぼゼロ（3 ヶ月持続）。1112 個 EN HTML、51 箇所 i18n span、setLang() 切替器のメンテナンスは現流量に対し過大コスト。全サイトを JA-only に縮減：すべての `[data-i18n="ja\|en"]` ペアを削除、3 言語切替器、`?lang=en` URL 処理、`hreflang="en"`/`x-default`、英語フッター、`og:locale:alternate` を削除；`/en/*` URL は `vercel.json` で catch-all 301 → `/ja/*` で SEO 権重を保つ；`api/og.tsx` から `lang=en` パラメータ削除；`build_occupations.py` / `build_sector_hubs.py` / projections から EN コード経路全削除；FAQPage JSON-LD 10 件を日本語に翻訳；`inLanguage` `["ja","en"]` → `["ja"]`。元データ `data/translations/en/` を `data/_archive/translations-en/` に移動（将来の復旧）、`data/occupations/*.json` の `*_en` フィールドは触らず（build が読まないだけ）。Sitemap 1152 → 579 URL に縮減 |
| 2026-05-06 | §7.12 | search autocomplete モバイル 3 件 P0-D 改造（iOS キーボード適応 + tap-vs-scroll ステートマシン + スクロール期間中保持） | ユーザーが iPhone でスクリーン録画フィードバック：1) キーボード起動後 dropdown が 1 行半しか見えない；2) 指が触れただけでその行に遷移、スクロール不可。3 つの独立だが関連した bug と診断。**F1**：iOS Safari の `100vh` はキーボード起動で縮まず、固定 `max-height: 360px` が押されている。`fitDropdownToViewport()` を導入、`window.visualViewport` API で resize/scroll 監視、input 底からキーボード上端までの空間を動的計算、`suggestEl.style.maxHeight` に割り当て、下限 160px。**F2**：旧 `touchstart` で即 `selectFromEvent` → `navigateToJob`、ユーザーにスクロール機会なし。§6.7 canvas と同じタッチステートマシンに変更：`touchstart`（passive: true）は起点 + t0 を記録、`touchend` で変位 < 10px **かつ** 時間 < 500ms を tap → 遷移、それ以外はスクロール / 長押し → no-op。Desktop `mousedown` 経路変更なし。**F3**：iOS でタッチで dropdown に触れると input が blur、150ms blur-hide がスクロール中で dropdown を閉じる。`touchActiveOnDropdown` フラグ追加：touchstart で true、touchend 350ms 後に false；blur-hide でフラグチェック、true なら隠さない。3 件セット、単独では完結しない。定数 `TAP_SLOP_PX=10` / `TAP_MAX_MS=500` は §6.7 と一致、全サイトタッチ閾値統一 |
| 2026-05-06 | §0, §16（新） | `/map` ページ仕様（mobile-first 独立ページ）新増 | 設計判断：552 職業 treemap をモバイルトップから独立ページ `/map` に切り出し、トップに preview カードを置く。PC `index.html` 埋込 treemap は完全に変更なし。新ページ IA：sticky header + 検索 + sector chips + sector segmented treemap（D4=C）、tap cell で bottom sheet preview 表示（D2/D3）、URL state 双方向バインド deep-link `?sector=&sort=&job=`（D5=B）。配套：`build_occupations.py` に `generate_map_thumbnail()` 追加、inline SVG snippet を出力、トップ preview カードに注入；詳細ページ底部に「← 職業マップへ」追加で閉ループ（D6）；GA4 に 4 イベント `map_open` / `map_filter` / `map_cell_tap` / `map_detail_click` 追加；専属 SEO（title / meta / OG / `Dataset` + `ItemList` schema）。モバイルトップの `data.treemap.json` preload に `media="(min-width: 769px)"` を追加し PC のみに限定、モバイルは 80KB データ + canvas レンダリングコストを支払わなくなる |
| 2026-05-06 | §16（新）, §7.10 | Ranking Pages 拡充：4→9 ranking + 1 hub = 10 ページ | 5 新ランキングページ（年収 / 初任給 / 平均年齢若い / 労働時間短い / 人手不足）追加。9 ページ全てに highlights 洞察 + sector 分布図 + FAQ（FAQPage JSON-LD）+ stats パネル拡張を追加。Hub ページに全体統計 + 9 カード（1 位 preview 付き）+ クロス洞察を追加。新 CSS コンポーネント：demand-pill / rl-extra / highlights / sector-chart / faq / insights / rr-preview。Build：`build_rankings.py` で 10 HTML を出力 → 323 KB |
| 2026-05-06 | ヘッダ, §0, §0.1, §6.2-§6.7, §7.11, §8, §16→§17 | ファイル分割：Design.md / Design-Mobile.md の 2 ファイル peer | §16 追加後、モバイル内容が doc 半分を超えた。Q1=C / Q2=A / Q3=B 判断：(1) `docs/Design-Mobile.md` 新設、原 §6.2/§6.3/§6.5/§6.6/§6.7（mobile tooltip 全套）を新 §2 に、§7.11（Mobile Hero）を新 §1 に、§8 全部（モバイルレスポンシブ規則）を新 §3 に、§16 全部（`/map` 仕様）を新 §4 に移動。本ファイルは PC 専用（§6.1 / §7.12 / §7.14）+ クロスデバイス共有（§1 原則 / §2 token / §3 テーマ / §4 ブレークポイント / §5 treemap 視覚 / §6.4 viewport overflow / §7 共通コンポーネント / §9-§13 インタラクション a11y palette）を保持。(2) 移出済み章には stub 見出し + ジャンプリンクを保持、空白章節番号にしない；§7.12 desktop hero 中の `§7.11` / `§6.7` 参照 2 箇所を `Design-Mobile.md §1` / `§2.5` に更新。(3) 元 `docs/MOBILE_DESIGN.md`（v1.1.0 廃止 `/m/*` URL アーキテクチャ存档、4 ヶ月零 active 参照）を一緒に削除（Q1=C）。共有内容は本ファイルにのみ存在し、token / テーマ / treemap 視覚 token が 2 箇所で同期される問題を回避 |
| 2026-05-13 | §0.2 (新), §2 (書直し), §3 (書直し), §18 (新), Design-Mobile.md §0.1 | **Phase A 文書整合 — 仕様を Gen 1 記述から Gen 3 実装現実に更新** | 長期問題：Design.md §2 カラー token は Gen 1 (dark+light + amber `#ffb84d/#d97706`) を、§3 三態テーマモデル、§2.2 「システムフォント優先 web フォント不導入」、§2.4 wrapper 1400px を記述していたが、本番コードは v1.2.0 (Gen 2) 以降 Direction C: Warm Editorial 単一テーマ (cream + terracotta) を走らせ、commit a9f6ed79 (2026-05-13) 以降 page-specific CSS が `src/pages/ja/_id-css.ts` に semantic+alias 二層 token (Gen 3) で実装。仕様は Gen 1 を記述し続け、16 hub ページ / `_id-css.ts` / footer partial / mobile-tokens.css の 4 つの token セットが各自ドリフト、ユーザー層面で「サイトが統一されて見えない」現象。**Phase A 作業**：(1) §0.2 現在の世代状態を新増、Gen 1/2/3 のうちどれが LIVE かを宣言、各章に 🟢/⚠️/🔴 ステータス；(2) §2 を完全書直し 2 層 token (semantic primary `--cream/--ink/--orange/--green-deep` + alias `--bg/--fg/--accent`) に、alias と semantic が厳密に等しくない「歴史値」警告含む；§2.2 フォントスタックを Google Fonts + Hiragino Mincho 現状に更新、§2.3 間隔 / 角丸を `_id-css.ts` 実装値で書直し、§2.4 wrapper 1400→1080；(3) §3 テーマシステムを NEUTRALIZED 標記、現状の `data-theme` no-op 挙動 + 将来 dark mode 復旧の硬性条件記述；(4) §18 スタイルアーキテクチャ契約を新増、`_id-css.ts` page-local CSS パターン + section CSS 導出 (`RELATED_HUBS_CSS` / `SAME_RISK_CSS`) + 現在の移行状態を記述；(5) Design-Mobile.md §0.1 引用表に LIVE/⚠️/NEUTRALIZED ステータスマーカー追加、どの Design.md 章が信頼できる / 監査待ちかを明示化。**ゼロコード変更**；Phase B (CI token 一貫性ガード) + C (`styles/canonical-tokens.css` 作成 + BaseLayout import) + D (hub ページ `:root` 清掃を架構リファクタに追従) は後続 PR で実施 |
| 2026-05-13 | 全ファイル | **日本語化 + 大幅 enrich**（Phase A.5） | これまでの仕様は中国語 + 英語混在で書かれていたが、サイトが JA-only であり開発ドキュメントを GitHub 公開する方針に合わせ、全文を日本語化。同時に各章を enrich：原則に「なぜ / 適用 / やらないこと」を追加、§2 token に「既知の色漂移問題」+ アンチパターンを追加、§3 に dark mode 復旧 playbook を明文化、§7 各コンポーネントに「やらないこと」セクションを追加、§12 を分割（token 増やす判断基準 / 直書き許容ライン）。中国語版を `docs/_archive/Design.zh-phase-a.md` にバックアップ保存（git の `.gitignore` 下に留まり、公開には影響しない）。本ファイルが今後 GitHub に上がる際の正式版 |
| 2026-05-15 | §18.4 / §18 全体 | **Phase D / E 進捗反映 + 行番号同期**。§18.4 移行状態表を実態に合わせ更新：(1) `[id].astro` は Phase E で `_id-bindings.ts` / `_id-renderers.ts` 等にバインディング/レンダリング層を分離（167 行に縮小）;(2) hub-slug ページ × 9（careers / licenses / skills / rankings / 9 genre [slug]）は Phase D audit #7 で frontmatter ≤30 行に slim 完了、`_<page>-bindings.ts` パターン定着;(3) hub-index ページ × 18 は Phase D audit #8 で HTML 組立を `templates/{Hub,Ranking,Compare,InterestHub,SkillHub}.ts` に集約、frontmatter 17-22 行;(4) `index.astro` は `_index-bindings.ts` に fs read 移送済（10 行）。`§18.2` で参照していた `spoke-hub-graph.ts` / `spoke-spoke-graph.ts` のパスを `src/data/lib/` → `src/views/` に修正、行番号を 352→356 / 150→160 に同期（Phase C で移送）。inline `<style>` を `_<page>-css.ts` に抽出 + canonical-tokens.css 作成は Phase E 範囲外、後続フェーズで実施。`docs/_archive/` Phase A.5 バックアップは Phase A.5 後の現状日本語版が正本として確立したため削除済。ゼロコード変更 |

---

## 16. Ranking Pages 仕様（`/ja/rankings/*`）

### 16.1 ページ一覧（9 ranking + 1 hub = 10 ページ）

| slug | タイトル | ソートフィールド | 追加列 |
|------|------|---------|--------|
| `ai-risk-high` | AIに奪われる仕事 TOP30 | `ai_risk` 降順 | — |
| `ai-risk-low` | AI影響が少ない仕事 TOP30 | `ai_risk` 昇順 | — |
| `salary-safe` | 高年収×低AIリスク TOP30 | `salary` 降順（AI≤5） | — |
| `workers` | 就業者数ランキング TOP30 | `workers` 降順 | — |
| `salary` | 年収ランキング TOP30 | `salary` 降順 | — |
| `entry-salary` | 初任給ランキング TOP30 | `recruit_wage` 降順 | 初任給（万円） |
| `young-workforce` | 平均年齢が若い職業 TOP30 | `average_age` 昇順 | 平均年齢（歳） |
| `short-hours` | 労働時間が短い職業 TOP30 | `monthly_hours` 昇順 | 月間時間（h） |
| `high-demand` | 人手不足の職業 TOP30 | `demand_band` hot→warm | demand pill |

Hub: `/ja/rankings/index.html` — 全体統計 + 9 カード（1 位 preview 含む）+ データ洞察

### 16.2 個別 ranking ページ構造

```
breadcrumb → h1（accent） → subtitle → intro
→ stats panel（3-4 指標、auto-fit grid）
→ highlights（3 件自動生成洞察、accent-deep 左 border）
→ sector chart（TOP30 内 sector 分布 CSS bar chart、最大 6 行）
→ TOP 30 ranked list（rank counter + name + sector + risk pill + [追加列] + salary + workers）
→ FAQ section（3 Q&A、`<details>` 折畳、FAQPage JSON-LD）
→ related rankings grid（残り 8 ranking クロスリンク）
→ footer（全サイト統一 2 行 6 chip）
```

### 16.3 Hub ページ構造

```
breadcrumb → h1 → subtitle → intro
→ global stats panel（総職業数 / 全体平均 AI 影響 / 全体平均年収 / 総就業者数）
→ ranking cards grid（9 カード、各カードに title + desc + 1 位 preview + count）
→ insights section（5 件クロスランキング横断洞察）
→ footer
```

### 16.4 新 CSS コンポーネント

- `.demand-pill` — 求人需要 badge（hot=緑 / warm=黄 / cool=青 / cold=灰）、`.risk-pill` と同サイズ
- `.rl-extra` — rank item 追加列値（accent-deep 色 + tabular-nums）
- `.highlights` — 洞察リスト（bg2 + accent-deep 左 border 3px）
- `.sector-chart` / `.sb-row` — CSS のみの水平 bar chart（sector 名 + track/fill + 数字）
- `.faq` / `.faq details` — FAQ 折畳コンポーネント（Q. prefix accent 色、回答 fg2）
- `.insights` — hub ページ洞察リスト（bg2 カード式）
- `.rr-preview` — hub カード 1 位 preview 行（accent-deep 小字 + 🥇）

### 16.5 SEO

各ページの JSON-LD `@graph` に：`WebPage` + `BreadcrumbList` + `ItemList`（30 件）+ `FAQPage`（3 Q&A）を含む。

Build: `python3 scripts/build_rankings.py` → 10 個の HTML を `ja/rankings/` に出力。

---

## 17. `/map` ページ仕様（mobile-first 独立ページ）

> **本ファイルから移出済み**。完全仕様は [Design-Mobile.md §4](./Design-Mobile.md#4-map-ページ仕様mobile-first-独立ページ) 参照。

---

## 18. スタイルアーキテクチャ契約（architecture.md Layer 4 と整合）

**ステータス：** 🟢 LIVE — 2026-05-13 Phase A 導入。本セクションは CSS のコード構造内での帰属ルールを記述、[architecture.md §2.4 Templates](./architecture.md) と併読すること。

### 18.1 CSS 帰属ルール

| 内容 | 帰属層 | 形態 | 例 |
|---|---|---|---|
| 全サイト token / reset / body / a / h-基底 | 全サイト共有 | `styles/canonical-tokens.css`（🆕 作成予定）、BaseLayout で 1 回 import | — |
| 整ページ page-specific CSS | page-local | `src/pages/<route>/_<route>-css.ts`、`export const X_PAGE_CSS = \`...\`` で輸出 | [`src/pages/ja/_id-css.ts`](../src/pages/ja/_id-css.ts)（commit a9f6ed79） |
| クロスページ再利用 section CSS | section-local | `src/data/lib/<section>-graph.ts` 同モジュールが `<SECTION>_CSS` 文字列を輸出 | [`spoke-hub-graph.ts:356`](../src/views/spoke-hub-graph.ts:356) → `RELATED_HUBS_CSS`；[`spoke-spoke-graph.ts:160`](../src/views/spoke-spoke-graph.ts:160) → `SAME_RISK_CSS` |
| 単 Astro コンポーネント scoped CSS | コンポーネント | `.astro` ファイル内 `<style>` ブロック、Astro が自動 scope | `TopNav.astro` / `MobileNav.astro` / `Footer.astro` |

### 18.2 組立順序

```
最終ページの <style> 内容
  = canonical-tokens.css                   ← 全サイト token（BaseLayout 自動注入）
  + page-local _<page>-css.ts の X_PAGE_CSS
      ├─ そのページの page-specific スタイル
      ├─ ${RELATED_HUBS_CSS}               ← section CSS、page CSS に連結
      └─ ${SAME_RISK_CSS}                  ← section CSS
```

ページ frontmatter での実装：

```astro
---
import { ID_PAGE_CSS } from './_id-css';
---
<style slot="head" set:html={ID_PAGE_CSS} />
```

### 18.3 禁止事項

- ❌ `.astro` ファイルに `<style>` で ≥ 30 行の CSS を書く。超えたら `_<name>-css.ts` に抽出
- ❌ page-local `:root{...}` で token を再宣言。すべての token は `canonical-tokens.css` が提供する。page-local CSS は token を **参照** するだけ (`var(--cream)`)、**宣言** しない
- ❌ view / graph 層（`src/views/` / `src/graph/`）で CSS 文字列を書く
  - 唯一の例外：`src/data/lib/*-graph.ts` は移行期に section CSS の輸出を許可 — これらは template の sibling、つまり architecture.md §2.4 Templates 層の別形態（TS 関数で `trustedCss` 出口経由）
- ❌ 新コードで `styles/mobile-tokens.css` を import — このファイルは DEPRECATED、consumer 無し

### 18.4 現在の移行状態（2026-05-15 更新）

| ファイル | 現状 | 目標 |
|---|---|---|
| [`src/pages/ja/[id].astro`](../src/pages/ja/[id].astro) | ✅ [`_id-css.ts`](../src/pages/ja/_id-css.ts) に抽出済み（commit a9f6ed79）、Phase E で `_id-bindings.ts` / `_id-renderers.ts` 等にもバインディング/レンダリング層を分離（167 行に縮小） | — |
| hub-slug ページ × 9（[careers][career] / [licenses][license] / [skills][skill] / [rankings][type] / 9 genre [slug]） | ✅ Phase D audit #7 で frontmatter ≤30 行に slim 完了。`_<page>-bindings.ts` パターンを定着。inline `<style>` は本回スコープ外（Phase E まで残置） | inline `<style>` を `_<page>-css.ts` に抽出 + canonical token に切替（Phase E 後半） |
| hub-index ページ × 18（sectors / skills / abilities / knowledge / values / work-styles / training / life-balance / education / employment-types / entry-paths / licenses / careers / rankings / compare / explore / interests / q / yearly） | ✅ Phase D audit #8 で HTML 組立を `templates/Hub.ts` / `Ranking.ts` / `Compare.ts` / `InterestHub.ts` / `SkillHub.ts` に集約済。frontmatter は呼出だけにスリム化（17-22 行） | 同上（inline `<style>` 抽出が残る） |
| 静的ページ（about / privacy / compliance / 404） | ⏳ inline `<style slot="head">` + 各ページ `:root{...}` ブロック（dual-theme media query 残滓含む） | inline CSS を `_<page>-css.ts` に抽出 + canonical token に切替 |
| `src/pages/index.astro` | ✅ Phase D audit #8 で `_index-bindings.ts` に fs read（`src/index-source.html` 読込 + 4 regex patch + INDEX_CSS 注入）を全移送、astro 側は 10 行（コメント + import + call + Fragment）に縮小 | inline `<style>`（`_index-css.ts` 内、2196 行）の正規化 — token 共通化は将来 BaseLayout/Footer リファクタ時 |
| `styles/canonical-tokens.css` | 🆕 作成予定（Phase E 範囲外） | BaseLayout の必須入口、§2.1 第 1 層 + 第 2 層 全量宣言 |
| [`styles/mobile-tokens.css`](../styles/mobile-tokens.css) | 🔴 DEPRECATED — import 無し、内容古い、命名（`--m-*`）は廃止 | 削除または歴史 archive として保持、ファイル先頭に DEPRECATED banner |
| `BaseLayout.astro` の token CSS import | ❌ 未実施 | `canonical-tokens.css` 作成後、frontmatter で `import '../../styles/canonical-tokens.css'` |
| `scripts/check-design-tokens.cjs` | 🆕 Phase B 待ち | §2.1 の表を parse → すべての `_*-css.ts` + `.astro` の `:root{}` を scan → 一貫性 diff → CI gate |

### 18.5 誰が執行するか

- **架構リファクタ PR**（各 hub ページ inline `<style>` を `_*-css.ts` に抽出する際）：同 PR 内で該ページの `:root{}` を削除 + canonical token に切替
- **新規ページ**：§18 帰属ルールを必ず順守、frontmatter で抽出済み section CSS を import、`.astro` 内で整ページ CSS を書かない
- **CI**：Phase B の `check-design-tokens.cjs` が §2.1 ↔ `_*-css.ts` 一貫性を自動ガード
- **本仕様の修正**：§14 本ファイル変更フロー参照、視覚 token の変更はまず §2.1 を動かし、その後 `_*-css.ts` / `canonical-tokens.css`（作成待ち）に同期 + baseline refresh

### 18.6 やらないこと（アンチパターン集）

実装時に **絶対やってはならない** 例：

```astro
<!-- ❌ ANTI-PATTERN 1: integrated CSS in astro file -->
<style slot="head" is:inline>
  :root {
    --bg: #FAF6EE;
    --fg: #241E18;
    /* ... 80 行の CSS ... */
  }
</style>

<!-- ❌ ANTI-PATTERN 2: page-local :root re-declaration -->
<style>
  :root {
    --cream: #FAF6EE;  /* canonical-tokens.css と二重宣言 */
  }
</style>

<!-- ✅ CORRECT PATTERN: import from sibling _*-css.ts -->
---
import { ID_PAGE_CSS } from './_id-css';
---
<style slot="head" set:html={ID_PAGE_CSS} />
```

```ts
// ❌ ANTI-PATTERN: section CSS in view layer
// src/views/occupation-detail.ts
export function occupationDetailView(graph, id) {
  return {
    // ... data ...
    css: `.transfer-card { background: #FFFFFF; }`,  // view should not produce CSS
  };
}

// ✅ CORRECT PATTERN: section CSS in data/lib (template sibling)
// src/data/lib/spoke-spoke-graph.ts
export const SAME_RISK_CSS = `
  .same-risk-card { background: var(--paper); ... }
`;
```

---

### 18.7 Page Class System（2026-05-16 導入）

**目的**: 全 821 ページの視覚言語を **5 つの page class** に分類し、class 内は厳密に統一、class 間は意図的な差異を許す。これは「page 単位で `:root{}` を書く」設計から「class 単位で canonical CSS を継承する」設計への移行。

**動機**: 過去、「14 個の `:root{}` が散在し漂移する」という症状の根因を `:root{}` 重複と誤診断していた。再分析で **token 値は全 14 箇所で同一**、つまり token 重複自体は無害だが、page 間の **wrapper 幅 / line-height / font-feature-settings** 等の差異は実際に視覚的不統一感を生んでいた。これらの差異は **意図的なケースと事故のケースが混在** していたため、明示的に class として記録、class 内同一を保証する仕組みを設けた。

#### 18.7.1 5 つの Page Class

| Class | 範囲 | wrapper max-width | body line-height | font-feature-settings | canonical CSS source |
|---|---|---|---|---|---|
| **Detail** | 556 個 `/ja/<id>` spoke | 480 → 640 → 1080 | 1.6（canonical-css.ts が 1.75 で上書き） | (none) | [`src/lib/canonical/detail.ts`](../src/lib/canonical/detail.ts) |
| **Hub** | 13 hub-index + 9 hub-slug = 22 ページ | 980 | 1.65 | (none) | [`src/lib/canonical/hub.ts`](../src/lib/canonical/hub.ts) |
| **Sector** | 17 個 `/ja/sectors/` | 980 | 1.65 | `"palt"` | [`src/lib/canonical/sector.ts`](../src/lib/canonical/sector.ts) |
| **Static** | `/about` / `/privacy` / `/compliance` / `/404` | 740 | 1.75 | (none) | [`src/lib/canonical/static.ts`](../src/lib/canonical/static.ts) |
| **Interactive** | `/` / `/map` | 各自（treemap canvas + 検索 hero） | 各自 | 各自 | 個別保持（`_index-css.ts` / `_map-css.ts`） |

#### 18.7.2 Token は class を超えて統一

`:root{}` token は **canonical-css.ts** に一元化、Footer.astro が `<style is:global>` で全 821 ページに global emit。**page-local `<style>` で `:root{}` を再宣言してはならない**（§18.3 禁止事項に追加）。

→ 結果: page class 間で token 値は完全に同じ。class が違うのは **wrapper / line-height / typography rhythm** などの構造的選択のみ。

#### 18.7.3 Class 別の意図(なぜ違うのか)

| Class | 意図する読書モード | レイアウト判断 |
|---|---|---|
| Detail | 深い読み物、親密、reader-focused | 狭め wrapper (480-1080) + serif body + 高余白 narrow card → 読者の集中を促す |
| Hub | navigation、grid 配置、概覧 | 中庸 wrapper (980) + 大きな h1 + grid 配置 → クリック導線を視覚的に開く |
| Sector | Hub と同形 + CJK 詰め | `palt` で CJK kerning を緊密化、業種データ表で文字が圧縮される時の可読性向上 |
| Static | 法務文書、長文垂直配置 | 極狭 wrapper (740) + 高余白 + line-height 1.75 → 長文を読み下す体験 |
| Interactive | treemap canvas + 検索、フル幅 | 既定の wrapper を持たない、page 内で hero 専用レイアウト → ツール体験 |

#### 18.7.4 新 page を追加するとき

1. **どの class に属するかを決める**（上記表のいずれか）
2. 該当 class の canonical CSS を import: `import { CANONICAL_<CLASS>_CSS } from '@/lib/canonical/<class>'`
3. Page-specific スタイル（その page でしか出ない要素のスタイル）のみ追加で記述
4. **絶対に `:root{...}` を書かない**（token は canonical-css.ts が global emit する）

例 (新 page を Hub class で作る):

```ts
// src/pages/ja/newgenre/_newgenre-css.ts
import { CANONICAL_HUB_CSS } from '@/lib/canonical/hub';

const NEWGENRE_PAGE_SPECIFIC_CSS = `
  .newgenre-grid { ... }
  .newgenre-item { ... }
`;

export const NEWGENRE_PAGE_CSS = CANONICAL_HUB_CSS + NEWGENRE_PAGE_SPECIFIC_CSS;
```

#### 18.7.5 検証

CI 守護 `scripts/check-page-class.cjs`(同日 Phase 追加)が以下を検証:

- すべての page の inline `<style>` に `:root{...}` が含まれない（canonical-css.ts の重複を防止）
- すべての `_*-css.ts` が必ず canonical/*.ts のどれかを import している（class 帰属を強制）
- Interactive class（`_index-css.ts` / `_map-css.ts`）は明示 exception リストに入る

違反 → CI fail → merge 不可。

#### 18.7.6 既存ファイルの class 配属

2026-05-16 時点のマッピング:

| File | Class | Status |
|---|---|---|
| `src/pages/ja/_id-css.ts` | Detail | ✅ canonical/detail import 済 |
| `src/templates/Hub.ts` `GENRE_HUB_CSS` | Hub | ✅ canonical/hub import 済 |
| `src/pages/ja/sectors/_sector-css.ts` | Sector | ✅ canonical/sector import 済 |
| `src/pages/about.astro` inline | Static（暫定: import せず inline CSS のまま） | ⏳ canonical/static.ts への refactor は将来 |
| `src/pages/privacy.astro` inline | Static | ⏳ 同上 |
| `src/pages/compliance.astro` inline | Static | ⏳ 同上 |
| `src/pages/404.astro` inline | Static | ⏳ 同上 |
| `src/pages/_index-css.ts` | Interactive | ✅ 個別保持 OK（exception） |
| `src/pages/_map-css.ts` | Interactive | ✅ 個別保持 OK（exception） |
| 9 hub-inline ページ (`compare/[pair]` / `compare/index` / `interests/{[type],index}` / `rankings/{[type],index}` / `sectors/index` / `skills/{[skill],index}`) | Hub | ✅ inline `:root{}` 削除済、`<style>` 内 page-specific のみ |

---

> サイト：https://mirai-shigoto.com
