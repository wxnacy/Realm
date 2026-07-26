---
phase: 10-Cookie管理增强
plan: 01
subsystem: cookie-management
tags: [cookie, ipc, preload, renderer, ui]
dependency_graph:
  requires: []
  provides: [cookie-management-enhanced]
  affects: [renderer.js, index.html, main.css]
tech_stack:
  added: []
  patterns: [ipc-bridge, context-bridge, dom-manipulation]
key_files:
  created: []
  modified:
    - cookie-manager.js
    - ipc-handlers.js
    - src/preload.js
    - src/renderer.js
    - src/index.html
    - src/styles/main.css
decisions:
  - 使用 Session/File 双来源查看 Cookie 数据
  - 使用客户端域名过滤（exact/subdomain/all）
  - 使用 25 条/页分页显示
  - Cookie name 字段设为只读避免技术复杂性
metrics:
  duration: ~15m
  completed: "2026-07-26T13:15:21Z"
  tasks_completed: 2
  tasks_total: 2
status: complete
---

# Phase 10 Plan 01: Cookie 管理增强 Summary

## One-liner

增强 Cookie 管理面板，支持多来源查看、域名过滤、手动保存、单条编辑删除和分页显示。

## What Was Built

### Task 1: 后端增强 — Cookie 管理函数 + IPC 通道 + Preload API

**新增函数（cookie-manager.js）：**
- `getSessionCookies(containerId)` - 从 Electron Session 实时读取 Cookie
- `getFileCookies(containerId)` - 从 cookies.json 文件读取持久化 Cookie
- `editCookie(containerId, cookieData)` - 编辑单个 Cookie（更新 Session + 同步文件）
- `deleteSingleCookie(containerId, cookieData)` - 删除单个 Cookie（Session + 文件同步）

**新增 IPC 通道（ipc-handlers.js）：**
- `cookie:get-session` → getSessionCookies
- `cookie:get-file` → getFileCookies
- `cookie:edit` → editCookie
- `cookie:delete-single` → deleteSingleCookie

**新增 Preload API（src/preload.js）：**
- `getSessionCookies(containerId)`
- `getFileCookies(containerId)`
- `editCookie(containerId, cookieData)`
- `deleteSingleCookie(containerId, cookieData)`

### Task 2: 前端 UI 增强 — Cookie 管理模态框重构

**HTML 结构更新（src/index.html）：**
- 添加 `.source-tabs` 容器（Session/File 标签页）
- 添加 `.domain-filter` 容器（域名过滤选项）
- 添加 `.cookie-list-header`（列标题：Name/Value/Domain/操作）
- 添加 `.pagination` 容器（分页控件）
- 添加 Cookie 编辑模态框（8 个表单字段）

**JavaScript 逻辑更新（src/renderer.js）：**
- 新增 `cookieState` 对象管理 Cookie 管理状态
- 实现 `handleSourceTabSwitch()` - 来源切换
- 实现 `handleDomainFilter()` - 域名过滤
- 实现 `handleEditCookie()` - 打开编辑模态框
- 实现 `handleSaveCookieEdit()` - 保存 Cookie 编辑
- 实现 `handleDeleteCookie()` - 删除 Cookie
- 实现 `handleSaveToFile()` - 保存到文件
- 实现 `renderPagination()` - 分页渲染
- 实现 `applyDomainFilter()` - 客户端域名过滤

**CSS 样式更新（src/styles/main.css）：**
- `.modal-xlarge` - 750px 宽度模态框
- `.source-tabs` / `.source-tab` - 来源标签页样式
- `.domain-filter` / `.filter-chip` - 域名过滤样式
- `.cookie-list-header` - 列标题样式
- `.cookie-col-*` - 列宽定义
- `.pagination` / `.page-btn` - 分页控件样式
- `.cookie-edit-modal` - 编辑模态框样式
- `.btn-sm` / `.btn-danger-icon` - 小按钮和危险按钮样式

## Verification Results

### 自动化验证
- ✅ 后端函数可调用（getSessionCookies, getFileCookies, editCookie, deleteSingleCookie）
- ✅ IPC 通道正确注册
- ✅ Preload API 正确暴露
- ✅ HTML 结构正确更新
- ✅ CSS 样式正确应用

### 手动验证建议
- 打开 Cookie 管理面板，验证来源标签页切换
- 验证域名过滤功能（exact/subdomain/all）
- 验证分页功能（25 条/页）
- 验证 Cookie 编辑功能
- 验证 Cookie 删除功能
- 验证保存到文件功能

## Decisions Made

1. **Session/File 双来源**：允许用户查看实时 Session Cookie 或持久化文件 Cookie
2. **客户端域名过滤**：在渲染进程实现过滤逻辑，无需 IPC 调用
3. **25 条/页分页**：平衡性能和用户体验
4. **Cookie name 只读**：避免修改 name 需要删除旧 Cookie + 创建新 Cookie 的技术复杂性
5. **编辑后同步文件**：确保重启后数据不丢失

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all planned features fully implemented.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-10-01 | cookie-manager.js | 编辑 Cookie 后同步更新 Session 和文件，避免数据不一致 |
| T-10-02 | cookie-manager.js | 删除 Cookie 后同步从 Session 和文件中移除，避免残留 |
| T-10-05 | src/renderer.js | Cookie 数据使用 textContent 插入 DOM，禁止 innerHTML |

## Self-Check: PASSED

- ✅ cookie-manager.js 包含 4 个新函数
- ✅ ipc-handlers.js 包含 4 个新 IPC 通道
- ✅ src/preload.js 包含 4 个新 API 方法
- ✅ src/renderer.js 包含增强的 Cookie 管理逻辑
- ✅ src/index.html 包含更新的 Cookie 管理模态框结构
- ✅ src/styles/main.css 包含新增的样式
- ✅ 所有代码遵循项目规范（camelCase, JSDoc, textContent）
- ✅ 安全要求满足（XSS 防护, IPC 验证）
