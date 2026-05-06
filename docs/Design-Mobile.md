# Design-Mobile.md — mirai-shigoto.com 移动版设计规范

> 这是本站**移动版**（≤768px）设计的唯一真相源（single source of truth）。
> 桌面版规范见 [Design.md](./Design.md)。共享底层（颜色 token / 字体 / 间距 / 主题系统 / 响应式断点定义 / treemap 视觉 / 通用组件）全部在 Design.md，本文件只描述**移动专属**：mobile hero、tooltip touch-mode、移动端自适应规则、`/map` 独立页。
>
> 跟历史 `MOBILE_DESIGN.md` 的关系：那个文件描述 v1.1.0 时代废弃的 `/m/*` URL 架构，已于 2026-05-06 删除（v1.4.0 之后零 active 引用）。本文件描述的是当前主域 `mirai-shigoto.com` 的 mobile 响应式设计。
>
> 代码与本文件冲突时，**以本文件为准**。

---

## 0. 适用范围

- `index.html` mobile 段（`@media (max-width: 768px)` 及更窄断点）
- `map.html`（mobile-first 独立职业地图页；详见 §4）
- `scripts/build_occupations.py` 生成的 556 个 `ja/<id>.html` 详情页 mobile 段
- 共享底层（颜色 / 字体 / 间距 / 主题 / 断点 / treemap 视觉）见 Design.md

---

### 0.1 与 Design.md 的关系

| 维度 | 在哪 |
|---|---|
| 颜色 / 字体 / 间距 token | Design.md §2 |
| 主题系统（双主题契约） | Design.md §3 |
| 响应式断点定义 | Design.md §4 |
| Treemap 视觉化（颜色函数 / 透明度 / 标签门槛 / GAP） | Design.md §5 |
| Desktop tooltip (hover-mode) | Design.md §6.1 |
| Tooltip 视口溢出处理（共享） | Design.md §6.4 |
| 通用组件（top banner / stats panel / footer / 404 等） | Design.md §7.1-§7.10, §7.13, §7.14 |
| Desktop Hero | Design.md §7.12 |
| 交互动效 / 可访问性 / 资产 / palette 准则 | Design.md §9-§13 |

| 维度 | 在哪 |
|---|---|
| Mobile Hero (Variant C) | 本文件 §1 |
| Mobile Tooltip 行为（touch-mode + close button + CTA + touch state machine） | 本文件 §2 |
| 移动端响应式规则汇总（≤768 / ≤480 / ≤360 / ≤540） | 本文件 §3 |
| `/map` 独立页规范 | 本文件 §4 |

---

## 1. Mobile Hero (Variant C, mobile-only)

mobile (`≤768px`) 专用首屏 hero block。在 desktop 上 `display: none`，不影响桌面版。

**目的**：手机用户打开站点 10 秒内必须看到主图 / 工具入口，避免让 stats / toggles / 说明文字挤占首屏。

**结构**（DOM 顺序自上而下）：

1. `h2.mobile-hero-title` — `あなたの仕事の AI 影響度 を見る`，字号 1.35rem (`≤480: 1.2rem`)，`AI 影響度` 用 `var(--accent)` 着色。
2. `.mobile-hero-trust` — 单行信任信号：`552 職業 · LLM スコア · 公開データ由来`。font 0.74rem，`color: var(--fg2)`，居中或左对齐。
3. `.mobile-hero-search` — 搜索输入框 + 🔍 icon prefix。input 占满宽，padding `10px 14px 10px 38px`（左侧留 icon 空间），radius 999px。`placeholder: 職業名で検索（例：事務職）`。绑定 `applyFilter()` + dropdown（共用 Design.md §7.12 的 search-suggest 逻辑）。
4. `.mobile-hero-chips` — 5 个职业 chip，横排可 wrap：**事務職 / 経理 / 営業 / CS（カスタマーサポート 缩写）/ 看護師**（与桌面 Design.md §7.12 共用同一组）。chip padding `5px 11px`，radius 999px，`border: 1px solid var(--border)`，font 0.78rem。

**桌面行为**（`min-width: 769px`）：`.mobile-hero { display: none }`。

**移动行为**（`max-width: 768px`）：
- `.mobile-hero { display: block }`，置于 h1 之下、treemap 之上。
- DOM 重排：`.controls` / `.stats-panel` 移到 treemap **之后**（`#wrapper` 改 flex-column + `order` 控制），`.dimension-hint` / `.search-row`（旧的，原 desktop 位）`display: none`（mobile-hero 取代它们）。
- 用户首屏看到：top-banner → h1 → mobile-hero → treemap 顶部。`.controls` / `.stats-panel` 滚下后可见，做"探索后操作"。

**Chip 行为契约（Stage 1 起：1 步直达）**：
- 点击 chip → 通过 `CHIP_TO_JOB` 映射 → `window.location.href = occUrl(matched_record)`，1 步跳到对应详情页。
- chip 名 v1 占位（与 Design.md §7.12 共用），data-chip 是日文全名，可视显示在窄屏上可缩写（如 `カスタマーサポート` → `CS`）。
- 应在 GA4 数据稳定（2-3 周）后用 top-clicked / top-searched 替换名单。
- GA4 事件：`popular_job_click`，参数 `occupation_id` / `language`。

---

## 2. Mobile Tooltip 行为

### 2.1 touch-mode 入口

- 添加 `.touch-mode` class
- `pointer-events: auto`
- 显示 `.tt-close` 关闭按钮（右上角 ×）— 详细规格见 §2.3
- 显示 `.tt-cta` 按钮（"詳細を見る →"）— 详细规格见 §2.4
- `max-width: calc(100vw - 32px)`
- `max-height: calc(100vh - 32px)`
- `overflow-y: auto` + `-webkit-overflow-scrolling: touch`
- `font-size: 0.78rem`，`padding: 10px 12px`

### 2.2 Tap-outside 行为

点击 tooltip 外部任意位置自动关闭。点击 tile 切换 tooltip。

### 2.3 Close button (`.tt-close`) 触摸目标

| 主题 | 数值 |
|---|---|
| Visual size | 32×32 px（圆形） |
| Hit area (touch target) | **44×44 px**（Apple HIG 最小） — 用 padding / pseudo-element 扩出，不靠 visual size |
| Background | `rgba(255,255,255,0.06)`（dark 主题）/ `rgba(0,0,0,0.05)`（light 主题） |
| Border | `1px solid var(--border)` |
| Radius | `50%` |
| Color | `var(--fg2)`，hover `var(--accent)` |
| Font-size | `1.1rem`（× 字符大小） |
| Position | `top: 8px; right: 8px` 绝对定位 |

> **不可低于 44×44 hit area**。这是 v0.4.2 之后追加的硬性最小。原 22×22 视觉 + ~22×22 hit 在测试中导致老人 / 大拇指用户高频 mis-tap，是漏斗里的隐形漏点。

### 2.4 Tooltip CTA (`.tt-cta`)

Mobile touch-mode tooltip 必须有一个**显眼的"進入詳細页"按钮**，否则用户看到信息却不知道能点进去（实测漏斗大漏点）。

| 字段 | 值 |
|---|---|
| 元素 | `<a id="tooltipCta" class="tt-cta" target="_blank" rel="noopener">` |
| 文本 | `詳細を見る →` |
| Background | `var(--accent)`（橙色） |
| Color | dark 主题 `#0b0d10`，light 主题 `#fff` |
| Padding | `10px 14px` |
| Radius | 8px |
| Font-weight | 600 |
| Font-size | 0.88rem |
| Display | block，`width: 100%`，`text-align: center` |
| Margin | `12px 0 0`（与 tooltip 内容隔开） |
| Hover | `filter: brightness(1.05)` |
| Focus | `outline: 2px solid var(--accent); outline-offset: 2px` |

**href 契约**：showTooltip() 时 JS 设置 `cta.href = occUrl(occupation)`（`/ja/<id>`，v1.4.0 起 JA-only）。

**GA4 事件**：点击 fire `tooltip_cta_click` 事件，参数 `occupation_id` / `ai_risk_score` / `language` — 详见 `analytics/spec.yaml`。

> **CTA 与"双击 tile 打开详情"并存**，不替换。CTA 是显式入口（大多数用户走），双击是隐式快捷（老用户走）。两条路径都进 `/ja/<id>`。GA4 用不同事件区分归因。

### 2.5 Touch 行为契约（scroll vs tap）

Canvas 必须正确区分用户**意图滚动**和**意图点击**，否则把 treemap 区域变成"滚动死区"。

| 阶段 | 行为 |
|---|---|
| `touchstart` | 记录起点 `{ x, y, t }`。`passive: true` — **不调用 `preventDefault`**，让浏览器决定是否启动 native 滚动 |
| `touchmove` | 不需要拦截。如果用户滚动，浏览器会自然处理 |
| `touchend` | 计算位移 `Math.hypot(dx, dy)`：<br>• `< 10px` AND `duration < 500ms` → 视为 tap，调用 `handleTouchTap(x, y)`<br>• 否则 → 视为滚动结束，**不处理**（不出 tooltip、不导航） |

> 现状 bug（v0.4.2 之前留下的）：`touchstart` 用 `passive: false` + `preventDefault` 后立刻 fire tap → tile 区域内任何手指落点都锁住 native scroll，treemap 变成"滚不动的图"。修复后 tile 区域内可以正常滚动列表。

> Tap 触发延迟：从 touchstart 立即 → touchend 后 100–300ms。这是为了**正确判断意图**的代价，可接受。

> 常量 `TAP_SLOP_PX = 10` / `TAP_MAX_MS = 500` 与 Design.md §7.12 desktop hero search autocomplete 触摸状态机保持一致（同一套阈值适用全站）。

> 视口溢出处理（与 desktop 共享逻辑）见 Design.md §6.4。

---

## 3. 移动端响应式规则汇总

### 3.1 ≤768px（mobile）

- `#wrapper padding: 16px 16px 60px`，**改 `display: flex; flex-direction: column`** 以便 §1 mobile-hero / treemap / 旧 chrome 通过 `order` 重排
- `h1 font 1.3rem`，flex-direction column，gap 8px
- `h1 .lang-switch margin-left 0`（不再 push 到右）
- **§1 `.mobile-hero` 显示**（`display: block`），插在 h1 之下
- **DOM 重排（CSS `order`）**：mobile-hero / loadingState / treemap / .controls / .stats-panel 之间用 order 推 treemap 上来
- **`.dimension-hint`、原 `.search-row` 在 mobile 上 `display: none`**（mobile-hero 取代它们）
- `.intro font 0.88rem`, line-height 1.75
- `.controls gap 10px, padding 10px 12px`，**移到 treemap 之后**
- `.layer-toggle` 横向滚动
- `.gradient-legend` 占满宽度 + 居中
- `.stats-panel` **移到 treemap 之后**
- `.stats-row gap 14px, font 0.78rem`
- `#tooltip` 进入 touch-mode（详见 §2.1）
- `.meta-card` 单列
- treemap 高度切换为 `w × 2.6`，标签 minW/H 减半

### 3.2 ≤480px（compact-mobile）

- `top-banner` 缩字
- `h1 font 1.2rem`
- `stats-panel: 2 columns`
- `stat-block padding 10px 12px`，stat-value 1rem
- `tier-table font 0.7rem`
- `mini-hist height 28px`（原 32px）
- `dimension-hint` 改 column 排列
- `layer-toggle` 改 wrap（不再滚动）
- `palette-toggle margin-left 0`
- `disclaimer / usage-notice / intro-details / meta-card` 全部缩字 + 缩 padding
- `#wrapper padding 14px 12px 50px`

### 3.3 ≤360px（tiny-mobile）

- `stats-panel: 1 column`
- `h1 font 1.1rem`
- `h1 .h1-sub font 0.74rem`

### 3.4 ≤540px（share buttons 触摸增强）

- `share-btn 36×36`（默认 32×32）

---

## 4. `/map` 页规范（mobile-first 独立页）

### 4.0 适用范围

- 新建 `map.html`，Vercel 路径 `/map`
- 影响 `index.html` mobile 段（≤768px）：treemap canvas 改为 preview 卡
- 影响 `scripts/build_occupations.py`：新增 SVG 缩略图生成步骤
- 影响 `scripts/build_occupations.py` 生成的 `ja/<id>.html`：底部加 "← 職業マップへ" 链接
- 影响 `sitemap.xml`、`vercel.json`（如需 rewrite）

> **桌面端 `index.html` 嵌入式 treemap 完全不变**，本节只描述 mobile + 新页面。

---

### 4.1 IA 决策

| 设备 | `/` 首页 treemap 体验 | `/map` 体验 |
|---|---|---|
| Desktop（≥769px） | 嵌入完整 treemap（Design.md §5 现状） | 同 mobile 版（max-width 900px 居中），不为桌面单独优化 |
| Mobile（≤768px） | 仅 preview 卡 → tap 跳 `/map` | 全屏 sector segmented treemap |

**桌面首页不显示 preview 卡**（嵌入式 treemap 已在视野内，preview 重复且占位）。

---

### 4.2 Mobile 首页 — Map preview 卡

位于现有 mobile hero（§1）+ search row + chips 之后。

```
┌──────────────────────────────────────┐
│ 職業マップ           全 552 職業      │  ← title row
│ 面積 = 就業者数・色 = AI 影響         │  ← legend caption
├──────────────────────────────────────┤
│  [inline SVG 缩略图，~120-160px 高]   │
├──────────────────────────────────────┤
│   ┌──────────────────────────────┐   │
│   │   マップを探索する  →         │   │  ← primary CTA
│   └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

- **整张卡可点击**（不只是按钮）→ `/map`
- 缩略图 = build 时生成的 inline `<svg>`，无 fetch、无 JS
- 颜色 token：背景 `--bg-2`，文字 `--ink-1` / `--ink-2`，CTA 描边 `--accent`
- 边距：复用 Design.md §2.3 `--space-section` 与 Design.md §7 通用卡片 padding
- 仅在 `@media (max-width: 768px)` 渲染；桌面 `display: none`

---

### 4.3 `/map` 页 — 顶部 sticky 区域

三层 sticky（从上到下）：

```
┌─ Layer 1: header (sticky, top:0) ─────┐
│ ←       職業マップ                     │  44px 高，背景 --bg-1
├─ Layer 2: search (sticky, top:44px) ──┤
│ 🔍 気になる職業を入力     [診断]       │  56px 高
├─ Layer 3: chips (sticky, top:100px) ──┤
│ 横向滚动: [全て] [事務] [専門技術]…    │  48px 高
│           並べ替え: [AI影響↓ ▾]       │
└────────────────────────────────────────┘
```

- 三层 sticky 总高 **148px**（mobile）/ **148px**（desktop）
- iOS Safari sticky 跳动：用 `transform: translate3d(0,0,0)` 兜底
- chips 行右端固定 sort dropdown，左侧 sector chips 横向 scroll-snap

#### 4.3.1 Sector chips

- 数据源：`data.sectors.json`（JILPT 大分類，10-12 项）
- 单选；默认 `[全て]` 高亮
- 选中状态：背景 `--accent`，文字 `--bg-1`
- 切换 → 写 URL `?sector=<key>` → 切换 segmented view

#### 4.3.2 Sort dropdown

- 选项：`AI影響↓` / `AI影響↑` / `年収↓` / `就業者数↓`
- 默认 `AI影響↓`
- 切换 → 写 URL `?sort=<key>` → 重排当前 sector 的 treemap

#### 4.3.3 搜索框

- 行为完全等同 Design.md §7.12 desktop hero search（autocomplete → 跳 `/ja/<id>`）
- 不在 map 内做"高亮/聚焦"，搜索 = 全站快捷跳转
- 触摸状态机沿用 §2.5 / Design.md §7.12（`TAP_SLOP_PX=10` / `TAP_MAX_MS=500`），全站统一

---

### 4.4 `/map` 页 — Sector segmented treemap

**核心：不把 552 格塞一屏**。按 sector 分段，每段独立 treemap。

```
┌──────────────────────────────────────┐
│ 事務  (43 職業)              [折りたたみ]│  ← sector header
│ ┌──────────────────────────────────┐  │
│ │  treemap (该 sector 内职业)       │  │  ← 高度 = sqrt(职业数) × scale
│ └──────────────────────────────────┘  │
├──────────────────────────────────────┤
│ 専門・技術  (98 職業)        [折りたたみ]│
│ ┌──────────────────────────────────┐  │
│ │  treemap                          │  │
│ └──────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- 当 `sector chip = 全て`：纵向列出全部 sector 段，每段可折叠
- 当 `sector chip = 事務`：只显示 `事務` 段，自动展开占满视口
- 每段内部用 squarified treemap（同 Design.md §5）
- min cell size = **44px²**（触摸目标），小于阈值的合并为段尾 "その他 (n 職業)"
- 段头 sticky 副标题（滚动时跟手）
- 颜色 token、透明度、字体颜色策略：100% 复用 Design.md §5（视觉一致性硬约束）

**fallback（D4 兜底方案 A）**：如分段视图实现成本过高 → 退回单一 squarified treemap，加 pinch-to-zoom；该退化路径在 PR 描述中标注。

---

### 4.4.1 重渲染契約（不可破壊 scroll · 硬規則）

> 由 v1.3.x 移动滑动 bug 反推：treemap 重渲染必须保护用户 scroll 位置。本节规则**适用于 `/map` 上所有动态重排逻辑**（`renderMap` / `renderList` / 错误态 / 未来任何替换 `$content` 内容的入口）。

#### A. DOM 替换：原子操作，禁止 wipe-and-rebuild

| | 写法 | 后果 |
|---|---|---|
| ❌ 禁止 | `el.innerHTML = ''` 后再 `appendChild(frag)` | 第一行同步触发 reflow，文档高度塌陷为 0；浏览器立刻把 `scrollTop` clamp 到 0；append 后内容回来但 scroll 已被改写。**用户被甩到顶端**。 |
| ✅ 必须 | `el.replaceChildren(frag)` | 单次原子 DOM 操作，文档高度从旧值直接跳到新值，**不经过中间帧 0**。`scrollTop` 仅在新高度 < 当前 scrollY 时才被 clamp（边界情况）。 |

兼容性：Safari 14+ / Chrome 86+ / Firefox 78+。低于此版本可忽略（站点目标用户 2026 年新设备）。

#### B. resize 触发：只在容器宽度真正变化时重排

squarified layout 只依赖 `$content.clientWidth`（[map.html](../map.html) `renderMap` / `mergeSmallCells` / `squarify` 全部按宽度算面积）。容器高度由数据驱动（`sectorContainerHeight(recs.length)`），与 viewport 高度无关。

**因此**：mobile 浏览器 URL bar 收起触发的 `window.resize`（仅高度变化）**绝不能**触发重排。

| | 监听器 | 何时触发 |
|---|---|---|
| ❌ 禁止 | `window.addEventListener('resize', …renderMap…)` | URL bar 收起、键盘弹出、设备旋转 height 变化等都会触发，绝大多数情况下宽度未变，纯无谓 CPU + 电量。 |
| ✅ 必须 | `ResizeObserver(el)` 观察容器本身，且回调内部缓存 `prevWidth`，宽度未变 early-return | 只在 `$content` 真实宽度变化时才触发（设备旋转 / 桌面拖窗 / 未来引入侧栏布局都正确响应）。|

#### C. 三层防御纵深（互相正交，单层失效另两层依然兜底）

| 层 | 实现 | 角色 |
|---|---|---|
| L1 | `replaceChildren` 原子替换 | **治本**：任何触发源都不可能再弄丢 scroll |
| L2 | width 缓存 early-return | **节流**：避免不必要的重新 squarify 计算 |
| L3 | `ResizeObserver($content)` 替代 `window.resize` | **精度 + future-proof**：window 宽度不等于容器宽度的场景也能正确响应 |

#### D. 回归验证（人工 · 真机）

每次改动 `renderMap()` / `renderList()` / `$content` 写入逻辑，必须在 mobile 真机走完以下用例：

1. 打开 `/map` → 向下滑动两屏 → 继续向下滑（URL bar 收起触发 resize 的典型场景）→ scroll 位置不变
2. 向上滑动至 URL bar 重新出现 → scroll 位置正确响应手指
3. 设备横竖切换 → 重排发生，但 scroll 应保持视觉锚定（接受小幅偏移，不接受跳到顶）
4. 切换 sector chip → 接受跳到顶（主动操作）
5. 切换 sort dropdown → 接受跳到顶（主动操作；如未来希望保持 scroll，需额外保护）

---

### 4.5 `/map` 页 — Bottom sheet

Tap 任意 cell 时升起。

```
┌──────────────────────────────────────┐
│       ━━━━━ (drag handle)             │
├──────────────────────────────────────┤
│ データ入力                       ✕     │  ← 标题 + close
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

#### 关闭交互（D3 = A）

- Drag handle 下拉关闭（速度阈值 > 0.3 px/ms 立即关；缓慢拖动按位置）
- 背景 backdrop tap 关闭（半透明遮罩 `--ink-1` @ 40% alpha）
- ✕ 按钮关闭
- iOS safe area inset：`padding-bottom: env(safe-area-inset-bottom)`

#### 内容（D2 同意）

- 字段：职业名 / ランキング徽章（仅当排名 ≤ Top 50） / AI影響度 / 年収 / 就業者数 / CTA / ✕
- 不含相邻职业（详情页职责）
- 数据来源：`data.treemap.json` 已包含；无额外 fetch

#### 视觉

- 高度：内容自适应，max-height 50vh
- 圆角：`border-radius: 16px 16px 0 0`
- 背景 `--bg-1`，shadow `0 -8px 24px rgba(0,0,0,0.16)`
- 入场动画：`transform: translateY(100%) → 0`，`cubic-bezier(0.16, 1, 0.3, 1)`，280ms
- 遵循 Design.md §9.4 `prefers-reduced-motion` → 跳过动画直接显示

---

### 4.6 URL state & 深链（D5 = B）

```
/map                           默认（全 sector + AI影響↓）
/map?sector=事務               单 sector 视图
/map?sector=事務&sort=salary   单 sector + 自定排序
/map?job=12345                 自动打开该职业的 bottom sheet（深链）
/map?sector=事務&job=12345     组合
```

- 用 `URLSearchParams` 双向绑定，无 router 库
- 切换 chip / sort / 打开 bottom sheet → `history.replaceState`（不污染历史栈）
- 关闭 bottom sheet → 移除 `?job` 参数
- 浏览器 back：从 `/map` 回上一页（默认行为）；从 `/ja/<id>` 回 `/map?job=<id>` 时自动打开 sheet（用 referrer 判断，best-effort）
- `?sector=` 不存在的 key → fallback `全て` + console warn

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

- **OG image**：扩展 `api/og.tsx` 接受 `?page=map`，输出"全 552 職業" + 缩略图样式
- **schema.org**：`Dataset` 描述整体 + `ItemList` 列出 Top 50 职业（按 ranking）
- 不为 `?sector=` query 单独建 canonical，所有 query 视为同一 canonical `/map`
- `?sector=` 衍生 URL 加进 sitemap.xml（10-12 条），priority 0.7

---

### 4.8 Analytics events

GA4 自定义事件 4 个，全部新增到 `analytics/` spec：

| Event | 触发时机 | params |
|---|---|---|
| `map_open` | `/map` 页加载完成 | `referrer: 'home_card'` / `'direct'` / `'detail'` |
| `map_filter` | sector chip / sort dropdown 切换 | `sector: <key>`, `sort: <key>` |
| `map_cell_tap` | 任意 cell 被点击（bottom sheet 升起） | `job_id`, `sector`, `rank` |
| `map_detail_click` | bottom sheet "詳細を見る" 被点击 | `job_id` |

四件套 analytics scripts（CF / GA4 / Vercel WA / Vercel Speed Insights）必须全部进入 `map.html` `<head>`（按 PII / 一致性硬规则）。

---

### 4.9 Loading / Skeleton / Error

- Sticky 区域 (header / search / chips) 立即渲染（HTML 内联）
- Treemap 区域初始显示 skeleton：每个 sector 段一个浅灰矩形 + "読み込み中…"
- `data.treemap.json` 通过 `<link rel="preload" as="fetch" crossorigin>` 在 `<head>` 启动
- Fetch 成功 → `requestIdleCallback` 渲染（不阻塞 sticky 可交互）
- Fetch 失败 → "データを読み込めません。 [再読み込み] " 按钮（`location.reload()`）
- 慢 3G 超时（>10s）→ 显示同失败文案

---

### 4.10 Build pipeline（缩略图）

`scripts/build_occupations.py` 扩展：

1. 在生成 `data.treemap.json` 之后，新增步骤 `generate_map_thumbnail()`
2. 输出 `dist/map-thumb.snippet.html`（一段 inline `<svg>` 字符串）
3. `index.html` 在 mobile preview 卡处通过 build-time include 注入（不是运行时 fetch）
4. SVG 简化策略：
   - 只取 Top 30 职业按面积排（剩余合并为底部一条 "その他"）
   - 颜色用 Design.md §2.1 Treemap 配色函数，但精度降为 5 档
   - 输出大小目标 < 4KB inline
5. include 机制：用 build 脚本的 `{{INCLUDE map-thumb}}` 占位符 → sed 替换

---

### 4.11 Sitemap / Footer / 闭环 nav

- `sitemap.xml`：加 `/map` (priority 0.9, changefreq monthly) + `/map?sector=*` (priority 0.7)
- `map.html` footer：完全复用 Design.md §7.10（Privacy / About / Compliance / Data source）
- Footer 全站统一：在 Design.md §7.13 footer follow + share 区域加一个 "職業マップ" 链接（位置 next to "About"）
- **`/ja/<id>` 详情页底部加链接 "← 職業マップへ"**（D6）：永远跳无 query 的 `/map`，让用户重新选择
  - 位置：在 Design.md §7.10 footer 之上、详情正文之下
  - 文案 JA only
  - 影响 `build_occupations.py` 模板 + 所有生成页（按 PII audit 经验，模板和生成页都要改）

---

### 4.12 桌面端行为

- 桌面 `/` 完全不变，**不显示** mobile preview 卡
- 桌面访问 `/map` → 同 mobile 布局，`max-width: 900px; margin: 0 auto`
- 不为桌面 `/map` 做第二套设计（直链 / 分享落地用，主力体验在 `/`）

---

### 4.13 A11y（PENDING — 待决策）

最低线（无论后续怎么定都做）：
- treemap canvas 加 `role="img"` + `aria-label="552 職業の AI 影響ヒートマップ"`
- 所有 chips / dropdown / bottom sheet 走原生 `<button>` / `<select>`
- Sticky 区域键盘 focus visible（沿用 Design.md §9.3）
- Reduced motion → bottom sheet 跳过 280ms 动画

**待拍板**：要不要做 "リスト表示に切り替え" toggle，输出 `<ol>` 版本作为 screen reader / 键盘用户兜底？
- 工作量：~半天
- 收益：treemap 对 SR 用户彻底不可用，列表是兜底
- 当前桌面 treemap 同样没有 SR 兜底（Design.md §10 现状）→ 一致性论点说"也不做"也通

> 决策悬置；§4 实施时按"最低线"先做，列表 toggle 看后续是否补。

---

### 4.14 不在本期范围

- Dark mode 单独适配（站点已有暗色基础，沿用 Design.md §3）
- 横屏专门优化（按竖屏做，横屏自然展开）
- PWA / Service Worker
- 多语言（JA-only 已在 v1.4.0 锁定）

---

## 5. 修改本文件流程

1. 在 PR 描述中明确写「本次涉及 Design-Mobile.md §X.Y」
2. 同 PR 内同时修改 Design-Mobile.md 与代码（不允许只改一边）
3. 如同时涉及 Design.md 共享章节（§2 token / §3 主题 / §4 断点 / §5 treemap / §6 tooltip / §7 components 等），两文件同步改、同一 PR 内完成
4. 视觉层变更附 before/after 截图（≥768 + ≤480 各一张）
5. 文末「修订历史」追加一行：日期 / 涉及章节 / 一句话原因

---

## 6. 修订历史

| 日期 | 章节 | 改动 | 原因 |
|---|---|---|---|
| 2026-05-06 | 全文 | 文件创建 | 从 Design.md 拆分 mobile 专属内容（原 §6.2 / §6.3 / §6.5 / §6.6 / §6.7 mobile tooltip → 本文件 §2；原 §7.11 Mobile Hero → §1；原 §8 移动端自适应 → §3；原 §16 `/map` 页规范 → §4）。共享底层（颜色 token / 字体 / 间距 / 主题 / 断点 / treemap 视觉 / 通用组件 / 桌面 hero / a11y / palette 准则）留在 Design.md。`/m/*` 架构存档 `MOBILE_DESIGN.md` 同步删除（v1.1.0 已废弃 4 个月，零 active 引用）。Q1=C / Q2=A / Q3=B 决策见 CHANGELOG。|
| 2026-05-06 | §4.4.1 新增 | 新增「重渲染契約（不可破壊 scroll · 硬規則）」 | 移动端真机 bug：用户向下滑动时页面自动弹回顶端。根因为 `window.resize`（URL bar 收起触发）调用 `renderMap()`，内部 `innerHTML = ''` → `appendChild` 两步，第一步同步 reflow 导致文档高度塌陷为 0，浏览器 clamp `scrollTop` 至 0。规范化"原子替换 + 宽度变化才重排"为 `/map` 重渲染硬规则，附三层防御纵深与真机回归验证清单。|

---

> 站点：https://mirai-shigoto.com
