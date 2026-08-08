# Phase 29: 多媒体播放器设置控制 - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

用户在设置页面新增"多媒体"侧边栏选项，包含播放器功能开关和域名白名单配置。功能开关默认关闭，控制视频探测、媒体面板、播放按钮的显示。域名白名单支持添加/删除域名，默认为"全部"（所有域名都进行探测）。当功能关闭时，MediaSniffer 完全停止、媒体列表清空、播放器按钮隐藏，页面恢复正常浏览器行为（mp4/webm 原生播放，m3u8 显示为文本）。

</domain>

<decisions>
## Implementation Decisions

### 功能开关粒度
- **D-01:** 单一总开关控制所有多媒体功能（嗅探 + 面板 + 播放器），不提供细粒度分项控制
- **D-02:** 全局设置，所有容器共享同一个开关状态，不按容器独立设置
- **D-03:** 存储在 electron-store 的 settings 中（如 `settings.mediaPlayer.enabled`），与其他设置项一致
- **D-04:** 切换开关后即时生效，无需重启应用

### 域名白名单交互
- **D-05:** 标签式 UI：输入框 + 回车添加 + 标签式显示，每个域名一个标签，点击 × 删除
- **D-06:** 白名单过滤模式：白名单为空时 = 全部域名嗅探；白名单非空时 = 仅嗅探白名单中的域名
- **D-07:** 子域名自动包含：白名单包含 example.com 时，自动匹配 www.example.com、api.example.com 等子域名
- **D-08:** 白名单为空时显示提示文字"所有域名都进行探测"和添加域名输入框

### 关闭时的资源释放
- **D-09:** webRequest 监听器：在回调中检查开关状态，关闭时直接 return 不处理（不移除监听器）
- **D-10:** 脚本注入：在 renderer.js 注入脚本前检查开关状态，关闭时跳过注入
- **D-11:** 已打开的播放器窗口：不强制关闭，继续播放直到用户手动关闭
- **D-12:** 媒体列表：清空所有容器的媒体列表，隐藏媒体面板和按钮

### 关闭时的页面行为
- **D-13:** 恢复浏览器原生行为：mp4/webm 在 webview 中原生播放（Chromium 内置支持），不触发下载
- **D-14:** 链接点击恢复正常：点击 m3u8/mp4 链接时触发浏览器原生行为
- **D-15:** m3u8 内容正常显示为文本：m3u8 文件内容在页面中显示为 HLS 播放列表文本

### Claude's Discretion
无 — 所有决策均由用户明确选择

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求文档
- `.planning/REQUIREMENTS.md` — v2.2 里程碑需求（SNIFF/IPC/PANEL/PLAYER 已完成）
- `.planning/ROADMAP.md` §Phase 29 — 阶段目标和成功标准

### 前置阶段上下文
- `.planning/phases/26-ipc/26-CONTEXT.md` — 媒体数据模型 (D-05~D-08)、IPC 通道 (media:get-list, media:play, media:copy-url, media:clear-list)
- `.planning/phases/27-media-panel/27-CONTEXT.md` — 媒体面板 UI 模式、工具栏按钮
- `.planning/phases/28-player/28-CONTEXT.md` — 播放器窗口、资源释放模式

### 现有代码参考
- `media-sniffer.js` — MediaSniffer 类（webRequest 拦截 + 脚本注入 + DOM 监听）
- `main.js:61` — `const mediaSniffer = require('./media-sniffer')` 引用
- `main.js:417-425` — `ses.webRequest.onResponseStarted` 注册点
- `src/renderer.js:849-935` — 媒体检测脚本注入逻辑
- `src/settings.html:16-71` — 设置页面侧边栏导航结构
- `src/settings-page.js` — 设置页面逻辑
- `src/preload.js` — mediaAPI 暴露（getMediaList, play, copyUrl, clearList, onMediaListUpdate）

### 代码库地图
- `.planning/codebase/ARCHITECTURE.md` — 系统架构（主进程/渲染进程/IPC）
- `.planning/codebase/INTEGRATIONS.md` — IPC 通信机制

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `electron-store` — 设置持久化机制，新增 `mediaPlayer.enabled` 和 `mediaPlayer.whitelist` 字段
- `src/settings.html` 侧边栏导航 — 新增"多媒体"侧边栏选项，复用现有 sidebar-item 模式
- `src/settings-page.js` — 设置页面逻辑，新增多媒体设置区域
- `media-sniffer.js` MediaSniffer 类 — 需新增 `enabled` 状态检查和 `clearAll()` 方法
- `src/renderer.js` 脚本注入逻辑 — 需在注入前检查开关状态

### Established Patterns
- 设置页面侧边栏：`<div class="sidebar-item" data-page="xxx">` + SVG 图标 + 标签文字
- 设置页面区域：`<section id="settings-xxx" class="settings-section">` 模式
- electron-store 设置读写：`getSettings()` / `setSetting(key, value)` IPC 通道
- 开发者模式域名管理：输入框 + 列表 + 删除按钮（可参考但改用标签式）

### Integration Points
- `src/settings.html` — 新增多媒体侧边栏选项和内容区域
- `src/settings-page.js` — 新增多媒体设置逻辑（开关切换、白名单管理）
- `src/renderer.js` — 脚本注入前检查开关状态
- `main.js` — webRequest 回调中检查开关状态
- `media-sniffer.js` — 新增 enabled 状态管理和 clearAll 方法

</code_context>

<specifics>
## Specific Ideas

- 设置页面"多媒体"侧边栏选项使用播放器图标（类似媒体面板的 ▶ 图标）
- 域名白名单 UI 参考 Chrome 扩展的权限管理标签式设计
- 功能开关默认关闭（per Success Criteria）
- mp4/webm 关闭时在 webview 中原生播放（与 Chrome 行为一致）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-多媒体播放器设置控制*
*Context gathered: 2026-08-08*
