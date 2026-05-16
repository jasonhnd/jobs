# SITE_FULL_VISION.md — mirai-shigoto.com 全体ビジョン

> **状態**: 実装ロードマップ確定（2026-05-09 拍板済）→ 構造実装フェーズほぼ完了（2026-05-15 時点）。L2 explore + L3 全 genre family の **page routing + 投影 + JSON-LD + OG image** は構造実装済、深編集（persona / Q&A 本文 / 比較記事 / 注解）は継続中。
> **適用範囲**: サイト全体の最終形態 + 実装順序
> **ベース**: 全コードを精読した上での実測 + 拡張計画
> **関連**: [WORKFLOW.md](./WORKFLOW.md) (作業ルール) ・ [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md) (データ規約) ・ [architecture.md](./architecture.md) (5 層アーキテクチャ詳細)
>
> **歴史メモ**: HUB_EXPANSION_PLAN.md（v0.2、140 hub プラン）は本ファイルが上位互換で包含、2026-05-14 削除済。

---

## 0. 拍板済の 5 項目（このドキュメントの前提）

| 項目 | 決定 | 進捗（2026-05-15）|
|---|---|---|
| 1. 総ページ規模 614 → 820 (+206) | ✓ | 構造実装済(全 genre route family 存在)、深編集継続 |
| 2. 着手順序: 興味タイプ / スキル / 比較 を最優先 (★★★) | ✓ | **§12 の Phase 1 該当** route + 投影 + JSON-LD は完了、深編集が継続 |
| 3. Q&A 36 + キャリア 10 = 46 手書 hub にコミット | ✓ | route 存在、内容深編集は継続作業 |
| 4. `api/og.tsx` 全 mode 拡張を並行実施 | ✓ | `src/views/og-cards.ts` 構築済([architecture.md](./architecture.md) §11 Step 9) |
| 5. ドキュメント整備: 本ファイル + HUB_EXPANSION_PLAN.md 並列保持 | ✓→✗ | HUB_EXPANSION_PLAN.md は本ファイルが上位互換のため 2026-05-14 削除、本ファイル単独で保持 |

---

## 0.5. 二つの「Phase」命名の整理（重要）

このプロジェクトには **同名異種の "Phase" が 2 系統** 存在する。読み違えを避けるため、本節で明確化:

| 系統 | 出典 | 何 | 単位 | 現状 |
|---|---|---|---|---|
| **本ドキュメント §12 の Phase 0-6** | SITE_FULL_VISION.md | **機能拡張ロードマップ** — 新 hub family / 新 ranking / 新 Q&A / persona 系の追加。content / SEO / UX の "ページが何を読者に届けるか" の進化を扱う | 「読者向けに新しい体験を出す」単位 | Phase 0-5 の **構造実装は完了**(全 route family が存在 + 投影 + JSON-LD + OG image)、Phase 6 と各 hub の **深編集は継続作業**(5-6 ヶ月並行) |
| **[architecture.md](./architecture.md) §11 + §15 の Phase B/C/D/E** | architecture.md | **コードアーキテクチャ refactor** — 5 層契約(Sources / Graph / Views / Templates / Pages)の確立 + Strangler Fig 移行 + SafeHtml 境界閉環 + CI 関門整備。Code organization / boundary / safety guard の進化を扱う | 「`src/data/lib/*-hub.ts` から `src/views/` + `src/templates/` への移送 1 ファイル」単位 | **Phase B/C/D/E 全完了**(2026-05-15)。Phase E で `src/page-data/` 中間層追加、views から fs read 完全排除。残りは Step 11(inline JS 1881 行抽出)+ profile5/transfer_paths の graph schema 統合のみ |

**両者は直交関係**。同時並行で進行可能、互いに前提でも結果でもない。本ドキュメントを読むときの目安:

- 「新しい職業ページを出すか / Q&A を増やすか」の議論 → 本ドキュメント §12
- 「ファイルをどこに置くか / 何が何を import してよいか」の議論 → [architecture.md](./architecture.md) §2 + §11

**最近の commit history を読むときの目安**:

- `refactor(phase-b/c/d/e)` プレフィックスは **architecture.md の Phase**(コード移送)
- `feat(ranking)` / `feat(sectors)` / `feat(q)` 等の content 追加 commit は **本ドキュメントの Phase**(機能)

両 Phase 系統は意図的に独立させてある。重構 commit が機能変更を含まないことを SEO baseline byte-compare(architecture.md §7)で構造的に保証している。

---

## 1. 技術スタック（v1.5.0、2026-05-09 以降の現実）

```
Astro 5.1 (静的) + React 18 (Edge のみ) + TypeScript strict + Zod 検証
                            ↓
       Vercel hnd1 (東京エッジ) · 25 秒 build · 5 秒デプロイ
```

- Python pipeline 完全削除（PR 38 完了）
- `scripts/` ディレクトリには `seo-check.sh` だけ残存
- 全 build / projection / render が TypeScript

---

## 2. データフロー（実コード確認済）

```
data/<source>/                          ← 手維持の真理 (git tracked)
├── occupations/<id>.json × 556         IPD source
├── stats_legacy/<id>.json × ~552       労働市場 stats
├── scores/<scope>_<model>_<date>.json  AI 評分 (append-only)
├── sectors/{sectors.ja-en, overrides}  16 sector + 上書き
├── labels/<dim>.ja-en.json × 7         skill/知識/能力/興味/価値観等
├── translations/en/<id>.json × ~552    EN 翻訳 (v1.4.0 以降未使用)
├── prompts/prompt.{ja,en}.md           採点プロンプト
└── rationales/batch_<n>.json × 40+     AI 理由文の束
                       │
                       ▼ npm run build:data → src/data/build.ts
                       │
            ┌──────────────────────────┐
            │ buildIndexes() (Zod 検証)│ src/data/lib/indexes.ts
            │  - occById Map           │
            │  - statsById Map         │
            │  - latestScoreByOcc      │
            │  - sectorByOcc (resolver)│ src/data/lib/sector-resolver.ts
            │  - labelsByDim           │
            │  - historyByOcc (sorted) │
            └──────────────┬───────────┘
                           ▼
            ┌──────────────────────────────────────────────┐
            │ 12 投影 順次実行 (src/data/projections/*.ts) │
            │   1. sectors        16 + uncategorized       │
            │   2. labels         ja.json                   │
            │   3. profile5       5 軸 radar               │
            │   4. treemap        552 records              │
            │   5. search         556 docs                 │
            │   6. transfer_paths cosine, MIN_SIM 0.3      │
            │   7. detail         556 files                │
            │   8. tasks          556 files (未消費)       │
            │   9. skills         31 files (未消費)        │
            │  10. holland        RIASEC 6 dim (未消費)    │
            │  11. featured       12 picks (未消費)        │
            │  12. score_history  556 files (未消費)       │
            └──────────────┬───────────────────────────────┘
                           ▼
        public/data.*  (gitignored、build 時再生成)
                           │
                           ▼  npm run build → astro build
                ┌──────────────────────────┐
                │ Astro 静的レンダリング   │
                │ src/pages/*.astro        │
                │ + getStaticPaths × 556   │
                │ + sectors × 16           │
                │ + rankings × 9           │
                └──────────┬───────────────┘
                           ▼
        dist-astro/ (Vercel 専用、gitignored)
```

---

## 3. 現状ページ全数（実測 = sitemap が emit する 606 URL）

| カテゴリー | 数 | URL pattern | 実装 |
|---|---|---|---|
| **顶层** | 6 | `/` `/map` `/about` `/privacy` `/compliance` `/404` | src/pages/*.astro |
| **機械** | 6 | `/sitemap.xml` `/image-sitemap.xml` `/llms.txt` `/llms-full.txt` `/robots.txt` `/og.png` | dynamic + public/ |
| **API Edge** | 3 | `/api/og` `/api/feedback` `/api/subscribe` | api/*.{tsx,js} |
| **map filter variants** | 16 | `/map?sector=<id>` × 16 | sitemap entry のみ |
| **中层 sectors** | 17 | `/ja/sectors/` + 16 sectors | sectors/[sector].astro |
| **中层 rankings** | 10 | `/ja/rankings/` + 9 rankings | rankings/[type].astro |
| **底层 spokes** | 556 | `/ja/<id>` × 556 | [id].astro |
| **総計** | **614** | | |

**現中层 hub: 17 + 10 = 27（業種 + ランキング のみ）**

---

## 4. 既に emit されているが UI 未消費の資産

build:data が出すが、現状どのページも読んでいない（= "untapped 資産"）：

| 投影 | 含む内容 | 潜在的用途 |
|---|---|---|
| `data.tasks/<id>.json` × 556 | 各職業の最大 37 タスク × {実施率, 重要度} | task-level AI risk hub / heatmap |
| `data.skills/<key>.json` × 31 | スキル別職業ランキング | スキル別 hub（即作れる） |
| `data.holland.json` | RIASEC 6 dim per occupation | 興味タイプ hub × 6（即作れる） |
| `data.featured.json` | 12 picks (high AI risk × high workforce) | TOP page hero / 注目セクション |
| `data.score-history/<id>.json` | 各職業の score 履歴 | 評価変化 hub / 年次 hub |
| `data.profile5.json` | 全 occ の 5 軸 | spoke で消費中 ✓ + 5 軸 hub × 5 可能 |
| `data.review_queue.json` | 未分類職業 + 曖昧なやつ | 内部メンテ用 |
| labels/work_values + work_characteristics + work_activities | 12 + 39 + 41 dim | 価値観 / 業務形態 hub の data 源 |

**12 投影中 4 個 (detail / sectors / rankings / treemap) しか消費されていない**。残り 8 投影は消費 page 待ち。

---

## 5. 完成形の全 sitemap（820 ページ）

```
mirai-shigoto.com/
│
├── /                                    [TOP] homepage
├── /map                                 [TOP] full-screen treemap
├── /about /privacy /compliance /404     [TOP]
│
├── /api/og  /api/feedback  /api/subscribe   [Edge]
│
├── /sitemap.xml /image-sitemap.xml /llms.txt /llms-full.txt /robots.txt /og.png
│
└── /ja/
    │
    ├── (新) /ja/explore/by-{...}           [L2 routes × 7]
    │   ├─ by-industry        → /ja/sectors/
    │   ├─ by-ranking         → /ja/rankings/
    │   ├─ find-your-fit      → /ja/q/ + careers/ + interests/ + values/
    │   ├─ by-skill-and-license → /ja/skills/ + licenses/ + abilities/ + knowledge/ + education/
    │   ├─ by-work-style      → /ja/work-styles/ + employment-types/ + training/ + life-balance/
    │   ├─ compare            → /ja/compare/
    │   └─ methodology-trust  → /ja/about/methodology + glossary + data-sources + yearly/
    │
    ├── /ja/sectors/                     [既存 17]
    ├── /ja/rankings/                    [既存 10 → 42（+32）]
    ├── (新) /ja/q/                      [Q&A × 36]
    ├── (新) /ja/careers/                [キャリア段階 × 11]
    ├── (新) /ja/licenses/               [資格 × 16]
    ├── (新) /ja/skills/                 [スキル × 11] ★★★
    ├── (新) /ja/abilities/              [能力 × 9]
    ├── (新) /ja/knowledge/              [知識 × 6]
    ├── (新) /ja/interests/              [RIASEC × 7] ★★★
    ├── (新) /ja/values/                 [価値観 × 7]
    ├── (新) /ja/education/              [学歴 × 7]
    ├── (新) /ja/training/               [修行期間 × 5]
    ├── (新) /ja/work-styles/            [業務形態 × 7]
    ├── (新) /ja/employment-types/       [雇用形態 × 5]
    ├── (新) /ja/compare/                [比較 × 13] ★★★
    ├── (新) /ja/life-balance/           [ライフ整合 × 6]
    ├── (新) /ja/entry-paths/            [入職経路 × 5]
    ├── (新) /ja/yearly/                 [年次 × 4]
    ├── (新) /ja/about-trust/            [信頼性 × 4]
    │
    └── /ja/<1-556>                      [底层 spoke × 556、深編集対象]
```

---

## 6. 完成時の規模確定

| 層 | 現状 | 目標 | 増分 |
|---|---|---|---|
| 機械系 (sitemap, robots etc) | 6 | 6 | — |
| API Edge | 3 | 3 | — |
| **顶层** | 6 | 6 | — |
| L2 explore routes (新) | 0 | 7 | +7 |
| L3 sectors (16 + index) | 17 | 17 | — |
| L3 rankings (9 + index) | 10 | 42 | **+32** |
| L3 q/ (Q&A) (新) | 0 | 37 | **+37** |
| L3 careers (新) | 0 | 11 | +11 |
| L3 licenses (新) | 0 | 16 | +16 |
| L3 skills (新) | 0 | 11 | +11 |
| L3 abilities (新) | 0 | 9 | +9 |
| L3 knowledge (新) | 0 | 6 | +6 |
| L3 interests (新) | 0 | 7 | +7 |
| L3 values (新) | 0 | 7 | +7 |
| L3 education (新) | 0 | 7 | +7 |
| L3 training (新) | 0 | 5 | +5 |
| L3 work-styles (新) | 0 | 7 | +7 |
| L3 employment-types (新) | 0 | 5 | +5 |
| L3 compare (新) | 0 | 13 | +13 |
| L3 life-balance (新) | 0 | 6 | +6 |
| L3 entry-paths (新) | 0 | 5 | +5 |
| L3 yearly (新) | 0 | 4 | +4 |
| L3 about-trust (新) | 0 | 4 | +4 |
| **底层 spoke** | 556 | 556 | — |
| **総計** | **614** | **820** | **+206** |

---

## 7. 主要 reader フロー (5 path)

```
Path 1: SEO 長尾 query → spoke 直着
  Google "豆腐職人 AI 影響"  →  /ja/1
    ↓ spoke 底部 8-12 反向 hub link
  /ja/sectors/seizo  /ja/rankings/ai-risk-low  /ja/q/ai-de-kienai etc.
    ↓
  別の spoke → 反向 link → ...無限回遊

Path 2: SEO 中層 query → hub 直着
  Google "AI でなくならない仕事"  →  /ja/q/ai-de-kienai
    ↓ 150 字直答 + 500 字根拠 + TOP10 例
  /ja/<候補 spoke>  →  ...

Path 3: ブラウズ from TOP
  /  →  /ja/explore/find-your-fit  →
  /ja/interests/  →  /ja/interests/realistic  →  /ja/<id>

Path 4: 比較 → 決断
  Google "看護師 介護福祉士 違い"  →  /ja/compare/kango-vs-kaigo
    ↓ 比較表 + 結論
  spoke 選択

Path 5: マップ視覚探索
  /map  →  バブル click  →  /ja/<id>
```

---

## 8. 各層の visible char と編集量

| 層 / page type | 現実測 char | 目標 char | 編集者作業 |
|---|---|---|---|
| `/` (TOP, index-source.html) | 5,000+ | 維持 | 触らない |
| `/map` | 動的 | — | 動的 viz |
| 業種 hub (例: iryo.html) | ~1,925 | ~3,000 | +intro+pattern+findings+notes |
| ランキング hub (例: ai-risk-low) | ~1,797 | ~2,500 | +pattern 観察 + 注解 |
| Q&A hub | — | ~1,500 | 全面手書 (lead+根拠+例) |
| 比較 hub | — | ~1,500 | 全面手書 (両者比較) |
| キャリア段階 hub | — | ~2,000 | persona 框架手書 |
| 資格 / スキル / 能力 / 知識 hub | — | ~1,500 | 説明 + 一覧 |
| 興味 / 価値観 hub | — | ~1,500 | type 説明 + 30 職業 |
| 学歴 / 修行 / 業務形態 / 雇用 / ライフ / 入職 | — | ~1,300 | 短文 + 一覧 |
| 年次 hub | — | ~3,000 | 年次レポート長文 |
| 方法論 / 用語 / 出典 | — | ~2,500 | 信頼性長文 |
| **底层 spoke** (例 /ja/1) | 既存 ~4,000 | ~5,500 | 著者深編集（手） |

**全編集量推算**:
- 中层新増 ~200 hub × 平均 1,800 字 ≈ **36 万字**
- spoke 556 × +1,500 字 ≈ **84 万字**
- **合計 約 120 万字**（≈ 5-6 ヶ月編集ペース、1 日 5,000 字）

---

## 9. 視覚言語の統一（実装済の Direction C）

**Single source of truth**:
- Color: `styles/mobile-tokens.css`
- Typography baseline: `src/lib/canonical-css.ts`（全 page Footer.astro 経由で global emit）

**統一済**:
```
Color tokens
  --bg #FAF6EE     warm cream
  --accent #D96B3D terracotta
  --accent-2 #6E9B89 sage
  --accent-deep #48705F sage deep

Risk pills
  low (sage)  ≤ 3.9
  mid (gold)  ≤ 6.9
  high (terracotta)  > 6.9

Type
  H1-H3: Noto Serif JP (1.7rem / 1.15rem / 1rem)
  body: Plus Jakarta Sans + Hiragino Sans (16px / 1.75)

Layout
  spoke wrapper: max-width 780px
  hub wrapper:   max-width 980px
  全 page footer: 統一 .site-footer (Footer.astro)
```

**未来 hub 全部、この token を継承**。新 genre ごとに hue（補助色）を 1 個追加可能（例: Q&A hub = mid green pill, 比較 hub = split-bg）。

---

## 10. SEO 全像（実装済 + 拡張）

### 全 page 共通 (BaseLayout.astro)
- `<link rel="canonical">`
- Open Graph (og:title, og:image, og:description, og:url)
- Twitter Card
- Cloudflare + GA4 + Vercel analytics
- robots: 17 AI crawlers 全 allow
- JSON-LD per genre

### JSON-LD タイプ (実装済)
| Page type | JSON-LD `@type` |
|---|---|
| spoke | WebPage + Occupation + BreadcrumbList + FAQPage |
| sectors index | WebPage + BreadcrumbList + ItemList |
| sector hub | WebPage + Article + BreadcrumbList + ItemList + FAQPage |
| rankings index | WebPage + BreadcrumbList |
| ranking hub | WebPage + Article + BreadcrumbList + ItemList + FAQPage |
| /map | Dataset |

### 新 genre の JSON-LD 設計
| 新 genre | 主 type |
|---|---|
| Q&A hub | QAPage + BreadcrumbList + FAQPage |
| 比較 hub | Article + BreadcrumbList |
| キャリア / 資格 / スキル / 能力 / 知識 / 興味 / 価値観 / 学歴 / 修行 / 業務 / 雇用 / ライフ / 入職 | CollectionPage + BreadcrumbList + ItemList + FAQPage (任意) |
| 年次 | Article (Report) + BreadcrumbList |
| 方法論 / 用語 / 出典 | TechArticle + BreadcrumbList |

### OG Image System (api/og.tsx)
1200×630 PNG 動的生成、現状 5 mode:
- `?id=<n>`: 556 spoke 用 (rich)
- `?sector=<id>`: 16 sector 用 (rich)
- `?page=map`: map 用 (rich)
- `?page={home,about,privacy,compliance,404,sectors,rankings}`: 7 page 用 (text)
- `?ranking=<slug>`: 9 ranking 用 (text)

**新 genre 拡張時、og.tsx に新 mode 追加が必要**（拍板 4 で承認済）:
- `?q=<slug>` Q&A 用
- `?compare=<slug>` 比較用
- `?career=<slug>` キャリア用
- `?license=<slug>` 資格用
- `?skill=<slug>` スキル用
- `?ability=<slug>` 能力用
- `?knowledge=<slug>` 知識用
- `?interest=<slug>` 興味用
- `?value=<slug>` 価値観用
- 等々

または共通 `?genre=<g>&slug=<s>` 1 mode に統合する検討も価値あり。

---

## 11. 実装可能性ランキング & 着手順序

> **2026-05-15 更新**: 構造実装(route + JSON-LD + OG + binding 層)はほぼ全部完了。残るは **内容深編集**(persona 文章 / Q&A 本文 / 比較記事本文 / 業種注解等)。**構造 ✓ = 自動派生 + テンプレ生成済;深編集 ⏳ = 編集者の手による本文書き入れ待ち**。

### ★★★ 最優先（既存資産でほぼ即実装可能）

| 拡張 | 必要工数 | 既存資産 | 構造 | 深編集 |
|---|---|---|---|---|
| **興味タイプ hub × 6 + index** | 低 | `data.holland.json` 既存 | ✅ `src/pages/ja/interests/` | ⏳ |
| **スキル hub × 10 + index** | 低 | `data.skills/<key>.json` × 31 既存 | ✅ `src/pages/ja/skills/` | ⏳ |
| **比較 hub × 12 + index** | 中 | spoke データから派生、cosine 既存 | ✅ `src/pages/ja/compare/` | ⏳ |

### ★★ 次優先（パターンの拡張、SEO 価値高）

| 拡張 | 必要工数 | 構造 | 深編集 |
|---|---|---|---|
| 新 ranking +30 | 中 (rankings.ts に slug 追加) | ◐ 既存 ranking 9 + 候補 slug 追加で拡張可 | ⏳ |
| 業種 hub 改造 | 中 (既存 16 hub に層追加) | ✅ 既存 17 hub に注解可 | ⏳ |
| Q&A hub × 36 | 高 (全文手書) | ✅ `src/pages/ja/q/` | ⏳ 全文編集が本体 |
| 方法論 / 用語 / 出典 | 中 (llms.txt から流用可) | ✅ `src/pages/ja/about/{methodology,glossary,data-sources}` | ⏳ |

### ★ 後続（重編集、persona / 主観あり）

| 拡張 | 必要工数 | 構造 | 深編集 |
|---|---|---|---|
| キャリア段階 hub × 10 | 高 (persona 完全手書) | ✅ `src/pages/ja/careers/` | ⏳ |
| 資格 hub × 15 | 高 (related_certs_ja から派生 + 手書) | ✅ `src/pages/ja/licenses/` | ⏳ |
| 能力 / 知識 / 価値観 / 学歴 / 業務 / 雇用 / ライフ / 入職 | 中 | ✅ 全 genre 構造済 | ⏳ |
| L2 explore routes × 7 | 低 (既存 hub への navigation のみ) | ✅ `src/pages/ja/explore/[route].astro` + `index.astro` | ⏳ |

### ☆ 最後

| 拡張 | 必要工数 | 構造 | 深編集 |
|---|---|---|---|
| 年次 hub × 3 | 高 (全文編集、年に 1 回) | ✅ `src/pages/ja/yearly/{index,2026-report,next-decade,5year-changes}` | ⏳ |

---

## 12. 確定実施フェーズ（拍板 2 ベース）

### Phase 0: 準備（1 週間）
- og.tsx に新 mode 拡張（任意 genre 対応の汎用化）
- BaseLayout.astro を再点検、新 hub テンプレが共通化できるよう調整
- `src/data/lib/` に hub 共通ヘルパー新設（注解生成、リンク graph 等）

### Phase 1: ★★★ 即実装（2 週間）
1. 興味タイプ hub × 6 + index   （`/ja/interests/`）
2. スキル hub × 10 + index    （`/ja/skills/`）
3. 比較 hub × 12 + index     （`/ja/compare/`）

→ 中層 27 → 56 (+29 page)

### Phase 2: ★★ ranking + sector 改造（3 週間）
4. 新 ranking +30 (slug + FAQ + ranking 関数追加)
5. 業種 hub 16 個に intro / pattern / findings / 注解を追加

→ 中層 56 → 86 (+30 page、内容深化)

### Phase 3: ★★ Q&A 36 + 方法論 4（4-5 週間）
6. Q&A hub × 36 (5 sub-genre 別に手書き編集)
7. /ja/about/methodology + glossary + data-sources + 1 yearly

→ 中層 86 → 126 (+40 page)

### Phase 4: ★ persona 系（4-5 週間）
8. キャリア段階 hub × 10
9. 資格 hub × 15
10. 学歴 / 修行 / 業務 / 雇用 / ライフ / 入職 (各 5-7 個)
11. 能力 / 知識 / 価値観 (各 6-9 個)

→ 中層 126 → 220 (+94 page)

### Phase 5: ナビゲーション層（1 週間）
12. /ja/explore/ × 7 (L2 routes)
13. 各 genre index 整備

→ 中層 220 → 230+

### Phase 6: spoke 深編集（並行、長期）
14. 556 spoke を順次手編集（Phase 1-5 と並行、5-6 ヶ月）

---

## 13. 完成形を 1 段落で

> ある日本人 reader が "AI で消えない仕事" を Google 検索する。検索結果に
> `mirai-shigoto.com/ja/q/ai-de-kienai` が現れる。1500 字の記事、150 字の直答 +
> 500 字の根拠 + TOP 10 職業の例（30 字注解付き）。reader は "看護師" の
> 項目に興味を持ち click。
>
> /ja/123 spoke、深編集 5500 字。AI 影响度評価の詳細、5 軸 radar、
> top skills、関連職業 transfer paths、jobtag 出典。底部に **10-12 個の
> 反向 hub link**:「医療 sector」「国家資格必須 ranking」「AI 安全 ×
> 高年収」「対人スキル中心」「看護師 vs 介護福祉士 比較」「育児両立
> しやすい」「社会的タイプ向け」...
>
> reader は **/ja/compare/kango-vs-kaigo** で看護師 vs 介護福祉士の
> 比較表を見る。決断の助けになる。/map に飛んで 552 職業全体像を眺める。
> /ja/explore/find-your-fit で適職診断を試す。最終的にブックマーク。
>
> **全 820 page。中层 200+ hub。内部リンク密度 13,000+。SEO 入口
> 4 layer × 全 query 種に対応**。

---

## 14. 維持・拡張 burden（完成後）

| 作業 | 頻度 | 見積 |
|---|---|---|
| AI 影响度 score 再評価 | 半年に 1 度 | 1 週間 |
| 各 hub の編集 update | 6-12 ヶ月 | 月 1-2 hub |
| 年次レポート 2027 / 2028 ... | 年 1 | 1 週間 |
| 新 spoke (新 IPD 職業追加) | jobtag 更新時 | 1-2 日 |
| build pipeline メンテ | 月 1 | 数時間 |

中規模負担。週 4-6 時間で十分維持可能。

---

## 15. 修正履歴

- 2026-05-09 v0.1: 初稿（コード精読 + 実測ベース）。HUB_EXPANSION_PLAN.md v0.2 を上位互換で包含。
- 2026-05-13 Phase A.5: 全文を日本語化(他の docs 文書と同期)。
- 2026-05-16: §0.5「二つの『Phase』命名の整理」を新設。本ドキュメント §12 の Phase 0-6(機能拡張)と [architecture.md](./architecture.md) §11 の Phase B/C/D/E(コード重構)を直交関係として明確化。§0 表第 2 行も "Phase B/C/D/E で全部構造実装済" を "§12 の Phase 1 該当" に修正、対応関係を明示。
- 2026-05-14 v0.2: HUB_EXPANSION_PLAN.md は本ファイルが上位互換のため削除。`282fda41 chore(docs): un-gitignore docs/` で `docs/` 全公開、本ファイルも GitHub 公開対象に。
- 2026-05-15 v0.3: 構造実装フェーズ完了状態を反映。§0 拍板 5 項目に進捗列追加(構造実装済 vs 深編集継続)、§11 実装可能性ランキング表に「構造 / 深編集」列を分けて記録。残る作業は **route の物理生成ではなく、各 hub ページの本文編集** であることを明示化。Phase B/C/D/E（architecture.md §15 参照）で全 genre route family が構造実装済 — `src/pages/ja/{interests,skills,compare,careers,licenses,abilities,knowledge,values,work-styles,life-balance,training,education,employment-types,entry-paths,q,yearly,explore}/` 全部存在。
- （以降は修正のたびに追記）
