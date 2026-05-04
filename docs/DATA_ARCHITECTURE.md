# DATA_ARCHITECTURE.md — mirai-shigoto.com 数据架构规范

> 本文档是**目标数据架构规范**。它描述当前已落地状态、v1.0.3 目标设计和未来规划；具体适用边界见 §0.1 状态矩阵。
>
> 三个范围的权威关系：
> - **已落地范围**：以**现实代码为准**，本文档只是事实描述；如有出入应修正本文档。
> - **目标范围（v1.0.3 本轮要做）**：以**本文档为准**，代码视为待按本文档修正的偏差。
> - **未来规划范围（§10）**：仅记录方向，不约束代码也不约束本文档实施。

---

## 0. 文档与适用范围

### 0.1 Document Status

| 字段 | 值 |
|---|---|
| 版本 | v1.1.0 |
| 最后更新 | 2026-05-04 |
| 整体状态 | **Target Spec — 数据层已全量落地，前端 mobile 层待落地** |
| 已落地范围 | **v1.1.0 起：Phase 1-4 + Sector 子系统**。IPD v7.00 切换 + 9 投影家族 + 前端桌面消费者切换（v1.0.x）+ Sector taxonomy 子系统（§6.11，v1.1.0：sectors 投影 + 多轴 bands + review_queue + 24 unit tests + 100% 自动派生覆盖率）全部落地。**本文档对此范围内的 schema / 路径 / 命名 / 投影契约单方面权威**。 |
| 待落地（未来 Phase / 不在本轮范围） | 4 个新职业（581-584）的英文翻译；O*NET 标签的人工交叉验证（labels 当前为 draft v0.1）；5 个 Future 投影家族（tasks/skills/holland/featured/score-history）按对应 UX 上线时启用；Vercel build server 上 Python pipeline（M-004，目前 dist/ 入 git）；**移动端 HTML/CSS/JS 实现（v1.1.1+，纯前端工作，不动数据架构）**。 |
| 未来规划 | §10 "未来迁移路径"（M-001 至 M-005）—— 仅记录方向，不参与当前验收 |
| 关联文档 | [Design.md](./Design.md)（前端呈现）、[CHANGELOG.md](../CHANGELOG.md)（产品版本） |

> **AI / 程序员阅读注意**：每个**数据源**和**投影**都标有 **Status**（`Implemented` / `Planned` / `Future`）。流程章节（§7 Build Pipeline、§8 升级流程）属于**整节级 Status**，在该节起首单独标注。**只有 `Implemented` 是当前事实**；`Planned` 是本轮要做的目标；`Future` 是之后可能做的方向，**不要现在去实现**。

### 0.2 Prerequisites

build / import 流程的运行前提：

| 项 | 版本 / 要求 | 当前状态 |
|---|---|---|
| Python | `>=3.11`（pyproject.toml）；`.python-version` 锁定 3.12 | Implemented |
| 包管理 | `uv`（仓库根 `uv.lock` 已存在） | Implemented |
| 现有 Python 依赖 | beautifulsoup4 ≥ 4.12, httpx ≥ 0.28, playwright ≥ 1.50, python-dotenv ≥ 1.0 | Implemented |
| 新增依赖 | `openpyxl ≥ 3.1`（读 xlsx）、`pydantic ≥ 2.5`（schema 校验） | **Implemented**（v1.0.5 起在 pyproject.toml） |
| Node | package.json：@vercel/og 0.6.x, react 18.x（仅 OG image API 用） | Implemented |
| 运行目录 | 仓库根（所有 `python3 scripts/*.py` 命令均在此执行） | Implemented |

### 0.3 适用范围

- `data/`（源数据：IPD、stats_legacy、scores、translations、labels、schema）
- `dist/`（构建产物：9 个投影家族 / 10 个投影文件）
- `scripts/build_data.py`（构建管道）
- `scripts/import_ipd.py`（一次性 / 升级时的 xlsx → JSON 导入）
- 所有读取 `dist/data.*` 的前端代码（`index.html`、`api/og.tsx`、`build_occupations.py` 等）

> 与 [Design.md](./Design.md) 的关系：Design.md 管"前端怎么呈现"；本文档管"数据从哪来、怎么存、怎么打包"。两者通过 `dist/data.*` 投影契约对接。

---

## 1. 核心原则

1. **IPD 是职业画像的唯一权威源**。其他来源（jobtag 网页爬取、ハローワーク 等）只能作为**显式标注的补丁层**（如 `stats_legacy/`），不可与 IPD 数据混在同一字段。
2. **源 / 中间 / 投影 三层强分离**。源（`data/`）是手维护的事实；投影（`dist/`）是 build 的输出，**严禁手编辑**；build 脚本（`scripts/`）是唯一的桥梁。
3. **每个消费者拿到为它定制的投影**。前端首页、详情页、OG API、未来手机端，各取自己最瘦的那份 JSON。**不存在"一份打胖了大家用"的中间产物**。
4. **Schema 强制校验**。所有源 JSON 在 build 时通过 Pydantic model 校验，字段拼错 / 类型错 / 范围越界一律 build 失败。
5. **多次 AI 评分全量保留**。`data/scores/` 永不删旧文件——每次大模型升级跑出的新评分是历史记录的一部分，是产品内容（"评分演化"未来要可视化）。
6. **翻译与主源解耦**。所有非日语内容放在 `data/translations/<lang>/` 独立一层，主 JSON 只用日语 + 通用 key。新加语种 = 加目录，不动主源。
7. **变更必须先动本文件**。源结构 / 投影契约 / build 流程的变更，先在本文档反映，再写代码。

---

## 2. 数据源

### 2.1 IPD（主源）

- **Status**：**Implemented**（v1.0.7 起；`data/occupations_full.json` 已归档至 `data/.archive/v0.6/`）
- **正式名**：日本版 O-NET インプットデータ（職業情報データベース）
- **发布方**：独立行政法人 労働政策研究・研修機構（JILPT）；通过 厚労省 jobtag 网站分发
- **著作权人**：JILPT（"同データベースの著作権に関する全ての権利は同機構が保有しています"）
- **当前版本**：v7.00
  - **発行日（site publish）**：2026-03-17（job tag 网站更新日；本批同时新增 15 个职业）
  - **数据基准日（data cut）**：2026-02-10（数值系内部 最終更新日）/ 2026-02-26（解説系内部 最終更新日）
- **物理形态**：两个 xlsx 文件
  - `IPD_DL_numeric_7_00.xlsx`：数值系（518 职业 × 479 字段，技能/知识/能力/任务等）
  - `IPD_DL_description_7_00_01.xlsx`：解説系（556 职业 × 102 字段，描述/分类/別名/関連団体等）
- **数据字典**：两个 xlsx 都包含 `インプットデータ細目` sheet，定义全部 574 个字段的 IPD-ID、类型、范围、含义。**这是 schema 的事实源**。
- **覆盖领域**：
  - 01 収録番号（主键）
  - 02 名称・分類領域：職業名 + 厚労省分類 + JSOC 分類 + 25 個別名
  - 03 解説領域：簡易説明 / どんな職業か / 就くには / 労働条件 + 関連団体（10 個 + URL）+ 関連資格（35 個）
  - 04 数値プロフィール領域（核心）：職業興味 6 / 仕事価値観 11 / スキル 39 / 知識 33 / 仕事の性質 39 / 学歴 9 / 入職前訓練 10 / 入職前経験 10 / 入職後訓練 10 / 仕事活動 41 / 就業形態 10 / アビリティ 35（v1.0.6 修正：原写 78 / 66 含 `_無関係フラグ` flag 子节，实际 score 字段是 39 / 33）
  - 05 タスク領域：最多 37 個任务 × {description, 実施率, 重要度}
  - 77 直近情報源領域：每個分區的来源信息
  - 88 直近更新年度領域：每個分區的更新年度
  - 99 その他領域：样本量不足等业务标志位
- **存放**：原始 xlsx 文件**不入 git**（太大且二进制）。下载到 `~/Downloads/` 后通过 `scripts/import_ipd.py` 导入到 `data/occupations/<id>.json`。
- **数据溯源（Provenance）**（v1.0.5 已核对官方页面）：

  | 字段 | 值 |
  |---|---|
  | `source_index_url` | https://shigoto.mhlw.go.jp/User/download （job tag 下载索引页，URL 稳定） |
  | `source_file_url_numeric` | https://sgteprdstaplog01.blob.core.windows.net/web-app-contents/downloads/ver13/IPD_DL_numeric_7_00.xlsx |
  | `source_file_url_description` | https://sgteprdstaplog01.blob.core.windows.net/web-app-contents/downloads/ver13/IPD_DL_description_7_00_01.xlsx |
  | `source_publisher` | 独立行政法人 労働政策研究・研修機構（JILPT） |
  | `source_distributor` | 厚生労働省 / 職業情報提供サイト（job tag） |
  | `source_dataset` | 職業情報データベース 簡易版ダウンロードデータ（数値系 + 解説系） |
  | `version` | v7.00 |
  | `published_at` | 2026-03-17（job tag 网站发布日） |
  | `data_cut_date` | 2026-02-10（数値系）/ 2026-02-26（解説系） |
  | `retrieved_at` | （由 `import_ipd.py` 写入 `data/occupations/<id>.json` 顶层 `data_source_versions.ipd_retrieved_at`） |
  | `sha256` | （由 `import_ipd.py` 计算并记入 `data/.ipd_provenance.json`） |
  | `license_terms` | **二次利用 OK**。job tag 利用規約 第 9 条明文："職業解説 / 職業の数値情報 については 編集・加工、再集計等の二次利用が可能です"。本项目对 IPD 数据的解析、合并、投影属于该条款允许的"加工・再集計"。 |
  | `restrictions` | 利用規約 第 8 条：『職業興味検査』『仕事価値観検査』『職業適性テスト（Gテスト）』 的问题（含图像）禁止任何形式的记录 / 复制 / 配信。**本项目不使用这些 test 数据**，仅用 IPD 简易版的 occupation profile，不触及禁区。 |
  | `attribution_required` | **是**。规定格式（必须按此写）：<br/>原文格式：`『職業情報データベース 解説系ダウンロードデータ ver.7.00』職業情報提供サイト（job tag）より YYYY 年 MM 月 DD 日にダウンロード`<br/>加工版加注：`(https://shigoto.mhlw.go.jp/User/download)を加工して作成` |
  | `attribution_locations` | 必须出现在：网站 footer / README.md + README.ja.md / 详情页页面（与 IPD 数据相邻）/ data.json 衍生投影顶部注释 |
  | `tos_url` | https://shigoto.mhlw.go.jp/User/tos （查看完整利用規約） |

### 2.2 stats_legacy（薪资补丁层）

- **Status**：**Implemented**（v1.0.7 起；旧 `data.json` 已归档至 `data/.archive/v0.6/`）
- **存在原因**：IPD **不包含**薪资 / 就業者数 / 労働時間 / 年齢 / 求人賃金 / 求人倍率。这些数据在 jobtag.mhlw.go.jp 网页上由 JILPT 从 **賃金構造基本統計調査**、**労働力調査**、**ハローワーク求人統計** 三份不同政府数据汇总。
- **当前来源**：从历史爬取的 `data.json` 抽取（一次性）。
- **关键边界（重要）**：stats_legacy **物理上独立**于 IPD occupation 主源——它存在 `data/stats_legacy/<id>.json` 单独文件。**不允许嵌入 `data/occupations/<id>.json`**（违反 §1 第 1 / 2 条原则）。
  - 在 source 层：两份文件，按 id 配对
  - 在 build 层：`build_data.py` join 它们
  - 在 projection 层：`dist/data.detail/<id>.json` 才会出现合并后的 `stats_legacy` 子对象
- **6 个字段**：
  | 字段 | 单位 | 来源 |
  |---|---|---|
  | `salary_man_yen` | 万円/年 | 賃金構造基本統計調査 |
  | `workers` | 人 | 労働力調査 |
  | `monthly_hours` | 時間/月 | 賃金構造基本統計調査 |
  | `average_age` | 歳 | 賃金構造基本統計調査 |
  | `recruit_wage_man_yen` | 万円/月 | ハローワーク求人統計 |
  | `recruit_ratio` | 倍 | ハローワーク求人統計 |
- **覆盖**：552 条记录（其中 535 条有完整 6 字段；4 个 IPD 新职业 581-584 暂无）。
- **更新策略**：当前为**冻结快照**（不主动更新）。未来如需刷新有 3 个选项：
  - A. 重新爬 jobtag 的 stats panel（推荐，自动跟随）
  - B. 接 e-Stat 賃金構造基本統計調査 API（最权威，工作量大）
  - C. 等 JILPT 把这部分纳入 IPD 詳細版（被动等）
- **存放**：`data/stats_legacy/<id>.json` 一职业一文件。
- **数据溯源（Provenance）**：

  | 字段 | 值 |
  |---|---|
  | `source_url` | 间接来自 https://shigoto.mhlw.go.jp/User/Occupation/Detail/<id> 的 stats panel |
  | `source_publisher` | 厚生労働省（汇总） |
  | `original_surveys` | 賃金構造基本統計調査 / 労働力調査 / ハローワーク求人統計 |
  | `retrieved_at` | 2026-04-25（一次性历史爬取） |
  | `sha256` | （由迁移脚本计算并记入 `data/.stats_legacy_provenance.json`） |
  | `license_terms` | **待确认**。stats 来源（賃金構造基本統計調査 / 労働力調査 / ハローワーク求人統計）的二次利用条款实施时需逐项核对 e-Stat 官方页面与厚労省条款。 |
  | `freshness` | **冻结**——不主动更新；如要刷新见上述 A/B/C 选项 |

### 2.3 AI scores（评分层）

- **Status**：当前 `data/ai_scores_2026-04-25.json` 已落地（**Implemented**）；多份历史保留 + 任务级评分 + ScoreRun 完整 schema 是 **Planned**
- **每次大模型升级或重新校准跑一次**。每次产出一份独立 JSON 文件，**永不删除**。
- **文件命名**：`<scope>_<model-slug>_<run-date>.json`
  - `<scope>` ∈ {`occupations`, `tasks`}，前缀必须有，避免两类评分混淆
  - `<model-slug>` 用小写连字符：`claude-opus-4-7`、`gpt-5`
  - `<run-date>` 用 ISO 格式：`YYYY-MM-DD`
  - 例：`occupations_claude-opus-4-7_2026-04-25.json`、`tasks_claude-opus-4-8_2027-01-10.json`
- **目前已有**：`occupations_claude-opus-4-7_2026-04-25.json`（从原 `data/ai_scores_2026-04-25.json` 重命名 + 加 `occupations_` 前缀）
- **取最新策略**：默认按 `run_date` 取最晚一份。该策略写在 `scripts/lib/score_strategy.py`，**不要散落在多个投影里**。

#### 2.3.1 ScoreRun Schema（v1.0.3 新增完整元数据）

每份 score 文件必须满足以下 schema（除 `scores` 外其他字段都是审计 / 复现所需的元数据）：

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

**关键元数据字段**：
- `input_data_version` + `input_data_sha256`：复现性的核心——确认评分时所用源数据的精确版本
- `prompt_version` + `prompt_sha256`：rubric 演化追踪
- `model_temperature`：影响一致性的关键 LLM 参数
- `confidence`（per-score）：可选，模型对该评分的置信度

**当前已有文件迁移**：
- `data/ai_scores_2026-04-25.json` → `data/scores/occupations_claude-opus-4-7_2026-04-25.json`
- 旧文件 `version: "1.0"` → 新 `schema_version: "2.0"`
- 旧文件缺失字段（input_data_*, prompt_*, model_temperature 等）：迁移脚本填 `"<unknown - migrated from v1.0>"` 标记，不阻塞

### 2.4 翻译（多语种层）

- **Status**：**Implemented**（v1.0.7 起按语种拆分目录已落地；旧单文件已归档）
- **当前语种**：日语（主）+ 英语（翻译）
- **存放**：`data/translations/<lang>/<id>.json`，按 ISO 639-1 语言代码
  - 例：`data/translations/en/0001.json`
- **未来扩展**：加新语种 = 加目录（`data/translations/ko/`、`data/translations/zh/`），主源完全不动。
- **翻译范围**：
  - 主 JSON 的 `title.ja`、`description.*`、`tasks[].description_ja`、`aliases_ja`
  - 标准标签（skills/knowledge 名称）**不在这里**——见 §2.5
- **数据溯源**：每个 `<lang>/<id>.json` 文件需有 `translator`（model）、`translated_at`、`source_data_version`（指向被翻译的 IPD 版本）三个元数据字段

### 2.5 标签字典（labels）

- **Status**：**Implemented**（v1.0.7 起；7 个文件 / 204 labels 由 `scripts/build_labels.py` 生成；EN 名为 draft v0.1，待 O*NET 交叉验证）
- **目的**：通用标签（如"読解力" → "Reading Comprehension"）是全 556 个职业共用的，不要在每个文件里存 556 遍。
- **存放**：`data/labels/<dimension>.ja-en.json`
- **来源**：JA 名直接来自 IPD 細目；EN 名是 O*NET 对齐的最佳译名（v1.0.6 由 `scripts/build_labels.py` 生成，标记 draft 待 O*NET 交叉验证）
- **文件清单**（共 204 labels，v1.0.6 修正：原 §2.5 的 skills 78 / knowledge 66 包含 `_無関係フラグ` 子节）：
  - `skills.ja-en.json`（39 项）
  - `knowledge.ja-en.json`（33 项）
  - `abilities.ja-en.json`（35 项）
  - `work_characteristics.ja-en.json`（39 项）
  - `work_activities.ja-en.json`（41 项）
  - `interests.ja-en.json`（6 项 Holland Code）
  - `work_values.ja-en.json`（11 项）
- **数据溯源**：每份 `<dimension>.ja-en.json` 顶层须有 `source` / `license` / `count` 三个元数据字段（schema 见 `data/schema/labels.py`）

---

## 3. ID 覆盖矩阵

> 这一节回答：**哪些职业 ID 在哪些数据源里有数据？前端如何容错？**

### 3.1 集合关系

```
                        全集 = 580 (occupations_full.json 历史最大集)
                        ├── ok=False, 全空：28 条 → 不收录
                        └── ok=True：552 条 → 收录

IPD v7.00 解説系：556 条
  └─ 含 552 条与 ok=True 重合
  └─ 4 条新增（id 581-584）

IPD v7.00 数値系：518 条
  └─ 全部是解説系子集（518 ⊂ 556）
  └─ 38 条解説有但数値画像缺失（样本不足）
```

### 3.2 最终收录范围

**收录 556 个职业** = 552（原） + 4（IPD 新增）。具体：

| ID 类别 | 数量 | 主源数据 | stats_legacy | 数值画像 (skills/knowledge/...) |
|---|---|---|---|---|
| 旧 + IPD 双全（核心） | 518 | ✅ IPD 解説 | ✅ 有 | ✅ IPD 数値 |
| 旧 + 仅 IPD 解説 | 34 | ✅ IPD 解説 | ✅ 有 | ❌ 数值字段全 null |
| IPD 新增（581-584） | 4 | ✅ IPD 解説 | ❌ 无 | ❌ 数值字段全 null（样本不足） |
| **合计** | **556** | | | |

> 派生统计：556 中有 518 条具备 IPD 数値画像；38 条无数値画像（= 34 旧 + 4 新）。投影代码以 518 为"全画像样本"基数。

**前端容错规则**：
- 数值字段为 null → 不显示技能雷达图、不显示 Holland Code 测评结果，但其余正常
- stats_legacy 为 null → 显示"統計データは現在準備中です" 而不是 "0万円"

### 3.3 4 个 IPD 新增职业

```
581  ブロックチェーン・エンジニア   AI 风险话题 / IT 高收入
582  声優                       AI 配音冲击代表性职业
583  産業医                      医疗/法务边界
584  3D プリンター技術者          制造业 AI 标签
```

这 4 个职业**优先级高**，因为话题性强、SEO 价值大。

---

## 3A. ID and Path Rules（新增）

> v1.0.3 引入。集中规定所有 ID / 路径 / 文件名格式，避免多套写法散落各处。

### 3A.1 ID 类型

| ID 类型 | 表示形式 | 范围 | 出现位置 | 例 |
|---|---|---|---|---|
| **Canonical ID** | 整数 | 1 – 584（含 IPD 收录番号） | JSON 字段 `"id": <int>`、SQL 主键、所有内存数据结构 | `1`, `42`, `581` |
| **Source 文件名 ID** | 4 位补零字符串 | `0001` – `0584` | `data/occupations/<padded>.json`、`data/translations/<lang>/<padded>.json`、`data/stats_legacy/<padded>.json` | `0001.json`, `0042.json`, `0581.json` |
| **Projection 文件名 ID** | 4 位补零字符串 | 同上 | `dist/data.detail/<padded>.json`、`dist/data.tasks/<padded>.json`、`dist/data.score-history/<padded>.json` | `0001.json` |
| **URL ID** | 裸整数 | 1 – 584 | `https://mirai-shigoto.com/{ja,en}/<id>`、jobtag `https://shigoto.mhlw.go.jp/User/Occupation/Detail/<id>` | `/ja/1`, `/en/581` |
| **Display ID** | 裸整数 | 1 – 584 | UI 上展示给用户、面包屑、SEO meta | `1`, `42` |

### 3A.2 转换规则

```
canonical_id (int)  ←→  filename_id (str)  ←→  url_id (str)
       42                    "0042"                 "42"

filename_id = f"{canonical_id:04d}"
url_id      = str(canonical_id)
```

**转换不允许 lossy**：导入器和 build 脚本必须用 `int()` / `f"{:04d}"` 显式转换，不允许字符串拼接式的 hack。

### 3A.3 路径模板

| 用途 | 模板 | 示例 |
|---|---|---|
| 源 occupation 文件 | `data/occupations/{padded}.json` | `data/occupations/0042.json` |
| 源 stats_legacy 文件 | `data/stats_legacy/{padded}.json` | `data/stats_legacy/0042.json` |
| 源 translation 文件 | `data/translations/{lang}/{padded}.json` | `data/translations/en/0042.json` |
| 源 score 文件 | `data/scores/{scope}_{model-slug}_{run-date}.json` | `data/scores/occupations_claude-opus-4-7_2026-04-25.json` |
| 投影 detail 文件 | `dist/data.detail/{padded}.json` | `dist/data.detail/0042.json` |
| 投影 tasks 文件 | `dist/data.tasks/{padded}.json` | `dist/data.tasks/0042.json` |
| 投影 score-history 文件 | `dist/data.score-history/{padded}.json` | `dist/data.score-history/0042.json` |
| 投影 skill 文件 | `dist/data.skills/{skill_key}.json` | `dist/data.skills/reading.json` |
| 已发布 URL（ja） | `https://mirai-shigoto.com/ja/{url_id}` | `https://mirai-shigoto.com/ja/42` |
| 已发布 URL（en） | `https://mirai-shigoto.com/en/{url_id}` | `https://mirai-shigoto.com/en/42` |

### 3A.4 测试一致性

`scripts/test_data_consistency.py` 必须包含以下断言：

- 每个 `data/occupations/{padded}.json` 文件的 JSON 内 `"id"` 字段值 == `int(padded)`
- `data/stats_legacy/`、`data/translations/<lang>/` 下所有文件遵循同样规则
- 文件名补零位数严格等于 4
- canonical_id ∈ [1, 999]（4 位补零的安全范围；目前用到 584）

---

## 4. 文件布局

### 4.1 源数据 `data/`

```
data/
├── occupations/                        # IPD 主数据，一职业一文件
│   ├── 0001.json
│   ├── 0002.json
│   └── ... (556 文件)
│
├── translations/
│   └── en/
│       ├── 0001.json
│       ├── 0002.json
│       └── ... (556 文件)
│
├── labels/                             # 标签字典（全局共享）
│   ├── skills.ja-en.json
│   ├── knowledge.ja-en.json
│   ├── abilities.ja-en.json
│   ├── work_characteristics.ja-en.json
│   ├── work_activities.ja-en.json
│   ├── interests.ja-en.json
│   └── work_values.ja-en.json
│
├── scores/                             # AI 评分历史（永不删）
│   ├── occupations_claude-opus-4-7_2026-04-25.json
│   ├── occupations_<model>_<date>.json
│   └── tasks_<model>_<date>.json       # 任务级（未来）
│
├── stats_legacy/                       # 薪资补丁层
│   ├── 0001.json
│   ├── 0002.json
│   └── ... (552 文件，4 个新职业暂无)
│
└── schema/                             # Pydantic models
    ├── occupation.py                   # IPD occupation 主结构
    ├── translation.py
    ├── score_run.py
    ├── stats_legacy.py
    └── labels.py
```

**全部入 git**。

### 4.2 构建产物 `dist/`

```
dist/
├── data.treemap.json                   # 桌面首页 treemap
│
├── data.detail/                        # 详情页 / OG / 手机 drill-down
│   ├── 0001.json
│   └── ... (556 文件)
│
├── data.tasks/                         # 任务级数据（含 AI 评分）
│   ├── 0001.json
│   └── ... (556 文件)
│
├── data.search.json                    # 全局搜索索引（含别名）
│
├── data.skills/                        # 按技能找职业
│   ├── _index.json
│   ├── reading.json
│   └── ... (78 文件)
│
├── data.holland.json                   # Holland Code 测评匹配
├── data.featured.json                  # 手机首屏推荐
│
├── data.score-history/                 # AI 评分时间序列
│   ├── 0001.json
│   └── ... (556 文件)
│
└── data.labels/
    ├── ja.json
    └── en.json
```

**入 git**（因为 Vercel 当前不跑 build server，需要 push 时已经构建完）。

### 4.3 一次性 / 临时

```
~/Downloads/IPD_DL_*.xlsx               # IPD 原始下载，不入 git
build/                                  # 构建中间产物，.gitignore
```

---

## 5. Schema 体系（v1.0.3 拆分）

源数据和投影数据的 schema **物理上不同**——前者是 IPD + 翻译的事实，后者是 build 时 join 的视图。混在一起会让"补丁层独立"原则失效。

本节按 **3 个 schema** 分别定义：

- §5.1 `SourceOccupationSchema`：`data/occupations/<padded>.json`，**不含 stats_legacy**
- §5.2 `StatsLegacySchema`：`data/stats_legacy/<padded>.json`，独立文件
- §5.3 `DetailProjectionSchema`：`dist/data.detail/<padded>.json`，build 时 join 后的视图

### 5.1 `SourceOccupationSchema` — `data/occupations/<padded>.json`

**不含**：`stats_legacy`（独立见 §5.2）、英文翻译（独立见 §2.4 translations 层）

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

独立文件，1 职业 1 文件。**禁止合并到 SourceOccupationSchema**。

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

- 4 个 IPD 新职业（id 581-584）：**不存在文件**，build 时按缺失处理（不是文件存在但内容为 null）
- 部分字段缺失（535/552 全 6 字段，其余有部分）：缺的字段用 `null`，文件本身仍存在

### 5.3 `DetailProjectionSchema` — `dist/data.detail/<padded>.json`

由 `build_data.py` 在投影阶段生成。SourceOccupation + StatsLegacy + 翻译 + 最新评分的合并视图。完整 schema 见 §6.2。

**关键边界提示**：DetailProjection 内部的 `stats_legacy` 子对象**是 join 出来的视图**——它是 §5.2 文件的内容嵌入，不是 source 数据的字段。

### 5.4 Null 规则

- **数值画像 12 个子分区**——`interests` / `work_values` / `skills` / `knowledge` / `abilities` / `work_characteristics` / `work_activities` / `education_distribution` / `training_pre` / `training_post` / `experience` / `employment_type`：当该职业 IPD 没有数値画像数据时（38 条），**整段为 `null`**（而不是 dict 里所有值都 null）。投影层据此判断要不要画雷达图。
- `tasks` 为空数组 `[]` 而不是 null，表示已知无任务（IPD タスク内容の妥当性懸念フラグ=1）
- `tasks_lead_ja`：可为 `null`（当 IPD タスク_リード文 字段缺失时）
- 单字段缺失用 `null`（不省略 key）——schema 一致性优先
- `data/stats_legacy/<padded>.json` 整文件不存在：投影层检测后，DetailProjection 的 `stats_legacy` 字段填 `null`（不是空对象）

### 5.5 Classification Fields — 使用规则（v1.0.3 新增）

`classifications.mhlw_main` / `mhlw_all` / `jsoc_main` / `jsoc_all` 这 4 个字段已经进入 schema，但**它们的语义和分類映射表当前未确认**。在确认前严格按以下规则使用：

| 字段 | 例值 | 当前可用 | 当前禁用 | 解锁条件 |
|---|---|---|---|---|
| `mhlw_main` | `"12_072-06"` | raw 存储；按完全字符串相等做 dedupe / group key | UI 展示；SEO 页面生成；面包屑；筛选 | 实施时根据厚労省編職業分類表（v4 或最新）解析 `<大分類>_<中分類>-<小分類>` 格式 |
| `mhlw_all` | `["12_072-06"]` | 同上 | 同上 | 同上 |
| `jsoc_main` | `"H533"` | raw 存储；按首字母分组 | UI 展示需配合 JSOC 大分類映射表 | 加入 `data/labels/jsoc_categories.ja-en.json`（12 项 A-L）后开放 |
| `jsoc_all` | `["H533"]` | 同上 | 同上 | 同上 |

**当前安全做法**：
- import 时**按 IPD 细目原样写入**——不要解析、不要规范化
- 投影层**默认不输出**这 4 个字段到面向用户的投影（detail 不出，search 不出，treemap 不出）
- 如果某投影必须用分類，**先在本节增加映射表 + 解锁规则**

### 5.6 Pydantic Model 自动生成

`data/schema/occupation.py` 由一次性脚本 `scripts/generate_schema.py` 从 IPD 細目 sheet 自动生成：

```python
# 伪代码
for row in ipd_dictionary_sheet:
    ipd_id, name, dtype, rng = row
    if dtype == "数値":
        # range like "0.000～5.000" → Field(ge=0, le=5)
        field_def = parse_range_to_pydantic(rng)
    elif dtype == "日本語テキスト":
        # range like "10～100字程度" → Field(min_length=..., max_length=...)
        ...
```

**优点**：IPD 升 7.01 时，只需重新生成 schema，不用手敲。

---

## 6. 投影契约（9 个家族 / 10 个文件类型）

> 投影 = build_data.py 输出的 `dist/data.*` 文件。**这一节是前后端契约**。任何投影 shape 变更都必须先改本节。

### 6.0 投影总表

`dist/` 顶级共 **10 个家族**（v1.1.0 起；家族 = 一个顶级路径）。其中 `data.skills/` 家族含 2 类文件（`_index.json` + per-skill），`data.sectors`-子系统含 sectors + review_queue 两个并列文件，其余各 1 类，**总计 12 个文件类型**。

| 家族 | 子节 | Status | 消费者 | 文件数 | gzip 目标 | 实测 |
|---|---|---|---|---|---|---|
| `data.sectors.json` + `data.review_queue.json` | §6.11 | **Implemented** ✅ (v1.1.0) | mobile ②マップ／③検索 chip／④⑤ sector 标签／関連職業 候选；review_queue 仅给 ops | 2 | < 5 KB / < 50 KB | sectors **2.8 KB**, queue **0.3 KB** |
| `data.treemap.json` | §6.1 | **Implemented** ✅ (v1.0.8) + 加 sector + 多轴 bands (v1.1.0) | `index.html`（桌面首页）+ mobile ②マップ ⑦ランキング | 1 | < 120 KB | **70.0 KB** |
| `data.detail/` | §6.2 | **Implemented** ✅ + 加 sector{} 块 + 3 bands (v1.1.0) | `build_occupations.py`、`api/og.tsx`、mobile ④⑤ drill-down | 556 | < 5 KB / 个 | avg 3.5 KB |
| `data.tasks/` | §6.3 | **Future-coded** — 函数已写但默认 build 跳过；任务级 AI 评分跑完后启用 | 未来"任务级风险地图"页 | 556 | < 3 KB / 个 | avg ~1.5 KB |
| `data.search.json` | §6.4 | **Implemented** ✅ + 加 sector_id + risk_band + workforce_band (v1.1.0) | 搜索（手机 + 桌面） | 1 | < 200 KB | **29.0 KB** |
| `data.skills/` | §6.5 + §6.6 | **Future-coded** — 没有"按技能找职业"UX 之前不启用 | 未来"按技能找职业"页 | 40（39 + _index） | < 15 KB / 个 | per-skill 8.5 KB |
| `data.holland.json` | §6.7 | **Future-coded** — 没有 Holland 测评 UX 之前不启用 | 未来 Holland Code 测评页 | 1 | < 50 KB | **13.2 KB** |
| `data.featured.json` | §6.8 | **Future-coded** — 手机端 UX 定型后启用 | 手机端首屏 | 1 | < 10 KB | **2.5 KB** |
| `data.score-history/` | §6.9 | **Future-coded** — 跑过 ≥ 2 个模型后才有内容 | 未来"评分演化"页 | 552 | < 3 KB / 个 | avg ~150 B |
| `data.labels/` | §6.10 | **Implemented** ✅ | 所有前端代码渲染标签 | 2（ja + en） | < 30 KB / 个 | ja 5.0 KB, en 3.5 KB |

> **施工边界**（v1.1.0 已落地）：5 个 Planned 家族为默认 build 输出（`sectors` 是 v1.1.0 新增的第 5 个，跑在最前面以便 treemap/detail/search 引用）。5 个 Future 家族函数代码已写好，需用 `npm run build:data:full` (= `python scripts/build_data.py --enable-future`) 显式启用。当对应 UX 上线时再切默认 build 列表。

### 6.1 `data.treemap.json`

- **消费者**：`index.html`（桌面 + 移动 treemap canvas + per-tile tooltip）
- **大小目标**：< 100 KB gzipped
- **形状**：**top-level array of objects**（v1.0.8 修订；之前 v1.0.3-v1.0.7 是 cols/rows columnar 形式，但实证 index.html 需要每个 tile tooltip 的 ~15 个字段，columnar 形式不够。array-of-objects 让 treemap.json 成为 legacy `data.json` 的近似 drop-in，前端只需改 fetch URL）。
- **过滤规则**：只输出**同时**有 `stats_legacy` AND `latest_score` 的职业（典型 552 条）。4 个新 IPD 职业（581-584）二者皆无、被排除（仍在 `data.search.json` + `data.detail/` 里）。
- **legacy compat**：`education_pct` 和 `employment_type` 在投影时从 EN snake_case key + 0-1 fraction **反向转换**回日文 key + 0-100 percentage，匹配 legacy `data.json` 形状（index.html 内部 `EDU_LABELS` 等用日文 key 查表）。"わからない" 桶在 education_pct 中**故意丢弃**（match legacy 行为）。
- **每条记录字段**（共 16 个）：

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

- **取数策略**：
  - `name_en` 来自 `translations/en/<padded>.json` 的 `title_en`
  - `salary` / `workers` / `hours` / `age` / `recruit_wage` / `recruit_ratio` 来自 `stats_legacy/<padded>.json`
  - `hourly_wage`：legacy data.json 有此字段（来自另一份爬取），IPD 不携带，**v1.0.8 起一律 null**
  - `ai_risk` / `ai_rationale_*`：来自最新一次评分（按 `run_date` 取最晚）
  - `education_pct` / `employment_type`：来自 IPD `education_distribution` / `employment_type`，反向转换日文 key + percentage
  - `url`：来自 IPD source occupation

### 6.2 `data.detail/<id>.json`

- **消费者**：`build_occupations.py`（生成 ja/en HTML）、`api/og.tsx`（OG 图）、未来手机端 drill-down fetch
- **大小目标**：< 5 KB gzipped per file
- **形状**：嵌套对象，主 occupation JSON + EN 翻译合并

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
  "...": "完整字段，但只精选 top-N 维度避免 detail 太大"
}
```

- **`*_top_N` 字段排序规则**：一律按"该职业的得分降序"取前 N。当数值画像整段为 null（38 条职业）时，这些字段也为 null（不是空数组）。
- **N 的选择**：skills 取 10（信息密度最高），knowledge / abilities 取 5（避免详情页字段堆叠）。改 N 需在本节同步。

### 6.3 `data.tasks/<id>.json`

- **消费者**：未来"任务级 AI 风险地图"页面
- **大小目标**：< 3 KB gzipped per file
- **形状**：

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

- **当 AI 任务评分还未跑时**：`ai_risk` 字段为 null，但其余照常输出

### 6.4 `data.search.json`

- **消费者**：搜索页面（手机 + 桌面），可被 FlexSearch / MiniSearch 等库消费
- **大小目标**：< 200 KB gzipped
- **形状**：搜索友好的扁平索引

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

- **`category_size`**：与 §6.1 treemap 的 `category_size` 同字段——按 `stats_legacy.workers` 数值分桶（small / medium / large）。**未来如要按职业分類筛选**（厚労省編職業分類 / JSOC），需先在本节增设 `category_class` 字段并定义映射表，IPD 大分類对应表需在 `import_ipd.py` 实施时确认。
- **不含描述全文**（避免索引臃肿）。详情靠 `data.detail/<id>.json` 二次 fetch。

### 6.5 `data.skills/<skill_key>.json`

- **消费者**：未来"按技能找职业"页面
- **数量**：78 个文件（每个技能一个）
- **大小目标**：< 15 KB per file
- **形状**：按该技能得分降序排列的职业列表

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

- **消费者**：技能列表导航页
- **形状**：

```json
{
  "skills": [
    {"key": "reading", "label_ja": "読解力", "label_en": "Reading Comprehension"},
    ...
  ]
}
```

### 6.7 `data.holland.json`

- **消费者**：未来 Holland Code 兴趣测评匹配页
- **大小目标**：< 50 KB gzipped
- **形状**：列式 6 维向量

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

- **消费者**：手机端首屏（"今日推荐"或"AI 高风险职业"）
- **大小目标**：< 10 KB gzipped
- **形状**：精选 10-20 条完整 detail（避免二次 fetch）

```json
{
  "generated_at": "2026-05-03T10:00:00Z",
  "strategy": "top_ai_risk",
  "occupations": [
    { /* 完整的 detail 结构 */ }
  ]
}
```

- **挑选策略**：写在 `scripts/lib/featured_strategy.py`，可演化（今日按风险高、明日按热门浏览，等）

### 6.9 `data.score-history/<id>.json`

- **消费者**：未来"评分演化"页（"这个职业的 AI 风险随模型升级如何变化"）
- **大小目标**：< 3 KB per file
- **形状**：

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

- **消费者**：所有前端代码（渲染 skill / knowledge / ability / 工作活动 等标签）
- **大小目标**：< 30 KB each
- **形状**：扁平的 key → label 映射

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

### 6.11 `data.sectors.json` + `data.review_queue.json` + 多轴 bands（v1.1.0 新增）

> **Status**：**Implemented**（v1.1.0）。完整移动版 ② 職業マップ 行业分组、③ 検索 sector chip、④/⑤ 詳細 行业标签、関連職業 候选池、未来 ⑨ 診断 匹配池都接这一组投影。

#### 6.11.1 设计动机

mhlw_main / jsoc_main 是政府分类码，对开发者透明但**对消费者完全不可读**（`12_072-06` 没人看得懂）。设计稿要求 16 个消费者友好的"行业 sector"分组（医療・介護・事務・販売 等），但这一层在源数据里**不存在**——必须新增。

3 种历史选项被否决：
1. **手工标注 552 条**：可演化性差，每次新增职业要重标。
2. **直接用 MHLW 15 主类**：视觉极不平衡（03 类有 88 条，01 类只有 8 条），且名称不可消费。
3. **MHLW → 16 翻译表（无 override 机制）**：边界情况无处安放。

最终方案（D-014）：**双层映射 + 自动派生 + override 文件 + review_queue 反馈环**。详见决策记录。

#### 6.11.2 数据流

```
data/sectors/sectors.ja-en.json  (16 个 sector 定义 + mhlw_seed_codes)
data/sectors/overrides.json      (per-occupation 手动覆盖)
                ↓
scripts/lib/sector_resolver.py   (resolve_sector — 纯函数)
                ↓
scripts/lib/indexes.py            (build 时为每条 occ 派生 SectorAssignment)
                ↓
scripts/projections/sectors.py    → dist/data.sectors.json
                                  → dist/data.review_queue.json
scripts/projections/treemap.py    → 每 tile 加 sector_id / sector_ja / hue / 3 个 band
scripts/projections/search.py     → 每文档加 sector_id / risk_band / workforce_band
scripts/projections/detail.py     → 每记录加 sector{} 块 + 3 个 band
```

#### 6.11.3 Resolution 规则

详见 `data/schema/sector.py` docstring + `scripts/lib/sector_resolver.py`：

1. `overrides[<padded_id>]` 命中 → 用之，`provenance="override"`。
2. `occ.classifications.mhlw_main` 与某个 sector 的 `mhlw_seed_codes` glob 匹配：
   - 唯一匹配 → `provenance="auto"`。
   - 0 匹配 → `_uncategorized` + `provenance="unmatched"` + 进入 review_queue。
   - 多匹配 → 第一匹配胜出 + `provenance="auto-ambiguous"` + 候选列表入 review_queue。
3. occ 完全没有 mhlw_main → `_uncategorized` + `provenance="no-mhlw"`。

Seed glob 语法（`fnmatch`）：`"12_*"`、`"12_072*"`、`"12_072-06"`。

#### 6.11.4 投影输出

**`data.sectors.json`** — 16 sector 定义 + 聚合统计（occupation_count / mean_ai_risk / total_workforce / sample_titles_ja）。给前端做 sector chip 标签 + treemap 分组 + 详情页"同行业相邻职业"列表。

**`data.review_queue.json`** — 内部 ops 文件，summary（uncategorized / ambiguous / override_count）+ 每条问题的 `hint`（最佳近似 sector）。**不上 Vercel rewrite**——只 git track，给操作员 review。

**多轴 bands**（`scripts/lib/bands.py`）—— 3 个独立 axis，每条记录都带：

| 字段 | 来源 | 取值 | 阈值 |
|---|---|---|---|
| `risk_band` | ai_risk | `low`/`mid`/`high` | 3.9 / 6.9 |
| `workforce_band` | workers | `small`/`mid`/`large` | 2万/10万 |
| `demand_band` | recruit_ratio | `cold`/`normal`/`hot` | 1.0 / 2.0 |

阈值是 `lib/bands.py` 的常量，**不在投影代码里调**——保证 treemap / search / detail 三个投影输出的 band 永远一致。

#### 6.11.5 操作工作流

```
1. 看 dist/data.review_queue.json 的 summary
   - uncategorized > 0 → 该 mhlw 码漏在所有 sector 的 seed_codes 之外
   - ambiguous > 0     → 该 mhlw 码同时被多个 sector seed 命中

2. 决策：
   a) 漏覆盖 → 在 data/sectors/sectors.ja-en.json 给某 sector 加一条 seed
   b) 边界情况 → 在 data/sectors/overrides.json 加 {"<padded>": "<sector_id>"}
   c) sector 重新定义 → 改 data/sectors/sectors.ja-en.json 的 sector 列表

3. uv run python scripts/build_data.py
4. 再看 review_queue 直到 uncategorized + ambiguous = 0
```

CI 检查 review_queue 不为零会发 warn（不阻塞），但 D-014 要求每次 sector 文件改动后 review_queue 必须归零再 commit。

#### 6.11.6 大小预算

| 文件 | raw | gz |
|---|---|---|
| `data.sectors.json` | ~7 KB | ~3 KB |
| `data.review_queue.json` | < 1 KB（理想态空）| < 0.3 KB |
| `data.treemap.json` 增量 | +5 KB（v1.0.8 → v1.1.0）| +5 KB |
| `data.search.json` 增量 | +3 KB | +2 KB |
| `data.detail/<id>.json` 增量 | +60 bytes | +0.1 KB |

总增量：移动端首屏 + 一次详情页加载 < 8 KB gz。

---

## 7. Build Pipeline

> **整节 Status**：**Implemented**（v1.0.7 起；本节描述的 `scripts/build_data.py` orchestrator + `scripts/lib/*.py` + `scripts/projections/*.py × 9` + atomic dist swap + L1/L2/L3 校验阶梯均已落地。命令可直接执行。）

### 7.1 总流程

```
┌─────────────────────────────────────┐
│  data/  (源)                         │
│   ├ occupations/                     │
│   ├ translations/en/                 │
│   ├ scores/                          │
│   ├ stats_legacy/                    │
│   └ labels/                          │
└──────────────┬──────────────────────┘
               │
               ▼
   ┌─────────────────────────────┐
   │  scripts/build_data.py      │
   │                             │
   │  1. 加载 + Pydantic 校验     │
   │  2. 建内存索引               │
   │  3. 调用 9 个投影函数        │
   │  4. 写 dist/                 │
   └──────────────┬──────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  dist/  (投影，前端读)                │
│   ├ data.treemap.json                │
│   ├ data.detail/<id>.json × 556      │
│   ├ data.tasks/<id>.json × 556       │
│   ├ data.search.json                 │
│   ├ data.skills/<skill>.json × 39    │
│   ├ data.holland.json                │
│   ├ data.featured.json               │
│   ├ data.score-history/<id>.json     │
│   └ data.labels/{ja,en}.json         │
└─────────────────────────────────────┘
```

### 7.2 build_data.py 内部结构

```python
# scripts/build_data.py（伪代码）

def main():
    # === 1. 加载 ===
    occupations = load_all_validated("data/occupations/", Occupation)
    translations_en = load_all_validated("data/translations/en/", TranslationEN)
    score_runs = load_all_validated("data/scores/", ScoreRun)
    stats_legacy = load_all_validated("data/stats_legacy/", StatsLegacy)
    labels = load_labels("data/labels/")

    # === 2. 建索引 ===
    indexes = build_indexes(occupations, translations_en, score_runs, stats_legacy)
    # indexes 包含：
    #   occ_by_id              dict[int, Occupation]
    #   trans_by_id            dict[int, TranslationEN]
    #   stats_by_id            dict[int, StatsLegacy]
    #   history_by_occ         dict[int, list[ScoreEntry]]  按时间排序
    #   latest_score_by_occ    dict[int, ScoreEntry]
    #   runs_by_model          dict[str, list[ScoreRun]]

    # === 3. 投影 ===
    from projections import treemap, detail, tasks, search, skills, holland, featured, history, labels as labels_proj
    treemap.build(indexes, "dist/")
    detail.build(indexes, "dist/")
    tasks.build(indexes, "dist/")
    search.build(indexes, "dist/")
    skills.build(indexes, labels, "dist/")
    holland.build(indexes, "dist/")
    featured.build(indexes, "dist/")
    history.build(indexes, "dist/")
    labels_proj.build(labels, "dist/")

    # === 4. 一致性检查 ===
    run_consistency_checks(indexes, "dist/")
    # - 任何 detail 文件必须能反查到 occupation
    # - treemap 行数 == occupation 数
    # - skill index 包含所有 78 个 skill key
    # 等
```

### 7.3 共享索引 `scripts/lib/indexes.py`

```python
def build_indexes(occupations, translations_en, score_runs, stats_legacy):
    """一次性建好所有投影会用到的内存索引。
    任何投影都从 indexes 读，不重复扫描原始列表。"""

    occ_by_id = {o.id: o for o in occupations}
    trans_by_id = {t.id: t for t in translations_en}
    stats_by_id = {s.id: s for s in stats_legacy}

    history_by_occ = defaultdict(list)
    for run in score_runs:
        for occ_id_str, entry in run.scores.items():
            history_by_occ[int(occ_id_str)].append({
                "model": run.model,
                "date": run.run_date,
                "score": entry.ai_risk,
                "rationale_ja": entry.rationale_ja,
                "rationale_en": entry.rationale_en,
            })
    for oid in history_by_occ:
        history_by_occ[oid].sort(key=lambda x: x["date"])

    latest_score_by_occ = {
        oid: pick_latest_score(hist)
        for oid, hist in history_by_occ.items()
    }

    runs_by_model = defaultdict(list)
    for run in score_runs:
        runs_by_model[run.model].append(run)

    return Indexes(
        occ_by_id=occ_by_id,
        trans_by_id=trans_by_id,
        stats_by_id=stats_by_id,
        history_by_occ=history_by_occ,
        latest_score_by_occ=latest_score_by_occ,
        runs_by_model=runs_by_model,
    )
```

### 7.4 取最新评分策略

`scripts/lib/score_strategy.py`：

```python
def pick_latest_score(history: list[dict]) -> dict:
    """当前策略：按 run_date 取最晚。
    未来可能改为：按模型优先级（如 Opus > GPT > 旧 Opus）。
    任何修改都需要在本文件留 changelog。"""
    return max(history, key=lambda x: x["date"])
```

### 7.5 入口与 npm scripts

`package.json`（v1.0.7 已加入）：

```json
{
  "scripts": {
    "build:data": "uv run python scripts/build_data.py",
    "build:data:full": "uv run python scripts/build_data.py --enable-future",
    "build:data:validate": "uv run python scripts/build_data.py --validate-only",
    "build:occ": "python3 scripts/build_occupations.py",
    "build": "npm run build:data && npm run build:occ",
    "test:data": "uv run python scripts/test_data_consistency.py"
  }
}
```

部署前的标准流程：`npm run build`。CI 推荐顺序：`npm run build:data:validate && npm run build && npm run test:data`。

### 7.6 Validation & Failure Policy（v1.0.3 新增）

**所有命令在仓库根执行**。

#### 7.6.1 校验阶梯（4 层）

```
L1  Schema 校验      Pydantic model 验证每个 source JSON
                     失败 → 立即 build 失败（exit 1），打印第一个出错文件 + 字段
L2  一致性校验       cross-file 关系：id 唯一性、padding 正确性、引用完整性
                     失败 → build 失败
L3  投影 sanity       每份输出的行数 / 字段数 / 大小是否合理
                     失败 → build 失败
L4  端到端冒烟       前端能 fetch 关键投影文件
                     失败 → 部署阻断（CI gate）
```

#### 7.6.2 命令清单

| 校验 | 命令 | 退出码语义 |
|---|---|---|
| L1 + L2 | `python3 scripts/build_data.py --validate-only` | 0 = 通过；非 0 = schema 或一致性问题 |
| L1 + L2 + 全量 build | `python3 scripts/build_data.py` | 0 = 通过；非 0 = 任何阶段失败 |
| L3 | `python3 scripts/test_data_consistency.py` | 0 = 通过；非 0 = 投影 sanity 检查失败 |
| L4 | `npm run dev` 起本地 + 浏览器 fetch `/data.treemap.json`、`/data.detail/0001.json`、`/data.search.json` | 200 + 合法 JSON = 通过 |

#### 7.6.3 失败策略

- **build 失败处理**：build 脚本应**原子化**——失败时不要写半截的 `dist/`。建议方案：
  1. 写入到临时目录 `dist.next/`
  2. 全部投影成功后，原子替换 `dist/ ← dist.next/`（或先 `mv dist dist.prev && mv dist.next dist`）
  3. 失败：删 `dist.next/`，保留 `dist/` 旧版本不变
- **数据缺失处理**：
  - `data/scores/` 为空 → `latest_score_by_occ` 全为 null；treemap 的 `ai_risk` 列全 null；不阻塞 build
  - `data/stats_legacy/<padded>.json` 不存在 → DetailProjection 的 `stats_legacy` 字段为 null；不阻塞
  - `data/translations/en/<padded>.json` 不存在 → DetailProjection 的英文字段为 null；不阻塞
  - `data/occupations/<padded>.json` 不存在但其他层引用了它 → **build 失败**（数据完整性 bug）
- **schema 拼错处理**：build 失败，打印精确位置（如 `data/occupations/0042.json: 'ai_risk' should be int, got str`），不写 dist
- **警告级别**：以下情况输出警告但**不**失败：
  - 某 source 文件包含 schema 之外的额外字段（前向兼容）
  - 某 score 文件缺 `confidence` 字段（schema v1 → v2 迁移期）
  - 某职业的 IPD 数値画像整段缺失（38 条职业的预期情况）

#### 7.6.4 CI / Pre-deploy gate

`.github/workflows/`（待实施）应在 push 到 main 前跑：

```bash
python3 scripts/build_data.py --validate-only  # L1 + L2，最快
python3 scripts/build_data.py                  # 完整 build
python3 scripts/test_data_consistency.py       # L3
# L4 在 Vercel deploy preview 上自动跑
```

任何一步非 0 退出 → **阻止 merge / deploy**。

---

## 8. 升级流程

> **整节 Status**：**Implemented**（v1.0.7 起所有引用的脚本均已存在；§8.1-§8.5 的命令可直接执行。具体命令如 `python3 scripts/import_ipd.py` / `python3 scripts/build_data.py` 已通过 v0.7.0 落地验证。）

### 8.1 IPD 升新版本（7.00 → 7.01）

```
1. 下载新 xlsx 到 ~/Downloads/
2. python3 scripts/import_ipd.py --version 7.01
   ├─ 解析 細目 sheet → 重新生成 data/schema/occupation.py
   ├─ 解析 IPD形式 / 解説系 → 写入 data/occupations/<id>.json
   ├─ 报告 diff：新增 / 删除 / 字段变更的职业
3. 人工 review diff（git diff data/）
4. 处理 schema breaking change（如果有）
   ├─ 字段重命名 → 写迁移脚本
   ├─ 字段类型变化 → 修改投影代码
5. python3 scripts/build_data.py
6. 跑测试：python3 scripts/test_data_consistency.py
7. git commit + push
```

### 8.2 跑新一轮 AI 评分

```
1. 准备 prompt（已有，见 data/prompts/）
2. 跑模型 → 输出 JSON 到 data/scores/occupations_<model>_<date>.json
3. python3 scripts/build_data.py
   └─ 自动检测新 score 文件，重建 history_by_occ + latest_score_by_occ
4. git commit + push
```

**不需要删除旧 score 文件**——history 是产品内容。

### 8.3 加新翻译语种（如韩语）

```
1. mkdir data/translations/ko/
2. 跑翻译模型 → 输出 556 个文件到 data/translations/ko/
3. 在 build_data.py 加载 trans_ko = load_all_validated(...)
4. 在 detail.py 投影代码加 lang_ko 输出（或开新投影 data.detail.ko/）
5. 前端按用户语言选择 fetch
```

### 8.4 手动改一个职业

```
1. vim data/occupations/0042.json    # 改你想改的字段
2. python3 scripts/build_data.py     # 重生所有受影响投影
3. git commit + push
```

**禁止**直接编辑 `dist/` 下任何文件——会被下一次 build 覆盖。

### 8.5 跑任务级 AI 评分

```
1. 写 prompt：吃 task.description_ja + occupation 上下文 → 输出 0-10 风险
2. 遍历所有 occupation 的 tasks（约 5,000 个）→ 调用模型
3. 输出到 data/scores/tasks_<model>_<date>.json
4. python3 scripts/build_data.py
   └─ data.tasks/<id>.json 投影会自动 join 任务评分
5. 前端"任务风险地图"页面消费 data.tasks/<id>.json
```

---

## 9. 决策记录

> 重大架构选择的"why"。当未来你或别的维护者想改时，先读这里。

### D-001：选择文件型架构（架构 A）而不是 SQLite

- **日期**：2026-05-03
- **决定**：源数据用 JSON 文件，不用 SQLite
- **原因**：
  - 单人编辑（无并发冲突）
  - git review 体验最重要
  - 580 条规模 Python dict 完全够用
  - 学习成本最低
- **代价**：所有"取最新"、"按模型分组"等查询逻辑要手写（在 indexes.py 里集中维护）
- **何时回头考虑 SQLite**：投影函数 > 8 且每个都 join 复杂 / 想做职业相似度查询 / 评分文件 > 30 个 / build > 5 秒

### D-002：IPD 是唯一职业画像源 + stats_legacy 单独补丁层

- **日期**：2026-05-03
- **决定**：薪资 6 字段不混入 IPD 主结构，单独存为 `stats_legacy`
- **原因**：
  - IPD 不包含薪资数据（来自不同政府机构）
  - 物理来源不同的数据混在一起会污染"IPD 真实性"
  - 未来 stats 来源可能切换（爬 jobtag → e-Stat），单独一层切换无副作用
- **代价**：build 时需要 join 两层

### D-003：拆 occupations_full.json 为每职业一文件

- **日期**：2026-05-03
- **决定**：`data/occupations/<id>.json`（4 位补零）而不是单大文件
- **原因**：git diff、编辑器性能、AI context 友好
- **代价**：文件数从 1 → 556（macOS 完全无感）

### D-004：翻译与主源解耦

- **日期**：2026-05-03
- **决定**：英文不在 `data/occupations/<id>.json` 里，独立 `data/translations/en/<id>.json`
- **原因**：IPD 升级 vs 翻译模型升级周期不同；加新语种成本最低
- **代价**：build 时多一次 join

### D-005：score 文件按 `<scope>_<model>_<date>` 命名

- **日期**：2026-05-03
- **决定**：`scope` ∈ {`occupations`, `tasks`}；不覆盖、不删除、永久保留
- **原因**：评分历史是产品内容（"AI 视角的演化"）；scope 前缀避免职业级 / 任务级评分混淆
- **代价**：仓库累积小文件

### D-006：投影层 9 个家族 / 10 个文件类型

- **日期**：2026-05-03
- **决定**：每个消费者一个 dedicated 投影；`data.skills/` 家族含 `_index.json` + 78 个 per-skill 文件共 2 类，其余 8 个家族各 1 类，合计 10 个文件类型
- **原因**：手机端需要不同 shape；treemap 不该背负详情数据
- **代价**：build 输出文件数多；前端 fetch 路径需要新约定

### D-007：stats_legacy 从 data.json 抽，不从 occupations_full.json

- **日期**：2026-05-03
- **决定**：用现成解析好的 6 字段，不重新解析原始数组
- **原因**：那 28 条额外的 occupations_full 记录都是 `ok=False` 的空记录，零增量
- **代价**：无

### D-008：4 个 IPD 新职业一并收录

- **日期**：2026-05-03
- **决定**：581 ブロックチェーン / 582 声優 / 583 産業医 / 584 3D プリンター 全部加入
- **原因**：话题性强、SEO 价值大、内容深度好
- **代价**：这 4 条 stats_legacy 为 null，前端容错

### D-009：dist/ 入 git，不上 Vercel build server

- **日期**：2026-05-03（Phase 0 决策 0.4）
- **决定**：构建产物 `dist/` 跟随 source 一起 commit 入 git；不在 Vercel 配 Python build 环境
- **原因**：当前 Vercel 配置零变更；本地 build 后 push，部署链路最短；commit 体积可控（~5-10 MB）
- **代价**：每次数据更新会污染 commit history（diff 大）；超过 200 MB 时再考虑 M-004
- **备选**：M-004 描述了未来切换路径

### D-010：4 个新职业 stats_legacy 留 null（前端容错）

- **日期**：2026-05-03（Phase 0 决策 0.5）
- **决定**：581-584 这 4 个 IPD 新职业 stats_legacy 文件不生成，DetailProjection 的 `stats_legacy` 字段为 null；前端 UI 显示"統計データは現在準備中です"
- **原因**：这些职业在 jobtag scrape 时还不存在，无 stats 数据；上线优先级 > 等数据
- **代价**：4 条详情页 stats 区域为占位文本；可接受
- **未来动作**：JILPT 在 IPD 詳細版发布或 jobtag scrape 重跑时补齐

### D-011：migrate_*.py / import_ipd.py 一次性脚本保留在 scripts/

- **日期**：2026-05-03（Phase 0 决策）
- **决定**：所有 Phase 1 的 migrate_*.py 和 import_ipd.py 跑完不删，保留在 `scripts/` 内，注释顶部标 "one-shot, kept for reference / future re-runs"
- **原因**：import_ipd.py 在 IPD 升 7.01 时要复用；migrate_* 虽真一次性但保留有助审计/复盘
- **代价**：`scripts/` 文件数增加；未来读者可能困惑"为什么有这些脚本"——靠注释说明

### D-012：每个 Phase 一个 commit/PR

- **日期**：2026-05-03（Phase 0 决策）
- **决定**：Phase 0 / 1 / 2 / 3 / 4 各产出一个 PR，4-5 个大 PR 完成整个 IPD 切换
- **原因**：每个 PR 都对应一个完整、可独立部署的产品状态；review 颗粒度合适；万一回滚损失只一个 Phase
- **代价**：每个 PR 改动较大（一个 PR 可能 20-50 个文件）；review 需要更专心

### D-013：仅 Phase 4 末做一次 audit reviewer 复查

- **日期**：2026-05-03（Phase 0 决策）
- **决定**：Phase 0 / 1 / 2 / 3 不单独触发外部 audit；Phase 4 收尾时做一次全量 audit reviewer 复查
- **原因**：v1.0.3-v1.0.4 文档审计已经设立基准；中间过程主要是按文档执行，不需要每步审计；Phase 4 末做总检验
- **代价**：万一前面某 Phase 偏离文档，到 Phase 4 才发现可能要回工
- **缓解**：每个 Phase 内部用 §7.6 Validation 阶梯自检，本身就有质量门

### D-014：Sector taxonomy 用"自动派生 + override + review_queue"，不手工标注 552 条

- **日期**：2026-05-04（v1.1.0 mobile pivot）
- **背景**：移动版 ② 職業マップ 设计要求 16 个消费者友好的行业分组，但源数据只有 MHLW 政府分类码（不可读 + 分布不均）和 JSOC 字母码（同问题）。
- **被否决的备选**：
  - **A：手工标注 552 条** —— 无法演化，每次新增职业必须重标。
  - **B：直接用 MHLW 15 主类** —— 名称不可消费（`12_072-06`），分布严重不均（03 类 88 条、01 类 8 条）。
  - **C：MHLW → 16 翻译表** —— 没有边界情况处理机制，`12_080-*` 这种 sub-bucket 内同时含创意 / 制造 / IT 时无解。
- **决定**：双层映射 + 自动派生 + override 文件 + review_queue 反馈环（详见 §6.11）。
  - 主映射：`data/sectors/sectors.ja-en.json` 定义 16 sector + 每 sector 的 `mhlw_seed_codes` glob 列表。
  - 边界处理：`data/sectors/overrides.json` 一对一覆盖（padded_id → sector_id）。
  - 自动反馈：每次 build 输出 `dist/data.review_queue.json`，操作员看到后回头编辑上面两个文件直到清零。
- **原因**：
  - source 数据洁净度——`data/occupations/<id>.json` 一行不改，sector 派生发生在 projection 层，跟现有架构 100% 一致。
  - 每条派生带 `provenance`（override / auto / auto-ambiguous / unmatched / no-mhlw）——可审计。
  - 加新职业自动派生，遇歧义入队等仲裁——可演化。
  - 只 ~5 天工作量（vs 选项 A 的 ~10-15 天），但同时解锁多轴 bands、关联职业推荐、faceted search 等"未来能力"。
- **代价**：
  - 多了一层抽象（resolver + projection + override 文件）。
  - 操作员要养成定期 review queue 的习惯。
  - 16 sector 数量是判断，不是数据驱动——可能未来发现 14 或 18 更合适，要重定义。
- **首轮结果**：556 条职业 100% 自动派生（3 条用 override），16 sector 分布范围 14-63 条，0 uncategorized / 0 ambiguous。
- **依据文档**：§6.11

---

## 10. 未来迁移路径

> 当下不实现，但留好接口。

### M-001：从架构 A 升 C（加 SQLite 中间层）

- **触发条件**：投影超过 12 份；想做 N×N 相似度查询；想给前端开"任意切片 API"
- **动作**：保留全部 `data/` 不变，仅改 `build_data.py`：把"加载 + 索引"段换成"加载 + 灌内存 SQLite"，所有投影函数从 dict 操作改 SQL 查询
- **可逆**：随时可以退回纯 dict 版

### M-002：开启 KV 写回通道

- **触发条件**：想要用户收藏 / 评分 / 留言
- **动作**：加 Vercel KV 或 Upstash Redis；新增 `api/feedback-store.js`、`api/favorites.js`；前端读混合（静态 + KV）
- **不影响**：当前所有静态投影

### M-003：用 e-Stat 賃金構造基本統計調査 替代 stats_legacy

- **触发条件**：jobtag 改版导致旧 stats 失效，且 JILPT 仍未把这部分纳入 IPD
- **动作**：写新 importer `scripts/import_estat.py`，输出到 `data/stats_official/<id>.json`；build 优先读 stats_official，回退 stats_legacy
- **不影响**：投影 schema 不变（来源标签从 `jobtag_scrape` → `estat_official`）

### M-004：把 dist/ 移出 git，改成 Vercel build 时生成

- **触发条件**：dist 体积超过 200 MB；或想避免每次数据更新都污染 commit history
- **动作**：在 Vercel 配置 Python build 环境；`vercel.json` 加 `buildCommand: "npm run build"`；dist/ 进 .gitignore
- **代价**：build server 依赖（更脆弱）

### M-005：开启詳細版 IPD 数据

- **触发条件**：JILPT 发布 v7.x 詳細版（含样本量、置信区间等统计元信息）
- **动作**：新加 importer，将这些元信息以 `data/occupations/<id>.json` 同级的 `data/occupations_meta/<id>.json` 形式存储；前端可选展示

---

## 11. 修订历史

> 紧缩格式：每条仅写"做了什么"。设计理由 / 反思见**附录 A**。

- **v1.0** — 2026-05-03 — 初稿。
- **v1.0.1** — 2026-05-03 — 修正 §3.2 数字 514/38 → 518/34；统一 score 命名加 `occupations_` 前缀；§5.1 补全 12 子分区。
- **v1.0.2** — 2026-05-03 — 状态行版本同步；§2.3 合并冗余小节；§3.1 术语统一；§5.1 措辞改正；回滚 v1.0.1 凭空 `mhlw_categories`；统一 `category_size`。
- **v1.0.3** — 2026-05-03 — 重大补强。新增 Document Status 矩阵（§0.1）+ Prerequisites（§0.2）；§2 全部数据源加 Provenance；§2.3 加 ScoreRun 完整 schema；新增 §3A "ID and Path Rules"；§5 拆为 SourceOccupation / StatsLegacy / DetailProjection 三套 schema 并新增 §5.5 Classification Fields 使用规则；§6 改为"9 家族 / 10 文件"+ 总表加 Status 列；§6.1 边界改严格区间符号；新增 §7.6 Validation & Failure Policy（4 层校验阶梯 + 失败策略 + CI gate）；§11 紧缩；新增附录 A。
- **v1.0.4** — 2026-05-03 — 复核精修。修正 v1.0.3 头部权威关系写反（已落地范围应代码为准而非文档为准）；D-006 标题"9 份 JSON" → "9 家族 / 10 文件类型"；§2.1 / §2.2 license_terms 全改为"待确认"（不预设官方条款结论）；§7 / §8 各加整节级 Status 标注；§0.1 第 23 行说明流程章节用整节级 Status。
- **v1.0.5** — 2026-05-03 — Phase 0 落地。§2.1 IPD 数据溯源全部确认（直接下载 URL × 2、发布日 2026-03-17、数据基准日 2026-02-10/02-26、license 二次利用 OK 含规定 attribution 格式、tos URL）；§9 新增 D-009 至 D-013 五条 Phase 0 决策（dist 入 git / 4 新职业 stats null / migrate 脚本保留 / 单 PR 颗粒度 / 仅 Phase 4 audit）。pyproject.toml 加 openpyxl + pydantic 依赖。
- **v1.0.6** — 2026-05-04 — Phase 1 部分落地（1B/1D/1E/1F/1C 完成）。修正 §2.1 / §2.5 的 skills 78 → 39、knowledge 66 → 33（原值错误地包含了 `_無関係フラグ` 子节）。Pydantic schemas 写好（occupation / stats_legacy / score_run / translation / labels）；3 个 migration 脚本跑通（552 stats_legacy 文件 / 552 translation 文件 / 1 ScoreRun v2.0 文件）；7 个 labels 文件生成（204 labels 总）。
- **v1.0.7** — 2026-05-04 — Phase 1 全完 + Phase 2 全完。`scripts/import_ipd.py` 跑通 → 556 source occupation 文件。完整构建管道落地：`scripts/lib/{indexes,score_strategy,atomic_write}.py` + `scripts/projections/*.py × 9` + `scripts/build_data.py` orchestrator（含 --validate-only / --enable-future / atomic dist swap）+ 重写 `scripts/test_data_consistency.py` 跑 L3 sanity。`package.json` 加 4 个 npm scripts。`.gitignore` 改：`dist/` 入 git（D-009），仅 `dist.next/` `dist.prev/` 排除。§6.0 投影总表 4 个 Planned 家族升 Implemented + 实测 size 全部符合目标。
- **v1.0.8** — 2026-05-04 — Phase 3 全完（前端切到新投影）。§6.1 treemap 形状从 columnar 改为 array-of-objects + 16 字段（含 legacy JA-key 反向转换的 `education_pct` / `employment_type`）— 让 `data.treemap.json` 成为 legacy `data.json` 的 drop-in。`index.html` 5 处 `data.json` 引用 → `data.treemap.json`（preload / fetch / JSON-LD / FAQ / 错误信息）。`scripts/build_occupations.py` 加 `_load_legacy_shape_corpus()` 适配器，从 `dist/data.detail/<id>.json × 556` 读取——render 层 ~900 行零修改；输出 1112 页（556 JA + 556 EN，含 4 新 IPD）。`api/og.tsx` 从全集 fetch 改成单条 `/data.detail/<padded>.json` fetch。`vercel.json` 加 4 条 rewrite + cache headers；`scripts/dev-server.py` 镜像同样规则；本地端到端冒烟全绿（GA4 `map_loaded` event 552 tiles 触发）。§0.1 已落地范围全部升 Implemented。
- **v1.0.9** — 2026-05-04 — Phase 4 全完（收尾）。归档 `data.json` + `data/occupations_full.json` + `data/occupations.json` + `data/ai_scores_2026-04-25.json` + `data/translations_2026-04-25.json` 到 `data/.archive/v0.6/`（含 README 解释每个文件的用途和替换关系）。删 `scripts/build_data_legacy.py.bak` + `scripts/.normalization_warnings.json`。`vercel.json` 加 `/data.json → /data.treemap.json` 301 redirect（向后兼容外部链接）。更新 9 处外部引用：`scripts/make_prompt.py` INPUT 切到 dist；`llms.txt` / `llms-full.txt` 多处 URL + 描述；`analytics/spec.yaml` 字段来源说明；`README.md` / `README.ja.md` 数据流程表 + 文件树。`CHANGELOG.md` 加 v0.7.0 entry，`package.json` bump 0.6.0 → 0.7.0。`.github/workflows/data-validation.yml` CI gate 跑 L1+L2+L3 + dist 漂移检测。本地端到端冒烟全绿（/data.json 本地 404 = 正常，Vercel 301）。§0.1 状态升为 "Phase 1-4 全部完成"。
- **v1.0.10** — 2026-05-04 — 外部 audit reviewer 复查（D-013）+ 修。Audit verdict: **PASS-WITH-WARNINGS**（0 P0、3 P1、4 P2、1 P3）。修了所有 9 项：A-001 (6 处 `Status: Planned` → `Implemented` 在 §2.1 / §2.2 / §2.4 / §2.5 / §7 / §8 整节标注)；A-002 (test_data_consistency 错误信息 `treemap rows` → `total source occupations`)；A-003 (生成实际 `data/.stats_legacy_provenance.json` + 3 个 migrate 脚本 SOURCE 路径同步切到 `data/.archive/v0.6/`)；B-001 (README × 2 删除残留 `score_ai_risk.py` / `scores.json` 引用 + 文件树重写)；B-002 (`llms.txt` / `llms-full.txt` 顶部 552 → "556 (552 scored, 4 await scoring)")；B-003 (§7.2 pipeline 图 `× 78` → `× 39`)；B-004 (§0.2 deps Status `Planned` → `Implemented`)；C-001 (dev-server.py 加 `/data.json` → 301 → `/data.treemap.json`)。
- **v1.1.0** — 2026-05-04 — Mobile pivot · sector 子系统落地。新增 §6.11（sector taxonomy + 多轴 bands）+ D-014（决策记录）。新文件：`data/schema/sector.py`（Pydantic）、`data/sectors/sectors.ja-en.json`（16 sector 定义 + MHLW seed_codes）、`data/sectors/overrides.json`（per-occupation 覆盖 × 3）、`scripts/lib/sector_resolver.py`（resolve_sector 纯函数 + validate_sector_definitions）、`scripts/lib/bands.py`（risk / workforce / demand 三 axis 阈值常量）、`scripts/projections/sectors.py`（输出 data.sectors.json + data.review_queue.json）、`scripts/test_sector_subsystem.py`（24 unit tests）。修改：`scripts/lib/indexes.py` 加 sectors / sector_overrides / sector_by_occ 三个 index；`scripts/projections/treemap.py` 加 sector_id / sector_ja / hue / risk_band / workforce_band / demand_band 6 字段；`scripts/projections/search.py` 加 sector_id / risk_band / workforce_band 3 字段（schema 升 1.1）；`scripts/projections/detail.py` 加 sector{} 块 + 3 个 band（schema 升 1.1）；`scripts/build_data.py` 把 sectors 加入 PLANNED（首位执行）+ L3 sanity；`scripts/test_data_consistency.py` 加 check_sectors / check_review_queue / check_treemap_v110；`vercel.json` 加 `/data.sectors.json` rewrite + cache header；`scripts/dev-server.py` 镜像。**首轮结果**：556 occupation 100% 自动派生（3 条 override），16 sector 分布 14-63 条，0 uncategorized / 0 ambiguous。Size 增量：treemap +5 KB gz / search +2 KB gz / detail +0.1 KB per file。所有 24 unit tests + 全部 L3 sanity checks 通过。

---

## 附录 A — 变更背景（设计理由）

> v1.0.1 起每次重大修订的"为什么"。changelog 只写"做了什么"，背景查这里。

### A.1 v1.0.1 背景

- **§3.2 数字 514/38 → 518/34**：原数字把 "IPD_desc - IPD_num = 38"（含 4 个新职业）误当成"旧 + 仅 IPD 解説"。正确分解：旧 IPD 双全 518 + 旧 仅解説 34 + 新增 4 = 556。
- **score 命名加前缀**：原 `<model>_<date>` 命名无法区分职业级 / 任务级评分。加 `<scope>_` 前缀避免歧义。
- **§5.1 12 子分区**：之前只列 6 个（interests/skills/knowledge/abilities/work_characteristics/work_activities），漏了 work_values + 4 个 distribution + employment_type，共 12 个。规则统一适用。

### A.2 v1.0.2 背景

- **回滚 `mhlw_categories.ja-en.json`**：v1.0.1 引入了 `category_code: "12"` / `category_ja: "製造職"`。但豆腐製造 mhlw_main `12_072-06` 的 "12" 究竟是大分類还是中分類，需查厚労省編職業分類官方表，未确认。**且这是 audit 过程中我自行加入的设计，未与用户讨论**。原则违反：决策记录是用户决定，文档不应替用户决定。回滚到 `category_size`（与 §6.1 一致，只用 workers 数量分桶）。
- **`category` → `category_size`**：原 §6.1 用 `category`，§6.4 用 `category_size`，命名不一致。统一为 `category_size`。例值 id=1 workers=1.2M 原写 "small"，但按规则应是 "large"，例值错误。

### A.3 v1.0.3 背景

外部审计指出 12 项问题（DOC-DA-001 到 DOC-DA-012）。本次全部回应：

- **DOC-DA-001 (P0) 定位冲突**：原文档同时声称"唯一真相源"和"草案待落地"。新版引入 Document Status 矩阵（§0.1）明确"已落地范围"vs"目标范围"，绝对表述改为有边界。
- **DOC-DA-002 (P1) 当前未来混杂**：§6 总表加 Status 列；每个家族标 Implemented / Planned / Future。明确 v1.0.3 落地只必做 4 个 Planned 家族。
- **DOC-DA-003 (P1) 9 vs 10 数量歧义**：§6 标题改"9 个家族 / 10 个文件"，总表里写明 `data.skills/` 含 2 类文件。
- **DOC-DA-004 (P1) stats_legacy 边界乱**：§5 schema 拆为三套——SourceOccupationSchema 移除 stats_legacy，StatsLegacySchema 独立成节，DetailProjectionSchema 才是 join 视图。架构原则恢复。
- **DOC-DA-005 (P1) 分類字段语义未定**：§5.5 新增 Classification Fields 使用规则——分類字段当前**只允许**raw 存储 + dedupe，**禁止** UI / SEO / 筛选用途，直到映射表确认。
- **DOC-DA-006 (P2) 路径规则散乱**：新增 §3A ID and Path Rules，集中定义 5 类 ID（canonical / source 文件名 / projection 文件名 / URL / display），10 类路径模板。
- **DOC-DA-007 (P2) 边界条件**：§6.1 `category_size` 改严格区间符号 `[0, 100K) / [100K, 1M] / (1M, ∞)`，明示边界值归属。
- **DOC-DA-008 (P2) 验证策略不足**：新增 §7.6 Validation & Failure Policy——4 层校验阶梯（Schema / 一致性 / 投影 sanity / 端到端冒烟）、命令清单、退出码语义、原子化 build 策略、CI gate 描述。
- **DOC-DA-009 (P2) 前置条件缺失**：§0.2 Prerequisites 表覆盖 Python / 包管理 / 现有依赖 / 待加依赖 / Node / 运行目录。
- **DOC-DA-010 (P2) AI score 复现性**：§2.3.1 新增 ScoreRun 完整 schema，含 model / provider / temperature / prompt_version / prompt_sha256 / input_data_version / input_data_sha256 / run_id 等审计元数据。
- **DOC-DA-011 (P2) 数据溯源缺失**：§2.1 / §2.2 / §2.4 / §2.5 各加 Provenance 表（source_url / publisher / retrieved_at / sha256 / license_terms / attribution）。
- **DOC-DA-012 (P3) changelog 过密**：§11 紧缩到每条 1-2 行，背景全部下沉到本附录 A。

**未做**：审计 §4 提议的"14 节大重构"。判断：当前 11 节骨架清晰，硬伤是内容问题不是结构问题，重构会引入认知成本而无产品价值。补内容、不动骨架。

### A.4 v1.0.4 背景

外部审计第二轮指出 v1.0.3 残留 4 项问题（R-001 到 R-004）。本次全部回应：

- **R-001 (P0) 头部权威关系写反**：v1.0.3 第 4 行写"已落地范围内：本文档与代码冲突时以本文档为准"，与 §0.1 "已落地范围 | 仍以现实代码为准"直接冲突——这是把 audit 修复时本意"已落地代码是事实，文档只是描述"误写成相反意思。重写头部明确三类范围（已落地 / 目标 / 未来）的权威关系：已落地以代码为准、目标以文档为准、未来不约束。
- **R-002 (P1) D-006 标题落版**：D-006 标题升级时漏改"9 份 JSON" → "9 家族 / 10 文件类型"。补全 + 在决定理由里说明数量结构。
- **R-003 (P1) license 误作事实写**：v1.0.3 §2.1 / §2.2 把 license_terms 写成 "出典明示で二次利用可"——但报告里同时承认未核对 JILPT 官方页面。这是把"假设"误当"结论"。两处全改"待确认"+ 实施前必须核对官方页面 + 在确认前不得作为法律结论。
- **R-004 (P2) Status 承诺过宽**：v1.0.3 §0.1 第 23 行说"每个数据源、每份投影、每个流程都标有 Status"，但 §7 Build Pipeline 和 §8 升级流程的子节实际都没标。两条修复：(a) 收窄第 23 行措辞为"数据源 + 投影标 Status；流程章节用整节级 Status"；(b) 在 §7 / §8 起首各加整节 Status 标注（均为 Planned）。

### A.5 v1.0.6 + v1.0.7 背景（Phase 1 + Phase 2 落地）

**v1.0.6 (Phase 1 中段)**：
- 数错的发现：原 §2.1 / §2.5 写 skills=78、knowledge=66；实际 IPD 細目 sheet 这两个 中領域 下存在两套字段——score 字段（`IPD_04_03_01_*` 39 个 / `IPD_04_04_01_*` 33 个）+ 平行的 `_無関係フラグ` 字段。原 doc 把两者总数当成 score 数量。修正后真实总 labels = 6 + 11 + 39 + 33 + 35 + 39 + 41 = **204**。这个错误暴露在 build_labels.py 第一次运行时（"missing EN translation for `_無関係フラグ`"）。预防：未来读 IPD 任何字段时按 IPD-ID prefix 严格过滤，不依赖 中領域 substring 匹配。
- 5 个 migration 脚本一次跑通无 retry，得益于 Pydantic 严格校验在 source data 端。
- 翻译策略：278 个 EN 标签由 Claude 一次性生成（O*NET-aligned 优先，literal 次之），全部标 `draft v0.1`，待未来人工 + O*NET 28.x 交叉验证。

**v1.0.7 (Phase 1 末 + 全部 Phase 2)**：
- import_ipd.py 第一次跑生成的 occupation 文件 tasks 数为 0 — 暴露的问题：task IPD-ID 格式假设错（`IPD_05_<NN>_001` vs 实际 `IPD_05_<NN>_01`）。修正后 17 个 task / 豆腐製造，全集 7501 个 task。预防：编写 IPD 导入逻辑前必须先 dump 实际 sheet 头部一次。
- atomic dist swap 设计（`AtomicDist` 上下文管理器）保证 build 中途失败时 dist/ 不被破坏。手动测过失败路径：dist.next/ 自动清理，dist/ 不动。
- L3 sanity 在 build_data.py 末尾自动跑，独立 `test_data_consistency.py` 提供 CI 入口。两者校验逻辑同源（应共享，未来可重构为 lib/sanity.py）。
- 投影实测 size 全部低于 §6.0 目标的一半以下——意味着将来加内容（如更多 detail 字段、aliases_en 等）有充足余量。
- 手动决策：search.json 的 `category_size` 沿用 treemap 同字段，**避免 v1.0.1-v1.0.2 那种"凭空引入新字段"反复**。未来加 `category_class` 必须先在 §6.4 增设。

### A.6 v1.0.8 背景（Phase 3：前端切换）

**关键发现 / 决策**：
- treemap.json 形状重新设计：原 v1.0.3 的 columnar (cols/rows) **不够**——index.html 的 per-tile tooltip 需要 ~15 个字段（含 `education_pct` / `employment_type` 这种嵌套对象），columnar 形式塞这些很丑。改为 array-of-objects 后，文件大小从原 15.7 KB gz 涨到 ~80 KB gz——仍远低于 100 KB 目标。
- legacy JA-key 反向转换：原 IPD source 用 `below_high_school: 0.074` 形式；index.html 用 `"高卒未満": 7.4` 形式。投影时反向转换，让 frontend 内部 ~900 行零改动。这是"不为完美打破现状"的妥协，但保住了 Phase 3 视觉零回归。
- 4 个新职业的 frontend 兼容：581-584 在 treemap 里被过滤掉（缺 stats + ai_risk），但 detail 页正常生成——展示为 "AI Impact —" + "data unavailable"。这是 D-010 的兑现。
- vercel.json rewrites：projections 物理上在 `dist/`，URL 上服务在 `/data.treemap.json` 等。加了 4 条 rewrite + dev-server.py 镜像。
- build_occupations.py 适配策略选择 B（compat loader）而不是改 render：~900 行 render_html / pick_related 全部保留，只在入口加 50 行 `_load_legacy_shape_corpus()`。修改 surface 最小、回归风险最低。
- 本地冒烟通过的关键证据：preview 浏览器加载 index.html 后 GA4 自动 fire `map_loaded` 事件 with `tile_count=552`——意味着 treemap.json fetch + parse + 渲染全部成功。截图视觉与 v0.6.x 生产无差异。

### A.7 v1.0.9 背景（Phase 4：收尾）

**关键决策 / 操作**：
- 老源文件**归档而非删除**：`data/.archive/v0.6/` 保留所有 5 个老 source files + 一份解释 README。git mv 保留历史 blame；未来回归 v0.6.x 任何 deploy 都可复现。这是 D-007 / D-011 思路的延伸：保守优先于精简。
- `/data.json` 加 301 redirect 而不是 410：外部生态（搜索引擎索引、社交分享旧链接、第三方 mirror、prompt.ja.md 历史用户）平稳过渡到 `/data.treemap.json`。后者 schema 是 v0.6 data.json 的近似 drop-in（同字段名 + JA-key distributions），所以即使老脚本 fetch 也能继续工作。
- CI gate 加 dist 漂移检测：committed `dist/` must equal what `npm run build:data` would produce now。catches 两种 bug：(a) 改了 source 但忘记 rebuild + commit dist（部署到生产时数据陈旧）；(b) 投影函数有 nondeterminism（不同机器 build 出不同结果）。这是 D-009（dist 入 git）的必要保险。
- README 双语同步：`README.md` 和 `README.ja.md` 数据流程表 + 文件树**手动同步**改了。两份不容易保持一致，但用户读哪边都能看到正确的 v0.7 架构。
- `scripts/make_prompt.py` 的 INPUT 切到 `dist/data.treemap.json`：因为 schema 兼容（同 16 字段同名），这个 LLM scoring 脚本无需改其他逻辑就能跑。意外副作用：**未来跑新模型评分**时直接用 dist 即可，不用回头读老文件。
- 没有 audit reviewer 的 review：D-013 决定仅 Phase 4 末做一次 audit。本次 review 由用户 / 协作者外部审计完成（如同 v1.0.3 → v1.0.4 那次外部审计模式）。本文档 v1.0.9 + 实代码 + dist + git diff 是 audit 的输入。

### A.8 v1.1.0 背景（Mobile pivot · sector 子系统）

**触发场景**：移动版 UIUX 重做。设计稿（10 屏 mobile-web）的 ② 職業マップ 要求 16 个消费者友好的"行业 sector"分组，但 source 数据只有 MHLW 政府分类码（`12_072-06` 这种）。需要回答两个相关问题：
1. 为了支持移动版，要不要建数据库？（结论：完全不需要——现有 9-projection 文件型架构已经远超需求）
2. 16 个 sector 怎么落地？（决策详见 D-014）

**关键决策 / 操作**：
- **不污染 source 层**：`data/occupations/<id>.json` 一行不改。新加的 `data/sectors/` 是独立目录，sector 派生发生在 `scripts/lib/indexes.py` 加载时（per-occ resolve），**不修改源数据**。理由跟 D-002（IPD 是唯一职业画像源）一致——任何"派生"放在 build 层，source 永远是单一事实。
- **Resolver 是纯函数**：`scripts/lib/sector_resolver.py` 不读文件、不写状态——拿 sectors + overrides + occ_id + mhlw_main，返回 SectorAssignment。这让它可以在任何上下文复用（projection / 测试 / 未来的 CLI 工具），且测试只需要内存 fixture。
- **多轴 bands 抽出独立 lib**：`scripts/lib/bands.py` 三个 axis（risk / workforce / demand）只是阈值常量 + 三个纯函数。treemap、search、detail 三个 projection 都 import，**保证 band 取值在三处永远一致**。如果未来要调阈值（例如把"hot"从 >2.0 调到 >1.8），改一处即可。
- **review_queue 是反馈环，不是失败信号**：build 时输出 `dist/data.review_queue.json` 给操作员看（uncategorized / ambiguous 列表 + hint）。CI 不阻塞，但操作员必须把它清零再 commit。这把"分类正确性"从"开发问题"变成"持续运维问题"——更可演化。
- **首轮就达到 100% 自动派生**：556 条职业全部分类，3 条用 override（12_080-* sub-bucket 内同时含 IT/建設/maint 的混合情况）。0 uncategorized / 0 ambiguous。说明 16 sector + seed_codes 设计基本对位 MHLW 实际分布。
- **Sector hue 是 fallback，不是真色**：每 sector 定义里有 `hue: 'safe'|'mid'|'warm'|'risk'`——但前端真正画 treemap 时颜色还是来自 ai_risk。hue 只在"sector 标签 chip 默认背景色"这种"没有具体职业上下文"的地方做缺省。这避免了"sector hue 跟某条 outlier 职业的 risk 冲突"的视觉混乱。
- **没新增数据库**：用户原本担心"为了支持新功能，是不是要建数据库"。审计现有 `dist/` 后发现 4 个 Planned projection 已经覆盖所有移动端的 fetch 需求（treemap 65 KB / search 27 KB / detail 3.4 KB per file / labels 5 KB），加上本次 v1.1.0 的 sectors（3 KB）+ 三个 band 字段，全栈数据需求 < 100 KB gz 首屏。SQLite / Postgres / 任何运行时数据库都是过度设计。这印证了 D-001（选择文件型架构而不是 SQLite）的判断在 v1.1.0 仍然成立。
- **没新增 SPA**：跟数据库决策同源——既然 552 条只读、按 id 已切片、CDN 友好，移动版应该走"静态多页 + 局部岛屿"，不走 SPA。这次 v1.1.0 只动数据层；HTML/JS 那一层（手机版 ① ホーム / ② 職業マップ / 等）下个版本再做。
- **下一步留给 v1.1.1+**：移动端 HTML/CSS/JS 实现（含 ② 職業マップ 用 sector_id 分组渲染、③ 検索 用 sector chip 筛选、④/⑤ 詳細 显示 sector 标签 + 同 sector 関連職業 等）。这一层不动数据架构，纯前端工作。
