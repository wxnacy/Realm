---
phase: 31-download-manager-ui
reviewed: 2026-08-13T10:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - download-manager.js
  - ipc-handlers.js
  - main.js
  - src/index.html
  - src/styles/main.css
  - src/renderer.js
  - src/preload.js
  - src/downloads.html
  - src/downloads-page.js
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-08-13T10:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 31 实现了完整的下载管理器 UI，包括下载面板（renderer.js 内嵌）、独立下载页面（realm://downloads）、以及对应的 IPC 通道和 HTTP API。代码结构清晰，安全措施（REALM_TOKEN 鉴权、deleteDownload 路径遍历防护）已到位。

CR-01（缺失 HTTP API 路由）和 CR-02（响应格式不匹配）已在 plan 31-03 中修复。以下为当前代码库中仍存在的问题。

## Warnings

### WR-01: open/show-in-folder 路由缺少路径验证

**File:** `main.js:1298-1310`

`/api/downloads/open` 和 `/api/downloads/show-in-folder` 路由直接使用请求体中的 `filePath`，未验证路径是否在用户下载目录内。

`deleteDownload`（`download-manager.js:608-612`）有路径遍历防护：
```javascript
const downloadsDir = app.getPath('downloads');
const resolvedPath = path.resolve(record.save_path);
if (!resolvedPath.startsWith(downloadsDir)) {
  console.warn(`[Realm] 拒绝删除下载目录外的文件: ${resolvedPath}`);
}
```

但 `openFile` 和 `showInFolder` 没有类似检查。虽然 REALM_TOKEN 提供了 CSRF 防护，但拥有 token 的恶意脚本可以打开系统上的任意文件。

**Fix:** 在 main.js 路由中添加路径白名单验证，或在 download-manager.js 的 openFile/showInFolder 中复用 deleteDownload 的路径检查逻辑。

---

### WR-02: 删除流程先取消后弹窗（逻辑顺序问题）

**File:** `src/downloads-page.js:336-339`

```javascript
if (pendingDeleteDownload.isInProgress) {
  await apiAction(`/api/downloads/cancel`, { downloadId: target.dataset.id });
}
const modal = document.getElementById('downloadsDeleteModal');
if (modal) modal.showModal();
```

用户点击删除按钮时，如果下载正在进行中，代码先调用 cancel 取消下载，然后才弹出确认对话框。如果用户在对话框中点击"取消"，下载已经被取消但记录未删除，造成状态不一致。

**Fix:** 将取消操作移到确认对话框的"删除"按钮点击后执行，与 `executeDeleteDownload` 合并。

---

### WR-03: bindItemActions 重复绑定事件监听器

**File:** `src/downloads-page.js:297-298`

`bindItemActions(listEl)` 在每次 `renderDownloads(downloads, reset=true)` 时调用（第 198 行），使用 `addEventListener` 而非替换式绑定。每次重置列表都会添加一个新的 click 监听器，导致事件处理函数累积。搜索频繁触发时（300ms 防抖），监听器数量会快速增长。

**Fix:** 将 `bindItemActions` 移到 `init()` 中只绑定一次，或在绑定前检查是否已绑定。

---

### WR-04: search 参数被发送但后端未处理

**File:** `src/downloads-page.js:147-149`, `main.js:1256-1261`

前端发送 `search` 参数：
```javascript
if (currentSearch) {
  url += `&search=${encodeURIComponent(currentSearch)}`;
}
```

但后端 list 路由不读取该参数，`getAllDownloads` 也没有搜索过滤逻辑。搜索功能实际上不工作。

**Fix:** 在 `getAllDownloads` 中添加 `filename LIKE ?` 过滤，或在 main.js 路由中读取 search 参数并传递。

---

## Info

### IN-01: IPC 与 HTTP API 响应格式不一致

**File:** `ipc-handlers.js:949`

IPC 通道 `download:list-all` 直接返回裸数组，而 HTTP API `/api/downloads/list` 返回 `{success: true, downloads: [...]}`。两个消费者各自适配了不同格式，但不一致性增加了维护成本。

---

### IN-02: formatFileSize 重复实现且逻辑略有差异

**Files:** `download-manager.js:158-163`, `src/downloads-page.js:425-431`

`formatFileSize` 在主进程和渲染进程各有一份实现，单位数组不同（主进程 4 个 vs 渲染进程 5 个含 TB）。建议抽取为共享模块。

---

### IN-03: formatRelativeTime 时间戳单位可能不匹配

**File:** `src/downloads-page.js:438-449`

`formatRelativeTime` 将输入当作秒级时间戳（`Date.now() / 1000`），但数据库 `created_at` 使用毫秒级默认值（`strftime('%s', 'now') * 1000`）。如果 `start_time` 也是毫秒级，显示的时间会偏差 1000 倍。需确认单位一致性。

---

_Reviewed: 2026-08-13T10:00:00Z_
_Reviewer: Claude (inline review)_
_Depth: standard_
