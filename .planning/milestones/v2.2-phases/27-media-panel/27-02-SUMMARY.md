---
phase: 27-media-panel
plan: 02
type: summary
executed_by: gsd-execute-phase --gaps-only
date: 2026-08-07
---

# Phase 27 Gap Closure — 27-02-SUMMARY

## 执行的 Gap

| Gap ID | 问题 | 根因 | 修复文件 |
|--------|------|------|----------|
| G-27-1a | 媒体按钮 active 样式缺失 | `.media-panel-btn` 无 `#mediaPanelBtn.active` 变体 | `src/styles/main.css` |
| G-27-1b | 点击 webview 内网页不关闭面板 | guest 点击不冒泡到宿主 document | `src/webview-preload.js`, `src/renderer.js` |
| G-27-2 | 面板空态（读/推容器键不一致） | `loadMediaList` 无参回退 stale `windowContainerMap`；`notifyRenderer` 按 stale map 过滤 | `src/renderer.js`, `media-sniffer.js` |

## 修改摘要

### Task 1 — 按钮 active 样式（G-27-1a）
- `src/styles/main.css`: 新增 `#mediaPanelBtn.active` 规则（`color: var(--accent-color); background-color: var(--bg-hover);`），镜像 `#aiPanelBtn.active`（main.css:4766-4769）。

### Task 2 — 读/推容器键对齐（G-27-2）
- `src/renderer.js` `loadMediaList`: `window.mediaAPI.getMediaList()` → `window.mediaAPI.getMediaList(state.currentContainer)`，显式传当前容器 ID。
- `src/renderer.js` `onMediaListUpdate`: 加 `data.containerId !== state.currentContainer` 守卫，忽略非当前容器推送。
- `media-sniffer.js` `notifyRenderer`: 删除 `windowManager.getCurrentContainer` 过滤，广播所有非销毁窗口；删除局部 `require('./window-manager')`。

### Task 3 — guest 点击关闭面板（G-27-1b）
- `src/webview-preload.js`: `contextBridge` 块之后追加 `window.addEventListener('mousedown', ..., true)`（捕获阶段），`sendToHost('media:outside-click')`。
- `src/renderer.js` ipc-message 监听器: 追加 `else if (e.channel === 'media:outside-click')` 分支，`state.mediaPanelOpen` 时 `toggleMediaPanel()`。
- 宿主 document 既有 `click` 监听（renderer.js:3785-3791）保留，负责工具栏/标签栏 chrome 区域点击关闭。

## 验证结果

| 检查项 | 结果 |
|--------|------|
| `#mediaPanelBtn.active` 规则含 accent-color + bg-hover | PASS |
| `node --check src/renderer.js` | PASS |
| `node --check media-sniffer.js` | PASS |
| `node --check src/webview-preload.js` | PASS |
| `loadMediaList` 显式传 `state.currentContainer` | PASS |
| 渲染端 `onMediaListUpdate` 按 `containerId` 过滤 | PASS |
| `media-sniffer.js` 无 `winContainerId` 引用 | PASS |
| `webview-preload.js` 有 `sendToHost('media:outside-click')` | PASS |
| `renderer.js` 有 `media:outside-click` handler | PASS |
| `webview-preload.js` 无 Node 全局/路径模块引用 | PASS |

## 待人工验证

Task 4 (UAT 复测) 为 `checkpoint:human-verify` 门控，需按 27-UAT.md 五项全量重跑：
1. 打开/关闭交互（按钮高亮、网页点击关面板、面板内点击不误关）
2. 列表渲染（非 default 容器显示真实媒体列表）
3. 播放（新标签页打开）
4. 复制（URL 进剪贴板）
5. 实时徽标+容器切换（实时推送、容器切换重置）
