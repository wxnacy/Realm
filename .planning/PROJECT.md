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
- ✓ CDP-01: 独立 CDP 管理器（cdp-manager.js，attachForAI/detachForAI/executeCommand + 超时 + 自动清理） — Phase 22
- ✓ CDP-02: read_page_content 工具（Readability 注入提取，102400 字符截断，空状态文案） — Phase 22
- ✓ CDP-03: extract_links 工具（http/https 过滤 + 锚点过滤 + URL 去重） — Phase 22
- ✓ CDP-04: open_link 工具（双模式 + 内存权威容器校验，打开链接唯一入口） — Phase 22
- ✓ AUTO-01: fillForm CDP 方法（六级字段定位链，支持 9 种表单类型） — Phase 24
- ✓ AUTO-02: executeAction CDP 方法（支持 17 种页面操作类型） — Phase 24
- ✓ AUTO-03: fill_form AI 工具（风险评估 + 输入消毒 + CAPTCHA 预检） — Phase 24
- ✓ AUTO-04: execute_action AI 工具（风险评估 + 脚本安全检查 + CAPTCHA 预检） — Phase 24
- ✓ AUTO-05: 高风险操作确认 UI（IPC 处理器 + 确认卡片 + 状态机） — Phase 24
- ✓ AUTO-06: Prompt Injection 防护（sanitizeInput + validateScript + CDP 双层防护） — Phase 24
- ✓ SCRIPT-01: 一句话生成脚本（generate_script + 13 项白名单静态分析 + 预览卡片 + 逐步执行引擎） — Phase 25
- ✓ TAG-01: AI 自动标签分组（suggest_tab_groups 三策略 + 建议卡片 + 标签栏重排） — Phase 25
- ✓ SNIFF-01~05: 媒体嗅探引擎（网络拦截 + 脚本注入 + MutationObserver + 容器隔离去重 + 导航清空） — Phase 26
- ✓ IPC-01~05: 媒体 IPC 通道（get-list/play/copy-url/clear-list/script-detected + mediaAPI preload） — Phase 26
- ✓ PANEL-01~05: 媒体面板（浮动层 + 类型徽标列表 + 播放/复制 + 数量徽标 + 实时更新） — Phase 27
- ✓ PLAYER-01~10: 独立播放器窗口（无边框 + HLS/MP4/MPEGTS 播放 + 完整控制 + 画中画 + 播放列表 + Session 隔离 + 资源释放） — Phase 28
- ✓ SC-01~05: 多媒体播放器设置控制（功能开关 + 域名白名单 + webRequest/注入双路径过滤 + 实时广播） — Phase 29
- ✓ MW-01: 用户可以通过 Dock 右击菜单新建窗口 — v2.4
- ✓ MW-02: 用户可以拖拽标签页出窗口，创建新窗口 — v2.4
- ✓ MW-03: 用户可以在窗口间拖拽标签页 — v2.4
- ✓ MW-04: 用户可以拖拽标签改变顺序 — v2.4
- ✓ MW-05: 窗口间拖拽标签时，源窗口仅剩一个标签则自动销毁 — v2.4
- ✓ MW-06: 窗口位置和大小在重启后恢复 — v2.4
- ✓ MW-07: 新建窗口时继承源窗口的容器上下文 — v2.4
- ✓ MW-08: 用户可以使用 Cmd+N 快捷键新建窗口 — v2.4
- ✓ MW-09: 用户可以使用 Cmd+Shift+W 关闭当前窗口 — v2.4
- ✓ MW-10: 多窗口时窗口间焦点切换正常工作 — v2.4
- ✓ MW-11: 右键菜单添加"在新窗口中打开"选项 — v2.4
- ✓ MW-12: 窗口标题栏显示当前容器名称 — v2.4
- ✓ MW-13: 窗口标题栏/工具栏显示容器颜色标识 — v2.4

### Active

<!-- 当前需要构建的功能（v2.5 里程碑） -->

- 边播边缓存 (Deferred from v2.3)
- 增强功能 (ENH-01~06: 截图/画中画/播放列表/字幕/DASH/RTMP)
- 书签导出
- 全屏模式
- 无痕/隐私浏览

### Out of Scope

- **浏览器扩展支持** — 本期不支持 Chrome/Firefox 扩展
- **书签/历史同步** — 本期不实现跨容器同步
- **网络代理隔离** — 本期不实现每个容器独立代理
- **移动端支持** — 仅支持桌面端（macOS）
- **Chrome 多 Profile 合并导入** — 检测覆盖 Default/Profile N（含 AccountBookmarks），但仅导入检测到的第一个 Profile，不做多 Profile 合并
- **收藏栏多行显示** — 仅支持单行显示
- **DASH (.mpd) 播放** — v2.2 暂缓：嗅探/renderer/CSS 已补 dash 支持但复验仍失败，二层根因未诊断（UAT G-28-2，2026-08-08 用户决定，走 /gsd-plan-phase 28 --gaps 续查）

## Current Milestone: v2.5 (Planned)

**Goal:** 待规划

## Current State

**Shipped:** v2.4 (2026-08-16)
- 36 phases complete (4 v1.0 + 5 v1.1 + 3 v1.2 + 1 v1.3 + 8 v2.0 + 4 v2.1 + 4 v2.2 + 4 v2.3 + 3 v2.4)
- 所有里程碑已完成归档
- v2.4 Phase 34-36 complete — 多窗口支持（窗口管理 + Tab 拖拽 + 跨窗口移动）
- 技术栈：Electron 32.x + better-sqlite3 + electron-store + Chrome DevTools Protocol + pi-agent-core + nodejieba

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
- AI Agent 集成（pi-agent-core + AI Manager + 12 个 Realm 工具 + 聊天 UI）
- AI 智能上下文引用（@ 引用标签页正文注入）+ 收藏 FTS5 中文全文检索
- AI 自动化填表/操作（fillForm/executeAction + CAPTCHA 检测 + 操作确认 UI）
- AI 脚本生成（自然语言生成可执行脚本 + 逐步执行 + 安全验证）
- AI 智能标签分组（suggest_tab_groups + 建议卡片 + 标签栏重排）
- 多媒体：视频源嗅探（网络+注入+DOM 三通道）+ 媒体面板 + 独立播放器窗口（HLS/MP4/MPEGTS + 画中画 + 播放列表）
- Tab 拖拽排序（HTML5 DnD + Chrome 风格插入指示器 + rAF 节流）
- 跨窗口 Tab 拖拽（DragCoordinator + 自定义鼠标事件 + 浮动预览 + 新窗口创建）
- 窗口位置持久化（electron-store + 越界检测 + 多显示器支持）
- 右键菜单"在新窗口中打开"（move/copy 模式）
- 多窗口架构（windowManager Map + Set 双重注册 + broadcast 广播）

**Known gaps:**
- 20 个 debug session（18 个已 fixed，2 个 unknown — container-delete-partitions 和 whitelist-bypass-script-injection 已确认修复待 UAT 回归）
- 2 个 Verification gaps（Phase 30 和 Phase 35 需 human 验证）

**Current milestone:** v2.5 (planned)

## Next Milestone Goals

**v2.5** (planned)
- 边播边缓存 (Deferred from v2.3)
- 增强功能 (ENH-01~06: 截图/画中画/播放列表/字幕/DASH/RTMP)
- 书签导出
- 全屏模式
- 无痕/隐私浏览

**Future Features:**
- 浏览器扩展支持
- 书签/历史同步
- 网络代理隔离
- 移动端支持
- 页面缩放 (Zoom)
- 阅读模式
- 分屏浏览

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
- v2.4 已 shipped，包含完整的多容器浏览器功能 + 历史记录 + 收藏夹 + 常用网站 + 设置 + 开发者模式 + 右键菜单 + 收藏夹文件夹 + Chrome 导入 + 收藏栏 + AI Agent + 多媒体播放器 + 下载管理器 + 自动填充 + 多窗口支持
- 36 个阶段完成，所有计划完成
- 技术栈：Electron 32.x + better-sqlite3 + electron-store + Chrome DevTools Protocol + pi-agent-core + hls.js + mpegts.js + dashjs + nodejieba

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
| AI 工具 CDP 调试器独立通道 attachForAI/detachForAI | 与 dev-mode 抓包调试器隔离，工具 finally 块保证断开，webview destroyed 兜底清理 | ✓ 已验证 — Phase 22 UAT |
| Readability 打包为可注入 IIFE bundle（lib/readability-bundle.js） | Runtime.evaluate 注入真实页面提取正文，避免主进程解析 HTML | ✓ 已验证 — Phase 22 UAT |
| 容器校验数据源切换为 getContainersLazy() 内存权威数据 | electron-store 磁盘读取在全新 profile 下误报「容器不存在」（CR-01 根因），内存 Map 由 initContainers 启动建立 | ✓ 已验证 — Phase 22（22-04） |
| 职责重叠工具取删除而非复用实现（navigate 移除，open_link 唯一入口） | navigate 三重根因（幽灵 Tab + 死参数 + 选择歧义）均为独立缺陷，保留则歧义永存 | ✓ 已验证 — Phase 22（22-05）UAT 复测 |
| 截断阈值采用字符语义（102,400 字符）而非字节 | Readability 提取率约 7%，按字节推断截断前提会选中阈值边缘页面；契约/标记/UAT 三处统一字符措辞 | ✓ 已验证 — Phase 22（22-05） |
| AI 工具与 DevTools 共存（不互斥） | Electron 允许 AI debugger 与用户 DevTools 并存，冲突检测为过期预期，用户确认共存行为更好 | ✓ 已验证 — Phase 22 UAT Test 5 用户决策 |
| 确认响应单一权威通道：ai-manager 委托 main.js pendingActions 注入 | 两套并行确认实现（ai-manager 孤儿 IPC vs main.js Map）未对接导致点确认必超时误判取消；删除孤儿实现，未注入 fail-closed | ✓ 已验证 — Phase 24 UAT（G-24-4） |
| 按钮类元素一律确认（元素类型判定，非文字语义） | "Sign in" 文本匹配命中 passkey 按钮不可靠；button/input[submit]/[role=button] 一律升级高风险 | ✓ 已验证 — Phase 24 UAT（G-24-4） |
| Input.insertText 前合成点击落位输入管线焦点 + readback 裁决兜底 | insertText 打进输入管线焦点元素而非 DOM activeElement —— 焦点在 embedder 时填表文本串进 AI 聊天框；wc.focus()/this.focus() 无效，只有合成 dispatchMouseEvent 落位 | ✓ 已验证 — Phase 24 UAT（G-24-2b） |
| 脚本操作白名单独立于 execute_action 的 action enum（13 种安全操作） | 脚本由步骤序列构成，排除 screenshot/upload/execute_script 等高风险操作，攻击面小于通用操作工具 | ✓ 已验证 — Phase 25 UAT |
| validateScriptForSteps 在 validateScript 上扩展 5 个危险模式（fetch/XHR/路径遍历/window/document） | 脚本步骤经 CDP 执行而非页面内 JS，内嵌脚本模式在步骤级无意义且高危 | ✓ 已验证 — Phase 25 UAT |
| 脚本步骤状态经 script:step-update IPC 逐步实时推送 | 逐步执行 + 每步回调，失败即停，用户可中断（script:stop），预览卡片状态实时切换 | ✓ 已验证 — Phase 25 UAT |
| 标签分组策略参数化（domain/semantic/mixed） | 域名分组确定性高，语义分组贴合主题，mixed 先域名再细分；默认 semantic | ✓ 已验证 — Phase 25 UAT |
| 播放库经 UMD script 标签引入（window.Hls/mpegts/dashjs），不用裸 import | file:// 渲染进程无打包器，裸模块说明符不可解析；player.js 的 window 全局检查命中后不走 import 分支 | ✓ 已验证 — Phase 28 UAT（G-28-1a） |
| getMainWindow 用显式 mainWindowRef 登记，不用 getAllWindows()[0] | 窗口数组顺序随焦点/创建变化，辅助窗口存在时误判主窗口，assertTrustedSender 误拒主窗口合法 IPC | ✓ 已验证 — Phase 28 UAT（G-28-4） |
| 窗口控制 IPC 信任断言按窗口身份分离（assertTrustedSender / assertPlayerSender） | 主窗口断言拒绝播放器窗口的合法调用；播放器通道校验来源==当前 playerWindow 更准确 | ✓ 已验证 — Phase 28 UAT（G-28-6） |
| 非主窗口快捷键不派发主窗口；closeTab(Cmd+W) 转为关闭来源窗口自身 | before-input-event 全局监听会截获播放器窗口按键误派主窗口；webview guest 经 fromWebContents 解析回宿主不受影响 | ✓ 已验证 — Phase 28 UAT（Test 13/14） |
| HLS 自动播放挂 MANIFEST_PARSED 回调 | HLS 分支漏调 video.play() 导致打开默认暂停 + 切换不续播；play 事件联动刷新图标/覆盖层/隐藏定时器 | ✓ 已验证 — Phase 28 UAT（G-28-3） |

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
*Last updated: 2026-08-16 after v2.4 milestone completion (多窗口支持)*
