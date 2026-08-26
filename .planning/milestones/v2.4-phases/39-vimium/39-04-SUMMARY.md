---
phase: 39-vimium
plan: 04
status: complete
type: execute
gap_closure: true
completed: 2026-08-24T18:50:00Z
---

## Summary

修复 Phase 39 UAT 两个 major gap 的共享根因：Vimium 开关的「写入侧」与「读取侧」electron-store 文件/键路径错配。

## Root Cause

**写入侧（正确）：**
- 设置页开关 → POST /api/settings/update → main.js:988 `configStore.set('settings.vimium.enabled', value)`
- 落在 realm-config.json（main.js:50 `configStore = new Store({ name: 'realm-config' })`）

**读取侧（错误，已修复）：**
- shortcut-manager.js:34 `settingsStore = new Store({ name: 'settings' })`（独立 settings.json，磁盘上不存在）
- vimium-manager.js:21 `VIM_ENABLED_KEY = 'vimium.enabled'`（与写入键不匹配）

**结果：** `isVimEnabled` 恒为 false，所有 Vim 按键在 before-input-event 被静默丢弃（shortcut-manager.js:275）

## Changes

### 核心修复（关闭 G-39-1 和 G-39-2）

1. **shortcut-manager.js**
   - `settingsStore` 改读 `realm-config.json`（与 main.js:50 写入侧同一文件）
   - 启用 `watch: true` 支持运行时热更新
   - 新增 `hintModeActive` / `searchInputActive` 主进程同步标志
   - Hint Mode / 搜索输入激活期间跳过所有 Vim 命令处理

2. **src/vimium/vimium-manager.js**
   - `VIM_ENABLED_KEY` 改为 `'settings.vimium.enabled'`（与 main.js:988 写入键对齐）
   - 搜索导航阶段支持 `/` 重新打开搜索、`Escape` 退出搜索

### 稳定性改进

3. **src/renderer.js**
   - Tab 切换时退出 Vim 搜索模式和 Hint Mode（防状态泄漏）
   - Tab 关闭时清除主进程侧标志
   - 跨页导航（did-navigate）退出搜索/Hint Mode
   - SPA 跳转（did-navigate-in-page）退出 Hint Mode
   - `httpUrlToRealm` 保留业务参数（如 viewsource?url=）

4. **ipc-handlers.js**
   - 新增 `clipboard:write-text` IPC 通道（支持 yy/yf 复制功能）

5. **src/preload.js**
   - 暴露 `clipboardWriteText` API

6. **src/webview-preload.js**
   - 搜索模式和 Hint Mode 的 guest 端状态管理优化

7. **main.js**
   - webContents 销毁时清理 vimFocusStates 条目

## Verification

- G-39-1 (Hint Mode): Test 1 pass - 按 f 出现黄色 hint 标签，输入字母后跳转
- G-39-2 (搜索模式): Test 2 pass - 按 / 出现搜索栏，实时高亮，n/N 跳转

## Key Files

- `shortcut-manager.js` - 主进程 Vim 快捷键拦截
- `src/vimium/vimium-manager.js` - Vim 状态机和命令映射
- `src/renderer.js` - 渲染进程 Vim 命令处理
- `src/webview-preload.js` - Guest 端脚本注入
