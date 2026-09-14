---
phase: "50"
slug: "api-skills"
status: draft
shadcn_initialized: false
preset: none
created: "2026-09-14"
---

# Phase 50 — UI Design Contract

> 「设置页（`realm://settings`）AI 分区的『技能管理』区」的视觉与交互契约。
> 由 gsd-ui-researcher 生成，gsd-ui-checker 校验。
>
> **本阶段 UI 面只有一处**：设置页 AI 分区新增的**「技能管理」区**（三档来源分组行式列表 +
> 诊断两层承载 + 启停 + 卸载确认）。**不新增页面、不新增图标、不新增字体、不新增折叠控件家族、
> 不新增 toast 基建、不新增前端依赖**。
>
> **三条对本阶段直接生效的项目约定（AGENTS.md）**：
> 1. **内部页面 CSP**：`realm://settings` 的 CSP 是 `style-src 'self'`（无 `unsafe-inline`）⇒
>    **markup 内联 `style="…"` 不生效**。所有初始隐藏必须走 **CSS 类**；显隐切换用 JS CSSOM
>    （`el.style.display = 'flex' / 'none'`，具体值，不依赖 `''` 回落）。
> 2. **弹框居中约定的末条明文豁免**：`realm://` 内部页面**不适用**「原生 `<dialog>` + `margin: auto`」
>    那条主约定，继续用 **div 遮罩 + CSSOM `display` 切换**。本阶段的卸载确认弹框走这条路。
> 3. **数据访问分层**：设置页是 `<webview>` guest、**没有 `realmAPI`** ⇒ 一律走
>    `/api/skills/*` + URL token；主窗口 `file://` **不能** fetch 本地 HTTP（Phase 38 事故）⇒ 走 IPC。
>    两条**不可互换**（D-17）。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none（无 `components.json` / 无 `tailwind.config.*` / `package.json` 依赖中无 UI 框架） |
| Icon library | none（**本阶段不新增任何图标**；唯一新增字形是诊断徽标与汇总条头部的折叠指示 `▾` —— 与既有 `.ai-skill-content-box-chevron` **同一字符**，不是新图标） |
| Font | 系统字体栈 `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`（`src/styles/main.css:128`，`body` 规则）；**技能名与诊断码**用 `var(--font-mono, monospace)`（既有用法；该变量全仓**未定义**，实际走平台默认等宽族 —— 与 48/49 一致，本阶段不新建字体变量） |

**样式令牌的实际来源**：全部为 `src/styles/main.css` 顶部两个主题块的**手写 CSS 自定义属性**，
不是任何设计系统产物：

- `:root, [data-theme="dark"]`（`main.css:7-30`）—— 深色主题（默认）
- `[data-theme="light"]`（`main.css:32-56`）—— 浅色主题

**两套主题必须同时定义本阶段新增的令牌**（缺一即在对应主题下失效）。本阶段新增令牌**恰一个**：
`--skill-success-text`（见 `## Color`）。

**shadcn 门禁**：项目非 React / Next.js / Vite，纯手写 HTML + 原生 JS，**门禁不适用**，不做初始化、
不询问 preset。
**Registry 安全门禁**：无第三方 registry，见 `## Registry Safety`。

---

## Component Inventory

Could not enumerate: 项目无组件库、无设计系统包 —— 无 `components.json`、无 `tailwind.config.*`、
`package.json` 依赖中无 UI 框架；全部 UI 为手写 HTML 元素 + 单文件 `src/styles/main.css`（约 10k 行），
不存在可枚举的组件导出面（无包、无 `exports` 映射、无版本号可读）。

本阶段的「组件清单」因此是**既有可复用原语的清点**，由以下可重跑命令生成（非组件库枚举）：

```bash
grep -cE '^\.(settings-group|settings-group-title|setting-description|settings-item|whitelist-tag|whitelist-hint|ai-form-hint|ai-switch|ai-modal|ai-modal-overlay|ai-skill-content-box|slash-picker-source-badge|slash-picker-tag-explicit|btn)' src/styles/main.css
# → 61（14 个族，2026-09-14 实测）
```

**非穷尽清单 —— 不是封闭白名单。** 执行时如需表外既有原语，直接查 `main.css` 是**预期路径**，
不是例外。本表的作用是标出本阶段**已经核对过**的复用点，不是允许使用的上限。

| 既有原语（类 / 表） | 位置 | 本阶段如何复用 |
|----------------------|------|----------------|
| `.settings-group` | `main.css:3195` | 区外壳：`background: var(--bg-secondary)` / `border-radius: 8px` / `padding: 16px 20px` / `border: 1px solid var(--border-color)`。**零改动**。⚠️ 它是本区所有文字色的**唯一底色基准**（= `--bg-secondary`） |
| `.settings-group-title` | `main.css:3203` | 区标题「技能管理」：14px / 600 / `--text-primary` / `margin-bottom: 16px`。**零改动**（以「继承登记」形式计入 Typography） |
| `.setting-description` | `main.css:2098` | 区级说明三段：12px / 400 / `--text-secondary`。**零改动** |
| `.settings-item` | `main.css:3210` | 行骨架范式参照（`display:flex` / `justify-content:space-between` / `align-items:center` / `padding: 8px 0`；`main.css:2103` 的**同名重复规则**无 padding）。**本阶段不直接挂该类**（行结构比它多一层），只照抄其 `padding: 8px 0` |
| `.ai-switch` + `.on` + `::after` | `main.css:5098-5130` | 启停开关：36×20px / `border-radius: 10px` / 20px 圆形拇指 / `.on` 态 `background: var(--accent-color)`。**零改动**（仅新增一条**作用域收敛**的 `:focus-visible`，见 `## Color`） |
| `.ai-modal-overlay` | `main.css:5350` | 卸载确认弹框的外层遮罩：`display: none` 初始（**CSP 安全的初始隐藏范式**）/ `position: fixed` / `inset: 0` / `align-items:center` / `justify-content:center` / `z-index: 1000`。**零改动**（JS 置 `display:'flex'` 即居中） |
| `.ai-modal` / `.ai-modal-header` / `.ai-modal-header h3` | `main.css:5376-5401` | 弹框内层：`background: var(--bg-secondary)` / `border-radius: 10px` / `padding: 16px` / `gap: 10px`；标题 16px / 600。**零改动** |
| `.ai-skill-content-box` 家族（`-header` / `-title` / `-chevron` / `-body`） | `main.css:5827-5891` | **48 D-09 已建**的折叠块。本阶段在**第三种语境**复用：诊断详情区（只用 box + body）与模块级问题汇总条（全家族）。**只允许一条 scoped 覆盖**（header hover 文字色，见 `## Color` 的前置修复）。**不得新建第二份折叠实现** |
| `.slash-picker-source-badge` + 三个 `-user` / `-builtin` / `-managed` | `main.css:7236-7268` | 三档来源徽标（面板行 / `read` 卡片 / `manage_skill` 卡片 / **本页**四处共用同一类）。**零改动** —— 底色已钉死为 `color-mix(… , var(--bg-secondary))`，而本页宿主底色**正是同一个令牌** ⇒ 48/49 实测的四档比值**逐值照搬、无需重算** |
| `.slash-picker-tag-explicit` | `main.css:7270` | 「仅显式」标记：11px / `padding: 1px 4px` / `border-radius: 3px` / 中性 `rgba(127,127,127,0.16)`。**零改动** |
| `TIER_BADGE` | `src/skill-picker-model.js:324` | 三档徽标的 `label` / `className` / `title` **唯一权威查表**。本阶段**只查表、不扩表、不复制文案** |
| `STATUS_TEXT` | `src/skill-picker-model.js:239` | 行尾状态标注的**唯一权威**（本阶段**加第 5 条** `disabled: '已禁用'`，见 `## Copywriting Contract`） |
| `.whitelist-hint` | `main.css:8721` | **反面参照，不复用**：`color: var(--text-muted)` / `text-align:center` / `padding:12px` —— `--text-muted` 在 `--bg-secondary` 上实测 2.97:1（暗）/ 2.33:1（亮），**11–14px 小字不达标**（48-UI-REVIEW 已按「灰显非活动控件」豁免面板行，本页的行是**活动行**、不适用该豁免）。本阶段另立 `.skill-manage-state` |
| `.ai-memory-hint-success` / `-danger` | `main.css:10455` / `:10459` | **反面参照，不复用**：`--success-color`（浅色底 2.33:1）与 `--danger-color`（四档 3.82 / 2.76 / 3.45 / 2.85）**作小字文字色全部不达标**。本阶段另立 `.skill-manage-hint-*`（见 `## Color`） |
| `.btn` / `.btn-secondary` / `.btn-sm` | `main.css:907` / `:923` / `:930` | 弹框按钮与「重新加载」按钮：底色 `--bg-tertiary`、文字 `--text-primary`（四档 9.99 / 9.10 / 13.81 / 13.18 ✅）。**零改动** |
| `.btn-danger` | `main.css:1442` | **本阶段不使用**：白字对 `--danger-color` 实测 **3.76:1** < 4.5（12px 小字）⇒ 危险语义改由**文字色** `--skill-error-text` + 中性底表达（见 `## Color`） |
| `skills:changed` 广播 | `src/renderer.js:4405`（消费端） | **设置页收不到**（`windowManager.broadcast` 只发 BrowserWindow 的 webContents，`window-manager.js:310`）⇒ 设置页每次操作后自行重拉（D-18）。本页**不注册任何 IPC / broadcast 监听** |
| `setAiMemoryHint` 的「2 秒无条件复位」守卫 | `src/settings-page.js:3878-3897` | **照抄形状**（D-06）：本阶段另立 `setSkillManageHint` / `resetSkillManageHint`，并**增加 `clearTimeout` 纪律**（连续操作不被陈旧复位清掉，见 `## 交互契约`） |

---

## Spacing Scale

声明值（**新增元素**的 `gap` / `padding` / `margin` 只允许取 4 的倍数；唯一例外通道是下方
Exceptions 的 **B 表** —— 偏离值必须逐条登记并附理由与既有先例）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 行内第二行与第一行的行距（`.skill-manage-row-sub { margin-top: 4px }`）；诊断条目之间的间隙；徽标类既有的 `padding: 1px 4px`（A 表登记） |
| sm | 8px | 行内元素间隙（`gap: 8px`，全页统一）；行上下 `padding: 8px 0`（照抄既有 `.settings-item`）；诊断条目内的 `gap: 8px` |
| md | 16px | 区分组之间的 `margin-top` + `padding-top`（各 16px）；汇总条与列表的段间距；空态容器 `padding: 16px 0` |
| lg | 24px | 本阶段**未使用**（保留） |
| xl | 32px | 本阶段**未使用**（保留） |
| 2xl | 48px | 本阶段**未使用**（保留） |
| 3xl | 64px | 本阶段**未使用**（保留） |

**12px 亦在标内**（4 的倍数）：既有 `.tool-card-header` / `.tool-card-params` 的 12px 属 49 面，
与本页无关。**本阶段的新增间距声明中不出现 12px**（全部为 4 / 8 / 16）。

### Exceptions

**A. 存量继承值** —— 既有类的值，被复用或逐值照抄；允许继续存在，**不得新增同类偏离**：

| 既有类 / 属性 | 值 | 位置 | 处理 |
|--------------|-----|------|------|
| `.settings-group` | `padding: 16px 20px` / `margin-bottom: 12px` / `border-radius: 8px` | `main.css:3195-3201` | **不改** —— 20px 为既有水平内边距；本区全部行宽以内层可用宽度为准 |
| `.settings-item` | `padding: 8px 0` | `main.css:3210-3214` | 照抄值（本页行的上下内边距） |
| `.settings-group-title` | `margin-bottom: 16px` | `main.css:3203-3208` | **不改** |
| `.setting-description` | 无内边距声明（间隙由父容器与相邻元素提供） | `main.css:2098-2101` | **不改** —— 本区说明段之间用 `margin-bottom: 8px` 显式给出（已在 4 网格内） |
| `.ai-switch` | `width: 36px` / `height: 20px` / `border-radius: 10px` / `::after` 16×16 | `main.css:5098-5130` | **不改** |
| `.ai-switch.on::after` | `background: #fff` | `main.css:5127-5130` | **不改**（硬编码白，既有值；本次不规范化） |
| `.slash-picker-source-badge`（三档共用） | `padding: 1px 4px` | `main.css:7236-7243` | **48/49 UI-SPEC 已登记的共用例外**（11px 文字上的发丝级垂直内边距；取 4px 会撑破 20px 高的 chip 宿主）。沿用，**不重复登记、不放大** |
| `.slash-picker-tag-explicit` | `padding: 1px 4px` | `main.css:7270-7281` | 同上（`仅显式` 与徽标同尺寸同 padding，避免同行参差） |
| `.ai-skill-content-box` | `margin: 4px 0 0` / `border-radius: 8px` | `main.css:5827-5835` | **不改**（诊断详情区与汇总条的外边距由本页的容器 `gap` 承担，见下） |
| `.ai-skill-content-box-header` | `gap: 6px` / `padding: 6px 12px` / `border-radius` 无 | `main.css:5837-5847` | **48/49 UI-SPEC 已登记的例外**（逐值照抄 `.ai-summary-box-header`）。本阶段照抄复用，**不重复登记** |
| `.ai-skill-content-box-body` | `padding: 8px 12px 10px` | `main.css:5876-5887` | 照抄值（48 的 A 表已登记） |
| `.btn` + `.btn-sm` | `12px` / `500` / `padding: 4px 10px` / `border-radius: 6px` | `main.css:907-921` + `:930-936` | **直接复用该既有组合**（本页三个按钮：`卸载` / `重新加载` / `取消`），与同页「AI Bash 命令白名单」的「添加」按钮**同款**。⚠️ **不得**把 `.btn-sm` 与 `.btn-danger` 叠加使用 —— `.btn-danger`（`main.css:1442`）在文件里**晚于** `.btn-sm`，同特异性下会覆盖掉 `font-size` / `padding`，得到 14px 的「小按钮」（既有脆弱面，本阶段**不使用 `.btn-danger`** 也一并回避了它） |

**B. 本阶段新增声明中非 4 倍数的值 —— 零条。**

本阶段全部新增 `gap` / `padding` / `margin` 均为 4 的倍数（4 / 8 / 16）。
执行时若确需新值，**必须先补进本表**（附理由 + 既有先例）再落码 —— 契约与 CSS 块必须始终自洽。

无 44px 触控目标例外：本页面是桌面端（鼠标 + 键盘）设置页，无独立触控入口。

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 12px | 400 | 1.5 |
| Label | 11px | 400 | 1.4 |
| Heading | 13px | 600 | 1.4 |
| Display | 14px | 600 | 1.2 |
| Inherited（既有类，**本阶段不改声明**） | — | — | — |

**本阶段声明**：**4 个字号（11 / 12 / 13 / 14）、2 个字重（400 / 600）**。逐个用途：

- **Body 12px / 400 / 1.5** —— 技能描述、诊断 `message`、诊断 `code`、行尾状态标注、
  区级说明（`.setting-description` 存量 12px）、空态正文、失败正文、inline hint
- **Label 11px / 400 / 1.4** —— **诊断徽标**（`诊断 N`）、**元信息行**（`12.3 KB · 4 个文件`）、
  诊断**级别标签**（`错误` / `警告` / `提示`）；与同处「元数据簇」的来源徽标（既有 11px）同档
- **Heading 13px / 600 / 1.4** —— **技能名**（等宽 + 600，与 48 面板行名 `.slash-picker-name:7175`
  同款同档）、**组标题**（`.skill-manage-group-title`）
- **Display 14px / 600 / 1.2** —— **区标题**「技能管理」（复用既有 `.settings-group-title`，
  **继承登记**：本阶段零改动；其 `line-height` 未声明，由 UA 默认承担，间距由该类既有
  `margin-bottom: 16px` 决定）

> **表末行是「继承登记」而非本阶段声明**。以下既有类的字号/字重**不属于本阶段声明**，
> 也不得因此新增任何新类去复制它们：
>
> | 既有类 | 存量值 | 说明 |
> |--------|--------|------|
> | `.settings-group-title` | 14px / 600 | 区标题（本页唯一 14px 用途） |
> | `.settings-item label` / `.setting-label` | 14px | 本阶段未使用 |
> | `.btn` | 14px / 500 | 按钮基类；本页三个按钮经 `.btn-sm` 收敛为 12px（见下一行） |
| `.btn` + `.btn-sm` | 12px / 500 | **本页三个按钮的实际取值**（`卸载` / `重新加载` / `取消`）—— 与同页既有「添加」按钮同款组合；500 不计入本阶段字重数、12px 与 Body 同号但字重不同（无新号、无新重） |
> | `.btn-sm` | 12px | **本阶段未使用该类**（两个按钮的尺寸写在本阶段新类上，见 A 表） |
> | `.ai-modal-header h3` | 16px / 600 | 弹框标题 |
> | `.slash-picker-source-badge` / `.slash-picker-tag-explicit` | 11px / 400 / 1.4 | 徽标与 `仅显式` |
> | `.ai-skill-content-box-header` | 12px / 400 | 折叠块 header 与汇总条标题 |
> | `.ai-skill-content-box-body` | 12px / **1.6** | 诊断详情正文的行高（照抄存量；比 Body 的 1.5 略松，属既有值，不统一） |

Exceptions：

- **本阶段不引入第 5 个字号**，也不引入第 3 个字重（500 / 700 一律不得出现在本阶段新增的类上）。
- **元信息取 11px 而非 12px**：它与来源徽标、诊断徽标同处一行的「元数据簇」，取同档可让
  「可扫读的次要信息」在视觉上归为一类；12px 会让元信息与技能描述（同为 12px）竞争注意力。
- 诊断详情正文的 `line-height: 1.6` 照抄 `.ai-skill-content-box-body` 存量值（不改成 1.5）。

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-primary` — 暗 `#1a1a1a` / 亮 `#ffffff` | 设置页页面底（`.settings-content`） |
| Secondary (30%) | `--bg-secondary` — 暗 `#2a2a2a` / 亮 `#f5f5f5`；次级 `--bg-tertiary` — 暗 `#3a3a3a` / 亮 `#e5e5e5` | **本区所有文字与 chip 的底色基准**：`.settings-group` 卡片底、`.ai-skill-content-box` 底、按钮底（`.btn-secondary`）；行 hover 底 `--bg-hover` — 暗 `#404040` / 亮 `#e0e0e0`（**本阶段未使用于行**，见下） |
| Accent (10%) | `--accent-color` `#3B82F6` | 见下方 **Accent reserved for** 显式清单 |
| Warning / 注意 | `--skill-limit-text` — 暗 `#F59E0B` / 亮 `#92400E` | 超限 / 超预算的行尾状态标注；诊断**警告**级标签 |
| Error（新文字面） | `--skill-error-text` — 暗 `#FCA5A5` / 亮 `#B91C1C`（**49 已建，本阶段首次用于设置页**） | 诊断**错误**级标签；卸载 / 启停的失败 hint；空态失败标题；危险按钮的**文字色** |
| Success（**本阶段新增令牌**） | `--skill-success-text` — 暗 `#6EE7B7` / 亮 `#065F46` | 启停成功的 inline hint |
| Destructive | `--danger-color` `#EF4444` | **本阶段不使用**（白字对其底 3.76:1、作文字色四档 3.82 / 2.76 / 3.45 / 2.85 全部不达标）。见下方说明 |

### Accent reserved for（显式清单，非「所有可交互元素」）

1. **启停开关 `on` 态**（`.ai-switch.on` 的 `background` / `border-color`，`main.css:5122-5125`）
   —— **既有类复用**，本阶段零新增色值。本区的开关是该项目类的第 2 个宿主。
2. **键盘焦点环**：`outline: 2px solid var(--accent-color)` —— 本阶段**新增一处作用域收敛的规则**
   （`.skill-manage-section .ai-switch:focus-visible`，`outline-offset: 2px`）。
   同一族还有**既有**规则 `.ai-skill-content-box-header:focus-visible`（`main.css:5862-5865`，
   `outline-offset: -2px`），它对**本页新实例同样生效**（同类名）。
   > **本条是对 `49-UI-SPEC` 的 Accent 清单失真的一处追认**：`49-UI-REVIEW` 的 `W3-01` 指出
   > 那份清单漏记了「折叠块 header 的键盘焦点环」这第 3 处使用。本契约把这一类**统一登记为
   > 「键盘焦点环」一条**，并明确它**不是**「accent 背景」、**不是**「展开 / 折叠态边框」，
   > 因而不构成对 49 既有禁令（「不得改为 accent 背景」「展开 / 折叠态不加 accent 边框」）的破坏。
3. `--bg-hover` 行高亮 / 按钮 hover **不使用** accent（显式排除）。
4. `.btn-primary`（`background: var(--accent-color)`）**本阶段不使用** —— 本区无主行动按钮，
   弹框的默认按钮（`取消`）用 `.btn-secondary`，破坏性按钮用中性底 + 危险文字色。

### 「危险」语义的表达方式（本阶段不使用 `.btn-danger`）

| 元素 | 底色 | 文字色 | 理由 |
|------|------|--------|------|
| 行内「卸载」按钮 | `.btn-secondary`（`--bg-tertiary`） | `--skill-error-text` | 白字对 `--danger-color` 实测 **3.76:1** < 4.5（12px 小字）；危险语义由**文字色**承担，四档全部达标（见下表） |
| 弹框「卸载」确认按钮 | 同款 | 同款 | 同上；与行内按钮**同一类**（`.skill-manage-danger-btn`），不做第二份危险样式 |

> **记录**：`.btn-danger`（白字 + `#EF4444`）的对比度不足是**既有按钮族的缺陷、非本阶段引入**；
> 本阶段**不使用它、也不修它**（不扩大、不声称已修），按 48/49 的既有处置口径挂账。

### 新增令牌：成功文案文字色

`--success-color`（`#10B981`）作小字文字色**不达标**：四档实测 5.66（暗·常态）/ **4.09**（暗·hover）/
**2.33**（亮·常态）/ **2.07**（亮·hover）—— 它未按主题分档，浅色下几乎不可读。
故按 49 对 `--skill-error-text` 的同款处置**定义专用成对令牌**：

| 令牌 | 暗色值 | 浅色值 | 用途 |
|------|--------|--------|------|
| `--skill-success-text` | `#6EE7B7` | `#065F46` | 启停成功的 inline hint（12px） |

写入 `:root, [data-theme="dark"]` 与 `[data-theme="light"]` **两处**（缺一即对应主题失效）。

> ⚠️ **同值不同量提醒**：`--skill-success-text` 与 `--skill-source-builtin`（内置徽标色）**今天的取值相同**，
> 但**语义不同**（一个承载「成功文字」，一个承载「内置徽标」）。**改动其中一个时不得顺手同步另一个** ——
> 与 `MAX_JSON_BODY_BYTES`(1 MiB) 对 P7「单 entry 1 MB」的同类提醒同款（D-16 已建立该纪律）。

### 对比度核算（WCAG 1.4.3；11px / 12px 属小字 ⇒ 硬要求 **≥ 4.5:1**）

**底色基准说明**：本区的行**不设 hover 底色**（与既有 `.settings-item` 一致 —— 它没有 `:hover` 规则），
因此文字的**唯一常态底**是 `--bg-secondary`。下表仍**同时列出 `--bg-hover` 一列**，用途有二：
① 对**确实会切到 hover 底**的元素（折叠块 header、危险按钮）作真实核算；
② 作为**对抗性上界核算** —— 日后若有人给行加 `--bg-hover` 底，本表直接指出哪些令牌会破线
（这正是 `48-UI-REVIEW` Pillar 3 的教训：契约漏算自身 hover 态 ⇒ 修复需求被漏掉）。

| 元素（本阶段新增或首次用于本页） | 令牌 | 暗 · `#2a2a2a` | 暗 · `#404040` | 亮 · `#f5f5f5` | 亮 · `#e0e0e0` | 判定 |
|----------------------------------|------|----------------|----------------|----------------|----------------|------|
| 技能名 | `--text-primary` | 12.60 | 9.10 | 15.96 | 13.18 | ✅ 全档 |
| 描述 / 元信息 / 诊断 message·code / 中性状态标注 | `--text-secondary` | **5.49** | **3.97 ❌** | **5.27** | **4.35 ❌** | ✅ 常态档全达标；**hover 档不达标 ⇒ 行不得加 `--bg-hover` 底**（见下「硬禁令」） |
| 状态标注（超限 / 超预算）、诊断**警告**标签 | `--skill-limit-text` | 6.68 | 4.83 | 6.50 | 5.37 | ✅ 全档 |
| 诊断**错误**标签、失败 hint、失败标题、危险按钮文字 | `--skill-error-text` | 7.56 | 5.46 | 5.93 | 4.90 | ✅ 全档 |
| 成功 hint | `--skill-success-text` | 9.42 | 6.80 | 7.05 | 5.82 | ✅ 全档 |
| 诊断徽标（常态 / hover / 展开态，**无底色**） | `--text-secondary` / `--text-primary` | 5.49 / 12.60 | 3.97 / 9.10 | 5.27 / 15.96 | 4.35 / 13.18 | ✅ 常态与 hover 态（hover 时切 `--text-primary`，见 `## 交互契约`） |
| 三档来源徽标（`用户` / `内置` / `托管`） | `--skill-source-*` | 5.72 / 6.58 / 5.59 | 同左（**底色已钉死**） | 4.89 / 4.70 / 5.30 | 同左 | ✅ —— 与 48/49 实测值**逐值相同**：`color-mix(…, var(--bg-secondary))` 的基准正是本页宿主底色，比值不随宿主漂移 |
| `.btn.btn-secondary.btn-sm`（弹框「取消」/「重新加载」/ 危险按钮的底） | `--text-primary` on `--bg-tertiary` | 9.99 | 9.10 | 13.81 | 13.18 | ✅ 全档 |
| **禁用记录**：`.btn-danger` | 白 on `--danger-color` | **3.76 ❌** | — | **3.76 ❌** | — | ❌ 不达标 ⇒ 本阶段不使用 |
| **禁用记录**：`--danger-color` 作文字 | `--danger-color` | 3.82 ❌ | 2.76 ❌ | 3.45 ❌ | 2.85 ❌ | ❌ 全档不达标 ⇒ 不得作文字色 |
| **禁用记录**：`--success-color` 作文字 | `--success-color` | 5.66 | 4.09 ❌ | 2.33 ❌ | 2.07 ❌ | ❌ ⇒ 用 `--skill-success-text` |
| **禁用记录**：`--text-muted` 作文字 | `--text-muted` | 2.97 ❌ | 2.05 ❌ | 2.33 ❌ | 2.07 ❌ | ❌ ⇒ 本页活动行**不得**用它（`.whitelist-hint` / `.slash-picker-desc` 的那套豁免不适用于本页） |

**硬禁令（由本表直接导出）**：`.skill-manage-row` **不得**声明 `:hover` / `.active` 的
`background: var(--bg-hover)` —— 那会让整行的描述、元信息、中性状态标注同时跌破 4.5:1
（暗 3.97 / 亮 4.35）。行的可交互反馈由**行内控件自身**的既有 hover（`.btn-secondary:hover`、
`.ai-switch` 的 `on` 态、诊断徽标的文字色变化）承担。若日后确要给行加 hover 底，
**必须同时**把上述四处文字换成 `--text-primary`，并重算本表。

### 前置修复 / 作用域覆盖（本阶段复用既有面产生的两条）

| # | 处置 | 位置 | 为什么本阶段必须落 |
|---|------|------|-------------------|
| ① | **scope 覆盖**：`.skill-manage-section .ai-skill-content-box-header:hover { color: var(--text-primary); }` | 新增规则（新增作用域前缀） | 折叠块 header 的**既有** hover 底是 `--bg-hover`（`main.css:5849-5851`），而其文字色是 `--text-secondary` ⇒ 实测**暗 3.97 / 亮 4.35 < 4.5**。诊断详情区的 header 在本页是**活控件**（可点可键盘），必须在其 hover 态达标。**作用域收敛的理由**：48/49 的两个宿主（气泡 / 工具卡片）行为**零变化** —— 本阶段不重设计既有面（49 收尾的爆炸半径纪律） |
| ② | **补记而非改动**：既有两个宿主的折叠块 header hover 文字色**仍是** `--text-secondary`、仍不达标 | `main.css:5849-5851` | 这是**既有缺陷、非本阶段引入**。本阶段**不修也不声称已修**（与 `TD-48-01` 同款处置：不扩大缺口 + 如实挂账）。修它会改动 48/49 两个实名宿主，属跨阶段视觉决策，须单独立项 |

---

## Copywriting Contract

### 全部新增 / 复用的用户可见文案（唯一权威清单）

| # | 位置 | 文案 | 来源 |
|---|------|------|------|
| 1 | 区标题 | `技能管理` | 本契约（USER-01 原文「技能管理」区） |
| 2 | 三个组名 | `我的技能` / `内置技能` / `AI 创建` | **D-01 原文**（对应 `user` / `builtin` / `managed`） |
| 3 | 区说明 ①（行为） | `禁用只过滤、不删除文件 —— 禁用后该技能不再进入提示词，也不再出现在 / 面板，重新启用即恢复；变更在下一条消息起生效，AI 正在回复时会延迟到本轮结束后应用。` | 本契约（D-05 / D-09 / D-18 的用户可见投影；`/` 以 `<code>` 呈现） |
| 4 | 区说明 ②（卸载限制） | `内置技能与 AI 创建的技能不可在此卸载（AI 创建的技能请让 AI 用 manage_skill 删除，内置技能只可禁用）` | **D-07 原文逐字**（`manage_skill` 以 `<code>` 呈现） |
| 5 | 区说明 ③（计量口径） | `体积与文件数为该技能目录的递归合计（含 SKILL.md，不含隐藏文件）。` | 本契约（D-13 口径的用户可见面；`SKILL.md` 以 `<code>` 呈现） |
| 6 | 来源徽标文字 / `title` | `用户` / `内置` / `托管` + 三条 `title` | **零新增** —— 查 `TIER_BADGE` |
| 7 | 「仅显式」文字 | `仅显式` | **零新增**（与面板同词；其 `title` 的单源化见下「硬前置条件」） |
| 8 | 行尾状态标注（首条） | `已禁用` / `已遮蔽 · 由用户同名技能胜出` / `超数量上限` / `未进提示词 · 超预算` | **查 `STATUS_TEXT`**（首条为**本阶段新增的第 5 条**：`disabled: '已禁用'`） |
| 9 | 诊断徽标 | `诊断 {N}`，`title="展开 / 折叠诊断详情"` | 本契约（D-11 的「诊断 N」徽标） |
| 10 | 元信息 | `{大小} · {N} 个文件`（如 `12.3 KB · 4 个文件`） | **D-02 原文格式**；大小格式化沿既有 `formatFileSize` 惯例（`toFixed(1)` + `B/KB/MB/GB`，`0 → 0 B`） |
| 11 | 元信息的失败形态 | `统计不可用` | 本契约（`bytes === 0 && fileCount === 0` ⇒ **不得**渲染 `0 B · 0 个文件`，那是失实文案；此时必有诊断徽标） |
| 12 | 启停开关的无障碍名 | `禁用技能「{name}」` / `启用技能「{name}」`（随当前状态切换语义） | 本契约（D-05 的启停控件） |
| 13 | 卸载按钮 | `卸载` | 本契约 |
| 14 | 启停成功 hint | `已禁用「{name}」` / `已启用「{name}」` | 本契约（D-06 的 inline hint） |
| 15 | 卸载成功 hint | `已卸载「{name}」` | 本契约 |
| 16 | 失败 hint（按 `code` 映射，见下表） | 见下表 | 本契约（D-06 + D-08） |
| 17 | 加载中 | `正在加载技能…` | 本契约（用户问答：单行纯文本，零 spinner、零骨架屏） |
| 18 | 空态 A（`refreshedAt === 0`） | 标题 `技能列表尚未加载`；正文 `技能集尚未完成首次加载，因此这里没有内容。点「重新加载」重试。`；按钮 `重新加载` | 本契约（**D-19 的硬要求**：不得渲染成「无技能」） |
| 19 | 空态 B（`refreshedAt > 0` 且 0 条） | 标题 `尚无任何技能`；正文 `agent-workspace/skills/ 下没有技能，也未检测到随包内置技能（内置技能在应用启动时自动播种）。把自己的技能放进该目录后点「重新加载」再试。`；按钮 `重新加载` | 本契约（区分「确实没有技能」） |
| 20 | 空态 C（拉取失败） | 标题 `技能列表加载失败`；正文 = **后端 `error` 字段原文**（取不到则 `请求失败（HTTP {status}）`）；按钮 `重新加载` | 本契约（沿用 `settingsApi` / `aiMemoryApi` 的「优先使用后端 error 详情、前端不另造文案」既有惯例） |
| 21 | 模块级汇总条标题 | `技能加载问题（{N}）` | 本契约（D-11 的「顶部汇总条」） |
| 22 | 诊断级别标签 | `错误` / `警告` / `提示` | 本契约（闭合白名单；表外 `level` ⇒ **不渲染标签**，不得回落到 `undefined` 字面量） |
| 23 | 卸载确认弹框 | 见下「卸载确认弹框」 | 本契约（D-05 的二次确认） |
| 24 | 同名重建可见提示 | `同名内置 / 托管技能将在删除后重新可见。` | 本契约（**D-07 明文**：`managed-skills/<name>` 的存在**只作提示、不作拒绝条件**） |

### 失败文案映射表（按服务端回传的 `code`，前端**不解析 `message`**）

> 契约面：`/api/skills/*` 的业务错误以 `{ error, code }` 返回（HTTP 状态统一 400，沿既有 `/api/*` 范式）。

| `code` | 触发场景 | 用户可见 hint 文案 |
|--------|---------|-------------------|
| `not_found` | 卸载 / 启停时 `skills/<name>` 已不存在（含「存在但读不到」） | `技能已不存在，列表已刷新`（并**必须**触发一次列表重拉） |
| `not_user_owned` | 卸载的对象只存在于 `managed-skills/` | `该技能不是你的技能，无法在此卸载（内置技能只可禁用，AI 创建的技能请让 AI 用 manage_skill 删除）` |
| `invalid_name` | 技能名不合法 | `技能名不合法，无法操作` |
| `BODY_TOO_LARGE` | 请求体超限（SEC-09 的**兜底**，技能域三个端点的载荷远小于 1 MiB，正常不可达） | `请求体超过上限，操作未执行` |
| 表外 / 缺失 / `unknown` | 沙箱失败等 | `操作失败：{后端 error 原文}`（取不到则 `操作失败，请重试`） |

**纪律**：

- **闭合白名单**：表外 `code` **不**回落到 `undefined` —— 统一走最后一行兜底文案。
- **不解析 `message`**：前端只按 `code` 查表（49 的 `manage_skill` 卡片同款纪律）。
- **启停开关恒可操作**：凡能列在「技能管理」列表里的技能，其开关**必须**可操作。因此
  `set-disabled` 的名称谓词必须与**列表的来源谓词**同宽（而非写入门 `^[a-z0-9-]+$` 的严格形态）
  —— 否则 `skills/My_Skill/` 这类技能会 render 出一个「点了必然 400」的开关（OQ-2 的
  「故意的不对称」必须落在**服务端谓词**上，而不是让用户先撞墙）。

### 卸载确认弹框（D-05 的二次确认；本契约定稿）

| 位置 | 文案 |
|------|------|
| 弹框标题 | `卸载技能「{name}」？` |
| 正文 | `将删除 skills/{name}/ 整个目录（含其中的脚本与引用文件），此操作无法恢复。` |
| 条件追加行（**仅当同名 managed / builtin 条目存在时**） | `同名内置 / 托管技能将在删除后重新可见。` |
| 按钮（左） | `取消` |
| 按钮（右，危险文字色） | `卸载` |

- **`{name}` 一律经 `textContent` / `el.setAttribute` 注入**（见下「注入纪律」）；
  正文里的目录路径 `skills/{name}/` 也是**文本节点**，不是 HTML 拼接。
- **条件追加行的判定是纯数据查找**（**不重判任何优先级 / 遮蔽**）：
  列表里存在某条 `tier !== 'user'` 且 `shadowed === true` 且 `shadowedBy === {该技能名}` 的条目。
  **查找不到即不渲染该行**（宁缺勿猜，与 49 的「表外跳过」同款）。
- **弹框形态**：`.ai-modal-overlay` + `.ai-modal`（**既有类**，零新遮罩实现）。初始隐藏走
  **CSS 类**（`.ai-modal-overlay { display: none }` 既有规则），打开时 JS 置
  `overlay.style.display = 'flex'`（CSSOM，不受 CSP `style-src 'self'` 限制），关闭置 `'none'`。
  **绝不写 markup 内联 `style="display:none"`**，**绝不**把 `.ai-modal-overlay` 用到 `dialog` 元素上
 （AGENTS.md「弹框居中约定」明文：全屏 div 遮罩类用到 `dialog` 上会把盒子钉在左上角）。

### Primary CTA

本区**没有**「保存」类主行动按钮（启停是即改即存、卸载是二次确认后立即执行 —— D-05 锁定）。
唯一的行动按钮是**空态 / 失败态的 `重新加载`**（`.btn-secondary`），即本阶段的 Primary CTA。

### 空态 / 错误态（模板要求的三行）

| Element | Copy |
|---------|------|
| Empty state heading | **三态**：`技能列表尚未加载`（从未加载）/ `尚无任何技能`（确实没有）/ `技能列表加载失败`（拉取失败） |
| Empty state body | 见上表 #18 / #19 / #20 —— 每态一句「现状 + 下一步」，并配 `重新加载` 按钮 |
| Error state | 拉取失败走空态 C（后端 `error` 原文）；**操作**失败（启停 / 卸载）走区级 inline hint（`--skill-error-text`），按 `code` 查表，2 秒后复位为 `''` |
| Destructive confirmation | `卸载技能「{name}」？` —— 完整文案见上表 |

### 文案纪律（硬要求）

- 全部**新增** UI 文案为**简体中文**；技术标识（技能 `name`、`/skill:name`、`manage_skill`、
  `set-disabled`、`uninstall`、`not_user_owned`、`realm_*` 诊断码、`agent-workspace/skills/`、
  `SKILL.md` 等）**保留原文**。
- **引用单源，不得在本页写第二份**：`STATUS_TEXT`（状态标注）、`TIER_BADGE`（徽标 label/title）、
  `仅显式` 的 label 与 title（见下硬前置条件）。诊断级别标签（错误/警告/提示）与失败 `code` 映射表
  是**本阶段新引入的单消费者文案** ⇒ 落 `src/settings-page.js` 的**闭合白名单表**即可；
  **一旦出现第二个消费者必须提升到 `src/skill-picker-model.js`**。
- **不在设置页写任何限额数值**（`64 KiB` / `50` / `8000` / `1 MiB` 等）—— 限额一律取管理投影
  回传的 `limits`（45/46 建立的「端点与前端零字面量」纪律）。

### 注入纪律（硬约束 —— 与 `TD-48-01` 的关系）

技能名 / 描述 / 诊断 `message` / 错误全文**一律经 DOM API 注入**：

- 文本 → `el.textContent = value`
- 属性 → `el.title = value` / `el.setAttribute('aria-label', value)` / `el.setAttribute('aria-controls', id)`
- **禁止**任何 `innerHTML` / `insertAdjacentHTML` / 字符串模板拼 HTML 的路径（含「拼完再整体赋给
  `innerHTML`」）。
- **为什么 DOM 属性赋值是安全的**：`el.title = value` 是 **DOM 属性赋值**，不走 HTML 解析，
  与 `escapeHtml` 的属性逃逸缺口（`TD-48-01`：`escapeHtml` 只转义 `& < >`、**不转义引号**）无关。
- **本阶段的诚实边界**：`TD-48-01` / `TD-48-02` **仍开、仍未被修**（用户已裁决延后）。
  本阶段的责任是**不扩大缺口**：本页新增的插值面**全部**是 DOM API 赋值，零 HTML 字符串模板。
  执行期若顺手修 `escapeHtml`，须一并核对 48 的面板面并单独记账，**不得**在本阶段声称已修。
- **唯一允许走 markup 直写的字符串**是**静态字面量**（区说明里的 `<code>manage_skill</code>`、
  `<code>/</code>`、`<code>SKILL.md</code>`）—— 它们不含任何来自技能数据的插值。

### 硬前置条件（单源化：`仅显式` 的 label 与 title）

`仅显式` 的**可见文字**与它的 `title`（`该技能不进模型提示词，只能手动调用（/skill:名字）`）
目前是 `src/renderer.js` 面板行里的**内联字面量**。设置页是本阶段新增的**第二个消费者** ——
再写一份字面量就是 48/49 反复付过代价的「第二份拷贝」（`49-UI-REVIEW` 的 `W1-04` 正是同一形态）。

**要求**：把这两个字符串提升为 `src/skill-picker-model.js` 的单源冻结表（与 `TIER_BADGE` 同族、
同导出面，建议形状 `{ label, title }`），面板侧改为引用同一常量；**渲染结果逐字不变**。
**代价（须一并做）**：`tests/test-skill-picker-model.js:1271` 目前断言该 `title` 字面量出现在含
`slash-picker-tag-explicit` 的源码片段里 —— 该断言改为「断言单源表的值 + 面板侧引用形态」
（该测试面本阶段本来就要改：补 `STATUS_TEXT.disabled`）。**具体命名交 plan 期**。

---

## 结构与交互契约

**落点**：`src/settings.html`（DOM）+ `src/settings-page.js`（渲染 / 交互）+ `src/styles/main.css`（样式）。
**插入位置**：`#settings-ai-assistant` 内、`ai-vision-section` 之后（AI 分区的最后一个子区）。
**新增 `<script>`**：`<script src="skill-picker-model.js"></script>`（必须在 `settings-page.js` **之前**，
与既有 `ai-brand-map.js` / `model-family.js` 同排在文件尾部的脚本区）。该文件零依赖、双模式导出、
纯函数 ⇒ `realm://` CSP 下安全（research A3；执行期须实测一次加载无副作用）。

### 区结构（骨架）

```
div.settings-group.skill-manage-section                    ← 区外壳（复用 .settings-group）
  ├─ h2.settings-group-title                               技能管理        （既有类）
  ├─ p.setting-description                                 区说明 ①②③      （既有类，三段）
  ├─ div#skillManageSummary.ai-skill-content-box.skill-manage-summary   模块级 errors[] 汇总条（条件渲染；默认**展开**）
  ├─ div#skillManageState.skill-manage-state               加载中 / 空态三态（互斥；见「状态机」）
  ├─ div#skillManageGroups.skill-manage-groups             三组容器（仅承载组间间距）
  │    └─ section.skill-manage-group[data-tier]            × 1..3（空组不渲染 —— 由主进程剔除）
  │         ├─ h3.skill-manage-group-title                 我的技能 / 内置技能 / AI 创建
  │         └─ ul.skill-manage-list
  │              └─ li.skill-manage-row[data-skill-name][data-skill-tier]   × N
  └─ p#skillManageHint.skill-manage-hint                   inline hint（D-06；默认空文本、不可见）
```

- **空组不渲染在渲染层是「零判定」**：管理投影返回的 `groups[]` **已剔除空组**（D-03 要求分组在
  主进程）；渲染层只做 `groups.forEach`，**不得**再写一套「组内是否为空」的判断。
- **区标题 / 组标题是两级**：区标题复用既有 `.settings-group-title`（14px/600/`--text-primary`），
  组标题是**新类** `.skill-manage-group-title`（13px/600/`--text-secondary`）——
  差一档字号 + 换色即形成层级，零新视觉语言。

### 行结构（`li.skill-manage-row`）

```
li.skill-manage-row
  ├─ div.skill-manage-row-main                    第一行（flex / nowrap / gap: 8px）
  │    ├─ span.skill-manage-name                 技能名（等宽 13px/600；单行截断；title=全文）
  │    ├─ span.slash-picker-source-badge.slash-picker-source-badge-{tier}   来源徽标（查 TIER_BADGE）
  │    ├─ span.slash-picker-tag-explicit          仅显式（条件：disableModelInvocation === true）
  │    └─ div.skill-manage-tail                   margin-left:auto（右对齐簇，flex-shrink:0）
  │         ├─ button.skill-manage-diag-badge     诊断 {N}（条件：diagnostics.length > 0）
  │         ├─ span.skill-manage-status[.skill-manage-status-limit]   行尾状态标注（条件：命中链首条）
  │         └─ div.skill-manage-actions
  │              ├─ button.ai-switch[.on][role=switch][aria-checked]   启停（即改即存）
  │              └─ button.skill-manage-danger-btn.btn.btn-secondary   卸载（**仅 tier === 'user' 渲染**）
  ├─ div.skill-manage-row-sub                     第二行（flex / nowrap / gap: 8px / margin-top: 4px）
  │    ├─ span.skill-manage-desc                  描述（单行截断 + title=全文 —— D-02 锁定）
  │    └─ span.skill-manage-meta                  12.3 KB · 4 个文件（永不截断）
  └─ div.ai-skill-content-box.collapsed.skill-manage-diag    诊断详情区（条件：diagnostics.length > 0）
       └─ div.ai-skill-content-box-body > ul.skill-manage-diag-list
            └─ li.skill-manage-diag-item.skill-manage-diag-item-{error|warning|info}
                 ├─ span.skill-manage-diag-level        错误 / 警告 / 提示
                 ├─ span.skill-manage-diag-message      可读 message（可换行，不截断）
                 └─ code.skill-manage-diag-code         realm_* 诊断码（次要、等宽）
```

**第一行元素顺序是契约**（不得调换）：`技能名 → 来源徽标 → 仅显式 → [右对齐簇: 诊断徽标 → 状态标注 → 操作区]`。
前三个与 48 面板行的 ①②③ 顺序一致（同一视觉语言的延续）。

### 长文本与溢出纪律

| 字段 | 规则 |
|------|------|
| 技能名 | **CSS 单行截断**（`overflow:hidden` + `text-overflow:ellipsis` + `white-space:nowrap`）+ `title` = 原文。理由：首行的右对齐簇是硬占用，名称退化到省略号时用户仍可悬停读全名（与 `48-UI-REVIEW` W2-01 的建议方向一致）。`title` 经 DOM 属性赋值注入 |
| 描述 | **CSS 单行截断 + `title` 放全文**（**D-02 锁定**，截断用 CSS 而非 JS —— 避免「截断逻辑」成为第二份实现） |
| 元信息 | `flex-shrink: 0` + `white-space: nowrap` —— **永不截断、永不让位** |
| 行尾状态标注 | 同上（定长文案；最长为 `STATUS_TEXT.shadowed` 的 14 字） |
| 诊断徽标 | 同上（`诊断 {N}` 定长） |
| 诊断 `message` | **不截断**：`white-space: pre-wrap` + `word-break: break-word`（照抄 `.ai-skill-content-box-body` 存量声明） |
| 诊断 `code` | 等宽 + `white-space: nowrap`（`realm_*` 定长形态，不会溢出） |
| 区说明 / 失败 hint / 弹框正文 | 允许换行（`word-break: break-word`），不截断 |

**唯一压缩承担者**：`.skill-manage-name`（`flex: 0 1 auto; min-width: 0`）。
**硬禁令**：`.skill-manage-row-main` **不得**声明 `flex-wrap`（否则重演 `48-UI-REVIEW` Pillar 2 的
「徽标被挤出首行、与名字读作两行」）。

**已知且接受的退化（窄窗口）**：行宽 = `窗口宽度 − 220px 侧边栏 − 64px 内容内边距 − 40px 卡片内边距`
（`.settings-section` 另受 `max-width: 680px` 封顶）。右对齐簇最长形态（`诊断 N` + `已遮蔽 · 由用户同名技能胜出`
+ 开关 + 卸载按钮 + 4×8px 间隙）约 **330px**。⇒ 1024px 窗口下行宽约 640px（名称可读约 25 个汉字）；
800px 窗口下行宽约 476px（名称被压到约 130px）。**名称退化到省略号是刻意取舍**，缓解手段是
`title` 全文。**不得**为了多显示几个字符把状态标注或徽标改成可截断。

### 诊断详情区（本阶段唯一需要定稿的交互形态）

**形态定稿：复用 48 / 49 的折叠块家族，但只取「shell + body」，不取 header。**

| 项 | 契约 |
|----|------|
| DOM | `div.ai-skill-content-box.collapsed.skill-manage-diag` + 直接子节点 `div.ai-skill-content-box-body`（**无 header、无 chevron 元素**） |
| 类名复用 | `.ai-skill-content-box`（外框：`border` / `border-radius` / `background: var(--bg-secondary)` / `overflow: hidden`）+ `.ai-skill-content-box-body`（正文排版）—— **零新增外观声明**，折叠/展开由**既有**规则 `.ai-skill-content-box:not(.collapsed) .ai-skill-content-box-body { display: block }` 提供 |
| **为什么不用 header** | header 的作用是承载「折叠开关」。本页的开关已在**第一行的诊断徽标**（它离用户更近、且必须在行内可见）。再渲染一个 header 会产出**一个区域两个控件、两份状态**（`aria-expanded` 需双向同步）—— 这是纯粹的漂移面，不是复用 |
| **开关元素** | `button.skill-manage-diag-badge`（`type="button"`），文案 `诊断 {N}`，内含 `<span class="skill-manage-diag-badge-chevron" aria-hidden="true">▾</span>` |
| a11y 属性 | `aria-expanded="false" | "true"`（**状态的唯一权威**）+ `aria-controls="{详情区 id}"`；chevron 用 `aria-hidden`；徽标无底色，靠 `title="展开 / 折叠诊断详情"` 说明用途 |
| 键盘 | `button` 元素原生支持 Enter / Space（**不需要**自定义 `keydown`）；焦点环走 UA 默认环（全仓无全局 `outline: none` 重置），见下「键盘可达性」 |
| 默认态 | **折叠**（`.collapsed` 存在）。理由：诊断是少数技能的异常信息，默认展开会让列表被灰块打断 |
| 展开态 | 移除 `.collapsed` + `aria-expanded="true"`；chevron 由 `[aria-expanded="false"] .skill-manage-diag-badge-chevron { transform: rotate(-90deg) }` 驱动（**以属性而非类为状态源**，杜绝类/属性漂移） |
| 展开 / 折叠的显隐机制 | `display: none → block`（**既有规则**）。⇒ 折叠态的详情区**不在 Tab 序内**，**不可能**产出「零可见高度的隐形焦点停靠点」（这正是 `49-UI-REVIEW` W6-01 的成因；本页用 `display` 而非 `max-height: 0` 承载折叠，故天然免疫） |
| **是否持久化** | **不持久化**：不写 `localStorage` / 不写 `settings`；每次重拉列表后全部回到折叠态。与 48 D-09 / 49 折叠块同款（零新状态） |
| 是否有「全部展开 / 全部折叠」 | **v1 不做**（避免新增控件与第二套状态） |
| 0 条诊断 | **整个详情区不渲染**，诊断徽标也不渲染（不占位、不留空元素） |
| 具体值**不得**上屏 | 展示 `level` + `message` + `code` **三项**；`path`（诊断条目可能带的路径）**不上屏**（它是沙箱内绝对路径，对用户无意义且冗余） |

### 模块级汇总条（`errors[]`，D-11 的顶部承载面）

- **形态**：**完整的折叠块家族**（有 header：`div.ai-skill-content-box-header` + `span.ai-skill-content-box-title`
  + `span.ai-skill-content-box-chevron`）—— 与「诊断详情区」不同，这里**没有**行内徽标可充当开关，
  故 header 就是开关。
- **标题文案**：`技能加载问题（{N}）`，N = `errors.length`。
- **默认态**：**展开**（不初始化 `.collapsed`）。理由：模块级错误（如技能目录缺失）是**异常状态**，
  项目的既有纪律是「禁止静默失败」；默认折叠会把它们藏起来。
- **a11y**：header 带 `role="button"` + `tabindex="0"` + `aria-expanded="true"`（随态更新），
  并响应 Enter / Space（`preventDefault` 防 Space 滚动）。这与 **48-UI-REVIEW Pillar 6 的明确建议**
  一致（「若 Phase 49/50 会重做这一族折叠控件，建议一并补 `button` 语义 + `aria-expanded`」），
  且该实例的 header **恒在正常流内可见** ⇒ 焦点语义成立（不是 49 卡片实例那种被裁切的情形）。
- **逐条渲染**：`li.skill-manage-diag-item` 三项（级别标签 + `message` + `code`），级别标签按级别上色
  （错误 → `--skill-error-text`；警告 → `--skill-limit-text`；提示 → `--text-secondary`）。
- **0 条时**：整个汇总条**不渲染**（不占位）。
- **与每技能诊断的关系**：两层各自独立，互不复用容器 —— `errors[]` 是**无归属技能**的模块级容器
  （46 D-07），塞进行内不可能（D-11 已锁定）。

### 状态机（`#skillManageState` 与列表的互斥关系）

| 状态 | 触发 | 区内容区呈现 | 汇总条 | 分组列表 | hint |
|------|------|--------------|--------|----------|------|
| **加载中** | 首次 / 手动重拉期间 | 单行 `正在加载技能…`（`.skill-manage-state` 内只有 `.skill-manage-state-body`，**无标题、无按钮、无 spinner、无骨架屏**） | 不渲染 | 不渲染 | 保持空 |
| **已就绪（有数据）** | `ok` 且总条数 > 0 | 不渲染 | 有 `errors[]` 时渲染 | 渲染 `groups[]` | 空 |
| **空态 A：尚未加载** | `ok` 且 `refreshedAt === 0` | `技能列表尚未加载` + 正文 + `重新加载` | 不渲染 | 不渲染 | 空 |
| **空态 B：确实没有** | `ok` 且 `refreshedAt > 0` 且总条数 === 0 | `尚无任何技能` + 正文 + `重新加载` | 有 `errors[]` 时渲染（**可以同时出现** —— 正是「为什么一条都没有」的解释面） | 不渲染 | 空 |
| **空态 C：拉取失败** | HTTP 非 2xx / 网络错误 / JSON 解析失败 | `技能列表加载失败` + 后端 `error` 原文 + `重新加载` | 不渲染 | 不渲染 | 空 |

**区分「尚未加载」与「确实没有」是 D-19 的硬要求**：`refreshedAt === 0` **不得**被渲染成
「无技能」（后者会让用户以为内置技能不存在，而它们其实早已在盘上）。

**无 provider 场景（D-19 / research 修正 2）**：本契约**不**为「未配置供应商」渲染任何常驻提示 ——
修好读路径的初始化（`ensureSkillsFresh` 一类，D-19 的交付项）之后，未配置 provider 时的呈现
**与已配置时相同**（两个内置技能正常列出）。**因此本契约的验收面是「无 provider 时列表不为空」，
而不是「多一条提示」** —— 在正常态下渲染 provider 警告会产生假警报。

**一个内置技能都没有的极端态**：这属于空态 B（总条数为 0）或「只有 user 组、无 builtin 组」。
无论哪种，**空组不渲染**（D-01 锁定）⇒ 缺失的「内置技能」组**不会**有占位或提示行；
其异常（播种失败）由**模块级汇总条**承载（`realm_builtin_src_invalid` / 播种诊断），
或由空态 B 的正文指出「未检测到随包内置技能」。**本契约不在空组外新增任何提示行**。

### 列表滚动归属

**`.settings-content`（既有页面级滚动容器）是唯一的滚动容器。**
本阶段**不新建任何内层滚动容器**：不给 `.skill-manage-list` / `.skill-manage-group` / 区加
`max-height` + `overflow`。理由：与 D-01「不折叠」的取舍一致（把上限 100 条直接铺在页面滚动里），
且嵌套滚动会让「跳到某条技能」在键盘与鼠标下都变得不可预期。

### 启停开关（即改即存，D-05）与失败回滚（D-06）

| 时点 | 契约 |
|------|------|
| 控件 | `button.ai-switch`（**既有类，零改动**）+ `role="switch"` + `aria-checked="true|false"` + 状态类 `.on` + 逐行 `aria-label`（`禁用技能「{name}」` / `启用技能「{name}」`）。开关语义：`aria-checked === true` ⇔ 技能**启用**（未在 `settings.aiSkills.disabled` 名单里） |
| 点击（乐观翻转） | **立即**翻转 `.on` 与 `aria-checked`（即改即存的观感），并置 `disabled`（在途态样式由 `.skill-manage-actions .ai-switch:disabled` 承担：`opacity: .6` / `cursor: progress`），**不发**请求前的任何二次确认（D-05 锁定） |
| 在途 | 开关 `disabled`（既有 `.btn:disabled` 的同类语义；`.ai-switch` 需本阶段补一条 `:disabled` 规则，见「新增 CSS 声明清单」）。**不做**全局遮罩、**不做**列表 loading 态 |
| 成功 | ① 用**响应体回传的最新管理投影**就地重渲染（`setSkillDisabled` / `uninstall` 的响应即 `getSkillsForManagement()` 的结果 —— **零二次请求**）；② hint(success)：`已禁用「{name}」` / `已启用「{name}」`；③ 2 秒后无条件复位（见下「hint 复位纪律」） |
| 失败 | ① **回滚**到点击前的 `.on` / `aria-checked`；② 解除 `disabled` / pending；③ hint(**danger**)：按 `code` 查表（见 Copywriting 的失败文案映射表） |
| 重渲染后的位置保持 | 重渲染会重建整棵行 DOM ⇒ **必须**：① 还原滚动位置（记录并回写 `.settings-content.scrollTop`）；② 焦点归还到**同一技能行**的开关（按 `data-skill-name` 查找新节点；找不到则不移动焦点）。**不得**让用户的滚动位置与键盘焦点在每次开关后被重置 —— 这是「一次操作只影响一行」的可见保证 |
| 禁用后的连带效果（供文案理解，非本页实现） | 被禁用的技能从 `/` 面板消失、不进 system prompt（48 D-10 / 46 D-09）；**文件仍在盘上** ⇒ 允许在**禁用状态下卸载**（D-09 锁定，开关不置灰） |

### 卸载（D-05 / D-07）

| 时点 | 契约 |
|------|------|
| 入口可见性 | **仅** `tier === 'user'` 的行渲染卸载按钮；`builtin` / `managed` 行**不渲染**（不给「点了才知道不行」的挫败）。说明文案由区说明 ② 承担（D-07 原文） |
| 服务端 | 独立于前端的读盘判据（`skills/<name>` 存在且是目录 ⇒ 允许；`managed-skills/<name>` 存在**只作提示**）—— 手改 URL 直调端点同样被（或不被）拒绝，**判据在 manager 层**（D-07 / ROADMAP 判据 3） |
| 点击 | 打开确认弹框（`.ai-modal-overlay` + `.ai-modal`），**不做**乐观删除 |
| 确认 | 按钮置 `disabled`（既有 `.btn:disabled` 样式），弹框**保持打开**直到响应到达 |
| 成功 | 关闭弹框 → 用响应体回传的最新投影重渲染（滚动位置与焦点归还同上；被删行的开关已不存在 ⇒ 焦点不移动）→ hint(success) `已卸载「{name}」` |
| 失败 | **关闭弹框** + hint(danger)（按 `code` 查表）。**不再**改变行内的任何状态（若 `code === not_found`，则**额外**触发一次列表重拉，让该行自然消失） |
| 焦点管理 | 打开时初始焦点落在 **`取消`** 按钮（默认焦点 = 安全选项）；`Esc` 关闭；关闭后焦点归还**触发行内的卸载按钮**（若该行已不存在则不移动）。**已知边界（如实登记）**：**不实现完整焦点陷阱**（Tab 循环）—— 与设置页既有的三个 `.ai-modal-overlay` 弹框同范式；引入焦点陷阱属于跨页面新机制，须单独立项。这是**有理由的边界，不是静默省略** |

### inline hint（D-06）

| 项 | 契约 |
|----|------|
| 位置 | 区内容**末尾**的单行 `p#skillManageHint.skill-manage-hint` |
| 形态 | 复用设置页既有 inline hint 的范式（`.ai-memory-hint` 同款：**颜色类 + 文案 + 自动复位**），**不新建 toast 基建**（见下「复用之外的边界」） |
| 色调类 | `.skill-manage-hint-success`（`--skill-success-text`）/ `.skill-manage-hint-danger`（`--skill-error-text`）/ 默认中性（`--text-secondary`，用于 `正在加载…` 一类） |
| 复位纪律 | 2 秒后**无条件**复位为 `''`；**每次设置 hint 前必须 `clearTimeout` 上一次的定时器** —— 连续操作（快速连点两个开关）时，陈旧复位**不得**清掉新的消息（这是 44/43 既有守卫的同类加固，须写成可失败的门） |
| 文本与色调必须一并设置 | 不允许「只改文字不改色」的路径（否则会出现绿色文案说失败） |
| 空文本时 | `p` 元素保留在 DOM 中但用 **CSSOM** 置 `hintEl.style.display = 'none'`（有文本时置 `'block'`）—— 避免空段留下 8px 的残留外边距。**不走 markup 内联 style**（CSP），**不用** `''` 回落 |
| 复用之外的边界 | 设置页既有的 `#toast`（`settings.html:752`）是**全页通用**的另一套通道（白名单增删等在用）；D-06 已把本区的反馈面锁定为 inline hint，故本区**不调用** `showToast` |

### 键盘可达性（本页新实例必须齐备）

| 元素 | 焦点语义 |
|------|---------|
| 启停开关 | `button` 元素原生可聚焦；`:focus-visible` 走**本阶段新增的作用域收敛规则**（`.skill-manage-section .ai-switch:focus-visible` → `outline: 2px solid var(--accent-color); outline-offset: 2px`）。**作用域收敛的理由**：`.ai-switch` 已有一个宿主（provider 启用开关），全局补焦点环会改动本阶段以外的面 |
| 卸载按钮 | `button.btn.btn-secondary.btn-sm` 原生可聚焦；沿用全仓 `.btn` 的 UA 默认焦点环（全仓无全局 `outline: none` 重置） |
| 诊断徽标 | `button.skill-manage-diag-badge` 原生可聚焦（Enter / Space 原生触发） |
| 汇总条 / 折叠块 header | `role="button"` + `tabindex="0"` + 随态 `aria-expanded` + Enter / Space（`preventDefault`）；焦点环由**既有** `.ai-skill-content-box-header:focus-visible` 规则承担（同类名 ⇒ 对本页新实例同样生效） |
| 空态 `重新加载` 按钮 | `button.btn.btn-secondary.btn-sm` 原生可聚焦 |
| 顺序焦点序 | 与 DOM 顺序一致（行内：诊断徽标 → 开关 → 卸载；名称与描述是纯文本、不进焦点序），**不引入任何 `tabindex` 正值** |

### 新增 CSS 声明清单（本阶段全部新增，逐条可核）

命名空间统一为 `.skill-manage-*`（kebab-case，符合项目命名规范）。**每条都不改动任何既有规则**
（唯二例外是两条**作用域收敛**的覆盖，见 `## Color` 的前置修复 ① 与「键盘可达性」）。全部间距值为
4 的倍数（B 表为空）。

**落点（强制）**：整段**追加在 `src/styles/main.css` 末尾**的专属段中（段注释见下）。
理由是**源序依赖**：`.skill-manage-danger-btn { color: … }` 与 `.btn-secondary`（`main.css:923`）
**同特异性**（各一个类），必须靠**后出现**才能覆盖 `color`；同理
`.skill-manage-section .ai-switch:focus-visible` 是两段式选择器、天然优先于 `.ai-switch`。
把本段插到文件中部会让这两条覆盖**静默失效**（与 49 的 `.tool-card-manage-note-*` 同款做法）。

```css
/* ===== 设置页「技能管理」区（Phase 50） ===== */

/* 区作用域锚 `.skill-manage-section`：**刻意的无样式钩子**（供两条作用域收敛覆盖与测试定位，
   不承担样式职责，故此处不声明任何属性 —— 它不是孤儿类，见下方两条以它为前缀的规则） */

/* 组标题（区标题之下的第二级：13px/600 + 次级色，零新视觉语言） */
.skill-manage-group-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

/* 组容器：区分组之间用既有的描边 + 4 网格留白（不加卡片，避免双层卡片底） */
.skill-manage-group + .skill-manage-group {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

/* 汇总条与下方列表的段间距 —— 相邻兄弟选择器天然做到「只在汇总条存在时生效」 */
.ai-skill-content-box.skill-manage-summary + .skill-manage-groups { margin-top: 16px; }

.skill-manage-list { list-style: none; }

/* 行：分隔线只画在行与行之间；无 hover 底（见 Color 的硬禁令与四档核算） */
.skill-manage-row { padding: 8px 0; }
.skill-manage-row + .skill-manage-row { border-top: 1px solid var(--border-color); }

.skill-manage-row-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  /* 硬禁令：不得声明 flex-wrap —— 见契约「长文本与溢出纪律」 */
}

/* 技能名：唯一压缩承担者（等宽 13px/600 与 48 面板行名同款） */
.skill-manage-name {
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右对齐簇：诊断徽标 → 状态标注 → 操作区（一个 auto 外边距，顺序确定） */
.skill-manage-tail {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}

/* 诊断徽标：无底色的文本按钮（有底色会压低暗色主题对比度，见 Color 表） */
.skill-manage-diag-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
}
.skill-manage-diag-badge:hover { color: var(--text-primary); }
.skill-manage-diag-badge-chevron { transition: transform 150ms ease; }
.skill-manage-diag-badge[aria-expanded="true"] { color: var(--text-primary); }
.skill-manage-diag-badge[aria-expanded="false"] .skill-manage-diag-badge-chevron { transform: rotate(-90deg); }

/* 行尾状态标注：纯文本、永不截断；中性态用 --text-secondary（--text-muted 不达标） */
.skill-manage-status {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
.skill-manage-status-limit { color: var(--skill-limit-text); }

.skill-manage-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* 开关在途态（既有 .ai-switch 无 disabled 样式） */
.skill-manage-actions .ai-switch:disabled { opacity: 0.6; cursor: progress; }
/* 焦点环（作用域收敛：不改动 provider 区的那个宿主） */
.skill-manage-section .ai-switch:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px; }

/* 危险按钮：中性底 + 危险文字色（.btn-danger 的白字不达标，见 Color）。
   尺寸不另行声明 —— 由既有 .btn + .btn-sm 提供，与同页「添加」按钮同款。 */
.skill-manage-danger-btn { color: var(--skill-error-text); }

/* 第二行：描述（唯一压缩项）+ 元信息（永不截断） */
.skill-manage-row-sub { display: flex; align-items: center; gap: 8px; margin-top: 4px; min-width: 0; }
.skill-manage-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-manage-meta {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

/* 诊断详情区 / 汇总条的 scoped 覆盖（唯一一条）：header hover 文字色 */
.skill-manage-section .ai-skill-content-box-header:hover { color: var(--text-primary); }

/* 诊断条目列表 */
.skill-manage-diag-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.skill-manage-diag-item { display: flex; align-items: baseline; gap: 8px; }
.skill-manage-diag-level {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  flex-shrink: 0;
  color: var(--text-secondary);
}
.skill-manage-diag-item-error .skill-manage-diag-level { color: var(--skill-error-text); }
.skill-manage-diag-item-warning .skill-manage-diag-level { color: var(--skill-limit-text); }
.skill-manage-diag-message {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-word;
  flex: 1 1 auto;
  min-width: 0;
}
.skill-manage-diag-code {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

/* 加载中 / 空态三态（共用一个容器；无 spinner、无骨架屏）。
   flex column + gap 让「标题 → 正文 → 重新加载按钮」的间隙由一处给出（含加载态只有正文的情形） */
.skill-manage-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  text-align: center;
}
.skill-manage-state-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}
.skill-manage-state-title-danger { color: var(--skill-error-text); }
.skill-manage-state-body {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-word;
}
/* 空态的「重新加载」按钮无需新类：直接用既有 .btn .btn-secondary .btn-sm */

/* inline hint（D-06） */
.skill-manage-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  margin-top: 8px;
  word-break: break-word;
}
.skill-manage-hint-success { color: var(--skill-success-text); }
.skill-manage-hint-danger { color: var(--skill-error-text); }

/* 卸载确认弹框（内层修饰；外壳复用 .ai-modal-overlay / .ai-modal） */
.skill-manage-confirm { width: 420px; max-width: 94vw; }
.skill-manage-confirm-body {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
  word-break: break-word;
}
.skill-manage-confirm-note {
  font-size: 12px;
  line-height: 1.5;
  color: var(--skill-limit-text);
  word-break: break-word;
}
.skill-manage-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
```

**唯一非 4 倍数的值**：`.skill-manage-diag-badge` 的 `padding: 1px 4px` —— **照抄** A 表登记的
`.slash-picker-source-badge` / `.slash-picker-tag-explicit` 既有例外（`1px` 垂直）。**不新登记、不放大**。

### 状态机与重渲染的硬约束（汇总）

1. **零 HTML 字符串模板**：整棵列表用 `createElement` + `textContent` / DOM 属性赋值构建
   （本页既有 `renderAiBashWhitelistTags` 已是该范式，照抄形状）。
2. **每次写操作后用响应体重渲染**，不额外发第二次请求（响应即最新投影）。
3. **重渲染必须还原滚动位置 + 焦点**（见「启停开关」表）。
4. **诊断展开态不跨重渲染保留**（契约明确：不持久化）。
5. **区在页面上恒存在**（即使加载失败）—— 用户必须始终能看到「技能管理」这个区与其说明。

---

## 与 48 / 49 既有面的关系

| 面 | 关系 |
|----|------|
| 三档来源徽标（`TIER_BADGE` + `.slash-picker-source-badge*`，48 D-14 / 49） | **消费同一份**：本阶段**只查表、零判定、零新色值**。徽标底色已钉死在 `var(--bg-secondary)`，而本页宿主底色正是该令牌 ⇒ 48/49 的四档实测值**逐值照搬、无需重算** |
| `STATUS_TEXT` 单源（48 D-12 / 49） | **同一张表新增第 5 条** `disabled: '已禁用'`（本契约；消费方只有设置页 —— `/` 面板根本不列出被禁用技能，48 D-10）。**不违反单源**：是同一张表的**不同消费者**，不是第二份文案 |
| 面板行的 `nameClash` 状态（48） | **本页不使用** —— 「与本地命令同名」是 `/` 面板专属语义（设置页没有本地命令概念）。⇒ 本页的状态链是 `disabled > shadowed > overLimit > promptOmitted`，**`nameClash` 不在链上** |
| 折叠块家族 `.ai-skill-content-box*`（48 D-09 / 49） | **第三种语境复用**：本页取「shell + body」（诊断详情区）与「完整家族」（模块级汇总条）。**不新建第二份折叠实现**；只允许**一条** scoped 覆盖（header hover 文字色，见 `## Color` 前置修复 ①）。本页的折叠用 `display` 切换（既有规则）⇒ **不重演** 49 的「`max-height: 0` + `overflow: hidden` 造出隐形焦点停靠点」（`UI-49-W6-01`） |
| 折叠块的键盘语义（48-UI-REVIEW Pillar 6 建议 / 49-08 的 `{ interactive }` 语境开关） | **本页是第三个语境，采取「可见即施加」**：诊断详情区与汇总条的 header 恒在正常流内可见 ⇒ 施加 `role="button"` + `tabindex="0"` + `aria-expanded` + Enter/Space。这与 49 的**卡片实例**（`{ interactive: false }`）不冲突：那条决策的判据是「宿主默认零高 ⇒ 施加即产出隐形停靠点」，本页不存在该前提。**不推翻 `49-UI-SPEC.md` 的卡片锁定决策** |
| `/` 面板行（48-02） | **无交集**：本阶段不触碰 `renderSlashPickerList` / `buildPickerItems` 的既有语义（只在 `STATUS_TEXT` 加一键、并按「硬前置条件」把 `仅显式` 的 label/title 提升为单源） |
| 用户气泡 / 工具卡片（48 / 49） | **无交集**：本阶段不渲染 pill、不改工具卡片、不改 `.tool-card-*` 任何规则 |
| 48-UI-REVIEW 的 3 条 priority fix | ① 徽标底色基准 / ② 浅色 `--skill-limit-text` —— **已由 49 作为前置修复落地**，本页**纯受益**（无需再做）；③ 面板行不可换行组 —— 属**面板面**，本阶段**不涉及、也不得被视为已修** |
| 48-UI-REVIEW Pillar 3 的 hover 对比度盲区 | **本页主动闭合**：本契约的对比度表同时列 `--bg-secondary` 与 `--bg-hover` 两档，并导出硬禁令（行不得加 `--bg-hover` 底） |
| `49-UI-REVIEW` 的 `W3-01`（Accent 清单漏记聚焦环） | **本页追认并统一登记**（见 `## Color` 的 Accent reserved for 第 2 条） |
| `49-UI-REVIEW` 的 `W1-04`（同域第二份映射表）形态 | **本页主动规避**：`仅显式` 的 label/title 提升为单源（硬前置条件），失败 `code` 映射表是**单消费者**新文案（一旦有第二消费者即须提升） |
| `TD-48-01`（`escapeHtml` 不转义引号 ⇒ 属性上下文逃逸） | **本阶段不扩大缺口**：本页新增的插值面**全部**走 DOM API 赋值（`textContent` / `el.title = …` / `setAttribute`），零 HTML 字符串模板。**该挂账项仍在原处、仍未被修**，不得读成已修 |
| `TD-48-02` / `WR-02` / `WR-06`（48 挂账） | **不在本阶段契约面**，逐字保持挂账（见 `STATE.md`） |
| `WR-12` / `IN-14` / `IN-16` / `IN-17`（49 收尾带出的守卫强度债 / 可复现性债） | **不在本阶段契约面**。若本阶段新增真实渲染门禁，**不得重复 `WR-12` 的「否命题空集真」形态** —— 承重判据必须带**正命题** |
| a11y：卡片语境技能正文折叠块无键盘入口（49 收尾带出，**既有状态非回归**） | **不在本阶段契约面**。`49-UI-SPEC.md` 的「展开 / 折叠（卡片）」锁定行要求 49 零改动；本页是**另一个宿主**（设置页），因此**不构成**对该 a11y 项的处置，**不得**被读成已修 |

---

## UI Considerations

> 本节由 `ui-phase` 探针在 checker 通过后写入（形状根因的 UI 状态覆盖：empty / loading / error /
> populated / partial / overflow / zero-one-many / long-text）。**本节留空，等待探针填表。**
>
> 空态与错误态的**文案**在 `## Copywriting Contract`（三态空态 + 按 `code` 的失败映射表 +
> 加载中文案），本节只记**形状**覆盖，不重复抄写文案。

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| （无） | — | not applicable —— 项目未初始化 shadcn（无 `components.json`），不消费任何 registry，无第三方 block 需要 vetting |

---

## 决策来源表

| 契约条目 | 来源 |
|----------|------|
| 按来源分三组 + 组名「我的技能 / 内置技能 / AI 创建」+ 组内行式列表 + 不做折叠 + **空组不渲染** | **D-01 原文** |
| 两行式行布局、描述 CSS 单行截断 + `title` 全文、元信息格式 `12.3 KB · 4 个文件` | **D-02 原文** |
| 排序与分组都在主进程、前端只渲染不重排 | D-03（`bySkillPriority` 全序） |
| v1 不做过滤 / 搜索框 | D-04 |
| 启停即改即存（switch、无保存按钮）+ 卸载二次确认 + `realm://` 弹框范式 | D-05（含其与 49 D-01 的正交论据） |
| 失败 / 拒绝反馈走设置页 inline hint、不新建 toast 基建 | D-06 |
| 卸载入口仅对 `source === 'user'` 渲染 + 区说明 ②（**D-07 原文逐字**）+ 同名条目只作提示 | D-07 |
| 卸载失败码 `not_user_owned` 与 `not_found` 的区分 | D-08（第十码） |
| 禁用的技能仍可卸载（开关不置灰） | D-09 |
| 诊断两层承载（模块级 `errors[]` → 顶部汇总条；每技能 `diagnostics[]` → 行尾徽标 + 内联可展开详情区） | D-11 原文 |
| 状态标注复用 `STATUS_TEXT` 单源 + 优先级链 `disabled > shadowed > overLimit > promptOmitted` + 「仅显式」在链外独立 | D-12 原文 |
| `disabled → '已禁用'` 作为 `STATUS_TEXT` 第 5 条 | D-12 原文（本契约落其取值与消费方） |
| 元信息 = 体积 / 文件数（递归、含 `SKILL.md`、不含隐藏文件） | D-13 原文 + research A2（`SKILL.md` 计入的口径须写明） |
| 不展示 `allowed-tools` | D-14（本阶段的 UI 面因此**不含**该字段的任何呈现位） |
| 设置页走 HTTP / 主窗口走 IPC，两条不可互换 | D-17（+ AGENTS.md 数据访问分层约定） |
| 写路径「`syncAgentSystemPrompt()` 恰一次 + 调用侧补播」对 UI 的可见投影 = 「变更在下一条消息起生效」文案 + 每次操作后自行重拉 | D-18（含诚实边界：设置页收不到广播） |
| 空态必须区分「确实没有技能」与「尚未加载（`refreshedAt === 0`）」；无 provider 时的验收面是「列表不为空」而非「多一条提示」 | **D-19**（修正 2 的验收面） |
| **诊断详情区 = 复用折叠块家族（shell + body、无 header、徽标作开关）** | **用户（本次 ui-phase 问答）** —— D-11 的「列表内联可展开详情区」+ CONTEXT Claude's Discretion 的「建议复用 48 / 49 的折叠块范式」 |
| **卸载确认弹框文案（含目录路径 + 条件性同名提示）** | **用户（本次 ui-phase 问答）** —— D-05 的二次确认 + D-07 的「同名只作提示」 |
| **空态三态（尚未加载 / 确实没有 / 拉取失败）+ `重新加载` CTA** | **用户（本次 ui-phase 问答）** —— D-19 的硬要求 |
| **加载中态 = 单行纯文本、无 spinner / 无骨架屏** | **用户（本次 ui-phase 问答）** —— 沿设置页「AI 记忆」子区 `加载中…` 的既有先例 |
| 诊断徽标 = 无底色的文本按钮 + chevron（以 `aria-expanded` 为状态源） | 本契约（对比度核算：带 `rgba(127,127,127,0.16)` 底时暗色主题实测 **4.49**，不达标 ⇒ 改无底色；状态源取 a11y 属性而非类名，杜绝类/属性漂移） |
| 汇总条默认**展开**、header 兼作开关 | 本契约（D-11 未细化汇总条的展开形态；默认展开是「禁止静默失败」既有纪律的直接兑现，与 D-11 归属不冲突） |
| 「仅显式」渲染在第一行（来源徽标之后）、状态标注与诊断徽标置于右对齐簇 | 本契约（与 48 面板行的 ①②③ 元素顺序一致，是「同一视觉语言」的可核面对） |
| 行**不设** `--bg-hover` 底 | 本契约（对比度直接导出：`--text-secondary` on `--bg-hover` 实测暗 3.97 / 亮 4.35 不达标；既有 `.settings-item` 同样无 hover 底） |
| 危险按钮用「中性底 + `--skill-error-text` 文字」，**不使用** `.btn-danger` | 本契约（白字对 `--danger-color` 实测 3.76:1 < 4.5；`.btn-danger` 的缺陷既有、本阶段不修亦不用） |
| 新增令牌 `--skill-success-text` | 本契约（`--success-color` 未按主题分档、浅色底实测 2.33:1 ⇒ 按 49 对 `--skill-error-text` 的同款处置成对定义） |
| 折叠块 header hover 文字色的**作用域收敛**覆盖 | 本契约（既有 hover 底 + `--text-secondary` 实测暗 3.97 / 亮 4.35 不达标；作用域收敛以保住 48/49 两个宿主的零变化） |
| `仅显式` 的 label / title 提升为单源（面板侧改引用） | 本契约（48/49 反复付过代价的「第二份拷贝」形态；`49-UI-REVIEW` W1-04 同族） |
| `set-disabled` 的名称谓词必须与列表来源谓词同宽（开关恒可操作） | 本契约（OQ-2 的「故意的不对称」必须落在服务端谓词；否则 render 出「点了必然 400」的开关） |
| 重渲染必须还原滚动位置与焦点 | 本契约（一次操作只影响一行；零二次请求用响应体投影重渲染的必然代价） |
| 弹框**不做**完整焦点陷阱、初始焦点落在「取消」、`Esc` 关闭 | 本契约（与设置页既有的三个 `.ai-modal-overlay` 弹框同范式；如实登记为已知边界） |
| 列表滚动归 `.settings-content`（不新建内层滚动容器） | 本契约（与 D-01「不折叠」的取舍一致；避免嵌套滚动） |
| 新增 `<script src="skill-picker-model.js">` 于 `settings-page.js` 之前 | D-12 单源的实现前提（research A3；执行期须实测一次 `realm://` CSP 下的加载表现） |

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
