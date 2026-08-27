---
phase: 41-web-fetch-ui
reviewed: 2026-08-27T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - search-manager.js
  - ai-manager.js
  - ipc-handlers.js
  - main.js
  - package.json
  - src/preload.js
  - src/settings-page.js
  - src/settings.html
  - src/styles/main.css
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-08-27T12:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 41 adds two features: (1) a `web_fetch` AI tool backed by `fetchUrl` + `htmlToMarkdown` in search-manager.js using jsdom/Readability/turndown, and (2) a search config UI in the settings page with verify-key support. The implementation has sound SSRF protection and correct dependency management, but contains a race condition in verify-key that can corrupt stored API keys, and an inconsistency where the IPC verify-key handler ignores the parameters passed by the caller.

## Critical Issues

### CR-01: verify-key 存在并发竞态，可覆盖其他 Provider 的 API Key

**File:** `main.js:1510-1525` and `ipc-handlers.js:2070-2078`

**Issue:** HTTP `/api/search-config/verify-key` 的实现是：(1) 备份全部 apiKeys，(2) 写入待验证的 key，(3) 执行 doSearch，(4) finally 恢复备份。如果两个请求并发执行（用户快速切换 Provider 并点击验证），请求 B 的 finally 恢复的是请求 A 开始前的快照，导致请求 A 写入的 key 被静默覆盖丢失。

同时 IPC handler `search-config:verify-key`（ipc-handlers.js:2070-2078）完全忽略传入的 `{ provider, apiKey }` 参数，直接调用 `searchManager.doSearch('test', 1)`，使用 configStore 中已有的 key 做验证——与 HTTP handler 的语义不一致，且与 preload.js 暴露的 `verifyKey(provider, apiKey)` 签名矛盾。

**Fix:**
```javascript
// IPC handler 应使用传入的 provider 和 apiKey：
ipcMain.handle('search-config:verify-key', async (event, { provider, apiKey }) => {
  assertTrustedSender(event);
  // 临时写入单个 provider key（不影响其他 provider）
  const origKey = configStore.get(`search.apiKeys.${provider}`);
  configStore.set(`search.apiKeys.${provider}`, apiKey);
  try {
    const result = await searchManager.doSearch('test', 1);
    return { valid: true, provider: result.provider };
  } catch (err) {
    return { valid: false, error: err.message };
  } finally {
    // 只恢复单个 provider key，而非整个 apiKeys 对象
    if (origKey !== undefined) {
      configStore.set(`search.apiKeys.${provider}`, origKey);
    } else {
      // 删除临时写入的 key
      const keys = configStore.get('search.apiKeys', {});
      delete keys[provider];
      configStore.set('search.apiKeys', keys);
    }
  }
});
```

HTTP handler 同理，改为按 provider 单键备份/恢复。

### CR-02: search-config:set 缺少输入校验，可写入任意数据

**File:** `main.js:1501-1506` and `ipc-handlers.js:2057-2061`

**Issue:** HTTP `/api/search-config/set` 和 IPC `search-config:set` 都不校验 `config.provider` 和 `config.apiKeys` 的值类型和内容。攻击者可通过 webview guest 的 HTTP API（持有 token）写入非字符串 provider（如数字、对象），或在 apiKeys 中注入非字符串值，污染 configStore 导致后续读取时类型异常。

```javascript
// main.js:1501-1506 — 当前代码
if (updates.provider) configStore.set('search.provider', updates.provider);
if (updates.apiKeys) configStore.set('search.apiKeys', updates.apiKeys);
```

**Fix:**
```javascript
// 校验 provider 为已知字符串
const VALID_PROVIDERS = ['auto', 'tavily', 'brave', 'serper', 'anysearch', 'anysearch_free'];
if (updates.provider) {
  if (typeof updates.provider !== 'string' || !VALID_PROVIDERS.includes(updates.provider)) {
    sendJson(res, 400, { error: '无效的搜索 Provider' });
    return;
  }
  configStore.set('search.provider', updates.provider);
}
// 校验 apiKeys 为对象且值为字符串
if (updates.apiKeys) {
  if (typeof updates.apiKeys !== 'object' || Array.isArray(updates.apiKeys)) {
    sendJson(res, 400, { error: '无效的 apiKeys 格式' });
    return;
  }
  for (const [k, v] of Object.entries(updates.apiKeys)) {
    if (typeof k !== 'string' || typeof v !== 'string') {
      sendJson(res, 400, { error: 'apiKeys 键值必须为字符串' });
      return;
    }
  }
  configStore.set('search.apiKeys', updates.apiKeys);
}
```

## Warnings

### WR-01: web_fetch 工具错误不抛出异常，Agent 无法感知失败

**File:** `ai-manager.js:2997-3006`

**Issue:** `web_fetch` 的 execute 函数 catch 所有错误后返回 `{ content: [{ type: 'text', text: '抓取失败: ...' }] }`，不抛出异常。pi-agent-core 的工具调用框架依赖异常来标记工具失败（其他工具如 read_page_content、fill_form 均 throw）。当 fetchUrl 失败时，Agent 会把错误消息当作正常内容处理，可能基于错误消息生成误导性回复。

**Fix:**
```javascript
// 将 catch 块改为抛出异常，与其他工具行为一致
} catch (err) {
  throw new Error(`抓取失败: ${err.message}`);
}
```

### WR-02: fetchUrl 重定向未校验目标协议

**File:** `search-manager.js:1520-1525`

**Issue:** `fetchUrl` 在重定向循环中，仅在每跳开始时检查 `isPrivateHost`，但未校验重定向目标的协议。如果服务端返回 `Location: javascript:...` 或 `Location: data:...`，`new URL(loc, currentUrl)` 会成功解析，但 `net.fetch` 对这些协议的行为不确定。

**Fix:**
```javascript
// 在重定向后、下一跳 isPrivateHost 检查前，增加协议校验
if ([301, 302, 307, 308].includes(res.status)) {
  const loc = res.headers.get('location');
  if (!loc) break;
  currentUrl = new URL(loc, currentUrl).href;
  // 校验重定向目标协议
  if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
    throw new Error(`重定向到非 HTTP 协议: ${currentUrl}`);
  }
  continue;
}
```

### WR-03: showConfirmBar 使用 innerHTML 拼接用户可控消息

**File:** `src/settings-page.js:3196-3204`

**Issue:** `showConfirmBar` 函数的 `message` 参数直接拼入 innerHTML 模板字符串。虽然当前调用方传入的是硬编码中文字符串（'当前 Provider 已有 API Key，确认覆盖？'），但如果未来有其他调用方传入用户输入，会构成 XSS。settings.html 的 CSP 是 `script-src 'self'`（无 unsafe-inline），能阻止脚本执行，但 HTML 注入仍可改变 DOM 结构。

**Fix:**
```javascript
// 使用 textContent 设置消息文本
const bar = document.createElement('div');
bar.className = 'search-confirm-bar';

const msgSpan = document.createElement('span');
msgSpan.className = 'search-confirm-message';
msgSpan.textContent = message;

const okBtn = document.createElement('button');
okBtn.className = 'btn btn-primary btn-sm search-confirm-ok';
okBtn.textContent = confirmText;

const cancelBtn = document.createElement('button');
cancelBtn.className = 'btn btn-secondary btn-sm search-confirm-cancel';
cancelBtn.textContent = cancelText;

bar.appendChild(msgSpan);
bar.appendChild(okBtn);
bar.appendChild(cancelBtn);
```

### WR-04: settings.html CSP 允许内联 style 属性

**File:** `src/settings.html:9`

**Issue:** CSP 声明为 `style-src 'self'`（无 unsafe-inline），但 HTML 中多处使用 `style="display:none;"` 内联样式（如 `searchEditorForm`、`aiEditorEmpty`、`searchEditorEmpty` 等）。根据 CLAUDE.md 明确记录："realm:// 页面的 CSP 是 style-src 'self'（无 unsafe-inline），HTML markup 里的 style 属性不生效"。这意味着这些带 `style="display:none"` 的元素在页面加载时会短暂或持续可见，直到 JS 执行 CSSOM 操作覆盖。

**Fix:** 将初始隐藏状态改为 CSS class 控制：
```html
<!-- 替换 style="display:none;" 为 hidden class -->
<div id="searchEditorForm" class="ai-editor-form hidden">
```
```css
.ai-editor-form.hidden { display: none; }
```

## Info

### IN-01: @mozilla/readability 从 devDependencies 移到 dependencies

**File:** `package.json:30`

**Issue:** `@mozilla/readability` 从 devDependencies 移到了 dependencies。这是正确的改动（search-manager.js 在运行时 require 它），但值得注意的是它同时被 `ai-manager.js` 的 `READABILITY_SCRIPT`（读取 `lib/readability-bundle.js` 文件）使用。两者是不同的使用路径：search-manager 用 npm 包的 Node API，ai-manager 用打包后的浏览器 bundle。确认 `lib/readability-bundle.js` 仍由单独的构建流程维护。

### IN-02: search-manager.js 新增三个 npm 依赖的顶层 require

**File:** `search-manager.js:26-28`

**Issue:** 模块顶层新增了 `jsdom`、`@mozilla/readability`、`turndown` 三个 require。这些是主进程模块的同步加载，会增加应用启动时间。jsdom 尤其重量级。如果 web_fetch 功能使用频率低，可考虑延迟加载（在 fetchUrl 首次调用时 require）。

### IN-03: DuckDuckGo Browser Provider 未包含在搜索配置 UI 中

**File:** `src/settings-page.js:2557-2565`

**Issue:** `SEARCH_PROVIDERS` 数组未包含 `duckduckgo_browser`。这是合理的（浏览器模式不需要 API Key，且 auto fallback 链会自动包含它），但用户无法从 UI 知道 DDG 浏览器搜索是可用的。可在自动选择的描述中补充说明。

---

_Reviewed: 2026-08-27T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
