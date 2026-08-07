# Phase 27: 媒体面板 - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

用户通过工具栏按钮打开/关闭媒体面板（浮动层，z-index 覆盖页面），查看当前容器检测到的所有媒体资源列表（名称、类型徽标、URL 预览），执行播放（新标签打开）和复制（剪贴板）操作，新检测到媒体时工具栏按钮显示数量提示徽标。

</domain>

<decisions>
## Implementation Decisions

### 面板形态与布局
- **D-01:** 浮动弹出面板，覆盖在页面上方（z-index），不占用侧边栏空间
- **D-02:** 面板从工具栏媒体按钮下方弹出，靠近按钮位置（类似 Chrome 扩展弹窗）
- **D-03:** 点击面板外部区域自动关闭，同时保留关闭按钮
- **D-04:** 面板固定尺寸，宽度约 360px，高度自适应（最大 500px 后滚动），不可拖拽调整

### 媒体列表项展示
- **D-05:** 紧凑列表样式：类型徽标 + 标题或文件名 + URL 预览（域名+文件名），无缩略图
- **D-06:** 类型徽标使用颜色编码：m3u8=蓝、mp4=绿、flv=橙、webm=紫
- **D-07:** 空状态显示提示文字"当前页面未检测到媒体资源"
- **D-08:** URL 展示为"域名+文件名"格式（如 example.com/video.m3u8）

### 工具栏按钮与徽标
- **D-09:** 媒体按钮使用播放三角形图标（▶），SVG 格式
- **D-10:** 数量徽标显示在按钮右上角，红底白字小圆点+数字
- **D-11:** 按钮放在工具栏右侧，与 AI 面板按钮相邻

### 交互行为
- **D-12:** 点击播放按钮时，在新标签页中打开视频 URL 直接播放（而非独立播放器窗口）
- **D-13:** 点击复制按钮后，按钮图标短暂变为勾选图标（✓），1.5 秒后恢复
- **D-14:** 面板打开时，新检测到的媒体自动添加到列表底部（利用 Phase 26 的 onMediaListUpdate 推送机制）

### Claude's Discretion
无 — 所有决策均由用户明确选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` §PANEL — 媒体面板需求 PANEL-01~05
- `.planning/ROADMAP.md` §Phase 27 — 阶段目标和成功标准

### 现有代码参考
- `src/renderer.js` — AI 面板开关逻辑（toggleAIPanel, aiPanelOpen 状态管理），媒体面板可参考同一模式
- `src/index.html` — 工具栏结构和现有面板 HTML 模式
- `src/styles/main.css` — CSS 变量和组件样式模式
- `src/preload.js` — mediaAPI 暴露（getMediaList/play/copyUrl/clearList/onMediaListUpdate）

### 前置阶段决策
- `.planning/phases/26-ipc/26-CONTEXT.md` — 媒体数据模型（D-05~D-08）、列表更新通知机制（D-09~D-12）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `window.mediaAPI` — Phase 26 已暴露 getMediaList/play/copyUrl/clearList/onMediaListUpdate，可直接使用
- AI 面板模式（`toggleAIPanel`）— 面板开关、状态管理、按钮 active 样式切换的完整参考
- `elements` 对象 — DOM 元素引用集中管理模式，媒体面板按钮和面板元素应加入此对象
- CSS 变量系统 — `--bg-primary`、`--text-secondary` 等，面板样式应使用这些变量保持一致

### Established Patterns
- 面板开关：state 布尔值控制 + classList.toggle('hidden') + 按钮 active 样式
- 事件监听：在 `setupEventListeners()` 中集中绑定
- IPC 通道命名：`动词:名词` 格式（如 `media:get-list`）
- 日志前缀：`[Realm Renderer]` 用于渲染进程日志

### Integration Points
- `src/index.html` — 工具栏区域添加媒体按钮，body 末尾添加面板 HTML
- `src/renderer.js` — elements 对象添加引用，setupEventListeners 绑定事件，新增 toggleMediaPanel 函数
- `src/styles/main.css` — 添加面板、列表项、徽标、按钮样式
- `src/preload.js` — 无需修改（mediaAPI 已由 Phase 26 暴露）

</code_context>

<specifics>
## Specific Ideas

无特殊要求 — 用户选择了标准推荐方案

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-媒体面板*
*Context gathered: 2026-08-07*
