---
phase: 29-
reviewed: 2026-08-08T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/settings-page.js
  - src/settings.html
  - src/styles/main.css
  - src/renderer.js
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 29-: Code Review Report

**Reviewed:** 2026-08-08T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 29 adds a multimedia settings page (Plan 01: HTML/JS/CSS) and backend integration for feature toggle and whitelist filtering (Plan 02: main.js, media-sniffer.js, renderer.js). The settings page implementation follows existing devMode patterns correctly -- XSS prevention via textContent, domain validation, settingsApi persistence. However, a critical bug exists in the renderer's media list clearing logic: it calls `clearMediaList()` without a webContentsId argument, which is a no-op because the underlying IPC handler requires a specific ID. The media list is never actually cleared when the toggle is turned off, violating the D-12 requirement.

## Critical Issues

### CR-01: toggle 关闭时媒体列表未被清空（clearMediaList 无参调用是空操作）

**File:** `src/renderer.js:5181`
**Issue:** `updateMediaPlayerVisibility(false)` 调用 `window.mediaAPI.clearMediaList()` 时未传入 webContentsId 参数。`media:clear-list` IPC 处理器接收 `undefined` 后调用 `mediaSniffer.clearMediaList(undefined)`，而 `clearMediaList(webContentsId)` 内部执行 `this.mediaMap.delete(undefined)`——这是一个无操作（Map 中不存在 key 为 `undefined` 的条目）。结果：用户关闭多媒体开关后，媒体面板仍显示之前嗅探到的媒体列表。

Plan 02 在 media-sniffer.js 中新增了 `clearAll()` 方法用于清空所有容器的媒体数据，但该方法未通过 IPC 暴露给渲染进程。`media:clear-all` IPC 通道在 preload.js 和 ipc-handlers.js 中均不存在。

**Fix:**

方案 A（推荐）：新增 `media:clear-all` IPC 通道：

在 `ipc-handlers.js` 中添加：
```javascript
ipcMain.handle('media:clear-all', () => {
  mediaSniffer.clearAll();
});
```

在 `preload.js` 中添加：
```javascript
clearAllMedia: () => ipcRenderer.invoke('media:clear-all'),
```

在 `src/renderer.js:5181` 中将：
```javascript
window.mediaAPI.clearMediaList();
```
改为：
```javascript
window.mediaAPI.clearAllMedia();
```

方案 B（最小改动）：修改 `ipc-handlers.js` 的 `media:clear-list` 处理器，当 webContentsId 为 undefined 时调用 `clearAll()`：
```javascript
ipcMain.handle('media:clear-list', (event, webContentsId) => {
  if (webContentsId === undefined) {
    mediaSniffer.clearAll();
  } else {
    mediaSniffer.clearMediaList(webContentsId);
  }
});
```

## Warnings

### WR-01: switchSettingsPage 从 devmode 切换到 multimedia/ai-assistant 时队列轮询未停止

**File:** `src/settings-page.js:219-234`
**Issue:** `switchSettingsPage` 的 `else if` 链中，`stopQueueStatusPolling()` 仅在 `else` 分支（即页面名不匹配任何已知分支时）被调用。当用户从 devmode 页面直接切换到 multimedia 或 ai-assistant 时，命中的是对应页面的 `else if` 分支而非 `else` 分支，导致队列状态轮询定时器持续运行（每 2 秒请求一次 `devqueue-stats`）。这是一个 pre-existing 问题，但 Phase 29 新增的 `multimedia` 分支扩大了触发面。

**Fix:** 在 switchSettingsPage 开头无条件停止轮询：
```javascript
function switchSettingsPage(pageName) {
  stopQueueStatusPolling(); // 无条件停止，devmode 分支会重新启动

  document.querySelectorAll('.settings-section').forEach(section => {
    section.style.display = 'none';
  });
  // ... 其余逻辑不变
```

### WR-02: saveMediaPlayerEnabled 失败时 UI 与后端状态不一致

**File:** `src/settings-page.js:1466-1480`
**Issue:** `saveMediaPlayerEnabled` 在 API 调用失败时不恢复 toggle 的视觉状态。`updateMediaPlayerUI(enabled)` 在 try 块中被调用（第 1474 行），而 catch 块仅显示 toast 但不回退 UI。对比 `saveDevModeEnabled`（第 1229-1231 行），后者在 catch 中恢复了 toggle 状态。结果：API 失败时 toggle 显示新状态，但 electron-store 中仍是旧状态。

**Fix:** 在 catch 块中添加 UI 回退：
```javascript
} catch (error) {
  console.error('[Realm] 保存多媒体播放器开关失败:', error);
  showToast('保存失败，请重试');
  // 恢复 toggle 状态
  updateMediaPlayerUI(!enabled);
}
```

### WR-03: updateMediaPlayerVisibility 中 clearMediaList 调用无错误处理

**File:** `src/renderer.js:5181`
**Issue:** `window.mediaAPI.clearMediaList()` 是一个返回 Promise 的异步 IPC 调用，但此处未使用 await，也未附加 .catch() 处理。如果 IPC 调用失败（例如主进程尚未初始化 mediaSniffer），会产生未处理的 Promise rejection。虽然此问题与 CR-01 重叠（修复 CR-01 后此处代码会被替换），但如果选择方案 B 修复 CR-01，此处仍需添加错误处理。

**Fix:** 修复 CR-01 后此问题自然消除。若保留当前调用方式：
```javascript
window.mediaAPI.clearMediaList().catch(err => {
  console.warn('[Realm Renderer] 清空媒体列表失败:', err.message);
});
```

## Info

### IN-01: switchSettingsPage JSDoc 注释未更新

**File:** `src/settings-page.js:197`
**Issue:** `switchSettingsPage` 的 JSDoc `@param` 描述仍为旧值 `'general、rules、shortcuts、about'`，未包含 `'devmode'`、``'ai-assistant'`、`'multimedia'`。

**Fix:**
```javascript
/**
 * 切换设置页面
 * @param {string} pageName - 页面名称（general、rules、shortcuts、devmode、ai-assistant、multimedia、about）
 */
```

---

_Reviewed: 2026-08-08T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
