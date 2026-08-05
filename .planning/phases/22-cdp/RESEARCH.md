# Phase 22 Research: CDP 管理器扩展 + 基础网页操控工具

**Research Date:** 2026-08-02
**Status:** Complete
**Phase Goal:** AI Agent 能够读取网页内容、提取链接、在容器中打开链接 — 所有后续阶段的 CDP 基础

---

## Executive Summary

Phase 22 将扩展现有 `cdp-manager.js` 模块，从仅支持 Network 域的请求抓取，升级为支持 Runtime/DOM/Page 域的统一调试器管理器。基于此基础设施，新增 3 个 AI 工具：`read_page_content`、`extract_links`、`open_link`。

**核心价值：** 为后续阶段（智能上下文引用、自动填表、脚本生成）奠定 CDP 基础设施。

**关键技术决策：**
- 使用 `Runtime.evaluate` 注入 Mozilla Readability 库提取可读内容
- 按需附加/断开调试器，避免资源占用
- 100KB 内容截断策略，平衡信息完整性与性能

---

## 1. Domain Analysis

### 1.1 Chrome DevTools Protocol (CDP) 核心概念

**CDP 域（Domains）** 是 CDP 协议的组织单元，每个域提供特定功能：

| 域名 | 功能 | Phase 22 用途 |
|------|------|---------------|
| **Runtime** | JavaScript 执行环境 | `Runtime.evaluate` 注入 Readability 脚本、执行 DOM 查询 |
| **DOM** | 文档对象模型访问 | 获取文档根节点、查询节点信息（辅助） |
| **Page** | 页面生命周期控制 | 页面加载状态检测、导航事件监听 |
| **Network** | 网络请求拦截（已有） | 现有请求抓取功能 |

**关键 API：**

```javascript
// 1. 启用域（必须在调用域方法前执行）
await webContents.debugger.sendCommand('Runtime.enable');

// 2. 执行 JavaScript 表达式
const result = await webContents.debugger.sendCommand('Runtime.evaluate', {
  expression: 'document.title',
  returnByValue: true  // 直接返回值而非 RemoteObject
});

// 3. 获取文档根节点
const { root } = await webContents.debugger.sendCommand('DOM.getDocument');

// 4. 查询节点
const { nodeIds } = await webContents.debugger.sendCommand('DOM.querySelectorAll', {
  nodeId: root.nodeId,
  selector: 'a[href]'
});
```

### 1.2 Mozilla Readability 库

**用途：** 从网页 HTML 中提取可读内容（类似 Firefox 阅读模式）。

**工作原理：**
1. 解析 DOM 树，识别主要内容区域
2. 移除广告、导航栏、侧边栏等干扰元素
3. 提取标题、正文、作者、发布日期等元信息
4. 输出清理后的 HTML 或纯文本

**集成方式：**
- 方案 A：将 Readability 源码注入到 webview 中执行（推荐）
- 方案 B：在主进程 fetch HTML 后用 Node.js 解析

**选择方案 A 的原因：**
- 可直接访问 webview 的真实 DOM（含动态渲染内容）
- 无需额外网络请求
- 与现有 `Runtime.evaluate` 模式一致

**Readability 最小化代码（~50KB）：**
- 源码：`https://github.com/mozilla/readability`
- 需要提取 `Readability.js` 和依赖的 `JSDOMParser.js`
- 或者使用打包后的 `readability-min.js`

### 1.3 内容截断策略

**数据来源：** HTTP Archive 统计

| 指标 | 数值 |
|------|------|
| 网页平均 HTML 大小 | 30-50 KB |
| 网页平均纯文本大小 | 5-15 KB |
| 99th percentile 网页大小 | ~100 KB |
| 最大合理内容大小 | 100 KB |

**截断策略：**
- 阈值：100 KB（约 100,000 字符）
- 截断后追加标记：`[截断：原始大小 X bytes，已截断至 100KB]`
- 截断位置：优先在段落边界（`\n\n`）截断

---

## 2. Codebase Analysis

### 2.1 现有 CDP 实现（`cdp-manager.js`）

**当前能力：**
- ✅ 调试器生命周期管理（attach/detach）
- ✅ Network 域启用和事件监听
- ✅ webContents 状态跟踪（`debuggerStates` Map）
- ✅ DevTools 冲突检测（detach 事件处理）
- ✅ 域名匹配和自动附加/断开

**需要扩展：**
- ⚠️ 支持 Runtime/DOM/Page 域启用
- ⚠️ 提供通用的 `sendCommand` 封装
- ⚠️ 按需附加逻辑（AI 工具调用时触发）

**关键代码结构：**

```javascript
// cdp-manager.js 核心状态
const debuggerStates = new Map();  // webContents.id → { attached, containerId }

// 调试器附加流程
function attachDebugger(webContents, containerId) {
  webContents.debugger.attach('1.3');  // 协议版本
  webContents.debugger.sendCommand('Network.enable');  // 启用 Network 域
  debuggerStates.set(webContents.id, { attached: true, containerId });
}

// DevTools 冲突处理
webContents.debugger.on('detach', (event, reason) => {
  // 不主动重新附加，等下次导航时自动重新附加
});
```

### 2.2 AI 工具注册系统（`ai-manager.js`）

**工具注册模式：**

```javascript
// _buildRealmTools() 返回工具数组
{
  name: 'get_tabs',           // 工具 ID（LLM 调用时使用）
  label: '获取标签页',          // UI 显示名称
  description: '获取当前所有标签页列表...',  // LLM 理解的描述
  parameters: {               // JSON Schema 格式
    type: 'object',
    properties: {
      url: { type: 'string', description: '...' }
    },
    required: ['url']
  },
  execute: async (toolCallId, params) => {
    // 工具执行逻辑
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      details: { count: 42 }
    };
  }
}
```

**事件广播机制：**

```javascript
// 工具执行状态事件
{ type: 'tool_execution_update', tool_execution_id, tool_name, status, params, result, error }

// 状态值：'running' | 'completed' | 'failed'
```

### 2.3 标签页管理（`tab-manager.js`）

**关键方法：**

```javascript
// 获取所有标签页
const tabs = tabManager.getTabs();
// 返回: [{ id, url, title, containerId, webContentsId, ... }]

// 创建新标签页
const tab = tabManager.createTab(containerId, url);
// 返回: { id, url, title, containerId, webContentsId }
```

**webContents 获取：**

```javascript
// 通过 webContentsId 获取 webContents 实例
const { webContents } = require('electron');
const wc = webContents.fromId(tab.webContentsId);
```

---

## 3. Technical Design

### 3.1 CDP 管理器扩展（CDP-01）

**扩展策略：** 在现有 `cdp-manager.js` 基础上添加 AI 工具专用的调试器管理方法，不修改现有 Network 域抓取逻辑。

**新增方法：**

```javascript
/**
 * 为 AI 工具附加调试器并启用指定域
 * @param {number} webContentsId - webContents ID
 * @param {string[]} domains - 要启用的域列表，如 ['Runtime', 'DOM']
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function attachForAI(webContentsId, domains = ['Runtime']) {
  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) {
    return { success: false, error: '标签页已关闭' };
  }

  // 检查 DevTools 是否已打开（D-04）
  if (wc.debugger.isAttached()) {
    return { success: false, error: 'DevTools 已打开，请关闭后重试' };
  }

  try {
    // 附加调试器
    wc.debugger.attach('1.3');
    
    // 启用请求的域
    for (const domain of domains) {
      await wc.debugger.sendCommand(`${domain}.enable`);
    }
    
    // 更新状态（区分 AI 附加和 Network 抓取附加）
    debuggerStates.set(wc.id, { 
      attached: true, 
      source: 'ai-tool',
      domains 
    });
    
    return { success: true };
  } catch (err) {
    try { wc.debugger.detach(); } catch {}
    return { success: false, error: `CDP 附加失败: ${err.message}` };
  }
}

/**
 * AI 工具完成后断开调试器
 * @param {number} webContentsId
 */
function detachForAI(webContentsId) {
  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) return;
  
  const state = debuggerStates.get(webContentsId);
  if (!state || state.source !== 'ai-tool') return;
  
  try {
    wc.debugger.detach();
  } catch {}
  
  debuggerStates.delete(webContentsId);
}

/**
 * 执行 CDP 命令（带超时和错误处理）
 * @param {number} webContentsId
 * @param {string} method - CDP 方法名
 * @param {object} params - 方法参数
 * @param {number} timeout - 超时毫秒数（默认 10000）
 * @returns {Promise<{success: boolean, result?: object, error?: string}>}
 */
async function executeCommand(webContentsId, method, params = {}, timeout = 10000) {
  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) {
    return { success: false, error: '标签页已关闭' };
  }
  
  try {
    const result = await Promise.race([
      wc.debugger.sendCommand(method, params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('CDP 命令执行超时')), timeout)
      )
    ]);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

**生命周期管理：**

```
AI 工具调用
    ↓
attachForAI(webContentsId, ['Runtime'])
    ↓
executeCommand(webContentsId, 'Runtime.evaluate', { expression: '...' })
    ↓
detachForAI(webContentsId)
    ↓
返回结果
```

**webview 销毁清理：**

```javascript
// 在 main.js 的 webview 事件中添加
webview.addEventListener('destroyed', () => {
  cdpManager.detachForAI(webview.getWebContentsId());
});
```

### 3.2 read_page_content 工具（CDP-02）

**功能：** 读取当前标签页的页面标题、正文、元信息。

**实现流程：**

```javascript
{
  name: 'read_page_content',
  label: '读取页面内容',
  description: '读取当前标签页的页面内容，包括标题、正文、元信息和 Open Graph 数据',
  parameters: {
    type: 'object',
    properties: {
      tabId: {
        type: 'string',
        description: '标签页 ID（可选，默认使用当前活跃标签页）'
      }
    }
  },
  execute: async (toolCallId, params) => {
    const tabId = params.tabId || tabManager.getActiveTabId();
    const tab = tabManager.getTab(tabId);
    
    if (!tab) {
      throw new Error('标签页不存在');
    }
    
    // 1. 附加调试器
    const attachResult = await cdpManager.attachForAI(tab.webContentsId, ['Runtime']);
    if (!attachResult.success) {
      throw new Error(attachResult.error);
    }
    
    try {
      // 2. 注入 Readability 并提取内容
      const extractScript = `
        (function() {
          // 注入 Readability 库（从预加载的脚本中获取）
          ${READABILITY_SCRIPT}
          
          // 解析文档
          const doc = document.cloneNode(true);
          const reader = new Readability(doc);
          const article = reader.parse();
          
          // 收集元信息
          const meta = {
            description: document.querySelector('meta[name="description"]')?.content || '',
            keywords: document.querySelector('meta[name="keywords"]')?.content || '',
            author: document.querySelector('meta[name="author"]')?.content || ''
          };
          
          // 收集 Open Graph 数据
          const og = {
            title: document.querySelector('meta[property="og:title"]')?.content || '',
            description: document.querySelector('meta[property="og:description"]')?.content || '',
            image: document.querySelector('meta[property="og:image"]')?.content || ''
          };
          
          // 收集页面属性
          const properties = {
            canonical: document.querySelector('link[rel="canonical"]')?.href || '',
            language: document.documentElement.lang || '',
            charset: document.characterSet || ''
          };
          
          return JSON.stringify({
            title: document.title,
            url: window.location.href,
            favicon: document.querySelector('link[rel="icon"]')?.href || '',
            meta,
            og,
            properties,
            content: article ? article.textContent : ''
          });
        })()
      `;
      
      // 3. 执行脚本
      const result = await cdpManager.executeCommand(
        tab.webContentsId,
        'Runtime.evaluate',
        { expression: extractScript, returnByValue: true }
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // 4. 解析结果并截断
      const data = JSON.parse(result.result.value);
      
      // 100KB 截断（D-07）
      const MAX_CONTENT_SIZE = 100 * 1024;
      if (data.content.length > MAX_CONTENT_SIZE) {
        data.content = data.content.substring(0, MAX_CONTENT_SIZE) + 
          `\n[截断：原始大小 ${data.content.length} bytes，已截断至 100KB]`;
      }
      
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        details: { title: data.title, contentLength: data.content.length }
      };
    } finally {
      // 5. 断开调试器
      cdpManager.detachForAI(tab.webContentsId);
    }
  }
}
```

**Readability 库集成：**

- 方案：将 Readability 源码打包为单个 JS 字符串，注入到 webview 中执行
- 文件位置：`lib/readability-bundle.js`（新增）
- 打包方式：使用 esbuild/rollup 将 Readability 打包为 IIFE

### 3.3 extract_links 工具（CDP-03）

**功能：** 提取页面所有有效链接，支持过滤和去重。

**实现流程：**

```javascript
{
  name: 'extract_links',
  label: '提取页面链接',
  description: '提取当前页面的所有有效链接，自动过滤非 HTTP 协议和锚点链接',
  parameters: {
    type: 'object',
    properties: {
      tabId: {
        type: 'string',
        description: '标签页 ID（可选，默认使用当前活跃标签页）'
      }
    }
  },
  execute: async (toolCallId, params) => {
    const tabId = params.tabId || tabManager.getActiveTabId();
    const tab = tabManager.getTab(tabId);
    
    if (!tab) {
      throw new Error('标签页不存在');
    }
    
    const attachResult = await cdpManager.attachForAI(tab.webContentsId, ['Runtime']);
    if (!attachResult.success) {
      throw new Error(attachResult.error);
    }
    
    try {
      // 提取链接脚本（D-08: 过滤规则）
      const extractScript = `
        (function() {
          const links = Array.from(document.querySelectorAll('a[href]'))
            .map(a => {
              try {
                const url = new URL(a.href, window.location.origin);
                return {
                  url: url.href,
                  text: (a.textContent || '').trim().substring(0, 200)
                };
              } catch {
                return null;
              }
            })
            .filter(link => {
              if (!link) return false;
              // 仅保留 http/https 协议
              if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
                return false;
              }
              // 过滤锚点链接
              if (link.url.includes('#') && 
                  link.url.split('#')[0] === window.location.href.split('#')[0]) {
                return false;
              }
              // 过滤空文本链接
              if (!link.text) return false;
              return true;
            });
          
          // URL 去重
          const seen = new Set();
          const uniqueLinks = links.filter(link => {
            if (seen.has(link.url)) return false;
            seen.add(link.url);
            return true;
          });
          
          return JSON.stringify({
            total: uniqueLinks.length,
            links: uniqueLinks
          });
        })()
      `;
      
      const result = await cdpManager.executeCommand(
        tab.webContentsId,
        'Runtime.evaluate',
        { expression: extractScript, returnByValue: true }
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      const data = JSON.parse(result.result.value);
      
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        details: { totalLinks: data.total }
      };
    } finally {
      cdpManager.detachForAI(tab.webContentsId);
    }
  }
}
```

### 3.4 open_link 工具（CDP-04）

**功能：** 在指定容器中打开链接，支持当前标签页或新标签页。

**实现流程：**

```javascript
{
  name: 'open_link',
  label: '打开链接',
  description: '在指定容器中打开一个链接，支持在当前标签页或新标签页中打开',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要打开的 URL 地址'
      },
      containerId: {
        type: 'string',
        description: '目标容器 ID（可选，默认使用当前活跃容器）'
      },
      newTab: {
        type: 'boolean',
        description: '是否在新标签页中打开（可选，默认 true）'
      }
    },
    required: ['url']
  },
  execute: async (toolCallId, params) => {
    const { url, newTab = true } = params;
    
    // 验证 URL
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      throw new Error('无效的 URL，仅支持 http/https 协议');
    }
    
    // 获取容器 ID（D-10: 默认使用当前活跃容器）
    const containerId = params.containerId || windowManager.getCurrentContainerId();
    
    // 验证容器是否存在
    const container = windowManager.getContainer(containerId);
    if (!container) {
      throw new Error('指定容器不存在或已删除');
    }
    
    let tab;
    
    if (newTab) {
      // D-11: 默认新标签页打开
      tab = tabManager.createTab(containerId, url);
    } else {
      // 当前标签页导航
      const activeTab = tabManager.getActiveTab();
      if (!activeTab) {
        throw new Error('没有活跃的标签页');
      }
      
      const wc = webContents.fromId(activeTab.webContentsId);
      if (!wc || wc.isDestroyed()) {
        throw new Error('标签页已关闭');
      }
      
      wc.loadURL(url);
      tab = { ...activeTab, url };
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          tabId: tab.id,
          url: url,
          containerId: containerId,
          isNewTab: newTab
        }, null, 2)
      }],
      details: { tabId: tab.id, url }
    };
  }
}
```

---

## 4. Risk Assessment

### 4.1 Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Readability 库注入失败 | Medium | Low | 提供降级方案：直接提取 `document.body.innerText` |
| CDP 命令执行超时 | Medium | Medium | 10 秒超时保护，超时返回错误而非挂起 |
| DevTools 冲突 | High | Medium | 明确错误提示，引导用户关闭 DevTools |
| 大页面内存占用 | Medium | Low | 100KB 截断 + 即时断开调试器 |
| webContents 已销毁 | Low | Low | 每次操作前检查 `isDestroyed()` |

### 4.2 Integration Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| 现有 Network 抓取冲突 | High | Low | AI 附加和 Network 附加使用不同状态标记 |
| 多个 AI 工具并发调用 | Medium | Medium | 使用锁机制或队列化处理 |
| webview 导航中断 | Medium | Medium | 导航开始时自动断开 AI 调试器 |

---

## 5. Implementation Plan

### 5.1 Task Breakdown

| Task | Description | Priority | Est. Hours |
|------|-------------|----------|------------|
| T1 | 扩展 `cdp-manager.js`：添加 `attachForAI`/`detachForAI`/`executeCommand` | P0 | 2 |
| T2 | 准备 Readability 库：打包为可注入的 JS 字符串 | P0 | 1 |
| T3 | 实现 `read_page_content` 工具 | P0 | 3 |
| T4 | 实现 `extract_links` 工具 | P0 | 2 |
| T5 | 实现 `open_link` 工具 | P0 | 1 |
| T6 | 在 `ai-manager.js` 中注册 3 个新工具 | P0 | 0.5 |
| T7 | 添加 webview 销毁清理逻辑 | P1 | 0.5 |
| T8 | 添加错误处理和边界情况处理 | P1 | 1 |
| T9 | 更新系统提示词和工具描述 | P2 | 0.5 |
| T10 | 编写测试用例 | P2 | 2 |

**总计：** ~13.5 小时

### 5.2 Dependencies

```
T1 (CDP 管理器扩展)
    ↓
T2 (Readability 准备) ─┐
    ↓                   │
T3 (read_page_content) ←┘
    ↓
T4 (extract_links)
    ↓
T5 (open_link)
    ↓
T6 (工具注册)
    ↓
T7-T10 (收尾工作)
```

### 5.3 File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `cdp-manager.js` | Modify | 添加 `attachForAI`/`detachForAI`/`executeCommand` 方法 |
| `ai-manager.js` | Modify | 在 `_buildRealmTools()` 中添加 3 个新工具 |
| `lib/readability-bundle.js` | Create | Readability 库打包文件 |
| `main.js` | Modify | 添加 webview 销毁时的 CDP 清理逻辑 |
| `src/preload.js` | Modify | 添加新 IPC 通道（如果需要） |

---

## 6. Testing Strategy

### 6.1 Unit Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| CDP attach/detach | 测试调试器附加和断开 | 状态正确更新，无内存泄漏 |
| DevTools 冲突 | 模拟 DevTools 已打开 | 返回错误提示 |
| Readability 注入 | 测试脚本注入和执行 | 正确提取页面内容 |
| 内容截断 | 测试超过 100KB 的内容 | 正确截断并添加标记 |
| 链接过滤 | 测试各种边界情况的链接 | 正确过滤非 HTTP、锚点链接 |
| URL 去重 | 测试重复链接 | 返回去重后的结果 |

### 6.2 Integration Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| AI 调用 read_page_content | 模拟 AI 工具调用 | 返回页面标题、内容、元信息 |
| AI 调用 extract_links | 模拟 AI 工具调用 | 返回有效链接列表 |
| AI 调用 open_link | 模拟 AI 工具调用 | 在指定容器打开链接 |
| 并发调用 | 同时调用多个工具 | 正确处理，无冲突 |
| webview 销毁 | 工具执行中 webview 销毁 | 正确清理，无异常 |

### 6.3 Performance Tests

| Test Case | Description | Target |
|-----------|-------------|--------|
| 大页面内容提取 | 测试 >1MB 的页面 | <5 秒返回 |
| 大量链接提取 | 测试 >1000 个链接的页面 | <3 秒返回 |
| 连续调用稳定性 | 连续调用 100 次 | 无内存泄漏 |

---

## 7. Open Questions

1. **Readability 库打包方式**：使用 esbuild 还是手动合并？需要评估打包复杂度和维护成本。

2. **并发调用处理**：如果用户同时调用多个 AI 工具，是否需要队列化处理？当前设计是每次调用都附加/断开调试器，可能有冲突。

3. **内容缓存策略**：是否需要缓存已提取的页面内容？当前设计是每次调用都重新提取，可能有性能问题。

4. **错误恢复机制**：如果 CDP 命令执行失败，是否需要自动重试？当前设计是直接返回错误。

---

## 8. References

### 8.1 Official Documentation

- [Chrome DevTools Protocol Documentation](https://chromedevtools.github.io/devtools-protocol/)
- [Runtime Domain](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/)
- [DOM Domain](https://chromedevtools.github.io/devtools-protocol/tot/DOM/)
- [Page Domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/)
- [Electron WebContents Debugger API](https://www.electronjs.org/docs/latest/api/web-contents#class-debugger)

### 8.2 Third-Party Libraries

- [Mozilla Readability](https://github.com/mozilla/readability)
- [Readability.js Source](https://github.com/mozilla/readability/blob/main/Readability.js)

### 8.3 Internal References

- `cdp-manager.js` — 现有 CDP 管理器实现
- `ai-manager.js` — AI 工具注册系统
- `tab-manager.js` — 标签页管理
- `.planning/phases/22-cdp/22-CONTEXT.md` — Phase 22 上下文
- `.planning/phases/22-cdp/22-UI-SPEC.md` — Phase 22 UI 规范

---

*Research completed: 2026-08-02*
*Next step: Plan phase execution*
