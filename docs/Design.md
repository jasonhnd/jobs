# Design.md — mirai-shigoto.com 设计规范（桌面 + 共享）

> 这是本站**桌面版 + 共享底层**设计的唯一真相源（single source of truth）。
> 今后任何桌面侧视觉/交互/响应式行为变更，**先改这个文件**，再让代码跟随这个文件。
> 代码与本文件冲突时，**以本文件为准**，代码视为应当被修正的偏差。
>
> **移动版（≤768px）专属规范见 [Design-Mobile.md](./Design-Mobile.md)**：mobile hero、tooltip touch-mode、移动响应式规则、`/map` 独立页。共享 token / 主题 / 断点 / treemap 视觉 / 通用组件继续在本文件，移动文件通过引用复用。
>
> **v1.4.0 起 JA-only 架构**：英文版 UI 已下线。所有 `/en/*` URL 通过 vercel.json 301 → `/ja/*`。索引、详情、sector hub、`api/og.tsx`、`llms.txt` 全部缩减为日语单语。源数据保留在 `data/_archive/translations-en/` 以便日后恢复。
>
> **v1.2.0 起单一 URL 架构**：v1.1.0 引入的 `/m/ja/*` + `/m/en/*` 已全部删除，移动体验合并到主 URL `/ja/<id>`，靠 CSS `@media` 自适应。Direction C 设计语言已合入桌面（视觉 + 文案），详见 §0.1。废弃的 `MOBILE_DESIGN.md` 已于 2026-05-06 删除（v1.1.0 已废弃 4 个月，零 active 引用）。

---

## 0. 适用范围

- `index.html`（首页 treemap，桌面段；mobile 段见 Design-Mobile.md §3）
- `privacy.html` / `compliance.html` / `about.html` / `404.html`（既有静态页，桌面 + 共享）
- `scripts/build_occupations.py` 生成的 556 个 `ja/<id>.html` 职业详情页（v1.4.0 起 JA-only；桌面段；mobile 段见 Design-Mobile.md §3）

> **`map.html`**（mobile-first 独立职业地图页）的完整规范在 [Design-Mobile.md §4](./Design-Mobile.md#4-map-页规范mobile-first-独立页)。桌面访问 `/map` 时复用同一布局（max-width 900px 居中）。

> 当下设计源自 v0.4.x 系列，桌面版当前规范版本 v1.x（见 §15 修订历史）。

### 0.1 与 Design-Mobile.md 的分工

2026-05-06 起，原单一 Design.md 拆分为两份 peer 文件，按"设备 vs 共享"分工：

| 文档 | 管什么 |
|---|---|
| **Design.md**（本文件） | 桌面专属 + 跨端共享底层（颜色 token / 字体 / 间距 / 主题 / 断点 / treemap 视觉 / 通用组件 / 桌面 hero / 交互动效 / 可访问性 / palette 准则） |
| **[Design-Mobile.md](./Design-Mobile.md)** | 移动专属（`@media (max-width: 768px)` 及更窄）：Mobile Hero (Variant C)、Tooltip touch-mode、移动响应式规则、`/map` 独立页 |

**共享内容只在 Design.md 出现一份**，Design-Mobile.md 用引用方式复用，避免 token / 主题等共享底层出现两处需要同步的问题。

跨端组件（同一个 component 在两端表现不同的）：本文件描述 desktop 行为 + 共享视觉，移动行为见 Design-Mobile.md 对应章节。例如：
- Tooltip：本文件 §6.1 (Desktop hover) + §6.4 (视口溢出，共享) / Design-Mobile.md §2 (touch-mode 全套)
- Hero：本文件 §7.12 (Desktop) / Design-Mobile.md §1 (Mobile)
- 响应式：本文件 §4 (断点定义) / Design-Mobile.md §3 (移动各档详细规则)

后续 minor / major 调整都以补丁形式追加在各自文件末尾「修订历史」。

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

> **已迁出本文件**。Mobile tooltip 全套行为（touch-mode 入口、tap-outside、close button、CTA、touch 状态机）见 [Design-Mobile.md §2](./Design-Mobile.md#2-mobile-tooltip-行为)。

### 6.3 Tap-outside 行为（Mobile）

> 见 [Design-Mobile.md §2.2](./Design-Mobile.md#22-tap-outside-行为)。

### 6.4 视口溢出处理

JS 必须根据 `window.innerWidth` / `innerHeight` 动态调整 tooltip 位置，确保不溢出视口。详见 `index.html` 中 `positionTooltip()` 逻辑（v0.4.2 引入）。

> 此节为 desktop / mobile 共享逻辑，留在本文件。

### 6.5 Close button (`.tt-close`) 触摸目标

> 见 [Design-Mobile.md §2.3](./Design-Mobile.md#23-close-button-tt-close-触摸目标)。

### 6.6 Tooltip CTA (`.tt-cta`)

> 见 [Design-Mobile.md §2.4](./Design-Mobile.md#24-tooltip-cta-tt-cta)。

### 6.7 Touch 行为契约（scroll vs tap）

> 见 [Design-Mobile.md §2.5](./Design-Mobile.md#25-touch-行为契约scroll-vs-tap)。常量 `TAP_SLOP_PX = 10` / `TAP_MAX_MS = 500` 在 §7.12 desktop hero search autocomplete 触摸状态机中复用，全站统一。

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

**全站统一规范（v1.3.x 起 — 两行 chip + footer-meta 三层结构）**：footer 改为 **导航 chip 行 + 法务/规约 chip 行 + footer-meta** 的三层结构，全站（index / about / compliance / privacy / 404 / detail × 556 / sector × 17 / ranking × 10）**完全一致**（包括首页）。

**单一真相源（v1.3.x patch — partial 架构）**：footer 的 HTML 实体从全部 8 处复制粘贴（5 个静态 HTML + 3 个 Python 生成器）收敛为一个文件 `partials/footer.html`。改 footer 的唯一姿势：

1. 编辑 `partials/footer.html`
2. 跑 `npm run build:footer`（= `python3 scripts/build_partials.py`）— 静态 5 页之间 `<!-- FOOTER:START --> ... <!-- FOOTER:END -->` 标记之间的内容被替换
3. 跑 `npm run build`（含 build:footer、build:occ、build:sectors、build:rankings）— 587 generated 页用 `FOOTER_PARTIAL = (REPO / "partials" / "footer.html").read_text()` 直接读 partial，渲染到对应位置

不要在静态页 marker 之间手改 footer，下一次 build 会被覆盖。不要在 build 脚本里硬编码 footer HTML，必须通过 `{FOOTER_PARTIAL}` 插入。

**版面**：

```
<footer>
  <div class="footer-links">          ← 第 1 行：导航 chip（pill 圆角边框）
    <a href="/">トップ</a>
    <a href="/ja/sectors">セクター</a>
    <a href="/ja/rankings">ランキング</a>
  </div>
  <div class="footer-links">          ← 第 2 行：法务/规约 chip
    <a href="/about">データについて</a>
    <a href="/compliance">コンプライアンス</a>
    <a href="/privacy">プライバシー</a>
  </div>
  <div class="footer-meta">           ← 第 3 层：版本 / 出典 / 免责（小字）
    v1.3.0 · MIT<br />
    出典：厚生労働省・<span class="nowrap">独立行政法人 労働政策研究・研修機構（JILPT）</span><br />
    <em>※ 本サイトは独自分析サイトであり、<br />厚生労働省・job tag・JILPT の<span class="nowrap">公式見解ではありません</span>。<br />詳細は <a href="/compliance">コンプライアンス</a> ページをご確認ください。</em>
  </div>
</footer>
```

**chip 样式**：

```css
footer .footer-links {
  display: flex; flex-wrap: wrap; gap: 8px;
  justify-content: center; align-items: center;
  margin-bottom: 14px;
}
footer .footer-links a {
  color: var(--fg2);
  padding: 5px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 0.78rem;
  text-decoration: none;
  transition: color 150ms, border-color 150ms, background 150ms;
}
footer .footer-links a:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(217,107,61,0.06);
}
footer .footer-meta { color: var(--fg2); font-size: 0.7rem; line-height: 1.65; opacity: 0.92; text-wrap: pretty; }
footer .footer-meta a { color: var(--accent); }
footer .footer-meta .nowrap { white-space: nowrap; }   /* 全站强制：用于「独立行政法人 労働政策研究・研修機構（JILPT）」与「公式見解ではありません」防折行 */
@media (max-width: 540px) {
  footer .footer-meta { font-size: 0.66rem; line-height: 1.6; word-break: keep-all; overflow-wrap: anywhere; }
}
```

**链接清单契约（v1.3.x 起 — 严格两行 6 chip 规则 + GitHub 完全切断）**：
- ✅ **全站每个页面（index / 404 / about / compliance / privacy / 556 detail / 17 sector / 9 ranking）**：**正好两行 6 chip**
  - 第 1 行：`トップ / セクター / ランキング`（导航三件套）
  - 第 2 行：`データについて / コンプライアンス / プライバシー`（法务/规约三件套）
- ✅ **footer-meta**：`v1.3.0 · MIT` + 出典 + 独立分析サイト免責声明 + コンプライアンス链接（全站完全一致，包括 compliance.html 自身的自指链接）
- ❌ **禁止**任何额外 chip：原本 index 上的「変更履歴 / Changelog」与 sector hub 上的「算出方法 / Methodology」均已在 v1.2.2 删除；旧的 4 chip 单行版本已在 v1.3.x 退役
- ❌ **禁止**站内任何 `<a href="https://github.com/...">` —— 全站完全切断 GitHub 链接（包括 footer-meta 的 `MIT` 链接、JSON-LD 的 `sameAs`、content body 的 GitHub Issues 引用、llms.txt / llms-full.txt 中的 source code 引用、make_prompt.py 生成的 prompt 文件）；`MIT` 在 footer-meta 改为纯文本
- ✅ 自指 chip 是有意行为：在 `/about` / `/compliance` / `/privacy` 页 footer 仍展示对应自身的 chip（一致性优先于「不放自指链接」），点击会刷新当前页

**理由**：
- 旧的 3 / 4 chip 单行版本把导航（トップ）和法务（コンプライアンス）混在一行，视觉权重不清；user 反馈「需要让 footer 也成为站点导航口」。
- 拆为「导航 + 法务」两行后，第一行承担首页之外的兜底导航职责（特别是从详情页直跳セクター / ランキング），第二行回归法务/规约本职；mobile 上两行也比单行 6 chip 更不容易折行混乱。
- pill chip 用 border + padding 让每个链接有独立 hit area + 视觉容器，hover 高亮单个 chip 更清晰。
- footer-meta 在所有页面统一为「版本 + 出典 + 独立分析免責 + コンプライアンス链接」四件套，避免每页 disclaimer 内容飘移；用户反馈「所有页面 footer 要一模一样」。
- 移除 GitHub 链接是配合首页去掉「非公式」banner 的同一波清理：把开发者向元素从访客主路径剥离。

### 7.11 Mobile Hero（Variant C, mobile-only）

> **已迁出本文件**。Mobile Hero 完整规范见 [Design-Mobile.md §1](./Design-Mobile.md#1-mobile-hero-variant-c-mobile-only)。Chip 名单与本文件 §7.12 桌面 hero 共用同一组（事務職 / 経理 / 営業 / カスタマーサポート / 看護師），任一处改动两端同步。

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
   - **首条自动高亮（v1.3.1, P0-B）**：render() 时第一个候选自动加 `.focused` 类（`focusedIdx = 0`），用户敲完 Enter **无需先按 ↓** 即可跳第一条。`rankMatches` 已经是「精確 → 前缀 → 包含 + 名称长度 asc」三层排序，第一条命中率最高。
   - **键盘提示行（v1.3.1, P0-C）**：dropdown 顶部插入一个 `.ss-hint` 非交互行，文案「↑↓ で選択 · Enter で開く」/「↑↓ to select · Enter to open」。仅在 `matchMedia("(hover: none) and (pointer: coarse)")` 为 false（即非触屏设备）时渲染；触屏设备保持紧凑无 hint。`pointer-events: none` 确保 hint 不被 click/keyboard 选中，keydown / mousedown 都用 `li[data-job-id]` 选择器跳过它。
   - **触屏 tap-vs-scroll 状态机（v1.3.1, P0-D F2）**：mobile 上 `touchstart` 仅记录起点 + 时间戳（`{ passive: true }`，**不**调 `preventDefault`，让浏览器原生滚动接管），`touchend` 时计算位移和持续时长。位移 < 10px **且** 时长 < 500ms 才视为 tap → 触发 `navigateToJob`；否则视为滚动或长按 → no-op。常量 `TAP_SLOP_PX = 10` / `TAP_MAX_MS = 500` 与 [Design-Mobile.md §2.5](./Design-Mobile.md#25-touch-行为契约scroll-vs-tap) canvas 触摸状态机保持一致（同一套阈值适用全站）。Desktop 行为不变，仍走 `mousedown` 立即 `selectFromEvent`。
   - **iOS 键盘自适应高度（v1.3.1, P0-D F1）**：iOS Safari 的 `100vh` 在键盘弹起时**不会**缩小（已知行为），导致固定 `max-height: 360px` 的下拉框被键盘压住一半。`fitDropdownToViewport()` 用 `window.visualViewport` API 监听 `resize` / `scroll` 事件，动态把 `suggestEl.style.maxHeight` 设为 `visualViewport.height - inputBottom - 12px`，下限 160px。Focus 时也调一次以确保第一次打开就贴合。`visualViewport` 不存在的旧浏览器降级到 CSS 默认 max-height。
   - **滚动期间不隐藏（v1.3.1, P0-D F3）**：iOS 上手指触碰下拉框会让 `<input>` 失去焦点，原 150ms blur-hide 会在用户滚动到一半时关闭下拉框。新增 `touchActiveOnDropdown` 标志：touchstart 置 true，touchend 350ms 延迟回 false。Blur-hide 检查标志，标志为 true 时不隐藏。350ms 窗口足够覆盖 navigateToJob 跳转完成。
6. `.desktop-hero-popular-label` + `.desktop-hero-chips` — 5 个固定 chips（与 §7.11 共用同一组）：**事務職 / 経理 / 営業 / カスタマーサポート / 看護師**。

**桌面行为**（`min-width: 769px`）：`.desktop-hero { display: block }`。同时**隐藏**老的 `#wrapper > header > h1` / `.controls` / `.dimension-hint` / `.search-row`（这些被 hero 替代；DOM 保留以保 SEO/可访问性，但 `display: none`）。

**移动行为**（`max-width: 768px`）：`.desktop-hero { display: none }`，移动端继续用 [Design-Mobile.md §1](./Design-Mobile.md#1-mobile-hero-variant-c-mobile-only) `.mobile-hero`。

**交互契约（1 步直达）**：

- 输入框 typing → `applyFilter()` live 高亮 treemap + 实时渲染下拉建议
- Enter / 点「AI 影響度をチェック」按钮 → 跳到 top match 的 `/ja/<id>`
- 点 chip → 通过 `CHIP_TO_JOB` 映射跳到对应职业详情页：
  - `事務職 → 一般事務` (id=428)
  - `経理 → 経理事務` (id=430)
  - `営業 → 営業事務` (id=431)
  - `カスタマーサポート → コールセンターオペレーター` (id=64)
  - `看護師 → 看護師` (id=156, 精确匹配)
- 点下拉 li / 键盘 Enter → 跳到对应 `/ja/<id>`
- 无匹配 → 不跳，显示 `.search-noresult` 「該当する職業が見つかりません」

**GA4 事件**：
- `popular_job_click` — chip → 详情页跳转
- `job_search_typed` — 用户键入并暂停 800ms（v1.3.1 之前叫 `job_search_submit`，但因为同时计入「视觉过滤意图」与「跳转意图」两类用户，CTR 分母被污染。此事件保留用于「热门搜索词 / 数据缺口」统计，**不再作为 CTR 分母**）。
- `job_search_intent` — 用户对 autocomplete 表现出明确的跳转意图。触发源 `intent_source` 区分四种：`submit`（Enter / 按钮）、`arrow_keys`（↑↓）、`hover`（鼠标悬停 ≥ 500ms）、`click`（mousedown / touchstart）。每个查询去重一次。
- `job_search_navigate` — 实际跳到 `/ja/<id>`（Enter / button / suggest item）。
- **真实搜索 CTR = `job_search_navigate` ÷ `job_search_intent`**（v1.3.1 起，2026-05-06 P0-A）。

**chips 名单是 v1**：与 §7.11 共用一组 5 chips，一处改动两端同步。GA4 数据稳定（2-3 周）后应替换为 top-clicked / top-searched。

---

### 7.13 Footer Follow + Share（Stage 1，全站统一）

首页 + 556 个 `/ja/<id>` 详情页**统一**使用同一个 footer follow + share 区块（v1.4.0 起 JA-only）。视觉分两层：

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

### 7.14 404 错误页（`/404.html`）

Vercel 静态部署在任何未匹配路由命中 root `/404.html` 并返回 HTTP 404；本页是站点最后一道兜底，必须延续 Direction C 视觉语言、保持 4-tracker analytics、双语 + 双主题。

**与其他静态页的差异**：本页**不挂 §7.1 top-banner**。理由：用户落到 404 是因为 URL 错了，需要的是「快速回到正轨」的引导，不是品牌 disclaimer。banner 的红色高对比块会和大字 404 抢主视觉，让页面读起来像系统报错叠了一层"我们也很非公式"的免责声明，信息层次混乱。

**版面**：

```
（无 top-banner）

#wrapper { max-width 560px; margin: 0 auto; padding 28px 28px 80px; }
  .top-bar （← マップへ戻る ｜ theme-toggle）

  .four-oh-four
    font-family: var(--font-serif)         /* Noto Serif JP */
    font-size:   clamp(5rem, 18vw, 9rem)
    font-weight: 700
    line-height: 0.9
    letter-spacing: -0.04em
    color:       var(--fg)
    margin:      24px 0 4px

    .four-oh-four .accent  /* 中间的 "0" */
      color: var(--accent)
      font-style: italic
      display: inline-block
      transform: translateY(-4%) rotate(-6deg)   /* 编辑式倾斜，避免模板感 */

  h1.title { 1.4rem · serif · weight 600 · margin-bottom 8px }
  p.subtitle { 0.95rem · color var(--fg2) · margin-bottom 24px }

  .cta-primary  /* 主 CTA，回首页 */
    display:        inline-flex
    align-items:    center
    gap:            8px
    background:     var(--accent)
    color:          #fff
    padding:        12px 22px
    border-radius:  6px
    font-weight:    600
    font-size:      0.95rem
    text-decoration: none
    transition:     transform 150ms ease, box-shadow 150ms ease
    hover:          transform translateY(-1px); box-shadow 0 4px 14px rgba(217,107,61,0.28)

  .helpful-links     /* 二级链接列表 */
    margin-top:    32px
    border-top:    1px solid var(--border)
    padding-top:   18px
    a              { color var(--fg) · border-bottom 1px solid var(--border) · padding 10px 0 · display block }
    a:hover        { color var(--accent) · border-bottom-color var(--accent) }

  footer  /* 同 about.html 页脚 */
```

**复用**：§7.4 颜色契约（accent = `#D96B3D` 暖橙、fg2 = `#7A6F5E` 软棕）、§7.10 footer 简版。
**不复用**：§7.1 top-banner（见本节"与其他静态页的差异"）、share buttons（404 不该被分享）、follow CTA（避免视觉抢主 CTA）。

**SEO**：
- `<meta name="robots" content="noindex, follow">` —— 错误页不入索引
- 不设 `<link rel="canonical">`
- `lang="ja"` 默认；`?lang=en` 切英文
- 仍带 4-tracker analytics（per `feedback_analytics_consistency.md`）

**文案**：
- ja: 大字 `404` → h1「ページが見つかりません」→ 副 「指定された URL は存在しないか、変更された可能性があります。」
- en: same with `Page not found` / `This URL doesn't exist or may have moved.`
- 主 CTA: ja「トップへ戻る →」/ en「Back to home →」 → `/`
- 二级链接 4 个：データについて (`/about`) · 利用規約 (`/compliance`) · プライバシー (`/privacy`) · GitHub Issues
- 不暴露搜索框（首页已有，避免双重入口稀释）

**dev-server**：`scripts/dev-server.py` 在所有 cleanUrl 重写之后、文件存在性检查后，对不存在的 path 用 `404.html` 内容 + HTTP 404 状态作兜底（镜像 Vercel 行为）。

---

## 8. 移动端自适应规则汇总

> **已迁出本文件**。移动端响应式规则全套（≤768 / ≤480 / ≤360 / ≤540 各档详细规则）见 [Design-Mobile.md §3](./Design-Mobile.md#3-移动端响应式规则汇总)。本文件 §4 仍持有断点的**定义**（768 / 480 / 360 / 540 阈值），具体每档要做什么交给 Design-Mobile.md。

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
| 2026-05-05 | §0, §7.14 | 新增 `/404.html` 静态页规范 | Vercel 静态部署默认查找 root `/404.html`，本站之前没有自定义错误页，未命中路径回落到 Vercel 平台白屏。新增 §7.14 定义 404 页版面（serif 大字 404 + 主 CTA 回首页 + 4 个二级链接 + 双语 + 双主题），延续 Direction C tokens、4-tracker analytics、no-index meta。同步要求 `dev-server.py` 模拟 Vercel 兜底行为。|
| 2026-05-05 | §7.10 | 全站 footer 重写：`·` 中点列表 → pill chip + footer-meta 两层结构 | 用户反馈「全站页脚链接区分不开」。原 footer `<a>トップ</a> · <a>データについて</a> · <a>プライバシー</a> · <a>GitHub</a>` 在 mobile 容易折行混杂、视觉权重不清。新规范：主导航用 pill chip（独立 border + hover 高亮），出典 / 许可下沉到 footer-meta 小字。同步移除全站 footer 的 GitHub chip（v1.2.1 把 repo 直链从访客主路径剥离，跟移除「非公式」banner 同一波清理）；MIT 许可链接保留在 meta 区域。覆盖 5 张静态页 + 1112 detail + 32 sector hub。|
| 2026-05-05 | §7.10 | footer 严格化 3/4 chip 规则 + GitHub 完全切断 | 用户进一步要求：footer chip index 只要 3 个、其他页面只要 4 个；整站不要跟 GitHub 有任何链接。删除 index 的「変更履歴」chip、sector hub 的「算出方法」chip；footer-meta 的 `MIT` 链接改为纯文本（不再指向 LICENSE）；content body 的 GitHub Issues 引用（compliance / about）改为 `mailto:privacy@mirai-shigoto.com` 或纯文本说明；index JSON-LD 的 `sameAs` / `measurementTechnique` / FAQ answer 中的 GitHub URL 移除；llms.txt / llms-full.txt / make_prompt.py 生成的 prompt files 全部清理。最终全仓 grep `github\.com` 在所有 served HTML / TXT / MD 文件命中数 0。|
| 2026-05-06 | §7.12 | 搜索 autocomplete 三件 P0 改造（事件拆分 + 首条自动高亮 + 键盘提示行）| GA4 funnel 显示 `job_search_submit → job_search_navigate` 仅 22% CTR，但深挖发现该事件混合了「视觉过滤意图」与「跳转意图」两类用户，分母被污染。**P0-A**：`job_search_submit` 重命名为 `job_search_typed` 并降级为非 Key Event（保留用于热门查询/数据缺口统计）；新增 `job_search_intent` 作为新 KPI #1，仅在用户对 autocomplete 表现出明确跳转意图时触发（form submit / 方向键 / hover ≥500ms / 点击候选），按查询去重一次。**P0-B**：autocomplete render() 时第一条自动 `.focused`（`focusedIdx = 0`），用户敲完 Enter 无需先按 ↓ 即可跳第一条。**P0-C**：dropdown 顶部插入「↑↓ で選択 · Enter で開く」非交互提示行（`.ss-hint` + `pointer-events: none`），仅桌面渲染，触屏跳过。新真实 CTR 公式 = `job_search_navigate / job_search_intent`。|
| 2026-05-06 | 头部, §0, §0.1, §6.6, §7.10, §7.12, §7.13 | v1.4.0 — 英文版 UI 全部下线 | GA4 + Vercel analytics 显示英文版会话占比近零（持续 3 个月）。维护 1112 个 EN HTML、51 处 i18n span、setLang() 切换器对当前流量来说成本过高。整站缩减为 JA-only：删除所有 `[data-i18n="ja\|en"]` 配对、3 个语言切换器、`?lang=en` URL 处理、`hreflang="en"`/`x-default`、英文页脚、`og:locale:alternate`；`/en/*` URL 在 `vercel.json` 加 catch-all 301 → `/ja/*` 保 SEO 权重；`api/og.tsx` 删 `lang=en` 参数；`build_occupations.py` / `build_sector_hubs.py` / projections 全删 EN 代码路径；FAQPage JSON-LD 10 题翻译为日文；`inLanguage` `["ja","en"]` → `["ja"]`。源数据 `data/translations/en/` 移动到 `data/_archive/translations-en/` 保留以便日后恢复，`data/occupations/*.json` 的 `*_en` 字段一字不动（仅 build 不读）。Sitemap 1152 → 579 URL，`ja/<id>.html` × 556 + `ja/sectors/<sector_id>.html` × 16 + `ja/sectors/index.html` × 1。|
| 2026-05-06 | §7.12 | 搜索 autocomplete 移动端三件 P0-D 改造（iOS 键盘自适应 + tap-vs-scroll 状态机 + scroll 期间保持显示）| 用户在 iPhone 上录屏反馈：1) 键盘弹起后下拉框被压到只剩一条半的高度，下面看不见；2) 手指一碰下拉就立刻跳到那条，无法滚动浏览。诊断为三个独立但相关的 bug。**F1**：iOS Safari 的 `100vh` 不会因键盘弹起而缩小，固定 `max-height: 360px` 被键盘压住。引入 `fitDropdownToViewport()` 用 `window.visualViewport` API 监听 resize/scroll，动态计算 input 底部到键盘顶部的可用空间，赋给 `suggestEl.style.maxHeight`，下限 160px。**F2**：原 `touchstart` 立即调 `selectFromEvent` → `navigateToJob`，用户没机会滚动。改为 §6.7 canvas 同款触摸状态机：`touchstart`（passive: true）只记录起点 + t0；`touchend` 时位移 < 10px **且** 时长 < 500ms 视为 tap 才跳转，否则视为滚动 / 长按 → no-op。Desktop `mousedown` 路径不变。**F3**：iOS 上触摸下拉框会让 input 失焦，原 150ms blur-hide 会在用户滚动到一半时关闭下拉框。新增 `touchActiveOnDropdown` 标志：touchstart 置 true，touchend 350ms 延迟回 false；blur-hide 检查标志，true 时不隐藏。三件配套，单独做任一件都不完整。常量 `TAP_SLOP_PX=10` / `TAP_MAX_MS=500` 与 §6.7 一致，全站触摸阈值统一。|
| 2026-05-06 | §0, §16（新）| 新增 §16 `/map` 页规范（mobile-first 独立页）| 设计决策：把 552 职业 treemap 从 mobile 首页拆出做独立页 `/map`，首页改放 preview 卡。桌面 `index.html` 嵌入式 treemap 完全不动。新页 IA：sticky header + 搜索 + sector chips + sector segmented treemap（D4=C），tap cell 升起 bottom sheet 预览（D2/D3），URL state 双向绑定深链 `?sector=&sort=&job=`（D5=B）。配套：`build_occupations.py` 新增 `generate_map_thumbnail()` 输出 inline SVG snippet 注入首页 preview 卡；详情页底部加 "← 職業マップへ" 闭环（D6）；GA4 加 4 个事件 `map_open` / `map_filter` / `map_cell_tap` / `map_detail_click`；专属 SEO（title / meta / OG / `Dataset` + `ItemList` schema）。Mobile 首页 `data.treemap.json` preload 加 `media="(min-width: 769px)"` 限定桌面，移动端不再为 treemap 付出 80KB 数据 + canvas 渲染成本。a11y "リスト表示に切り替え" toggle 暂列为 §16.13 PENDING（M8 待决策）。|
| 2026-05-06 | §16（新）, §7.10 | Ranking Pages 扩充：4→9 ranking + 1 hub = 10 页 | 新增 5 个排名页（年収 / 初任給 / 平均年齢若い / 労働時間短い / 人手不足）。全 9 页追加 highlights 洞察 + sector 分布图 + FAQ（FAQPage JSON-LD）+ stats 面板拡張。Hub 页追加全局統計 + 9 卡片含 1 位预览 + 横断 insights。新 CSS 组件：demand-pill / rl-extra / highlights / sector-chart / faq / insights / rr-preview。Build: `build_rankings.py` 输出 10 HTML → 323 KB。|
| 2026-05-06 | 头部, §0, §0.1, §6.2-§6.7, §7.11, §8, §16→§17 | 文件拆分：Design.md / Design-Mobile.md 两份 peer | 新增 §16 后 mobile 内容已超 doc 一半。按 Q1=C / Q2=A / Q3=B 决策：(1) 新建 `docs/Design-Mobile.md`，移入原 §6.2/§6.3/§6.5/§6.6/§6.7（mobile tooltip 全套）→ 新 §2、§7.11（Mobile Hero）→ 新 §1、§8 全部（移动响应式规则）→ 新 §3、§16 全部（`/map` 页规范）→ 新 §4。本文件保留桌面专属（§6.1 / §7.12 / §7.14）+ 跨端共享（§1 原则 / §2 token / §3 主题 / §4 断点 / §5 treemap 视觉 / §6.4 视口溢出 / §7 通用组件 / §9-§13 交互 a11y palette）。(2) 已迁出章节在本文件保留 stub 标题 + 跳转链，不留空白章节号；§7.12 desktop hero 中两处 `§7.11` / `§6.7` 引用更新为 `Design-Mobile.md §1` / `§2.5`。(3) 原 `docs/MOBILE_DESIGN.md`（v1.1.0 时代废弃 `/m/*` URL 架构存档，4 个月零 active 引用）一并删除（Q1=C）。共享内容只在本文件出现一份，避免 token / 主题 / treemap 视觉 token 出现两份需要同步的问题。|

---

## 16. Ranking Pages 规范（`/ja/rankings/*`）

### 16.1 页面一览（9 ranking + 1 hub = 10 页）

| slug | 标题 | 排序字段 | 额外列 |
|------|------|---------|--------|
| `ai-risk-high` | AIに奪われる仕事 TOP30 | `ai_risk` 降序 | — |
| `ai-risk-low` | AI影響が少ない仕事 TOP30 | `ai_risk` 升序 | — |
| `salary-safe` | 高年収×低AIリスク TOP30 | `salary` 降序（AI≤5） | — |
| `workers` | 就業者数ランキング TOP30 | `workers` 降序 | — |
| `salary` | 年収ランキング TOP30 | `salary` 降序 | — |
| `entry-salary` | 初任給ランキング TOP30 | `recruit_wage` 降序 | 初任給（万円） |
| `young-workforce` | 平均年齢が若い職業 TOP30 | `average_age` 升序 | 平均年齢（歳） |
| `short-hours` | 労働時間が短い職業 TOP30 | `monthly_hours` 升序 | 月間時間（h） |
| `high-demand` | 人手不足の職業 TOP30 | `demand_band` hot→warm | demand pill |

Hub: `/ja/rankings/index.html` — 全局统计 + 9 卡片（含 1 位预览） + 数据洞察

### 16.2 个别 ranking 页面结构

```
breadcrumb → h1（accent） → subtitle → intro
→ stats panel（3-4 个指标，auto-fit grid）
→ highlights（3 条自动生成洞察，accent-deep 左边框）
→ sector chart（TOP30 内行业分布 CSS 条形图，最多 6 行）
→ TOP 30 ranked list（rank counter + name + sector + risk pill + [extra col] + salary + workers）
→ FAQ section（3 Q&A，`<details>` 折叠，FAQPage JSON-LD）
→ related rankings grid（剩余 8 个 ranking 的交叉链接）
→ footer（全站统一两行 6 chip）
```

### 16.3 Hub 页面结构

```
breadcrumb → h1 → subtitle → intro
→ global stats panel（总职业数 / 全体平均 AI 影響 / 全体平均年収 / 総就業者数）
→ ranking cards grid（9 卡，每卡含 title + desc + 1 位 preview + count）
→ insights section（5 条跨排名横断洞察）
→ footer
```

### 16.4 新增 CSS 组件

- `.demand-pill` — 求人需要 badge（hot=绿 / warm=黄 / cool=蓝 / cold=灰），跟 `.risk-pill` 同尺寸
- `.rl-extra` — rank item 额外列值（accent-deep 色 + tabular-nums）
- `.highlights` — 洞察列表（bg2 + accent-deep 左边框 3px）
- `.sector-chart` / `.sb-row` — CSS-only 水平条形图（sector 名 + track/fill + 数字）
- `.faq` / `.faq details` — FAQ 折叠组件（Q. 前缀 accent 色，答案 fg2）
- `.insights` — hub 页洞察列表（bg2 卡片式）
- `.rr-preview` — hub 卡片 1 位预览行（accent-deep 小字 + 🥇）

### 16.5 SEO

每页 JSON-LD `@graph` 包含：`WebPage` + `BreadcrumbList` + `ItemList`（30 条）+ `FAQPage`（3 Q&A）。

Build: `python3 scripts/build_rankings.py` → 输出 10 个 HTML 到 `ja/rankings/`。

---

## 17. `/map` 页规范（mobile-first 独立页）

> **已迁出本文件**。完整规范见 [Design-Mobile.md §4](./Design-Mobile.md#4-map-页规范mobile-first-独立页)。

---

> 站点：https://mirai-shigoto.com
