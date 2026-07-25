# Phase 5: 容器属性扩展 - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

容器支持手机号、邮箱、备注等扩展属性，旧版本数据自动兼容。用户可以在创建和编辑容器时填写这些属性，所有字段可选，填写时进行宽松格式验证。

</domain>

<decisions>
## Implementation Decisions

### 属性字段布局
- **D-01:** 采用单列垂直排列方式，在现有属性（名称、颜色、图标）下方依次显示邮箱、手机号、备注字段
- **D-02:** 每个字段独占一行，与现有表单风格保持一致

### 数据验证规则
- **D-03:** 所有扩展属性（手机号、邮箱、备注）都是可选字段
- **D-04:** 填写时进行宽松格式验证：邮箱检查 @ 格式，手机号检查数字长度（11位）
- **D-05:** 不填写时不显示任何验证错误或提示

### 备注字段限制
- **D-06:** 备注字段使用 textarea 多行输入框
- **D-07:** 备注字段最大长度限制为 500 字符
- **D-08:** 备注字段支持换行输入

### 旧数据兼容策略
- **D-09:** 采用读取时惰性填充策略，每次读取容器数据时检查并填充缺失字段的默认值
- **D-10:** 缺失字段的默认值为空字符串：`phone: ''`, `email: ''`, `notes: ''`
- **D-11:** 不需要启动时批量迁移，减少启动开销

### Claude's Discretion
- 新容器创建时，扩展属性默认为空字符串
- 表单提交时，空字符串字段不会触发验证
- 容器列表和下拉面板不需要显示扩展属性

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — ATTR-01 到 ATTR-05 需求定义
- `.planning/ROADMAP.md` — Phase 5 目标和成功标准

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南
- `.planning/codebase/STACK.md` — 技术栈和依赖

### 关键文件
- `main.js` — 主进程，DEFAULT_CONTAINERS 定义、容器管理逻辑
- `src/renderer.js` — 渲染进程，容器编辑 Modal 逻辑
- `src/index.html` — UI 结构，容器编辑表单
- `src/preload.js` — IPC 接口定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **容器编辑 Modal**: 已存在于 renderer.js，可直接扩展表单字段
- **electron-store**: 已用于容器配置持久化，可直接存储新属性
- **DEFAULT_CONTAINERS**: 已有 name, color, icon 属性，可添加 phone, email, notes

### Established Patterns
- **IPC 通道命名**: kebab-case 格式，如 `get-containers`、`update-container`
- **contextBridge API**: 通过 window.realmAPI 暴露方法
- **表单处理**: 编辑 Modal 使用 state.currentEditContainer 管理表单状态

### Integration Points
- **main.js**: 修改 `updateContainer()` 函数，处理新属性
- **renderer.js**: 修改 `openEditModal()` 和 `saveContainer()` 函数
- **index.html**: 在编辑 Modal 中添加新字段的 HTML 结构
- **preload.js**: 如果需要新的 IPC 通道，在此添加

</code_context>

<specifics>
## Specific Ideas

- 扩展属性字段在现有属性下方用分隔线隔开，视觉上区分基础属性和扩展属性
- 表单字段标签使用中文：邮箱、手机号、备注
- 备注字段使用 textarea，高度适中（约 3-4 行）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 5-容器属性扩展*
*Context gathered: 2026-07-25*
