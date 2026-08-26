# Phase 33: 自动填充 — 增强 - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以管理已保存的凭据和地址信息。

**核心交付：**
- AF-04: 用户可以在设置页查看和删除已保存的凭据
- AF-06: 用户可以保存地址表单信息（姓名、电话、地址）
- AF-07: 用户可以在地址表单中自动填充已保存的地址信息

**成功标准：**
1. 用户可以在设置页查看和删除已保存的凭据
2. 用户可以保存地址表单信息（姓名、电话、地址），并在地址表单中自动填充

</domain>

<decisions>
## Implementation Decisions

### 凭据管理 UI
- **D-01:** 展示形态：表格列表（类似 Chrome 设置页密码管理器）
- **D-02:** 详情交互：展开式详情（点击行展开显示密码和删除按钮）
- **D-03:** 搜索功能：顶部搜索框，按网站域名或用户名过滤
- **D-04:** 删除方式：支持批量删除（选中多条凭据后批量删除）

### 地址表单字段
- **D-05:** 字段定义：基础三字段 — 姓名、手机号、详细地址（省市区+街道+门牌号）
- **D-06:** 存储策略：每个容器单地址（覆盖写入）
- **D-07:** 保存方式：弹出提示横幅（类似凭据保存），用户确认后保存
- **D-08:** 管理功能：设置页支持查看+编辑已保存的地址

### 地址表单检测
- **D-09:** 检测策略：多字段特征匹配（姓名、手机号、地址字段特征）
- **D-10:** 匹配阈值：2/3 匹配（三个字段中匹配到 2 个即触发）
- **D-11:** 检测关系：统一检测逻辑（与登录表单共用检测框架）
- **D-12:** 检测时机：单次检测（页面加载完成后检测一次）

### Claude's Discretion
无 — 用户对所有问题都做出了明确选择。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 32 自动填充引擎
- `.planning/phases/32-autofill-credential-engine/32-CONTEXT.md` — Phase 32 决策：表单检测策略、保存提示 UI、autofill/fillForm 互斥机制、凭据存储使用 safeStorage
- `.planning/phases/32-autofill-credential-engine/32-UI-SPEC.md` — Phase 32 UI 设计规范（如有）

### Phase 30-31 下载管理器
- `.planning/phases/30-download-manager-core/30-CONTEXT.md` — Phase 30 决策：SQLite 表结构、IPC 通道设计模式
- `.planning/phases/31-download-manager-ui/31-CONTEXT.md` — Phase 31 决策：UI 组件模式、realm:// 页面模式

### 需求文档
- `.planning/REQUIREMENTS.md` — AF-04, AF-06, AF-07 需求定义
- `.planning/ROADMAP.md` — Phase 33 目标和成功标准

### 技术约束
- `CLAUDE.md` — 项目规范：命名规范、代码风格、IPC 通信模式

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **webview-preload.js**: Phase 32 已实现表单检测框架，地址表单检测将复用此框架
- **凭据存储 API**: Phase 32 已实现 credentialAPI（保存/读取/删除），设置页将调用
- **保存提示横幅**: Phase 32 已实现凭据保存提示 UI，地址保存将复用此组件
- **IPC 通信模式**: contextBridge + ipcMain.handle 模式，地址 API 将遵循此模式
- **SQLite + better-sqlite3**: Phase 30-32 已使用，地址存储将使用相同模式
- **深色主题 CSS 变量**: 已有完整颜色系统，设置页 UI 将直接使用

### Established Patterns
- **容器隔离**: 每个容器使用独立的 Session partition（`persist:container-{id}`）
- **SQLite 单表 + container_id**: Phase 30 downloads 表已验证，地址表将使用相同模式
- **realm:// 协议**: 已有 realm://settings 等内部页面，凭据/地址管理将在此实现
- **IPC 事件广播**: download:started、credential:saved 等事件已定义，地址事件将遵循此模式

### Integration Points
- **src/settings-page.js**: 设置页现有结构，凭据/地址管理 UI 将在此扩展
- **src/webview-preload.js**: 表单检测框架，地址表单检测将在此实现
- **main.js**: 凭据/地址存储、IPC 处理将在此实现
- **src/preload.js**: 暴露地址 API 给渲染进程

</code_context>

<specifics>
## Specific Ideas

- 凭据管理 UI 类似 Chrome 设置页密码管理器，用户熟悉
- 地址表单检测与登录表单检测统一框架，减少代码重复
- Bug 修复穿插在功能开发中，保持开发节奏
- 每个 Bug 修复单独提交，便于追溯和回滚

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-自动填充 — 增强 + Bug 修复*
*Context gathered: 2026-08-13*
