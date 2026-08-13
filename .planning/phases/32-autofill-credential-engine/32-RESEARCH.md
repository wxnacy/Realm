# Phase 32: 自动填充 -- 凭据引擎 - Research

**Researched:** 2026-08-13
**Domain:** Electron 凭据存储、表单检测、自动填充、autofill/fillForm 互斥
**Confidence:** MEDIUM

## Summary

Phase 32 实现浏览器自动填充凭据引擎，核心挑战在于：(1) 在 webview-preload.js 中检测登录表单并提取凭据（需要 DOM 上下文）；(2) 使用 Electron safeStorage API 加密存储凭据（macOS Keychain）；(3) 页面加载后自动填充已保存的凭据；(4) 凭据按容器隔离存储；(5) autofill 与现有 CDP fillForm 工具互斥。

**主要建议：** 创建独立的 `credential-manager.js` 模块，遵循现有 `download-manager.js` 和 `history-manager.js` 的模式，使用 better-sqlite3 存储凭据元数据（URL、用户名），使用 safeStorage 加密存储密码。表单检测和凭据注入在 webview-preload.js 中实现，通过 ipcRenderer.sendToHost() 与渲染进程通信。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**表单检测策略：**
- **D-01:** 检测时机：页面加载完成后扫描 + MutationObserver 持续监听（两者结合）
- **D-02:** 识别规则：两层检测 -- 第一层 password 字段存在即为登录表单，第二层多字段特征匹配精细分类（登录/注册/密码修改）
- **D-03:** 提交检测：监听 form submit 事件
- **D-04:** 凭据提取：直接读取 input[type=text/email] 和 input[type=password] 的 value

**保存提示 UI 形态：**
- **D-05:** 提示位置：工具栏下方弹出横幅（Chrome 风格）
- **D-06:** 提示内容：保存/永不/暂不 三按钮 + 网站名
- **D-07:** 永不保存记录：记录到凭据存储（按容器隔离）
- **D-08:** 自动消失：10 秒后自动消失（等同于「暂不」）

**自动填充时机与交互：**
- **D-09:** 填充时机：页面加载后自动填充用户名和密码
- **D-10:** 多账号处理：只保存一个凭据（同一网站最后一个）
- **D-11:** 填充反馈：无额外视觉反馈，字段直接填好
- **D-12:** 页面刷新：每次都填充（刷新/重新导航都触发）

**autofill/fillForm 互斥机制：**
- **D-13:** 互斥策略：fillForm 激活时临时禁用 autofill 检测
- **D-14:** 优先级：fillForm 优先（AI 填表优先于浏览器 autofill）
- **D-15:** 状态同步：fillForm 完成后自动恢复 autofill 检测
- **D-16:** 禁用持续时间：仅执行期间禁用（fillForm 执行完立即恢复）

### Claude's Discretion
无 -- 用户对所有问题都做出了明确选择。

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AF-01 | 应用检测到用户提交登录表单时弹出保存凭据提示 | 表单检测：webview-preload.js DOM 扫描 + MutationObserver + form submit 事件监听 |
| AF-02 | 用户保存的凭据使用 safeStorage 加密存储（macOS Keychain） | Electron safeStorage API：encryptStringAsync/decryptStringAsync，macOS Keychain 原生加密 |
| AF-03 | 用户再次访问已保存凭据的网站时自动填充用户名和密码 | webview-preload.js 在 dom-ready 后查询凭据并注入，使用 native setter 触发框架状态更新 |
| AF-05 | 凭据数据按容器隔离存储（不同容器的同一网站凭据独立） | 单表 + container_id 列模式（同 Phase 30 downloads 表） |
| AF-08 | 自动填充与现有 CDP fillForm 工具互斥（AI 填表时禁用浏览器 autofill） | cdpManager.fillForm 执行前后通过 IPC 通知 webview-preload.js 暂停/恢复检测 |
| AF-09 | 自动填充在 webview preload 脚本中检测表单（需 DOM 上下文） | webview-preload.js 运行在 guest 页面主世界，有完整 DOM 访问权限 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 表单检测 | Webview Guest (preload) | — | 需要 DOM 上下文，webview-preload.js 有完整访问权限 |
| 凭据提取 | Webview Guest (preload) | — | 读取 input.value 需要在页面上下文中执行 |
| 凭据加密存储 | Main Process | — | safeStorage API 仅在主进程可用 |
| 凭据查询 | Main Process | — | SQLite 查询在主进程执行 |
| 保存提示 UI | Renderer Process | — | 工具栏横幅在渲染进程 DOM 中 |
| 自动填充注入 | Webview Guest (preload) | — | 需要在页面上下文中设置 input.value |
| autofill/fillForm 互斥 | Main Process | Webview Guest | 主进程协调，webview-preload.js 执行暂停/恢复 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron safeStorage | 43.3.0+ | 凭据加密存储 | 内置 API，macOS Keychain 原生加密，零依赖 |
| better-sqlite3 | 13.0.2+ | 凭据元数据存储 | 已在项目中使用（history.db），同步 API 性能好 |
| Electron ipcRenderer.sendToHost | 43.3.0+ | webview → renderer 通信 | 现有模式（media:detected），安全可靠 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MutationObserver | built-in | 动态表单检测 | SPA 登录表单异步加载场景 |
| contextBridge | built-in | 安全 API 暴露 | webview-preload.js 暴露 autofill API |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| safeStorage | electron-store + 自定义加密 | safeStorage 使用 OS 原生加密（Keychain），更安全；自定义加密需管理密钥 |
| 单表 + container_id | 每容器独立表 | 单表更简单，查询统一；独立表隔离性更好但管理复杂 |
| sendToHost | ipcRenderer.invoke | sendToHost 单向推送适合事件通知；invoke 需要主进程注册处理器 |

**Installation:**
```bash
# 已在项目中，无需额外安装
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| electron | npm | 10+ years | 5.9M/week | github.com/electron/electron | OK | Approved |
| better-sqlite3 | npm | 8+ years | 9.7M/week | github.com/WiseLibs/better-sqlite3 | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none（electron 和 better-sqlite3 的 SUS 标记是因为最新版本发布时间较近，但两者都是成熟的、广泛使用的包）

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Main Process                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Credential Manager                        │   │
│  │  - safeStorage 加密/解密（macOS Keychain）                  │   │
│  │  - SQLite 凭据元数据存储（history.db credentials 表）       │   │
│  │  - 凭据 CRUD 操作                                           │   │
│  │  - 永不保存记录管理                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                    │                    │               │
│           ▼                    ▼                    ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
│  │ safeStorage │    │ SQLite      │    │ IPC Handler         │   │
│  │ encryptAsync│    │ credentials │    │ credential:*        │   │
│  │ decryptAsync│    │ table       │    │ channels            │   │
│  └─────────────┘    └─────────────┘    └─────────────────────┘   │
│           │                                                         │
│           │ IPC (credential:* channels)                             │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Preload Script                            │   │
│  │  - contextBridge.exposeInMainWorld('credentialAPI', {...})  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Renderer Process                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      UI Layer                               │   │
│  │  - 保存凭据横幅（toolbar 下方，Chrome 风格）                │   │
│  │  - 三按钮：保存/永不/暂不                                   │   │
│  │  - 10 秒自动消失                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                         │
                         │ ipcRenderer.sendToHost / webview IPC
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Webview Guest (preload)                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Form Detection Engine                     │   │
│  │  - DOMContentLoaded 初始扫描                                │   │
│  │  - MutationObserver 持续监听                                │   │
│  │  - form submit 事件监听                                     │   │
│  │  - 两层检测：password 字段 + 多字段特征匹配                 │   │
│  │  - 凭据提取：读取 input.value                               │   │
│  │  - 自动填充：native setter + input/change 事件              │   │
│  │  - fillForm 互斥：暂停/恢复检测                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
realm/
├── credential-manager.js     # 凭据管理器核心模块（新建）
├── main.js                   # 主进程入口，注册 credential-manager
├── ipc-handlers.js           # IPC 处理器，添加 credential:* 命名空间
├── src/
│   ├── preload.js            # 暴露 credentialAPI
│   ├── webview-preload.js    # 表单检测 + 凭据注入（扩展）
│   ├── renderer.js           # 保存提示横幅 UI
│   ├── index.html            # 添加横幅 HTML
│   └── styles/
│       └── main.css          # 横幅样式
```

### Pattern 1: Credential Manager 模块设计

**What:** 独立的凭据管理器模块，封装加密存储和 SQLite 操作

**When to use:** 所有凭据相关操作

**Example:**
```javascript
// credential-manager.js
// Source: Electron safeStorage API + Phase 30 download-manager.js 模式

const path = require('path');
const { app, safeStorage } = require('electron');

// better-sqlite3 延迟加载
let Database = null;
let DB_PATH = null;
let db = null;

/**
 * 初始化数据库连接，创建 credentials 表
 * 应在 app.whenReady 之后调用
 */
function initDatabase() {
  if (db) return;

  if (!Database) {
    Database = require('better-sqlite3');
    DB_PATH = path.join(app.getPath('userData'), 'history.db');
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // 凭据表：元数据明文 + 密码加密
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT NOT NULL,
      url TEXT NOT NULL,
      origin TEXT NOT NULL,
      username TEXT NOT NULL,
      encrypted_password BLOB NOT NULL,
      never_save INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_credentials_container_id ON credentials (container_id);
    CREATE INDEX IF NOT EXISTS idx_credentials_origin ON credentials (origin);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_container_origin
      ON credentials (container_id, origin);
  `);

  console.log('[Realm] 凭据管理器数据库已初始化');
}
```

### Pattern 2: safeStorage 加密/解密

**What:** 使用 Electron safeStorage API 加密存储密码

**Example:**
```javascript
// Source: Electron 官方文档 safe-storage
// https://www.electronjs.org/docs/latest/api/safe-storage

const { safeStorage } = require('electron');

/**
 * 加密密码字符串
 * @param {string} plainPassword - 明文密码
 * @returns {Promise<Buffer|null>} 加密后的 Buffer，不可用时返回 null
 */
async function encryptPassword(plainPassword) {
  const available = await safeStorage.isAsyncEncryptionAvailable();
  if (!available) {
    console.error('[Realm] safeStorage 加密不可用，拒绝存储凭据');
    return null;
  }
  return await safeStorage.encryptStringAsync(plainPassword);
}

/**
 * 解密密码
 * @param {Buffer} encryptedBuffer - 加密的 Buffer
 * @returns {Promise<string|null>} 解密后的密码，失败时返回 null
 */
async function decryptPassword(encryptedBuffer) {
  try {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encryptedBuffer);
    // 密钥轮转时重新加密（D-15 状态同步）
    if (shouldReEncrypt) {
      console.log('[Realm] 密钥已轮转，重新加密凭据');
      const reEncrypted = await safeStorage.encryptStringAsync(result);
      return { password: result, reEncrypted };
    }
    return { password: result, reEncrypted: null };
  } catch (err) {
    console.error('[Realm] 解密凭据失败:', err.message);
    return null;
  }
}
```

### Pattern 3: webview-preload.js 表单检测

**What:** 在 webview guest 页面中检测登录表单

**Example:**
```javascript
// webview-preload.js 扩展
// Source: D-01/D-02/D-03 决策

/**
 * 表单检测引擎
 * 两层检测：password 字段存在 + 多字段特征匹配
 */
const FormDetector = {
  /** 已检测到的表单集合（避免重复检测） */
  detectedForms: new WeakSet(),

  /** autofill 是否暂停（fillForm 互斥，D-13） */
  autofillPaused: false,

  /**
   * 扫描页面中的登录表单
   * @returns {Array<Object>} 检测到的表单信息数组
   */
  scanForLoginForms() {
    const forms = [];
    const passwordFields = document.querySelectorAll('input[type="password"]');

    passwordFields.forEach(pwField => {
      const form = pwField.closest('form');
      if (form && this.detectedForms.has(form)) return;

      // 第一层：password 字段存在即为登录表单
      const formInfo = this.classifyForm(pwField, form);
      if (formInfo) {
        forms.push(formInfo);
        if (form) this.detectedForms.add(form);
      }
    });

    return forms;
  },

  /**
   * 分类表单类型（第二层多字段特征匹配）
   * @param {HTMLInputElement} pwField - password 字段
   * @param {HTMLFormElement|null} form - 父表单
   * @returns {Object|null} 表单信息
   */
  classifyForm(pwField, form) {
    // 查找用户名字段
    const usernameField = this.findUsernameField(pwField, form);
    if (!usernameField) return null;

    // 判断表单类型
    const formType = this.detectFormType(pwField, form);

    return {
      usernameField,
      passwordField: pwField,
      form,
      type: formType, // 'login' | 'register' | 'password-change'
    };
  },

  /**
   * 查找用户名字段
   * @param {HTMLInputElement} pwField - password 字段
   * @param {HTMLFormElement|null} form - 父表单
   * @returns {HTMLInputElement|null}
   */
  findUsernameField(pwField, form) {
    const container = form || document;
    // 优先查找 type=text/email 的输入框
    const candidates = container.querySelectorAll(
      'input[type="text"], input[type="email"], input:not([type])'
    );

    for (const input of candidates) {
      // 检查是否在 password 字段之前
      if (input.compareDocumentPosition(pwField) & Node.DOCUMENT_POSITION_FOLLOWING) {
        // 检查 name/id/placeholder 是否包含用户名相关关键词
        const attrs = (input.name + input.id + input.placeholder + input.autocomplete).toLowerCase();
        if (/user|login|email|account|phone|mobile/i.test(attrs) || input.type === 'email') {
          return input;
        }
      }
    }

    // 兜底：password 字段前最近的 text/email 输入框
    for (const input of candidates) {
      if (input.compareDocumentPosition(pwField) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return input;
      }
    }

    return null;
  },

  /**
   * 检测表单类型
   * @param {HTMLInputElement} pwField - password 字段
   * @param {HTMLFormElement|null} form - 父表单
   * @returns {string} 'login' | 'register' | 'password-change'
   */
  detectFormType(pwField, form) {
    const container = form || document;
    const passwordFields = container.querySelectorAll('input[type="password"]');
    if (passwordFields.length >= 2) return 'password-change';

    // 检查注册相关关键词
    const text = (container.textContent + container.innerHTML).toLowerCase();
    if (/register|sign.?up|注册|创建账号/i.test(text)) return 'register';

    return 'login';
  },

  /**
   * 提取凭据
   * @param {Object} formInfo - 表单信息
   * @returns {Object} { username, password }
   */
  extractCredentials(formInfo) {
    return {
      username: formInfo.usernameField.value || '',
      password: formInfo.passwordField.value || '',
    };
  },

  /**
   * 设置 form submit 监听器（D-03）
   * @param {Object} formInfo - 表单信息
   */
  attachSubmitListener(formInfo) {
    const form = formInfo.form;
    if (!form) return;

    form.addEventListener('submit', () => {
      if (this.autofillPaused) return; // D-13 互斥

      const creds = this.extractCredentials(formInfo);
      if (creds.username && creds.password) {
        // 发送到 renderer 进程
        ipcRenderer.sendToHost('credential:form-submitted', {
          url: window.location.href,
          origin: window.location.origin,
          username: creds.username,
          password: creds.password,
          formType: formInfo.type,
        });
      }
    });
  },
};
```

### Pattern 4: 自动填充注入

**What:** 页面加载后自动填充已保存的凭据

**Example:**
```javascript
// webview-preload.js 扩展
// Source: D-09/D-11/D-12 决策

/**
 * 自动填充引擎
 * 使用 native setter 触发框架状态更新
 */
const AutofillEngine = {
  /**
   * 填充凭据到表单
   * @param {Object} credentials - { username, password }
   * @param {Object} formInfo - 表单信息
   */
  fillCredentials(credentials, formInfo) {
    if (FormDetector.autofillPaused) return; // D-13 互斥

    // 使用 native setter 触发 React/Vue 状态更新
    this.setInputValue(formInfo.usernameField, credentials.username);
    this.setInputValue(formInfo.passwordField, credentials.password);
  },

  /**
   * 设置 input 值（使用 native setter）
   * @param {HTMLInputElement} input - 输入框元素
   * @param {string} value - 要设置的值
   */
  setInputValue(input, value) {
    // 获取 native setter（避免 React/Vue 拦截）
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(input, value);

    // 触发事件（让框架感知变化）
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  },
};
```

### Pattern 5: autofill/fillForm 互斥机制

**What:** fillForm 激活时临时禁用 autofill 检测

**Example:**
```javascript
// webview-preload.js 扩展
// Source: D-13/D-14/D-15/D-16 决策

// 监听主进程的 fillForm 互斥信号
ipcRenderer.on('autofill:pause', () => {
  FormDetector.autofillPaused = true; // D-13: fillForm 激活时禁用
});

ipcRenderer.on('autofill:resume', () => {
  FormDetector.autofillPaused = false; // D-15: fillForm 完成后恢复
});
```

### Anti-Patterns to Avoid

- **直接设置 .value：** React/Vue 等框架会拦截 .value setter，必须使用 native setter
- **忽略 autocomplete=off：** 部分网站使用此属性禁止自动填充，应尊重此设置
- **在 MutationObserver 回调中同步检测：** 回调可能频繁触发，需要防抖处理
- **忘记 fillForm 互斥：** 不暂停 autofill 会导致 AI 填表和浏览器 autofill 冲突
- **密码明文存储：** 必须使用 safeStorage 加密，不能直接存入 SQLite

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 密码加密 | 自定义 AES/RSA 加密 | safeStorage API | OS 原生加密（Keychain），密钥管理由 OS 处理 |
| 表单检测 | 简单的 querySelectorAll | 两层检测 + MutationObserver | 需要处理动态加载、SPA 路由、多种表单布局 |
| 凭据注入 | 直接设置 .value | native setter + 事件 | 框架拦截 .value setter，不触发状态更新 |
| SQLite 表结构 | 每容器独立表 | 单表 + container_id 列 | D-05 决策，与 Phase 30 保持一致 |

## Common Pitfalls

### Pitfall 1: safeStorage 在 Linux 上不可用

**What goes wrong:** 凭据存储失败，用户无法保存密码

**Why it happens:** Linux 上需要 GNOME Keyring 或 KWallet，未安装时 safeStorage.isEncryptionAvailable() 返回 false

**How to avoid:** 在存储前检查 isAsyncEncryptionAvailable()，不可用时拒绝存储并提示用户

**Warning signs:** Linux 用户反馈无法保存密码

### Pitfall 2: React/Vue 框架拦截 .value setter

**What goes wrong:** 自动填充后框架状态未更新，提交时密码为空

**Why it happens:** 框架重写了 input.value 的 setter，直接赋值不触发状态更新

**How to avoid:** 使用 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set 获取 native setter

**Warning signs:** 自动填充后表单显示有值但提交时为空

### Pitfall 3: MutationObserver 回调频繁触发

**What goes wrong:** 性能问题，页面卡顿

**Why it happens:** SPA 路由切换、DOM 更新频繁触发 MutationObserver

**How to avoid:** 使用防抖（debounce）延迟检测，避免在短时间内重复扫描

**Warning signs:** 页面加载缓慢，CPU 占用高

### Pitfall 4: fillForm 与 autofill 冲突

**What goes wrong:** AI 填表和浏览器 autofill 同时执行，覆盖彼此的值

**Why it happens:** 未实现互斥机制，两者同时运行

**How to avoid:** fillForm 执行前发送 autofill:pause，执行后发送 autofill:resume

**Warning signs:** 用户反馈 AI 填表后值被覆盖

## Runtime State Inventory

> 不适用 -- Phase 32 是新增功能，不涉及重命名/重构/迁移。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 无 | — |
| Live service config | 无 | — |
| OS-registered state | 无 | — |
| Secrets/env vars | 无 | — |
| Build artifacts | 无 | — |

**Nothing found in category:** N/A -- greenfield phase.

## Common Pitfalls (continued)

### Pitfall 5: webview-preload.js 无法直接调用主进程 safeStorage

**What goes wrong:** 在 webview-preload.js 中无法加密密码

**Why it happens:** webview-preload.js 运行在 guest 进程，无法直接访问主进程 API

**How to avoid:** 凭据提取后通过 sendToHost 发送到 renderer，renderer 通过 IPC 转发到主进程加密存储

**Warning signs:** 凭据保存失败，控制台报错

## Code Examples

### IPC 通道注册（credential:* 命名空间）

```javascript
// ipc-handlers.js
// Source: 现有 download:* 命名空间模式

const credentialManager = require('./credential-manager');

// 凭据相关 IPC 通道
ipcMain.handle('credential:save', async (event, data) => {
  const { containerId, url, origin, username, password } = data;
  return await credentialManager.saveCredential(containerId, url, origin, username, password);
});

ipcMain.handle('credential:get', async (event, { containerId, origin }) => {
  return await credentialManager.getCredential(containerId, origin);
});

ipcMain.handle('credential:delete', async (event, { containerId, origin }) => {
  return await credentialManager.deleteCredential(containerId, origin);
});

ipcMain.handle('credential:never-save', async (event, { containerId, origin }) => {
  return await credentialManager.markNeverSave(containerId, origin);
});

ipcMain.handle('credential:is-never-save', async (event, { containerId, origin }) => {
  return await credentialManager.isNeverSave(containerId, origin);
});
```

### Preload API 暴露

```javascript
// src/preload.js
// Source: 现有 downloadAPI 模式

contextBridge.exposeInMainWorld('credentialAPI', {
  /** 保存凭据 */
  saveCredential: (data) => ipcRenderer.invoke('credential:save', data),

  /** 获取凭据 */
  getCredential: (containerId, origin) =>
    ipcRenderer.invoke('credential:get', { containerId, origin }),

  /** 删除凭据 */
  deleteCredential: (containerId, origin) =>
    ipcRenderer.invoke('credential:delete', { containerId, origin }),

  /** 标记永不保存 */
  markNeverSave: (containerId, origin) =>
    ipcRenderer.invoke('credential:never-save', { containerId, origin }),

  /** 检查是否永不保存 */
  isNeverSave: (containerId, origin) =>
    ipcRenderer.invoke('credential:is-never-save', { containerId, origin }),

  /** 监听表单提交事件（来自 webview） */
  onFormSubmitted: (callback) => {
    ipcRenderer.on('credential:form-submitted', (event, data) => callback(data));
  },

  /** 发送 autofill 暂停信号到 webview */
  pauseAutofill: (webContentsId) =>
    ipcRenderer.invoke('credential:pause-autofill', webContentsId),

  /** 发送 autofill 恢复信号到 webview */
  resumeAutofill: (webContentsId) =>
    ipcRenderer.invoke('credential:resume-autofill', webContentsId),
});
```

### 保存提示横幅 UI

```javascript
// src/renderer.js 扩展
// Source: D-05/D-06/D-07/D-08 决策

/**
 * 显示保存凭据提示横幅
 * @param {Object} data - { url, origin, username, formType }
 */
function showSaveCredentialBanner(data) {
  const banner = document.getElementById('credentialSaveBanner');
  const siteName = new URL(data.origin).hostname;

  // 设置内容（D-06）
  banner.querySelector('.credential-banner-site').textContent = siteName;
  banner.querySelector('.credential-banner-username').textContent = data.username;

  // 显示横幅（D-05: 工具栏下方）
  banner.classList.add('visible');

  // 10 秒自动消失（D-08）
  const autoHideTimer = setTimeout(() => {
    hideBanner(banner);
  }, 10000);

  // 按钮事件
  banner.querySelector('.credential-banner-save').onclick = () => {
    clearTimeout(autoHideTimer);
    window.credentialAPI.saveCredential({
      containerId: state.currentContainer,
      url: data.url,
      origin: data.origin,
      username: data.username,
      password: data.password,
    });
    hideBanner(banner);
  };

  banner.querySelector('.credential-banner-never').onclick = () => {
    clearTimeout(autoHideTimer);
    window.credentialAPI.markNeverSave(state.currentContainer, data.origin);
    hideBanner(banner);
  };

  banner.querySelector('.credential-banner-dismiss').onclick = () => {
    clearTimeout(autoHideTimer);
    hideBanner(banner);
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| safeStorage 同步 API | safeStorage 异步 API | Electron 33+ | 非阻塞，支持密钥轮转 |
| 直接设置 .value | native setter + 事件 | React 16+ | 框架状态正确更新 |

**Deprecated/outdated:**
- safeStorage.encryptString/decryptString（同步版本）：未来版本将废弃，使用 encryptStringAsync/decryptStringAsync

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Electron 43.3.0 支持 safeStorage.isAsyncEncryptionAvailable() | Standard Stack | 中，可能需要降级到同步 API |
| A2 | macOS 上 safeStorage 默认使用 Keychain | Security | 低，官方文档确认 |
| A3 | webview-preload.js 可以直接访问 DOM | Architecture | 低，现有 media 检测已验证 |
| A4 | ipcRenderer.sendToHost 可以发送任意 JSON 数据 | IPC | 低，现有 media:detected 已验证 |

## Open Questions

1. **凭据表是否与 history.db 共享**
   - What we know: Phase 30 使用 history.db 存储 downloads 表
   - What's unclear: 凭据表是否也放在 history.db 中
   - Recommendation: 共享 history.db，减少文件数量，与 Phase 30 保持一致

2. **safeStorage 密钥轮转时的批量重新加密**
   - What we know: decryptStringAsync 返回 shouldReEncrypt 标志
   - What's unclear: 是否需要启动时批量检查并重新加密所有凭据
   - Recommendation: 懒更新 -- 解密时检查 shouldReEncrypt，按需重新加密

3. **凭据管理 UI（Phase 33 范围）**
   - What we know: AF-04（查看和删除凭据）在 Phase 33 实现
   - What's unclear: Phase 32 是否需要预留 API
   - Recommendation: Phase 32 实现基础 CRUD API，Phase 33 实现 UI

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Electron | safeStorage API | ✓ | 43.3.0 | — |
| better-sqlite3 | 凭据存储 | ✓ | 13.0.2 | — |
| Node.js | 运行时 | ✓ | 22.22.0 | — |
| npm | 包管理 | ✓ | 10.9.4 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前没有测试框架） |
| Config file | none |
| Quick run command | — |
| Full suite command | — |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AF-01 | 保存凭据提示 | manual | — | ❌ Wave 0 |
| AF-02 | safeStorage 加密存储 | manual | — | ❌ Wave 0 |
| AF-03 | 自动填充凭据 | manual | — | ❌ Wave 0 |
| AF-05 | 容器隔离存储 | manual | — | ❌ Wave 0 |
| AF-08 | autofill/fillForm 互斥 | manual | — | ❌ Wave 0 |
| AF-09 | webview-preload 表单检测 | manual | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 手动测试
- **Per wave merge:** 手动测试
- **Phase gate:** 手动验证所有需求

### Wave 0 Gaps
- [ ] 无自动化测试（项目未配置测试框架）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | safeStorage 加密存储凭据 |
| V3 Session Management | no | — |
| V4 Access Control | yes | 容器隔离存储，凭据不跨容器 |
| V5 Input Validation | yes | 验证 URL/origin 格式，防注入 |
| V6 Cryptography | yes | safeStorage 使用 OS 原生加密（macOS Keychain） |

### Known Threat Patterns for Credential Autofill

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 凭据泄露 | Information Disclosure | safeStorage 加密，仅主进程可解密 |
| 跨容器凭据访问 | Elevation of Privilege | container_id 隔离，IPC 校验来源 |
| XSS 注入伪造表单提交 | Tampering | webview-preload.js 验证表单来源 |
| 密码明文传输 | Information Disclosure | IPC 传输加密，不落盘明文 |

## Sources

### Primary (HIGH confidence)
- Electron 官方文档 safe-storage - https://www.electronjs.org/docs/latest/api/safe-storage
- 项目现有代码模式（download-manager.js, history-manager.js, ipc-handlers.js）

### Secondary (MEDIUM confidence)
- Context7 Electron safeStorage API 文档
- Phase 30 RESEARCH.md - SQLite + better-sqlite3 模式

### Tertiary (LOW confidence)
- WebSearch: 表单检测和自动填充最佳实践（未找到官方文档，基于社区经验）
- WebSearch: Electron webview preload DOM 访问（基于现有 media 检测代码推断）

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - 所有依赖已在项目中使用，safeStorage API 文档完整
- Architecture: MEDIUM - 遵循现有模式，但 webview-preload.js 扩展需要验证
- Pitfalls: MEDIUM - 部分基于训练知识，需要实际测试验证

**Research date:** 2026-08-13
**Valid until:** 2026-09-13（Electron API 稳定，30 天有效）
