# Phase 35: Tab 窗口关联 - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

每个 Tab 明确归属到一个窗口，窗口生命周期与 Tab 生命周期正确联动。

**核心交付：**
- MW-05: 关闭窗口时，窗口内所有 Tab 一起关闭；如果是最后一个窗口则退出应用
- MW-06: Tab 拖拽过程中保留 URL、容器、标题、favicon 等状态信息（不丢失）
- MW-12: 窗口标题栏显示当前活动 Tab 所属容器的名称
- MW-14: 窗口标题栏/工具栏显示容器颜色标识

**从 Phase 34 延续的决策（D-04, D-07, D-08, D-09）：**
- D-04: Cmd+W 关闭当前 Tab；如果关闭的是最后一个 Tab，窗口自动关闭
- D-07: 每个窗口独立的工具栏状态（URL 输入框、导航按钮）
- D-08: 每个窗口独立的 Tab 栏
- D-09: 窗口焦点切换时，工具栏和 Tab 栏自动更新

**成功标准：**
1. 关闭窗口时，窗口内所有 Tab 一起销毁；如果是最后一个窗口则退出应用
2. Tab 拖拽过程中保留 URL、容器、标题、favicon 等状态信息（不丢失）
3. 窗口标题栏显示当前活动 Tab 所属容器的名称
4. 窗口标题栏/工具栏显示容器颜色标识，不同容器的窗口视觉上可区分

</domain>

<decisions>
## Implementation Decisions

### 窗口关闭级联
- **D-15:** 关闭窗口时，如果有活跃任务（进行中的下载 + 正在播放的媒体），弹出原生确认对话框（dialog.showMessageBox）；无活跃任务时直接关闭
- **D-16:** 窗口销毁顺序：先显式销毁窗口内所有 Tab 的 webContents，再销毁窗口本身，确保资源正确释放和事件触发
- **D-17:** 活跃任务检测范围：download-item 下载任务 + media-sniffer 检测到的活跃媒体播放

### 窗口标题和容器颜色
- **D-18:** 窗口标题栏格式：`容器名 - 页面标题`，如 "工作 - Google"，与 Chrome 风格一致
- **D-19:** 容器颜色标识位置：Tab 栏顶部 2-3px 彩色边框线，类似 Firefox 容器颜色条
- **D-20:** 颜色更新策略：跟随当前活动 Tab 的容器颜色实时更新
- **D-21:** 默认容器处理：默认容器无颜色，隐藏颜色条

### Tab 管理重构
- **D-22:** Tab 归属关系：每个 tab 对象增加 windowId 字段，主进程维护全局 Tab Map（Map<tabId, {url, container, windowId, ...}>）作为权威数据源
- **D-23:** 渲染进程架构：每个 BrowserWindow 有独立的 renderer.js 实例，只管理本窗口的 Tab，窗口间通过主进程中转通信
- **D-24:** 窗口间 Tab 传递：拖拽移动 Tab 时，事件先发到主进程，主进程更新 Tab 归属后通知目标窗口创建 Tab

### Claude's Discretion
- 拖拽移动 Tab 的具体实现细节（Phase 36 范围）
- Tab 栏内拖拽排序的具体实现（Phase 36 范围）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — MW-05, MW-06, MW-12, MW-14 需求定义
- `.planning/ROADMAP.md` — Phase 35 目标和成功标准

### 研究文档（Phase 34 产出）
- `.planning/research/STACK.md` — Electron 多窗口 API（BrowserWindow, screen, Dock, Menu）
- `.planning/research/FEATURES.md` — Chrome 多窗口行为分析、Table Stakes/Differentiators
- `.planning/research/ARCHITECTURE.md` — 多窗口架构设计、组件改动分析
- `.planning/research/PITFALLS.md` — 21 个陷阱（assertTrustedSender、webview 跨窗口限制等）

### 先前阶段决策
- `.planning/phases/34-multi-window/34-CONTEXT.md` — Phase 34 决策：D-01~D-13，特别是 D-04/D-07/D-08/D-09（deferred to Phase 35）

### 项目规范
- `CLAUDE.md` — 项目规范：命名规范、代码风格、IPC 通信模式
- `main.js` — 当前窗口管理实现（windowContainerMap、mainWindowRef、Tab 管理）
- `src/renderer.js` — 当前 Tab 管理实现（单窗口）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **windowContainerMap**: 当前已有的窗口-容器映射（Map<windowId, containerId>），Phase 34 已扩展为 Map + Set 双重注册表
- **managedWindowIds**: Phase 34 新增的窗口 ID 集合，用于 assertTrustedSender 校验
- **windowManager.broadcast()**: Phase 34 新增的广播方法，可向所有窗口发送 IPC 消息
- **Tab 管理函数**: createTab, closeTab, switchTab 等，需要从单窗口重构为多窗口

### Established Patterns
- **CR-7 决策**: getMainWindow 用显式 mainWindowRef 登记，不用 getAllWindows()[0]
- **播放器窗口模式**: Phase 28 已验证非主窗口的 IPC 校验和快捷键隔离
- **Session 隔离**: 每个容器使用独立的 Session partition（`persist:container-{id}`）
- **download-item 事件**: Electron 原生下载事件，可用于检测活跃下载
- **media-sniffer**: 已有的媒体嗅探模块，可检测活跃媒体播放

### Integration Points
- **main.js**: 窗口管理、IPC 处理、Tab 管理的主入口，需要增加全局 Tab Map
- **src/renderer.js**: 渲染进程 UI 逻辑，需要重构为每窗口独立实例
- **src/preload.js**: contextBridge 暴露 realmAPI，可能需要新增 Tab 相关 API
- **window-manager.js**: Phase 34 已重构为 Map + Set，本阶段继续扩展

</code_context>

<specifics>
## Specific Ideas

- 窗口关闭时的行为与 Chrome 类似：有活跃任务弹确认，无任务直接关闭
- 窗口标题栏格式与 Chrome 一致：容器名 - 页面标题
- 容器颜色条参考 Firefox Multi-Account Containers 的实现
- 主进程维护全局 Tab Map 作为权威数据源，渲染进程只做 UI 展示

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-Tab 窗口关联*
*Context gathered: 2026-08-14*
