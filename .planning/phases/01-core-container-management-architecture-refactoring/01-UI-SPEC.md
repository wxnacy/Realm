---
phase: 1
slug: 01-core-container-management-architecture-refactoring
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-23
---

# Phase 1 — UI Design Contract

> 视觉和交互契约，覆盖容器下拉面板、容器创建/编辑 Modal、容器删除确认弹窗。由 gsd-ui-researcher 生成，gsd-ui-checker 验证。

---

## Design System

| 属性 | 值 |
|------|-----|
| 工具 | none（纯 CSS + CSS 变量） |
| Preset | 不适用 |
| 组件库 | 无（原生 HTML + CSS + JS） |
| 图标库 | 内联 SVG（Feather 风格，已存在于 index.html） |
| 字体 | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

**设计系统状态：** 项目不使用 React/Vue/Next.js/Vite，shadcn 不适用。现有 CSS 变量系统（main.css :root）已定义完整的深色主题令牌。Phase 1 延续现有系统，不引入新工具。

---

## Spacing Scale

延续现有 CSS 变量系统，使用 4px 倍数：

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 图标与文字间距、紧凑内边距 |
| sm | 8px | 按钮内边距、列表项间距、工具栏 gap |
| md | 16px | 表单组间距、面板内边距、Modal 内边距 |
| lg | 24px | Modal 标题下方间距、面板标题区域 |
| xl | 32px | 图标按钮尺寸、输入框高度 |
| 2xl | 48px | 工具栏高度、Modal 最小高度 |
| 3xl | 64px | 未使用（预留） |

例外：容器颜色圆点 32x32px（颜色选择器）、10x10px（列表指示器）——语义组件尺寸，非间距例外。

---

## Typography

| 角色 | 尺寸 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| Body | 14px | 400 | 1.5 | 容器名称、表单输入、按钮文字 |
| Label | 12px | 400 | 1.4 | 辅助说明文字、状态文字、指示器文字 |
| Heading | 18px | 600 | 1.3 | Modal 标题、面板标题 |
| Display | 32px | 600 | 1.2 | 仅欢迎页大标题（Phase 1 不新增用途） |

**现有约定（main.css）：**
- `.container-name`: font-size 14px, font-weight 500
- `.modal-content h2`: font-size 18px, font-weight 600
- `.indicator-text`: font-size 12px

Phase 1 新增组件遵循以上角色分配。

---

## Color

现有 CSS 变量（main.css :root）定义的颜色系统：

| 角色 | 值 | 用途 |
|------|-----|------|
| Dominant (60%) | #1a1a1a (`--bg-primary`) | 主背景、浏览器视图背景 |
| Secondary (30%) | #2a2a2a (`--bg-secondary`) | 侧边栏、工具栏、Modal 背景、卡片 |
| Tertiary | #3a3a3a (`--bg-tertiary`) | 输入框背景、容器活跃态、滚动条 |
| Hover | #404040 (`--bg-hover`) | 悬停态背景 |
| Accent (10%) | #3B82F6 (`--accent-color`) | 主按钮、输入框聚焦边框、指示器圆点 |
| Accent Hover | #2563EB (`--accent-hover`) | 主按钮悬停态 |
| Destructive | #EF4444 (`--danger-color`) | 删除按钮、错误提示 |
| Success | #10B981 (`--success-color`) | 成功状态 |
| Border | #404040 (`--border-color`) | 边框、分隔线 |

**Accent 保留用途（仅以下元素使用蓝色 #3B82F6）：**
1. 主按钮（"创建"、"保存"）
2. 输入框聚焦边框
3. 容器指示器圆点（跟随当前容器颜色时除外）
4. 当前活跃容器的选中态

**容器预设色板（8 色）：**
- 蓝 #3B82F6、绿 #10B981、黄 #F59E0B、红 #EF4444
- 紫 #8B5CF6、粉 #EC4899、靛 #6366F1、橙 #F97316

---

## Copywriting Contract

| 元素 | 文案 |
|------|------|
| 主按钮 CTA | "创建容器"（新建）、"保存"（编辑） |
| 面板空状态标题 | 暂无容器 |
| 面板空状态正文 | 点击下方按钮创建第一个容器 |
| 错误状态 - 名称重复 | 容器名称已存在，请使用其他名称 |
| 错误状态 - 名称为空 | 请输入容器名称 |
| 删除确认标题 | 删除容器 |
| 删除确认正文 | 确定要删除「{容器名称}」吗？删除后该容器的 Cookie 和浏览数据将被清除。 |
| 删除确认按钮 | "删除"（红色主按钮）、"取消"（次要按钮） |
| 禁止删除提示 | 默认容器不可删除（tooltip，hover 时显示） |
| 面板标题 | 容器列表 |
| Modal 标题 - 新建 | 新建容器 |
| Modal 标题 - 编辑 | 编辑容器 |
| 颜色选择器标签 | 容器颜色 |
| 图标选择器标签 | 容器图标 |
| 名称输入占位符 | 例如：工作、个人、测试 |

---

## Component Inventory

Phase 1 新增/修改的 UI 组件：

### 1. 容器下拉面板（Popover）

**触发：** 工具栏 `.container-indicator` 按钮点击
**位置：** 从工具栏指示器下方弹出，固定宽度 280px
**关闭：** 点击面板外部区域、点击指示器按钮、按 Escape

**布局：**
```
┌──────────────────────────┐
│ 容器列表          [+]    │  ← 标题 + 新建按钮（右侧）
├──────────────────────────┤
│ 🔵 工作          [✎][✕] │  ← 活跃容器：高亮背景 + ✓
│ 🟢 个人                 │
│ 🔴 测试                 │
│ ...                      │
└──────────────────────────┘
```

**容器行：** 左侧颜色圆点(10px) + emoji 图标 + 容器名称，右侧编辑/删除图标按钮
**活跃容器：** 背景色 `--bg-tertiary`，右侧显示 ✓ 图标
**悬停态：** 背景色 `--bg-hover`
**新建按钮：** 右上角 "+" 图标按钮，点击打开新建 Modal

### 2. 容器创建/编辑 Modal

**触发：** 面板新建按钮 / 面板编辑按钮
**复用：** 同一 Modal，通过 mode 区分新建/编辑

**表单字段：**
1. **名称输入** — text input，必填，占位符 "例如：工作、个人、测试"
2. **颜色选择** — 8 个预设颜色圆点（32x32px），点击选中，选中态：白色边框 + 放大 1.1x
3. **图标选择** — 20 个预设 emoji（4x5 网格），点击选中，选中态：背景高亮 + 白色边框

**预设 emoji 列表（20 个）：**
🌐 💼 👤 🏦 🎮 📚 🛒 💰 🏠 📧 🔬 🎵 📱 ✈️ 🎨 🔧 📊 🏢 🎯 🌍

**按钮：** "取消"（次要）+"创建"/"保存"（主按钮）
**验证：** 名称为空 → 红色提示 "请输入容器名称"；名称重复 → 红色提示 "容器名称已存在，请使用其他名称"

### 3. 容器删除确认 Modal

**触发：** 面板删除按钮点击
**布局：** 显示容器颜色圆点 + emoji + 名称，提示文案，双按钮

**禁止删除：** 默认容器（id=default）的删除按钮置灰 + 禁用 + tooltip "默认容器不可删除"
**删除活跃容器：** 执行后自动切换到默认容器

---

## Interaction Flow

### 创建容器
1. 点击工具栏指示器 → 弹出下拉面板
2. 点击面板右上角 "+" → 打开新建 Modal
3. 输入名称、选择颜色、选择图标
4. 点击 "创建" → 验证 → 成功则关闭 Modal + 面板刷新列表 + 新容器高亮

### 编辑容器
1. 点击工具栏指示器 → 弹出下拉面板
2. 点击容器行的编辑图标 → 打开编辑 Modal（预填当前值）
3. 修改后点击 "保存" → 验证 → 成功则关闭 Modal + 面板刷新

### 删除容器
1. 点击工具栏指示器 → 弹出下拉面板
2. 点击容器行的删除图标 → 打开删除确认 Modal
3. 点击 "删除" → 关闭 Modal + 面板刷新 + 若删除的是活跃容器则切换到默认

### 切换容器
1. 点击工具栏指示器 → 弹出下拉面板
2. 点击目标容器行 → 关闭面板 → 工具栏指示器更新为新容器

---

## Registry Safety

| 注册表 | 使用的块 | 安全门 |
|--------|----------|--------|
| shadcn official | 不适用 | 不适用 |
| 第三方注册表 | 无 | 不适用 |

Phase 1 不使用任何组件注册表。所有组件为原生 HTML/CSS/JS 实现。

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Source Traceability

| 决策来源 | 使用的决策 |
|----------|-----------|
| CONTEXT.md | D-04（Popover 弹出层）、D-05（列表布局）、D-06（固定宽度 280px）、D-07（高亮当前容器）、D-08（统一 Modal）、D-09（预设色板）、D-10（预设 emoji）、D-11（基础验证）、D-12（删除确认弹窗）、D-13（禁止删除默认容器）、D-14（删除活跃容器切换） |
| main.css | 颜色变量、字体栈、间距约定、组件基础样式 |
| index.html | 现有 HTML 结构、SVG 图标风格、Modal 结构 |
| REQUIREMENTS.md | CONT-01 至 CONT-06 需求映射 |
