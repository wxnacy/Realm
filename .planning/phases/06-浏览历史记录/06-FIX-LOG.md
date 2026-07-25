# Phase 06 浏览历史记录 — 问题修复记录

**日期:** 2026-07-25
**状态:** 全部完成，UAT 11/11 通过

---

## 第三轮修复（Test 5/8/9/11）

### 9. 搜索无结果时页面布局收缩居中（Test 5）

**根因:** `main.css` 的 `body { display: flex; height: 100vh; overflow: hidden }` 是主窗口布局。历史页复用后 `.history-page` 作为 flex item 未设 `flex:1`，宽度由内容决定——列表有长 URL 时撑到 max-width 800px，空状态内容少则收缩成窄条并居中。

**修复方案:** `.history-page` 添加 `flex: 1`，宽度始终撑到 max-width。

**涉及文件:** `src/styles/main.css` — `.history-page`

---

### 10. 历史页面无法上下滚动（Test 11）

**根因:** 同一 body 布局问题：`overflow: hidden` 禁止滚动，且原 `.history-page` 的 `height: 100%` + flex column 不产生滚动容器，`window` scroll 事件也不会触发，滚动加载随之失效。

**修复方案:** `.history-page` 改为 `flex: 1; overflow-y: auto` 自身作为滚动容器；`history-page.js` 滚动加载监听从 `window` 改为 `.history-page` 元素。

**涉及文件:**
- `src/styles/main.css` — `.history-page`
- `src/history-page.js` — `elements.historyPage`，滚动监听

---

### 11. 清空全部后列表未立即清除（Test 8）

**根因:** `renderEmpty()` 只 `appendChild` 空状态节点、不清空 `historyContent`，`handleClearAll()` 直接调用后旧记录 DOM 残留（刷新后消失是因为重新加载数据）。

**修复方案:** `renderEmpty()` 开头先 `elements.historyContent.innerHTML = ''`。

**涉及文件:** `src/history-page.js` — `renderEmpty()`

---

### 12. 切换容器后历史页串数据（Test 9）

**根因:** 工具栏历史按钮复用逻辑只匹配 `tab.url === 'realm://history'`，不限容器。在「默认」容器打开的历史 tab（webview URL `?container=default`），切到「金融」后点历史按钮仍复用该 tab，显示的是默认容器的数据。

**修复方案:** 复用条件增加 `tab.containerId === 当前容器`，每个容器有独立的历史 tab（与 per-container tab 设计一致，webview partition 与 `?container=` 参数始终匹配）。

**涉及文件:** `src/renderer.js` — 历史按钮 click 处理器

---

## 第二轮修复（Test 2：CSS 错乱 + 列表为空）

### 7. 历史记录页面 CSS 样式错乱（已修复）

**根因:** 页面经 `http://localhost:PORT/history` 加载，HTML 中相对路径 `styles/main.css` 和 `history-page.js` 解析到服务器根路径（`/styles/main.css`、`/history-page.js`），HTTP 服务器只路由 `/history/*`，两者均 404。CSS 未加载导致样式错乱，JS 未加载导致页面逻辑完全未执行。

**修复方案:** `history.html` 添加 `<base href="/history/">`，相对资源路径统一解析到 `/history/` 下；同时更新 CSP 放行远程 favicon（`img-src 'self' https: http: data:`）。

**涉及文件:**
- `src/history.html` — 添加 base 标签，更新 CSP

---

### 8. 历史记录列表为空（已修复）

**根因（两层）:**
1. `history-page.js` 404 未加载（同问题 7），`init()` 从未执行。
2. 更根本的架构问题：页面运行在 webview guest 中，`ipc-handlers.js` 的 `assertTrustedSender`（CR-4 安全修复）明确拒绝 webview guest 的 IPC 调用。即使 JS 加载成功，`window.realmAPI` 不存在（webview 未挂 preload），且挂载 preload 会在 webview 导航到外部站点时泄露特权 API。

**修复方案:** 内部页面数据层从 IPC 改为 HTTP API，与既有本地服务器架构统一：
- `main.js` 的 `realmServer` 新增 `/api/history/*` JSON 端点（list/search/delete/delete-batch/clear），直接调用 `historyManager`
- API 使用启动时生成的随机 token（`crypto.randomUUID()`）鉴权，防 CSRF 和 localhost 端口扫描；token 仅经 `get-realm-port` IPC 返回给受信主窗口
- `get-realm-port` 返回值从端口号改为 `{ port, token }`
- 渲染进程创建内部页面 webview 时，将 `?container=X&token=Y` 注入 URL；`httpUrlToRealm()` 显示时剥离查询参数（token 不落盘、不进地址栏）
- `history-page.js` 从 `location.search` 读取 container/token，数据操作改为 `fetch('/api/history/...')`
- favicon 回退改为 JS 事件监听（CSP 禁止 inline `onerror`/`style` 属性）

**涉及文件:**
- `main.js` — 新增 crypto 导入、REALM_TOKEN、sendJson/readJsonBody/handleHistoryApi、API 路由、get-realm-port 返回对象
- `src/renderer.js` — state.realmToken、init() 解构 {port, token}、realmUrlToHttp 附加查询参数、httpUrlToRealm 剥离查询参数
- `src/history-page.js` — 数据层全面改为 fetch HTTP API，favicon 回退改用 JS 控制

---

## 之前已修复的问题

### 1. SIGSEGV 段错误崩溃（blocker）

**根因:** `better-sqlite3` v13.0.1 与 Electron 32 不兼容。原生模块在 Electron 进程中加载时触发段错误。

**修复方案:**
- 将 `better-sqlite3` 从 v13.0.1 降级到 v11.7.0
- 将 `require('better-sqlite3')` 从模块顶层延迟到 `initDatabase()` 函数内部（app.whenReady 之后）
- 将 `app.getPath('userData')` 也延迟到 `initDatabase()` 中
- 删除 `node_modules/better-sqlite3/prebuilds/` 目录，强制从源码编译
- 运行 `npx @electron/rebuild -f -w better-sqlite3` 重新编译

**涉及文件:**
- `package.json` — better-sqlite3 版本改为 `^11.7.0`
- `history-manager.js` — 延迟加载 better-sqlite3

---

### 2. realm:// 协议 URL 未被识别为有效 URL

**根因:** 地址栏的 `normalizeUrl()` 函数只识别 `http://` 和 `https://`，`realm://history` 被当作 Google 搜索关键词。

**修复方案:** 在 `normalizeUrl()` 中添加 `realm://` 协议识别。

**涉及文件:**
- `src/renderer.js:135` — `normalizeUrl()` 函数

---

### 3. webview 拒绝加载 realm:// URL

**根因:** `createWebviewForTab()` 中的 URL scheme 白名单（WR-9）只允许 `http://` 和 `https://`，`realm://` 被拒绝，webview 根本不创建。

**修复方案:** 白名单中添加 `realm://` 协议。

**涉及文件:**
- `src/renderer.js:386` — `createWebviewForTab()` 函数

---

### 4. will-navigate 拦截器阻止 realm:// 导航

**根因:** `main.js` 中的 `will-navigate` 事件处理器通过 `isAllowedWebUrl()` 拦截所有非 http(s) 导航。

**修复方案:** `isAllowedWebUrl()` 中添加 `realm://` 协议支持。

**涉及文件:**
- `main.js` — `isAllowedWebUrl()` 函数

---

### 5. webview 无法加载自定义协议（核心架构问题）

**根因:** Electron 的 `protocol.handle()` 注册的自定义协议 `realm://` 无法被 webview 加载。webview 运行在独立的渲染进程中，无法访问主进程注册的协议处理器。`net.fetch()` 返回的 Response 对象也不被 webview 接受。

**修复方案:** 启动本地 HTTP 服务器（`http.createServer`），在随机端口监听，将 `realm://history` 映射为 `http://localhost:PORT/history`。渲染进程在初始化时获取端口号，创建 webview 前将 `realm://` URL 转换为 HTTP URL。

**涉及文件:**
- `main.js` — 新增 HTTP 服务器（`realmServer`），MIME 类型映射，`ipcMain.handle('get-realm-port')`
- `src/preload.js` — 新增 `getRealmPort` API
- `src/renderer.js` — 新增 `realmUrlToHttp()` 和 `httpUrlToRealm()` 函数，`state.realmPort` 字段，`init()` 中获取端口

---

### 6. 路径模块未导入导致 HTTP 服务器报错

**根因:** `path` 模块仅在 macOS Dock 图标代码块内 `require`，HTTP 服务器在全局作用域无法访问。

**修复方案:** 将 `const path = require('path')` 移到文件顶部。

**涉及文件:**
- `main.js` — 顶部导入 path

---

## 代码变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | better-sqlite3 降级到 ^11.7.0 |
| `history-manager.js` | 修改 | 延迟加载 better-sqlite3 和 DB_PATH |
| `main.js` | 修改 | 添加 path/http/fs/crypto 导入，本地 HTTP 服务器（静态路由 + /api/history/* JSON API + token 鉴权），isAllowedWebUrl 支持 realm://，get-realm-port 返回 {port, token} |
| `src/preload.js` | 修改 | 添加 getRealmPort API |
| `src/renderer.js` | 修改 | realmUrlToHttp 附加 container/token 查询参数，httpUrlToRealm 剥离查询参数，normalizeUrl/createWebviewForTab/did-navigate 处理，state.realmToken |
| `src/history.html` | 修改 | 添加 <base href="/history/">，CSP 放行远程 favicon |
| `src/history-page.js` | 修改 | 数据层从 IPC 改为 fetch /api/history/*，favicon 回退改用 JS 监听（CSP 合规） |

---

## 给接手者的建议

1. **优先打开 DevTools**：所有排查都应该从 DevTools 的 Console 和 Network 面板开始
2. **HTTP 服务器是核心组件**：`main.js` 中的 `realmServer` 同时承担静态页面路由（`/history/*`）和数据 API（`/api/history/*`），API 需要 URL 中的 token 参数鉴权
3. **URL 双向转换**：`realm://history` ↔ `http://localhost:PORT/history?container=X&token=Y`，涉及 renderer.js 中的 `realmUrlToHttp()` 和 `httpUrlToRealm()`（后者剥离查询参数用于显示）
4. **内部页面不能走 IPC**：webview guest 的 IPC 会被 `assertTrustedSender`（CR-4）拒绝，新增内部页面统一复用 `/api/*` HTTP 端点模式
5. **历史记录写入时机**：在 `did-navigate` 事件中通过 `window.realmAPI.historyAdd()` 写入（该调用来自受信主窗口渲染进程，不受 CR-4 影响）
