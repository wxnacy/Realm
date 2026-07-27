# Phase 11: 设置页面重构 - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

重构设置页面为带左侧边栏导航的多页面布局，将分配规则和快捷键设置从弹窗迁移到设置页面内。具体能力边界：
- 设置页面左侧边栏导航，包含"通用"、"分配规则"、"快捷键设置"、"关于"四个入口
- 点击侧边栏入口切换右侧内容区域，无需弹窗
- "通用"页面显示现有设置功能（默认浏览器、历史保留天数、默认容器、启动行为）
- "分配规则"页面显示规则列表，支持增删改查、拖拽排序、启用/禁用、导入导出
- "快捷键设置"页面显示快捷键列表，支持自定义修改和重置
- "关于"页面显示应用版本信息

</domain>

<decisions>
## Implementation Decisions

### 左侧边栏导航样式
- **D-01:** 采用固定边栏布局，边栏始终可见，类似 Chrome/Firefox 设置页
- **D-02:** 导航项使用图标 + 文字标签样式，视觉层次丰富
- **D-03:** 选中项使用背景高亮条（圆角）表现选中状态，类似 Chrome 设置页
- **D-04:** 边栏宽度约 200-240px（标准宽度），导航项上方有"设置"标题

### 分配规则编辑体验
- **D-05:** 规则采用表格/列表视图展示，每行显示域名、目标容器、匹配类型
- **D-06:** 编辑规则采用展开式编辑面板，在规则行下方展开编辑区域
- **D-07:** 拖拽排序使用 HTML5 原生拖拽 API，复用现有实现
- **D-08:** 启用/禁用规则使用行内开关按钮（toggle），点击立即切换状态

### 快捷键设置交互
- **D-09:** 快捷键按功能分组展示（标签页操作、导航操作、书签操作等），每组有标题分隔
- **D-10:** 修改快捷键采用点击即捕获方式，点击后变为"请按下快捷键..."捕获状态
- **D-11:** 快捷键冲突时显示警告提示"该快捷键已被 [操作名] 使用"，但允许强制覆盖
- **D-12:** 支持单个重置（仅在修改过时显示重置按钮）和页面底部的"重置全部快捷键"按钮

### 通用设置页面内容
- **D-13:** 设置项按功能分组展示，每组有标题（如"浏览器"、"历史记录"、"外观"等）
- **D-14:** 设置项包括：默认浏览器引导、历史保留天数、默认容器设置、启动行为
- **D-15:** 设置项修改后即时生效并自动保存，无需点击保存按钮
- **D-16:** 边栏底部显示应用版本号，点击可进入"关于"页面查看详细信息

### Claude's Discretion
- 设置页面的整体 CSS 样式细节（颜色、间距、动画）
- 各设置项的具体分组方式和标题命名
- 关于页面的具体内容布局
- 导行切换的过渡动画效果
- 导入导出功能的具体实现方式（文件选择器 vs 剪贴板）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/ROADMAP.md` §Phase 11 — 设置页面重构目标和成功标准
- `.planning/REQUIREMENTS.md` — SETT-06 到 SETT-10 需求定义

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南
- `.planning/codebase/STACK.md` — 技术栈和依赖

### 关键文件（现有实现）
- `src/settings.html` — 现有设置页面 HTML 结构
- `src/settings-page.js` — 现有设置页面逻辑
- `shortcut-manager.js` — 快捷键管理模块，包含默认快捷键配置和读写函数
- `main.js` — 主进程，设置相关 IPC 通道和 API 端点
- `src/renderer.js` — 渲染进程，包含规则和快捷键的模态框逻辑
- `src/index.html` — 主界面结构，包含模态框定义
- `src/styles/main.css` — 样式文件

### 参考实现
- `src/history.html` — 历史记录页面（全页面布局参考）
- `src/history-page.js` — 历史记录页面逻辑（分页、过滤参考）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shortcut-manager.js**: 已有 DEFAULT_SHORTCUTS 配置和 getShortcuts()/setShortcuts() 函数，可直接复用
- **HTML5 拖拽实现**: renderer.js 中已有规则拖拽排序的实现，可迁移到新页面
- **规则 CRUD 逻辑**: renderer.js 中已有规则的增删改查逻辑，可迁移复用
- **realm://settings 路由**: 已有设置页面的内部路由机制，复用即可

### Established Patterns
- **IPC 通道命名**: kebab-case 格式，如 `get-containers`、`create-tab`
- **contextBridge API**: 通过 window.realmAPI 暴露方法
- **内部页面模式**: realm://xxx → 本地 HTTP 服务器 → src/xxx.html
- **electron-store**: 配置持久化使用 electron-store

### Integration Points
- **src/settings.html**: 需要重构为带边栏的多页面布局
- **src/settings-page.js**: 需要扩展支持页面切换和新功能
- **src/renderer.js**: 规则和快捷键的模态框逻辑需要迁移到设置页面
- **src/index.html**: 规则和快捷键的模态框 HTML 可能需要保留或移除
- **shortcut-manager.js**: 快捷键管理逻辑保持不变，设置页面调用其 API

</code_context>

<specifics>
## Specific Ideas

- 设置页面参考 Chrome 设置页面的简洁布局，左侧固定边栏 + 右侧内容区域
- 边栏使用深色背景（与应用主题一致），选中项使用圆角高亮条
- 规则列表使用表格视图，支持拖拽排序和行内开关
- 快捷键按功能分组展示，点击即捕获按键组合
- 设置项修改后即时生效，类似 Chrome 设置页的交互体验

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-设置页面重构*
*Context gathered: 2026-07-27*
