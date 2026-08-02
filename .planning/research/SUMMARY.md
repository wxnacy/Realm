# 项目研究摘要

**项目:** Realm Browser v2.1 — AI CDP 增强 + Tabbrowser 功能集成
**领域:** Electron 多容器隔离浏览器 — AI Agent 深度控制
**研究日期:** 2026-08-02
**置信度:** HIGH

## Executive Summary

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，v2.1 里程碑的核心目标是将 AI Agent 从"只能调用 5 个基础工具"升级为"能深度操控网页内容"。研究结论非常明确：**无需新增任何依赖**，所有功能都可以用现有技术栈（Electron CDP、better-sqlite3 FTS5、pi-agent-core）实现。关键决策是优先使用 `Runtime.evaluate` 而非 DOM 域逐节点操作，因为它更灵活、更强大，能在页面上下文中执行任意 JavaScript。

推荐的实施路径分为四个阶段，严格按依赖顺序推进：Phase 22（CDP 管理器扩展 + 3 个基础工具）是所有后续功能的前提；Phase 23（智能上下文引用 + 全文检索）和 Phase 24（任务自主执行）可相对独立开发；Phase 25（脚本生成 + 智能标签整理）依赖前面所有阶段的能力。这个顺序既符合技术依赖关系，也能让每个阶段都有可交付的价值增量。

最大风险集中在安全领域：AI Agent 执行自动化任务时面临 XSS、Prompt Injection、代码注入等攻击面。必须在 Phase 24-25 实现严格的安全防护（输入消毒、脚本静态分析、沙箱执行、高风险操作用户确认）。其次是性能风险：大页面内容提取可能导致 UI 冻结，CDP 会话泄漏可能导致内存溢出。这些都需要在 Phase 22 同步解决，不能留到后面。

## Key Findings

### Recommended Stack

**核心结论：零新增依赖。** 所有功能基于 6 个已集成技术实现。

**核心技术：**
- **Electron CDP (webContents.debugger)**: 网页内容读取和 DOM 操控 — Electron 原生支持，无需 Puppeteer/Playwright
- **Runtime.evaluate**: 页面内执行 JavaScript — 比 DOM 域更灵活，可完成读取、点击、填表等所有操作
- **better-sqlite3 FTS5**: 全文检索 — 已集成，unicode61 分词器对中文"足够好"
- **pi-agent-core**: AI 工具注册框架 — 5 个现有工具扩展到 12+ 个
- **cheerio**: HTML 解析备选 — 已集成，用于 CDP 取回 HTML 后的服务端解析

**关键决策：** 优先使用 `Runtime.evaluate` 而非 DOM 域。`Runtime.evaluate` 可以在页面上下文中执行任意 JS，比逐节点操作更简单、更强大。cheerio 作为备选，用于需要在主进程解析 HTML 的场景。

**避免使用：** Puppeteer/Playwright（Electron 内置 CDP）、jieba（FTS5 unicode61 够用）、lunr.js（SQLite FTS5 更强）、RobotJS（CDP 可直接操作 DOM）。

> 详见 [STACK.md](./STACK.md)

### Expected Features

**Must have（本里程碑核心）：**

| Phase | Feature | 说明 |
|-------|---------|------|
| 22 | CDP 管理器扩展 | 从 Network 域扩展到 Runtime/DOM/Page 域 |
| 22 | read_page_content 工具 | 读取页面标题、正文、元信息 — 后续所有功能的基础 |
| 22 | extract_links 工具 | 提取页面所有有效链接 |
| 22 | open_link 工具 | 在容器中打开指定链接 |
| 23 | @ 引用标签页上下文 | AI 对话中引用特定标签页内容 |
| 23 | 全文检索收藏 | FTS5 索引页面正文，支持内容搜索 |
| 24 | 自动化填表 | AI 自动填写网页表单 |
| 24 | 自动化操作 | AI 执行点击、滚动等页面操作 |
| 25 | 一句话生成脚本 | 自然语言描述 → 可执行脚本 |
| 25 | AI 自动标签分组 | 按主题/域名智能分组标签页 |

**Should have（差异化竞争）：**
- 容器感知的 AI 上下文 — AI 理解当前容器身份
- 跨容器内容对比 — 对比不同容器中同一网站的内容差异
- AI 浏览摘要 — 自动生成页面结构化摘要
- 智能表单记忆 — 按容器隔离存储表单数据

**Defer（v2+）：**
- 自动化脚本市场 — 需要脚本格式标准化
- 操作录制回放 — 类似 Playwright codegen，复杂度高
- 标签页智能休眠 — 可后续迭代

**Anti-Features（必须避免）：**
- 无确认的自动化操作 — 所有写操作必须用户确认
- 页面内容持久化存储 — 仅内存缓存，会话结束清除
- 跨容器数据泄露 — AI 上下文严格按容器隔离
- 自动化绕过网站安全机制 — 遇到 CAPTCHA/2FA 提示用户手动操作

> 详见 [FEATURES.md](./FEATURES.md)

### Architecture Approach

v2.1 沿用现有模块化架构，在 `cdp-manager.js`、`ai-manager.js`、`favorites-manager.js` 三个核心模块上扩展。CDP Manager 从被动抓取扩展为主动网页操控（新增 getSession/getPageContent/extractLinks/executeScript 方法），AI Manager 工具集从 5 个扩展到 12+ 个，渲染进程新增 @ 引用 UI 和全文检索能力。所有新功能复用现有的 IPC 通道和 contextBridge 模式。

**主要组件扩展：**
1. **cdp-manager.js** — 新增 Runtime/DOM/Page 域支持，从被动抓取扩展为主动操控
2. **ai-manager.js** — 新增 7+ 个工具定义，注入 cdpManager 依赖
3. **favorites-manager.js** — 新增 FTS5 虚拟表 + 触发器 + searchFulltext 方法
4. **renderer.js** — 新增 @ 引用输入框 + Tab 选择器 + 脚本预览 UI
5. **preload.js / ipc-handlers.js** — 新增 `ai:prompt-with-context` IPC 通道

**构建顺序：** Phase 22 → 23 → 24 → 25，严格按依赖链推进。Phase 22 是基础（CDP 能力），Phase 23 和 24 可相对并行，Phase 25 依赖前面所有阶段。

> 详见 [ARCHITECTURE.md](./ARCHITECTURE.md)

### Critical Pitfalls

1. **CDP 调试器会话泄漏（内存泄漏）** — 每个会话占用 5-20MB，webview 销毁时必须调用 detachDebugger()。解决：扩展 debuggerStates 跟踪 enabledDomains 和 activeCommands，添加资源监控和自动清理（MAX_DEBUGGER_SESSIONS=10，MAX_IDLE_TIME=5min）。**Phase 22 必须解决。**

2. **大页面内容提取导致 UI 冻结** — `document.body.innerText` 在大页面上阻塞事件循环。解决：添加超时（5s）、大小限制（1MB）、分块读取、使用 `webContents.executeJavaScript` 在渲染进程异步执行。**Phase 22 必须解决。**

3. **任务自动化中的 XSS 和 Prompt Injection** — 恶意网页可通过 DOM 属性注入恶意提示词。解决：输入消毒（sanitizeForLLM）、脚本静态分析（validateGeneratedScript）、沙箱执行、高风险操作用户确认。**Phase 24-25 必须解决。**

4. **全文检索索引膨胀** — >10,000 条收藏时索引可达数百 MB。解决：限制索引内容长度（10KB/条）、增量更新、定期 VACUUM、查询缓存。**Phase 23 必须解决。**

5. **链接提取的 URL 格式错误** — 相对路径、javascript: 链接、锚点链接未正确处理。解决：使用 `el.href`（浏览器自动解析绝对 URL）、过滤非 HTTP 协议、去重。**Phase 22 必须解决。**

> 详见 [PITFALLS.md](./PITFALLS.md)

## Implications for Roadmap

基于研究，建议分为 4 个阶段，严格按依赖顺序推进：

### Phase 22: CDP 管理器扩展 + 基础网页操控工具
**Rationale:** 这是所有后续功能的前提。CDP Manager 需要从被动抓取扩展为主动网页操控，read_page_content 是 Phase 23 @ 引用、全文检索、Phase 24 自动化填表的共同依赖。
**Delivers:** cdp-manager.js 新增 getSession/getPageContent/extractLinks/executeScript 方法 + AI Manager 新增 3 个工具（read_page_content, extract_links, open_link）
**Addresses:** CDP 管理器扩展、read_page_content、extract_links、open_link
**Avoids:** CDP 会话泄漏（陷阱 1）、大页面 UI 冻结（陷阱 2）、链接 URL 格式错误（陷阱 3）
**子任务建议：**
- 22-01: cdp-manager.js 扩展（getSession/getPageContent/extractLinks/executeScript + 资源监控）
- 22-02: ai-manager.js 新增 read_page_content 工具
- 22-03: ai-manager.js 新增 extract_links 工具
- 22-04: ai-manager.js 新增 open_link 工具

### Phase 23: 智能上下文引用 + 全文检索
**Rationale:** 依赖 Phase 22 的 read_page_content 能力。@ 引用和全文检索可并行开发，都围绕"让 AI 理解更多信息"展开。
**Delivers:** @ 引用标签页 UI + ai:prompt-with-context IPC 通道 + FTS5 全文检索 + search_favorites_fulltext 工具
**Addresses:** @ 引用标签页上下文、全文检索收藏
**Avoids:** 全文检索索引膨胀（陷阱 4）、@ 引用敏感信息泄露（陷阱 8）
**子任务建议：**
- 23-01: renderer.js @ 引用 UI（输入框 + Tab 选择器）
- 23-02: 新增 ai:prompt-with-context IPC 通道
- 23-03: ai-manager.js 上下文注入逻辑
- 23-04: favorites-manager.js FTS5 索引扩展
- 23-05: ai-manager.js 新增 search_favorites_fulltext 工具

### Phase 24: 任务自主执行
**Rationale:** 依赖 Phase 22 的 Runtime.evaluate + Input 域能力。自动化填表和操作是高价值功能，但安全风险最高，需要最严格的安全防护。
**Delivers:** fillForm/executeAction CDP 方法 + fill_form/execute_action AI 工具 + 操作确认机制
**Addresses:** 自动化填表、自动化操作
**Avoids:** XSS 和 Prompt Injection（陷阱 5）、代码注入和权限提升（陷阱 6）
**子任务建议：**
- 24-01: cdp-manager.js 新增 fillForm 方法
- 24-02: cdp-manager.js 新增 executeAction 方法
- 24-03: ai-manager.js 新增 fill_form 工具
- 24-04: ai-manager.js 新增 execute_action 工具
- 24-05: 渲染进程操作确认 UI

### Phase 25: 脚本生成 + 智能标签整理
**Rationale:** 依赖 Phase 22（页面内容读取）+ Phase 24（自动化执行能力）。是整个里程碑的高级功能，安全要求最高。
**Delivers:** generate_script 工具 + suggest_tab_groups 工具 + 脚本预览/确认 UI + 标签分组 UI
**Addresses:** 一句话生成脚本、AI 自动标签分组
**Avoids:** 脚本生成代码注入（陷阱 6）、标签分组不准确（陷阱 7）
**子任务建议：**
- 25-01: ai-manager.js 新增 generate_script 工具
- 25-02: renderer.js 脚本预览/确认 UI
- 25-03: ai-manager.js 新增 suggest_tab_groups 工具
- 25-04: renderer.js 标签分组 UI

### Phase Ordering Rationale

- **Phase 22 必须最先**：CDP Manager 扩展是所有网页操控功能的前提，read_page_content 是后续所有阶段的共同依赖
- **Phase 23 和 24 可相对并行**：@ 引用（UI 层）和自动化（CDP 层）依赖不同的技术栈，但都依赖 Phase 22
- **Phase 25 必须最后**：脚本生成需要页面内容读取（Phase 22）+ 自动化执行能力（Phase 24）
- **安全防护贯穿 Phase 24-25**：输入消毒、脚本分析、沙箱执行、用户确认机制必须在自动化功能上线时同步就绪

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 24:** 任务自动化安全防护方案需要深入研究，包括 Prompt Injection 防御策略、脚本沙箱实现细节、操作确认 UI 交互设计
- **Phase 25:** 脚本生成的 LLM Prompt 工程需要原型验证，标签分组算法需要实际数据测试

Phases with standard patterns (skip research-phase):
- **Phase 22:** CDP Runtime.evaluate 是成熟 API，有大量 Electron 示例代码，STACK.md 已提供完整代码模板
- **Phase 23:** FTS5 虚拟表 + 触发器是标准 SQLite 模式，@ 引用 UI 是常见的 @ mention 交互

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 所有技术已集成并验证，CDP/FTS5 有官方文档支持，研究提供了完整代码示例 |
| Features | HIGH | 功能边界清晰，依赖链明确，每个 Phase 的交付物和复杂度已评估 |
| Architecture | HIGH | 基于现有模块扩展，集成点明确，数据流和组件交互图完整 |
| Pitfalls | HIGH | 基于现有代码库分析 + Chromium/Electron 官方文档，提供了具体的代码级解决方案 |

**Overall confidence:** HIGH

### Gaps to Address

- **自动化操作的 UX 设计**：操作确认 UI 的具体交互模式（模态框 vs 侧边栏 vs 内联确认）需要在 Phase 24 planning 时确定
- **LLM Prompt 工程**：脚本生成的 system prompt 需要在 Phase 25 planning 时进行原型验证
- **中文全文检索效果**：FTS5 unicode61 分词器对中文的实际搜索质量需要在 Phase 23 实现后用真实数据测试，如果召回率不足可能需要考虑 ICU tokenizer
- **标签分组算法选择**：域名聚合 vs LLM 分析 vs 混合方案的具体选择需要在 Phase 25 planning 时根据实际标签页数据量决定

## Sources

### Primary (HIGH confidence)
- Electron webContents.debugger API — CDP 会话管理、Runtime.evaluate 使用
- Chrome DevTools Protocol 规范 — Runtime, DOM, Page, Network 域方法
- SQLite FTS5 官方文档 — 全文检索扩展、触发器配置
- pi-agent-core README — AgentTool 接口定义、工具注册模式

### Secondary (MEDIUM confidence)
- better-sqlite3 文档 — Node.js SQLite 绑定、FTS5 编译状态
- OWASP 代码注入防护指南 — 安全防护模式
- LLM Prompt Injection 防护最佳实践 — 输入消毒策略

### Tertiary (LOW confidence)
- 自动化操作的网站反检测（reCAPTCHA、Cloudflare）— 需要在实际网站上验证
- FTS5 unicode61 中文分词质量 — 需要用真实中文收藏数据测试

---
*研究完成: 2026-08-02*
*Ready for roadmap: yes*
