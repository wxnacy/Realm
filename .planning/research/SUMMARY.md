# v2.3 Research Summary — 下载管理器 + 自动填充 + Bug 修复

**Project:** Realm Browser
**Domain:** Electron 32.x 多容器隔离浏览器 — 浏览器基础功能补全
**Researched:** 2026-08-11
**Confidence:** HIGH

## Executive Summary

v2.3 的核心目标是补全 Realm Browser 作为浏览器的两个基础能力：**下载管理器**和**表单自动填充**。研究结论明确：这两个功能**零新 npm 依赖**，完全基于 Electron 原生 API（DownloadItem、safeStorage）和已有基础设施（better-sqlite3、cdp-manager.js）实现。这是 v2.3 相比 v2.2（引入 hls.js/mpegts.js）的最大优势——技术风险极低，可专注于功能打磨和用户体验。

下载管理器的核心挑战在于 **Electron DownloadItem 的时序约束**：`setSavePath()` 只能在 `will-download` 回调内同步调用，异步设置路径会静默失败。断点续传依赖服务端 Range/ETag 支持，不支持时 `resume()` 会从头重新下载。这些是文档明确记录但容易忽略的陷阱。

自动填充的核心挑战在于**安全模型**：`safeStorage` 在 Linux 无密钥管理器时降级为明文加密，必须检测并拒绝存储；容器间凭据必须严格隔离（按 `container_id` 分区查询），否则会违反 Realm 的核心价值——容器数据完全隔离。此外，autofill 与现有 CDP fillForm（Phase 24）可能冲突，需要互斥锁机制。

## Key Findings

### Recommended Stack

**零新依赖**——全部基于 Electron 原生 API + 已有依赖。

**核心 API:**
- **Electron DownloadItem**: 文件下载拦截/暂停/恢复/取消/进度追踪——原生 API，无需 electron-dl
- **Electron safeStorage**: 凭据加密存储（macOS Keychain 后端）——替代已停止维护的 keytar
- **CDP Autofill 域**: Chromium 内置表单填充引擎——复用现有 cdp-manager.js 基础设施
- **better-sqlite3** (已有): 下载历史 + 凭据存储——复用，与 history/favorites 模式一致

**关键决策:**
- 下载历史表单表设计（`container_id` 列区分容器），非分表——简化查询
- 凭据加密使用 safeStorage 异步 API（`encryptStringAsync`/`decryptStringAsync`），避免阻塞主线程
- 表单检测在 webview-preload.js 中完成（需要 DOM 上下文），凭据读写走主进程 IPC

### Expected Features

**Must have (table stakes) — 下载管理器:**
- DL-01: 文件下载拦截（`session.on('will-download')`）
- DL-05: 保存对话框（`setSaveDialogOptions`）
- DL-02: 下载历史列表（SQLite 持久化 + `realm://downloads` 页面）
- DL-03: 暂停/恢复
- DL-04: 文件操作（打开/Finder 显示/删除）

**Must have (table stakes) — 自动填充:**
- AF-01: 密码保存提示（webview-preload 检测登录表单提交）
- AF-02: 密码自动填充（域名匹配 + 表单注入）
- AF-03: 凭据管理（realm://settings 页面）

**Should have (differentiators):**
- 下载速度实时显示 + 剩余时间估算
- 来源容器标识（颜色/名称）
- 工具栏下载图标 + 活跃下载徽标
- AF-04: 地址表单支持（`autocomplete` 属性检测）
- 凭据按容器隔离存储

**Defer (v2+):**
- 多线程分片下载（Electron 不原生支持）
- BT/磁力链接支持
- 跨会话断点续传（`createInterruptedDownload` 有局限）
- 密码生成器、跨设备同步、2FA/Passkey 管理
- 信用卡信息保存（合规复杂）

### Architecture Approach

遵循现有模式：**主进程承载业务逻辑，渲染进程负责 UI，通过 IPC 通信，数据按容器隔离**。

**Major components:**
1. **download-manager.js** (新增, 主进程) — 下载拦截、状态机（progressing/completed/cancelled/interrupted）、SQLite 持久化
2. **autofill-manager.js** (新增, 主进程) — safeStorage 加密/解密、凭据 CRUD、域名匹配
3. **webview-preload.js** (修改) — 表单检测（MutationObserver）、凭据填充（DOM 操作）、登录提交监听
4. **download-panel.js** (新增, 渲染进程) — 下载面板 UI 逻辑
5. **ipc-handlers.js** (修改) — 注册 `download:*` 和 `autofill:*` IPC 通道

**数据模型:**
- 下载历史：单表 `downloads`，含 `container_id` 列，按容器过滤
- 凭据：`autofill_credentials` 表，`username_encrypted` + `password_encrypted` 使用 safeStorage BLOB
- 地址：`autofill_addresses` 表，各字段独立加密

### Critical Pitfalls

1. **DL-1: `will-download` 路径设置时序 (CRITICAL)** — `setSavePath()` 只能在回调内同步调用。使用 `setSaveDialogOptions()` 让 Electron 处理对话框，或在回调内直接 `setSavePath()`。异步设置会静默失败。

2. **DL-2: 断点续传依赖服务端 (CRITICAL)** — `resume()` 需要服务器支持 Range + Last-Modified + ETag。不支持时会丢弃已下载字节从头重下。必须检测并告知用户续传能力。

3. **AF-1: Linux safeStorage 降级为明文 (CRITICAL)** — 无密钥管理器时使用硬编码明文加密。必须调用 `getSelectedStorageBackend()` 检查，返回 `basic_text` 时拒绝存储凭据。

4. **AF-3: 容器间凭据泄漏 (CRITICAL)** — 凭据查询必须带 `container_id` 条件，否则容器 A 的密码会在容器 B 中被填充。这是 Realm 容器隔离核心价值的直接威胁。

5. **AF-6: autofill 与 CDP fillForm 冲突 (HIGH)** — 用户级 autofill 和 AI 级 fillForm 可能同时操作同一字段。需要互斥锁 + 优先级规则。

6. **DL-3: `interrupted` 状态歧义 (HIGH)** — `updated` 事件中 interrupted = 可恢复；`done` 事件中 interrupted = 不可恢复。必须按事件名分别处理。

7. **AF-7: 跨域 iframe 凭据注入 (HIGH)** — 恶意页面可通过隐藏 iframe 获取已保存凭据。只在顶层页面触发 autofill，验证 iframe origin 与顶层一致。

## Implications for Roadmap

Based on research, suggested 4-phase structure:

### Phase 1: Download Manager Core
**Rationale:** 下载管理器是用户最直接感知的基础功能缺失。先做核心拦截和保存，建立 download-manager.js 模块骨架。
**Delivers:** 文件下载拦截、保存对话框、基础进度显示、SQLite 持久化
**Addresses:** DL-01, DL-05, 下载进度显示
**Avoids:** DL-1 (时序问题) — 使用 `setSaveDialogOptions` 而非异步 `setSaveDialog`
**Builds:** `download-manager.js`, 修改 `ipc-handlers.js` / `preload.js` / `renderer.js`

### Phase 2: Download Manager Enhancements
**Rationale:** 依赖 Phase 1 的基础模块。暂停/恢复需要处理 DL-2（断点续传）和 DL-3（状态歧义）陷阱。
**Delivers:** 下载历史列表、暂停/恢复/取消、文件操作、重试
**Addresses:** DL-02, DL-03, DL-04
**Avoids:** DL-2 (检测 Range/ETag 支持)、DL-3 (按事件区分 interrupted)、DL-5 (每个容器 Session 注册处理器)
**Builds:** `realm://downloads` 内部页面, 下载面板 UI

### Phase 3: Autofill Core
**Rationale:** 与 Phase 1/2 无依赖，可并行规划。核心是安全模型——必须先解决 safeStorage 平台差异和容器隔离。
**Delivers:** 凭据加密存储、登录表单检测、自动填充、保存提示
**Addresses:** AF-01, AF-02
**Avoids:** AF-1 (Linux basic_text 检测)、AF-3 (容器隔离查询)、AF-4 (异步 API)
**Builds:** `autofill-manager.js`, 修改 `webview-preload.js`

### Phase 4: Autofill Enhancements + Integration
**Rationale:** 依赖 Phase 3 的基础模块。凭据管理 UI + 地址表单 + 与 CDP fillForm 的互斥集成。
**Delivers:** 凭据管理 UI、地址表单支持、settings 页面集成、autofill/fillForm 互斥
**Addresses:** AF-03, AF-04
**Avoids:** AF-6 (互斥锁)、AF-7 (跨域 iframe)、AF-8 (表单字段语义匹配)
**Builds:** 凭据管理 UI, 地址表单检测

### Phase Ordering Rationale

- **Phase 1 -> Phase 2**: 下载历史和暂停/恢复依赖核心拦截模块
- **Phase 3 -> Phase 4**: 凭据管理和地址表单依赖核心加密存储模块
- **Phase 1/2 || Phase 3/4**: 下载和自动填充无技术依赖，可并行开发（但建议串行以控制复杂度）
- 每个 Phase 的末尾都包含对应功能的 "Looks Done But Isn't" 检查清单验证

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Autofill Core):** safeStorage 在 Linux 的降级策略需要实际环境验证；CDP Autofill 域的 `Autofill.trigger` 需要 `DOM.BackendNodeId`，获取流程需细化
- **Phase 4 (Autofill Enhancements):** 地址表单的 `autocomplete` 属性检测在不同网站的覆盖率需要调研

Phases with standard patterns (skip research-phase):
- **Phase 1 (Download Core):** Electron DownloadItem API 文档完善，session 事件拦截模式与 media-sniffer 一致
- **Phase 2 (Download Enhances):** SQLite CRUD + UI 面板，与 history-manager/favorites-manager 模式完全一致

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | 零新依赖，全部基于 Electron 原生 API 官方文档 + 已有依赖 |
| Features | HIGH | 功能边界清晰，与 Chrome/Firefox 内置功能对标明确 |
| Architecture | HIGH | 遵循现有模式（history-manager、favorites-manager），无架构创新 |
| Pitfalls | HIGH | 所有陷阱均来自 Electron 官方文档明确说明 + 现有代码库分析 |

**Overall confidence:** HIGH

### Gaps to Address

- **CDP Autofill 域稳定性**: 文档标注为 Experimental，需要在实际 webview 中验证 `Autofill.trigger` 的可靠性。如果不可靠，降级为 DOM 直接操作（`Input.insertText`）。
- **safeStorage 跨平台行为**: macOS Keychain 行为明确，Linux/Windows 需要实际环境测试。建议 Phase 3 第一步就做平台检测。
- **表单字段匹配覆盖率**: `autocomplete` 属性在中文网站覆盖率可能较低，需要 fallback 到 name/id 语义匹配。AF-8 陷阱中的字段模式表需要持续维护。
- **Bug 修复范围**: 本次研究未覆盖 bug 修复部分，需要在 planning 阶段单独梳理。

## Sources

### Primary (HIGH confidence)
- [Electron DownloadItem API](https://www.electronjs.org/docs/latest/api/download-item) — 完整方法/事件/状态文档
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) — 加密/解密 API（含异步版本）
- [Electron Session will-download](https://www.electronjs.org/docs/latest/api/session#event-will-download) — 下载拦截事件
- [CDP Autofill Domain](https://chromedevtools.github.io/devtools-protocol/tot/Autofill/) — 表单填充协议规范
- Realm Browser CLAUDE.md — 现有架构、CDP fillForm、容器 Session 模式

### Secondary (MEDIUM confidence)
- [MDN HTML autocomplete 属性](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete) — 表单字段标准
- [Web.dev 登录表单最佳实践](https://web.dev/articles/sign-in-form-best-practices) — 表单检测策略参考

---
*Research completed: 2026-08-11*
*Ready for roadmap: yes*
