---
phase: 25
slug: script-tab
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-03
---

# Phase 25 — UI Design Contract

> 脚本生成 + 智能标签整理的视觉与交互设计契约。涵盖 SCRIPT-01~03（脚本预览/编辑/执行）和 TAG-01~02（标签分组建议/应用）。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（沿用现有纯 CSS 体系） |
| Preset | not applicable |
| Component library | none（复用 Phase 24 action-confirm-card 模式） |
| Icon library | 内联 SVG（与现有工具图标一致） |
| Font | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` |

**设计原则：** Phase 25 不引入新的设计系统或组件库。所有新 UI 组件均在 AI 聊天面板内联渲染，复用 Phase 24 的 `.action-confirm-card` 模式和现有 CSS 变量体系。

---

## Spacing Scale

沿用项目现有间距体系（见 `src/styles/main.css` `:root` 声明），Phase 25 新增组件使用以下值：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 步骤卡片内图标与文字间距、状态圆点与文字间距 |
| sm | 8px | 步骤卡片之间间距、按钮组间距、标签项间距 |
| md | 12px | 卡片内边距、分组卡片头部内边距 |
| lg | 16px | 卡片整体外边距、分组列表内边距 |
| xl | 24px | 脚本卡片与分组卡片之间的间距 |

**组件特定尺寸：**
- 脚本步骤卡片高度：自动（内容撑开），最小 40px
- 步骤序号圆圈：24x24px
- 拖拽手柄：16x16px
- 操作按钮高度：32px（与 action-confirm-card 一致）
- 分组分隔线高度：1px
- 标签页项高度：36px

**无例外值** — 所有间距均为 4px 的倍数。

---

## Typography

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 13px | 400 | 1.4 | 步骤详情文本、标签页 URL、参数值 |
| Label | 12px | 500 | 1.3 | 步骤序号标签、分组名称、状态文本 |
| Heading | 14px | 600 | 1.3 | 脚本名称、分组标题、卡片头部 |
| Display | 14px | 400 | 1.5 | 脚本描述文本 |

**等宽字体**（用于参数值显示）：`'SF Mono', Monaco, Menlo, Consolas, monospace`

---

## Color

沿用项目现有色彩体系，不引入新颜色。

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#1a1a1a` (--bg-primary) | 页面背景 |
| Secondary (30%) | `#2a2a2a` (--bg-secondary) | AI 面板背景 |
| Tertiary | `#3a3a3a` (--bg-tertiary) | 卡片背景、步骤项背景 |
| Hover | `#404040` (--bg-hover) | 按钮悬停、可交互元素悬停 |
| Accent | `#3B82F6` (--accent-color) | 确认按钮、激活状态、拖拽插入线 |
| Danger | `#EF4444` (--danger-color) | 删除按钮、安全验证失败、错误状态 |
| Success | `#10B981` (--success-color) | 执行成功、安全验证通过 |
| Warning | `#F59E0B` | 中等风险步骤、执行跳过状态 |

**语义色使用规则：**
- `--accent-color`：仅用于「执行脚本」「应用分组」主按钮、拖拽插入指示线、当前执行步骤高亮
- `--danger-color`：仅用于「删除步骤」「安全拦截」状态、危险操作标签
- `--success-color`：仅用于步骤执行成功指示、安全验证通过标签

---

## Copywriting Contract

### 脚本预览卡片

| Element | Copy |
|---------|------|
| 主 CTA | `执行脚本` |
| 取消 CTA | `取消` |
| 空步骤提示 | `脚本无步骤` |
| 安全拦截标题 | `⚠️ 安全警告：检测到危险操作` |
| 安全拦截正文 | `以下步骤包含被禁止的操作，已自动移除：{操作列表}` |
| 执行中状态 | `执行中... ({当前}/{总数})` |
| 执行完成 | `✓ 脚本执行完成` |
| 执行失败 | `✗ 步骤 {N} 执行失败：{错误原因}` |
| 重试按钮 | `重试` |
| 跳过按钮 | `跳过` |
| 终止按钮 | `终止` |
| 添加步骤 | `+ 添加步骤` |
| 步骤序号 | `步骤 {N}` |

### 标签分组建议卡片

| Element | Copy |
|---------|------|
| 主 CTA | `应用分组` |
| 取消 CTA | `取消` |
| 分组标题 | `{分组名} ({标签数量})` |
| 无标签提示 | `当前没有打开的标签页` |
| 应用成功 | `✓ 已整理 {N} 个标签到 {M} 个分组` |
| 空分组名占位 | `未命名分组` |
| 添加分组 | `+ 添加分组` |

### 步骤类型标签

| Action | Display Label |
|--------|---------------|
| navigate | `导航` |
| click | `点击` |
| type | `输入` |
| scroll | `滚动` |
| wait | `等待` |
| select | `选择` |

---

## Component Specs

### 1. Script Preview Card (`.script-preview-card`)

**用途：** AI 聊天内联展示生成的脚本步骤列表，支持编辑和执行。

**结构：**
```
.script-preview-card
  .script-card-header
    .script-card-icon (24x24, 执行图标)
    .script-card-info
      .script-card-name (14px, 600)
      .script-card-desc (13px, --text-secondary)
    .script-card-actions (执行/取消按钮组)
  .script-steps-list
    .script-step-item (可拖拽)
      .step-drag-handle (16x16, 拖拽手柄)
      .step-number (24x24 圆圈, 序号)
      .step-content
        .step-action-label (12px, 500, 操作类型)
        .step-target (13px, 目标元素描述)
        .step-params (12px, --text-muted, 可折叠)
      .step-actions (编辑/删除按钮, hover 显示)
    .script-step-item.step-executing (当前执行步骤高亮)
    .script-step-item.step-success (已完成)
    .script-step-item.step-error (失败)
    .script-step-item.step-skipped (已跳过)
  .script-add-step-btn (+ 添加步骤)
```

**样式要点：**
- 卡片背景：`var(--bg-tertiary)`, `border-radius: 8px`, `overflow: hidden`
- 卡片头部：`padding: 12px`, `gap: 12px`, flex row
- 步骤列表：`padding: 0 12px 12px`
- 步骤项：`padding: 8px 0`, `border-bottom: 1px solid var(--border-color)`
- 拖拽状态：`opacity: 0.4`, 拖拽插入线 `2px solid var(--accent-color)`
- 按钮组：复用 `.action-confirm-card` 按钮样式（32px 高, 6px 圆角, 13px 字号）

**状态样式：**
- `.step-executing`：左侧 `3px solid var(--accent-color)` 边框，背景 `rgba(59, 130, 246, 0.1)`
- `.step-success`：左侧 `3px solid var(--success-color)` 边框，序号变绿
- `.step-error`：左侧 `3px solid var(--danger-color)` 边框，序号变红
- `.step-skipped`：`opacity: 0.5`, 文字变 `--text-muted`

**交互：**
- 步骤项 hover：显示编辑/删除按钮（`opacity: 0 → 1`，`transition: 0.15s`）
- 拖拽排序：复用项目现有的拖拽模式（dragstart/dragover/drop）
- 步骤展开/折叠：点击步骤行展开参数编辑区域（`max-height` 过渡 200ms）
- 添加步骤：在列表末尾追加空白步骤项，自动进入编辑模式

---

### 2. Script Step Editor (`.step-editor`)

**用途：** 展开单个步骤进行参数编辑。

**结构：**
```
.step-editor (在 .script-step-item 内展开)
  .step-editor-row
    label "操作"
    select.step-action-select
      option: 导航(navigate), 点击(click), 输入(type), 滚动(scroll), 等待(wait), 选择(select)
  .step-editor-row
    label "目标"
    input.step-target-input (13px, --bg-primary, 6px 圆角)
  .step-editor-row (条件显示, 根据 action 类型)
    label "参数"
    input.step-param-input / textarea.step-param-textarea
  .step-editor-actions
    button.step-save-btn (保存, accent-color)
    button.step-cancel-btn (取消, bg-hover)
```

**样式要点：**
- 编辑区域：`padding: 8px 0`, `gap: 8px`, flex column
- 行：flex row, `gap: 8px`, `align-items: center`
- label：`width: 48px`, `font-size: 12px`, `color: var(--text-secondary)`
- input/select：`flex: 1`, `height: 32px`, `padding: 0 8px`, `background: var(--bg-primary)`, `border: 1px solid var(--border-color)`, `border-radius: 6px`, `color: var(--text-primary)`, `font-size: 13px`
- focus 状态：`border-color: var(--accent-color)`

---

### 3. Tab Group Suggestion Card (`.tab-group-card`)

**用途：** AI 聊天内联展示标签页分组建议，支持编辑和应用。

**结构：**
```
.tab-group-card
  .tab-group-header
    .tab-group-icon (24x24, 分组图标)
    .tab-group-info
      .tab-group-title (14px, 600)
      .tab-group-desc (13px, --text-secondary)
    .tab-group-actions (应用/取消按钮组)
  .tab-groups-list
    .tab-group-section
      .tab-group-section-header
        .tab-group-name (14px, 600, 可编辑)
        .tab-group-count (12px, --text-muted, 标签数量)
        .tab-group-section-actions (重命名/删除, hover 显示)
      .tab-group-items
        .tab-group-item
          .tab-item-color-dot (8x8, 容器颜色)
          .tab-item-favicon (16x16)
          .tab-item-title (13px, 单行省略)
          .tab-item-url (12px, --text-muted, 单行省略)
          .tab-item-actions (移出分组, hover 显示)
    .tab-group-divider (1px solid var(--border-color))
  .tab-group-add-btn (+ 添加分组)
```

**样式要点：**
- 卡片背景：`var(--bg-tertiary)`, `border-radius: 8px`, `overflow: hidden`
- 卡片头部：`padding: 12px`, `gap: 12px`, flex row（与 script-preview-card 一致）
- 分组列表：`padding: 0 12px 12px`
- 分组区域：`margin-bottom: 8px`（最后一个无 margin）
- 分组头部：`padding: 8px 0`, `gap: 8px`, flex row
- 标签项：`padding: 6px 8px`, `border-radius: 6px`, flex row, `gap: 8px`
- 标签项 hover：`background: var(--bg-hover)`
- 分隔线：`height: 1px`, `background: var(--border-color)`, `margin: 4px 0`
- 拖拽样式：与脚本步骤拖拽一致

**交互：**
- 标签项可跨分组拖拽（dragstart/dragover/drop）
- 分组名可点击编辑（双击或点击编辑图标）
- 删除分组：分组内标签移至「未分组」
- 按钮组：复用 `.action-confirm-card` 按钮样式

---

## Animations & Transitions

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| 步骤展开/折叠 | max-height | 200ms | ease |
| 按钮/编辑图标显隐 | opacity | 150ms | ease |
| 拖拽插入线 | opacity | 150ms | ease |
| 执行状态切换 | background-color | 200ms | ease |
| 步骤状态指示器 | color, border-color | 200ms | ease |
| 标签项 hover | background | 150ms | ease |

**无新增动画** — 所有过渡复用项目现有 timing 模式。

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| 无外部 registry | N/A | not required |

Phase 25 不引入任何第三方 UI 组件。所有组件均使用原生 HTML + 项目现有 CSS 变量实现。

---

## New CSS Variables

Phase 25 新增以下 CSS 变量（如需要）：

```css
/* 脚本预览 */
--script-step-height: 40px;
--script-number-size: 24px;
--script-drag-handle-size: 16px;

/* 标签分组 */
--tab-group-item-height: 36px;
--tab-color-dot-size: 8px;
--tab-favicon-size: 16px;
```

**注意：** 这些变量仅为语义化命名，值直接来自现有间距/尺寸体系。

---

## Implementation Notes

### 与 Phase 24 的复用关系

1. **按钮组模式**：脚本预览和分组建议的「执行/取消」「应用/取消」按钮组直接复用 `.action-confirm-card` 的按钮行样式
2. **风险徽章**：安全拦截的状态标签复用 `.risk-badge` 的低/中/高风险样式
3. **状态指示**：执行中的 spinner 复用 `.tool-card` 的旋转图标模式
4. **卡片容器**：整体卡片容器复用 `.action-confirm-card` 的外层样式

### 渲染位置

所有新组件均在 `src/renderer.js` 的 AI 聊天消息渲染流程中，作为 `.ai-message-ai` 的子内容渲染。与 Phase 24 的工具卡片、确认卡片共存于同一消息流中。

### HTML 模板

新增 HTML 模板片段添加在 `src/index.html` 的 `<body>` 末尾（`<template>` 标签），供 `renderer.js` 动态克隆使用。

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-03
