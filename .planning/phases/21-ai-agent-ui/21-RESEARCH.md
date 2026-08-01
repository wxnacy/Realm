# Phase 21: AI Agent 集成 - 聊天 UI - Research

**Researched:** 2026-08-01
**Domain:** Electron 原生 JS 聊天 UI、Markdown 流式渲染、代码高亮
**Confidence:** HIGH

## Summary

Phase 21 需要在 Realm Browser 右侧实现 AI 聊天面板，包括消息气泡、流式渲染、工具执行卡片、面板交互（快捷键/拖拽调整宽度/智能滚动）。项目使用 Electron 32 + 原生 JavaScript（无 React/Vue），所有 UI 通过 DOM 操作实现。

Phase 20 已完成 AI Manager 核心功能（pi-agent-core Agent 实例、工具注册、事件广播），preload.js 已暴露完整的 AI API（prompt/abort/onEventsBatch/configureProviders/getAvailableModels/getState）。Phase 21 专注于渲染进程的 UI 实现。

关键发现：项目当前没有 Markdown 渲染和代码高亮库，需要引入两个轻量级 npm 包。推荐 marked（Markdown 渲染）+ highlight.js（代码语法高亮），它们在 Electron 环境中久经验证、包体小、无外部依赖。

**Primary recommendation:** 使用 marked + highlight.js 实现消息渲染，在 renderer.js 中以原生 DOM 操作构建完整聊天 UI。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: 右侧侧边栏形态，不遮挡网页内容（网页区域自动缩小）
- D-06: 气泡对话样式 — 用户消息靠右（深色气泡），AI 消息靠左（浅色气泡）
- D-07: 完整 Markdown 渲染 + 代码语法高亮（需要引入 markdown 渲染库）
- D-08: 逐字流式显示（光标闪烁指示正在生成），基于 Phase 20 的 ai:events-batch 事件
- D-10: 可折叠卡片形态展示工具执行状态
- D-14: Cmd/Ctrl + ] 唤起/隐藏 AI 面板（需在 shortcut-manager.js 注册）
- D-16: 智能自动滚动

### Claude's Discretion
- Markdown 渲染库的选择（如 marked、markdown-it 等）
- 代码高亮库的选择（如 highlight.js、Prism 等）
- 消息气泡的具体 CSS 样式和动画效果
- 工具卡片的展开/折叠动画
- 输入框自动扩展的具体实现方式
- 面板打开/关闭的过渡动画

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-03 | AI 聊天面板 UI — 包括消息列表、输入框、流式渲染、工具执行状态、面板交互 | 本研究文档直接覆盖所有 AI-03 子项 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| marked | ^15.x | Markdown → HTML 转换 | 轻量（~45KB min）、零依赖、支持流式解析（Lexer 分步）、久经 Electron 验证 |
| highlight.js | ^11.x | 代码语法高亮 | 190+ 语言支持、零配置 autoDetect、可通过 CDN 或 npm 引入、被 VS Code 等编辑器级产品验证 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | ^8.1.0 | 持久化面板宽度和开关状态 | 已在项目中，Phase 21 复用 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| marked | markdown-it | markdown-it 功能更丰富（插件架构、attrs 等），但包体更大（~120KB）、初始化更慢；对于聊天消息的简单 Markdown 子集（加粗、列表、代码块、链接），marked 更轻量高效 |
| highlight.js | Prism | Prism 体积更小（~30KB），但需要手动引入语言包；highlight.js 的 autoDetect 更方便，适合 AI 生成的任意代码语言 |

**Installation:**
```bash
npm install marked highlight.js
```

**Version verification:** [ASSUMED] — 基于训练知识推荐，未在本次研究中执行 npm view 验证。Planner 应在安装前确认最新版本。

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| marked | npm | ~12 年 | 极高（GitHub 32k+ stars） | github.com/markedjs/marked | OK | Approved |
| highlight.js | npm | ~14 年 | 极高（GitHub 24k+ stars） | github.com/highlightjs/highlight.js | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AI 面板 HTML 结构 | Browser / Renderer | — | 面板是纯 UI 组件，在渲染进程 DOM 中 |
| 消息渲染（Markdown + 代码高亮） | Browser / Renderer | — | 纯客户端渲染，不涉及后端 |
| 流式消息处理 | Browser / Renderer | Main (IPC) | 渲染进程接收事件并更新 DOM；主进程通过 ai:events-batch 推送 |
| 面板状态持久化 | Main (electron-store) | — | electron-store 在主进程运行 |
| 快捷键注册 | Main (shortcut-manager) | Browser (keydown) | Cmd+] 由 shortcut-manager 统一管理 |
| 拖拽调整宽度 | Browser / Renderer | — | 纯 DOM 事件（mousedown/mousemove/mouseup） |

## Architecture Patterns

### 现有集成点

Phase 21 与现有代码的集成点已明确：

1. **shortcut-manager.js** — `DEFAULT_SHORTCUTS` 添加 `'toggleAIPanel': 'CmdOrCtrl+]'`（唯一修改点）
2. **src/renderer.js** — `initShortcuts()` 添加 `case 'toggleAIPanel'` 分支；`setupEventListeners()` 添加 AI 面板事件监听
3. **src/index.html** — `<body>` 末尾添加 `#aiPanel` 容器和 `#aiPanelBtn` 工具栏按钮
4. **src/styles/main.css** — 新增约 200 行 AI 面板样式
5. **src/preload.js** — 无需修改（AI API 已在 Phase 20 注册完成）

### 推荐项目结构

```
src/
├── renderer.js          # 添加 AI 面板逻辑（~300-400 行新增）
├── index.html           # 添加 AI 面板 HTML 结构
├── styles/
│   └── main.css         # 添加 AI 面板样式
└── (无新文件 — 遵循项目单文件渲染架构)
```

**说明：** 项目使用单文件渲染架构（renderer.js），不拆分模块。AI 面板的所有逻辑（消息渲染、流式处理、工具卡片、面板交互）统一在 renderer.js 中，通过 `// ==================== AI 助手 ====================` 注释区域分隔。

### Pattern 1: 面板布局（CSS Flexbox 联动）

**What:** 右侧侧边栏，打开时主内容区自动缩小
**When to use:** 面板开关时
**Example:**
```css
/* body 改为 flex 布局 */
body {
  display: flex;
}
.main-content {
  flex: 1;
  min-width: 0; /* 防止 flex 子项溢出 */
}
#aiPanel {
  width: var(--ai-panel-width, 360px);
  flex-shrink: 0;
}
#aiPanel.hidden {
  width: 0;
  overflow: hidden;
}
```

### Pattern 2: 流式 Markdown 渲染

**What:** 逐字接收 AI 响应，实时渲染为 HTML
**When to use:** 处理 `ai:events-batch` 中的 `message_update` 事件
**Example:**
```javascript
/**
 * 处理流式消息更新
 * 每次收到 message_update 事件时，重新渲染当前 AI 消息的 Markdown
 * 使用 marked.parse() 增量处理累积的文本内容
 */
function handleStreamUpdate(messageId, fullText) {
  const messageEl = document.getElementById(`msg-${messageId}`);
  if (!messageEl) return;

  // 使用 marked 将累积文本转为 HTML
  const html = marked.parse(fullText);
  messageEl.querySelector('.message-content').innerHTML = html;

  // 对新渲染的代码块应用语法高亮
  messageEl.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });
}
```

### Pattern 3: 智能自动滚动

**What:** 新消息自动滚到底部，用户上滚后暂停，显示"回到底部"按钮
**When to use:** 消息列表更新时
**Example:**
```javascript
/**
 * 智能滚动控制
 * 用户上滚超过 100px 时暂停自动滚动，显示"回到底部"按钮
 */
const scrollState = { autoScroll: true, userScrolled: false };

function onMessageListScroll() {
  const el = elements.aiMessageList;
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  scrollState.userScrolled = distanceFromBottom > 100;
  scrollState.autoScroll = !scrollState.userScrolled;
  updateScrollToBottomButton();
}

function scrollToBottom() {
  elements.aiMessageList.scrollTo({
    top: elements.aiMessageList.scrollHeight,
    behavior: 'smooth'
  });
  scrollState.autoScroll = true;
  scrollState.userScrolled = false;
}
```

### Anti-Patterns to Avoid

- **不要在流式更新时使用 innerHTML += 拼接：** 每次都重新 parse 完整累积文本并设置 innerHTML，而非追加。标记库的 parse 速度足够快（<1ms 对于典型响应长度），但频繁的 DOM 操作会导致布局抖动。
- **不要为每个流式 token 单独创建 DOM 节点：** 使用整段 HTML 替换而非逐字追加文本节点。后者会导致大量小 DOM 操作和高亮失效。
- **不要在渲染进程创建独立的 marked/Highlight.js 实例：** 单例配置一次即可。重复创建浪费内存。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown → HTML | 自定义正则解析器 | marked | 正则无法处理嵌套列表、代码块内转义等边界情况 |
| 代码语法高亮 | 基于正则的着色器 | highlight.js | 190+ 语言的语法定义需要持续维护 |
| 滚动容器内的拖拽 | 手动计算位置 | CSS resize 或 mousedown 事件 + clamped 宽度 | 浏览器原生事件处理更可靠 |

## Common Pitfalls

### Pitfall 1: 流式 Markdown 渲染时代码高亮不生效
**What goes wrong:** 在流式输出过程中，marked 每次重新 parse 整段文本并替换 innerHTML，但新插入的 `<pre><code>` 元素没有被 highlight.js 处理
**Why it happens:** hljs.highlightElement() 只对传入的元素生效，innerHTML 替换后新元素不在 DOM 树中或未被选中
**How to avoid:** 在 innerHTML 赋值后，立即 querySelectorAll 新的 `pre code` 元素并逐一调用 `hljs.highlightElement()`
**Warning signs:** 代码块显示为纯文本，无语法着色

### Pitfall 2: 面板打开时 webview 内容闪烁
**What goes wrong:** 打开 AI 面板时，主内容区宽度突然变化导致 webview 重新布局
**Why it happens:** webview 的 BrowserView 或 webContents 在尺寸变化时会触发 reflow
**How to avoid:** 使用 CSS transition 平滑过渡宽度变化（250ms ease-in-out），而非瞬间切换。flex 布局会自动处理子元素尺寸
**Warning signs:** 打开面板瞬间页面内容跳动

### Pitfall 3: 工具执行卡片展开时内容溢出
**What goes wrong:** 工具执行结果（JSON）内容很长时，展开动画的 max-height 过渡无法确定目标高度
**Why it happens:** max-height: 0 → max-height: 1000px 的过渡在内容只有 200px 时，动画速度会异常
**How to avoid:** 展开时先设置 `max-height: none` 让浏览器计算实际高度，然后用 `scrollHeight` 作为目标值；或直接使用 `height` 过渡
**Warning signs:** 短内容展开动画过慢，长内容展开动画过快

## Code Examples

### 流式 Markdown 渲染完整流程
```javascript
// Source: 基于 pi-agent-core Agent.subscribe 事件模型
// ai:events-batch 事件格式来自 ai-manager.js _setupEventBroadcasting()

/**
 * 注册 AI 事件监听器
 * 处理来自 ai-manager.js 的批量事件
 */
function initAIEventListener() {
  window.realmAPI.ai.onEventsBatch((events) => {
    for (const event of events) {
      switch (event.type) {
        case 'message_update':
          // message_update 包含完整的消息文本（累积式）
          handleStreamUpdate(event.messageId, event.text);
          break;
        case 'tool_execution_update':
          handleToolExecutionUpdate(event);
          break;
        case 'turn_end':
          handleTurnEnd(event);
          break;
        case 'error':
          handleAIError(event.error);
          break;
      }
    }
  });
}
```

### 面板拖拽调整宽度
```javascript
/**
 * 初始化面板拖拽调整宽度
 * 左侧边缘 6px 区域为拖拽手柄
 */
function initPanelResize() {
  const handle = document.getElementById('aiPanelResizeHandle');
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = elements.aiPanel.offsetWidth;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const diff = startX - e.clientX; // 向左拖拽增大宽度
    const newWidth = Math.max(280, Math.min(600, startWidth + diff));
    elements.aiPanel.style.width = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    // 持久化宽度
    window.realmAPI.setSetting('ai.panelWidth', elements.aiPanel.offsetWidth);
  });
}
```

### 输入框自动扩展
```javascript
/**
 * 输入框自动扩展高度
 * 根据内容行数自动调整，最小 40px，最大 120px
 */
function initAutoExpandInput(textarea) {
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto'; // 重置以获取 scrollHeight
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(120, Math.max(40, scrollHeight))}px`;
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 无 AI 集成 | pi-agent-core Agent + 事件广播 | Phase 19-20 | AI Manager 已就绪，Phase 21 只做 UI |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | marked ^15.x 是最新稳定版 | Standard Stack | 可能需要调整版本号 |
| A2 | highlight.js ^11.x 是最新稳定版 | Standard Stack | 可能需要调整版本号 |
| A3 | marked.parse() 在 Electron 渲染进程中正常工作（无 Node.js API 依赖） | Architecture | 需确认 marked 纯浏览器兼容 |
| A4 | ai:events-batch 事件中 message_update 包含完整累积文本（非增量 delta） | Code Examples | 如为增量 delta，需要在渲染进程维护累积缓冲区 |

**A4 关键说明：** ✅ RESOLVED — 通过阅读 `node_modules/@earendil-works/pi-agent-core/dist/types.d.ts` 确认：`message_update` 事件包含完整 `message: AgentMessage` 对象（累积式全文，非增量 delta）。渲染进程无需维护累积缓冲区，直接用 `event.message` 替换当前消息即可。

## Open Questions

1. ✅ RESOLVED — **pi-agent-core message_update 事件格式**
   - What we know: ai-manager.js 将 Agent 事件原样转发到渲染进程
   - **RESOLVED (2026-08-01):** 通过 pi-agent-core types.d.ts 确认事件格式为 `{ type: "message_update", message: AgentMessage, assistantMessageEvent: AssistantMessageEvent }`。`message` 是完整消息对象（累积全文），`assistantMessageEvent` 包含流式文本事件。渲染进程直接用 `event.message` 替换消息列表中对应项即可，无需累积缓冲区。

2. ✅ RESOLVED — **tool_execution_update 事件的完整 payload**
   - What we know: 事件包含工具名和执行状态
   - **RESOLVED (2026-08-01):** 通过 pi-agent-core types.d.ts 确认完整事件类型：
     - `tool_execution_start`: `{ type, toolCallId: string, toolName: string, args: any }`
     - `tool_execution_update`: `{ type, toolCallId: string, toolName: string, args: any, partialResult: any }`
     - `tool_execution_end`: `{ type, toolCallId: string, toolName: string, result: any, isError: boolean }`
     - 渲染进程通过 `toolCallId` 关联同一工具调用的生命周期事件。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Electron 主进程 | ✓ | 20.18.x (Electron 32 内置) | — |
| npm | 包安装 | ✓ | — | — |
| Electron | 运行时 | ✓ | ^32.0.0 | — |
| marked | Markdown 渲染 | 待安装 | — | 无（必须安装） |
| highlight.js | 代码高亮 | 待安装 | — | 无（必须安装） |

**Missing dependencies with no fallback:**
- marked — Markdown 渲染核心依赖，无替代方案（D-07 锁定需要 Markdown 渲染）
- highlight.js — 代码高亮核心依赖，无替代方案（D-07 锁定需要代码高亮）

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | 无（项目当前没有配置测试） |
| Config file | none |
| Quick run command | `npm test` (未配置) |
| Full suite command | `npm test` (未配置) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-03 | 面板打开/关闭 | manual-only | — | — |
| AI-03 | 消息发送和流式渲染 | manual-only | — | — |
| AI-03 | 工具卡片展示 | manual-only | — | — |
| AI-03 | 快捷键 Cmd+] | manual-only | — | — |
| AI-03 | 拖拽调整宽度 | manual-only | — | — |

**说明：** 项目当前无测试框架，Phase 21 的 UI 交互功能主要通过手动验证（UAT）确认。

### Wave 0 Gaps
- 无测试框架（项目历史决定，非 Phase 21 范围）

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | AI API Key 管理已在 Phase 20 完成 |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | 用户输入消息需转义后渲染，防止 XSS。marked 默认对 HTML 进行转义（sanitize 已在 marked v12+ 中默认启用） |
| V6 Cryptography | no | — |

### Known Threat Patterns for Electron + DOM

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 通过 AI 响应注入 HTML/JS | Tampering / Elevation | marked 默认转义 HTML 标签；highlight.js 输出经 DOMPurify 或等效处理 |
| 通过工具执行结果注入 | Tampering | 工具结果 JSON 在渲染前需转义为文本 |

**注意：** marked v12+ 已弃用 `sanitize` 选项，改为使用 `marked.parse()` 的默认行为（输出已转义的 HTML）。对于聊天 UI，建议在 marked 配置中确保 `gfm: true, breaks: true`，输出的 HTML 通过 DOM 操作设置（innerHTML），无需额外的 DOMPurify（因为 marked 不会执行任意 HTML）。但工具执行结果中的 JSON 应使用 `textContent` 设置而非 `innerHTML`。

## Sources

### Primary (HIGH confidence)
- 项目源码（ai-manager.js, src/preload.js, src/renderer.js, src/index.html, shortcut-manager.js） — 直接读取分析
- CONTEXT.md — 用户锁定的设计决策
- UI-SPEC.md — 完整的视觉和交互合约

### Secondary (MEDIUM confidence)
- docs/plan/pi-agent-integration.md — Phase 3 聊天 UI 设计意图
- package.json — 依赖版本确认

### Tertiary (LOW confidence)
- marked 和 highlight.js 版本信息 — 基于训练知识 [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 项目代码已完整阅读，集成点清晰
- Architecture: HIGH — 现有架构模式明确，新增代码遵循已建立的模式
- Pitfalls: MEDIUM — 流式 Markdown 渲染的细节依赖于 pi-agent-core 事件格式确认

**Research date:** 2026-08-01
**Valid until:** 2026-08-31（30 天 — 项目技术栈稳定，Electron 32 短期内不会大版本升级）
