# Phase 20: AI Agent 集成 - 核心功能 - Research

**Researched:** 2026-08-01
**Domain:** AI Agent SDK 集成、Electron IPC 通信、工具注册
**Confidence:** HIGH

## Summary

Phase 20 完成 AI Manager 核心模块，注册 Realm 工具，打通 IPC 通信，使 AI Agent 能够调用 Realm 浏览器功能。基于 Phase 19 已验证的 AIManager 骨架，需要填充 5 个工具的实现逻辑、事件广播机制、IPC 通道和 Preload API。

**关键发现：**
- Phase 19 已完成 AIManager 骨架（284 行）和 get_tabs 工具端到端验证
- pi-ai 和 pi-agent-core 为 ESM-only 包，需要动态 import()
- Electron 32.3.3 内置 Node.js 20.18.x（不满足 pi-agent-core >= 22.19.0）
- 已有完整的设计契约（UI-SPEC.md）和集成文档（pi-agent-integration.md）

**Primary recommendation:** 在现有 AIManager 骨架基础上填充工具逻辑和事件广播，复用项目已有的 Manager 模块（tab-manager、history-manager、favorites-manager、container-manager）。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI Agent 生命周期 | Main Process | — | pi-agent-core 运行在主进程，管理 Agent 实例 |
| 工具执行 | Main Process | — | 工具需要访问主进程模块（tab-manager 等） |
| 事件广播 | Main Process | Renderer | 主进程推送事件，渲染进程接收并渲染 |
| API Key 管理 | Main Process | — | 安全要求，不能暴露到渲染进程 |
| UI 展示 | Renderer | — | 聊天界面和设置页面（Phase 21） |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @earendil-works/pi-ai | ^0.82.1 | 统一多提供商 LLM API | 已安装，Phase 19 验证通过 |
| @earendil-works/pi-agent-core | ^0.82.1 | Agent 运行时 | 已安装，Phase 19 验证通过 |
| electron-store | ^8.1.0 | 配置持久化 | 已有，存储 API Key |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron | ^32.0.0 | 桌面应用框架 | 已有 |

### Installation

```bash
# 已安装，无需额外安装
npm install
```

## Package Legitimacy Audit

> 已在 Phase 19 验证，无需重复检查。

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| @earendil-works/pi-ai | npm | OK | Approved |
| @earendil-works/pi-agent-core | npm | OK | Approved |

## Architecture Patterns

### System Architecture Diagram

```
渲染进程 (Phase 21)
    ↕ IPC: ai:prompt / ai:events-batch
主进程 (Phase 20)
    ├─ AIManager
    │   ├─ pi-ai Models (LLM 连接)
    │   ├─ pi-agent-core Agent (对话和工具执行)
    │   └─ Realm 工具注册
    │       ├─ navigate → tab-manager
    │       ├─ search_history → history-manager
    │       ├─ manage_favorites → favorites-manager
    │       ├─ switch_container → container-manager
    │       └─ get_tabs → tab-manager
    └─ ipc-handlers.js
        ├─ ai:prompt
        ├─ ai:abort
        ├─ ai:configure
        ├─ ai:get-models
        └─ ai:get-state
```

### Recommended Project Structure

```
src/
├── ai-manager.js           # AI Manager 核心模块（已有骨架）
├── ipc-handlers.js         # 添加 AI IPC 通道
├── src/preload.js          # 暴露 AI API
└── src/renderer.js         # Phase 21 添加 AI 聊天 UI
```

### Pattern 1: 工具注册

**What:** 使用 pi-agent-core 的 AgentTool 接口注册 Realm 工具
**When to use:** 每个需要 AI 调用的 Realm 功能
**Example:**

```javascript
// Source: ai-manager.js Phase 19 已验证
{
  name: 'navigate',
  label: 'URL 导航',
  description: '在指定容器中打开 URL',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: '要打开的 URL' },
      containerId: { type: 'string', description: '容器 ID（可选）' },
      newTab: { type: 'boolean', description: '是否在新标签页打开' },
    },
    required: ['url'],
  },
  execute: async (toolCallId, params, signal, onUpdate) => {
    // 调用 tab-manager 创建标签页
    const tab = tabManager.createTab(params.containerId, params.url);
    return {
      content: [{ type: 'text', text: `已在容器 ${tab.containerId} 打开 ${params.url}` }],
      details: { tabId: tab.id },
    };
  },
}
```

### Pattern 2: 事件广播

**What:** 通过 IPC 将 Agent 事件推送到渲染进程
**When to use:** 所有 Agent 事件（message、tool_execution 等）
**Example:**

```javascript
// Source: ai-manager.js Phase 19 已验证
this.agent.subscribe((event) => {
  const win = windowManager.getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send('ai:event', event);
  }
});
```

### Pattern 3: 批量事件

**What:** 高频事件使用 debounce 16ms 批量合并
**When to use:** message_update、tool_execution_update 等高频事件
**Example:**

```javascript
// Source: UI-SPEC.md IPC Event Contract
let eventBatch = [];
let batchTimer = null;

this.agent.subscribe((event) => {
  if (event.type === 'message_update' || event.type === 'tool_execution_update') {
    eventBatch.push(event);
    if (!batchTimer) {
      batchTimer = setTimeout(() => {
        const win = windowManager.getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('ai:events-batch', { events: eventBatch });
        }
        eventBatch = [];
        batchTimer = null;
      }, 16);
    }
  } else {
    // 非高频事件立即发送
    const win = windowManager.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ai:events-batch', { events: [event] });
    }
  }
});
```

### Anti-Patterns to Avoid

- **在渲染进程运行 Agent:** Agent 必须在主进程运行，因为需要访问主进程模块（tab-manager 等）
- **直接暴露 API Key:** API Key 必须存储在主进程，通过 CredentialStore 注入
- **同步阻塞主进程:** Agent 调用 LLM 是异步操作，使用 async/await

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM 调用 | 自行实现 HTTP 请求 | pi-ai Models | 已有 30+ 提供商支持 |
| Agent 循环 | 自行实现对话循环 | pi-agent-core Agent | 已有完整状态管理 |
| 工具执行引擎 | 自行实现工具调度 | pi-agent-core AgentTool | 已有并行/串行执行、生命周期钩子 |
| 上下文管理 | 自行实现消息裁剪 | pi-agent-core transformContext | 已有完整机制 |

## Common Pitfalls

### Pitfall 1: ESM 动态导入

**What goes wrong:** pi-ai 和 pi-agent-core 是 ESM-only 包，CommonJS 的 require() 无法加载
**Why it happens:** package.json 声明 "type": "module"
**How to avoid:** 使用动态 import() 加载 ESM 包
**Warning signs:** `SyntaxError: Cannot use import statement outside a module`

```javascript
// 正确做法
const { builtinModels } = await import('@earendil-works/pi-ai');
const { Agent } = await import('@earendil-works/pi-agent-core');
```

### Pitfall 2: Node.js 版本不满足

**What goes wrong:** pi-agent-core 要求 Node.js >= 22.19.0，Electron 32.3.3 内置 Node 20.18.x
**Why it happens:** Electron 版本与 Node.js 版本绑定
**How to avoid:** Phase 19 已验证可以正常运行（可能有警告但功能正常）
**Warning signs:** `Warning: Node.js version 20.18.x is below recommended 22.19.0`

### Pitfall 3: 事件广播遗漏

**What goes wrong:** 忘记广播某些 Agent 事件，导致 UI 状态不同步
**Why it happens:** Agent 事件类型较多，容易遗漏
**How to avoid:** 参考 UI-SPEC.md 的事件类型清单，确保所有事件都广播
**Warning signs:** UI 显示不完整或状态不一致

### Pitfall 4: 工具返回格式错误

**What goes wrong:** 工具返回格式不符合 AgentToolResult 接口
**Why it happens:** 不熟悉 pi-agent-core 的接口定义
**How to avoid:** 使用 { content: [...], details: any } 格式
**Warning signs:** Agent 无法解析工具结果

## Code Examples

### 完整工具实现示例

```javascript
// Source: ai-manager.js Phase 19 已验证
{
  name: 'search_history',
  label: '搜索历史',
  description: '搜索浏览历史记录',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词' },
      containerId: { type: 'string', description: '容器 ID（可选）' },
      limit: { type: 'number', description: '返回结果数量限制' },
    },
    required: ['query'],
  },
  execute: async (toolCallId, params, signal, onUpdate) => {
    const results = historyManager.searchRecords(params.containerId || 'work', {
      keyword: params.query,
      limit: params.limit || 10,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2),
      }],
      details: { count: results.length },
    };
  },
}
```

### IPC 通道注册

```javascript
// Source: ipc-handlers.js 现有模式
ipcMain.handle('ai:prompt', async (event, message) => {
  assertTrustedSender(event);
  if (!message || typeof message !== 'string') {
    throw new Error('无效的消息');
  }
  await aiManager.prompt(message);
  return { success: true };
});

ipcMain.handle('ai:abort', async (event) => {
  assertTrustedSender(event);
  aiManager.abort();
  return { success: true };
});
```

### Preload API 暴露

```javascript
// Source: src/preload.js 现有模式
contextBridge.exposeInMainWorld('realmAPI', {
  // ... 现有 API ...
  ai: {
    prompt: (message) => ipcRenderer.invoke('ai:prompt', message),
    abort: () => ipcRenderer.invoke('ai:abort'),
    onEventsBatch: (callback) => {
      ipcRenderer.on('ai:events-batch', (_, data) => callback(data.events));
      return () => ipcRenderer.removeAllListeners('ai:events-batch');
    },
    configureProviders: (config) => ipcRenderer.invoke('ai:configure', config),
    getAvailableModels: () => ipcRenderer.invoke('ai:get-models'),
    getState: () => ipcRenderer.invoke('ai:get-state'),
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无 AI 集成 | pi-agent-core SDK | Phase 19 | 完整的 Agent 能力 |
| 控制台输出 | IPC 事件广播 | Phase 20 | UI 可以接收实时事件 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pi-agent-core 在 Node 20.18.x 上可以正常运行 | Pitfall 2 | 可能需要升级 Electron 或使用子进程方案 |
| A2 | 16ms debounce 可以平衡实时性和性能 | Pattern 3 | 可能需要调整 debounce 时间 |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | pi-agent-core | ✓ | 20.18.x (Electron 内置) | — |
| electron-store | API Key 存储 | ✓ | 8.1.0+ | — |
| tab-manager | get_tabs, navigate | ✓ | 已有 | — |
| history-manager | search_history | ✓ | 已有 | — |
| favorites-manager | manage_favorites | ✓ | 已有 | — |
| container-manager | switch_container | ✓ | 已有 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 无（项目当前没有配置测试） |
| Config file | none |
| Quick run command | `npm test`（未配置） |
| Full suite command | `npm test`（未配置） |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-02 | AI Manager 完整实现 | manual | 手动验证 | ❌ |
| AI-02 | Realm 工具注册 | manual | 手动验证 | ❌ |
| AI-02 | IPC 通道实现 | manual | 手动验证 | ❌ |
| AI-02 | Preload.js API 暴露 | manual | 手动验证 | ❌ |

### Sampling Rate

- **Per task commit:** 手动验证核心功能
- **Per wave merge:** 完整功能测试
- **Phase gate:** 所有工具可调用，事件广播正常

### Wave 0 Gaps

- 无测试框架，采用手动验证

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | API Key 存储在 electron-store，不暴露到渲染进程 |
| V3 Session Management | no | — |
| V4 Access Control | yes | IPC assertTrustedSender 验证 |
| V5 Input Validation | yes | 工具参数校验 |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron AI Agent

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API Key 泄露 | Information Disclosure | 存储在主进程，不暴露到渲染进程 |
| 恶意工具调用 | Elevation of Privilege | assertTrustedSender 验证 IPC 来源 |
| 注入攻击 | Tampering | 工具参数类型校验 |

## Sources

### Primary (HIGH confidence)

- `docs/plan/pi-agent-integration.md` — Pi Agent SDK 能力边界分析
- `ai-manager.js` — Phase 19 已验证的 AIManager 骨架
- `.planning/phases/20-ai-agent/20-CONTEXT.md` — 用户决策和实现细节
- `.planning/phases/20-ai-agent/20-UI-SPEC.md` — 设计契约

### Secondary (MEDIUM confidence)

- `ipc-handlers.js` — IPC 注册模式
- `src/preload.js` — API 暴露模式

### Tertiary (LOW confidence)

- 无

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 19 已验证
- Architecture: HIGH — 有完整的设计文档
- Pitfalls: HIGH — ESM 动态导入已在 Phase 19 解决

**Research date:** 2026-08-01
**Valid until:** 2026-08-15（pi-ai 和 pi-agent-core 版本稳定）
