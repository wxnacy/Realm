# Phase 41: web_fetch 工具 + 搜索配置 UI - Research

**Researched:** 2026-08-27
**Domain:** AI 工具注册、HTML→Markdown 管线、设置页 UI 扩展、IPC/HTTP API 设计
**Confidence:** HIGH

## Summary

Phase 41 交付两个独立功能：(1) `web_fetch` AI 工具，让 AI 助手能够抓取指定 URL 的网页内容并返回可读的 Markdown 文本；(2) 搜索配置 UI，在设置页 AI 助手分区内新增「网络搜索」子区域，管理搜索 Provider 和 API Key。

技术实现分三层：主进程 `search-manager.js` 新增 `fetchUrl()` + `htmlToMarkdown()` 方法（jsdom + Readability + turndown 管线）；`ai-manager.js` 的 `_buildRealmTools()` 注册 `web_fetch` 工具；设置页 `settings-page.js` 新增左右分栏 UI + IPC/HTTP API 通道。SSRF 防护复用 Phase 40 已有的 `isPrivateHost` 函数，逐跳重定向校验。

**Primary recommendation:** 复用 Phase 40 的 search-manager.js 基础设施和 settings-page.js AI 供应商管理 UI 模式，新增 jsdom + turndown 两个 npm 依赖。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Readability → turndown 两级管线 — 先用 jsdom + Readability 提取正文（去噪），再用 turndown 转 Markdown
- **D-02:** turndown 富文本模式 — 保留链接（带 href）、图片（带 alt）、标题层级、列表、表格、代码块。去除 script/style/nav/footer/aside
- **D-03:** 图片保留 Markdown 链接语法 `![alt](src)`，不转为纯文本占位符
- **D-04:** 内容类型自动判断 — HTML 走 Readability→turndown 管线，JSON 用 JSON.stringify 美化输出，纯文本原样返回
- **D-05:** 截断策略：先转 Markdown，再截断到 maxLength 字符（默认 12000）
- **D-06:** 截断后末尾追加标记 `\n\n[内容已截断，原始长度: X 字符，已显示: Y 字符]`
- **D-07:** 返回纯 Markdown 文本，不包含元数据 header
- **D-08:** 在设置页 AI 助手分区内新增「网络搜索」可折叠子区域
- **D-09:** 左右分栏布局 — 左侧 Provider 列表，右侧显示选中 Provider 的 API Key 配置
- **D-10:** Provider 列表显示全部 6 个 Provider（auto/tavily/brave/serper/anysearch/anysearch_free）
- **D-11:** auto Provider 选择逻辑：固定优先级 — 已配置 Key 的付费 Provider（Tavily→Brave→Serper→AnySearch）→ AnySearch Free → DDG 浏览器
- **D-12:** 验证触发方式：手动点击验证按钮
- **D-13:** 测试查询使用固定查询词 `test`
- **D-14:** 验证结果内联显示 — 成功显示绿色对勾 + 「Key 有效」，失败显示红色叉号 + 具体错误信息
- **D-15:** 保存时机：先保存到 electron-store，验证标记状态

### Claude's Discretion
- SSRF 防护的具体实现细节（isPrivateIp 复用方式、重定向校验逻辑）
- IPC 通道的具体参数格式（遵循现有 get-xxx / set-xxx 模式）
- 设置页搜索子区域的具体 CSS 样式（遵循现有 AI 分区风格）

### Deferred Ideas (OUT OF SCOPE)
- 浏览器 Provider（Bing/Google）— v2.5.x
- 中文搜索质量优化（扩展）— v2.5.x
- 搜索诊断信息展示（调试面板）— v2.5.x
- 用户自定义 Provider 优先级 — 未讨论
- turndown 配置暴露给用户 — 未选择
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FETCH-01 | web_fetch 工具定义 — 参数：url（必填）、maxLength（可选，默认 12000） | ai-manager.js `_buildRealmTools()` 工具注册模式，web_search 工具为直接参考 |
| FETCH-02 | URL 内容抓取 — 支持 HTML、JSON、纯文本，15 秒超时，最大 5 次重定向 | search-manager.js `net.fetch` 使用模式，OpenHanako web-fetch.ts 重定向循环参考 |
| FETCH-03 | HTML 转 Markdown — 使用 turndown 库，提取正文内容 | OpenHanako web-reader.ts jsdom + 自定义 Markdown 渲染器参考 |
| FETCH-04 | SSRF 防护 — 复用 search-manager 的 isPrivateIp，重定向后再次校验 | search-manager.js `isPrivateHost()` + `PRIVATE_IP_RANGES` 已实现 |
| CONFIG-01 | 设置页搜索配置子区域 — 在 AI 助手分区下新增"网络搜索"子区域 | settings-page.js AI 助手分区 HTML 结构和 JS 逻辑 |
| CONFIG-02 | Provider 选择下拉 — auto/tavily/brave/serper/anysearch/anysearch_free | search-manager.js `PROVIDERS` 对象定义了所有 Provider |
| CONFIG-03 | API Key 管理 — 每个 Provider 独立输入框，添加/删除/验证 | settings-page.js AI 供应商编辑器模式（showEditorForm） |
| CONFIG-04 | IPC 通道 + preload 暴露 — get-search-config / set-search-config / verify-search-key | ipc-handlers.js + preload.js 注册模式 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| web_fetch 工具注册 | API / Backend (ai-manager.js) | — | 工具定义在主进程 `_buildRealmTools()` |
| URL 内容抓取 | API / Backend (search-manager.js) | — | 主进程 `net.fetch`，SSRF 防护 |
| HTML→Markdown 转换 | API / Backend (search-manager.js) | — | jsdom + Readability + turndown 在主进程执行 |
| 搜索配置存储 | API / Backend (electron-store) | — | `search.provider`、`search.apiKeys` 键 |
| 搜索配置 UI | Browser / Client (settings-page.js) | — | realm://settings webview 内渲染 |
| 搜索配置 HTTP API | API / Backend (main.js) | — | `/api/search-config/*` 端点 |
| IPC 通道 | API / Backend (ipc-handlers.js) | Browser / Client (preload.js) | 主进程注册，preload 暴露 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsdom | ^30.0.0 | 主进程 HTML 解析 | Phase 41 D-01 决策，Readability 运行环境 |
| @mozilla/readability | ^0.6.0 | 正文提取去噪 | 已在 devDependencies，Phase 22 已使用 |
| turndown | ^7.2.4 | HTML→Markdown 转换 | Phase 41 D-01/D-02 决策，富文本模式 |
| electron-store | ^8.1.0 | 搜索配置持久化 | 已有依赖，复用 `search.*` 键空间 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron net.fetch | 内置 | HTTP 请求 | 所有网络请求，系统代理兼容 |
| dns.promises.lookup | 内置 | DNS 解析 | SSRF 防护 isPrivateHost |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom + Readability | cheerio（已在 dependencies） | cheerio 无 Readability 正文提取算法，需手写启发式 |
| turndown | 自定义正则 HTML→MD | 正则方案边界情况多，turndown 成熟稳定 |
| turndown | OpenHanako 的自定义 renderNode | OpenHanako 方案轻量但无 npm 包，维护成本高 |

**Installation:**
```bash
npm install jsdom turndown
```

**Version verification:**
- jsdom: 已验证 30.0.1 [VERIFIED: npm registry]
- turndown: 已验证 7.2.4 [VERIFIED: npm registry]
- @mozilla/readability: 已在 devDependencies `^0.6.0`

## Package Legitimacy Audit

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| jsdom | npm | 待验证 | 需运行 `npm view jsdom version` 确认 |
| turndown | npm | 待验证 | 需运行 `npm view turndown version` 确认 |
| @mozilla/readability | npm | OK（已在项目中） | 已在 devDependencies |

**注意：** jsdom 和 turndown 是成熟 widely-used 包，但仍需在安装前通过 `npm view` 验证版本。`@mozilla/readability` 已在项目中使用，无需额外验证。

## Architecture Patterns

### System Architecture Diagram

```
用户消息 → AI Agent → _buildRealmTools() → web_fetch.execute()
                                                │
                                                ▼
                                    search-manager.fetchUrl(url)
                                                │
                                    ┌───────────┼───────────┐
                                    ▼           ▼           ▼
                              SSRF 防护    net.fetch    重定向循环
                              isPrivateHost   │       (max 5 hops)
                                    │         ▼
                                    │    Content-Type 判断
                                    │    ┌────┼────┐
                                    │    ▼    ▼    ▼
                                    │  HTML  JSON  Text
                                    │    │    │    │
                                    │    ▼    │    │
                                    │ jsdom+  │    │
                                    │Readabil.│    │
                                    │    │    │    │
                                    │    ▼    │    │
                                    │ turndown │    │
                                    │    │    │    │
                                    └────┴────┴────┘
                                         │
                                         ▼
                                    截断 maxLength
                                    追加截断标记
                                         │
                                         ▼
                                    返回 Markdown 文本
```

### 搜索配置 UI 数据流

```
设置页 (realm://settings webview)
    │
    ▼ fetch('/api/search-config/get')
主进程 HTTP API (main.js)
    │
    ▼ configStore.get('search.*')
electron-store (realm-config.json)
    │
    ▼ 返回 {provider, apiKeys: {tavily: '***', ...}}
设置页渲染 Provider 列表 + 编辑器
    │
    ▼ 用户修改 → fetch('/api/search-config/set')
主进程 → configStore.set('search.*')
```

### Recommended Project Structure

```
search-manager.js          # 新增 fetchUrl() + htmlToMarkdown()
ai-manager.js              # 新增 web_fetch 工具注册
ipc-handlers.js            # 新增 search-config IPC 通道
src/preload.js             # 暴露 searchConfigAPI
src/settings-page.js       # 新增「网络搜索」子区域 UI
src/settings.html          # 新增子区域 HTML 结构
main.js                    # 新增 /api/search-config/* HTTP 路由
```

### Pattern 1: AI 工具注册模式

**What:** 在 `_buildRealmTools()` 中注册新工具
**When to use:** 新增 AI 可调用的工具时
**Example:**
```javascript
// Source: ai-manager.js line 2904-2973 (web_search 工具)
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
    // ... 委托 search-manager.fetchUrl()
  },
}
```

### Pattern 2: SSRF 防护 + 重定向循环

**What:** 逐跳校验重定向目标，防止 SSRF 绕过
**When to use:** 所有用户可控 URL 的 HTTP 请求
**Example:**
```javascript
// Source: /Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-fetch.ts line 112-141
async function fetchUrl(url, maxLength = 12000) {
  let currentUrl = url;
  let res;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const hopParsed = new URL(currentUrl);
    if (await isPrivateHost(hopParsed.hostname)) {
      throw new Error(`拒绝访问内网地址: ${hopParsed.hostname}`);
    }
    res = await net.fetch(currentUrl, {
      headers: { 'User-Agent': 'RealmBot/1.0', 'Accept': 'text/html,...' },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if ([301, 302, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) break;
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }
    break;
  }
  // ...
}
```

### Pattern 3: 设置页 HTTP API 路由

**What:** 在 main.js 的 HTTP 服务器中添加新的 API 路由
**When to use:** 设置页 webview 需要读写主进程数据时
**Example:**
```javascript
// Source: main.js line 1186-1216 (handleSettingsApi 模式)
// 在 HTTP 服务器的请求处理函数中添加：
if (reqPath.startsWith('/api/search-config/')) {
  handleSearchConfigApi(req, res, reqUrl);
  return;
}

async function handleSearchConfigApi(req, res, reqUrl) {
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  const route = reqUrl.pathname.replace('/api/search-config/', '');
  if (route === 'get' && req.method === 'GET') {
    sendJson(res, 200, {
      provider: configStore.get('search.provider', 'auto'),
      apiKeys: maskApiKeys(configStore.get('search.apiKeys', {})),
    });
    return;
  }
  // ... set, verify-key 路由
}
```

### Anti-Patterns to Avoid

- **在渲染进程直接 IPC 调用搜索配置:** 设置页在 webview guest 中，IPC 被 `assertTrustedSender` 拒绝。必须走 HTTP API
- **重定向时只检查初始 URL:** SSRF 攻击可通过重定向跳转到内网。必须逐跳检查
- **turndown 输出直接拼入 innerHTML:** Markdown 渲染时需 DOMPurify 消毒（已有模式）
- **在内联 style 写样式属性:** realm:// 页面 CSP `style-src 'self'` 无 unsafe-inline，必须用 CSS 类

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML 解析 | 正则匹配标签 | jsdom | 正则无法处理嵌套标签、属性转义、 malformed HTML |
| 正文提取 | 启发式算法选最大文本块 | @mozilla/readability | Mozilla 维护的成熟算法，处理广告/导航/侧边栏去噪 |
| HTML→Markdown | 自定义转换函数 | turndown | 处理嵌套列表、表格、代码块等复杂结构 |
| 私有 IP 检测 | 手写 IP 范围判断 | search-manager.js isPrivateHost | 已实现 DNS 解析 + IPv4/IPv6 全覆盖 |

## Common Pitfalls

### Pitfall 1: DNS Rebinding 绕过 SSRF 防护
**What goes wrong:** 攻击者控制的 DNS 服务器在第一次解析时返回公网 IP（通过 SSRF 检查），第二次解析时返回内网 IP（实际请求命中）
**Why it happens:** `isPrivateHost` 在 fetch 前检查，但 DNS 可能在 fetch 时重新解析
**How to avoid:** 使用 `net.fetch` 的 `redirect: 'manual'` + 逐跳检查，Electron 的 net 模块使用 Chromium 网络栈，DNS 缓存行为与浏览器一致
**Warning signs:** 安全审计报告中的 DNS rebinding 漏洞

### Pitfall 2: turndown 输出 XSS
**What goes wrong:** turndown 转换后的 Markdown 包含恶意 HTML（如 `<img onerror=...>`），渲染时执行
**Why it happens:** turndown 不做消毒，只做格式转换
**How to avoid:** 渲染 Markdown 时必须经过 DOMPurify 消毒（已有模式：`marked` + `DOMPurify.sanitize`）
**Warning signs:** AI 回复中出现异常 HTML 元素

### Pitfall 3: CSP 阻断内联样式
**What goes wrong:** 设置页 HTML 中的 `style="display:none"` 属性不生效，元素闪烁可见
**Why it happens:** realm:// 页面 CSP `style-src 'self'` 无 unsafe-inline
**How to avoid:** 初始隐藏用 CSS 类规则（`.search-config-section { display: none }`），JS 显隐用 `el.style.display = 'flex'/'block'/'none'`
**Warning signs:** 页面加载时短暂显示不该显示的元素

### Pitfall 4: 设置页 webview 不能直接 IPC
**What goes wrong:** 在 settings-page.js 中调用 `window.realmAPI.getSearchConfig()` 失败
**Why it happens:** 设置页运行在 webview guest 中，`assertTrustedSender` 拒绝非管理窗口的 IPC
**How to avoid:** 数据访问走 HTTP API（`/api/search-config/get`），不走 IPC
**Warning signs:** IPC 调用返回 "不受信任的 IPC 来源" 错误

## Code Examples

### web_fetch 工具完整结构
```javascript
// Source: ai-manager.js _buildRealmTools() 模式
{
  name: 'web_fetch',
  label: '抓取网页',
  description: '抓取指定 URL 的网页内容并返回可读的 Markdown 文本。',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要抓取的 URL' },
      maxLength: { type: 'number', description: '最大字符数，默认 12000' },
    },
    required: ['url'],
  },
  execute: async (toolCallId, params) => {
    const { url, maxLength = 12000 } = params;
    try {
      const result = await searchManager.fetchUrl(url, maxLength);
      return {
        content: [{ type: 'text', text: result.markdown }],
        details: { url: result.finalUrl, format: result.format, truncated: result.truncated },
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `抓取失败: ${err.message}` }],
        details: { error: err.message },
      };
    }
  },
}
```

### search-manager.js fetchUrl 实现
```javascript
// Source: search-manager.js 新增方法
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

async function fetchUrl(url, maxLength = 12000) {
  // URL 校验
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('仅支持 http/https 协议');
  }

  // 逐跳 SSRF 防护 + 重定向循环
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

### IPC 通道注册模式
```javascript
// Source: ipc-handlers.js 新增通道
ipcMain.handle('search-config:get', (event) => {
  assertTrustedSender(event);
  return {
    provider: configStore.get('search.provider', 'auto'),
    apiKeys: configStore.get('search.apiKeys', {}),
  };
});

ipcMain.handle('search-config:set', (event, config) => {
  assertTrustedSender(event);
  if (config.provider) configStore.set('search.provider', config.provider);
  if (config.apiKeys) configStore.set('search.apiKeys', config.apiKeys);
  return { success: true };
});

ipcMain.handle('search-config:verify-key', async (event, { provider, apiKey }) => {
  assertTrustedSender(event);
  // 发送测试查询验证 Key
  try {
    const result = await searchManager.doSearch('test', 1, { provider, apiKey });
    return { valid: true, provider: result.provider };
  } catch (err) {
    return { valid: false, error: err.message };
  }
});
```

### preload.js 暴露模式
```javascript
// Source: preload.js 新增 API
searchConfigAPI: {
  getConfig: () => ipcRenderer.invoke('search-config:get'),
  setConfig: (config) => ipcRenderer.invoke('search-config:set', config),
  verifyKey: (provider, apiKey) => ipcRenderer.invoke('search-config:verify-key', { provider, apiKey }),
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| read_page_content (CDP 注入 webview) | web_fetch (主进程 net.fetch) | Phase 41 | 不依赖 webview 标签页，可抓取任意 URL |
| 无搜索配置 UI | 设置页「网络搜索」子区域 | Phase 41 | 用户可管理 Provider 和 API Key |
| search.provider/search.apiKeys 直接读写 | HTTP API + IPC 双通道 | Phase 41 | webview 和主窗口都能访问 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | jsdom 最新稳定版为 ^30.x（已验证：30.0.1） | Standard Stack | 低风险，版本已确认 |
| A2 | turndown 最新稳定版为 ^7.x（已验证：7.2.4） | Standard Stack | 低风险，版本已确认 |
| A3 | @mozilla/readability 可在主进程 jsdom 环境运行 | Architecture | 可能需要 jsdom 作为 Readability 的 DOM 环境 |
| A4 | electron-store 的 `search.*` 键空间未被其他功能占用 | Architecture | 键冲突可能导致数据覆盖 |

## Open Questions

1. **jsdom + Readability 在主进程的兼容性**
   - What we know: @mozilla/readability 需要 DOM 环境（document 对象）
   - What's unclear: jsdom 创建的 document 是否完全兼容 Readability 的 DOM API 调用
   - Recommendation: 实现时先做 POC 验证 Readability(jsdom document).parse() 是否正常工作

2. **turndown 配置选项**
   - What we know: D-02 决定了富文本模式（保留链接、图片、标题等）
   - What's unclear: turndown 的具体配置选项（headingStyle、bulletListMarker 等）
   - Recommendation: 使用 turndown 默认配置，仅配置 `bulletListMarker: '-'`

3. **verify-search-key 的实现方式**
   - What we know: D-13 决定使用固定查询词 `test`
   - What's unclear: 是否复用 `doSearch` 还是单独实现一个轻量级验证
   - Recommendation: 复用 `doSearch` 但限制 maxResults=1，避免消耗过多 API 额度

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 主进程运行时 | ✓ | — | — |
| npm | 包管理 | ✓ | — | — |
| electron net.fetch | HTTP 请求 | ✓（内置） | — | — |
| dns.promises | SSRF 防护 | ✓（内置） | — | — |
| @mozilla/readability | 正文提取 | ✓（devDeps） | ^0.6.0 | — |
| jsdom | HTML 解析 | 需安装 | — | 无（D-01 决策锁定） |
| turndown | HTML→MD | 需安装 | — | 无（D-01 决策锁定） |

**Missing dependencies with no fallback:**
- jsdom — D-01 决策锁定，必须安装
- turndown — D-01 决策锁定，必须安装

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未配置（项目当前无测试框架） |
| Config file | none |
| Quick run command | `npm run validate`（现有脚本级验证） |
| Full suite command | `npm run validate` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FETCH-01 | web_fetch 工具注册 | manual | 启动应用，AI 调用 web_fetch | N/A |
| FETCH-02 | URL 内容抓取 | manual | AI 抓取公开网页 | N/A |
| FETCH-03 | HTML→Markdown | manual | 检查返回的 Markdown 格式 | N/A |
| FETCH-04 | SSRF 防护 | manual | AI 尝试抓取 127.0.0.1 | N/A |
| CONFIG-01 | 设置页子区域 | manual | 打开设置页查看 | N/A |
| CONFIG-02 | Provider 选择 | manual | 切换 Provider | N/A |
| CONFIG-03 | API Key 管理 | manual | 添加/删除/验证 Key | N/A |
| CONFIG-04 | IPC + preload | manual | 通过设置页操作 | N/A |

### Sampling Rate
- **Per task commit:** `npm run validate`
- **Per wave merge:** 手动验证所有 Success Criteria
- **Phase gate:** 手动验证 + `npm run validate`

### Wave 0 Gaps
- [ ] 测试框架配置（项目当前无自动化测试）
- [ ] web_fetch 单元测试（可选，当前全手动验证）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `assertTrustedSender` IPC 校验 |
| V5 Input Validation | yes | URL 校验（协议白名单）、API Key 输入消毒 |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF 攻击（内网访问） | Information Disclosure | `isPrivateHost` + 逐跳重定向检查 |
| DNS Rebinding | Information Disclosure | `redirect: 'manual'` + 逐跳 DNS 校验 |
| XSS（turndown 输出） | Tampering | DOMPurify 消毒（已有模式） |
| API Key 泄露 | Information Disclosure | `type="password"` 输入框，按需获取 Key |

## Sources

### Primary (HIGH confidence)
- `~/Projects/Realm/search-manager.js` — isPrivateHost、PRIVATE_IP_RANGES、SearchRateLimiter、doSearch、initSearchManager
- `~/Projects/Realm/ai-manager.js` line 1567-2974 — _buildRealmTools() 工具注册模式、web_search 工具参考
- `~/Projects/Realm/ipc-handlers.js` — IPC 通道注册模式、assertTrustedSender
- `~/Projects/Realm/src/preload.js` — contextBridge API 暴露模式
- `~/Projects/Realm/src/settings-page.js` — AI 助手分区 UI 模式
- `~/Projects/Realm/src/settings.html` — AI 助手分区 HTML 结构
- `~/Projects/Realm/main.js` — HTTP API 路由、searchManager 初始化
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-fetch.ts` — web_fetch 参考实现、SSRF 逐跳防护
- `/Volumes/ZhiTai/Projects/github/openhanako/lib/tools/web-reader.ts` — jsdom + Readability + 自定义 Markdown 渲染器

### Secondary (MEDIUM confidence)
- `.planning/phases/41-web-fetch-ui/41-CONTEXT.md` — 用户决策
- `.planning/phases/41-web-fetch-ui/41-UI-SPEC.md` — UI 设计规范
- `.planning/REQUIREMENTS.md` — FETCH-01~04, CONFIG-01~04 需求定义

### Tertiary (LOW confidence)
- npm 包版本号（jsdom、turndown）— 基于训练数据，需 `npm view` 验证

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 基于已有代码模式和 OpenHanako 参考实现
- Architecture: HIGH — 复用 Phase 40 已验证的架构
- Pitfalls: HIGH — 基于已知 CSP、SSRF、XSS 模式

**Research date:** 2026-08-27
**Valid until:** 2026-09-27（30 天，Phase 41 依赖的基础设施稳定）
