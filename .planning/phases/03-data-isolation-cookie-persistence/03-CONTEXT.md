# Phase 3: Data Isolation + Cookie Persistence - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

确保每个容器的数据完全隔离，并实现 Cookie 的自动持久化。

**核心交付：**
1. 每个容器的 Cookie、Session、LocalStorage、IndexedDB、HTTP 缓存完全隔离（由 Electron session partition 自动处理）
2. 应用关闭时自动保存每个容器的 Cookie 到独立 JSON 文件
3. 应用启动时自动加载各容器的 Cookie
4. 支持手动导出/导入 Cookie

</domain>

<decisions>
## Implementation Decisions

### 容器删除时的 Cookie 清理
- **D-01:** 删除容器时直接删除对应的 cookie JSON 文件，不保存最新状态
- **D-02:** 同时调用 `session.clearStorageData()` 清理 session 数据

### 孤立 Cookie 文件管理
- **D-03:** 不主动清理孤立的 cookie 文件（删除容器后残留的文件）
- **D-04:** 后续在设置面板中增加手动清理按钮

### Cookie 属性完整性
- **D-05:** 保存 Cookie 时包含 SameSite 属性（Strict/Lax/None）
- **D-06:** 保存 Cookie 时包含 hostOnly 属性

### 数据隔离说明
- **D-07:** Electron session partition（`persist:container-{id}`）自动覆盖 ISO-01 到 ISO-04 的所有隔离需求，无需自定义代码

### Claude's Discretion
无 — 所有决策均已由用户明确选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目规划
- `.planning/PROJECT.md` — 项目概述、核心价值、技术环境、关键决策
- `.planning/REQUIREMENTS.md` — v1 需求列表（ISO-01 至 ISO-04, PST-01 至 PST-03 为本阶段需求）
- `.planning/ROADMAP.md` — 阶段规划和成功标准

### 代码库分析
- `.planning/codebase/STACK.md` — 技术栈和依赖
- `.planning/codebase/ARCHITECTURE.md` — 系统架构和组件职责
- `.planning/codebase/CONVENTIONS.md` — 编码规范和命名约定

### 现有代码
- `cookie-manager.js` — Cookie 管理模块（保存、加载、导出、导入）
- `container-manager.js` — 容器管理模块（Session partition、容器 CRUD）
- `ipc-handlers.js` — IPC 处理器
- `src/preload.js` — 渲染进程 API
- `main.js` — 应用入口

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cookie-manager.js`: 已实现 saveCookies, loadCookies, exportCookies, importCookies
- `container-manager.js`: 已实现 Session partition 管理和容器 CRUD
- `configStore` (electron-store): 已配置，可用于容器配置持久化
- `COOKIE_DIR`: `{userData}/cookies/` 目录已定义

### Established Patterns
- IPC 通道命名: `cookie:xxx` 格式（如 `cookie:save`, `cookie:load`）
- Cookie 文件命名: `{containerId}.json`
- 日志前缀: `[Realm]` 主进程

### Integration Points
- `cookie-manager.js`: 需要修改 deleteContainer 函数，添加 cookie 文件删除逻辑
- `cookie-manager.js`: 需要更新 saveCookies 函数，添加 SameSite 和 hostOnly 属性
- `container-manager.js`: deleteContainer 函数需要调用 cookie-manager 删除 cookie 文件

</code_context>

<specifics>
## Specific Ideas

- 删除容器时直接删除 cookie 文件，不保存
- 孤立文件管理推迟到后续设置面板
- Cookie 保存格式需要包含 SameSite 和 hostOnly 属性
- 数据隔离由 Electron session partition 自动处理，无需额外实现

</specifics>

<deferred>
## Deferred Ideas

### 设置面板清理功能
- 后续在设置面板中增加手动清理孤立 cookie 文件的按钮
- 属于 Phase 4 或后续阶段的功能

</deferred>

---

*Phase: 3-Data Isolation + Cookie Persistence*
*Context gathered: 2026-07-23*
