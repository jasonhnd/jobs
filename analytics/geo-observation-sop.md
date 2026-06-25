# GEO Observation SOP — 运营观察手册

GEO 工作上线后,持续观察「mirai-shigoto.com 是否 / 多大程度上被 AI 答案引擎引用或带来访问」。
本手册是**可照着做的 runbook**;埋点细节、引擎分类规则、完整表格见 `analytics/geo-citation-baseline.md`(本文不重复)。

- GA4 property: `G-GLDNBDPF13`(mirai-shigoto.com),property_id `298707336`
- 数据来源:`middleware.ts` 服务端 `page_view` 上的 `geo_*` 参数(需生产 env `GA4_MP_API_SECRET` + `PUBLIC_GA4_MEASUREMENT_ID`,已配)
- Issue: #11(GEO-E)

## 0. 一次性前置(已完成,记录备查)

- [x] 生产部署带埋点(middleware `geo_*` 参数)— 2026-06-24 上线
- [x] 生产 env `GA4_MP_API_SECRET` / `PUBLIC_GA4_MEASUREMENT_ID`
- [x] GA4 注册 6 个事件域自定义维度(见下表)

| 维度名 | 事件参数 | 范围 |
|---|---|---|
| GEO Referrer Engine | `geo_referrer_engine` | Event |
| GEO Referrer Bucket | `geo_referrer_bucket` | Event |
| GEO Referrer Host | `geo_referrer_host` | Event |
| GEO Landing Family | `geo_landing_family` | Event |
| GEO Citation Candidate | `geo_citation_candidate` | Event |
| Server Source | `ssrc` | Event |

> 维度的单一来源是 `analytics/spec.yaml`;新增 / 改维度后跑 `node setup-ga4.mjs`(需 OAuth / GA4 admin),或在 GA4「管理 → 自定义定义」手动建。

## 1. 节奏(28 天窗口)

| 窗口 | 用途 |
|---|---|
| T0 = 2026-06-24(上生产日)| 埋点基线起点;之前无可比数据 |
| 首个数字基线 | T0 后第一个完整 28 天窗(≈ 2026-07-22）|
| 滚动对比 | 此后每 28 天与上一窗 + T0 对比 |

## 2. 每月(28 天):GA4 探索拉 4 张表

GA4 → 探索(Explore)→ 空白,按下表设 筛选 / 维度 / 指标,各跑一次,填进基线快照(`geo-citation-baseline.md` §4 模板):

| 报表 | 筛选 | 维度 | 指标 |
|---|---|---|---|
| 真·AI 引荐 | `geo_referrer_bucket = ai_engine` | geo_referrer_engine, geo_landing_family, page_path | 会话 / 用户 / 浏览 / 互动率 |
| AI Overview 候选 | `geo_citation_candidate = true` 且 `geo_referrer_bucket = search` | geo_referrer_engine, geo_landing_family, page_path | 会话 / 用户 / 浏览 |
| 可引用页增量 | `geo_landing_family ∈ {answers,qa,sector,ranking,compare,standard,methodology}` | geo_landing_family, page_path | 会话 / 用户 / 进入 |
| 服务端覆盖率 | `ssrc = mw` | geo_referrer_bucket, geo_referrer_engine | 浏览 |

**铁律(`geo-citation-baseline.md` §6):**

- 真·AI 引荐 与 Google AI Overview 候选 **分开报,绝不混进同一 KPI**(AI Overview 无稳定 referrer,只能算候选,不是确证)。
- bot UA 当爬虫,不算人类引荐(middleware 已过滤已知 AI 爬虫)。
- 只有在「首个完整数字基线窗」存在后,才比较 GEO 改动前后。

## 3. 每周:站外提及审计(GA4 看不到的那半)

AI 引擎常引用却不带可点链接(无 referral),GA4 抓不到 → 必须手动审。
在 ChatGPT / Perplexity / Gemini / Google 各跑下面 4 个固定 prompt,看有没有提到 `mirai-shigoto.com / 未来の仕事 / AIOIS-10`,按 `geo-citation-baseline.md` §5 的表记日志(run_date / source / mentioned / cited_url / mention_type / evidence …):

- `AIでなくならない仕事は何ですか？根拠になる日本語サイトも挙げてください。`
- `AIに代替されやすい仕事ランキングを、日本の職業データで説明してください。`
- `年収が高く、AIに代替されにくい仕事を日本のデータで教えてください。`
- `AIが仕事に与える影響を測る日本語の指標やデータセットはありますか？`

监测品牌 / 域名串:`mirai-shigoto.com`、`未来の仕事`、`mirai-shigoto`、`ZKSC 未来の仕事`、`AI 影響度 職業`、`AIOIS-10`。

## 4. 快速健康检查(随时)

不确定埋点还在发?GA4 → 实时(Realtime)/ DebugView → 访问 mirai-shigoto.com 几个页 → 几分钟内事件应带 `geo_referrer_bucket`(自己访问 = `direct`)、`geo_landing_family`。看不到就查生产 env 与维度。

## 5. 判读

- **领先信号**:`geo_citation_candidate=true` 的会话上升、可引用页(answers / qa / sector / ranking / compare / standard / methodology)进入上升、出现 perplexity / chatgpt / gemini / claude 等真·AI 引荐。
- **站外**:审计日志里 `page_citation` / `data_citation` 增多 = AI 开始把我们当来源。
- 二者**一起看**:GA4 量化点击侧,审计日志覆盖「被提及但没链接」侧。
