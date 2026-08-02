# Feature Landscape — v2.1 AI CDP 增强 + Tabbrowser 功能集成

**Domain:** Electron 多容器隔离浏览器 — AI 能力深度增强 + 智能标签管理
**Researched:** 2026-08-02
**Overall confidence:** MEDIUM（基于 CDP 协议官方文档和 Electron API 一手知识，部分自动化场景未经端到端验证）

## 研究范围

本次研究聚焦 v2.1 新增功能，不重复 v1.x 已验证的 Table Stakes。现有能力基线：

| 已有能力 | 说明 |
|----------|------|
| CDP 网络抓取 | `cdp-manager.js` — 域名匹配 + Network 域事件监听 + 请求/响应捕获 |
| AI Manager | `ai-manager.js` — 5 个工具（get_tabs / navigate / search_history / manage_favorites / switch_container）|
| AI Chat UI | 流式输出 + 工具卡片 + 消息操作 + 拖拽面板 |
| 收藏全文搜索 | `favorites-manager.js` — SQLite FTS5 虚拟表 + porter unicode61 分词 |
| 多 Tab 容器隔离 | tab-manager.js + window-manager.js + Session partition |

---

## Table Stakes（本里程碑必须有）

这些功能是 v2.1 核心价值，缺失则里程碑目标不完整。

### Phase 22: CDP 管理器 + 网页读取与链接操作

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **独立 CDP 管理器** (`cdp-manager.js` 扩展) | 当前 CDP 仅用于网络抓取（Network 域），AI Agent 需要读取页面内容和操作 DOM | Medium | 复用 `cdp-manager.js` 的 attach/detach 生命周期，新增 `Page`/`DOM`/`Runtime` 域支持 |
| **read_page_content 工具** | AI 需要理解当前页面内容才能回答问题或执行操作 | Medium | 通过 `Runtime.evaluate` 执行 `document.title` / `document.body.innerText` / `document.querySelector('meta[name="description"]')` 获取标题、正文、元信息 |
| **extract_links 工具** | AI 需要提取页面链接供用户选择或批量操作 | Low | `Runtime.evaluate` 执行 `Array.from(document.querySelectorAll('a[href]')).map(a => ({text: a.textContent.trim(), href: a.href}))` |
| **open_link 工具** | 用户或 AI 指定链接后需要在容器中打开 | Low | 复用 `tabManager.createTab(containerId, url)` 或在指定 webview 中 `loadURL(url)` |

**依赖链：**
```
独立 CDP 管理器
  ├── read_page_content 工具（需要 Runtime.evaluate 能力）
  ├── extract_links 工具（需要 Runtime.evaluate 能力）
  └── open_link 工具（需要 tabManager / webview 导航）
```

**与现有 CDP 的关系：**
现有 `cdp-manager.js` 负责网络请求抓取（Network 域），新功能需要 DOM/Runtime 域。两种方案：
1. **扩展现有 cdp-manager.js**（推荐）：复用 attach/detach 和 debuggerStates，新增方法
2. **独立模块**：新建 `cdp-page-reader.js`，共享 debugger 连接

方案 1 更优，因为 debugger 同一 webContents 只能 attach 一次，共享连接避免冲突。

### Phase 23: 智能上下文引用 + 全文检索

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **@ 引用标签页上下文** | 用户在 AI 对话中需要引用特定标签页内容，而非手动描述 | Medium | 需要：(1) 渲染进程解析 `@tab-title` 语法 (2) 提取被引用标签页的 URL/标题/内容摘要 (3) 将上下文注入 AI 对话的 system prompt 或 user message |
| **全文检索收藏内容** | 当前 `manage_favorites` 工具仅支持标题/URL 搜索，用户期望搜索页面正文内容 | Medium | 需要：(1) 收藏时抓取页面正文存入 FTS5 (2) 搜索时匹配正文内容 (3) 返回匹配片段高亮 |

**@ 引用标签页交互流程：**
```
用户输入 "@GitHub - realm 项目 read_page_content 的实现"
  → 渲染进程解析 @ 前缀
  → 匹配当前标签页列表（模糊匹配标题）
  → 选中 "GitHub - realm-browser" 标签页
  → 自动调用 read_page_content 获取该标签页内容
  → 将内容摘要注入 AI 对话上下文
  → AI 基于注入的上下文回答问题
```

**全文检索收藏的技术路径：**
现有 `favorites-manager.js` 已有 FTS5 虚拟表（`porter unicode61` 分词），当前仅索引 `title` 和 `url`。扩展方案：
1. 收藏时通过 CDP 抓取页面 `document.body.innerText`
2. 存入 `favorites_content` FTS5 表（关联 favorites.id）
3. 搜索时 JOIN 查询返回匹配片段

### Phase 24: 任务自主执行

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **自动化填表** | 用户期望 AI 能自动填写网页表单（登录、注册、搜索等） | High | 需要：(1) CDP Runtime.evaluate 定位表单元素 (2) Input.dispatchKeyEvent 模拟输入 (3) 理解表单语义（email/password/submit） |
| **自动化操作** | 用户期望 AI 能执行页面操作（点击按钮、选择选项、滚动等） | High | 需要：(1) CDP Input.dispatchMouseEvent 模拟点击 (2) Runtime.evaluate 执行 JS 操作 (3) 操作序列化和错误恢复 |

**自动化填表技术路径：**
```javascript
// 步骤 1: 识别表单元素
const formElements = await cdp.sendCommand('Runtime.evaluate', {
  expression: `
    Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
      tag: el.tagName,
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      value: el.value,
      label: el.labels?.[0]?.textContent?.trim()
    }))
  `
});

// 步骤 2: 聚焦并输入
await cdp.sendCommand('Runtime.evaluate', {
  expression: `document.querySelector('#email').focus()`
});
await cdp.sendCommand('Input.dispatchKeyEvent', {
  type: 'keyDown', text: 'user@example.com'
});

// 步骤 3: 提交
await cdp.sendCommand('Runtime.evaluate', {
  expression: `document.querySelector('form').submit()`
});
```

**关键风险：**
- 网站反自动化检测（reCAPTCHA、Cloudflare）→ 需要人工确认机制
- 动态渲染的 SPA 表单（React/Vue）→ 需要等待元素渲染完成
- 跨 iframe 表单 → 需要 Frame 域支持

### Phase 25: 脚本生成 + 智能标签整理

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **一句话生成脚本** | 用户用自然语言描述操作，AI 生成可执行的自动化脚本 | High | 需要：(1) LLM 理解用户意图 (2) 生成 CDP 操作序列 (3) 脚本持久化和回放 |
| **AI 自动标签分组** | 用户打开大量标签页后，AI 自动按主题/域名/用途分组 | Medium | 需要：(1) 分析标签页标题/URL/内容 (2) LLM 或聚类算法分组 (3) 应用 Tab Group API 或 UI 分组 |

**脚本生成架构：**
```
用户: "帮我登录 GitHub 并查看 realm 仓库的 Issues"
  → LLM 解析意图
  → 生成脚本 AST:
     1. navigate('https://github.com/login')
     2. fill('#login_field', 'username')
     3. fill('#password', '***')
     4. click('input[type=submit]')
     5. wait('.dashboard')
     6. navigate('https://github.com/user/realm/issues')
  → 序列化为可执行格式
  → 用户确认后执行
```

**智能标签分组方案：**
| 方案 | 优点 | 缺点 | 推荐场景 |
|------|------|------|----------|
| 域名聚合 | 简单、确定性高 | 无法识别跨域相关性 | 基础分组 |
| LLM 分析标题 | 理解语义 | API 调用成本 | 中等规模标签 |
| 嵌入向量聚类 | 精度高 | 实现复杂 | 大量标签页 |
| 混合方案 | 平衡成本和精度 | 需要调优 | **推荐** |

---

## Differentiators（竞争优势功能）

这些功能让 Realm 在容器浏览器赛道中脱颖而出。

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **容器感知的 AI 上下文** | AI 理解当前容器身份（工作/个人），自动调整回答风格 | Low | 在 system prompt 中注入容器名称、属性（手机号/邮箱/备注） |
| **跨容器内容对比** | AI 对比不同容器中同一网站的内容差异 | Medium | 需要同时读取多个容器的页面内容 |
| **自动化脚本市场** | 用户分享和导入自动化脚本 | Medium | 需要脚本格式标准化 + 导入导出 |
| **操作录制回放** | 录制用户操作生成脚本，支持编辑和重放 | High | 类似 Playwright codegen，但集成在浏览器内 |
| **智能表单记忆** | 记住用户在特定网站的填写内容，下次自动填充 | Medium | 按容器隔离存储表单数据 |
| **AI 浏览摘要** | AI 自动生成当前页面的结构化摘要 | Low | 基于 read_page_content + LLM 摘要 |
| **标签页智能休眠** | AI 判断不活跃标签页并自动休眠，释放内存 | Medium | 结合最后访问时间和内容分析 |

---

## Anti-Features（应该避免的功能）

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **无确认的自动化操作** | 安全风险：AI 可能执行恶意操作（删除、转账等） | 所有写操作（填表、点击、提交）必须用户确认 |
| **页面内容持久化存储** | 隐私风险：用户浏览的页面正文可能包含敏感信息 | 仅在内存中缓存，会话结束即清除 |
| **外部脚本执行** | 安全风险：用户导入的脚本可能包含恶意代码 | 沙箱化执行 + 权限声明 + 用户确认 |
| **跨容器数据泄露** | 违反容器隔离核心价值 | AI 上下文严格按容器隔离，不混合 |
| **自动化绕过网站安全机制** | 法律风险 + 伦理问题 | 遇到 CAPTCHA/2FA 时提示用户手动操作 |
| **LLM 调用阻塞 UI** | 用户体验差 | 所有 LLM 调用异步 + 加载状态 + 取消机制 |
| **全局脚本共享** | 隐私风险：脚本可能包含用户凭证 | 脚本按容器隔离存储，凭证使用占位符 |

---

## Feature Dependencies

```
Phase 22: CDP 管理器扩展
  ├── read_page_content（需要 Runtime.evaluate）
  ├── extract_links（需要 Runtime.evaluate）
  └── open_link（需要 tabManager）

Phase 23: 智能上下文 + 全文检索
  ├── @ 引用标签页 → 依赖 read_page_content（Phase 22）
  └── 全文检索收藏 → 依赖 read_page_content（Phase 22）+ FTS5 扩展

Phase 24: 任务自主执行
  ├── 自动化填表 → 依赖 Runtime.evaluate + Input 域（Phase 22 CDP 扩展）
  └── 自动化操作 → 依赖 Runtime.evaluate + Input 域 + DOM 域

Phase 25: 脚本生成 + 智能标签
  ├── 脚本生成 → 依赖 Phase 24 的自动化能力
  └── 智能标签分组 → 依赖 get_tabs + LLM 分析（Phase 20 AI Manager）
```

### 关键路径

```
CDP 管理器扩展（Phase 22 基础）
  ├── read_page_content（Phase 22 核心工具）
  │   ├── @ 引用标签页（Phase 23）
  │   ├── 全文检索收藏（Phase 23）
  │   └── 自动化填表（Phase 24）
  └── extract_links + open_link（Phase 22 工具）

任务自主执行（Phase 24 基础）
  └── 脚本生成（Phase 25 依赖 Phase 24）

智能标签分组（独立，仅依赖 AI Manager）
```

---

## MVP Recommendation

### Phase 22 MVP（CDP + 网页读取）

优先构建：
1. **CDP 管理器扩展** — 复用现有 attach/detach，新增 Runtime.evaluate 支持
2. **read_page_content** — 最核心工具，后续所有功能的基础
3. **extract_links** — 低成本高价值
4. **open_link** — 复用现有 tabManager

### Phase 23 MVP（上下文 + 搜索）

优先构建：
1. **@ 引用标签页** — 交互创新，差异化亮点
2. **全文检索收藏** — 扩展 FTS5 索引字段

### Phase 24 MVP（自动化）

优先构建：
1. **自动化填表** — 实用价值最高
2. **自动化操作** — 需要设计确认机制

### Phase 25 MVP（脚本 + 标签）

优先构建：
1. **AI 自动标签分组** — 实现相对简单，用户感知强
2. **一句话生成脚本** — 依赖 Phase 24 稳定后实现

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| CDP 页面读取 | HIGH | CDP 协议文档完善，Electron debugger API 成熟 |
| 自动化填表 | MEDIUM | CDP Input 域可用，但网站反自动化检测是未知变量 |
| 全文检索收藏 | HIGH | FTS5 已在项目中使用，扩展路径明确 |
| @ 引用标签页 | MEDIUM | 交互设计需迭代，技术实现路径清晰 |
| 脚本生成 | LOW | 高度依赖 LLM 能力和脚本格式设计，需要原型验证 |
| 智能标签分组 | MEDIUM | 算法成熟，但分组质量需要实际数据验证 |

---

## Sources

- [Chrome DevTools Protocol Documentation](https://chromedevtools.github.io/devtools-protocol/) — CDP 域和方法参考
- [Electron webContents.debugger API](https://www.electronjs.org/docs/latest/api/web-contents#class-debugger) — Electron 调试器 API
- [SQLite FTS5 Extension](https://www.sqlite.org/fts5.html) — FTS5 全文搜索文档
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) — Node.js SQLite 绑定
- 项目现有代码：`cdp-manager.js`、`ai-manager.js`、`favorites-manager.js`

---
*Feature research for: Realm Browser v2.1 AI CDP Enhancement + Tabbrowser Integration*
*Researched: 2026-08-02*
