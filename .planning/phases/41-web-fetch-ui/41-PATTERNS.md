# Phase 41: web_fetch 工具 + 搜索配置 UI - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 7
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `search-manager.js` (modify) | service | request-response (HTTP fetch) | `search-manager.js` existing `doSearch` | exact |
| `ai-manager.js` (modify) | controller/tool | request-response | `ai-manager.js` `_buildRealmTools()` web_search | exact |
| `ipc-handlers.js` (modify) | controller | request-response | `ipc-handlers.js` existing IPC channels | exact |
| `src/preload.js` (modify) | middleware/bridge | request-response | `src/preload.js` existing `contextBridge` | exact |
| `src/settings-page.js` (modify) | component | request-response | `src/settings-page.js` AI provider management | exact |
| `src/settings.html` (modify) | component (static) | static | `src/settings.html` AI 助手分区 | exact |
| `main.js` (modify) | controller | request-response | `main.js` `handleSettingsApi` | exact |

## Pattern Assignments

### `search-manager.js` — 新增 `fetchUrl()` + `htmlToMarkdown()` (service, request-response)

**Analog:** `search-manager.js` 自身的 `doSearch` + Provider 搜索函数

**Imports pattern** — 新增依赖（文件顶部现有 imports 之后添加）：
```javascript
// 需新增：
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
```

**常量定义模式** — 参考现有 `SEARCH_TIMEOUT_MS` 等常量（line 59-67）：
```javascript
/** web_fetch 请求超时（毫秒） */
const FETCH_TIMEOUT_MS = 15_000;

/** web_fetch 最大重定向次数 */
const MAX_REDIRECTS = 5;

/** web_fetch 默认最大内容长度 */
const FETCH_DEFAULT_MAX_LENGTH = 12_000;
```

**SSRF 防护模式** — 直接复用现有 `isPrivateHost`（line 183-199）：
```javascript
// 已有函数，无需修改，fetchUrl 中直接调用：
if (await isPrivateHost(hopParsed.hostname)) {
  throw new Error(`拒绝访问内网地址: ${hopParsed.hostname}`);
}
```

**HTTP 请求模式** — 参考 `searchTavily` 等 Provider 函数（line 874-898）使用 `net.fetch`：
```javascript
// 模式来源: search-manager.js line 875-887
res = await net.fetch(currentUrl, {
  headers: {
    'User-Agent': 'RealmBrowser/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*',
  },
  redirect: 'manual',
  signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
});
```

**错误处理模式** — 参考 `throwIfHttpError`（line 519-527）：
```javascript
if (!res.ok) throw new Error(`HTTP ${res.status}`);
```

**核心模式 fetchUrl** — 逐跳重定向 + SSRF + Content-Type 判断：
```javascript
/**
 * 抓取指定 URL 的内容并转换为可读文本
 *
 * 流程：URL 校验 → 逐跳 SSRF 防护 + 重定向循环 → Content-Type 判断
 *   → HTML: jsdom + Readability → turndown → Markdown
 *   → JSON: JSON.stringify 美化
 *   → Text: 原样返回
 * → 截断到 maxLength → 追加截断标记
 *
 * @param {string} url - 要抓取的 URL
 * @param {number} [maxLength=12000] - 最大字符数
 * @returns {Promise<{markdown: string, finalUrl: string, format: string, truncated: boolean}>}
 */
async function fetchUrl(url, maxLength = FETCH_DEFAULT_MAX_LENGTH) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('仅支持 http/https 协议');
  }

  let currentUrl = url;
  let res;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const hopHost = new URL(currentUrl).hostname;
    if (await isPrivateHost(hopHost)) {
      throw new Error(`拒绝访问内网地址: ${hopHost}`);
    }
    res = await net.fetch(currentUrl, {
      headers: {
        'User-Agent': 'RealmBrowser/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if ([301, 302, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) break;
      currentUrl = new URL(loc, currentUrl).href;
      continue;
    }
    break;
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();
  let text, format;

  if (contentType.includes('application/json')) {
    try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch { text = raw; }
    format = 'json';
  } else if (contentType.includes('text/html')) {
    text = await htmlToMarkdown(raw, currentUrl);
    format = 'markdown';
  } else {
    text = raw;
    format = 'text';
  }

  const truncated = text.length > maxLength;
  if (truncated) {
    text = text.slice(0, maxLength)
      + `\n\n[内容已截断，原始长度: ${text.length} 字符，已显示: ${maxLength} 字符]`;
  }

  return { markdown: text, finalUrl: currentUrl, format, truncated };
}
```

**核心模式 htmlToMarkdown** — jsdom + Readability + turndown：
```javascript
/**
 * 将 HTML 转换为可读的 Markdown 文本
 *
 * 使用 jsdom 构建 DOM 环境，Readability 提取正文，turndown 转换为 Markdown。
 *
 * @param {string} html - 原始 HTML 字符串
 * @param {string} [url] - 来源 URL（Readability 用于相对链接解析）
 * @returns {Promise<string>} Markdown 文本
 */
async function htmlToMarkdown(html, url) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const contentHtml = article?.content || html;

  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
  });
  // 去除 script/style/nav/footer/aside（Readability 已去噪，turndown 再保险）
  turndown.remove(['script', 'style', 'nav', 'footer', 'aside']);

  return turndown.turndown(contentHtml);
}
```

**模块导出** — 参考现有 `module.exports`（line 1448-1463）：
```javascript
// 新增导出：
module.exports = {
  // ... 现有导出
  fetchUrl,
  htmlToMarkdown,
};
```

---

### `ai-manager.js` — 新增 web_fetch 工具 (controller/tool, request-response)

**Analog:** `ai-manager.js` web_search 工具（line 2904-2973）

**工具注册模式** — 在 `_buildRealmTools()` 返回数组末尾（line 2973 之后、`];` 之前）追加：
```javascript
// ==================== web_fetch 工具 ====================
/**
 * 网页内容抓取工具
 *
 * 抓取指定 URL 的网页全文内容并返回可读的 Markdown 文本。
 * 用于读取搜索结果中的文章全文、文档页面等。
 * 委托 search-manager.js 执行抓取，支持 SSRF 防护和内容截断。
 */
{
  name: 'web_fetch',
  label: '抓取网页',
  description: '抓取指定 URL 的网页内容并返回可读的 Markdown 文本。用于读取搜索结果中的文章全文、文档页面等。',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要抓取的网页 URL（必须包含 https:// 或 http://）',
      },
      maxLength: {
        type: 'number',
        description: '返回内容最大字符数（可选，默认 12000）',
      },
    },
    required: ['url'],
  },
  execute: async (toolCallId, params) => {
    const { url, maxLength = 12000 } = params;
    if (!url) {
      throw new Error('URL 不能为空');
    }

    try {
      const result = await searchManager.fetchUrl(url, maxLength);
      return {
        content: [{
          type: 'text',
          text: result.markdown,
        }],
        details: {
          url: result.finalUrl,
          format: result.format,
          truncated: result.truncated,
        },
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: `抓取失败: ${err.message}`,
        }],
        details: { error: err.message },
      };
    }
  },
},
```

**关键约束:** `searchManager` 引用必须在文件中已有（line 附近有 `const searchManager = require('./search-manager')`）。

---

### `ipc-handlers.js` — 新增 search-config IPC 通道 (controller, request-response)

**Analog:** `ipc-handlers.js` existing `settings:get` / `settings:set`（line 2004-2033）

**IPC 注册模式** — 在 `registerHandlers()` 函数内 `settings:set` 之后（line 2033 之后）追加：
```javascript
// ==================== 搜索配置 ====================

/**
 * 获取搜索配置（主窗口渲染进程用；webview 内设置页走 HTTP /api/search-config/get）
 * @returns {{provider: string, apiKeys: Object}}
 */
ipcMain.handle('search-config:get', (event) => {
  assertTrustedSender(event);
  return {
    provider: configStore.get('search.provider', 'auto'),
    apiKeys: configStore.get('search.apiKeys', {}),
  };
});

/**
 * 写入搜索配置
 * @param {Object} config - { provider?: string, apiKeys?: Object }
 * @returns {{success: boolean}}
 */
ipcMain.handle('search-config:set', (event, config) => {
  assertTrustedSender(event);
  if (config.provider) configStore.set('search.provider', config.provider);
  if (config.apiKeys) configStore.set('search.apiKeys', config.apiKeys);
  return { success: true };
});

/**
 * 验证搜索 Provider API Key
 * 发送测试查询验证 Key 有效性（D-13: 固定查询词 'test'）
 * @param {Object} params - { provider: string, apiKey: string }
 * @returns {Promise<{valid: boolean, provider?: string, error?: string}>}
 */
ipcMain.handle('search-config:verify-key', async (event, { provider, apiKey }) => {
  assertTrustedSender(event);
  try {
    const result = await searchManager.doSearch('test', 1);
    return { valid: true, provider: result.provider };
  } catch (err) {
    return { valid: false, error: err.message };
  }
});
```

**关键约束:** `searchManager` 需在文件顶部 require 或通过 setter 注入（参考 `setAIManager` 模式 line 2043-2045）。可能需要新增 `setSearchManager` 函数。

---

### `src/preload.js` — 暴露 searchConfigAPI (middleware/bridge, request-response)

**Analog:** `src/preload.js` existing `ai` API 命名空间（line 901-972）

**contextBridge 暴露模式** — 在 `contextBridge.exposeInMainWorld('realmAPI', {...})` 内部、`ai:` 命名空间之后追加：
```javascript
// ==================== 搜索配置 ====================

/**
 * 搜索配置 API
 * 提供搜索 Provider 和 API Key 的管理功能
 */
searchConfig: {
  /**
   * 获取搜索配置
   * @returns {Promise<{provider: string, apiKeys: Object}>}
   */
  getConfig: () => ipcRenderer.invoke('search-config:get'),

  /**
   * 写入搜索配置
   * @param {Object} config - { provider?: string, apiKeys?: Object }
   * @returns {Promise<{success: boolean}>}
   */
  setConfig: (config) => ipcRenderer.invoke('search-config:set', config),

  /**
   * 验证搜索 Provider API Key
   * @param {string} provider - Provider ID
   * @param {string} apiKey - API Key
   * @returns {Promise<{valid: boolean, provider?: string, error?: string}>}
   */
  verifyKey: (provider, apiKey) => ipcRenderer.invoke('search-config:verify-key', { provider, apiKey }),
},
```

---

### `src/settings-page.js` — 新增「网络搜索」子区域 UI (component, request-response)

**Analog:** `src/settings-page.js` AI 供应商管理（line 2540-2720，左右分栏 + showEditorForm）

**HTTP API 调用模式** — 使用现有 `settingsApi` helper（line 58-71），但搜索配置走独立路由：
```javascript
/**
 * 调用搜索配置 HTTP API
 * 参考 settingsApi 函数模式（line 58-71）
 */
async function searchConfigApi(route, options = {}) {
  const params = new URLSearchParams({ token: apiToken });
  const res = await fetch(`/api/search-config/${route}?${params.toString()}`, options);
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      if (data && data.error) detail = data.error;
    } catch { /* 非 JSON 响应忽略 */ }
    throw new Error(detail || `搜索配置 API 请求失败: ${res.status}`);
  }
  return res.json();
}
```

**Provider 列表渲染模式** — 参考 `renderProviderList()`（line 2592-2651）：
```javascript
/** 搜索 Provider 定义 */
const SEARCH_PROVIDERS = [
  { id: 'auto', name: '自动选择', requiresKey: false },
  { id: 'tavily', name: 'Tavily', requiresKey: true },
  { id: 'brave', name: 'Brave Search', requiresKey: true },
  { id: 'serper', name: 'Serper (Google)', requiresKey: true },
  { id: 'anysearch', name: 'AnySearch', requiresKey: true },
  { id: 'anysearch_free', name: 'AnySearch Free', requiresKey: false },
];

/** 当前选中的搜索 Provider ID */
let searchSelectedProviderId = null;

/** 搜索配置数据 */
let searchConfig = { provider: 'auto', apiKeys: {} };

/**
 * 渲染搜索 Provider 列表
 * 参考 renderProviderList()（line 2592-2651）
 */
function renderSearchProviderList() {
  const listEl = document.getElementById('searchProviderList');
  if (!listEl) return;

  listEl.innerHTML = '';
  SEARCH_PROVIDERS.forEach(p => {
    const hasKey = !!searchConfig.apiKeys[p.id];
    const item = document.createElement('div');
    item.className = 'ai-provider-item'
      + (searchSelectedProviderId === p.id ? ' active' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'provider-name';
    nameSpan.textContent = p.name;
    item.appendChild(nameSpan);

    // 状态图标：已配置/未配置/免费
    const statusSpan = document.createElement('span');
    if (p.requiresKey) {
      statusSpan.className = hasKey ? 'provider-status configured' : 'provider-status unconfigured';
      statusSpan.textContent = hasKey ? '已配置' : '未配置';
    } else {
      statusSpan.className = 'provider-status free';
      statusSpan.textContent = '免费';
    }
    item.appendChild(statusSpan);

    item.addEventListener('click', () => showSearchEditorForm(p.id));
    listEl.appendChild(item);
  });
}
```

**编辑表单模式** — 参考 `showEditorForm()`（line 2670-2720）：
```javascript
/**
 * 显示搜索 Provider 编辑表单
 * 参考 showEditorForm()（line 2670-2720）
 * @param {string} providerId - Provider ID
 */
function showSearchEditorForm(providerId) {
  const provider = SEARCH_PROVIDERS.find(p => p.id === providerId);
  if (!provider) return;

  searchSelectedProviderId = providerId;
  renderSearchProviderList();

  const form = document.getElementById('searchEditorForm');
  const empty = document.getElementById('searchEditorEmpty');
  if (empty) empty.style.display = 'none';
  if (form) form.style.display = '';

  const titleEl = document.getElementById('searchEditorTitle');
  const apiKeyInput = document.getElementById('searchEditorApiKey');
  const verifyBtn = document.getElementById('searchVerifyBtn');
  const verifyResult = document.getElementById('searchVerifyResult');

  if (titleEl) titleEl.textContent = provider.name;
  if (apiKeyInput) {
    if (provider.requiresKey) {
      apiKeyInput.value = searchConfig.apiKeys[provider.id] || '';
      apiKeyInput.parentElement.style.display = '';
      if (verifyBtn) verifyBtn.style.display = '';
    } else {
      apiKeyInput.parentElement.style.display = 'none';
      if (verifyBtn) verifyBtn.style.display = 'none';
    }
  }
  if (verifyResult) verifyResult.textContent = '';
}
```

**验证交互模式** — 参考 AI 供应商配置保存逻辑：
```javascript
/**
 * 验证搜索 Provider API Key（D-12: 手动点击验证按钮）
 * @param {string} providerId - Provider ID
 * @param {string} apiKey - API Key
 */
async function verifySearchKey(providerId, apiKey) {
  const verifyBtn = document.getElementById('searchVerifyBtn');
  const verifyResult = document.getElementById('searchVerifyResult');
  if (verifyBtn) verifyBtn.disabled = true;
  if (verifyResult) verifyResult.textContent = '验证中...';

  try {
    const result = await searchConfigApi('verify-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerId, apiKey }),
    });
    if (result.valid) {
      if (verifyResult) {
        verifyResult.className = 'verify-result success';
        verifyResult.textContent = 'Key 有效';
      }
    } else {
      if (verifyResult) {
        verifyResult.className = 'verify-result error';
        verifyResult.textContent = result.error || '验证失败';
      }
    }
  } catch (err) {
    if (verifyResult) {
      verifyResult.className = 'verify-result error';
      verifyResult.textContent = err.message || '验证失败';
    }
  } finally {
    if (verifyBtn) verifyBtn.disabled = false;
  }
}
```

---

### `src/settings.html` — 新增子区域 HTML 结构 (component, static)

**Analog:** `src/settings.html` AI 助手分区（line 265-360，左右分栏布局）

**HTML 结构模式** — 在 AI 助手分区末尾、`</section>` 之前追加：
```html
<!-- 网络搜索配置子区域（D-08: 可折叠） -->
<div class="settings-group search-config-section">
  <div class="settings-group-header" id="searchConfigToggle">
    <h2 class="settings-group-title">网络搜索</h2>
    <svg class="settings-group-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
  </div>
  <div class="settings-group-content" id="searchConfigContent" style="display:none;">
    <!-- Provider 选择左右分栏（D-09） -->
    <div class="settings-ai-split">
      <!-- 左侧 Provider 列表 -->
      <div class="settings-ai-sidebar">
        <div id="searchProviderList" class="ai-provider-list"></div>
      </div>

      <!-- 右侧编辑器 -->
      <div class="settings-ai-editor">
        <!-- 空状态 -->
        <div id="searchEditorEmpty" class="ai-editor-empty">
          <div style="font-size:15px;font-weight:600;margin-bottom:4px;">选择搜索 Provider</div>
          <div style="font-size:13px;color:var(--text-secondary);">点击左侧 Provider 查看配置</div>
        </div>

        <!-- 编辑表单（初始隐藏） -->
        <div id="searchEditorForm" class="ai-editor-form" style="display:none;">
          <div class="ai-editor-header">
            <h3 id="searchEditorTitle" class="ai-editor-title">Provider 名称</h3>
          </div>

          <div class="ai-form-group">
            <label>API Key</label>
            <div class="settings-input-wrapper">
              <input type="password" id="searchEditorApiKey" class="text-input" placeholder="输入 API Key">
              <button class="btn btn-secondary btn-sm" id="searchVerifyBtn">验证</button>
            </div>
            <div id="searchVerifyResult" class="verify-result"></div>
          </div>

          <div class="ai-editor-actions">
            <button class="btn btn-primary" id="searchSaveBtn">保存</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

**关键约束:** CSP `style-src 'self'` 无 unsafe-inline，初始隐藏用 CSS 类或 `style="display:none"` 属性（`el.style.display = 'flex'/'block'/'none'` 覆盖）。

---

### `main.js` — 新增 `/api/search-config/*` HTTP 路由 (controller, request-response)

**Analog:** `main.js` `handleSettingsApi`（line 1186-1239）

**路由注册模式** — 在 HTTP 服务器请求处理函数中（line 2016 附近）追加路由判断：
```javascript
// 搜索配置 JSON API（设置页面数据层）
if (reqPath.startsWith('/api/search-config/')) {
  handleSearchConfigApi(req, res, reqUrl);
  return;
}
```

**处理函数模式** — 参考 `handleSettingsApi`（line 1186-1239）：
```javascript
/**
 * 处理 /api/search-config/* 搜索配置 API 请求
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 * @param {URL} reqUrl - 解析后的请求 URL
 */
async function handleSearchConfigApi(req, res, reqUrl) {
  // token 鉴权（与 handleSettingsApi 一致）
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const route = reqUrl.pathname.replace('/api/search-config/', '');

    // GET /api/search-config/get
    if (route === 'get' && req.method === 'GET') {
      sendJson(res, 200, {
        provider: configStore.get('search.provider', 'auto'),
        apiKeys: maskApiKeys(configStore.get('search.apiKeys', {})),
      });
      return;
    }

    // POST /api/search-config/set
    if (route === 'set' && req.method === 'POST') {
      const updates = await readJsonBody(req);
      if (updates.provider) configStore.set('search.provider', updates.provider);
      if (updates.apiKeys) configStore.set('search.apiKeys', updates.apiKeys);
      sendJson(res, 200, { success: true });
      return;
    }

    // POST /api/search-config/verify-key
    if (route === 'verify-key' && req.method === 'POST') {
      const { provider, apiKey } = await readJsonBody(req);
      // 临时设置 Key 后验证，验证完恢复
      const origKeys = configStore.get('search.apiKeys', {});
      configStore.set(`search.apiKeys.${provider}`, apiKey);
      try {
        const result = await searchManager.doSearch('test', 1);
        sendJson(res, 200, { valid: true, provider: result.provider });
      } catch (err) {
        sendJson(res, 200, { valid: false, error: err.message });
      } finally {
        // 恢复原始 Key（D-15: 验证不删除）
        configStore.set('search.apiKeys', origKeys);
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[Realm] 搜索配置 API 错误:', err);
    sendJson(res, 500, { error: err.message });
  }
}

/**
 * 遮蔽 API Key 显示（返回时隐藏完整 Key）
 * @param {Object} apiKeys - { provider: apiKey }
 * @returns {Object} 遮蔽后的 API Keys
 */
function maskApiKeys(apiKeys) {
  const masked = {};
  for (const [key, value] of Object.entries(apiKeys || {})) {
    if (value && typeof value === 'string' && value.length > 8) {
      masked[key] = value.slice(0, 4) + '****' + value.slice(-4);
    } else {
      masked[key] = value || '';
    }
  }
  return masked;
}
```

**关键约束:** `searchManager` 引用需在 main.js 中已有（Phase 40 已通过 `initSearchManager` 初始化）。`sendJson` 和 `readJsonBody` 是 main.js 已有的辅助函数。`REALM_TOKEN` 是 main.js 已有的 token 常量。

---

## Shared Patterns

### HTTP API 路由 + Token 鉴权
**Source:** `main.js` line 1186-1191 (`handleSettingsApi`)
**Apply to:** main.js 新增 `handleSearchConfigApi`
```javascript
if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
  sendJson(res, 403, { error: 'Forbidden' });
  return;
}
```

### IPC assertTrustedSender
**Source:** `ipc-handlers.js` line 78-87
**Apply to:** 所有新增 IPC 通道
```javascript
ipcMain.handle('search-config:get', (event) => {
  assertTrustedSender(event);
  // ...
});
```

### electron-store 配置读写
**Source:** `ipc-handlers.js` line 2004-2033 (`settings:get` / `settings:set`)
**Apply to:** search-config IPC 和 HTTP API
```javascript
// 读取
configStore.get('search.provider', 'auto');
configStore.get('search.apiKeys', {});
// 写入
configStore.set('search.provider', provider);
configStore.set('search.apiKeys', apiKeys);
```

### 设置页 webview 数据获取（HTTP API 而非 IPC）
**Source:** `src/settings-page.js` line 58-71 (`settingsApi`)
**Apply to:** settings-page.js 搜索配置数据获取
```javascript
// 关键：webview guest 不能走 IPC（assertTrustedSender 拒绝），必须走 HTTP API
const params = new URLSearchParams({ token: apiToken });
const res = await fetch(`/api/search-config/get?${params.toString()}`);
```

### CSP 安全的显隐控制
**Source:** CLAUDE.md "内部页面 CSP" 规则
**Apply to:** settings.html 搜索配置子区域
```javascript
// 初始隐藏用 style="display:none"，JS 覆盖用具体值
el.style.display = 'flex';  // 显示
el.style.display = 'none';  // 隐藏
// 不要依赖 '' 回落到 markup 状态
```

### 工具返回格式
**Source:** `ai-manager.js` line 2948-2956 (web_search)
**Apply to:** web_fetch 工具 execute 返回值
```javascript
return {
  content: [{ type: 'text', text: result.markdown }],
  details: { url: result.finalUrl, format: result.format, truncated: result.truncated },
};
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | 所有 7 个文件均有精确匹配的现有模拟 |

## Metadata

**Analog search scope:** `search-manager.js`, `ai-manager.js`, `ipc-handlers.js`, `src/preload.js`, `src/settings-page.js`, `src/settings.html`, `main.js`
**Files scanned:** 7
**Pattern extraction date:** 2026-08-27
