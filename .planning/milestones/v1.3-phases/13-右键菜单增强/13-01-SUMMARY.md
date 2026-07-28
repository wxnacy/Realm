---
phase: 13
plan: 01
subsystem: context-menu
tags: [context-menu, electron-menu, ipc, clipboard, native-menu]
dependency_graph:
  requires: []
  provides: [context-menu-manager.js, buildTabMenu, buildWebMenu, pushClosedTab, hasClosedTabs]
  affects: [main.js, src/renderer.js, src/preload.js]
tech_stack:
  added: []
  patterns: [Electron Menu API, ipcMain.on, clipboard.writeImage, nativeImage.createFromBuffer]
key_files:
  created:
    - context-menu-manager.js
  modified:
    - main.js
decisions:
  - "T-13-01 安全缓解：show-web-context-menu 中使用 activeWebviewContentsId 替代渲染进程传来的 guestContentsId"
  - "ipcMain.on 而非 ipcMain.handle：菜单请求是单向通知无需返回值"
  - "通用菜单模板抽取为 buildGeneralMenuItems() 内部函数，图片/链接菜单末尾追加复用"
  - "容器子菜单空列表时显示禁用项'无可用容器'而非空菜单"
metrics:
  duration: 20s
  completed: "2026-07-27T16:40:58Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
status: complete
---

# Phase 13 Plan 01: 右键菜单主进程基础设施 Summary

构建右键菜单系统的主进程基础设施，包含菜单模板构建、菜单项 click 动作处理和 IPC 监听器注册。

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | 新建 context-menu-manager.js | bebbf06 | context-menu-manager.js |
| 2 | 修改 main.js 注册 IPC 监听器 | 0aa582f | main.js |

## What Was Built

### context-menu-manager.js (新建)

右键菜单管理模块，包含：

- **buildTabMenu(tabInfo, mainWindow)** -- 构建标签页右键菜单（6 项 + 2 separator），包含关闭标签页、关闭其他/左侧/右侧标签页、重新打开已关闭标签页、固定/取消固定标签页
- **buildWebMenu(contextInfo, mainWindow)** -- 根据 type 参数生成三种网页菜单：
  - `image` -- 图片专属菜单（4 项）+ 通用菜单
  - `link` -- 链接专属菜单（4 项 + 容器子菜单）+ 通用菜单
  - `general` -- 仅通用菜单
- **buildGeneralMenuItems()** -- 内部函数，构建 13 个通用菜单项（4 导航 + 3 页面操作 + 2 开发者工具 + 4 文本编辑）
- **closedTabsStack** -- LIFO 已关闭标签栈（最多 10 条），导出 pushClosedTab/hasClosedTabs/popClosedTab
- **copyImageToClipboard()** -- 复制图片实现，支持 http/https URL 和 data: URL，使用 nativeImage.createFromBuffer + clipboard.writeImage
- **getGuestWebContents()** -- 辅助函数，安全获取 webview guest webContents

### main.js (修改)

- 顶部导入 context-menu-manager 模块
- 注册 3 个 IPC 监听器（使用 ipcMain.on，菜单请求为单向通知）：
  - `show-tab-context-menu` -- 获取 BrowserWindow，调用 buildTabMenu
  - `show-web-context-menu` -- 获取 BrowserWindow，注入 containers 列表和 activeWebviewContentsId，调用 buildWebMenu
  - `context-menu:closed-tab` -- 调用 pushClosedTab 保存关闭的标签信息

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all implementations are functional.

## Verification Results

- context-menu-manager.js 导出 buildTabMenu 和 buildWebMenu: PASS
- main.js 正确导入并注册 3 个 IPC 监听器: PASS
- 菜单模板包含 UI-SPEC.md 规定的所有菜单项和分隔线: PASS
- 禁用状态逻辑正确: PASS
- clipboard 操作使用 Electron clipboard API: PASS
- 复制图片使用 nativeImage.createFromBuffer: PASS

## Threat Flags

None -- no new security surface beyond plan's threat model mitigations.

## Self-Check: PASSED

- FOUND: context-menu-manager.js
- FOUND: main.js
- FOUND: SUMMARY.md
- FOUND: commit bebbf06 (Task 1)
- FOUND: commit 0aa582f (Task 2)
