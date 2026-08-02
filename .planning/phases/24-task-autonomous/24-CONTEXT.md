# Phase 24: 任务自主执行 - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

AI Agent 能够自动填写网页表单和执行页面操作，所有高风险写操作（表单提交、文件上传、支付相关）必须用户确认。

具体交付：
- AUTO-01: fillForm CDP 方法（自动化填写网页表单）
- AUTO-02: executeAction CDP 方法（执行点击、滚动等页面操作）
- AUTO-03: fill_form AI 工具（AI 调用填表能力）
- AUTO-04: execute_action AI 工具（AI 调用操作能力）
- AUTO-05: 操作确认 UI（高风险操作必须用户确认）
- AUTO-06: Prompt Injection 防护（输入消毒、脚本静态分析、沙箱执行）

**偏离 Roadmap 原始要求：** 用户决定仅对高风险操作（表单提交、文件上传、支付相关）要求确认，低风险操作（填表、点击、滚动）自动执行。Roadmap 原要求"所有写操作必须用户确认"。

</domain>

<decisions>
## Implementation Decisions

### 表单字段定位策略
- **D-01:** ARIA 语义 + 文本匹配 — 优先用 label/placeholder/aria-label/文本内容定位表单字段，更贴近人类理解，页面改版不易失效。找不到时回退 CSS 选择器
- **D-02:** 字段名 + 值参数格式 — fill_form 工具参数为 `{ field: "邮箱", value: "test@example.com" }`，CDP 端按 label→name→id→selector 顺序查找最佳匹配
- **D-03:** 全表单类型支持 — 支持 input[text/email/password/number/tel/url/search/date/time]、textarea、select、checkbox、radio、file upload、date picker、contenteditable、iframe 内表单、CAPTCHA 字段检测
- **D-04:** 字段未找到时报错 + 返回可用字段 — AI 指定的字段名找不到时，返回错误信息和页面上所有可用字段列表，让 AI 重新选择

### 操作确认 UI 模式
- **D-05:** 聊天内联确认 — 确认 UI 在 AI 聊天面板内显示确认卡片，不阻塞页面操作。用户在聊天中点击确认/取消
- **D-06:** 详细版确认信息 — 确认卡片展示：操作类型 + 具体值 + 目标页面 URL + 容器名 + 风险等级
- **D-07:** 仅高风险操作确认 — 仅对表单提交(submit)、文件上传、支付相关操作要求用户确认。低风险操作（填表、点击、滚动）自动执行
- **D-08:** 偏离 Roadmap — 此决策偏离 Roadmap 原要求"所有写操作必须用户确认"，用户明确确认此偏离

### 元素定位与操作设计
- **D-09:** 文本优先 + 选择器兜底 — execute_action 工具定位元素时，优先用文本描述匹配（如"提交按钮"），找不到时用 CSS 选择器作为兜底。与 D-01 表单定位策略一致
- **D-10:** 全操作类型支持 — 支持 click、scroll、type、select、check/uncheck、focus/blur、submit、upload、drag、hover、keydown/keyup、execute_script、screenshot、wait_for_element
- **D-11:** 结构化参数格式 — execute_action 工具参数为 `{ action: 'click', target: '提交按钮' }`，与 Playwright/Selenium/Puppeteer 行业标准一致
- **D-12:** 操作结果 + 页面变化 — 操作执行后返回：操作结果（成功/失败）+ 页面变化（新 URL、新弹窗、表单验证错误等）

### 安全防护与边界处理
- **D-13:** 多层 Prompt Injection 防护 — 输入消毒（过滤危险字符）+ 脚本静态分析（检测 eval/Function/fetch 等危险调用）+ 沙箱执行（隔离环境限制 API 访问）
- **D-14:** CAPTCHA/2FA 暂停等待 — 检测到验证码或 2FA 页面时，暂停当前任务，提示用户手动操作，等待用户完成后自动恢复后续步骤
- **D-15:** 特征 + 关键词检测 — CAPTCHA 检测：常见框架（reCAPTCHA/hCaptcha/Turnstile）+ 页面关键词（"验证"、"机器人检测"、"安全验证"）
- **D-16:** 白名单脚本安全 — execute_script 操作仅允许 DOM 操作和页面交互 API，禁止 eval、new Function、import()、require()、fs/net/http 等模块访问

### Claude's Discretion

无 — 所有关键决策已由用户确认。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CDP / AI 工具系统
- `cdp-manager.js` — CDP 调试器管理器，包含 attachForAI/detachForAI/executeCommand 方法。fillForm 和 executeAction 的 CDP 底层实现复用此模块
- `ai-manager.js` — AI Manager，包含 `_buildRealmTools()` 方法定义工具列表。fill_form 和 execute_action 工具在此注册
- `src/preload.js` — contextBridge API 定义，新 IPC 通道（操作确认）需在此暴露

### UI / 确认交互
- `src/renderer.js` — 渲染进程逻辑，AI 聊天面板内联确认卡片需在此添加
- `src/index.html` — 主界面结构，确认卡片 HTML 结构需在此添加
- `src/styles/main.css` — 样式文件，确认卡片样式需在此添加

### 项目规范
- `.planning/ROADMAP.md` — Phase 24 成功标准和依赖关系
- `.planning/REQUIREMENTS.md` — AUTO-01~AUTO-06 需求定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cdp-manager.js` `attachForAI()` / `detachForAI()` / `executeCommand()`: AI 工具的 CDP 调试器管理，fillForm/executeAction 直接复用
- `cdp-manager.js` `executeCommand()` 超时保护: 10 秒超时防挂起，fillForm/executeAction 复用
- `ai-manager.js` `_buildRealmTools()` 工具注册模式: name/description/parameters/execute 签名，新工具直接复用
- AI 工具 execute 函数签名: `async (toolCallId, params, signal?, onUpdate?)`
- AI 工具返回格式: `{ content: [{ type: 'text', text: JSON.stringify(...) }], details: {...} }`

### Established Patterns
- CDP 域启用: `attachForAI(webContentsId, ['Runtime', 'DOM', 'Input'])` — 按需启用多个域
- IPC 通道 kebab-case: `get-containers`、`switch-container`
- 状态管理: 全局 state 对象 + elements 对象集中 DOM 引用
- 确认 UI: 现有模态弹窗模式（容器删除确认、Cookie 保存确认）

### Integration Points
- `cdp-manager.js` — fillForm/executeAction CDP 底层方法在此新增
- `ai-manager.js` `_buildRealmTools()` — fill_form/execute_action AI 工具在此注册
- `src/renderer.js` — AI 聊天面板内联确认卡片逻辑在此添加
- `src/preload.js` — 新 IPC 通道（操作确认请求/响应）需在此暴露
- `src/index.html` — 确认卡片 HTML 结构需在此添加
- `src/styles/main.css` — 确认卡片样式需在此添加

</code_context>

<specifics>
## Specific Ideas

- 表单字段查找链：label 文本 → placeholder → aria-label → name 属性 → id 属性 → CSS 选择器。每一步找到唯一匹配即返回，全部失败则返回可用字段列表
- 操作确认卡片设计：显示操作图标 + 操作描述（如"填写邮箱为 test@example.com"）+ 页面 URL + 容器名 + 风险等级标签 + 确认/取消按钮
- CAPTCHA 检测逻辑：在页面 DOM 中搜索 reCAPTCHA iframe、hCaptcha div、Turnstile widget，以及关键词匹配
- 白名单脚本 API：document.querySelector、element.click/scrollIntoView/focus、window.scrollTo、history.back/forward 等 DOM 和页面交互 API

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-任务自主执行*
*Context gathered: 2026-08-02*
