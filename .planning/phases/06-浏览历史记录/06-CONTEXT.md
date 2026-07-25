# Phase 6: 浏览历史记录 - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

应用自动记录用户浏览的页面，按容器隔离存储，用户可以查看、搜索和清理历史记录。

具体能力边界：
- 自动记录页面导航（URL + 标题 + 时间戳）
- 按容器完全隔离存储（SQLite）
- 历史记录列表展示（内部页面 `realm://history`）
- 搜索过滤（标题 + URL 实时匹配）
- 单条删除 + 批量删除
- 超过每容器 10000 条上限时静默 FIFO 淘汰

</domain>

<decisions>
## Implementation Decisions

### UI 入口与导航
- **D-01:** 工具栏添加专用历史记录按钮（时钟/历史图标），点击后在当前容器新 Tab 打开 `realm://history` 内部页面
- **D-02:** 历史记录页面按容器隔离，每个容器只能看到自己的历史记录
- **D-03:** 使用 Electron 的 registerFileProtocol 或 interceptFileProtocol 注册 `realm://history` 协议，加载内部 HTML 页面

### 列表展示形式
- **D-04:** 按日期分组展示：「今天」「昨天」「本周」「本月」「更早」
- **D-05:** 每条记录显示：favicon + 页面标题 + URL + 访问时间，紧凑列表样式
- **D-06:** 参考 Chrome 历史页面的交互风格
- **D-07:** 列表支持滚动加载（分页或虚拟滚动，具体方案由 planner 决定）

### 搜索功能
- **D-08:** 搜索同时匹配页面标题和 URL
- **D-09:** 输入关键词后实时过滤结果（debounce 300ms）
- **D-10:** 搜索结果中高亮匹配的文本

### 数据存储
- **D-11:** 使用 SQLite 数据库存储历史记录（需要引入 better-sqlite3 依赖）
- **D-12:** 按容器隔离：每个容器独立的表或通过 container_id 字段过滤（具体方案由 planner 决定）
- **D-13:** 数据库文件存储在应用的 userData 目录下（与 electron-store 同级）
- **D-14:** 需要建立索引以支持高效的按时间排序、按容器过滤和搜索查询

### 删除操作
- **D-15:** 鼠标悬停在历史记录条目上时显示删除图标，点击直接删除（无确认弹窗）
- **D-16:** 每条记录前面有复选框，支持多选后批量删除
- **D-17:** 批量删除有「全选」快捷操作
- **D-18:** 批量删除前显示确认提示（防误操作）

### 自动清理
- **D-19:** 每容器超过 10000 条记录时自动淘汰最旧的记录（FIFO）
- **D-20:** 淘汰过程对用户无感知，不需要提示

### 历史记录写入时机
- **D-21:** 页面导航完成（did-finish-load 或 did-navigate）时自动记录
- **D-22:** 记录内容：URL、页面标题、访问时间戳、容器 ID
- **D-23:** 以下情况不记录：新标签页（realm://newtab）、历史记录页面本身、about:blank

### Claude's Discretion
- SQLite 数据库的表结构设计
- 具体的 SQL 查询优化策略
- favicon 的获取和缓存策略
- 历史记录页面的 CSS 样式细节
- 分页/虚拟滚动的具体实现方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — HIST-01 到 HIST-07 需求定义
- `.planning/ROADMAP.md` — Phase 6 目标和成功标准

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南
- `.planning/codebase/STACK.md` — 技术栈和依赖
- `.planning/codebase/ARCHITECTURE.md` — 架构设计、进程通信

### 关键文件
- `main.js` — 主进程，容器管理、Session 隔离、IPC 处理
- `src/renderer.js` — 渲染进程，UI 交互逻辑
- `src/index.html` — UI 结构定义
- `src/preload.js` — IPC 接口定义
- `src/styles/main.css` — 样式文件

### 参考实现
- `src/cookie-manager.js` — Cookie 持久化模块，可参考其文件 I/O 模式

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **electron-store (configStore)**: 已用于容器配置持久化，历史记录元数据（如保留天数）可复用
- **Cookie 持久化模块 (cookie-manager.js)**: 展示了文件 I/O 和数据序列化的模式
- **容器下拉面板 UI**: 展示了工具栏按钮 + 下拉面板的交互模式，历史记录按钮可参考
- **Tab 管理系统**: 展示了新 Tab 创建和内部页面加载的流程

### Established Patterns
- **IPC 通道命名**: kebab-case 格式，如 `get-containers`、`create-tab`
- **contextBridge API**: 通过 window.realmAPI 暴露方法
- **Session 隔离**: 每个容器使用独立的 `persist:container-{id}` Session
- **工具栏按钮**: 使用 `.btn-icon` 样式类，通过 `setupEventListeners()` 绑定事件

### Integration Points
- **main.js**: 添加历史记录写入逻辑（监听 webview 导航事件）、IPC 处理器
- **src/preload.js**: 暴露历史记录 API（getHistory、searchHistory、deleteHistory 等）
- **src/renderer.js**: 添加历史记录按钮事件、加载历史记录页面
- **src/index.html**: 添加工具栏历史记录按钮 HTML
- **需要新增**: `src/history-manager.js`（历史记录管理模块）、`src/history.html`（历史记录页面）

</code_context>

<specifics>
## Specific Ideas

- 历史记录页面风格参考 Chrome 的 `chrome://history`，但适配 Realm 的深色主题
- 工具栏历史按钮位置在 URL 输入框右侧，与容器按钮相邻
- favicon 使用 Chromium 的 webContents.getFavicon API 或 Google Favicon API

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 6-浏览历史记录*
*Context gathered: 2026-07-25*
