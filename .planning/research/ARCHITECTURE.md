# Architecture Research — Download Manager + Autofill (v2.3)

**Domain:** Electron 32.x 多容器隔离浏览器 — 下载管理器与自动填充
**Researched:** 2026-08-11
**Confidence:** HIGH

## Executive Summary

本研究聚焦 v2.3 新增的下载管理器（DL-01~05）和自动填充（AF-01~04）功能的架构设计。核心原则：**遵循现有模式** — 主进程承载业务逻辑，渲染进程负责 UI，通过 IPC 通信，数据按容器隔离。

下载管理器应作为独立模块 `download-manager.js` 在主进程运行，利用 Electron 原生 `session.on('will-download')` 事件拦截下载，通过 SQLite 持久化下载历史（复用 better-sqlite3），进度通过 IPC 实时推送到渲染进程。

自动填充凭据应存储在独立的 SQLite 数据库中（`autofill.db`），使用 Electron `safeStorage` API 加密密码字段（macOS Keychain 后端），按容器隔离存储。表单匹配在渲染进程完成（需要 DOM 上下文），凭据读写通过 IPC 走主进程。

## Download Manager Architecture

### 为什么在主进程

1. **Electron API 要求**：`session.on('will-download')` 只能在主进程注册
2. **Session 隔离**：每个容器的 session 独立，下载自然按容器隔离
3. **文件系统访问**：`dialog.showSaveDialog()` 和文件操作在主进程更自然
4. **一致性**：与 history-manager、favorites-manager 的模式一致

### 核心组件

```
Main Process (新增)
├── download-manager.js     # 下载管理核心模块
│   ├── DownloadManager 类
│   ├── 会话级 will-download 监听器
│   ├── SQLite 持久化（download_history 表）
│   └── 下载状态机（progress → completed/cancelled/interrupted）
│
├── ipc-handlers.js (修改)
│   └── download:* IPC 通道注册

Renderer Process (修改)
├── download-panel.js       # 下载面板 UI 逻辑（新增）
├── renderer.js (修改)
│   └── 下载按钮/面板交互
└── preload.js (修改)
    └── downloadAPI 暴露
```

### 数据模型

```sql
-- 下载历史表（全局共享，通过 container_id 区分容器）
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id TEXT NOT NULL,          -- 来源容器 ID
  url TEXT NOT NULL,                   -- 下载源 URL
  filename TEXT NOT NULL,              -- 文件名
  save_path TEXT NOT NULL,             -- 保存路径
  mime_type TEXT,                      -- MIME 类型
  total_bytes INTEGER DEFAULT 0,       -- 文件总大小
  received_bytes INTEGER DEFAULT 0,    -- 已下载大小
  state TEXT DEFAULT 'progressing',    -- progressing | completed | cancelled | interrupted
  start_time INTEGER NOT NULL,         -- 开始时间戳
  end_time INTEGER,                    -- 结束时间戳
  error_message TEXT,                  -- 错误信息（interrupted 时）
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_downloads_container ON downloads(container_id);
CREATE INDEX IF NOT EXISTS idx_downloads_state ON downloads(state);
```

### 状态机

```
                    ┌─────────────┐
                    │  will-download │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ progressing  │◄──── pause() / resume()
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────────┐
       │completed │ │cancelled │ │ interrupted  │
       └──────────┘ └──────────┘ └──────────────┘
```

### IPC 通道设计

| 通道 | 方向 | 参数 | 返回值 | 说明 |
|------|------|------|--------|------|
| `download:list` | renderer→main | `{containerId?, state?, limit?, offset?}` | `Array<DownloadItem>` | 查询下载历史 |
| `download:pause` | renderer→main | `{id}` | `{success}` | 暂停下载 |
| `download:resume` | renderer→main | `{id}` | `{success}` | 恢复下载 |
| `download:cancel` | renderer→main | `{id}` | `{success}` | 取消下载 |
| `download:open` | renderer→main | `{id}` | `{success}` | 打开文件 |
| `download:show` | renderer→main | `{id}` | `{success}` | 在 Finder 中显示 |
| `download:delete` | renderer→main | `{id, deleteFile?}` | `{success}` | 删除记录（可选删文件） |
| `download:clear` | renderer→main | `{containerId?, state?}` | `{count}` | 清空历史 |
| `download:retry` | renderer→main | `{id}` | `{success}` | 重新下载（interrupted） |
| `download:progress` | main→renderer | `DownloadItem` | - | 进度推送（实时） |
| `download:started` | main→renderer | `DownloadItem` | - | 新下载开始 |
| `download:done` | main→renderer | `DownloadItem` | - | 下载完成/取消/中断 |

### will-download 拦截流程

```javascript
// download-manager.js 核心逻辑
function setupSessionDownloadListener(containerId) {
  const ses = session.fromPartition(`persist:container-${containerId}`);

  ses.on('will-download', (event, item, webContents) => {
    // 1. 弹出保存对话框（或使用默认路径）
    const savePath = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });

    if (savePath.canceled) {
      item.cancel();
      return;
    }

    item.setSavePath(savePath.filePath);

    // 2. 记录到 SQLite
    const record = insertDownload({
      containerId,
      url: item.getURL(),
      filename: item.getFilename(),
      savePath: item.getSavePath(),
      mimeType: item.getMimeType(),
      totalBytes: item.getTotalBytes()
    });

    // 3. 通知渲染进程
    sendToRenderer('download:started', record);

    // 4. 监听进度
    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        updateDownloadProgress(record.id, item.getReceivedBytes());
        sendToRenderer('download:progress', {
          id: record.id,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes()
        });
      }
    });

    // 5. 监听完成
    item.on('done', (event, state) => {
      updateDownloadState(record.id, state);
      sendToRenderer('download:done', { id: record.id, state });
    });
  });
}
```

### 保存对话框策略

**推荐：先弹对话框再下载**（DL-05 要求）

- 默认路径：`app.getPath('downloads')` + 原始文件名
- 用户取消 → `item.cancel()`，不记录
- 支持"始终保存到此目录"设置（electron-store）

**备选：静默下载到临时目录，完成后提示**

- 优点：不打断用户
- 缺点：不符合 DL-05 需求，且需要额外的"移动文件"逻辑

### 下载进度节流

进度更新频率需要节流，避免高频 IPC 冲刷渲染进程：

```javascript
// 节流：最多每 200ms 推送一次进度
const PROGRESS_THROTTLE_MS = 200;
let lastProgressTime = 0;

item.on('updated', (event, state) => {
  const now = Date.now();
  if (now - lastProgressTime < PROGRESS_THROTTLE_MS) return;
  lastProgressTime = now;
  // ... 发送进度
});
```

## Autofill Architecture

### 存储架构

**核心决策：凭据存储在主进程，按容器隔离**

```
Main Process (新增)
├── autofill-manager.js     # 自动填充核心模块
│   ├── AutofillManager 类
│   ├── SQLite 持久化（autofill.db）
│   ├── safeStorage 加密/解密
│   └── 域名匹配逻辑
│
├── ipc-handlers.js (修改)
│   └── autofill:* IPC 通道注册

Renderer Process (修改)
├── autofill-bridge.js      # 自动填充桥接（webview guest 内）
│   ├── 表单检测（MutationObserver）
│   ├── 凭据填充（DOM 操作）
│   └── 登录提交监听
└── preload.js (修改)
    └── autofillAPI 暴露
```

### 为什么用 safeStorage 而不是 Keytar

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Electron safeStorage** ✓ | 原生支持，macOS 用 Keychain，零依赖 | 仅加密字符串，需自建存储 |
| keytar | 专门管理密码 | 已弃用，原生模块打包复杂 |
| 明文 SQLite | 简单 | 安全性差，密码不应明文存储 |

**选择 safeStorage**：Electron 原生 API，macOS 后端是系统 Keychain，无需额外依赖。

### 数据模型

```sql
-- 自动填充凭据表（按容器隔离）
CREATE TABLE IF NOT EXISTS autofill_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id TEXT NOT NULL,          -- 来源容器 ID
  origin TEXT NOT NULL,                -- 网站 origin（https://example.com）
  username_encrypted BLOB NOT NULL,    -- 加密的用户名（safeStorage.encryptString）
  username_hash TEXT NOT NULL,         -- 用户名哈希（用于去重查询，不加密）
  password_encrypted BLOB NOT NULL,    -- 加密的密码
  field_names TEXT,                    -- JSON: {username: 'email', password: 'pass'}
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(container_id, origin, username_hash)
);

-- 自动填充地址表（按容器隔离）
CREATE TABLE IF NOT EXISTS autofill_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id TEXT NOT NULL,
  label TEXT NOT NULL,                 -- 地址标签（如"家"、"公司"）
  name_encrypted BLOB,
  email_encrypted BLOB,
  phone_encrypted BLOB,
  address_encrypted BLOB,             -- JSON: {street, city, state, zip, country}
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_credentials_container_origin
  ON autofill_credentials(container_id, origin);
```

### 加密流程

```javascript
const { safeStorage } = require('electron');

// 加密
function encryptField(plaintext) {
  return safeStorage.encryptString(plaintext);
}

// 解密
function decryptField(encrypted) {
  return safeStorage.decryptString(encrypted);
}

// 保存凭据
async function saveCredential(containerId, origin, username, password) {
  const usernameEncrypted = encryptField(username);
  const passwordEncrypted = encryptField(password);
  const usernameHash = crypto.createHash('sha256').update(username).digest('hex');

  db.prepare(`
    INSERT OR REPLACE INTO autofill_credentials
    (container_id, origin, username_encrypted, username_hash, password_encrypted)
    VALUES (?, ?, ?, ?, ?)
  `).run(containerId, origin, usernameEncrypted, usernameHash, passwordEncrypted);
}
```

### 表单检测与填充流程

**关键决策：检测和填充在 webview guest 的 preload 中完成**

原因：
1. 表单 DOM 在 webview guest 内部，主进程无法直接访问
2. 填充需要操作 DOM（设置 input.value），必须在渲染进程
3. webview guest 已有 preload 脚本（`webview-preload.js`），可以扩展

```javascript
// webview-preload.js 扩展（在 webview guest 内执行）
const { contextBridge, ipcRenderer } = require('electron');

// 检测登录表单
function detectLoginForm() {
  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    const passwordInput = form.querySelector('input[type="password"]');
    if (!passwordInput) continue;

    const usernameInput = form.querySelector(
      'input[type="text"], input[type="email"], input[name="username"], input[name="email"]'
    );

    if (usernameInput) {
      return {
        origin: window.location.origin,
        usernameField: usernameInput.name || usernameInput.id,
        passwordField: passwordInput.name || passwordInput.id
      };
    }
  }
  return null;
}

// 监听表单提交
function watchFormSubmit() {
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    const passwordInput = form.querySelector('input[type="password"]');
    if (!passwordInput) return;

    const usernameInput = form.querySelector(
      'input[type="text"], input[type="email"]'
    );

    if (usernameInput && passwordInput.value) {
      // 通知主进程保存凭据
      ipcRenderer.send('autofill:save-credential', {
        origin: window.location.origin,
        username: usernameInput.value,
        password: passwordInput.value,
        fieldNames: {
          username: usernameInput.name || usernameInput.id,
          password: passwordInput.name || passwordInput.id
        }
      });
    }
  }, true); // capture phase，早于页面的 submit 处理
}

// 请求填充凭据
async function requestAutofill() {
  const form = detectLoginForm();
  if (!form) return;

  const credentials = await ipcRenderer.invoke('autofill:get-credentials', {
    origin: form.origin
  });

  if (credentials && credentials.length > 0) {
    // 填充第一个匹配的凭据
    const cred = credentials[0];
    const usernameInput = document.querySelector(`[name="${cred.fieldNames.username}"], #${cred.fieldNames.username}`);
    const passwordInput = document.querySelector(`[name="${cred.fieldNames.password}"], #${cred.fieldNames.password}`);

    if (usernameInput) usernameInput.value = cred.username;
    if (passwordInput) passwordInput.value = cred.password;
  }
}

// 页面加载完成后检测
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    watchFormSubmit();
    requestAutofill();
  });
} else {
  watchFormSubmit();
  requestAutofill();
}
```

### IPC 通道设计

| 通道 | 方向 | 参数 | 返回值 | 说明 |
|------|------|------|--------|------|
| `autofill:get-credentials` | guest→main | `{origin}` | `Array<Credential>` | 获取匹配凭据（解密） |
| `autofill:save-credential` | guest→main | `{origin, username, password, fieldNames}` | `{success}` | 保存凭据（加密） |
| `autofill:delete-credential` | renderer→main | `{id}` | `{success}` | 删除凭据 |
| `autofill:list-credentials` | renderer→main | `{containerId?, origin?}` | `Array<Credential>` | 列出凭据 |
| `autofill:get-addresses` | renderer→main | `{containerId}` | `Array<Address>` | 获取地址列表 |
| `autofill:save-address` | renderer→main | `{containerId, address}` | `{success}` | 保存地址 |
| `autofill:delete-address` | renderer→main | `{id}` | `{success}` | 删除地址 |
| `autofill:fill-address` | renderer→main | `{id}` | `Address` | 获取地址详情（解密） |

### 安全考量

1. **safeStorage 限制**：
   - macOS：数据在 Keychain 中，应用签名变化后无法解密
   - 首次使用前检查 `safeStorage.isEncryptionAvailable()`，不可用时降级为不存储密码

2. **内存中的明文**：
   - 解密后的密码仅在 IPC 处理函数的栈帧内存在
   - 不缓存解密后的密码到全局变量
   - 渲染进程填充后立即清除引用

3. **容器隔离**：
   - 凭据表包含 `container_id` 字段
   - 查询时强制带上容器 ID 条件
   - 容器删除时级联删除该容器的凭据

## Integration Points

### 与现有模块的集成

| 现有模块 | 集成方式 | 修改点 |
|---------|---------|--------|
| `main.js` | 初始化 download-manager 和 autofill-manager | 添加模块 require 和初始化 |
| `ipc-handlers.js` | 注册新 IPC 通道 | 添加 download:* 和 autofill:* 通道 |
| `src/preload.js` | 暴露新 API | 添加 downloadAPI 和 autofillAPI |
| `src/renderer.js` | 下载面板 UI | 添加下载按钮和面板逻辑 |
| `webview-preload.js` | 表单检测和填充 | 添加表单监听和填充逻辑 |
| `session.fromPartition()` | 下载拦截 | 在容器创建时注册 will-download 监听 |

### 新增文件

| 文件 | 职责 | 估计行数 |
|------|------|---------|
| `download-manager.js` | 下载管理核心（拦截、持久化、状态机） | 200-250 |
| `autofill-manager.js` | 自动填充核心（加密存储、域名匹配） | 150-200 |
| `src/download-panel.js` | 下载面板 UI 逻辑 | 150-200 |
| `src/download-panel.css` | 下载面板样式 | 100-150 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `main.js` | 引入并初始化 download-manager、autofill-manager |
| `ipc-handlers.js` | 注册 download:* 和 autofill:* IPC 通道 |
| `src/preload.js` | 添加 downloadAPI 和 autofillAPI |
| `src/renderer.js` | 下载按钮、面板交互 |
| `src/index.html` | 下载面板 HTML 结构 |
| `src/styles/main.css` | 下载面板样式 |
| `webview-preload.js` | 表单检测、凭据填充逻辑 |

## Data Flow

### 下载流程

```
1. 用户在 webview 中点击下载链接
   │
   ▼
2. Chromium 发起下载请求
   │
   ▼
3. Session.on('will-download') 触发（主进程）
   │
   ▼
4. 弹出保存对话框（dialog.showSaveDialog）
   │
   ├── 用户取消 → item.cancel()，流程结束
   │
   └── 用户选择路径 → item.setSavePath(path)
   │
   ▼
5. 插入下载记录到 SQLite
   │
   ▼
6. 发送 'download:started' 到渲染进程
   │
   ▼
7. item.on('updated') → 节流推送进度
   │
   ▼
8. item.on('done') → 更新状态为 completed/cancelled/interrupted
   │
   ▼
9. 发送 'download:done' 到渲染进程
```

### 自动填充流程

```
1. webview 加载页面，DOMContentLoaded 触发
   │
   ▼
2. webview-preload.js 检测登录表单
   │
   ├── 未检测到表单 → 流程结束
   │
   └── 检测到表单 → 发送 autofill:get-credentials IPC
   │
   ▼
3. 主进程查询 SQLite（解密凭据）
   │
   ├── 无匹配凭据 → 返回空数组
   │
   └── 有匹配凭据 → 返回凭据列表
   │
   ▼
4. webview-preload.js 填充表单字段
   │
   ▼
5. 用户提交表单
   │
   ▼
6. webview-preload.js 拦截 submit 事件
   │
   ▼
7. 发送 autofill:save-credential IPC（主进程）
   │
   ▼
8. 主进程加密并存储到 SQLite
```

## Build Order

### 阶段划分

```
Phase A: Download Manager 核心（DL-01, DL-05）
├── download-manager.js 核心模块
├── will-download 拦截 + 保存对话框
├── SQLite 持久化
├── 进度 IPC 推送
└── 下载面板 UI

Phase B: Download Manager 增强（DL-02, DL-03, DL-04）
├── 下载历史列表
├── 暂停/恢复/取消
├── 文件操作（打开/Finder/删除）
└── 重试（interrupted 状态）

Phase C: Autofill 核心（AF-01, AF-02）
├── autofill-manager.js 核心模块
├── safeStorage 加密/解密
├── SQLite 持久化
├── webview-preload.js 表单检测
└── 凭据填充逻辑

Phase D: Autofill 增强（AF-03, AF-04）
├── 凭据管理 UI
├── 地址表单支持
└── 设置页集成
```

### 依赖关系

```
Phase A ──► Phase B （B 依赖 A 的基础模块）
Phase C ──► Phase D （D 依赖 C 的基础模块）
Phase A ∥ Phase C （可并行，无依赖）
```

### 最小可验证切片

**Phase A 的最小切片**：
1. `download-manager.js`：监听 will-download，弹出保存对话框，记录到 SQLite
2. `ipc-handlers.js`：注册 `download:list` 通道
3. `renderer.js`：下载按钮点击 → 显示下载计数

**Phase C 的最小切片**：
1. `autofill-manager.js`：SQLite 表创建 + safeStorage 加密/解密
2. `webview-preload.js`：检测登录表单，发送 IPC
3. 主进程：接收凭据，加密存储

## Sources

- [Electron DownloadItem API](https://www.electronjs.org/docs/latest/api/download-item)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron Session Events](https://www.electronjs.org/docs/latest/api/session#instance-events)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- 现有代码模式：history-manager.js, favorites-manager.js, cookie-manager.js

---

*Last updated: 2026-08-11*
