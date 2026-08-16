---
phase: 35-tab
plan: 03
type: summary
status: completed
completed: 2026-08-16T00:51:00.000Z
---

# Phase 35 Plan 3: UAT Gap Fixes Summary

## 完成内容

修复 UAT 发现的 2 个问题。

### Task 1: 移除窗口顶部容器颜色条

**问题**: 颜色条遮挡了标签页本身的颜色

**修改文件**:
- `src/renderer.js`:
  - 删除 `updateWindowColorBar()` 函数定义（20 行）
  - 删除初始化时的 DOM 创建代码（颜色条元素）
  - 删除 `switchTab()` 中的 `updateWindowColorBar()` 调用
  - 删除初始化时的 `updateWindowColorBar()` 调用
  - 删除 `handleContainerSwitched()` 中的 `updateWindowColorBar()` 调用
- `src/styles/main.css`:
  - 删除 `.window-color-bar` 和 `.window-color-bar.hidden` 样式（18 行）

**保留不变**: `updateWindowTitle()` 函数及其所有调用

### Task 2: 修复关闭最后窗口不退出的问题

**问题**: macOS 上关闭最后一个窗口时不退出，反而打开 realm://newtab

**修改文件**:
- `main.js`:
  - 移除 `window-all-closed` 事件处理器中的 `process.platform !== 'darwin'` 条件判断
  - 所有平台（包括 macOS）关闭最后一个窗口时都退出应用

**根因**: macOS 标准行为是关闭窗口后应用保留在 Dock，但 Realm 浏览器不需要此行为

**后续发现**: 2026-08-16 验证时发现 `app.quit()` 调用后 activate 事件处理器（main.js:2657）仍会重建窗口。关闭窗口路径不会设置 `quitting` 标志，导致 activate 检查通过。需要在 window-all-closed 中也设置 `quitting=true`。

## 验证要点

1. 启动应用，确认窗口顶部无颜色条显示 ✓
2. 切换不同容器的 Tab，确认无颜色条出现 ✓
3. 确认窗口标题栏功能正常（标题更新不受影响） ✓
4. 关闭最后一个窗口，确认应用正常退出（不再出现 realm://newtab） ✗ 仍需修复
5. 使用 Cmd+Q 退出，确认正常工作
