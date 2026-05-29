# architecture.md — mirai-shigoto 5 層アーキテクチャ

> **ステータス**: 現行版(2026-05-12 起草、Phase B/C/D/E まで完了 = 2026-05-15)。詳細な施工進捗は §11 移行順序の表、各 Phase の判断・履歴は §15 決定ログ参照。
> **適用範囲**: コード構成、データフロー、型契約、移行パス、SEO 契約
> **関連**: [WORKFLOW.md](./WORKFLOW.md)(運用 / デプロイ / CI)、[DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md)(データ規約)、[SITE_FULL_VISION.md](./SITE_FULL_VISION.md)(全体ビジョン)
>
> **読み方のヒント**: §2 はアーキテクチャの **静的構造** を、§8 / §11 / §15 が **施工状態の真実** を表す。Layer 2/3/4 は当初「新設」と書かれていたが、Phase B/C/D/E で全層が **実装済**(`src/graph/` / `src/views/` / `src/templates/` 全部存在 + tests 完備)。本ファイル §2 の表現は構造記述として残るが、現状を確認するには §8 表 + §11 状態列を参照。

---

## 0. 一文要約

**本システムの本質は「日本の職業に関する知識グラフ + 複数のスライス提示」である。**

アーキテクチャ全体は、この事実をコードに直接翻訳したもの: 5 層、3 つの語義レベル、単一の真実、純粋関数の連鎖、URL は出力のバインディングであってビジネスの入力ではない。

エンタープライズ層分けではない。流行フレームワークの標準構成でもない。**問題の形状に決定された形状** である。

---

## 1. 概念上、システムは何か

技術細部をすべて剥ぎ取ると:

- **ノード**: occupation(556)/ sector(16)/ skill(10 IPD 次元)/ ability / knowledge / value / interest(6 RIASEC)/ education / training / license / employment-type / life-balance / entry-path / career persona
- **エッジ**: occupation→sector(1:1)、occupation→{skill, ability, knowledge, value}(M:N 重み付き)、occupation→occupation(転職 / compare ペア)、sector→sector(関連)
- **属性**: AI risk スコア + rationale、salary、workers、hue、descriptions、出典 source

**このグラフの読み方(= ページファミリー)**:

| 読み方 | ページファミリー | インスタンス数 |
|---|---|---|
| 1 ノードを見る | `/ja/[id]` | 556 |
| 1 種類のノードを集約 | `/ja/sectors/[sector]` | 16 |
| 次元でスライス | `/ja/{rankings,skills,interests,abilities,knowledge,values,...}/[name]` | ~90 |
| 二元ノード対比 | `/ja/compare/[pair]` | ~20 |
| 全グラフ俯瞰 | `/`、`/map` | 2 |
| スライスをまたがる成果物 | sitemap、OG card、JSON-LD、meta tags | 横断 |

**これがシステムの全て**。現在の build 出力は 822 個の静的 HTML ページ + OG endpoint の動的カード、すべてこのグラフの異なる読み方である。

---

## 2. 5 層アーキテクチャ

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1 · Sources    人間が編集する事実(YAML / JSON)         │
└────────────────────────────┬─────────────────────────────────┘
                             │ schema 検証 + Graph 構築
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2 · Graph      メモリ内の領域グラフ(ノード + エッジ + 属性)│
└────────────────────────────┬─────────────────────────────────┘
                             │ 純粋関数クエリ
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 3 · Views      ページファミリーのスライス(ファミリー単位の view)│
└────────────────────────────┬─────────────────────────────────┘
                             │ 純粋関数レンダリング
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 4 · Templates  view → SafeHtml / Astro コンポーネント   │
└────────────────────────────┬─────────────────────────────────┘
                             │ URL バインド
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 5 · Pages      Astro page = view インスタンス + template│
└──────────────────────────────────────────────────────────────┘
```

### 2.1 Layer 1: Sources

**場所**:

| ディレクトリ | 内容 |
|---|---|
| `data/occupations/` | 556 個の occupation ソースデータ(1 ファイル 1 職業) |
| `data/sectors/` | 16 個の sector 定義 + overrides |
| `data/labels/` | 7 次元の日中英対訳ラベル(skill / ability / knowledge / value / interest / education / training) |
| `data/scores/` | AI risk スコアリングバッチ(append-only) |
| `data/stats_legacy/` | 552 職業の labor-market 統計 |

補助ディレクトリ(source ではないが build に参加): `data/prompts/`(LLM プロンプトテンプレート)、`data/rationales/`(LLM 生成 rationale バッチ)、`data/_archive/`(歴史スナップショット)。

**定義**: 人間が編集し、可読、自己完結、「ウェブサイトの存在を知らない」事実。

**許可されること**:
- 原始事実を含む(日中英名称、AI risk スコア、次元重み、出典 URL)
- Zod / JSON schema による起点での自己検証
- source 間の参照(`occupation.sectorId` が sector id を指す)

**禁止事項**:
- 派生データを含む(「sector 平均給与」は source ではなく view)
- HTML / リッチテキストを含む(必要なら、raw テキストと rich text を分離)
- 「page」「view」「template」など上位概念の参照

**契約(上向き)**: すべての source は build 時に検証される; どれか 1 つでも通らなければ build を中断する。Source は **その用途を約束しない**。

**なぜ独立して存在するか**: クロスサイト再利用のコア。mirai-shigoto.cn / .de / 任意の "mirai-xxx" は **source 一式の入れ替え** で実現、その他は継承。

---

### 2.2 Layer 2: Graph

**場所**: `src/graph/`(実装済 = 2026-05-13 Step 1)。`ids.ts` / `types.ts` / `loader.ts` / `score-strategy.ts` / `sector-resolver.ts` + 4 個の test ファイル + `index.ts` の計 10 ファイル。`loadGraph()` は memoize 済(commit `cc83ebf7`、build 15× 高速化)。旧 `src/data/lib/indexes.ts` は projection build pipeline のみで使われる中間 index に役割を絞り、業務層からは参照されない。

**定義**: source のメモリ内 **領域形態** — 不変な property graph。

**型シグネチャ**:

```ts
// src/graph/types.ts
export type OccupationId = string & { readonly __brand: 'OccupationId' }
export type SectorId    = string & { readonly __brand: 'SectorId' }
export type SkillId     = string & { readonly __brand: 'SkillId' }
// ... 各種 ID にブランド型を 1 つずつ

export interface OccupationNode {
  readonly id: OccupationId
  readonly title: LocalizedText
  readonly sectorId: SectorId
  readonly aiRisk: { score: number; band: RiskBand; rationaleJa: string }
  readonly stats: { workers: number | null; salary: number | null }
  // ... 自身のフィールド(派生データを含まない)
}

export interface KnowledgeGraph {
  readonly occupations: ReadonlyMap<OccupationId, OccupationNode>
  readonly sectors: ReadonlyMap<SectorId, SectorNode>
  readonly skills: ReadonlyMap<SkillId, SkillNode>
  // ... その他ノードマップ

  // エッジクエリ関数(O(1) / O(N) のメモリ操作、純粋関数セマンティクス)
  skillsOf(id: OccupationId): readonly WeightedSkillEdge[]
  occupationsBySector(id: SectorId): readonly OccupationId[]
  relatedOccupations(id: OccupationId): readonly OccupationId[]
  comparePair(id: ComparePairId): readonly [OccupationId, OccupationId]
  // ...
}

export function loadGraph(): Promise<KnowledgeGraph>
```

**主要性質**:

| 性質 | 意味 |
|---|---|
| 不変 | build 起動後 graph は変更されない(全工程 `Readonly`) |
| 型化 | 各 ID はブランド型、ID 取り違え = コンパイルエラー |
| 決定的 | 同じ source からは常に同じ graph を構築 |
| HTML ゼロ | graph は HTML の存在を知らない |
| ランタイム I/O ゼロ | ロード時に一度に構築、クエリ中はファイルを読まない |

**契約(上向き)**: すべてのクエリ関数は O(1) / O(N)、純粋関数セマンティクス、I/O ゼロ。

**CS 原型**: Datomic / Neo4j のメモリ内グラフモデル。Astro Content Collections は同じ思想の簡略版(graph 層までで、明示的な view 層はない)。

---

### 2.3 Layer 3: Views

**場所**: `src/views/`(実装済 = 2026-05-13/14 Phase B/C/D)。60+ ファイル(ranking / sector / hub / interest / compare / skill / og-cards / jsonld / meta / sitemap / image-sitemap / occupation-detail / occupation-faqs / occupation-jsonld / occupation-seo / spoke-hub-graph / spoke-spoke-graph / careers-meta / licenses-meta / rankings-meta / interests-meta / skills-meta / sector-meta / qa-meta / compare-meta / explore-routes / genre-configs / inline-links / hub-hub-graph 等)。Phase B(18 untested 退役)+ Phase C(13 tested 消化)で旧 `src/data/lib/*-hub.ts` 系から完全移行済。`src/data/projections/` は build pipeline 中(`src/data/build.ts`)で 12 投影を `public/data.*` に書き出すために残置(別系統、view 層は使わない)。

**定義**: **純粋関数** `(graph, params) => ViewResult`。

**型シグネチャ**:

```ts
// src/views/occupation-detail.ts
export interface OccupationDetailView {
  occupation: OccupationNode
  sector: SectorNode
  topSkills: readonly { skill: SkillNode; weight: number }[]
  topAbilities: readonly { ability: AbilityNode; weight: number }[]
  riasecProfile: RiasecScores
  transferPaths: readonly TransferPath[]
  relatedOccupations: readonly RelatedOccupation[]
  // ... この view が自分で必要な全フィールドを宣言する
}

export function occupationDetailView(
  graph: KnowledgeGraph,
  id: OccupationId,
): OccupationDetailView
```

**主要性質**:

| 性質 | 意味 |
|---|---|
| 純粋関数 | ファイル読まず、I/O せず、時刻 / 乱数に依存しない |
| 決定的 | 同 graph + 同 params → 常に同出力(snapshot ガードの前提) |
| 閉包 | 出力オブジェクトは自己完結、template は受け取ったら graph に戻らない |
| HTML ゼロ | view はデータを返す、文字列ではない |
| 組合せ可 | view が sub-view を呼ぶことは可能 |

**View 分類**:

| 種別 | 例 | 物化戦略 |
|---|---|---|
| 単一ノード view | `OccupationDetailView(id)` | 物化(OG endpoint がプロセス越しに消費) |
| 集約 view | `SectorView(id)` | 物化(OG endpoint が消費) |
| スライス view | `RankingView(axis)` | 非物化(build 内消費) |
| 二元 view | `CompareView(pairId)` | 非物化 |
| グローバル view | `TreemapView()`、`SearchIndexView()` | 物化(クライアント fetch) |
| 横断 view | `JsonLdView(nodeId)`、`OgCardView(params)`、`MetaView(pageRef)`、`SitemapView()` | インライン / endpoint 消費 |

**契約(上向き)**: 戻り値は **完全に自己完結かつ型化**、template は目を瞑ってもレンダリングできる。

**CS 原型**: CQRS における read model / materialized view(Kleppmann *DDIA* 第 11 章)。

---

### 2.4 Layer 4: Templates

**場所**: `src/templates/`(実装済 = 2026-05-13/14 Phase B/C/D)。30+ ファイル(Compare / Hub / InterestHub / SkillHub / Ranking / SectorChart / SectorListings / SectorPatterns / AiRiskDetail / FaqSection / Highlights / LegacyRelated / MetaRow / OccFaq / OrgsCerts / ProfileRadar / ProseSection / Provenance / Topn / Transfer 等、全テスト完備)。Phase D audit #8 で 18 hub-index ページの HTML 組立(`.map(...).join('')`)を本層に集約済。TS 関数で `SafeHtml` を返す形態が主体、Astro コンポーネントは `BaseLayout.astro` / `Footer.astro` / `_RiskCard.astro` 等の小数。

**定義**: HTML / VDOM / バイナリ画像を生成する **唯一の層**。

**形態選択ルール**:

| 出力形態 | 何を使うか | 理由 |
|---|---|---|
| 固定 DOM 構造 | `.astro` コンポーネント | auto-escape、scoped CSS、slot 再利用 |
| 動的形態(inline link をテキストに埋込、データで分岐する list mapper) | TS 関数で `SafeHtml` を返す | Astro コンポーネントだとこのシナリオは冗長 |
| OG 画像 | Satori JSX(`api/og.tsx`) | Astro は画像をレンダリングしない |
| Sitemap XML / JSON-LD 文字列 | TS 関数 | HTML 以外の出力 |

**SafeHtml 契約**:

```ts
// src/lib/safe-html.ts
export type SafeHtml = string & { readonly __safeHtml: unique symbol }

// 唯一の構築方法(values を escape したうえで brand を付ける)
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml

// set:html は SafeHtml だけを受け付ける
```

**主要性質**:

| 性質 | 意味 |
|---|---|
| 入力は view | 型化された view オブジェクトを受け取る |
| 出力は SafeHtml | コンパイル時に escape 済みを保証 |
| view / graph 呼出ゼロ | view を受け取った後は遡らない |
| ファイル I/O ゼロ | 何も読まない |
| scoped CSS | Astro コンポーネントのネイティブ機能 / TS 関数は trustedCss 出口経由 |
| 葉層 | sub-template / shared primitive を呼んでよい; 上位層を逆呼出してはならない |

**Template の組合せルール**:

```
Astro コンポーネントが SafeHtml を set:html できる              ✓
TS 関数が HTML を出力し、hook を残して Astro で装飾する          ✓
TS 関数が Astro コンポーネントをレンダリングする(ランタイム不可能)  ✗
TS 関数 / Astro コンポーネントが view 関数を呼ぶ                 ✗
TS 関数 / Astro コンポーネントが graph 関数を呼ぶ                ✗
```

**CS 原型**: Pure rendering(Elm / React)+ branded primitive types。

---

### 2.5 Layer 5: Pages

**場所**: `src/pages/`(既存、スリム化が必要)。

**定義**: Astro ページファイル。**1 つの view インスタンスを 1 つの template にバインドする**、**それだけ**。

**Page ファイルの標準構成**:

```astro
---
import { loadGraph } from '@/graph/loader'
import { occupationDetailView } from '@/views/occupation-detail'
import { jsonLdOccupationView } from '@/views/json-ld-occupation'
import { metaView } from '@/views/meta'
import OccupationDetail from '@/templates/OccupationDetail.astro'
import JsonLdScript from '@/templates/JsonLdScript.astro'
import BaseLayout from '@/layouts/BaseLayout.astro'

export async function getStaticPaths() {
  const graph = await loadGraph()
  return [...graph.occupations.keys()].map(id => ({
    params: { id },
    props: {
      view: occupationDetailView(graph, id),
      jsonLd: jsonLdOccupationView(graph, id),
      meta: metaView(graph, { type: 'occupation', id }),
    },
  }))
}

const { view, jsonLd, meta } = Astro.props
---
<BaseLayout meta={meta}>
  <JsonLdScript data={jsonLd} />
  <OccupationDetail view={view} />
</BaseLayout>
```

**制約**:

| ルール | 数値 |
|---|---|
| ファイル長 | **緩和済**(2026-05-14 決定ログ参照): 厳密 ≤ 30 行 → "**view + template バインドに必要な範囲**"(典型 30-150 行)|
| frontmatter のビジネスロジック | 0 行(計算は view へ、HTML 組立は template へ) |
| HTML 文字列の組立 | 0 行 |
| ファイル読込 | 0 行 |
| schema parse | 0 行 |
| fallback 処理 | 0 行(これは view の仕事) |

**ファイル長 緩和の理由**(2026-05-14 audit でルール再評価):

当初 "≤ 30 行" は理想形を強制するための値だった。実装してみたところ、典型的な hub-family ページ(例: `careers/[career].astro`、`licenses/[license].astro`、`q/[q].astro`)は以下の理由で 50-150 行になる:

- `getStaticPaths` の中で props を組み立てる(view 関数複数呼出 + map / filter)
- 複数の view 関数の結果を destructure する宣言
- per-page meta(canonical / title / seoDesc / ogImage / breadcrumb)の組立て
- 派生 props の宣言(統計値、stats html、stats JSON-LD など)
- frontmatter の中の inline `<style>` ブロック(Phase E で抽出予定)

これらは "page がやってはいけないこと" ではなく、**page binding 層の正当な責務**: graph → view 関数の呼出 + props 整形 + template への引渡し。view の中に押し込むと "page-specific helper" が view 層を汚染する。

**判定基準**(数値ではなく性質):

✅ page が許される行為:
- view 関数を呼ぶ
- view の戻り値を destructure する
- meta(title / description / canonical / ogImage)を計算する
- 派生 props を組み立てる(view の戻り値を別の view にチェインする)
- inline `<style>` ブロックを書く(Phase E まで)

❌ page が許されない行為:
- ファイル読込 / fs / schema parse
- HTML 文字列を直接組み立てる(template の仕事)
- 業務ロジック(ranking 計算、relatedness 算出など)
- mutation / global state

**CS 原型**: URL routing 層。MVC の controller。当初描いた "≤ 30 行" のイメージは Astro の `getStaticPaths` パターン下では非現実的だったので、行数ではなく **責務の性質** で判定する。

---

## 3. 5 つのコア禁止事項

| # | 禁止 | 違反するとどうなるか |
|---|---|---|
| 1 | **Pages はファイルを読まない / schema parser を呼ばない** | データ取得が各ページに散在、現状に戻る |
| 2 | **Templates はファイルを読まない / graph を引かない / ビジネス計算をしない** | template にビジネスロジックが混入、view 層が無効化 |
| 3 | **Views は HTML を生成しない / I/O しない / mutation しない** | view が page-specific helper に退化、再利用が消える |
| 4 | **Graph は build 期間中に mutation しない / I/O 後に変更しない** | build が非決定的になり、snapshot テストが効かなくなる |
| 5 | **Sources は view / template / page の概念を参照しない** | 上流が下流に依存、クロスサイト再利用時に全崩壊 |

**この 5 条はルールではない — このアーキテクチャがこのアーキテクチャである本質である。** 具体的な設計判断はすべてこの 5 条に立ち返ってチェックする。

---

## 4. 5 つの具体的決定(ロック済み)

| # | 決定 | 選択 | 理由 |
|---|---|---|---|
| 1 | **View 物化戦略** | **ハイブリッド**(view 種別単位で `materialize: true/false` を明示宣言) | プロセス越し消費(OG endpoint / ブラウザ fetch)は物化必須; build 内消費は非物化 |
| 2 | **Graph の分割** | **単一 graph** | 領域は 1 つ; 1000 ノード規模で分割不要 |
| 3 | **ブランド型** | **使用** | コンパイル時の取り違え防止; 学習価値; ランタイムコストゼロ; クロスサイト再利用に必須 |
| 4 | **Template 形態** | **ハイブリッド**(DOM 形状で Astro コンポーネント / TS 関数を選ぶ) | 静的はコンポーネント、動的は関数; 統一を強要するのは誠実でない |
| 5 | **エラーモデル** | **fail-fast**(dev では `ALLOW_PARTIAL_DATA` バイパスを保留) | コンテンツを自分でコントロールしている; 「build 通過 = データ健全」というクリーンな契約 |

**この 5 つは独立した選択ではなく、上記 5 層アーキテクチャの直接投影である。** 単独修正不可 — 1 つ変えれば全体アーキテクチャの再審が必要。

---

## 5. 横断的関心事 = view のもう 1 つのインスタンス

「ページの外側だがページと共に現れる」成果物は、**例外なくすべて** view + template の形をとる:

| 成果物 | View 種別 | Template 形態 |
|---|---|---|
| ページの `<title>` / canonical / `<meta>` | `MetaView(graph, pageRef)` | `BaseLayout.astro` slot |
| JSON-LD (schema.org) | `JsonLdView(graph, nodeId)` | `JsonLdScript.astro` |
| OG card データ | `OgCardView(graph, params)` | `OgCardTemplate.tsx`(Satori) |
| Sitemap | `SitemapView(graph)` | `sitemap.ts` が XML 文字列を返す |
| Image sitemap | `ImageSitemapView(graph)` | `image-sitemap.ts` |
| hreflang / alternate URLs | `AlternateUrlsView(graph, nodeId)` | `MetaView` に注入 |
| 404 fallback | `NotFoundView(graph, path)` | `NotFound.astro` |

**この一貫性こそアーキテクチャ最大の副作用**: sitemap は常に実ページと一致、OG endpoint は常にページ schema と一致、クロス言語の alternate URL は常に source と一致 — 規律ではなく構造によって保たれる。

---

## 6. ガード機構

違反を **コンパイル失敗 / CI 拒否** に落とし、人手レビューに頼らない。

### 6.1 コンパイル期

| ガード | 実装方法 |
|---|---|
| ブランド ID の取り違え不可 | `OccupationId` ≠ `SectorId` ≠ `string`(決定 #3) |
| Graph の mutation 不可 | 全工程 `Readonly` / `ReadonlyMap` |
| Template の出力は必ず escape 済 | `SafeHtml` ブランド型 + `set:html` は SafeHtml のみ受付 |
| View 関数が純粋 | TypeScript で完全保証は無理だが、関数シグネチャ `(graph, params) => Result` が違反を明示にする |

### 6.2 ファイル境界 + import ルール

```
src/graph/         HTML ツールの import 禁止
src/views/         'fs'、'src/templates/*' の import 禁止
src/templates/     'fs'、'src/graph/*'、'src/views/*' の import 禁止(型を除く)
src/pages/         'fs'、'src/data/projections/*' の import 禁止
```

実装: `scripts/check-architecture.cjs`(移行過程で追加)が各ディレクトリの import 文を grep する。

### 6.3 CI 関門

> **2026-05-29 更新**: GitHub Actions を全廃(2026-05-28)し、全ゲートを Vercel build に再接続。`vercel.json` › `buildCommand` が push ごとに自動実行: `typecheck` → `build`(`build:data` L1+L2 + `astro build` + `check-rendered-leaks` + analytics / CSP / lockfile / HTML チェック)→ **`verify:gates`**(L3 consistency + アーキテクチャ境界 grep + Edge TSX + 内部リンク integrity + JSON-LD + SEO baseline diff)→ `test`(unit)。**手動は e2e のみ**(A11y / visual / smoke / analytics は Chromium バイナリが必要なため deploy には載せず、`bun run test:e2e`)。下表「計画」列の `.github/workflows/*.yml` は廃止済みの歴史的参照(現在の配線は本ノートが正)。

| 関門 | 現在の状態 | 計画 |
|---|---|---|
| TypeScript strict 型チェック | ✓ 既存 `bun run typecheck` | 維持 |
| 単体テスト | ✓ 既存 `bun run test` | 各層 view にテスト必須 |
| データ schema 検証 | ✓ 既存 `bun run build:data` | 維持 |
| HTML rendered leak 検査 | ✓ 既存 `check-rendered-leaks.cjs` | 維持 |
| **SEO baseline diff**(§7 参照) | ✓ **構築済み** | `.github/workflows/seo-baseline.yml` |
| アーキテクチャ境界 grep | ✓ **構築済み** | `scripts/check-architecture.cjs`(4 層を強制) |
| Edge Function dep TSX 検査 | ✓ **構築済み** | `scripts/check-architecture.cjs` の transitive walker(`api/og.tsx` / `middleware.ts` の import 閉包に `.tsx` dep が現れたら fail。Vercel Edge bundler の dep TSX-loader 欠落への対策。2026-05-13/14 の 27 連続 deploy 失敗事件を再発防止) |
| 内部リンク integrity | ✓ **構築済み** | `scripts/verify-internal-links.cjs`(全 `<a href>` が emit 済 URL に解決) |
| JSON-LD schema.org コンプライアンス | ✓ **構築済み** | `scripts/verify-jsonld.cjs`(WebPage/Article/BreadcrumbList/ItemList/FAQPage/Occupation を構造検証) |
| A11y baseline | ✓ **構築済み** | `tests/e2e/a11y.spec.ts`(axe-core、WCAG 2.1 AA、critical/serious で fail) |
| Visual regression(構造不変量、4 ブレークポイント) | ✓ **構築済み** | `tests/e2e/visual.spec.ts`(320/768/1024/1440 で水平 overflow / hero / nav / footer / `#mapContent` を検証) |
| Visual regression(pixel-perfect snapshot) | ⏳ 後回し | バイナリ PNG baseline のリポジトリ管理コストが高く、SEO baseline byte-compare で大部分カバー済。CSS リファクタリスクが顕在化した時点で再評価。 |

---

## 7. SEO baseline 契約

移行期間中最大の非技術リスクは **Google が見えているものがこっそり変わる** こと。本セクションは SEO のセーフティネットを定義する。

### 7.1 なぜ必要か

mirai-shigoto.com は既に 800+ URL が Google にクロールされ、外部リンクされ、SNS で共有されている。構造的なリファクタを **明示的にガードしないと** 以下が混入する:

- URL 消失(404 → ランキング消失)
- title / description / canonical 改変(検索結果の文言が変わる)
- JSON-LD 構造変化(rich result 消失)
- og:image URL 変化(ソーシャル共有カードが壊れる)
- 内部リンク消失(PageRank の流れが変わる)

これらは typecheck / unit test では検知できない。**スナップショット比較でのみ捕捉可能**。

### 7.2 baseline はどこに、何を記録するか

場所: [tests/baseline/](../tests/baseline/)

| ファイル | 内容 | 重要性 |
|---|---|---|
| `urls.txt` | 全パブリック URL のソート済リスト(1 行 1 URL) | URL カバレッジ — Google が最も気にすること。1 行欠ければ SEO リグレッション |
| `sitemap.xml` | sitemap の原文出力 | Search Console に提出するもの、有効性必須 |
| `image-sitemap.xml` | image-sitemap の原文 | OG カード発見の経路 |
| `seo-metadata.jsonl` | URL ごとに 1 行: `{url, title, description, canonical, robots, keywords, h1Texts}` | SERP に直接入るフィールド; どれもランキングシグナル |
| `og-meta.jsonl` | URL ごとに 1 行: `{url, og:*, twitter:*}` | ソーシャルプレビューカード; `og:image` は OG endpoint へのリンク |
| `json-ld.jsonl` | URL ごとに 1 行: `{url, ld: [parsed objects]}` | 構造化データ → Google rich results |
| `internal-links.jsonl` | URL ごとに 1 行: `{url, internalHrefs, anchorIds}` | 内部 PageRank の流れ + fragment リンクの完全性 |
| `data-files.txt` | `public/data.*` パスのソート済リスト | OG endpoint + クライアント JS fetch がこれらを参照; パスがズレると壊れる |
| `capture-meta.json` | キャプチャ時刻 + git commit / branch + 件数 | 監査トレイル、diff 比較対象には入らない |

**大きな JSON ではなく JSONL を使う理由**: URL ごとに 1 行 → `git diff` でどの URL のどのフィールドが変わったか直接見える。

**総容量約 6.7 MB**、git で処理して問題なし。最大ファイルは `json-ld.jsonl`(~4 MB)、JSON-LD 自体が verbose だから。

### 7.3 ガードスクリプト

| スクリプト | 役割 |
|---|---|
| [scripts/lib/seo-extract.cjs](../scripts/lib/seo-extract.cjs) | 共通 HTML 抽出プリミティブ + `captureBaseline()` エントリ(capture と diff の共通基盤) |
| [scripts/capture-seo-baseline.cjs](../scripts/capture-seo-baseline.cjs) | 抽出を実行 → `tests/baseline/` に書込 |
| [scripts/diff-seo-baseline.cjs](../scripts/diff-seo-baseline.cjs) | 抽出を実行 → `tests/baseline/` と比較 → drift を報告 |
| `bun run check:seo-baseline`([diff-seo-baseline.cjs](../scripts/diff-seo-baseline.cjs)) | drift 検知(**手動実行**。GitHub Actions は 2026-05-28 廃止、Vercel build gate には未接続) |

npm エントリ:

```bash
bun run capture:seo-baseline   # 新 baseline を書く
bun run check:seo-baseline     # 現 build を baseline と比較
```

**決定性**: 同じ `dist-astro/` + 同じ `public/` → 同じ baseline。`capture-meta.json` 以外にタイムスタンプは入らない。

### 7.4 baseline を更新する手順(変化が意図的な場合)

```bash
# 1. コード修正
# 2. build
bun run build

# 3. 再キャプチャ
bun run capture:seo-baseline

# 4. diff が想定通りか確認
git diff tests/baseline/

# 5. コード変更と一緒に commit、commit message で diff を必ず説明
#    例: "feat(sectors): 17 個目の sector 'energy' を追加(+1 URL、+1 sitemap entry)"
```

**説明のない baseline diff = コードレビューの赤旗**。レビュアーは「これは意図的か?」と必ず聞くこと。

### 7.5 CI が drift を報告したら

CI 失敗メッセージは **どの URL のどのフィールドが変わったか** を正確に列挙する。

1. **まず diff を見る、baseline を即更新しない**
2. **判断: 意図的か、事故か?**
   - 意図的 → 更新 + commit + 説明(§7.4)
   - 事故 → コードを直して baseline に合わせる
3. **判断つかない → 事故扱いをデフォルトに**。SEO リグレッションはほぼ「層を間違えた refactor」由来、保守的に

よくある事故パターン:

- view 層の refactor がフィールド名を変えた → `og:image` URL が壊れる
- template が JSON-LD 構造を変えた → rich result 消失
- page 層の変更が内部リンクを意図せず追加 / 削除
- sitemap ジェネレータが route family を 1 グループ落とす
- schema 移行が `api/og.tsx` の fetch するデータパスを変える

### 7.6 後回し: OG カードの視覚 baseline

OG endpoint(`api/og.tsx`)は Vercel Edge function、リクエスト時に 1200×630 PNG を生成する。PNG バイト列を baseline にすると:

- ~6-30 GB のファイル
- バイナリ(`git diff` 意味なし)
- 再現困難(エッジノードのコールドスタート差異)

妥協:

- `og-meta.jsonl` が既にページの `og:image` URL を守っている — **これが Google が実際に読むもの**
- 実際の PNG が正しく返るかは、**OG endpoint 移行フェーズ(Step 9)の付属ヘルスチェックで検証する**

これは許容可能なギャップ: Google SEO は og:image URL が HTML に存在することに依存し、PNG バイト列には依存しない。ソーシャルプラットフォーム(Twitter / Facebook / LinkedIn)は定期的に再フェッチ、自己回復する。

### 7.7 baseline 範囲外のもの

| 項目 | なぜここではないか | どこ |
|---|---|---|
| HTML body の完全コンテンツ(h1 以外) | 視覚リグレッションは別の契約 | 計画: Playwright snapshot |
| CSS / レスポンシブ動作 | 視覚リグレッション領域 | 同上 |
| サーバーレスポンスコード | build は 404 を生成しない、Vercel が serve 時に処理 | 計画: post-deploy ヘルスチェック |
| Core Web Vitals 性能指標 | SEO コンテンツ契約ではない | 計画: Lighthouse CI |

これらは異なる契約、異なるツールが必要。**SEO baseline に押し込まないこと**。

---

## 8. 既存コード → 目標アーキテクチャのマッピング

| 今どこ | 最終どこ | 変化 |
|---|---|---|
| `src/data/schema/` | Layer 1 Sources schema | ほぼ動かさず、概念上「source 検証契約」に格上げ |
| `data/{occupations,sectors,labels,scores,stats_legacy}/` | Layer 1 Sources(位置不変) | 物理位置は動かさず、地位を「真実の唯一の住所」と明確化 |
| `src/data/lib/indexes.ts` の `buildIndexes()` | Layer 2 Graph (`src/graph/loader.ts`) | ブランド型 / 明示的エッジクエリ / 不変性を追加 |
| `src/data/lib/strict-load.ts` | Layer 2 内部ツール | ビジネス層からは呼ばれなくなる |
| `src/data/projections/*` | Layer 3 Views + 物化ロジック | 分解: 「スライス計算」は views へ; 「物化」は view の属性に |
| `src/data/lib/projection-schemas.ts` | Layer 3 出力型 | view 型定義に進化 |
| `src/data/lib/genre-hub.ts` | `src/views/hub.ts` + `src/templates/Hub.astro` | データは view、HTML は template |
| `src/data/lib/skills-hub.ts` | `src/views/skill.ts` + `src/templates/SkillHub.astro` | 同上 |
| `src/data/lib/interests.ts` | `src/views/interest.ts` + `src/templates/InterestHub.astro` | 同上 |
| `src/data/lib/rankings.ts` | `src/views/ranking.ts` + `src/templates/Ranking.astro` | 同上 |
| `src/data/lib/compare-hub.ts` | `src/views/compare.ts` + `src/templates/Compare.astro` | 同上 |
| `src/data/lib/ranking-renderers.ts` | `src/templates/Ranking.astro` + `src/templates/primitives/*` | 共通プリミティブを抽出 |
| `src/data/lib/adapt-detail.ts` | `src/views/occupation-detail.ts` | データ整形は view 配下 |
| `src/lib/og-helpers.ts` の二次 schema | **削除** | OG は graph + `views/og-card.ts` を使う(schema を共通化) |
| `api/og.tsx` のカード設定 | `src/views/og-card.ts` + `src/templates/og-card.tsx` | 設定をテーブル化; `api/og.tsx` は薄いバインダとして残す |
| `src/pages/**/*.astro` の frontmatter ビジネスロジック | view + template のバインドだけにスリム化 | Page ファイル最終的に ≤ 30 行 |
| `src/index-source.html` 5230 行 | SearchView + TreemapView + 対応 template に分解 | 最後に処理 |
| `src/pages/map.astro` 1217 行のインライン JS | squarified / gesture / search-suggest モジュールを抽出 | 最後に処理 |

**そのまま残す**: `data/` 配下のソースデータ; `src/data/build.ts` は build オーケストレータとして(内部は進化); 既存 CI / verification スクリプト。

**Phase B + C 完了後の現状 (2026-05-14)**:

| §8 行 | 最終目標 | 現状 |
|---|---|---|
| indexes.ts | graph/loader.ts | ✓ graph/loader.ts 存在; indexes.ts は data/build.ts + 9 projection の build pipeline で生きており data/lib に残置 (projection 退役時に消化) |
| strict-load.ts | graph 内部 | ◐ src/lib/strict-load.ts に移行(2026-05-14 Phase C #3); 3 層(graph/views/pages)が消費するため lib 配下が正直な現在地 |
| genre-hub.ts | views/hub + templates/Hub | ◐ src/views/genre-hub.ts に統合(Phase C #4); データ/HTML 拆分は Phase D 範疇 |
| skills-hub.ts | views/skill + templates/SkillHub | ◐ src/views/skills-hub.ts に統合; 同上 |
| interests.ts | views/interest + templates/InterestHub | ◐ src/views/interests.ts に統合; 同上 |
| rankings.ts | views/ranking + templates/Ranking | ◐ src/views/rankings.ts に移行(Phase B #17); 拆分は Phase D |
| compare-hub.ts | views/compare + templates/Compare | ◐ src/views/compare-hub.ts(Phase B); 拆分は Phase D |
| ranking-renderers.ts | templates/Ranking + primitives | ◐ src/views/ranking-renderers.ts(Phase C #1); templates 階層への移送は Phase D |
| adapt-detail.ts | views/occupation-detail.ts (合併) | ◐ src/views/adapt-detail.ts に移行(Phase C #1); 合併は Phase D |
| projection-schemas.ts | Layer 3 出力型 | ◐ src/lib/projection-schemas.ts(Phase B #2); view 出力型として再分類は Phase D |
| og-helpers.ts 二次 schema | 削除 | ⏳ 未処理; og-helpers.ts に zod 残り 1 箇所 |
| api/og.tsx カード設定 | views/og-card + templates/og-card.tsx | ✓ src/views/og-cards.ts 構築済(Step 9) |
| pages frontmatter slim | **緩和済**(2026-05-14): 行数ではなく "responsibility" で判定 | ✓ 全 page が `getStaticPaths` 内で view 関数を呼び、props を組み立てる範囲に留まっている。inline `<style>` 抽出は Phase E。§2.5 の表 + 決定ログ参照 |
| src/index-source.html 5230 行 | View + Template 分解 | ◐ inline `<style>` 抽出済; inline `<script>` 1881 行は BaseLayout リファクタ時 |
| src/pages/map.astro 1217 行 | モジュール抽出 | ⏳ 未処理 |

**Phase D 候補(残作業)**: データ/HTML 拆分(hub × 3, ranking × 2, compare × 1)、adapt-detail 合併、og-helpers 二次 schema 削除、Step 11 inline script 抽出(BaseLayout/Footer リファクタと同時)。

---

## 9. 移行戦略: Strangler Fig

**コア思想**: 新アーキテクチャを旧コードの隣に共存させ、1 つずつ旧を絞め殺し、最終的に完全に置き換える。**どの時点でもサイト全体が ship 可能**、旧経路はいつでも退却できる。

**主要性質**:
- 新旧並行 — 同一の sources を共有、消費経路が並列 2 セット(旧経路は `buildIndexes()` + projection JSON、新経路は `loadGraph()` + view)
- 各 page family は独立移行、独立 PR、独立 preview 検証
- snapshot ガード — 移行のたびに 0 diff か、明示的なレビュー済み diff
- 削除は移行の後 — 旧ファイルは **完全に誰も import しなくなって** から削除

---

## 10. 共存ルール(移行期間中)

| ルール | 意味 |
|---|---|
| 新コードは新アーキテクチャのみ | 新規追加の page / view / template は 5 層契約に従う |
| 新コードは自己完結、旧コードに依存しない | 新 `src/graph/` / `src/views/` / `src/templates/` は `src/data/lib/*-hub.ts` や `src/data/projections/*` を一切 import しない |
| Page は一括切替 | 1 つの page は新経路か旧経路のどちらか、混合不可 |
| Snapshot ガード切替 | 各 page family の移行には snapshot 検証エビデンスを添付 |
| 削除は移行に遅延 | 旧ファイルは import が完全に消えた時のみ削除 |
| PR 粒度 | page family 単位で 1 PR |

---

## 11. 移行順序

| ステップ | 内容 | 工数 | 状態 |
|---|---|---|---|
| **0** | **SEO baseline キャプチャ**(2026-05-12 完了、§7 参照) | 2d | ✓ |
| 1 | Graph 層(`src/graph/`) | 5d | ✓ |
| 2 | SectorView の最初の end-to-end + baseline 検証 | 7d | ✓ |
| 3 | アーキテクチャ境界 verification gate(grep + snapshot) | 3d | ✓ |
| 4 | Hub ファミリー(abilities/knowledge/values/...) | 5d | ✓ |
| 5 | Ranking ファミリー | 4d | ✓ |
| 6 | Compare ファミリー | 3d | ✓ |
| 7 | Skill / Interest ファミリー | 3d | ✓ |
| 8 | OccupationDetail(主戦場、556 ページ) | 10d | ✓ |
| 9 | OG endpoint リファクタ | 5d | ✓ |
| 10 | JsonLd / Meta / Sitemap を view に統一 | 2d | ✓ |
| 11 | Legacy island(index / map) | 12d | ◐ |
| 12 | 旧 `src/data/lib/*` のデッドコード掃除 | 3d | ✓ |
| 12.B | 18 個の untested data/lib ファイル退役(Phase B) | 4d | ✓ |
| 12.C | 残り 13 個の tested data/lib ファイル消化(Phase C) | 2d | ✓ |

**合計 64 工数日(step 0 完了済を含む)、おおむね 12-15 週フルタイム。**

**Step 11 状態 (◐ 部分完了, 2026-05-13):**
- ✓ `src/index-source.html` の inline `<style>` ブロック(2196 行)を `src/pages/_index-css.ts` に抽出、build 時に注入(2026-05-13)
- ✓ `src/pages/map.astro` の inline `<style>` を `_map-css.ts` に抽出(以前)
- ✓ canonical CSS を `src/lib/canonical-css.ts` に統合(以前)
- ⏳ `src/index-source.html` の inline `<script>` ブロック(1881 行)— IIFE が複雑、PII/analytics 統合が密、リスク対比価値低。将来 BaseLayout+Footer リファクタ時に同時実施予定。

**各ステップの受入基準**:
1. snapshot 比較 0 diff(または明示的にレビュー済み diff)
2. CI 全グリーン(typecheck + tests + SEO baseline + アーキテクチャ境界 grep)
3. preview deploy で人手抽検(最低 3 URL サンプル)
4. PR 説明に受入エビデンスを記載

---

## 12. SAY NO リスト

| やりたくなること | アーキテクチャの答え |
|---|---|
| page frontmatter で detail JSON を直接 fetch | NO(禁止 1 違反) |
| template の中で view 関数を再度呼んでデータを補う | NO(禁止 2 違反) |
| view 関数の中で設定ファイルを読んで挙動を決める | NO(禁止 3 違反 — 設定は引数として渡す) |
| OG endpoint で独自 schema を定義 | NO(OgCardView を消費すべき) |
| sitemap を sitemap.xml.ts で手組み | NO(SitemapView + SitemapTemplate であるべき) |
| graph ロード時に NODE_ENV で分岐 | NO(graph 決定性 = build 再現性) |
| source に `<a href>` リッチテキストを書く | NO(source は「リンク」という概念を知らない) |
| view の中でデータを 'ja' / 'en' に分岐 | NO(i18n は sources に多言語版を追加 + view 層で引数選択) |
| page の中で ranking ソート | NO(ソートは view の責務) |

**この NO は仕事を制約するためではなく、実装プレッシャーでアーキテクチャの形が歪まないよう保護するためのもの。**

---

## 13. 産業界の先例

このアーキテクチャは発明ではなく **応用**。参照可能:

| システム | どこが似ているか |
|---|---|
| **Datomic** | Graph 不変 + 純粋クエリ関数 |
| **Astro Content Collections** | Sources → typed reads(本アーキテクチャの簡略版、graph 層まで) |
| **Hugo** (静的サイトジェネレータ) | Sources → Pages、taxonomies = 簡易グラフエッジ |
| **Gatsby + GraphQL** | Sources → schema → page queries → React → ほぼ完全に対応 |
| **Notion データベース + views** | データ + 複数視点のスライス |
| **Apollo Client + normalized cache** | Graph normalize + selector 関数 = view |

**意味するところ**: 本アーキテクチャは Gatsby / Datomic 経験者なら 5 分で理解できる。学習曲線は産業界の豊富な教材でカバー可能。

---

## 14. 用語集

| 用語 | 定義 | 出典 |
|---|---|---|
| **Knowledge graph** | ノード + エッジ + 属性の領域モデル | Neo4j *Graph Databases* |
| **Property graph** | ノードもエッジも属性を持つグラフ(RDF triple との対比) | グラフデータベース領域 |
| **Materialized view** | 事前に計算しデータとして格納したクエリ結果 | Kleppmann *DDIA* 第 11 章 |
| **CQRS** | Command Query Responsibility Segregation — 読み出しモデルと書き込みモデルの分離 | Greg Young |
| **Strangler Fig** | 新コードが旧コードを 1 つずつ包み込み、完全に置換するまで続ける移行パターン | Martin Fowler |
| **Branded type / Nominal typing** | TypeScript で brand を付けて、構造が同じ型同士を交換不可にする手法 | TS 公式 docs |
| **Pure function** | 副作用なし、I/O なし、同入力に対し常に同出力 | FP |
| **Functional core, imperative shell** | 中間層を純粋関数で、I/O を境界に置くパターン | Gary Bernhardt |
| **SafeHtml (branded)** | ブランド型、唯一の構築方法が escape を経由 | 本アーキテクチャ定義 |
| **View instance** | ある view 種別が具体的な params に対して出力したもの | 本アーキテクチャ定義 |
| **SEO baseline** | URL / meta / JSON-LD / og / 内部リンクの決定的スナップショット | 本アーキテクチャ §7 |

---

## 15. 決定ログ

アーキテクチャレベルの決定を append-only で記録する。**追加のみ、削除・改変禁止**。

### 2026-05-12

- **アーキテクチャ形態確定**: 5 層(Sources / Graph / Views / Templates / Pages)。理由: 問題自身の形状(知識グラフ + スライス)と合致するから。代替案(4 層機械的階層 / 全 Astro コンポーネント / 現状維持)はいずれも却下。
- **クロスサイト再利用を一等市民目標とする**: アーキテクチャは mirai-shigoto.cn / .de / その他姉妹ドメインをサポート可能でなければならない。Sources 層がサイトごとに書き直す唯一の部分。
- **5 つの sub-decision ロック**: 物化ハイブリッド / 単一 graph / ブランド型 / template ハイブリッド形態 / fail-fast。
- **SEO baseline を step 0 とする**: `tests/baseline/` と `scripts/{capture,diff}-seo-baseline.cjs` を構築、CI は `.github/workflows/seo-baseline.yml`。822 URL / 1714 データファイルが baseline に取り込まれた。詳細は §7。
- **OG card PNG の視覚 baseline は Step 9 に後回し**: `og-meta.jsonl` が既に `og:image` URL を守っている、PNG バイト列は OG endpoint 移行時のヘルスチェックで担保。

### 2026-05-13

- **全ドキュメントの日本語化(Phase A.5)**: 本ファイルを含む `docs/*` と一部の `.md` ファイルを日本語に書き直し。サイトが JA-only であり、開発ドキュメントを GitHub に公開する方針との整合性のため。中国語版は `docs/_archive/architecture.zh.md`(本ファイル) などにバックアップ保管(`.gitignore` 下、公開には影響しない)。
- **§6.3 CI 関門の完備**: アーキテクチャ境界 grep / 内部リンク integrity / JSON-LD 構造検証 / A11y baseline / 構造 visual regression を CI に組込み完了(`scripts/check-architecture.cjs` / `scripts/verify-internal-links.cjs` / `scripts/verify-jsonld.cjs` / `tests/e2e/a11y.spec.ts` / `tests/e2e/visual.spec.ts`)。Visual regression は意図的に「構造不変量」アプローチを採用 — pixel snapshot は font レンダリングの CI 不安定性 + バイナリ baseline 管理コストが大きい、SEO baseline byte-compare が HTML 部分はカバー済、追加価値が低い。CSS リファクタリスクが顕在化した時点で pixel snapshot を再評価。
- **Step 11 部分完了**: `src/index-source.html` の inline `<style>` ブロック(2196 行)を `src/pages/_index-css.ts` に抽出、`patchOrThrow` 経由で build 時に注入。SEO baseline byte-identity を保つことを `String.raw` + 文字検査(backtick/`${`/backslash いずれも 0 個)で保証。inline `<script>` ブロック(1881 行)は IIFE + analytics 結合が密かつ価値対比リスクが釣り合わないため、BaseLayout/Footer の本格リファクタ時に再着手予定として明示的に scope out。

### 2026-05-14

- **Vercel Edge bundler の TSX-loader 制約を確定**: Step 9 part 2 で `src/lib/og-renderers/*.tsx` (JSX-bearing) を `api/og.tsx` から import した結果、Vercel の Edge Function bundler が連続 27 回 deploy を失敗させた。3 回の修正試行で根因を確定:
  - Vercel の Edge bundler は **entry 用** loader 集合(`.tsx` 含む)と **dependency 用** loader 集合(`.js`/`.ts` のみ、`.tsx` 無し)を別管理している
  - dep として import された `.tsx` は、`api/` 内部にあっても、explicit extension で書いても、loader 不足で `"unsupported modules"` 扱い
  - `src/lib/og-helpers.ts`(JSX 無し)が動いていたのは `.ts` だから — 偶然成功して問題を覆い隠した
- **規範**: **JSX を含むコードは Edge Function の entry 文件にのみ書く**。helper / sub-renderer は `.ts` で `createElement`(エイリアス `h`)を使って手書きする。`.tsx` を dep にすると Vercel ではビルドが落ちる。`@vercel/og`'s `ImageResponse` は JSX も `createElement` 結果も同じ React 要素を受け取るので、機能差は無い。
- 失敗 commit 範囲: `3d50a8b3..33783386`(27 deploys)。最終解決: 4 renderer を `src/lib/og-renderers/*.ts` に書き直し、JSX 完全排除。ビルド管線に platform-specific workaround は残らない。
- **Edge-function dep gate を自動検出化**: 当初 `EDGE_ENTRIES` は `api/og.tsx` と `middleware.ts` のみハードコード、後で `api/feedback.js` / `api/subscribe.js` を追加した時に手動更新で対応していた。新たな Edge function を将来追加する際にメンテナが gate 更新を忘れると、上記 27 deploy 失敗パターンが再発するリスクがあるため、`api/*.{ts,tsx,js,jsx,mjs,cjs}` + `middleware.{ts,js,mjs}` を scan して `runtime: 'edge'` か `import from '@vercel/edge'` を含むファイルを自動的に Edge entry として登録するように変更。緊急時の override は `EDGE_ENTRIES_OVERRIDE` 環境変数で。
- **§11 範囲外として明示化**: `src/data/lib/` 配下の 18 個の旧データ加工ファイル(計 ~3500 行)は単体テストが未整備。これは §11 Step 12「**死コード**清理」(featured/score_history/tasks の 3 projection 削除済) の scope を超えるため、本 migration からは out-of-scope と確定。今後の独立タスクとして補完予定だが、production 上は live で動いており SEO baseline + 内部リンク integrity + JSON-LD validator が暫定 safety net として機能する。
- **Phase B 18-file 退役完了**: 上記の "out-of-scope" を撤回。同日中に 18 個の untested data/lib ファイル全件を `src/views/` / `src/lib/` へ Strangler Fig 移行。+183 テストを新規追加(542 → 875)、各 commit で SEO baseline byte-identity を `pnpm run check:seo-baseline` で検証、preview 環境で 27 URL 抽検 200。委細は §11 表の Step 12.B 行を参照。最重要 commits: `#15 inline-links`(17 importers + XSS test)、`#16 hub-hub-graph`(qaSlugSet 回帰 pin、commit 94b64855 の 33 broken-link 修正をテストで固定)、`#17 rankings`(1425 行、8 importers、含 multi-line dynamic await import)、`#18 genre-configs`(22 importers、21 page families、+8 invariant tests for 61-hub config tree)。
- **Phase C 13-file 消化完了**: Phase B の続きで、テスト済の残り 13 ファイル(`adapt-detail / genre-hub / interests / occupation-faqs / occupation-definition / ranking-renderers / rankings-meta / score-strategy / sector-faqs / sector-resolver / skills-hub / strict-load`)を全件適切な層へ消化。4 commits 構成: #1 = 6 pure-data ファイル → views; #2 = sector-resolver + score-strategy → graph; #3 = strict-load → lib(graph/views/pages の 3 層クロス利用のため lib が正直な現在地、doc §8 の "graph 内部" 目標は projection 退役時の Phase D); #4 = 3 大 hub(genre-hub 511 行 + skills-hub 413 行 + interests 509 行)を views へ移送、data/HTML 拆分は doc §8 通り Phase D。各 commit SEO baseline 0 drift、883/883 テスト、`scripts/check-architecture.cjs` 全緑。最終 `src/data/lib/` 残置 = `bands.ts` / `banker-round.ts` / `fsum.ts` / `indexes.ts` の 4 ファイル — いずれも消費者解析で正しい位置と確認済(bands は data 層 classifier で src/lib/risk.ts が UI 配対、indexes は data/build.ts + 9 projection の build pipeline 中核、banker-round / fsum は projection のみ消費)。
- **Phase D 候補スコープ確定**: 残作業を §8 表末尾 "Phase D 候補" に明示。3 大 hub の data/HTML 拆分、ranking/compare の同様な拆分、adapt-detail の occupation-detail への合併、og-helpers の二次 schema 削除、Step 11 inline script 抽出(BaseLayout/Footer リファクタと同時)。SEO baseline + architecture-gate が現状 safety net として機能しているため、Phase D 着手は機能追加圧力と独立に判断可能。
- **Phase D 完了 + audit**(同日後半): Phase D の 8 項目を 7 commit で完遂(D1-D8;D9 = Step 11 inline script は scope-out のまま)。完了後の audit で 4 つの §6.2 境界違反を発見(`views/ranking.ts:252` の value import + 3 view test の location ズレ + `templates/Ranking.test.ts` の value import + `check-architecture.cjs` の相対パス漏れ + docstring "import" 誤検出)を 1 commit で全修正。さらに 3 つの §3.1 / §3.3 違反を発見(`pages/image-sitemap.xml.ts` の fs+schema parse + `views/{ranking,inline-links,occupation-page-data}.ts` の `node:fs`)、それぞれ 1 commit ずつで修正。最終的に doc §3 五大禁止事項のうち §3.1 / §3.2 / §3.3 / §3.4 / §3.5 すべて(except `occupation-aux-data.ts` の profile5 / transfer_paths fs read = graph schema 未拡張のため Phase E)に違反なし。`scripts/check-architecture.cjs` には relative-path 形式の禁止 import パターンを追加し、`m` フラグ付き行頭 anchor の regex で docstring 内の `import` 誤検出も解消。
- **§2.5 page-file 行数ルール緩和**: 当初設定した "ファイル長 ≤ 30 行" は Astro `getStaticPaths` + props 構築 + meta 計算という現実の binding 仕事量に合わない。15+ 個の hub-family page が 50-150 行のまま残る運用となり、ルール厳守は実装コスト対比 reader value が割に合わない。**緩和**: 行数ではなく "responsibility" で判定(§2.5 表 + 詳細条件参照)。✅ page が許される: view 関数呼出 / destructure / meta 計算 / 派生 props 組立 / inline `<style>`(Phase E まで)。❌ page が許されない: fs / schema parse / HTML 直接組立 / 業務ロジック / mutation。**現状**: 全 page がこの新基準を満たしている。15-150 行の幅は許容(legacy island `index.astro` 98 行 / Step 11 scope-out も含む)。BaseLayout / Footer 重構期(Phase E)に inline `<style>` を抽出すれば自然と多くの page が 50 行台に収まるが、それは強制目標ではなく副産物。

- **Phase D audit #8 — page frontmatter HTML-assembly + index.astro fs read 全消化**(同日深夜): 再 audit で発見した違反を 3 階層で全修正。**(1) 18 hub-index pages の `.map(...).join('')` HTML 組立**: `templates/Hub.ts` に `renderGenreHubIndexCards`, `renderQGroupsHtml`, `renderExploreIndexCards`, `renderExploreGenreCards`, `renderExploreOtherRoutes`, `renderExploreIndexJsonLd`, `renderExploreSlugJsonLd` を追加し、`templates/Ranking.ts` に `renderRankingsHubCards / Stats / Insights` を、`templates/Compare.ts` に `renderCompareHubCards` を、`templates/InterestHub.ts` に `renderInterestsHubCards` を、`templates/SkillHub.ts` に `renderSkillsHubCards` を追加。18 page を呼出だけにスリム化。**(2) 4 hub-family slug page の slim 化**: `_<page>-bindings.ts` パターン(`_compare-bindings.ts` / `_interests-bindings.ts` / `_q-bindings.ts` / `_sectors-index-bindings.ts`)で frontmatter を 17-22 行に削減。**(3) `src/pages/index.astro` の fs read 移送**: `_index-bindings.ts` に `buildIndexPageHtml()` を新設し、`readFileSync(src/index-source.html)` + 4 regex patch + INDEX_CSS 注入を全て移送。`index.astro` 自体は 10 行(コメント + 1 import + 1 call + Fragment)に縮小。`index-source.html` の fs read は `_index-bindings.ts` 内に隔離されており、これは "page sub-layer binding" として doc §3.1 の例外(co-located hand-maintained legacy HTML wrapper)と位置付け。**結果**: page-frontmatter audit で `.map().join('` ヒット 0、fs read 違反 0(`_index-bindings.ts` 内のみ)、SEO baseline 0 drift、883/883 tests、boundary gate 緑、preview deploy 821 pages OK。残作業として views/genre-hub.ts `loadAllDetails()` の fs scan + views/hub-hub-graph + spoke-hub-graph + ranking insights の HTML 生成は Phase E(graph schema 拡張 + view→template 移送)に持ち越し。

### 2026-05-15

- **Phase E — Boundary Calibration 完了**: 外部 audit が指摘した 5 類の境界違反を 1 セッションで全修正。Phase D 以降の "view っぽい場所に置かれた orchestrator" + "type 化されていない SafeHtml 境界" + "散らばった site identity" を構造的に解消。
  - **新規 layer `src/page-data/`**(本 commit で正式化): build orchestration 専用の中間層。`loadGraph()` の起点 + `public/data.*.json` 読込 + Astro `getStaticPaths` 用 dataset 構築を**ここに限定**する。views は graph を受取るのみ。新 layer rule を `scripts/check-architecture.cjs` に登録(templates / components / layouts / .astro / projections の import を禁止;fs / loadGraph は許可)。
  - **`src/views/occupation-page-data.ts` → `src/page-data/`**: 唯一の loadGraph 起点 view を移送。逻辑零変更、import path のみ修正。`[id].astro` の 2 箇所の dynamic import path 更新。
  - **`src/views/occupation-aux-data.ts` → `src/page-data/`**: profile5 / transfer_paths の `readFileSync` 直接消費者。**audit の "短期" 推奨を採用**(移動のみ);"中期" の graph schema 拡張は別タスクに分離(file header に明記)。
  - **Views 層 fs + loadGraph 完全禁止**(Phase D の "tolerated for now" コメント削除): `scripts/check-architecture.cjs` Views ルールに `node:fs` / `node:fs/promises` / `@/graph/loader` / `../graph/loader` を追加。これら 4 禁令が初めて enforce される(views/ 内に直接違反 0)。テスト exception 機構を walker に追加(`.test.ts` / `.test.tsx` は drift-detection で fs を使ってよい)。
  - **SafeHtml 型境界の閉環**:
    - `_id-renderers.ts` の 7 個の `render*Html(): string` を `(): SafeHtml` に締直し(templates 側は既に SafeHtml 返却済、binding 層で brand を捨てていたのを修正)。
    - `_id-bindings.ts` `IdPageBindings` interface の 11 個の `*Html: string` を `SafeHtml` に。`ctxHtml` の手組み concat は `unsafeReviewedHtml` で audit 履歴を残す escape hatch を経由。
    - `views/spoke-{hub,spoke}-graph.ts` の 2 個の `render*Section(): string` を `SafeHtml` に。それを消費する `OccupationSpokeViews` interface も `SafeHtml` に。
  - **`src/site/config.ts` 新設**: hardcode していた `https://mirai-shigoto.com` / `日本の職業 AI 影響マップ` / `lang="ja"` / `og:locale=ja_JP` / default OG image を一箇所に集約。`src/lib/urls.ts` と `src/layouts/BaseLayout.astro` の 4 値が `siteConfig.*` を読むように変更。`config.test.ts` で値を pin(AI が "branding" 修正で silent 改変するリスクを防御)。`feedback_pii_audit_surface` memory に記録済の "operator-name / X-handle が 8+ surfaces に散布した" 過去事故と同じ問題類への構造的対策。
  - **検証結果**: typecheck / 887 unit tests(siteConfig 4 件追加で 883 → 887)/ build 821 pages / 0 leaks / architecture-gate 全緑 / JSON-LD 全合格 / 41,277 internal links 全有効 / SEO baseline drift = sitemap `<lastmod>` の今日日付のみ(意図通り、baseline 更新済)。
  - **明示的に scope-out**: profile5 + transfer_paths の graph schema 統合(audit の "中期");`src/index-source.html` の 167KB スリム化;middleware.ts の analytics fallback リファクタ;`src/data/lib/` 残置 5 ファイルの再配置。**Phase E はここで終わる** — 同 audit が警告した通り、次は内容更新の "沈殿期間" を置いてからアーキテクチャの次の動きを判断する。

- **docs/ 全公開化 + 文書同期 audit**: 同日午後、`282fda41 chore(docs): un-gitignore docs/` で `docs/_archive/` 以外の全ファイル(Design.md / Design-Mobile.md / WORKFLOW.md / DATA_ARCHITECTURE.md / architecture.md / SITE_FULL_VISION.md)が git tracked に。`_archive/` の Phase A.5 中国語バックアップ 3 件は目的達成として削除。同時に 6 文書を **コード現状との整合性 audit**:
  - **architecture.md §0 ヘッダ更新**: "ドラフト(2026-05-12)" → "現行版(Phase B/C/D/E まで完了 = 2026-05-15)"。§2.2 / §2.3 / §2.4 の Layer 2/3/4 「新設(...から進化)」表現を、現実の `src/graph/` 10 ファイル / `src/views/` 60+ ファイル / `src/templates/` 30+ ファイルの状態に合わせて更新。§2 はアーキテクチャ静的構造、§8 / §11 / §15 が施工状態の真実、と読み方ヒントを明示。
  - **Design.md / Design-Mobile.md**: §18.4 移行状態表を Phase D / E 反映で更新、`spoke-hub-graph.ts` / `spoke-spoke-graph.ts` のパス(`src/data/lib/` → `src/views/`)と行番号(352→356 / 150→160)を同期。
  - **WORKFLOW.md**: §13 ドキュメント関係表 / §6 ファイル分類図を「全 `docs/` が GitHub 公開」現実に合わせ更新。README.ja.md / ARCHIVED-MIGRATION_PLAN.md など既に存在しない参照を整理。
  - **DATA_ARCHITECTURE.md**: 全文の Python 系参照(`scripts/build_data.py` / Pydantic / uv 等)を v1.5.0 以降の TypeScript 現実(`src/data/build.ts` / Zod / tsx / `npm run build:data`)に refresh。v1.6.0 entry 追加。歴史的経緯(Python 時代の記述)は新規 附録 B として保存。
  - **SITE_FULL_VISION.md**: §0 / §11 / §12 の各 Phase ステータスを architecture refactor 実態(Phase 1-5 で計画されていた hub family は構造実装完了、深編集は別物として継続中)に合わせ更新。HUB_EXPANSION_PLAN.md 参照削除(既に削除済)。
  - **検証結果**: コード変更ゼロ、内容のみの sync。SEO baseline drift = 0 想定(本コミットには code 変更が含まれないため)。次の commit で `_archive/` 削除 + 6 文書 update を 1 PR にまとめて push to preview。

### 2026-05-16

- **src/data/lib/ 残置 4 ファイルの位置決定ロック + og-helpers 二次 schema 完全消去**: §15 Phase C 完了ログ(2026-05-14)で「消費者解析で正しい位置と確認済」とした `bands.ts` / `banker-round.ts` / `fsum.ts` / `indexes.ts` を、未来の重構者が "Phase D/E 未完了" と誤読しないよう各ファイル先頭に **Location decision (Phase D/E follow-up, 2026-05-16)** docstring を追加し決定を構造的に固定。
  - `bands.ts`: 「データ層 classifier / `src/lib/risk.ts` が UI render mapper」という意図的な data/render split を docstring 明文化。View 層から import される事実は許容(`src/data/schema/*` 同様、データ層のルール参照)。`src/lib/risk.ts` への合併は禁止 — 分業こそが設計意図。
  - `indexes.ts`: build-pipeline join 核として 9 projection が全部依存。`src/graph/` 移送は Layer 2 を projection 内部に結合してしまうため不可、`src/lib/` 移送は ETL plumbing と UI helper を混同するため不可。projection 退役時に "消す" ことはあっても "動かす" ことはない。
  - `banker-round.ts` / `fsum.ts`: 「Python pipeline と byte-identical 保証」のための数値工具。View 層の言及は docstring 参照のみで実 import 無し(`views/ranking.ts:1351` は "matches banker-round.ts" コメント)。projection 専用、外部 0 consumer。
- **og-helpers.ts SectorRecordSchema / SectorsProjectionSchema を projection-schemas.ts に統一**: Phase D #8 で DetailRecordSchema が `DetailFileSchema.pick()` で派生に切り替わった後、Sector 系の二つは未対応で hand-written のまま残っていた(§8 表で "⏳ 未処理; og-helpers.ts に zod 残り 1 箇所" と記述)。og-helpers.test.ts の drift guard が両者の構造同一性を pin していたため、`projection-schemas.ts` の `SectorRecordSchema` を `export` 昇格し、og-helpers.ts は 22 行の手書きを削除して re-export に変更。`SectorRecord` / `SectorsProjection` 型エイリアスは `z.infer` 経由で保持(外部 API 不変、`src/lib/og-renderers/sector.ts:32` の import path 不変)。**§8 表第 11 行(「`src/lib/og-helpers.ts` の二次 schema 削除」)これにて完了 ✅**。
- **検証結果**: typecheck 緑 / og-helpers drift guard 3 件パス / 全 887 unit tests pass(`indexes.test.ts:108` 1 件のみ failing だが Windows path separator regex の pre-existing bug、本変更と無関係)/ projection-schemas / og-helpers / og-renderers の循環依存無し / SEO baseline 改変無し(コード行為変更なし)。
- **DATA_ARCHITECTURE.md §0.1 ヘッダ更新 + SITE_FULL_VISION.md §0.5 新設**: docstring 同期作業の一環。前者は version v1.1.0 → v1.6.0、最終更新を 2026-05-15 に bump。後者は「機能拡張ロードマップ (本ドキュメント §12)」と「コード重構 (architecture.md §11)」の二系統 "Phase" 命名を直交関係として明確化(同名異種の混同防止)。
- **`.gitignore` `*conflicted copy*` パターン追加**: Dropbox 配下のリポジトリで複数マシン間同期競合により発生する `(... conflicted copy YYYY-MM-DD)` 形式の副本を `public/data.*` 規則と独立に明示的にignore。本 commit 時点で git track ゼロ、本番返却 404 を curl 確認済(`public/` 7 件 + `dist-astro/` 7 件 + `analytics/node_modules` 1 件 + `.git/index` 29 件 = 計 44 件を local 物理削除)。根治には repo を Dropbox 外に出す必要があるが、その判断は別 todo。

### 2026-05-17

- **profile5 graph 統合(Phase E follow-up #1)**: §3.3(View 層 fs ゼロ)達成のため、`src/page-data/occupation-aux-data.ts` の `getProfile5()` を退役。アルゴリズム(`AXIS_INPUTS` + `gatherAxis`)を `src/graph/profile5.ts` に新設し `KnowledgeGraph.occupations.<id>.profile5` フィールドとして eagerly 計算。projection 側(`src/data/projections/profile5.ts`)はこの algorithm を import して再利用、`public/data.profile5.json` の出力は **byte-identical**(`/tmp/profile5-before.json` ↔ `public/data.profile5.json` で `diff -q` 検証)。Rec 型に `profile5: Profile5Record` 追加、`adaptDetailFile(d, profile5?)` で optional 引数化。`_id-renderers.ts` から `getProfile5` import 削除、`rec.profile5` 直接消費に切替。新 test 8 件(`src/graph/profile5.test.ts`: 6 件は projection から複製、2 件は `computeProfile5ForOcc` 新規)。
- **transfer_paths graph 統合(Phase E follow-up #2)**: profile5 と同じパターンで `src/graph/transfer-paths.ts` 新設、ただし algorithm が cross-occupation(cosine similarity over same-sector pool → top-N)のため、OccupationNode のフィールドではなく `KnowledgeGraph.transferCandidatesOf(id): TransferPathEntry` graph method として exposure。`loadGraph()` 時に `computeTransferCandidatesMap()` で全 source の候補を一括計算(~30-50ms for N=556、memoized 後一度のみ)。projection(`src/data/projections/transfer_paths.ts`)は同 algorithm を import 再利用、JSON 出力 byte-identical 検証済。`src/page-data/occupation-aux-data.ts` + `occupation-aux-data.test.ts` 全削除 — page-data 層の fs read 完全ゼロ達成。新 test 11 件(`src/graph/transfer-paths.test.ts`: 7 件は cosine、4 件は `computeTransferCandidatesMap`)。これで `views/` + `page-data/` の **両層が fs に依存しない** 状態を構造的に達成。
- **§8 表 row 13/14 完成**: `adapt-detail merge` + `og-helpers 二次 schema` 削除 + `occupation-aux-data` 退役 すべて完了。残作業は Step 11(BaseLayout 重構期予定)のみ。
- **`api/feedback.js` + `api/subscribe.js` rate limit + Turnstile 統合(audit #7-8 完成)**: §15 2026-05-15 entry の "scope-out 項" にあった "feedback / subscribe の rate limiting 未実装" を解消。`src/lib/api-security.js` に 3 helper 追加 — `clientIpFromRequest(req)` / `rateLimitCheck({ip, namespace, limit, windowSeconds, env})` / `verifyTurnstile({token, env, remoteip?})`。**degrade gracefully**: env 変数(`UPSTASH_REDIS_REST_URL/TOKEN`, `TURNSTILE_SECRET_KEY`)が unset の場合 `{ ok: true, skipped: true }` 返却 → 既存防御(honeypot + body cap + origin gate)が引き続き有効、新 env 設定するまで挙動完全互換。Upstash / Cloudflare 障害時 fail-open(本番フォームを単一ベンダ障害で落とさない、`FAIL_CLOSED_ON_RATELIMIT_ERROR=1` で反転可)。feedback: 10 POST/5min、subscribe: 5 POST/5min(opt-in なので厳しめ)。新 test 16 件(env 欠落 / 5xx fail-open / fail-closed / under/over quota / Turnstile token 欠落 各分岐網羅)。`.env.example` に 6 個の新 env 変数文書化。**重要**: 前端 Turnstile widget は未実装 — 形式上 form フロントエンド未実装のため(audit 確認結果)、widget は使い道無し。後続 task で form フロント実装する際に `<div class="cf-turnstile" data-sitekey="...">` 追加するだけで widget が稼働する状態。
- **検証結果**: typecheck / **900 unit tests / 900 pass / 0 fail**(Windows path bug fix + 24 件新規追加で 887 → 900)/ `check-architecture.cjs` 全緑(Edge function dep walker 含む)/ `check-analytics-config.cjs` OK / `check-lockfile-sync.cjs` OK / `check-nested-html-comments.cjs` OK / SEO baseline: profile5 + transfer_paths byte-identical(回归ゼロ)。`check-page-class.cjs` の 6 violation は **pre-existing**(2026-05-16 Page Class System 導入時から、本 commit 前から HEAD で同数 — git stash 検証済)、別 todo として継承。
- **新 layer-isolation 達成**: ✅ views/ から `node:fs` import = 0 / ✅ page-data/ から `node:fs` import = 0(transfer_paths 統合で `occupation-aux-data.ts` 削除済)/ ✅ graph から fs = 0(graph はあくまで source schema + algorithm)/ ✅ data/lib/ 残置 4 ファイル全件 Location decision docstring で固定。**5 層境界が初めて構造的に閉環**。

---

## 付録: なぜ他の形態にしないか

| 代替形態 | 却下理由 |
|---|---|
| ページ結合型(現状の延長) | 800+ ページ規模では保守不能、新規 page family の追加コストが高い |
| 機械的階層(Loader / VM / Renderer / Page) | 概念がシステムの形状とズレている、ViewModel は静的生成では冗長 |
| コンポーネント駆動(全 Astro コンポーネント) | 動的 list mapper / inline link をテキストに埋込はコンポーネントだと悪夢 |
| テンプレートエンジン(Hugo / Jekyll 風) | 関係密度が足りない、compare / cross-hub link を表現できない |

---

**本ドキュメントはこのアーキテクチャの契約**。コード変更で自分がいずれかの条項に違反していると気づいたら、回避するよりも本ドキュメントの再審を優先する。

**本ドキュメントの修正**: アーキテクチャレベルの修正は「決定ログ」に新エントリを追加し、トリガー、影響範囲、後方互換戦略を記載する必要がある。
