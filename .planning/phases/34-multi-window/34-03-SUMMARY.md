---
phase: 34-multi-window
plan: 03
subsystem: main-process
tags: [electron, multi-window, dock-menu, activate, broadcast, shortcuts]
dependency:
  requires:
    - phase: 34-multi-window
      provides: "window-manager.js isManagedWindow() + broadcast() API (Plan 01)"
    - phase: 34-multi-window
      provides: "ipc-handlers.js assertTrustedSender 泛化 (Plan 02)"
  provides:
    - "Dock 菜单新建窗口入口"
    - "activate 事件 hasVisibleWindows 处理"
    - "Application Menu 新建/关闭窗口菜单项"
    - "before-quit 退出提示广播到所有窗口"
  affects: [main.js]
tech_stack:
  added: []
  patterns: ["macOS Dock 菜单模式", "activate hasVisibleWindows 模式", "广播替代单发"]
key_files:
  modified:
    - main.js
  created: []
decisions:
  - "Dock 菜单 click 回调与 Cmd+N 共用同一逻辑（D-03）"
  - "activate 事件使用 hasVisibleWindows 参数区分恢复/创建场景（Pitfall MW-7）"
  - "before-quit show-quit-hint 通过 broadcast 发送到所有窗口（Pitfall MW-6）"
  - "开发者菜单 DevTools 切换改为动态获取 getMainWindow()，不依赖闭包变量"
metrics:
  duration: 5min
  completed: "2026-08-16"
  total_tasks: 2
  completed_tasks: 2
status: complete
---

# Phase 34 Plan 03: Dock 菜单 + activate 事件重构 + 广播替换

**在 main.js 中实现 Dock 菜单新建窗口、重构 activate 事件处理、替换单窗口广播为多窗口广播。**

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Dock 菜单 + activate 事件重构 + registerShortcuts 适配 | - | main.js |
| 2 | 替换 main.js 中单窗口广播为多窗口广播 | - | main.js |

## Changes Made

### Task 1: Dock 菜单 + activate 事件重构

1. **Dock 菜单** — 添加 `app.dock.setMenu(dockMenu)` 包含"新建窗口"菜单项
2. **Application Menu** — "窗口"子菜单新增"新建窗口 ⌘N"和"关闭窗口 ⇧⌘W"
3. **activate 事件** — 添加 `hasVisibleWindows` 参数，处理最小化窗口恢复（Pitfall MW-7）
4. **开发者菜单** — DevTools 切换改为动态 `getMainWindow()` 调用

### Task 2: 广播替换

1. **show-quit-hint** — `getMainWindow().webContents.send()` → `windowManager.broadcast()`
2. **getMainWindow 调用** — 从约 10 处减少到 3 处（仅保留需要窗口实例引用的场景）

## Key Design Decisions

| 决策 | 说明 |
|------|------|
| Dock 菜单与 Cmd+N 共用逻辑 | D-03: 避免重复代码 |
| hasVisibleWindows 判断 | Pitfall MW-7: 区分恢复最小化窗口 vs 创建新窗口 |
| broadcast 替代单发 | Pitfall MW-6: 非主窗口按 Cmd+Q 也能看到退出提示 |
| 动态 getMainWindow | 开发者菜单不依赖闭包变量，多窗口后主窗口可能已关闭 |

## Verification

自动化验证：
- `grep -c 'dock.setMenu' main.js` → 1 ✅
- `grep -c 'hasVisibleWindows' main.js` → 4 ✅
- `grep -c 'broadcast.*show-quit-hint' main.js` → 1 ✅
- `grep -c 'registerShortcuts()' main.js` → 2 ✅
- `getMainWindow` 调用数: 3 ≤ 5 ✅

## Human Verification Required

按以下步骤手动验证：

1. **MW-01 — Dock 右击新建窗口**：Dock 右击 → 选择"新建窗口" → 确认新窗口出现
2. **MW-07 — 新窗口使用默认容器**：新窗口的容器选择器显示 "default"
3. **MW-08 — Cmd+N 新建窗口**：按 Cmd+N → 确认新窗口出现
4. **MW-09 — Cmd+Shift+W 关闭窗口**：在多窗口下按 Cmd+Shift+W → 确认当前窗口关闭
5. **MW-10 — 窗口间焦点切换**：创建 2 个窗口 → 点击不同窗口 → 确认工具栏和 Tab 栏正确更新
6. **退出提示广播**：在非主窗口按 Cmd+Q → 确认退出提示在当前窗口显示
7. **最小化恢复**：所有窗口最小化后点击 Dock 图标 → 确认窗口恢复

## Self-Check

- [x] main.js 包含 `app.dock.setMenu(dockMenu)` 调用
- [x] Dock 菜单包含标签为'新建窗口'的菜单项
- [x] Dock 菜单 click 回调调用 `windowManager.createMainWindow('default', defaultContainer)`
- [x] activate 事件处理函数包含 `hasVisibleWindows` 参数
- [x] activate 中 `!hasVisibleWindows` 分支处理最小化窗口恢复
- [x] before-quit 中 `show-quit-hint` 通过 `windowManager.broadcast('show-quit-hint')` 发送
- [x] registerShortcuts 调用改为无参版本
- [x] Application Menu"窗口"子菜单包含"新建窗口"和"关闭窗口"菜单项
- [x] 开发者菜单 DevTools 切换使用动态 `getMainWindow()`

---
*Phase: 34-multi-window*
*Completed: 2026-08-16*
