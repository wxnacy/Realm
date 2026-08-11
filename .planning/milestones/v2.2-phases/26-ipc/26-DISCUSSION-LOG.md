# Phase 26: 视频源检测 + IPC 基础 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-06
**Phase:** 26-视频源检测 + IPC 基础
**Areas discussed:** 嗅探器架构, 媒体数据模型, 列表更新通知机制, 导航生命周期

---

## 嗅探器架构

### Q1: 视频源检测有三种方式，它们应该如何组织？

| Option | Description | Selected |
|--------|-------------|----------|
| 单类统一管理（推荐） | 三种方式封装在 MediaSniffer 类中，统一管理检测结果和生命周期 | ✓ |
| 三模块分离 | 每种检测方式独立模块，各自负责检测逻辑，通过回调向上汇报 | |
| 内联到现有文件 | 完全不封装，直接在 main.js 和 renderer.js 中写逻辑 | |

**User's choice:** 单类统一管理（推荐）

### Q2: 嗅探器代码放在哪里？

| Option | Description | Selected |
|--------|-------------|----------|
| 主进程 media-sniffer.js（推荐） | 所有嗅探逻辑在主进程运行，通过 IPC 向渲染进程推送结果 | ✓ |
| 拆分：主进程 + 渲染进程 | webRequest 在主进程，脚本注入在渲染进程 | |
| 不建新文件 | 嗅探逻辑直接散落在 main.js 和 renderer.js 中 | |

**User's choice:** 主进程 media-sniffer.js（推荐）

### Q3: 脚本注入检测 <video>/<source> 元素应该在什么时机执行？

| Option | Description | Selected |
|--------|-------------|----------|
| dom-ready 时注入（推荐） | 在 webview 的 dom-ready 事件中注入脚本，同时启动 MutationObserver | ✓ |
| 网络请求完成后注入 | 通过 webRequest.onCompleted 监听媒体类型响应后注入 | |
| 页面开始加载时注入 | 在 did-start-loading 事件中注入，尽可能早捕获内容 | |

**User's choice:** dom-ready 时注入（推荐）

### Q4: MutationObserver 应该监听多大范围？

| Option | Description | Selected |
|--------|-------------|----------|
| 监听整个 body（推荐） | childList + subtree + attributes，覆盖所有动态加载场景 | ✓ |
| 监听特定容器 | 只监听 #app、#root 等特定区域 | |
| 定时器轮询 | 使用定时器轮询 document.querySelectorAll 代替 MutationObserver | |

**User's choice:** 监听整个 body（推荐）

---

## 媒体数据模型

### Q5: 检测到的视频 URL 如何去重？

| Option | Description | Selected |
|--------|-------------|----------|
| URL 去重（推荐） | 同一容器内相同 URL 只保留一条记录 | ✓ |
| URL + 容器去重 | URL + 容器 ID 组合去重 | |
| URL + 来源去重 | URL + 检测方式去重 | |

**User's choice:** URL 去重（推荐）

### Q6: 每条媒体记录应该存储哪些字段？

| Option | Description | Selected |
|--------|-------------|----------|
| 基础字段（推荐） | url、type、source、timestamp | |
| 扩展字段 | 基础字段 + title、duration、thumbnail（poster） | ✓ |
| 最简字段 | 只存 URL 和 type | |

**User's choice:** 扩展字段

### Q7: 内存中如何组织媒体数据结构？

| Option | Description | Selected |
|--------|-------------|----------|
| Map 按容器分组（推荐） | Map<containerId, MediaItem[]>，按容器 ID 分组存储 | ✓ |
| 全局 URL Map | Map<url, MediaItem>，全局 URL 到记录的映射 | |
| 全局数组 | 简单数组存储，每次查询时按 containerId 过滤 | |

**User's choice:** Map 按容器分组（推荐）

### Q8: 媒体列表是否需要持久化？

| Option | Description | Selected |
|--------|-------------|----------|
| 仅内存（推荐） | 应用关闭后清空，下次打开页面重新检测 | ✓ |
| 持久化到文件 | 使用 electron-store 持久化到本地文件 | |

**User's choice:** 仅内存（推荐）

---

## 列表更新通知机制

### Q9: 主进程检测到新媒体后，如何通知渲染进程？

| Option | Description | Selected |
|--------|-------------|----------|
| webContents.send 推送（推荐） | 主进程通过 webContents.send('media:list-updated', data) 推送 | ✓ |
| 渲染进程轮询 | 渲染进程定期调用 getMediaList() 轮询 | |
| 事件广播 | 使用 EventEmitter 广播事件 | |

**User's choice:** webContents.send 推送（推荐）

### Q10: 检测到新媒体时，通知应该立即发送还是防抖合并？

| Option | Description | Selected |
|--------|-------------|----------|
| 立即通知（推荐） | 每次检测到新媒体立即通知渲染进程 | ✓ |
| 200ms 防抖 | 短时间内多次检测合并为一次通知 | |
| 批次通知 | 按页面或容器批次通知 | |

**User's choice:** 立即通知（推荐）

### Q11: 通知应该携带什么数据？

| Option | Description | Selected |
|--------|-------------|----------|
| 完整列表（推荐） | 每次通知携带完整的当前容器媒体列表 | ✓ |
| 增量更新 | 每次通知只携带新增的媒体项 | |
| 信号 + 拉取 | 通知只告知"有更新"，渲染进程再调用 getMediaList | |

**User's choice:** 完整列表（推荐）

### Q12: 如果未来支持多窗口，媒体列表应该如何处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 每窗口独立（推荐） | 每个 BrowserWindow 有独立的媒体列表，互不影响 | ✓ |
| 全局共享 | 所有窗口共享同一份媒体列表 | |

**User's choice:** 每窗口独立（推荐）

---

## 导航生命周期

### Q13: SNIFF-05 要求页面导航时清空当前容器的媒体列表。应该在哪个导航事件中清空？

| Option | Description | Selected |
|--------|-------------|----------|
| did-navigate（推荐） | 页面已开始加载新内容，旧视频已不相关 | ✓ |
| did-start-loading | 更早但可能在页面加载失败时也清空了 | |
| will-navigate | 最早但可能在重定向时过早清空 | |

**User's choice:** did-navigate（推荐）

### Q14: 页内锚点跳转应该清空媒体列表吗？

| Option | Description | Selected |
|--------|-------------|----------|
| 跨页面才清空（推荐） | 只在 URL 域名/路径变化时清空，锚点跳转不清空 | ✓ |
| 任何导航都清空 | 任何导航事件都清空，包括页内锚点跳转 | |

**User's choice:** 跨页面才清空（推荐）

### Q15: 切换容器时，是否清空前一个容器的媒体列表？

| Option | Description | Selected |
|--------|-------------|----------|
| 保留所有容器列表（推荐） | 切换容器时不清空任何容器的媒体列表 | ✓ |
| 切换时清空 | 切换容器时清空前一个容器的列表 | |

**User's choice:** 保留所有容器列表（推荐）

### Q16: 关闭 Tab 时，是否清空该 Tab 的媒体列表？

| Option | Description | Selected |
|--------|-------------|----------|
| 关闭 Tab 时清空（推荐） | 关闭 Tab 时清空该 Tab 所属容器的媒体列表 | ✓ |
| 保留列表 | 关闭 Tab 时保留媒体列表 | |

**User's choice:** 关闭 Tab 时清空（推荐）

---

## Claude's Discretion

无 — 所有决策均由用户明确选择

## Deferred Ideas

None — discussion stayed within phase scope
