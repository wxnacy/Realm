# Phase 1: Core Container Management + Architecture Refactoring - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

模块化重构 + 容器 CRUD + 管理 UI。将单文件 main.js 拆分为职责单一的模块，实现容器创建/编辑/删除功能，并通过工具栏下拉面板管理容器。

**核心交付：**
1. main.js 按职责拆分为 4 个模块
2. 工具栏下拉面板（Popover）管理容器列表
3. 容器创建/编辑 Modal 对话框
4. 容器删除确认弹窗
5. IPC 通道统一重命名

</domain>

<decisions>
## Implementation Decisions

### 模块拆分策略
- **D-01:** 按职责拆分 main.js → 4 个模块
  - `container-manager.js` — 容器 CRUD + Session 管理
  - `window-manager.js` — BrowserWindow 创建和映射
  - `ipc-handlers.js` — 集中注册所有 IPC 处理器
  - `main.js` — 入口，app.whenReady() + 模块组装
- **D-02:** 直接导入通信 — 模块导出函数，main.js 导入组装，不互相 require
- **D-03:** 统一重命名 IPC 通道（如 `container:list`, `container:create`），同步更新 preload.js

### 容器下拉面板交互
- **D-04:** Popover 弹出层 — 工具栏按钮点击弹出浮动面板，点击外部关闭
- **D-05:** 列表布局 + 底部新建按钮 — 每个容器一行：颜色圆点 + 名称 + 图标，右侧编辑/删除按钮
- **D-06:** 固定宽度 280px，从工具栏按钮下方弹出
- **D-07:** 高亮背景色 + 右侧勾号标识当前活跃容器

### 容器创建/编辑流程
- **D-08:** 统一 Modal 对话框 — 创建和编辑共用同一个 Modal，包含名称、颜色、图标三个字段
- **D-09:** 预设色板 — 8-12 个预设颜色（红、橙、黄、绿、蓝、紫、灰等），点击选择
- **D-10:** 预设 emoji 列表 — 15-20 个预设 emoji 图标（🌐💼👤🏦🎮📚🛒💰🏠📧等），点击选择
- **D-11:** 基础验证 — 名称必填（非空、不重复），颜色和图标有默认值，验证失败显示红色错误提示

### 容器删除确认
- **D-12:** 自定义 Modal 确认弹窗 — 显示容器名称、颜色、图标，提示"删除后该容器的 Cookie 和浏览数据将被清除"
- **D-13:** 禁止删除默认容器（id=default），删除按钮置灰或隐藏
- **D-14:** 删除当前活跃容器时自动切换到默认容器

### Claude's Discretion
无 — 所有决策均已由用户明确选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目规划
- `.planning/PROJECT.md` — 项目概述、核心价值、技术环境、关键决策
- `.planning/REQUIREMENTS.md` — v1 需求列表（CONT-01 至 CONT-06 为本阶段需求）
- `.planning/ROADMAP.md` — 阶段规划和成功标准

### 代码库分析
- `.planning/codebase/STRUCTURE.md` — 目录结构和命名规范
- `.planning/codebase/ARCHITECTURE.md` — 系统架构和组件职责

### 现有代码
- `main.js` — 当前主进程实现（约 250 行），包含容器管理、窗口管理、IPC 处理
- `src/preload.js` — 当前 IPC 桥接实现
- `src/renderer.js` — 当前渲染进程逻辑
- `src/index.html` — 当前 UI 结构
- `src/styles/main.css` — 当前样式定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `configStore` (electron-store): 已配置好，可直接用于容器配置持久化
- `DEFAULT_CONTAINERS` 数组: 包含 4 个默认容器，可作为容器数据结构参考
- `containers` Map: 容器实例存储，拆分后移入 container-manager.js
- `windowContainerMap` Map: 窗口-容器映射，拆分后移入 window-manager.js

### Established Patterns
- IPC 通道命名: `动词-名词` 格式（如 `get-containers`, `create-container`）
- 容器数据结构: `{ id, name, color, icon }`
- Session 隔离: `persist:container-${containerId}` 分区命名
- 日志前缀: `[Realm]` 主进程, `[Realm Renderer]` 渲染进程

### Integration Points
- `main.js:35-49` (initContainers): 容器初始化逻辑，拆分时迁移至 container-manager.js
- `main.js:56-95` (createMainWindow): 窗口创建逻辑，拆分时迁移至 window-manager.js
- `main.js:102-150` (IPC handlers): IPC 处理器，拆分时迁移至 ipc-handlers.js
- `src/preload.js:13-81` (realmAPI): IPC 桥接定义，需要同步更新通道名

</code_context>

<specifics>
## Specific Ideas

- 参考 Firefox Multi-Account Containers 的交互模式
- 参考 AutoBrowser 项目的 Cookie 持久化方案（JSON 文件格式，支持 domain 前缀点号保留）
- 下拉面板而非侧边栏（PROJECT.md 已决定）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-Core Container Management + Architecture Refactoring*
*Context gathered: 2026-07-23*
