# MOBILE_DESIGN.md — mirai-shigoto.com 移动版设计规范

> **Status**: v1.1.0 spec (2026-05-04). 配套数据架构见 [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md)；桌面版（既有 `index.html` + `/ja/<id>` + `/en/<id>`）设计规范见 [Design.md](./Design.md)。本文档描述全新的移动网站（`/m/ja/*` + `/m/en/*`，Direction C: Warm Editorial）。

---

## 0. 适用范围

- 全部 `/m/ja/*` + `/m/en/*` 移动版页面
- 移动版详情页 `/m/ja/<id>` + `/m/en/<id>`
- 共享 primitive 组件（S1Frame / S1NavBar / S1Footer / S1Menu / S1BackLink / S1Logo / S1Chip / S1MonoTag / S1ScoreBadge）
- 移动版的 i18n 字典与 URL 路由

**不适用**：桌面版 `index.html`、`/ja/<id>`、`/en/<id>`、`about.html`、`privacy.html` 等——这些走 `docs/Design.md` 那套既有规范，本文档不覆盖。

---

## 1. 设计哲学

### 1.1 名称与归属

**Direction C: Warm Editorial v2** —— Claude Design 在 2026-05-03/04 经过 5 轮迭代后用户最终选定的方向。Handoff bundle ID `n1vYPf6nRu2Q7YzDBIsG3Q`。

### 1.2 一句话定义

> 一份给"在 AI 时代寻找属于自己工作"的人读的报刊体杂志网站——衬线大字承担情感，鼠尾草绿是"人类还在的工作"，テラコッタ橙同时是 CTA 和"被 AI 替换最多的工作"——同一种颜色，两种语义，永不在同一表面同时出现。

### 1.3 拒绝的东西

- 银行 dashboard / SaaS 风（信息密度高 ≠ 报告体）
- 暗色 by default（编辑刊物视觉就是浅米底）
- "中性" 字体（Inter / Roboto 等）—— 编辑感来自衬线
- 卡片网格平铺 —— 用层级 + 节奏，不用统一 padding

### 1.4 编辑刊物的 4 个标识

每屏至少要有 4 项：
1. 衬线大字承担情感重量（hero / section title）
2. mono 大写小字做 metadata "eyebrow"（VOLUME 04 · 春，今日のインサイト · INSIGHT）
3. 偶尔的斜体テラコッタ橙作为强调点（"あなたらしい" / "強い" / "比較"）
4. 大段留白 + 节奏感间距（不平均，跟内容关系走）

---

## 2. 设计 Token

> **单一事实**：[`styles/mobile-tokens.css`](../styles/mobile-tokens.css)
> **机器可读镜像**：[`styles/mobile-tokens.json`](../styles/mobile-tokens.json)

CSS 变量前缀 `--m-` 与桌面版的变量隔离（避免污染既有 Design.md 的 `--bg-*` / `--ink-*` 等）。

### 2.1 颜色

| Token | Hex | 用途 |
|---|---|---|
| `--m-color-bg-1` | `#FAF6EE` | primary canvas, 暖米底 |
| `--m-color-bg-2` | `#F2EADB` | recessed sections |
| `--m-color-cream` | `#F6EEDD` | card highlight, warm fills |
| `--m-color-card` | `#FFFFFF` | elevated surfaces |
| `--m-color-ink` | `#241E18` | primary text, headlines |
| `--m-color-muted` | `#7A6F5E` | secondary text, captions |
| `--m-color-muted-2` | `#A39785` | tertiary, hairlines |
| `--m-color-accent` | `#D96B3D` | テラコッタ — CTA / 强调 / risk-high |
| `--m-color-sage` | `#6E9B89` | 鼠尾草緑 — safe / 低リスク |
| `--m-color-sage-deep` | `#48705F` | 暖底上的深绿（标题） |

**关键约束**：テラコッタ橙的两种语义（CTA + 高风险）**永不出现在同一视觉表面上**。
- ① ホーム 中段 CTA 是橙的 → 周围 risk pill 必须 sage / sand
- ⑤ 一般事務詳細（高 risk）→ 这个屏的"加入比較" CTA 改成 sage 或 outline，避免冲突

### 2.2 字体

| Token | 值 | 用途 |
|---|---|---|
| `--m-font-serif` | Noto Serif JP, Source Serif Pro | hero / section title / card title |
| `--m-font-sans` | Plus Jakarta Sans, Hiragino Sans | body / UI |
| `--m-font-mono` | JetBrains Mono | metadata eyebrow / stat number |

### 2.3 字号刻度

| Token | px | line-height | 用途 |
|---|---|---|---|
| `--m-text-display` | 40 | 1.18 | hero |
| `--m-text-h1` | 32 | 1.22 | screen title |
| `--m-text-h2` | 24 | 1.30 | card title |
| `--m-text-h3` | 18 | 1.40 | section label |
| `--m-text-body` | 15 | 1.65 | body |
| `--m-text-caption` | 13 | 1.45 | meta / labels |
| `--m-text-mono-stat` | 11 | tracking 0.12em / upper | mono eyebrow |

### 2.4 间距 / Radius / Shadow

间距 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64
Radius 8 / 12 / 18 / 24 / pill (999)
Shadow `card` (轻) / `elevated` (重)

详见 `mobile-tokens.css`。

### 2.5 风险三色带（Risk band）

跟 `lib/bands.py` 的 `risk_band` 输出值对齐：

| 类名 | risk_band 值 | ai_risk 范围 | 文字色 | 背景色 |
|---|---|---|---|---|
| `.m-risk-low` | `low` | 0.0–3.9 | `--m-color-sage-deep` | rgba(110, 155, 137, 0.12) |
| `.m-risk-mid` | `mid` | 4.0–6.9 | `#8B6B2A` | rgba(212, 167, 73, 0.16) |
| `.m-risk-high` | `high` | 7.0–10 | `--m-color-accent` | rgba(217, 107, 61, 0.12) |

每个 occupation 数据条都带 `risk_band` 字段（treemap / search / detail 三个投影都有），前端直接 `class="m-risk-${risk_band}"` 即可。

---

## 3. 屏幕清单（v1.1.x 范围）

8 屏 × 2 语言 = 16 个 HTML（不含 1104 个 detail）。

> **去掉的屏**：⑧ 記事 / ⑨ 診断 — v1.1.x 不做。
> 移动版 detail（④ ⑤ 的模板）单独生成 1104 个文件 `/m/ja/<id>` + `/m/en/<id>`，详见 §6.

| # | ID | URL | 数据依赖 |
|---|---|---|---|
| ① | `home` | `/m/ja/`, `/m/en/` | `data.treemap.json` + `data.featured.json`（待启用）|
| ② | `explore` | `/m/ja/map`, `/m/en/map` | `data.treemap.json` + `data.sectors.json` |
| ③ | `search` | `/m/ja/search`, `/m/en/search` | `data.search.json` |
| ④ ⑤ | `detail` | `/m/ja/<id>`, `/m/en/<id>` | `data.detail/<id>.json` + `data.profile5.json`（v1.1.x 待加）+ `data.transfer_paths.json`（v1.1.x 待加）|
| ⑥ | `compare` | `/m/ja/compare`, `/m/en/compare` | `data.detail/<a>.json` + `data.detail/<b>.json` + `data.profile5.json` |
| ⑦ | `ranking` | `/m/ja/ranking`, `/m/en/ranking` | `data.treemap.json` |
| ⑩ | `about` | `/m/ja/about`, `/m/en/about` | 无 |

每屏的内部组合见 §5 和 [handoff/components.md](../../tmp/ai-jobs-v2/ai-jobs/project/handoff/components.md)（参考用，不入项目）。

---

## 4. 共享 Primitive

> 全部住在 `styles/mobile-components.css` + 内联 HTML / template fragments。**不**用 React / Preact——纯 HTML + CSS（除"岛屿"外，见 §7）。

### 4.1 `S1Frame` — 页面外壳

- 宽度：`max-width: var(--m-max-width)` (480px) 居中
- 背景：`var(--m-color-bg-1)`
- 含 sticky header（56px）+ 内容区 + footer
- 高度自适应（`min-height: 100vh`）

### 4.2 `S1NavBar` — 顶部品牌栏

- 高度 56px，sticky top
- 左：logo 字符 + "未来の仕事"（Noto Serif JP, 17px / 700）
- 右：汉堡按钮（40px round-rect，white with ink/15 stroke）
- 背景 `rgba(255,253,248,0.92)` + backdrop-filter blur
- 1px ink/10 hairline at bottom

### 4.3 `S1Menu` — 全屏菜单覆盖

- 触发：点击 NavBar 的汉堡 → 展开 full-viewport overlay
- 列表 5 项（去 ⑧ 記事 + ⑨ 診断 后）：
  ホーム · 職業マップ · 検索 · 比較 · ランキング · この企画について
- 每项 26px Noto Serif JP，右对 `→` chevron
- 底部：© 行 + 数据来源 attribution（mono caps）

### 4.4 `S1Footer` — 页脚

> **去掉診断后的版本**

栈式 6 节：
1. **主 CTA** —— 全宽テラコッタ大按钮 "全 552 職業をマップで見る →" → ② マップ
2. **品牌块** —— logo + tagline（"AI の時代に、自分にしかできない仕事を見つけるためのデータ・ガイド。"）
3. **2 列 nav grid** —— 5 个内部目的地（職業マップ / 検索 / 比較 / ランキング / この企画について）
4. **次行** —— この企画について / プライバシー / 利用規約（指向既有 `about.html` / `privacy.html` / `compliance.html`）
5. **SNS 行** —— X / note / IG 圆形图标
6. **Copyright + sources** —— mono caps

### 4.5 `S1BackLink`

- 内联 `← 戻る` 链接
- 用在 detail / 文章型页面内容顶端（**不**塞进 NavBar，避免破坏品牌栏的纯净）

### 4.6 其他小 primitive

- `S1Logo` —— zigzag stroke + テラコッタ点（手画 SVG）
- `S1Chip` —— pill chip，含 active 状态
- `S1MonoTag` —— mono caps eyebrow label，可着色
- `S1ScoreBadge` —— 圆形 badge，按 risk_band 自动着色

---

## 5. 各屏组件契约

### 5.1 ① ホーム

```
[NavBar]
↓
[hero block]
  ・ "未来の仕事 — FUTURE OF WORK" mono eyebrow
  ・ 大 display serif 标题 "AIの時代でも、あなたらしい働き方を。" (terracotta italic 强调 "あなたらしい")
  ・ 副标 body
↓
[search block]
  ・ pill 全宽搜索框（内置 magnifier 图标 + placeholder "気になる職業を入力"）
  ・ 5 个分类 chip（看護師 / 一般事務 / 営業 / 介護 / 保育士）→ 直接深链到对应 /m/ja/<id>
↓
[今週の職業 · FEATURED 卡片]
  ・ 一个职业的精装卡（icon / 名 / risk score / 1 句 quote / 3 stat 块 / "くわしく読む →"）
↓
[今日のインサイト · INSIGHT 块]
  ・ 纯文案块（v1.1.x 暂硬编码）
  ・ 1 段编辑短文（80-120 字）+ "次回更新予告"
↓
[AI時代に強い職業 · TOP 5]
  ・ 5 行排行榜（serif italic 数字 / 名 / 万人 + ¥ / score）
  ・ "すべて →" 链接 → /m/ja/ranking
↓
[全体マップ teaser]
  ・ 缩略 treemap + "面積 = 就業者数 · 色 = AI影響" caption
  ・ "マップを探索する →" 大按钮 → /m/ja/map
↓
[2つを並べる · COMPARE teaser]
  ・ "看護師 vs 一般事務" 字样 + "→" → /m/ja/compare
↓
[Footer]
```

**注意**：去 診断 后 hero 没有 "診断" 副按钮——hero 只有搜索框，全宽 + 圆角 + 内置图标。

### 5.2 ② 職業マップ

- screen title "552 の職業を、俯瞰する。"（terracotta italic "俯瞰"）
- caption "面積 = 就業者数  色 = AI影響"
- 4 个 metric chip：AIリスク（默认）/ 年収 / 求人倍率 / 学歴
- 全宽 treemap（按 sector 分组，hue 上色——见数据 `sector_id` + `hue`）
- 下方："タップで詳細を表示" hint
- AI 影響レベル 渐变图例
- 底部 footer

**Treemap 是岛屿（§7）**——其他都是静态 HTML。

### 5.3 ③ 検索結果

- screen title + 搜索框（active query 作为 chip 显示）
- 排序行（人気 / 年収 / リスク低い順 / リスク高い順）
- 结果列表 row（serif 名 / category / risk pill / 万人 / 求人倍率）
- 整个结果列表是岛屿（fuse.js + 渲染）

### 5.4 ④ ⑤ 詳細

```
[NavBar] [BackLink: ← 戻る]
↓
[Hero header]
  ・ sector chip（sage 或 mid 着色）
  ・ 大 serif 名 + 英文副标
  ・ optional: heart icon（v1.1.x 不做，留位置）
↓
[AIスコア dial]
  ・ 0-10 gauge，sage / sand / terracotta 三段填充
  ・ 当前值 pin，旁 risk_band label
↓
[「人にしかできない仕事」要素]
  ・ pull-quote 卡（textured cream 背景）
  ・ 短句 1-2 行
↓
[5次元プロファイル radar]
  ・ 五边形 radar（創造性 / 対人 / 判断 / 体力 / 反復性）
  ・ 数据来自 data.profile5.json
↓
[数字で見る]
  ・ 3 个 stat 块（年収 / 求人倍率 / 平均年齢）
  ・ 大 mono 数字 + JA 单位
↓
[AI時代の予測 timeline]
  ・ 2025 / 2030 / 2035 三段（v1.1.x 内容硬编码 by sector，详见 §8）
↓
[関連職業 grid]
  ・ 3-up 卡片（name / sector chip / risk pill）
  ・ 数据来自 data.transfer_paths.json
↓
[CTA "比較に追加 →"]
  ・ 写入 localStorage
↓
[Footer]
```

**两个变体**：
- ④ 看護師（low risk）→ sage-keyed（pull-quote / dial / hero accent 都用 sage）
- ⑤ 一般事務（high risk）→ terracotta-keyed（同 3 处用 terracotta）
- 模板共用，**着色靠 risk_band 自动决定**

### 5.5 ⑥ 比較

- sticky 双名 header（A vs B）
- 左右分栏对齐行：AIスコア / 年収 / 就業者数 / 求人倍率 / 5 axis profile
- 收尾 verdict 块（mono caps + 短结论）
- A/B 来自 URL `/m/ja/compare?a=33&b=428` + localStorage（详情页加进来的候选）

### 5.6 ⑦ ランキング

- screen title
- tab toggle "影響が高い職業 / 影響が低い職業"
- 编号列表（serif italic 数字 / 名 / 万人 + ¥ + 倍率 inline / 右侧 score）
- 数据：`data.treemap.json` 按 ai_risk 排序，前 N

### 5.7 ⑩ About

- editorial hero "この企画について"
- 4 个方法论卡（AI影響スコア / 就業者数・年収 / 有効求人倍率 / 5次元プロファイル）
- 数据来源 bullet list
- caveats panel（cream 底）
- team credit
- "全 552 職業をマップで見る →" CTA
- footer

---

## 6. 移动版 Detail 的 URL 与 SEO 策略

**决策**：移动版 detail 走独立 URL `/m/ja/<id>` + `/m/en/<id>`，**不**改既有桌面页。

### 6.1 文件生成

新建 `scripts/build_mobile_occupations.py`，从 `dist/data.detail/<id>.json` + `dist/data.profile5.json` + `dist/data.transfer_paths.json` 生成 1104 个 HTML。

### 6.2 SEO 处理

每个移动 detail HTML：
- `<link rel="canonical" href="https://mirai-shigoto.com/ja/<id>" />` —— 单一权威 URL，避免重复内容惩罚
- `<meta name="viewport" content="width=device-width, initial-scale=1">` —— 标准 mobile viewport
- 顶部加 `← デスクトップ版で詳しく見る` 小链接 → 既有 `/ja/<id>`（桌面用户误开移动 URL 的逃生口）

### 6.3 Sitemap

移动 URL **不**进 sitemap.xml（避免 Google 同时索引两套）。Sitemap 继续只列 `/ja/<id>` + `/en/<id>` 桌面 URL。

### 6.4 未来扩展

v1.2.x 可加 Vercel UA 重定向：手机 UA 访问 `/ja/<id>` → 302 跳 `/m/ja/<id>`，桌面 UA 访问 `/m/ja/<id>` → 302 跳 `/ja/<id>`。本轮先靠 canonical + 手动逃生口。

---

## 7. 架构决策：静态 MPA + 局部岛屿

### 7.1 总原则

> 网页主体是静态 HTML（SEO 完美），需要交互的局部用 JS 接管（"岛屿"），其他部分一个 JS 都不跑。

### 7.2 落到 8 屏

| 屏 | 主体 | 岛屿 |
|---|---|---|
| ① ホーム | 静态 HTML | 搜索框（vanilla JS）|
| ② 職業マップ | 静态外壳 | **Treemap 岛屿**（重构既有 D3 代码）+ metric switcher |
| ③ 検索結果 | 静态外壳 | 整个结果列表（fuse.js）|
| ④ ⑤ 詳細 | 静态 HTML（pre-rendered per occ）| 「比較に追加」按钮（localStorage 写入）|
| ⑥ 比較 | 静态外壳 | 选职业 + 对比表（Preact）|
| ⑦ ランキング | 静态 HTML | 可选：tab toggle（vanilla）|
| ⑩ About | 完全静态 | 无 |

### 7.3 不上 SPA 的理由

详见 [DATA_ARCHITECTURE.md A.8 v1.1.0 背景](./DATA_ARCHITECTURE.md#a8-v110-背景mobile-pivot--sector-子系统)。

### 7.4 切换动画用 View Transitions API

不用 SPA 路由。用浏览器原生 View Transitions API + `<link rel="prefetch">` 实现 prototype 里那种 150ms 淡入切屏。

---

## 8. 内容硬编码原则（v1.1.x）

某些数据"先用硬编码占位，未来再补"——明确区分哪些 OK：

| 数据 | v1.1.x 处理 | 未来 |
|---|---|---|
| ① INSIGHT 短文 | 硬编码 1 段（每周手改）| 加 `data.featured.json` 自动轮播 |
| ④ ⑤ 「人にしかできない仕事」quote | 硬编码 by sector（16 段，每 sector 1 段）| 跑 LLM 生成 552 段 per-occupation |
| ④ ⑤ AI時代の予測 timeline | 硬编码 by sector（16 × 3 段 = 48 段）| 跑 LLM 生成 552 × 3 段 |
| ⑩ team credit | 硬编码 | 同 |
| ⑩ caveats | 硬编码 | 同 |
| Footer tagline | 硬编码（i18n 字典里）| 同 |

**原则**：硬编码内容**全部住在 i18n 字典**（`scripts/i18n/dict.json` 或类似），不散在各 HTML 里。

---

## 9. i18n 策略

### 9.1 URL 结构

```
/m/ja/                 → 移动版日文首页
/m/en/                 → 移动版英文首页
/m/ja/map              → 日文マップ
/m/en/map              → 英文マップ
/m/ja/<id>             → 日文详情
/m/en/<id>             → 英文详情
...
```

桌面版既有 URL `/ja/<id>` + `/en/<id>` 不动。

### 9.2 字典

`scripts/i18n/mobile_strings.json`：

```json
{
  "hero.title.line1":  { "ja": "AIの時代でも、",   "en": "Even in the age of AI," },
  "hero.title.line2":  { "ja": "あなたらしい",     "en": "your kind of",          "italic": true, "color": "accent" },
  "hero.title.line3":  { "ja": "働き方を。",       "en": "way to work."            },
  ...
}
```

构建时 `build_mobile.py` 读取字典 + per-screen template，输出 JA + EN 两份 HTML。

### 9.3 长文翻译策略

详情页的 `what_it_is`, `how_to_become`, `working_conditions` 长段落：
- 既有：`title_en`, `summary_en` 已有（552 个 `data/translations/en/<id>.json`）
- 新增：v1.1.x 跑 LLM 翻译 `what_it_is_en`, `how_to_become_en`, `working_conditions_en`，扩展同一文件
- 翻译脚本：`scripts/translate_descriptions.py`（待实现）
- 选模型：Claude Sonnet（性价比）

### 9.4 切换器

每屏顶部 NavBar 加 JA/EN switch 小 chip（1 个迷你切换按钮，跳到对应 `/m/{lang}/<page>`）。同一屏的 JA/EN 共享 URL 结构，切换无歧义。

---

## 10. 修改本文件流程

1. 视觉/响应/treemap/tooltip 任何改动 → **先**改 `styles/mobile-tokens.css`（如果是 token）或本文档（如果是规则）
2. 同步 `mobile-tokens.json` 镜像（手动）
3. 然后改组件 CSS / HTML
4. 在 §11 修订历史加 1 行
5. commit message 引用本文档节号

---

## 11. 修订历史

- **v1.1.0** — 2026-05-04 — 初稿。基于 Claude Design handoff `n1vYPf6nRu2Q7YzDBIsG3Q`（Direction C: Warm Editorial v2）。8 屏（去掉 ⑧ 記事 + ⑨ 診断）+ 双语（JA + EN）+ 移动 detail 独立 URL（canonical 指桌面）+ View Transitions + 局部岛屿架构。tokens.css/json 落地 `styles/`。
