# Realm Browser

## What This Is

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，支持独立的 Cookie、Session、LocalStorage、IndexedDB 和缓存隔离。用户可以通过工具栏按钮管理容器，在同一窗口内以多 Tab 形式运行不同容器的页面，实现类似 Firefox Multi-Account Containers 的隔离体验。

## Core Value

容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载。

## Requirements

### Validated

<!-- 从现有代码推断的已实现能力 -->

- ✓ Electron 应用基础框架 — 现有
- ✓ 基于 Session partition 的容器隔离机制 — 现有
- ✓ 容器配置持久化（electron-store）— 现有
- ✓ IPC 通信架构（contextBridge）— 现有
- ✓ 基础 UI 框架（HTML/CSS/JS）— 现有
- ✓ 容器管理下拉面板 — Phase 1
- ✓ 容器 CRUD — Phase 1
- ✓ 容器自定义（名称、颜色、图标）— Phase 1
- ✓ 容器切换 — Phase 1
- ✓ 多容器 Tab — Phase 2
- ✓ URL 导航（协议补全/搜索回退/前进后退/刷新停止）— Phase 2
- ✓ Tab 状态持久化与重启恢复 — Phase 2
- ✓ CONT-01: 用户可以创建新容器，设置名称、颜色、图标 — v1.0
- ✓ CONT-02: 用户可以编辑现有容器的名称、颜色、图标 — v1.0
- ✓ CONT-03: 用户可以删除容器（含确认提示）— v1.0
- ✓ CONT-04: 用户可以通过工具栏下拉面板查看所有容器列表 — v1.0
- ✓ CONT-05: 用户可以点击容器进入该容器，后续新 Tab 在该容器中打开 — v1.0
- ✓ CONT-06: 用户可以点击其他容器，在新 Tab 中打开该容器 — v1.0
- ✓ BROW-01: 用户可以在容器中输入 URL 并导航到网页 — v1.0
- ✓ BROW-02: 用户可以使用前进、后退、刷新按钮进行导航 — v1.0
- ✓ BROW-03: 用户可以在同一窗口内打开多个 Tab，每个 Tab 属于不同容器 — v1.0
- ✓ BROW-04: 用户可以关闭 Tab — v1.0
- ✓ BROW-05: 用户可以看到 Tab 标签页标题和容器颜色标识 — v1.0
- ✓ ISO-01: 每个容器的 Cookie 和 Session 完全隔离 — v1.0
- ✓ ISO-02: 每个容器的 LocalStorage 和 IndexedDB 完全隔离 — v1.0
- ✓ ISO-03: 每个容器的 HTTP 缓存完全隔离 — v1.0
- ✓ ISO-04: 用户可以在同一网站同时登录不同容器的不同账号 — v1.0
- ✓ PST-01: 应用关闭时自动保存每个容器的 Cookie — v1.0
- ✓ PST-02: 应用启动时自动加载各容器的 Cookie — v1.0
- ✓ PST-03: Cookie 文件保留 domain 前缀点号格式 — v1.0
- ✓ CNV-01: 用户可以设置容器分配规则 — v1.0
- ✓ CNV-02: 用户可以使用快捷键进行常用操作 — v1.0
- ✓ ATTR-01: 用户可以为容器设置手机号属性 — v1.1
- ✓ ATTR-02: 用户可以为容器设置邮箱属性 — v1.1
- ✓ ATTR-03: 用户可以为容器设置备注属性 — v1.1
- ✓ ATTR-04: 容器属性在编辑容器 Modal 中展示和编辑 — v1.1
- ✓ ATTR-05: 旧版本容器数据自动兼容 — v1.1
- ✓ HIST-01: 应用自动记录用户访问的页面 URL 和标题 — v1.1
- ✓ HIST-02: 历史记录按容器隔离存储 — v1.1
- ✓ HIST-03: 用户可以查看当前容器的历史记录列表 — v1.1
- ✓ HIST-04: 用户可以搜索历史记录 — v1.1
- ✓ HIST-05: 用户可以删除单条历史记录 — v1.1
- ✓ HIST-06: 用户可以清空当前容器的历史记录 — v1.1
- ✓ HIST-07: 历史记录自动清理（每容器上限 10000 条） — v1.1
- ✓ FAV-01: 用户可以收藏当前页面 — v1.1
- ✓ FAV-02: 用户可以取消收藏已收藏页面 — v1.1
- ✓ FAV-03: 用户可以查看收藏列表 — v1.1
- ✓ FAV-04: 用户可以编辑收藏项的标题 — v1.1
- ✓ FAV-05: 用户可以删除收藏项 — v1.1
- ✓ FAV-06: 用户可以搜索收藏 — v1.1
- ✓ FAV-08: 同一 URL 不能重复收藏（全局唯一） — v1.1
- ✓ FAV-09: 收藏数据全局共享 — v1.1
- ✓ FAV-10: 切换容器时收藏列表保持一致 — v1.1
- ✓ FREQ-01: 新标签页展示常用网站网格 — v1.1
- ✓ FREQ-02: 常用网站基于 frecency 算法排序 — v1.1
- ✓ FREQ-03: 常用网站按域名聚合 — v1.1
- ✓ FREQ-04: 常用网站显示 favicon — v1.1
- ✓ FREQ-05: 常用网站合并所有容器历史记录 — v1.1
- ✓ SETT-01: 用户可以打开设置页面 — v1.1
- ✓ SETT-02: 设置页面包含默认浏览器引导功能 — v1.1
- ✓ SETT-03: 默认浏览器使用当前容器打开外部链接 — v1.1
- ✓ SETT-04: 设置持久化（electron-store） — v1.1
- ✓ SETT-05: 设置页面包含历史记录保留天数配置 — v1.1
- ✓ SETT-09: 规则导出→导入往返可用，失败时 toast 显示真实原因 — Phase 11
- ✓ 设置页面侧边栏多页面布局（通用/分配规则/快捷键设置/关于） — Phase 11
- ✓ 分配规则与快捷键设置从弹窗迁移入设置页面 — Phase 11
- ✓ DEV-01: 设置页开发者模式开关，关闭时配置区禁用 — Phase 12
- ✓ DEV-02: 抓取域名列表管理（选择/手动添加/删除，精确+子域名匹配） — Phase 12
- ✓ DEV-03: CDP 自动附加匹配域名 webview，抓取 URL/方法/请求头/Cookie/响应头/响应体 — Phase 12
- ✓ DEV-04: realm://devrequests 请求查看页（表格/详情/过滤/分页/清空/容器切换） — Phase 12
- ✓ DEV-05: 抓取数据按容器分表持久化 SQLite，异步队列批量 flush 不阻塞页面 — Phase 12
- ✓ CTX-01: 标签页右键菜单（关闭/关闭其他/左右侧/重新打开已关闭/固定） — Phase 13
- ✓ CTX-02: 网页通用右键菜单（导航/另存为/打印/查看源代码/检查元素/文本编辑） — Phase 13
- ✓ CTX-03: 图片右键专属菜单（新标签页打开/另存为/复制图片/复制图片地址） — Phase 13
- ✓ CTX-04: 链接右键专属菜单（新标签页/后台打开/容器中打开/复制链接地址） — Phase 13
- ✓ CTX-05: 菜单项功能与 Chrome 浏览器一致（LIFO 恢复、固定 Tab favicon 持久化） — Phase 13

### Active

<!-- 当前需要构建的功能（下一里程碑定义） -->

**v2.0 收藏夹文件夹支持 + AI Agent 集成** (2026-07-28)

#### 收藏夹文件夹支持
- FOLDER-01: 创建文件夹 — Phase 14
- FOLDER-02: 重命名文件夹 — Phase 14
- FOLDER-03: 删除文件夹 — Phase 14
- FOLDER-04: 移动收藏到文件夹 — Phase 14
- FOLDER-05: 文件夹树状导航 — Phase 15
- FOLDER-06: 面包屑导航 — Phase 15
- FOLDER-07: 拖拽排序 — Phase 16
- FOLDER-08: 右键菜单（收藏夹页面）— Phase 15

#### Chrome 书签导入
- IMPORT-01: 自动读取 Chrome 本地书签 — Phase 17
- IMPORT-02: 支持 HTML 书签文件导入 — Phase 17
- IMPORT-03: 导入进度和冲突处理 — Phase 17

#### 收藏栏
- BAR-01: 收藏栏固定显示 — Phase 18
- BAR-02: 收藏栏项目交互 — Phase 18
- BAR-03: 收藏栏右键菜单 — Phase 18
- BAR-04: 收藏栏显示/隐藏设置 — Phase 18

#### AI Agent 集成（基于 pi-agent-core）
- AI-01: Node.js 版本验证和基础架构 — Phase 19
- AI-02: AI Manager 核心功能 — Phase 20
- AI-03: AI 聊天面板 UI — Phase 21

### Out of Scope

- **浏览器扩展支持** — 本期不支持 Chrome/Firefox 扩展
- **书签/历史同步** — 本期不实现跨容器同步
- **网络代理隔离** — 本期不实现每个容器独立代理
- **移动端支持** — 仅支持桌面端（macOS）
- **Chrome 多 Profile 导入** — 仅支持 Default Profile
- **收藏栏多行显示** — 仅支持单行显示

## Current State

**Shipped:** v1.3 (2026-07-27)
- 13 phases complete (4 v1.0 + 5 v1.1 + 3 v1.2 + 1 v1.3)
- 所有里程碑已完成归档
- 技术栈：Electron 32.x + better-sqlite3 + electron-store + Chrome DevTools Protocol

**Key features delivered:**
- 多容器隔离浏览器（Cookie/Session/Storage/缓存完全隔离）
- 容器 CRUD + 多 Tab + URL 导航 + 分配规则 + 快捷键
- 容器扩展属性（手机号/邮箱/备注）+ 惰性填充兼容
- 浏览历史记录（SQLite + 每容器隔离 + realm:// 协议）
- 收藏夹管理（全局共享数据库 + 星标按钮 + CRUD）
- frecency 常用网站推荐 + 应用设置页面（侧边栏多页面布局）
- Cookie 管理面板（session/file 双视图）+ 开发者模式（CDP 抓取 API 请求 + devrequests 查看页）
- 右键菜单增强（Tab/网页通用/图片/链接上下文菜单，固定 Tab favicon，已关闭标签 LIFO 恢复）

**Known gaps:**
- 09-04: checkBookmarkStatus realm:// 早退守卫移除（deferred）
- 12 个已诊断 debug session 未修复

## Context

**技术环境：**
- Electron 32.x + Node.js
- 主进程管理 Session 和窗口
- 渲染进程通过 contextBridge 暴露 IPC 接口
- electron-store 持久化容器配置

**参考实现：**
- Firefox Multi-Account Containers 的交互模式
- AutoBrowser 项目的 Cookie 持久化方案（JSON 文件格式，支持 domain 前缀点号保留）

**代码库状态：**
- v1.3 已 shipped，包含完整的多容器浏览器功能 + 历史记录 + 收藏夹 + 常用网站 + 设置 + 开发者模式 + 右键菜单
- 13 个阶段完成，26/27 计划完成（1 plan deferred），69/69 需求全部实现
- 技术栈：Electron 32.x + better-sqlite3 + electron-store + Chrome DevTools Protocol

## Constraints

- **Tech Stack**: Electron 32.x — 项目已选定，不可更改
- **Platform**: macOS — 主要开发和测试平台
- **Compatibility**: Chromium 内核 — 需兼容主流网站
- **Performance**: 容器切换不能有明显延迟

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 使用 Electron Session partition 实现隔离 | Electron 原生支持，成熟稳定 | ✓ 已验证 — Phase 1/2 UAT 通过 |
| Cookie 持久化使用 JSON 文件格式 | 参考 AutoBrowser 实现，便于调试和迁移 | ✓ 已验证 — Phase 3 UAT 通过 |
| 单窗口多 Tab 架构 | 参考 Firefox Multi-Account Containers 体验 | ✓ 已验证 — Phase 2 UAT 13/13 通过 |
| 下拉面板而非侧边栏 | 减少屏幕占用，交互更直接 | ✓ 已验证 — Phase 1 |
| webviewTag 显式启用（Electron 32 默认 false） | 不启用则 webview 是无功能 HTMLUnknownElement | ✓ 已验证 — Phase 2（02-04） |
| 空 Tab 栏惰性创建 Tab（URL 回车时 createTab） | 覆盖冷启动与关闭最后 Tab 两个入口，不破坏空 Tab 栏新标签页预期 | ✓ 已验证 — Phase 2（02-05） |
| 导航入口统一经 normalizeUrl | 原始输入不直达 webview.src，避免缺 scheme/意外协议（T-02-05-01 缓解） | ✓ 已验证 — Phase 2 安全审计 |
| 分配规则支持精确匹配、通配符匹配、子域名匹配 | 灵活匹配网站 URL | ✓ 已验证 — Phase 4 UAT 通过 |
| 快捷键使用 CmdOrCtrl 前缀 | macOS 用 Cmd，Windows/Linux 用 Ctrl | ✓ 已验证 — Phase 4 |
| 使用纯 CSS 实现 toggle switch 组件 | 无第三方依赖 | ✓ 已验证 — Phase 4 |
| 使用 HTML5 原生 Drag and Drop API 实现规则排序 | 浏览器原生支持 | ✓ 已验证 — Phase 4 |
| 采用读取时惰性填充策略兼容旧数据 | 避免启动时批量迁移，降低风险 | ✓ 已验证 — Phase 5 |
| 使用 better-sqlite3 同步 API | 性能优于异步 sqlite3 | ✓ 已验证 — Phase 6 |
| 每容器独立 SQLite 表 | 避免索引膨胀，简化 FIFO 淘汰 | ✓ 已验证 — Phase 6 |
| realm:// 自定义协议用于内部页面 | 避免 http:// 路由冲突 | ✓ 已验证 — Phase 6 |
| 收藏从按容器隔离重构为全局共享 | 用户判断收藏应跨容器共享（类似 Chrome） | ✓ 已验证 — Phase 9 |
| 容器 ID 白名单验证 [a-z0-9-] | 防 SQL 注入 | ✓ 已验证 — Phase 6 |
| 设置页面 webview 通过 HTTP API 而非 IPC 访问数据 | guest 内 assertTrustedSender 会拒绝 IPC；/api/* 路由统一 token 鉴权 | ✓ 已验证 — Phase 11 |
| 服务端 payload 归一化防御层（normalizeRulesPayload） | 路由层解包任意层级 {rules} 包裹，不侵入 importRules 既有校验契约 | ✓ 已验证 — Phase 11（9/9 冒烟断言） |
| 客户端失败可见性契约：result.success === false → toast 真实原因 | 静默吞错导致用户感知"没反应"（Phase 11 UAT gap 根因） | ✓ 已验证 — Phase 11 UAT 重跑通过 |
| guest→容器映射由渲染进程上报（webview:register-container） | Electron 32 下 guest session.partition 为空串，主进程无法反推；webview 元素 partition 属性是权威来源 | ✓ 已验证 — Phase 12 UAT |
| CDP 耗时取 loadingFinished 与 requestWillBeSent 单调时间戳差值 | timing.requestTime 是单调时钟基准值（数值巨大），直接乘算得伪值 | ✓ 已验证 — Phase 12 UAT |
| CDP 响应体在 loadingFinished 时发 Network.getResponseBody 主动拉取 | dataReceived 事件不携带数据本体（只有 dataLength），攒数据块方案不可行 | ✓ 已验证 — Phase 12 UAT |
| 内部页面自建滚动容器（height:100vh + overflow-y:auto） | 全局 body overflow:hidden 是主窗口壳样式，内部页面复用 main.css 必须自管滚动 | ✓ 已验证 — Phase 12 UAT |
| 网页右键菜单唯一来源为新管线（renderer context-menu → IPC → buildWebMenu） | 遗留 webContents 级 handler 与新管线竞争导致旧 5 项菜单抢先弹出，必须删除 | ✓ 已验证 — Phase 13 UAT |
| 已关闭标签页恢复维持逐条 LIFO（Chrome 风格） | 2026-07-28 产品决策方案 A：批量关闭经连续恢复逐个找回，不做一键恢复多个 | ✓ 已验证 — Phase 13 UAT |
| Tab DOM 创建统一入口 createTabElement(tab) | 三处创建点分叉导致 favicon 元素缺失（固定 Tab 无图标 bug 根因），统一入口防回归 | ✓ 已验证 — Phase 13 UAT |
| 复制图片走 nativeImage 快路径 + Chromium canvas 解码兜底 | nativeImage.createFromBuffer 仅支持 PNG/JPEG，webp/avif 需 offscreen 窗口 canvas 转 PNG | ✓ 已验证 — Phase 13 UAT |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-28 after v1.3 milestone completion*
