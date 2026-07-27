# Realm Browser 接入 Pi Agent SDK 能力边界分析

> 生成日期：2026-07-26
> 目标：评估 Realm Browser 接入 Pi Agent SDK 实现 AI Agent 能力的可行性与边界

---

## 1. Pi SDK 架构概览

Pi 是由 earendil-works 开源的 AI Agent 工具包（MIT 协议，GitHub 77.6k stars），采用分层架构设计：

```
@earendil-works/pi-ai (统一 LLM API 层)
    ↓
@earendil-works/pi-agent-core (Agent 运行时)
    ↓
@earendil-works/pi-coding-agent / pi-tui (用户交互层)
```

### 1.1 核心包说明

| 包名 | 版本 | 说明 |
|------|------|------|
| `@earendil-works/pi-ai` | 0.82.x | 统一多提供商 LLM API，支持 30+ 提供商，流式输出，工具调用验证 |
| `@earendil-works/pi-agent-core` | 0.82.1 | Agent 运行时，工具执行，状态管理，事件流 |
| `@earendil-works/pi-coding-agent` | - | 交互式编程 Agent CLI（与浏览器集成无关） |
| `@earendil-works/pi-tui` | - | 终端 UI 库（与浏览器集成无关） |

对 Realm 而言，**pi-ai** 和 **pi-agent-core** 是核心依赖，pi-coding-agent 和 pi-tui 不需要。

### 1.2 pi-ai 核心能力

- **统一 API**：`builtinModels()` 创建模型集合，一套 API 覆盖 30+ 提供商
- **流式输出**：`models.stream()` 返回异步迭代器，支持 `text_delta`、`toolcall_delta` 等事件
- **工具调用验证**：`validateToolCall()` 基于 TypeBox schema 校验参数
- **上下文序列化**：`Context` 是纯 JSON，可直接 `JSON.stringify/parse`
- **跨模型切换**：同一上下文可在 OpenAI → Anthropic → Google 间无缝切换
- **支持的提供商**：OpenAI、Anthropic、Google、Azure、DeepSeek、Mistral、Groq、Ollama 等 30+

### 1.3 pi-agent-core 核心能力

- **Agent 类**：高层封装，管理对话状态、工具执行、事件广播
- **工具系统**：`AgentTool` 接口，支持 TypeBox 参数定义、并行/串行执行、生命周期钩子
- **事件流**：`agent_start` → `turn_start` → `message_*` → `tool_execution_*` → `turn_end` → `agent_end`
- **状态管理**：`AgentState` 管理 systemPrompt、model、tools、messages、streaming 状态
- **上下文管理**：`transformContext` 裁剪历史，`convertToLlm` 转换消息格式
- **Steering/Follow-up**：支持中断当前执行注入新消息

---

## 2. Realm Browser 现状分析

### 2.1 已实现功能

| 功能 | 状态 | 核心模块 |
|------|------|---------|
| 多容器隔离（Cookie/Session/缓存） | 已完成 | `container-manager.js` |
| 容器 CRUD | 已完成 | `container-manager.js` |
| 标签页管理与回收 | 已完成 | `tab-manager.js` |
| URL 分配规则 | 已完成 | `assignment-rules.js` |
| 浏览历史（SQLite） | 已完成 | `history-manager.js` |
| 书签/收藏（SQLite） | 已完成 | `favorites-manager.js` |
| 常用站点 | 已完成 | `frequent-sites-manager.js` |
| 自定义快捷键 | 已完成 | `shortcut-manager.js` |
| 内部页面服务（realm:// 协议） | 已完成 | `main.js` |
| Cookie 导入导出 | 已完成 | `cookie-manager.js` |
| **AI Agent 集成** | **未实现** | 仅在 package.json 和文档中提及 |

### 2.2 技术架构特征

```
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │container-mgr │ │  tab-mgr     │ │ history-mgr  │    │
│  │cookie-mgr    │ │ window-mgr   │ │ favorites-mgr│    │
│  │assignment-rules│ │shortcut-mgr │ │frequent-sites│    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│           │                    │                        │
│           ▼                    ▼                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              ipc-handlers.js                     │   │
│  │  (集中式 IPC 注册，输入校验，发送方信任验证)        │   │
│  └─────────────────────────────────────────────────┘   │
│           │                    │                        │
│           ▼                    ▼                        │
│  ┌────────────────┐  ┌────────────────────────────┐   │
│  │  main.js       │  │  本地 HTTP 服务器             │   │
│  │  (应用生命周期)  │  │  (realm:// 页面 + REST API) │   │
│  └────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         │ IPC (contextBridge)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  renderer.js (2495 行)                           │   │
│  │  - 标签页 UI 管理                                 │   │
│  │  - 容器切换                                       │   │
│  │  - Webview 管理                                   │   │
│  │  - 书签/规则/快捷键 UI                            │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  preload.js (433 行)                             │   │
│  │  - window.realmAPI (所有 IPC 桥接)               │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.3 关键技术约束

- **Electron 32.x**：主进程 Node.js 运行时
- **进程隔离**：`contextIsolation: true`，`nodeIntegration: false`
- **IPC 通信**：所有功能通过 `ipcMain.handle` / `ipcRenderer.invoke` 桥接
- **数据持久化**：`electron-store`（配置）+ `better-sqlite3`（历史/书签）
- **单窗口多 Tab**：所有容器在同一窗口内以 Tab 形式运行
- **无前端框架**：原生 JavaScript + DOM 操作

---

## 3. 能力边界：能做到的

### 3.1 对话式 AI 助手

**可行性：完全可行**

利用 `pi-agent-core` 的 `Agent` 类，在主进程中运行 agent 实例，通过 IPC 把事件流推给渲染进程：

```
渲染进程 (AI Chat UI)
    ↕ IPC: ai:prompt / ai:event
主进程 (AI Manager)
    ↕ pi-agent-core Agent
pi-ai (LLM Provider)
```

**支持的能力：**
- 多轮对话，上下文保持（`AgentState.messages` 天然支持）
- 流式输出（`agent.subscribe` 的 `message_update` 事件逐字推送到 UI）
- 跨模型切换（同一上下文可在 GPT-4o → Claude → Gemini 间无缝切换）
- Thinking 模式（`thinkingLevel` 支持 minimal/low/medium/high/max）

### 3.2 工具调用封装 Realm 功能

**可行性：完全可行**

`pi-agent-core` 的 `AgentTool` 接口可以直接封装 Realm 已有功能模块：

| 工具名 | 封装能力 | 对应模块 | 工具参数示例 |
|--------|---------|---------|-------------|
| `navigate` | URL 导航、打开新标签 | `tab-manager.js` | `{ url, containerId?, newTab? }` |
| `search_history` | 搜索浏览历史 | `history-manager.js` | `{ query, containerId?, limit? }` |
| `manage_favorites` | 增删查改书签 | `favorites-manager.js` | `{ action, url?, title?, id? }` |
| `switch_container` | 切换容器 | `container-manager.js` | `{ containerId }` |
| `create_container` | 创建隔离容器 | `container-manager.js` | `{ name, color, icon }` |
| `manage_rules` | 管理 URL 分配规则 | `assignment-rules.js` | `{ action, pattern?, containerId? }` |
| `manage_cookies` | Cookie 导入导出 | `cookie-manager.js` | `{ action, containerId }` |
| `get_page_content` | 获取当前页面内容 | webview `executeJavaScript` | `{ selector?, maxLength? }` |
| `screenshot` | 页面截图 | webview `capturePage` | `{ quality? }` |
| `get_tabs` | 获取标签页列表 | `tab-manager.js` | `{ containerId? }` |
| `close_tab` | 关闭标签页 | `tab-manager.js` | `{ tabId }` |

**用户可以发出的自然语言指令示例：**
- "帮我把所有 GitHub 相关的页面都归到 work 容器" → AI 调用 `manage_rules`
- "我昨天看过一个关于 React 的文章，帮我找一下" → AI 调用 `search_history`
- "把这个页面收藏到技术分类" → AI 调用 `manage_favorites`
- "帮我创建一个专门用来购物的容器" → AI 调用 `create_container`
- "把当前页面截图发给我" → AI 调用 `screenshot`

### 3.3 智能 URL 路由

**可行性：完全可行**

结合 `assignment-rules.js` 和 AI 的语义理解能力：
- 用户访问新 URL 时，AI 自动判断应放入哪个容器
- 基于页面内容语义（而非仅 URL 模式）做分类
- 自动学习用户的容器使用习惯，建议新规则

### 3.4 上下文感知的浏览辅助

**可行性：部分可行（取决于模型能力）**

利用 `pi-ai` 的多模态能力（如果模型支持）：
- 页面内容摘要（通过 `get_page_content` 工具获取文本后送 LLM）
- 翻译当前页面
- 基于当前浏览上下文的问答
- 页面内容分析和对比

### 3.5 自动化工作流

**可行性：完全可行**

利用 `beforeToolCall` / `afterToolCall` 生命周期钩子：
- 定时检查特定网站更新
- 自动登录特定容器的网站
- 批量操作（如批量收藏、批量清理历史）
- 基于规则的自动容器分配

### 3.6 本地模型支持

**可行性：完全可行**

`pi-ai` 原生支持 Ollama 等本地模型：
- 通过 `createProvider()` 自定义 Ollama 提供商
- 浏览数据完全本地化，不发送到外部 API
- 适合对隐私敏感的用户

---

## 4. 能力边界：做不到的 / 技术限制

### 4.1 Node.js 版本要求（关键阻断点）

`pi-agent-core` 的 `package.json` 明确要求 **Node.js >= 22.19.0**。

Electron 32.x 内置的 Node.js 版本可能不满足此要求。**必须首先验证**：

```bash
# 检查 Electron 内置 Node 版本
npx electron -e "console.log(process.versions.node)"
```

**可能的解决方案：**
1. 升级 Electron 到内置 Node >= 22.19.0 的版本
2. 在独立子进程中运行 Agent（使用系统 Node.js），通过 IPC 与主进程通信
3. 使用 `pi-ai` 直接调用 LLM API（绕过 pi-agent-core 的版本限制），自行实现 Agent 循环

### 4.2 安全架构约束

| 约束 | 原因 | 解决方案 |
|------|------|---------|
| API Key 不能暴露到渲染进程 | `contextIsolation: true` + `nodeIntegration: false` | Agent 运行在主进程，Key 存储在 electron-store |
| 主进程阻塞风险 | Agent 循环可能占用 CPU | 使用 Worker Thread 或将 Agent 放到子进程 |
| 网络请求权限 | Electron 的网络策略 | 主进程无此限制，可直接调用 LLM API |
| IPC 传输开销 | 大量流式事件通过 IPC 传输 | 批量合并事件，减少 IPC 调用频率 |

### 4.3 上下文大小限制

浏览器场景的上下文可能很大（页面 DOM 内容、完整历史记录等），但 LLM 有 token 限制：
- 需要实现 `transformContext` 做上下文裁剪
- 页面内容需要先摘要/截断再送给 LLM
- 长对话需要自动压缩历史消息

### 4.4 实时页面交互的延迟

AI 无法直接操作 webview 内部 DOM。每次页面操作需要经过完整链路：

```
AI Agent → Tool execute() → IPC → webview.executeJavaScript() → 结果返回 → IPC → Tool result
```

这个链路有明显延迟（每次 50-200ms），**不适合**：
- 实时表单自动填写（需要毫秒级响应）
- 页面元素实时高亮/标注
- 实时滚动控制

**适合**的场景是"指令式"操作：用户发出指令 → AI 执行 → 返回结果。

### 4.5 UI 需要自行实现

`pi-tui` 是终端 UI 库，对 Electron 渲染进程无用。需要在 `renderer.js` 中自行实现：
- AI 聊天面板（消息列表、输入框、流式显示）
- 工具执行状态展示
- 设置面板（API Key 配置、模型选择）
- 快捷键唤起/隐藏

### 4.6 多 Agent 协调

当前 `pi-agent-core` 是单 Agent 模式。如果需要多 Agent 协调（如一个 Agent 管理浏览，另一个管理数据分析），需要自行实现协调逻辑。

---

## 5. 推荐集成架构

### 5.1 模块设计

```
┌─────────────────────────────────────────────────────────┐
│                      Main Process                       │
│                                                         │
│  ┌───────────────┐    ┌────────────────────────────┐   │
│  │  AI Manager    │    │    Existing Managers        │   │
│  │  (ai-manager.js)│   │ container-mgr / tab-mgr    │   │
│  │               │←──→│ cookie-mgr / history-mgr    │   │
│  │  - Agent 实例  │    │ favorites-mgr / rules       │   │
│  │  - pi-ai Models│    │ shortcut-mgr / frequent     │   │
│  │  - Tool 注册表 │    └────────────────────────────┘   │
│  │  - API Key 管理│                                     │
│  └───────┬───────┘                                     │
│          │ IPC: ai:prompt, ai:event, ai:abort           │
│          │      ai:configure, ai:get-models             │
└──────────┼──────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           AI Chat Panel (新 UI 组件)              │   │
│  │                                                   │   │
│  │  ┌─────────────────────────────────────────────┐│   │
│  │  │  聊天消息列表（流式渲染）                      ││   │
│  │  │  - 用户消息                                   ││   │
│  │  │  - AI 回复（逐字流式显示）                     ││   │
│  │  │  - 工具执行状态（折叠展示）                    ││   │
│  │  └─────────────────────────────────────────────┘│   │
│  │  ┌─────────────────────────────────────────────┐│   │
│  │  │  输入框 + 发送按钮 + 模型切换                  ││   │
│  │  └─────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 5.2 AI Manager 核心模块设计

**文件**: `ai-manager.js`（主进程新模块）

```javascript
/**
 * AI Manager - 管理 Pi Agent 实例和 LLM 连接
 *
 * 职责：
 * - 初始化 pi-ai Models 集合
 * - 创建和管理 Agent 实例
 * - 注册 Realm 工具到 Agent
 * - 通过 IPC 广播 Agent 事件到渲染进程
 * - 管理 API Key 配置
 */

// 伪代码结构
class AIManager {
  constructor() {
    this.models = null;      // pi-ai Models 实例
    this.agent = null;       // pi-agent-core Agent 实例
    this.tools = [];         // Realm 工具列表
  }

  async init() {
    // 1. 初始化 pi-ai Models
    this.models = builtinModels({ /* auth config */ });

    // 2. 注册 Realm 工具
    this.tools = this._buildRealmTools();

    // 3. 创建 Agent 实例
    this.agent = new Agent({
      initialState: {
        systemPrompt: REALM_SYSTEM_PROMPT,
        model: this.models.getModel('openai', 'gpt-4o-mini'),
        tools: this.tools,
      },
      streamFn: this.models.streamSimple.bind(this.models),
      convertToLlm: (msgs) => msgs.filter(m =>
        ['user', 'assistant', 'toolResult'].includes(m.role)),
      transformContext: this._compactContext,
    });

    // 4. 订阅事件并转发到渲染进程
    this.agent.subscribe(async (event) => {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('ai:event', event);
      });
    });
  }

  _buildRealmTools() {
    return [
      this._createNavigateTool(),
      this._createSearchHistoryTool(),
      this._createManageFavoritesTool(),
      this._createSwitchContainerTool(),
      this._createCreateContainerTool(),
      this._createManageRulesTool(),
      this._createManageCookiesTool(),
      this._createGetPageContentTool(),
      this._createScreenshotTool(),
    ];
  }

  async prompt(message) {
    await this.agent.prompt(message);
  }

  abort() {
    this.agent.abort();
  }
}
```

### 5.3 Preload.js 新增 API

```javascript
// 新增到 window.realmAPI
ai: {
  // 发送消息给 AI
  prompt: (message) => ipcRenderer.invoke('ai:prompt', message),

  // 取消当前操作
  abort: () => ipcRenderer.invoke('ai:abort'),

  // 监听 Agent 事件
  onEvent: (callback) => {
    ipcRenderer.on('ai:event', (_, event) => callback(event));
    return () => ipcRenderer.removeAllListeners('ai:event');
  },

  // 配置 API Key
  configureProviders: (config) => ipcRenderer.invoke('ai:configure', config),

  // 获取可用模型列表
  getAvailableModels: () => ipcRenderer.invoke('ai:get-models'),

  // 获取当前 Agent 状态
  getState: () => ipcRenderer.invoke('ai:get-state'),
}
```

### 5.4 IPC 通道清单

| 通道 | 方向 | 说明 |
|------|------|------|
| `ai:prompt` | renderer → main | 发送用户消息 |
| `ai:abort` | renderer → main | 取消当前操作 |
| `ai:configure` | renderer → main | 配置 API Key 和提供商 |
| `ai:get-models` | renderer → main | 获取可用模型列表 |
| `ai:get-state` | renderer → main | 获取 Agent 状态 |
| `ai:event` | main → renderer | 广播 Agent 事件（流式） |

---

## 6. 实施路线图

### Phase 1：基础验证（1-2 天）

1. **验证 Node.js 版本兼容性**
   - 检查 Electron 32 内置 Node 版本
   - 测试 pi-ai 和 pi-agent-core 能否在 Electron 主进程正常加载
   - 如不兼容，评估升级 Electron 或使用子进程方案

2. **最小可行 Demo**
   - 安装 `@earendil-works/pi-ai` 和 `@earendil-works/pi-agent-core`
   - 在 main.js 中创建一个 Agent 实例
   - 实现一个简单工具（如 `get_tabs`）
   - 通过 IPC 把 AI 回复打印到渲染进程控制台

### Phase 2：核心功能（3-5 天）

3. **创建 ai-manager.js 模块**
   - 封装 Agent 初始化、工具注册、事件广播
   - 实现 API Key 配置管理（electron-store）

4. **注册 Realm 工具**
   - 封装 tab/container/history/favorites/rules 等现有功能为 AgentTool
   - 实现工具执行的安全校验

5. **IPC 通道打通**
   - 在 ipc-handlers.js 中注册 AI 相关通道
   - 在 preload.js 中暴露 AI API

### Phase 3：UI 集成（3-5 天）

6. **AI 聊天面板**
   - 在 renderer.js 中实现聊天 UI
   - 流式消息渲染
   - 工具执行状态展示

7. **快捷键集成**
   - 通过 shortcut-manager 注册 AI 面板唤起快捷键
   - 支持选中文本直接发送给 AI

### Phase 4：高级功能（持续迭代）

8. **上下文感知**
   - 实现页面内容提取工具
   - 实现上下文自动裁剪

9. **智能路由**
   - 基于 AI 的自动容器分配
   - 学习用户习惯

10. **本地模型支持**
    - 集成 Ollama
    - 隐私模式配置

---

## 7. 总结评估

| 维度 | 可行性 | 说明 |
|------|--------|------|
| 对话式 AI 助手 | **完全可行** | pi-agent-core 原生支持 |
| 工具调用封装 Realm 功能 | **完全可行** | AgentTool 可直接调用现有 manager |
| 流式输出到 UI | **完全可行** | Agent 事件系统 + IPC |
| 多模型切换 | **完全可行** | pi-ai 支持 30+ 提供商 |
| 页面内容理解 | **部分可行** | 需 webview 注入 JS 提取内容，有延迟 |
| 自动化工作流 | **完全可行** | 工具 + 生命周期钩子 |
| 实时 DOM 操作 | **受限** | IPC 链路延迟，不适合高频操作 |
| 隐私浏览数据本地化 | **完全可行** | 选择 Ollama 本地模型 |
| 多 Agent 协调 | **需自行实现** | pi-agent-core 是单 Agent 模式 |

**核心风险**：Node.js >= 22.19.0 的版本要求与 Electron 32 的兼容性。建议在 Phase 1 首先验证这一点，再决定是否推进后续阶段。

---

## 参考资料

- Pi GitHub 仓库：https://github.com/earendil-works/pi
- pi-ai 包：`@earendil-works/pi-ai`
- pi-agent-core 包：`@earendil-works/pi-agent-core`
- pi 官方网站：pi.dev
