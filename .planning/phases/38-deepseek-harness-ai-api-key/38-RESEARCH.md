# Phase 38: AI 助手供应商管理增强 - Research

**Researched:** 2026-08-21
**Domain:** Electron 应用 AI 提供商管理、pi-ai SDK 集成、UI 组件设计
**Confidence:** HIGH

## Summary

本阶段将 Realm Browser 的 AI 助手从"单提供商配置"升级为"多供应商增删改"系统。核心改造涉及三个层面：

1. **设置页供应商管理**：将现有 AI 助手配置区域重构为左右分栏布局，支持内置供应商（pi-ai 38 个提供商目录）和自定义 OpenAI 兼容端点的 CRUD 操作。
2. **API Key 环境变量优先**：利用 pi-ai SDK 内置的 `env-api-keys.js` 模块（已包含完整的提供商→环境变量映射），实现环境变量自动检测+手动输入兜底。
3. **聊天面板底部工具栏**：在 AI 面板底部增加模型选择器（跨供应商分组）、发送按钮和新对话按钮。

**主要发现：** pi-ai SDK (`@earendil-works/pi-ai`) 已内置完整的提供商→环境变量映射（`env-api-keys.js`），包括 OpenAI、DeepSeek、Anthropic、Google、Groq 等 30+ 提供商的约定环境变量名。Realm 可以直接复用这个映射表，无需自行维护。该模块虽未在 package.json exports 中声明，但可以通过 `import('@earendil-works/pi-ai')` 访问或直接在 Realm 本地维护一份相同的映射表。

**主要建议：** 复用 ai-manager.js 现有的 `_getCatalog()` 方法和 `configureProviders()` API，扩展为支持多供应商并行配置。设置页 UI 在 settings.html/settings-page.js 中改造，聊天面板工具栏在 renderer.js/index.html 中改造。

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 左右分栏布局：左侧供应商列表+搜索框，右侧编辑表单（提供商名/Key/模型/环境变量）
- **D-02:** 两个入口按钮："添加内置供应商"（从 pi-ai 内置 38 个提供商目录选择）和"添加自定义供应商"（自定义 baseURL + API Key + 协议）
- **D-03:** 右侧编辑表单有"检测模型"按钮，调用提供商 API 获取可用模型列表，失败时提示错误
- **D-04:** 用户可手动删除检测到的不需要的模型
- **D-05:** 删除供应商 = 彻底清除（硬删除），相关配置（Key、模型列表）全部清除
- **D-06:** 保留当前 OpenAI 默认配置，迁移旧数据（`ai.apiKey` → `ai.providers.openai`）
- **D-07:** 按提供商约定自动检测环境变量名（如 OPENAI_API_KEY、DEEPSEEK_API_KEY、ANTHROPIC_API_KEY 等）
- **D-08:** 用户可自定义环境变量名（覆盖默认约定）
- **D-09:** 检测到环境变量时，输入框下方显示"检测到环境变量 XXX，已自动使用"提示
- **D-10:** 用户可手动输入 API Key 覆盖环境变量值
- **D-11:** 底部工具栏布局：[模型按钮] ---- [发送按钮]，发送按钮从输入区移到工具栏最右侧
- **D-12:** 模型按钮显示当前模型名（如 "gpt-4o"），点击展开下拉框
- **D-13:** 下拉框展示所有已配置供应商的模型列表，按供应商分组显示
- **D-14:** 选择模型即激活对应供应商（更新 `ai.activeProvider` + 切换模型）
- **D-15:** 工具栏左侧加"新对话"按钮，清空聊天历史
- **D-16:** 调用提供商 API 获取可用模型列表（非 pi-ai 内置目录），使用已保存的 API Key 认证
- **D-17:** 检测失败时显示错误信息（网络错误/认证失败/不支持的端点）
- **D-18:** 检测结果中的模型列表可由用户手动增删

### Claude's Discretion

- 供应商列表项的具体样式（图标/状态指示器/激活标记）
- 添加内置供应商时的选择界面（弹窗/下拉/搜索过滤）
- 自定义供应商的表单字段（baseURL、协议选择、模型名手动输入）
- 工具栏的具体 CSS 样式（高度、间距、分割线）
- 模型下拉框的分组样式（提供商名作为分组标题）
- 新对话按钮的确认行为（直接清空还是二次确认）
- 环境变量检测的时机（启动时/打开设置页时/实时）
- 模型按钮的宽度限制（模型名过长时截断策略）

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 供应商 CRUD | API / Backend | — | electron-store 持久化，主进程管理配置 |
| API Key 环境变量检测 | API / Backend | — | 主进程可访问 process.env |
| 模型检测 API 调用 | API / Backend | — | 主进程发起 HTTP 请求，需 API Key |
| 供应商管理 UI | Browser / Client | — | settings-page.js 渲染，在 webview guest 中运行 |
| 聊天面板工具栏 | Browser / Client | — | renderer.js 渲染，在主窗口中运行 |
| 模型选择器下拉 | Browser / Client | — | 纯 UI 交互，本地状态管理 |
| AI Agent 切换 | API / Backend | — | ai-manager.js 管理 Agent 实例和模型绑定 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @earendil-works/pi-ai | ^0.82.1 | LLM 统一 API 层，内置 38 个提供商 | 项目已使用，builtinModels 提供完整提供商目录 |
| @earendil-works/pi-agent-core | ^0.82.1 | AI Agent 框架 | 项目已使用，管理对话和工具执行 |
| electron-store | ^8.1.0 | 配置持久化 | 项目已使用，`ai.providers` 路径存储供应商配置 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fetch (Node.js 内置) | — | 模型检测 API 调用 | 主进程发起 HTTP 请求获取模型列表 |
| DOMPurify | ^3.4.12 | XSS 消毒 | 已在项目中，渲染用户输入的提供商名称 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 直接导入 pi-ai env-api-keys | 本地维护映射表 | 本地维护更稳定，不依赖内部模块路径 |

**Installation:**
```bash
# 无需新增依赖，全部使用项目已有库
```

## Package Legitimacy Audit

> 本阶段不安装新外部依赖，无需审计。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (无新增) | — | — | — | — | — | — |

## Architecture Patterns

### System Architecture Diagram

```
设置页 (settings-page.js)
  │
  ├── 供应商列表 (左侧)
  │   ├── 搜索过滤
  │   ├── 添加内置供应商 → dialog 弹窗 → pi-ai 目录
  │   └── 添加自定义供应商 → 展开表单
  │
  └── 编辑表单 (右侧)
      ├── 提供商名称
      ├── API Key + 环境变量检测
      ├── 模型列表 + 检测模型按钮
      └── 保存/删除按钮
          │
          ▼ HTTP /api/settings/ai/*
          │
主进程 (main.js)
  │
  ├── ai-manager.js
  │   ├── _getCatalog() → builtinModels 目录
  │   ├── configureProviders() → 保存配置 + 重新初始化
  │   └── getAvailableModels() → 返回提供商+模型列表
  │
  └── configStore (electron-store)
      └── ai.providers.{id}.apiKey / .model / .envVarName
          ai.activeProvider
          ai.providers.{id}.customModels (用户自定义模型列表)

聊天面板 (renderer.js)
  │
  ├── 工具栏
  │   ├── 新对话按钮
  │   ├── 模型选择器 → 下拉框（按供应商分组）
  │   └── 发送按钮
  │
  └── 消息列表 + 输入框
```

### Recommended Project Structure

```
src/
├── settings-page.js      # [改造] 供应商管理 UI
├── settings.html         # [改造] 供应商管理 HTML
├── renderer.js           # [改造] 聊天面板工具栏
├── index.html            # [改造] 工具栏 HTML
└── styles/
    └── main.css          # [改造] 新增供应商管理和工具栏样式

ai-manager.js             # [改造] 多供应商支持、环境变量检测
main.js                   # [改造] 新增 HTTP API 端点
ipc-handlers.js           # [改造] 新增 IPC 处理器（如需要）
preload.js                # [改造] 暴露新 API（如需要）
```

### Pattern 1: 供应商配置数据模型

**What:** 扩展 electron-store 的 `ai.providers` 结构，支持多供应商并行配置
**When to use:** 所有供应商配置存储和读取
**Example:**
```javascript
// configStore.get('ai.providers') 结构
{
  openai: {
    apiKey: 'sk-...',
    model: 'gpt-4o',
    envVarName: 'OPENAI_API_KEY',      // 用户可自定义
    customModels: ['gpt-4o', 'gpt-3.5-turbo'],  // 用户手动管理的模型列表
    isBuiltin: true,                    // 是否内置供应商
    baseURL: undefined,                 // 内置供应商使用默认端点
  },
  'my-custom': {
    apiKey: 'sk-...',
    model: 'my-model',
    envVarName: 'MY_CUSTOM_API_KEY',
    customModels: ['my-model'],
    isBuiltin: false,
    baseURL: 'https://api.example.com/v1',
    protocol: 'openai-chat',           // 自定义供应商需指定协议
    displayName: 'My Custom Provider',
  }
}
```

**Source:** [VERIFIED: ai-manager.js:559-566] 现有 `ai.providers` 结构，[VERIFIED: ai-manager.js:1086-1116] configureProviders API

### Pattern 2: 环境变量检测

**What:** 利用 pi-ai SDK 的环境变量映射，自动检测提供商对应的 API Key
**When to use:** 打开供应商编辑表单时，自动检测并提示
**Example:**
```javascript
// 环境变量映射表（基于 pi-ai SDK env-api-keys.js）
const PROVIDER_ENV_MAP = {
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  xai: 'XAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  // ... 完整映射见 pi-ai README
};

// 检测环境变量
function detectEnvVar(providerId) {
  const envName = PROVIDER_ENV_MAP[providerId];
  if (envName && process.env[envName]) {
    return { found: true, name: envName, value: process.env[envName] };
  }
  return { found: false, name: envName || null };
}
```

**Source:** [VERIFIED: node_modules/@earendil-works/pi-ai/dist/env-api-keys.js:70-109] pi-ai SDK 内置映射表

### Pattern 3: 模型检测 API 调用

**What:** 调用提供商的 /models 端点获取可用模型列表
**When to use:** 用户点击"检测模型"按钮时
**Example:**
```javascript
// OpenAI 兼容端点的标准 /models 调用
async function detectModels(baseURL, apiKey) {
  const url = `${baseURL}/models`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data.map(m => ({ id: m.id, name: m.id }));
}
```

**Source:** [ASSUMED] 基于 OpenAI API 标准，各提供商兼容端点遵循相同协议

### Anti-Patterns to Avoid

- **不要在 renderer.js 中维护提供商目录**：提供商目录应从主进程获取（`ai-manager.getAvailableModels()`），渲染进程只做展示
- **不要硬编码环境变量映射**：使用映射表对象，便于扩展新提供商
- **不要在设置页直接调用 pi-ai SDK**：设置页运行在 webview guest 中，通过 HTTP API 与主进程通信

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 提供商目录枚举 | 手动维护提供商列表 | `builtinModels().getProviders()` | pi-ai SDK 内置 38 个提供商，自动更新 |
| 环境变量映射 | 硬编码每个提供商的环境变量名 | 参考 pi-ai env-api-keys.js 映射表 | SDK 维护权威映射，减少维护负担 |
| 模型列表获取 | 手动维护模型列表 | 调用提供商 /models API | 动态获取，支持新模型自动发现 |
| 凭证存储 | 自定义加密存储 | electron-store + pi-ai InMemoryCredentialStore | 项目已有模式，安全可靠 |

## Common Pitfalls

### Pitfall 1: ESM 动态 import 在 Electron 中的兼容性

**What goes wrong:** pi-ai 和 pi-agent-core 是 ESM-only 包，CommonJS 的 require() 无法加载
**Why it happens:** Electron 32 内置 Node.js 20.18.x，低于 pi-agent-core 要求的 22.19.0
**How to avoid:** 使用动态 `import()` 加载 ESM 包（ai-manager.js 已有此模式）
**Warning signs:** `ERR_REQUIRE_ESM` 错误

**Source:** [VERIFIED: ai-manager.js:9-16] 文件头注释明确说明 ESM 兼容性问题

### Pitfall 2: 设置页在 webview guest 中运行

**What goes wrong:** 设置页通过 IPC 调用主进程 API 会被 assertTrustedSender 拒绝
**Why it happens:** webview guest 不在 managedWindowIds 集合中
**How to avoid:** 设置页使用 HTTP API（`/api/settings/*`）而非直接 IPC
**Warning signs:** `IPC 调用方不受信任` 错误

**Source:** [VERIFIED: src/settings-page.js:9-11] 注释明确说明此限制

### Pitfall 3: 自定义供应商的 baseURL 和协议配置

**What goes wrong:** 自定义供应商缺少 baseURL 或协议配置，导致请求失败
**Why it happens:** 内置供应商有默认端点和协议，自定义供应商需要显式配置
**How to avoid:** 添加自定义供应商时强制要求 baseURL 和协议选择
**Warning signs:** `Unknown provider` 或 `Unsupported protocol` 错误

**Source:** [CITED: deepseek-harness config.ts:88-96] 自定义供应商需要完整配置

## Code Examples

### 获取提供商目录（已有模式）

```javascript
// Source: ai-manager.js:680-690
async _getCatalog() {
  if (this.models) return this.models;
  if (!this._catalogPromise) {
    this._catalogPromise = (async () => {
      const { builtinModels } = await import('@earendil-works/pi-ai/providers/all');
      const { InMemoryCredentialStore } = await import('@earendil-works/pi-ai');
      return builtinModels({ credentials: new InMemoryCredentialStore() });
    })();
  }
  return this._catalogPromise;
}
```

### 配置提供商（已有模式）

```javascript
// Source: ai-manager.js:1086-1116
async configureProviders(config) {
  const { provider, apiKey, model } = config;
  // 校验提供商存在
  const catalog = await this._getCatalog();
  const catalogProvider = catalog.getProviders().find(p => p.id === provider);
  if (!catalogProvider) throw new Error(`未知提供商: ${provider}`);
  // 更新 configStore
  const providers = this.configStore.get('ai.providers', {});
  providers[provider] = { apiKey, model: validModel };
  this.configStore.set('ai.providers', providers);
  this.configStore.set('ai.activeProvider', provider);
  // 重新初始化 Agent
  await this.init(this.configStore);
}
```

### HTTP API 端点（已有模式）

```javascript
// Source: main.js:1115-1130
if (route === 'ai/configure' && req.method === 'POST') {
  const config = await readJsonBody(req);
  if (!config || !config.provider || !config.apiKey) {
    sendJson(res, 400, { error: '提供商和 API Key 不能为空' });
    return;
  }
  if (aiManager) {
    await aiManager.configureProviders({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
  }
  sendJson(res, 200, { success: true });
}
```

### 环境变量映射表（参考 pi-ai SDK）

```javascript
// Source: node_modules/@earendil-works/pi-ai/dist/env-api-keys.js:70-109
const PROVIDER_ENV_MAP = {
  'openai': 'OPENAI_API_KEY',
  'azure-openai-responses': 'AZURE_OPENAI_API_KEY',
  'deepseek': 'DEEPSEEK_API_KEY',
  'anthropic': 'ANTHROPIC_API_KEY',
  'google': 'GEMINI_API_KEY',
  'google-vertex': 'GOOGLE_CLOUD_API_KEY',
  'groq': 'GROQ_API_KEY',
  'cerebras': 'CEREBRAS_API_KEY',
  'xai': 'XAI_API_KEY',
  'openrouter': 'OPENROUTER_API_KEY',
  'mistral': 'MISTRAL_API_KEY',
  'fireworks': 'FIREWORKS_API_KEY',
  'together': 'TOGETHER_API_KEY',
  'xiaomi': 'XIAOMI_API_KEY',
  // ... 完整列表见 pi-ai README
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 单 OpenAI 配置 (`ai.apiKey`) | 多提供商配置 (`ai.providers`) | Phase 19-22 | 已完成迁移，本阶段扩展 |
| 设置页单提供商选择 | 设置页多供应商 CRUD | 本阶段 | 需要重构 settings.html |
| 聊天面板无模型切换 | 聊天面板底部工具栏 | 本阶段 | 需要改造 renderer.js |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pi-ai SDK 的 `getProviders()` 返回 38 个内置提供商 | Standard Stack | 提供商数量可能随版本变化 |
| A2 | 各提供商的 /models API 端点遵循 OpenAI 兼容协议 | Pattern 3 | 部分提供商可能使用不同协议 |
| A3 | 环境变量映射表基于 pi-ai SDK 源码，可在 Realm 本地维护 | Pattern 2 | SDK 更新时需同步更新本地映射 |
| A4 | 自定义供应商需要用户手动指定 baseURL 和协议 | Architecture | 某些提供商可能有自动发现机制 |

## Open Questions (RESOLVED)

1. **pi-ai SDK 的 getEnvApiKey 是否可直接导入使用？** (RESOLVED)
   - What we know: `env-api-keys.js` 未在 package.json exports 中声明
   - What's unclear: 是否可以通过子路径导入
   - Recommendation: 在 Realm 本地维护一份相同的映射表，避免依赖内部模块路径
   - Resolution: Plan 01 Task 1 在 ai-manager.js 本地维护 PROVIDER_ENV_MAP 常量，不依赖 pi-ai 内部模块

2. **模型检测 API 调用的错误处理策略？** (RESOLVED)
   - What we know: 各提供商返回不同的错误格式
   - What's unclear: 是否需要统一错误处理
   - Recommendation: 统一捕获 HTTP 错误，显示友好提示
   - Resolution: Plan 01 Task 2 统一捕获 fetch 错误，按 HTTP 状态码分类返回友好提示（网络错误/API Key 无效/其他）

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 主进程 | ✓ | 20.18.x (Electron 32) | — |
| pi-ai SDK | 提供商目录 | ✓ | ^0.82.1 | — |
| pi-agent-core | AI Agent | ✓ | ^0.82.1 | — |
| electron-store | 配置持久化 | ✓ | ^8.1.0 | — |
| fetch (Node.js 内置) | HTTP API 调用 | ✓ | 内置 | — |

**Missing dependencies with no fallback:**
- 无

**Missing dependencies with fallback:**
- 无

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | API Key 存储在 electron-store，不暴露给渲染进程 |
| V3 Session Management | no | — |
| V4 Access Control | yes | assertTrustedSender 校验 IPC 调用方 |
| V5 Input Validation | yes | 提供商名称、API Key 输入消毒 |
| V6 Cryptography | no | API Key 明文存储在 electron-store（与现有模式一致） |

### Known Threat Patterns for Electron + AI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API Key 泄露 | Information Disclosure | electron-store 本地存储，不通过 IPC 暴露完整 Key |
| XSS 注入（提供商名称） | Tampering | DOM 构建 + textContent，不使用 innerHTML |
| 环境变量篡改 | Tampering | 只读访问 process.env，不修改 |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: ai-manager.js:509-651] AI Manager 类实现，provider 配置、CredentialStore 注入、Agent 初始化
- [VERIFIED: ai-manager.js:680-690] _getCatalog() 方法，获取提供商目录
- [VERIFIED: ai-manager.js:1086-1152] configureProviders() 和 getAvailableModels() API
- [VERIFIED: src/settings-page.js:2366-2590] 设置页 AI 助手区域实现
- [VERIFIED: src/settings.html:258-305] AI 助手配置 HTML 结构
- [VERIFIED: src/index.html:762-806] AI 面板 HTML 结构
- [VERIFIED: main.js:1097-1130] AI HTTP API 端点
- [VERIFIED: src/preload.js:900-958] AI IPC 暴露
- [VERIFIED: ipc-handlers.js:1621-1709] AI IPC 处理器
- [VERIFIED: node_modules/@earendil-works/pi-ai/dist/env-api-keys.js:70-109] 环境变量映射表

### Secondary (MEDIUM confidence)
- [CITED: node_modules/@earendil-works/pi-ai/README.md:411-415] 提供商环境变量文档
- [CITED: deepseek-harness config.ts:84-168] PiAiProviderProfile 配置模型

### Tertiary (LOW confidence)
- [ASSUMED] 各提供商 /models API 端点遵循 OpenAI 兼容协议

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 项目已有依赖，无需新增
- Architecture: HIGH — 基于现有模式扩展，路径清晰
- Pitfalls: HIGH — 已知问题有明确解决方案

**Research date:** 2026-08-21
**Valid until:** 2026-09-21（pi-ai SDK 版本稳定，30 天有效）
