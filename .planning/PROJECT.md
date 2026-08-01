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
- ✓ FOLDER-01..04: 文件夹 CRUD + 移动收藏到文件夹 — Phase 14
- ✓ FOLDER-05/06/08: 文件夹树状导航 + 面包屑 + 右键菜单 — Phase 15
- ✓ FOLDER-07: 拖拽排序（fractional-indexing + 多选批量操作） — Phase 16
- ✓ IMPORT-01: 自动读取 Chrome 本地书签（含 AccountBookmarks/多 Profile 检测） — Phase 17
- ✓ IMPORT-02: 支持 HTML 书签文件导入（预览确认两阶段） — Phase 17
- ✓ IMPORT-03: 导入进度（HTTP 轮询 + stage 分阶段）和冲突处理（书签 URL 去重 + 文件夹同名复用） — Phase 17
- ✓ AI-02: AI Manager 核心功能（5 个 Realm 工具 + 事件广播 + 错误重试 + IPC 通道 + 设置页 AI 分区） — Phase 20
- ✓ AI-03: AI 聊天面板 UI（面板开关/消息渲染/流式输出/工具卡片/消息操作/拖拽宽度/设置集成） — Phase 21

### Active

<!-- 当前需要构建的功能（下一里程碑定义） -->

**v2.0 收藏夹文件夹支持 + AI Agent 集成** (2026-07-28)

#### 收藏栏
- BAR-01: 收藏栏固定显示 — Phase 18
- BAR-02: 收藏栏项目交互 — Phase 18
- BAR-03: 收藏栏右键菜单 — Phase 18
- BAR-04: 收藏栏显示/隐藏设置 — Phase 18

#### AI Agent 集成（基于 pi-agent-core）
- AI-01: Node.js 版本验证和基础架构 — Phase 19

### Out of Scope

- **浏览器扩展支持** — 本期不支持 Chrome/Firefox 扩展
- **书签/历史同步** — 本期不实现跨容器同步
- **网络代理隔离** — 本期不实现每个容器独立代理
- **移动端支持** — 仅支持桌面端（macOS）
- **Chrome 多 Profile 合并导入** — 检测覆盖 Default/Profile N（含 AccountBookmarks），但仅导入检测到的第一个 Profile，不做多 Profile 合并
- **收藏栏多行显示** — 仅支持单行显示

## Current State

**Shipped:** v2.0 (2026-08-01)
- 21 phases complete (4 v1.0 + 5 v1.1 + 3 v1.2 + 1 v1.3 + 8 v2.0)
- 所有里程碑已完成归档
- v2.0 Phase 21 complete — AI 聊天面板 UI 全部 13 个 UAT 验证通过
- 技术栈：Electron 32.x + better-sqlite3 + electron-store + Chrome DevTools Protocol + pi-agent-core

**Key features delivered:**
- 多容器隔离浏览器（Cookie/Session/Storage/缓存完全隔离）
- 容器 CRUD + 多 Tab + URL 导航 + 分配规则 + 快捷键
- 容器扩展属性（手机号/邮箱/备注）+ 惰性填充兼容
- 浏览历史记录（SQLite + 每容器隔离 + realm:// 协议）
- 收藏夹管理（全局共享数据库 + 星标按钮 + CRUD + 文件夹支持）
- frecency 常用网站推荐 + 应用设置页面（侧边栏多页面布局）
- Cookie 管理面板（session/file 双视图）+ 开发者模式（CDP 抓取 API 请求 + devrequests 查看页）
- 右键菜单增强（Tab/网页通用/图片/链接上下文菜单，固定 Tab favicon，已关闭标签 LIFO 恢复）
- 收藏夹文件夹系统（数据库层 + UI 交互 + 拖拽排序 + 多选批量操作）
- Chrome 书签导入（JSON/HTML 解析 + 批量导入 + 进度预览）
- 收藏栏功能（固定显示 + 交互 + 右键菜单 + 设置）
- AI Agent 集成（pi-agent-core + AI Manager + 5 个 Realm 工具 + 聊天 UI）

**Known gaps:**
- 13 个已诊断 debug session 未修复
- 1 个 UAT 差距（Phase 18，0 个待处理场景）

## Next Milestone Goals

**v2.1 Bug Fixes + Polish** (planned)
- 修复 13 个已诊断的 debug session
- 解决 Phase 18 UAT 差距
- 性能优化和 UI 打磨
- 文档更新

**Future Features:**
- 浏览器扩展支持
- 书签/历史同步
- 网络代理隔离
- 移动端支持

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
- v2.0 已 shipped，包含完整的多容器浏览器功能 + 历史记录 + 收藏夹 + 常用网站 + 设置 + 开发者模式 + 右键菜单 + 收藏夹文件夹 + Chrome 导入 + 收藏栏 + AI Agent
- 21 个阶段完成，所有计划完成，所有需求全部实现
- 技术栈：Electron 32.x + better-sqlite3 + electron-store + Chrome DevTools Protocol + pi-agent-core

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
| webview 内部页面新功能一律走 /api/* HTTP 端点，禁用 realmAPI | Phase 17 UAT 根因：webview guest 无 realmAPI（CR-4），导入前端误用 IPC 导致点击无反应；Electron 32 已移除 File.path，文件选择用原生 input 读内容上传 | ✓ 已验证 — Phase 17 UAT |
| 导入文件夹去重按"同名同父级复用"（findFolderByName） | 书签有 INSERT OR IGNORE 兜底而文件夹没有，重复导入原样重建文件夹树 | ✓ 已验证 — Phase 17 UAT |
| 长任务进度经 HTTP 轮询 + stage 分阶段上报；同步批处理每批 setImmediate 让出事件循环 | webview 无法接收 IPC 事件；同步循环阻塞事件循环导致轮询无响应、进度条卡 0 | ✓ 已验证 — Phase 17 UAT |
| AI 事件广播：高频 debounce 16ms 批量合并，低频立即发送 | 避免高频事件冲刷渲染进程，同时保证低频事件实时性 | ✓ 已验证 — Phase 20 UAT |
| AI 错误处理：3 次重试 + 指数退避（1s/2s/4s）+ 错误事件广播 | LLM 调用瞬态失败可自愈，最终失败经事件通知 UI | ✓ 已验证 — Phase 20 UAT |
| setAIManager setter 延迟注入 IPC 处理器 | main.js 已初始化 AIManager，setter 注入避免重复实例化 | ✓ 已验证 — Phase 20 UAT |
| renderer 顶层 elements 快照要求所有 script 标签置于全部 DOM 之后 | 面板 HTML 在 script 后解析导致 7 个元素引用为 null，面板交互全灭 | ✓ 已验证 — Phase 21 UAT |
| builtinModels 从 pi-ai/providers/all 子路径导入 | 包根入口不导出该函数，根路径导入使 AI init 必败（隐性两阶段） | ✓ 已验证 — Phase 21 UAT |
| 主进程承担 SDK→UI 事件契约翻译层 | pi-agent-core 事件形状（message 内容块数组/start-update-end 三段/每轮 turn_end）与 UI 契约不同，渲染端不应感知 SDK | ✓ 已验证 — Phase 21 UAT |
| AI 配置按提供商存储（ai.providers.{id}.{apiKey,model}） | pi-ai 内置 38 提供商，用户按需配置多家；设置页可筛选下拉选择 | ✓ 已验证 — Phase 21 UAT（xiaomi 实测） |
| AI 消息 Markdown 渲染必须 DOMPurify 消毒 | marked v5+ 移除 sanitize，原生 HTML 透传；恶意网页提示注入可借模型输出 XSS 访问 realmAPI | ✓ 已验证 — Phase 21 安全审计 |
| 流式渲染定向更新气泡，禁止 16ms 全量列表重建 | 全量 innerHTML 重建 60 次/秒导致气泡闪烁；webview 区域拖拽需禁用 pointer-events | ✓ 已验证 — Phase 21 UAT |
| LLM 级错误检测 AssistantMessage.errorMessage | pi-agent-core 对 401 等错误不抛异常，产出 errorMessage 消息正常结束，agent_end 必须显式检测转 error 事件 | ✓ 已验证 — Phase 21 UAT |

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
*Last updated: 2026-08-02 after v2.0 milestone*
