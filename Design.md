# Design.md — mirai-shigoto.com 设计规范

> 这是本站设计的**唯一真相源（single source of truth）**。
> 今后任何视觉/交互/响应式行为变更，**先改这个文件**，再让代码跟随这个文件。
> 代码与本文件冲突时，**以本文件为准**，代码视为应当被修正的偏差。

---

## 0. 适用范围

- `index.html`（首页 treemap）
- `privacy.html`（隐私政策）
- `scripts/build_occupations.py` 生成的 1104 个 `ja/<id>.html` / `en/<id>.html` 职业详情页

> 当下设计源自 v0.4.x 系列。后续 minor / major 调整都以补丁形式追加在文末「修订历史」。

---

## 1. 核心原则

1. **数据是主角，UI 不抢戏**。视觉重量集中在 treemap、统计、tooltip；周边元素（标签、说明、页脚）退到次要层级。
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
- 显示 `.tt-close` 关闭按钮（右上角 ×）
- `max-width: calc(100vw - 32px)`
- `max-height: calc(100vh - 32px)`
- `overflow-y: auto` + `-webkit-overflow-scrolling: touch`
- `font-size: 0.78rem`，`padding: 10px 12px`

### 6.3 Tap-outside 行为（Mobile）

点击 tooltip 外部任意位置自动关闭。点击 tile 切换 tooltip。

### 6.4 视口溢出处理

JS 必须根据 `window.innerWidth` / `innerHeight` 动态调整 tooltip 位置，确保不溢出视口。详见 `index.html` 中 `positionTooltip()` 逻辑（v0.4.2 引入）。

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

---

## 8. 移动端自适应规则汇总

### 8.1 ≤768px（mobile）

- `#wrapper padding: 16px 16px 60px`
- `h1 font 1.3rem`，flex-direction column，gap 8px
- `h1 .lang-switch margin-left 0`（不再 push 到右）
- `.intro font 0.88rem`, line-height 1.75
- `.controls gap 10px, padding 10px 12px`
- `.layer-toggle` 横向滚动
- `.gradient-legend` 占满宽度 + 居中
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

---

> 本文件维护人：Jason  
> 站点：https://mirai-shigoto.com  
> 仓库：mirai-shigoto / jobs
