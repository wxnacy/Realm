# Phase 12: 开发者模式 - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

在设置页面新增"开发者模式"功能，开启后可配置域名列表，自动抓取匹配域名的所有 API 请求并持久化到 SQLite。具体能力边界：
- 设置页面左侧边栏新增"开发者模式"入口，顶部有开关切换按钮（默认关闭）
- 开关关闭时页面下方所有配置元素为禁用状态；开启后恢复可交互
- 域名列表区域：展示已启用抓取的域名，支持删除操作
- 域名添加：从已有域名列表选择 + 手动输入两种方式
- CDP 抓取引擎：自动抓取匹配域名的 API 请求（URL、方法、参数、请求头、Cookie、响应头、响应体）
- 异步写入队列 + 批量 flush，不阻塞页面加载和渲染
- 独立 realm://devrequests 页面查看抓取的请求数据

</domain>

<decisions>
## Implementation Decisions

### CDP 附加策略
- **D-01:** 按需附加 — tab 加载的域名匹配抓取列表时才附加调试器，离开该域名时断开。节省内存，每次附加有微小延迟但可接受
- **D-02:** 主进程统一管理 — main.js 监听 webview 的 did-start-navigation 事件，检查 URL 域名是否在抓取列表中，匹配则附加调试器
- **D-03:** 包含响应体的 CDP 事件 — 抓取 Network.requestWillBeSent + Network.responseReceived + Network.dataReceived + Network.loadingFinished/Failed，可获取完整响应体
- **D-04:** toast 提示 + 继续 — 调试器附加失败或意外断开时弹 toast 提示，但不阻塞页面加载

### SQLite 存储方案
- **D-05:** 容器数据库内存储 — 每个容器的 SQLite 文件中新增 dev_requests 表，复用现有 better-sqlite3 连接
- **D-06:** 每容器独立表 — 如 dev_requests_work、dev_requests_personal，复用 Phase 6 的 per-container 独立表模式，容器 ID 白名单验证 [a-z0-9-] 防 SQL 注入
- **D-07:** 按天数保留 — 用户可配置保留天数（在设置页开发者模式区域配置），自动清理过期数据
- **D-08:** 仅文本响应 — 只存储 Content-Type 为 application/json、text/* 等文本类响应体，跳过二进制内容（图片、视频、文件下载）

### 写入队列设计
- **D-09:** 主进程统一队列 — 所有容器的抓取数据统一收集到主进程内存队列，批量写入对应容器的 SQLite
- **D-10:** 紧急 flush — 队列达到上限（建议 1000 条）时触发紧急 flush，将当前队列全部写入磁盘后再继续接收
- **D-11:** 定时 2 秒 flush — 每 2 秒 flush 一次，不管队列有多少条，对 SQLite 写入友好
- **D-12:** 重试 3 次 + 丢弃 — 写入失败时将失败条目放回队列头部重试，最多 3 次，超过后丢弃并记录 console.error

### 请求数据查看
- **D-13:** 独立 realm://devrequests 页面 — 新建独立的内部页面查看抓取的请求数据，通过设置页链接或工具栏进入
- **D-14:** 表格视图 — 类似 Chrome DevTools Network 面板，表格形式展示 URL、方法、状态码、时间、大小等列
- **D-15:** 行内展开详情 — 点击请求行后在下方展开详情面板，显示 Headers、Body、Response 等标签页，不离开列表页
- **D-16:** 域名 + 方法 + 搜索过滤 — 按域名过滤 + 按请求方法（GET/POST 等）过滤 + 关键词搜索 URL

### Claude's Discretion
- 设置页开发者模式区域的具体 UI 布局和样式细节
- 域名选择器的具体交互方式（下拉选择 vs 自动完成输入框）
- 请求表格的列宽、排序默认值
- realm://devrequests 页面的整体视觉风格
- 写入队列的具体上限值（1000 条为建议值）
- CDP 附加/断开的生命周期管理细节
- 数据保留天数的默认值和范围限制

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/ROADMAP.md` §Phase 12 — 开发者模式目标和成功标准（DEV-01 到 DEV-05）
- `.planning/PROJECT.md` — 项目整体需求和技术约束

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南
- `.planning/codebase/ARCHITECTURE.md` — 系统架构、组件职责、数据流
- `.planning/codebase/STACK.md` — 技术栈和依赖

### 关键文件（现有实现）
- `main.js` — 主进程，webview 管理、IPC 通道、设置 API、本地 HTTP 服务器
- `src/renderer.js` — 渲染进程，webview 创建、Tab 管理、状态管理
- `src/preload.js` — contextBridge API 暴露
- `src/settings.html` — 现有设置页面（Phase 11 重构后带左侧边栏）
- `src/settings-page.js` — 现有设置页面逻辑
- `shortcut-manager.js` — 快捷键管理模块（参考模式）

### 参考实现（Phase 6 历史记录）
- `src/history.html` — realm:// 内部页面布局参考
- `src/history-page.js` — 分页、过滤、SQLite 查询参考

### Phase 11 设置页面重构决策
- `.planning/phases/11-设置页面重构/11-CONTEXT.md` — 左侧边栏布局、导航样式、设置项交互模式

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **better-sqlite3**: 已在 Phase 6 引入，同步 API，每容器独立数据库文件。可直接在现有数据库中新增 dev_requests 表
- **realm:// 协议**: 已有 realm://settings、realm://history、realm://favorites 等内部页面模式，新增 realm://devrequests 即可
- **本地 HTTP 服务器**: main.js 已有 /api/settings/*、/api/cookies/* 等端点模式，新增 /api/devrequests/* 端点
- **electron-store**: 已用于容器配置和设置持久化，可直接存储开发者模式开关和域名列表
- **webview debugger API**: Electron webContents.debugger 可直接附加 CDP 调试器（尚未在项目中使用）

### Established Patterns
- **IPC 通道命名**: kebab-case 格式，如 `get-containers`、`create-tab`
- **contextBridge API**: 通过 window.realmAPI 暴露方法
- **内部页面模式**: realm://xxx → 本地 HTTP 服务器 → src/xxx.html
- **每容器独立表**: Phase 6 已验证的 per-container SQLite 表模式（history_xxx）
- **容器 ID 白名单**: [a-z0-9-] 验证防 SQL 注入（Phase 6 已实现）

### Integration Points
- **main.js**: 添加 CDP 调试器管理逻辑、写入队列、域名列表管理 IPC
- **src/renderer.js**: 监听 webview 事件通知主进程（或主进程直接监听）
- **src/preload.js**: 暴露新的开发者模式 API（getDevMode、setDevMode、getDevDomains 等）
- **src/settings.html / settings-page.js**: 新增开发者模式侧边栏入口和配置页面
- **新建 src/devrequests.html / devrequests-page.js**: 独立的请求查看页面

</code_context>

<specifics>
## Specific Ideas

- 请求查看页面参考 Chrome DevTools Network 面板的表格布局和交互方式
- 域名选择器应该自动列出用户浏览过的域名（从历史记录中提取）
- 写入队列应该有可视化状态指示（如设置页显示"队列中: 42 条"）
- realm://devrequests 页面应该支持实时刷新（新请求自动追加到列表）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-开发者模式*
*Context gathered: 2026-07-27*
