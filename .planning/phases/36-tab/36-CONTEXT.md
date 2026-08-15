# Phase 36: Tab 拖拽与跨窗口移动 - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以通过拖拽在窗口内排序 Tab、将 Tab 拖出创建新窗口、将 Tab 拖到另一个窗口移动。包括窗口位置和大小的持久化恢复，以及右键菜单"在新窗口中打开"功能。

**核心交付：**
- MW-02: 拖拽 Tab 出标签栏创建新窗口
- MW-03: 跨窗口拖拽移动 Tab（源窗口仅剩一个 Tab 时自动销毁）
- MW-04: 窗口内拖拽排序（实时显示插入位置指示器）
- MW-11: 窗口位置和大小持久化（electron-store）
- MW-13: 右键菜单"在新窗口中打开"选项

**从 Phase 35 延续的决策：**
- D-22: 每个 tab 对象增加 windowId 字段，主进程维护全局 Tab Map 作为权威数据源
- D-23: 每个 BrowserWindow 有独立的 renderer.js 实例，窗口间通过主进程中转通信
- D-24: 拖拽移动 Tab 时，事件先发到主进程，主进程更新 Tab 归属后通知目标窗口创建 Tab

</domain>

<decisions>
## Implementation Decisions

### 拖拽技术选型
- **D-25:** 混合方案：窗口内排序使用 HTML5 DnD API（复用 Phase 16 收藏夹排序经验），跨窗口拖拽使用自定义鼠标事件（mousedown/mousemove/mouseup）+ IPC
- **D-26:** 跨窗口通信：拖拽过程中通过 IPC 与主进程实时通信，主进程协调窗口间状态同步

### 拖拽触发机制
- **D-27:** Tab 拖出窗口判定：Chrome 风格，鼠标离开 Tab 栏边缘 + 30px 垂直阈值后触发创建新窗口
- **D-28:** 判定基准是 Tab 栏边缘（不是窗口边缘），主要支持向下拖出，也支持向上拖出

### 视觉反馈设计
- **D-29:** 窗口内插入指示器：垂直插入线（Chrome 风格），显示在两个 Tab 之间
- **D-30:** 跨窗口拖拽预览：Mini 卡片浮动窗口（200px 宽），显示 favicon + 标题，可选容器颜色条
- **D-31:** 目标窗口 Tab 栏反馈：插入位置线 + Tab 栏背景高亮

### 窗口位置持久化
- **D-32:** 保存属性：位置(x, y) + 大小(width, height) + 窗口状态（最大化/最小化）+ 所在显示器信息
- **D-33:** 保存时机：窗口移动/调整大小时实时保存 + 应用退出时保存（双重保障）
- **D-34:** 越界恢复：检测到窗口位置超出所有显示器边界时，居中到主显示器

### 跨窗口拖拽原子性
- **D-35:** 源窗口 Tab 状态：拖拽开始时 Tab 保持原位显示，松手后才移动（Chrome 风格）
- **D-36:** 取消/失败处理：静默回滚，Tab 回到原位，用户无感知
- **D-37:** 无效区域松手：在非 Tab 栏区域（如窗口空白处、桌面）松手时，自动创建新窗口

### Claude's Discretion
- 浮动预览窗口的具体动画效果（跟随鼠标的方式）
- Tab 栏高亮的具体样式（背景色变化程度）
- 窗口位置持久化的存储 key 命名

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — MW-02, MW-03, MW-04, MW-11, MW-13 需求定义
- `.planning/ROADMAP.md` — Phase 36 目标和成功标准

### 研究文档（Phase 34 产出）
- `.planning/research/STACK.md` — Electron 多窗口 API（BrowserWindow, screen, Dock, Menu）
- `.planning/research/FEATURES.md` — Chrome 多窗口行为分析、Table Stakes/Differentiators
- `.planning/research/ARCHITECTURE.md` — 多窗口架构设计、组件改动分析
- `.planning/research/PITFALLS.md` — 21 个陷阱（assertTrustedSender、webview 跨窗口限制等）

### 先前阶段决策
- `.planning/phases/34-multi-window/34-CONTEXT.md` — Phase 34 决策：D-01~D-13，多窗口基础架构
- `.planning/phases/35-tab/35-CONTEXT.md` — Phase 35 决策：D-15~D-24，Tab 窗口关联和全局 Tab Map

### 项目规范
- `CLAUDE.md` — 项目规范：命名规范、代码风格、IPC 通信模式

### 参考实现
- Chromium `TabDragController` — Chrome Tab 拖拽实现参考
  - `chrome/browser/ui/views/tabs/tab_drag_controller.cc`
  - 关键常量：`kVerticalDetachThreshold`（~30px）、`kMinDragDistance`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **HTML5 DnD 实现**：Phase 16 收藏夹排序已验证，可在 `src/renderer.js:2406-2460` 找到完整实现模式
- **windowContainerMap**: 当前已有的窗口-容器映射（Map<windowId, containerId>）
- **managedWindowIds**: Phase 34 新增的窗口 ID 集合，用于 assertTrustedSender 校验
- **windowManager.broadcast()**: Phase 34 新增的广播方法，可向所有窗口发送 IPC 消息
- **Tab 管理函数**: createTab, closeTab, switchTab 等，需要从单窗口重构为多窗口

### Established Patterns
- **CR-7 决策**: getMainWindow 用显式 mainWindowRef 登记，不用 getAllWindows()[0]
- **播放器窗口模式**: Phase 28 已验证非主窗口的 IPC 校验和快捷键隔离
- **Session 隔离**: 每个容器使用独立的 Session partition（`persist:container-{id}`）
- **electron-store**: 已有配置持久化机制，可复用于窗口位置存储

### Integration Points
- **main.js**: 窗口管理、IPC 处理、Tab 管理的主入口，需要增加全局 Tab Map 和拖拽协调
- **src/renderer.js**: 渲染进程 UI 逻辑，需要实现拖拽事件处理和视觉反馈
- **src/preload.js**: contextBridge 暴露 realmAPI，需要新增 Tab 拖拽相关 API
- **window-manager.js**: Phase 34 已重构为 Map + Set，本阶段继续扩展

</code_context>

<specifics>
## Specific Ideas

- 拖拽体验完全参考 Chrome 的实现，用户已经熟悉这种交互模式
- 浮动预览窗口使用无边框、圆角、半透明背景，视觉上像从原窗口"撕下来"的卡片
- 窗口位置持久化使用 electron-store，key 可命名为 `windowBounds`
- 跨窗口拖拽时，主进程需要维护"拖拽状态"（哪个 Tab 正在被拖、从哪个窗口、到哪个窗口）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-Tab 拖拽与跨窗口移动*
*Context gathered: 2026-08-15*
