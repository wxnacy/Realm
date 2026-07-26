# Phase 10: Cookie 管理增强 - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

增强现有 Cookie 管理面板，支持多来源查看、域名过滤、手动保存和单条编辑删除。具体能力边界：
- 切换数据来源（Session 或文件），查看不同来源的 cookie 数据
- 切换查看全部 cookie 或仅当前域名及其子域名的 cookie
- 手动保存按钮，将当前域名及子域名的 cookie 主动保存到文件（合并模式，不覆盖）
- 编辑单个 cookie 的值、过期时间等属性，修改后立即生效
- 删除单个 cookie，删除后立即从 session 和文件中移除

</domain>

<decisions>
## Implementation Decisions

### Cookie 面板布局
- **D-01:** 保持模态框形式（增强版），不改为全页面
- **D-02:** 采用顶部工具栏 + 列表 + 底部操作的三段式布局
- **D-03:** 模态框宽度增加到 700-800px，为新增功能提供足够空间
- **D-04:** Cookie 列表采用分页显示，每页 20-30 条，避免大量数据时性能问题

### 数据来源切换
- **D-05:** 使用标签页（Tab）切换 Session 和 File 数据来源
- **D-06:** 标签页明确标注类型：Session（实时）和 File（持久化）
- **D-07:** 两个标签页显示独立视图，各自显示对应数据源的 Cookie
- **D-08:** 切换标签页时懒加载数据，不预加载两个数据源

### 域名过滤
- **D-09:** 默认自动检测当前标签页的域名进行过滤
- **D-10:** 用户可选过滤范围：仅当前域名 / 包含子域名 / 全部
- **D-11:** 过滤控件放在工具栏内（紧凑设计）
- **D-12:** 过滤按钮点击后展开选项，默认使用"包含子域名"

### Cookie 编辑
- **D-13:** 使用弹窗编辑模态框，不采用行内编辑
- **D-14:** 可编辑字段包括核心字段 + 安全属性（共 8 个）：name、value、domain、path、expirationDate、secure、httpOnly、sameSite
- **D-15:** 编辑后点击保存按钮立即更新 Session 和文件
- **D-16:** 保存成功后显示简短成功提示（如"Cookie 已更新"）

### Claude's Discretion
- Cookie 列表的排序方式（按域名、按名称、按过期时间等）
- 分页控件的具体样式和位置
- 编辑模态框的表单布局和验证逻辑
- 删除 Cookie 的确认机制（是否需要确认对话框）
- Session 和 File 数据源的错误处理策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/ROADMAP.md` — Phase 10 目标和成功标准
- `.planning/ROADMAP.md` §Phase 10 — COOKIE-01 到 COOKIE-04 需求定义

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南
- `.planning/codebase/ARCHITECTURE.md` — 系统架构、组件职责、数据流

### 关键文件（现有实现）
- `cookie-manager.js` — Cookie 管理模块，核心增强目标（添加单条编辑/删除、来源查询）
- `main.js` — 主进程，/api/cookies/* API 端点定义
- `src/renderer.js` — Cookie 管理模态框的渲染进程逻辑
- `src/index.html` — Cookie 管理模态框的 HTML 结构
- `src/styles/main.css` — 样式文件，需要更新模态框样式

### 参考实现
- `src/history.html` — 历史记录页面（全页面参考）
- `src/history-page.js` — 历史记录页面逻辑（分页、过滤参考）
- `src/favorites.html` — 收藏页面（模态框参考）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **cookie-manager.js**: 已有 saveCookies()、loadCookies()、saveAllCookies() 函数，可扩展添加单条编辑/删除
- **Session API**: Electron session.cookies.get/set/remove 可直接操作 Session Cookie
- **本地 HTTP 服务器 (main.js)**: 已有 /api/cookies/* 端点模式，新增编辑/删除端点即可
- **模态框模式**: 已有 cookiesModal 的基础结构和样式，可复用

### Established Patterns
- **IPC 通道命名**: kebab-case 格式，如 `get-containers`、`create-tab`
- **contextBridge API**: 通过 window.realmAPI 暴露方法
- **Session 隔离**: 每个容器使用独立的 `persist:container-{id}` Session
- **API 端点模式**: /api/xxx/* JSON 端点，token 认证

### Integration Points
- **cookie-manager.js**: 核心增强 — 添加单条编辑/删除函数、来源查询函数
- **main.js**: 添加 /api/cookies/* 编辑/删除端点、Session Cookie 操作
- **src/preload.js**: 暴露新的 Cookie 操作 API（如 editCookie、deleteCookie）
- **src/renderer.js**: 增强 cookiesModal 逻辑（来源切换、域名过滤、编辑模态框）
- **src/index.html**: 更新 cookiesModal HTML 结构（工具栏、标签页、分页）
- **src/styles/main.css**: 更新模态框样式（宽度、布局、编辑表单）

</code_context>

<specifics>
## Specific Ideas

- Cookie 管理面板应该保持模态框形式，但增加功能密度
- 数据来源切换使用标签页，明确区分 Session（实时）和 File（持久化）
- 域名过滤默认自动检测当前域名，提供可选的过滤范围
- Cookie 编辑使用独立模态框，提供完整的字段编辑能力
- 保存操作立即生效，并显示简短的成功反馈

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-Cookie管理增强*
*Context gathered: 2026-07-26*
