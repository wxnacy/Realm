---
phase: 22
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - cdp-manager.js
  - lib/readability-bundle.js
autonomous: true
requirements:
  - CDP-01

must_haves:
  truths:
    - "AI 工具调用时能成功附加 CDP 调试器并启用 Runtime/DOM 域"
    - "工具执行完成后调试器自动断开，不保留连接"
    - "DevTools 已打开时返回明确错误提示"
    - "CDP 命令执行超时 10 秒后返回错误而非挂起"
    - "webview 销毁时自动清理相关调试器状态"
  artifacts:
    - "cdp-manager.js 包含 attachForAI/detachForAI/executeCommand 方法"
    - "lib/readability-bundle.js 包含可注入的 Readability 库"
  key_links:
    - "attachForAI → debuggerStates 状态管理"
    - "executeCommand → 超时保护机制"
    - "webview destroyed → detachForAI 清理"
---

<objective>
扩展 CDP 管理器，添加 AI 工具专用的调试器管理方法，并准备 Readability 库打包文件。

Purpose: 为后续 AI 工具（read_page_content、extract_links、open_link）提供统一的 CDP 调试器生命周期管理基础设施。
Output: 扩展后的 cdp-manager.js + lib/readability-bundle.js
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@cdp-manager.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: 扩展 cdp-manager.js 添加 AI 工具方法</name>
  <files>cdp-manager.js</files>
  <action>
在 cdp-manager.js 中添加以下三个新方法（per D-01/D-02/D-03/D-04）：

1. **attachForAI(webContentsId, domains)** 方法：
   - 参数：webContentsId (number), domains (string[]，默认 ['Runtime'])
   - 返回：Promise<{success: boolean, error?: string}>
   - 实现逻辑：
     a. 通过 webContents.fromId(webContentsId) 获取 webContents 实例
     b. 检查 wc.isDestroyed()，已销毁返回 {success: false, error: '标签页已关闭'}
     c. 检查 wc.debugger.isAttached()，已附加返回 {success: false, error: 'DevTools 已打开，请关闭后重试'}（per D-04）
     d. 调用 wc.debugger.attach('1.3') 附加调试器
     e. 遍历 domains 数组，逐个调用 wc.debugger.sendCommand(`${domain}.enable`)
     f. 更新 debuggerStates Map，记录 {attached: true, source: 'ai-tool', domains}
     g. 返回 {success: true}
     h. 任何异常时尝试 detach 并返回 {success: false, error: `CDP 附加失败: ${err.message}`}

2. **detachForAI(webContentsId)** 方法：
   - 参数：webContentsId (number)
   - 返回：void
   - 实现逻辑：
     a. 通过 webContents.fromId(webContentsId) 获取 webContents 实例
     b. 检查 wc.isDestroyed()，已销毁直接返回
     c. 从 debuggerStates 获取状态，检查 source === 'ai-tool'，不匹配则返回（per D-03：用完即卸）
     d. 调用 wc.debugger.detach()
     e. 从 debuggerStates 删除该 webContentsId

3. **executeCommand(webContentsId, method, params, timeout)** 方法：
   - 参数：webContentsId (number), method (string), params (object，默认 {}), timeout (number，默认 10000)
   - 返回：Promise<{success: boolean, result?: object, error?: string}>
   - 实现逻辑：
     a. 通过 webContents.fromId(webContentsId) 获取 webContents 实例
     b. 检查 wc.isDestroyed()，已销毁返回 {success: false, error: '标签页已关闭'}
     c. 使用 Promise.race 竞争 wc.debugger.sendCommand(method, params) 和超时 Promise
     d. 超时 Promise 在 timeout 毫秒后 reject(new Error('CDP 命令执行超时'))
     e. 成功返回 {success: true, result}
     f. 异常返回 {success: false, error: err.message}

4. 在模块导出中添加这三个新方法。

5. 在 cleanup() 函数中添加 AI 工具状态清理逻辑（遍历 debuggerStates，对 source === 'ai-tool' 的条目执行 detach）。
  </action>
  <verify>
    <automated>node -e "const cdp = require('./cdp-manager'); console.log(typeof cdp.attachForAI, typeof cdp.detachForAI, typeof cdp.executeCommand);"</automated>
  </verify>
  <done>cdp-manager.js 导出 attachForAI/detachForAI/executeCommand 三个方法，类型为 function</done>
</task>

<task type="auto">
  <name>Task 2: 创建 Readability 库打包文件</name>
  <files>lib/readability-bundle.js</files>
  <action>
创建 lib/readability-bundle.js 文件，包含 Mozilla Readability 库的打包版本。

1. 创建 lib 目录（如果不存在）

2. 使用以下方式获取 Readability 库：
   - 方案 A（推荐）：从 npm 安装 @mozilla/readability 包，然后用 esbuild 打包为 IIFE 格式
   - 命令：npm install --save-dev @mozilla/readability && npx esbuild node_modules/@mozilla/readability/Readability.js --bundle --format=iife --global-name=Readability --outfile=lib/readability-bundle.js --minify
   - 方案 B（备选）：如果 esbuild 不可用，直接从 GitHub 下载 Readability.js 源码，手动包装为可注入的字符串

3. 打包后的文件应导出一个全局变量 Readability，可在 Runtime.evaluate 中直接使用

4. 文件格式要求：
   - IIFE 格式，避免污染全局作用域
   - 包含 Readability 构造函数和 parse() 方法
   - 文件大小约 50KB（minified）

5. 在 cdp-manager.js 顶部添加注释说明 Readability 库的来源和用途
  </action>
  <verify>
    <automated>test -f lib/readability-bundle.js && echo "File exists" || echo "File missing"</automated>
  </verify>
  <done>lib/readability-bundle.js 文件存在，包含可注入的 Readability 库代码</done>
</task>

</tasks>

<verification>
1. cdp-manager.js 导出 attachForAI/detachForAI/executeCommand
2. lib/readability-bundle.js 文件存在
3. 两个文件无语法错误
</verification>

<success_criteria>
- cdp-manager.js 包含三个新方法，可正常导出
- lib/readability-bundle.js 包含 Readability 库代码
- 代码符合项目风格（JSDoc 注释、camelCase 命名）
</success_criteria>

<output>
创建 `.planning/phases/22-cdp/22-01-SUMMARY.md` 当完成时
</output>
