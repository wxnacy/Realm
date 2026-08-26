# Phase 38: AI 助手供应商管理增强 - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

扩展 AI 助手的供应商管理能力：从当前"单提供商配置"升级为"多供应商增删改"，API Key 支持环境变量优先+手动输入兜底，并在聊天对话框底部增加模型选择器。

**核心交付：**
- 设置页供应商管理：左右分栏布局，左侧供应商列表+搜索，右侧编辑表单
- 供应商 CRUD：添加内置供应商（pi-ai 目录）+ 添加自定义 OpenAI 兼容端点 + 编辑 + 删除
- API Key 环境变量优先：按提供商约定自动检测，用户可自定义环境变量名
- 聊天面板底部工具栏：模型选择器（跨供应商）+ 发送按钮 + 新对话按钮
- 模型检测：调用提供商 API 获取可用模型列表
- 选择模型即激活对应供应商

</domain>

<decisions>
## Implementation Decisions

### 供应商管理 UI（设置页）
- **D-01:** 左右分栏布局：左侧供应商列表+搜索框，右侧编辑表单（提供商名/Key/模型/环境变量）
- **D-02:** 两个入口按钮："添加内置供应商"（从 pi-ai 内置 38 个提供商目录选择）和"添加自定义供应商"（自定义 baseURL + API Key + 协议）
- **D-03:** 右侧编辑表单有"检测模型"按钮，调用提供商 API 获取可用模型列表，失败时提示错误
- **D-04:** 用户可手动删除检测到的不需要的模型
- **D-05:** 删除供应商 = 彻底清除（硬删除），相关配置（Key、模型列表）全部清除
- **D-06:** 保留当前 OpenAI 默认配置，迁移旧数据（`ai.apiKey` → `ai.providers.openai`）

### API Key 环境变量
- **D-07:** 按提供商约定自动检测环境变量名（如 OPENAI_API_KEY、DEEPSEEK_API_KEY、ANTHROPIC_API_KEY 等）
- **D-08:** 用户可自定义环境变量名（覆盖默认约定）
- **D-09:** 检测到环境变量时，输入框下方显示"检测到环境变量 XXX，已自动使用"提示
- **D-10:** 用户可手动输入 API Key 覆盖环境变量值

### 聊天面板底部工具栏
- **D-11:** 底部工具栏布局：[模型按钮] ---- [发送按钮]，发送按钮从输入区移到工具栏最右侧
- **D-12:** 模型按钮显示当前模型名（如 "gpt-4o"），点击展开下拉框
- **D-13:** 下拉框展示所有已配置供应商的模型列表，按供应商分组显示
- **D-14:** 选择模型即激活对应供应商（更新 `ai.activeProvider` + 切换模型）
- **D-15:** 工具栏左侧加"新对话"按钮，清空聊天历史

### 模型检测
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目规范
- `CLAUDE.md` — 项目规范：命名规范、代码风格、IPC 通信模式、新增 IPC 接口流程

### AI 相关实现
- `ai-manager.js` — AI Manager 核心：pi-agent-core SDK 集成、provider 配置读取、CredentialStore 注入、模型初始化
- `src/settings-page.js` — 设置页 AI 助手区域：提供商选择、模型选择、API Key 输入、保存配置
- `src/settings.html` — 设置页 HTML 结构：AI 配置区 DOM

### 聊天面板
- `src/renderer.js` — 渲染进程：AI 面板开关、消息渲染、流式输出、工具卡片
- `src/index.html` — AI 面板 HTML 结构（#aiPanel、#aiInput、#aiSendBtn）
- `src/styles/main.css` — AI 面板样式

### 主进程 IPC
- `main.js` — IPC 处理器注册、AI 相关通道
- `ipc-handlers.js` — 集中 IPC 处理器注册
- `src/preload.js` — contextBridge 暴露 realmAPI

### 参考项目
- `/Users/wxnacy/Projects/github/deepseek-harness/packages/llm/llm-pi-ai/src/config.ts` — deepseek-harness 的 provider 配置模型：apiKeyEnv 环境变量引用、profile 结构、模型目录解析
- `/Users/wxnacy/Projects/github/deepseek-harness/` — 整体架构参考

### pi-ai SDK
- `@earendil-works/pi-ai/providers/all` — builtinModels 导入路径，内置 38 个提供商
- `@earendil-works/pi-ai` — Provider/Model 类型定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ai-manager.js `init()` 方法**: 已有 provider 配置读取逻辑（`ai.providers.{id}.{apiKey,model}`）、CredentialStore 注入、模型初始化。扩展为多供应商时需重构此流程
- **settings-page.js `selectAIProvider()`**: 已有提供商选择+模型列表渲染逻辑，可复用于供应商列表
- **settings-page.js `settingsApi('ai/models')`**: 已有获取模型目录的 API 调用
- **settings-page.js `settingsApi('ai/configure')`**: 已有保存提供商配置的 API
- **configStore (`ai.providers`, `ai.activeProvider`)**: 已有配置持久化结构

### Established Patterns
- **IPC 通信模式**: `ipcMain.handle('channel-name', handler)` + `contextBridge.exposeInMainWorld` + `window.realmAPI.method()`
- **设置页数据流**: settings-page.js → HTTP `/api/settings/*` → main.js → configStore
- **AI 事件广播**: ai-manager.js → mainWindow.webContents.send → renderer.js 监听
- **深色主题**: CSS 变量 `--bg-primary`, `--text-secondary` 等

### Integration Points
- **main.js**: 需要新增/扩展 IPC 处理器：供应商 CRUD、模型检测、环境变量读取
- **src/preload.js**: 需要暴露新的 realmAPI 方法（如果走 IPC 路线）
- **src/settings.html**: 需要重构 AI 助手区域为左右分栏布局
- **src/settings-page.js**: 需要重写供应商管理逻辑（列表、搜索、CRUD、模型检测）
- **src/index.html**: AI 面板底部需要重构为工具栏布局
- **src/renderer.js**: 需要实现工具栏交互（模型选择、新对话）
- **src/styles/main.css**: 需要新增工具栏和供应商管理样式
- **ai-manager.js**: 需要扩展为支持多供应商切换和环境变量检测

</code_context>

<specifics>
## Specific Ideas

- 供应商管理参考 deepseek-harness 的 provider profile 结构（apiKeyEnv、baseURL、models）
- 模型下拉框参考 Cursor/VS Code 的模型切换体验
- 环境变量检测参考各提供商的约定命名（OPENAI_API_KEY、DEEPSEEK_API_KEY、ANTHROPIC_API_KEY 等）
- 聊天面板工具栏风格与现有深色主题一致

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-AI 助手供应商管理增强*
*Context gathered: 2026-08-21*
