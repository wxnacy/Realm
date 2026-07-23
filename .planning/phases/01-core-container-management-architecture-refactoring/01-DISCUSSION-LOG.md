# Phase 1: Core Container Management + Architecture Refactoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 1-Core Container Management + Architecture Refactoring
**Areas discussed:** 模块拆分策略, 容器下拉面板交互, 容器创建/编辑流程, 容器删除确认

---

## 模块拆分策略

### Q1: main.js 怎么拆？

| Option | Description | Selected |
|--------|-------------|----------|
| 按职责拆分（推荐） | main.js → container-manager.js + window-manager.js + ipc-handlers.js + app-lifecycle.js。每个模块职责单一，main.js 只做入口和模块组装。结构清晰但文件增多。 | ✓ |
| 按目录拆分 | main.js → containers/ + windows/ 目录，每个目录含 index.js。模块按领域组织，目录结构更清晰，但对当前规模可能过度设计。 | |
| 保持单文件 | 保持单文件，用清晰的注释分区和函数分组。对当前 250 行代码来说最简单，但后续扩展性差。 | |

**User's choice:** 按职责拆分（推荐）
**Notes:** 用户选择按职责拆分，将 main.js 拆成 4 个独立模块

### Q2: 具体拆成几个模块？

| Option | Description | Selected |
|--------|-------------|----------|
| 4 个模块（推荐） | container-manager.js 负责容器 CRUD 和 Session 管理；window-manager.js 负责 BrowserWindow 创建和映射；ipc-handlers.js 集中注册所有 IPC 处理器；main.js 只做 app.whenReady() 和模块组装。 | ✓ |
| 2 个模块 | container-manager.js 包含容器 CRUD + Session 管理 + electron-store 持久化；window-manager.js 包含窗口创建 + IPC 注册 + 应用生命周期。更少文件但模块稍大。 | |
| 5 个模块 | container-manager.js + window-manager.js + ipc-handlers.js + app-lifecycle.js + store.js（electron-store 封装）。store 独立出来方便后续扩展。 | |

**User's choice:** 4 个模块（推荐）
**Notes:** 用户选择标准的 4 模块拆分方案

### Q3: 模块之间怎么通信？

| Option | Description | Selected |
|--------|-------------|----------|
| 直接导入（推荐） | 各模块导出函数，main.js 导入并组装。container-manager 和 window-manager 通过函数调用通信，不互相 require。简单直接。 | ✓ |
| 服务类 + 依赖注入 | 定义 ContainerService 类，包含所有容器操作方法，通过构造函数注入依赖（如 configStore）。更面向对象但对当前规模可能过重。 | |
| 事件驱动 | 模块间通过 EventEmitter 通信，main.js 作为事件总线。解耦彻底但调试困难。 | |

**User's choice:** 直接导入（推荐）
**Notes:** 用户选择简单直接的函数导入方式

### Q4: IPC 接口要改吗？

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现有接口不变（推荐） | 拆分后 IPC 通道名不变（get-containers, create-container 等），preload.js 无需修改，renderer.js 无感知。零破坏性变更。 | |
| 统一重命名 | 借重构机会统一 IPC 命名规范（如 container:list, container:create），同步更新 preload.js。有短期成本但长期更一致。 | ✓ |

**User's choice:** 统一重命名
**Notes:** 用户选择借重构机会统一命名规范

---

## 容器下拉面板交互

### Q1: 面板用什么形式？

| Option | Description | Selected |
|--------|-------------|----------|
| Popover 弹出层（推荐） | 工具栏按钮点击后弹出浮动面板，点击外部区域关闭。类似浏览器扩展弹出层，支持自定义渲染。灵活度高。 | ✓ |
| 下拉列表 | 类似原生 select 但可自定义渲染。点击按钮展开列表，再次点击或选择后收起。交互简单但扩展性有限。 | |

**User's choice:** Popover 弹出层（推荐）

### Q2: 面板内部怎么布局？

| Option | Description | Selected |
|--------|-------------|----------|
| 列表 + 底部新建按钮（推荐） | 每个容器一行，左侧颜色圆点 + 名称 + 图标，右侧编辑/删除按钮。点击容器行进入该容器。底部有"+ 新建容器"按钮。 | ✓ |
| 列表 + 搜索框 | 容器列表 + 顶部搜索框。容器多时方便过滤。但当前默认只有 4 个容器，搜索功能可能过度。 | |
| 网格卡片 | 网格布局，每个容器一个卡片，显示颜色、图标、名称。视觉效果好但占用空间大。 | |

**User's choice:** 列表 + 底部新建按钮（推荐）

### Q3: 面板宽度和位置？

| Option | Description | Selected |
|--------|-------------|----------|
| 固定宽度 + 按钮下方（推荐） | 面板固定宽度（如 280px），从工具栏按钮下方弹出，对齐按钮左侧或右侧。简单可靠。 | ✓ |
| 自适应宽度 | 面板宽度根据容器名称长度自适应，最小 240px，最大 400px。但可能导致面板大小跳动。 | |

**User's choice:** 固定宽度 + 按钮下方（推荐）

### Q4: 当前容器怎么标识？

| Option | Description | Selected |
|--------|-------------|----------|
| 高亮 + 勾号（推荐） | 当前选中的容器在列表中高亮显示（如背景色变化 + 右侧勾号），让用户清楚当前在哪个容器中。 | ✓ |
| 仅高亮背景 | 仅通过背景色高亮，不额外加图标。简洁但不够明显。 | |
| 当前容器置顶 | 当前置顶显示，其余按创建时间排序。但可能导致列表顺序不稳定。 | |

**User's choice:** 高亮 + 勾号（推荐）

---

## 容器创建/编辑流程

### Q1: 创建和编辑用同一套 Modal 吗？

| Option | Description | Selected |
|--------|-------------|----------|
| 统一 Modal（推荐） | 创建和编辑都用 Modal 对话框，包含名称、颜色、图标三个字段。表单复用，逻辑简单。 | ✓ |
| 创建 Modal + 编辑 inline | 创建用 Modal 对话框，编辑在下拉面板中 inline 行内编辑。编辑更快速但需要两套 UI 逻辑。 | |

**User's choice:** 统一 Modal（推荐）

### Q2: 容器颜色怎么选？

| Option | Description | Selected |
|--------|-------------|----------|
| 预设色板（推荐） | 提供 8-12 个预设颜色（如红、橙、黄、绿、蓝、紫、灰等），点击选择。简单直观，覆盖大部分需求。 | ✓ |
| 预设 + 自定义输入 | 预设色板 + 自定义颜色输入（hex 值）。灵活但增加 UI 复杂度。 | |
| 系统颜色选择器 | 使用系统原生颜色选择器（input type=color）。功能完整但 UI 风格可能不统一。 | |

**User's choice:** 预设色板（推荐）

### Q3: 容器图标怎么选？

| Option | Description | Selected |
|--------|-------------|----------|
| 预设 emoji 列表（推荐） | 提供 15-20 个预设 emoji 图标（如 🌐💼👤🏦🎮📚🛒💰🏠📧等），点击选择。无需额外图标库，跨平台一致。 | ✓ |
| 预设 + 自定义输入 | 提供预设 emoji + 用户可输入自定义 emoji。灵活但需要处理无效输入。 | |
| SVG 图标库 | 使用 SVG 图标库（如 Lucide/Heroicons）。专业但需要引入额外依赖。 | |

**User's choice:** 预设 emoji 列表（推荐）

### Q4: 表单验证规则？

| Option | Description | Selected |
|--------|-------------|----------|
| 基础验证（推荐） | 名称必填（非空、不重复），颜色和图标有默认值。验证失败时在输入框下方显示红色错误提示。简单够用。 | ✓ |
| 严格验证 | 名称必填 + 长度限制（如 1-20 字符）+ 不允许特殊字符 + 不重复。更严格但用户体验更好。 | |

**User's choice:** 基础验证（推荐）

---

## 容器删除确认

### Q1: 删除容器时用什么形式确认？

| Option | Description | Selected |
|--------|-------------|----------|
| 自定义 Modal 确认（推荐） | 自定义样式的确认弹窗（Modal），显示容器名称和颜色，提示删除后数据不可恢复。与创建/编辑 Modal 风格统一。 | ✓ |
| 原生 confirm 对话框 | 使用原生 confirm() 对话框。简单但 UI 风格与应用不统一。 | |
| inline 确认 | 在下拉面板中 inline 确认，删除按钮变为"确认删除？"文字，3 秒后恢复。快速但容易误触。 | |

**User's choice:** 自定义 Modal 确认（推荐）

### Q2: 删除确认弹窗中显示哪些信息？

| Option | Description | Selected |
|--------|-------------|----------|
| 基础提示（推荐） | 显示容器名称、颜色、图标，并提示"删除后该容器的 Cookie 和浏览数据将被清除"。简单明了。 | ✓ |
| 详细数据影响提示 | 显示容器信息 + 受影响的数据类型列表（Cookie、LocalStorage、IndexedDB 等）。更详细但可能吓到用户。 | |
| 极简提示 | 仅显示"确定删除容器 [名称] 吗？"。极简但信息不足。 | |

**User's choice:** 基础提示（推荐）

### Q3: 默认容器可以删除吗？

| Option | Description | Selected |
|--------|-------------|----------|
| 禁止删除默认容器（推荐） | 默认容器（id=default）不允许删除，删除按钮置灰或隐藏。防止用户误删核心容器。 | ✓ |
| 允许删除所有容器 | 允许删除所有容器，包括默认容器。但需要额外提示用户后果。 | |

**User's choice:** 禁止删除默认容器（推荐）

### Q4: 删除当前活跃的容器时怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 自动切换到默认容器（推荐） | 如果用户删除当前活跃的容器，自动切换到默认容器。平滑过渡，用户无需手动操作。 | ✓ |
| 让用户选择切换目标 | 弹出提示让用户选择切换到哪个容器。更灵活但增加操作步骤。 | |

**User's choice:** 自动切换到默认容器（推荐）

---

## Claude's Discretion

无 — 所有决策均由用户明确选择

## Deferred Ideas

None — discussion stayed within phase scope
