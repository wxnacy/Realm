---
phase: "48"
slug: "skill-name"
status: draft
shadcn_initialized: false
preset: none
created: "2026-09-12"
---

# Phase 48 — UI Design Contract

> 技能发现与调用（`/` 面板 + `/skill:name`）的视觉与交互契约。
> 由 gsd-ui-researcher 生成，gsd-ui-checker 校验。
>
> **本阶段是既有 UI 的增量扩展，不是从零建面。** 面板骨架（`#slashPickerPanel`）、
> 行样式（`.slash-picker-row` / `-name` / `-desc`）、键盘导航（`handleAIInputKeydown`）、
> 气泡 pill 家族（`.ai-message-ref-pill`）、折叠框先例（`.ai-summary-box`）、
> 工具卡片骨架（`.tool-card`）**全部已存在**。契约只描述**新增的视觉元素与新增的交互规则**，
> 并逐项指明复用的既有类。**不得**另起一套设计系统或第二份徽标/折叠实现。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none（无 `components.json` / 无 `tailwind.config.*` / `package.json` 依赖中无 UI 框架） |
| Icon library | none（图标为 `src/index.html` 内联手写 SVG，本阶段**不新增任何图标**） |
| Font | 系统字体栈 `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`（`src/styles/main.css:107`）；标识名用等宽 `var(--font-mono, monospace)`（既有 `.slash-picker-name:7006` 用法） |

**样式令牌的实际来源**：全部为 `src/styles/main.css` 顶部两个主题块的**手写 CSS 自定义属性**，
不是任何设计系统产物：

- `:root, [data-theme="dark"]`（`main.css:7-23`）—— 深色主题（默认）
- `[data-theme="light"]`（`main.css:25-42`）—— 浅色主题

两套主题**必须同时**定义本阶段新增的令牌。新增令牌值如下（`## Color` 章节给出明暗两套值与
对比度核算结论）。

**shadcn 门禁**：项目非 React / Next.js / Vite，纯手写 HTML + 原生 JS，**门禁不适用**，不做初始化。
**Registry 安全门禁**：无第三方 registry，见 `## Registry Safety`。

---

## Component Inventory

Could not enumerate: 项目无组件库、无设计系统包 —— 无 `components.json`、无 `tailwind.config.*`、`package.json` 依赖中无 UI 框架；全部 UI 为手写 HTML 元素 + 单文件 `src/styles/main.css`（约 10k 行），不存在可枚举的组件导出面。

本阶段的「组件清单」因此是**既有可复用原语的清点**，由以下可重跑命令生成（非组件库枚举）：

```bash
grep -nE "^\.(slash-picker|ai-(message-ref|attachment|summary-box|system-note)|tool-card)[a-z-]*[ ,{]" src/styles/main.css
```

**非穷尽清单 —— 不是封闭白名单。** 执行时如需表外原语，直接查 `main.css` 是**预期路径**，
不是例外：**表中未列出的既有类可直接使用**（例如 `.ai-message-refs`、`.ai-attachment-pill-badge`、
`.ai-drop-overlay`），**不因未列于本表而受阻**。本表的作用是标出本阶段**已经核对过**的复用点，
不是允许使用的上限。

| 既有原语（类 / 函数） | 位置 | 本阶段如何复用 |
|----------------------|------|----------------|
| `.slash-picker-panel` | `main.css:6973` | 面板外壳：`bottom:100%` / `max-height:220px` / `overflow-y:auto` / `--bg-secondary` 底 / `8px` 圆角 / `0 4px 16px rgba(0,0,0,0.4)` 阴影。**零改动**（含 `max-height` —— 见 `## UI Considerations` 的 backstop 行） |
| `.slash-picker-row` / `-name` / `-desc` | `main.css:6988-7019` | 行骨架。`-name` = `var(--font-mono, monospace)` / 13px / 600 / nowrap；`-desc` = 12px / `--text-muted` / 单行 ellipsis。**零改动** |
| `.slash-picker-row:hover` / `.active` | `main.css:6997-7003` | 行高亮一律 `var(--bg-hover)`。**禁止**改为 accent 背景 |
| `#slashPickerList` / `#slashPickerPanel` | `index.html:861-863` | 渲染容器。分组标题必须落在 `.slash-picker-panel` 的滚动容器内（见下） |
| `SLASH_COMMANDS` | `renderer.js:334` | 本地命令唯一注册表；「命令」分区的唯一数据源，形状 `{name, description, takesArg, handler}` |
| `renderSlashPickerList()` | `renderer.js:9900` | 全量 `innerHTML` 重建 + `activeRow.scrollIntoView({block:'nearest'})` + `data-cmd` 点击/mousemove 绑定。新增分组渲染在此函数内扩展 |
| `state.slashPickerItems` | `renderer.js` 单数组 | **必须保持展平单数组**（D-01）；`activeIndex` 是扁平索引 |
| `.ai-message-ref-pill` / `-dot` / `-title` | `main.css:6929-6953` | 用户气泡 pill 家族：20px 高 / `padding 1px 8px` / `border-radius 10px` / 11px / `rgba(0,0,0,0.25)` 底 / `color: inherit` / `max-width 180px`。技能 pill 复用（**底部用 `rgba(0,0,0,0.25)` 而非 `--bg-hover`** —— 它坐在 `--accent-color` 蓝底气泡上） |
| `.ai-message-refs` | `main.css:6922` | 气泡 pill 行容器（`flex` / `flex-wrap` / `gap:4px` / `margin-bottom:6px`）。技能 pill 行**原类复用**，零改动 |
| `.ai-attachment-pill-badge` | `main.css:6843` | 中性微标先例（面板语境）。**气泡语境不用它**（`--bg-hover` 底在蓝气泡上发灰），改用新增 `.ai-skill-pill-badge` |
| `.ai-summary-box` / `-header` / `-icon` / `-title` / `-chevron` / `-body` | `main.css:5733-5785` | `/compact` 折叠框先例：`flex-shrink:0` / `border-radius 8px` / header 12px `--text-secondary` / chevron 折叠时 `rotate(-90deg)` / body `max-height:260px` + `overflow-y:auto` + `white-space:pre-wrap` + `line-height:1.6`。技能正文折叠块**逐值照抄** |
| `.ai-system-note` / `span` | `main.css:5713-5725` | 文本反馈唯一形态（居中 / 12px / `--text-muted` / `rgba(127,127,127,0.12)` 底 / `padding 3px 12px` / `border-radius 10px`）。D-10 / D-13 三条反馈**零新形状** |
| `.tool-card` / `-header` / `-name` / `-icon` / `-status` | `main.css:5991-6059` | `-header` = `display:flex` / `gap:8px` / `height:36px` / `padding:0 12px`；`-name` = 12px / 500 / `flex:1` / ellipsis / nowrap。`read` 技能变体复用骨架，只加修饰类 |
| `renderToolCard()` | `renderer.js:9224` | `execute_action (${action})` 已是「按参数特殊化标题」的既有先例 → 技能变体同款处理 |
| `pushSystemNote(content)` | `renderer.js:8794` | 文本反馈唯一入口 |
| `abortAIIfStreaming()` | `renderer.js:8804` | 流式中触发技能调用先中止再发（D-08），零新增中止逻辑 |

---

## Spacing Scale

声明值（**新增元素**的 `gap` / `padding` / `margin` 只允许取 4 的倍数；唯一例外通道是下方
Exceptions 的 **B 表** —— 偏离值必须逐条登记并附理由与既有先例）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 徽标/标记与相邻文字的间隙（`margin-right`）；徽标**水平** `padding`；状态标注的内边距 |
| sm | 8px | 行垂直 padding；块级元素之间的间隙；`read` 卡片技能名的外层（图标↔名称）与内层（名称↔徽标）`gap` |
| md | 16px | 本阶段**未使用**（保留） |
| lg | 24px | 本阶段**未使用**（保留） |
| xl | 32px | 本阶段**未使用**（保留） |
| 2xl | 48px | 本阶段**未使用**（保留） |
| 3xl | 64px | 本阶段**未使用**（保留） |

**12px 亦在标内**（4 的倍数），本阶段用于水平 padding，因为它就是既有
`.slash-picker-row { padding: 8px 12px }`（`main.css:6992`）的水平值 —— 沿用而非新引入；
新增的 `.slash-picker-group-header` 取 `padding: 4px 12px` 同款口径。

### Exceptions

**A. 存量继承值** —— 既有类的值，被复用或照抄；允许继续存在，**不得新增同类偏离**：

| 既有类 | 值 | 位置 | 处理 |
|--------|-----|------|------|
| `.slash-picker-row` | `gap: 10px` | `main.css:6991` | **不改** —— 10 不是 4 的倍数，但改它会同时移动既有命令行的观感，超出本阶段范围 |
| `.slash-picker-row` | `padding: 8px 12px` | `main.css:6992` | 照抄值 |
| `.ai-summary-box` | `margin: 4px auto` | `main.css:5738` | 4 的倍数；技能折叠块的覆盖项对齐它（`4px 0 0`） |
| `.ai-summary-box-header` | `padding: 6px 12px`、`gap: 6px` | `main.css:5748-5749` | 照抄值（见 B 表第 2 条） |
| `.ai-summary-box-body` | `padding: 8px 12px 10px` | `main.css:5772` | 照抄值 |
| `.ai-message-ref-pill` | `padding: 1px 8px` | `main.css:6933` | 照抄值（气泡 pill 原地复用，零改动） |
| `.ai-message-refs` | `gap: 4px` / `margin-bottom: 6px` | `main.css:6925-6926` | 气泡 pill 行容器原地复用，零改动 |
| `.ai-system-note span` | `padding: 3px 12px` | `main.css:5724` | 存量值，D-10/D-13 反馈直接沿用 |

**B. 本阶段新增声明中非 4 倍数的值 —— 仅此两条，逐条附理由与先例。**
执行时**不得**再添加任何未登记的新值：

| 新增类 | 属性 | 值 | 为什么不能取 4 的倍数 |
|--------|------|-----|----------------------|
| `.slash-picker-source-badge`、`.slash-picker-tag-explicit`、`.ai-skill-pill-badge`（三处**共用同一条例外**） | `padding` | `1px 4px` —— **水平已是 4 倍数，例外仅在垂直 `1px`** | 三个徽标都是 **11px 文字上的发丝级垂直内边距**。取 `4px` 会把徽标高撑到约 23px（`11 × 1.4 + 2×4 + 2×1(border)`），**超出其宿主的固定高**：`.ai-message-ref-pill` 是 `height: 20px`（`main.css:6932`），`.slash-picker-row` 是单行高。既有同族先例的垂直值同样非 4 倍数：`.ai-message-ref-pill` 的 `1px 8px`（`main.css:6933`）、`.ai-attachment-pill-badge` 的 `2px 4px`（`main.css:6846`）。垂直取 `1px` 而非 `2px` 是为与 pill 家族（`1px`）对齐 |
| `.ai-skill-content-box-header`（新增，见 `## 用户气泡契约`） | `gap` / `padding` | `gap: 6px` / `padding: 6px 12px` | **逐值照抄** `.ai-summary-box-header`（`main.css:5748-5749` 即 `gap: 6px; padding: 6px 12px`）。契约要求技能正文折叠块与既有 `/compact` 摘要框**同族**（本文件开头：「**不得**另起一套…第二份徽标/折叠实现」）。此处单独拉回 `gap: 8px` 会与同屏可能出现的摘要框产生**无收益的视觉分叉**；改成 4 的倍数即等于发明第三个折叠框外观 |

- **本阶段新增元素的 `gap` / `padding` / `margin` 一律取 4 的倍数**（6 / 10 / 14 之类**不得出现**），
  **唯一例外是上表 B 中已逐条登记的两条**。新增任何偏离值都必须先补进 B 表（附理由 + 既有先例）
  再落码 —— 契约与 CSS 块必须始终自洽。

无 44px 触控目标例外：本阶段全部控件是桌面端键盘优先的浮层行与 pill，无独立触控入口。

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 12px | 400 | 1.5 |
| Label | 11px | 400 | 1.4 |
| Heading | 13px | 600 | 1.2 |
| Display | 14px | 400 | 1.5 |
| Inherited（既有卡片标题，**本阶段不改**） | 12px | 500（继承） | n/a（继承，未声明） |

**本阶段声明**：**4 个字号、2 个字重**（400 / 600）。逐个用途：

- **Body 12px / 400** —— 面板行描述（`.slash-picker-desc` 存量 12px）、行尾状态标注、
  技能正文折叠块正文（复用 `.ai-summary-box-body` 存量 12px）、system-note（存量 12px）
- **Label 11px / 400** —— 来源徽标、`仅显式` 标记、气泡内 `技能` 微标、分组标题
  （`Label` 与既有 `.ai-message-ref-pill` 的 11px 同档）
- **Heading 13px / 600** —— 面板行标识名 `/{name}`（复用 `.slash-picker-name` 存量 13px/600）、
  气泡内技能名、`read` 卡片技能名（**仅加等宽字体**，字号字重沿用卡片存量的 12px/500）
- **Display 14px / 400** —— 既有用户气泡正文（`.ai-message-content` 14px），
  **本阶段不新增**该档用途，仅登记以免执行时误用第 5 个字号

> **表末行是「继承登记」，不是本阶段声明。** `.tool-card-name`（`main.css:6044-6046`：
> `font-size: 12px; font-weight: 500`）是既有 `read` 卡片标题的存量值，本阶段**只改文案 +
> 追加徽标，不改该类**（详见 Exceptions 第 1 条）。它的 500 不计入本阶段声明的字重数，
> 也不得因此新增任何 500 字重的新类。

Exceptions：

- `.tool-card-name` 的存量 **500** 字重**不改**（技能变体的标题行只改文案 + 追加徽标，
  不引入第 3 个字重）—— 该值同时在 Typography 表末行以「继承登记」形式列出
- 技能正文折叠块正文的 `line-height: 1.6` 照抄 `.ai-summary-box-body` 存量值（详见
  `## 用户气泡契约`）
- 分组标题 11px 比既有 `.slash-picker-desc` 的 12px 更小，是刻意的层级区分（分组标题是结构标签、不是内容）

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-primary` — 暗 `#1a1a1a` / 亮 `#ffffff` | 聊天面板底色（面板本身浮在其上） |
| Secondary (30%) | `--bg-secondary` — 暗 `#2a2a2a` / 亮 `#f5f5f5` | `/` 面板底（`.slash-picker-panel` 存量）、技能正文折叠块底（`.ai-summary-box` 存量）、分组标题底 |
| Tertiary | `--bg-tertiary` — 暗 `#3a3a3a` / 亮 `#e5e5e5` | AI 气泡底（存量）；面板行 hover/active 用 `--bg-hover`（暗 `#404040` / 亮 `#e0e0e0`），**本阶段沿用** |
| Accent (10%) | `--accent-color` `#3B82F6` | **本阶段不新增任何 accent 使用点** |
| Warning | `--warning-color` `#F59E0B`（暗） | 仅「未进提示词」超限标注（暗色主题用；浅色见下表专用令牌） |
| Muted | `--text-muted` `#6b7280`（暗）/ `#9ca3af`（亮） | 面板行描述、行尾遮蔽标注、分组标题、`--text-secondary` 用于徽标与标记文字 |
| Destructive | `--danger-color` `#EF4444` | **本阶段无破坏性操作，不使用** |

**Accent reserved for（显式清单，非「所有可交互元素」）**：

1. 用户气泡背景（`--accent-color`，`.ai-message-user .ai-message-content`，**既有，非本阶段新增**）
2. 附件拖拽遮罩边框（`.ai-drop-overlay`，**既有，非本阶段新增**）

> **本阶段新增元素零 accent 使用。** 面板选中行高亮继续用 `--bg-hover`
> （既有 `.slash-picker-row.active`），**不得**改为 accent 背景 —— 与既有键盘导航高亮视觉一致，
> 且避免与「蓝色 = 用户气泡 / 蓝色 = 用户自己的技能」两套语义在浮层里混淆。

### 新增令牌：三档来源徽标配色

用户已确认三档**独立配色**。为避免把 `--accent-color` / `--success-color` 的语义拉伸到
「技能来源」上，定义 3 个**专用令牌**，明暗两套值：

| 档位 | 判定（**消费 D-14，不重新定义**） | 令牌 | 暗色值 | 浅色值 |
|------|-----------------------------------|------|--------|--------|
| 用户 | `source === 'user'` | `--skill-source-user` | `#93C5FD` | `#1D4ED8` |
| 内置 | `name ∈ builtin-skills-seeder.getSeededSkillNames()` | `--skill-source-builtin` | `#6EE7B7` | `#065F46` |
| 托管 | `source === 'managed'` 且非 seeded（AI 自建） | `--skill-source-managed` | `#C4B5FD` | `#5B21B6` |

徽标视觉（`.slash-picker-source-badge`，面板与 `read` 卡片共用）：

```css
font-size: 11px; font-weight: 400; line-height: 1.4;
padding: 1px 4px; border-radius: 3px; white-space: nowrap; flex-shrink: 0;
color: var(--skill-source-<tier>);
background: color-mix(in srgb, var(--skill-source-<tier>) 15%, transparent);
border: 1px solid color-mix(in srgb, var(--skill-source-<tier>) 30%, transparent);
```

- 写进 `:root, [data-theme="dark"]` 与 `[data-theme="light"]` **两处**（缺一即浅色主题失效）
- `color-mix` 项目已有先例（`.ai-drop-overlay`），Electron 43 支持
- **`padding` 全部在 4 网格内（水平 `4px`）**，唯一偏离是垂直 `1px` —— 已登记于
  `## Spacing Scale` 的 **B 表第 1 条**（11px 文字 + 20px 高 pill 宿主下 4px 会撑破容器；
  与 `.ai-message-ref-pill` 的存量 `1px 8px` 同族）。**不得**在执行时另行放大
- **对比度硬要求：徽标文字对「15% 混色底 + 面板 `--bg-secondary`」的对比度 ≥ 4.5:1**
  （11px 属小字，按 WCAG 1.4.3）。上述取值已按 15% 混色底手工核算通过
  （暗色约 5.7 / 6.1 / 5.2:1，浅色约 4.7 / 5.3 / 5.0:1）。
  执行时**如调整任一值，必须在改动的主题下重新核算**并更新本节。
- 徽标是**文字标签**不是状态胶囊：低饱和底色 + 细边框使其读作分类标签，
  不与 `--warning-color` 的超限标注（橙色）抢语义

### 新增令牌：超限标注文字色

`--warning-color` 在浅色主题（`#F59E0B` on `--bg-secondary #f5f5f5`）对比度仅约 2.0:1，
不可读。故定义专用令牌：

| 令牌 | 暗色值 | 浅色值 |
|------|--------|--------|
| `--skill-limit-text` | `#F59E0B`（= `--warning-color` 同值） | `#B45309` |

两值对各自 `--bg-secondary` 的对比度分别约 6.7:1 / 4.6:1（≥ 4.5:1 通过）。

### 状态色的三档语义（用户已确认）

| 行状态 | 行整体 | 行尾标注色 | 可选中 |
|--------|--------|-----------|--------|
| 正常（含超限） | 不透明 | 超限 → `--skill-limit-text` | 是 |
| 被遮蔽（D-11） | `opacity: 0.6` | `--text-muted` | 否（灰显禁用态） |
| 与本地命令同名（本契约推导） | `opacity: 0.6` | `--text-muted` | 否（灰显禁用态） |

灰显行是不可交互的**禁用态**，按 WCAG 1.4.3 的 inactive-component 豁免不要求 4.5:1；
**禁止**为了对比度把遮蔽行做得和可选中行一样醒目 —— 可选中性必须一眼可辨。

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | 无新增按钮文案 —— **面板行本身即主操作**：行文本 `/{技能名}`，Enter 或点击执行（D-04「行显 `/name`、选中即执行」） |
| Empty state heading | 无标题（面板空态沿用既有**单行提示条**形态，与 `.slash-picker-desc` 同款居中行，不引入 heading/body 两段） |
| Empty state body | `无匹配技能或命令，输入 / 查看全部` |
| Error state | 显式调用不存在的技能：`未找到技能「foo」，输入 / 查看可用技能` |
| Destructive confirmation | **本阶段无破坏性操作** —— 不新增任何 `<dialog>`、不新增确认卡片。技能调用的确认面完全复用既有 bash 三档确认机制（技能不构成额外权限） |

### 全部用户可见文案（唯一权威清单）

| 位置 | 文案 | 来源 |
|------|------|------|
| 分组标题（第一分区） | `技能` | D-01 |
| 分组标题（第二分区） | `命令` | D-01 |
| 面板过滤无命中（单行空态） | `无匹配技能或命令，输入 / 查看全部` | 本契约（对既有 `无匹配命令，输入 / 查看全部` 的**必要更新**：面板现在同时列技能，旧文案已不准确） |
| 面板行名称 | `/{name}`（技能与命令同形；命令行零变化） | D-04 |
| 面板行名称 `title` | 技能行 `title="/skill:{name} 可显式调用"`；命令行不加 `title` | 本契约（**补充**：D-04 只锁「行显 `/name`」，加 `title` 不改行显文本，为 `/skill:` 语法提供发现入口） |
| 面板行描述 | 技能 → `skill.description`；命令 → `SLASH_COMMANDS[i].description`（存量） | D-02 |
| 来源徽标文字 | `用户` / `内置` / `托管` | D-14 |
| 来源徽标 `title` | 用户 `用户技能（agent-workspace/skills/），同名时优先于内置与托管`；内置 `随包内置技能，每次启动自愈播种`；托管 `托管技能（AI 自建，存于 managed-skills/）` | 本契约 |
| `仅显式` 标记 | `仅显式` | D-02 |
| `仅显式` 标记 `title` | `该技能不进模型提示词，只能手动调用（/skill:名字）` | 本契约（解释 `disable-model-invocation: true`） |
| 超限标注（prompt 预算） | `未进提示词 · 超预算` | D-12 **原文** |
| 超限标注（数量上限） | `超数量上限` | D-12 **原文**（D-12 原文如此，刻意比前者短；执行时**照写**，不要自行统一为两段式） |
| 超限标注 `title`（两种） | `未进入模型提示词，但仍可手动调用（/skill:名字）` | 本契约 |
| 遮蔽标注（D-11） | `已遮蔽 · 由用户同名技能胜出` | D-11 **原文** |
| 遮蔽标注 `title` | `本行不可调用；/skill:名字 作用于胜出的用户技能` | 本契约 |
| 与本地命令同名的技能标注 | `与本地命令同名 · 本地命令优先` | 本契约**推导**（D-04 的优先级规则的可见后果，CONTEXT 未显式决定；见 `## 交互契约`） |
| 禁用技能显式调用（system-note） | `技能「foo」已被禁用，可在 设置 → AI → 技能管理 重新启用` | D-10 **原文** |
| `/skill:foo` 未找到（system-note） | `未找到技能「foo」，输入 / 查看可用技能` | D-13（锁定语义「未找到技能「foo」」+ 既有 system-note 的下一步指引同形） |
| 裸 `/foo` 两边都不命中（system-note） | `未知命令 /foo，输入 / 查看可用技能与命令` | D-13（锁定「沿用未知命令路径」；文案把「命令」更新为「技能与命令」以与面板实际内容一致） |
| 气泡内 `技能` 微标 | `技能` | 本契约（用户已确认） |
| 技能正文折叠块 header | `技能正文（N 字符）` | D-09（N = `skill.content.length`，**JS `String.length` 字符数**，与 `LIMITS.SKILLS_PROMPT_CHAR_BUDGET` 同口径；**不得**用字节数） |
| `read` 卡片技能标题 | `使用技能「{name}」` | D-15 **原文** |

> **文案纪律**：全部 UI 文案为简体中文；技术标识（技能 `name`、`/skill:name` 语法、
> `disable-model-invocation`）保留原文。技能名与描述来自磁盘（`SKILL.md`），
> **一律经 `textContent` 注入**（沿用 `renderToolCard` 的 T-21-03 缓解）；
> 面板行沿用既有 `innerHTML` 模板拼接，因此**插入前必须转义**技能名与描述
> —— 这是既有模板的既有风险面，本阶段新增数据源必须按同口径处理。

> ⚠ **前瞻引用提示**：D-10 的文案指向「设置 → AI → 技能管理」，该设置区在
> **Phase 50** 才落地（已确认 `src/settings.html` / `settings-page.js` 当前无技能相关 UI）。
> 本契约照写 D-10 原文，不做改写；执行时如认为需要，不要自行改文案，走 plan 期决策。

---

## 面板结构契约（`/` 面板）

**落点**：`src/index.html:862` §`slashPickerPanel` + `src/renderer.js:9900` §`renderSlashPickerList`

### 结构

```
.slash-picker-panel            ← overflow-y:auto（滚动容器，存量，零改动）
  └─ #slashPickerList          ← 无 overflow（不得加 overflow:hidden —— 会打断 sticky）
       ├─ .slash-picker-group-header      「技能」
       ├─ .slash-picker-row × N           技能行
       ├─ .slash-picker-group-header      「命令」
       └─ .slash-picker-row × 2           命令行（存量行结构与行为零变化）
```

### 分组标题（新增类 `.slash-picker-group-header`）

| 属性 | 值 |
|------|-----|
| 定位 | `position: sticky; top: 0; z-index: 1` |
| 背景 | `var(--bg-secondary)`（**必须显式声明** —— 透明背景会让滚动内容从标题下透出） |
| 下边框 | `1px solid var(--border-color)` |
| 排版 | 11px / 400 / `var(--text-muted)`（见 `## Typography` 的 Label 档） |
| 内边距 | `padding: 4px 12px`（两值均在 4 网格内 —— 见 `## Spacing Scale`） |
| 交互 | `user-select: none`；**不可点击、无 hover 背景、无 cursor:pointer**；不参与 `slashPickerItems` 索引 |

**硬约束（sticky 生效前提）**：`.slash-picker-panel` 仍是滚动容器（`overflow-y: auto` 保持），
中间**不得**出现任何 `overflow: hidden` / `auto` 的包裹元素。若执行时为了分组引入包裹 div，
必须确认它不带 overflow，否则分组标题的 sticky 静默失效。

**不渲染空分组标题** —— 某分组命中 0 项时该标题整个不输出（D-01）。

### 行内容（从左到右）

| # | 元素 | 类 / 样式 | 说明 |
|---|------|----------|------|
| 1 | 标识名 | `.slash-picker-name`（存量 13px/600/等宽/nowrap） | `/{name}`；D-04 锁定行显 `/name` |
| 2 | 来源徽标 | `.slash-picker-source-badge`（新增，见 `## Color`） | 三档文字 `用户`/`内置`/`托管`；色令牌按档取 |
| 3 | `仅显式` 标记 | `.slash-picker-tag-explicit`（新增） | 仅 `disableModelInvocation === true` 的技能渲染；**中性色**（`--text-secondary` on `rgba(127,127,127,0.16)`），**不引入第 4 个色相** |
| 4 | 描述 | `.slash-picker-desc`（存量 12px/`--text-muted`） | `flex: 1; min-width: 0` + 单行 ellipsis |
| 5 | 状态标注 | `.slash-picker-status`（新增） | 纯文本（无底、无边框）；`margin-left: auto; flex-shrink: 0`；色见 `## Color` 的状态表 |

**行布局约束**：`.slash-picker-row` 加 `flex-wrap: wrap`。
元素 1–3 为**不可换行组**（名称与徽标/标记的 `flex-shrink: 0`，名称 nowrap）；
元素 4 承担全部压缩（`flex: 1; min-width: 0`）；
元素 5 `flex-shrink: 0` + `white-space: nowrap`，当剩余宽度不足时**自动换到第二行**
（`margin-left: auto` 使其右对齐）。面板最窄 280px（`--ai-panel-min-width`）下这是唯一不
牺牲可读性的解法：标注永不截断，描述先让位。

### `仅显式` 标记（新增类 `.slash-picker-tag-explicit`）

```css
font-size: 11px; font-weight: 400; line-height: 1.4;
padding: 1px 4px; border-radius: 3px; white-space: nowrap; flex-shrink: 0;
color: var(--text-secondary);
background: rgba(127, 127, 127, 0.16);
```

刻意**与来源徽标同尺寸但无彩色** —— 一行里出现 4 个色相会变成彩虹；来源是分类（需要色相区分，
用户已确认），`仅显式` 是修饰（中性足以）。

`padding` 与 `.slash-picker-source-badge` **完全同值**：水平 `4px` 在 4 网格内，垂直 `1px`
走 `## Spacing Scale` **B 表第 1 条**这条共用例外（两个徽标必须严格同高，否则同一行里会参差）。

### 行状态与可选中性

| 状态 | 视觉 | 键盘（↑↓） | Enter / 点击 |
|------|------|-----------|-------------|
| 正常 | 不透明 | 可落点 | 执行 |
| **超限**（D-12） | 不透明 + 行尾橙色标注 | 可落点 | 执行（显式调用是它唯一可用路径） |
| **被遮蔽**（D-11） | `opacity: 0.6` + 行尾灰标注 | **跳过** | **不执行、不关面板、不改 activeIndex** |
| **与本地命令同名** | `opacity: 0.6` + 行尾灰标注 | **跳过** | **不执行、不关面板、不改 activeIndex** |
| 已禁用（D-10） | 面板中**不渲染**（不是灰显） | — | 只能经手打语法命中，走 system-note |

**「跳过」的含义**：`state.slashPickerActiveIndex` 的取值域收敛为**可选中行的扁平索引集合**。
↑↓ 移动时跳过不可选中行，落在最近的可选中行（`ArrowDown` 向后、`ArrowUp` 向前）；
mousemove 命中不可选中行时**不改** `activeIndex`（`.active` 类不落在灰显行上）。
若过滤结果中**全部行都不可选中**，则 `activeIndex = -1`，Enter 回落既有
`executeActiveSlashCommand()` 返回 `false` 的路径（→ `handleSendAIMessage()` 的斜杠分支给出
system-note），**不新增分支、不新增空态文案**。

> **推导说明**：D-11 只锁「回车/点击都不执行」。若 ↑↓ 仍能落在灰显行上，Enter 会变成死键
> —— 因此「导航跳过」是「不可选中」的必要补全，记为**由 D-11 推导**的契约。
> 点击灰显行**不弹 system-note**（行尾标注常驻可见，已构成解释；与 D-15「不额外插 system-note」
> 同款理由：与已有信息重复）。

### 「与本地命令同名」这一状态（推导）

D-04 明确「显式语法与裸名都识别，**本地命令优先**」。若某技能名为 `clear` / `compact`，
面板里会出现两行同名 `/{name}`，点技能行却执行本地命令 —— 这是「点了没反应/点了做错事」的陷阱。

**契约**：渲染端按 `SLASH_COMMANDS` 的 name 集合做一次**集合查询**，同名技能行灰显不可选中，
行尾标 `与本地命令同名 · 本地命令优先`。技能行**仍然渲染**（不得静默隐藏 —— 违反
「禁止静默失败」的既有约定）。

**边界**：本判定**只做名字集合查询**，不重新定义任何技能优先级 / 遮蔽 / 限额判定
（单一数据权威在主进程，`ai-skills-manager.js`）。数据层的 `shadowed` 是「同名 user/managed
冲突」，与本条的「与本地命令同名」是**两件互不相干的事**，两条标注不得混写。

---

## 交互契约

| 场景 | 契约 |
|------|------|
| 触发 | 输入框值以 `/` 起始 → 打开面板（既有）。**本阶段零变化** |
| 过滤 | `/` 后、首个空白前的 token 小写后：技能的 **name 前缀命中排前**，**description 子串命中排后**（D-03）；本地命令的 `startsWith` 语义与相对顺序零变化（D-03）。描述命中时描述文本**不做命中高亮**（本阶段不引入 mark 样式） |
| 展平不变式 | `state.slashPickerItems` **保持展平单数组**（D-01），且**数组顺序必须等于视觉渲染顺序**（分组只在渲染层插入标题）。违反即 `activeIndex` 与视觉行错位、↑↓ 跳行 |
| 分区顺序 | 「技能」在上、「命令」在下（D-01 行文顺序）；D-03 的前缀/描述排序在**各自分区内**生效 |
| 键盘导航 | ↑↓ 循环、Esc 关闭、Enter 执行、焦点始终留在输入框（既有 `handleAIInputKeydown`）。**新增**：跨分区连续（分组标题不占索引）+ 跳过不可选中行 |
| 选择技能行执行 | 路径 A（面板）：`executeActiveSlashCommand()` 取 `rest` 后，由技能行分支组装**完整语法文本** `/skill:{name}{ rest ? ' ' + rest : ''}` 交主进程解析（D-19）。**不在 renderer 拼增强文本、不把技能正文塞进 `message`** |
| 选择命令行执行 | 走既有 `cmd.handler(rest)`，**逐字节不变** |
| 支持手打语法 | `/skill:name [args]` 与裸 `/name [args]` 都识别，本地命令优先（D-04）。边界语义沿用既有「严格前缀 + 空白边界」（`text === '/'+name \|\| text.startsWith('/'+name+' ')`），**不得**退化为宽松前缀匹配 |
| 流式中触发 | 先 `abortAIIfStreaming()` 再发（D-08 复用）；v1 不做 steer / followUp 排队 |
| 面板重渲染 | **不丢焦点、不关面板、不清输入框、不改 `activeIndex`**（除越界收缩）；重渲染后沿用 `scrollIntoView({block:'nearest'})` 保证不跳动 |
| 输入框文本保留 | 打开面板时输入框保留 `/{name}` 原文（既有语义：用户要看到命令原文再回车）—— **本阶段不改**，行显 `/{name}` 与输入框原文一致 |

---

## 刷新契约（D-17 · P8 门禁本阶段触发点）

| 阶段 | 契约 |
|------|------|
| 打开瞬间 | 用同步的 `getSkillsSnapshot()`（**新增 `realmAPI.*` IPC**，主窗口 `file://` 不能 fetch `/api/*` —— Phase 38 事故）**立即渲染**。**不显示骨架屏 / spinner / 「加载中」占位**（快照是零 IO 同步视图，没有可显示的等待态） |
| 后台刷新 | 面板打开后发起 `refreshSkills()`，完成后**原地重渲染** |
| 广播同步 | 新增 `skills:changed` 监听（`ai-manager.js:2541` 已在广播，renderer 侧当前零监听）。收到后**仅在面板打开时**重拉快照并原地重渲染 |
| 刷新失败 | **保留现有快照**（stale-while-revalidate 语义），面板内**不出现任何错误 UI** —— 错误走主进程诊断面（Phase 50 才展示）。禁止把失败变成面板空态 |
| 不闪的实现 | 重渲染沿用既有全量 `innerHTML` 替换即可（面板是瞬态浮层、无内部焦点，不产生可见闪烁）；**不需要** diff。**不需要**入场动画、**不需要** loading 过渡 |
| 自绘边界 | 面板**只渲染**，不得在渲染端重实现优先级 / 遮蔽 / 限额判定（46 D-06 的「单一数据权威」）。展平数组里的每个条目的状态字段**全部**来自主进程 |

---

## 用户气泡契约

**落点**：`src/renderer.js:8029` 起的 `isUser` 分支（`referencedTabs` / `attachments` pill 行的既有链路）

### 结构（自上而下）

```
.ai-message-content（用户气泡 = --accent-color 蓝底、白字）
  ├─ .ai-message-refs            ← 技能 pill 行（复用既有容器类）
  │    └─ .ai-message-ref-pill.ai-skill-pill
  │         ├─ .ai-skill-pill-badge      「技能」微标
  │         └─ .ai-message-ref-title     技能名（等宽 600）
  ├─ 正文（args 原文，纯文本）
  ├─ 附件图片 / 附件 pill 行（既有，位置不变）
  └─ .ai-skill-content-box       ← 技能正文折叠块（默认折叠）
```

### 技能 pill（D-06）

- 容器 `.ai-message-ref-pill` **原类复用**：20px 高 / `padding 1px 8px` / `border-radius 10px` /
  11px / `background: rgba(0,0,0,0.25)` / `color: inherit` / `max-width: 180px`
- 名 `.ai-message-ref-title` 原类复用（单行 ellipsis）
- 微标 `.ai-skill-pill-badge`（新增）：

```css
display: inline-flex; align-items: center; flex-shrink: 0;
padding: 1px 4px; margin-right: 4px; border-radius: 3px;
font-size: 11px; font-weight: 400; line-height: 1.4;
color: inherit; background: rgba(0, 0, 0, 0.25);
```

> **为什么微标不用 `.ai-attachment-pill-badge`**：后者底为 `var(--bg-hover)`（暗色 #404040），
> 坐在 `--accent-color` 蓝底气泡上会发灰发脏。`.ai-message-ref-pill` 家族的 `rgba(0,0,0,0.25)`
> 才是气泡语境的自适应做法 —— 微标必须与所属 pill 同底。

> **间距说明**：`margin-right: 4px` 与水平 `padding: 4px` 都在 4 网格内；垂直 `1px` 是
> `## Spacing Scale` **B 表第 1 条**登记的共用例外（4px 垂直内边距会把微标撑到约 23px，
> 超出宿主 `.ai-message-ref-pill` 的 `height: 20px`）。

- 技能名用**等宽字体 + 600**（与面板行名称同款），与 @ 引用 pill 的「彩色圆点 + 普通字重标题」
  和附件 pill 的「SVG 图标 + 标题」在形状上三者可辨
- 气泡**不显示** `/name` 原文与技能正文（D-06）
- 技能名超长 → pill `max-width: 180px` + 名 ellipsis；微标 `flex-shrink: 0` **不被截断**
- 微标 `title` 与来源徽标 `title` 同源文案（`用户技能（…）` / `随包内置技能…` / `托管技能…`）
  —— 气泡内不渲染彩色来源徽标（避免与蓝底撞色），来源信息经 `title` 可达

### 技能正文折叠块（D-09）

新增类 `.ai-skill-content-box`，**视觉值逐项照抄 `.ai-summary-box` 家族**：

| 属性 | 值 | 来源 |
|------|-----|------|
| 外框（`.ai-skill-content-box`） | `border: 1px solid var(--border-color)` / `border-radius: 8px` / `background: var(--bg-secondary)` / `overflow: hidden` / `flex-shrink: 0` / `max-width: 86%` | `.ai-summary-box`（`main.css:5733-5743`） |
| header（`.ai-skill-content-box-header`） | `display:flex; align-items:center; gap:6px; padding:6px 12px; cursor:pointer; user-select:none; font-size:12px; color:var(--text-secondary)` + hover 背景 `--bg-hover` | `.ai-summary-box-header`（`main.css:5745-5759`）。`gap: 6px` / `padding: 6px 12px` 为**照抄值**，已登记于 `## Spacing Scale` **B 表第 2 条** |
| chevron（`.ai-skill-content-box-chevron`） | `margin-left:auto` + 折叠时 `rotate(-90deg)` + `transition: transform 150ms ease` | `.ai-summary-box-chevron`（`main.css:5761-5768`） |
| body（`.ai-skill-content-box-body`） | 默认 `display:none`；展开后 `padding:8px 12px 10px; font-size:12px; line-height:1.6; color:var(--text-secondary); white-space:pre-wrap; word-break:break-word; border-top:1px solid var(--border-color); max-height:260px; overflow-y:auto` | `.ai-summary-box-body`（`main.css:5770-5785`）；`padding` 为照抄的存量值（A 表） |
| 覆盖项（**仅此两项**） | `max-width: 100%`、`margin: 4px 0 0` | 气泡内不需要居中；`4px` 对齐 `.ai-summary-box` 的存量 `margin: 4px auto`（`main.css:5738`），**在 4 网格内** |

- header 文案 `技能正文（N 字符）`（N 口径见 `## Copywriting Contract`）
- **默认折叠**（与 `/compact` 摘要框一致）
- 展开内容 = **技能正文本体**（`skill.content`，即 `<skill>` 包裹的内容）。
  **不含** `<skill name location>` 外层标签、不含 provenance 行、不含 args（args 已在气泡正文可见）
- 内容经 `textContent` 注入（沿用 `.ai-summary-box-body` 的既有做法，防 XSS）
- 展开/折叠状态**不持久化**：翻看历史 / 重渲染后回到折叠态（与 `/compact` 摘要框一致，零新状态）

---

## `read` 工具卡片技能化（D-15）

**落点**：`src/renderer.js:9224` §`renderToolCard`（已有 `execute_action (${action})` 先例）

### 触发

工具事件带**主进程打的标记**时进入技能变体（判定必须在工具事件生成侧完成 ——
renderer 不掌握技能目录的权威路径，是 CONTEXT 的裁量项）：

```
toolExecution.skillInvocation = { name: string, source: 'user'|'builtin'|'managed' }
```

**接口契约**：`skillInvocation` 缺失 / 非法 → **渲染为普通 `read` 卡片**（零回归）；
renderer **不得**按路径字符串自行匹配 `skills/` / `managed-skills/`（那会成为第二份判定实现）。

### 视觉

| 元素 | 契约 |
|------|------|
| 标题文案 | `使用技能「{name}」`（替换原始 `read`） |
| 名称容器 | `.tool-card-name` **原类零改动** + 新增修饰类 `.tool-card-name-skill`（`display:flex; align-items:center; gap:8px; min-width:0`） |
| 名称文本 | 内层新增 `.tool-card-name-text`（`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0`）+ **等宽字体** |
| 来源徽标 | `.slash-picker-source-badge` **同一类复用**（同尺寸、同色令牌、同 15% 混色底） |
| 状态图标 / 状态文字 | **不变**（`正在执行...` / `完成` / `失败`） |
| 折叠内容 | **不变** —— 参数区仍显示 `filePath`、结果区仍显示文件内容（用户要能核对读了哪个路径） |
| 展开/折叠交互 | **不变**（既有 header 点击 toggle） |

- `.tool-card-name-skill` 的 `gap: 8px` **在 4 网格内**，与父容器 `.tool-card-header` 的存量
  `gap: 8px`（`main.css:6001`）同值 —— 使「图标↔名称」与「名称↔徽标」两处间隙一致；
  **不得**改用 6px（那是 `## Spacing Scale` B 表的例外值，仅折叠框 header 可用）

### 负向约束

- **不额外插 system-note**（D-15）—— 与 tool card 信息重复，且自动匹配可能多次触发
- **不新增卡片形状**、不新增图标、不改 `.tool-card` 系列既有规则
- 技能名超长 → 由 `.tool-card-name-text` 截断，徽标 `flex-shrink: 0` 不受影响

---

## UI Considerations

Applicable state considerations resolved: 12 covered, 2 backstop, 0 unresolved

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | `/` 面板列表（list-collection） | ✅ covered | 过滤无命中 → 单行空态，文案 `无匹配技能或命令，输入 / 查看全部`（沿用既有 `.slash-picker-row` + `.slash-picker-desc` 形态，`cursor:default`，无标题）；技能集为空时**只渲染「命令」分区**，空分组标题不输出（D-01） |
| empty | 面板「技能」分区（list-collection） | ✅ covered | 0 个已启用技能时该分区连同标题**整个不渲染** —— 不是空分区占位（D-01）。已禁用技能在面板隐藏（D-10），因此禁用全部技能等价于技能集为空 |
| loading | `/` 面板列表（list-collection） | ✅ covered | **无 loading 态**：打开即用同步快照渲染，不显示骨架屏 / spinner / 占位文字；后台刷新完成后原地重渲染（`## 刷新契约`） |
| loading | 用户气泡 / 工具卡片（media, interactive-control） | ✅ covered | 本阶段不在气泡与卡片内引入异步态：折叠块内容随消息对象一次到位；`read` 卡片沿用既有 `running` 状态图标与「正在执行...」文字 |
| error | `/` 面板列表（list-collection） | ✅ covered | 快照刷新失败**保留旧快照**、面板内零错误 UI（避免把瞬时失败渲染成面板空态）；失败可见性归主进程诊断面（Phase 50） |
| error | 技能显式调用（interactive-control） | ✅ covered | 三条错误反馈全部走既有 `.ai-system-note` 单行形态，文案见 `## Copywriting Contract`（禁用 / 未找到 / 未知命令），**零新渲染形状** |
| populated | `/` 面板列表（list-collection） | ✅ covered | 典型量 = 2 条本地命令 + 若干技能；两个 sticky 分组标题 + 行内容五要素（名 / 徽标 / `仅显式` / 描述 / 状态标注） |
| partial | `/` 面板列表（list-collection） | ✅ covered | stale-while-revalidate 的中间态：待渲染条目已可用但技能集可能已变更 —— 属**正常可交互态**，不显示任何「数据可能过期」提示（语义上快照就是权威视图，刷新是自愈） |
| overflow | `/` 面板列表（list-collection） | ✅ covered | 面板 `max-height: 220px`（存量）+ `overflow-y: auto`；active 行经 `scrollIntoView({block:'nearest'})` 保持可见；分组标题 sticky 常驻 |
| overflow | 技能正文折叠块（static-content） | ✅ covered | body `max-height: 260px` + `overflow-y: auto` 内部滚动（照抄 `.ai-summary-box-body`）；header 不随内容滚动 |
| zero-one-many | `/` 面板列表（list-collection） | 🧪 backstop | **0 技能**：只渲染「命令」分区（已覆盖）；**1 项**：单行，无「数量」类文案需要复数处理（中文无单复数）；**50+ 项**：`max-height:220px` 下实际观感（两个 sticky 标题占用后的剩余可视行数）为 CONTEXT 明确列出的**待实测项** —— 需在真实 50 技能数据集上视觉确认，**若不可接受，处理方式是调整 `--ai-panel-*` 之外的面板高度常量，不得改动分组/标注结构** |
| overflow | 面板行尾状态标注（static-content） | ✅ covered | 行 `flex-wrap: wrap`；标注 `flex-shrink:0` + `nowrap`，宽度不足时自动换到第二行右对齐（280px 最窄面板下仍完整可读）；**永不截断** |
| long-text | 面板行（list-collection） | ✅ covered | 名称 `nowrap`（`.slash-picker-name` 存量）+ `flex-shrink:0`；描述 `flex:1; min-width:0` + 单行 ellipsis（存量 `.slash-picker-desc`）。超长描述不换行、不撑高 |
| long-text | 用户气泡技能 pill（static-content） | ✅ covered | pill `max-width: 180px`（存量）+ 名 `.ai-message-ref-title` ellipsis；`技能` 微标 `flex-shrink:0` 优先保留 |
| long-text | `read` 卡片技能标题（static-content） | ✅ covered | `.tool-card-name-text` ellipsis（`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0`）；徽标 `flex-shrink:0` |
| long-text | 技能正文折叠块 body（static-content） | ✅ covered | `white-space: pre-wrap` + `word-break: break-word`（照抄存量），长行强制折行，无横向滚动 |
| long-text | system-note（static-content） | ✅ dismissed | 技能 `name` 受 `^[a-z0-9-]+$` 与目录名约束、`description` 不进入任何 system-note 文案 —— 三条反馈文案长度天然可控，**不改** `.ai-system-note` 的既有宽度行为（改它会波及 `/clear`、`/compact` 等既有反馈） |
| long-text | `read` 卡片标题「使用技能「name」」（interactive-control） | ✅ covered | 归入上表「`read` 卡片技能标题」行；卡片 header 有 `height:36px` 固定高，截断不改变行高 |

> **backstop 行的含义**：`50+ 技能下的 220px 面板观感` 无法由静态契约裁决，需真实数据集的视觉确认。
> 验证时**无显式证据**则路由到 `human_needed`，不得静默通过。

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| （无） | — | not applicable —— 项目未初始化 shadcn（无 `components.json`），不消费任何 registry，无第三方 block 需要 vetting |

---

## 决策来源表

| 契约条目 | 来源 |
|----------|------|
| 面板分区 + sticky 标题 + 空分组不渲染 + 单数组不变式 | D-01 |
| 行四要素（名称 / 来源徽标 / 截断描述 / `仅显式`）+ 不显示体积文件数诊断 | D-02 |
| 过滤 = name 前缀命中前 + description 子串兜底后；命令零变化 | D-03 |
| 行显 `/{name}`、选中即执行、`/skill:` 与裸名都识别、本地命令优先 | D-04 |
| 用户气泡 = 技能徽标 pill + args 正文、不显示 `/name` 与正文 | D-06 |
| 技能正文折叠块（默认折叠、可展开看正文） | D-09 |
| 禁用技能：面板隐藏 + 显式调用 system-note（文案 D-10 原文） | D-10 |
| 遮蔽：可见 + 灰显不可选中 + 行尾「已遮蔽 · 由用户同名技能胜出」 | D-11 |
| 超限：列出 + 可显式调用 + 行尾「未进提示词 · 超预算」/「超数量上限」 | D-12 |
| 不存在 / 未知命令的 system-note 文案 + 零新渲染形状 | D-13 |
| 三档来源徽标**判定**（本契约只消费，不重新定义） | D-14（判定由 Phase 47 D-11 锁定） |
| `read` 卡片技能化（`使用技能「name」` + 徽标 + 不加 system-note） | D-15 |
| stale-while-revalidate 刷新链路 + `skills:changed` 监听 | D-17 |
| 主进程解析完整语法文本（renderer 不拼增强文本） | D-19 |
| **三档来源徽标各自独立配色** | **用户（本次 ui-phase 问答）** |
| **气泡 pill = `技能` 微标 + 技能名** | **用户（本次 ui-phase 问答）** |
| **超限标注用警示橙、遮蔽标注用中性灰** | **用户（本次 ui-phase 问答）** |
| 徽标 / 标记 / 标注 / 分组标题的具体尺码与色值 | 本契约（存量先例 + 对比度核算） |
| 新增间距值一律对齐 4 网格；两条不可对齐的偏离（徽标垂直 `1px`、折叠框 header 的照抄值）逐条登记 | 本契约（`## Spacing Scale` Exceptions B 表；值均以 `src/styles/main.css` 既有类的实际值为先例核对） |
| ↑↓ 跳过不可选中行 + 灰显禁用态口径 | 由 D-11 推导（「不可选中」的键盘补全） |
| 「与本地命令同名」行的灰显处理与标注 | 由 D-04 的优先级规则推导 |
| `--skill-limit-text` 浅色专用值 | 本契约（`--warning-color` 在浅色主题对比度不足） |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending
