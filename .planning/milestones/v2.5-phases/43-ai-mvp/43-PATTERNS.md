# Phase 43: AI 记忆系统集成（条目记忆 MVP） - Pattern Map

**Mapped:** 2026-09-04
**Files analyzed:** 8
**Analogs found:** 7 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ai-memory-manager.js` (new) | service (main-process manager) | file-I/O + transform | `cookie-manager.js`（文件存储形态）+ `ai-manager.js` validateScript（扫描形态） | role-match |
| `ai-manager.js` (modify) | service | event-driven (Agent 循环) | `ai-manager.js` 自身既有工具/Agent 创建点 | exact（自身扩展） |
| `container-manager.js` (modify) | service | CRUD (删除链路) | `container-manager.js` 自身 `deleteContainer` | exact（自身扩展） |
| `main.js` (modify) | route | request-response | `main.js` `/api/ai/providers` 路由族 + `handleHistoryApi` token 鉴权 | exact（自身扩展） |
| `src/settings.html` (modify) | component (markup) | — | `src/settings.html` 自身 `search-config-section` | exact（自身扩展） |
| `src/settings-page.js` (modify) | component | request-response (HTTP) | `src/settings-page.js` 自身 `searchConfigApi` / `settingsApi` | exact（自身扩展） |
| `src/renderer.js` (modify) | component | event-driven (用户操作) | `src/renderer.js` 自身 `confirmDeleteContainer` 确认链路 | exact（自身扩展） |
| `test/memory/*.test.js` (new) | test | batch | 无 node:test 先例（现有 `tests/test-*.js` 为独立脚本） | **no analog**（见 No Analog 段） |

> 本阶段全部插入点已在 43-RESEARCH.md 逐行验证；本文件的价值是把每个插入点对应的**可复制代码原文**集中交付给 planner。

## Pattern Assignments

### `ai-memory-manager.js` (service, file-I/O) — 新建

**Analog 1（模块形态/文件存储）:** `cookie-manager.js`

模块头 + userData 路径常量模式（lines 1-20）：

```javascript
/**
 * Realm Browser - Cookie 管理模块
 *
 * 管理容器 Cookie 的保存、加载、导出和导入
 * 每个容器的 Cookie 独立存储在容器目录下的 cookies.json 文件
 */

const { app, session } = require('electron');
const fs = require('fs');
const path = require('path');
```
```javascript
// 容器目录根路径
const CONTAINERS_DIR = path.join(app.getPath('userData'), 'containers');
```
- CommonJS（`require` + 末尾 `module.exports`），文件头 JSDoc 说明职责——所有主进程 manager 统一形态
- `app.getPath('userData')` 是项目内数据落盘的唯一路径来源（`favorites-manager.js`、`history-manager.js`、`ai-conversations-manager.js` 等同款）。**注意**：ai-memory-manager 需要路径可注入（Wave 0 可测试性要求，RESEARCH.md Wave 0 Gaps），即把路径解析收敛为单一可覆写函数而非顶层常量——这是对 cookie-manager 形态的唯一偏离
- 目录懒创建模式（lines 44-49）：

```javascript
function ensureContainerDir(containerId) {
  const containerDir = getContainerDir(containerId);
  if (!fs.existsSync(containerDir)) {
    fs.mkdirSync(containerDir, { recursive: true });
  }
}
```

**Analog 2（威胁扫描 fail-closed 形状，D-11）:** `ai-manager.js` `validateScript`（lines 141-178）

```javascript
/**
 * 脚本静态分析（per D-16 白名单脚本安全）
 * @param {string} script - 要检查的脚本内容
 * @returns {{safe: boolean, reason?: string}} 检查结果
 */
function validateScript(script) {
  if (!script || typeof script !== 'string') {
    return { safe: false, reason: '脚本内容为空' };
  }

  /** 危险模式列表 */
  const dangerousPatterns = [
    { pattern: /\beval\s*\(/, name: 'eval' },
    { pattern: /\bnew\s+Function\s*\(/, name: 'new Function' },
    // ...
  ];

  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(script)) {
      return { safe: false, reason: `检测到危险调用: ${name}` };
    }
  }

  return { safe: true };
}
```
- `scanInjectionPatterns(content)` 照此形状：`{ pattern, name }` 数组 + 命中返回 `{ safe: false, reason }`
- **语义区别**：validateScript 配套的是「先扫描后拒绝执行」；memory 场景 D-11 拍板是**拒绝写入**——扫描命中后在 write 路径 `throw`（Pitfall 4：throw → SDK 转 `isError:true` toolResult，不要返回错误文本冒充成功）
- **不要**复用 `sanitizeInput`（lines 84-139）的消毒语义——那是改写输入，memory 场景是拒绝写入

**跨 manager 引用模式**（`ai-manager.js` lines 71-80，container-manager 反向引用 ai-memory-manager 时套用）：

```javascript
/**
 * 惰性 require 的原因：纯 Node 环境（语法检查/注册验证）下
 * container-manager 依赖链（electron-store 构造时 app.getPath 为
 * undefined）不可加载；Electron 主进程运行时直接命中模块缓存，
 * 无循环依赖风险。
 */
function getContainersLazy() {
  return require('./container-manager').getContainers();
}
```

核心文件逻辑（编号解析/预算/原子写）无项目先例，按 43-RESEARCH.md「ai-memory-manager.js 模块骨架」+ AI-SPEC §4 实施；预算数值只在 manager 定义一处（shortcut-manager「默认值唯一来源」惯例）。

---

### `ai-manager.js` (modify) — 工具注册 + 快照注入

**Analog: 自身既有代码**

**模式 1：工具定义 + 活跃容器缺省解析**（`search_history`，lines 2290-2365）：

```javascript
// parameters 用普通 JSON Schema（非 TypeBox 构造器），逐字惯例：
parameters: {
  type: 'object',
  properties: {
    query: { type: 'string', description: '搜索关键词' },
    containerId: {
      type: 'string',
      description: '容器 ID（可选，默认使用当前活跃容器）',
    },
    // ...
  },
  required: ['query'],
},
execute: async (toolCallId, params) => {
  const { query, limit = 10, date } = params;
  let { containerId, startDate, endDate } = params;

  // 如果未指定容器，自动获取当前活跃容器
  if (!containerId) {
    const activeTab = tabManager.getActiveTab();
    if (!activeTab || !activeTab.containerId) {
      throw new Error('无法获取当前容器，请先打开一个标签页');
    }
    containerId = activeTab.containerId;
  }
  // ...业务校验失败也 throw（如 line 2340-2342: throw new Error('搜索关键词不能为空')）
  return {
    content: [{ type: 'text', text: JSON.stringify({...}, null, 2) }],
    details: { count: results.length, containerId },
  };
},
```
- `memory_read` 的缺省容器解析（D-03）和 `memory` 工具 `target:'container'` 落层解析（D-02）逐字套用这段
- 同款报错文案「无法获取当前容器，请先打开一个标签页」在 list_history（lines 2406-2413）重复出现——是稳定惯例，照抄文案
- 唯一不 throw 的例外：`memory_read` 文件不存在 → 返回空态文案「该容器暂无记忆」（D-05）

**模式 2：快照注入点 — 两处 Agent 创建都要改**（Pitfall 3）

`init()` 内（lines 724-738）：
```javascript
this.agent = new Agent({
  initialState: {
    systemPrompt: REALM_SYSTEM_PROMPT,   // ← 两处都改为 buildSystemPrompt() 拼接快照
    model,
    tools: this.tools,
  },
  streamFn: this.models.streamSimple.bind(this.models),
  convertToLlm: (messages) => {
    return messages.filter(msg =>
      msg.role === 'user' || msg.role === 'assistant' || msg.role === 'toolResult'
    );
  },
  transformContext: this._compactContext.bind(this),
});
```

`_recreateAgent()` 内（lines 2121-2158）：
```javascript
async _recreateAgent() {
  // ...
  const { Agent } = await import('@earendil-works/pi-agent-core');  // ESM-only，require() 直接失败
  // ...
  this.agent = new Agent({
    initialState: {
      systemPrompt: REALM_SYSTEM_PROMPT,   // ← 同上
      // ...
    },
    // ...
  });
  this._setupEventBroadcasting();
}
```
- 建议（RESEARCH Pitfall 3）：抽 `buildSystemPrompt()` 小函数（`REALM_SYSTEM_PROMPT + '\n\n' + memorySnapshot`）供两处共用，计划里作为独立验证项
- `buildGlobalSnapshot()` 必须是**同步函数**（读 ≤2200 字符文件同步成本可忽略）；`await import()` 后 `this.agent` 在微任务才赋值，同步帧内恒 null（G-42-4 实录）
- `convertToLlm` 已放行 `toolResult`——memory 工具结果天然可见，此回调零改动

**工具注册位置：** `this.tools` 数组（`_buildRealmTools()` 构建处），memory/memory_read 追加到数组末尾，参数 schema 与 description 语义必须一致（Pitfall 5：SDK execute 前强预检，enum 与 D-02 三值逐字一致，`entryId` pattern `^M[0-9]+$`）。

---

### `container-manager.js` (modify) — 删除钩子

**Analog: 自身 `deleteContainer`（lines 280-316）**

```javascript
/**
 * 删除容器
 * 异步流程：先 await 清空 session 存储（停止写入并刷盘），
 * 再删除 Cookie JSON 与 Partitions 目录，避免清理未完成时 rmSync 竞态
 * @param {string} id - 容器 ID
 * @returns {Promise<{success: boolean, message?: string}>} 操作结果
 */
async function deleteContainer(id) {
  // 拒绝删除默认容器
  if (id === 'default') {
    return { success: false, message: '无法删除默认容器' };
  }

  const container = containers.get(id);
  if (!container) {
    return { success: false, message: '容器不存在' };
  }

  // 清空容器 session 数据（必须 await：异步刷盘未完成时删目录会被重建）
  try {
    await container.session.clearStorageData();
  } catch (error) {
    console.error(`[Realm] 清空容器 session 数据失败: ${id}`, error);
  }
  containers.delete(id);

  // 删除容器的 Cookie 文件和 Session 数据（D-01, D-02）
  await cookieManager.deleteCookies(id);
  // ← D-05 钩子插入点：aiMemoryManager.deleteContainerMemory(id)，用惰性 require('./ai-memory-manager')

  // 从配置中移除
  let savedContainers = configStore.get('containers', DEFAULT_CONTAINERS);
  savedContainers = savedContainers.filter(c => c.id !== id);
  configStore.set('containers', savedContainers);

  console.log(`[Realm] 删除容器: ${id}`);
  return { success: true };
}
```
- 钩子放 `await cookieManager.deleteCookies(id)` 之后、`configStore.set` 之前；同样 `await`（删除方保证原子性，RESEARCH 责任表明确「不能靠懒读取兜底」）
- 引用方式用惰性 require（见 `ai-memory-manager.js` 段的 getContainersLazy 模式），避开 electron-store 顶层依赖链
- 日志惯例：`console.log('[Realm] 删除容器: ' + id)`——钩子内同款 `console.log('[Realm] 删除容器 AI 记忆: ' + id)` 或复用现有前缀

---

### `main.js` (modify) — `/api/ai-memory` 端点

**Analog 1: `handleHistoryApi` 的 token 鉴权（lines 766-771，逐字模式）：**

```javascript
async function handleHistoryApi(req, res, reqUrl) {
  // token 鉴权：防 CSRF 与 localhost 端口扫描读取/篡改历史
  if (reqUrl.searchParams.get('token') !== REALM_TOKEN) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const route = reqUrl.pathname.replace('/api/history/', '');
    if (route === 'list' && req.method === 'GET') {
      const containerId = reqUrl.searchParams.get('containerId') || '';
      // ...
      sendJson(res, 200, historyManager.listRecords(containerId, { offset, limit }));
      return;
    }
```
- `REALM_TOKEN` 定义于 main.js 顶部（L102，注释注明 `/api/*` 与 `/proxy` 鉴权）
- 7+ 个 `/api/*` handler 同款——**不要新写鉴权**（RESEARCH Don't Hand-Roll 表）

**Analog 2: `/api/ai/providers` 路由族（lines 1380-1419，GET/POST/带参 DELETE 全覆盖）：**

```javascript
// GET /api/ai/providers — 获取已配置供应商列表
if (route === 'ai/providers' && req.method === 'GET') {
  if (!aiManager) {
    sendJson(res, 200, { providers: [], activeProvider: null, activeModel: null });
    return;
  }
  sendJson(res, 200, await aiManager.getAvailableModels());
  return;
}

// POST /api/ai/providers — 保存供应商配置
if (route === 'ai/providers' && req.method === 'POST') {
  const config = await readJsonBody(req);
  if (!config || !config.provider) {
    sendJson(res, 400, { error: '提供商不能为空' });
    return;
  }
  if (aiManager) {
    await aiManager.configureProviders(config);
  }
  sendJson(res, 200, { success: true });
  return;
}

// DELETE /api/ai/providers/:id — 删除供应商
if (route.startsWith('ai/providers/') && req.method === 'DELETE') {
  const parts = route.split('/');
  const providerId = parts[2];
  if (!providerId) {
    sendJson(res, 400, { error: '供应商 ID 不能为空' });
    return;
  }
  // ...
}
```
- `/api/ai-memory` 的 GET（scope 参数 `user`/`global`/`container:<id>` + 容器下拉数据）与 POST（保存，服务端校验预算双保险）按此形状展开
- manager 空守卫（`if (!aiManager)`）照抄——`aiMemoryManager` 尚未初始化时返回空态而非 500
- 挂载方式：平级新 handler（与 settings/search-config/ai 并存）或并入 `handleSettingsApi` 均有先例（RESEARCH A3），实施时以 main.js 服务器分发结构为准
- 错误统一：catch 里 `sendJson(res, 400, { error: err.message })`（RESEARCH VERIFIED main.js:1480-1483）

---

### `src/settings.html` (modify) — 「AI 记忆」分区

**Analog: 自身 `search-config-section`（lines 419-455）**

```html
<!-- 网络搜索配置子区域 -->
<div class="settings-group search-config-section">
  <div class="settings-group-header">
    <h2 class="settings-group-title">网络搜索</h2>
  </div>
  <div class="settings-group-content" id="searchConfigContent">
    <!-- 编辑表单（初始隐藏） -->
    <div id="searchEditorForm" class="ai-editor-form">
      <div class="ai-editor-header">
        <h3 id="searchEditorTitle" class="ai-editor-title">Provider 名称</h3>
      </div>
      <div class="ai-form-group">
        <label>API Key</label>
        <div class="settings-input-wrapper">
          <input type="password" id="searchEditorApiKey" class="text-input" placeholder="输入 API Key">
```
- 「AI 记忆」分区放在 `settings-ai-assistant` section（L266）内，作为新的 `settings-group`，结构与 search-config-section 同形
- **CSP 铁律**（Pitfall 6）：初始隐藏必须走 CSS 类规则（`style="display:none"` 在 `style-src 'self'` 下不生效）；切换用 JS CSSOM `el.style.display = 'flex'/'block'/'none'`，不依赖 `''` 回落。textarea + 保存按钮 + 字数统计 span + 容器下拉，均为静态 markup

---

### `src/settings-page.js` (modify) — AI 记忆分区逻辑

**Analog 1: token 获取 + API 包装函数（lines 46-71, 145-155）**

```javascript
/** API token（来自 URL 查询参数） */
const apiToken = pageParams.get('token') || '';

/**
 * 调用设置 HTTP API
 */
async function settingsApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/settings/${route}?${params.toString()}`, options);
  if (!res.ok) {
    // 优先使用后端返回的错误详情
    let detail = '';
    try {
      const data = await res.json();
      if (data && data.error) detail = data.error;
    } catch { /* 非 JSON 响应忽略 */ }
    throw new Error(detail || `设置 API 请求失败: ${res.status}`);
  }
  return res.json();
}
```
```javascript
async function searchConfigApi(route, options = {}, query = {}) {
  const params = new URLSearchParams({ token: apiToken, ...query });
  const res = await fetch(`/api/search-config/${route}?${params.toString()}`, options);
  // ...同款错误详情透传
}
```
- 新增 `aiMemoryApi(route, options, query)` 包装函数照此形状，指向 `/api/ai-memory/`
- 「优先透传后端 error 详情」的 try/catch 段对保存失败提示（超限/容器不存在）尤其重要，保留

**Analog 2: 容器下拉数据源（lines 77-91，逐字复用）**

```javascript
async function fetchContainers() {
  try {
    const params = new URLSearchParams({ token: apiToken });
    const res = await fetch(`/api/containers/list?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`容器 API 请求失败: ${res.status}`);
    }
    const containers = await res.json();
    state.containers = containers;
    return containers;
  } catch (error) {
    console.error('[Realm] 获取容器列表失败:', error);
    return [];
  }
}
```
- 容器下拉直接复用 `fetchContainers()`，无需新端点（RESEARCH Open Question 1 结论）
- 交互按 D-12：textarea + 显式保存按钮 + 字数统计（`textarea.value.length`，与后端统一 JS `string.length` 口径，Pitfall 8）+ 超限阻断 + 「新会话生效」提示文案

---

### `src/renderer.js` (modify) — 删除确认文案

**Analog: 自身删除容器确认链路（lines 4358-4398）**

```javascript
previewInfo.appendChild(document.createTextNode(` ${container.name}`));

elements.deleteContainerPreview.innerHTML = '';
elements.deleteContainerPreview.appendChild(previewInfo);

elements.deleteConfirmModal.showModal();
```
```javascript
async function confirmDeleteContainer() {
  const containerId = state.deletingContainerId;
  if (!containerId) return;
  // ...先关闭该容器所有 Tab（销毁 webview）...
  const result = await window.realmAPI.deleteContainer(containerId);
```
- D-05 文案「该容器的 AI 记忆将一并删除」追加到 `deleteContainerPreview` 填充处（L4365-4366 附近），可追加为独立 textNode/列表项
- 原生 `<dialog>` + `showModal()`，与 AGENTS.md 弹框居中约定一致——本阶段只改文案内容，不动 dialog 结构，无需处理 margin: auto 事项
- `confirmDeleteContainer()` 逻辑零改动（钩子在主进程）

---

## Shared Patterns

### 活跃容器缺省解析（调用时解析）
**Source:** `ai-manager.js` lines 2321-2328（search_history，list_history 2406-2413 同款）
**Apply to:** `memory_read`（containerId 缺省）、`memory` 工具 `target:'container'` 落层（D-02：解析时机锁定在 execute 内）
```javascript
if (!containerId) {
  const activeTab = tabManager.getActiveTab();
  if (!activeTab || !activeTab.containerId) {
    throw new Error('无法获取当前容器，请先打开一个标签页');
  }
  containerId = activeTab.containerId;
}
```

### fail-closed 错误语义（throw → isError toolResult）
**Source:** pi-agent-core README L440-454（RESEARCH Pattern 6）+ ai-manager.js 工具 execute 内既有 throw 惯例
**Apply to:** memory 工具所有业务校验失败（威胁扫描命中、预算超限、悬空编号、参数组合非法）；错误消息写清修正指引（「先 remove 整理旧条目」/「换措辞重试」）
**唯一例外:** `memory_read` 文件不存在 → 返回空态文案（D-05）

### REALM_TOKEN 查询参数鉴权
**Source:** `main.js` lines 767-771（handleHistoryApi）
**Apply to:** `/api/ai-memory` GET/POST

### userData 路径 + 懒创建目录
**Source:** `cookie-manager.js` lines 17, 44-49；全项目 manager 同款
**Apply to:** `ai-memory-manager.js`（`userData/ai-memory/` + `memories/` 子目录）；**偏离点**：路径解析收敛为可覆写函数支持测试注入

### 惰性 require 跨 manager 引用
**Source:** `ai-manager.js` lines 71-80（getContainersLazy）
**Apply to:** `container-manager.js` → `ai-memory-manager.js` 的删除钩子引用

### token 获取 + fetch 包装 + 后端错误透传
**Source:** `src/settings-page.js` lines 46-71, 145-155
**Apply to:** settings-page 新增 `aiMemoryApi` 包装函数

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `test/memory/*.test.js` | test | batch | 项目现有测试是 `tests/test-*.js` 独立脚本（`npm run validate` 串联），**无 node:test 先例**。采用 AI-SPEC §5 选定的 node:test 是新惯例——planner 应把「test/memory/ 目录 + `npm run test:memory` script」作为 Wave 0 首个 task 建立基建。可参照 `tests/test-ai-conversations.js` 处理「顶层 require('electron') 不可加载」的 mock 手法（该文件注释提及 ai-conversations-manager 的 electron 依赖处理） |
| `ai-memory-manager.js` 条目解析核心（[Mn] 编号 parse/预算/原子写） | — | transform | 项目内无条目式文本存储先例；核心逻辑按 43-RESEARCH.md「ai-memory-manager.js 模块骨架」+ AI-SPEC §3/§4 实施，**不要**在 planner 之外另寻代码参照 |

## Metadata

**Analog search scope:** 项目根目录主进程模块（*.js）、src/ 渲染进程、tests/、node_modules/@earendil-works（经 RESEARCH 验证引用）
**Files read directly:** ai-manager.js（4 段非重叠区间）、container-manager.js、main.js（2 段）、src/settings-page.js、src/settings.html（2 段）、src/renderer.js、cookie-manager.js
**Pattern extraction date:** 2026-09-04
**行号可信度:** 本文所有行号为 2026-09-04 实读；ai-manager.js / main.js / renderer.js 均为 4000+ 行大文件，planner 引用时建议以 `grep` 重新定位锚点（如 `REALM_SYSTEM_PROMPT`、`deleteCookies(id)`、`ai/providers`）而非硬编码行号
