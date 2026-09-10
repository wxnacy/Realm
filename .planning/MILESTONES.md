# Milestones

## v2.5 AI 网络搜索功能 (Shipped: 2026-09-10)

**Phases completed:** 6 phases, 38 plans, 76 tasks

**Key accomplishments:**

- 在搜索关键路径添加12条 info/warn/error 级别日志，使用 [Realm Search] 前缀统一格式
- 当所有搜索 Provider 都失败时，web_search 工具现在展示 diagnostics.attempts 详情（Provider 名称、错误类型、错误消息），而非返回通用消息。
- fetchUrl 网页抓取 + htmlToMarkdown 转换管线，SSRF 逐跳防护，web_fetch AI 工具注册
- Search configuration IPC/HTTP/preload channels + settings page "网络搜索" sub-section with Provider list, API Key editor, verification, and overwrite confirmation
- 独立 SQLite 对话存储 + 一对话一 Agent 实例模式 + 5 个对话管理 IPC 通道
- 对话历史下拉面板 + 列表渲染/切换/新建/删除/重命名 + 右键菜单 + 删除确认对话框
- 对话创建惰性化（启动零对话行、删除不补建）+ 首条消息 D-04 自动命名 + conversationId 回传 + message_count 真实化 + saveMessages 全量替换事务
- 消息存储管线归一化（写入侧按角色内容提取 + 显示/注入双形状读出 + 旧 JSON 行兼容）+ switchConversation 异步等 Agent 重建后注入真实历史上下文
- 菜单项 stopPropagation 阻断冒泡竞态 + 删除目标 dialog dataset 结构化传参（IPC 必达）+ 确认框 margin:auto 居中 + AGENTS.md 弹框居中约定沉淀
- getMessages 同回合 assistant 行合并（显示形状根因修复）+ renderAIMessages 空 content 气泡守卫（防御修复）——工具回合历史恢复与实时视图同构，getAgentMessages 注入形状零变化（48 项冒烟断言全过）
- buildGlobalSnapshot 注入「不可信来源拒绝」+「容器记忆边界」双负向规则与层级归属指引，eval:memory 真实模型 14/14 PASS 闭合 G-43-1/1b/1c
- 「已保存」success 提示存活期守卫：UI 自动化帧轮询实测已保存帧存续恰好 2000ms（20 帧命中）后恢复生效时机文案，G-43-2 0 帧覆盖根因源级闭合
- 独立播放窗口 localhost 化 + /proxy 层按视频组织的分片磁盘缓存（FIFO 淘汰/强淘/哈希校验）+ SQLite 观看历史精确续播，主链路端到端打通
- 交付两个去 Electron 化纯逻辑模块：m3u8 行级解析器（parsePlaylist/resolveUri，录制引擎唯一解析来源）与 media-task-manager 统一任务注册表（D-25 状态机 + persist 注入持久化 + D-22 record→convert 接力钩子 + D-07 豁免查询源 isVideoActive），41 项单测全绿
- media-task-manager 接入主进程（持久化 + 双广播 + 系统通知 + D-07 淘汰豁免注入）并交付用户可见面：realm://tasks 任务页三区渲染、主窗口任务角标（openUrl 收敛）、设置页视频缓存分区（目录/容量即改即存），导航权威文档同步两个新入口
- 主进程 media-record-engine（m3u8 轮询追分片，D-18/D-20/D-21/D-23）+ 播放器录制按钮/红点/抽屉面板（UI-SPEC Component 1-4）+ record IPC + 关窗/应用退出两级确认（D-19），任务中心获得第一类真实任务
- mux.js（D-04 纯 JS）TS→fMP4 转封装 + convert 后台任务（D-24 弹框/命名/通知/定位）+ D-22 录制停止自动接力 + 抽屉「转换为 MP4」D-17 入口与任务页续转端点落地，Phase 44 产物侧收口
- handleProxyRequest 缓存查询翻转为命中优先（key=请求 URL target，命中读盘直返不回源）修复 CR-01、store()/透传分支源流 'error' 防护修复 CR-05，随 CR-01 补 WR-06（FRAG_LOADED 复位 hlsRetryCount）——「重开秒开」「断网照播」两条 failed truth 与主进程崩溃级缺陷在生产路径闭合
- storeBuffer 写路径容量水位淘汰（tracked 水位 O(1) 判定 + setCapacityBytes 改容量即收敛）修复 CR-02、RECORD_ROOT 常量与 readRecordTaskSegments task.id 目录补算修复 CR-03——「10GB 上限形同虚设」与「崩溃录制 outputPath 恒 null 续转恒 400」两条 failed truth 在生产路径闭合，且无每分片全库扫描性能回归
- 把任务页「停止」从状态标记变成真实停止：running record 经 recordEngine.stopRecord（与红点停止同原语——引擎停轮询、meta.json 落盘、completed + D-22 record→convert 接力），running convert 经 convertCancelTokens → convertToMp4 shouldCancel 协作式取消（reason='cancelled' + 半成品清理 + 任务落 cancelled）——CR-04 无限落盘根因在生产路径闭合
- webview tab 播放器直连拉流（D-01，仅独立窗口走 /proxy）、G-44-2b 空索引 meta 副作用随直连消失并留存 cacheEnabled 护栏、录制按钮新增停止方块图标
- convert/record 终态在主窗口弹应用内 toast（不依赖系统通知授权），点击经既有 showInFolder 链路定位产物；系统通知代码保留，正式签名后双通道并存
- 首分片格式嗅探（0x47/fMP4 box/高熵三判定）+ 不可转格式显式 reject + 产物终检，杜绝 0 字节假产物，失败原因直达任务页（G-44-4b）
- 抽屉删除确认框新增「同时删除条目（含观看历史）」checkbox（默认不勾，勾选后 playerHistory 按 playbackKey 参数化联动删除），meta 行「最近观看」文字替换为时钟图标 + tooltip；D-16 默认仅删缓存语义逐字节不变
- renderer 监听改用 mediaAPI 命名空间打通主窗口任务角标（G-44-7 单行根因修复）+ 任务页操作失败可见反馈条与 no_segments 解释性文案（G-44-9），preload.js 零改动
- 播放器窗口关闭与用户关 tab 的 guest webContents 销毁改为先隐藏后约 300ms 延迟销毁，收窄 Electron 43.3.0 上游键盘 ACK use-after-free 的两个已知触发窗口；dev 环境留存被销毁 webContents 的 id+URL 诊断日志。
- Electron 43.3.0 → 43.6.0（Chromium 150.0.7871.224 → .250）+ 4 处 UA/CH 常量与新内核实测对齐（降维 UA 冻结不动），打包版实机浏览+播放验证无崩溃，与 44-14 叠加形成 G-44-2 双层防御。
- 运行中录制时长改本地挂钟差值平滑推进（0 分片也在走表）并新增 4 例口径分离单测；缓存抽屉 meta 行恢复「时钟图标 + 时间」并排常显。
- convertToMp4 产物流改同步 fd 创建（fs.openSync 'w' → createWriteStream {fd}），失败清理从「竞态」变「确定」，并补密文拒转/取消两路径的事件循环延迟泄漏回归测试
- 清单解析层检测 EXT-X-KEY 加密（hasEncryption + keyUris）→ 缓存层密钥 URI 排除落库 + 加密标记登记 → 转换双入口弹框前早拒（「加密视频暂不支持转换」）+ 抽屉加密条目转换按钮隐藏，G-44-7 分类/体验半边闭合
- B 站直播 fMP4 流从「unsupported_container 拒转」改为「有 init 字节拼接转出 probe 可校验的 fMP4 产物、无 init 走 init_missing 引导」，parser 同步捕获 EXT-X-MAP init 分片 URI——零新依赖、TS/加密/取消契约全绿。
- B 站直播录制链路 fMP4 端到端打通：录制引擎首轮 baseline 即下载 EXT-X-MAP init 分片落盘（Pitfall 1 关闭），meta.json 自解释，编排层 initPath 两跳透传到 45-01 的嗅探分流，CONVERT_FAIL_TEXT 新 reason 文案闭环——stub e2e 从带 MAP 清单到 probe 可解析产物全绿，真实流验证留 end-of-phase human-check。
- 缓存链路 fMP4 支持闭环（D-03 第二链路）：EXT-X-MAP 登记 map_uris/has_fmp4_map 复刻 44-18 key_uris 先例，init 本体留存 <videoDir>/init 且绝不进 segments（Pitfall 2 完整性口径），getConvertInfo 透出 initPath，startConvertFromInput 对历史无 init 条目 init_missing 早拒引导重播——缓存 fMP4 条目可转 mp4，四套件 106 例全绿零回归。
- moof→traf→tfdt 轻量 box walker 按轨减去 epoch 级基线并原位改写，fMP4 拼接产物时间轴从 0 开始（v1 BigInt / v0 Number 等长改写，畸形容忍，零新依赖）

---

## v2.2 多媒体功能集成 (Shipped: 2026-08-11)

**Phases completed:** 4 phases, 11 plans, 24 tasks

**Key accomplishments:**

- 1. 添加 mediaAPI IPC 通道和 preload 暴露
- e4bc525
- 浮动媒体面板 UI：工具栏按钮 + 媒体列表 + 类型徽标颜色编码 + 播放/复制操作 + 实时更新
- MediaSniffer clearAll + webRequest switch/whitelist filtering + renderer UI hide with feature toggle
- 白名单过滤被脚本注入路径绕过。媒体嗅探有两条路径，白名单只挂在网络路径（main.js onResponseStarted）上；脚本注入路径完全失守。

---

## v1.0 MVP

**Shipped:** 2026-07-25
**Phases:** 4 (12 plans)
**Status:** ✅ Complete

### Delivered

完整的多容器隔离浏览器，支持：

- 容器 CRUD（创建/编辑/删除）和自定义（名称、颜色、图标）
- 多 Tab 浏览，每个 Tab 属于不同容器
- URL 导航（协议补全/搜索回退/前进后退/刷新停止）
- 完全数据隔离（Cookie、Session、LocalStorage、IndexedDB、HTTP 缓存）
- Cookie 文件持久化和自动加载
- 容器分配规则（精确匹配/通配符/子域名）
- 快捷键支持

### Key Accomplishments

1. Phase 1: 模块化架构重构 + 容器管理 UI
2. Phase 2: WebContentsView 多 Tab 架构 + URL 导航
3. Phase 3: 完整数据隔离 + Cookie 持久化
4. Phase 4: 分配规则 + 快捷键管理

### Verification

- Closeout type: override_closeout (known verification overrides)
- 20/20 v1 requirements complete
- 5 debug sessions deferred
- 1 UAT gap deferred (Phase 03)

### Archive

- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
- Tag: `v1.0`

## v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面

**Shipped:** 2026-07-26
**Phases:** 5 (11 plans, 10 complete)
**Status:** ✅ Complete

### Delivered

在 MVP 基础上增强了容器属性管理、浏览历史记录、收藏夹、常用网站推荐和应用设置：

- 容器扩展属性（手机号/邮箱/备注）+ 旧数据惰性填充兼容
- 基于 SQLite 的浏览历史记录系统（每容器隔离 + realm:// 协议 + FIFO 淘汰）
- 收藏夹管理（全局共享数据库 + 星标按钮 + CRUD + 搜索）
- frecency 常用网站推荐（频率 + 最近性加权排序 + 域名聚合）
- 应用设置页面（默认浏览器引导 + 历史记录保留天数）
- 收藏数据库从按容器隔离重构为全局共享

### Key Accomplishments

1. Phase 5: 容器数据模型扩展 phone/email/notes + 惰性填充兼容
2. Phase 6: SQLite 历史记录系统 + realm:// 自定义协议
3. Phase 7: 收藏夹全功能管理（星标按钮 + 编辑面板 + 列表页面）
4. Phase 8: frecency 常用网站推荐 + 应用设置页面
5. Phase 9: 收藏数据库从按容器隔离重构为全局共享

### Verification

- Closeout type: override_closeout
- 30/30 v1.1 requirements complete
- 6 debug sessions deferred (diagnosed)
- 1 plan gap deferred (09-04: checkBookmarkStatus realm:// guard)
- 1 UAT gap deferred (Phase 03)

### Archive

- Roadmap: `.planning/milestones/v1.1-ROADMAP.md`
- Requirements: `.planning/milestones/v1.1-REQUIREMENTS.md`
- Tag: `v1.1`

## v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式

**Shipped:** 2026-07-27
**Phases:** 3 (6 plans)
**Status:** ✅ Complete

### Delivered

Cookie 管理面板增强，设置页面重构，开发者模式实现：

- Cookie 管理面板多来源查看（Session/File）+ 域名过滤 + 手动保存 + 单条编辑删除
- 设置页面左侧边栏导航（通用/分配规则/快捷键设置）+ 规则/快捷键页面化
- 开发者模式：CDP 抓取 API 请求 + SQLite 持久化 + realm://devrequests 查看页

### Key Accomplishments

1. Phase 10: Cookie 管理面板完全增强（来源切换/域名过滤/保存/编辑/删除）
2. Phase 11: 设置页面重构为侧边栏多页面布局，规则和快捷键从弹窗迁入
3. Phase 12: 开发者模式 CDP 引擎 + 写入队列 + SQLite + 请求查看页

### Verification

- Closeout type: override_closeout
- 14/14 v1.2 requirements complete
- 12 debug sessions deferred (diagnosed)
- 1 UAT gap deferred (Phase 06 — passed, 0 pending)

### Archive

- Roadmap: `.planning/milestones/v1.2-ROADMAP.md`
- Requirements: `.planning/milestones/v1.2-REQUIREMENTS.md`
- Phases: `.planning/milestones/v1.2-phases/`
- Tag: `v1.2`

## v1.3 右键菜单增强

**Shipped:** 2026-07-27
**Phases:** 1 (3 plans)
**Status:** ✅ Complete

### Delivered

标签页和网页右键菜单完整实现：

- 标签页右键菜单（关闭/关闭其他/左右侧/重新打开已关闭/固定）
- 网页通用右键菜单（导航/另存为/打印/查看源代码/检查元素/文本编辑）
- 图片右键菜单（新标签页打开/另存为/复制图片/复制图片地址）
- 链接右键菜单（新标签页/后台打开/容器中打开/复制链接地址）
- 已关闭标签页 LIFO 恢复 + 固定 Tab favicon 持久化

### Key Accomplishments

1. Phase 13: context-menu-manager.js 主进程菜单基础设施
2. Phase 13: 渲染进程集成 + preload API + 右键事件监听
3. Phase 13: UAT 验证 + 安全威胁缓解 + Tab DOM 统一入口

### Verification

- Closeout type: override_closeout
- 5/5 v1.3 requirements complete
- 12 debug sessions deferred (diagnosed)
- 1 UAT gap deferred (Phase 06 — passed, 0 pending)

### Archive

- Roadmap: `.planning/milestones/v1.3-ROADMAP.md`
- Requirements: `.planning/milestones/v1.3-REQUIREMENTS.md`
- Phases: `.planning/milestones/v1.3-phases/`
- Tag: `v1.3`

## v2.0 收藏夹文件夹支持 + AI Agent 集成

**Shipped:** 2026-08-01
**Phases:** 8 (16 plans)
**Status:** ✅ Complete

### Delivered

收藏夹文件夹系统 + AI Agent 基础集成：

- 收藏夹文件夹系统（数据库层 + UI 交互 + 拖拽排序 + 多选批量操作）
- Chrome 书签导入（JSON/HTML 解析 + 批量导入 + 进度预览）
- 收藏栏功能（固定显示 + 交互 + 右键菜单 + 设置）
- AI Agent 集成（pi-agent-core + AI Manager + 5 个 Realm 工具 + 聊天 UI）

### Key Accomplishments

1. Phase 14-16: 收藏夹文件夹系统完整实现
2. Phase 17: Chrome 书签导入（自动检测 + HTML 导入 + 进度预览）
3. Phase 18: 收藏栏功能
4. Phase 19-21: AI Agent 集成（AI Manager + 聊天 UI + 流式渲染）

### Verification

- Closeout type: verified_closeout
- 25/25 v2.0 requirements complete

### Archive

- Roadmap: `.planning/milestones/v2.0-ROADMAP.md`
- Requirements: `.planning/milestones/v2.0-REQUIREMENTS.md`
- Tag: `v2.0`

## v2.1 AI CDP 增强 + Tabbrowser 功能集成

**Shipped:** 2026-08-04
**Phases:** 4 (18 plans)
**Status:** ✅ Complete

### Delivered

AI Agent 深度浏览器控制能力：

- CDP 管理器扩展 + 基础网页操控工具（read_page_content/extract_links/open_link）
- 智能上下文引用（@ 标签页引用）+ FTS5 收藏全文检索
- 任务自主执行（fillForm/executeAction + AI 工具 + CAPTCHA 检测 + 确认 UI）
- 脚本生成 + 智能标签整理

### Key Accomplishments

1. Phase 22: CDP 管理器扩展 + 3 个网页操控 AI 工具（含 2 轮 gap 修复）
2. Phase 23: @ 引用标签页上下文 + FTS5 收藏全文检索（含 3 个 gap 修复复测）
3. Phase 24: 任务自主执行（fillForm/executeAction + CAPTCHA 检测 + 确认 UI）
4. Phase 25: 脚本生成 + 智能标签整理（含 apply_tab_groups 回传修复）

### Verification

- Closeout type: override_closeout (未运行里程碑审计)
- 20/20 v2.1 requirements complete
- 13 debug sessions deferred (from v2.0)
- Phase 23 代码审查遗留 19 项（6 Critical）

### Archive

- Roadmap: `.planning/milestones/v2.1-ROADMAP.md`
- Requirements: `.planning/milestones/v2.1-REQUIREMENTS.md`
