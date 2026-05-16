# DATA_ARCHITECTURE.md — mirai-shigoto.com データアーキテクチャ仕様

> 本ドキュメントは **目標データアーキテクチャ仕様**。現在の実装済状態、v1.0.3 目標設計、将来計画を記述する; 具体的な適用境界は §0.1 状態マトリクス参照。
>
> 3 範囲の権威関係:
> - **実装済範囲**: **現実のコードが基準**、本ドキュメントは事実記述のみ; 不一致があれば本ドキュメントを修正する
> - **目標範囲(v1.0.3 今回作業分)**: **本ドキュメントが基準**、コードは本ドキュメントに合わせて修正されるべき逸脱と見なす
> - **将来計画範囲(§10)**: 方向性の記録のみ、コードも本ドキュメントの実装も拘束しない
>
> **重要 update 2026-05-15(v1.6.0)**: v1.5.0 で Python pipeline は完全廃止された(commit `66cc97aa feat(arch): remove /m/ pipeline — single responsive URL architecture` 系)。本ファイル §0.2 / §7 / §8 はすべて TypeScript ETL(`src/data/build.ts`、`tsx` runner、Zod schema)を記述する。歴史的な Python 時代(`scripts/build_data.py`、Pydantic、`uv run python`)の経緯と動機は **附録 B「歴史的経緯(Python 時代)」** に保存。コードを読みながら本ファイル §7/§8 を参照するときは「現在の TypeScript 実装」を、過去の commit を遡るときは「附録 B」を見ること。

---

## 0. ドキュメントと適用範囲

### 0.1 Document Status

| フィールド | 値 |
|---|---|
| バージョン | v1.6.0 |
| 最終更新 | 2026-05-15 |
| 全体ステータス | **Current Spec — TypeScript ETL に完全移行済、5 層アーキテクチャ refactor (Phase B/C/D/E) 完了** |
| 実装済範囲 | **v1.6.0 以降: Phase B/C/D/E 完了** + v1.5.0 で Python pipeline 完全廃止。すべての ETL は `src/data/build.ts`(tsx runner、Zod schema)で動作、9 投影ファミリーを `public/data.*` に出力。サイト本体は 5 層アーキテクチャ(Sources / Graph / Views / Templates / Pages、Phase E で page-data 中間層追加)に従う。Sector taxonomy サブシステム(§6.11)+ Phase 1-4 + EN UI 廃止(v1.4.0)すべて反映済。**本ドキュメントは schema / パス / 命名 / 投影契約に対し権威を持つ**。 |
| 未実装(将来 Phase / 本回範囲外) | 4 新規職業(581-584)の英訳; O*NET ラベルの人間クロス検証(labels は現在 draft v0.1); Future-coded 投影ファミリー(tasks/skills/holland/featured/score-history)は対応 UX オンライン時に有効化(`--enable-future` フラグ); profile5 + transfer_paths の graph schema 統合(現在 page-data 層に fs read 隔離); src/index-source.html の inline `<script>` 1881 行抽出(BaseLayout/Footer 重構期に同時実施)。 |
| 将来計画 | §10「将来移行パス」(M-001 から M-005)—— 方向性の記録のみ、現在の受入対象外 |
| 関連ドキュメント | [architecture.md](./architecture.md)(5 層コードアーキテクチャ)、[Design.md](./Design.md)(フロントエンド呈現)、[CHANGELOG.md](../CHANGELOG.md)(プロダクトバージョン) |

> **AI / プログラマー読書注意**: 各 **データソース** と **投影** には **Status**(`Implemented` / `Planned` / `Future`)が付く。プロセス章節(§7 Build Pipeline、§8 アップグレードフロー)は **セクションレベル Status** に属し、該セクション冒頭で個別に標示する。**`Implemented` だけが現在の事実**; `Planned` は今回作業の目標; `Future` は将来の可能性方向、**今は実装しない**。

### 0.2 Prerequisites

build / import フローの実行前提(v1.5.0 以降の TypeScript pipeline):

| 項目 | バージョン / 要件 | 現在状態 |
|---|---|---|
| Node | ≥ 22(`package.json` engines)、Vercel は Node 22 LTS | Implemented |
| パッケージ管理 | `pnpm`(corepack 経由、`pnpm-lock.yaml` で固定) | Implemented |
| TypeScript runner | `tsx`(`devDependencies`)で `.ts` を直接実行 | Implemented |
| TypeScript | strict mode、`tsconfig.json` で `noEmit` | Implemented |
| Schema 検証 | `zod`(`dependencies`、build 時 + テスト時のみ消費) | Implemented |
| xlsx 読込 | `xlsx`(`devDependencies`、`src/data/import-ipd.ts` でのみ使用) | Implemented |
| Frontend stack | Astro ≥ 6.x、React 18.x(Edge Functions + 一部 component)、@vercel/og 0.6.x | Implemented |
| 作業ディレクトリ | リポジトリ root(すべての `npm run *` / `tsx src/*` コマンドはここで実行) | Implemented |

> **v1.5.0 以前との差異**: Python ≥ 3.11、`uv`、`pydantic`、`openpyxl`、`beautifulsoup4`、`httpx`、`playwright`、`python-dotenv` はすべて廃止。歴史については **附録 B** 参照。

### 0.3 適用範囲

- `data/`(ソースデータ: IPD、stats_legacy、scores、translations、labels、schema)
- `dist/`(構築成果物: 9 投影ファミリー / 10 投影ファイル)
- `src/data/build.ts`(構築パイプライン、`npm run build:data` で実行)
- `src/data/import-ipd.ts`(一回限り / アップグレード時の xlsx → JSON インポート、`npm run import:ipd` で実行)
- `public/data.*` を読むすべてのフロントエンドコード(`src/pages/*.astro`、`api/og.tsx`、`middleware.ts` 等。v1.5.0 以降 `index.html` / `build_occupations.py` は廃止、附録 B 参照)

> [Design.md](./Design.md) との関係: Design.md は「フロントエンドでの呈現の仕方」を、本ドキュメントは「データがどこから来て、どう保存され、どうパッケージされるか」を管轄する。両者は `dist/data.*` 投影契約で接続される。

---

## 1. コア原則

1. **IPD は職業プロファイルの唯一の権威源**。他のソース(jobtag ウェブクロール、ハローワーク 等)は **明示的に注記されたパッチ層**(例: `stats_legacy/`)としてのみ使え、IPD データと同一フィールドに混入してはならない。
2. **ソース / 中間 / 投影 の 3 層強分離**。ソース(`data/`)は人手メンテの事実; 投影(`dist/`)は build の出力で **手編集厳禁**; build スクリプト(`scripts/`)が唯一の橋。
3. **各消費者は自分用に最適化された投影を取得する**。フロントエンドのトップページ、詳細ページ、OG API、将来のモバイル端、それぞれが自分向けの最薄 JSON を取る。**「1 つに膨らませて全員で使う」中間成果物は存在しない**。
4. **Schema 強制検証**。すべてのソース JSON は build 時に Zod schema 検証(`src/data/schema/*.ts`)を通過する; フィールド名 typo / 型不一致 / 範囲外は build 失敗(`tsx src/data/build.ts` が exit 1)。
5. **複数回 AI スコアリングを全量保持**。`data/scores/` の旧ファイルは永遠に削除しない —— 大規模モデル昇格時の新スコアは履歴記録の一部、プロダクト内容(「スコアリングの進化」は将来可視化対象)。
6. **翻訳と主ソースを切り離す**。すべての非日本語コンテンツは `data/translations/<lang>/` 独立層に置く; 主 JSON は日本語 + 共通 key のみ。新言語追加 = ディレクトリ追加、主ソース不変。
7. **変更は必ず本ファイルを先に動かす**。ソース構造 / 投影契約 / build フローの変更は、まず本ドキュメントに反映してからコードを書く。

---

## 2. データソース

### 2.1 IPD(主ソース)

- **Status**: **Implemented**(v1.0.7 以降; `data/occupations_full.json` は `data/.archive/v0.6/` にアーカイブ済)
- **正式名**: 日本版 O-NET インプットデータ(職業情報データベース)
- **発行元**: 独立行政法人 労働政策研究・研修機構(JILPT); 厚労省 jobtag サイト経由で配布
- **著作権者**: JILPT(「同データベースの著作権に関する全ての権利は同機構が保有しています」)
- **現バージョン**: v7.00
  - **発行日(site publish)**: 2026-03-17(job tag サイト更新日; 本バッチで 15 職業新規追加)
  - **データ基準日(data cut)**: 2026-02-10(数値系 内部最終更新日)/ 2026-02-26(解説系 内部最終更新日)
- **物理形態**: 2 つの xlsx ファイル
  - `IPD_DL_numeric_7_00.xlsx`: 数値系(518 職業 × 479 フィールド、技能/知識/能力/タスク等)
  - `IPD_DL_description_7_00_01.xlsx`: 解説系(556 職業 × 102 フィールド、説明/分類/別名/関連団体等)
- **データ辞書**: 両 xlsx に `インプットデータ細目` sheet を含み、574 フィールド全部の IPD-ID、型、範囲、意味を定義する。**これが schema の事実源**。
- **カバー領域**:
  - 01 収録番号(主キー)
  - 02 名称・分類領域: 職業名 + 厚労省分類 + JSOC 分類 + 25 個別名
  - 03 解説領域: 簡易説明 / どんな職業か / 就くには / 労働条件 + 関連団体(10 個 + URL) + 関連資格(35 個)
  - 04 数値プロファイル領域(核心): 職業興味 6 / 仕事価値観 11 / スキル 39 / 知識 33 / 仕事の性質 39 / 学歴 9 / 入職前訓練 10 / 入職前経験 10 / 入職後訓練 10 / 仕事活動 41 / 就業形態 10 / アビリティ 35(v1.0.6 修正: 原文 78 / 66 は `_無関係フラグ` 子節を含んでいた、実 score フィールドは 39 / 33)
  - 05 タスク領域: 最大 37 タスク × {description, 実施率, 重要度}
  - 77 直近情報源領域: 各サブ領域の出典情報
  - 88 直近更新年度領域: 各サブ領域の更新年度
  - 99 その他領域: サンプル不足等のビジネスフラグビット
- **保存**: 原 xlsx ファイルは **git に入れない**(大きく、バイナリ)。`~/Downloads/` にダウンロード後、`scripts/import_ipd.py` で `data/occupations/<id>.json` にインポートする。
- **データ来歴(Provenance)**(v1.0.5 で公式ページと突合済):

  | フィールド | 値 |
  |---|---|
  | `source_index_url` | https://shigoto.mhlw.go.jp/User/download (job tag ダウンロードインデックスページ、URL 安定) |
  | `source_file_url_numeric` | https://sgteprdstaplog01.blob.core.windows.net/web-app-contents/downloads/ver13/IPD_DL_numeric_7_00.xlsx |
  | `source_file_url_description` | https://sgteprdstaplog01.blob.core.windows.net/web-app-contents/downloads/ver13/IPD_DL_description_7_00_01.xlsx |
  | `source_publisher` | 独立行政法人 労働政策研究・研修機構(JILPT) |
  | `source_distributor` | 厚生労働省 / 職業情報提供サイト(job tag) |
  | `source_dataset` | 職業情報データベース 簡易版ダウンロードデータ(数値系 + 解説系) |
  | `version` | v7.00 |
  | `published_at` | 2026-03-17(job tag サイト発行日) |
  | `data_cut_date` | 2026-02-10(数値系)/ 2026-02-26(解説系) |
  | `retrieved_at` | (`import_ipd.py` が `data/occupations/<id>.json` のトップレベル `data_source_versions.ipd_retrieved_at` に書込む) |
  | `sha256` | (`import_ipd.py` が計算し `data/.ipd_provenance.json` に記録) |
  | `license_terms` | **二次利用 OK**。job tag 利用規約 第 9 条明文: 「職業解説 / 職業の数値情報 については 編集・加工、再集計等の二次利用が可能です」。本プロジェクトの IPD データ解析・結合・投影は本条項が許可する「加工・再集計」に該当する。 |
  | `restrictions` | 利用規約 第 8 条: 『職業興味検査』『仕事価値観検査』『職業適性テスト(Gテスト)』 の問題(画像含む)はいかなる形式の記録 / 複製 / 配信も禁止。**本プロジェクトはこれらの test データを使わず**、IPD 簡易版の occupation profile のみ使用、禁止領域には触れない。 |
  | `attribution_required` | **必要**。規定フォーマット(必ずこの通りに書く):<br/>原文フォーマット: `『職業情報データベース 解説系ダウンロードデータ ver.7.00』職業情報提供サイト(job tag)より YYYY 年 MM 月 DD 日にダウンロード`<br/>加工版追記: `(https://shigoto.mhlw.go.jp/User/download)を加工して作成` |
  | `attribution_locations` | 必須表示: サイト footer / README.md + README.ja.md / 詳細ページ(IPD データに隣接) / data.json 派生投影トップのコメント |
  | `tos_url` | https://shigoto.mhlw.go.jp/User/tos (完全な利用規約) |

### 2.2 stats_legacy(給与パッチ層)

- **Status**: **Implemented**(v1.0.7 以降; 旧 `data.json` は `data/.archive/v0.6/` にアーカイブ済)
- **存在理由**: IPD は **給与 / 就業者数 / 労働時間 / 年齢 / 求人賃金 / 求人倍率を含まない**。これらは jobtag.mhlw.go.jp の Web ページで JILPT が **賃金構造基本統計調査**、**労働力調査**、**ハローワーク求人統計** の 3 種類の異なる政府データから集約したもの。
- **現在のソース**: 過去にクロールした `data.json` から抽出(一回限り)。
- **重要な境界**: stats_legacy は **物理的に IPD occupation 主ソースから独立** —— `data/stats_legacy/<id>.json` 単独ファイルに存在。**`data/occupations/<id>.json` に埋め込み禁止**(§1 の第 1 / 2 条原則違反)。
  - source 層: 2 ファイル、id でペア
  - build 層: `build_data.py` で join
  - projection 層: `dist/data.detail/<id>.json` で初めて結合後の `stats_legacy` サブオブジェクトが出現
- **6 フィールド**:
  | フィールド | 単位 | ソース |
  |---|---|---|
  | `salary_man_yen` | 万円/年 | 賃金構造基本統計調査 |
  | `workers` | 人 | 労働力調査 |
  | `monthly_hours` | 時間/月 | 賃金構造基本統計調査 |
  | `average_age` | 歳 | 賃金構造基本統計調査 |
  | `recruit_wage_man_yen` | 万円/月 | ハローワーク求人統計 |
  | `recruit_ratio` | 倍 | ハローワーク求人統計 |
- **カバー**: 552 レコード(うち 535 件が 6 フィールド完備; 4 つの IPD 新規職業 581-584 は未対応)。
- **更新戦略**: 現在は **凍結スナップショット**(能動更新なし)。将来更新する場合は 3 つの選択肢:
  - A. jobtag の stats panel を再クロール(推奨、自動追従)
  - B. e-Stat 賃金構造基本統計調査 API に接続(最も権威、作業量大)
  - C. JILPT がこの部分を IPD 詳細版に取り込むのを待つ(受動)
- **保存**: `data/stats_legacy/<id>.json` 1 職業 1 ファイル。
- **データ来歴(Provenance)**:

  | フィールド | 値 |
  |---|---|
  | `source_url` | 間接的に https://shigoto.mhlw.go.jp/User/Occupation/Detail/<id> の stats panel から |
  | `source_publisher` | 厚生労働省(集約) |
  | `original_surveys` | 賃金構造基本統計調査 / 労働力調査 / ハローワーク求人統計 |
  | `retrieved_at` | 2026-04-25(一回限り歴史クロール) |
  | `sha256` | (migration スクリプトが計算し `data/.stats_legacy_provenance.json` に記録) |
  | `license_terms` | **未確認**。stats ソース(賃金構造基本統計調査 / 労働力調査 / ハローワーク求人統計)の二次利用条項は実装時に e-Stat 公式ページと厚労省条項を 1 件ずつ突合する必要がある。 |
  | `freshness` | **凍結** —— 能動更新せず; リフレッシュする場合は前述 A/B/C 選択肢 |

### 2.3 AI scores(評価層)

- **Status**: 現在 `data/ai_scores_2026-04-25.json` は実装済(**Implemented**); 複数の歴史保持 + タスクレベル評価 + ScoreRun 完全 schema は **Planned**
- **大規模モデルアップグレードまたは再キャリブレーション時に 1 回実行**。毎回独立した JSON ファイルを 1 つ生成、**永遠に削除しない**。
- **ファイル命名**: `<scope>_<model-slug>_<run-date>.json`
  - `<scope>` ∈ {`occupations`, `tasks`}、prefix 必須、2 種類の評価混同を回避
  - `<model-slug>` は小文字ハイフン: `claude-opus-4-7`、`gpt-5`
  - `<run-date>` は ISO 形式: `YYYY-MM-DD`
  - 例: `occupations_claude-opus-4-7_2026-04-25.json`、`tasks_claude-opus-4-8_2027-01-10.json`
- **現有**: `occupations_claude-opus-4-7_2026-04-25.json`(原 `data/ai_scores_2026-04-25.json` を改名 + `occupations_` prefix 追加)
- **最新取得戦略**: デフォルトでは `run_date` で最新のものを取る。この戦略は `scripts/lib/score_strategy.py` に書く、**複数 projection に散らさない**。

#### 2.3.1 ScoreRun Schema(v1.0.3 完全メタデータ新規追加)

各 score ファイルは以下の schema を満たす必要がある(`scores` 以外のフィールドは監査 / 再現のためのメタデータ):

```json
{
  "schema_version": "2.0",
  "scope": "occupations",
  "scorer": {
    "model": "claude-opus-4-7",
    "model_provider": "anthropic",
    "model_temperature": 0.2,
    "scoring_method": "single-pass per occupation"
  },
  "run": {
    "run_date": "2026-04-25",
    "run_id": "occ_2026-04-25_v1",
    "duration_minutes": 38,
    "operator": "jasonhnd"
  },
  "input": {
    "input_data_version": "ipd_v7.00",
    "input_data_sha256": "<hash of joined source data at scoring time>",
    "occupation_count_scored": 552,
    "occupation_count_skipped": 4
  },
  "prompt": {
    "prompt_version": "1.0",
    "prompt_file": "data/prompts/prompt.ja.md",
    "prompt_sha256": "<hash of prompt file at run time>",
    "rubric_source": "karpathy/jobs 0-10 scale, calibrated for Japan jobtag"
  },
  "anchors": {
    "0-1": "Minimal: physical/hands-on in unpredictable environments",
    "...": "..."
  },
  "caveat": "Rough LLM estimates. ...",
  "scores": {
    "1": {
      "ai_risk": 2,
      "rationale_ja": "伝統的な手作業の食品製造",
      "rationale_en": "Hand-crafted tofu making; manual food trade",
      "confidence": 0.8
    }
  }
}
```

**主要メタデータフィールド**:
- `input_data_version` + `input_data_sha256`: 再現性の核 —— 評価時に使われた source data の正確なバージョンを確認
- `prompt_version` + `prompt_sha256`: rubric 進化追跡
- `model_temperature`: 一貫性に影響する主要 LLM パラメータ
- `confidence`(per-score): オプション、モデルがその評価に対する信頼度

**現有ファイルマイグレーション**:
- `data/ai_scores_2026-04-25.json` → `data/scores/occupations_claude-opus-4-7_2026-04-25.json`
- 旧ファイル `version: "1.0"` → 新 `schema_version: "2.0"`
- 旧ファイル欠落フィールド(input_data_*, prompt_*, model_temperature 等): migration スクリプトが `"<unknown - migrated from v1.0>"` で埋める、ブロックしない

### 2.4 翻訳(多言語層)

- **Status**: **Implemented**(v1.0.7 以降、言語ディレクトリ分離は実装済; 旧単一ファイルはアーカイブ済)
- **現在言語**: 日本語(主) + 英語(翻訳)
- **保存**: `data/translations/<lang>/<id>.json`、ISO 639-1 言語コード単位
  - 例: `data/translations/en/0001.json`
- **将来拡張**: 新言語追加 = ディレクトリ追加(`data/translations/ko/`、`data/translations/zh/`)、主ソースは一切変更しない。
- **翻訳範囲**:
  - 主 JSON の `title.ja`、`description.*`、`tasks[].description_ja`、`aliases_ja`
  - 標準ラベル(skills/knowledge 名称)は **ここではない** —— §2.5 参照
- **データ来歴**: 各 `<lang>/<id>.json` ファイルには `translator`(model)、`translated_at`、`source_data_version`(翻訳対象の IPD バージョンを指す)の 3 つのメタデータフィールドが必要

### 2.5 ラベル辞書(labels)

- **Status**: **Implemented**(v1.0.7 以降; 7 ファイル / 204 labels が `scripts/build_labels.py` で生成; EN 名は draft v0.1、O*NET クロス検証待ち)
- **目的**: 共通ラベル(例: 「読解力」→「Reading Comprehension」)は全 556 職業共通、各ファイルに 556 回保存するな。
- **保存**: `data/labels/<dimension>.ja-en.json`
- **ソース**: JA 名は IPD 細目から直接; EN 名は O*NET 対応の最適訳(v1.0.6 で `scripts/build_labels.py` 生成、draft マーク付きで O*NET クロス検証待ち)
- **ファイル一覧**(合計 204 labels、v1.0.6 修正: 元 §2.5 の skills 78 / knowledge 66 は `_無関係フラグ` 子節を含んでいた):
  - `skills.ja-en.json`(39 項)
  - `knowledge.ja-en.json`(33 項)
  - `abilities.ja-en.json`(35 項)
  - `work_characteristics.ja-en.json`(39 項)
  - `work_activities.ja-en.json`(41 項)
  - `interests.ja-en.json`(6 項 Holland Code)
  - `work_values.ja-en.json`(11 項)
- **データ来歴**: 各 `<dimension>.ja-en.json` トップに `source` / `license` / `count` 3 つのメタデータフィールド必須(schema は `data/schema/labels.py` 参照)

---

## 3. ID カバレッジマトリクス

> このセクションは答える: **どの職業 ID がどのデータソースに含まれるか? フロントエンドはどう耐障害化するか?**

### 3.1 集合関係

```
                        全集 = 580(occupations_full.json 歴史最大集)
                        ├── ok=False、全空: 28 件 → 収録しない
                        └── ok=True: 552 件 → 収録

IPD v7.00 解説系: 556 件
  └─ うち 552 件は ok=True と重なる
  └─ 4 件新規(id 581-584)

IPD v7.00 数値系: 518 件
  └─ 全部 解説系の部分集合(518 ⊂ 556)
  └─ 38 件は解説あるが数値プロファイル欠落(サンプル不足)
```

### 3.2 最終収録範囲

**556 職業収録** = 552(既存) + 4(IPD 新規)。詳細:

| ID 区分 | 件数 | 主ソースデータ | stats_legacy | 数値プロファイル(skills/knowledge/...) |
|---|---|---|---|---|
| 既存 + IPD 完備(コア) | 518 | ✅ IPD 解説 | ✅ あり | ✅ IPD 数値 |
| 既存 + IPD 解説のみ | 34 | ✅ IPD 解説 | ✅ あり | ❌ 数値フィールド全 null |
| IPD 新規(581-584) | 4 | ✅ IPD 解説 | ❌ なし | ❌ 数値フィールド全 null(サンプル不足) |
| **合計** | **556** | | | |

> 派生統計: 556 のうち 518 件が IPD 数値プロファイルを持ち、38 件は数値プロファイルなし(= 34 既存 + 4 新規)。投影コードは 518 を「全プロファイルサンプル」基数とする。

**フロントエンド耐障害ルール**:
- 数値フィールド null → 技能レーダーチャートを表示しない、Holland Code 測定結果を表示しない、その他は正常
- stats_legacy null → 「統計データは現在準備中です」を表示、「0 万円」ではない

### 3.3 4 つの IPD 新規職業

```
581  ブロックチェーン・エンジニア   AI リスクトピック / IT 高収入
582  声優                       AI 音声衝撃の代表的職業
583  産業医                      医療/法務境界
584  3D プリンター技術者          製造業 AI タグ
```

これら 4 職業は **優先度高**、トピック性が強く SEO 価値も大きい。

---

## 3A. ID and Path Rules(新規)

> v1.0.3 導入。すべての ID / パス / ファイル名フォーマットを集中規定、複数の書き方が散在しないように。

### 3A.1 ID タイプ

| ID タイプ | 表現形式 | 範囲 | 出現箇所 | 例 |
|---|---|---|---|---|
| **Canonical ID** | 整数 | 1 – 584(IPD 収録番号含む) | JSON フィールド `"id": <int>`、SQL 主キー、すべてのメモリデータ構造 | `1`, `42`, `581` |
| **Source ファイル名 ID** | 4 桁ゼロ詰め文字列 | `0001` – `0584` | `data/occupations/<padded>.json`、`data/translations/<lang>/<padded>.json`、`data/stats_legacy/<padded>.json` | `0001.json`, `0042.json`, `0581.json` |
| **Projection ファイル名 ID** | 4 桁ゼロ詰め文字列 | 同上 | `dist/data.detail/<padded>.json`、`dist/data.tasks/<padded>.json`、`dist/data.score-history/<padded>.json` | `0001.json` |
| **URL ID** | 裸整数 | 1 – 584 | `https://mirai-shigoto.com/{ja,en}/<id>`、jobtag `https://shigoto.mhlw.go.jp/User/Occupation/Detail/<id>` | `/ja/1`, `/en/581` |
| **Display ID** | 裸整数 | 1 – 584 | UI 上ユーザーに表示、breadcrumb、SEO meta | `1`, `42` |

### 3A.2 変換ルール

```
canonical_id (int)  ←→  filename_id (str)  ←→  url_id (str)
       42                    "0042"                 "42"

filename_id = f"{canonical_id:04d}"
url_id      = str(canonical_id)
```

**変換に lossy を許さない**: importer と build スクリプトは `int()` / `f"{:04d}"` で明示変換、文字列連結式の hack 禁止。

### 3A.3 パステンプレート

| 用途 | テンプレート | 例 |
|---|---|---|
| ソース occupation ファイル | `data/occupations/{padded}.json` | `data/occupations/0042.json` |
| ソース stats_legacy ファイル | `data/stats_legacy/{padded}.json` | `data/stats_legacy/0042.json` |
| ソース translation ファイル | `data/translations/{lang}/{padded}.json` | `data/translations/en/0042.json` |
| ソース score ファイル | `data/scores/{scope}_{model-slug}_{run-date}.json` | `data/scores/occupations_claude-opus-4-7_2026-04-25.json` |
| 投影 detail ファイル | `dist/data.detail/{padded}.json` | `dist/data.detail/0042.json` |
| 投影 tasks ファイル | `dist/data.tasks/{padded}.json` | `dist/data.tasks/0042.json` |
| 投影 score-history ファイル | `dist/data.score-history/{padded}.json` | `dist/data.score-history/0042.json` |
| 投影 skill ファイル | `dist/data.skills/{skill_key}.json` | `dist/data.skills/reading.json` |
| 公開 URL(ja) | `https://mirai-shigoto.com/ja/{url_id}` | `https://mirai-shigoto.com/ja/42` |
| 公開 URL(en) | `https://mirai-shigoto.com/en/{url_id}` | `https://mirai-shigoto.com/en/42` |

### 3A.4 一貫性テスト

`scripts/test_data_consistency.py` は以下のアサーションを含む必要がある:

- 各 `data/occupations/{padded}.json` の JSON 内 `"id"` フィールドが `int(padded)` と等しい
- `data/stats_legacy/`、`data/translations/<lang>/` 配下の全ファイルが同ルールに従う
- ファイル名のゼロ詰め桁数が厳密に 4
- canonical_id ∈ [1, 999](4 桁ゼロ詰めの安全範囲; 現在 584 まで使用)

---

## 4. ファイルレイアウト

### 4.1 ソースデータ `data/`

```
data/
├── occupations/                        # IPD 主データ、1 職業 1 ファイル
│   ├── 0001.json
│   ├── 0002.json
│   └── ... (556 ファイル)
│
├── translations/
│   └── en/
│       ├── 0001.json
│       ├── 0002.json
│       └── ... (556 ファイル)
│
├── labels/                             # ラベル辞書(グローバル共有)
│   ├── skills.ja-en.json
│   ├── knowledge.ja-en.json
│   ├── abilities.ja-en.json
│   ├── work_characteristics.ja-en.json
│   ├── work_activities.ja-en.json
│   ├── interests.ja-en.json
│   └── work_values.ja-en.json
│
├── scores/                             # AI 評価履歴(削除しない)
│   ├── occupations_claude-opus-4-7_2026-04-25.json
│   ├── occupations_<model>_<date>.json
│   └── tasks_<model>_<date>.json       # タスクレベル(将来)
│
├── stats_legacy/                       # 給与パッチ層
│   ├── 0001.json
│   ├── 0002.json
│   └── ... (552 ファイル、4 新規職業は未対応)
│
```

**すべて git に入れる**(schema は `src/data/schema/*.ts` に移動済、§4.4 参照)。

### 4.1.5 Schema location(v1.5.0 以降)

```
src/data/schema/                        # Zod schemas(TypeScript)
├── index.ts                            # re-exports
├── occupation.ts                       # IPD occupation 主構造 + null rules per §5.4
├── translation.ts
├── score-run.ts
├── stats-legacy.ts
├── sector.ts                           # v1.1.0 追加
└── labels.ts
```

**v1.5.0 以前との差異**: `data/schema/*.py`(Pydantic)から `src/data/schema/*.ts`(Zod)へ移行。詳細は附録 B。

### 4.2 構築成果物 `dist/`

```
dist/
├── data.treemap.json                   # PC トップページ treemap
│
├── data.detail/                        # 詳細ページ / OG / モバイル drill-down
│   ├── 0001.json
│   └── ... (556 ファイル)
│
├── data.tasks/                         # タスクレベルデータ(AI 評価含む)
│   ├── 0001.json
│   └── ... (556 ファイル)
│
├── data.search.json                    # グローバル検索インデックス(別名含む)
│
├── data.skills/                        # 技能で職業検索
│   ├── _index.json
│   ├── reading.json
│   └── ... (78 ファイル)
│
├── data.holland.json                   # Holland Code 測定マッチング
├── data.featured.json                  # モバイル第一画面推薦
│
├── data.score-history/                 # AI 評価時系列
│   ├── 0001.json
│   └── ... (556 ファイル)
│
└── data.labels/
    ├── ja.json
    └── en.json
```

**git に入れる**(現在 Vercel が build server を走らせず、push 時に構築済が必要なため)。

### 4.3 一回限り / 一時

```
~/Downloads/IPD_DL_*.xlsx               # IPD オリジナルダウンロード、git に入れない
build/                                  # 構築中間成果物、.gitignore
```

---

## 5. Schema 体系(v1.0.3 分割)

ソースデータと投影データの schema は **物理的に異なる** —— 前者は IPD + 翻訳の事実、後者は build 時 join のビュー。混ぜると「パッチ層独立」原則が失効する。

本セクションは **3 つの schema** に分けて定義する:

- §5.1 `SourceOccupationSchema`: `data/occupations/<padded>.json`、**stats_legacy を含まない**
- §5.2 `StatsLegacySchema`: `data/stats_legacy/<padded>.json`、独立ファイル
- §5.3 `DetailProjectionSchema`: `dist/data.detail/<padded>.json`、build 時 join 後のビュー

### 5.1 `SourceOccupationSchema` — `data/occupations/<padded>.json`

**含まない**: `stats_legacy`(独立、§5.2 参照)、英語翻訳(独立、§2.4 translations 層参照)

```json
{
  "id": 1,
  "ipd_id": "IPD_01_01_001",
  "schema_version": "7.00",
  "ingested_at": "2026-05-03",

  "title_ja": "豆腐製造、豆腐職人",
  "aliases_ja": ["豆腐職人", "豆腐製造業者"],

  "classifications": {
    "mhlw_main": "12_072-06",
    "mhlw_all": ["12_072-06"],
    "jsoc_main": "H533",
    "jsoc_all": ["H533"]
  },

  "description": {
    "summary_ja": "...",
    "what_it_is_ja": "...",
    "how_to_become_ja": "...",
    "working_conditions_ja": "..."
  },

  "interests":            { "realistic": 2.743, "investigative": 2.771, "artistic": 2.629, "social": 2.657, "enterprising": 2.657, "conventional": 2.686 },
  "work_values":          { "achievement": 3.1, "autonomy": 2.8, "...": "11 dims total" },
  "skills":               { "reading": 2.371, "active_listening": 2.829, "writing": 2.943, "...": "78 dims total" },
  "knowledge":            { "...": "66 dims" },
  "abilities":            { "...": "35 dims" },
  "work_characteristics": { "...": "39 dims" },
  "work_activities":      { "...": "41 dims" },

  "education_distribution": { "below_high_school": 2.1, "high_school": 45.2, "...": "9 categories" },
  "training_pre":           { "...": "10 categories" },
  "training_post":          { "...": "10 categories" },
  "experience":             { "...": "10 categories" },
  "employment_type":        { "...": "10 categories" },

  "tasks_lead_ja": "この職業では以下のような業務を行います",
  "tasks": [
    { "task_id": 1, "description_ja": "原料の大豆を選別し、洗浄する", "execution_rate": 0.92, "importance": 4.1 }
  ],

  "related_orgs": [
    { "name_ja": "全国豆腐連合会", "url": "https://..." }
  ],
  "related_certs_ja": ["豆腐マイスター"],

  "url": "https://shigoto.mhlw.go.jp/User/Occupation/Detail/1",

  "data_source_versions": {
    "ipd_numeric": "v7.00",
    "ipd_description": "v7.00",
    "ipd_retrieved_at": "2026-05-03"
  },
  "last_updated_per_section": {
    "interests": 2024,
    "skills": 2024,
    "tasks": 2023
  }
}
```

### 5.2 `StatsLegacySchema` — `data/stats_legacy/<padded>.json`

独立ファイル、1 職業 1 ファイル。**SourceOccupationSchema への合併禁止**。

```json
{
  "id": 1,
  "schema_version": "1.0",
  "source": "jobtag_scrape_2026-04-25",
  "salary_man_yen": 366.2,
  "workers": 1227480,
  "monthly_hours": 165,
  "average_age": 43.5,
  "recruit_wage_man_yen": 21,
  "recruit_ratio": 4.44
}
```

- 4 つの IPD 新規職業(id 581-584): **ファイル不在**、build 時に欠落として扱う(ファイル存在で内容 null ではない)
- 部分フィールド欠落(535/552 が 6 フィールド完備、残りは一部): 欠落フィールドは `null`、ファイル自体は存在

### 5.3 `DetailProjectionSchema` — `dist/data.detail/<padded>.json`

`build_data.py` が投影段階で生成。SourceOccupation + StatsLegacy + 翻訳 + 最新スコアの統合ビュー。完全 schema は §6.2 参照。

**重要境界の注意**: DetailProjection 内部の `stats_legacy` サブオブジェクトは **join 出力のビュー** —— §5.2 ファイル内容の埋込であり、source データのフィールドではない。

### 5.4 Null ルール

- **数値プロファイル 12 サブ領域** —— `interests` / `work_values` / `skills` / `knowledge` / `abilities` / `work_characteristics` / `work_activities` / `education_distribution` / `training_pre` / `training_post` / `experience` / `employment_type`: その職業の IPD 数値プロファイルデータがない場合(38 件)、**領域全体が `null`**(dict 内のすべての値が null ではない)。投影層がこれに基づいてレーダーチャートを描くかどうか判断する。
- `tasks` は空配列 `[]` で null ではない、既知タスクなしを意味する(IPD タスク内容の妥当性懸念フラグ=1)
- `tasks_lead_ja`: `null` 可(IPD タスク_リード文 フィールド欠落時)
- 単一フィールド欠落は `null` を使う(key を省略しない) —— schema 一貫性優先
- `data/stats_legacy/<padded>.json` ファイル全体が存在しない: 投影層が検出後、DetailProjection の `stats_legacy` フィールドを `null` で埋める(空オブジェクトではない)

### 5.5 Classification Fields — 使用ルール(v1.0.3 新規)

`classifications.mhlw_main` / `mhlw_all` / `jsoc_main` / `jsoc_all` の 4 フィールドは schema に入っているが、**その語義と分類マッピング表は現時点で未確認**。確認前は以下の規則を厳守:

| フィールド | 例値 | 現在可能 | 現在禁止 | 解除条件 |
|---|---|---|---|---|
| `mhlw_main` | `"12_072-06"` | raw 保存; 完全文字列等価で dedupe / group key | UI 表示; SEO ページ生成; breadcrumb; フィルタ | 厚労省編職業分類表(v4 または最新)を解析し `<大分類>_<中分類>-<小分類>` 形式に従って実装時に対応 |
| `mhlw_all` | `["12_072-06"]` | 同上 | 同上 | 同上 |
| `jsoc_main` | `"H533"` | raw 保存; 頭文字でグループ化 | UI 表示は JSOC 大分類マッピング表との連携要 | `data/labels/jsoc_categories.ja-en.json`(12 項 A-L)を追加後解放 |
| `jsoc_all` | `["H533"]` | 同上 | 同上 | 同上 |

**現在の安全策**:
- import 時は **IPD 細目原文のまま書込** —— 解析せず、正規化せず
- 投影層は **デフォルトでこの 4 フィールドをユーザー向け投影に出力しない**(detail に出さず、search に出さず、treemap に出さず)
- ある投影で分類を使う必要が出たら、**先に本セクションでマッピング表 + 解除ルールを追加する**

### 5.6 Schema 維持戦略(v1.5.0 以降: Zod 手書き)

`src/data/schema/occupation.ts` 等は **手書きの Zod schema**(TypeScript)。

```ts
// src/data/schema/occupation.ts(抜粋)
import { z } from 'zod';

export const OccupationSchema = z.object({
  id: z.number().int().positive(),
  schema_version: z.literal('7.00'),
  title_ja: z.string().min(1),
  classifications: z.object({
    mhlw_main: z.string().regex(/^\d{2}_\d{3}-\d{2}$/),
    mhlw_all: z.array(z.string()),
    jsoc_main: z.string().optional(),
    jsoc_all: z.array(z.string()),
  }),
  // 12 数値プロファイル: 各々が完全 dict or null
  interests: z.object({ /* 6 dims */ }).nullable(),
  // ... 他 11 dims
  // tasks は空配列でも有効、tasks_lead_ja は null 可
  tasks: z.array(/* ... */).default([]),
  tasks_lead_ja: z.string().nullable(),
  // ... 他のフィールド
});

export type Occupation = z.infer<typeof OccupationSchema>;
```

**メリット**:
- TypeScript の型と Zod の runtime 検証が同一ソース(`z.infer`)— 二重保守不要
- Astro / Edge Function / build スクリプトすべてが同じ schema を import 可能
- IPD 7.01 アップグレード時は手動で schema 差分を反映(現在 ~574 フィールドのうち、人手で見れる変更点しか実際は来ない)

**v1.5.0 以前との差異**: `scripts/generate_schema.py` が Pydantic schema を IPD 細目 sheet から自動生成していた。Zod に移行後はこの自動生成スクリプトは廃止、手書き保守。理由は附録 B 参照。

---

## 6. 投影契約(9 ファミリー / 10 ファイルタイプ)

> 投影 = build_data.py 出力の `dist/data.*` ファイル。**このセクションは前後端契約**。投影 shape の変更はすべてまず本セクションを修正する必要がある。

### 6.0 投影総合表

`dist/` トップレベル計 **10 ファミリー**(v1.1.0 以降; ファミリー = トップレベルパス 1 つ)。うち `data.skills/` ファミリーは 2 種類のファイル(`_index.json` + per-skill)、`data.sectors`-サブシステムは sectors + review_queue 2 つの並列ファイル、その他は各 1 種類、**計 12 ファイルタイプ**。

| ファミリー | サブセクション | Status | 消費者 | ファイル数 | gzip 目標 | 実測 |
|---|---|---|---|---|---|---|
| `data.sectors.json` + `data.review_queue.json` | §6.11 | **Implemented** ✅ (v1.1.0) | mobile ② マップ / ③ 検索 chip / ④⑤ sector ラベル / 関連職業候補; review_queue は ops のみ | 2 | < 5 KB / < 50 KB | sectors **2.8 KB**, queue **0.3 KB** |
| `data.treemap.json` | §6.1 | **Implemented** ✅ (v1.0.8) + sector + 多軸 bands 追加 (v1.1.0) | `index.html`(PC トップ) + mobile ② マップ ⑦ ランキング | 1 | < 120 KB | **70.0 KB** |
| `data.detail/` | §6.2 | **Implemented** ✅ + sector{} ブロック + 3 bands 追加 (v1.1.0) | `build_occupations.py`、`api/og.tsx`、mobile ④⑤ drill-down | 556 | < 5 KB / 件 | avg 3.5 KB |
| `data.tasks/` | §6.3 | **Future-coded** — 関数は書いてあるがデフォルト build でスキップ; タスクレベル AI 評価実施後に有効化 | 将来「タスクレベルリスクマップ」ページ | 556 | < 3 KB / 件 | avg ~1.5 KB |
| `data.search.json` | §6.4 | **Implemented** ✅ + sector_id + risk_band + workforce_band 追加 (v1.1.0) | 検索(モバイル + PC) | 1 | < 200 KB | **29.0 KB** |
| `data.skills/` | §6.5 + §6.6 | **Future-coded** — 「技能で職業検索」UX が出るまで有効化しない | 将来「技能で職業検索」ページ | 40(39 + _index) | < 15 KB / 件 | per-skill 8.5 KB |
| `data.holland.json` | §6.7 | **Future-coded** — Holland 測定 UX が出るまで有効化しない | 将来 Holland Code 測定ページ | 1 | < 50 KB | **13.2 KB** |
| `data.featured.json` | §6.8 | **Future-coded** — モバイル UX 確定後に有効化 | モバイル第一画面 | 1 | < 10 KB | **2.5 KB** |
| `data.score-history/` | §6.9 | **Future-coded** — ≥ 2 モデル走った後に初めて内容が出る | 将来「評価進化」ページ | 552 | < 3 KB / 件 | avg ~150 B |
| `data.labels/` | §6.10 | **Implemented** ✅ | すべてのフロントエンドコードのラベルレンダリング | 2(ja + en) | < 30 KB / 件 | ja 5.0 KB, en 3.5 KB |

> **施工境界**(v1.1.0 で実装済): 5 つの Planned ファミリーがデフォルト build 出力(`sectors` は v1.1.0 で追加された 5 つ目、treemap/detail/search が参照するため最初に走る)。5 つの Future ファミリーの関数コードは書いてあり、`tsx src/data/build.ts --enable-future` で明示的に有効化。対応 UX オンライン時にデフォルト build リストに切替える。

### 6.1 `data.treemap.json`

- **消費者**: `index.html`(PC + モバイル treemap canvas + per-tile tooltip)
- **サイズ目標**: < 100 KB gzipped
- **形状**: **top-level array of objects**(v1.0.8 で修訂; v1.0.3-v1.0.7 では cols/rows columnar 形式だったが、実証で index.html が各 tile tooltip の ~15 フィールドを必要としており columnar 形式では不足。array-of-objects により treemap.json を legacy `data.json` の近似 drop-in にし、フロントエンドは fetch URL を変えるだけで済む)。
- **フィルタルール**: **同時に** `stats_legacy` AND `latest_score` がある職業のみ出力(典型 552 件)。4 つの新 IPD 職業(581-584)は両方とも無いので除外(`data.search.json` + `data.detail/` には残る)。
- **legacy compat**: `education_pct` と `employment_type` は投影時に EN snake_case key + 0-1 fraction から **逆変換** で日本語 key + 0-100 percentage に戻す、legacy `data.json` 形状に合わせる(index.html 内部の `EDU_LABELS` 等が日本語 key で参照)。「わからない」バケツは education_pct で **意図的に破棄**(legacy 挙動に合致)。
- **各レコードフィールド**(計 16 個):

```json
[
  {
    "id": 1,
    "name_ja": "豆腐製造、豆腐職人",
    "name_en": "Tofu Maker / Tofu Craftsman",
    "salary": 366.2,
    "workers": 94422,
    "hours": 165,
    "age": 43.5,
    "recruit_wage": 21.0,
    "recruit_ratio": 4.44,
    "hourly_wage": null,
    "ai_risk": 2,
    "ai_rationale_ja": "伝統的な手作業の食品製造",
    "ai_rationale_en": "Hand-crafted tofu making; manual food trade",
    "education_pct": {"高卒": 51.9, "大卒": 22.2, "...": "..."},
    "employment_type": {"正規の職員、従業員": 48.1, "パートタイマー": 48.1, "...": "..."},
    "url": "https://shigoto.mhlw.go.jp/User/Occupation/Detail/1"
  }
]
```

> Sidecar metadata file `dist/data.treemap.meta.json` carries `schema_version`, `generated_at`, `record_count`, `filter` description.

- **取得戦略**:
  - `name_en` は `translations/en/<padded>.json` の `title_en` から
  - `salary` / `workers` / `hours` / `age` / `recruit_wage` / `recruit_ratio` は `stats_legacy/<padded>.json` から
  - `hourly_wage`: legacy data.json にあった(別クロール由来)、IPD は持たない、**v1.0.8 以降一律 null**
  - `ai_risk` / `ai_rationale_*`: 最新スコアから(`run_date` で最新を取る)
  - `education_pct` / `employment_type`: IPD `education_distribution` / `employment_type` から、日本語 key + percentage に逆変換
  - `url`: IPD source occupation から

### 6.2 `data.detail/<id>.json`

- **消費者**: `build_occupations.py`(ja/en HTML 生成)、`api/og.tsx`(OG 図)、将来のモバイル drill-down fetch
- **サイズ目標**: < 5 KB gzipped per file
- **形状**: ネストオブジェクト、主 occupation JSON + EN 翻訳合併

```json
{
  "id": 1,
  "title": {
    "ja": "豆腐製造、豆腐職人",
    "en": "Tofu Maker / Tofu Craftsman",
    "aliases_ja": [...],
    "aliases_en": [...]
  },
  "description": {
    "summary_ja": "...",
    "summary_en": "...",
    "...": "..."
  },
  "ai_risk": {
    "score": 2,
    "model": "claude-opus-4-7",
    "scored_at": "2026-04-25",
    "rationale_ja": "...",
    "rationale_en": "..."
  },
  "stats": { ... },
  "skills_top10": [
    {"key": "active_listening", "label_ja": "傾聴力", "label_en": "Active Listening", "score": 2.829}
  ],
  "knowledge_top5": [...],
  "abilities_top5": [...],
  "tasks_count": 12,
  "...": "完全フィールド、ただし top-N 次元のみ厳選し detail を肥大化させない"
}
```

- **`*_top_N` フィールドソートルール**: 一律「その職業のスコア降順」で上位 N を取る。数値プロファイル全体が null の場合(38 件)、これらフィールドも null(空配列ではない)。
- **N の選択**: skills は 10(情報密度最高)、knowledge / abilities は 5(詳細ページのフィールド積み重ねを回避)。N の変更は本セクションで同期。

### 6.3 `data.tasks/<id>.json`

- **消費者**: 将来「タスクレベル AI リスクマップ」ページ
- **サイズ目標**: < 3 KB gzipped per file
- **形状**:

```json
{
  "id": 1,
  "title_ja": "豆腐製造、豆腐職人",
  "tasks": [
    {
      "task_id": 1,
      "description_ja": "原料の大豆を選別し、洗浄する",
      "description_en": "Select and wash raw soybeans",
      "execution_rate": 0.92,
      "importance": 4.1,
      "ai_risk": 1,
      "ai_rationale_ja": "...",
      "scored_by": "claude-opus-4-7",
      "scored_at": "2026-06-15"
    }
  ]
}
```

- **AI タスク評価未実行時**: `ai_risk` フィールドは null、その他は通常出力

### 6.4 `data.search.json`

- **消費者**: 検索ページ(モバイル + PC)、FlexSearch / MiniSearch 等のライブラリで消費可能
- **サイズ目標**: < 200 KB gzipped
- **形状**: 検索フレンドリーなフラットインデックス

```json
{
  "schema_version": "1.0",
  "documents": [
    {
      "id": 1,
      "title_ja": "豆腐製造、豆腐職人",
      "title_en": "Tofu Maker / Tofu Craftsman",
      "aliases_ja": ["豆腐職人", "豆腐製造業者"],
      "aliases_en": ["Tofu artisan"],
      "category_size": "large",
      "ai_risk": 2
    }
  ]
}
```

- **`category_size`**: §6.1 treemap の `category_size` と同フィールド —— `stats_legacy.workers` 数値でバケツ分け(small / medium / large)。**将来職業分類で絞り込み**(厚労省編職業分類 / JSOC)する場合、まず本セクションで `category_class` フィールドを追加しマッピング表を定義、IPD 大分類対応表は `import_ipd.py` 実装時に確認。
- **記述全文を含まない**(インデックス肥大化回避)。詳細は `data.detail/<id>.json` で 2 次 fetch。

### 6.5 `data.skills/<skill_key>.json`

- **消費者**: 将来「技能で職業検索」ページ
- **数量**: 78 ファイル(各技能 1 ファイル)
- **サイズ目標**: < 15 KB per file
- **形状**: その技能スコア降順で並ぶ職業リスト

```json
{
  "skill_key": "reading",
  "label_ja": "読解力",
  "label_en": "Reading Comprehension",
  "occupations": [
    {"id": 153, "name_ja": "弁護士", "score": 4.8},
    {"id": 280, "name_ja": "大学教員", "score": 4.7}
  ]
}
```

### 6.6 `data.skills/_index.json`

- **消費者**: 技能リストナビゲーションページ
- **形状**:

```json
{
  "skills": [
    {"key": "reading", "label_ja": "読解力", "label_en": "Reading Comprehension"},
    ...
  ]
}
```

### 6.7 `data.holland.json`

- **消費者**: 将来 Holland Code 興味測定マッチングページ
- **サイズ目標**: < 50 KB gzipped
- **形状**: 列式 6 次元ベクトル

```json
{
  "schema_version": "1.0",
  "cols": ["id", "name_ja", "R", "I", "A", "S", "E", "C"],
  "rows": [
    [1, "豆腐製造、豆腐職人", 2.743, 2.771, 2.629, 2.657, 2.657, 2.686]
  ]
}
```

### 6.8 `data.featured.json`

- **消費者**: モバイル第一画面(「本日のおすすめ」or「AI 高リスク職業」)
- **サイズ目標**: < 10 KB gzipped
- **形状**: 厳選 10-20 件の完全 detail(2 次 fetch 回避)

```json
{
  "generated_at": "2026-05-03T10:00:00Z",
  "strategy": "top_ai_risk",
  "occupations": [
    { /* 完全な detail 構造 */ }
  ]
}
```

- **選出戦略**: `scripts/lib/featured_strategy.py` に書く、進化可能(今日はリスク順、明日は人気順、等)

### 6.9 `data.score-history/<id>.json`

- **消費者**: 将来「評価進化」ページ(「この職業の AI リスクはモデルアップグレードでどう変化するか」)
- **サイズ目標**: < 3 KB per file
- **形状**:

```json
{
  "id": 1,
  "history": [
    {"date": "2026-04-25", "model": "claude-opus-4-7", "score": 2, "rationale_ja": "..."},
    {"date": "2026-12-01", "model": "claude-opus-4-8", "score": 3, "rationale_ja": "..."}
  ]
}
```

### 6.10 `data.labels/ja.json` / `data.labels/en.json`

- **消費者**: すべてのフロントエンドコード(skill / knowledge / ability / 仕事活動 等のラベルレンダリング)
- **サイズ目標**: < 30 KB each
- **形状**: フラット key → label マッピング

```json
{
  "skills": {
    "reading": "読解力",
    "active_listening": "傾聴力"
  },
  "knowledge": { "...": "..." },
  "...": "..."
}
```

---

### 6.11 `data.sectors.json` + `data.review_queue.json` + 多軸 bands(v1.1.0 新規)

> **Status**: **Implemented**(v1.1.0)。モバイル版 ② 職業マップ の業種グループ、③ 検索 sector chip、④/⑤ 詳細 業種ラベル、関連職業候補プール、将来 ⑨ 診断 マッチングプールがすべてこの投影セットを使う。

#### 6.11.1 設計動機

mhlw_main / jsoc_main は政府分類コードで開発者には透過だが **消費者には完全に不可読**(`12_072-06` は誰も理解できない)。設計稿は 16 個の消費者フレンドリーな「業種 sector」グループを要求するが、この層はソースデータに **存在しない** —— 新規追加が必要。

3 つの歴史的選択肢は却下:
1. **552 件手動アノテーション**: 進化性が悪く、職業追加のたびに再ラベル必要。
2. **MHLW 15 主類を直接使う**: 視覚が極端に不均衡(03 類は 88 件、01 類はわずか 8 件)、かつ名称が消費不可。
3. **MHLW → 16 翻訳表(override 機構なし)**: 境界ケースの行き場がない。

最終方案(D-014): **二層マッピング + 自動派生 + override ファイル + review_queue フィードバックループ**。詳細は決定記録を参照。

#### 6.11.2 データフロー

```
data/sectors/sectors.ja-en.json  (16 sector 定義 + mhlw_seed_codes)
data/sectors/overrides.json      (per-occupation 手動上書き)
                ↓
scripts/lib/sector_resolver.py   (resolve_sector — 純粋関数)
                ↓
scripts/lib/indexes.py            (build 時に各 occ の SectorAssignment を派生)
                ↓
scripts/projections/sectors.py    → dist/data.sectors.json
                                  → dist/data.review_queue.json
scripts/projections/treemap.py    → 各 tile に sector_id / sector_ja / hue / 3 band 追加
scripts/projections/search.py     → 各 document に sector_id / risk_band / workforce_band 追加
scripts/projections/detail.py     → 各レコードに sector{} ブロック + 3 band 追加
```

#### 6.11.3 Resolution ルール

詳細は `data/schema/sector.py` docstring + `scripts/lib/sector_resolver.py`:

1. `overrides[<padded_id>]` ヒット → これを使う、`provenance="override"`。
2. `occ.classifications.mhlw_main` が ある sector の `mhlw_seed_codes` glob にマッチ:
   - 唯一マッチ → `provenance="auto"`。
   - 0 マッチ → `_uncategorized` + `provenance="unmatched"` + review_queue へ。
   - 複数マッチ → 最初のマッチが勝つ + `provenance="auto-ambiguous"` + 候補リストが review_queue へ。
3. occ に mhlw_main が完全に無い → `_uncategorized` + `provenance="no-mhlw"`。

Seed glob 文法(`fnmatch`): `"12_*"`、`"12_072*"`、`"12_072-06"`。

#### 6.11.4 投影出力

**`data.sectors.json`** — 16 sector 定義 + 集約統計(occupation_count / mean_ai_risk / total_workforce / sample_titles_ja)。フロントエンドが sector chip ラベル + treemap グループ化 + 詳細ページの「同業種隣接職業」リストに使う。

**`data.review_queue.json`** — 内部 ops ファイル、summary(uncategorized / ambiguous / override_count) + 各問題の `hint`(最も近い sector)。**Vercel rewrite には乗せない** —— git track のみ、オペレーターのレビュー用。

**多軸 bands**(`scripts/lib/bands.py`)—— 3 つの独立 axis、各レコードに付与:

| フィールド | ソース | 値 | 閾値 |
|---|---|---|---|
| `risk_band` | ai_risk | `low`/`mid`/`high` | 3.9 / 6.9 |
| `workforce_band` | workers | `small`/`mid`/`large` | 2万/10万 |
| `demand_band` | recruit_ratio | `cold`/`normal`/`hot` | 1.0 / 2.0 |

閾値は `lib/bands.py` の定数、**投影コード内で調整しない** —— treemap / search / detail の 3 投影の band 出力が永遠に一致することを保証。

#### 6.11.5 オペレーションワークフロー

```
1. dist/data.review_queue.json の summary を見る
   - uncategorized > 0 → 該 mhlw コードが全 sector の seed_codes から漏れている
   - ambiguous > 0     → 該 mhlw コードが複数 sector seed に同時ヒット

2. 判断:
   a) カバー漏れ → data/sectors/sectors.ja-en.json の ある sector に seed 1 件追加
   b) 境界ケース → data/sectors/overrides.json に {"<padded>": "<sector_id>"} 追加
   c) sector の再定義 → data/sectors/sectors.ja-en.json の sector リストを変更

3. npm run build:data  (= tsx src/data/build.ts)
4. review_queue を再確認、uncategorized + ambiguous = 0 になるまで
```

CI が review_queue 非ゼロを警告(ブロックしない)、ただし D-014 は「sector ファイル変更後、review_queue は必ずゼロにしてから commit」を要求。

#### 6.11.6 サイズ予算

| ファイル | raw | gz |
|---|---|---|
| `data.sectors.json` | ~7 KB | ~3 KB |
| `data.review_queue.json` | < 1 KB(理想は空)| < 0.3 KB |
| `data.treemap.json` 増分 | +5 KB(v1.0.8 → v1.1.0)| +5 KB |
| `data.search.json` 増分 | +3 KB | +2 KB |
| `data.detail/<id>.json` 増分 | +60 bytes | +0.1 KB |

総増分: モバイル第一画面 + 1 回詳細ページロード < 8 KB gz。

---

## 7. Build Pipeline

> **セクション全体 Status**: **Implemented**(v1.5.0 以降 TypeScript ETL に完全移行)。本セクションは現在の TypeScript 実装を記述する。Python 時代(v1.0.7 - v1.4.x)の同パイプラインの構造と動機は附録 B 参照。
>
> **入口コマンド**: `npm run build:data` (= `tsx src/data/build.ts`)

### 7.1 全体フロー

```
┌─────────────────────────────────────┐
│  data/  (ソース)                     │
│   ├ occupations/                     │
│   ├ translations/en/                 │
│   ├ scores/                          │
│   ├ stats_legacy/                    │
│   ├ sectors/                         │
│   └ labels/                          │
└──────────────┬──────────────────────┘
               │
               ▼
   ┌─────────────────────────────┐
   │  src/data/build.ts          │
   │  (= npm run build:data)     │
   │                             │
   │  1. ロード + Zod 検証        │
   │  2. メモリインデックス構築    │
   │  3. 12 投影関数呼出          │
   │  4. public/ 書込             │
   └──────────────┬──────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  public/  (投影、フロントエンドが読む)│
│  (= Astro publicDir、build で       │
│   そのまま dist-astro/ に複製)       │
│                                      │
│   ├ data.treemap.json                │
│   ├ data.detail/<id>.json × 556      │
│   ├ data.tasks/<id>.json × 556       │
│   ├ data.search.json                 │
│   ├ data.skills/<skill>.json × 31    │
│   ├ data.holland.json                │
│   ├ data.featured.json               │
│   ├ data.score-history/<id>.json     │
│   ├ data.sectors.json (+review_queue)│
│   ├ data.profile5.json               │
│   ├ data.transfer_paths.json         │
│   └ data.labels/{ja,en}.json         │
└─────────────────────────────────────┘
```

> **v1.5.0 以前との差異**: パイプラインは `scripts/build_data.py`(Python、`uv run`)→ `src/data/build.ts`(TypeScript、`tsx`)に置換。出力先は `dist/` → `public/` に変更(Astro の publicDir 規約に合わせ、astro build が `dist-astro/` に自動複製)。詳細は附録 B 参照。

### 7.2 src/data/build.ts 内部構造

```ts
// src/data/build.ts(擬似コード)
import { loadAll } from './loaders';
import { buildIndexes } from './lib/indexes';
import * as projections from './projections';

async function main() {
  // === 1. ロード + Zod 検証 ===
  const occupations = await loadAll('data/occupations/', OccupationSchema);
  const translationsEn = await loadAll('data/translations/en/', TranslationSchema);
  const scoreRuns = await loadAll('data/scores/', ScoreRunSchema);
  const statsLegacy = await loadAll('data/stats_legacy/', StatsLegacySchema);
  const labels = await loadLabels('data/labels/');
  const sectors = await loadSectorDefinitions('data/sectors/');

  // === 2. インデックス構築 ===
  const indexes = buildIndexes({
    occupations, translationsEn, scoreRuns, statsLegacy, labels, sectors,
  });
  // indexes 含む:
  //   occById              Map<number, Occupation>
  //   transById            Map<number, TranslationEn>
  //   statsById            Map<number, StatsLegacy>
  //   historyByOcc         Map<number, ScoreEntry[]>  // 時間順
  //   latestScoreByOcc     Map<number, ScoreEntry>
  //   runsByModel          Map<string, ScoreRun[]>
  //   sectorByOcc          Map<number, SectorAssignment>  // v1.1.0 追加
  //   labelsByDim          Map<string, LabelDict>

  // === 3. 投影(12 ファミリー、依存順) ===
  await projections.sectors.build(indexes, 'public/');       // 他から参照されるため最初
  await projections.labels.build(labels, 'public/');
  await projections.profile5.build(indexes, 'public/');
  await projections.treemap.build(indexes, 'public/');
  await projections.search.build(indexes, 'public/');
  await projections.transferPaths.build(indexes, 'public/');
  await projections.detail.build(indexes, 'public/');
  // 以下は Future-coded(デフォルト build でスキップ、--enable-future で有効化)
  await projections.tasks.build(indexes, 'public/');
  await projections.skills.build(indexes, labels, 'public/');
  await projections.holland.build(indexes, 'public/');
  await projections.featured.build(indexes, 'public/');
  await projections.scoreHistory.build(indexes, 'public/');

  // === 4. 一貫性チェック(L3 sanity) ===
  runConsistencyChecks(indexes, 'public/');
  // - すべての detail ファイルが occupation に逆引きできる
  // - treemap 行数 == occupation 数(stats + score 完備のもの)
  // - skill index が 31 個の skill key を含む
  // - sector review_queue が空でない場合 warn
  // 等
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 7.3 共有インデックス `src/data/lib/indexes.ts`

```ts
// src/data/lib/indexes.ts(抜粋)
import { pickLatestScore } from '@/graph/score-strategy';
import { resolveSector } from '@/graph/sector-resolver';

export interface Indexes {
  readonly occById: ReadonlyMap<number, Occupation>;
  readonly transById: ReadonlyMap<number, TranslationEn>;
  readonly statsById: ReadonlyMap<number, StatsLegacy>;
  readonly historyByOcc: ReadonlyMap<number, readonly ScoreEntry[]>;
  readonly latestScoreByOcc: ReadonlyMap<number, ScoreEntry>;
  readonly runsByModel: ReadonlyMap<string, readonly ScoreRun[]>;
  readonly sectorByOcc: ReadonlyMap<number, SectorAssignment>; // v1.1.0
  readonly labelsByDim: ReadonlyMap<string, LabelDict>;
}

export function buildIndexes(input: BuildIndexesInput): Indexes {
  const occById = new Map(input.occupations.map((o) => [o.id, o]));
  const transById = new Map(input.translationsEn.map((t) => [t.id, t]));
  const statsById = new Map(input.statsLegacy.map((s) => [s.id, s]));

  const historyByOcc = new Map<number, ScoreEntry[]>();
  for (const run of input.scoreRuns) {
    for (const [occIdStr, entry] of Object.entries(run.scores)) {
      const occId = Number(occIdStr);
      const list = historyByOcc.get(occId) ?? [];
      list.push({
        model: run.scorer.model,
        date: run.run.run_date,
        score: entry.ai_risk,
        rationaleJa: entry.rationale_ja,
        rationaleEn: entry.rationale_en,
      });
      historyByOcc.set(occId, list);
    }
  }
  for (const list of historyByOcc.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  const latestScoreByOcc = new Map(
    [...historyByOcc.entries()].map(([id, hist]) => [id, pickLatestScore(hist)]),
  );

  const runsByModel = new Map<string, ScoreRun[]>();
  for (const run of input.scoreRuns) {
    const list = runsByModel.get(run.scorer.model) ?? [];
    list.push(run);
    runsByModel.set(run.scorer.model, list);
  }

  // v1.1.0: sector 派生
  const sectorByOcc = new Map(
    input.occupations.map((occ) => [occ.id, resolveSector(occ, input.sectors, input.overrides)]),
  );

  return { occById, transById, statsById, historyByOcc, latestScoreByOcc, runsByModel, sectorByOcc, labelsByDim: input.labelsByDim };
}
```

すべて `ReadonlyMap` / `readonly` で **build 起動後の不変性** を型レベルで保証。

### 7.4 最新スコア取得戦略

`src/graph/score-strategy.ts`(Phase C で `src/data/lib/` から `src/graph/` に移送):

```ts
// src/graph/score-strategy.ts
export interface ScoreEntry {
  readonly model: string;
  readonly date: string;  // ISO YYYY-MM-DD
  readonly score: number;
  readonly rationaleJa: string;
  readonly rationaleEn: string;
}

/**
 * 現在の戦略: run_date で最新を取る。
 * 将来はモデル優先度に変更可能(例: Opus > GPT > 旧 Opus)。
 * 変更時は本ファイルに changelog を残すこと + Zod schema にも反映。
 */
export function pickLatestScore(history: readonly ScoreEntry[]): ScoreEntry {
  if (history.length === 0) {
    throw new Error('pickLatestScore: empty history');
  }
  return history.reduce((latest, cur) => (cur.date > latest.date ? cur : latest));
}
```

unit tests は `src/graph/score-strategy.test.ts`(複数モデル、同日複数 run、空 history などのケース)。

### 7.5 エントリと npm scripts(v1.5.0 以降の現実)

`package.json`(現行):

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "node scripts/check-lockfile-sync.cjs && node scripts/check-analytics-config.cjs && node scripts/check-nested-html-comments.cjs && tsx src/data/build.ts && astro build && node scripts/check-rendered-leaks.cjs",
    "build:data": "tsx src/data/build.ts",
    "import:ipd": "tsx src/data/import-ipd.ts",
    "typecheck": "tsc --noEmit",
    "test": "tsx --test 'src/**/*.test.ts'",
    "test:consistency": "tsx src/data/test-consistency.ts",
    "test:e2e": "scripts/run-e2e.sh",
    "test:seo": "bash scripts/seo-check.sh https://mirai-shigoto.com/",
    "check:architecture": "node scripts/check-architecture.cjs",
    "check:seo-baseline": "node scripts/diff-seo-baseline.cjs",
    "capture:seo-baseline": "node scripts/capture-seo-baseline.cjs",
    "check:rendered-leaks": "node scripts/check-rendered-leaks.cjs",
    "check:html-comments": "node scripts/check-nested-html-comments.cjs",
    "check:lockfile-sync": "node scripts/check-lockfile-sync.cjs",
    "check:analytics-config": "node scripts/check-analytics-config.cjs",
    "verify:jsonld": "node scripts/verify-jsonld.cjs",
    "verify:internal-links": "node scripts/verify-internal-links.cjs",
    "audit": "corepack pnpm audit --audit-level=moderate && (cd analytics && corepack pnpm audit --audit-level=moderate)"
  }
}
```

デプロイ前の標準フロー: `npm run build`(中で `build:data` が走る → Zod 検証 + 12 投影 → `astro build` で 821 ページ静的生成 → `check-rendered-leaks` でセンシティブトークン検査)。

**CI 推奨順序**(GitHub Actions + Vercel build):
1. `npm run typecheck` — TypeScript strict
2. `npm test` — 887 unit tests
3. `npm run build` — 上記すべて(build:data + astro build + leak check)
4. `npm run test:consistency` — L3 projection sanity
5. `npm run check:architecture` — 5 層境界 grep
6. `npm run check:seo-baseline` — SEO drift 検知
7. `npm run verify:internal-links` — 41,277 内部リンク integrity
8. `npm run verify:jsonld` — JSON-LD 構造検証

> **v1.5.0 以前との差異**: `uv run python scripts/build_data.py` 系のコマンドはすべて `tsx src/data/...` または `npm run` に置換。`scripts/build_occupations.py`(Python で 1112 HTML を生成していた)は `astro build` + `[id].astro` getStaticPaths に完全置換。詳細は附録 B。

### 7.6 Validation & Failure Policy(v1.0.3 新規)

**すべてのコマンドはリポジトリ root で実行**。

#### 7.6.1 検証梯子(4 層)

```
L1  Schema 検証       Pydantic model で各 source JSON を検証
                      失敗 → 即時 build 失敗(exit 1)、最初のエラーファイル + フィールドを出力
L2  一貫性検証        cross-file 関係: id 唯一性、padding 正確性、参照完全性
                      失敗 → build 失敗
L3  投影 sanity       各出力の行数 / フィールド数 / サイズが妥当か
                      失敗 → build 失敗
L4  E2E 煙テスト       フロントエンドが主要投影ファイルを fetch できるか
                      失敗 → デプロイブロック(CI gate)
```

#### 7.6.2 コマンドリスト

| 検証 | コマンド | exit code 意味 |
|---|---|---|
| L1 + L2 + 全量 build | `npm run build:data`(= `tsx src/data/build.ts`) | 0 = 成功; 非 0 = どの段階の失敗でも |
| L3 | `npm run test:consistency`(= `tsx src/data/test-consistency.ts`) | 0 = 成功; 非 0 = 投影 sanity チェック失敗 |
| Architecture boundary | `npm run check:architecture` | 0 = 全 5 層境界 grep 通過; 非 0 = どこかが import 禁則違反 |
| SEO baseline | `npm run check:seo-baseline` | 0 = drift なし; 非 0 = URL / meta / JSON-LD / og / 内部リンクのいずれかが変化 |
| 内部リンク integrity | `npm run verify:internal-links` | 0 = 全リンク有効; 非 0 = 死リンク検出 |
| JSON-LD 構造検証 | `npm run verify:jsonld` | 0 = 全 page の schema.org が合格; 非 0 = 構造エラー |
| L4 | `npm run dev` で local 起動 + ブラウザで `/data.treemap.json`、`/data.detail/0001.json`、`/data.search.json` を fetch | 200 + 妥当な JSON = 成功 |

> **v1.5.0 以前との差異**: `python3 scripts/build_data.py --validate-only`(L1+L2 のみで build を走らせない separate コマンド)は廃止。TypeScript の Zod 検証は build 開始の最初の段階で必ず走るため、別途 validate-only モードは不要(失敗時は projection 書込前に exit 1)。

#### 7.6.3 失敗ポリシー

- **build 失敗処理**: build スクリプトは **アトミック化** —— 失敗時に半端な `dist/` を残さない。推奨方法:
  1. 一時ディレクトリ `dist.next/` に書込
  2. すべての投影成功後、原子的に置換 `dist/ ← dist.next/`(または先に `mv dist dist.prev && mv dist.next dist`)
  3. 失敗: `dist.next/` を削除、`dist/` の旧版を維持
- **データ欠落処理**:
  - `data/scores/` 空 → `latest_score_by_occ` 全 null; treemap の `ai_risk` 列全 null; build ブロックしない
  - `data/stats_legacy/<padded>.json` 不在 → DetailProjection の `stats_legacy` フィールド null; ブロックしない
  - `data/translations/en/<padded>.json` 不在 → DetailProjection の英語フィールド null; ブロックしない
  - `data/occupations/<padded>.json` 不在だが他層から参照されている → **build 失敗**(データ完全性 bug)
- **schema typo 処理**: build 失敗、精確な位置を出力(例 `data/occupations/0042.json: 'ai_risk' should be int, got str`)、dist を書かない
- **警告レベル**: 以下は警告を出すが **失敗しない**:
  - source ファイルが schema にない追加フィールドを含む(前方互換)
  - score ファイルが `confidence` フィールドを欠く(schema v1 → v2 移行期)
  - 職業の IPD 数値プロファイルが全体欠落(38 件職業の想定状況)

#### 7.6.4 CI / Pre-deploy gate

`.github/workflows/data-validation.yml` および pre-push hook(`scripts/run-e2e.sh` 由来)が main への push 前に実行(v1.5.0 以降):

```bash
npm run typecheck                  # TS strict
npm test                           # 887 unit tests
npm run build                      # = build:data + astro build + leak check
npm run test:consistency           # L3 projection sanity
npm run check:architecture         # 5 層 import 境界 grep
npm run check:seo-baseline         # SEO drift
npm run verify:internal-links      # 内部リンク
npm run verify:jsonld              # JSON-LD 構造
```

どのステップも非 0 exit → **merge / deploy ブロック**。

> **architecture.md §6.3 と整合**: architecture.md 側に「CI 関門表」(2026-05-13 確立済)があり、本セクションの CI gate と同期。Vercel deploy preview は別途 L4(実 HTTP fetch + Lighthouse + Visual regression)を担当。

---

## 8. アップグレードフロー

> **セクション全体 Status**: **Implemented**(v1.5.0 以降 TypeScript pipeline で動作; §8.1-§8.5 のコマンドは直接実行可)。
> Python 時代のコマンド(`python3 scripts/import_ipd.py` / `python3 scripts/build_data.py` 等)は附録 B 参照。

### 8.1 IPD 新バージョンアップグレード(7.00 → 7.01)

```
1. 新 xlsx を ~/Downloads/ にダウンロード
2. npm run import:ipd  (= tsx src/data/import-ipd.ts)
   ├─ 細目 sheet を解析 → 差分レポートを stdout に
   ├─ IPD形式 / 解説系 を解析 → data/occupations/<id>.json に書込
   ├─ data/.ipd_provenance.json 更新(sha256 + retrieved_at)
3. diff を人手 review(git diff data/)
4. schema breaking change の処理(あれば)
   ├─ フィールドリネーム → src/data/schema/occupation.ts に Zod 変更
   ├─ フィールド型変更 → 投影コード(src/data/projections/*.ts)修正
5. npm run build:data
6. テスト実行: npm run test:consistency
7. git commit + push origin preview
8. https://pre.mirai-shigoto.com で 3 URL サンプル抽検
9. preview → main マージで本番反映
```

### 8.2 新 AI 評価ラウンド実行

```
1. prompt 準備(既存、data/prompts/ 参照)
2. モデル実行 → JSON 出力を data/scores/occupations_<model>_<date>.json に
3. npm run build:data
   └─ 自動で新 score ファイル検出、historyByOcc + latestScoreByOcc を再構築
4. npm run check:seo-baseline で AI risk 変化分の差分確認
5. baseline を意図的更新: npm run capture:seo-baseline → git commit
6. git push origin preview
```

**旧 score ファイルを削除する必要はない** —— history はプロダクトコンテンツ。

### 8.3 新翻訳言語追加(例: 韓国語)

```
1. mkdir data/translations/ko/
2. 翻訳モデル実行 → 556 ファイルを data/translations/ko/ に出力
3. src/data/build.ts に transKo = await loadAll(...) 追加
4. src/data/projections/detail.ts に lang_ko 出力追加(または新投影 data.detail.ko/)
5. フロントエンドはユーザー言語で選択 fetch
```

(現状サイトは v1.4.0 以降 JA-only。EN 翻訳は data/translations/en/ に保存されているが UI では消費しない。)

### 8.4 1 職業を手動編集

```
1. vim data/occupations/0042.json    # 修正したいフィールドを修正
2. npm run build:data                 # 影響を受けるすべての投影を再生成
3. git commit + push origin preview
```

**禁止**: `public/data.*` 配下のどのファイルも直接編集してはならない —— 次回 build で上書きされる(gitignored、build 成果物)。

### 8.5 タスクレベル AI 評価実行

```
1. prompt 作成: task.description_ja + occupation context → 0-10 リスクを出力
2. すべての occupation の tasks(約 5,000 個)を巡回 → モデル呼出
3. 出力を data/scores/tasks_<model>_<date>.json に
4. npm run build:data --enable-future
   └─ data.tasks/<id>.json 投影(Future-coded)が自動でタスク評価を join
5. フロントエンド「タスクリスクマップ」ページ(将来実装)が data.tasks/<id>.json を消費
```

> Tasks 投影は現在 Future-coded(関数は実装済、デフォルト build でスキップ)。`--enable-future` フラグで有効化可能。対応 UX 公開時にデフォルトに切替予定。

---

## 9. 決定記録

> 主要アーキテクチャ選択の「why」。将来あなたや別の保守担当が変更したくなった時、先にここを読む。

### D-001: ファイル型アーキテクチャ(アーキテクチャ A)を選択、SQLite ではない

- **日付**: 2026-05-03
- **決定**: ソースデータは JSON ファイル、SQLite は使わない
- **理由**:
  - 単独編集者(並行衝突なし)
  - git review 体験が最重要
  - 580 件規模は Python dict で十分
  - 学習コスト最低
- **代償**: 「最新取得」「モデル別グループ化」等のクエリロジックを手書き必要(indexes.py に集中保守)
- **SQLite 再考のタイミング**: 投影関数 > 8 で各々 join 複雑 / 職業類似度クエリ実装 / 評価ファイル > 30 個 / build > 5 秒

### D-002: IPD が唯一の職業プロファイル源 + stats_legacy 独立パッチ層

- **日付**: 2026-05-03
- **決定**: 給与 6 フィールドを IPD 主構造に混入させず、`stats_legacy` として独立
- **理由**:
  - IPD は給与データを含まない(異なる政府機関由来)
  - 物理的出所の異なるデータを混ぜると「IPD 真実性」が汚染される
  - 将来 stats ソース切替(jobtag → e-Stat)時に独立層なら副作用なし
- **代償**: build 時に 2 層 join が必要

### D-003: occupations_full.json を職業ごと 1 ファイルに分割

- **日付**: 2026-05-03
- **決定**: `data/occupations/<id>.json`(4 桁ゼロ詰め)、単一大ファイルではない
- **理由**: git diff、エディタ性能、AI context フレンドリー
- **代償**: ファイル数 1 → 556(macOS では完全に無感)

### D-004: 翻訳と主ソースを切り離す

- **日付**: 2026-05-03
- **決定**: 英語を `data/occupations/<id>.json` に入れず、独立 `data/translations/en/<id>.json`
- **理由**: IPD アップグレード vs 翻訳モデルアップグレードの周期が異なる; 新言語追加コスト最低
- **代償**: build 時に追加 join 1 回

### D-005: score ファイルを `<scope>_<model>_<date>` 命名

- **日付**: 2026-05-03
- **決定**: `scope` ∈ {`occupations`, `tasks`}; 上書きせず、削除せず、永久保持
- **理由**: 評価履歴はプロダクトコンテンツ(「AI 視点の進化」); scope prefix で職業レベル / タスクレベル評価の混同を回避
- **代償**: リポジトリに小ファイル累積

### D-006: 投影層 9 ファミリー / 10 ファイルタイプ

- **日付**: 2026-05-03
- **決定**: 各消費者に dedicated 投影; `data.skills/` ファミリーは `_index.json` + 78 個 per-skill ファイルで計 2 種、他 8 ファミリーは各 1 種、合計 10 ファイルタイプ
- **理由**: モバイル端は異なる shape が必要; treemap が詳細データを背負ってはいけない
- **代償**: build 出力ファイル数が多い; フロントエンド fetch パスに新規約が必要

### D-007: stats_legacy は data.json から抽出、occupations_full.json からではない

- **日付**: 2026-05-03
- **決定**: 既存解析済の 6 フィールドを使い、生配列を再解析しない
- **理由**: 28 件の追加 occupations_full レコードはすべて `ok=False` の空レコード、ゼロ増分
- **代償**: なし

### D-008: 4 つの IPD 新規職業を一括収録

- **日付**: 2026-05-03
- **決定**: 581 ブロックチェーン / 582 声優 / 583 産業医 / 584 3D プリンター すべて加入
- **理由**: トピック性強、SEO 価値大、コンテンツ深度良好
- **代償**: この 4 件は stats_legacy が null、フロントエンドで耐障害化

### D-009: dist/ を git に入れる、Vercel build server に乗せない

- **日付**: 2026-05-03(Phase 0 決定 0.4)
- **決定**: 構築成果物 `dist/` を source と一緒に commit; Vercel に Python build 環境を構成しない
- **理由**: 現状の Vercel 構成変更ゼロ; ローカル build 後 push、デプロイ経路最短; commit サイズ管理可(~5-10 MB)
- **代償**: データ更新のたびに commit history が汚染(diff 大); 200 MB 超過時 M-004 を検討
- **代替案**: M-004 が将来の切替パスを記述

### D-010: 4 新規職業の stats_legacy は null(フロントエンドで耐障害)

- **日付**: 2026-05-03(Phase 0 決定 0.5)
- **決定**: 581-584 この 4 IPD 新規職業は stats_legacy ファイル生成せず、DetailProjection の `stats_legacy` フィールド null; フロントエンド UI で「統計データは現在準備中です」表示
- **理由**: これら職業は jobtag scrape 時にまだ存在せず、stats データなし; リリース優先度 > データ待ち
- **代償**: 4 件の詳細ページ stats 領域がプレースホルダ; 許容可能
- **将来アクション**: JILPT が IPD 詳細版で公開、または jobtag scrape 再実行時に補充

### D-011: migrate_*.py / import_ipd.py 一回限りスクリプトを scripts/ に保留

- **日付**: 2026-05-03(Phase 0 決定)
- **決定**: Phase 1 の migrate_*.py と import_ipd.py を実行後削除せず、`scripts/` 内に保留、ファイル冒頭に "one-shot, kept for reference / future re-runs" コメント
- **理由**: import_ipd.py は IPD 7.01 アップグレード時に再利用; migrate_* は真の一回限りだが監査 / 復盤に保留が助かる
- **代償**: `scripts/` ファイル数増加; 将来の読者が「なぜこれらスクリプトがあるか」困惑するかもしれない — コメントで説明

### D-012: 各 Phase に 1 commit/PR

- **日付**: 2026-05-03(Phase 0 決定)
- **決定**: Phase 0 / 1 / 2 / 3 / 4 各々 1 PR、4-5 個の大 PR で全 IPD 切替を完了
- **理由**: 各 PR が完全で独立デプロイ可能なプロダクト状態に対応; review 粒度妥当; ロールバック時の損失は 1 Phase のみ
- **代償**: 各 PR の変更量が大(1 PR で 20-50 ファイル可能); review に集中力必要

### D-013: Phase 4 末尾のみ audit reviewer 復査

- **日付**: 2026-05-03(Phase 0 決定)
- **決定**: Phase 0 / 1 / 2 / 3 は外部 audit を単独トリガーしない; Phase 4 締括り時に全量 audit reviewer 復査を 1 回
- **理由**: v1.0.3-v1.0.4 ドキュメント監査でベースライン確立済; 中間プロセスは主にドキュメント通り実行で各ステップ監査不要; Phase 4 末に総検証
- **代償**: 万一前段の Phase がドキュメントから逸脱しても Phase 4 まで発覚せず手戻り可能性
- **緩和**: 各 Phase 内部で §7.6 Validation 梯子で自己チェック、それ自体が品質ゲート

### D-015: Python pipeline 完全廃止、TypeScript ETL に統合(v1.5.0、2026-05-09)

- **日付**: 2026-05-09
- **背景**: v1.0.x - v1.4.x の build pipeline は Python(`scripts/build_data.py` + `scripts/projections/*.py × 12` + `scripts/lib/*.py` + Pydantic schemas)で構築されていた。一方サイトのフロントエンドと API は TypeScript(Astro + React + @vercel/og)。**2 言語スタック共存** が運用コストを生んでいた:
  - `uv run python` と `npm run` のコマンド使い分け
  - Pydantic schema と TypeScript 型の **二重保守**(同じデータ構造を 2 度定義)
  - Vercel build 環境に Python 入りインストール構成が必要(コールドスタート遅延)
  - 開発者が両言語に習熟する必要(`scripts/build_occupations.py` 1112 ページ生成 Python と `src/pages/*.astro` 動的生成 TS が独立)
- **却下された代替案**:
  - **A: Python 側のまま、TS 側を Python に寄せる** — フロントエンドを Python(Jinja2 等)に変えるのは現実的でない。Astro の component model 失う。
  - **B: 二言語のまま、共通 schema を JSON Schema で同期** — schema sync 自動化のコスト > 一本化のコスト。
- **決定**: Python pipeline を完全廃止、TypeScript ETL(`src/data/build.ts` + Zod schemas + tsx runner)に統合。
  - `scripts/build_data.py` → `src/data/build.ts`
  - `scripts/lib/indexes.py` → `src/data/lib/indexes.ts`
  - `scripts/lib/score_strategy.py` → `src/graph/score-strategy.ts`(Phase C で graph 層に移送)
  - `scripts/projections/*.py × 12` → `src/data/projections/*.ts × 12`
  - `data/schema/*.py`(Pydantic) → `src/data/schema/*.ts`(Zod)
  - `scripts/build_occupations.py`(1112 HTML 静的生成) → `src/pages/ja/[id].astro` getStaticPaths(astro build で 821 ページ生成)
  - `scripts/dev-server.py` → `astro dev`(Vercel の dev server)
- **代償**:
  - Pydantic の `Field(ge=0, le=5)` のような宣言的 range 制約は Zod でも書けるが、IPD 細目 sheet からの自動生成スクリプト(`scripts/generate_schema.py`)は廃止、Zod schema は手書き保守
  - Python ecosystem の特定ライブラリ(`beautifulsoup4`、`playwright`)を使っていた一部スクリプトは `xlsx` package と native fetch に書き換え
  - `uv` の virtualenv 自動管理 → `pnpm` + `tsx` の Node モジュール解決(同等の体験)
- **効果**:
  - 単一スタック(TypeScript + Astro)、開発者の認知負荷削減
  - Schema が一箇所(`src/data/schema/*.ts`)— type と runtime validation を `z.infer` で同一ソース化
  - Vercel build から Python 構成削除 → コールドスタート / build 時間短縮
  - Edge Function、Astro page、build pipeline、test がすべて同じ schema を import 可能
- **依拠 commit**: `66cc97aa feat(arch): remove /m/ pipeline — single responsive URL architecture` 系の連続 commits(2026-05-09 前後)。詳細歴史は **附録 B** 参照。

### D-014: Sector taxonomy は「自動派生 + override + review_queue」、552 件手動アノテーションではない

- **日付**: 2026-05-04(v1.1.0 mobile pivot)
- **背景**: モバイル版 ② 職業マップ 設計が 16 個の消費者フレンドリーな業種グループを要求するが、ソースデータは MHLW 政府分類コード(不可読 + 分布不均) と JSOC 文字コード(同問題)のみ。
- **却下された代替案**:
  - **A: 552 件手動アノテーション** —— 進化不可、職業追加のたびに再ラベル必要。
  - **B: MHLW 15 主類を直接使う** —— 名称が消費不可(`12_072-06`)、分布が深刻に不均(03 類 88 件、01 類 8 件)。
  - **C: MHLW → 16 翻訳表** —— 境界ケース処理機構なし、`12_080-*` のような sub-bucket が同時に creative / 製造 / IT を含む時に無解。
- **決定**: 二層マッピング + 自動派生 + override ファイル + review_queue フィードバックループ(詳細は §6.11)。
  - 主マッピング: `data/sectors/sectors.ja-en.json` が 16 sector + 各 sector の `mhlw_seed_codes` glob リストを定義。
  - 境界処理: `data/sectors/overrides.json` で 1 対 1 上書き(padded_id → sector_id)。
  - 自動フィードバック: build のたびに `dist/data.review_queue.json` 出力、オペレーターが見て上記 2 ファイルを編集し続けゼロになるまで。
- **理由**:
  - source データ清潔度 —— `data/occupations/<id>.json` 一行も変えず、sector 派生は projection 層で発生、既存アーキテクチャと 100% 一致。
  - 各派生に `provenance`(override / auto / auto-ambiguous / unmatched / no-mhlw)—— 監査可。
  - 職業追加時に自動派生、曖昧時にキューイングして仲裁 —— 進化可。
  - 工数約 5 日(選択肢 A の約 10-15 日に対し)、ただし多軸 bands、関連職業推薦、faceted search 等「将来能力」を同時に解放。
- **代償**:
  - 抽象が 1 層増える(resolver + projection + override ファイル)。
  - オペレーターが review queue を定期的に見る習慣を養う必要。
  - 16 sector 数は判断、データ駆動ではない —— 将来 14 や 18 が良いと発見した場合、再定義必要。
- **初回結果**: 556 職業 100% 自動派生(3 件 override)、16 sector 分布範囲 14-63 件、0 uncategorized / 0 ambiguous。
- **根拠ドキュメント**: §6.11

---

## 10. 将来移行パス

> 現時点では実装しないが、インターフェイスは残す。

### M-001: アーキテクチャ A → C アップグレード(SQLite 中間層追加)

- **トリガー条件**: 投影が 12 個超え; N×N 類似度クエリしたい; フロントエンドに「任意スライス API」開きたい
- **アクション**: `data/` を全部維持、`build_data.py` のみ変更: 「ロード + インデックス」段を「ロード + メモリ SQLite 灌入」に置換、すべての投影関数を dict 操作から SQL クエリに変更
- **可逆**: いつでも純粋 dict 版に戻せる

### M-002: KV 書込チャネル開放

- **トリガー条件**: ユーザーお気に入り / 評価 / コメントしたい
- **アクション**: Vercel KV または Upstash Redis 追加; 新 `api/feedback-store.js`、`api/favorites.js`; フロントエンドはハイブリッド読込(静的 + KV)
- **影響なし**: 現在のすべての静的投影

### M-003: e-Stat 賃金構造基本統計調査で stats_legacy を置換

- **トリガー条件**: jobtag 改版で旧 stats 失効、かつ JILPT がまだ IPD に取り込まない
- **アクション**: 新 importer `scripts/import_estat.py` 作成、`data/stats_official/<id>.json` に出力; build 時に stats_official を優先、stats_legacy にフォールバック
- **影響なし**: 投影 schema 不変(ソースラベルが `jobtag_scrape` → `estat_official`)

### M-004: dist/ を git から移し、Vercel build 時生成にする

- **トリガー条件**: dist サイズ 200 MB 超え; またはデータ更新のたびに commit history を汚染したくない
- **アクション**: Vercel に Python build 環境構成; `vercel.json` に `buildCommand: "npm run build"` 追加; dist/ を .gitignore に
- **代償**: build server 依存(より脆弱)

### M-005: 詳細版 IPD データ有効化

- **トリガー条件**: JILPT が v7.x 詳細版発行(サンプル量、信頼区間等の統計メタ情報含む)
- **アクション**: 新 importer 追加、これらメタ情報を `data/occupations/<id>.json` 同階層の `data/occupations_meta/<id>.json` 形式で保管; フロントエンドで選択表示可

---

## 11. 改訂履歴

> 圧縮フォーマット: 各エントリは「何をしたか」のみ記載。設計理由 / 振り返りは **附録 A** 参照。

- **v1.0** — 2026-05-03 — 初稿。
- **v1.0.1** — 2026-05-03 — §3.2 数字 514/38 → 518/34 修正; score 命名統一に `occupations_` prefix 追加; §5.1 で 12 サブ領域補完。
- **v1.0.2** — 2026-05-03 — 状態行バージョン同期; §2.3 重複小節合併; §3.1 用語統一; §5.1 表現修正; v1.0.1 で空中追加した `mhlw_categories` ロールバック; `category_size` 統一。
- **v1.0.3** — 2026-05-03 — 大幅強化。Document Status マトリクス(§0.1)+ Prerequisites(§0.2)新規; §2 全データソースに Provenance 追加; §2.3 に ScoreRun 完全 schema 追加; §3A "ID and Path Rules" 新規; §5 を SourceOccupation / StatsLegacy / DetailProjection 3 schema に分割し §5.5 Classification Fields 使用ルール新規; §6 を「9 ファミリー / 10 ファイル」に + 総合表に Status 列追加; §6.1 境界を厳密区間記号に; §7.6 Validation & Failure Policy 新規(4 層検証梯子 + 失敗ポリシー + CI gate); §11 圧縮; 附録 A 新規。
- **v1.0.4** — 2026-05-03 — 復査精修。v1.0.3 ヘッダの権威関係が逆だった(実装済範囲は文書ではなくコードが基準が正)を修正; D-006 タイトル「9 JSON」 → 「9 ファミリー / 10 ファイルタイプ」; §2.1 / §2.2 license_terms 全て「未確認」に変更(公式条項の結論を予断しない); §7 / §8 各々セクション全体 Status 標示追加; §0.1 第 23 行 で フローセクションはセクション全体 Status を使うと説明。
- **v1.0.5** — 2026-05-03 — Phase 0 実装。§2.1 IPD データ来歴を全確認(直リンク × 2、発行日 2026-03-17、データ基準日 2026-02-10/02-26、license 二次利用 OK 規定 attribution フォーマット込、tos URL); §9 に D-009 から D-013 5 件 Phase 0 決定新規追加(dist 入 git / 4 新規職業 stats null / migrate スクリプト保留 / 単 PR 粒度 / Phase 4 のみ audit)。pyproject.toml に openpyxl + pydantic 依存追加。
- **v1.0.6** — 2026-05-04 — Phase 1 部分実装(1B/1D/1E/1F/1C 完了)。§2.1 / §2.5 の skills 78 → 39、knowledge 66 → 33 修正(旧値が誤って `_無関係フラグ` 子節を含んでいた)。Pydantic schemas 完成(occupation / stats_legacy / score_run / translation / labels); 3 個の migration スクリプト動作(552 stats_legacy / 552 translation / 1 ScoreRun v2.0 ファイル); 7 個 labels ファイル生成(204 labels 計)。
- **v1.0.7** — 2026-05-04 — Phase 1 完了 + Phase 2 完了。`scripts/import_ipd.py` 動作 → 556 source occupation ファイル。完全 build パイプライン実装: `scripts/lib/{indexes,score_strategy,atomic_write}.py` + `scripts/projections/*.py × 9` + `scripts/build_data.py` orchestrator(--validate-only / --enable-future / atomic dist swap 含) + `scripts/test_data_consistency.py` 書直しで L3 sanity 実行。`package.json` に 4 npm scripts 追加。`.gitignore` 変更: `dist/` を git に(D-009)、`dist.next/` `dist.prev/` のみ除外。§6.0 投影総合表で 4 Planned ファミリーが Implemented に + 実測 size すべて目標に合致。
- **v1.0.8** — 2026-05-04 — Phase 3 完了(フロントエンドを新投影に切替)。§6.1 treemap 形状を columnar から array-of-objects + 16 フィールドに変更(legacy JA-key 逆変換の `education_pct` / `employment_type` 含)—— `data.treemap.json` を legacy `data.json` の drop-in に。`index.html` 5 箇所の `data.json` 参照 → `data.treemap.json`(preload / fetch / JSON-LD / FAQ / エラーメッセージ)。`scripts/build_occupations.py` に `_load_legacy_shape_corpus()` アダプタ追加、`dist/data.detail/<id>.json × 556` から読込 —— render 層 ~900 行ゼロ修正; 出力 1112 ページ(556 JA + 556 EN、4 新 IPD 含)。`api/og.tsx` を全集 fetch から単一 `/data.detail/<padded>.json` fetch に。`vercel.json` に rewrite 4 件 + cache header; `scripts/dev-server.py` に同ルールミラー; ローカル E2E 煙テスト全グリーン(GA4 `map_loaded` event 552 tiles 発火)。§0.1 実装済範囲が全 Implemented に昇格。
- **v1.0.9** — 2026-05-04 — Phase 4 完了(締括り)。`data.json` + `data/occupations_full.json` + `data/occupations.json` + `data/ai_scores_2026-04-25.json` + `data/translations_2026-04-25.json` を `data/.archive/v0.6/` にアーカイブ(各ファイルの用途と置換関係を説明する README 含)。`scripts/build_data_legacy.py.bak` + `scripts/.normalization_warnings.json` 削除。`vercel.json` に `/data.json → /data.treemap.json` 301 redirect 追加(外部リンクへの後方互換)。9 箇所の外部参照更新: `scripts/make_prompt.py` INPUT を dist に切替; `llms.txt` / `llms-full.txt` 複数 URL + 説明; `analytics/spec.yaml` フィールドソース説明; `README.md` / `README.ja.md` データフロー表 + ファイルツリー。`CHANGELOG.md` に v0.7.0 エントリ追加、`package.json` を 0.6.0 → 0.7.0 に bump。`.github/workflows/data-validation.yml` CI gate で L1+L2+L3 + dist drift 検知。ローカル E2E 煙テスト全グリーン(/data.json local 404 = 正常、Vercel 301)。§0.1 状態を「Phase 1-4 全完了」に。
- **v1.0.10** — 2026-05-04 — 外部 audit reviewer 復査(D-013) + 修正。Audit verdict: **PASS-WITH-WARNINGS**(0 P0、3 P1、4 P2、1 P3)。9 項目すべて修正: A-001(§2.1 / §2.2 / §2.4 / §2.5 / §7 / §8 セクション全体標示で `Status: Planned` × 6 → `Implemented`); A-002(test_data_consistency エラーメッセージ `treemap rows` → `total source occupations`); A-003(実 `data/.stats_legacy_provenance.json` 生成 + 3 migrate スクリプトの SOURCE パスを `data/.archive/v0.6/` に同期); B-001(README × 2 の残留 `score_ai_risk.py` / `scores.json` 参照削除 + ファイルツリー書直し); B-002(`llms.txt` / `llms-full.txt` 冒頭 552 → "556 (552 scored, 4 await scoring)"); B-003(§7.2 pipeline 図 `× 78` → `× 39`); B-004(§0.2 deps Status `Planned` → `Implemented`); C-001(dev-server.py に `/data.json` → 301 → `/data.treemap.json` 追加)。
- **v1.1.0** — 2026-05-04 — Mobile pivot · sector サブシステム実装。§6.11(sector taxonomy + 多軸 bands) + D-014(決定記録)新規。新ファイル: `data/schema/sector.py`(Pydantic)、`data/sectors/sectors.ja-en.json`(16 sector 定義 + MHLW seed_codes)、`data/sectors/overrides.json`(per-occupation 上書き × 3)、`scripts/lib/sector_resolver.py`(resolve_sector 純粋関数 + validate_sector_definitions)、`scripts/lib/bands.py`(risk / workforce / demand 3 axis 閾値定数)、`scripts/projections/sectors.py`(data.sectors.json + data.review_queue.json 出力)、`scripts/test_sector_subsystem.py`(24 unit tests)。変更: `scripts/lib/indexes.py` に sectors / sector_overrides / sector_by_occ 3 index 追加; `scripts/projections/treemap.py` に sector_id / sector_ja / hue / risk_band / workforce_band / demand_band 6 フィールド追加; `scripts/projections/search.py` に sector_id / risk_band / workforce_band 3 フィールド追加(schema 1.1 に昇格); `scripts/projections/detail.py` に sector{} ブロック + 3 band 追加(schema 1.1 に昇格); `scripts/build_data.py` で sectors を PLANNED に(先頭実行) + L3 sanity; `scripts/test_data_consistency.py` に check_sectors / check_review_queue / check_treemap_v110 追加; `vercel.json` に `/data.sectors.json` rewrite + cache header; `scripts/dev-server.py` ミラー。**初回結果**: 556 occupation 100% 自動派生(3 件 override)、16 sector 分布 14-63 件、0 uncategorized / 0 ambiguous。Size 増分: treemap +5 KB gz / search +2 KB gz / detail +0.1 KB per file。すべての 24 unit tests + 全 L3 sanity checks 通過。
- **v1.1.1** — 2026-05-13 — Phase A.5 全ドキュメント日本語化。本ファイルおよび関連 `docs/*` / `analytics/*` / `README.md` 等を日本語に書き直し。中文原版は `docs/_archive/DATA_ARCHITECTURE.zh.md` 等にバックアップ保管(`.gitignore` 下、公開対象外)。コードロジック・schema 変更なし。
- **v1.5.0** — 2026-05-09 — **Python pipeline 完全廃止、TypeScript ETL に統合**(D-015 参照)。`scripts/build_data.py` → `src/data/build.ts`、Pydantic → Zod、`uv run python` → `tsx` / `npm run`。`scripts/build_occupations.py`(1112 HTML 静的生成) → `[id].astro` getStaticPaths。Vercel build から Python 構成削除。詳細プロセスは附録 B。
- **v1.6.0** — 2026-05-15 — **本ファイル全 Python 参照を TypeScript に refresh**。§0.2 Prerequisites / §1 原則 4 / §4.1 schema location / §5.6 schema 維持戦略 / §7 Build Pipeline 全体 / §8 アップグレードフロー / §9 D-015 追加。歴史保存のため **附録 B「歴史的経緯(Python 時代)」** を新設、Pydantic / uv / Python script 等の元記述を時系列で保存。Phase A.5(2026-05-13)で本ファイルは日本語化されたが、内容は依然 Python pipeline を記述しており、コード現状と乖離していた。本回その乖離を解消。
- **v1.6.1** — 2026-05-15 — 文書 git 公開化(commit `282fda41`)に追随。`docs/_archive/` Phase A.5 中文バックアップ削除(目的達成)。他 docs/* との内部参照整合(architecture.md / WORKFLOW.md / SITE_FULL_VISION.md と同期)。コード変更なし。

---

## 附録 A — 変更背景(設計理由)

> v1.0.1 以降の重大改訂の「why」。changelog は「何をしたか」のみ、背景はここを参照。

### A.1 v1.0.1 背景

- **§3.2 数字 514/38 → 518/34**: 元の数字が「IPD_desc - IPD_num = 38」(4 新規職業含)を「既存 + IPD 解説のみ」と誤解。正分解: 既存 IPD 完備 518 + 既存 解説のみ 34 + 新規 4 = 556。
- **score 命名に prefix 追加**: 元 `<model>_<date>` 命名は職業レベル / タスクレベル評価を区別不可。`<scope>_` prefix で曖昧性回避。
- **§5.1 12 サブ領域**: 以前 6 個のみ列挙(interests/skills/knowledge/abilities/work_characteristics/work_activities)、work_values + 4 distribution + employment_type を漏らしていた、計 12 個。ルールが統一適用。

### A.2 v1.0.2 背景

- **`mhlw_categories.ja-en.json` ロールバック**: v1.0.1 で `category_code: "12"` / `category_ja: "製造職"` を導入。しかし豆腐製造 mhlw_main `12_072-06` の "12" が大分類か中分類かは厚労省編職業分類公式表の確認が必要、未確認。**かつこれは audit プロセスで私が独断追加した設計、ユーザーと未議論**。原則違反: 決定記録はユーザーの決定、文書がユーザーの代わりに決定すべきでない。`category_size`(§6.1 と一致、workers 数だけでバケツ分け)にロールバック。
- **`category` → `category_size`**: 元 §6.1 で `category`、§6.4 で `category_size`、命名不一致。`category_size` に統一。例値 id=1 workers=1.2M で元 "small" 記載だが、ルール上 "large" のはず、例値エラー。

### A.3 v1.0.3 背景

外部監査が 12 項目を指摘(DOC-DA-001 ~ DOC-DA-012)。本回全対応:

- **DOC-DA-001 (P0) 位置付け衝突**: 元文書が同時に「唯一の真実源」と「ドラフト実装待ち」を主張。新版で Document Status マトリクス(§0.1)導入し「実装済範囲」vs「目標範囲」を明示、絶対表現を境界付きに改める。
- **DOC-DA-002 (P1) 現在未来混在**: §6 総合表に Status 列追加; 各ファミリーに Implemented / Planned / Future マーク。v1.0.3 実装で必修は 4 Planned ファミリーのみと明示。
- **DOC-DA-003 (P1) 9 vs 10 数量曖昧**: §6 タイトルを「9 ファミリー / 10 ファイル」に変更、総合表に `data.skills/` が 2 種ファイルを含むと明記。
- **DOC-DA-004 (P1) stats_legacy 境界混乱**: §5 schema を 3 種に分割 —— SourceOccupationSchema から stats_legacy を除去、StatsLegacySchema を独立セクションに、DetailProjectionSchema が join ビュー。アーキテクチャ原則を復元。
- **DOC-DA-005 (P1) 分類フィールド語義未定**: §5.5 Classification Fields 使用ルール新規 —— 分類フィールドは現在 **raw 保存 + dedupe のみ許可**、**UI / SEO / フィルタ用途は禁止**、マッピング表確認まで。
- **DOC-DA-006 (P2) パスルール散乱**: §3A ID and Path Rules 新規、5 種 ID(canonical / source ファイル名 / projection ファイル名 / URL / display)、10 種パステンプレートを集中定義。
- **DOC-DA-007 (P2) 境界条件**: §6.1 `category_size` を厳密区間記号 `[0, 100K) / [100K, 1M] / (1M, ∞)` に、境界値の帰属を明示。
- **DOC-DA-008 (P2) 検証戦略不足**: §7.6 Validation & Failure Policy 新規 —— 4 層検証梯子(Schema / 一貫性 / 投影 sanity / E2E 煙テスト)、コマンドリスト、exit code 意味、アトミック化 build 戦略、CI gate 記述。
- **DOC-DA-009 (P2) 前提条件不足**: §0.2 Prerequisites 表で Python / パッケージ管理 / 既存依存 / 追加依存 / Node / 作業ディレクトリをカバー。
- **DOC-DA-010 (P2) AI score 再現性**: §2.3.1 で ScoreRun 完全 schema 新規、model / provider / temperature / prompt_version / prompt_sha256 / input_data_version / input_data_sha256 / run_id 等の監査メタデータを含む。
- **DOC-DA-011 (P2) データ来歴不足**: §2.1 / §2.2 / §2.4 / §2.5 各々に Provenance 表追加(source_url / publisher / retrieved_at / sha256 / license_terms / attribution)。
- **DOC-DA-012 (P3) changelog 過密**: §11 を 1-2 行/件に圧縮、背景を全部 附録 A に下ろす。

**未実施**: 監査が §4 で提案した「14 セクション大再構築」。判断: 現在 11 セクションの骨格は明瞭、ハードイシューは内容問題で構造問題ではない、再構築は認知コストを引き入れプロダクト価値はない。内容追加、骨格不変。

### A.4 v1.0.4 背景

外部監査第二ラウンドが v1.0.3 残留 4 項目を指摘(R-001 ~ R-004)。本回全対応:

- **R-001 (P0) ヘッダ権威関係逆**: v1.0.3 第 4 行で「実装済範囲内: 本ドキュメントとコード衝突時は本ドキュメント基準」と書いたが、§0.1「実装済範囲 | 現実のコードが基準」と直接衝突 —— audit 修正時の意図「実装済コードが事実、文書は記述のみ」を逆に書いたミス。ヘッダ書直し、3 種範囲(実装済 / 目標 / 将来)の権威関係を明示: 実装済はコード基準、目標は文書基準、将来は拘束しない。
- **R-002 (P1) D-006 タイトル昇格漏れ**: D-006 タイトル昇格時に「9 JSON」 → 「9 ファミリー / 10 ファイルタイプ」を漏らしていた。補充 + 決定理由で数量構造説明。
- **R-003 (P1) license を事実として誤記**: v1.0.3 §2.1 / §2.2 で license_terms を「出典明示で二次利用可」と書いたが、レポート内で同時に JILPT 公式ページ未照合と認めていた。「仮説」を「結論」と誤認した。両箇所「未確認」に + 実装前に公式ページ突合必須 + 確認まで法的結論として用いない。
- **R-004 (P2) Status 約束過広**: v1.0.3 §0.1 第 23 行で「各データソース、各投影、各プロセスに Status」と書いたが、§7 Build Pipeline と §8 アップグレードフローのサブセクションには未標示。2 件修正: (a) 第 23 行表現を「データソース + 投影に Status; プロセスセクションはセクション全体 Status」に絞る; (b) §7 / §8 冒頭に各々セクション全体 Status 標示(両者 Planned)。

### A.5 v1.0.6 + v1.0.7 背景(Phase 1 + Phase 2 実装)

**v1.0.6 (Phase 1 中段)**:
- 数字エラー発見: 元 §2.1 / §2.5 で skills=78、knowledge=66 と記載; 実際 IPD 細目 sheet のこれら 中領域 配下に 2 セットフィールドがある —— score フィールド(`IPD_04_03_01_*` 39 個 / `IPD_04_04_01_*` 33 個) + 並列の `_無関係フラグ` フィールド。原 doc は両者の合計を score 数として扱っていた。修正後の真の合計 labels = 6 + 11 + 39 + 33 + 35 + 39 + 41 = **204**。このエラーは build_labels.py 初回実行時に露呈(「missing EN translation for `_無関係フラグ`」)。予防: 将来 IPD のフィールドを読む時は IPD-ID prefix で厳密フィルタ、中領域 substring マッチに依存しない。
- 5 個の migration スクリプトが 1 回で動作、retry なし —— Pydantic 厳密検証が source data 側にあるおかげ。
- 翻訳戦略: 278 個 EN ラベルを Claude が一気に生成(O*NET-aligned 優先、literal 次)、すべて `draft v0.1` マーク、将来人間 + O*NET 28.x クロス検証待ち。

**v1.0.7 (Phase 1 末 + 全 Phase 2)**:
- import_ipd.py 初回実行で生成された occupation ファイルの tasks 数が 0 —— 露呈した問題: task IPD-ID フォーマット仮定エラー(`IPD_05_<NN>_001` vs 実 `IPD_05_<NN>_01`)。修正後 17 task / 豆腐製造、全集 7501 task。予防: IPD インポートロジックを書く前に実 sheet ヘッダを 1 回 dump 必須。
- atomic dist swap 設計(`AtomicDist` コンテキストマネージャ)で build 途中失敗時に dist/ が破壊されないことを保証。失敗パス手動テスト済: dist.next/ 自動クリーンアップ、dist/ 不変。
- L3 sanity が build_data.py 末尾で自動実行、独立 `test_data_consistency.py` が CI エントリを提供。両者の検証ロジックは同源(共有すべき、将来 lib/sanity.py に再構築可)。
- 投影実測 size 全て §6.0 目標の半分以下 —— 将来コンテンツ追加(detail フィールド増、aliases_en 等)に十分な余裕。
- 手動決定: search.json の `category_size` は treemap と同フィールドを踏襲、**v1.0.1-v1.0.2 のような「空中から新フィールド導入」反復を回避**。将来 `category_class` 追加するなら §6.4 で先に新規規定。

### A.6 v1.0.8 背景(Phase 3: フロントエンド切替)

**主要発見 / 決定**:
- treemap.json 形状再設計: 元 v1.0.3 の columnar (cols/rows) は **不足** —— index.html の per-tile tooltip が ~15 フィールド(`education_pct` / `employment_type` のような nested object 含む)を必要、columnar で押し込むと汚い。array-of-objects に変更後、ファイルサイズが 15.7 KB gz から ~80 KB gz に上昇 —— 100 KB 目標を下回る。
- legacy JA-key 逆変換: 元 IPD source は `below_high_school: 0.074` 形式; index.html は `"高卒未満": 7.4` 形式。投影時に逆変換し、フロントエンド内部 ~900 行ゼロ修正。これは「完璧のために現状を壊さない」妥協だが、Phase 3 で視覚ゼロリグレッションを保つ。
- 4 新規職業のフロントエンド互換: 581-584 は treemap でフィルタアウト(stats + ai_risk 欠落)、detail ページは正常生成 —— 「AI Impact —」 + 「data unavailable」表示。D-010 の履行。
- vercel.json rewrites: projections は物理的に `dist/`、URL 上は `/data.treemap.json` 等でサービス。rewrite 4 件 + dev-server.py ミラー追加。
- build_occupations.py 適応戦略選択 B(compat loader)、render 修正ではない: ~900 行 render_html / pick_related を全部保持、入口に 50 行 `_load_legacy_shape_corpus()` 追加。修正面積最小、リグレッションリスク最低。
- ローカル煙テスト通過の主証拠: preview ブラウザで index.html ロード後、GA4 が `map_loaded` イベントを自動 fire(`tile_count=552`) —— treemap.json fetch + parse + レンダリングが全成功を意味。スクリーンショット視覚は v0.6.x 本番と無差異。

### A.7 v1.0.9 背景(Phase 4: 締括り)

**主要決定 / 操作**:
- 旧 source ファイルは **アーカイブ、削除ではない**: `data/.archive/v0.6/` に 5 件全 source ファイル + 解説 README 保持。git mv で history blame を保つ; 将来 v0.6.x のどの deploy にも回帰再現可能。D-007 / D-011 思想の延長: 保守は精簡に優先。
- `/data.json` に 301 redirect 追加、410 ではない: 外部エコシステム(検索エンジンインデックス、ソーシャル共有旧リンク、サードパーティミラー、prompt.ja.md 歴史ユーザー)が `/data.treemap.json` にスムーズ移行。後者の schema は v0.6 data.json の近似 drop-in(同フィールド名 + JA-key distributions)、古いスクリプトの fetch もそのまま動く。
- CI gate に dist drift 検知追加: commit 済 `dist/` は `npm run build:data` で今生成されるものと等しくなければならない。2 種 bug を捕捉: (a) source 変更後 dist を rebuild + commit 忘れ(本番デプロイ時にデータ古い); (b) 投影関数に nondeterminism(マシンごとに異なる結果)。D-009(dist を git に)の必須保険。
- README 双語同期: `README.md` と `README.ja.md` のデータフロー表 + ファイルツリーを **手動で同期** 変更。両ファイルを一致に保つのは難しいが、ユーザーがどちらを読んでも正しい v0.7 アーキテクチャが見える。
- `scripts/make_prompt.py` の INPUT を `dist/data.treemap.json` に切替: schema 互換(同 16 フィールド同名)のため、この LLM scoring スクリプトは他ロジック変更不要で動く。意図外副作用: **将来新モデル評価実行** 時、直接 dist を使えばよい、旧ファイルに戻る必要なし。
- audit reviewer のレビューなし: D-013 で Phase 4 末のみ audit 決定。本回 review はユーザー / コラボレーターの外部監査で完了(v1.0.3 → v1.0.4 の外部監査モード同様)。本文書 v1.0.9 + 実コード + dist + git diff が audit 入力。

### A.8 v1.1.0 背景(Mobile pivot · sector サブシステム)

**トリガーシナリオ**: モバイル版 UIUX 再構築。設計稿(10 画面 mobile-web)の ② 職業マップ が 16 個の消費者フレンドリーな「業種 sector」グループを要求するが、source データには MHLW 政府分類コード(`12_072-06` のような)のみ。関連 2 問題に答える必要:
1. モバイル版サポートのためデータベース構築するか?(結論: 完全に不要 —— 既存 9-projection ファイル型アーキテクチャがニーズを遥かに超える)
2. 16 sector をどう実装するか?(決定詳細 D-014)

**主要決定 / 操作**:
- **source 層を汚染しない**: `data/occupations/<id>.json` を一行も変えない。新規 `data/sectors/` は独立ディレクトリ、sector 派生は `scripts/lib/indexes.py` ロード時に発生(per-occ resolve)、**ソースデータ修正なし**。理由は D-002(IPD は唯一の職業プロファイル源)と一致 —— あらゆる「派生」を build 層に置く、source は永遠に単一事実。
- **Resolver は純粋関数**: `scripts/lib/sector_resolver.py` はファイル読まず、状態書かず —— sectors + overrides + occ_id + mhlw_main を取って SectorAssignment を返す。任意のコンテキストで再利用可(projection / テスト / 将来の CLI ツール)、テストはメモリフィクスチャのみ必要。
- **多軸 bands を独立 lib に抽出**: `scripts/lib/bands.py` の 3 axis(risk / workforce / demand)は閾値定数 + 3 純粋関数のみ。treemap、search、detail の 3 投影が全 import、**3 箇所で band 値が永遠に一致することを保証**。将来閾値調整(例: 「hot」を >2.0 から >1.8 に)時、1 箇所変更で済む。
- **review_queue はフィードバックループ、失敗信号ではない**: build 時に `dist/data.review_queue.json` を出力しオペレーターに見せる(uncategorized / ambiguous リスト + hint)。CI はブロックしないが、オペレーターはゼロにしてから commit する。「分類正確性」を「開発問題」から「継続運用問題」に変える —— より進化可能。
- **初回で 100% 自動派生達成**: 556 職業全分類、3 件 override(12_080-* sub-bucket 内に IT/建設/maint 混在のケース)。0 uncategorized / 0 ambiguous。16 sector + seed_codes 設計が MHLW 実分布に基本的にマッチを示す。
- **Sector hue は fallback、真の色ではない**: 各 sector 定義に `hue: 'safe'|'mid'|'warm'|'risk'` —— ただしフロントエンドが実 treemap を描く時の色はあくまで ai_risk から。hue は「sector ラベル chip デフォルト背景色」のような「具体的職業コンテキストがない」場所のデフォルトのみ。これで「sector hue が outlier 職業の risk と衝突する」視覚混乱を回避。
- **データベース未追加**: ユーザーは「新機能サポートのためデータベース構築必要か」と懸念。既存 `dist/` 監査後、4 つの Planned projection がモバイル端の全 fetch 需要をカバー(treemap 65 KB / search 27 KB / detail 3.4 KB per file / labels 5 KB)、加えて本回 v1.1.0 の sectors(3 KB) + 3 band フィールド、フルスタックデータ需要 < 100 KB gz 第一画面。SQLite / Postgres / 任意のランタイムデータベースは過剰設計。D-001(SQLite ではなくファイル型アーキテクチャ選択)の判断が v1.1.0 でも成立することを裏付ける。
- **SPA 未追加**: データベース決定と同源 —— 552 件読み取り専用、id 単位でスライス済、CDN フレンドリー、モバイル版は「静的多ページ + 局所 island」、SPA は使わない。本回 v1.1.0 はデータ層のみ; HTML/JS 層(モバイル版 ① ホーム / ② 職業マップ / 等)は次バージョン。
- **次は v1.1.1+ に**: モバイル端 HTML/CSS/JS 実装(② 職業マップ で sector_id でグループ表示、③ 検索 で sector chip フィルタ、④/⑤ 詳細で sector ラベル + 同 sector 関連職業 表示 等)。この層はデータアーキテクチャ不変、純粋フロントエンド作業。

---

## 附録 B — 歴史的経緯(Python 時代、v0.0.x - v1.4.x)

> v1.5.0 で Python pipeline は完全廃止された(D-015 参照)。本附録は **Python 時代に決まっていた設計の出所を保存** する目的で残す。コード変更時に「なぜそうなっているのか」を遡るときの参照。
>
> **本附録の記述はすべて廃止済技術**。新規開発に引用しないこと。

### B.1 Python pipeline 概観(v0.0.x - v1.4.x)

| ファイル | 役割 | TypeScript 後継 |
|---|---|---|
| `scripts/build_data.py` | ETL orchestrator(1300+ 行) | `src/data/build.ts` |
| `scripts/import_ipd.py` | xlsx → JSON、IPD アップグレード時 | `src/data/import-ipd.ts` |
| `scripts/build_occupations.py` | 1112 HTML 静的生成(556 JA + 556 EN) | `src/pages/ja/[id].astro` getStaticPaths(astro build で 556 ページ) |
| `scripts/build_sector_hubs.py` | 16 sector hub HTML 生成 | `src/pages/ja/sectors/[sector].astro` |
| `scripts/build_rankings.py` | 9 ranking HTML 生成 | `src/pages/ja/rankings/[type].astro` |
| `scripts/build_labels.py` | labels JSON 生成 | `src/data/projections/labels.ts` |
| `scripts/generate_schema.py` | IPD 細目 sheet → Pydantic schema 自動生成 | **廃止**(Zod schema は手書き保守) |
| `scripts/lib/indexes.py` | メモリインデックス構築 | `src/data/lib/indexes.ts` |
| `scripts/lib/score_strategy.py` | 最新スコア取得戦略 | `src/graph/score-strategy.ts` |
| `scripts/lib/sector_resolver.py` | sector 解決(純粋関数) | `src/graph/sector-resolver.ts` |
| `scripts/lib/bands.py` | risk/workforce/demand bands | `src/data/lib/bands.ts` |
| `scripts/lib/atomic_write.py` | atomic dist swap context manager | `src/data/build.ts` 内部 |
| `scripts/projections/*.py × 12` | 12 投影 build | `src/data/projections/*.ts × 12` |
| `scripts/test_data_consistency.py` | L3 sanity check | `src/data/test-consistency.ts` |
| `scripts/dev-server.py` | Vercel dev server mirror | `astro dev`(Astro 公式) |
| `scripts/make_prompt.py` | LLM scoring prompt generation | スクリプトは保留(LLM scoring は今も人手 driven のため、自動化対象外) |

### B.2 Pydantic schema の構造(廃止)

Python 時代の schema は `data/schema/*.py`(Pydantic models)に書かれた。例:

```python
# data/schema/occupation.py(廃止)
from pydantic import BaseModel, Field
from typing import Literal

class OccupationSchema(BaseModel):
    id: int = Field(gt=0)
    schema_version: Literal["7.00"]
    title_ja: str = Field(min_length=1)
    classifications: ClassificationsSchema
    # 12 数値プロファイル: 各々が完全 dict or None
    interests: InterestsSchema | None
    # ... 他 11 dims
    tasks: list[TaskSchema] = Field(default_factory=list)
    tasks_lead_ja: str | None = None
```

**TypeScript への移行 motivation**:
- Pydantic の `Field(ge=0, le=5)` は Zod の `z.number().gte(0).lte(5)` に直訳可能
- IPD 細目 sheet からの自動生成スクリプト(`scripts/generate_schema.py`)は廃止: Zod に対する同等スクリプト未作成、手書き保守で代用
- 理由: 自動生成のメリット(IPD 7.01 で 1 行で再生成)は実際あまり機能していなかった。IPD 細目 sheet が出てから schema を re-generate しても、breaking change の検出と migration は結局人手 review が必要。Zod 手書きでも IPD 差分処理コストはほぼ同じ。

### B.3 旧 build pipeline コマンド一覧(廃止)

```bash
# Python 時代の入口(廃止、v1.4.x まで)
uv run python scripts/build_data.py                    # ETL 実行
uv run python scripts/build_data.py --validate-only    # L1+L2 のみ
uv run python scripts/build_data.py --enable-future    # Future-coded 投影含む
uv run python scripts/import_ipd.py --version 7.00     # xlsx インポート
python3 scripts/build_occupations.py                   # 1112 HTML 生成
python3 scripts/build_sector_hubs.py                   # 16 sector HTML 生成
python3 scripts/build_rankings.py                      # 9 ranking HTML 生成
uv run python scripts/test_data_consistency.py         # L3 sanity
uv run python scripts/generate_schema.py               # Pydantic schema 再生成
```

**TypeScript 時代の対応コマンド**:

```bash
npm run build:data                # = tsx src/data/build.ts(ETL + 12 投影、Zod 検証込)
npm run import:ipd                # = tsx src/data/import-ipd.ts
npm run build                     # = build:data + astro build + leak check(821 HTML 生成は astro build に統合)
npm run test:consistency          # L3 sanity
npm run typecheck                 # TypeScript strict check
npm test                          # 887 unit tests(Zod schemas のテスト含む)
```

### B.4 Python → TypeScript 移行の主要 commit(D-015 と整合)

| 時期 | commit | 内容 |
|---|---|---|
| 2026-04-25 | (v0.6.x) | Python pipeline 完全動作期、`data.json` 単一出力 |
| 2026-05-03 | Phase 0 | Document Status マトリクス導入、TypeScript 移行構想開始 |
| 2026-05-04 | Phase 1-4 | IPD v7.00 切替 + 9 投影家族 + atomic dist swap、Python pipeline は依然主体 |
| 2026-05-09 | `66cc97aa` 系 | **Python pipeline 全廃**、TypeScript ETL に統合、Vercel build から Python 構成削除 |
| 2026-05-12 - 2026-05-15 | Phase B/C/D/E | TypeScript アーキテクチャ refactor(`src/graph/` / `src/views/` / `src/templates/` 構築) |

### B.5 廃止された設計判断の振り返り

| 判断 | 当時の理由 | 廃止後の評価 |
|---|---|---|
| `uv` を使う | Python 仮想環境管理が `venv` より速く、`requirements.txt` より宣言的 | 良かったが、TS 統合後は不要 |
| Pydantic v2 を使う | Python schema 検証の de facto、IDE サポート良好 | 良かったが、Zod は TS native でさらに type-safe |
| `data/schema/*.py` を git に入れる | schema は source of truth、git diff 可読 | 同じ理由で TS に移送、変わらない |
| `scripts/generate_schema.py` で auto-gen | IPD 7.01 アップグレードを 1 コマンド化 | 実用上手書きと変わらない、Zod に移行時に廃止 |
| `data.json` 単一出力 → 12 投影に分解 | 「各消費者に最適な shape」原則の実現 | 大成功、TypeScript でも同設計を継承 |
| `dist/` を git に入れる(D-009) | Vercel build に Python 構成を入れる必要回避 | Python 廃止後は `public/` を git に入れない方針に切替可能(将来 M-004) |

### B.6 「なぜ Python だったか、なぜ移行できたか」

- **当初(v0.0.x、2026-04)**: 著者が個人プロジェクトとして始め、Python の科学計算 / ETL エコシステム(pandas、openpyxl、BeautifulSoup)が手に馴染んでいた
- **静的 HTML 生成**: `build_occupations.py` で Jinja2-like のテンプレ + Python loop で 1112 HTML を 1 分強で生成、初期 deploy には十分
- **問題が顕在化**: フロントエンドが Astro + React + TypeScript で開発進行、特に Edge Function(`api/og.tsx`)を導入してから「2 言語スタック」の運用負荷が表面化
- **転機**: 2026-05-09 の `66cc97aa` 系で「移行する価値」を確信、1 セッションで pipeline 全体を TypeScript に書き換え、SEO baseline 0 drift で完了

詳細な commit 一覧は git log を参照: `git log --oneline --grep="pipeline\|python\|TS ETL" --before=2026-05-15`。
