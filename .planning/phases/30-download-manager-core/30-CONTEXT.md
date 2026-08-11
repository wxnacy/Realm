# Phase 30: 下载管理器 — 核心引擎 - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

用户在浏览器中下载文件时，能看到保存对话框、实时进度，并且下载记录持久化。

**核心交付：**
- DL-01: 下载进度条（文件名、大小、速度、剩余时间）
- DL-05: 打开已下载的文件
- DL-09: 点击下载链接时弹出保存对话框，支持选择保存位置
- DL-10: 工具栏下载按钮显示当前下载数量徽标
- DL-11: 下载数据按容器隔离存储（SQLite）

**成功标准：**
1. 用户点击下载链接时弹出系统保存对话框，可选择保存位置
2. 下载进行时显示实时进度条（文件名、大小、速度、剩余时间）
3. 下载完成后记录持久化到 SQLite，重启后仍可查看
4. 工具栏下载按钮在有活跃下载时显示数量徽标
5. 下载数据按容器隔离存储，不同容器的下载记录互不干扰

</domain>

<decisions>
## Implementation Decisions

### 保存对话框行为
- **D-01:** 使用系统原生对话框（NSSavePanel），而非自定义对话框
- **D-02:** 默认保存位置为 ~/Downloads，可在设置中配置
- **D-03:** 支持"始终保存到此目录"选项，记住用户选择
- **D-04:** 文件名冲突时自动重命名（添加 (1)、(2) 等后缀）

### 进度条展示形式
- **D-05:** 工具栏增加下载按钮，进度在按钮上使用圆圈进度条（类似 Chrome）
- **D-06:** 简洁模式：只显示圆圈进度条，鼠标悬停显示详细信息
- **D-07:** 下载完成后图标变化（绿色对勾），无干扰
- **D-08:** 多个同时下载时显示数字徽标（进行中下载数量）

### SQLite 表结构设计
- **D-09:** 单表 + container_id 列，而非每容器独立表
- **D-10:** 扩展字段：文件名、URL、大小、状态、保存路径、容器ID、开始时间、完成时间、MIME类型、来源网页、下载速度历史
- **D-11:** 扩展状态：progressing、completed、cancelled、interrupted、paused、waiting
- **D-12:** 记录永久保留，用户手动删除

### 工具栏徽标交互
- **D-13:** 点击下载按钮打开下载面板（Phase 31 实现）
- **D-14:** 有活跃下载时显示数字徽标（进行中下载数量）
- **D-15:** 没有下载历史时始终显示下载图标
- **D-16:** 下载按钮放在 URL 输入框右侧，与其他导航按钮一起

### Claude's Discretion
无 — 用户对所有问题都做出了明确选择。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Electron 下载 API
- `main.js` — 现有主进程架构，下载管理器将在此实现
- `src/preload.js` — IPC 接口暴露模式，下载 API 将遵循此模式
- `src/renderer.js` — UI 交互逻辑，下载按钮和进度条将在此实现

### SQLite 数据库
- `src/settings-page.js` — 现有 SQLite 使用模式（better-sqlite3）
- `.planning/codebase/STACK.md` — 技术栈说明（Electron 32.x + better-sqlite3）

### 需求文档
- `.planning/REQUIREMENTS.md` — DL-01, DL-05, DL-09, DL-10, DL-11 需求定义
- `.planning/ROADMAP.md` — 阶段目标和成功标准

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **better-sqlite3**: 已在项目中使用，可直接用于下载记录存储
- **electron-store**: 容器配置存储，可扩展存储下载设置（默认保存位置等）
- **Session partition 机制**: 容器隔离的基础，下载数据将按容器隔离
- **IPC 通信模式**: contextBridge + ipcMain.handle 模式，下载 API 将遵循此模式

### Established Patterns
- **容器隔离**: 每个容器使用独立的 Session partition（`persist:container-{id}`）
- **SQLite 同步 API**: 使用 better-sqlite3 同步 API，性能优于异步
- **UI 无框架**: 渲染进程使用原生 JavaScript，无 React/Vue
- **深色主题**: 应用使用深色主题，下载 UI 需要适配

### Integration Points
- **main.js**: 下载事件监听（will-download）、下载管理器初始化
- **src/preload.js**: 暴露下载 API 给渲染进程（downloadAPI）
- **src/renderer.js**: 下载按钮 UI、进度条显示、下载面板交互
- **src/index.html**: 添加下载按钮到工具栏

</code_context>

<specifics>
## Specific Ideas

- 用户希望像 Chrome 一样，工具栏增加下载按钮，进度在按钮上使用圆圈进度条
- 点击后可以打开下载列表（Phase 31 实现）
- 简洁模式：只显示圆圈进度条，鼠标悬停显示详细信息

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-下载管理器 — 核心引擎*
*Context gathered: 2026-08-11*
