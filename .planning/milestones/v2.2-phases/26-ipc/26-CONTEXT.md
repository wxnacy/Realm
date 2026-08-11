# Phase 26: 视频源检测 + IPC 基础 - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

<domain>
## Phase Boundary

在任意容器中浏览网页时，系统自动检测页面中的视频资源 URL（通过网络拦截、脚本注入、DOM 监听三种方式），并通过 IPC 通道将检测结果暴露给渲染进程。媒体列表按容器隔离，仅内存存储，页面导航时自动清空。

</domain>

<decisions>
## Implementation Decisions

### 嗅探器架构
- **D-01:** 三种检测方式（webRequest 拦截、脚本注入、MutationObserver）封装在单一 MediaSniffer 类中，统一管理检测结果和生命周期
- **D-02:** 嗅探器代码放在主进程 `media-sniffer.js` 文件中，所有嗅探逻辑在主进程运行，通过 IPC 向渲染进程推送结果
- **D-03:** 脚本注入在 webview 的 `dom-ready` 事件中执行，同时启动 MutationObserver 监听 DOM 变化
- **D-04:** MutationObserver 监听整个 `document.body`，配置 `childList + subtree + attributes`，覆盖所有动态加载场景

### 媒体数据模型
- **D-05:** 同一容器内相同 URL 只保留一条记录（URL 去重）
- **D-06:** 每条记录包含扩展字段：url、type (m3u8/mp4/flv/webm)、source (network/script/dom)、timestamp、title、duration、thumbnail (poster)
- **D-07:** 内存中使用 `Map<containerId, MediaItem[]>` 按容器 ID 分组存储，每个容器独立的数组
- **D-08:** 媒体列表仅保存在内存中，应用关闭后清空，下次打开页面重新检测

### 列表更新通知机制
- **D-09:** 主进程通过 `webContents.send('media:list-updated', data)` 向渲染进程推送更新，渲染进程通过 `ipcRenderer.on` 订阅
- **D-10:** 每次检测到新媒体立即通知渲染进程，不做防抖
- **D-11:** 每次通知携带完整的当前容器媒体列表，渲染进程直接替换本地数据
- **D-12:** 每个 BrowserWindow 有独立的媒体列表，互不影响（为未来多窗口预留）

### 导航生命周期
- **D-13:** 在 webview 的 `did-navigate` 事件中清空当前容器的媒体列表
- **D-14:** 只在跨页面导航（URL 域名/路径变化）时清空，页内锚点跳转不清空
- **D-15:** 切换容器时保留所有容器的媒体列表，不清空任何容器
- **D-16:** 关闭 Tab 时清空该 Tab 所属容器的媒体列表

### Claude's Discretion
无 — 所有决策均由用户明确选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` §SNIFF — 视频源检测需求 SNIFF-01~05
- `.planning/REQUIREMENTS.md` §IPC — 媒体 IPC 通道需求 IPC-01~05
- `.planning/ROADMAP.md` §Phase 26 — 阶段目标和成功标准

### 现有代码参考
- `main.js:358-414` — `session-created` 事件中 `ses.webRequest` 的现有用法（onBeforeSendHeaders/onSendHeaders）
- `src/renderer.js:1181,1442,1586` — `webview.executeJavaScript` 的现有用法
- `src/preload.js` — contextBridge API 暴露模式（window.realmAPI）
- `main.js:1677-1951` — 现有 IPC 通道注册模式（favorites:*, bookmarks-bar:*, script:*）

### 代码库地图
- `.planning/codebase/STACK.md` — 技术栈（Electron 32.x, JavaScript ES6+）
- `.planning/codebase/INTEGRATIONS.md` — IPC 通信机制和现有 API 列表

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ses.webRequest` — 已在 main.js 中用于 Client Hints 头修改，可复用同一机制拦截媒体类型响应
- `webview.executeJavaScript` — 已在 renderer.js 中用于 Readability 提取和页面操控，可复用注入检测脚本
- `contextBridge.exposeInMainWorld` — 已在 preload.js 中暴露 realmAPI，可按同样模式暴露 mediaAPI
- `ipcMain.handle` / `ipcRenderer.invoke` — 现有 IPC 通信模式，media:* 通道遵循同一模式

### Established Patterns
- IPC 通道命名：`动词:名词` 格式（如 `favorites:create-folder`、`script:execute`）
- 容器隔离：通过 `persist:container-{id}` partition 实现，嗅探器需按 partition 分组存储媒体
- 窗口-容器映射：`windowContainerMap` 已存在，可复用确定当前窗口的容器 ID
- 日志前缀：`[Realm]` 用于主进程，`[Realm Renderer]` 用于渲染进程

### Integration Points
- `app.on('session-created')` — 注册 webRequest 拦截器的入口点（main.js:358）
- webview 的 `dom-ready` 事件 — 注入检测脚本的时机点
- `ipc-handlers.js` — 可选的 IPC 通道注册位置（或直接在 main.js 中注册）
- `src/preload.js` — 暴露 mediaAPI 的位置

</code_context>

<specifics>
## Specific Ideas

无特殊要求 — 用户选择了标准推荐方案

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-视频源检测 + IPC 基础*
*Context gathered: 2026-08-06*
