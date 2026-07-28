# Phase 15: 收藏夹文件夹 - UI 交互 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 15-收藏夹文件夹 - UI 交互
**Areas discussed:** 页面布局结构, 文件夹树交互细节, 右键菜单具体行为, 新建文件夹入口

---

## 页面布局结构 — 文件夹树和列表布局

| Option | Description | Selected |
|--------|-------------|----------|
| 固定宽度左侧面板（200-240px） | 类似 Finder 的侧边栏，固定宽度，不可拖拽调整 | ✓ |
| 可折叠左侧面板 | 默认显示，可通过按钮折叠隐藏 | |
| You decide | 由 Claude 选择 | |

**User's choice:** 固定宽度左侧面板（200-240px）

## 页面布局结构 — 搜索栏位置

| Option | Description | Selected |
|--------|-------------|----------|
| 搜索栏在顶部全宽 | 搜索栏横跨左右两栏顶部，文件夹树和列表共享搜索 | ✓ |
| 搜索栏在右侧列表区 | 搜索栏只在右侧列表区域 | |
| You decide | 由 Claude 选择 | |

**User's choice:** 搜索栏在顶部全宽

## 页面布局结构 — 面包屑位置

| Option | Description | Selected |
|--------|-------------|----------|
| 右侧内容区顶部（同 Chrome） | 面包屑在搜索栏和列表之间，横跨右侧内容区顶部 | ✓ |
| 页面顶部全宽 | 面包屑在搜索栏下方，横跨整个页面 | |
| You decide | 由 Claude 选择 | |

**User's choice:** 右侧内容区顶部（同 Chrome）
**Notes:** 用户问了 Chrome 的布局方式后确认选择

---

## 文件夹树交互细节 — 新建文件夹入口

| Option | Description | Selected |
|--------|-------------|----------|
| 左侧面板标题栏 + 按钮 | 和容器面板的 + 按钮模式一致 | ✓ |
| 左侧面板底部按钮 | 类似 Finder 侧边栏底部 | |
| You decide | 由 Claude 选择 | |

**User's choice:** 左侧面板标题栏 + 按钮

## 文件夹树交互细节 — 点击行为

| Option | Description | Selected |
|--------|-------------|----------|
| 点击 = 展开 + 导航 | 类似 Finder 侧边栏，一步完成 | ✓ |
| 箭头展开，名称导航 | 两步操作，更精确但多一次点击 | |
| You decide | 由 Claude 选择 | |

**User's choice:** 点击 = 展开 + 导航

## 文件夹树交互细节 — 根节点

| Option | Description | Selected |
|--------|-------------|----------|
| 有根节点（所有书签） | 树顶部固定根节点，点击显示全部收藏 | ✓ |
| 无根节点，直接列文件夹 | 用户点击文件夹进入 | |
| You decide | 由 Claude 选择 | |

**User's choice:** 有根节点（所有书签）

## 文件夹树交互细节 — 数量徽标

| Option | Description | Selected |
|--------|-------------|----------|
| 显示数量徽标 | 每个文件夹名右侧显示收藏项数量（如"开发 (12)"） | ✓ |
| 不显示数量，仅图标 | 保持简洁 | |
| You decide | 由 Claude 选择 | |

**User's choice:** 显示数量徽标

---

## 右键菜单具体行为 — 实现方式

| Option | Description | Selected |
|--------|-------------|----------|
| Electron 原生菜单 | 与现有网页右键菜单一致 | ✓ |
| HTML 自定义菜单 | 在 webview guest 中用 HTML/CSS 实现 | |
| You decide | 由 Claude 选择 | |

**User's choice:** Electron 原生菜单

## 右键菜单具体行为 — 菜单项范围

| Option | Description | Selected |
|--------|-------------|----------|
| 精简版（核心功能） | 打开、新标签页、编辑、删除、移动到... | |
| 完整版（FOLDER-08 全部） | 包括剪切/复制/粘贴、属性、新窗口打开等 | ✓ |
| You decide | 由 Claude 选择 | |

**User's choice:** 完整版（FOLDER-08 全部）

## 右键菜单具体行为 — 剪切/复制/粘贴

| Option | Description | Selected |
|--------|-------------|----------|
| 内部状态剪贴板 | 应用内部状态存储，不依赖系统剪贴板 | ✓ |
| 延后到 Phase 16 | Phase 15 不实现，放到增强功能 | |
| You decide | 由 Claude 选择 | |

**User's choice:** 内部状态剪贴板
**Notes:** 用户问了 Claude 推荐，Claude 推荐内部状态剪贴板（Finder/VS Code/Chrome 标准做法）

---

## Claude's Discretion

- 文件夹树展开/收起动画（CSS transition）
- 空文件夹显示行为
- 右键菜单快捷键绑定

## Deferred Ideas

None — discussion stayed within phase scope
