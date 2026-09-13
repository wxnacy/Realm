---
phase: "49"
slug: "manage-skill-ai"
status: approved
shadcn_initialized: false
preset: none
created: "2026-09-13"
reviewed_at: "2026-09-13"
---

# Phase 49 — UI Design Contract

> `manage_skill` 工具（AI 自建技能）的视觉与交互契约。
> 由 gsd-ui-researcher 生成，gsd-ui-checker 校验。
>
> **本阶段 UI 面只有一处**：D-02 的**工具卡片技能化**（`renderToolCard()` 的 `manage_skill` 变体）。
> 整个阶段**不新增页面、不新增弹框、不新增图标、不新增折叠控件家族** —— 卡片骨架、徽标查表、
> 正文折叠块、参数/结果折叠区**全部已存在**（48 D-15 / D-09 交付）。契约只描述**新增的三个内联
> 视觉元素与新增的一条文案域**，并逐项指明复用的既有类与既有令牌。
> **不得**另起一套设计系统、第二份徽标实现或第五种折叠外观。
>
> **与 48 的关系**：本阶段复用 48 建立的三档来源徽标（`TIER_BADGE` + `--skill-source-*` +
> `.slash-picker-source-badge`）与技能正文折叠块（`.ai-skill-content-box`），因此 48-UI-REVIEW
> 挂账的**两条共用面缺陷**成为本阶段的前置条件（见 `## Color` 的「前置修复」小节）。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none（无 `components.json` / 无 `tailwind.config.*` / `package.json` 依赖中无 UI 框架） |
| Icon library | none（图标为 `renderToolCard` 内联手写 SVG；**本阶段不新增任何图标**） |
| Font | 系统字体栈 `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`（`src/styles/main.css:120`，`body` 规则）；技能名与正文区用等宽 `var(--font-mono, monospace)` / `'SF Mono', Monaco, …`（既有 `.tool-card-name-text` / `.tool-card-value` 用法） |

**样式令牌的实际来源**：全部为 `src/styles/main.css` 顶部两个主题块的**手写 CSS 自定义属性**，
不是任何设计系统产物：

- `:root, [data-theme="dark"]`（`main.css:7-30`）—— 深色主题（默认）
- `[data-theme="light"]`（`main.css:32-56`）—— 浅色主题

两套主题**必须同时**定义本阶段新增的令牌（缺一即在对应主题下失效）。

**shadcn 门禁**：项目非 React / Next.js / Vite，纯手写 HTML + 原生 JS，**门禁不适用**，不做初始化。
**Registry 安全门禁**：无第三方 registry，见 `## Registry Safety`。

---

## Component Inventory

Could not enumerate: 项目无组件库、无设计系统包 —— 无 `components.json`、无 `tailwind.config.*`、
`package.json` 依赖中无 UI 框架；全部 UI 为手写 HTML 元素 + 单文件 `src/styles/main.css`（约 10k 行），
不存在可枚举的组件导出面。

本阶段的「组件清单」因此是**既有可复用原语的清点**，由以下可重跑命令生成（非组件库枚举）：

```bash
grep -nE "^\.(tool-card|ai-skill|ai-message-ref)[a-z-]*[ ,{]" src/styles/main.css
```

**非穷尽清单 —— 不是封闭白名单。** 执行时如需表外原语，直接查 `main.css` 是**预期路径**，
不是例外。本表的作用是标出本阶段**已经核对过**的复用点，不是允许使用的上限。

| 既有原语（类 / 函数） | 位置 | 本阶段如何复用 |
|----------------------|------|----------------|
| `.tool-card` | `main.css:6075` | 卡片外壳：`background-color: var(--ai-tool-card-bg)` / `border-radius: 8px` / `overflow: hidden`。**零改动** |
| `.tool-card-header` | `main.css:6082` | 头部：`display:flex` / `align-items:center` / `gap:8px` / `padding:0 12px` / `height:36px` / `cursor:pointer` / hover 底 `var(--bg-hover)`。**零改动**（**不得**加 `flex-wrap` —— 见 `## 卡片结构契约` 的单行不变式） |
| `.tool-card-name` | `main.css:6128` | 名称容器：`flex:1` / `overflow:hidden` / ellipsis / nowrap / 12px / 500。**零改动**（本阶段声明的字重不受影响，见 `## Typography` 的继承登记） |
| `.tool-card-name-skill` | `main.css:6149` | **48-03 已建**的技能变体容器：`display:flex` / `align-items:center` / `gap:8px` / `min-width:0`。**原类复用，零改动** —— `manage_skill` 变体的「标题 + 徽标 + 内联标注」三项正好落在同一 flex 行内 |
| `.tool-card-name-text` | `main.css:6158` | 技能变体的标题文本：等宽 + `overflow:hidden` / ellipsis / nowrap / `min-width:0`。**原类复用，零改动** —— 它是头部**唯一**承担压缩的元素 |
| `.slash-picker-source-badge` + 三个 `-user` / `-builtin` / `-managed` | `main.css:7162-7188` | 三档来源徽标（面板行 / `read` 卡片 / 本阶段卡片**三处共用同一类**）。**只允许按 48-UI-REVIEW 的对比度修复调整底色基准**，不得新增第四个色相或第二份徽标实现 |
| `TIER_BADGE` | `src/skill-picker-model.js:324` | 三档徽标的 `label` / `className` / `title` **唯一权威查表**（renderer 与主进程共用同一 api 对象）。本阶段**只查表、不扩表、不复制文案** |
| `.tool-card-status` | `main.css:6139` | 状态文字（`正在执行...` / `完成` / `失败`）。**零改动** |
| `.tool-card-icon` + `-spin` / `-success` / `-error` | `main.css:6097-6125` | 三态 SVG 图标。**零改动** |
| `.tool-card-content` | `main.css:6167-6177` | 折叠内容区：默认 `max-height:0`；`.tool-card.expanded` 时 `max-height:500px; overflow-y:auto`。**零改动**（它是本阶段正文的**唯一滚动容器**） |
| `.tool-card-params` / `.tool-card-label` / `.tool-card-value` | `main.css:6180-6205` | 参数区骨架与键值排版（`pre` + `pre-wrap` + `word-break:break-word` + `overflow-x:auto`）。**零改动**，只改「往里放什么」 |
| `.tool-card-result` | `main.css:6181` | 结果 / 错误区（标签按状态在 `结果` / `错误` 间切换）。**零改动** |
| `.ai-skill-content-box` 家族 | `main.css:5819-5869` | **48 D-09 已建**的「技能正文（N 字符）」折叠块（`.ai-summary-box` 家族的照抄实现）。**原类复用**，卡片语境只允许两处 scoped 覆盖（`margin` / `max-height`），**不得新建第二份折叠实现** |
| `.tool-cards-container` | `main.css:6067` | 多张卡片的纵向容器（`gap: 8px`）。**零改动** |
| `renderToolCard()` | `src/renderer.js:9552` | 唯一的工具卡片渲染函数（48-03 的 `read` 技能变体已在此特殊化标题）。本阶段在同一函数内加 `manage_skill` 分支 |
| `renderSkillContentBox()` | `src/renderer.js:8927` | 技能正文折叠块的**唯一构建实现**（48 D-09）。卡片语境复用同一 DOM 结构与类名 |
| `SKILL_TIER_TITLES` / `skillTierTitle()` | `src/renderer.js:8847-8860` | 气泡语境的三档 `title` 文案（48-01 建的**第二份**副本，WR-01 在册）。本阶段**不使用**它 —— 卡片徽标一律查 `TIER_BADGE`，**不得把副本扩大到第三处** |

---

## Spacing Scale

声明值（**新增元素**的 `gap` / `padding` / `margin` 只允许取 4 的倍数；唯一例外通道是下方
Exceptions 的 **B 表** —— 偏离值必须逐条登记并附理由与既有先例）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 折叠块与相邻区段的外边距；徽标水平 `padding`（既有登记例外） |
| sm | 8px | 头部内元素间隙（由宿主既有 `gap: 8px` 提供，**不新增声明**）；折叠块下半外边距 |
| md | 16px | 本阶段**未使用**（保留） |
| lg | 24px | 本阶段**未使用**（保留） |
| xl | 32px | 本阶段**未使用**（保留） |
| 2xl | 48px | 本阶段**未使用**（保留） |
| 3xl | 64px | 本阶段**未使用**（保留） |

**12px 亦在标内**（4 的倍数），本阶段用于水平内边距 —— 它就是既有
`.tool-card-header { padding: 0 12px }` 与 `.tool-card-params { padding: 8px 12px }` 的存量值，
沿用而非新引入。**本阶段新增声明只有两条**（`margin: 4px 12px 8px` / `margin: 4px 0 0`），
两值均在 4 网格内。

### Exceptions

**A. 存量继承值** —— 既有类的值，被复用或照抄；允许继续存在，**不得新增同类偏离**：

| 既有类 / 属性 | 值 | 位置 | 处理 |
|--------------|-----|------|------|
| `.tool-card-header` | `gap: 8px` / `padding: 0 12px` / `height: 36px` | `main.css:6082-6090` | **不改** —— 内联标注与徽标的间隙全部由该 `gap` 提供（因此新标注类**零 padding / 零 margin**） |
| `.tool-card-name-skill` | `gap: 8px` / `min-width: 0` | `main.css:6149-6154` | **不改** —— 与父容器 `gap` 同值，使「图标↔标题」「标题↔徽标」「徽标↔标注」三处间隙一致 |
| `.tool-card-params` | `padding: 8px 12px` | `main.css:6180-6184` | 照抄值（折叠块的水平内边距与它对齐） |
| `.tool-card-value` | `padding: 8px` | `main.css:6193-6205` | 照抄值 |
| `.slash-picker-source-badge`（三档共用） | `padding: 1px 4px` | `main.css:7166` | **48-UI-SPEC 已登记的共用例外**（11px 文字上的发丝级垂直内边距；取 4px 会撑破 20px 高的 pill 宿主）。本阶段沿用，**不重复登记、不放大** |
| `.ai-skill-content-box-header` | `gap: 6px` / `padding: 6px 12px` | `main.css:5829-5839` | **48-UI-SPEC 已登记的例外**（逐值照抄 `.ai-summary-box-header`）。本阶段照抄复用，**不重复登记** |
| `.ai-skill-content-box-body` | `padding: 8px 12px 10px` | `main.css:5854-5864` | 照抄值（48 的 A 表已登记） |

**B. 本阶段新增声明中非 4 倍数的值 —— 零条。**

本阶段**不新增任何非 4 倍数的间距值**：两个新增元素（头部内联标注、技能正文折叠块）
**不声明 padding / margin 之外的任何间距**，且其全部 padding / margin 均为 4 的倍数。
执行时若确需新值，**必须先补进本表**（附理由 + 既有先例）再落码 —— 契约与 CSS 块必须始终自洽。

无 44px 触控目标例外：本阶段全部控件是桌面端键盘优先的工具卡片，无独立触控入口。

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 12px | 400 | 1.5 |
| Label | 11px | 400 | 1.4 |
| Heading | 13px | 600 | 1.2 |
| Display | 14px | 400 | 1.5 |
| Inherited（既有卡片标题与参数区，**本阶段不改**） | 12px | 500（继承） | 1.4（继承，`.tool-card-value` 存量声明） |

**本阶段声明**：**4 个字号、2 个字重**（400 / 600）。逐个用途：

- **Body 12px / 400** —— 参数摘要（复用 `.tool-card-value` 存量 12px）、结果 / 错误全文
  （同）、正文折叠块正文（复用 `.ai-skill-content-box-body` 存量 12px）
- **Label 11px / 400** —— **本阶段新增的两条内联标注**（失败短原因 / 成功那条的 `超预算`
  —— 后者取自 `/` 面板行尾未进提示词标注的短形态投影 `PROMPT_OMITTED_CARD_NOTE`），
  与同处头部「元数据簇」的来源徽标（既有 11px）同档
- **Heading 13px / 600** —— 本阶段**未使用**（保留；面板行名 `/{name}` 属 48 面）
- **Display 14px / 400** —— 本阶段**未使用**（保留以免执行时误用第 5 个字号）

> **表末行是「继承登记」，不是本阶段声明。** `.tool-card-name`（`main.css:6128-6136`：
> `font-size: 12px; font-weight: 500`）是既有工具卡片标题的存量值，本阶段**只改文案内容 +
> 追加徽标与标注，不改该类**。它的 500 不计入本阶段声明的字重数，也不得因此新增任何 500 字重的新类。

Exceptions：

- 卡片标题沿袭 `.tool-card-name` 的存量 **12px / 500**（含 48-03 建立的 `.tool-card-name-text`
  只加等宽字体、不动字号字重）—— 本阶段不变
- 内联标注取 **11px** 而非面板行尾状态标注的 12px：两者是**不同表面** —— 面板行是整行宽、
  无图标与状态文字竞争；卡片头部是 36px 单行，多一个字号档就会把技能名挤到不可读。
  该 11px 与徽标同档，已在 Label 行声明，**不引入第 5 个字号**
- 正文折叠块正文的 `line-height: 1.6` 照抄 `.ai-skill-content-box-body` 存量值

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-primary` — 暗 `#1a1a1a` / 亮 `#ffffff` | 聊天面板底色（卡片浮在其上） |
| Secondary (30%) | `--bg-secondary` — 暗 `#2a2a2a` / 亮 `#f5f5f5`；卡片底 `--ai-tool-card-bg` — 暗 `#252525` / 亮 `#f0f0f0` | 卡片底（存量）、参数值底与正文折叠块底（存量 `--bg-secondary`）、头部 hover 底 `--bg-hover`（暗 `#404040` / 亮 `#e0e0e0`） |
| Accent (10%) | `--accent-color` `#3B82F6` | **本阶段不新增任何 accent 使用点** |
| Warning | `--skill-limit-text` — 暗 `#F59E0B` / 亮 `#92400E`（**修值，见前置修复 ②**） | 仅 `/` 面板行尾的「未进提示词」标注；卡片头部的超预算形态取该来源的短投影（同一令牌，见 E1 overflow 收口记录） |
| Destructive | `--danger-color` `#EF4444` | **仅状态图标的既有用色**（失败 ✗）。**不得**用作文本色 —— 4.5:1 不达标（实测对卡片底 4.07:1 暗 / 3.30:1 亮） |

**Accent reserved for（显式清单，非「所有可交互元素」）**：

1. 用户气泡背景（`--accent-color`，`.ai-message-user .ai-message-content`，**既有，非本阶段新增**）
2. 附件拖拽遮罩边框（`.ai-drop-overlay`，**既有，非本阶段新增**）

> **本阶段新增元素零 accent 使用。** 卡片头部 hover 继续用 `--bg-hover`（既有
> `.tool-card-header:hover`），**不得**改为 accent 背景；展开 / 折叠态不加 accent 边框。

### 新增令牌：失败短原因文字色

`--danger-color`（`#EF4444`）作为 11px 文字色在卡片底上**不达标**（见上表 Destructive 行实测），
故按 48 对 `--skill-limit-text` 的同款处置**定义专用令牌**：

| 令牌 | 暗色值 | 浅色值 | 用途 |
|------|--------|--------|------|
| `--skill-error-text` | `#FCA5A5` | `#B91C1C` | 头部内联**失败短原因**（11px） |

写入 `:root, [data-theme="dark"]` 与 `[data-theme="light"]` **两处**（缺一即对应主题失效）。

### 对比度核算（WCAG 1.4.3，11px/12px 属小字 ⇒ 硬要求 **≥ 4.5:1**）

卡片头部在 hover 时底色切到 `--bg-hover`（`main.css:6092-6094`），而**键盘/鼠标停留是常驻状态**；
48-UI-REVIEW 的 Pillar 3 finding 正是「契约只按面板底核算、漏了自身的 hover 底」。
**本表对两个底色都核算**（`--ai-tool-card-bg` = 常态，`--bg-hover` = 最劣态）：

| 元素 | 暗 · 卡片底 `#252525` | 暗 · hover 底 `#404040` | 亮 · 卡片底 `#f0f0f0` | 亮 · hover 底 `#e0e0e0` | 判定 |
|------|----------------------|------------------------|----------------------|------------------------|------|
| 失败短原因 `--skill-error-text` | 8.08:1 | 5.46:1 | 5.68:1 | 4.90:1 | ✅ 全档达标 |
| `/` 面板行尾「未进提示词」标注 + 卡片头部的超预算形态投影（同一 `--skill-limit-text`） | 7.14:1 | 4.83:1 | 6.22:1 | 5.37:1 | ✅ 全档达标（暗色 hover 余量较薄，见下注） |
| 三档来源徽标（`用户` / `内置` / `托管`） | 5.72 / 6.58 / 5.59 | 同左（**底色已钉死**） | 4.89 / 4.70 / 5.30 | 同左 | ✅ 见前置修复 ① |

> **暗色 hover 余量提示**：`--skill-limit-text` 暗色值对 `--bg-hover` 仅 4.83:1。任何调值都
> **必须**在这四个组合下重算并更新本表；**不得**只为「更好看」而调整。
> **失败短原因的四档全达标**，含最劣的浅色 hover 底（4.90:1）。

### 前置修复（本阶段复用的 48 共用面，两条）

本阶段把 48 的两个共用元素搬到**同一个带 hover 的卡片头部**上，因此 48-UI-REVIEW 挂账的两条
对比度缺陷成为本阶段的**硬前置条件**（不是新工作，是复用面成立的前提）：

| # | 修复 | 位置 | 为什么本阶段必须落 |
|---|------|------|-------------------|
| ① | 三档徽标底色基准由 `transparent` 改为 `var(--bg-secondary)`（`background: color-mix(in srgb, var(--skill-source-<tier>) 15%, var(--bg-secondary))`；边框同理 30%） | `main.css:7172-7188` | 底色钉死后**不再随宿主背景漂移**，比值在面板行与卡片头部的任意 hover 态下同时成立（下表值即钉死后的实测值）。不修则卡片 hover 态复现 48 的同一条 finding |
| ② | 浅色 `--skill-limit-text` 由 `#B45309` 改为 `#92400E` | `main.css:55` | 原值对浅色 hover 底实测 3.80:1（不达标）；卡片头部与面板行同款 hover，且标注更靠近图标与状态文字，可达性要求一致 |

修完请**回归核对面板行**（48 的既有面）—— 两处共用同一类，修复对两侧同时生效，面板侧数值
即 48-UI-REVIEW 已实测的 暗 5.72 / 6.58 / 5.59、亮 4.89 / 4.70 / 5.30。

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | **无新增按钮文案** —— 卡片是**只读记录**（AI 调用 `manage_skill` 的产物），用户无发起入口。唯一交互是既有「点击头部展开 / 折叠」与折叠块的展开 |
| Empty state | **不适用** —— 卡片由工具调用驱动，不存在列表空态；`content` / `description` 由 D-07 强制 trim 后非空，因此**不存在空正文、空描述、空折叠块**（见 `## UI Considerations` 的两条 dismissed 行） |
| Error state | 见下方**九条原因码表**：头部短原因（11px 内联）+ 展开区完整文案（既有「错误」区），二者均**由主进程单点产出**，渲染端只呈现 |
| Destructive confirmation | **本阶段无任何确认卡片** —— D-01 已锁定 create / update / delete **三动作一律自动**（`delete` 亦不弹确认）。这是**决策而非遗漏**：破坏面已被硬沙箱限定在 AI 专用数据区，且 `write` / `bash` 本就能直写同一路径，单独确认会被绕道成为虚假安全感（D-05 同款判断） |

### 卡片标题（三动作白名单，`MANAGE_SKILL_ACTION_LABEL`）

| `action` | 标题文案 |
|----------|---------|
| `create` | `创建技能「{name}」` |
| `update` | `更新技能「{name}」` |
| `delete` | `删除技能「{name}」` |
| 表外 / 缺失 / `name` 非非空字符串 | **整个技能变体不成立** → 回落到既有普通卡片（标题 = 工具名 `manage_skill`），零回归 |

- 标签表住 `src/skill-picker-model.js`（跨进程单源，`ai-manager.js:138` 已 `require` 同一 api 对象）
  —— renderer 与主进程共用**一份**，不得在任一侧另写一份映射。
- `{name}` 一律经 **DOM `textContent`** 注入（48 D-15 / T-48-10 同款）。**禁止**把 `name`
  拼进 `innerHTML`、`title`、`class`、`dataset` 或任何属性值（TD-48-01 的教训面）。

### 九条原因码（`details.code` / 短原因表 `MANAGE_SKILL_SHORT_REASON`）

| `code` | 头部短原因（11px 内联，**定长，不含技能名**） | 展开区完整文案（单点产出于主进程；`{N}` 取自 `LIMITS`，**不得写死**） |
|--------|-----------------------------------------------|----------------------------------------------------------------------|
| `seeded_protected` | `内置不可改删` | `「{name}」是随包内置技能，AI 不能覆盖或删除。请换一个名字创建，或用 update 增强自己创建的技能。` |
| `user_owned_conflict` | `用户技能占用` | `已存在同名用户技能「{name}」；用户技能优先级更高，AI 创建的会被永久遮蔽，因此未写入。请换一个名字。` |
| `already_exists` | `已存在` | `技能「{name}」已存在（AI 自建）。请用 update 更新，或换一个名字创建。` |
| `not_found` | `不存在` | `技能「{name}」不存在，无法更新或删除。` |
| `limit_exceeded` | `超数量上限` | `AI 自建技能数量已达上限（{MAX_MANAGED_SKILLS}）。请先删除不再需要的技能再创建。` |
| `invalid_name` | `名称不合法` | `技能名不合法：只允许小写字母、数字与连字符，长度不超过 64，且不能以连字符开头 / 结尾或出现连续连字符。` |
| `invalid_description` | `描述不合法` | `技能描述不合法：不能为空，且不能超过长度上限。` |
| `oversize` | `正文超限` | `技能正文超过上限（{MAX_SKILL_MD_BYTES}）。请精简后再写入。` |
| `unscannable` | `内容含风险` | `内容未通过安全检查，已拒绝写入。请移除注入指令或凭据类内容后重试。` |

**纪律**：

- 短原因表是**闭合白名单**：表外 code → **不渲染标注**（不得回落到 `undefined` 字面量）。
- 短原因**一律不含技能名 / 不含变量**（失败态定长 ≤ 6 字；成功那条渲染 `超预算` —— 由 `/` 面板
  那段行尾原文（含「未进提示词」）的 `STATUS_TEXT.promptOmitted` 第二段**机械投影**而来，见
  `## UI Considerations` 的 E1 overflow 收口记录），故卡片域最宽只是 6 字 —— 这是头部单行不变式成立的前提（见 `## 卡片结构契约`）。
- 完整文案是**单点实现**（主进程抛出的业务错误消息即其载体）。渲染端**不得**含这九条文案
  —— 沿用 48-06 的跨文件护栏思路（两侧不可能被同时删改而无人发现）。
- `limit_exceeded` 的短原因**必须**与面板行尾标注 `超数量上限`（`STATUS_TEXT.overLimit`）**同值**
  （查同一张表 / 复用同一字符串，不得新写一份）。「哪个限额 / 当前值」的数值口径归 Phase 50。

### 成功结果文本（工具返回给模型，同时显示在卡片「结果」区）

| 动作 | 文案 |
|------|------|
| `create` | `已创建技能「{name}」。该技能从下一条消息起可用。` |
| `update` | `已更新技能「{name}」。下一条消息起按新正文生效。` |
| `delete` | `已删除技能「{name}」。下一条消息起不再可用。` |

**「下一条消息起可用」不是可选修饰语而是契约** —— D-13 的忙时语义（工具执行期必走忙分支、
真正回写落在本轮成功出口）对用户完全不可见，不说明就会被读成「AI 建的技能没用」。

`promptIncluded === false` 时在结果文本末尾追加一句（**仅 create / update**）：

> `该技能暂未进入模型提示词（技能段预算已满），仍可用 /skill:{name} 手动调用。`

### 全部用户可见文案（唯一权威清单）

| 位置 | 文案 | 来源 |
|------|------|------|
| 卡片标题（create / update / delete） | 见上方三动作表 | D-02 **原文**「创建 / 更新 / 删除技能「foo」」 |
| 卡片标题（变体不成立） | 既有工具名 `manage_skill` | 48-03 的「非法标记 → 普通卡片」同款回落 |
| 来源徽标文字 / `title` | `用户` / `内置` / `托管` + 三条 `title` | **零新增** —— 查 `TIER_BADGE`（D-14 判定，Phase 47 D-11 锁定） |
| 头部短原因（九条） | 见上方原因码表 | 本契约（对应 D-07 的九码） |
| 头部「未进提示词」标注 | `超预算` | 复用 48 的 `STATUS_TEXT.promptOmitted`（`/` 面板行尾用**完整两段式**），取该单源的 **≤ 4 字第二段投影**（`PROMPT_OMITTED_CARD_NOTE`），48 的面板串逐字未变 |
| 正文折叠块 header | `技能正文（N 字符）` | **逐字复用 48 D-09**；N = `content.length`（JS `String.length`，与 prompt 段预算同口径，**不是字节数**） |
| 参数区标签 / 值 | 标签 `参数`（既有）；值三行：`动作：创建`/`更新`/`删除`、`技能名：{name}`、`描述：{description}`（`delete` 只有前两行） | 本契约（D-02「用户感知」的可核对面） |
| 结果 / 错误区标签 | `结果` / `错误` | 既有（按状态切换），**零改动** |
| 成功结果文本 | 见上方三条 | 本契约（含 D-13 的「下一条消息起可用」） |
| 失败完整文案（九条） | 见上方原因码表 | 单点产出于主进程（业务错误消息） |

> **文案纪律**：全部 UI 文案为简体中文；技术标识（技能 `name`、`/skill:name`、`manage_skill`、
> `create`/`update`/`delete`）保留原文。
> **注入纪律（硬约束）**：技能名 / 描述 / 正文 / 错误全文**一律经 `textContent`**（DOM API）
> 注入；**不得**把任何来自 LLM 参数或工具结果的字符串拼进 `innerHTML` / 属性值。
> 本阶段**不新增任何属性上下文插值** —— 徽标 `label` / `title` 与 `className` 一律查
> `TIER_BADGE` 白名单表（表外跳过徽标，不产出 `undefined` 字面量进 class）。

---

## 卡片结构契约（`manage_skill` 变体）

**落点**：`src/renderer.js:9552` §`renderToolCard`（48-03 的 `read` 技能变体已在此特殊化标题）

### 结构

```
.tool-card.tool-card-manage                          ← 新增钩子类（见下「钩子类」）
  ├─ .tool-card-header                               ← 存量（36px 单行，零改动）
  │    ├─ .tool-card-icon.tool-icon-{spin,success,error}   既有三态 SVG
  │    ├─ .tool-card-name.tool-card-name-skill       ← 存量容器原类复用
  │    │    ├─ .tool-card-name-text                  存量类 → 标题「创建技能「foo」」
  │    │    ├─ .slash-picker-source-badge.<tier 白名单类>   存量类，查 TIER_BADGE
  │    │    └─ .tool-card-manage-note[-error|-limit] ← 新增（0 或 1 个）
  │    └─ .tool-card-status                          存量（正在执行.../完成/失败）
  └─ .tool-card-content                              ← 存量折叠区（默认折叠，展开 500px + 滚动）
       ├─ .tool-card-params                          ← 存量骨架，内容改为「剔除 content 的摘要」
       │    ├─ .tool-card-label 参数
       │    └─ .tool-card-value 动作：创建\n技能名：foo\n描述：…
       ├─ .ai-skill-content-box.collapsed            ← 存量折叠块（create/update 才有）
       │    ├─ .ai-skill-content-box-header / -title / -chevron
       │    └─ .ai-skill-content-box-body
       └─ .tool-card-result[.tool-card-params 同款骨架]  ← 存量，标签 结果 / 错误
```

### 头部三个新增/复用元素

| # | 元素 | 类 / 规格 | 说明 |
|---|------|----------|------|
| 1 | 标题文本 | `.tool-card-name-text`（**存量，零改动**） | 三动作白名单文案；等宽；**头部唯一承担压缩的元素**（`min-width:0` + ellipsis） |
| 2 | 来源徽标 | `.slash-picker-source-badge` + `.slash-picker-source-badge-{user,builtin,managed}`（**存量，零改动**类，仅按前置修复 ① 调底色基准） | 档位来自终态元数据 `tier`；查 `TIER_BADGE` 白名单取 `label` / `className` / `title`；表外 / 缺失 → **跳过** |
| 3 | 内联标注 | `.tool-card-manage-note`（新增） + `-error` / `-limit`（新增） | **至多一个**。失败 → 短原因 + `-error`；成功且 `promptIncluded === false` → `超预算` + `-limit`。无内容时**不渲染元素**（不占位） |

**新增标注类的完整 CSS 规格**（唯一新增的排版规则，零间距值）：

```css
/* AI 自建技能卡片（Phase 49）：头部内联标注（失败短原因 / 面板「未进提示词」标注的短形态投影）。
   纯文本、无底色无边框（与 .slash-picker-status 同族）；零 padding / 零 margin ——
   与相邻元素的间隙由宿主 .tool-card-name-skill 的存量 gap: 8px 提供（不新增间距声明）。 */
.tool-card-manage-note {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
}
.tool-card-manage-note-error { color: var(--skill-error-text); }
.tool-card-manage-note-limit { color: var(--skill-limit-text); }
```

### 头部单行不变式（硬约束）

1. `.tool-card-header` **不得**声明 `flex-wrap` —— 头部恒为 36px 单行，**永不换行**。
2. 徽标与内联标注 `flex-shrink: 0` + `white-space: nowrap`：**永不截断、永不让位**。
3. `.tool-card-name-text` 是**唯一**压缩承担者（`min-width:0` + ellipsis）—— 空间不足时
   让位的是技能名，不是来源与原因。
4. 失败短原因**定长 ≤ 6 字**且**不含技能名**（见 `## Copywriting Contract` 的纪律）——
   这是本条不变式在最小面板宽下成立的前提。
5. **已知且接受的退化**：`--ai-panel-min-width: 280px`（减气泡内边距）下同时带徽标 + 标注时，
   技能名可能被压缩到仅剩省略号。**这是刻意取舍**：D-02 要求卡片成为用户可见的持久动作记录，
   「谁被怎么处理了、为什么被拒」的信息价值高于「完整名字」；备选方案（额外 system-note）
   已被 D-02 明确否决（信息重复 + 多技能时刷屏）。该退化登记为 `## UI Considerations` 的 backstop 行。

### 钩子类 `.tool-card-manage`

`card.classList.add('tool-card-manage')` —— **刻意的无 CSS 规则钩子**（供测试与后续阶段定位
`manage_skill` 变体，不承担任何样式职责）。48-UI-REVIEW 把「孤儿类」记为 INFO，故此处**显式声明**
其身份：**它不是可用样式钩子**，任何样式必须落在上表的具体元素类上。

### 参数区（`create` / `update`）

**不再 `JSON.stringify` 整个 params**（`content` 上限 64 KiB ⇒ 展开后是一整面 JSON 墙，
且正文在 JSON 里被二次转义、不可读）。改为**剔除 `content` 的可读摘要**，三行纯文本：

```
动作：创建
技能名：foo
描述：{description 原文}
```

- 载体仍是既有 `.tool-card-value`（`<pre>`，`pre-wrap` + `word-break`），**零新增 CSS**。
- **`content` 不出现在参数区** —— 它的唯一展示面是正文折叠块（字符数在 header、原文在展开态）。
- `delete` 只有 `动作` / `技能名` 两行，且**不渲染**正文折叠块。
- `description` **不截断**（它受写入门长度约束，且 `pre-wrap` 会折行）。

### 技能正文折叠块（`create` / `update`）

**复用 48 D-09 的同一 DOM 结构与同一族类名**（`.ai-skill-content-box` / `-header` / `-title` /
`-chevron` / `-body`），**不得新建第二份折叠实现**。卡片语境只允许**两处 scoped 覆盖**：

```css
/* 技能正文折叠块在卡片语境的覆盖（仅两处）：水平内边距与 .tool-card-params 对齐；
   去掉内层滚动 —— 由 .tool-card.expanded .tool-card-content 的 500px + overflow-y 承担
   「单一滚动容器」，避免嵌套滚动条。 */
.tool-card-content .ai-skill-content-box { margin: 4px 12px 8px; }
.tool-card-content .ai-skill-content-box-body { max-height: none; }
```

| 属性 | 值 | 来源 |
|------|-----|------|
| 外框 | `border: 1px solid var(--border-color)` / `border-radius: 8px` / `background: var(--bg-secondary)` / `overflow: hidden` | 存量类，**不改** |
| header | `display:flex; align-items:center; gap:6px; padding:6px 12px; cursor:pointer; font-size:12px; color:var(--text-secondary)` + hover 底 `var(--bg-hover)` | 存量类，**不改** |
| chevron | `margin-left:auto` + 折叠时 `rotate(-90deg)` + `transition: transform 150ms ease` | 存量类，**不改** |
| body | 默认 `display:none`；展开后 `padding:8px 12px 10px; font-size:12px; line-height:1.6; white-space:pre-wrap; word-break:break-word; border-top:1px solid var(--border-color)`；**卡片语境覆盖 `max-height: none`** | 存量类 + 1 处覆盖 |
| header 文案 | `技能正文（N 字符）`，N = `content.length`（String.length 口径） | 48 D-09 原文 |
| 默认态 | **折叠**（与 48 气泡实例一致） | 48 D-09 |
| 展开内容 | **`content` 原文**（不含 frontmatter、不含任何包裹标签） | 48 D-09 同款 |
| 注入 | `textContent` | 48 D-09 同款（防 XSS） |
| 展开状态 | **不持久化**：翻看历史 / 重渲染后回到折叠态 | 48 D-09 同款（零新状态） |

**键盘可达性（新增实例一并补齐）**：折叠块 header 必须带 `role="button"` + `tabindex="0"` +
随态更新的 `aria-expanded`，并响应 Enter / Space 切换。理由：48-UI-REVIEW 的 Pillar 6 finding
明确指出「折叠块展开仅鼠标可达」，并建议「若 Phase 49/50 会重做这一族折叠控件，建议一并补
`button` 语义 + `aria-expanded`」—— 本阶段正是该族控件的**新增使用面**。
该补齐作用于**唯一构建实现**（`renderSkillContentBox`）⇒ 气泡实例同时获得，属**纯增量**：
零视觉变化、零文案变化、零行为回归。

### 结果区（两链路必须同形）

- 标签沿用既有：`结果`（completed）/ `错误`（failed）。
- **`manage_skill` 变体渲染「结果文本」而非 `JSON.stringify(result)`**：对象形状时取
  `result.content[]` 中的 text 块文本，字符串形状时原样 —— 使**实时链路与重载链路渲染逐字一致**
  （重载链路的 `toolExecutions[].result` 本就是文本字符串），且让「下一条消息起可用」与完整失败
  原因**可读**。其余工具的既有渲染路径**零改动**。
- `details` **不进结果区**（对用户无意义；`code` / `tier` / `promptIncluded` 已由头部与标注承载）。

---

## 数据契约（主进程 → 渲染端）

卡片消费的唯一标记（与 48-03 的 `skillInvocation` 同款 `snake_case` 事件字段 → `camelCase`
渲染端字段的既有命名法）：

```js
toolExecution.manageSkill = {
  action: 'create' | 'update' | 'delete',   // 白名单外的值 → 整个标记作废
  name:   string,                           // trim 后非空字符串，否则标记作废
  tier?:  'user' | 'builtin' | 'managed',   // 终态才判定；不可判定时「省略键」→ 跳过徽标
  code?:  <九码之一>,                        // 终态失败才有；表外 → 跳过标注
  promptIncluded?: boolean                  // 终态成功才有（create / update）；delete 省略
}
```

### 两个事件时点的分工（时序契约）

| 事件 | 标记内容 | 判定来源 | 理由 |
|------|---------|---------|------|
| `tool_execution_start` | `{action, name}` | `params`（**零 IO**，与 `_resolveSkillMarker` 同款同步判定） | 标题必须**在运行中即可见**（与 48-03 的 `read` 卡片一致）；本处是唯一携带 `params` 的时点 |
| `tool_execution_end` | 并入 `tier` / `code` / `promptIncluded` | 工具执行的**执行元数据**（见下） | 徽标与标注的档位**只有磁盘判定之后才知道**：`create` 的目标在调用前并不存在，无法在 start 时判定 |

**硬约束 1（终态字段合并）**：渲染端 `tool_execution_update` 的「已存在条目」分支目前只并入
`status` / `result` / `error`（`src/renderer.js:9347-9352`）—— **必须**把标记的终态字段一并并入，
否则徽标与短原因**永不出现**（新条目分支的 `...spread` 只覆盖首个事件）。

**硬约束 2（失败态的传输通道）**：SDK 在工具 `throw` 时走 `createErrorToolResult()`
（`agent-loop.js:519-524`），产出的 `result.details` 恒为 **`{}`** ⇒ **失败态的 `code` / `tier`
不能经 `details` 传递**。业务校验失败**仍然 throw**（D-07 / D-08 的 memory 工具语义不变，
LLM 照常收到 `isError: true` toolResult），但主进程必须在**工具注册层**把业务错误对象上的
`code` / `tier` 转存为该次工具执行的元数据（推荐按 `toolCallId` 的短期 Map，读后即删），
使**成功与失败两条路径的标记来源与形状逐字一致**。具体机制交 plan 期，但「两条路径单一读法」
是契约要求（禁止「成功读 `details`、失败读别处」的两套读法）。

**硬约束 3（重载链路同形）**：重开对话后卡片形状必须与实时链路**逐字一致**（48-03 的
「实时 vs 重载键集合逐字相等」纪律）。要求：

- `src/renderer.js:9552` §`renderToolCard` 与工具事件生成侧共用**同一个** `manage_skill` 标记判定
  （`_resolveManageSkillMarker`），两条链路的产出对象**键集合逐字相等**；
- 重载路径（`getConversationMessages`，`ai-manager.js:2754-2789`）当前只重建 `read` 标记，
  必须**同址**重建 `manage_skill` 标记（参数已在 `t.params` 中持久化）；
- 终态元数据需随显示形状回传：`ai-conversations-manager.js` 的 `getMessages` 在 toolResult 回填处
  已是 `{toolCallId, toolName, isError, details}` 的解析方（`tool_results` 列**已持久化 details**），
  把该终态元数据带到 `toolExecutions` 元素上即可 —— 使重载卡片与实时卡片同形；
- 装饰失败一律**原样透传、不丢消息**（沿用既有 try/catch 容错与告警）。

**硬约束 4（判定只在主进程）**：渲染端**不得**按路径 / 名字自行判定来源档位、名称冲突或限额
（48-03 的「renderer 零路径字符串匹配」同款）；渲染端只做白名单查表（`TIER_BADGE` /
`MANAGE_SKILL_ACTION_LABEL` / `MANAGE_SKILL_SHORT_REASON`）与呈现。

**`promptIncluded` 的判定口径**（D-12 的可见性精神，CONTEXT 的 Claude's Discretion 已建议带该字段）：
由 manager 在工具返回时用与 prompt 段预算**同一份**边际成本函数判定（新条目按优先级追加在末位
⇒ 可用「当前已入选条目成本 + 新条目边际成本 ≤ `SKILLS_PROMPT_CHAR_BUDGET`」判定）。
**无法判定时省略该键**（宁可不显示，不得猜）。注意 D-13：该次判定**不触发重扫**，也不声称
「已进提示词」是最终态 —— 真正的回写发生在**本轮成功出口**。

---

## 交互契约

| 场景 | 契约 |
|------|------|
| 触发 | 模型调用 `manage_skill` → 卡片出现在所属 assistant 气泡的 `.tool-cards-container` 内（既有链路，零改动） |
| 运行中 | 标题与技能名立即可见（start 事件的 `action` + `name`）；**徽标与内联标注尚未出现**（终态才判定）；状态沿用既有 `正在执行...` + 旋转图标 |
| 终态（成功） | 标题 + 档位徽标（`托管`）+（`promptIncluded === false` 时）`超预算` 标注 + `完成`；展开区 = 参数摘要 +（create/update）正文折叠块 + 结果文本 |
| 终态（失败） | 标题 + 档位徽标（可判定时）+ **短原因**（`-error` 色）+ `失败`；展开区 = 参数摘要 + `错误` 全文。**不弹确认卡片、不插 system-note**（D-01 / D-02） |
| 展开 / 折叠（卡片） | 既有行为：点击 `.tool-card-header` 切换 `.tool-card.expanded`；**本阶段零改动**（不新增键盘语义 —— 全仓所有工具卡片同一范式） |
| 展开 / 折叠（正文块） | 点击折叠块 header 切换 `.collapsed`；**新增** `role="button"` + `tabindex="0"` + `aria-expanded` + Enter/Space。默认折叠、状态不持久化 |
| 重开对话 | 卡片按**同一判据**从持久化参数与终态元数据重建，形状与实时链路逐字一致；技能事后被删除 / 改名**不影响**历史卡片（它是历史记录） |
| `skills:changed` 联动 | **卡片不响应**。卡片是**不可变历史记录**（与 48-03 的 `read` 卡片同款）：其标题 / 徽标 / 标注 / 正文全部由该次工具调用的参数与终态决定，不由快照重算。渲染端既有的「广播到达即无条件重拉快照」（48-06 / 48-07）**保持不变**，但不得据此改写已渲染的历史卡片 |
| 多张卡片 | 一次回合内多次 `manage_skill` 各产一张卡，纵向排列（存量 `gap: 8px`），互不影响 —— D-02 拒绝额外 system-note 正是为此时不刷屏 |
| 与 `/` 面板 + 气泡 pill 的一致性 | 徽标**同源同视觉**：同一 `TIER_BADGE` 单源、同一 `.slash-picker-source-badge*` 类、同一 `--skill-source-*` 令牌（面板行 / `read` 卡片 / `manage_skill` 卡片三处**零分叉**）。新建的 managed 技能随后的面板行徽标必然与本卡片一致（同一判定、同一查表） |
| 结果自描述 | 卡片**不额外**插 system-note / toast / 通知（D-02）；`skills:changed` 广播对用户不可见 |

---

## 与 48 既有面的关系

| 面 | 关系 |
|----|------|
| 三档来源徽标（48 D-14 / DISC-04） | **消费同一份**：判定不在本阶段重新定义（Phase 47 D-11 的「扫随包目录名集合」），本阶段只查 `TIER_BADGE` 取 `label` / `className` / `title` |
| `read` 卡片技能化（48 D-15） | **同一函数内的两个分支**（`renderToolCard`）；复用同一容器类 `.tool-card-name-skill` 与同一 `TIER_BADGE` 查表。`read` 变体的标题文案、状态区、参数区、结果区**逐字节不变** |
| 技能正文折叠块（48 D-09） | **同一实现**（`renderSkillContentBox`）在第二种语境复用；只允许上文的**两处 scoped 覆盖** + a11y 属性增量 |
| 用户气泡 pill（48 D-06） | **无交集**：卡片不渲染 pill、不新增气泡字段。气泡侧的 `SKILL_TIER_TITLES`（48-01 的第二份 `title` 副本，WR-01 在册）**不得**被本阶段扩成第三处 |
| 面板行渲染（48-02） | **无交集**：本阶段不触碰 `renderSlashPickerList` / `skill-picker-model.js` 的既有导出语义（只**加**两张白名单表） |
| TD-48-01（`escapeHtml` 不转义引号） | 本阶段**不扩大**该缺口：卡片变体新增的插值面**全部是 DOM 属性赋值或 `textContent`**（`badgeEl.textContent` / `badgeEl.title = <白名单表值>` / `nameText.textContent`），**零 `innerHTML` 模板拼接**。`manage_skill` 卡片不新增任何「不可信字符串进属性」的路径；该挂账项仍在原处（面板行渲染），若执行期顺手修则一并核对 |
| TD-48-02（取消分支缺锚点自校验） / WR-02 / WR-06 | **不在本阶段契约面**，逐字保持挂账（见 STATE.md） |
| 48-UI-REVIEW 的 3 条 priority fix | 其中 **2 条**（徽标底色基准 / `--skill-limit-text` 浅色值）因本阶段复用面而成为**前置修复**（见 `## Color`）；第 3 条（面板行不可换行组）属面板面，本阶段**不涉及**也不得被视为已修 |

---

## UI Considerations

> 本节由**探针引擎**（`$HOME/.codebuddy/gsd-core/bin/lib/ui-consideration-probe.cjs`）产出后人工裁决：
> 引擎按散文关键词判元素种类，对有损处**人工补全种类**（`elements` 覆盖数组）后重跑，再逐条裁决。
> **重复运行即整节替换，不追加。**
>
> 空态与错误态的**文案**在 `## Copywriting Contract`，本节只记形状根因的状态覆盖，不重复抄写文案。

coverage: **applicable 23 / resolved 23 / unresolved 0** ——
byVerification `{ explicit: 13, backstop: 1 }`，dismissed 9（带理由，非省略）。

元素清单与种类（人工确认，绕过有损分类器）：

| ID | 元素 | `elements` 种类 | 补充说明 |
|----|------|----------------|---------|
| E1 | 卡片头部（`.tool-card-header`）：三态图标 + 标题 + 来源徽标 + 至多一个内联标注 + 状态文字 | `interactive-control` · `static-content` · `list-collection` | 第三项**人工补**：徽标与标注是「至多一个」的可变成员簇，属 0/1 计数问题，引擎只在 `list-collection` 上建模 `zero-one-many` |
| E2 | 参数摘要区（`.tool-card-value` 预格式块） | `static-content` | 只读展示，**不补 `form`** —— 参数来自 LLM 而非用户输入，无输入控件、无提交动作 |
| E3 | 技能正文折叠块（`.ai-skill-content-box`） | `interactive-control` · `static-content` | header 具 `role="button"` + `aria-expanded` |
| E4 | 结果 / 错误区（`.tool-card-result`） | `static-content` | 标签按状态在 `结果` / `错误` 间切换 |
| E5 | 一次回合的多张卡片容器（`.tool-cards-container`） | `list-collection` | — |

> 未采用 `media`：头部三态 SVG 是**状态字形**而非内容图片（缺它会改变 E1 的 `empty` 计数，故显式记录此判断）。

| requirement_id | category | Status | Resolution / Reason |
|----------------|----------|--------|---------------------|
| E1 | empty | ✅ dismissed | 卡片由工具调用产生 —— 本回合没有调用 `manage_skill` 就没有卡片，容器不渲染空壳；不存在「无数据」呈现面 |
| E1 | loading | ✅ resolved (explicit) | 运行中头部 = 标题（start 事件的 `action` + `name`，零 IO 即时可见）+ 既有旋转图标 + 既有 `正在执行...`；来源徽标与内联标注**按设计尚未出现**（终态才判定）。**无骨架屏、无新增 spinner** |
| E1 | error | ✅ resolved (explicit) | 失败态头部 = 既有红 ✗ 图标 + 既有 `失败` + **新增 11px 短原因**（`.tool-card-manage-note-error`，取九码白名单，定长 ≤ 6 字且不含技能名）；可判定时同时显示来源徽标。**不弹确认卡片、不插 system-note**（D-01 / D-02） |
| E1 | populated | ✅ resolved (explicit) | 终态头部恒为 36px 单行：图标 + 标题（三动作白名单文案）+ 来源徽标（三档 `TIER_BADGE`）+ 至多一个内联标注 + 状态文字（`完成` / `失败`） |
| E1 | partial | ✅ dismissed | 无渐进就绪态 —— 整张卡片由一次工具执行的两个事件（`tool_execution_start` / `_end`）驱动，不存在字段部分到位仍可交互的中间态 |
| E1 | overflow | 🧪 resolved (backstop) | `{ statement: "在 AI 面板最小宽度（--ai-panel-min-width 280px，扣气泡内边距）下，带来源徽标 + 内联标注的 manage_skill 卡片头部保持单行不换行，徽标与短原因完整可读（仅技能名缩略，不出现标注被裁切或头部高度变化）", verification: "backstop" }` —— 需真实数据集的视觉确认（最宽为 6 字失败短原因；超预算形态 `超预算` 3 字 + 徽标 + 长技能名）；**无显式证据则路由 `human_needed`**。已按该处置收口：卡片头部的超预算标注改为 `/` 面板那条 `STATUS_TEXT.promptOmitted` 的 **≤ 4 字第二段投影**（`PROMPT_OMITTED_CARD_NOTE`），**不得**改成换行头部或加 system-note（收口记录见文件末尾） |
| E1 | zero-one-many | ✅ resolved (explicit) | 内联标注**至多一个** —— 失败短原因与成功那条 `超预算`（`/` 面板标注的短形态投影）互斥（失败态不判提示词归属）；0 个时**不渲染元素**（不占位、不留空元素） |
| E1 | long-text | ✅ resolved (explicit) | 超长技能名由 `.tool-card-name-text` 承担**全部**压缩（`min-width: 0` + ellipsis）；徽标与内联标注 `flex-shrink: 0` + `white-space: nowrap` ⇒ **永不截断、永不换行**（`.tool-card-header` 不得声明 `flex-wrap`） |
| E2 | overflow | ✅ resolved (explicit) | 复用存量 `.tool-card-value`（`pre-wrap` + `word-break: break-word` + `overflow-x: auto`）⇒ 长描述折行，不横向溢出、不撑破卡片宽度 |
| E2 | long-text | ✅ resolved (explicit) | `description` 不截断（受写入门长度约束），`pre-wrap` 强制折行；参数摘要行数固定为 2–3 行 |
| E3 | loading | ✅ dismissed | 折叠块不加载 —— `content` 来自本次工具调用的参数，展开即时可用，**无任何异步取数与中间态** |
| E3 | error | ✅ resolved (explicit) | 失败态下 `create` / `update` **不产生**正文折叠块（写入未落盘，无正文可示）；展开区只有既有 `错误` 区全文 |
| E3 | overflow | ✅ resolved (explicit) | 正文上限 64 KiB：默认折叠；展开后由 `.tool-card.expanded .tool-card-content` 的 `max-height: 500px; overflow-y: auto` 作**唯一滚动容器**（卡片语境覆盖内层 `max-height: none`，不产生嵌套滚动条） |
| E3 | long-text | ✅ resolved (explicit) | 正文 `white-space: pre-wrap` + `word-break: break-word`，长行强制折行、无横向滚动（照抄 48 D-09） |
| E4 | overflow | ✅ resolved (explicit) | 结果 / 错误全文经 `textContent` 注入存量 `.tool-card-value`（`pre-wrap` + `break-word` + `overflow-x: auto`）⇒ 折行不溢出 |
| E4 | long-text | ✅ resolved (explicit) | 失败文案长度由九条白名单固定（完整文案单点产出于主进程）；成功文案三条定长 |
| E5 | empty | ✅ dismissed | 容器内 0 张卡片时**不渲染任何东西** —— 没有 `manage_skill` 调用就没有卡片，无空态文案、无占位 |
| E5 | loading | ✅ dismissed | 容器自身不加载数据 —— 卡片由流式事件逐个插入 `.tool-cards-container`，容器无 loading 态（运行中态由单卡 E1 承载） |
| E5 | error | ✅ dismissed | 容器无独立失败态 —— 单次调用失败由**该卡片自身**的 error 态（E1）承载，容器继续正常排列其余卡片 |
| E5 | populated | ✅ dismissed | 容器不定义自身视觉 —— 1 张卡片的 happy path 即存量 `.tool-card` 正常渲染，由 E1–E4 逐区覆盖，容器只提供 `gap: 8px` 纵向排列 |
| E5 | partial | ✅ dismissed | 无部分就绪 —— 卡片在 `tool_execution_start` 时**原子插入**，不存在「容器已有但内容未齐」的中间态 |
| E5 | overflow | ✅ dismissed | 容器纵向排列且**不设 `overflow`** —— 卡片数量增长由外层聊天消息滚动区承担（存量链路）；容器自身无滚动 / 裁切行为 |
| E5 | zero-one-many | ✅ resolved (explicit) | 0 / 1 / N 张卡片共用存量 `.tool-cards-container` 的 `gap: 8px` 纵向排列；一次回合多次 `manage_skill` 各产一张卡互不影响 —— D-02 拒绝额外 system-note 正是为多时刷屏 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| （无） | — | not applicable —— 项目未初始化 shadcn（无 `components.json`），不消费任何 registry，无第三方 block 需要 vetting |

---

## 决策来源表

| 契约条目 | 来源 |
|----------|------|
| 卡片标题「创建 / 更新 / 删除技能「name」」+ 三档来源徽标 + 不额外插 system-note | D-02 **原文** |
| 三动作一律自动、无确认卡片、`delete` 亦不弹确认 | D-01（已锁定，非遗漏） |
| 徽标三档**判定**（本契约只消费，不重新定义） | Phase 47 D-11（seeded 身份）+ 48 D-14（消费口径） |
| 复用 `read` 卡片技能化先例（同一函数、同一容器类、同一查表） | 48 D-15 / 48-03 |
| 复用技能正文折叠块（默认折叠、N = String.length、textContent、状态不持久化） | 48 D-09 |
| 用「技能名 / 描述 / 正文一律 textContent」把属性注入面钉死 | 48 D-15 / T-48-10 + TD-48-01 的教训 |
| 九条原因码 → 短原因 + 完整文案（单点产出于主进程） | D-07 的原因码表 + D-08 的「命中即 throw」语义 |
| 「超数量上限」短原因与面板 `STATUS_TEXT.overLimit` 同值 | 48-02 的既有权威表（复用，不新写） |
| `/` 面板行尾「未进提示词」标注复用 48 同款文案与 `--skill-limit-text`；卡片头部的超预算形态则取该单源的短投影 | 用户（本次 ui-phase 问答）+ 48 D-12 的可见性精神 |
| 引用同一 `STATUS_TEXT.promptOmitted` 字符串（不新写） | 48 契约的「唯一权威清单」纪律 |
| 成功文案含「下一条消息起可用」 | D-13 的忙时语义（对用户不可见，不说明会被读成「AI 建的技能没用」）+ CONTEXT 的 Claude's Discretion |
| `promptIncluded` 进终态元数据并可呈现 | CONTEXT 的 Claude's Discretion + 48 D-12 的可见性精神 |
| 短原因内联于卡片头部（而非自动展开 / 仅在展开区） | **用户（本次 ui-phase 问答）** |
| 徽标「始终显示目标来源」（含拒绝态显示真实来源） | **用户（本次 ui-phase 问答）** |
| 参数区改为剔除 `content` 的摘要 + 独立的正文折叠块 | **用户（本次 ui-phase 问答）** |
| 启动即给标题、终态才给徽标与标注的两段式标记 | 本契约（由「create 的目标在调用前不存在」+「48-03 的 start 一次判定」推导） |
| 失败态元数据须经注册层转存（SDK throw 路径 `details` 恒空 `{}`） | 本契约（读 `agent-loop.js:519-524` 实测结论；保持 D-07/D-08 的 throw 语义不变） |
| 结果区渲染文本而非 `JSON.stringify(result)`（两链路同形） | 本契约（48-03 的「实时 vs 重载形状逐字相等」纪律 + 可读性） |
| 卡片不响应 `skills:changed`（不可变历史记录） | 本契约（48-03 的 `read` 卡片同款口径） |
| `--skill-error-text` 新令牌 + 四档对比度核算 | 本契约（`--danger-color` 作 11px 文字色不达标；处置方式照 48 对 `--skill-limit-text` 的先例） |
| 徽标底色基准 `transparent` → `var(--bg-secondary)`；浅色 `--skill-limit-text` → `#92400E` | **48-UI-REVIEW priority fix #2**（本阶段复用面成立的前置条件，非新工作） |
| 折叠块新增 `role="button"` / `tabindex` / `aria-expanded` | **48-UI-REVIEW Pillar 6 的明确建议**（本阶段是该族控件的新增使用面） |
| 头部单行不变式 + 唯一压缩承担者 + 已知退化 | 本契约（沿用 48 面板行的「标注永不截断」精神，并规避 48-UI-REVIEW Pillar 2 的「徽标被挤出首行」反例） |
| 新增间距零偏离（B 表为空） | 本契约（全部间隙由既有 `gap: 8px` / 既有 `padding` 提供） |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved（2026-09-13）

**非阻断建议（checker 提出，交 plan 期顺手收口）**：

1. **Dimension 7 的 FLAG 无需改动** —— `Could not enumerate` 是设计系统无可枚举导出面时的合法终止态。
   若欲消灭该 FLAG，可在 `## Component Inventory` 的 provenance 槽补记辅助命令的匹配条数与日期。
   **在补记之前，该表一律按非穷尽处理**：执行时使用表外既有原语不受阻。
2. **`invalid_description` 是九条错误行中唯一不给具体上限的一条**，且空正文的原因码归属未指定
   （`UI Considerations` 的 dismissed 口径把「空 `content`」归给 `invalid_description` / `oversize`，
   但这两条文案的语义分别是「描述不合法」与「正文超限」）。plan 期应显式指定空正文的原因码与文案，
   否则头部会给出指向错误字段的短原因（非阻断：展开区始终显示主进程原文）。
3. **`renderSkillContentBox` 新增 `tabindex="0"` 会引入新的焦点停靠点与 UA 默认焦点环**
   （项目无全局 `outline: none`，故不会出现不可见焦点）。契约中「零视觉变化」的措辞应理解为
   「无布局 / 配色 / 文案变化」；若沿用既有视觉语言，可顺手补一条 `:focus-visible`。

---

## Backstop 收口记录（E1 overflow）

> 本节是 `## UI Considerations` 的 `E1 / overflow` 那条 backstop 的**收口记录**（Phase 49 · 计划 07，gap `G-49-3`）。
> 它是**追加**节 —— 正文的改动只落在七处陈述卡片渲染文案的位置与四行表面标注上，两者由可重跑的
> 「七锚点 + 表面规则」判据机械覆盖，不靠人工核对。

**① 失败事实（自动化实测，非人工报告）。** 2026-09-13 的真实渲染驱动（playwright `_electron`
+ 真实拖拽到 `--ai-panel-min-width` = 280px）实测：面板 280px → 卡片实宽 210px →
`.tool-card-name`（`.tool-card-name-skill`）`clientWidth` **129**px < 其不可压缩内容 **148**px
（= 8 + 32 + 8 + 100：两处宿主 `gap: 8px` + 来源徽标 32px + 当时沿用的两段式标注 100px）。
后果有两条：**标注右端 19px 被祖先 `.tool-card-name` 继承的 `overflow: hidden` 裁掉**；
而唯一可压缩项 `.tool-card-name-text`（`min-width: 0`）被压到 `clientWidth = 0` ——
技能名**整段消失**、连省略号都没有空间渲染。

**② 收口的是什么。** E1 给出的处置（**缩短短原因文案至 ≤ 4 字**）照做，落点是**卡片头部那条
超预算标注**：它改为取 `/` 面板行尾 `STATUS_TEXT.promptOmitted` 的**第二段机械投影**
（新常量 `PROMPT_OMITTED_CARD_NOTE`，3 字），于是不可压缩簇回到 8 + 32 + 8 + 34 = 82 ≤ 129，
退化重新回到契约允许的唯一形态：「技能名被压缩到仅剩省略号」。收口由**真实渲染**门禁承担
（`tests/uat-49-g49-3-panel-layout.js` 的 A1–A9，见 ⑥），**不由声明扫描或子串扫描承担**。

**③ 收口的不是什么。** `/` 面板行尾那条长串**逐字未变**（`STATUS_TEXT.promptOmitted
=== "未进提示词 · 超预算"`）。四条依据：48-CONTEXT 的 **D-12 原文**、48-UI-SPEC 的
「超限两条刻意长度不对称、**照写不统一**」契约、`tests/test-skill-picker-model.js` 的用例名与
逐字断言、以及产品文档 §10.1 的四条定长文案之一。**缩短对面板零收益**：面板行 `flex-wrap: wrap`
且宽 ≥ 280px，该串在面板里从不被裁切；缩短只会丢掉「未进提示词」这半边语义（效果），
只剩「超预算」（原因）。因此本契约把一个串拆成**两个表面**：面板用完整两段式、卡片用其第二段投影
（同一单源，不是第二份文案）。

**④ 排除的两条路线。** **不**改成换行头部 —— `.tool-card-header` 恒 36px 单行是硬不变式
（`flex-wrap` 明文禁止，见 `## 卡片结构契约` 的头部单行不变式）；**不**加 system-note ——
D-02 已明确否决（信息重复 + 多技能时刷屏）。故 E1 原文的两条禁令**一字未破**。

**⑤ 契约级纪律（本节新增，防日后回归）。** 「凡提到『未进提示词』的位置，必须显式标明它属于
`/` 面板行尾标注，或作为卡片短形态的投影来源」—— 该纪律的作用是让后续改动**无法再把长串
悄悄读作卡片渲染文案**：本文件正文里所有提到该串的行都已按此标注（Color 的 Warning 行、
对比度核算表、CSS 规格代码块的注释、决策来源表末行），`/` 面板与卡片两个表面因此各自可机械区分。

**⑥ 真实渲染证据的位置。**
- 驱动脚本：`tests/uat-49-g49-3-panel-layout.js`（脚本名以 `uat-` 开头，故永不被 `test-*.js` 类套件拾取）
- 红轮日志（**改源码之前**，A1/A2/A3/A6 为红、A4/A5/A7/A8/A9 为绿）：`/tmp/uat49/g49-3-red.log`
- 绿轮日志（A1–A9 全绿、退出码 0）：`/tmp/uat49/g49-3-green.log`
- 证据 JSON（四档完整几何量 + 全轮 `cssDeclProjection` sha + `preflight`）：`/tmp/uat49/evidence-g49-3.json`
- 截图：`/tmp/uat49/g49-3-card-280.png`、`g49-3-card-520.png`、`g49-3-window-280.png`、
  `g49-3-zoom-280-header.png`（4× 放大，供人工目视复核标注尾部字符完整）
- 「CSS 声明零改动」由两条判据共同承担：A9（全轮声明投影 sha 相等 ⇒ 只动了注释）与纯 Node 的
  `css-decl-freeze`（四个规则块的声明集逐字比对）。单点变异 实测：给标注加 `max-width: 60px`
  会让两者**同时转红**，而 M14 / M15 / A1–A7 对它全部保持绿（盒子窄于文本时字形画到盒外，
  矩形判据看不见）—— 这正是本阶段「声明扫描会假绿」教训的兑现面。
