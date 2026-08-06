# Phase 26: 视频源检测 + IPC 基础 - Research

**Researched:** 2026-08-06
**Domain:** Electron 网络拦截、DOM 脚本注入、IPC 通信
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 三种检测方式封装在单一 MediaSniffer 类中
- **D-02:** 嗅探器代码放在主进程 `media-sniffer.js`
- **D-03:** 脚本注入在 webview 的 `dom-ready` 事件中执行
- **D-04:** MutationObserver 监听整个 `document.body`，配置 `childList + subtree + attributes`
- **D-05:** URL 去重（同容器内相同 URL 只保留一条）
- **D-06:** 记录字段：url, type, source, timestamp, title, duration, thumbnail
- **D-07:** 内存中使用 `Map<containerId, MediaItem[]>` 按容器分组
- **D-08:** 仅内存存储，应用关闭后清空
- **D-09:** 主进程通过 `webContents.send('media:list-updated', data)` 推送
- **D-10:** 每次检测到新媒体立即通知，不做防抖
- **D-11:** 每次通知携带完整当前容器媒体列表
- **D-12:** 每个 BrowserWindow 有独立的媒体列表
- **D-13:** `did-navigate` 事件中清空当前容器媒体列表
- **D-14:** 只在跨页面导航时清空，锚点跳转不清空
- **D-15:** 切换容器时保留所有容器的媒体列表
- **D-16:** 关闭 Tab 时清空该 Tab 所属容器的媒体列表

### Claude's Discretion
无 — 所有决策均由用户明确选择

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNIFF-01 | webRequest 拦截 m3u8/mp4/flv/webm | 使用 `ses.webRequest.onResponseStarted` 检测 resourceType=media 或 content-type 包含视频类型 |
| SNIFF-02 | executeJavaScript 注入检测 `<video>`/`<source>` | 复用现有 webview.executeJavaScript 模式（参考 Readability 提取） |
| SNIFF-03 | MutationObserver 监听 DOM 变化 | 在 dom-ready 注入脚本中启动 MutationObserver |
| SNIFF-04 | URL 去重和分类管理 | Map<containerId, MediaItem[]> + Set<url> 去重 |
| SNIFF-05 | 页面导航时清空 | did-navigate 事件触发清空 |
| IPC-01 | media:get-list IPC 通道 | ipcMain.handle('media:get-list', ...) |
| IPC-02 | media:play 创建播放器窗口 | new BrowserWindow + 加载播放器 HTML |
| IPC-03 | media:copy-url 剪贴板 | clipboard.writeText(url) |
| IPC-04 | media:clear-list 清空列表 | 从 Map 中移除容器数据 |
| IPC-05 | preload.js 暴露 mediaAPI | contextBridge.exposeInMainWorld('mediaAPI', {...}) |
</phase_requirements>

## Summary

Phase 26 需要构建一个三层媒体嗅探系统（网络拦截 + 脚本注入 + DOM 监听），通过 IPC 通道将检测结果暴露给渲染进程。核心技术挑战在于：1) 正确使用 Electron 的 webRequest API 而不与现有 Client Hints 处理冲突；2) 在 webview guest 中安全注入检测脚本；3) 按容器隔离管理媒体数据。

**关键发现：** Electron 的 `ses.webRequest` 每个事件类型在同一 session 上只能注册一个监听器（后注册的会替换先注册的）。当前代码已在 `session-created` 中注册了 `onBeforeSendHeaders` 和 `onSendHeaders`，因此媒体检测必须使用不同的事件类型（`onResponseStarted` 或 `onHeadersReceived`）。

**Primary recommendation:** 使用 `ses.webRequest.onResponseStarted` 进行网络层媒体检测，配合 `webview.executeJavaScript` 在 dom-ready 时注入 DOM 检测脚本，三种检测结果统一汇总到 MediaSniffer 类。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 网络请求拦截 | Main Process (session.webRequest) | — | webRequest API 仅在主进程可用 |
| DOM 脚本注入 | Renderer (webview.executeJavaScript) | — | executeJavaScript 在渲染进程调用 |
| MutationObserver | Guest Page (injected script) | — | 运行在 webview guest 页面上下文 |
| IPC 通道注册 | Main Process (ipcMain.handle) | — | 主进程注册处理器 |
| IPC 暴露给渲染进程 | Preload (contextBridge) | — | 安全暴露接口 |
| 媒体数据存储 | Main Process (MediaSniffer) | — | 内存 Map 存储，按容器隔离 |
| 渲染进程 UI 更新 | Renderer | — | 接收 media:list-updated 事件更新 UI |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 32.x | 桌面应用框架 | 项目已选定，不可更改 |
| Electron Session API | 内置 | 容器隔离 + webRequest 拦截 | 无需额外依赖 |
| Electron ipcMain/ipcRenderer | 内置 | 进程间通信 | 项目标准 IPC 模式 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | 8.1.0+ | 容器配置持久化 | 项目已有依赖（非本阶段新增） |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| onResponseStarted | onHeadersReceived | onHeadersReceived 支持修改响应头但更复杂；onResponseStarted 更简单且足够 |
| onResponseStarted | onCompleted | onCompleted 在响应体完全下载后才触发，大文件检测延迟高 |
| 单一 MediaSniffer 类 | 三个独立检测器 | 用户已决策 D-01：封装在单一类中 |

## Package Legitimacy Audit

> 本阶段不安装任何外部包，仅使用 Electron 内置 API。无需进行包合法性审查。

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none) | — | — | 本阶段无新增依赖 |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MediaSniffer                          │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ Network      │  │ Script       │  │ DOM           │  │   │
│  │  │ Detector     │  │ Injector     │  │ Observer      │  │   │
│  │  │              │  │ (主进程侧)   │  │ (注入脚本侧)  │  │   │
│  │  │ onResponse-  │  │              │  │               │  │   │
│  │  │ Started      │  │              │  │               │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │   │
│  │         │                 │                   │          │   │
│  │         └────────┬────────┴───────────────────┘          │   │
│  │                  ▼                                       │   │
│  │         ┌────────────────┐                               │   │
│  │         │ URL Dedup      │                               │   │
│  │         │ + Container    │                               │   │
│  │         │   Isolation    │                               │   │
│  │         └────────┬───────┘                               │   │
│  │                  │                                       │   │
│  │         ┌────────▼───────┐                               │   │
│  │         │ Map<container  │                               │   │
│  │         │   Id, Items[]> │                               │   │
│  │         └────────┬───────┘                               │   │
│  └──────────────────┼───────────────────────────────────────┘   │
│                     │                                           │
│         webContents.send('media:list-updated')                  │
│                     │                                           │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      │ IPC (contextBridge)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Renderer Process                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    mediaAPI                              │   │
│  │  getMediaList / play / copyUrl / clearList               │   │
│  │  onMediaListUpdate(callback)                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Webview (per Tab)                         │   │
│  │                                                          │   │
│  │  dom-ready → executeJavaScript(检测脚本)                  │   │
│  │  did-navigate → 清空容器媒体列表                          │   │
│  │                                                          │   │
│  │  注入脚本:                                               │   │
│  │  1. 扫描 <video>/<source> src                            │   │
│  │  2. MutationObserver 监听新增元素                         │   │
│  │  3. 通过 webview IPC 回传主进程                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
media-sniffer.js          # 新增：主进程媒体嗅探器类
ipc-handlers.js           # 修改：注册 media:* IPC 通道
src/preload.js            # 修改：暴露 mediaAPI
src/renderer.js           # 修改：监听 media:list-updated + dom-ready 注入
main.js                   # 修改：初始化 MediaSniffer + 集成到 session-created
```

### Pattern 1: webRequest.onResponseStarted 网络检测

**What:** 使用 Electron 的 `ses.webRequest.onResponseStarted` 事件监听网络请求完成，通过 `resourceType` 和 `responseHeaders['content-type']` 检测视频资源。

**When to use:** 当需要在网络层面检测视频资源 URL 时。这是最可靠的检测方式，因为它能看到实际的响应头信息。

**关键约束：** Electron 的 `ses.webRequest` 每个事件类型在同一 session 上**只能注册一个监听器**。后注册的会替换先注册的。当前代码已在 `session-created` 中注册了 `onBeforeSendHeaders` 和 `onSendHeaders`，因此媒体检测必须使用不同的事件类型。

**推荐方案：** 使用 `onResponseStarted`（当前未被使用），它提供 `resourceType` 和 `responseHeaders`，且是只读事件，不会干扰请求流程。

```javascript
// Source: https://www.electronjs.org/docs/latest/api/web-request#webrequestonresponsestartedfilter-listener
// 在 session-created 事件中注册
app.on('session-created', (ses) => {
  // 现有：onBeforeSendHeaders（Client Hints）
  ses.webRequest.onBeforeSendHeaders(...);

  // 现有：onSendHeaders（UA 日志）
  ses.webRequest.onSendHeaders(...);

  // 新增：onResponseStarted（媒体检测）
  ses.webRequest.onResponseStarted(
    { urls: ['*://*/*'] },
    (details) => {
      // details 包含：
      // - resourceType: 'media' | 'xhr' | 'other' 等
      // - responseHeaders: Record<string, string[]>（content-type 等）
      // - url: 请求 URL
      // - webContentsId: 来源 webContents ID
      mediaSniffer.handleNetworkResponse(details);
    }
  );
});
```

### Pattern 2: webview.executeJavaScript 脚本注入

**What:** 在 webview 的 `dom-ready` 事件中通过 `executeJavaScript` 注入检测脚本，扫描页面中的 `<video>` 和 `<source>` 元素。

**When to use:** 当需要检测页面 DOM 中的视频元素时。网络拦截无法检测到 blob: URL 和 data: URL 的视频，脚本注入可以补充这些场景。

**现有模式参考：** 项目中已有 `webview.executeJavaScript` 的成熟使用模式：
- `src/renderer.js:1181` — 切换设置页面
- `src/renderer.js:4184-4212` — Readability 内容提取（同步 IIFE，返回 JSON 字符串）
- `src/renderer.js:1442` — execCommand 执行
- `src/renderer.js:1586` — 注入脚本

```javascript
// Source: 项目现有模式 (src/renderer.js:4184-4212)
// 在 bindWebviewEvents 的 dom-ready 事件中执行
webview.addEventListener('dom-ready', () => {
  const script = `
(function() {
  // 防止重复注入
  if (window.__realmMediaSniffer) return;
  window.__realmMediaSniffer = true;

  // 1. 扫描现有视频元素
  function scanExistingVideos() {
    const results = [];
    document.querySelectorAll('video, source').forEach(el => {
      const url = el.src || el.currentSrc;
      if (url && !url.startsWith('blob:')) {
        results.push({ url, type: classifyUrl(url), source: 'script' });
      }
    });
    return results;
  }

  // 2. MutationObserver 监听新增元素
  const observer = new MutationObserver((mutations) => {
    const newVideos = [];
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.tagName === 'VIDEO' || node.tagName === 'SOURCE') {
            const url = node.src || node.currentSrc;
            if (url) newVideos.push({ url, type: classifyUrl(url), source: 'dom' });
          }
          // 检查子元素
          node.querySelectorAll && node.querySelectorAll('video, source').forEach(el => {
            const url = el.src || el.currentSrc;
            if (url) newVideos.push({ url, type: classifyUrl(url), source: 'dom' });
          });
        }
      });
      // 属性变化
      if (mutation.type === 'attributes' &&
          (mutation.target.tagName === 'VIDEO' || mutation.target.tagName === 'SOURCE')) {
        const url = mutation.target.src || mutation.target.currentSrc;
        if (url) newVideos.push({ url, type: classifyUrl(url), source: 'dom' });
      }
    });
    if (newVideos.length > 0) {
      window.postMessage({ type: '__realmMediaDetected', videos: newVideos }, '*');
    }
  });
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['src', 'currentSrc']
  });

  // 3. 返回初始扫描结果
  return JSON.stringify(scanExistingVideos());
})()`;
  webview.executeJavaScript(script);
});
```

### Pattern 3: IPC 通道注册模式

**What:** 按照项目现有模式注册 `media:*` 命名空间的 IPC 通道。

**When to use:** 所有主进程-渲染进程通信遵循此模式。

```javascript
// Source: ipc-handlers.js 现有模式 (container:*, cookie:*, history:*, favorites:*)
// 在 registerHandlers() 中注册

// === 渲染进程 → 主进程（invoke/handle）===
ipcMain.handle('media:get-list', (event) => {
  assertTrustedSender(event);
  const win = windowManager.getMainWindow();
  const containerId = windowContainerMap.get(win.id) || 'default';
  return mediaSniffer.getMediaList(containerId);
});

ipcMain.handle('media:play', async (event, url) => {
  assertTrustedSender(event);
  // 创建播放器窗口（Phase 28 实现完整功能，本阶段仅创建窗口占位）
  const playerWin = new BrowserWindow({
    width: 800, height: 600,
    webPreferences: { preload: path.join(__dirname, 'src/preload.js') }
  });
  await playerWin.loadFile(path.join(__dirname, 'src/player.html'));
  playerWin.webContents.send('media:play-url', url);
});

ipcMain.handle('media:copy-url', (event, url) => {
  assertTrustedSender(event);
  const { clipboard } = require('electron');
  clipboard.writeText(url);
  return { success: true };
});

ipcMain.handle('media:clear-list', (event) => {
  assertTrustedSender(event);
  const win = windowManager.getMainWindow();
  const containerId = windowContainerMap.get(win.id) || 'default';
  mediaSniffer.clearMediaList(containerId);
  return { success: true };
});

// === 主进程 → 渲染进程（send/on）===
// 在 MediaSniffer 内部调用：
// const win = windowManager.getMainWindow();
// if (win && !win.isDestroyed()) {
//   win.webContents.send('media:list-updated', { containerId, items });
// }
```

### Pattern 4: contextBridge API 暴露模式

**What:** 按照项目现有模式在 preload.js 中暴露 mediaAPI。

**When to use:** 所有渲染进程可调用的 API 都通过此模式暴露。

```javascript
// Source: src/preload.js 现有模式 (realmAPI)
// 在 contextBridge.exposeInMainWorld 中添加

// ==================== 媒体检测 ====================

/**
 * 获取当前容器的媒体列表
 * @returns {Promise<Array<{url: string, type: string, source: string, timestamp: number}>>}
 */
getMediaList: () => ipcRenderer.invoke('media:get-list'),

/**
 * 播放指定 URL 的媒体
 * @param {string} url - 媒体 URL
 * @returns {Promise<{success: boolean}>}
 */
playMedia: (url) => ipcRenderer.invoke('media:play', url),

/**
 * 复制媒体 URL 到剪贴板
 * @param {string} url - 媒体 URL
 * @returns {Promise<{success: boolean}>}
 */
copyMediaUrl: (url) => ipcRenderer.invoke('media:copy-url', url),

/**
 * 清空当前容器的媒体列表
 * @returns {Promise<{success: boolean}>}
 */
clearMediaList: () => ipcRenderer.invoke('media:clear-list'),

/**
 * 监听媒体列表更新事件
 * @param {Function} callback - 回调函数，参数为 { containerId, items }
 * @returns {Function} 取消监听的清理函数
 */
onMediaListUpdate: (callback) => {
  const handler = (event, data) => callback(data);
  ipcRenderer.on('media:list-updated', handler);
  return () => ipcRenderer.removeListener('media:list-updated', handler);
},
```

### Anti-Patterns to Avoid

- **不要在 onBeforeSendHeaders 中添加媒体检测逻辑：** 该事件已被 Client Hints 处理占用，且不提供 responseHeaders（无法检查 content-type）
- **不要使用 onCompleted 检测大文件：** onCompleted 在响应体完全下载后才触发，大视频文件（GB 级）会导致检测严重延迟
- **不要在 renderer.js 中直接操作主进程数据：** 所有媒体数据的增删改查都通过 IPC 通道，渲染进程只维护本地副本
- **不要在 webview guest 页面中使用 eval()：** 严格 CSP 站点会拦截 eval，使用 executeJavaScript 注入即可（它绕过 CSP）
- **不要忘记防重复注入守卫：** dom-ready 可能多次触发，注入脚本必须检查 `window.__realmMediaSniffer` 防止重复初始化
- **不要在 did-navigate-in-page 中清空媒体列表：** 锚点跳转和 pushState 不应清空列表（D-14）

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 视频格式检测 | 自定义文件头解析 | content-type header + URL 扩展名 | Electron webRequest 已提供准确的 content-type |
| 剪贴板操作 | document.execCommand('copy') | Electron clipboard API | execCommand 已废弃且不可靠 |
| 进程间通信 | WebSocket / 自定义协议 | Electron IPC (ipcMain/ipcRenderer) | 项目标准，安全性有保证 |
| 容器隔离 | 手动管理 session partition | 已有容器管理机制 | containerManager + windowContainerMap 已实现 |

## Common Pitfalls

### Pitfall 1: webRequest 单监听器限制
**What goes wrong:** 在同一 session 的同一事件类型上注册第二个监听器，会静默替换第一个。现有 Client Hints 处理会被覆盖。
**Why it happens:** Electron 设计限制，每个 session 的每个 webRequest 事件只能有一个监听器。
**How to avoid:** 使用当前未被占用的事件类型（`onResponseStarted` 或 `onHeadersReceived`），不要修改现有的 `onBeforeSendHeaders` / `onSendHeaders`。
**Warning signs:** Client Hints 头突然失效，Google 登录出现问题。

### Pitfall 2: executeJavaScript 与 CSP
**What goes wrong:** 在严格 CSP 站点上，`eval()` 和内联脚本会被拦截。
**Why it happens:** Content-Security-Policy 头限制了脚本执行方式。
**How to avoid:** 使用 `webview.executeJavaScript()` 而非 `eval()`。Electron 的 executeJavaScript 通过 webContents 注入，不受页面 CSP 限制。
**Warning signs:** 检测脚本在某些网站上不工作。

### Pitfall 3: dom-ready 多次触发
**What goes wrong:** 同一 webview 的 dom-ready 可能触发多次（SPA 导航），导致 MutationObserver 重复创建。
**Why it happens:** SPA 应用的 History API 导航会触发 dom-ready 但不触发 did-navigate。
**How to avoid:** 在注入脚本中使用 `window.__realmMediaSniffer` 守卫标志防止重复初始化。
**Warning signs：** 同一视频被多次检测，列表出现重复。

### Pitfall 4: HLS 分片污染
**What goes wrong:** HLS 流的每个 .ts 分片都被检测为独立视频，列表被大量分片 URL 污染。
**Why it happens:** .ts 分片的 content-type 也是 video/mp2t。
**How to avoid:** 只报告 m3u8 播放列表 URL，过滤掉 .ts 分片。在 content-type 检测中区分 `application/vnd.apple.mpegurl`（播放列表）和 `video/mp2t`（分片）。
**Warning signs:** 媒体列表中出现大量 .ts URL。

### Pitfall 5: 跨页面导航清空时机
**What goes wrong:** 在 did-navigate 事件中清空媒体列表，但 pushState 导航也会触发 did-navigate（在某些 Electron 版本中）。
**Why it happens:** Electron 的导航事件语义在不同版本间有差异。
**How to avoid:** 在 did-navigate 处理中检查 URL 变化类型（域名/路径变化 vs 仅 hash 变化），或使用 `isInPage` 属性判断。
**Warning signs:** SPA 应用中切换页面时媒体列表被错误清空。

## Code Examples

Verified patterns from existing codebase:

### webview.executeJavaScript 注入模式
```javascript
// Source: src/renderer.js:4184-4212 (Readability 提取)
const script = `
(function() {
  try {
    // ... 检测逻辑 ...
    return JSON.stringify(results);
  } catch(e) {
    return JSON.stringify([]);
  }
})()`;
const resultStr = await webview.executeJavaScript(script);
const results = JSON.parse(resultStr || '[]');
```

### IPC 通道注册模式
```javascript
// Source: ipc-handlers.js:233-236 (container:list)
ipcMain.handle('container:list', (event) => {
  assertTrustedSender(event);
  return containerManager.getContainers();
});
```

### 主进程向渲染进程推送事件
```javascript
// Source: ipc-handlers.js:222-227 (tab:recycled)
tabManager.setRecycleListener(({ recycledTabId, message }) => {
  const win = windowManager.getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('tab:recycled', { tabId: recycledTabId, message });
  }
});
```

### 渲染进程监听主进程事件
```javascript
// Source: src/preload.js:98-100 (open-url-in-tab)
onOpenUrlInTab: (callback) => {
  ipcRenderer.on('open-url-in-tab', (event, data) => callback(data));
},
```

### session-created 中注册 webRequest
```javascript
// Source: main.js:358-414
app.on('session-created', (ses) => {
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    // ... Client Hints 处理 ...
    callback({ requestHeaders: headers });
  });

  ses.webRequest.onSendHeaders((details) => {
    // ... 日志记录 ...
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| onBeforeRequest URL 拦截 | onResponseStarted 响应头检测 | Electron 20+ | 更准确的 content-type 检测，不阻塞请求 |
| eval() 注入脚本 | webview.executeJavaScript | Electron 5+ | 绕过 CSP 限制，更安全 |
| 手动管理 session partition | containerManager 自动管理 | 项目已有 | 容器隔离开箱即用 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Electron 32.x 的 onResponseStarted 提供 resourceType 字段 | Architecture Patterns | 如果不提供，需要从 responseHeaders 手动判断，增加复杂度 |
| A2 | webview.executeJavaScript 绕过页面 CSP | Pattern 2 | 如果受 CSP 限制，需要改用 preload 注入方式 |
| A3 | dom-ready 在 SPA pushState 导航时会重新触发 | Pitfall 3 | 如果不触发，MutationObserver 不会被重复创建，守卫机制不必要但无害 |

**如果此表为空：** 所有声明均已验证或引用 — 无需用户确认。

## Open Questions

1. **播放器窗口的 HTML 文件**
   - What we know: Phase 28 才完整实现播放器功能
   - What's unclear: 本阶段 IPC-02 (media:play) 需要创建播放器窗口，但播放器 HTML 尚不存在
   - Recommendation: 本阶段创建占位 player.html，IPC-02 实现为创建窗口 + 发送 URL，播放器功能留到 Phase 28

2. **mediaAPI 命名空间位置**
   - What we know: 现有 API 都在 `window.realmAPI` 下
   - What's unclear: IPC-05 要求暴露 mediaAPI，是挂在 realmAPI 下还是独立命名空间
   - Recommendation: 按 IPC-05 要求使用独立 `window.mediaAPI`，保持模块化清晰

3. **网络检测的 webContentsId 映射**
   - What we know: onResponseStarted 的 details 包含 webContentsId
   - What we know: guestContainerMap 已有 webContentsId → containerId 映射
   - What's unclear: 需要确认 onResponseStarted 的 webContentsId 是否与 guestContainerMap 中的 ID 一致
   - Recommendation: 实现时验证此映射，如果不一致则通过 session partition 推导 containerId

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | 全部功能 | ✓ | 32.x | — |
| Node.js | 主进程运行时 | ✓ | 内置 | — |
| Chromium | webview 渲染 | ✓ | 内置 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前无测试框架） |
| Config file | none — see Wave 0 |
| Quick run command | `npm test` (if configured) |
| Full suite command | `npm test` (if configured) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SNIFF-01 | 网络拦截视频资源 | manual-only | 需要真实浏览器环境 + 视频网站 | N/A |
| SNIFF-02 | 脚本注入检测 | manual-only | 需要 webview 环境 | N/A |
| SNIFF-03 | MutationObserver 监听 | manual-only | 需要 webview 环境 | N/A |
| SNIFF-04 | URL 去重 | unit | 可对 MediaSniffer 类进行单元测试 | ❌ Wave 0 |
| SNIFF-05 | 导航清空 | manual-only | 需要 webview 导航 | N/A |
| IPC-01 | media:get-list | unit | 可对 IPC handler 进行单元测试 | ❌ Wave 0 |
| IPC-02 | media:play | manual-only | 需要 BrowserWindow | N/A |
| IPC-03 | media:copy-url | manual-only | 需要系统剪贴板 | N/A |
| IPC-04 | media:clear-list | unit | 可对 clearMediaList 进行单元测试 | ❌ Wave 0 |
| IPC-05 | mediaAPI 暴露 | manual-only | 需要 preload + contextBridge | N/A |

### Sampling Rate
- **Per task commit:** `npm test` (if configured)
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] 无测试框架 — 本阶段为集成层功能，主要依赖手动验证
- [ ] 如果需要单元测试 MediaSniffer，需先配置测试框架

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | assertTrustedSender() 验证 IPC 来源 |
| V5 Input Validation | yes | 验证 URL 格式、IPC 参数类型 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron IPC

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 恶意 IPC 调用 | Spoofing | assertTrustedSender() 验证来源窗口 |
| XSS 通过媒体 URL | Tampering | URL 格式验证，限制 http/https 协议 |
| 跨容器数据泄露 | Information Disclosure | 按 containerId 隔离数据，IPC 验证容器归属 |
| 注入脚本执行任意代码 | Elevation of Privilege | 使用 executeJavaScript 而非 eval，限制脚本范围 |

## Sources

### Primary (HIGH confidence)
- Electron 官方文档: webRequest API — `onResponseStarted`, `onCompleted`, filter 格式
- 项目源码: `main.js:358-414` — session-created 事件处理
- 项目源码: `ipc-handlers.js:219-236` — IPC 通道注册模式
- 项目源码: `src/preload.js:14-984` — contextBridge API 暴露模式
- 项目源码: `src/renderer.js:4184-4212` — executeJavaScript 注入模式

### Secondary (MEDIUM confidence)
- 项目源码: `src/renderer.js:789-870` — webview 事件绑定模式
- 项目源码: `window-manager.js:107-110` — getMainWindow 模式

### Tertiary (LOW confidence)
- Electron webRequest 单监听器限制 — 基于文档描述，未在运行时验证
- executeJavaScript 绕过 CSP — 基于 Electron 架构推断，未在严格 CSP 站点验证

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 使用 Electron 内置 API，项目已有成熟模式
- Architecture: HIGH — 基于现有代码模式推导，架构清晰
- Pitfalls: MEDIUM — webRequest 限制和 CSP 行为基于文档，未运行时验证

**Research date:** 2026-08-06
**Valid until:** 2026-09-06 (Electron 32.x 稳定，API 不会变化)
