# WORKFLOW.md — Mirai-Shigoto 全体ワークフロー

> **本ドキュメントはプロジェクトのエンドツーエンドの運用方法を記述する**: データフロー、ブランチ、デプロイ、CI、日常タスク、ファイル分類。
> アーキテクチャ詳細(schema 契約、ID ルール、projection 出力形状)→ [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md) 参照。
>
> **ステータス**: 現行(v1.5.0、2026-05-09 Track D + follow-up 完了後)。
> フルスタック TypeScript + Astro、Python パイプラインは完全撤去済み。

---

## 1. アーキテクチャ概観(データフロー)

```
┌─────────────────────────────────────────────────────────────────┐
│                      ソースデータ(git に commit)                  │
├─────────────────────────────────────────────────────────────────┤
│  data/occupations/*.json   556 職業のソースデータ                │
│  data/sectors/*.json        16 sector 定義 + overrides           │
│  data/labels/*.json         skill/knowledge/ability ラベル ja-en │
│  data/scores/*.json         AI risk スコア(append-only、上書きなし)│
│  data/stats_legacy/*.json   労働市場統計                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ bun run build:data
                  ┌──────────────────────┐
                  │  TS-ETL              │  src/data/build.ts
                  │  • Zod で検証         │  + src/data/projections/*.ts
                  │  • 12 projection 実行 │
                  └──────────┬───────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│        public/(ローカル + Vercel 両方で生成、gitignored、push しない)│
├─────────────────────────────────────────────────────────────────┤
│  data.treemap.json          552 records(主データソース)         │
│  data.search.json           556 documents                        │
│  data.detail/<id>.json      556 個の詳細データ                   │
│  data.sectors.json          16 sectors + 集約                    │
│  data.transfer_paths.json   職業転換推薦                          │
│  data.profile5.json         5 次元 radar profile                 │
│  data.featured.json         トップ厳選                            │
│  ...他 5 projection                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ astro build
                  ┌──────────────────────┐
                  │  Astro 静的レンダリング│  src/pages/*.astro
                  │  • 589 HTML ページ   │  + src/components/*
                  │  • public/ をコピー入れる│  + src/layouts/*
                  └──────────┬───────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         dist-astro/(Vercel 上でのみ生成、gitignored)              │
├─────────────────────────────────────────────────────────────────┤
│  / about/ /map /privacy /404 等 6 個の静的ページ                 │
│  /ja/{1..584}.html          556 個の詳細ページ                   │
│  /ja/sectors/{16}           16 個の sector hub                   │
│  /ja/rankings/{9}           9 個の ranking                       │
│  /sitemap.xml               動的生成 606 URL                     │
│  /image-sitemap.xml         動的生成 552 OG entries              │
│  /og.png /robots.txt /llms.txt /llms-full.txt   (SEO statics)    │
│  /data.*.json               全 12 projection をフロントエンドが fetch│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ Vercel CDN
                    ┌────────────────────┐
                    │  ブラウザアクセス  │
                    │  + Edge Functions  │  api/og.tsx
                    │  + サードパーティ分析│  api/feedback.js
                    │                    │  api/subscribe.js
                    └────────────────────┘
```

---

## 2. ブランチ + デプロイ

```
GitHub Branches            Vercel デプロイ                ドメイン
─────────────────────────────────────────────────────────────────────
preview    ────────►  preview deployment   ────►  pre.mirai-shigoto.com
                       (staging)

main       ────────►  production deploy    ────►  mirai-shigoto.com
                       (本番)

feature/*  ────────►  per-PR preview       ────►  jobs-XXX-zkscio.vercel.app
                       (PR プレビュー)
```

各 git push が対応する Vercel デプロイをトリガー、~25 秒で完了。

---

## 3. 日常開発フロー

```bash
# 1. コードを書く(ローカルエディタ)
git checkout -b feature/my-change

# 2. リアルタイムプレビュー
bun run dev                  # localhost:4321、ホットリロード
                             # 大きなディレクトリを生成しない

# 3. コミット前自己チェック(秒単位)
bun run typecheck            # TS 型
bun run test                 # 単体テスト(69 個)

# 4. preview に push して実環境で確認
git add .
git commit -m "feat(...): ..."
git push origin preview      # → Vercel が自動デプロイ

# 5. ブラウザで検証
#    https://pre.mirai-shigoto.com/  ← 実 Vercel build
#    Vercel CI が自動実行:
#      typecheck + test + build:data + test:consistency + astro build
#    どれか 1 つでも失敗すれば、マージは止まる

# 6. 問題なければ main にマージして本番投入
git checkout main
git merge preview
git push origin main          # → mirai-shigoto.com 自動デプロイ
```

**重要原則: ローカルで `bun run build` を走らせない** — 浪費(47 MB の dist-astro/ が無用)。Vercel が権威 build 環境。

---

## 4. タスク早見表

| やりたいこと | 編集対象 | 実行コマンド |
|---|---|---|
| typo 修正 | 該当ファイル | `bun run dev` で確認、preview に push |
| 新規職業スコア追加 | `data/scores/<scope>_<model>_<date>.json`(新ファイル、**上書きしない**) | `bun run build:data` |
| sector 分類変更 | `data/sectors/overrides.json` | `bun run build:data` |
| 新規 sector 追加 | `data/sectors/sectors.ja-en.json` + 再実行 | `bun run build:data && bun run test:consistency` |
| 新規 ranking 追加 | `src/data/lib/rankings.ts` に slug + FAQ を追加 | `bun run dev` で検証 |
| IPD データアップグレード | xlsx を `~/Downloads/` に置く | `bun run import:ipd && bun run build:data` |
| フロント UI / スタイル変更 | `src/pages/*.astro` または `src/index-source.html` | `bun run dev` |
| schema 進化 | `src/data/schema/*.ts` + 影響を受ける projection + [id].astro | フルチェック |

---

## 5. CI/CD(設定済)

すべての push / PR で **Vercel の build gate** が自動実行される(GitHub Actions は 2026-05-28 に廃止し、ゲートを Vercel build へ移設):

```yaml
vercel.json › buildCommand
├── bun run typecheck   # TS 型 ✓
├── bun run build       # check-lockfile-sync + check-analytics-config
│                                  # + check-nested-html-comments + build:data
│                                  # (L1+L2 schema + 12 projection) + astro build
│                                  # + check-rendered-leaks + compute-csp-hashes ✓
├── bun run verify:gates  # L3 consistency + check:architecture (+ Edge TSX)
│                                    # + verify:internal-links + verify:jsonld + check:seo-baseline ✓
└── bun run test              # 946 個の単体テスト ✓
```

**どれか 1 つでも失敗すれば → デプロイ失敗 → 本番に反映されない。** 公開 URL と GitHub Deployments は Vercel の GitHub 連携が自動処理する。

> **手動ゲート(自動 CI 外)は e2e のみ**: `tests/e2e/*`(smoke / a11y / visual / analytics)は Chromium バイナリが必要なため deploy には載せず、`bun run test:e2e` でマージ前 / リリース前に手動実行。他の旧 GitHub Actions チェック(L3 consistency・`check:architecture`・`verify:internal-links`・`verify:jsonld`・`check:seo-baseline`)は 2026-05-29 に `verify:gates` 経由で build gate へ再接続済み。

---

## 6. ファイル分類

```
                                ┌─ GitHub に push される
                                │
                ┌─ 追跡(commit)─┤   (含: src/、data/、docs/、README*、CHANGELOG.md、
                │               │    public/og.png、public/robots.txt、public/llms*.txt 等)
                │               │
                │               └─ Vercel でも使用
コード / データ ─┤
                │               ┌─ 絶対 push しない
                └─ gitignored ──┤
                                │   ├─ public/data.*       (build 時に再生成)
                                │   ├─ dist-astro/         (build 時に再生成)
                                │   ├─ _audit/             (ローカル監査メモ)
                                │   ├─ .claude/ .vercel/   (ツール private)
                                │   ├─ node_modules/       (npm install で再構築)
                                │   ├─ analytics/dashboards.md  (内部 URL / アカウントパス含)
                                │   └─ .env*               (秘密情報)
                                │
                                └─ Vercel が再生成
```

公開リポジトリ(GitHub)にはソース + ソースデータ + ドキュメント + 4 つの SEO 静的ファイル。生成成果物はすべて Vercel/ローカルが必要に応じて再構築する。

> **注**: 2026-05-14 commit `282fda41 chore(docs): un-gitignore docs/` 以降、`docs/` 全体が git tracked。それ以前は「ローカル only」だった(機密性ではなく、内部メモを公開しないという方針)。日本語化(Phase A.5)を経て、現在は開発者向け公開ドキュメントとして共有される。

---

## 7. 鍵となる「なぜ」

| 決定 | 理由 |
|---|---|
| `data/` を git に入れ、`public/data.*` を入れない | ソースデータが真理、projection は派生 — projection は再生成可能 |
| 4 つの SEO 静的を git に入れる(`public/` 内) | 手動メンテの真理(robots.txt 等)であり、生成物ではない |
| `dist-astro/` を git に入れない | 100% 生成物、Vercel が権威 build |
| preview ブランチを使い、main に直 push しない | あらゆる変更を pre.mirai-shigoto.com で先に検証、本番に影響を与えない |
| ローカル build ではなく Vercel build | CI が標準環境で実行(Node 22)、ローカル node_modules 状態に依存しない |
| `api/*.{tsx,js}` の Edge Functions | 動的(OG カード、購読、フィードバック)は serverless、静的(556 詳細ページ)は SSG |

---

## 8. 主要コマンド一覧

```
日常:
  bun run dev                  → コード書いている時のリアルタイムプレビュー
  git push origin preview      → staging へのデプロイで検証

たまに:
  bun run typecheck            → 型の問題を疑うとき
  bun run test                 → lib のアルゴリズムを変えたとき
  bun run test:consistency     → ソースデータを変えた後

データアップグレード時:
  bun run import:ipd           → IPD xlsx → data/occupations/

ほぼ使わない:
  bun run build                → 浪費(Vercel が build)
  bun run preview              → build エラーをデバッグするときのみ
  bun run audit                → 週次の依存セキュリティチェック
```

---

## 9. アンチパターン(やらないこと)

- ❌ `public/data.*` を編集する — これは生成物、build:data で上書きされる。ソース `data/*` を編集して再構築する
- ❌ 新 Astro page を追加するが `src/pages/sitemap.xml.ts` を更新しない — 新ページが検索エンジンに発見されない
- ❌ `src/index-source.html` で外部 JS を呼ぶ `<script>` を書く — CSP がブロックする。インライン JS のみ可
- ❌ `src/index-source.html` のトップレベル `<script>` で `return` を使う — あれは classic script で IIFE ではない、トップレベル return は SyntaxError。`throw` を代わりに使う
- ❌ `api/*.tsx` で `Resend` を try/catch なしで呼ぶ — Vercel Edge Function の例外が social-card scraper に 500 をキャッシュさせる
- ❌ `_audit/` や `dist-py.next/` 等のローカル作業ディレクトリを commit する — 既に .gitignore に入っているが、`git add -f` は避ける
- ❌ `main` に直接 push する — 必ず preview で検証
- ❌ ローカル `bun run build` を sanity check として使う — 代わりに `bun run typecheck && bun run test` を使う

---

## 10. トラブルシュート早見表

### `bun run build:data` 失敗「validation error in data/...」
ソースデータが Zod schema を破壊している。エラーメッセージでファイル + フィールド名を読み、`src/data/schema/<file>.ts` の契約を確認して修正する。

### `bun run build` 失敗で Astro テンプレートエラー
通常は詳細ページや sector hub が存在しないフィールドを参照している。エラースタックで `.astro` ファイルを特定し:
- フィールド名 typo? → .astro 修正
- フィールドが schema にない? → schema 進化フローを通す

### Vercel build 失敗だがローカル OK
確認:
- env 変数が Vercel dashboard に揃っているか(`RESEND_API_KEY`、`RESEND_AUDIENCE_ID_JA`、`FEEDBACK_TO_EMAIL`、`FEEDBACK_FROM_EMAIL`)
- Node バージョンが合っているか(ローカル `node --version` vs Vercel build log の 1 行目)
- `package.json` の依存がすべて commit 済か
- `public/data.*` が commit されていないか(gitignored、Vercel が build:data で再生成)

### 詳細ページに 1 つの職業が抜けている
- score 未記入? → `data/scores/` にその id の最新 run があるか確認
- sector が未分類? → `public/data.review_queue.json` の uncategorized セクション、`data/sectors/overrides.json` で強制分類
- stats 欠落? → `data/stats_legacy/<padded>.json` が存在しない = その職業に公式統計なし(新規追加の 581-584 等でよくある)

### sitemap.xml の URL 数が合わない
`src/pages/sitemap.xml.ts` は動的生成、数 = 50(static)+ N(occupations)。期待される N = `public/data.detail/*.json` のファイル数。N が間違っているなら問題は build:data 側、sitemap エンドポイント側ではない。

### ブラウザで開いて 200 だがページが動かない
DevTools Console を見る。可能性:
- インライン `<script>` に SyntaxError(CI は検出しない、Node の `vm.Script` のみ検出)— 歴史的教訓: トップレベル `return` = 死亡
- DOM 要素 missing、handler が null に hook
- CSP が third-party script をブロック — Console の「Refused to...」エラーを見る

---

## 11. 協業ルール

- 主ブランチ: `main`(本番)、`preview`(staging)
- PR は `feature-branch → preview` で進め、検証後に `preview → main`
- main への直 push は緊急修正(ロールバック)のみ
- CI がグリーンでないとマージ不可
- Commit format: `<type>(<scope>): <summary>` —
  type ∈ {feat, fix, refactor, chore, docs, test, ci, perf}

---

## 12. 数字一覧

```
リポジトリ:                       Vercel build:
  src ファイル:    ~80              build 時間:    ~25 秒
  data ファイル:   1500+             デプロイ時間:  ~5 秒
  test ファイル:   8(69 単体テスト)  合計:          30 秒 / push

リポジトリ現状(v1.5.0):
  Python コード:    0
  any 型:           0([id].astro)
  TODO:             意識的 deferred のみ(rate limit 等)
  CI カバー:        typecheck + test + build:data + test:consistency + astro build
  テスト数:         69 単体テスト + L3 整合性 + クロス projection ID 不変条件
```

---

## 13. ドキュメント関係

| ドキュメント | 答える質問 | 場所 |
|---|---|---|
| **本ドキュメント(WORKFLOW.md)** | **どうやるか** — コマンド、順序、commit、デプロイ、トラブルシュート | `docs/`(GitHub 公開) |
| [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md) | **何であるか** — schema、ファイルレイアウト、projection 契約、データソース | `docs/`(GitHub 公開) |
| [architecture.md](./architecture.md) | コード構成、5 層契約、SEO baseline、移行履歴 | `docs/`(GitHub 公開) |
| [SITE_FULL_VISION.md](./SITE_FULL_VISION.md) | 全体ビジョン、820 ページ完成形、フェーズ計画 | `docs/`(GitHub 公開) |
| [Design.md](./Design.md) | フロントエンドの見せ方(PC) | `docs/`(GitHub 公開) |
| [Design-Mobile.md](./Design-Mobile.md) | フロントエンドの見せ方(mobile + `/map`) | `docs/`(GitHub 公開) |
| [`data/README.md`](../data/README.md) | データ貢献者: 各種データファイルの変更方法 | git tracked |
| [`README.md`](../README.md) | プロジェクトホーム(日本語、正本) | git tracked |
| [`README.en.md`](../README.en.md) | プロジェクトホーム(英語、対外) | git tracked |
| [`CHANGELOG.md`](../CHANGELOG.md) | 各 release で何を変えたか(英語、release notes 慣例) | git tracked |

---

歴史: PROPOSED_WORKFLOW.md から改名(2026-05-09 Track D 完了後)。
v1.5.0 で書き直し(2026-05-09 follow-up cleanup)、Python/uv/Pydantic の陳腐な参照を排除、現行 TS+Astro アーキテクチャを反映。
最終全体再編は 2026-05-09 evening、アーキテクチャ図 + タスク早見表 + アンチパターン + トラブルシュートを追加。
2026-05-13 Phase A.5 で全文を日本語化。
2026-05-14 commit `282fda41` で `docs/` を git に追加(以前は gitignored)、本ファイルも GitHub 公開対象に。
2026-05-15 §13 ドキュメント関係表を全 docs/ が GitHub 公開状態である現実に合わせて更新、archive 系参照(README.ja.md / ARCHIVED-MIGRATION_PLAN.md)を整理。
