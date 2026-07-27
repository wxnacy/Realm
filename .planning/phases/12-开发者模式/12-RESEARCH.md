# Phase 12: 开发者模式 - API 请求抓取 - Research

**Researched:** 2026-07-27
**Domain:** Electron CDP 调试器 API、SQLite 批量写入、内部页面开发
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEV-01 | 设置页面左侧边栏新增"开发者模式"入口 | 已有 sidebar-item 模式，直接复用 |
| DEV-02 | 开关关闭时页面下方所有配置元素为禁用状态 | CSS class + disabled 属性控制 |
| DEV-03 | 域名列表区域展示和管理 | 复用 rules-list 模式 |
| DEV-04 | 域名添加（已有域名选择 + 手动输入） | 复用规则添加模式 |
| DEV-05 | CDP 抓取引擎 + SQLite 持久化 + 写入队列 | 本研究核心 |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 按需附加 — tab 加载的域名匹配抓取列表时才附加调试器，离开该域名时断开
- **D-02:** 主进程统一管理 — main.js 监听 webview 的 did-start-navigation 事件
- **D-03:** 包含响应体的 CDP 事件 — Network.requestWillBeSent + Network.responseReceived + Network.dataReceived + Network.loadingFinished/Failed
- **D-04:** toast 提示 + 继续 — 调试器附加失败时弹 toast 提示，不阻塞页面加载
- **D-05:** 容器数据库内存储 — 每个容器的 SQLite 文件中新增 dev_requests 表
- **D-06:** 每容器独立表 — dev_requests_work、dev_requests_personal 等，容器 ID 白名单验证
- **D-07:** 按天数保留 — 用户可配置保留天数，自动清理过期数据
- **D-08:** 仅文本响应 — 只存储 Content-Type 为 application/json、text/* 等文本类响应体
- **D-09:** 主进程统一队列 — 所有容器的抓取数据统一收集到主进程内存队列
- **D-10:** 紧急 flush — 队列达到上限（建议 1000 条）时触发紧急 flush
- **D-11:** 定时 2 秒 flush — 每 2 秒 flush 一次
- **D-12:** 重试 3 次 + 丢弃 — 写入失败时重试最多 3 次，超过后丢弃并记录 console.error
- **D-13:** 独立 realm://devrequests 页面
- **D-14:** 表格视图 — 类似 Chrome DevTools Network 面板
- **D-15:** 行内展开详情 — 点击请求行后在下方展开详情面板
- **D-16:** 域名 + 方法 + 搜索过滤

### Claude's Discretion

- 设置页开发者模式区域的具体 UI 布局和样式细节
- 域名选择器的具体交互方式（下拉选择 vs 自动完成输入框）
- 请求表格的列宽、排序默认值
- realm://devrequests 页面的整体视觉风格
- 写入队列的具体上限值（1000 条为建议值）
- CDP 附加/断开的生命周期管理细节
- 数据保留天数的默认值和范围限制

### Deferred Ideas (OUT OF SCOPE)

None
</user_constraints>

## Summary

本研究为 Phase 12 开发者模式功能提供技术实现方案。核心功能是在设置页面新增开发者模式开关，允许用户配置需要抓取 API 请求的域名列表，通过 Chrome DevTools Protocol (CDP) 自动抓取匹配域名的所有网络请求，并异步持久化到 SQLite 数据库。

主要技术挑战在于：
1. **CDP 调试器管理**：需要在主进程统一管理 webview 的调试器生命周期，按需附加/断开
2. **异步写入队列**：高并发网络请求数据需要批量写入，避免阻塞页面渲染
3. **数据查看页面**：独立的 realm://devrequests 页面，提供类似 Chrome DevTools Network 面板的表格视图

**Primary recommendation:** 复用现有 better-sqlite3 连接和 realm:// 页面模式，CDP 调试器逻辑集中在 main.js 的 webContents 事件监听中实现。

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.7.0 | SQLite 数据库驱动 | 已在项目中使用，同步 API 性能优异 |
| electron-store | ^8.1.0 | 配置持久化 | 已在项目中使用，存储开发者模式开关和域名列表 |
| Electron CDP | 内置 | 网络请求抓取 | webContents.debugger 原生支持，无需额外依赖 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| 无新增依赖 | — | — | 复用现有依赖即可 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CDP 调试器 | 代理服务器 (mitmproxy) | CDP 无需额外进程，但代理可抓取所有流量；CDP 更轻量适合本场景 |
| 同步写入 | 异步队列 | 同步写入简单但会阻塞页面，异步队列复杂但用户体验更好 |

**Installation:**
```bash
# 无需新增依赖，全部复用现有
```

**Version verification:**
- better-sqlite3: ^11.7.0 [VERIFIED: package.json]
- electron-store: ^8.1.0 [VERIFIED: package.json]
- Electron: ^32.0.0 [VERIFIED: package.json]

## Package Legitimacy Audit

> 本 Phase 不安装任何外部包，所有依赖均已存在于项目中。

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| better-sqlite3 | npm | OK | 已在项目中使用 |
| electron-store | npm | OK | 已在项目中使用 |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### CDP 调试器生命周期管理

**核心流程：**
```
webview did-start-navigation
  → 检查 URL 域名是否在抓取列表
  → 是：附加调试器 (debugger.attach)
  → 否：如果已附加则断开 (debugger.detach)
```

**CDP 事件流：**
```
Network.enable
  ↓
Network.requestWillBeSent (请求发出)
  ↓
Network.responseReceived (响应头到达)
  ↓
Network.dataReceived (响应体数据块)
  ↓
Network.loadingFinished / Network.loadingFailed (完成/失败)
  ↓
Network.getResponseBody (获取完整响应体)
```

**关键实现细节：**
1. `webContents.debugger.attach('1.3')` — 附加调试器，版本 1.3 支持 Network 域
2. `debugger.sendCommand('Network.enable')` — 启用网络监控
3. `debugger.on('message', handler)` — 监听 CDP 事件
4. `debugger.on('detach', handler)` — 监听调试器断开（用户手动打开 DevTools 会导致断开）

**陷阱：**
- 同一 webContents 只能附加一个调试器，用户打开 DevTools 会导致自动断开
- 调试器断开后需要重新附加，但此时可能已经丢失部分请求
- 需要维护 requestId 到请求数据的映射，用于关联 requestWillBeSent 和 responseReceived

### 写入队列设计

**队列结构：**
```javascript
{
  queue: [],           // 待写入记录数组
  flushTimer: null,    // 2秒定时器
  flushing: false,     // 是否正在 flush
  retryCount: Map()    // 每条记录的重试次数
}
```

**Flush 策略：**
1. **定时 flush**：每 2 秒执行一次，不管队列有多少条
2. **紧急 flush**：队列达到 1000 条时立即触发
3. **退出 flush**：应用退出前 flush 所有待写入数据

**批量写入优化：**
```javascript
// 使用事务批量插入
const insert = db.prepare(`INSERT INTO ${tableName} (...) VALUES (?, ?, ?, ...)`);
const insertMany = db.transaction((records) => {
  for (const record of records) {
    insert.run(record.url, record.method, ...);
  }
});
insertMany(queue.splice(0, queue.length));
```

### realm:// 页面模式

**现有模式（复用）：**
```
realm://devrequests
  → http://localhost:PORT/devrequests?container=xxx&token=xxx
  → src/devrequests.html
  → src/devrequests-page.js
  → /api/devrequests/* JSON 端点
```

**数据 API 端点：**
- `GET /api/devrequests/list` — 分页查询请求记录
- `GET /api/devrequests/search` — 搜索请求记录
- `POST /api/devrequests/delete` — 删除单条记录
- `POST /api/devrequests/clear` — 清空容器的所有记录
- `GET /api/devrequests/stats` — 获取统计信息（总数、今日数等）

### Recommended Project Structure
```
src/
├── devrequests.html        # 新增：请求查看页面
├── devrequests-page.js     # 新增：请求查看页面逻辑
└── settings.html           # 修改：添加开发者模式侧边栏入口

main.js                     # 修改：添加 CDP 调试器管理、写入队列、API 端点
```

### Anti-Patterns to Avoid

- **在渲染进程管理调试器**：调试器必须在主进程管理，渲染进程无法直接访问 webContents.debugger
- **同步写入数据库**：每个网络请求都同步写入会严重阻塞页面加载
- **忽略调试器断开事件**：用户打开 DevTools 会导致调试器断开，需要处理重连
- **存储二进制响应体**：图片、视频等二进制内容不应存储到 SQLite，会导致数据库膨胀

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite 连接管理 | 自定义连接池 | 复用现有 history-manager 的 db 实例 | 避免多连接竞争，复用 WAL 模式配置 |
| 批量插入 | 逐条 INSERT | better-sqlite3 transaction | 事务批量插入性能提升 100x |
| URL 域名解析 | 正则表达式 | `new URL(url).hostname` | 内置 API 更可靠，处理各种边界情况 |
| HTML 转义 | 自定义函数 | 复用 history-page.js 的 escapeHtml | 避免 XSS 漏洞 |

## Common Pitfalls

### Pitfall 1: CDP 调试器冲突
**What goes wrong:** 用户手动打开 DevTools 会导致调试器自动断开
**Why it happens:** Electron 同一 webContents 只能有一个调试器连接
**How to avoid:** 监听 `debugger.on('detach')` 事件，在用户关闭 DevTools 后自动重新附加
**Warning signs:** 控制台出现 "Debugger is already attached" 错误

### Pitfall 2: 写入队列内存溢出
**What goes wrong:** 高流量网站产生大量请求，队列无限增长导致内存溢出
**Why it happens:** 没有设置队列上限
**How to avoid:** 设置队列上限（1000 条），达到上限时紧急 flush
**Warning signs:** 应用内存持续增长，页面变卡

### Pitfall 3: 响应体获取失败
**What goes wrong:** Network.getResponseBody 返回空或失败
**Why it happens:** 请求被取消、重定向、或响应体过大
**How to avoid:** 捕获异常，记录错误但不中断流程
**Warning signs:** 控制台出现 "No resource with given identifier" 错误

### Pitfall 4: 二进制响应体导致数据库膨胀
**What goes wrong:** 存储图片、视频等二进制内容导致 SQLite 文件快速增大
**Why it happens:** 没有过滤 Content-Type
**How to avoid:** 只存储 Content-Type 为 application/json、text/* 的响应体（D-08）
**Warning signs:** SQLite 文件大小异常增长

### Pitfall 5: 容器删除后残留表
**What goes wrong:** 删除容器后 dev_requests_xxx 表残留在数据库中
**Why it happens:** 容器删除逻辑没有清理开发者模式表
**How to avoid:** 在容器删除流程中添加 DROP TABLE IF EXISTS dev_requests_xxx
**Warning signs:** 数据库中存在孤立表

## Code Examples

### CDP 调试器附加和事件监听

```javascript
// 来源：Electron 官方文档 webContents.debugger
// https://www.electronjs.org/docs/latest/api/web-contents#class-webcontents

/**
 * 为 webview 附加 CDP 调试器并启用网络监控
 * @param {Electron.WebContents} webContents - webview 的 webContents
 * @param {string} containerId - 容器 ID
 */
function attachDebugger(webContents, containerId) {
  if (webContents.debugger.isAttached()) {
    return; // 已附加，跳过
  }

  try {
    webContents.debugger.attach('1.3');
    webContents.debugger.sendCommand('Network.enable');

    // 监听网络事件
    webContents.debugger.on('message', (event, method, params) => {
      handleNetworkEvent(webContents.id, containerId, method, params);
    });

    // 监听调试器断开（用户打开 DevTools 会触发）
    webContents.debugger.on('detach', (event, reason) => {
      console.log(`[Realm] 调试器断开: ${reason}`);
      // 标记为已断开，下次导航时重新附加
      debuggerState.delete(webContents.id);
    });

    console.log(`[Realm] 调试器已附加: webContents=${webContents.id}`);
  } catch (err) {
    console.error(`[Realm] 调试器附加失败:`, err.message);
    // D-04: toast 提示但不阻塞
    notifyDebuggerError(webContents, err.message);
  }
}
```

### 批量写入优化

```javascript
// 来源：better-sqlite3 官方文档
// https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction

/**
 * 创建批量插入语句
 * @param {string} tableName - 表名
 * @returns {Function} 批量插入函数
 */
function createBatchInserter(tableName) {
  const insert = db.prepare(`
    INSERT INTO ${tableName} (
      request_id, url, method, status_code,
      request_headers, request_body,
      response_headers, response_body,
      content_type, duration, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 使用事务批量插入（性能提升 100x）
  return db.transaction((records) => {
    for (const record of records) {
      insert.run(
        record.requestId,
        record.url,
        record.method,
        record.statusCode,
        JSON.stringify(record.requestHeaders),
        record.requestBody || '',
        JSON.stringify(record.responseHeaders),
        record.responseBody || '',
        record.contentType,
        record.duration,
        record.createdAt
      );
    }
  });
}
```

### 域名匹配逻辑

```javascript
/**
 * 检查 URL 域名是否在抓取列表中
 * @param {string} url - 完整 URL
 * @param {Set<string>} domains - 域名集合
 * @returns {boolean} 是否匹配
 */
function isDomainMatch(url, domains) {
  try {
    const hostname = new URL(url).hostname;
    // 支持精确匹配和子域名匹配
    // 例如：配置 "api.example.com" 匹配 "api.example.com"
    // 配置 "example.com" 匹配 "api.example.com" 和 "www.example.com"
    return domains.has(hostname) ||
           [...domains].some(domain =>
             hostname.endsWith(`.${domain}`)
           );
  } catch {
    return false; // URL 解析失败，不匹配
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无开发者模式 | CDP 调试器抓取 | Phase 12 新增 | 用户可抓取和查看 API 请求 |

**Deprecated/outdated:**
- 无（本 Phase 为新增功能）

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | webContents.debugger 在 Electron 32 中可用 | CDP 调试器 | 需要降级到代理方案 |
| A2 | better-sqlite3 transaction 批量插入性能优于逐条插入 | 写入队列 | 可能需要调整批量大小 |
| A3 | 1000 条队列上限足够应对大多数场景 | 写入队列 | 高流量网站可能需要更大上限 |

## Open Questions

1. **CDP 调试器与 DevTools 冲突处理**
   - What we know: 用户打开 DevTools 会导致调试器断开
   - What's unclear: 是否应该自动重新附加（用户可能想用 DevTools 调试）
   - Recommendation: 在 detach 事件中标记状态，下次导航时重新附加，但不主动抢占 DevTools

2. **数据保留天数默认值**
   - What we know: D-07 说用户可配置
   - What's unclear: 默认保留多少天
   - Recommendation: 默认 7 天，选项为 1/3/7/14/30/永不

3. **请求数据大小限制**
   - What we know: D-08 说只存储文本响应
   - What's unclear: 单条响应体大小上限
   - Recommendation: 限制 1MB，超过截断并标记 "响应体过大"

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| better-sqlite3 | SQLite 存储 | ✓ | ^11.7.0 | — |
| electron-store | 配置持久化 | ✓ | ^8.1.0 | — |
| Electron CDP | 网络抓取 | ✓ | 内置 | — |
| Node.js | 运行时 | ✓ | — | — |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** none

## Validation Architecture

> workflow.nyquist_validation is enabled (absent in config).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 未检测到测试框架 |
| Config file | none — see Wave 0 |
| Quick run command | `npm test` (需先配置) |
| Full suite command | `npm test` (需先配置) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEV-01 | 设置页显示开发者模式入口 | manual | — | — |
| DEV-02 | 开关控制配置元素禁用状态 | manual | — | — |
| DEV-03 | 域名列表展示和删除 | manual | — | — |
| DEV-04 | 域名添加（选择+输入） | manual | — | — |
| DEV-05 | CDP 抓取 + SQLite 持久化 | manual | — | — |

### Sampling Rate
- **Per task commit:** 无自动化测试
- **Per wave merge:** 无自动化测试
- **Phase gate:** 手动验证所有功能

### Wave 0 Gaps
- [ ] 项目当前没有配置测试框架，如需自动化测试需要先配置

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | API token 鉴权（复用现有 REALM_TOKEN） |
| V5 Input Validation | yes | 容器 ID 白名单验证、URL 格式校验 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + CDP

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL 注入 | Tampering | 容器 ID 白名单验证 [a-z0-9-] |
| API token 泄露 | Information Disclosure | token 仅在 URL 查询参数中传递，不持久化 |
| 敏感请求数据泄露 | Information Disclosure | 请求数据存储在本地 SQLite，不上传 |
| 恶意域名配置 | Denial of Service | 域名格式校验，限制域名数量上限 |

## Sources

### Primary (HIGH confidence)
- Electron 官方文档 - webContents.debugger: https://www.electronjs.org/docs/latest/api/web-contents
- better-sqlite3 官方文档: https://github.com/WiseLibs/better-sqlite3
- Chrome DevTools Protocol - Network 域: https://chromedevtools.github.io/devtools-protocol/1-3/Network/

### Secondary (MEDIUM confidence)
- 项目现有代码（history-manager.js、settings-page.js、main.js）

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - 全部复用现有依赖
- Architecture: HIGH - 复用现有 realm:// 页面模式和 SQLite 模式
- Pitfalls: MEDIUM - CDP 调试器管理有一定复杂度

**Research date:** 2026-07-27
**Valid until:** 2026-08-27 (30 天，技术栈稳定)
