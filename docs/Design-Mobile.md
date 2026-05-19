# Design-Mobile.md — mirai-shigoto.com モバイル版デザイン仕様

> 当サイト **モバイル版（≤768px）** デザインの唯一の正典 (single source of truth)。
> PC 版仕様は [Design.md](./Design.md) を参照。共有基盤（カラー token / フォント / 間隔 / テーマシステム / レスポンシブブレークポイント定義 / treemap 視覚 / 共通コンポーネント）はすべて Design.md にあり、本ファイルは **モバイル専用** のみを記述する：mobile hero、tooltip touch-mode、モバイル自適規則、`/map` 独立ページ。
>
> 歴史上の `MOBILE_DESIGN.md` との関係：あれは v1.1.0 時代に廃止された `/m/*` URL アーキテクチャを記述しており、2026-05-06 に削除済み（v1.4.0 以降 active 参照ゼロ）。本ファイルが記述するのは現在のメインドメイン `mirai-shigoto.com` のモバイルレスポンシブ設計。
>
> コードと本ファイルが矛盾した場合、**本ファイルが優先**。

---

## 0. 適用範囲

- [`src/pages/index.astro`](../src/pages/index.astro) のモバイル段（`@media (max-width: 768px)` 以下の各ブレークポイント）
- [`src/pages/map.astro`](../src/pages/map.astro)（モバイル先行の独立職業マップページ、詳細は §4）
- [`src/pages/ja/[id].astro`](../src/pages/ja/[id].astro) によって build される 556 個の `ja/<id>.html` 詳細ページのモバイル段
- 16 個 hub ページ（[`ja/sectors/*`](../src/pages/ja/sectors/) 等、Design.md §0 一覧参照）のモバイル段
- 共有基盤（カラー / フォント / 間隔 / テーマ / ブレークポイント / treemap 視覚）は Design.md を参照

---

### 0.1 Design.md との関係

> Design.md の章を引用する際、Phase A (2026-05-13) で §0.2 / §2 / §3 / §18 は整合済み、§5 / §6.1 / §7 の一部は Gen-3 監査待ち。Design.md の章を引用する前に必ず [Design.md §0.2 現在の世代状態](./Design.md#02-現在の世代状態2026-05-13-phase-a-導入) を見ること。

| 軸 | どこに | ステータス |
|---|---|---|
| カラー / フォント / 間隔 token | Design.md §2 | 🟢 LIVE（Phase A で 2 層 semantic+alias 構造に書直し済み） |
| テーマシステム | Design.md §3 | ⚠️ NEUTRALIZED — 単一テーマ、`data-theme` は no-op |
| レスポンシブブレークポイント定義 | Design.md §4 | 🟢 LIVE |
| Treemap 視覚化（カラー関数 / 透明度 / ラベル閾値 / GAP） | Design.md §5 | ⚠️ Dark 配色関数 deprecated、Light 経路 LIVE、完全監査は Phase B 待ち |
| Desktop tooltip (hover-mode) | Design.md §6.1 | ⚠️ 監査待ち — treemap が `/map` 独立ページに移行、desktop hover tooltip が今もアクティブか要検証 |
| Tooltip ビューポートはみ出し処理（共有） | Design.md §6.4 | 🟢 LIVE（共有ロジック） |
| 共通コンポーネント（top banner / stats panel / footer / 404 等） | Design.md §7.1-§7.10, §7.13, §7.14 | 🟢 LIVE — うち §7.10 footer (v1.3.x)、§7.12 desktop hero、§7.13 follow+share、§7.14 404 は最新かつ最もクリーンな契約 |
| Desktop Hero | Design.md §7.12 | 🟢 LIVE |
| インタラクション動効 / アクセシビリティ / アセット / palette ガイドライン | Design.md §9-§13 | 🟢 LIVE |
| **スタイルアーキテクチャ契約（CSS 帰属ルール + `_id-css.ts` pattern + 移行状態）** | **Design.md §18** | **🟢 LIVE（Phase A 新増）** |

| 軸 | どこに | ステータス |
|---|---|---|
| Mobile Hero (Variant C) | 本ファイル §1 | 🟢 LIVE |
| Mobile Tooltip 行動（touch-mode + close button + CTA + touch state machine） | 本ファイル §2 | 🟢 LIVE |
| モバイル自適規則まとめ（≤768 / ≤480 / ≤360 / ≤540） | 本ファイル §3 | 🟢 LIVE |
| `/map` 独立ページ仕様（§4.4.1 再レンダリング契約を含む） | 本ファイル §4 | 🟢 LIVE |

---

## 1. Mobile Hero (Variant C, mobile-only)

mobile（`≤768px`）専用の第一画面 hero ブロック。desktop では `display: none`、PC 版に影響しない。

**目的**：スマホユーザーがサイトを開いて 10 秒以内にメイン図 / ツール入口を見られるようにする、stats / toggles / 説明文字に第一画面を奪われないようにする。

**過去の問題**：v0.4.x 時代のモバイル第一画面は stats panel + dimension toggles + 6 個の説明カードで埋まり、treemap を見るのに 2-3 画面スクロールが必要だった。診断：「データ密度高」型 PC 設計をそのままモバイルに引き継いだ結果、モバイルでは「ツールへの最短経路」が消えていた。

### 1.1 構造（DOM 順、上から下へ）

1. `h2.mobile-hero-title` — `あなたの仕事の AI 影響度 を見る`、サイズ 1.35rem（`≤480: 1.2rem`）、「AI 影響度」を `var(--orange)` で着色
2. `.mobile-hero-trust` — 1 行の信頼信号：`552 職業 · LLM スコア · 公開データ由来`。font 0.74rem、`color: var(--ink-3)`、中央または左寄せ
3. `.mobile-hero-search` — 検索入力欄 + 🔍 icon prefix。input は幅いっぱい、padding `10px 14px 10px 38px`（左側に icon 用空間を確保）、radius 999px。`placeholder: 職業名で検索（例：事務職）`。`applyFilter()` + dropdown に bind（Design.md §7.12 の search-suggest ロジックを共用）
4. `.mobile-hero-chips` — 5 個の職業 chip、横並び wrap 可：**事務職 / 経理 / 営業 / CS（カスタマーサポート 略称）/ 看護師**（Design.md §7.12 PC hero と共通の 5 個セット）。chip padding `5px 11px`、radius 999px、`border: 1px solid var(--border)`、font 0.78rem

### 1.2 表示挙動

**Desktop**（`min-width: 769px`）：`.mobile-hero { display: none }`

**Mobile**（`max-width: 768px`）：
- `.mobile-hero { display: block }`、h1 の下、treemap の上に置く
- **DOM 再配列**：`.controls` / `.stats-panel` を treemap の **後** に移動（`#wrapper` を flex-column + `order` で制御）、`.dimension-hint` / `.search-row`（旧 desktop 位置）を `display: none`（mobile-hero に置換される）
- ユーザーが第一画面で見るもの：top-banner → h1 → mobile-hero → treemap 上部。`.controls` / `.stats-panel` はスクロール後に現れ、「探索後の操作」を担う

### 1.3 Chip 行動契約（Stage 1 以降：1 ステップ直達）

- chip クリック → `CHIP_TO_JOB` マッピング → `window.location.href = occUrl(matched_record)`、1 ステップで対応詳細ページに遷移
- chip 名 v1 は仮置き（Design.md §7.12 と共通）、data-chip は日本語フルネーム、表示は狭画面で略称（例：`カスタマーサポート` → `CS`）が可
- GA4 データ安定（2-3 週間）後、top-clicked / top-searched で名簿置換するべき
- GA4 イベント：`popular_job_click`、パラメータ `occupation_id` / `language`

### 1.4 やらないこと

- ❌ Stats panel を Mobile Hero の前に置く（第一画面奪取の根本問題に戻る）
- ❌ 「探索型」要素（layer toggle / dimension hint）を Mobile Hero に含める（自己診断パス汚染）
- ❌ Hero に複数の CTA を並べる（迷い）
- ❌ chip 数を 6 個以上にする（横並びが折り返し、視覚密度過大）

---

## 2. Mobile Tooltip 行動

### 2.1 touch-mode 入口

PC の hover-mode（Design.md §6.1）と区別するため、モバイルは tooltip を **明示的なタッチターゲット** として扱う：

- `.touch-mode` class を付与
- `pointer-events: auto`
- `.tt-close` 閉じるボタン（右上 ×）を表示 — 詳細は §2.3
- `.tt-cta`「詳細を見る →」ボタンを表示 — 詳細は §2.4
- `max-width: calc(100vw - 32px)`
- `max-height: calc(100vh - 32px)`
- `overflow-y: auto` + `-webkit-overflow-scrolling: touch`
- `font-size: 0.78rem`、`padding: 10px 12px`

### 2.2 Tap-outside 行動

tooltip 外の任意位置をクリックで自動 close。tile クリックで tooltip 切替。

### 2.3 Close button（`.tt-close`）タッチターゲット

| 軸 | 値 |
|---|---|
| Visual size | 32×32 px（円形） |
| Hit area（タッチターゲット） | **44×44 px**（Apple HIG 最小） — padding / pseudo-element で拡張、visual size 依存ではない |
| Background | `rgba(36,30,24,0.05)` |
| Border | `1px solid var(--line-strong)` |
| Radius | `50%` |
| Color | `var(--ink-3)`、hover で `var(--orange)` |
| Font-size | `1.1rem`（× 文字サイズ） |
| Position | `top: 8px; right: 8px` 絶対配置 |

> **44×44 hit area 以下不可**。v0.4.2 以降に追加された硬性最小。元 22×22 visual + 約 22×22 hit はテストで高齢ユーザー / 大親指ユーザーが高頻度で mis-tap、漏斗の隠れた漏点だった。

### 2.4 Tooltip CTA（`.tt-cta`）

Mobile touch-mode tooltip には **目立つ「詳細ページへ」ボタン** が必須、さもないとユーザーは情報を見ても入れることに気づかない（実測の漏斗大漏点）。

| フィールド | 値 |
|---|---|
| 要素 | `<a id="tooltipCta" class="tt-cta" target="_blank" rel="noopener">` |
| テキスト | `詳細を見る →` |
| Background | `var(--orange)`（テラコッタ） |
| Color | `#fff` |
| Padding | `10px 14px` |
| Radius | 8px |
| Font-weight | 600 |
| Font-size | 0.88rem |
| Display | block、`width: 100%`、`text-align: center` |
| Margin | `12px 0 0`（tooltip 内容と分離） |
| Hover | `filter: brightness(1.05)` |
| Focus | `outline: 2px solid var(--orange); outline-offset: 2px` |

**href 契約**：showTooltip() 時に JS が `cta.href = occUrl(occupation)` を設定（`/ja/<id>`、v1.4.0 以降 JA-only）。

**GA4 イベント**：クリック時に `tooltip_cta_click` イベントを fire、パラメータ `occupation_id` / `ai_risk_score` / `language` — `analytics/spec.yaml` 詳細参照。

> **CTA と「ダブルクリック tile で詳細を開く」は共存**、置換ではない。CTA は明示的入口（大多数ユーザーが利用）、ダブルクリックは暗黙的ショートカット（古参ユーザーが利用）。両経路とも `/ja/<id>` に進む。GA4 は別イベントで帰属を区別。

### 2.5 Touch 行動契約（scroll vs tap）

Canvas は **意図的スクロール** と **意図的クリック** を正しく区別しなければならず、さもないと treemap 領域が「スクロール死区」になる。

| 段階 | 行動 |
|---|---|
| `touchstart` | 起点 `{ x, y, t }` を記録。`passive: true` — **`preventDefault` を呼ばない**、ブラウザにネイティブスクロールを判断させる |
| `touchmove` | 何もしない。ユーザーがスクロールしていれば、ブラウザが自然に処理 |
| `touchend` | 変位 `Math.hypot(dx, dy)` を計算：<br>• `< 10px` AND `duration < 500ms` → tap とみなし `handleTouchTap(x, y)` を呼ぶ<br>• それ以外 → スクロール終了とみなし、**何もしない**（tooltip を出さない、ナビしない） |

> 過去の bug（v0.4.2 以前）：`touchstart` で `passive: false` + `preventDefault` した直後に tap を fire → tile 領域内の任意の指落としで native scroll がロック、treemap が「スクロール不能な図」になる。修正後、tile 領域内で正常に list をスクロールできるようになった。

> Tap 発火遅延：touchstart 即時 → touchend 後 100–300ms。**意図正しく判断する代償** として許容。

> 定数 `TAP_SLOP_PX = 10` / `TAP_MAX_MS = 500` は Design.md §7.12 desktop hero search autocomplete のタッチステートマシンと一致（同一閾値セットを全サイト適用）。

> ビューポートはみ出し処理（desktop と共有）は Design.md §6.4 参照。

---

## 3. モバイル自適規則まとめ

各ブレークポイントで具体的に **何が変わるか** を本セクションが規定する。ブレークポイント値の定義（768 / 540 / 480 / 360）は Design.md §4 にある。

### 3.1 ≤768px（mobile）

#### Layout

- `#wrapper padding: 16px 16px 60px`、**`display: flex; flex-direction: column` に変更** — §1 mobile-hero / treemap / 旧 chrome を `order` で再配列可能にする
- `h1 font 1.3rem`、flex-direction column、gap 8px
- `h1 .lang-switch margin-left 0`（右に push しない）

#### Mobile Hero

- **§1 `.mobile-hero` を表示**（`display: block`）、h1 の下に挿入
- **DOM 再配列（CSS `order`）**：mobile-hero / loadingState / treemap / .controls / .stats-panel の間で order を使い treemap を上に
- **`.dimension-hint`、旧 `.search-row` は mobile で `display: none`**（mobile-hero に置換）

#### Intro / 説明

- `.intro font 0.88rem`、line-height 1.75

#### Controls / Stats

- `.controls gap 10px, padding 10px 12px`、**treemap の後** に移動
- `.layer-toggle` 横スクロール
- `.gradient-legend` 幅いっぱい + 中央揃え
- `.stats-panel` **treemap の後** に移動
- `.stats-row gap 14px, font 0.78rem`

#### Tooltip

- `#tooltip` を touch-mode 入る（§2.1 詳細）

#### Meta Card / Treemap

- `.meta-card` 単列
- treemap 高さを `w × 2.6` に切替、ラベル minW/H を半減（Design.md §5.2）

### 3.2 ≤480px（compact-mobile）

- `top-banner` 文字縮小
- `h1 font 1.2rem`
- `stats-panel: 2 columns`
- `stat-block padding 10px 12px`、stat-value 1rem
- `tier-table font 0.7rem`
- `mini-hist height 28px`（元 32px）
- `dimension-hint` を column 配列に変更
- `layer-toggle` を wrap に変更（スクロールしない）
- `palette-toggle margin-left 0`
- `disclaimer / usage-notice / intro-details / meta-card` 全て文字縮小 + padding 縮小
- `#wrapper padding 14px 12px 50px`

### 3.3 ≤360px（tiny-mobile）

- `stats-panel: 1 column`
- `h1 font 1.1rem`
- `h1 .h1-sub font 0.74rem`

### 3.4 ≤540px（share buttons タッチ強化）

- `share-btn 36×36`（デフォルト 32×32）

### 3.5 やらないこと

- ❌ 768 / 540 / 480 / 360 以外の独自ブレークポイントを導入
- ❌ 単一コンポーネントのために `@media (max-width: 612px)` のような中途半端な境界を作る
- ❌ JS で `navigator.userAgent` を使ってモバイル判定（CSS / `window.innerWidth` 統一に従う）

---

## 4. `/map` ページ仕様（mobile-first 独立ページ）

### 4.0 適用範囲

- 新規 `map.html`、Vercel パス `/map`
- `index.html` モバイル段（≤768px）に影響：treemap canvas が preview カードに変わる
- `scripts/build_occupations.py` に影響：SVG サムネ生成ステップを追加
- `scripts/build_occupations.py` が生成する `ja/<id>.html` に影響：底部に「← 職業マップへ」リンクを追加
- `sitemap.xml`、`vercel.json` に影響（rewrite が必要な場合）

> **PC `index.html` の埋込 treemap は完全に変更なし**、本セクションは mobile + 新ページのみ記述。

---

### 4.1 IA 判断

| デバイス | `/` トップの treemap 体験 | `/map` 体験 |
|---|---|---|
| Desktop（≥769px） | 完全な treemap 埋込（Design.md §5 現状） | mobile 版と同じ（max-width 900px センター）、PC 専用に最適化しない |
| Mobile（≤768px） | preview カードのみ → tap で `/map` に遷移 | フルスクリーン sector segmented treemap |

**PC トップで preview カードは表示しない**（埋込 treemap が既に視野内、preview は冗長 + スペース占有）。

---

### 4.2 Mobile トップ — Map preview カード

既存 mobile hero（§1）+ search row + chips の後に配置：

```
┌──────────────────────────────────────┐
│ 職業マップ           全 552 職業      │  ← title row
│ 面積 = 就業者数・色 = AI 影響         │  ← legend caption
├──────────────────────────────────────┤
│  [inline SVG サムネ、~120-160px 高]   │
├──────────────────────────────────────┤
│   ┌──────────────────────────────┐   │
│   │   マップを探索する  →         │   │  ← primary CTA
│   └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

- **カード全体がクリッカブル**（ボタンだけでなく）→ `/map`
- サムネ = build 時に生成された inline `<svg>`、fetch 無し、JS 無し
- カラー token：背景 `--cream-2`、文字 `--ink` / `--ink-3`、CTA 縁取り `--orange`
- マージン：Design.md §2.3 と §7 共通カード padding を再利用
- `@media (max-width: 768px)` でのみレンダリング、desktop `display: none`

---

### 4.3 `/map` ページ — 上部 sticky 領域

3 層 sticky（上から下へ）：

```
┌─ Layer 1: header (sticky, top:0) ─────┐
│ ←       職業マップ                     │  44px 高、背景 --cream
├─ Layer 2: search (sticky, top:44px) ──┤
│ 🔍 気になる職業を入力     [診断]       │  56px 高
├─ Layer 3: chips (sticky, top:100px) ──┤
│ 横スクロール: [全て] [事務] [専門技術]… │  48px 高
│           並べ替え: [AI影響↓ ▾]       │
└────────────────────────────────────────┘
```

- 3 層 sticky の合計高 **148px**（mobile）/ **148px**（desktop）
- iOS Safari sticky の jitter：`transform: translate3d(0,0,0)` でフォールバック
- chips 行の右端に固定 sort dropdown、左に sector chips 横スクロール（scroll-snap）

#### 4.3.1 Sector chips

- データソース：`data.sectors.json`（JILPT 大分類、10-12 項目）
- 単一選択、デフォルト `[全て]` ハイライト
- 選択状態：背景 `--orange`、文字 `--cream`
- 切替 → URL に `?sector=<key>` を書き → segmented view を切替

#### 4.3.2 Sort dropdown

- 選択肢：`AI影響↓` / `AI影響↑` / `年収↓` / `就業者数↓`
- デフォルト `AI影響↓`
- 切替 → URL に `?sort=<key>` を書き → 現 sector の treemap を再配置

#### 4.3.3 検索ボックス

- 行動は Design.md §7.12 desktop hero search と完全に同じ（autocomplete → `/ja/<id>` に遷移）
- map 内では「ハイライト / focus」を行わない、検索 = サイト全体のショートカット遷移
- タッチステートマシンは §2.5 / Design.md §7.12 を継承（`TAP_SLOP_PX=10` / `TAP_MAX_MS=500`）、全サイト統一

---

### 4.4 `/map` ページ — Sector segmented treemap

**コア：552 マス を 1 画面に詰め込まない**。sector 単位でセグメント、各セグメントは独立の treemap。

```
┌──────────────────────────────────────┐
│ 事務  (43 職業)              [折りたたみ]│  ← sector header
│ ┌──────────────────────────────────┐  │
│ │  treemap (この sector 内の職業)   │  │  ← 高さ = sqrt(職業数) × scale
│ └──────────────────────────────────┘  │
├──────────────────────────────────────┤
│ 専門・技術  (98 職業)        [折りたたみ]│
│ ┌──────────────────────────────────┐  │
│ │  treemap                          │  │
│ └──────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- `sector chip = 全て` のとき：全 sector セグメントを縦に列挙、各セグメント折りたたみ可
- `sector chip = 事務` のとき：`事務` セグメントだけ表示、自動展開でビューポートを満たす
- 各セグメント内部は squarified treemap（Design.md §5 と同じ）
- min cell size = **44px²**（タッチターゲット）、閾値以下は段末「その他 (n 職業)」にマージ
- セグメントヘッダは sticky 副題（スクロール時に追従）
- カラー token / 透明度 / 文字色戦略：100% Design.md §5 を再利用（視覚一貫性は硬性制約）

**fallback（D4 退避案 A）**：セグメント view 実装コストが過大なら → 単一の squarified treemap に退却、pinch-to-zoom を追加、この退化経路は PR 説明で必ず明記。

---

### 4.4.1 再レンダリング契約（scroll 破壊不可・硬性ルール）

> v1.3.x モバイル滑動 bug から逆引きで導出：treemap 再レンダリングは必ずユーザーの scroll 位置を守る。本セクションのルールは **`/map` 上の全ての動的再配列ロジック** に適用（`renderMap` / `renderList` / エラー状態 / 将来のあらゆる `$content` 内容置換入口）。

#### A. DOM 置換：原子操作、wipe-and-rebuild 禁止

| | 書き方 | 結果 |
|---|---|---|
| ❌ 禁止 | `el.innerHTML = ''` の後 `appendChild(frag)` | 第 1 行が同期的に reflow を起こし、ドキュメント高さが 0 に潰れる、ブラウザは即座に `scrollTop` を 0 に clamp、append 後コンテンツは戻るが scroll は書き換え済。**ユーザーが頂上に飛ばされる** |
| ✅ 必須 | `el.replaceChildren(frag)` | 単回原子 DOM 操作、ドキュメント高さは旧値から新値へ直接ジャンプ、**中間フレーム 0 を経由しない**。`scrollTop` は新高 < 現 scrollY のときのみ clamp（境界ケース） |

互換性：Safari 14+ / Chrome 86+ / Firefox 78+。これ以下のバージョンは無視可（サイト想定ユーザーは 2026 年新デバイス）。

#### B. resize トリガー：コンテナ幅が本当に変わる時のみ再配置

squarified layout は `$content.clientWidth` のみに依存（[map.html](../map.html) `renderMap` / `mergeSmallCells` / `squarify` は全て幅で面積計算）。コンテナ高さはデータ駆動（`sectorContainerHeight(recs.length)`）、ビューポート高さに無関係。

**したがって**：モバイルブラウザの URL bar 収納で発火する `window.resize`（高さ変化のみ）は **絶対に** 再配置をトリガーしない。

| | リスナー | いつ発火 |
|---|---|---|
| ❌ 禁止 | `window.addEventListener('resize', …renderMap…)` | URL bar 収納、キーボード起動、デバイス回転 height 変化 — 大多数の場合 width は変わらず、無意味な CPU + バッテリー消費 |
| ✅ 必須 | `ResizeObserver(el)` でコンテナ自体を監視、コールバック内で `prevWidth` をキャッシュし、width 未変化なら early-return | `$content` の本物の width 変化時のみ発火（デバイス回転 / PC ウィンドウドラッグ / 将来 sidebar レイアウト導入時にも正しく応答） |

#### C. 3 層防御縦深（互いに直交、単層失効でも他 2 層がフォールバック）

| 層 | 実装 | 役割 |
|---|---|---|
| L1 | `replaceChildren` 原子置換 | **根本治療**：いかなるトリガー源でも scroll 紛失不可 |
| L2 | width キャッシュで early-return | **節流**：不要な squarify 再計算を避ける |
| L3 | `ResizeObserver($content)` で `window.resize` を代替 | **精度 + future-proof**：window 幅 ≠ コンテナ幅のケースでも正しく応答 |

#### D. 回帰検証（人手 · 実機）

`renderMap()` / `renderList()` / `$content` への書き込みロジックを変更するたびに、モバイル実機で以下のユースケースを通すこと：

1. `/map` を開く → 2 画面分スクロール → さらにスクロール（URL bar 収納の典型シナリオ）→ scroll 位置が変わらない
2. 上スクロールで URL bar 再表示 → scroll 位置が指に正しく応答
3. デバイス横縦切替 → 再配置発生、scroll は視覚アンカー保持（微小オフセット許容、頂上ジャンプ不許可）
4. sector chip 切替 → 頂上ジャンプ許容（能動操作）
5. sort dropdown 切替 → 頂上ジャンプ許容（能動操作、将来 scroll 保持希望ならば追加保護が必要）

---

### 4.5 `/map` ページ — Bottom sheet

任意 cell タップで起き上がる。

```
┌──────────────────────────────────────┐
│       ━━━━━ (drag handle)             │
├──────────────────────────────────────┤
│ データ入力                       ✕     │  ← タイトル + close
│ 🏆 ランキング 第 1 位                  │  ← optional badge
│                                        │
│  AI 影響度    10/10  ▲ 大きく変わる仕事 │
│  年収         356 万円                 │
│  就業者数     16 万人                  │
│                                        │
│ ┌──────────────────────────────────┐  │
│ │     詳細を見る  →                  │  │  ← primary CTA → /ja/<id>
│ └──────────────────────────────────┘  │
└──────────────────────────────────────┘
```

#### 閉じる操作（D3 = A）

- Drag handle 下プルで close（速度閾値 > 0.3 px/ms で即時、緩慢なら位置で判断）
- 背景 backdrop タップで close（半透明遮罩 `--ink` @ 40% alpha）
- ✕ ボタンで close
- iOS safe area inset：`padding-bottom: env(safe-area-inset-bottom)`

#### 内容（D2 同意）

- フィールド：職業名 / ランキング徽章（ランキング ≤ Top 50 のときのみ） / AI影響度 / 年収 / 就業者数 / CTA / ✕
- 隣接職業を含めない（詳細ページの仕事）
- データソース：`data.treemap.json` に既存、追加 fetch なし

#### 視覚

- 高さ：内容に自適、max-height 50vh
- 角丸：`border-radius: 16px 16px 0 0`
- 背景 `--cream`、shadow `0 -8px 24px rgba(36,30,24,0.16)`
- 入場アニメ：`transform: translateY(100%) → 0`、`cubic-bezier(0.16, 1, 0.3, 1)`、280ms
- Design.md §9.4 `prefers-reduced-motion` を遵守 → アニメをスキップ即時表示

---

### 4.6 URL state & deep-link（D5 = B）

```
/map                           デフォルト（全 sector + AI影響↓）
/map?sector=事務               単一 sector view
/map?sector=事務&sort=salary   単一 sector + カスタムソート
/map?job=12345                 自動で該職業の bottom sheet を開く（deep-link）
/map?sector=事務&job=12345     組み合わせ
```

- `URLSearchParams` で双方向 bind、router ライブラリ不要
- chip / sort 切替 / bottom sheet オープン → `history.replaceState`（履歴スタック汚染回避）
- bottom sheet クローズ → `?job` パラメータを削除
- ブラウザ back：`/map` から前ページに戻る（デフォルト挙動）、`/ja/<id>` から `/map?job=<id>` に戻ったとき自動で sheet を開く（referrer 判定、best-effort）
- 存在しない `?sector=` key → `全て` にフォールバック + console warn

---

### 4.7 SEO

```html
<title>職業マップ｜全 552 職業 × AI 影響度ヒートマップ — Mirai-Shigoto</title>
<meta name="description" content="日本の全 552 職業を就業者数 × AI 影響度で可視化。事務、専門・技術、サービス…分野別に AI で大きく変わる仕事を一目で確認。">
<link rel="canonical" href="https://mirai-shigoto.com/map">
<meta property="og:title" content="…（同 title）…">
<meta property="og:image" content="https://mirai-shigoto.com/api/og?page=map">
<meta property="og:url" content="https://mirai-shigoto.com/map">
```

- **OG image**：`api/og.tsx` を拡張、`?page=map` 受領、「全 552 職業」+ サムネスタイル出力
- **schema.org**：`Dataset` 全体記述 + `ItemList` で Top 50 職業を列挙（ranking 順）
- `?sector=` クエリ用に別 canonical は作らない、全クエリは同一 canonical `/map`
- `?sector=` 派生 URL を sitemap.xml に追加（10-12 件）、priority 0.7

---

### 4.8 Analytics events

GA4 カスタムイベント 4 個、全て `analytics/` spec に新増：

| Event | トリガー | params |
|---|---|---|
| `map_open` | `/map` ページ load 完了 | `referrer: 'home_card'` / `'direct'` / `'detail'` |
| `map_filter` | sector chip / sort dropdown 切替 | `sector: <key>`, `sort: <key>` |
| `map_cell_tap` | 任意 cell クリック（bottom sheet 起き上がる） | `job_id`, `sector`, `rank` |
| `map_detail_click` | bottom sheet「詳細を見る」クリック | `job_id` |

4 件セット analytics scripts（CF / GA4 / Vercel WA / Vercel Speed Insights）は必ず全て `map.html` `<head>` に入れる（PII / 一貫性硬性ルール）。

---

### 4.9 Loading / Skeleton / Error

- Sticky 領域（header / search / chips）は即時レンダリング（HTML inline）
- Treemap 領域初期は skeleton 表示：各 sector セグメントに浅灰矩形 + 「読み込み中…」
- `data.treemap.json` は `<link rel="preload" as="fetch" crossorigin>` で `<head>` 起動
- Fetch 成功 → `requestIdleCallback` でレンダリング（sticky の interactive をブロックしない）
- Fetch 失敗 → 「データを読み込めません。 [再読み込み] 」ボタン（`location.reload()`）
- 遅い 3G タイムアウト（>10s）→ 同じ失敗メッセージを表示

---

### 4.10 Build pipeline（サムネ）

`scripts/build_occupations.py` 拡張：

1. `data.treemap.json` 生成後、新ステップ `generate_map_thumbnail()` を追加
2. `dist/map-thumb.snippet.html` を出力（inline `<svg>` 文字列の塊）
3. `index.html` mobile preview カード位置で build-time include で注入（実行時 fetch ではない）
4. SVG 簡略化戦略：
   - 面積上位 Top 30 職業のみ選び（残りは底部「その他」にマージ）
   - カラーは Design.md §2.1 Treemap 配色関数を使い、精度を 5 段に下げる
   - 出力サイズ目標 < 4KB inline
5. include 機構：build スクリプトで `{{INCLUDE map-thumb}}` プレースホルダ → sed 置換

---

### 4.11 Sitemap / Footer / 閉ループ nav

- `sitemap.xml`：`/map` を追加（priority 0.9, changefreq monthly）+ `/map?sector=*`（priority 0.7）
- `map.html` footer：Design.md §7.10 を完全再利用（Privacy / About / Compliance / Data source）
- Footer 全サイト統一：Design.md §7.13 footer follow + share 領域に「職業マップ」リンクを追加（位置：「About」隣）
- **`/ja/<id>` 詳細ページ底部に「← 職業マップへ」リンク追加**（D6）：永遠にクエリ無しの `/map` に遷移、ユーザーが再選択できるように
  - 位置：Design.md §7.10 footer の上、詳細本文の下
  - 文言 JA only
  - `build_occupations.py` テンプレ + 全生成ページに影響（PII audit 経験：テンプレと生成ページ両方を改める）

---

### 4.12 PC 端の挙動

- PC `/` は完全に変更なし、mobile preview カードを **表示しない**
- PC で `/map` にアクセス → mobile レイアウトと同じ、`max-width: 900px; margin: 0 auto`
- PC `/map` 用に別途 2 度目の設計はしない（直リンク / 共有用、主力体験は `/`）

---

### 4.13 A11y（PENDING — 判断待ち）

最低線（後で何が決まろうとやる）：
- treemap canvas に `role="img"` + `aria-label="552 職業の AI 影響ヒートマップ"`
- すべての chips / dropdown / bottom sheet はネイティブ `<button>` / `<select>` を使う
- Sticky 領域のキーボード focus visible（Design.md §9.3 継承）
- Reduced motion → bottom sheet が 280ms アニメをスキップ

**判断待ち**：「リスト表示に切り替え」toggle を作るか、screen reader / キーボードユーザーのフォールバックとして `<ol>` 版を出力するか？
- 工数：~半日
- 効果：treemap は SR ユーザーに完全に使用不可、リストはフォールバック
- PC treemap も同じく SR フォールバックなし（Design.md §10 現状）→ 一貫性の論点で「やらない」も通る

> 判断保留、§4 実施時は「最低線」のみ実施、リスト toggle は後続で判断。

---

### 4.14 本期スコープ外

- Dark mode 専用適応（サイトに dark ベースあり、Design.md §3 継承、現状単一テーマ）
- 横画面専用最適化（縦画面ベースで作り、横画面は自然展開）
- PWA / Service Worker
- 多言語（JA-only は v1.4.0 でロック済み）

---

### 4.15 やらないこと

- ❌ `/map` ページの主要レイアウト判断（sticky 3 層 / sector segmented / bottom sheet / URL state）を本仕様の合意なしに変更する
- ❌ §4.4.1 再レンダリング契約に違反する（`innerHTML = ''` + `appendChild` / `window.resize` 直結 renderMap）
- ❌ 詳細ページの「← 職業マップへ」リンクを削除（D6、閉ループ navi の硬性要件）
- ❌ Mobile トップから map preview カードを削除する（IA 判断、§4.1）

---

## 5. 本ファイル変更フロー

1. PR 説明に「本変更は Design-Mobile.md §X.Y に関係」を明記
2. 同一 PR 内で Design-Mobile.md とコードを同時修正（片方だけの修正は許可しない）
3. Design.md 共有章（§2 token / §3 テーマ / §4 ブレークポイント / §5 treemap / §6 tooltip / §7 components 等）に同時に関係する場合、両ファイルを同期修正、同一 PR で完了
4. 視覚レイヤー変更は before/after スクリーンショット添付（≥768 + ≤480 各 1 枚）
5. §6 改訂履歴に追加：日付 / 該当章 / 一文の理由

---

## 6. 改訂履歴

| 日付 | 章節 | 変更 | 理由 |
|---|---|---|---|
| 2026-05-06 | 全文 | ファイル作成 | Design.md からモバイル専用内容を分離（原 §6.2 / §6.3 / §6.5 / §6.6 / §6.7 mobile tooltip → 本ファイル §2、原 §7.11 Mobile Hero → §1、原 §8 モバイル自適 → §3、原 §16 `/map` 仕様 → §4）。共有基盤（カラー token / フォント / 間隔 / テーマ / ブレークポイント / treemap 視覚 / 共通コンポーネント / PC hero / a11y / palette ガイドライン）は Design.md に残す。`/m/*` アーキテクチャ存档 `MOBILE_DESIGN.md` は同時に削除（v1.1.0 で 4 ヶ月廃止、active 参照ゼロ）。Q1=C / Q2=A / Q3=B 判断は CHANGELOG 参照 |
| 2026-05-06 | §4.4.1 新増 | 「再レンダリング契約（scroll 破壊不可・硬性ルール）」新増 | モバイル実機 bug：ユーザーが下スクロールするとページが頂上に弾き戻される。根本原因は `window.resize`（URL bar 収納でトリガー）が `renderMap()` を呼び、内部で `innerHTML = ''` → `appendChild` の 2 ステップ、第 1 ステップが同期 reflow を起こしドキュメント高が 0 に潰れ、ブラウザが `scrollTop` を 0 に clamp。「原子置換 + 幅変化時のみ再配置」を `/map` 再レンダリング硬性ルールとして規範化、3 層防御縦深と実機回帰検証リスト付き |
| 2026-05-13 | §0.1 引用表 | Phase A 文書整合（Design.md §0.2 / §2 / §3 / §18 書直しと連動） | 引用表に 🟢 LIVE / ⚠️ 監査待ち / NEUTRALIZED ステータスマーカーを行ごとに追加、「Design.md のどの章が信頼できる / どれが Gen 1 化石で監査待ち」を明示化、Design.md §18 スタイルアーキテクチャ契約の引用行を新増。本ファイルのモバイル専用 §1-§5 内容は変更なし（全て LIVE）。ゼロコード変更 |
| 2026-05-13 | 全ファイル | **日本語化 + 大幅 enrich**（Phase A.5） | これまでの仕様は中国語 + 英語混在で書かれていたが、サイトが JA-only であり開発ドキュメントを GitHub 公開する方針に合わせ、全文を日本語化。同時に各章を enrich：§1 Mobile Hero に「過去の問題」「やらないこと」追加、§2 各サブセクションを構造化（touch-mode 入口 / tap-outside / close button / CTA / touch ステートマシン）、§3 各ブレークポイントを論理ブロック分け（Layout / Mobile Hero / Intro / Controls / Tooltip / Meta Card / Treemap）、§4 各サブセクションに「やらないこと」追加、特に §4.4.1 再レンダリング契約の 3 層防御 + 5 件実機検証を明文化。中国語版を `docs/_archive/Design-Mobile.zh-phase-a.md` にバックアップ保存（git の `.gitignore` 下に留まり、公開には影響しない）。本ファイルが今後 GitHub に上がる際の正式版 |
| 2026-05-15 | §0.1 / §6 | 文書 git 公開化（commit `282fda41 chore(docs): un-gitignore docs/`）に追随。`docs/_archive/` 全件削除 — Phase A.5 のバックアップは目的達成、現状の日本語版が正本として確立した。Design.md §18 が参照する `spoke-hub-graph.ts` / `spoke-spoke-graph.ts` の行番号ズレは Design.md 側で訂正（本ファイルは引用のみ）。Phase B/C/D/E の architecture refactor（`src/graph/` 新規 / 全 view 層 + template 層構築 / page slim-down 完了 / `src/page-data/` 層導入）は本ファイルのモバイル仕様 §1-§5 とは独立、引き続き LIVE。ゼロコード変更 |
| 2026-05-18 | §1 / §3 (新 RA-015 lite) | **RA-015 lite モバイル隠し見出し降格** モバイル専用ブロック (`.mobile-hero` / `.m-top10` / `.m-map-preview` / `.m-map-head`) 内の `<h2>` 4 件を `<p role="heading" aria-level="2">` に変更。Design.md §15 RA-015 entry 参照。背景：desktop で `display:none` の H2 は AT に読まれないが、source-grep / outline tool 上で重複に見えていた。P3-2 フル DOM 分離 (Vercel Edge Middleware UA 分割) は別 PR。本ファイル §1 (Mobile Hero) の visual / interaction 仕様は変更なし — `.mobile-hero-title` の見た目 (size 1.35rem / `--orange` 強調) は CSS class セレクタで継続的に適用される。完全な P3-2 (DOM 分離) は後続 PR で議論 |
| 2026-05-18 | §1 / §3 / §4 | **モバイル UI/UX 監査 RA-006 / RA-009 / RA-014 (Design.md §15 と連動)** Chrome MCP iframe (srcdoc 375×812) で実測したモバイル特有問題に対する修正を本ファイル側に反映：(1) **§1 (Mobile Hero)**：影響なし（既存 §1.1-§1.4 の仕様は LIVE のまま）。ただし RA-006 で `_index-css.ts` の `.m-top10` (Variant C TOP 10 carousel) に `overflow-x: clip` 追加、iPhone 視口で document overflow 0px (was 8px) を達成。仕様変更は不要 — TOP 10 carousel の `margin: 0 -20px` ブリードは元設計通り、防御は親要素 contain で十分。(2) **§3 (モバイル自適規則)**：footer-links の tap target padding を `5px 14px` → `8px 14px` + `min-height: 28px` に変更（WCAG 2.5.8 24px 適合）。`canonical-css.ts` の `html body footer.site-footer .footer-links a` で実装。(3) **§4 (`/map` ページ)**：`<main>` を `<article aria-label="職業マップ">` に変更（BaseLayout が global `<main id="main-content">` を提供するため、ネスト回避）。ページ層の semantic 明確化のみ、視覚 / 挙動変更なし。(4) **mob-drawer 改善（cross-cutting）**：drawer 内 `<h3 class="mob-drawer-title">` を `<p role="heading" aria-level="2">` に変更、`display:none` 状態の drawer が page heading outline を 3 重複させていた問題（Chrome MCP 計測で hidden_dup_h2=4, hidden_dup_h3=3）を解消。`MobileNav.astro` と `index-source.html` の両方で適用。(5) **`/map` 単独ページ SEO**：tag `552 職業` を `OCCUPATION_COUNT.SCORED` 由来の一貫値に統一（Design.md §15 の RA-003 と同期）。**ゼロ仕様変更**（実装側のみ）— モバイル fundamentals (Mobile Hero / Tooltip / `/map` 再レンダリング契約) はすべて LIVE のまま |

---

> サイト：https://mirai-shigoto.com
