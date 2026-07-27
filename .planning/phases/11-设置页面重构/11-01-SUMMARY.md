---
phase: 11-设置页面重构
plan: 01
subsystem: settings
tags: [settings, ui, sidebar, rules, shortcuts, refactor]
dependency_graph:
  requires: [main.js, shortcut-manager.js, assignment-rules.js]
  provides: [settings-page.js, settings.html]
  affects: [renderer.js, index.html]
tech_stack:
  added: []
  patterns: [sidebar-navigation, multi-page-layout, http-api-integration]
key_files:
  created: []
  modified:
    - main.js
    - src/settings.html
    - src/settings-page.js
    - src/styles/main.css
    - src/index.html
    - src/renderer.js
decisions:
  - "使用 HTTP API 替代 IPC 供设置页面 webview 访问数据"
  - "快捷键按功能分组展示（标签页操作、导航操作、收藏、其他）"
  - "规则导入导出使用 webview 内的 file input 而非系统对话框"
metrics:
  duration: ~15min
  completed: "2026-07-27T06:10:00Z"
status: complete
---

# Phase 11 Plan 01: 设置页面重构 Summary

## One-liner

将设置页面重构为带左侧边栏导航的多页面布局，将分配规则和快捷键设置从弹窗迁移到设置页面内。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 在 main.js 中添加 /api/rules/* 和 /api/shortcuts/* HTTP 路由 | 846f216 | main.js |
| 2 | 重构 settings.html 为侧边栏 + 多页面布局 | e7e0c7d | src/settings.html, src/index.html |
| 3 | 扩展 settings-page.js 支持页面切换、规则管理、快捷键设置 | 36b1903 | src/settings-page.js, src/renderer.js |
| 4 | 添加设置页面侧边栏和新组件的 CSS 样式 | 69ed0b5 | src/styles/main.css |

## What Was Built

### 1. HTTP API 路由（main.js）

添加了两个新的 HTTP API 处理函数：

- **handleRulesApi**: 处理 `/api/rules/*` 请求
  - `GET /api/rules/list` - 获取规则列表
  - `POST /api/rules/create` - 创建规则
  - `POST /api/rules/update` - 更新规则
  - `POST /api/rules/delete` - 删除规则
  - `POST /api/rules/reorder` - 重新排序规则
  - `GET /api/rules/export` - 导出规则
  - `POST /api/rules/import` - 导入规则

- **handleShortcutsApi**: 处理 `/api/shortcuts/*` 请求
  - `GET /api/shortcuts/list` - 获取快捷键列表
  - `POST /api/shortcuts/set` - 设置快捷键
  - `POST /api/shortcuts/reset` - 重置快捷键

所有路由都包含 token 鉴权，与现有设置 API 一致。

### 2. 设置页面重构（settings.html）

将 settings.html 从简单的线性布局重构为带左侧边栏导航的多页面布局：

- **左侧边栏**（220px 宽度）：
  - 通用（齿轮图标）
  - 分配规则（层级图标）
  - 快捷键设置（键盘图标）
  - 关于（信息图标）
  - 版本号（点击跳转关于页面）

- **右侧内容区域**：
  - `#settings-general` - 通用设置（迁移自原有设置）
  - `#settings-rules` - 分配规则页面
  - `#settings-shortcuts` - 快捷键设置页面
  - `#settings-about` - 关于页面

- **快捷键捕获对话框**：从 index.html 迁移到 settings.html

### 3. 设置页面逻辑（settings-page.js）

扩展了 settings-page.js，添加了完整的页面切换、规则管理和快捷键设置功能：

- **页面切换**：`switchSettingsPage(pageName)` 函数
- **规则管理**：
  - 规则列表渲染（支持拖拽排序）
  - 规则 CRUD 操作（使用 HTTP API）
  - 规则启用/禁用 toggle
  - 规则导入导出（使用 webview 内的 file input）
- **快捷键设置**：
  - 快捷键列表渲染（按功能分组）
  - 快捷键修改（按键捕获对话框）
  - 快捷键重置
  - 重置全部快捷键
- **URL 参数解析**：支持 `?tab=rules` 跳转到指定页面

### 4. CSS 样式（main.css）

添加了完整的样式支持：

- 侧边栏样式（220px 宽度、active 状态高亮条）
- 内容区域样式（flex:1、overflow-y:auto、max-width 680px）
- 分配规则页面样式（顶部操作栏、添加表单、规则列表）
- 快捷键设置页面样式（分组标题、快捷键项、底部操作栏）
- 关于页面样式（居中布局、应用图标、版本号）
- 快捷键捕获对话框样式（80x80 捕获区域）

### 5. 代码迁移（renderer.js）

从 renderer.js 中移除了旧的模态框代码：

- 移除规则管理相关函数（showRulesModal、refreshRulesList、renderRulesList、拖拽函数、createRule、importRules、exportRules）
- 移除快捷键设置相关函数（SHORTCUT_NAMES、showShortcutsModal、refreshShortcutsList、renderShortcutsList、捕获相关函数、resetShortcut）
- 移除旧模态框相关的 DOM 元素引用和事件处理器
- 更新 openSettingsTab 函数支持 tab 参数
- 更新 rulesBtn/shortcutsBtn 点击处理为跳转到设置页面对应区域

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **HTTP API 替代 IPC**：设置页面运行在 webview guest 中，不能直接调用 IPC（assertTrustedSender 会拒绝）。所有数据访问必须通过本地 HTTP 服务器的 /api/* 端点。

2. **快捷键分组展示**：将快捷键按功能分为四组（标签页操作、导航操作、收藏、其他），提升用户体验。

3. **规则导入导出**：设置页面在 webview 内，不能打开系统文件对话框。导入使用 webview 内的 `<input type="file">`，导出使用 Blob URL 触发下载。

## Known Stubs

None - all functionality is fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: token-auth | main.js | 所有 /api/* 路由验证 REALM_TOKEN，与现有设置 API 一致 |

## Self-Check

- [x] main.js 中 handleRulesApi 和 handleShortcutsApi 函数存在
- [x] realmServer 的 createServer 回调中有 /api/rules/ 和 /api/shortcuts/ 路由分发
- [x] settings.html 包含 .settings-sidebar 侧边栏
- [x] settings.html 包含 #settings-general / #settings-rules / #settings-shortcuts / #settings-about 四个内容区域
- [x] settings-page.js 包含 switchSettingsPage 函数
- [x] settings-page.js 包含完整的规则管理逻辑
- [x] settings-page.js 包含完整的快捷键设置逻辑
- [x] .settings-sidebar 样式存在
- [x] .sidebar-item 样式存在
- [x] .settings-content 样式存在

## Verification

1. 打开设置页面（CmdOrCtrl+,），左侧边栏显示"通用"、"分配规则"、"快捷键设置"、"关于"
2. 点击各侧边栏项，右侧内容区域正确切换
3. 通用页面：默认浏览器、历史保留天数、默认容器、启动行为设置正常保存
4. 分配规则页面：添加规则、删除规则、启用/禁用 toggle、拖拽排序、导入/导出功能正常
5. 快捷键设置页面：查看快捷键列表（按功能分组）、修改快捷键（按键捕获对话框）、重置快捷键、重置全部功能正常
6. 关于页面：显示应用名称、版本号、描述
7. 旧模态框已从主窗口移除，工具栏规则/快捷键按钮点击后跳转到设置页面对应区域
8. 工具栏"规则"按钮点击 → 打开设置页面并切换到"分配规则"页面
9. 工具栏"快捷键"按钮点击 → 打开设置页面并切换到"快捷键设置"页面
10. 数据同步：设置页面修改后，主窗口立即生效（快捷键重建）
