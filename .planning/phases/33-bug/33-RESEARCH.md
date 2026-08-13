# Phase 33: 自动填充 — 增强 - Research

**Researched:** 2026-08-13
**Domain:** 凭据管理 UI + 地址表单检测/存储/自动填充
**Confidence:** HIGH

## Summary

Phase 33 在 Phase 32（凭据引擎）基础上扩展两个核心能力：(1) 设置页凭据管理 UI——表格列表、搜索、展开详情、批量删除；(2) 地址表单功能——检测、保存横幅、存储、自动填充。

Phase 32 已建立完整的基础设施：`credential-manager.js`（SQLite + safeStorage 加密）、`webview-preload.js`（FormDetector 表单检测框架 + AutofillEngine 填充引擎）、`credential-save-banner` UI、`credentialAPI` IPC 接口。Phase 33 的核心工作是**扩展**而非重建——凭据管理需要在 `credential-manager.js` 新增 `listCredentials` 和 `batchDelete` 函数，并在设置页新增 `#settings-autofill` section；地址功能需要新增 `address-manager.js` 模块、`addresses` SQLite 表、地址表单检测逻辑（复用 FormDetector 框架）、地址保存横幅（复用 credential-save-banner 模式）、地址自动填充（复用 AutofillEngine）。

**关键发现：** 设置页（`realm://settings`）运行在 webview guest 中，IPC 被 `assertTrustedSender` 拒绝，数据访问必须走 `/api/*` HTTP 端点（token 鉴权）。凭据管理和地址管理的 API 需要在 `main.js` 中注册 HTTP 路由，而非仅注册 IPC handler。

**Primary recommendation:** 复用 Phase 32 的所有模式——SQLite 单表 + container_id 列、safeStorage 加密、FormDetector 框架、save-banner UI、HTTP API 路由。新增 `credential-manager.js` 的 list/batch 函数和独立的 `address-manager.js` 模块。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**凭据管理 UI (AF-04):**
- **D-01:** 展示形态：表格列表（类似 Chrome 设置页密码管理器）
- **D-02:** 详情交互：展开式详情（点击行展开显示密码和删除按钮）
- **D-03:** 搜索功能：顶部搜索框，按网站域名或用户名过滤
- **D-04:** 删除方式：支持批量删除（选中多条凭据后批量删除）

**地址表单字段:**
- **D-05:** 字段定义：基础三字段 — 姓名、手机号、详细地址（省市区+街道+门牌号）
- **D-06:** 存储策略：每个容器单地址（覆盖写入）
- **D-07:** 保存方式：弹出提示横幅（类似凭据保存），用户确认后保存
- **D-08:** 管理功能：设置页支持查看+编辑已保存的地址

**地址表单检测:**
- **D-09:** 检测策略：多字段特征匹配（姓名、手机号、地址字段特征）
- **D-10:** 匹配阈值：2/3 匹配（三个字段中匹配到 2 个即触发）
- **D-11:** 检测关系：统一检测逻辑（与登录表单共用检测框架）
- **D-12:** 检测时机：单次检测（页面加载完成后检测一次）

### Claude's Discretion
无 — 用户对所有问题都做出了明确选择。

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AF-04 | 用户可以在设置页查看和删除已保存的凭据 | 需扩展 credential-manager.js（新增 list/batch-delete），新增 /api/credentials/* HTTP 路由，新增 settings.html #settings-autofill section + settings-page.js 凭据管理逻辑 |
| AF-06 | 用户可以保存地址表单信息（姓名、电话、地址） | 需新建 address-manager.js 模块 + addresses SQLite 表，复用 FormDetector 框架扩展地址检测，复用 credential-save-banner 模式做地址保存横幅 |
| AF-07 | 用户可以在地址表单中自动填充已保存的地址信息 | 复用 AutofillEngine 填充框架，扩展 webview-preload.js 地址填充逻辑，通过 IPC 从主进程获取地址数据 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 凭据列表/搜索/删除 API | Main Process (HTTP API) | — | 设置页在 webview guest 中，无法直接 IPC，走 /api/* HTTP 端点 |
| 凭据加密存储 | Main Process (credential-manager.js) | — | safeStorage 仅在主进程可用 |
| 地址存储/查询/删除 API | Main Process (HTTP API) | — | 同凭据，设置页需 HTTP 访问 |
| 地址加密存储 | Main Process (address-manager.js) | — | safeStorage 仅在主进程可用 |
| 凭据管理表格 UI | Renderer (settings-page.js in webview) | — | 设置页渲染逻辑 |
| 地址管理卡片 UI | Renderer (settings-page.js in webview) | — | 设置页渲染逻辑 |
| 地址表单检测 | Webview Preload (webview-preload.js) | — | 需要 DOM 上下文访问页面 input 元素 |
| 地址自动填充 | Webview Preload (webview-preload.js) | — | 需要 DOM 上下文设置 input 值 |
| 地址保存横幅 UI | Renderer (renderer.js in main window) | — | 横幅在主窗口工具栏下方，非 webview 内 |
| 地址保存横幅 IPC | Main Process (ipc-handlers.js) | — | address:save/get/delete IPC handler |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 已安装 | 地址数据持久化存储 | Phase 30-32 已验证，共享 history.db |
| Electron safeStorage | 内置 | 地址数据加密（macOS Keychain） | Phase 32 已验证，异步 API |
| Electron contextBridge | 内置 | 安全 IPC 暴露 | 项目标准模式 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide SVG | 内联 | 设置页图标 | 自动填充侧边栏图标（锁 + 地址图标） |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTTP API（设置页数据访问） | IPC + preload 注入 | webview guest 的 IPC 被 assertTrustedSender 拒绝，HTTP API 是唯一可行方案 |
| 独立 addresses 数据库 | 共享 history.db | 共享库简化备份和路径管理，Phase 30-32 已验证 |

**Installation:**
```bash
# 无新依赖安装 — 全部使用已有基础设施
```

**Version verification:** 不适用 — 无新包安装。

## Package Legitimacy Audit

> 本阶段不安装任何外部包。所有功能基于已有依赖（better-sqlite3、Electron 内置 API）实现。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| better-sqlite3 | npm | 已安装 | — | — | OK | 已有 |
| electron | npm | 已安装 | — | — | OK | 已有 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
用户操作
    │
    ├─ 设置页（webview guest: realm://settings）
    │   ├─ 凭据管理表格 ──HTTP GET──> /api/credentials/list ──> credential-manager.js ──> SQLite
    │   ├─ 凭据搜索     ──HTTP GET──> /api/credentials/search ──> credential-manager.js ──> SQLite
    │   ├─ 凭据删除     ──HTTP POST──> /api/credentials/delete ──> credential-manager.js ──> SQLite
    │   ├─ 凭据批量删除 ──HTTP POST──> /api/credentials/batch-delete ──> credential-manager.js ──> SQLite
    │   ├─ 地址查看     ──HTTP GET──> /api/address/get ──> address-manager.js ──> SQLite
    │   ├─ 地址编辑     ──HTTP POST──> /api/address/save ──> address-manager.js ──> safeStorage ──> SQLite
    │   └─ 地址删除     ──HTTP POST──> /api/address/delete ──> address-manager.js ──> SQLite
    │
    ├─ 浏览页面（webview guest: 外部网站）
    │   ├─ 地址表单检测 ──ipc-message──> renderer ──IPC──> 主进程（检查 never-save）
    │   ├─ 地址保存横幅 ──用户确认──> IPC address:save ──> address-manager.js ──> safeStorage ──> SQLite
    │   └─ 地址自动填充 ──IPC address:get ──> address-manager.js ──> 解密 ──> webview.send ──> AutofillEngine
    │
    └─ 主窗口（renderer process）
        └─ 地址保存横幅 UI（工具栏下方，复用 credential-save-banner 定位）
```

### Recommended Project Structure

```
根目录/
├── credential-manager.js    # 已有 — 需扩展 listCredentials / batchDelete / searchCredentials
├── address-manager.js       # 新建 — 地址存储模块（SQLite + safeStorage）
├── ipc-handlers.js          # 已有 — 需扩展 address:* IPC handler
├── main.js                  # 已有 — 需扩展 /api/credentials/* 和 /api/address/* HTTP 路由
├── src/
│   ├── settings.html        # 已有 — 需新增 #settings-autofill section + 侧边栏项
│   ├── settings-page.js     # 已有 — 需新增凭据管理 + 地址管理逻辑
│   ├── webview-preload.js   # 已有 — 需扩展地址表单检测 + 地址自动填充
│   ├── preload.js           # 已有 — 需暴露 addressAPI
│   ├── renderer.js          # 已有 — 需新增地址保存横幅逻辑
│   ├── index.html           # 已有 — 需新增地址保存横幅 HTML
│   └── styles/
│       └── main.css         # 已有 — 需新增凭据表格 + 地址卡片 + 地址横幅样式
```

### Pattern 1: 凭据管理 HTTP API（设置页数据访问）

**What:** 设置页在 webview guest 中运行，IPC 被 assertTrustedSender 拦截。所有数据访问走 /api/* HTTP 端点，token 鉴权。

**When to use:** 任何需要从设置页（realm://settings）访问主进程数据的场景。

**Example:**
```javascript
// main.js — HTTP API 路由注册（参考 /api/downloads/* 模式）
// Source: main.js:1257-1342 (handleDownloadsApi 模式)

async function handleCredentialsApi(req, res, reqUrl) {
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  try {
    const route = reqUrl.pathname.replace('/api/credentials/', '');

    // GET /api/credentials/list?containerId=xxx
    if (route === 'list' && req.method === 'GET') {
      const containerId = reqUrl.searchParams.get('containerId') || '';
      const credentials = credentialManager.listCredentials(containerId);
      sendJson(res, 200, { success: true, credentials });
      return;
    }

    // POST /api/credentials/delete — 单条删除
    if (route === 'delete' && req.method === 'POST') {
      const { containerId, origin } = await readJsonBody(req);
      sendJson(res, 200, credentialManager.deleteCredential(containerId, origin));
      return;
    }

    // POST /api/credentials/batch-delete — 批量删除
    if (route === 'batch-delete' && req.method === 'POST') {
      const { containerId, origins } = await readJsonBody(req);
      sendJson(res, 200, credentialManager.batchDelete(containerId, origins));
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    sendJson(res, 400, { error: err.message });
  }
}

// realmServer 路由注册（参考 main.js:1496-1555 模式）
if (reqPath.startsWith('/api/credentials/')) {
  handleCredentialsApi(req, res, reqUrl);
  return;
}
```

```javascript
// settings-page.js — 设置页调用 HTTP API（参考 settingsApi 模式）
// Source: settings-page.js:54-61

async function credentialsApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/credentials/${route}?${params.toString()}`, options);
  if (!res.ok) throw new Error(`凭据 API 请求失败: ${res.status}`);
  return res.json();
}

// 加载凭据列表
async function loadCredentials() {
  const containerId = pageParams.get('container') || 'default';
  const result = await credentialsApi('list', {}, { containerId });
  renderCredentialTable(result.credentials);
}
```

### Pattern 2: 地址管理模块（address-manager.js）

**What:** 独立的地址存储模块，与 credential-manager.js 结构一致——SQLite 单表 + safeStorage 加密 + container_id 列。

**When to use:** 新增数据存储模块时遵循此模式。

**Example:**
```javascript
// address-manager.js — 参考 credential-manager.js 结构
// Source: credential-manager.js 全文

const path = require('path');
const { app, safeStorage } = require('electron');
let Database = null;
let DB_PATH = null;
let db = null;

function initDatabase() {
  if (db) return;
  if (!Database) {
    Database = require('better-sqlite3');
    DB_PATH = path.join(app.getPath('userData'), 'history.db');
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // 每个容器单地址（D-06）：UNIQUE 约束 (container_id)
  db.exec(`
    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL UNIQUE,
      encrypted_name BLOB NOT NULL DEFAULT X'',
      encrypted_phone BLOB NOT NULL DEFAULT X'',
      encrypted_address BLOB NOT NULL DEFAULT X'',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_addresses_container_id ON addresses (container_id);
  `);
}
```

### Pattern 3: 地址表单检测（复用 FormDetector 框架）

**What:** 在 webview-preload.js 的 FormDetector 中新增地址表单检测方法，与登录表单检测统一框架（D-11）。

**When to use:** 需要在 webview 中检测 DOM 元素时。

**Example:**
```javascript
// webview-preload.js — 扩展 FormDetector
// Source: webview-preload.js:74-234 (FormDetector 模式)

const AddressDetector = {
  /**
   * 扫描页面中的地址表单
   * D-09: 多字段特征匹配（姓名、手机号、地址字段特征）
   * D-10: 2/3 匹配阈值
   *
   * @returns {Object|null} 检测到的地址表单信息
   */
  scanForAddressForms() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="tel"], textarea');
    const candidates = { name: null, phone: null, address: null };

    for (const input of inputs) {
      if (input.offsetParent === null) continue; // 跳过隐藏元素

      const attrs = (
        (input.name || '') +
        (input.id || '') +
        (input.placeholder || '') +
        (input.autocomplete || '')
      ).toLowerCase();

      // 姓名字段特征
      if (!candidates.name && /name|realname|username|姓名|收件人|联系人/i.test(attrs)) {
        candidates.name = input;
      }
      // 手机号字段特征
      if (!candidates.phone && (input.type === 'tel' || /phone|mobile|tel|手机|电话/i.test(attrs))) {
        candidates.phone = input;
      }
      // 地址字段特征
      if (!candidates.address && /address|addr|地址|详细地址|收货地址/i.test(attrs)) {
        candidates.address = input;
      }
    }

    // D-10: 2/3 匹配阈值
    const matchCount = [candidates.name, candidates.phone, candidates.address]
      .filter(Boolean).length;
    if (matchCount >= 2) {
      return candidates;
    }
    return null;
  },
};
```

### Anti-Patterns to Avoid

- **在 settings-page.js 中使用 IPC：** 设置页运行在 webview guest 中，IPC 被 assertTrustedSender 拒绝。必须走 HTTP API。
- **地址表单检测使用 MutationObserver 持续监听：** D-12 明确要求单次检测（页面加载完成后检测一次），不要像登录表单那样使用 MutationObserver。
- **凭据管理使用 innerHTML 渲染：** 凭据数据（域名、用户名）来自用户输入，必须使用 DOM 构建 + textContent 防止 XSS（WR-13 模式，参考 settings-page.js:391-501）。
- **地址明文存储：** 地址数据（姓名、手机号、地址）属于 PII，必须使用 safeStorage 加密存储（与凭据一致）。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 凭据/地址加密 | 自定义加密方案 | Electron safeStorage (encryptStringAsync/decryptStringAsync) | macOS Keychain 集成，密钥轮转支持 |
| SQLite 数据库连接 | 每次操作新建连接 | 共享 history.db 连接（better-sqlite3 单例） | Phase 30-32 已验证，WAL 模式并发安全 |
| 设置页数据访问 | 注入 preload 到 webview | HTTP API + token 鉴权 | webview guest 安全隔离，preload 泄露风险 |
| 表单字段值设置 | 直接 input.value = x | native setter + input/change 事件派发 | React/Vue 等框架拦截直接赋值 |
| DOM 渲染 | innerHTML 拼接 | DOM 构建 + textContent | 防止 XSS（WR-13） |

**关键洞察：** 地址管理与凭据管理是同构问题——都是「加密存储 + 容器隔离 + 表单检测 + 自动填充 + 设置页管理」。区别仅在于字段结构（凭据：username/password vs 地址：name/phone/address）和存储策略（凭据：每 origin 一条 vs 地址：每容器一条）。

## Common Pitfalls

### Pitfall 1: 设置页容器 ID 获取
**What goes wrong:** 设置页需要知道当前容器 ID 来过滤凭据/地址，但 webview guest 无法直接获取。
**Why it happens:** 容器 ID 在主窗口 renderer 的 state.currentContainer 中，设置页是独立的 webview。
**How to avoid:** 设置页 URL 已注入 `container` 查询参数（参考 settings-page.js:13 pageParams.get('token')），使用 `pageParams.get('container')` 获取。
**Warning signs:** 凭据列表显示所有容器的数据而非当前容器。

### Pitfall 2: 地址检测与登录检测冲突
**What goes wrong:** 同一页面既有登录表单又有地址表单（如电商结账页），两种检测互相干扰。
**Why it happens:** FormDetector 和 AddressDetector 共享 DOM 扫描范围。
**How to avoid:** 两种检测独立运行，互不干扰。登录检测监听 form submit，地址检测在 DOMContentLoaded 后执行一次。地址检测排除已包含 password 字段的表单。
**Warning signs:** 地址横幅在登录页面弹出。

### Pitfall 3: 凭据展开详情的密码安全
**What goes wrong:** 密码默认明文显示在展开详情中。
**Why it happens:** 直接将解密后的密码填入 DOM。
**How to avoid:** 默认显示遮罩 `••••••••`，用户点击「显示」按钮后才切换明文。参考 UI-SPEC C-02 展开详情行为。
**Warning signs:** 密码在页面加载时就可见。

### Pitfall 4: 批量删除的确认对话框
**What goes wrong:** 批量删除没有二次确认，用户误操作导致数据丢失。
**Why it happens:** 省略了确认步骤。
**How to avoid:** 弹出确认对话框，显示「确定要删除选中的 {n} 条凭据吗？此操作不可撤销。」（参考 UI-SPEC C-03）。
**Warning signs:** 点击删除按钮立即执行，无确认。

### Pitfall 5: 地址横幅与凭据横幅 z-index 冲突
**What goes wrong:** 地址保存横幅和凭据保存横幅同时显示时重叠。
**Why it happens:** 两个横幅使用相同的 z-index 和定位。
**How to avoid:** 地址横幅 z-index 9997，凭据横幅 z-index 保持现有值。同一时间只显示一个横幅（检测到地址表单时，如果已有凭据横幅显示，延迟到凭据横幅消失后再显示地址横幅）。
**Warning signs:** 两个横幅同时可见。

## Code Examples

### 凭据列表查询（新增到 credential-manager.js）
```javascript
// Source: credential-manager.js 模式扩展
/**
 * 查询容器的凭据列表（设置页用）
 * 返回不含密码的凭据元数据（安全考虑，列表不返回密码）
 *
 * @param {string} containerId - 容器 ID
 * @returns {Array<{id, container_id, url, origin, username, created_at, updated_at}>}
 */
function listCredentials(containerId) {
  if (!db) return [];
  try {
    const rows = db.prepare(`
      SELECT id, container_id, url, origin, username, created_at, updated_at
      FROM credentials
      WHERE container_id = ? AND never_save = 0
      ORDER BY updated_at DESC
    `).all(containerId);
    return rows;
  } catch (err) {
    console.error('[Realm] 查询凭据列表失败:', err.message);
    return [];
  }
}
```

### 凭据批量删除（新增到 credential-manager.js）
```javascript
// Source: credential-manager.js 模式扩展
/**
 * 批量删除凭据
 *
 * @param {string} containerId - 容器 ID
 * @param {Array<string>} origins - origin 数组
 * @returns {{success: boolean, deleted: number}}
 */
function batchDelete(containerId, origins) {
  if (!db || !Array.isArray(origins) || origins.length === 0) {
    return { success: false, deleted: 0 };
  }
  try {
    const placeholders = origins.map(() => '?').join(',');
    const result = db.prepare(`
      DELETE FROM credentials
      WHERE container_id = ? AND origin IN (${placeholders})
    `).run(containerId, ...origins);
    return { success: true, deleted: result.changes };
  } catch (err) {
    console.error('[Realm] 批量删除凭据失败:', err.message);
    return { success: false, deleted: 0 };
  }
}
```

### 凭据解密查询（设置页展开详情用）
```javascript
// Source: credential-manager.js:184-225 (getCredential 模式)
/**
 * 查询并解密凭据（设置页展开详情用）
 * 与 getCredential 相同，但不检查 never_save 标记
 *
 * @param {number} credentialId - 凭据 ID
 * @returns {Promise<{username, password}|null>}
 */
async function getCredentialById(credentialId) {
  if (!db) return null;
  try {
    const row = db.prepare(`
      SELECT id, username, encrypted_password
      FROM credentials WHERE id = ?
    `).get(credentialId);
    if (!row) return null;

    const decrypted = await decryptPassword(row.encrypted_password);
    if (!decrypted) return null;

    // 密钥轮转懒更新
    if (decrypted.shouldReEncrypt) {
      const reEncrypted = await encryptPassword(decrypted.password);
      if (reEncrypted) {
        db.prepare('UPDATE credentials SET encrypted_password = ?, updated_at = ? WHERE id = ?')
          .run(reEncrypted, Date.now(), row.id);
      }
    }

    return { username: row.username, password: decrypted.password };
  } catch (err) {
    console.error('[Realm] 查询凭据详情失败:', err.message);
    return null;
  }
}
```

### 地址保存/查询（address-manager.js 核心函数）
```javascript
// address-manager.js 核心函数
// Source: credential-manager.js 模式

/**
 * 保存地址（覆盖写入，D-06）
 * 使用 safeStorage 加密三个字段
 */
async function saveAddress(containerId, name, phone, address) {
  if (!db) return { success: false, error: '数据库未初始化' };
  if (!containerId || !name || !phone) {
    return { success: false, error: '缺少必要参数' };
  }

  const available = await safeStorage.isAsyncEncryptionAvailable();
  if (!available) {
    return { success: false, error: 'safeStorage 加密不可用' };
  }

  try {
    const encName = await safeStorage.encryptStringAsync(name);
    const encPhone = await safeStorage.encryptStringAsync(phone);
    const encAddress = await safeStorage.encryptStringAsync(address || '');

    // INSERT OR REPLACE：每容器单地址（D-06）
    db.prepare(`
      INSERT OR REPLACE INTO addresses
      (container_id, encrypted_name, encrypted_phone, encrypted_address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(containerId, encName, encPhone, encAddress, Date.now(), Date.now());

    return { success: true };
  } catch (err) {
    console.error('[Realm] 保存地址失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 查询并解密地址
 */
async function getAddress(containerId) {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT * FROM addresses WHERE container_id = ?').get(containerId);
    if (!row) return null;

    const name = await safeStorage.decryptStringAsync(row.encrypted_name);
    const phone = await safeStorage.decryptStringAsync(row.encrypted_phone);
    const address = await safeStorage.decryptStringAsync(row.encrypted_address);

    return { name, phone, address };
  } catch (err) {
    console.error('[Realm] 查询地址失败:', err.message);
    return null;
  }
}
```

### 地址保存横幅（renderer.js 复用 credential-save-banner 模式）
```javascript
// renderer.js — 地址保存横幅逻辑
// Source: renderer.js:8435-8546 (showSaveCredentialBanner 模式)

/**
 * 显示地址保存提示横幅
 * 复用 credential-save-banner 的定位和动画模式
 *
 * @param {Object} data - 检测到的地址数据 { name, phone, address }
 */
function showSaveAddressBanner(data) {
  const banner = elements.addressSaveBanner;
  if (!banner) return;

  // 清除之前的定时器
  if (state.addressBannerTimer) {
    clearTimeout(state.addressBannerTimer);
    state.addressBannerTimer = null;
  }

  // 显示横幅（slideDown 动画，300ms ease-out）
  banner.classList.remove('hidden');

  // 10 秒后自动消失（per D-07）
  state.addressBannerTimer = setTimeout(() => {
    hideAddressBanner();
  }, 10000);

  // 绑定按钮事件
  // ... 保存/永不/暂不 按钮逻辑
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无凭据管理 UI | 设置页凭据表格 + 搜索 + 批量删除 | Phase 33 (本次) | 用户可管理已保存凭据 |
| 无地址功能 | 地址检测 + 保存 + 自动填充 | Phase 33 (本次) | 用户可自动填充地址表单 |
| credential-manager 仅 save/get/delete | 扩展 list/batchDelete/getById | Phase 33 (本次) | 设置页可展示和管理凭据 |

**Deprecated/outdated:**
- 无 — Phase 33 是纯新增功能，不废弃任何现有代码。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 设置页 URL 注入了 `container` 查询参数 | Pitfall 1 | 凭据/地址过滤需要其他方式获取容器 ID |
| A2 | credential-save-banner 的 z-index 为 9998 | Pitfall 5 | 地址横幅 z-index 需要调整 |
| A3 | addresses 表使用 UNIQUE(container_id) 约束实现每容器单地址 | Pattern 2 | 需要改用 INSERT OR REPLACE + 查询检查 |

**验证方法：**
- A1: grep 'container' src/renderer.js 中 webview src 设置逻辑
- A2: grep 'credential-save-banner' src/styles/main.css 中 z-index 值
- A3: SQLite UNIQUE 约束 + INSERT OR REPLACE 是标准做法，Phase 32 credentials 表已验证

## Open Questions (RESOLVED)

1. **(RESOLVED)** 凭据搜索是否需要支持模糊匹配？
   - Resolution: Plan 33-01 Task 1 — `searchCredentials` 使用 `LIKE '%keyword%'` 模糊匹配，与 downloads 搜索一致

2. **(RESOLVED)** 地址保存横幅是否需要「永不保存」功能？
   - Resolution: Plan 33-02 Task 2 — 实现 `address_never_save` 机制，与凭据的 never_save 一致

3. **(RESOLVED)** 设置页切换容器时如何刷新凭据/地址数据？
   - Resolution: Plan 33-01/33-02 — `loadCredentials()` / `loadAddress()` 在容器切换时重新调用 API 加载数据

## Environment Availability

> 本阶段无外部依赖。所有功能基于已有基础设施实现。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-sqlite3 | 地址存储 | ✓ | 已安装 | — |
| Electron safeStorage | 地址加密 | ✓ | 内置 | — |
| Electron contextBridge | IPC 暴露 | ✓ | 内置 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未检测到测试框架 |
| Config file | none |
| Quick run command | `npm test` (未配置) |
| Full suite command | `npm test` (未配置) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AF-04 | 凭据管理 UI（列表/搜索/删除/批量删除） | manual-only | — | ❌ Wave 0 |
| AF-06 | 地址保存（检测/横幅/存储） | manual-only | — | ❌ Wave 0 |
| AF-07 | 地址自动填充 | manual-only | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 手动验证
- **Per wave merge:** 手动验证
- **Phase gate:** 手动验证所有功能

### Wave 0 Gaps
- [ ] 项目当前无测试框架，所有验证为手动测试

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | HTTP API token 鉴权（REALM_TOKEN） |
| V5 Input Validation | yes | 凭据/地址输入校验 + SQL 参数化查询 |
| V6 Cryptography | yes | safeStorage 加密存储（macOS Keychain） |

### Known Threat Patterns for Electron + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via innerHTML | Tampering | DOM 构建 + textContent（WR-13） |
| CSRF on HTTP API | Elevation | REALM_TOKEN 鉴权（随机 UUID） |
| 明文密码泄露 | Information Disclosure | 默认遮罩显示 + safeStorage 加密 |
| SQL 注入 | Tampering | better-sqlite3 参数化查询 |
| 地址 PII 泄露 | Information Disclosure | safeStorage 加密存储地址数据 |

## Sources

### Primary (HIGH confidence)
- `credential-manager.js` — 凭据存储模块完整实现，地址模块将同构复制
- `webview-preload.js` — FormDetector + AutofillEngine 框架，地址检测/填充将扩展
- `settings-page.js` — 设置页 HTTP API 调用模式、侧边栏导航、DOM 渲染模式
- `ipc-handlers.js` — IPC handler 注册模式（assertTrustedSender + 参数校验）
- `main.js` — HTTP API 路由注册模式（/api/* 前缀 + token 鉴权）
- `src/index.html` — credential-save-banner HTML 结构，地址横幅将复用
- `33-UI-SPEC.md` — 完整的 UI 设计规范（组件、状态、交互、文案）
- `33-CONTEXT.md` — 用户锁定的所有实现决策

### Secondary (MEDIUM confidence)
- Phase 32 CONTEXT.md — 表单检测策略、autofill/fillForm 互斥机制

### Tertiary (LOW confidence)
- 无 — 所有关键信息均来自项目代码和用户决策文档

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 全部使用已有基础设施，无新依赖
- Architecture: HIGH — 复用 Phase 32 已验证的所有模式
- Pitfalls: HIGH — 基于代码分析的具体问题，非推测

**Research date:** 2026-08-13
**Valid until:** 2026-09-13（30 天 — 项目代码模式稳定）
