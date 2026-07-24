# Phase 4: Convenience Features - Context

**Gathered:** 2026-07-24
**Status:** Ready for re-planning

<domain>
## Phase Boundary

通过分配规则和快捷键提升多容器浏览效率。用户可以设置规则让特定网站自动在指定容器打开，并使用快捷键快速执行常用操作。

**核心交付：**
1. 容器分配规则 — 指定网站自动在特定容器打开
2. 快捷键 — 常用操作的键盘快捷键
3. 规则管理 UI — 规则的 CRUD、启用/禁用、排序、导入导出
4. 快捷键设置 UI — 查看和自定义快捷键

</domain>

<decisions>
## Implementation Decisions

### 规则匹配模式
- **D-01:** 保持当前的域名级别匹配（精确匹配、通配符 `*.example.com`、子域名匹配）
- **D-02:** 不支持路径匹配、正则表达式或端口匹配 — 保持简单

### 规则冲突处理
- **D-03:** 当多个规则匹配同一 URL 时，返回第一个匹配的规则（按创建顺序）
- **D-04:** 用户可通过删除/禁用规则来调整匹配优先级

### 快捷键作用域（重要变更）
- **D-05:** 快捷键改为仅应用内生效（应用在前台时）
- **D-06:** 不使用 `globalShortcut`（全局注册），改用 `Menu` 加速键或 `before-input-event`
- **D-07:** 避免与系统快捷键和其他应用冲突

### 规则管理增强
- **D-08:** 添加启用/禁用切换按钮 — 快速启用或禁用单条规则，无需编辑
- **D-09:** 添加规则排序 — 支持拖拽排序，控制匹配优先级
- **D-10:** 添加规则导入/导出 — 导出为 JSON 文件，从文件导入，方便备份和分享

### Claude's Discretion
无 — 所有决策均由用户明确选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目规划
- `.planning/PROJECT.md` — 项目概述、核心价值、技术环境、关键决策
- `.planning/REQUIREMENTS.md` — v1 需求列表（CNV-01, CNV-02 为本阶段需求）
- `.planning/ROADMAP.md` — 阶段规划和成功标准

### 代码库分析
- `.planning/codebase/STACK.md` — 技术栈和依赖
- `.planning/codebase/ARCHITECTURE.md` — 系统架构和组件职责
- `.planning/codebase/CONVENTIONS.md` — 编码规范和命名约定

### 现有代码（需要重构）
- `assignment-rules.js` — 分配规则管理模块（CRUD + URL 匹配）
- `shortcut-manager.js` — 快捷键管理模块（需要从 globalShortcut 改为应用内快捷键）
- `ipc-handlers.js` — IPC 处理器
- `src/preload.js` — 渲染进程 API
- `src/renderer.js` — 渲染进程逻辑和 UI
- `main.js` — 应用入口

### Electron API 参考
- Electron Menu 加速键 — https://www.electronjs.org/docs/latest/api/menu
- Electron before-input-event — https://www.electronjs.org/docs/latest/api/web-contents#event-before-input-event

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assignment-rules.js`: 已实现基本 CRUD 和 URL 匹配，可复用
- `configStore` (electron-store): 已配置，可用于规则和快捷键持久化
- `containers` Map: 容器实例存储，用于获取容器信息

### Established Patterns
- IPC 通道命名: `rule:xxx`, `shortcut:xxx` 格式
- 规则数据结构: `{ id, containerId, pattern, enabled, createdAt }`
- 日志前缀: `[Realm]` 主进程, `[Realm Renderer]` 渲染进程

### Integration Points
- `shortcut-manager.js`: 需要重构，从 globalShortcut 改为 Menu 加速键或 before-input-event
- `src/renderer.js`: 需要添加规则排序（拖拽）、启用/禁用切换、导入/导出 UI
- `src/index.html`: 需要添加相应的 HTML 结构
- `src/styles/main.css`: 需要添加排序、切换等样式

</code_context>

<specifics>
## Specific Ideas

- 快捷键改为应用内生效，避免与系统冲突
- 规则排序使用拖拽实现（HTML5 Drag and Drop 或第三方库）
- 规则导入/导出使用 JSON 文件格式
- 启用/禁用切换使用开关（toggle）UI 组件

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 4-Convenience Features*
*Context gathered: 2026-07-24*
