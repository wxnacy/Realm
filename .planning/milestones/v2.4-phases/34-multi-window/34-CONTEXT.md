# Phase 34: 窗口管理基础 - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以通过多种方式创建和管理多个窗口，每个窗口作为独立的浏览上下文。

**核心交付：**
- MW-01: 用户可以通过 Dock 右击菜单新建窗口
- MW-07: 新窗口继承容器上下文（使用默认容器）
- MW-08: 用户可以使用 Cmd+N 快捷键新建窗口
- MW-09: 用户可以使用 Cmd+Shift+W 关闭窗口
- MW-10: 多窗口时窗口间焦点切换正常工作

**成功标准：**
1. 用户可以通过 Dock 右击菜单选择"新建窗口"创建第二个窗口
2. 用户可以使用 Cmd+N 快捷键新建窗口，新窗口使用默认容器
3. 用户可以使用 Cmd+Shift+W 关闭当前窗口（不影响其他窗口）
4. 多窗口存在时，点击不同窗口可以正常切换焦点，工具栏和 Tab 栏正确响应
5. 所有现有 IPC 通道在多窗口环境下正常工作（assertTrustedSender 扩展为 managedWindowIds 集合）

</domain>

<decisions>
## Implementation Decisions

### 新窗口初始状态
- **D-01:** 新建窗口时第一个 Tab 显示新标签页（常用网站网格），与现有新标签页一致
- **D-02:** 新窗口使用默认容器（default），用户可以手动切换到其他容器
- **D-03:** Dock 右击"新建窗口"和 Cmd+N 快捷键行为完全一致

### 窗口关闭策略
- **D-05:** Cmd+Shift+W 关闭当前窗口（窗口内所有 Tab 一起关闭）
- **D-06:** 如果关闭的是最后一个窗口，应用退出

### 架构决策
- **D-10:** windowManager 从单例 mainWindowRef 改为 Map<windowId, BrowserWindow>
- **D-11:** assertTrustedSender 从硬编码主窗口改为 managedWindowIds 集合校验
- **D-12:** shortcut-manager 的快捷键派发到焦点窗口（BrowserWindow.getFocusedWindow()）
- **D-13:** 播放器窗口保持全局单例（不受多窗口影响）

### Claude's Discretion
以下决策属于 Phase 35 范围（需要 Tab 窗口关联），Phase 34 不实现：
- **D-04:** Cmd+W 关闭当前 Tab；如果关闭的是最后一个 Tab，窗口自动关闭 [Phase 35]
- **D-07:** 每个窗口独立的工具栏状态（URL 输入框、后退/前进按钮、容器选择器） [Phase 35]
- **D-08:** 每个窗口独立的 Tab 栏（显示该窗口的 Tab 列表） [Phase 35]
- **D-09:** 窗口焦点切换时，工具栏和 Tab 栏自动更新为该窗口的状态 [Phase 35]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 研究文档
- `.planning/research/STACK.md` — Electron 多窗口 API（BrowserWindow, screen, Dock, Menu）
- `.planning/research/FEATURES.md` — Chrome 多窗口行为分析、Table Stakes/Differentiators/Anti-Features
- `.planning/research/ARCHITECTURE.md` — 多窗口架构设计、组件改动分析、构建顺序
- `.planning/research/PITFALLS.md` — 21 个陷阱（assertTrustedSender、webview 跨窗口限制等）
- `.planning/research/SUMMARY.md` — 研究执行摘要

### 需求文档
- `.planning/REQUIREMENTS.md` — MW-01, MW-07, MW-08, MW-09, MW-10 需求定义
- `.planning/ROADMAP.md` — Phase 34 目标和成功标准

### 先前阶段决策
- `.planning/phases/33-bug/33-CONTEXT.md` — Phase 33 决策（自动填充相关）
- `.planning/phases/28-player-window/28-CONTEXT.md` — Phase 28 决策：播放器窗口的 getMainWindow 显式登记（CR-7）、非主窗口快捷键不派发主窗口

### 项目规范
- `CLAUDE.md` — 项目规范：命名规范、代码风格、IPC 通信模式
- `main.js` — 当前窗口管理实现（windowContainerMap、mainWindowRef）
- `src/renderer.js` — 当前 Tab 管理实现

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **windowContainerMap**: 当前已有的窗口-容器映射（Map<windowId, containerId>），多窗口扩展时将保留此映射
- **createMainWindow()**: 当前窗口创建函数，多窗口时将重构为 createWindow() 支持创建多个窗口
- **shortcut-manager.js**: 快捷键注册和派发机制，多窗口时需要改为派发到焦点窗口
- **assertTrustedSender**: IPC 信任校验函数，需要从硬编码主窗口改为 managedWindowIds 集合

### Established Patterns
- **CR-7 决策**: getMainWindow 用显式 mainWindowRef 登记，不用 getAllWindows()[0]
- **播放器窗口模式**: Phase 28 已验证非主窗口的 IPC 校验和快捷键隔离
- **Session 隔离**: 每个容器使用独立的 Session partition（`persist:container-{id}`）

### Integration Points
- **main.js**: 窗口管理、IPC 处理、容器管理的主入口
- **src/renderer.js**: 渲染进程 UI 逻辑、Tab 管理
- **src/preload.js**: contextBridge 暴露 realmAPI
- **shortcut-manager.js**: 快捷键注册和派发

### 需要修改的模块（来自研究）
- **window-manager.js**: 从单例改为窗口集合 Map（HIGH 改动量）
- **assertTrustedSender**: 从硬编码主窗口改为 managedWindowIds 集合（HIGH 改动量）
- **shortcut-manager.js**: 从单窗口派发改为焦点窗口派发（MEDIUM 改动量）
- **main.js**: 窗口创建逻辑、IPC 路由（MEDIUM 改动量）

### 不需要修改的模块
- container-manager、cookie-manager、assignment-rules、history-manager、favorites-manager 等全局/按容器隔离的模块

</code_context>

<specifics>
## Specific Ideas

- 新窗口行为与 Chrome 一致：Cmd+N 创建新窗口，带新标签页
- 窗口关闭策略简化：最后 Tab 关闭时窗口自动关闭（不需要额外的 Cmd+Shift+W）
- 播放器窗口保持全局单例，不受多窗口影响
- 多窗口下的 media-sniffer 嗅探结果按 session 隔离，应该没问题

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-窗口管理基础*
*Context gathered: 2026-08-14*
