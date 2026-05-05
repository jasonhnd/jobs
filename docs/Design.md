# Design.md — mirai-shigoto.com 设计规范

> 这是本站**桌面版**设计的唯一真相源（single source of truth）。
> 今后任何桌面侧视觉/交互/响应式行为变更，**先改这个文件**，再让代码跟随这个文件。
> 代码与本文件冲突时，**以本文件为准**，代码视为应当被修正的偏差。
>
> **v1.2.0 起单一 URL 架构**：v1.1.0 引入的 `/m/ja/*` + `/m/en/*` 已全部删除，移动体验合并到主 URL `/<lang>/<id>`，靠 CSS `@media` 自适应。Direction C 设计语言已合入桌面（视觉 + 文案），详见 §0.1。
> [MOBILE_DESIGN.md](./MOBILE_DESIGN.md) 保留作为 **v1.1.0 历史 + Direction C token 来源**（index.html / 详情页 CSS comments 引用 `synced from styles/mobile-tokens.css`）。

---

## 0. 适用范围

- `index.html`（首页 treemap，桌面 + 既有"宽响应式至 mobile"实现）
- `privacy.html` / `compliance.html` / `about.html`（既有静态页）
- `scripts/build_occupations.py` 生成的 1104 个 `ja/<id>.html` / `en/<id>.html` 职业详情页（桌面 + 既有响应式至 mobile）

> 当下设计源自 v0.4.x 系列，桌面版当前规范版本 v1.x（见 §15 修订历史）。

### 0.1 与 MOBILE_DESIGN.md 的关系

从 v1.1.0 起，本站长出**两套并存的设计语言**：

| 文档 | 适用 URL | 设计方向 | 设计 Token |
|---|---|---|---|
| **Design.md**（本文件）| `index.html`, `/ja/<id>`, `/en/<id>`, `privacy.html`, `compliance.html`, `about.html` | **数据 dashboard** —— treemap 灵魂、暗色优先、信息密度高 | `--bg-*`, `--ink-*`（无前缀变量）|
| **MOBILE_DESIGN.md** | `/m/ja/*`, `/m/en/*`, `/m/ja/<id>`, `/m/en/<id>` | **Direction C: Warm Editorial** —— 衬线大字、sage 绿 + テラコッタ橙 + 暖米底 | `--m-*` 前缀 |

两套设计**语义上隔离**（不同 token、不同字体、不同视觉哲学），但**数据层共享**（同一份 `dist/data.*.json` 投影喂给两边）。

桌面版 detail `/ja/<id>` 和移动版 detail `/m/ja/<id>` 是**两套不同 HTML**，桌面通过 `<link rel="canonical">` 持有"唯一权威 URL"地位（移动版指向桌面版以避免 SEO 重复内容惩罚）。详见 [MOBILE_DESIGN.md §6](./MOBILE_DESIGN.md#6-移动版-detail-的-url-与-seo-策略)。

后续 minor / major 调整都以补丁形式追加在文末「修订历史」。

---

## 1. 核心原则

1. **自查路径优先于纯展示，但数据仍是品牌资产**。第一屏必须给焦虑型流量一个最短的查询入口（搜索框 + 热门 chips），让用户 1 步到达自己的职业详情页。treemap 作为站点的视觉差异化资产保留在第二屏（移动端）或同屏下半部分（桌面）。**视觉重量分配**：搜索 hero 占据视觉焦点，treemap 仍是品牌核心，周边元素（标签、说明、页脚）退到次要层级。
2. **双主题不是装饰**。light / dark 都是一等公民，每一个组件都要在两套配色下都美。**默认跟随系统**，用户显式切换后用 localStorage 持久化。
3. **移动优先 ≠ 移动专属**。设计在桌面（≥768px）以「数据密度高」呈现，在手机（<768px）以「关键信息可读」呈现。两端都要打磨到位。
4. **暖色 = 高风险，冷色 = 低风险**。这是站点的视觉语义契约，不可反转。色盲模式（viridis）是替代方案，不能改变语义方向。
5. **变更必须先动 Design.md**。代码上的临时实验不算「设计」，只有当本文件描述的状态被采纳，才视为正式设计。

---

## 2. 设计 Token

### 2.1 颜色

#### Dark（默认 / 系统暗色）
```css
--bg:     #0b0d10;   /* page background */
--bg2:    #14171c;   /* card / surface background */
--fg:     #e9eef5;   /* primary text */
--fg2:    #8a93a3;   /* secondary text */
--accent: #ffb84d;   /* primary accent — links, active states */
--border: rgba(255, 255, 255, 0.08);
```

#### Light
```css
--bg:     #fafafa;
--bg2:    #ffffff;
--fg:     #0f1217;
--fg2:    #5a6470;
--accent: #d97706;   /* darker amber for sufficient contrast on white */
--border: rgba(0, 0, 0, 0.10);
```

#### 语义色（不随主题变化）
```css
--high-risk-marker:  #ff5050;   /* top-banner badge */
--mid-warm-emphasis: #ff8a3d;   /* "非公式" / 强调 strong */
```

#### Treemap 配色函数

| 主题 | 函数 | t=0 锚点 | t=0.5 锚点 | t=1 锚点 |
|---|---|---|---|---|
| Dark | `greenRedCSSDark` | `rgb(30, 180, 40)` 森林绿 | `rgb(230, 160, 20)` 琥珀 | `rgb(255, 30, 15)` 鲜红 |
| Light | `greenRedCSSLight` | `rgb(15, 195, 105)` 鲜翠 | `rgb(235, 115, 25)` 烧橘 | `rgb(235, 40, 55)` 鲜红 |

`t` 是经过 `boostContrast(clamp(t))` 处理的归一化 risk score（0=低风险, 1=高风险）。

#### Treemap 透明度（baseAlpha）

| 状态 | Dark | Light |
|---|---|---|
| Dimmed（搜索 miss） | 0.18 | 0.18 |
| Hover | 0.92 | 1.0 |
| 普通 | 0.62 | 0.95 |

> Light 模式 alpha 必须高（≥0.85）— 因为白底会把任何低 alpha 颜色"洗白"，破坏对比层级。

---

### 2.2 排版

#### 字体栈
```css
font-family:
  -apple-system, BlinkMacSystemFont,
  "Hiragino Sans", "Yu Gothic UI",
  "Segoe UI", Roboto, sans-serif;
```

> 系统字体优先，不引入 web font。日文优先苹果黑体 / Yu Gothic，英文回退 SF Pro / Segoe UI。

#### 字号刻度

| Token | 值 | 用途 |
|---|---|---|
| h1 | `clamp(1.5rem, 1rem + 1.5vw, 2rem)` | 页面标题 |
| h1.h1-sub | 0.85rem | 标题副文 |
| body / intro | 0.95rem | 正文段落 |
| meta-card | 0.86rem | 元数据卡片 |
| stat-value | 1.1rem | 统计数值 |
| stat-label / explainer-heading | 0.7-0.78rem，UPPERCASE，letter-spacing 0.05-0.08em | 章节标签 |
| tooltip body | 0.82rem | tooltip 内容 |
| tooltip title | 0.95rem | tooltip 标题 |
| footer | 0.72rem | 页脚 |

#### Line-height

- 正文 / intro：1.7-1.85（高，便于长 CJK 段落阅读）
- 卡片 / 紧凑文本：1.5
- 标题：1.4

---

### 2.3 间距 & 圆角

```css
/* 内距 */
--pad-card-inline: 14-20px;
--pad-card-block:  12-18px;

/* 圆角 */
--radius-pill:   999px;   /* 语言切换、主题切换按钮 */
--radius-card:   8px;     /* 所有卡片、tooltip、disclaimer */
--radius-chip:   6px;     /* dimension-hint、layer-toggle */
--radius-badge:  4px;     /* top-banner badge */

/* 阴影 */
--shadow-card:    0 1px 4px rgba(255, 80, 80, 0.3);  /* badge only */
--shadow-tooltip: 0 8px 32px rgba(0, 0, 0, 0.6);
```

#### 边框颜色

- 默认 surface：`var(--border)`（半透明 white/black）
- 强调 surface（meta-card 左条、disclaimer 左条）：`3-4px` 实心 `var(--accent)` 或 `#ffb84d`

---

### 2.4 布局尺寸

```
#wrapper max-width:   1400px
#wrapper padding:     24px 28px 80px (desktop)
                      16px 16px 60px (≤768)
                      14px 12px 50px (≤480)

阅读区 max-width:      880px (intro / disclaimer / usage-notice / meta-card)
```

---

## 3. 主题系统

### 3.1 三态模型

1. **system**（无 `data-theme` 属性）— 跟随 `prefers-color-scheme`
2. **light**（`<html data-theme="light">`）— 用户显式选择
3. **dark**（`<html data-theme="dark">`）— 用户显式选择

### 3.2 实现规则

- **No-flash inline script**：必须放在 `<head>` 顶部，在任何样式表加载前读 `localStorage.theme` 设置 `data-theme` 属性。
- **CSS 优先级**：`:root[data-theme="…"]` 选择器必须排在 `@media (prefers-color-scheme)` 之**后**，确保显式选择压过系统偏好。
- **持久化**：用户点击 toggle 后，写 `localStorage.setItem("theme", next)`。
- **GA4 事件**：每次点击 toggle 发 `theme_change` 事件，参数：`from`/`to`/`was_explicit`/`system_pref`（详见 `analytics/spec.yaml`）。
- **画布重绘**：treemap 等 canvas 渲染**必须**在主题切换时重绘（`if (typeof draw === "function") draw()`），否则色板会停在旧主题。

### 3.3 切换按钮

- 位置：`<h1>` 内 `.lang-switch` 之前
- 形状：32×32 圆形（`border-radius: 999px`），内含 14×14 SVG 图标
- 图标：light 模式显示 🌙（icon-moon），dark 模式显示 ☀（icon-sun）
- Hover：`color: var(--accent)`, `border-color: var(--accent)`
- 焦点：`outline: 2px solid var(--accent); outline-offset: 2px`

---

## 4. 响应式断点

| 断点 | 名字 | 适配对象 |
|---|---|---|
| `≥768px` | desktop | 桌面、平板横屏 |
| `≤768px` | mobile | 手机横屏 / 平板竖屏 |
| `≤540px` | small-mobile | 普通手机竖屏 |
| `≤480px` | compact-mobile | 较窄手机 |
| `≤360px` | tiny-mobile | iPhone SE 1st gen 等 |

> JS 内 `isMobile = window.innerWidth < 768`。CSS 用 `@media (max-width: …)`。两者必须保持 768px 这个分界点同步。

---

## 5. Treemap 视觉化

### 5.1 高度比例

| 设备 | 高度 = 宽度 × n |
|---|---|
| Desktop（≥768px） | **w × 1.05** |
| Mobile（<768px） | w × 2.6 |

> Desktop 取 1.05 是为了让 552 个 tile 中的小 tile 有足够纵向空间显示职业名。
> Mobile 取 2.6 是因为屏幕窄，需要纵向延展。

### 5.2 标签可见门槛

| 阈值 | Desktop | Mobile |
|---|---|---|
| `labelMinW` | 50px | 30px |
| `labelMinH` | 18px | 14px |
| `subInfoMinW`（副信息） | 70px | 50px |
| `subInfoMinH` | 32px | 26px |
| `fontMin` | 9px | 8px |
| `fontMax` | 13px | 12px |

### 5.3 Tile 文字颜色

- 主标签：`rgba(255,255,255,0.92)`（hover 时 `#fff`）
- 副信息（risk score）：`rgba(255,255,255,0.55)`

> Light 模式下白字配深色 tile 仍然 OK（因为 alpha=0.95 加深底色）。**禁止改成黑字** — 会破坏与 dark 模式的视觉一致性。

### 5.4 Hover 边框

`strokeStyle: "#fff"`, `lineWidth: 2`, 绘制于 hover tile 周围（两个主题下都白边）。

### 5.5 Canvas 背景

- Dark：`#0b0d10`（与 `--bg` 一致，无缝衔接）
- Light：`#fafafa`

### 5.6 GAP（tile 间距）

`GAP = 1px`（半 px 在 tile 两侧），保证视觉上 tile 之间有清晰分隔。

---

## 6. Tooltip

### 6.1 Desktop（hover-mode）

```
position:    fixed
background:  var(--bg2)
border:      1px solid var(--border)
radius:      8px
padding:     14px 16px
font-size:   0.92rem
line-height: 1.55
max-width:   400px
shadow:      0 8px 32px rgba(0,0,0,0.6)
opacity transition: 0.12s
pointer-events: none  /* hover 模式不可点击 */

.tt-title {
  font-weight: 600
  font-size:   1.06rem
  color:       var(--fg)   /* 双主题统一，不写死 #fff */
  margin-bottom: 8px
}
```

### 6.2 Mobile（touch-mode）

- 添加 `.touch-mode` class
- `pointer-events: auto`
- 显示 `.tt-close` 关闭按钮（右上角 ×）— 详细规格见 §6.5
- 显示 `.tt-cta` 按钮（"詳細を見る →" / "View details →"）— 详细规格见 §6.6
- `max-width: calc(100vw - 32px)`
- `max-height: calc(100vh - 32px)`
- `overflow-y: auto` + `-webkit-overflow-scrolling: touch`
- `font-size: 0.78rem`，`padding: 10px 12px`

### 6.3 Tap-outside 行为（Mobile）

点击 tooltip 外部任意位置自动关闭。点击 tile 切换 tooltip。

### 6.4 视口溢出处理

JS 必须根据 `window.innerWidth` / `innerHeight` 动态调整 tooltip 位置，确保不溢出视口。详见 `index.html` 中 `positionTooltip()` 逻辑（v0.4.2 引入）。

### 6.5 Close button (`.tt-close`) 触摸目标

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

### 6.6 Tooltip CTA (`.tt-cta`)

Mobile touch-mode tooltip 必须有一个**显眼的"進入詳細页"按钮**，否则用户看到信息却不知道能点进去（实测漏斗大漏点）。

| 字段 | 值 |
|---|---|
| 元素 | `<a id="tooltipCta" class="tt-cta" target="_blank" rel="noopener">` |
| 文本 | JA `詳細を見る →` / EN `View details →` |
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

**href 契约**：showTooltip() 时 JS 设置 `cta.href = occUrl(occupation)`（`/ja/<id>` 或 `/en/<id>`）。

**GA4 事件**：点击 fire `tooltip_cta_click` 事件，参数 `occupation_id` / `ai_risk_score` / `language` — 详见 `analytics/spec.yaml`。

> **CTA 与"双击 tile 打开详情"并存**，不替换。CTA 是显式入口（大多数用户走），双击是隐式快捷（老用户走）。两条路径都进 `/ja/<id>` 或 `/en/<id>`。GA4 用不同事件区分归因。

### 6.7 Touch 行为契约（scroll vs tap）

Canvas 必须正确区分用户**意图滚动**和**意图点击**，否则把 treemap 区域变成"滚动死区"。

| 阶段 | 行为 |
|---|---|
| `touchstart` | 记录起点 `{ x, y, t }`。`passive: true` — **不调用 `preventDefault`**，让浏览器决定是否启动 native 滚动 |
| `touchmove` | 不需要拦截。如果用户滚动，浏览器会自然处理 |
| `touchend` | 计算位移 `Math.hypot(dx, dy)`：<br>• `< 10px` AND `duration < 500ms` → 视为 tap，调用 `handleTouchTap(x, y)`<br>• 否则 → 视为滚动结束，**不处理**（不出 tooltip、不导航） |

> 现状 bug（v0.4.2 之前留下的）：`touchstart` 用 `passive: false` + `preventDefault` 后立刻 fire tap → tile 区域内任何手指落点都锁住 native scroll，treemap 变成"滚不动的图"。修复后 tile 区域内可以正常滚动列表。

> Tap 触发延迟：从 touchstart 立即 → touchend 后 100–300ms。这是为了**正确判断意图**的代价，可接受。

---

## 7. 组件规范

### 7.1 Top Banner（顶部"非公式"警示条）

```
background: linear-gradient(90deg, rgba(255,80,80,0.18), rgba(255,138,61,0.14))
border-bottom: 2px solid rgba(255,80,80,0.55)
padding:    9px 20px (≤480 改 8px 12px)
font-size:  0.82rem (≤480 改 0.74rem)
gap:        12px (≤480 改 8px)

.badge {
  background: #ff5050
  color:      #fff
  padding:    3px 10px
  radius:     4px
  font-size:  0.74rem
  font-weight: 800
  letter-spacing: 0.08em
  shadow:     0 1px 4px rgba(255,80,80,0.3)
}
```

### 7.2 Stats Panel（统计面板）

- `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`
- gap: 12px → 8px (≤480) → 6px (≤360)
- ≤480 强制 `repeat(2, 1fr)`
- ≤360 强制 `1fr`（单列）

### 7.3 Stat Block

```
background:  var(--bg2)
border:      1px solid var(--border)
radius:      8px
padding:     12px 14px → 10px 12px (≤480)

.stat-label { font 0.7rem, UPPERCASE, letter-spacing 0.05em, color var(--fg2) }
.stat-value { font 1.1rem (≤480: 1rem), weight 600, color var(--fg) }
.stat-sub   { font 0.72rem (≤480: 0.68rem), color var(--fg2) }
```

### 7.4 Meta Card（数据来源块）

- 左侧 3px `var(--accent)` 实心条
- `grid-template-columns: max-content 1fr` （≤768 改 `1fr`）
- meta-label 大写 + letter-spacing
- 颜色契约：label = `var(--fg2)`, value = `var(--fg)`, link = `var(--accent)`

### 7.5 Disclaimer

```
background: rgba(255,184,77,0.08)
border:     1px solid rgba(255,184,77,0.4)
border-left: 4px solid #ffb84d
radius:     8px
padding:    16px 20px (≤480: 12px 14px)
strong:     color #ffb84d
```

### 7.6 Layer Toggle（色彩维度切换 chip 组）

- 默认 flex-wrap，desktop 横向排列
- ≤768 改 `flex-wrap: nowrap; overflow-x: auto`（横向滚动）
- ≤480 又改回 `flex-wrap: wrap`（多行而非滚动）
- 选中态：`border-color: var(--accent); color: var(--accent)`

### 7.7 Gradient Legend（左低风险 → 右高风险）

- 高 8px，宽随容器
- gradient: `linear-gradient(to right, low-risk-color, mid, high)`
- 左右各一个文字标签：`低リスク` / `高リスク`

### 7.8 Share Buttons（页脚社媒分享）

```
size:    32×32 (≤540: 36×36 — 触摸目标更大)
shape:   圆形 (radius 999px)
icon:    16×16 SVG, fill: currentColor
default: var(--bg2) bg, var(--fg2) icon

hover (各平台品牌色覆盖):
  X:        #000
  LINE:     #06C755
  Hatena:   #00A4DE
  LinkedIn: #0A66C2
  Copy/Native: var(--accent), color #1a1206
```

### 7.9 Tooltip / Modal Skip Link

```
.skip-link {
  position absolute; left -9999px;
  background var(--accent); color #000;
  padding 8px 14px;
  on focus → left 0;
}
```

### 7.10 Footer

- `font-size: 0.72rem` (≤480: 0.66rem)
- `color: #555c69`（独立色，不用 var）
- 链接颜色 `var(--accent)`

### 7.11 Mobile Hero（Variant C, mobile-only）

mobile (`≤768px`) 专用首屏 hero block。在 desktop 上 `display: none`，不影响桌面版。

**目的**：手机用户打开站点 10 秒内必须看到主图 / 工具入口，避免让 stats / toggles / 说明文字挤占首屏。

**结构**（DOM 顺序自上而下）：

1. `h2.mobile-hero-title` — `あなたの仕事の AI 影響度 を見る` / `See your job's AI impact`，字号 1.35rem (`≤480: 1.2rem`)，`AI 影響度` 用 `var(--accent)` 着色。
2. `.mobile-hero-trust` — 单行信任信号：`552 職業 · LLM スコア · 公開データ由来`。font 0.74rem，`color: var(--fg2)`，居中或左对齐。
3. `.mobile-hero-search` — 搜索输入框 + 🔍 icon prefix。input 占满宽，padding `10px 14px 10px 38px`（左侧留 icon 空间），radius 999px。`placeholder: 職業名で検索（例：事務職）`。绑定 `applyFilter()` + dropdown(共用 §7.12 的 search-suggest 逻辑)。
4. `.mobile-hero-chips` — 5 个职业 chip，横排可 wrap：**事務職 / 経理 / 営業 / CS（カスタマーサポート 缩写）/ 看護師**（与桌面 §7.12 共用同一组）。chip padding `5px 11px`，radius 999px，`border: 1px solid var(--border)`，font 0.78rem。

**桌面行为**（`min-width: 769px`）：`.mobile-hero { display: none }`。

**移动行为**（`max-width: 768px`）：
- `.mobile-hero { display: block }`，置于 h1 之下、treemap 之上。
- DOM 重排：`.controls` / `.stats-panel` 移到 treemap **之后**（`#wrapper` 改 flex-column + `order` 控制），`.dimension-hint` / `.search-row`（旧的，原 desktop 位）`display: none`（mobile-hero 取代它们）。
- 用户首屏看到：top-banner → h1 → mobile-hero → treemap 顶部。`.controls` / `.stats-panel` 滚下后可见，做"探索后操作"。

**Chip 行为契约（Stage 1 起：1 步直达）**：
- 点击 chip → 通过 `CHIP_TO_JOB` 映射 → `window.location.href = occUrl(matched_record)`，1 步跳到对应详情页。
- chip 名 v1 占位（与 §7.12 共用），data-chip 是日文全名，可视显示在窄屏上可缩写（如 `カスタマーサポート` → `CS`）。
- 应在 GA4 数据稳定（2-3 周）后用 top-clicked / top-searched 替换名单。
- GA4 事件：`popular_job_click`，参数 `occupation_id` / `language`。

---

### 7.12 Desktop Hero（Stage 1, search-first）

桌面（≥769px）专用首屏 hero block。在 mobile（≤768px）上 `display: none`，移动端继续用 §7.11。

**目的**：把站点从「探索型 552 职业地图站」转向「自查型 AI 影响度查询工具」，给焦虑型流量最短的查询入口。

**结构**（DOM 顺序自上而下）：

1. `.desktop-hero-utility` — 顶部小工具栏：站点 brand 副文「日本の職業 AI 影響マップ (非公式)」+ lang switch + theme toggle (`#themeToggleDesktop`)。font 0.8rem，居于 max-width 1400 容器内。
2. `h2.dh-title` — 「あなたの仕事はAI 時代にどう変わる？」H2 大标题，「AI 時代」用 `var(--accent)`，font `clamp(1.7rem, 1.2rem + 1.2vw, 2.4rem)`，weight 700。
3. `.dh-lead` — 3 行说明：「職業名を入力すると、AI による影響度と変化しやすい作業を確認できます。 / 転職、リスキリング、キャリアの見直しの参考に。」font 0.95rem，max-width 540px。
4. `.desktop-hero-search` — 搜索 form：输入框（`#searchInputDesktop`）+ 「AI 影響度をチェック」按钮，max-width 560px。
5. `.search-suggest` — 输入时实时下拉建议（top 8）：每条 `<li>` 显示职业名 + AI 影響度，按 (exact match → starts-with → contains → length asc) 排序。键盘 ↑↓ + Enter 可选，鼠标点击跳转。
6. `.desktop-hero-popular-label` + `.desktop-hero-chips` — 5 个固定 chips（与 §7.11 共用同一组）：**事務職 / 経理 / 営業 / カスタマーサポート / 看護師**。

**桌面行为**（`min-width: 769px`）：`.desktop-hero { display: block }`。同时**隐藏**老的 `#wrapper > header > h1` / `.controls` / `.dimension-hint` / `.search-row`（这些被 hero 替代；DOM 保留以保 SEO/可访问性，但 `display: none`）。

**移动行为**（`max-width: 768px`）：`.desktop-hero { display: none }`，移动端继续用 §7.11 `.mobile-hero`。

**交互契约（1 步直达）**：

- 输入框 typing → `applyFilter()` live 高亮 treemap + 实时渲染下拉建议
- Enter / 点「AI 影響度をチェック」按钮 → 跳到 top match 的 `/ja/<id>` 或 `/en/<id>`
- 点 chip → 通过 `CHIP_TO_JOB` 映射跳到对应职业详情页：
  - `事務職 → 一般事務` (id=428)
  - `経理 → 経理事務` (id=430)
  - `営業 → 営業事務` (id=431)
  - `カスタマーサポート → コールセンターオペレーター` (id=64)
  - `看護師 → 看護師` (id=156, 精确匹配)
- 点下拉 li / 键盘 Enter → 跳到对应 `/ja/<id>`
- 无匹配 → 不跳，显示 `.search-noresult` 「該当する職業が見つかりません」

**GA4 事件**：`popular_job_click`（chip）/ `job_search_navigate`（Enter / button / suggest item）。

**chips 名单是 v1**：与 §7.11 共用一组 5 chips，一处改动两端同步。GA4 数据稳定（2-3 周）后应替换为 top-clicked / top-searched。

---

### 7.13 Footer Follow + Share（Stage 1，全站统一）

首页 + 1104 个 `/ja/<id>` 和 `/en/<id>` 详情页**统一**使用同一个 footer follow + share 区块。视觉分两层：

1. **Follow CTA（突出）**：橙色块 `.follow-cta`，链 `https://x.com/miraishigotocom`。
   - 内容：📬 icon + 「X でフォローする / 毎日の職業分析を受け取る」(EN: 「Follow on X / Daily occupation insights」)
   - GA4 事件：`x_follow_click`（详情页带 `occupation_id` 参数）
2. **Share divider**：「このページをシェア」(EN: 「Share this page」) — 横线 + 中间文字
3. **Share buttons row（小图标）**：6 个圆形 32×32（mobile 36×36）按钮
   - X / LINE / Hatena / LinkedIn / **Facebook（Stage 1 新加）** / Copy
   - **Native**（`navigator.share()`）只在支持的设备显示（默认 hidden）
   - 每个 hover 切到对应平台品牌色（X #000 / LINE #06C755 / Hatena #00A4DE / LinkedIn #0A66C2 / Facebook #1877F2 / Copy var(--accent)）
   - GA4 事件：`share_click`，参数 `platform`、`language`、`occupation_id`（详情页）

**UTM 契约**：所有 share URL 都携带 `?utm_source=<platform>&utm_medium=<social|im|copylink|share_api>&utm_campaign=footer_share&utm_content=site|occ`。

---

## 8. 移动端自适应规则汇总

### 8.1 ≤768px（mobile）

- `#wrapper padding: 16px 16px 60px`，**改 `display: flex; flex-direction: column`** 以便 §7.11 mobile-hero / treemap / 旧 chrome 通过 `order` 重排
- `h1 font 1.3rem`，flex-direction column，gap 8px
- `h1 .lang-switch margin-left 0`（不再 push 到右）
- **§7.11 `.mobile-hero` 显示**（`display: block`），插在 h1 之下
- **DOM 重排（CSS `order`）**：mobile-hero / loadingState / treemap / .controls / .stats-panel 之间用 order 推 treemap 上来
- **`.dimension-hint`、原 `.search-row` 在 mobile 上 `display: none`**（mobile-hero 取代它们）
- `.intro font 0.88rem`, line-height 1.75
- `.controls gap 10px, padding 10px 12px`，**移到 treemap 之后**
- `.layer-toggle` 横向滚动
- `.gradient-legend` 占满宽度 + 居中
- `.stats-panel` **移到 treemap 之后**
- `.stats-row gap 14px, font 0.78rem`
- `#tooltip` 进入 touch-mode（详见 §6.2）
- `.meta-card` 单列
- treemap 高度切换为 `w × 2.6`，标签 minW/H 减半

### 8.2 ≤480px（compact-mobile）

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

### 8.3 ≤360px（tiny-mobile）

- `stats-panel: 1 column`
- `h1 font 1.1rem`
- `h1 .h1-sub font 0.74rem`

### 8.4 ≤540px（share buttons 触摸增强）

- `share-btn 36×36`（默认 32×32）

---

## 9. 交互与动效

### 9.1 过渡

- 主题切换按钮：`transition: color 150ms ease, border-color 150ms ease`
- Tooltip 出现 / 隐藏：`opacity 0.12s`
- Tile hover：无 CSS 过渡（canvas 直接重绘）

### 9.2 Hover 行为

- 链接：`text-decoration: underline` 或 dotted → solid border-bottom
- 按钮：颜色变 `var(--accent)`
- Tile：白色边框 + alpha 提升

### 9.3 Focus 行为（键盘可访问）

- 默认所有 button / link：`:focus-visible` 显示 outline `2px solid var(--accent)`，`offset 2px`
- 例外：自定义 chip 类按钮可用 border 色变化代替 outline，但必须有视觉反馈

### 9.4 Reduced Motion

- 当前未显式监听 `prefers-reduced-motion`，所有 transition <200ms 视为可接受
- **未来扩展**：如果加入 >300ms 的动画，必须包 `@media (prefers-reduced-motion: reduce)` 关闭

---

## 10. 可访问性

- **对比度**：light 模式 fg/bg 对比度 ≥4.5:1（WCAG AA），fg2/bg2 ≥3:1
- **触摸目标**：≤540px 时所有 button ≥36×36px（移动 share-btn 已遵守）
- **语言标记**：每个文本块用 `data-i18n` + `lang` 属性，确保屏幕阅读器切换语言
- **可见焦点**：所有交互元素 `:focus-visible` 有可见反馈
- **跳转链接**：页面顶部 `.skip-link` 跳到 `#main`
- **颜色非唯一信号**：treemap 标签同时显示 risk 数字（`9/10` 等），不只靠颜色传达
- **色盲模式**：`色覚配慮` toggle 切到 viridis palette（蓝→青→绿→黄）

---

## 11. 资产 / 图标

- **国旗 / 语言切换**：纯文字 `日本語` / `English`，圆角 pill 按钮
- **主题切换**：内联 SVG（`icon-sun` / `icon-moon`），14×14
- **Share buttons**：内联 SVG，每个平台一个 16×16 icon
- **不引入 icon font / icon library**

---

## 12. 字号 / 颜色 / 间距使用准则

- **不用魔术数字**。如果某个数值要复用 ≥3 次，提升为 token（CSS 变量或 JS 常量）
- **不引入未列出的颜色**。若需要新色（如新组件），必须先加到 §2.1，并双主题一起定义
- **不混用单位**。组件内 padding/font/radius 用 px / rem，避免 em
- **不写 inline `style=""`**（除调试用）

---

## 13. Treemap palette 变更准则

修改 `greenRedCSSDark` / `greenRedCSSLight` 锚点时：

1. 必须同时更新 §2.1「Treemap 配色函数」表格
2. 必须验证：低风险 / 中风险 / 高风险三档颜色在 light + dark 双主题下都视觉可区分
3. 推荐 sample：
   - 低风险（大量从业者，一般为绿色片区）
   - 中风险（橙色片区）
   - 高风险（红色片区）
4. light 模式 alpha=0.95 是与 #fafafa 背景的契约，不要单独改 alpha 而不调锚点

---

## 14. 修改本文件流程

1. 在 PR 描述中明确写「本次涉及 Design.md §X.Y」
2. 同 PR 内同时修改 Design.md 与代码（不允许只改一边）
3. 视觉层变更附 before/after 截图（≥768 + ≤480 各一张）
4. 文末「修订历史」追加一行：日期 / 涉及章节 / 一句话原因

---

## 15. 修订历史

| 日期 | 章节 | 改动 | 原因 |
|---|---|---|---|
| 2026-05-01 | — | 初版起草 | 把 v0.4.x 既有设计固化为正式规范 |
| 2026-05-01 | §2.1 | Light treemap 锚点变亮 | 用户反馈对比度还不够鲜艳：绿 `(0,140,75)` → `(15,195,105)`；红 `(200,35,45)` → `(235,40,55)`；橘微调 `(230,110,20)` → `(235,115,25)` |
| 2026-05-01 | §6.1 | Tooltip 字号 + 尺寸放大 | 原 0.82rem / 360px 在桌面读起来偏小，改 0.92rem / 400px，title 0.95→1.06rem 且去掉 hardcode `#fff` 改用 `var(--fg)`（双主题适用）|
| 2026-05-02 | §7.11, §8.1 | Mobile Hero（Variant C）| Mobile 首屏从 stats / toggles / 6 张卡 重构成 h2 + 信任信号 + 搜索框 + 5 chip + 直出 treemap。桌面不变。诊断：当前手机端要滚 2-3 屏才看到主图，工具入口被展示型设计语言挤掉。|
| 2026-05-02 | §6.2, §6.5, §6.6, §6.7 | Mobile tooltip 三件 fix（Mirai Mobile Fix 提案）| FIX 01 加 `.tt-cta`「詳細を見る →」按钮（漏斗大漏点）；FIX 02 重写 touch 状态机，touchstart `passive: true` + touchend 位移 < 10px 才视为 tap（修 treemap 区滚动死区）；FIX 03 close button 22×22→32×32 visual + **44×44 hit area**（HIG 合规）。CTA 与双击 tile 打开详情并存，不替换。|
| 2026-05-02 | §1, §7.11, §7.12, §7.13 | Stage 1：首页转向「自查路径优先」 | 新增 §7.12 桌面 hero（搜索 + 下拉建议 + 5 chips + 1 步直达 `/ja/<id>`），新增 §7.13 全站统一 follow + share footer（X follow CTA + 6 share 含新加 Facebook）。§7.11 移动 chip 行为从「填充 + 过滤」改为「1 步直达」，chip 名单 + 桌面统一为 `事務職 / 経理 / 営業 / カスタマーサポート / 看護師`（mobile 上 CS 缩写）。§1 第 1 条调整：「数据是主角」→「自查路径优先于纯展示，但数据仍是品牌资产」。原 explainer 区（meta-card + disclaimer + intro）从首页搬到独立 `/about` 页。背景：第一轮 X Ads 流量 491 link clicks 但站内 click 率仅 7.1%，需要把站点从展示型升级为查询工具。|
| 2026-05-04 | 头部, §0, §0.1 | 文档分裂：移动版独立设计文档 | 移动版 v1.1.0 起用 Direction C: Warm Editorial（sage 绿 + テラコッタ橙 + 暖米底 + 衬线大字），跟桌面 dashboard 风格在视觉哲学上完全不同。新建 `docs/MOBILE_DESIGN.md` 承载移动版规范；本文件继续是桌面版 single source of truth。两套设计 token 隔离（桌面无前缀，移动 `--m-*` 前缀）；数据层共享同一份 `dist/data.*.json` 投影。详见 §0.1。|

---

> 站点：https://mirai-shigoto.com
