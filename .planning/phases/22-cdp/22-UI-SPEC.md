---
phase: 22
slug: cdp
status: draft
shadcn_initialized: false
preset: none
created: 2026-08-02
---

# Phase 22 — UI Design Contract

> CDP 管理器扩展 + 基础网页操控工具的视觉和交互契约。
> 本阶段主要是基础设施（CDP-01）+ 3 个 AI 工具（CDP-02/03/04），
> 所有工具结果通过现有 AI 聊天工具卡片系统展示，无新增 UI 组件。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (vanilla JS) |
| Icon library | none (inline SVG + emoji) |
| Font | -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif |

来源：项目已有设计系统，无变更。

---

## Spacing Scale

沿用现有 CSS 变量，无新增间距值：

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 图标内边距、紧凑间距 |
| sm | 8px | 工具卡片内部元素间距 |
| md | 16px | 默认元素间距 |
| lg | 24px | 区域内边距 |
| xl | 32px | 布局间距 |
| 2xl | 48px | 主要分区间距 |
| 3xl | 64px | 页面级间距 |

Exceptions: 无

---

## Typography

沿用现有字体栈，无新增字体尺寸：

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 500 | 1.4 |
| Heading | 18px | 600 | 1.2 |
| Display | 24px | 600 | 1.2 |

来源：`main.css` 已有定义，本阶段无变更。

---

## Color

沿用现有 CSS 变量，无新增颜色：

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--bg-primary: #1a1a1a` | 主背景 |
| Secondary (30%) | `--bg-secondary: #2a2a2a` | 卡片、侧边栏、导航 |
| Accent (10%) | `--accent-color: #3B82F6` | 用户消息气泡、链接悬停、发送按钮 |
| Destructive | `--danger-color: #EF4444` | 错误状态图标、失败文案 |
| Success | `--success-color: #10B981` | 完成状态图标 |
| Tool card bg | `--ai-tool-card-bg: #252525` | 工具卡片背景 |

Accent reserved for: 用户消息气泡背景、链接悬停色、发送按钮图标、工具执行成功高亮。

来源：`main.css :root` 已有定义，本阶段无变更。

---

## Component Inventory

本阶段不新增 UI 组件。所有工具结果通过现有工具卡片系统展示。

### 现有组件复用

| Component | File | Usage in Phase 22 |
|-----------|------|-------------------|
| `.tool-card` | `src/renderer.js:3585-3676` | 3 个新工具的结果展示 |
| `.tool-card-header` | `src/renderer.js:3622-3626` | 状态图标 + 工具名 + 状态文字 |
| `.tool-card-content` | `src/renderer.js:3628-3665` | 可折叠的参数/结果区域 |
| `.tool-cards-container` | `src/renderer.js:3684-3704` | 多工具卡片纵向堆叠容器 |

### 工具卡片状态映射

| 状态 | 图标 | 图标 CSS 类 | 状态文字 |
|------|------|------------|----------|
| 执行中 | 旋转圆弧 SVG | `.tool-icon-spin` | `正在执行...` |
| 完成 | 勾选 SVG | `.tool-icon-success` | `完成` |
| 失败 | 叉号 SVG | `.tool-icon-error` | `失败` |

### 工具显示名称映射

| 工具 ID | 显示名称（tool-card-name） |
|---------|---------------------------|
| `read_page_content` | 读取页面内容 |
| `extract_links` | 提取页面链接 |
| `open_link` | 打开链接 |

实现位置：`src/renderer.js` 的 `renderToolCard()` 函数中，通过 `toolExecution.name` 显示。
工具名称应由主进程 `ai-manager.js` 的 `_buildRealmTools()` 中 `name` 字段定义，
渲染端无需额外映射 — 直接使用工具注册名。

---

## Copywriting Contract

### 工具状态文案

| Element | Copy |
|---------|------|
| 工具执行中 | `正在执行...` |
| 工具执行完成 | `完成` |
| 工具执行失败 | `失败` |
| 结果标签 | `结果` |
| 错误标签 | `错误` |
| 参数标签 | `参数` |

### 错误状态文案（CDP 特定）

| Error Scenario | Copy |
|----------------|------|
| DevTools 已打开 | `DevTools 已打开，请关闭后重试` |
| 页面未加载 | `当前标签页未加载页面，请先打开网页` |
| CDP 附加失败 | `无法连接到页面调试器，请刷新页面后重试` |
| 内容截断 | `[截断：原始大小 {X} bytes，已截断至 100KB]` |
| 链接打开失败 | `无法在容器中打开链接，请检查容器状态` |
| 容器不存在 | `指定容器不存在或已删除` |

### 空状态文案

| Scenario | Copy |
|----------|------|
| 无有效链接 | `未找到有效链接（仅保留 http/https 协议）` |
| 页面无内容 | `页面无可读内容，可能是纯应用页面或空白页` |

---

## Interaction Patterns

### 工具卡片交互

沿用现有 `renderToolCard` 交互，无新增交互：

| Action | Behavior |
|--------|----------|
| 点击工具卡片头部 | 展开/折叠参数和结果区域 |
| 工具执行中 | 头部显示旋转动画图标 + "正在执行..." |
| 工具执行完成 | 头部显示绿色勾号 + "完成"，可展开查看结果 |
| 工具执行失败 | 头部显示红色叉号 + "失败"，可展开查看错误信息 |

### 结果展示格式

所有工具结果通过 `JSON.stringify(result, null, 2)` 格式化为 monospace 预格式化文本，
显示在 `.tool-card-value` 区域。这与现有工具卡片行为一致，无需特殊处理。

#### read_page_content 结果结构

```json
{
  "title": "页面标题",
  "url": "https://example.com",
  "favicon": "https://example.com/favicon.ico",
  "meta": {
    "description": "页面描述",
    "keywords": "关键词1, 关键词2",
    "author": "作者"
  },
  "og": {
    "title": "Open Graph 标题",
    "description": "Open Graph 描述",
    "image": "https://example.com/og-image.jpg"
  },
  "properties": {
    "canonical": "https://example.com/canonical",
    "language": "zh-CN",
    "charset": "UTF-8"
  },
  "content": "页面正文内容...[截断：原始大小 150000 bytes，已截断至 100KB]"
}
```

#### extract_links 结果结构

```json
{
  "total": 42,
  "links": [
    { "url": "https://example.com/page1", "text": "链接文本1" },
    { "url": "https://example.com/page2", "text": "链接文本2" }
  ]
}
```

#### open_link 结果结构

```json
{
  "success": true,
  "tabId": "tab-xxx",
  "url": "https://example.com",
  "containerId": "work",
  "isNewTab": true
}
```

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | N/A | not applicable |
| (none) | — | — |

本阶段不使用任何组件注册表。项目为 vanilla JS + CSS 变量方案。

---

## Scope Boundaries

### In Scope

- 工具卡片中 3 个新工具的名称和状态文案
- CDP 特定错误状态的用户可见文案
- 工具结果的 JSON 展示格式约定

### Out of Scope

- 新增 UI 组件 — 本阶段无
- 新增 CSS 样式 — 现有工具卡片 CSS 已足够
- 工具结果的富文本渲染 — 当前使用 JSON 预格式化文本，后续阶段可优化
- CDP-01 基础设施 — 无直接 UI 产出

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
