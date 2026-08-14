# Research Summary: Realm Browser

**Project:** Realm Browser
**Domain:** Electron 32.x 多容器隔离浏览器
**Researched:** 2026-08-14
**Overall confidence:** HIGH

---

## v2.4 多窗口支持

### Executive Summary

v2.4 的核心目标是将 Realm Browser 从单窗口多 Tab 架构扩展为多窗口架构。研究结论表明，Chrome 的多窗口行为是用户的核心参考基准，必须遵循。

**核心发现：**
1. **Chrome 行为明确**：Tab 拖拽出窗口创建新窗口、Tab 拖拽到另一窗口、窗口内排序、窗口关闭自动销毁——这些是用户期望的基础行为
2. **Electron 限制**：`webContents` 不能跨窗口移动，必须序列化状态后重建；HTML5 Drag and Drop API 限定在同一页面，跨窗口需要 IPC 中转
3. **架构影响深远**：当前架构是深度单窗口假设——`windowManager.getMainWindow()` 在 30+ 处调用，`assertTrustedSender()` 硬编码主窗口校验，`tab-manager` 全局 Tab Map 无窗口关联

**关键设计决策：**
- Tab 全局追踪 + 窗口关联（Tab 对象新增 `windowId`）
- IPC 信任模型扩展（从单窗口改为 `managedWindowIds` 集合）
- 每个窗口独立 renderer 状态（加载同一 index.html，各自管理自己窗口的 Tab）
- webview 不能跨窗口移动（Tab 迁移需要重建 webview，接受页面状态丢失）

### Key Findings

**Stack:** 零新依赖——全部基于 Electron 原生 API + 已有依赖（HTML5 Drag and Drop API）
**Architecture:** 四个核心子系统需要重构：窗口管理、Tab 归属、IPC 路由、渲染进程状态
**Critical pitfall:** 跨窗口 drag events 不直接工作，必须通过 IPC 中转

### Implications for Roadmap

Based on research, suggested 4-phase structure:

1. **Phase 1: 窗口管理基础** - 重构 window-manager.js 支持多窗口 Map，扩展 assertTrustedSender
   - Addresses: MW-01 (Dock 新建窗口), MW-08 (Cmd+N)
   - Avoids: getAllWindows()[0] 歧义（已有 CR-7 决策）

2. **Phase 2: Tab 窗口关联** - Tab 对象新增 windowId，activeTabId 改为 Map
   - Addresses: MW-05 (窗口关闭自动销毁)
   - Avoids: 全局 Tab 上限跨窗口回收

3. **Phase 3: 窗口内 Tab 拖拽排序** - HTML5 DnD 实现
   - Addresses: MW-04 (窗口内排序)
   - Avoids: 拖拽视觉反馈问题

4. **Phase 4: Tab 跨窗口移动** - 拖拽出窗口 + 右键菜单"移动到窗口"
   - Addresses: MW-02 (拖拽创建窗口), MW-03 (拖拽到另一窗口)
   - Avoids: webview 跨窗口移动限制

**Phase ordering rationale:**
- Phase 1 -> Phase 2: Tab 窗口关联依赖窗口管理基础
- Phase 2 -> Phase 3: 拖拽排序依赖 Tab 窗口关联
- Phase 2 -> Phase 4: 跨窗口移动依赖 Tab 窗口关联
- Phase 3 || Phase 4: 可并行，无依赖

### Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 零新依赖，HTML5 DnD + Electron 原生 API |
| Features | HIGH | Chrome 行为明确，用户期望清晰 |
| Architecture | HIGH | 现有代码分析完整，改动点明确 |
| Pitfalls | HIGH | Electron 官方文档 + 现有代码库分析 |

### Gaps to Address

- **跨窗口拖拽 UX**: HTML5 DnD 跨窗口不直接工作，需要 IPC 中转协议设计
- **Tab 状态保留**: webview 重建后滚动位置/表单数据丢失，Chrome 也如此但用户可能不满意
- **性能**: 多窗口时 IPC 广播频率需要监控

---

## v2.3 下载管理器 + 自动填充

### Executive Summary

v2.3 的核心目标是补全 Realm Browser 作为浏览器的两个基础能力：**下载管理器**和**表单自动填充**。研究结论明确：这两个功能**零新 npm 依赖**，完全基于 Electron 原生 API（DownloadItem、safeStorage）和已有基础设施（better-sqlite3、cdp-manager.js）实现。

下载管理器的核心挑战在于 **Electron DownloadItem 的时序约束**：`setSavePath()` 只能在 `will-download` 回调内同步调用，异步设置路径会静默失败。断点续传依赖服务端 Range/ETag 支持，不支持时 `resume()` 会从头重新下载。

自动填充的核心挑战在于**安全模型**：`safeStorage` 在 Linux 无密钥管理器时降级为明文加密，必须检测并拒绝存储；容器间凭据必须严格隔离（按 `container_id` 分区查询），否则会违反 Realm 的核心价值——容器数据完全隔离。

### Key Findings

**Stack:** 零新依赖——Electron DownloadItem + safeStorage + better-sqlite3 + cdp-manager.js
**Architecture:** 遵循现有模式：主进程承载业务逻辑，渲染进程负责 UI，通过 IPC 通信，数据按容器隔离
**Critical pitfall:** `will-download` 路径设置时序窗口——`setSavePath()` 只能在回调内同步调用

### Critical Pitfalls

1. **DL-1: `will-download` 路径设置时序 (CRITICAL)** — `setSavePath()` 只能在回调内同步调用
2. **DL-2: 断点续传依赖服务端 (CRITICAL)** — `resume()` 需要服务器支持 Range + Last-Modified + ETag
3. **AF-1: Linux safeStorage 降级为明文 (CRITICAL)** — 无密钥管理器时使用硬编码明文加密
4. **AF-3: 容器间凭据泄漏 (CRITICAL)** — 凭据查询必须带 `container_id` 条件

---

## v2.2 多媒体功能集成

### Executive Summary

v2.2 的核心目标是为 Realm Browser 添加视频源检测、媒体面板和独立播放器窗口功能。视频源检测主要依赖两种互补技术路径：**网络层嗅探**（session.webRequest 拦截）和**页面层检测**（executeJavaScript 注入）。播放器层面，hls.js 和 mpegts.js 覆盖了主流流媒体格式。

### Key Findings

**Stack:** hls.js + mpegts.js（2 个新依赖）+ Electron 原生 API
**Architecture:** 网络嗅探为主 + DOM 检测为辅，独立播放器窗口
**Critical pitfall:** CSP 阻断 executeJavaScript 脚本注入

---

## Sources

- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window)
- [Electron webContents API](https://www.electronjs.org/docs/latest/api/web-contents)
- [Electron DownloadItem API](https://www.electronjs.org/docs/latest/api/download-item)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [MDN HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
- Realm Browser PROJECT.md — 项目约束和现有架构
- Realm Browser CLAUDE.md — 现有实现细节

---
*Last updated: 2026-08-14*
