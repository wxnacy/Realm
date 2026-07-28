---
phase: 11
slug: 设置页面重构
status: draft
shadcn_initialized: false
preset: not applicable
created: 2026-07-27
---

# Phase 11 — UI Design Contract

> 视觉和交互契约：设置页面重构为左侧边栏 + 多页面布局，将分配规则和快捷键从弹窗迁入设置页面。由 gsd-ui-researcher 生成，gsd-ui-checker 验证。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（原生 HTML + CSS，无组件库） |
| Preset | not applicable |
| Component library | none |
| Icon library | 内联 SVG（与现有 renderer.js 图标风格一致） |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

**设计系统说明：** 本项目为 Electron 桌面应用，使用原生 JavaScript + HTML + CSS，无 React/Vue 等框架，无 shadcn/Tailwind。所有样式通过 `src/styles/main.css` 的 CSS 变量系统管理。

---

## Spacing Scale

基于现有代码库 8px 网格系统（从现有 CSS 中 `padding: 16px`、`gap: 8px`、`margin: 24px` 等模式推导）：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 图标与文字间距、紧凑元素内间距 |
| sm | 8px | 列表项内部间距、按钮内间距、表单控件间距 |
| md | 16px | 卡片内边距、设置组间距、默认元素间距 |
| lg | 24px | 区域标题与内容间距、设置页内边距 |
| xl | 32px | 页面级间距、侧边栏与内容区间距 |
| 2xl | 48px | 大段落分隔、页面顶部留白 |

Exceptions:
- 侧边栏宽度：220px（固定值，非间距 token）
- 快捷键捕获对话框宽度：360px（固定值）
- 规则行高度：52px（固定值，含拖拽手柄）

---

## Typography

4 个字体大小等级，2 个字重：

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 13px | 400 (regular) | 1.5 |
| Label | 13px | 600 (semibold) | 1.4 |
| Heading (h3) / Sidebar title | 14px | 600 (semibold) | 1.3 |
| Page title (h1) | 18px | 600 (semibold) | 1.3 |
| Sidebar item | 13px | 400 (regular) | 1.4 |
| Version text | 11px | 400 (regular) | 1.4 |
| Caption / badge | 11px | 600 (semibold) | 1.3 |

**字体说明：** 13px body 与现有 Electron 应用（VS Code、Figma 桌面端）一致，macOS Retina 屏幕下可读性良好。所有字体大小使用绝对像素值（非 rem/em），与现有 main.css 风格保持一致。侧边栏标题复用 14px（与 h3 共享），仅保留 4 个字体大小等级。

---

## Color

现有 CSS 变量体系（从 `src/styles/main.css` 提取）：

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #1a1a2e | 页面背景、内容区域背景 |
| Secondary (30%) | #16213e | 侧边栏背景、卡片背景、设置组背景 |
| Accent (10%) | #3B82F6 | 选中高亮条、主按钮、链接、活跃标签页指示器 |
| Destructive | #EF4444 | 删除按钮、危险操作确认 |
| Border | #2d3748 | 分隔线、输入框边框、卡片边框 |
| Text primary | #e2e8f0 | 正文、标题 |
| Text secondary | #a0aec0 | 次要文字、描述文字 |
| Text muted | #718096 | 占位符、禁用状态文字 |
| Input background | #2d3748 | 输入框、下拉框、选择器背景 |
| Hover | rgba(255,255,255,0.05) | 行悬停、可交互元素悬停 |

Accent reserved for:
- 侧边栏选中项的背景高亮条（圆角矩形）
- 主要操作按钮（"添加规则"、"设为默认浏览器"）
- 快捷键捕获状态边框高亮
- 开关激活状态（toggle-switch.active）
- Toast 成功提示边框

---

## Copywriting Contract

### 页面级文案

| Element | Copy |
|---------|------|
| 页面标题 (h1) | 设置 |
| 侧边栏标题 | 设置 |

### 侧边栏导航项

| Icon | Label |
|------|-------|
| 齿轮图标 (svg) | 通用 |
| 规则图标 (svg) | 分配规则 |
| 键盘图标 (svg) | 快捷键设置 |
| 信息图标 (svg) | 关于 |

### 通用设置页

| Element | Copy |
|---------|------|
| 分组标题：默认浏览器 | 默认浏览器 |
| 状态文案（已是默认） | Realm 已是默认浏览器 |
| 状态文案（非默认） | Realm 不是默认浏览器 |
| CTA 按钮 | 设为默认浏览器 |
| 分组标题：历史记录 | 历史记录 |
| 设置项标签 | 历史记录保留天数 |
| 分组标题：默认容器 | 默认容器 |
| 设置项标签 | 新标签页默认容器 |
| 下拉默认选项 | 使用上次打开的容器 |
| 分组标题：启动 | 启动 |
| 设置项标签 | 启动时恢复上次的标签页 |
| 下拉选项 | 每次询问 / 恢复 / 不恢复 |

### 分配规则页

| Element | Copy |
|---------|------|
| 空状态标题 | 暂无分配规则 |
| 空状态说明 | 添加规则后，指定网站会自动在对应容器中打开 |
| 添加按钮 | 添加规则 |
| 导入按钮 | 导入 |
| 导出按钮 | 导出 |
| 规则行箭头 | -> |
| Toggle 启用提示 | 禁用 |
| Toggle 禁用提示 | 启用 |
| 删除按钮提示 | 删除 |
| 拖拽手柄 | (竖排两点图标) |

### 快捷键设置页

| Element | Copy |
|---------|------|
| 分组标题：标签页操作 | 标签页操作 |
| 分组标题：导航操作 | 导航操作 |
| 分组标题：收藏 | 收藏 |
| 分组标题：其他 | 其他 |
| 修改按钮提示 | 修改 |
| 恢复默认按钮提示 | 恢复默认 |
| 重置全部按钮 | 重置全部快捷键 |
| 捕获状态文案 | 请按下快捷键... |
| 等待按键文案 | 等待按键... |
| 冲突警告模板 | 该快捷键已被 [操作名] 使用 |

### 关于页

| Element | Copy |
|---------|------|
| 应用名称 | Realm Browser |
| 版本标签 | 版本: {version} |
| 描述 | 多容器隔离浏览器 |

### Toast 提示

| Type | Message |
|------|---------|
| Success: 设置保存 | 设置已保存 |
| Success: 规则添加 | 规则已添加 |
| Success: 快捷键更新 | 快捷键已更新 |
| Success: 快捷键重置 | 快捷键已恢复默认 |
| Success: 规则导入 | 已导入 {count} 条规则{，跳过 {skipped} 条重复} |
| Success: 规则导出 | 已导出 {count} 条规则 |
| Error: 设置保存失败 | 保存失败，请重试 |
| Error: 加载失败 | 加载设置失败 |
| Error: 输入为空 | 请输入匹配模式 |

### Destructive Confirmation

| Action | Approach |
|--------|----------|
| 删除规则 | 无确认（直接删除，右侧有 toast 反馈） |
| 重置全部快捷键 | 确认对话框："确定要重置所有快捷键为默认值吗？" |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| N/A | 无 | not applicable |

**说明：** 本项目不使用 shadcn 或任何组件注册表，所有组件为原生 HTML + CSS 实现。

---

## 页面布局契约

### 整体结构

```
+-----------------------------------------------+
|  .settings-page                                |
|  +----------+--------------------------------+ |
|  | .sidebar | .settings-content              | |
|  |          |                                 | |
|  | 设置     |  [动态内容区域]                  | |
|  |          |                                 | |
|  | 通用     |  通用设置 / 分配规则 / 快捷键    | |
|  | 分配规则  |  / 关于                         | |
|  | 快捷键   |                                 | |
|  | 关于     |                                 | |
|  |          |                                 | |
|  | v1.0.0   |                                 | |
|  +----------+--------------------------------+ |
+-----------------------------------------------+
```

### 侧边栏 (.sidebar)

| Property | Value |
|----------|-------|
| 宽度 | 220px（固定） |
| 背景色 | var(--bg-secondary) (#16213e) |
| 边框 | 右侧 1px solid var(--border-color) |
| 内边距 | 24px 0 |
| 位置 | position: sticky; top: 0; height: 100vh |

**侧边栏标题区域：**
- 距顶部 24px 内边距
- "设置" 文字，14px semibold，颜色 var(--text-primary)
- 底部 24px 间距

**导航项：**
- 高度：40px
- 内边距：0 16px 0 20px
- 图标 + 文字布局：gap 12px
- 图标大小：18x18px，颜色 var(--text-muted)
- 文字：13px regular，颜色 var(--text-secondary)
- 悬停：背景 rgba(255,255,255,0.05)
- 选中：背景 var(--accent-color) at 15% opacity，左侧 3px 圆角高亮条（accent 色），文字颜色 var(--text-primary)，图标颜色 var(--accent-color)

**版本号区域：**
- 固定在侧边栏底部（flex-end 或 position: absolute; bottom: 0）
- 内边距：16px 20px
- 文字：11px regular，颜色 var(--text-muted)
- 可点击，点击跳转"关于"页面

### 内容区域 (.settings-content)

| Property | Value |
|----------|-------|
| 最大宽度 | 680px |
| 内边距 | 24px 32px |
| 背景色 | var(--bg-primary) (#1a1a2e) |

**页面切换：** 点击侧边栏项时，内容区域通过 `display: none/block` 切换对应页面 div。无过渡动画（保持实现简单，`Claude's Discretion` 范围内选择最简方案）。

---

## 通用设置页面契约

### 设置组 (.settings-group)

| Property | Value |
|----------|-------|
| 背景色 | var(--bg-secondary) (#16213e) |
| 圆角 | 8px |
| 内边距 | 16px 20px |
| 底部间距 | 12px |
| 边框 | 1px solid var(--border-color) |

**组标题 (.settings-group-title)：**
- 14px semibold，颜色 var(--text-primary)
- 底部 12px 间距

### 设置项 (.settings-item)

| Property | Value |
|----------|-------|
| 布局 | flex, justify-content: space-between, align-items: center |
| 高度 | 44px（最小） |
| 标签 | 13px regular，颜色 var(--text-secondary) |
| 控件宽度 | select: 180px |

**控件样式：**
- `<select>`: 背景 var(--bg-input)，边框 1px solid var(--border-color)，圆角 6px，内边距 8px 12px，颜色 var(--text-primary)
- `<button>` (primary): 背景 var(--accent-color)，颜色 #fff，圆角 6px，内边距 8px 16px

**交互：** 所有设置项修改后即时保存（`change` 事件触发 `saveSettings()`），无需额外保存按钮。

---

## 分配规则页面契约

### 顶部操作栏

| Property | Value |
|----------|-------|
| 布局 | flex, justify-content: space-between, align-items: center |
| 底部间距 | 16px |

**左侧：** "添加规则" 主按钮（accent 色背景）
**右侧：** "导入" + "导出" 次要按钮（透明背景，边框样式）

### 添加规则表单

- 位于规则列表上方，展开时显示
- 包含：容器下拉选择（180px）+ URL 匹配模式输入框（flex: 1）+ 添加按钮
- 输入框样式与通用设置的 select 一致

### 规则列表 (.rules-list)

**空状态：**
- 居中显示，padding: 48px 0
- 图标：规则图标 SVG（48x48px，颜色 var(--text-muted)）
- 标题：14px medium，颜色 var(--text-secondary)
- 说明：13px regular，颜色 var(--text-muted)

**规则行 (.rule-item)：**

| Property | Value |
|----------|-------|
| 高度 | 52px |
| 背景 | var(--bg-secondary) |
| 圆角 | 8px |
| 底部间距 | 4px |
| 内边距 | 0 16px |
| 布局 | flex, align-items: center, gap: 12px |
| 悬停 | background: rgba(255,255,255,0.03) |

**行内元素：**
- 拖拽手柄：cursor grab，width 20px，color var(--text-muted)
- 匹配模式：13px regular，color var(--text-primary)，flex: 1，溢出 ellipsis
- 箭头：13px，color var(--text-muted)，margin 0 8px
- 容器名：13px regular，color var(--text-secondary)
- Toggle switch：36x20px track，16px thumb，激活色 var(--accent-color)
- 删除按钮：icon-only，14x14px SVG，color var(--text-muted)，hover var(--destructive)

**拖拽状态：**
- `.dragging`：opacity 0.5
- `.drag-over-top`：上边框 2px solid var(--accent-color)
- `.drag-over-bottom`：下边框 2px solid var(--accent-color)

---

## 快捷键设置页面契约

### 快捷键分组

每组包含：
- **分组标题**：14px semibold，color var(--text-primary)，padding: 16px 0 8px 0
- **快捷键行列表**

### 快捷键行 (.shortcut-item)

| Property | Value |
|----------|-------|
| 高度 | 48px |
| 背景 | var(--bg-secondary) |
| 圆角 | 8px |
| 底部间距 | 4px |
| 内边距 | 0 16px |
| 布局 | flex, align-items: center, justify-content: space-between |

**行内元素：**
- 操作名称：13px regular，color var(--text-primary)
- 按键标签：背景 var(--bg-input)，圆角 4px，内边距 4px 8px，12px medium，color var(--text-secondary)，font-family: monospace
- 修改按钮：icon-only SVG，14x14px
- 重置按钮：icon-only SVG，14x14px（仅在修改过时显示）

### 底部操作区

- "重置全部快捷键" 次要按钮（居中或靠右）
- 顶部 24px 间距，border-top 1px solid var(--border-color)

### 快捷键捕获对话框

**复用现有 `shortcutCaptureModal`（<dialog> 元素）：**
- 宽度：360px
- 背景：var(--bg-secondary)
- 标题："修改快捷键 - {操作名}"
- 捕获区域：居中，80x80px，背景 var(--bg-input)，圆角 12px
  - 等待状态：虚线边框，文字 "等待按键..."，颜色 var(--text-muted)
  - 捕获状态：实线边框（accent 色），显示按键组合
  - 冲突状态：边框变为 var(--destructive)，下方显示警告文字
- 底部按钮：取消（次要）+ 保存（主按钮，仅捕获后可点击）

---

## 关于页面契约

| Property | Value |
|----------|-------|
| 布局 | 居中对齐，max-width 400px，margin: 0 auto |
| 顶部间距 | 48px |

**内容：**
- 应用图标：64x64px（如有）或应用 logo
- 应用名称：18px semibold，color var(--text-primary)
- 版本号：13px regular，color var(--text-secondary)
- 分隔线：1px solid var(--border-color)，margin: 24px 0
- 简介：13px regular，color var(--text-muted)，居中

---

## 关键交互契约

### 页面切换

1. 点击侧边栏导航项
2. 移除所有导航项的 `.active` 类
3. 给被点击项添加 `.active` 类
4. 隐藏所有内容页面 div（`display: none`）
5. 显示对应内容页面 div（`display: block`）
6. 无过渡动画（保持实现简单）

### 规则拖拽排序

复用现有 `renderer.js` 中的 HTML5 拖拽实现：
- `dragstart`：添加 `.dragging` 类
- `dragover`：计算鼠标位置，添加 `.drag-over-top` 或 `.drag-over-bottom`
- `drop`：DOM 重排
- `dragend`：清除状态类，收集新顺序，调用 IPC 同步

### 快捷键捕获

1. 点击"修改"按钮
2. 打开 `shortcutCaptureModal`（<dialog>）
3. 捕获区显示"等待按键..."
4. 用户按键 → `acceleratorFromEvent()` 转换为 Electron accelerator
5. 检查冲突 → 如有，显示警告（允许强制覆盖）
6. 点击保存 → 调用 IPC 更新

### 设置自动保存

所有设置项绑定 `change` 事件 → 调用 `saveSettings(key, value)` → POST 到 `/api/settings/update` → Toast 反馈。

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
