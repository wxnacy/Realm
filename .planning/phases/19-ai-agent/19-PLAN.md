---
phase: 19-ai-agent
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ai-manager.js
  - main.js
  - package.json
autonomous: true
requirements:
  - AI-01

must_haves:
  truths:
    - Electron 32 内置 Node 版本已验证（>= 22.19.0 或已评估替代方案）
    - pi-ai 和 pi-agent-core 依赖已安装且可在主进程 require
    - AIManager 类可实例化，init() 方法可调用
    - get_tabs 工具已定义并可被 Agent 调用
    - AIManager 集成到 main.js 的 app.whenReady() 流程
  artifacts:
    - ai-manager.js（AI Manager 骨架模块）
    - package.json（新增 pi-ai 和 pi-agent-core 依赖）
    - main.js（集成 AIManager 初始化）
  key_links:
    - AIManager.init() → pi-ai builtinModels()
    - AIManager._buildRealmTools() → get_tabs 工具定义
    - main.js app.whenReady() → aiManager.init()
---

<objective>
验证 pi-agent-core SDK 在 Realm Browser 环境中的可行性，创建 AI Manager 骨架模块。

Purpose: 确认 Electron 32 主进程可以运行 pi-agent-core，建立 AI 模块基础架构。
Output: ai-manager.js 骨架模块 + 依赖安装 + main.js 集成。
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/19-ai-agent/19-CONTEXT.md
@.planning/phases/19-ai-agent/19-RESEARCH.md
@main.js
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: 验证 Electron 内置 Node 版本并安装 pi 依赖</name>
  <files>package.json</files>
  <read_first>
    - package.json（查看当前依赖和 Electron 版本）
    - .planning/phases/19-ai-agent/19-RESEARCH.md（Node 版本兼容性分析）
    - .planning/phases/19-ai-agent/19-CONTEXT.md（D-01 ~ D-04 决策）
  </read_first>
  <action>
1. 验证 Electron 32 内置 Node.js 版本（per D-01）：
   - 运行 `npx electron -e "console.log(process.versions.node)"` 获取版本号
   - 记录版本号到控制台输出

2. 根据版本验证结果决策（per D-01 ~ D-04）：
   - 如果 Node >= 22.19.0：满足要求，继续（per D-02）
   - 如果 Node < 22.19.0：输出警告日志，但继续安装依赖验证（per D-03，升级 Electron 评估留到后续）

3. 安装 pi 依赖（per D-14，初始支持 OpenAI）：
   - `npm install @earendil-works/pi-ai@^0.82.0 @earendil-works/pi-agent-core@^0.82.0`
   - 验证安装成功：`node -e "require('@earendil-works/pi-ai'); require('@earendil-works/pi-agent-core'); console.log('OK')"`

4. 验证依赖可在 Electron 主进程加载：
   - 创建临时测试脚本，使用 `npx electron -e` 测试 require
   - 输出加载结果到控制台
  </action>
  <verify>
    <automated>node -e "const p1 = require.resolve('@earendil-works/pi-ai'); const p2 = require.resolve('@earendil-works/pi-agent-core'); console.log('pi-ai:', p1); console.log('pi-agent-core:', p2);"</automated>
  </verify>
  <acceptance_criteria>
    - `npx electron -e "console.log(process.versions.node)"` 输出版本号
    - `node -e "require('@earendil-works/pi-ai')"` 不抛出 MODULE_NOT_FOUND
    - `node -e "require('@earendil-works/pi-agent-core')"` 不抛出 MODULE_NOT_FOUND
    - package.json dependencies 包含 `@earendil-works/pi-ai` 和 `@earendil-works/pi-agent-core`
  </acceptance_criteria>
  <done>Electron 内置 Node 版本已验证，pi-ai 和 pi-agent-core 依赖已安装且可在 Node.js 环境加载</done>
</task>

<task type="auto">
  <name>Task 2: 创建 ai-manager.js 骨架并集成到 main.js</name>
  <files>ai-manager.js, main.js</files>
  <read_first>
    - main.js（查看 app.whenReady() 流程和现有 Manager 初始化模式）
    - .planning/phases/19-ai-agent/19-CONTEXT.md（D-05 ~ D-14 决策）
    - .planning/phases/19-ai-agent/19-RESEARCH.md（AI Manager 骨架设计）
    - docs/plan/pi-agent-integration.md（5.2 AI Manager 核心模块设计）
  </read_first>
  <action>
1. 创建 `ai-manager.js` 文件（per D-08 完整骨架设计）：

   文件顶部 JSDoc 注释说明模块职责。

   定义 `REALM_SYSTEM_PROMPT` 常量：系统提示词，说明 AI 是 Realm Browser 的助手，可以操作标签页、管理容器等。

   定义 `AIManager` 类，包含以下方法（per D-10）：

   - `constructor()`：初始化状态，`this.models = null`、`this.agent = null`、`this.tools = []`、`this.configStore = null`、`this.isInitialized = false`

   - `async init(configStore)`：
     - 接收 configStore 参数（electron-store 实例，per D-12）
     - 检查 API Key 是否存在（`configStore.get('ai.apiKey')`）
     - 如果无 API Key，输出日志 `[Realm AI] 未配置 API Key，请在设置中配置`，设置 `this.isInitialized = false`，返回
     - 如果有 API Key：
       - 从 pi-ai 导入 `builtinModels`
       - 创建 Models 实例：`this.models = builtinModels({ openai: { apiKey } })`
       - 调用 `this._buildRealmTools()` 构建工具列表
       - 从 pi-agent-core 导入 `Agent`
       - 创建 Agent 实例（参考 pi-agent-integration.md 5.2 伪代码）
       - `this.isInitialized = true`
       - 输出日志 `[Realm AI] AI Manager 初始化完成`

   - `async prompt(message)`：
     - 检查 `this.isInitialized`，未初始化则输出错误日志并返回
     - 调用 `this.agent.prompt(message)`
     - 输出日志 `[Realm AI] 发送消息: ${message.substring(0, 50)}...`

   - `abort()`：
     - 检查 `this.agent` 存在则调用 `this.agent.abort()`
     - 输出日志 `[Realm AI] 操作已取消`

   - `_buildRealmTools()`（per D-11 静态工具注册）：
     - 返回数组，包含 get_tabs 工具定义
     - get_tabs 工具：name 为 `get_tabs`，description 为 `获取当前所有标签页列表`，parameters 为空对象（无参数），execute 函数返回当前标签页列表（从 tabManager 获取）

   - `_compactContext(messages)`：
     - 上下文裁剪方法，保留最近 20 条消息
     - 返回裁剪后的消息数组

2. 修改 `main.js`（集成 AIManager）：
   - 在文件顶部 require 区域添加：`const AIManager = require('./ai-manager');`
   - 在现有 Manager 初始化之后、`app.whenReady()` 回调内添加：
     ```
     const aiManager = new AIManager();
     ```
   - 在 `app.whenReady()` 回调的末尾添加 AIManager 初始化调用：
     ```
     aiManager.init(configStore).catch(err => {
       console.error('[Realm AI] 初始化失败:', err.message);
     });
     ```
   - 将 aiManager 导出（在 module.exports 中添加 aiManager 属性），供后续 Phase 使用
  </action>
  <verify>
    <automated>node -e "const AIM = require('./ai-manager'); const m = new AIM(); console.log('AIManager created:', typeof m.init, typeof m.prompt, typeof m.abort, typeof m._buildRealmTools, typeof m._compactContext);"</automated>
  </verify>
  <acceptance_criteria>
    - `ai-manager.js` 文件存在且可 require
    - `AIManager` 类包含 `init`、`prompt`、`abort`、`_buildRealmTools`、`_compactContext` 方法
    - `new AIManager()` 实例化不报错
    - `main.js` 顶部 require 区域包含 `require('./ai-manager')`
    - `main.js` 的 `app.whenReady()` 回调内有 `aiManager.init(configStore)` 调用
    - `main.js` module.exports 包含 `aiManager` 属性
    - `_buildRealmTools()` 返回的工具列表中包含 name 为 `get_tabs` 的工具
  </acceptance_criteria>
  <done>ai-manager.js 骨架模块创建完成，包含完整类结构和 get_tabs 工具定义；main.js 集成 AIManager 初始化</done>
</task>

</tasks>

<verification>
1. 依赖验证：`node -e "require('@earendil-works/pi-ai'); require('@earendil-works/pi-agent-core')"` 输出无报错
2. 模块验证：`node -e "const AIM = require('./ai-manager'); new AIM()"` 输出无报错
3. main.js 验证：`grep -c "aiManager" main.js` 输出 >= 3（require + 实例化 + init 调用）
</verification>

<success_criteria>
- Electron 32 内置 Node 版本已记录
- pi-ai 和 pi-agent-core 依赖安装成功
- ai-manager.js 骨架模块创建完成，包含 AIManager 类
- AIManager 包含 init()、prompt()、abort()、_buildRealmTools()、_compactContext() 方法
- get_tabs 工具已定义在 _buildRealmTools() 中
- main.js 已集成 AIManager 初始化
- API Key 通过 electron-store 存储（configStore.get('ai.apiKey')）
</success_criteria>

<output>
创建 `.planning/phases/19-ai-agent/19-01-SUMMARY.md` 当任务完成
</output>
