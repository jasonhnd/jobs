# SCORING_RUNBOOK — AI リスク 再採点 运维手册

> **用途**:每次用新模型(Opus 4.7 → 4.8 → 4.9 → 5.0 …)或调整 rubric 时,按此手册重新跑全职业的 AI 风险评分。
> **状态**:**定稿 v1(2026-05-29)**。A 类决策见 [§8](#8-决策记录已定-2026-05-29);小数 rubric 见 [附录 B](#附录-b小数-rubric评分标准细化-a2);组装器实现见 [附录 C](#附录-c组装器实现细节)。
> **语言说明**:本文用中文便于 maintainer review;`docs/` 其余文档为日文,如需统一可转换。
> **关联**:[DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md)、[WORKFLOW.md](./WORKFLOW.md)、`src/data/schema/score-run.ts`。

---

## 0. 数据存在哪("数据库"说明)

**本项目没有数据库,也没有任何外部同步目标。** 评分真源是 Git 里的 JSON 文件:

- `data/scores/<scope>_<model>_<date>.json` —— **append-only**:每跑一次 = 一个新文件,**绝不覆盖/删除旧文件**(rationale 翻译补全例外,见 §8 A3)。
- `bun run build` 读取所有批次 → 内存建知识图 → 重算全部投影 JSON(`public/data.treemap.json` / `data.detail/*.json` / `data.search.json`)+ 822 静态页。

> **"同步数据库" = `bun run build` + 部署。** 没有独立 DB 写入、没有迁移、没有外部系统要推送。Git 历史 = 审计 / diff / 一键回滚。

每个职业"当前生效"的分,由 `src/graph/score-strategy.ts` 的 `pickLatestScore` 决定:**逐职业取 `run_date` 最新的批次**(同日则后加载者胜 —— 故应避免同日多批)。

> **范围**:本手册只覆盖 `scope: "occupations"`。schema 另支持 `scope: "tasks"`,不在范围内。

---

## 1. 评分格式(一位小数,schema v2.1)

- `ai_risk`:`0.0`–`10.0`,**小数点后一位**(例 `6.9`、`9.5`)。
- `rationale_ja`:必填(日文)。`rationale_en`:本批写**空串 `""`**(`z.string()` 已允许;先日文、英文后补,§8 A3)。
- `confidence`:`0–1`,**本流程要求填**(§8 A4)。
- `schema_version: "2.1"`。旧整数批次(`2.0`)兼容并保留(`7` == `7.0`)。`schema_version` 只是文档标签,代码不按它分支。
- 文件名:`data/scores/occupations_<model-slug>_<YYYY-MM-DD>.json`。
- **风险分档(全项目统一,半开区间,小数安全)**:`[0, 4.0)` = `low`、`[4.0, 7.0)` = `mid`、`[7.0, 10]` = `high`(即 `< 4.0` / `< 7.0` / else)。
  > ⚠️ 现有 `src/data/lib/bands.ts` 用 `≤3.9`/`≤6.9`(整数时代写法),小数下会把 `3.95` 判 mid、`6.95` 判 high;须统一为上述半开区间 —— **对所有整数分数无变化,仅修正小数行为**。详见附录 A。
- **两种配色并存**:① 离散 3 档 `low/mid/high` 仍驱动 risk-pill、treemap 三色、设计 token(sage/sand/terracotta)—— **不会消失**;② **仅职业页 RiskCard 的分数数字**改为按确切分数**连续渐变**(绿→琥珀→红)。

---

## 2. 标准流程(每次重评)

1. **准备 rubric + prompt 快照**:prompt 文档采用**历史快照**制(§8 A1)。本次需用 [附录 B](#附录-b小数-rubric评分标准细化-a2) 的小数 rubric;为本次运行建带日期快照 `data/prompts/<date>_<model>.ja.md`,批次 `prompt_file` 指向它。
2. **(仅首次)确认小数支持已就位** —— 见 [附录 A](#附录-a一次性小数支持改造仅首次)。
3. **跑评分**:用 Opus X 对 **556 个职业**(含现缺 581–584)评分,每职业产出 `ai_risk`(一位小数)+ `rationale_ja`(仅日文)+ `confidence`(0–1);`rationale_en` 留空。**一次一个完整批次**,勿同日拆多文件。
4. **组装** → `bun run assemble:scores …`(见 [附录 C](#附录-c组装器实现细节))。
5. **预检** → `bun run check:score-batch <文件>`(schema / 覆盖率 / run_date / 小数粒度 / 漂移;空 `rationale_en` 仅提示)。
6. **构建("同步数据库")** → `bun run build`。
7. **门禁 + 测试** → `bun run verify:gates` 然后 `bun test src`(目标 946 全绿)。SEO baseline 纯重评不改 URL,无需 capture。
8. **重建后重点检查** → 见 [§2.1](#21-重建后重点检查spot-check)。
9. **预览验证** → `git push origin preview` → `vercel inspect <部署URL>` 确认 `● Ready`。
10. **上生产**(你决定) → 合并 `preview` → `main`。
11. **(异步)英文理由补全**:之后把 `rationale_en` 翻译补进同一批次文件(只增译文、不改分数),再 build/部署。

---

## 2.1 重建后重点检查(spot-check)

- **rankings 排序**(`/ja/rankings/*`)、**treemap 配色** + 首页/`/map` 可视化。
- **各职业页 RiskCard**:`6.9/10` 显示 + 连续渐变色。
- **same-risk 邻居**(`/ja/me`、detail):±1 风险窗会变。
- **OG 卡**:动态 Edge 自动反映,但社媒/CDN 缓存可能滞后,需要时手动重抓。
- **JSON-LD**:各职业页 AI 风险值更新(浮点合法)。

---

## 3. 组装器 `assemble:scores`(用法概览)

把原始评分结果拼成符合 `ScoreRunSchema` 的合法批次文件并校验。**每次升级复用**。命令:
```
bun run assemble:scores \
  --model claude-opus-4-8 --date 2026-06-01 --prompt-version 2.0 \
  --in raw-scores.jsonl \
  --out data/scores/occupations_claude-opus-4-8_2026-06-01.json
```
输入格式 = **JSONL**(每行一个职业)。实现细节(算法/参数/校验/测试)见 [附录 C](#附录-c组装器实现细节)。

---

## 4. 元数据填写规约

| 块 | 字段 | 怎么填 |
|---|---|---|
| `scorer` | model / model_provider / model_temperature / scoring_method | `claude-opus-4-8` / `anthropic` / `null` / `"single-pass per occupation"` |
| `run` | run_date / run_id / duration_minutes / operator | `YYYY-MM-DD` / `occ_2026-06-01_v1` / 可空 / 你的标识 |
| `input` | input_data_version / input_data_sha256 / count_scored / count_skipped | 评的是哪版职业数据:版本串 + 哈希(组装器算)+ 计数 |
| `prompt` | prompt_version / prompt_file / prompt_sha256 / rubric_source | 版本号 + 指向本次快照 + 哈希 + rubric 出处 |
| `anchors` / `caveat` | 档位说明(含小数子位)+ 注意声明 | 随细化 rubric 更新 |

---

## 5. 回滚

删掉新批次文件 → `bun run build` → `pickLatestScore` 自动取回次新 `run_date`。部分纠正用"更新 run_date 的修正批次"。

---

## 6. 验收清单

- [ ] **覆盖率 = 556**(含补 581–584;跳过须写明)
- [ ] `run_date` 比现有最新批次更新
- [ ] 所有 `ai_risk` ∈ `0.0`–`10.0` 且**最多一位小数**
- [ ] `confidence` 已填;`rationale_ja` 齐全(`rationale_en` 可后补)
- [ ] 漂移合理(看均值/分档迁移,不逐条)
- [ ] `build` + `verify:gates` + `bun test src` 全绿;§2.1 spot-check 通过;preview `● Ready`
- [ ] 本次 prompt 快照已建,`prompt_file` 指向正确

---

## 7. Git 提交规约

1. `feat(scores): rescore with <model> (<date>)` —— 新批次 + prompt 快照。
2. 代码改动(如首次附录 A)单独 `chore`/`feat` 提交,勿与数据混。
3. 后续英文补全:`feat(scores): add EN rationales for <model>`。

---

## 8. 决策记录(已定 2026-05-29)

- **A1 prompt 文档 = 历史快照制**:不维护单一最新版;每次运行建带日期快照,旧的冻结(`prompt.ja.md` = 4.7 快照,保留原名)。不做自动生成器。
- **A2 小数粒度 = 细化 rubric**:见 [附录 B](#附录-b小数-rubric评分标准细化-a2)。
- **A3 rationale = 先日文、英文后补**:本批只产 `rationale_ja` + `confidence`;`rationale_en` 写空串 `""`、后补(只增译文不改分)。**schema 无需改**(`z.string()` 已允许空串;改 `.nullish()` 反而引发类型错误)。
- **A4 confidence = 填**:4.8 输出 0–1 置信度,随批次落库。

---

## 附录 A:一次性"小数支持"改造(仅首次,之后 4.9 / 5.0 不再需要)

| # | 项 | 文件 | 改动 |
|---|---|---|---|
| 1 | schema:小数 | `src/data/schema/score-run.ts` | `ai_risk` 去 `.int()`,加"≤1 位小数"校验(FP 容差:`Math.abs(n*10-Math.round(n*10))<1e-9`,否则 `6.9` 会被误拒);`schema_version` 2.0→2.1 |
| 2 | EN 后补(无需改 schema) | `src/data/schema/score-run.ts` | `rationale_en` 保持 `z.string()`,待补时写空串 `""`。已验证 `loader.ts`/`score-strategy.ts`/`indexes.ts` 按非空 string 流转,改 `.nullish()` 会类型报错;空串零破坏 |
| 3 | 分档统一 | `bands.ts`、`risk.ts`、`me.astro:347`、`compare/index.astro:224`、**`map.astro:565`** | 全部统一 **`< 4.0` / `< 7.0`**(半开)。现状各不同:`bands.ts` `≤3.9/≤6.9`、risk/me/compare `≤3/≤6`、**`map.astro:565` `≤4/≤6`(连整数 4 都判错成 low)**。`risk-callout.ts`(floor 4/7/9)、`map.astro:185 riskLabel`(`≥`)已一致仅复核。补 `3.95/6.95` 边界测试 |
| 4 | 连续渐变配色 | `occupation-display.ts`、`_RiskCard.astro`、`[id].astro`、`_id-css.ts` | 弃用 11 个 `.risk-N`,RiskCard 数字按确切分数 inline 上色。**实现见下方 A.1** |
| 5 | OG 卡配色 | `src/lib/og-renderers/occupation.ts:86` | `RISK_COLORS[risk]` 是整数索引,小数 → `undefined` 丢色;改 `RISK_COLORS[Math.round(risk)]` |
| 6 | 客户端精度 | `src/pages/_index-inline.js:1492` | `parseInt(dataset.aiRisk)` → `parseFloat`(GA4 不截断 6.9→6)。`_JobtagAnchor.astro` 的 `String(aiRisk)` **无需改**(已是 "6.9");首页直方图 `Math.round` 分桶保留 |
| 7 | 契约注释 | `src/graph/types.ts`、`transfer-paths.ts`、`AiRiskDetail.ts` | "integer 0-10" → "0.0–10.0" |
| 8 | 测试 | `loader.test.ts`(去 `Number.isInteger` 断言)、`risk.test.ts`、`occupation-display.test.ts` | 跟随改 + 浮点边界用例(3.9/4.0/6.9/7.0) |
| 9 | 预检增强 | `scripts/check-score-batch.ts` | "≤1 位小数"已由 schema 覆盖;补均值/分档漂移 + 空 `rationale_en` 仅提示 |
| 10 | 不改(已决定) | `_id-bindings.ts` `riskTierJs`(`≥7`/`≥5`) | 保留 —— 这是 GA 漏斗分桶、非显示档,小数下 `≥` 仍合理 |

### A.1 连续渐变配色 — 实现

1. **`occupation-display.ts`** 加 `riskColor(score)`:5 色标 RGB 线性插值,clamp 0–10,`null`→`''`:
   `1→#48705F`(green-deep)、`3.5→#a8d572`、`5.5→#c89638`、`7.5→#D96B3D`(orange)、`9.5→#c95a3a`(red)。
2. `OccupationDisplay` 接口加 `riskColor: string`;`riskClass` 改 band:`risk-${riskClass(aiRisk)}` = `risk-low/mid/high`(import 自 `risk.ts`),`null`→`risk-na`。
3. **透传(已现成)**:`_id-bindings.ts` 是 `return { ...display }`,`riskColor` 自动流到 `[id].astro` —— 只需在 `<RiskCard … {riskColor} … />` 加一项。
4. **`_RiskCard.astro`**:加 `riskColor?: string` prop;`.risk-num` 加 `style={riskColor ? \`color:${riskColor}\` : undefined}`。
5. **`_id-css.ts`**:删 11 条 `.risk-card.risk-N .risk-num{color:…}`;基础 `.risk-num{…color:var(--red)}` 留作 `na` 兜底。
6. **测试**:`occupation-display.test.ts` 的 riskClass 断言改 band(`risk-7`→`risk-high`、`risk-0`→`risk-low`),加 `riskColor` 格式断言 + 小数用例。
7. ✅ **SEO 基线无需重捕**(开发实测 2026-05-29):`check:seo-baseline` 只覆盖 URL / sitemap / SEO-meta / OG / JSON-LD / 内链,**不覆盖页面 body markup**。连续渐变改的是 RiskCard markup + inline 脚本,不在基线快照里 → `verify:gates` 全绿、基线 clean。**只需 preview 肉眼审配色**(自动门禁查不出纯视觉变化)。⚠️ 注:build 的 `compute-csp-hashes` 会因 inline 脚本变化自动更新 `vercel.json` 的 CSP 哈希,需随 PR 一起提交。

---

## 附录 B:小数 rubric(评分标准细化 — A2)

> **目的**:让 `0.1` 的差异有真实依据,而非噪声。**整数档定"大类",小数定"档内相对位置"**,且用同一套规则保证横向可比。

### B.1 总轴(不变)
AI リスク = "AI 今后会在多大程度上重构这份工作"(直接自动化 + 间接提效减员)。核心问句:**"这份工作能多大程度上只靠一台电脑完成?"** —— 越能越高。

### B.2 整数档锚点(粗定位,沿用)
| 档 | 描述 | 锚点 |
|---|---|---|
| 0–1 | 物理/现场,不可远程 | 潜水士、林业 |
| 2–3 | 体力 + 对人 | 电工、美容师 |
| 4–5 | 体力 + 知识混合 | 护士、警察 |
| 6–7 | 知识 + 判断 | 教师、律师、会计 |
| 8–9 | 基本可在电脑完成 | 程序员、翻译 |
| 10 | 纯定型数字处理 | 数据录入 |

### B.3 小数定位:整体打分 + 三因子指引(已定 2026-05-29)

模型先用 B.2 锚点判断大致水平,再**直接给出 `0.0–10.0` 的连续分**。下面 3 个因子是**定性指引(不是机械公式)**,用来在档内上/下微调:

| 因子 | 含义 | 推高 ↑ | 推低 ↓ |
|---|---|---|---|
| **F1 数字完结度** | 多大比例可纯数字/远程完成、无需到场或动手 | 几乎全在屏幕里 | 强依赖现场/手作 |
| **F2 定型度** | 任务多可预测、可流程化 | 高度重复、规则明确 | 大量新颖判断/创造/担责 |
| **F3 人本不可替代性** | 价值依赖到场/肢体/关系信任/情感/执照壁垒 | 低(可被替代) | 高(强人本/执照) |

- **分档(low/mid/high)自然跟随最终分数**(§1 边界);**不 clamp** —— 分数落在哪档就显示哪档(`3.9` 即 `low`,诚实)。
- 因为不是机械公式,**没有不可达区间**;边界附近(如 3.9 vs 4.0)分档敏感是"连续分 + 离散档"的固有现象,可接受。
- 可比性靠:全量同一套指引 + B.4 小数锚点校准 + 让模型参考邻近锚点插值。

### B.4 小数校准锚点(定稿基准,模型据此插值;实跑时可微调)
> 这些是定稿的**校准基准**(体现各职业领域判断);模型在它们之间插值。实跑后若发现系统性偏差,可在此微调。

| 职业 | 旧整数(4.7) | 建议小数 | 为什么 |
|---|---|---|---|
| 数据录入 | 10 | 9.9 | 近乎纯定型数字处理 |
| 翻译 | 9 | 9.1 | 文本纯数字,AI 冲击大 |
| 程序员 | 9 | 8.8 | 高数字完结,但需设计判断 |
| 会计 | 7 | 7.0 | 规则强、偏自动化上沿 |
| 律师 | 7 | 6.4 | 判断/担责/执照拉低,但仍偏高 |
| 护士 | 5 | 4.3 | 到场+肢体+对人拉低 |
| 美容师 | 3 | 2.4 | 手作+对人 |
| 林业 | 1 | 0.6 | 现场体力 |

### B.5 诚实声明(写入批次 `caveat`)
小数表示"档内相对精修",**非测量精度**;`6.9` vs `7.0` 是相对位置判断,不宣称 0.1 客观可测。沿用"高分 ≠ 工作消失,多为重构而非替代"。

---

## 附录 C:组装器实现细节

### C.1 形态
- 文件 `scripts/assemble-scores.ts`(bun 运行,TS)。`package.json` 加 `"assemble:scores": "bun scripts/assemble-scores.ts"`。**独立工具,不进 `build`/`verify:gates`/`vercel.json`**。

### C.2 CLI 参数
- `--in <path>`(必填):原始结果 JSONL。
- `--model`、`--date`、`--prompt-version`、`--prompt-file`、`--run-id`、`--operator`、`--input-data-version`:元数据。
- `--out <path>`:默认按 `model+date` 命名到 `data/scores/`。
- 可选 `--anchors <file>` / `--caveat <file>`(否则用模板/上版)。

### C.3 输入 JSONL
每行:`{"id":1,"ai_risk":6.9,"rationale_ja":"…","rationale_en":"…"(可省),"confidence":0.8}`。

### C.4 算法
1. 读 `--in`,逐行 `JSON.parse`(跳空行;行号入错误信息)。
2. 逐行轻校验:`id`∈1–999;`ai_risk`∈0–10 且 ≤1 位小数;`rationale_ja` 非空;`confidence`∈0–1(或省)。**有错则全列出、exit 1、不写**。
3. 覆盖率:对 `data/occupations/*.json` 实际 id 集合算 scored / missing / extra;重复 id 报错;missing 列出(警告)。
4. 组装 `ScoreRun` 对象:`schema_version:"2.1"`、`scope:"occupations"`;`scorer/run/prompt` 来自 CLI;`input.occupation_count_scored/skipped` 自动算;`input_data_sha256` = 对所有 occupation 文件内容(排序后拼接)算 sha256;`prompt_sha256` = 对 `--prompt-file` 算;`anchors/caveat` 来自文件或模板;`scores` 映射 `{ "<id>": {...} }`。
5. **`ScoreRunSchema.safeParse` 全量校验**(与 build 同一 schema);失败列 issues、exit 1、不写。
6. 写 `--out`;**若文件已存在则报错**(保护 append-only,不覆盖)。
7. 打印摘要:scored/skipped、均值、分档分布、与现有最新批次的漂移(复用 `check-score-batch` 逻辑)。

### C.5 退出码
`0` 成功写出;`1` 输入/校验失败(不写文件)。

### C.6 测试(`scripts/assemble-scores.test.ts`)
合法输入→产出过 `ScoreRunSchema`;非法 `ai_risk`(`11` / 两位小数)→拒;缺 `rationale_ja`→拒;`confidence` 越界→拒;空 `rationale_en`→容许;覆盖率/skipped 计数正确;已存在输出→拒(不覆盖)。

### C.7 与 check-score-batch 的关系
`assemble` = 生产 + 自检;`check-score-batch` = 进 build 前独立复检。两者共享"小数/覆盖率/漂移"逻辑,抽到 `scripts/lib/score-batch.ts` 复用。

---

## 附录 D:版本历史

| 日期 | 模型 | schema | 备注 |
|---|---|---|---|
| 2026-04-25 | claude-opus-4-7 | 2.0(整数) | 初版(从 v1.0 迁移),552 职业 |
| _待填_ | claude-opus-4-8 | 2.1(一位小数) | 首次小数化 + 连续渐变 + 置信度 + EN 后补 |
