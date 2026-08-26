---
phase: 36-tab
type: verification
status: passed
created: 2026-08-15
verifier: claude-opus-4.7
---

# Phase 36 验证报告: Tab 拖拽排序与跨窗口移动

## 需求追溯矩阵

| 需求 ID | 描述 | 覆盖 Plan | 状态 |
|---------|------|-----------|------|
| MW-02 | 拖拽 Tab 出标签栏创建新窗口 | 36-03 | PASS |
| MW-03 | 跨窗口 Tab 拖拽移动 + 源窗口自动销毁 | 36-03 | PASS |
| MW-04 | 窗口内 Tab 拖拽排序 + 插入指示器 | 36-02 | PASS |
| MW-11 | 窗口位置/大小重启后恢复 (electron-store) | 36-01 | PASS |
| MW-13 | 右键菜单"在新窗口中打开" | 36-01 | PASS |

所有 5 个需求 ID 均已覆盖，无遗漏。

---

## Plan 01: 窗口位置持久化 + 右键菜单

**commit:** `76f78cf` (feat), `559c4f9` (feat)

### must_haves.truths 逐项验证

| # | 必须满足项 | 状态 | 证据 |
|---|-----------|------|------|
| 1 | 窗口位置和大小在应用重启后正确恢复 | PASS | `window-manager.js:43` windowBoundsStore (electron-store), `window-manager.js:79` restoreWindowBounds(), `window-manager.js:134-170` createMainWindow() 调用恢复逻辑 |
| 2 | 越界窗口自动居中到主显示器 | PASS | `window-manager.js:86-108` 越界检测: 检查窗口中心点是否在任何显示器范围, 越界时居中到 screen.getPrimaryDisplay() |
| 3 | 多窗口位置独立保存和恢复 | PASS | key 格式 `container-${containerId}` 独立存储; `main.js:2486` setupWindowBoundsTracking() 为每个窗口注册 moved/resized 监听 |
| 4 | 右键菜单包含"在新窗口中打开"选项 | PASS | `context-menu-manager.js:439-446` buildTabMenu() 中新增菜单项, 发送 context-menu:open-in-new-window 事件 |
| 5 | 点击"在新窗口中打开"后在新窗口打开该 Tab | PASS | `ipc-handlers.js:422` tab:open-in-new-window handler; `src/preload.js:186` openTabInNewWindow API; `src/renderer.js:2052` 处理回调 |

### must_haves.artifacts 逐项验证

| 制品 | 状态 | 证据 |
|------|------|------|
| window-manager.js (windowBoundsStore, saveWindowBounds, restoreWindowBounds) | PASS | `window-manager.js:43,51,79` — 三个要素均存在 |
| context-menu-manager.js ("在新窗口中打开"菜单项) | PASS | `context-menu-manager.js:439-446` — 菜单项已添加 |
| src/preload.js (openTabInNewWindow API) | PASS | `src/preload.js:186` — API 已暴露 |
| main.js (tab:open-in-new-window IPC 通道) | PASS | `ipc-handlers.js:422` — handler 已注册 |

### 关键设计决策验证

| 决策 | 状态 | 说明 |
|------|------|------|
| 越界检测使用窗口中心点 | PASS | `window-manager.js:87-88` centerX/centerY 计算正确 |
| moved/resized 事件 200ms throttle | PASS | `main.js:2486` setupWindowBoundsTracking 使用 throttle |
| before-quit 保存所有窗口 | PASS | `main.js:2712` app.on('before-quit') 遍历保存 |
| tab:open-in-new-window 支持 move 参数 | PASS | `ipc-handlers.js:449` options.move 判断 |

---

## Plan 02: 窗口内 Tab 拖拽排序

**commit:** `6d72adc` (feat), `4d7344e` (refactor)

### must_haves.truths 逐项验证

| # | 必须满足项 | 状态 | 证据 |
|---|-----------|------|------|
| 1 | Tab 可以通过拖拽改变顺序 | PASS | `src/renderer.js:575` dragstart 事件; `src/renderer.js:7973` dragover 计算插入位置; `src/renderer.js:8050+` drop 处理排序 |
| 2 | 拖拽时显示 Chrome 风格的垂直插入指示器 | PASS | `src/renderer.js:7961` tabDragIndicator DOM 元素; `src/styles/main.css:1526` 2px 宽度, accent-color, glow shadow |
| 3 | 松手后 Tab 顺序立即更新 | PASS | drop 事件中更新 state.tabs 并调用 tab:dnd-reorder IPC; `main.js:2352` handler 同步主进程 |
| 4 | 切换到其他窗口再切回，Tab 顺序保持不变 | PASS | 顺序同步到主进程 tabManager.reorderTabs(), 重启后从主进程恢复 |

### must_haves.artifacts 逐项验证

| 制品 | 状态 | 证据 |
|------|------|------|
| src/renderer.js (Tab 拖拽排序逻辑) | PASS | dragstart/dragover/drop/dragend 事件 + 指示器管理 |
| src/styles/main.css (拖拽指示器样式) | PASS | `main.css:1517-1537` .tab.dragging, .tab-drag-indicator |

### 额外实现 (Plan 2 优化任务)

| 功能 | 状态 | 证据 |
|------|------|------|
| 自定义拖拽预览 (cloneNode + setDragImage) | PASS | `src/renderer.js:8092` dragPreview 元素 |
| rAF 节流 | PASS | `src/renderer.js:7943` tabDragThrottled 标志 |
| Escape 取消拖拽 | PASS | dragend handler 中清理 |
| ARIA 无障碍属性 | PASS | aria-grabbed, aria-dropeffect 属性 |

---

## Plan 03: 跨窗口 Tab 拖拽

**commit:** `3c39b3b` (feat), `b463004` (feat), `bab8880` (feat)

### must_haves.truths 逐项验证

| # | 必须满足项 | 状态 | 证据 |
|---|-----------|------|------|
| 1 | 拖拽 Tab 出标签栏后松手创建新窗口 | PASS | `drag-coordinator.js:234-260` endDrag 'new-window' action: createMainWindow + createTab + closeTab + 通知 |
| 2 | 拖拽 Tab 到另一个窗口的 Tab 栏可以移动 Tab | PASS | `drag-coordinator.js:263-298` endDrag 'move-to-window' action: updateTab windowId + 通知源/目标窗口 |
| 3 | 源窗口仅剩一个 Tab 时自动销毁窗口 | PASS | `drag-coordinator.js:289-294` 检查 sourceTabs.length === 0 后调用 closeWindowWithTabs |
| 4 | 拖拽过程中显示浮动预览 | PASS | `src/renderer.js:8092` dragPreview DOM 元素; `src/styles/main.css:1545-1575` .tab-drag-preview 200px 样式 |
| 5 | 取消拖拽时静默回滚 | PASS | `drag-coordinator.js:312-323` cancelDrag 重置状态 + 广播 cancelled; `src/renderer.js:8261` renderer 调用 cancelDrag |

### must_haves.artifacts 逐项验证

| 制品 | 状态 | 证据 |
|------|------|------|
| main.js (DragCoordinator) | PASS | `drag-coordinator.js` 独立模块; `ipc-handlers.js:24` 引入 |
| src/renderer.js (跨窗口拖拽逻辑) | PASS | mousedown/mousemove/mouseup 事件 + 浮动预览 + 跨窗口 IPC |
| src/preload.js (拖拽相关 IPC API) | PASS | `src/preload.js:1325-1355` startDrag/updateDragPosition/endDrag/cancelDrag/onDragStateChanged |
| src/styles/main.css (浮动预览样式) | PASS | `main.css:1545-1594` .tab-drag-preview, .tab.cross-dragging, .tab-bar.cross-drag-target-ready |

### 关键设计决策验证

| 决策 | 状态 | 说明 |
|------|------|------|
| 自定义鼠标事件 (非 HTML5 DnD) | PASS | mousedown/mousemove/mouseup 事件系统, 因为 DnD 不支持跨窗口 |
| DragCoordinator 依赖注入 | PASS | `drag-coordinator.js:63-81` setWindowManager/setTabManager/setContainerManager |
| findWindowAtScreenPosition 封装 | PASS | `window-manager.js:313` 不暴露内部 windows Map |
| window:get-id IPC 通道 | PASS | `ipc-handlers.js:475` 暴露给渲染进程 |
| tab:removed/tab:created 事件同步 | PASS | `src/renderer.js:995,1031` handleTabCreated/Removed 处理器 |

### IPC 通道完整性

| 通道 | 方向 | 状态 |
|------|------|------|
| drag:start | renderer -> main | PASS (`ipc-handlers.js:490`) |
| drag:update-position | renderer -> main | PASS (`ipc-handlers.js:508`) |
| drag:end | renderer -> main | PASS (`ipc-handlers.js:523`) |
| drag:cancel | renderer -> main | PASS (`ipc-handlers.js:537`) |
| drag:state-changed | main -> renderer (broadcast) | PASS (`drag-coordinator.js:349`) |

---

## 交叉验证: 关键文件清单

| 文件 | Plan 01 | Plan 02 | Plan 03 | 状态 |
|------|---------|---------|---------|------|
| window-manager.js | saveWindowBounds, restoreWindowBounds, windowBoundsStore | - | findWindowAtScreenPosition | PASS |
| context-menu-manager.js | "在新窗口中打开"菜单项 | - | - | PASS |
| ipc-handlers.js | tab:open-in-new-window | tab:dnd-reorder | drag:* 通道 | PASS |
| src/preload.js | openTabInNewWindow | tabDndReorder | startDrag/updateDragPosition/endDrag/cancelDrag/onDragStateChanged | PASS |
| src/renderer.js | context-menu 回调 | DnD 事件 + 指示器 + rAF | 自定义鼠标事件 + 浮动预览 | PASS |
| src/styles/main.css | - | .tab-drag-indicator, .tab.dragging | .tab-drag-preview, .tab.cross-dragging, .tab-bar.cross-drag-target-ready | PASS |
| drag-coordinator.js | - | - | 全局拖拽状态协调 | PASS |
| tab-manager.js | - | reorderTabs() | getTabsByWindowId, updateTab | PASS |
| main.js | setupWindowBoundsTracking, before-quit | tab:dnd-reorder handler | drag-coordinator 引入 | PASS |

---

## 提交记录

| Commit | 描述 | Plan |
|--------|------|------|
| `76f78cf` | feat(36): implement window position persistence with electron-store | 01 |
| `559c4f9` | feat(36): add "open in new window" tab context menu option | 01 |
| `6d72adc` | feat(tab): implement window tab drag-and-drop reorder | 02 |
| `4d7344e` | refactor(tab): optimize tab drag-and-drop with preview, a11y, and rAF throttle | 02 |
| `3c39b3b` | feat(36-03): add DragCoordinator and cross-window drag IPC infrastructure | 03 |
| `b463004` | feat(36-03): add floating drag preview and cross-window tab drag-out | 03 |
| `bab8880` | feat(36-03): add cross-window tab movement and event handlers | 03 |

---

## 总结

**Phase 36 全部 5 个需求 ID (MW-02, MW-03, MW-04, MW-11, MW-13) 均已实现并通过验证。**

- Plan 01 (窗口位置持久化 + 右键菜单): 5/5 truths PASS, 4/4 artifacts PASS
- Plan 02 (窗口内 Tab 拖拽排序): 4/4 truths PASS, 2/2 artifacts PASS
- Plan 03 (跨窗口 Tab 拖拽): 5/5 truths PASS, 4/4 artifacts PASS

所有 must_haves 均已在代码中找到对应实现，代码结构与 Plan 描述一致，无偏差。
