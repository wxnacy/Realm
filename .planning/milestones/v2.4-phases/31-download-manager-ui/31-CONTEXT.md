# Phase 31: 下载管理器 — 用户交互 - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

用户通过下载面板管理所有下载任务——查看历史列表、暂停/恢复进行中的下载、操作已下载的文件（打开/Finder/删除）、批量管理。

**核心交付：**
- DL-02: 下载历史列表面板（Chrome 风格下拉 + realm://downloads 独立页面）
- DL-03: 暂停正在进行的下载
- DL-04: 恢复已暂停/中断的下载
- DL-06: 在 Finder 中显示已下载的文件
- DL-07: 删除单条下载记录（可选是否删除本地文件）
- DL-08: 清空所有下载历史

**成功标准：**
1. 用户可以打开下载面板查看所有下载历史列表
2. 用户可以暂停正在进行的下载，稍后恢复
3. 用户可以打开已下载的文件（使用系统默认应用）
4. 用户可以在 Finder 中显示已下载的文件
5. 用户可以删除单条下载记录（可选是否删除本地文件）或清空所有历史

</domain>

<decisions>
## Implementation Decisions

### 下载面板 UI 形态
- **D-01:** 混合模式：Chrome 风格下拉面板（快速预览）+ 底部"查看全部"按钮跳转 `realm://downloads` 独立页面
- **D-02:** 下拉面板只显示最近 N 条下载记录（Chrome 模式），完整列表在 realm://downloads 页面
- **D-03:** 无下载记录时显示空状态提示（"暂无下载记录"文案 + 空图标）
- **D-04:** 面板点击切换打开/关闭（与现有容器下拉面板行为一致）
- **D-05:** 面板显示所有容器的下载记录（不按当前容器过滤）

### 下载列表项展示
- **D-06:** 简洁模式：文件名 + 文件大小 + 下载时间（下拉面板空间有限，不显示来源 URL 和速度）
- **D-07:** 操作按钮为内联图标按钮，hover 时显示（打开文件、Finder、删除）
- **D-08:** 进行中的下载置顶显示，带进度条和速度信息
- **D-09:** 每条记录左侧显示文件类型图标（PDF、图片、视频、文档等），帮助快速识别
- **D-10:** 不同状态视觉区分：完成正常显示，失败/中断用红色/灰色区分

### 暂停/恢复交互模式
- **D-11:** 内联暂停/恢复按钮，进行中的下载右侧直接显示暂停按钮，点击切换为恢复
- **D-12:** 服务器不支持 Range 请求时（canResume=false），恢复按钮静默重新下载
- **D-13:** 网络中断的下载（state=interrupted）显示恢复按钮
- **D-14:** 暂停/恢复支持单条操作和批量操作（面板顶部"全部暂停/恢复"按钮）

### 删除行为设计
- **D-15:** 删除单条记录时弹窗让用户选择「仅删除记录」还是「同时删除文件」
- **D-16:** 提供"清空所有下载历史"按钮，点击后二次确认弹窗
- **D-17:** 进行中的下载可以删除，弹窗确认后取消下载并删除记录
- **D-18:** 支持多选批量删除（Cmd+点击 或 复选框）

### Claude's Discretion
无 — 用户对所有问题都做出了明确选择。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 30 下载管理器核心
- `.planning/phases/30-download-manager-core/30-CONTEXT.md` — Phase 30 决策：保存对话框、进度条、SQLite 表结构、工具栏徽标
- `.planning/phases/30-download-manager-core/30-UI-SPEC.md` — Phase 30 UI 设计规范：颜色、间距、排版、组件模式
- `.planning/phases/30-download-manager-core/30-RESEARCH.md` — Phase 30 技术调研：Electron DownloadItem API、SQLite 模式、IPC 通道设计

### 现有代码模式
- `download-manager.js` — 下载管理器核心模块（Phase 30 已实现），包含 SQLite 表、IPC 处理、进度追踪
- `src/renderer.js` — 渲染进程逻辑，下载按钮和 tooltip 已实现
- `src/preload.js` — IPC 接口暴露模式，downloadAPI 已定义
- `src/index.html` — 主界面结构，下载按钮已添加到工具栏

### 需求文档
- `.planning/REQUIREMENTS.md` — DL-02, DL-03, DL-04, DL-06, DL-07, DL-08 需求定义
- `.planning/ROADMAP.md` — Phase 31 目标和成功标准

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **download-manager.js**: Phase 30 已实现核心引擎，包含 SQLite CRUD、暂停/恢复/取消方法、进度事件广播
- **downloadAPI (preload)**: 已暴露 getDownloads、pauseDownload、resumeDownload、openFile、showInFolder、cancelDownload、getActiveCount 等 API
- **下载按钮 + tooltip**: Phase 30 已实现工具栏下载按钮、圆圈进度环、数字徽标、hover tooltip
- **realm:// 协议**: 已有 realm://history、realm://favorites、realm://settings 等内部页面，可复用模式创建 realm://downloads
- **深色主题 CSS 变量**: 已有完整的颜色系统（--bg-primary、--text-primary 等），新 UI 直接使用

### Established Patterns
- **下拉面板**: 容器下拉面板已有成熟的 toggle 模式（点击切换、点击外部关闭），下载面板复用此交互
- **内部页面 webview**: realm:// 页面在 webview 中加载，通过 HTTP API 或 realmAPI 访问数据
- **IPC 事件广播**: download:started、download:progress、download:completed 事件已定义，面板可监听
- **SQLite 单表 + container_id**: downloads 表已创建，支持按容器查询和全局查询

### Integration Points
- **main.js**: 下载面板 IPC 通道注册（download:list 需扩展支持 limit 参数）
- **src/renderer.js**: 下载按钮点击事件需要打开下拉面板（而非仅 tooltip）
- **src/index.html**: 添加下载面板 HTML 结构
- **src/styles/main.css**: 下载面板样式（参考容器下拉面板样式）
- **realm://downloads**: 新建独立页面 HTML，展示完整下载历史列表

</code_context>

<specifics>
## Specific Ideas

- 用户希望像 Chrome 一样，点击下载按钮弹出下拉面板，底部有"查看全部"按钮跳转完整页面
- 下拉面板简洁预览，完整功能在独立页面
- 面板显示所有容器的下载记录（用户明确选择了全局视图而非按容器过滤）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-下载管理器 — 用户交互*
*Context gathered: 2026-08-12*
