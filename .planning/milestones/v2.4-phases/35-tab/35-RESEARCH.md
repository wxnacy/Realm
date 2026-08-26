# Phase 35: Tab 窗口关联 - Research

**Researched:** 2026-08-15
**Domain:** Electron 多窗口 Tab 生命周期管理
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-15:** 关闭窗口时，如果有活跃任务（进行中的下载 + 正在播放的媒体），弹出原生确认对话框（dialog.showMessageBox）；无活跃任务时直接关闭
- **D-16:** 窗口销毁顺序：先显式销毁窗口内所有 Tab 的 webContents，再销毁窗口本身，确保资源正确释放和事件触发
- **D-17:** 活跃任务检测范围：download-item 下载任务 + media-sniffer 检测到的活跃媒体播放
- **D-18:** 窗口标题栏格式：`容器名 - 页面标题`，如 "工作 - Google"，与 Chrome 风格一致
- **D-19:** 容器颜色标识位置：Tab 栏顶部 2-3px 彩色边框线，类似 Firefox 容器颜色条
- **D-20:** 颜色更新策略：跟随当前活动 Tab 的容器颜色实时更新
- **D-21:** 默认容器处理：默认容器无颜色，隐藏颜色条
- **D-22:** Tab 归属关系：每个 tab 对象增加 windowId 字段，主进程维护全局 Tab Map（Map<tabId, {url, container, windowId, ...}>）作为权威数据源
- **D-23:** 渲染进程架构：每个 BrowserWindow 有独立的 renderer.js 实例，只管理本窗口的 Tab，窗口间通过主进程中转通信
- **D-24:** 窗口间 Tab 传递：拖拽移动 Tab 时，事件先发到主进程，主进程更新 Tab 归属后通知目标窗口创建 Tab

### Claude's Discretion
- 拖拽移动 Tab 的具体实现细节（Phase 36 范围）
- Tab 栏内拖拽排序的具体实现（Phase 36 范围）

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MW-05 | 关闭窗口时，窗口内所有 Tab 一起关闭；如果是最后一个窗口则退出应用 | D-15/D-16 窗口关闭级联机制 |
| MW-06 | Tab 拖拽过程中保留 URL、容器、标题、favicon 等状态信息（不丢失） | D-22/D-24 Tab 状态序列化 |
| MW-12 | 窗口标题栏显示当前活动 Tab 所属容器的名称 | D-18 标题栏格式规范 |
| MW-14 | 窗口标题栏/工具栏显示容器颜色标识 | D-19/D-20/D-21 颜色条实现 |
</phase_requirements>

## Summary

Phase 35 的核心目标是建立 Tab 与窗口的明确归属关系，并实现窗口关闭级联行为。当前代码库中，Tab 管理是单窗口模式：`tab-manager.js` 维护一个全局 `Map<tabId, tab>` 和单一 `activeTabId`，所有 Tab 不区分归属窗口。`window-manager.js` 已在 Phase 34 重构为 `Map<windowId, BrowserWindow>` + `Set<windowId>` 双重注册表，具备多窗口基础设施。

本阶段需要：
1. 为 Tab 对象新增 `windowId` 字段，建立 Tab-窗口归属关系
2. 实现窗口关闭时的 Tab 级联销毁（D-16）和活跃任务确认（D-15）
3. 实现窗口标题栏的容器名称显示（D-18）和颜色条（D-19/D-20/D-21）
4. 渲染进程需适配多窗口模式：每个窗口只管理自己的 Tab 子集

**Primary recommendation:** 采用"主进程权威数据源 + 渲染进程视图"模式——主进程 `tab-manager.js` 维护全局 Tab Map（含 windowId），渲染进程只维护本窗口的 Tab 子集视图。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab 生命周期管理 | Main Process | — | tab-manager.js 是权威数据源，管理创建/关闭/归属 |
| 窗口关闭级联 | Main Process | — | window close 事件在主进程处理，需协调 Tab 销毁 |
| 活跃任务检测 | Main Process | — | download-manager 和 media-sniffer 都在主进程 |
| 窗口标题更新 | Renderer | Main Process | 渲染进程感知 Tab 切换，通过 IPC 通知主进程设置标题 |
| 容器颜色条 | Renderer | — | 纯 UI 渲染，在渲染进程 DOM 操作 |
| Tab DOM 管理 | Renderer | — | 每个窗口独立的渲染进程实例管理自己的 Tab DOM |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 32.x | 桌面应用框架 | 已选定，BrowserWindow/Session/IPC 原生支持 |
| Node.js | LTS | 主进程运行时 | Electron 内置 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | 8.1.0+ | Tab 持久化 | 已有，存储 Tab 配置 |
| dialog (electron) | 内置 | 原生确认对话框 | D-15 活跃任务确认 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dialog.showMessageBox | 自定义 HTML 对话框 | 原生对话框更简洁，阻塞语义明确 |
| 渲染进程维护全局 Tab 状态 | 主进程权威数据源 | 主进程权威避免跨窗口状态不一致 |

**Installation:** 无需新依赖

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  tab-manager.js   │  │ window-manager.js │  │download-mgr  │ │
│  │  Map<tabId, tab>  │  │ Map<winId, Win>   │  │activeDwnloads│ │
│  │  + windowId field │  │ + broadcast()     │  │getActive*()  │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                     │                    │         │
│           ▼                     ▼                    ▼         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    IPC Handlers                          │   │
│  │  tab:create/close/switch  window:set-title              │   │
│  │  window:close-request     window:get-active-tasks       │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │ IPC (contextBridge)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Renderer Process (per window)                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  state.tabs (本窗口子集)    DOM: tabList, tabBar            │ │
│  │  state.activeTabId          .window-color-bar              │ │
│  │  createTabElement()         switchTab()                    │ │
│  │  updateWindowTitle()        updateColorBar()               │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
main.js                    # 窗口关闭级联、标题更新 IPC
window-manager.js          # 新增 closeWindowWithTabs() 方法
tab-manager.js             # Tab 对象新增 windowId，新增按窗口查询方法
ipc-handlers.js            # 新增 window:set-title, window:close-request
src/renderer.js            # 标题更新、颜色条、适配多窗口 Tab 子集
src/preload.js             # 新增 window:set-title API
src/styles/main.css        # .window-color-bar 样式
```

### Pattern 1: 窗口关闭级联 (D-16)

**What:** 关闭窗口时，先销毁窗口内所有 Tab 的 webContents，再销毁窗口本身
**When to use:** 窗口 close 事件触发时
**Example:**
```javascript
// window-manager.js - 新增方法
/**
 * 关闭窗口及其所有 Tab（D-16 级联销毁）
 * 先显式销毁窗口内所有 Tab 的 webContents，再销毁窗口本身
 * @param {number} windowId - 窗口 ID
 */
function closeWindowWithTabs(windowId) {
  const win = windows.get(windowId);
  if (!win || win.isDestroyed()) return;

  // 1. 获取该窗口的所有 Tab
  const windowTabs = tabManager.getTabsByWindowId(windowId);

  // 2. 逐个销毁 Tab 的 webContents（通过渲染进程通知）
  for (const tab of windowTabs) {
    const webview = getWebviewForTab(win, tab.id);
    if (webview && !webview.isDestroyed()) {
      webview.destroy();
    }
    tabManager.closeTab(tab.id);
  }

  // 3. 销毁窗口
  win.close();
}
```

### Pattern 2: 活跃任务确认对话框 (D-15)

**What:** 关闭窗口前检查活跃任务，有任务时弹出确认
**When to use:** 窗口 close 事件，e.preventDefault() 后
**Example:**
```javascript
// main.js - 窗口 close 事件处理
win.on('close', async (e) => {
  if (quitting) return; // 退出流程中不拦截

  e.preventDefault();

  // 检查活跃任务
  const activeDownloads = downloadManager.getActiveDownloads();
  const activeMedia = getActiveMediaForWindow(win.id);

  if (activeDownloads.length === 0 && activeMedia.length === 0) {
    // 无活跃任务，直接关闭
    destroyWindowTabs(win);
    win.destroy();
    return;
  }

  // 构建任务列表
  const taskList = [
    ...activeDownloads.map(d => `• ${d.filename} (下载中...)`),
    ...activeMedia.map(m => `• ${m.type} 播放中 (${m.domain})`),
  ].join('\n');

  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['关闭', '取消'],
    defaultId: 1, // 取消是安全默认
    title: '确认关闭',
    message: `该窗口有 ${activeDownloads.length + activeMedia.length} 个活跃任务：`,
    detail: `${taskList}\n关闭窗口将中断这些任务。确定要关闭吗？`,
  });

  if (response === 0) {
    // 用户选择关闭
    destroyWindowTabs(win);
    win.destroy();
  }
  // response === 1: 取消，窗口保持打开
});
```

### Pattern 3: 窗口标题更新 (D-18)

**What:** 窗口标题格式为 `容器名 - 页面标题`
**When to use:** Tab 切换、页面标题变化、容器切换时
**Example:**
```javascript
// renderer.js - 更新窗口标题
function updateWindowTitle() {
  const tab = state.tabs.get(state.activeTabId);
  if (!tab) {
    document.title = 'Realm';
    return;
  }

  const container = state.containers.find(c => c.id === tab.containerId);
  const containerName = container ? container.name : '';
  const pageTitle = tab.title || '新标签页';

  if (containerName && containerName !== 'default' && containerName !== '默认') {
    document.title = `${containerName} - ${pageTitle}`;
  } else {
    document.title = pageTitle;
  }
}
```

### Anti-Patterns to Avoid

- **渲染进程维护全局 Tab 状态：** 多窗口时会导致状态不一致，主进程是权威数据源
- **窗口关闭时不销毁 webContents：** 会导致内存泄漏和进程残留
- **跳过 e.preventDefault() 直接 win.destroy()：** 会跳过活跃任务检查
- **在渲染进程判断是否是最后一个窗口：** 渲染进程无法感知其他窗口，应在主进程判断

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 确认对话框 | 自定义 HTML 模态框 | dialog.showMessageBox | 原生对话框阻塞语义明确，跨平台一致 |
| 窗口标题 | 手动设置 BrowserWindow title | document.title | Electron 自动同步 document.title 到窗口标题栏 |
| 活跃下载检测 | 自定义下载状态追踪 | downloadManager.getActiveDownloads() | 已有完善实现 |
| 媒体播放检测 | 自定义媒体状态 | mediaSniffer.mediaMap | 已有按 webContents 隔离的媒体列表 |

## Common Pitfalls

### Pitfall 1: 窗口关闭竞态

**What goes wrong:** `win.close()` 触发 `close` 事件，如果在 close 事件中调用 `win.close()` 会递归
**Why it happens:** Electron 的 close 事件可以被 preventDefault()，再次调用 close() 会重新触发
**How to avoid:** 使用 `win.destroy()` 绕过 close 事件直接销毁，或设置标志位防止重入
**Warning signs:** 控制台显示 "Maximum call stack size exceeded"

```javascript
// 正确做法
let closing = false;
win.on('close', async (e) => {
  if (closing) return;
  closing = true;
  e.preventDefault();
  // ... 处理逻辑
  win.destroy(); // 绕过 close 事件
});
```

### Pitfall 2: Tab 的 webContents 销毁顺序

**What goes wrong:** 先销毁窗口后销毁 webContents，导致 webContents 访问已销毁的窗口
**Why it happens:** BrowserWindow 销毁时会级联销毁 webContents，但顺序不可控
**How to avoid:** D-16 明确要求先销毁 Tab webContents，再销毁窗口
**Warning signs:** 控制台报 "Object has been destroyed" 错误

### Pitfall 3: 活跃媒体检测范围

**What goes wrong:** 检测到已暂停的媒体也弹确认对话框
**Why it happens:** mediaSniffer.mediaMap 包含所有检测到的媒体，不仅是播放中的
**How to avoid:** 活跃媒体需要额外判断是否有播放中的媒体（需要从渲染进程查询）
**Warning signs:** 每次关闭窗口都弹确认，即使没有在播放视频

### Pitfall 4: document.title 与 BrowserWindow.title 同步

**What goes wrong:** 直接设置 `win.setTitle()` 会被渲染进程的 `document.title` 覆盖
**Why it happens:** Electron 优先使用 document.title 作为窗口标题
**How to avoid:** 统一在渲染进程设置 document.title，不要在主进程设置 win.setTitle()
**Warning signs:** 窗口标题闪烁或显示旧标题

### Pitfall 5: 多窗口 Tab Map 一致性

**What goes wrong:** 渲染进程的 state.tabs 与主进程的 tab-manager 不同步
**Why it happens:** 渲染进程只管理本窗口 Tab，但主进程管理全局 Tab
**How to avoid:** 所有 Tab 操作都通过 IPC 调用主进程，渲染进程只做 UI 响应
**Warning signs:** 关闭 Tab 后 DOM 残留，或新建 Tab 后不显示

## Code Examples

### 获取窗口内的 Tab 列表

```javascript
// tab-manager.js - 新增方法
/**
 * 获取指定窗口的所有 Tab
 * @param {number} windowId - 窗口 ID
 * @returns {Array} Tab 数组
 */
function getTabsByWindowId(windowId) {
  return Array.from(tabs.values()).filter(tab => tab.windowId === windowId);
}
```

### 创建 Tab 时指定 windowId

```javascript
// tab-manager.js - 修改 createTab
function createTab(containerId, url = '', windowId = null) {
  // ... 现有逻辑
  const tab = {
    id: tabId,
    containerId,
    windowId, // 新增字段
    url: url || '',
    title: '新标签页',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  // ...
}
```

### 渲染进程创建 Tab 时传递 windowId

```javascript
// renderer.js - 修改 createTab
async function createTab(containerId, url = null) {
  const tabUrl = url || 'realm://newtab';
  // 传递当前窗口的 windowId
  const tab = await window.realmAPI.createTab(containerId, tabUrl, windowId);
  // ...
}
```

### 窗口关闭级联完整流程

```javascript
// main.js - 窗口 close 事件处理
function setupWindowCloseHandler(win) {
  let closing = false;

  win.on('close', async (e) => {
    if (closing || quitting) return;
    closing = true;
    e.preventDefault();

    // 检查活跃任务
    const tasks = await getActiveTasksForWindow(win.id);
    if (tasks.length > 0) {
      const { response } = await showCloseConfirmDialog(win, tasks);
      if (response !== 0) {
        closing = false;
        return;
      }
    }

    // 销毁窗口内所有 Tab
    const windowTabs = tabManager.getTabsByWindowId(win.id);
    for (const tab of windowTabs) {
      tabManager.closeTab(tab.id);
    }

    // 销毁窗口
    win.destroy();
  });

  win.on('closed', () => {
    // 检查是否是最后一个窗口
    const remainingWindows = BrowserWindow.getAllWindows()
      .filter(w => !w.isDestroyed());
    if (remainingWindows.length === 0) {
      app.quit();
    }
  });
}
```

### 容器颜色条更新

```javascript
// renderer.js - 更新窗口颜色条
function updateWindowColorBar() {
  let colorBar = document.querySelector('.window-color-bar');
  if (!colorBar) {
    colorBar = document.createElement('div');
    colorBar.className = 'window-color-bar';
    document.body.prepend(colorBar);
  }

  const tab = state.tabs.get(state.activeTabId);
  if (!tab) {
    colorBar.classList.add('hidden');
    return;
  }

  const container = state.containers.find(c => c.id === tab.containerId);
  if (!container || !container.color) {
    colorBar.classList.add('hidden');
  } else {
    colorBar.classList.remove('hidden');
    colorBar.style.backgroundColor = container.color;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 单窗口 Tab 管理 | 多窗口 Tab 管理 (windowId) | Phase 35 | Tab 归属明确 |
| 无窗口关闭确认 | 活跃任务确认对话框 | Phase 35 | 防止误关闭 |
| 固定窗口标题 | 容器名 + 页面标题 | Phase 35 | 容器识别清晰 |
| 无容器颜色标识 | 窗口顶部颜色条 | Phase 35 | 视觉区分容器 |

**Deprecated/outdated:**
- 单窗口 `activeTabId` 模式：需要改为按窗口维护活动 Tab
- `tabManager.getTabs()` 返回所有 Tab：需要新增 `getTabsByWindowId()` 过滤

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron dialog | D-15 确认对话框 | ✓ | 内置 | — |
| downloadManager.getActiveDownloads() | D-17 活跃下载检测 | ✓ | 已实现 | — |
| mediaSniffer.mediaMap | D-17 活跃媒体检测 | ✓ | 已实现 | 需要新增按窗口过滤 |
| BrowserWindow.title | D-18 窗口标题 | ✓ | 内置 | — |
| document.title | D-18 标题同步 | ✓ | Web API | — |

**Missing dependencies with no fallback:** 无

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 无（项目当前未配置测试框架） |
| Config file | none |
| Quick run command | `npm run dev` (手动验证) |
| Full suite command | `npm run dev` (手动验证) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MW-05 | 窗口关闭级联 | manual-only | 手动验证：关闭窗口后 Tab 消失 | N/A |
| MW-06 | Tab 拖拽状态保留 | manual-only | 手动验证：拖拽后 Tab 信息完整 | N/A |
| MW-12 | 窗口标题显示容器名 | manual-only | 手动验证：标题格式正确 | N/A |
| MW-14 | 容器颜色标识 | manual-only | 手动验证：颜色条显示正确 | N/A |

### Sampling Rate
- **Per task commit:** `npm run dev` 手动验证
- **Per wave merge:** 完整功能验证
- **Phase gate:** 所有成功标准通过

### Wave 0 Gaps
- 无自动化测试框架（项目当前没有配置）
- 手动验证清单需要在 Plan 中定义

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | assertTrustedSender 校验 IPC 来源窗口 |
| V5 Input Validation | yes | Tab/windowId 参数校验 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron Multi-Window

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 伪造 IPC 来源 | Spoofing | assertTrustedSender + isManagedWindow 校验 |
| 窗口关闭竞态 | Denial of Service | 标志位防重入 + win.destroy() |
| webContents 残留 | Information Disclosure | D-16 显式销毁顺序 |

## Sources

### Primary (HIGH confidence)
- Electron 官方文档 - BrowserWindow API
- 项目代码库 - window-manager.js, tab-manager.js, main.js
- Phase 34 研究文档 - STACK.md, ARCHITECTURE.md, PITFALLS.md

### Secondary (MEDIUM confidence)
- Phase 34 已实现代码 - window-manager.js Map+Set 重构
- Phase 34 已实现代码 - broadcast() 方法

### Tertiary (LOW confidence)
- 无

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | mediaSniffer.mediaMap 包含所有检测到的媒体（不仅是播放中的） | Pitfall 3 | 活跃媒体检测可能误判 |
| A2 | document.title 会自动同步到 BrowserWindow 标题栏 | Pattern 3 | 需要手动调用 win.setTitle() |

## Open Questions

1. **活跃媒体如何判断"正在播放"？**
   - What we know: mediaSniffer.mediaMap 按 webContentsId 存储媒体列表
   - What's unclear: 是否有 API 判断媒体是否正在播放（而非只是检测到）
   - Recommendation: 需要从渲染进程查询 webview 的播放状态，或假设检测到的媒体都是活跃的

2. **多窗口时 tabManager 的 activeTabId 如何处理？**
   - What we know: 当前是单一 activeTabId
   - What's unclear: 多窗口时每个窗口有自己的活动 Tab
   - Recommendation: 改为 Map<windowId, tabId> 或在 Tab 对象中标记是否为活动

3. **Phase 34 Plan 03 是否已完全实现？**
   - What we know: 34-03-PLAN.md 定义了 Dock 菜单、activate 重构、broadcast 替换
   - What's unclear: 34-03-SUMMARY.md 不存在，可能尚未执行
   - Recommendation: 在 Phase 35 开始前确认 Phase 34 全部完成

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 基于已有 Electron 32.x 和现有代码
- Architecture: HIGH - Phase 34 已验证多窗口基础设施
- Pitfalls: MEDIUM - 部分陷阱基于 Electron 通用经验，未在本项目验证

**Research date:** 2026-08-15
**Valid until:** 2026-09-15 (30 days - stable phase)
