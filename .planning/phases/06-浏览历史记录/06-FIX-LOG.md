# Phase 06 浏览历史记录 — 问题修复记录

**日期:** 2026-07-25
**状态:** 未完成，需要继续修复

---

## 已修复的问题

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

## 未修复的问题

### 7. 历史记录页面 CSS 样式错乱

**现象:** 页面有 UI 元素但布局和样式不正确。

**可能原因:**
- HTTP 服务器虽然设置了 MIME 类型映射，但 CSS 文件可能未正确加载
- history.html 中的 `<link rel="stylesheet" href="styles/main.css">` 路径在 HTTP 服务器路由下可能不正确
- HTTP 服务器的路由逻辑：`/history/styles/main.css` → `src/styles/main.css`，需要验证路径映射是否正确

**排查方向:**
1. 打开 DevTools（Ctrl+Shift+I）查看 Network 面板，确认 CSS 文件是否加载成功
2. 检查 CSS 文件的请求 URL 和响应状态码
3. 验证 HTTP 服务器的文件路径映射逻辑

---

### 8. 历史记录列表为空

**现象:** 打开历史页面后记录列表为空，没有显示任何历史记录。

**可能原因:**
- `history-page.js` 未正确加载（HTTP 服务器路由问题）
- IPC 通信可能有问题（`history:list` 通道）
- `history-page.js` 中的 `containerId` 获取逻辑可能有问题（从 URL 解析容器 ID）
- 数据库中确实没有记录（需要先访问网页才会记录）
- `did-navigate` 事件中的历史写入逻辑可能有 bug

**排查方向:**
1. 打开 DevTools Console 查看 JS 错误
2. 检查 `history-page.js` 是否加载成功
3. 在 Console 中执行 `window.realmAPI.historyList('default')` 测试 IPC
4. 检查 `history.db` 文件是否存在且有数据
5. 验证 `did-navigate` 事件是否正确触发历史写入

---

## 代码变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `package.json` | 修改 | better-sqlite3 降级到 ^11.7.0 |
| `history-manager.js` | 修改 | 延迟加载 better-sqlite3 和 DB_PATH |
| `main.js` | 修改 | 添加 path/http/fs 导入，添加本地 HTTP 服务器，修改 isAllowedWebUrl 支持 realm://，添加 ipcMain.handle('get-realm-port') |
| `src/preload.js` | 修改 | 添加 getRealmPort API |
| `src/renderer.js` | 修改 | 添加 realmUrlToHttp/httpUrlToRealm 函数，修改 normalizeUrl/createWebviewForTab/did-navigate 处理 |

---

## 给接手者的建议

1. **优先打开 DevTools**：所有排查都应该从 DevTools 的 Console 和 Network 面板开始
2. **HTTP 服务器是新增的**：`main.js` 中的 `realmServer` 是本次新增的核心组件，理解它的路由逻辑是关键
3. **URL 双向转换**：`realm://history` ↔ `http://localhost:PORT/history`，涉及 renderer.js 中的 `realmUrlToHttp()` 和 `httpUrlToRealm()`
4. **历史记录写入时机**：在 `did-navigate` 事件中，通过 `window.realmAPI.historyAdd()` 写入，需要验证这个流程是否正常
5. **历史记录读取**：`history-page.js` 通过 `window.realmAPI.historyList()` 读取数据，需要验证容器 ID 是否正确传递
