# Phase 13: 右键菜单增强 - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

为标签页和网页内元素（图片、超链接、通用区域）提供 Chrome 风格的右键上下文菜单功能。具体能力边界：
- 标签页右键菜单：关闭标签页、关闭其他/左侧/右侧标签页、重新打开已关闭标签页、固定标签页
- 网页通用右键菜单：导航操作（后退/前进/刷新/停止）、页面操作（另存为/打印/添加到收藏夹）、开发者工具（检查元素/查看源代码）、文本操作（全选/复制/粘贴/剪切）
- 图片右键菜单：在新标签页中打开图片、将图片另存为、复制图片、复制图片地址
- 超链接右键菜单：在新标签页中打开、在新容器标签页中打开（子菜单选择容器）、复制链接地址、在后台标签页中打开

</domain>

<decisions>
## Implementation Decisions

### 菜单实现方式
- **D-01:** 使用 Electron 原生 Menu API 构建右键菜单，系统级菜单，性能好
- **D-02:** 主进程统一管理所有菜单逻辑，通过 IPC 与渲染进程通信
- **D-03:** 使用系统原生菜单样式，跟随操作系统风格（macOS/Windows）
- **D-04:** 菜单在鼠标点击位置立即显示，使用系统默认动画

### 上下文检测
- **D-05:** 通过 webview 的 context-menu 事件检测网页右键上下文（图片、链接等）
- **D-06:** 标签页右键通过 Tab 栏 DOM 事件检测

### 标签页右键菜单
- **D-07:** 包含：关闭标签页、关闭其他标签页、关闭左侧标签页、关闭右侧标签页、重新打开已关闭标签页、固定标签页
- **D-08:** 禁用项灰色显示不可点击（如只有一个标签页时禁用"关闭其他标签页"）
- **D-09:** 菜单项之间使用系统默认分隔线分组
- **D-10:** 菜单项显示对应的快捷键

### 网页右键菜单
- **D-11:** 根据右键点击的元素类型动态生成菜单（通用/图片/链接/选中文本）
- **D-12:** 通用菜单包含：导航操作、页面操作、开发者工具、文本操作四大分组
- **D-13:** 导航操作：后退、前进、刷新、停止加载（禁用状态灰色显示）
- **D-14:** 页面操作：另存为、打印、添加到收藏夹
- **D-15:** 开发者工具：检查元素（打开 Chrome DevTools）、查看页面源代码
- **D-16:** 文本操作：全选、复制、粘贴、剪切

### 图片右键菜单
- **D-17:** 包含：在新标签页中打开图片、将图片另存为（系统文件保存对话框）、复制图片（复制图片本身到剪贴板）、复制图片地址

### 超链接右键菜单
- **D-18:** 包含：在新标签页中打开、在新容器标签页中打开（子菜单列出所有容器）、复制链接地址、在后台标签页中打开（新标签页但不切换）

### 菜单交互
- **D-19:** 点击菜单项后自动关闭菜单
- **D-20:** 复制操作后显示 toast 提示"已复制"
- **D-21:** 菜单项显示图标
- **D-22:** 菜单项按 Chrome 浏览器的菜单顺序排列

### Claude's Discretion
- 菜单项的具体图标选择
- toast 提示的具体样式和位置
- 子菜单容器选择器的具体交互细节
- 查看源代码页面的具体实现方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/ROADMAP.md` §Phase 13 — 右键菜单增强目标和成功标准（CTX-01 到 CTX-05）
- `.planning/PROJECT.md` — 项目整体需求和技术约束

### 代码库结构
- `.planning/codebase/CONVENTIONS.md` — 编码规范、命名约定、IPC 通信模式
- `.planning/codebase/STRUCTURE.md` — 项目结构、文件位置、扩展指南
- `.planning/codebase/ARCHITECTURE.md` — 系统架构、组件职责、数据流

### 关键文件（现有实现）
- `main.js` — 主进程，webview 管理、IPC 通道、窗口管理
- `src/renderer.js` — 渲染进程，Tab 管理、webview 创建、状态管理
- `src/preload.js` — contextBridge API 暴露
- `src/index.html` — 主界面结构，包含 Tab 栏

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Electron Menu API**: Electron 原生菜单构建能力，可直接使用 Menu.buildFromTemplate() 和 menu.popup()
- **webview context-menu 事件**: webview 元素支持 context-menu 事件，可获取右键上下文信息
- **Tab 管理逻辑**: renderer.js 中已有完整的 Tab 管理逻辑（创建、关闭、切换），可直接复用
- **容器列表 API**: 已有 getContainers() API，用于构建容器选择子菜单
- **toast 提示模式**: 已有 toast 提示的实现模式，可复用

### Established Patterns
- **IPC 通道命名**: kebab-case 格式，如 `get-containers`、`create-tab`
- **contextBridge API**: 通过 window.realmAPI 暴露方法
- **主进程菜单管理**: Electron Menu 模板在主进程构建，通过 IPC 触发

### Integration Points
- **main.js**: 添加右键菜单构建逻辑、菜单项事件处理、IPC 通道
- **src/renderer.js**: 监听 webview context-menu 事件并通知主进程、Tab 栏右键事件
- **src/preload.js**: 暴露新的菜单相关 API（如 showTabContextMenu、showWebContextMenu）

</code_context>

<specifics>
## Specific Ideas

- 右键菜单完全按照 Chrome 浏览器的菜单项顺序和分组方式排列
- 标签页右键菜单参考 Chrome 的标签页右键菜单
- 图片和链接右键菜单参考 Chrome 的对应菜单
- 容器选择使用子菜单方式，在"在新容器标签页中打开"下方展开子菜单列出所有容器
- 查看源代码在新标签页中显示页面 HTML 源代码

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-右键菜单增强*
*Context gathered: 2026-07-28*
