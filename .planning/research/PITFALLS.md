# 领域陷阱研究 — v2.1 AI CDP 增强 + Tabbrowser 功能集成

**领域：** 多容器隔离浏览器 (Electron) — AI Agent + CDP 深度集成
**研究日期：** 2026-08-02
**置信度：** HIGH（基于现有代码库分析 + Chromium/Electron 官方文档）

---

## 本文档说明

本文档聚焦 v2.1 里程碑新增功能的陷阱，即：向已有系统**添加** CDP 深度控制能力、智能上下文引用、全文检索、任务自动化、脚本生成和智能标签分组时的常见错误。基础架构陷阱（Session 隔离、Cookie domain、内存泄漏等）请参见初始研究 PITFALLS.md（2026-07-23），v1.1 功能陷阱请参见 PITFALLS.md（2026-07-25）。

**核心风险领域：**
1. **CDP 会话生命周期管理** - 已有基础但扩展时易出问题
2. **内容提取性能** - 大页面和复杂 DOM 结构
3. **安全边界** - AI Agent 执行自动化任务时的 XSS/注入风险
4. **资源泄漏** - 长期运行的调试器连接和内存累积

---

## 关键陷阱

### 陷阱 1：CDP 调试器会话泄漏（内存泄漏） — 扩展 CDP 功能时的致命陷阱

**问题描述：**
CDP 调试器会话未正确关闭，导致内存持续累积。每个调试器会话占用约 5-20MB 内存（取决于页面复杂度），长时间运行后可导致应用内存溢出（OOM）崩溃。

**根本原因：**
现有 `cdp-manager.js` 已实现基础的 `attachDebugger()` 和 `detachDebugger()`，但在扩展新功能时容易出现以下问题：
- webview 销毁时未调用 `detachDebugger()`（现有代码的 `cleanup()` 只清理 Map，未遍历所有活跃会话）
- 新增的 CDP 域（如 `DOM`, `Runtime`）启用后未在断开时清理
- 异常路径未处理（CDP 命令执行失败后状态不一致）
- `debuggerStates` Map 只跟踪 `attached` 状态但未跟踪资源使用情况
- 多个 AI 工具并发访问同一 webContents 的调试器导致竞态条件

**如何避免：**

```javascript
// 1. 在 webview 销毁时强制清理（扩展现有 cleanup）
function cleanupAllDebuggers() {
  for (const [webContentsId, state] of debuggerStates.entries()) {
    try {
      const wc = webContents.fromId(webContentsId);
      if (wc && !wc.isDestroyed() && state.attached) {
        wc.debugger.detach();
      }
    } catch (err) {
      console.error(`[Realm CDP] 清理调试器失败: ${err.message}`);
    }
  }
  debuggerStates.clear();
  pendingRequests.clear();
}

// 2. 添加资源监控和自动清理
function monitorDebuggerResources() {
  const MAX_DEBUGGER_SESSIONS = 10;
  const MAX_IDLE_TIME = 5 * 60 * 1000; // 5 分钟

  if (debuggerStates.size > MAX_DEBUGGER_SESSIONS) {
    // 清理最旧的会话
    const oldest = [...debuggerStates.entries()]
      .sort((a, b) => a[1].lastActivity - b[1].lastActivity)[0];
    if (oldest) {
      const wc = webContents.fromId(oldest[0]);
      if (wc) detachDebugger(wc);
    }
  }
}

// 3. 扩展 debuggerStates 跟踪更多信息
debuggerStates.set(webContents.id, {
  attached: true,
  containerId,
  lastActivity: Date.now(),
  enabledDomains: ['Network'], // 跟踪已启用的 CDP 域
  activeCommands: new Set()    // 跟踪正在执行的命令
});
```

**预警信号：**
- 应用内存使用持续增长（通过 `process.memoryUsage()` 监控）
- `debuggerStates.size` 不断增加但 webview 数量未增加
- 用户反馈应用运行数小时后变慢或崩溃
- 控制台出现 "V8 inspector socket" 相关错误

**应解决的阶段：**
Phase 22（CDP 管理器扩展）— 在实现 read_page_content、extract_links、open_link 工具时同步实现资源监控。

---

### 陷阱 2：大页面内容提取导致渲染进程冻结

**问题描述：**
`read_page_content` 工具在读取大型页面（>10MB HTML）时阻塞主进程事件循环，导致整个应用无响应 5-30 秒。

**根本原因：**
- CDP `Runtime.evaluate` 在主进程同步执行，大 DOM 树序列化耗时
- 现有 `fetchResponseBody()` 有 1MB 限制，但页面内容提取可能需要更大范围
- 未实现流式读取或分块处理
- 缺少超时机制
- 未考虑 iframe 嵌套（可能递归读取无限深度）
- `document.body.innerText` 在大页面上执行时间与 DOM 节点数成正比

**如何避免：**

```javascript
// 1. 添加超时和大小限制
async function readPageContent(webContents, options = {}) {
  const {
    maxContentLength = 1024 * 1024, // 1MB 限制
    timeout = 5000, // 5 秒超时
    includeIframes = false, // 默认不读取 iframe
    extractMode = 'text' // 'text' | 'html' | 'markdown'
  } = options;

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('内容读取超时')), timeout)
  );

  const contentPromise = webContents.debugger.sendCommand(
    'Runtime.evaluate',
    {
      expression: `
        (function() {
          const body = document.body;
          if (!body) return { title: document.title, content: '', truncated: false };

          let content = '';
          if ('${extractMode}' === 'text') {
            content = body.innerText || '';
          } else if ('${extractMode}' === 'html') {
            content = body.innerHTML || '';
          }

          const truncated = content.length > ${maxContentLength};
          if (truncated) content = content.substring(0, ${maxContentLength});

          return {
            title: document.title,
            content: content,
            truncated: truncated,
            originalLength: content.length,
            url: location.href
          };
        })()
      `,
      returnByValue: true
    }
  );

  return Promise.race([contentPromise, timeoutPromise]);
}

// 2. 使用 webContents.executeJavaScript 在渲染进程执行（非阻塞）
async function readPageContentNonBlocking(webContents) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('超时')), 5000);

    webContents.executeJavaScript(`
      new Promise((resolve) => {
        requestIdleCallback(() => {
          resolve({
            title: document.title,
            content: document.body.innerText.substring(0, 1048576)
          });
        }, { timeout: 3000 });
      })
    `).then(result => {
      clearTimeout(timeout);
      resolve(result);
    }).catch(err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// 3. 分块读取大页面
async function readPageContentChunked(webContents, chunkSize = 100000) {
  const totalLength = await webContents.executeJavaScript(
    'document.body.innerText.length'
  );

  const chunks = [];
  for (let i = 0; i < totalLength; i += chunkSize) {
    const chunk = await webContents.executeJavaScript(
      `document.body.innerText.substring(${i}, ${i + chunkSize})`
    );
    chunks.push(chunk);

    // 每块之间让出事件循环
    await new Promise(resolve => setImmediate(resolve));
  }

  return chunks.join('');
}
```

**预警信号：**
- 用户执行"读取页面内容"时 UI 冻结超过 1 秒
- 控制台出现 "Renderer process became unresponsive" 警告
- 内存峰值突增（大页面序列化时）

**应解决的阶段：**
Phase 22（CDP 管理器扩展）— 在实现 read_page_content 工具时同步实现性能优化。

---

### 陷阱 3：链接提取的相对 URL 和 JavaScript 链接处理错误

**问题描述：**
`extract_links` 工具返回的链接包含大量无效或无法直接使用的 URL：
- 相对路径（`/path/to/page`）未转换为绝对 URL
- JavaScript 链接（`javascript:void(0)`）被当作普通链接
- 锚点链接（`#section`）重复出现
- 协议相对 URL（`//cdn.example.com/script.js`）处理不当
- `<base>` 标签影响相对 URL 解析

**根本原因：**
- 简单使用 `document.links` 或 `querySelectorAll('a[href]')` 未做后处理
- 未考虑 `<base>` 标签对相对 URL 的影响
- 未过滤非 HTTP 协议（`mailto:`, `tel:`, `javascript:`）
- `el.href` 在某些情况下可能返回空字符串

**如何避免：**

```javascript
// 正确的链接提取实现
async function extractLinks(webContents, options = {}) {
  const {
    filterJavascript = true,
    filterAnchors = true,
    resolveRelative = true,
    maxLinks = 1000,
    includeText = true,
    deduplicate = true
  } = options;

  return webContents.executeJavaScript(`
    (function() {
      const baseUrl = document.baseURI;
      const links = [];
      const seen = new Set();

      document.querySelectorAll('a[href], area[href]').forEach(el => {
        let href = el.href; // 浏览器自动解析为绝对 URL

        // 过滤无效 href
        if (!href || href === 'about:blank') return;

        // 过滤条件
        if (${filterJavascript} && href.startsWith('javascript:')) return;
        if (${filterAnchors} && href.startsWith('#')) return;
        if (href.startsWith('mailto:') || href.startsWith('tel:')) return;
        if (href.startsWith('data:')) return;

        // 去重
        if (${deduplicate}) {
          const normalized = href.split('#')[0]; // 移除锚点后去重
          if (seen.has(normalized)) return;
          seen.add(normalized);
        }

        links.push({
          url: href,
          text: ${includeText} ? (el.textContent || '').trim().substring(0, 200) : '',
          title: el.title || '',
          rel: el.rel || '',
          target: el.target || '',
          isExternal: !href.startsWith(location.origin)
        });

        if (links.length >= ${maxLinks}) return;
      });

      return {
        links: links,
        totalFound: document.links.length,
        filtered: document.links.length - links.length,
        baseUrl: baseUrl
      };
    })()
  `);
}
```

**预警信号：**
- AI Agent 尝试打开 `javascript:void(0)` 链接导致无响应
- 相对路径被当作完整 URL 传递给 `open_link` 工具
- 用户反馈链接提取结果包含大量无用链接
- 提取的链接在不同页面间不一致（受 `<base>` 标签影响）

**应解决的阶段：**
Phase 22（CDP 管理器扩展）— 在实现 extract_links 工具时同步实现 URL 归一化。

---

### 陷阱 4：全文检索索引膨胀和查询性能下降

**问题描述：**
收藏夹全文检索在数据量增长后（>10,000 条收藏）出现：
- 索引文件占用数百 MB 磁盘空间
- 查询响应时间从毫秒级退化到秒级
- 应用启动时重建索引耗时过长
- 中文分词不准确（默认 `unicode61` 分词器对中文支持有限）

**根本原因：**
- 使用 SQLite FTS5 但未优化分词器配置
- 未实现增量索引（每次全量重建）
- 中文分词未使用 `icu` 分词器（需要额外编译）
- 未限制索引字段（索引了整个页面内容而非摘要）
- 未配置 `detail=none` 减少存储空间

**如何避免：**

```sql
-- 1. 使用优化的 FTS5 配置
CREATE VIRTUAL TABLE favorites_fts USING fts5(
  title,
  url,
  content,  -- 仅索引摘要而非完整内容
  tokenize='unicode61 remove_diacritics 2',
  content='',  -- 不存储原始内容（仅索引）
  content_rowid='id'
);

-- 2. 限制索引内容长度
CREATE TRIGGER favorites_ai AFTER INSERT ON favorites BEGIN
  INSERT INTO favorites_fts(rowid, title, url, content)
  VALUES (
    new.id,
    new.title,
    new.url,
    SUBSTR(new.content, 1, 10000)  -- 限制每条最多 10KB
  );
END;

-- 3. 使用增量更新而非全量重建
CREATE TRIGGER favorites_au AFTER UPDATE ON favorites BEGIN
  INSERT INTO favorites_fts(favorites_fts, rowid, title, url, content)
  VALUES('delete', old.id, old.title, old.url, old.content);
  INSERT INTO favorites_fts(rowid, title, url, content)
  VALUES (new.id, new.title, new.url, SUBSTR(new.content, 1, 10000));
END;

-- 4. 定期优化索引
INSERT INTO favorites_fts(favorites_fts) VALUES('optimize');
```

```javascript
// 5. 添加查询缓存和分页
class FullTextSearch {
  constructor(db) {
    this.db = db;
    this.cache = new Map();
    this.cacheTimeout = 60 * 1000; // 1 分钟缓存
    this.maxCacheSize = 100;
  }

  async search(query, options = {}) {
    const { limit = 50, offset = 0 } = options;
    const cacheKey = `${query}:${limit}:${offset}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }

    // 防止 FTS5 注入
    const sanitizedQuery = this.sanitizeQuery(query);

    // 执行查询
    const result = this.db.prepare(`
      SELECT f.*, rank
      FROM favorites_fts fts
      JOIN favorites f ON f.id = fts.rowid
      WHERE favorites_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `).all(sanitizedQuery, limit, offset);

    // 更新缓存（LRU 策略）
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    return result;
  }

  sanitizeQuery(query) {
    // 移除 FTS5 特殊字符防止注入
    return query.replace(/['"*(){}[\]]/g, ' ').trim();
  }
}
```

**预警信号：**
- 应用启动时间从 2 秒增加到 10 秒以上
- `favorites_fts` 表大小超过主数据表 10 倍
- 搜索框输入时明显卡顿
- 中文搜索结果不准确

**应解决的阶段：**
Phase 23（智能上下文引用 + 全文检索）— 在实现全文检索功能时同步优化索引策略。

---

### 陷阱 5：任务自动化中的 XSS 和 Prompt Injection 风险

**问题描述：**
AI Agent 执行自动化任务（填表、点击、脚本生成）时，恶意网页可通过以下方式攻击：
- 通过 `document.title` 或 DOM 属性注入恶意提示词（Prompt Injection）
- 利用表单字段注入 JavaScript 代码
- 通过脚本生成工具执行任意系统命令
- 网页内容包含诱导 AI 执行危险操作的指令

**根本原因：**
- AI Agent 直接使用从网页提取的内容作为 LLM 输入，未做消毒
- 自动化脚本使用 `eval()` 或 `Function()` 执行
- 未验证 AI 生成的脚本是否包含危险操作
- 缺少操作确认机制（高风险操作自动执行）
- LLM 无法区分网页内容和用户指令

**如何避免：**

```javascript
// 1. 输入消毒 - 清洗网页提取内容
function sanitizeForLLM(webContent) {
  // 移除潜在的提示词注入
  const cleaned = webContent
    .replace(/```[\s\S]*?```/g, '[代码块已移除]') // 移除代码块
    .replace(/<script[\s\S]*?<\/script>/gi, '[脚本已移除]')
    .replace(/on\w+="[^"]*"/gi, '') // 移除事件处理器
    .replace(/javascript:/gi, '[javascript协议已移除]')
    .replace(/ignore previous instructions/gi, '[已过滤]') // 常见注入模式
    .replace(/system:\s*/gi, '[已过滤]') // 伪造系统消息
    .substring(0, 50000); // 限制长度

  return cleaned;
}

// 2. 脚本安全验证
function validateGeneratedScript(script) {
  const FORBIDDEN_PATTERNS = [
    { pattern: /require\s*\(/, message: 'Node.js 模块加载' },
    { pattern: /import\s+/, message: 'ESM 导入' },
    { pattern: /process\./, message: 'Node.js 进程访问' },
    { pattern: /child_process/, message: '子进程' },
    { pattern: /fs\./, message: '文件系统' },
    { pattern: /exec\s*\(/, message: '命令执行' },
    { pattern: /eval\s*\(/, message: '动态执行' },
    { pattern: /Function\s*\(/, message: 'Function 构造器' },
    { pattern: /__dirname|__filename/, message: '路径泄露' },
    { pattern: /window\.realmAPI/, message: 'Realm API 访问' },
    { pattern: /ipcRenderer/, message: 'IPC 访问' },
  ];

  const issues = [];
  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(script)) {
      issues.push(message);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

// 3. 沙箱执行环境
async function executeInSandbox(webContents, script) {
  // 使用 CDP 的 Runtime.evaluate 在页面上下文执行
  // 但限制为只读操作
  const readOnlyScript = `
    (function() {
      'use strict';

      // 保存原始方法
      const originalSetAttribute = Element.prototype.setAttribute;
      const originalClick = HTMLElement.prototype.click;

      // 禁止修改 DOM
      Element.prototype.setAttribute = function() {
        throw new Error('沙箱模式禁止修改 DOM');
      };

      try {
        const result = (function() { ${script} })();
        return { success: true, result };
      } catch (err) {
        return { success: false, error: err.message };
      } finally {
        // 恢复原始方法
        Element.prototype.setAttribute = originalSetAttribute;
        HTMLElement.prototype.click = originalClick;
      }
    })()
  `;

  return webContents.debugger.sendCommand('Runtime.evaluate', {
    expression: readOnlyScript,
    returnByValue: true,
    silent: true
  });
}

// 4. 高风险操作确认机制
const HIGH_RISK_OPERATIONS = [
  'click',      // 点击操作
  'submit',     // 表单提交
  'navigate',   // 页面导航
  'download',   // 文件下载
  'execute',    // 脚本执行
  'fill',       // 表单填写
  'delete',     // 删除操作
];

async function executeWithConfirmation(operation, params) {
  if (HIGH_RISK_OPERATIONS.includes(operation.type)) {
    // 发送确认请求到渲染进程
    const confirmed = await requestUserConfirmation({
      title: '确认操作',
      message: `AI 请求执行: ${operation.description}`,
      details: JSON.stringify(params, null, 2),
      risk: 'high',
      timeout: 30000 // 30 秒超时自动取消
    });

    if (!confirmed) {
      return { cancelled: true, reason: '用户取消或超时' };
    }
  }

  return executeOperation(operation, params);
}
```

**预警信号：**
- AI Agent 输出包含来自网页的异常指令
- 用户报告 AI 执行了未请求的操作
- 脚本生成工具产生包含 `require('child_process')` 的代码
- AI 突然改变行为模式（可能被 Prompt Injection 影响）

**应解决的阶段：**
Phase 24（任务自主执行）和 Phase 25（脚本生成）— 在实现自动化功能时同步实现安全防护。

---

### 陷阱 6：脚本生成的代码注入和权限提升

**问题描述：**
"一句话生成脚本"功能生成的脚本可能包含：
- 访问 Node.js API（`fs`, `child_process`）的代码
- 访问 Electron 主进程的代码
- 无限循环或资源耗尽代码
- 访问用户敏感数据的代码
- 调用 `window.realmAPI` 执行特权操作

**根本原因：**
- LLM 生成代码时未考虑 Electron 安全模型
- 未限制脚本执行环境（渲染进程 vs 主进程）
- 未实现代码静态分析
- 缺少脚本执行沙箱
- 系统提示词未明确禁止危险操作

**如何避免：**

```javascript
// 1. 脚本生成时的约束提示词
const SCRIPT_GENERATION_PROMPT = `你是一个浏览器自动化脚本生成器。

严格限制（违反任何一条都会被拒绝执行）：
- 只能生成在浏览器页面上下文执行的 JavaScript
- 禁止使用 Node.js API（require, import, fs, path, os, child_process 等）
- 禁止访问 Electron API（ipcRenderer, contextBridge 等）
- 禁止使用 eval(), Function() 构造器
- 禁止访问 window.electron, window.realmAPI 等暴露的 API
- 禁止访问 process, __dirname, __filename
- 禁止使用 fetch() 或 XMLHttpRequest 发送请求到非当前域
- 禁止读取本地文件系统

允许的操作：
- DOM 查询和操作（document.querySelector 等）
- 表单填写（input.value = ...）
- 点击操作（element.click()）
- 读取页面内容（innerText, innerHTML）
- 等待操作（setTimeout, Promise）

用户请求：`;

// 2. 静态代码分析
function analyzeScriptSafety(script) {
  const issues = [];

  const dangerousPatterns = [
    { pattern: /require\s*\(/, severity: 'critical', message: 'Node.js 模块加载' },
    { pattern: /import\s+/, severity: 'critical', message: 'ESM 导入' },
    { pattern: /process\./, severity: 'critical', message: 'Node.js 进程访问' },
    { pattern: /child_process/, severity: 'critical', message: '子进程操作' },
    { pattern: /\bfs\b/, severity: 'critical', message: '文件系统访问' },
    { pattern: /exec\s*\(/, severity: 'high', message: '命令执行' },
    { pattern: /eval\s*\(/, severity: 'high', message: '动态代码执行' },
    { pattern: /Function\s*\(/, severity: 'high', message: 'Function 构造器' },
    { pattern: /fetch\s*\(/, severity: 'medium', message: '网络请求（可能跨域）' },
    { pattern: /XMLHttpRequest/, severity: 'medium', message: 'XMLHttpRequest 使用' },
    { pattern: /while\s*\(true\)/, severity: 'medium', message: '可能的无限循环' },
    { pattern: /for\s*\(\s*;\s*;\s*\)/, severity: 'medium', message: '可能的无限循环' },
    { pattern: /window\.realmAPI/, severity: 'critical', message: 'Realm API 访问' },
    { pattern: /ipcRenderer/, severity: 'critical', message: 'IPC 访问' },
    { pattern: /__dirname|__filename/, severity: 'critical', message: '路径泄露' },
  ];

  for (const { pattern, severity, message } of dangerousPatterns) {
    if (pattern.test(script)) {
      issues.push({ severity, message, pattern: pattern.source });
    }
  }

  return {
    safe: issues.filter(i => i.severity === 'critical').length === 0,
    issues,
    criticalCount: issues.filter(i => i.severity === 'critical').length,
    highCount: issues.filter(i => i.severity === 'high').length,
  };
}

// 3. 执行前用户确认
async function confirmScriptExecution(script, analysis) {
  if (analysis.issues.length > 0) {
    const issueList = analysis.issues
      .map(i => `- [${i.severity.toUpperCase()}] ${i.message}`)
      .join('\n');

    return await showConfirmationDialog({
      title: '脚本安全警告',
      message: '生成的脚本包含潜在风险：',
      details: issueList,
      confirmText: '我理解风险，继续执行',
      cancelText: '取消',
      risk: analysis.criticalCount > 0 ? 'critical' : 'high'
    });
  }
  return true;
}

// 4. 脚本执行沙箱（使用 iframe）
async function executeScriptInIframe(webContents, script) {
  return webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.sandbox = 'allow-scripts'; // 限制权限
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const timeout = setTimeout(() => {
        document.body.removeChild(iframe);
        reject(new Error('脚本执行超时'));
      }, 10000);

      iframe.onload = () => {
        try {
          const result = iframe.contentWindow.eval(${JSON.stringify(script)});
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({ success: true, result });
        } catch (err) {
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve({ success: false, error: err.message });
        }
      };

      iframe.src = 'about:blank';
    })
  `);
}
```

**预警信号：**
- 生成的脚本包含 `require` 或 `import` 语句
- 脚本长度异常（>10KB）可能包含恶意代码
- 用户报告脚本执行后文件被修改
- 脚本尝试访问 `window.realmAPI`

**应解决的阶段：**
Phase 25（脚本生成 + 智能标签整理）— 在实现脚本生成功能时同步实现安全防护。

---

### 陷阱 7：智能标签分组的准确性和用户预期管理

**问题描述：**
AI 自动标签分组结果不符合用户预期：
- 将不相关的标签分为一组（主题误判）
- 分组粒度不当（过细或过粗）
- 分组结果不稳定（相同标签集合每次分组结果不同）
- 用户无法理解和调整分组逻辑
- 分组操作耗时过长（需要调用 LLM）

**根本原因：**
- 仅依赖 URL 或标题进行分组，未考虑页面内容
- LLM 分组结果具有随机性（temperature > 0）
- 未提供分组置信度或解释
- 缺少用户反馈和学习机制
- 未缓存分组结果（相同标签集合重复调用 LLM）

**如何避免：**

```javascript
// 1. 多维度分组特征
function extractTabFeatures(tab) {
  return {
    url: tab.url,
    domain: new URL(tab.url).hostname,
    title: tab.title,
    // 从 URL 推断的类别
    category: categorizeUrl(tab.url),
    // 访问频率和时长
    visitCount: tab.visitCount || 0,
    lastVisit: tab.lastVisit || 0,
    // 容器信息
    containerId: tab.containerId,
    // 页面摘要（如果有）
    summary: tab.summary || ''
  };
}

function categorizeUrl(url) {
  const domain = new URL(url).hostname;

  // 基于域名的简单分类
  const categories = {
    'social': ['twitter.com', 'facebook.com', 'linkedin.com', 'instagram.com'],
    'development': ['github.com', 'stackoverflow.com', 'dev.to', 'gitlab.com'],
    'news': ['news.ycombinator.com', 'reddit.com', 'medium.com'],
    'documentation': ['docs.', 'developer.', 'api.', 'wiki.'],
    'shopping': ['amazon.com', 'ebay.com', 'taobao.com'],
    'entertainment': ['youtube.com', 'netflix.com', 'bilibili.com'],
  };

  for (const [category, domains] of Object.entries(categories)) {
    if (domains.some(d => domain.includes(d))) {
      return category;
    }
  }
  return 'other';
}

// 2. 确定性分组（使用低 temperature + 缓存）
const groupCache = new Map();

async function groupTabsWithAI(tabs) {
  // 生成缓存键（基于标签 URL 排序）
  const cacheKey = tabs
    .map(t => t.url)
    .sort()
    .join('|');

  // 检查缓存
  if (groupCache.has(cacheKey)) {
    return groupCache.get(cacheKey);
  }

  const features = tabs.map(extractTabFeatures);

  // 使用低 temperature 确保结果稳定
  const response = await aiManager.chat({
    messages: [{
      role: 'user',
      content: `请将以下标签页分组。每组应有明确的主题。

要求：
- 每组 2-8 个标签页
- 提供分组理由（简短）
- 提供置信度（0-1）
- 输出 JSON 格式

标签页列表：
${JSON.stringify(features, null, 2)}`
    }],
    temperature: 0.1, // 低随机性
    responseFormat: { type: 'json_object' }
  });

  const result = parseGroupingResult(response);

  // 缓存结果（限制缓存大小）
  if (groupCache.size > 100) {
    const oldestKey = groupCache.keys().next().value;
    groupCache.delete(oldestKey);
  }
  groupCache.set(cacheKey, result);

  return result;
}

// 3. 提供分组解释和手动调整
function renderTabGroups(groups) {
  return groups.map(group => ({
    name: group.name,
    reason: group.reason, // 显示分组理由
    confidence: group.confidence, // 显示置信度
    tabs: group.tabs,
    // 允许用户调整
    actions: {
      rename: true,
      split: true,
      merge: true,
      exclude: true,
      moveTab: true
    }
  }));
}

// 4. 用户反馈学习
function recordGroupingFeedback(originalGroups, userAdjustments) {
  // 记录用户的调整，用于改进后续分组
  feedbackStore.push({
    timestamp: Date.now(),
    original: originalGroups,
    adjusted: userAdjustments,
    // 可以用于微调分组策略
  });
}
```

**预警信号：**
- 用户频繁手动调整 AI 分组结果
- 分组理由模糊（如"这些标签页相关"）
- 相同标签集合多次分组结果不一致
- 分组操作耗时超过 5 秒

**应解决的阶段：**
Phase 25（脚本生成 + 智能标签整理）— 在实现智能分组功能时同步实现用户反馈机制。

---

### 陷阱 8：@ 引用标签页上下文时的性能和安全问题

**问题描述：**
智能上下文引用（@ 引用标签页）功能在实现时可能遇到：
- 引用大量标签页时性能下降
- 引用的标签页内容包含敏感信息（密码、Token）
- 引用的标签页内容过长导致 LLM 上下文溢出
- 标签页关闭后引用失效

**根本原因：**
- 未限制引用的标签页数量
- 未过滤敏感信息
- 未截断引用内容
- 未处理标签页生命周期

**如何避免：**

```javascript
// 1. 限制引用数量和内容长度
const MAX_REFERENCED_TABS = 5;
const MAX_CONTENT_LENGTH_PER_TAB = 5000;

async function resolveTabReferences(tabIds) {
  // 限制引用数量
  const limitedIds = tabIds.slice(0, MAX_REFERENCED_TABS);

  const references = [];
  for (const tabId of limitedIds) {
    const tab = tabManager.getTab(tabId);
    if (!tab || tab.destroyed) continue;

    // 获取标签页内容
    const content = await readPageContent(tab.webContents, {
      maxContentLength: MAX_CONTENT_LENGTH_PER_TAB,
      timeout: 2000
    });

    // 过滤敏感信息
    const sanitized = sanitizeForLLM(content.content);

    references.push({
      tabId,
      title: tab.title,
      url: tab.url,
      content: sanitized,
      truncated: content.truncated
    });
  }

  return references;
}

// 2. 敏感信息过滤
function sanitizeForLLM(content) {
  // 移除可能的密码、Token、API Key
  return content
    .replace(/password[\s]*[:=][\s]*[^\s]+/gi, 'password: [已过滤]')
    .replace(/token[\s]*[:=][\s]*[^\s]+/gi, 'token: [已过滤]')
    .replace(/api[_-]?key[\s]*[:=][\s]*[^\s]+/gi, 'api_key: [已过滤]')
    .replace(/secret[\s]*[:=][\s]*[^\s]+/gi, 'secret: [已过滤]')
    .replace(/[A-Za-z0-9+/]{40,}={0,2}/g, '[可能的 Base64 数据已过滤]'); // Base64
}

// 3. 处理标签页关闭
function handleTabClosed(tabId) {
  // 从引用缓存中移除
  tabReferenceCache.delete(tabId);

  // 通知用户引用失效
  notifyUser(`引用的标签页已关闭: ${tabId}`);
}
```

**预警信号：**
- 引用 5 个以上标签页时响应变慢
- 引用内容包含用户密码或 Token
- LLM 返回 "context length exceeded" 错误
- 引用的标签页已关闭但仍被使用

**应解决的阶段：**
Phase 23（智能上下文引用 + 全文检索）— 在实现 @ 引用功能时同步实现性能优化和安全防护。

---

## 技术债务模式

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 使用 `eval()` 执行 AI 生成的脚本 | 实现简单 | 安全漏洞、无法审计 | **NEVER** |
| 全量重建搜索索引 | 代码简单 | 启动时间线性增长 | 仅 MVP（<1000 条数据） |
| 跳过 CDP 会话清理 | 开发速度快 | 内存泄漏 | 仅原型验证 |
| 不验证用户输入直接发送给 LLM | 减少代码量 | Prompt Injection 风险 | **NEVER** |
| 同步读取大页面内容 | 实现简单 | UI 冻结 | **NEVER** |
| 不限制引用标签页数量 | 实现简单 | 性能下降、上下文溢出 | 仅 MVP（<3 个标签页） |

## 集成陷阱

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CDP + AI Agent | AI 直接执行 CDP 命令无权限控制 | 添加操作白名单和用户确认 |
| 搜索索引 + SQLite | 在主进程同步构建索引 | 使用 worker 线程或增量更新 |
| 脚本生成 + 页面执行 | 生成后直接 eval | 静态分析 + 沙箱执行 |
| 内容提取 + LLM | 未截断大页面 | 限制输入长度 + 摘要提取 |
| @ 引用 + 标签页 | 未处理标签页关闭 | 生命周期管理 + 缓存失效 |

## 性能陷阱

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| CDP 事件风暴 | 高频页面加载时事件队列堆积 | 添加防抖和批量处理 | >100 请求/秒 |
| 搜索索引膨胀 | 应用启动时间线性增长 | 增量更新 + 定期压缩 | >10,000 条收藏 |
| 内存累积 | 长时间运行后 OOM | 定期清理 + 资源监控 | 运行 >4 小时 |
| DOM 序列化阻塞 | 读取大页面时 UI 冻结 | 异步执行 + 大小限制 | 页面 >5MB |
| LLM 调用延迟 | 分组/搜索响应慢 | 缓存 + 并发控制 | >10 个并发请求 |

## 安全风险

| Mistake | Risk | Prevention |
|---------|------|------------|
| AI Agent 执行未验证的网页指令 | Prompt Injection 攻击 | 输入消毒 + 操作白名单 |
| 脚本生成无沙箱 | 远程代码执行 | 静态分析 + 受限环境 |
| CDP 命令无权限控制 | 访问敏感数据 | 操作分级 + 用户确认 |
| 搜索查询无限制 | 信息泄露 | 查询白名单 + 结果过滤 |
| @ 引用泄露敏感信息 | 密码/Token 泄露 | 敏感信息过滤 |

## UX 陷阱

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 自动化操作无反馈 | 用户不知道 AI 在做什么 | 实时操作日志 + 进度指示 |
| 分组结果不可调整 | 用户感到失控 | 提供手动调整和学习机制 |
| 错误信息过于技术化 | 用户无法理解问题 | 友好的错误提示 + 解决建议 |
| 长时间操作无取消 | 用户被迫等待 | 随时取消 + 后台执行 |
| @ 引用标签页已关闭 | 用户困惑 | 明确提示 + 自动清理引用 |

## "Looks Done But Isn't" 检查清单

- [ ] **CDP 会话管理:** 验证 webview 销毁时调试器是否正确分离
- [ ] **内容提取:** 验证大页面（>5MB）不会冻结 UI
- [ ] **链接提取:** 验证相对 URL 和 javascript: 链接被正确过滤
- [ ] **全文检索:** 验证 10,000+ 条收藏时查询性能 <100ms
- [ ] **任务自动化:** 验证恶意 Prompt 无法执行危险操作
- [ ] **脚本生成:** 验证生成脚本无法访问 Node.js API
- [ ] **标签分组:** 验证相同标签集合分组结果一致
- [ ] **@ 引用:** 验证引用标签页关闭后正确处理
- [ ] **安全防护:** 验证所有用户输入都经过消毒

## 恢复策略

| 陷阱 | 恢复成本 | 恢复步骤 |
|------|---------|---------|
| CDP 会话泄漏 | LOW | 调用 cleanupAllDebuggers() + 重启应用 |
| 搜索索引损坏 | MEDIUM | 删除索引文件 + 重建（耗时） |
| 脚本执行卡死 | LOW | 强制终止 webContents + 恢复标签页 |
| 安全漏洞 | HIGH | 紧急修复 + 用户通知 + 版本回滚 |
| LLM 上下文溢出 | LOW | 清空对话历史 + 重新开始 |

## 陷阱到阶段映射

| 陷阱 | 预防阶段 | 验证方式 |
|------|---------|---------|
| CDP 调试器会话泄漏 | Phase 22 | 内存监控 + 长时间运行测试 |
| 大页面内容提取冻结 | Phase 22 | 性能测试（5MB 页面） |
| 链接提取 URL 格式错误 | Phase 22 | 单元测试（相对/绝对/JS 链接） |
| 全文检索性能下降 | Phase 23 | 压力测试（10,000+ 条数据） |
| @ 引用敏感信息泄露 | Phase 23 | 安全审计 + 敏感信息检测 |
| 任务自动化安全风险 | Phase 24 | 安全审计 + 渗透测试 |
| 脚本生成代码注入 | Phase 25 | 静态分析 + 沙箱验证 |
| 标签分组不准确 | Phase 25 | A/B 测试 + 用户反馈 |

---

## 来源

- Electron 官方文档：webContents.debugger API
- Chrome DevTools Protocol 规范
- OWASP 代码注入防护指南
- SQLite FTS5 性能优化文档
- LLM Prompt Injection 防护最佳实践
- 项目现有代码分析（cdp-manager.js, ai-manager.js）

---

*陷阱研究：多容器隔离浏览器 v2.1 AI CDP 增强 + Tabbrowser 功能集成*
*研究日期：2026-08-02*
