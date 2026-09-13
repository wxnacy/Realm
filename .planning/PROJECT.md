# Realm Browser

## What This Is

Realm Browser 是一个基于 Electron 的多容器隔离浏览器，支持独立的 Cookie、Session、LocalStorage、IndexedDB 和缓存隔离。用户可以通过工具栏按钮管理容器，在同一窗口内以多 Tab 形式运行不同容器的页面，实现类似 Firefox Multi-Account Containers 的隔离体验。

在此之上内置 AI 助手（可联网搜索 / 抓取网页 / 历史对话管理 / 三层持久记忆 / 文件与 Bash 工具 / CDP 页面操控）与本地媒体库（视频嗅探、独立播放器、分片磁盘缓存、直播录制与 mp4 转封装）。

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
- ✓ CONV-01: 对话存储基础与消息归一化管线（双形状读出） — Phase 42
- ✓ CONV-02: 对话管理 UI（历史列表/切换/删除/确认框居中） — Phase 42
- ✓ CONV-03: 对话历史全局共享（跨容器，无 container_id） — Phase 42
- ✓ CONV-04: 对话标题管理（D-04 自动命名 + 行内重命名） — Phase 42
- ✓ MEM-01~06: AI 三层条目记忆（USER.md / 全局 MEMORY.md 冻结快照注入 / 容器 memories + memory·memory_read 工具 + 写入威胁扫描 + 容器删除联动清理 + /api/ai-memory 设置页三 tab 分区） — Phase 43
- ✓ SEARCH-01~04 / TOOL-01~04 / FETCH-01~04 / CONFIG-01~04（16 项，归档 `.planning/milestones/v2.5-REQUIREMENTS.md`）：search-manager.js（provider 注册表 + 速率限制器 + SSRF 防护 + 结果标准化）、web_search 工具（4 家 API provider + Auto Fallback + 诊断 attempts）、web_fetch 工具（fetchUrl + turndown 转 Markdown + 逐跳 SSRF 校验）、设置页「网络搜索」配置区（Provider 选择 + API Key 管理与验证 + IPC/preload 通道） — v2.5
- ✓ 边播边缓存（Deferred from v2.3）：/proxy 分片级磁盘缓存（按视频组织目录 + FIFO 淘汰 + 强淘 + 哈希校验 + 断网降级照播） — Phase 44（需求未注册）
- ✓ 本地媒体库：观看历史精确续播（key = origin+pathname，query 时效 token 不参与）+ 独立播放窗口 localhost 化收口 /proxy — Phase 44（需求未注册）
- ✓ 媒体任务中心：直播录制（m3u8 轮询追分片 + 关窗/退出两级确认）+ mux.js TS→fMP4 转封装 + realm://tasks 任务页 + 主窗口角标 — Phase 44（需求未注册）
- ✓ AES-128 加密 HLS 解密转封装（EXT-X-KEY IV 捕获 + key/IV/media_sequence 留存与历史条目自愈 + 逐分片解密） — Phase 44（需求未注册）
- ✓ B 站直播 fMP4 转录（EXT-X-MAP init 留存 + 纯 JS 字节拼接 + tfdt rebase 时间轴归零） — Phase 45（需求未注册）
- ✓ SKILL-01..08 + DOC-01: AI 技能基础设施（`agent-workspace/skills/` 与 `managed-skills/` 双目录入硬沙箱 + SDK 加载接线 + `<available_skills>` 注入 system prompt 第 4 段 + 契约布局过滤/目录名权威/同名遮蔽去重 + 三限额与诊断不静默 + 启停只标记不删文件 + 不重建 Agent 的 prompt 回写与 `skills:changed` 跨窗口广播 + `docs/product/ai-skills.md` 骨架） — Phase 46
- ✓ SKILL-09 + SEED-01~05 + SEC-01 + DOC-02: 内置技能随包播种与 bash 策略加固（`skills-builtin/` 两技能 + 播种模块自愈式播种/差异诊断/原子替换 + 打包排除项与 `asarUnpack` 成对 + 打包后正式环境实跑验证 + bash 安装档改「首 token 默认拒绝 + 显式只读清单」+ 共用词法归一化 `stripShellQuoting` + 只读豁免三条承重墙（空只读清单不生成动词式正则 / 纵深优先 / `init`·`audit` 形态化）+ WR-01 白名单 `*` 条目双向关闭 + 三份文档逐句为真） — Phase 47
  > **收尾方式**：SC3 的**普遍性**表述（「不再可能被白名单免确认」）由用户裁定以 **override** 收尾 —— CR-01（旗标取值槽吞末尾子命令：`npm -g update`）与 CR-02（`audit` 与 `fix` 之间夹旗标：`npm audit --json fix`）两条**零卡片残余**在阶段基线 `0bbb6c4` 即存在（非本阶段回归），已由三份文档具名披露并记入 `47-REVIEW.md` 技术债，根治走 argv 级分词（见 Active）
- ✓ DISC-01..07: 技能发现与调用（`/` 斜杠面板并入技能列表 + 实时过滤 + 扁平索引直绑；`/skill:name [args]` 经 `formatSkillInvocation` 注入 `<skill>` 块；技能调用进历史并触发 LLM；三档来源徽标 + 遮蔽可见；`read` 技能卡片变体；两码两文案的明确错误提示与气泡回滚；`disable-model-invocation` 不进 prompt 但可显式调用并打 `仅显式` 标） — Phase 48
  > **收尾方式**：8/8 计划，UAT 20/20 全裁决（round 1–4）；三门禁全过 —— `validate-phase` 零 gap（`nyquist_compliant: true`）、`secure-phase` `threats_open: 0`（36 条登记项闭合、10 条 accepted risks）、`ui-review` 18/24（0 blocker、3 条 priority fix 记技术债）。已闭合的 gap：G-48-3/4/6（48-05/48-06）、G-48-12（48-07）、G-48-18/19（48-08）。**关键实现语义**：运行期新增技能经 miss 重扫**至多一次**后当场读盘；延迟回写 + `skills:changed` 广播落在**任一轮成功出口（含纯文本轮）**、由唯一实现 `_flushDeferredSkillsPrompt()` 承担。**挂账未修**：TD-48-01（`escapeHtml` 不转义引号）、TD-48-02（取消分支无锚点自校验）、WR-02（两处裸调未包 try）、WR-06（已缓存技能绕过 64 KiB 字节闸）、UI-REVIEW 3 条 priority fix

### Active

<!-- 当前需要构建的功能（v2.6 里程碑；需求细节见 .planning/REQUIREMENTS.md） -->

- AI 助手技能（Skill）能力 — v2.6 进行中
- **bash 安装档只读豁免的 argv 级分词根治** — Phase 47 复审 CR-01/CR-02 与残余 ③：`matchInstall` 的只读判定用「整段正则 + `FLAG_TOLERANCE` 取值槽」，导致 `npm -g update` / `npm --global rebuild` / `npm audit --json fix` / `npm -g update ls` 在白名单含裸工具名时**零卡片**。根治 = 显式声明「带值旗标」清单（`--prefix` / `-w` / `--filter` / `-C` / `--registry` …）+ argv 级分词后比对只读清单；可一次消除三条残余并使 `pnpm --filter a run build` 不再依赖取值槽实现（修法见 `.planning/phases/47-bash/47-REVIEW.md`）
- 增强功能 (ENH-01~06: 截图/画中画/播放列表/字幕/DASH/RTMP) — 顺延
- 书签导出 — 顺延
- 全屏模式 — 顺延
- 无痕/隐私浏览 — 顺延
- 浏览器搜索 Provider（Bing/Google/DDG DOM 解析）+ 中文搜索质量优化（v2.5 Future Requirements 顺延）
- 搜索结果高亮 / 搜索历史建议（v2.5 Future Requirements 顺延）

### Out of Scope

- **浏览器扩展支持** — 本期不支持 Chrome/Firefox 扩展
- **书签/历史同步** — 本期不实现跨容器同步
- **网络代理隔离** — 本期不实现每个容器独立代理
- **移动端支持** — 仅支持桌面端（macOS）
- **Chrome 多 Profile 合并导入** — 检测覆盖 Default/Profile N（含 AccountBookmarks），但仅导入检测到的第一个 Profile，不做多 Profile 合并
- **收藏栏多行显示** — 仅支持单行显示
- **DASH (.mpd) 播放** — v2.2 暂缓：嗅探/renderer/CSS 已补 dash 支持但复验仍失败，二层根因未诊断（UAT G-28-2，2026-08-08 用户决定，走 /gsd-plan-phase 28 --gaps 续查）

## Current Milestone: v2.6 AI 助手技能（Skill）能力

**Goal:** 让 Realm AI 助手具备符合 Anthropic Agent Skills 开放规范的技能发现、调用、创建与管理能力——用户可 `/` 唤出技能、可导入自己的技能，AI 可自主查找与创建技能。

**Target features:**
- Skill 发现与调用（pi-agent-core 原生 `loadSkills` / `formatSkillsForSystemPrompt` 接线；`/` 斜杠命令面板并入 skill 列表，支持 `/skill:name args`；模型按 description 自动匹配）
- 内置 find-skills（vercel-labs）+ skill-creator（anthropics）两个技能，完整打包目录并首次启动播种到 `managed-skills/`
- `manage_skill` 工具（create/update/delete + 名称校验 + 大小限制 + 原子写 + managed 边界保护），AI 可自主创建技能
- 用户技能管理：设置页 AI 分区新增技能管理区，支持 zip 包与网络地址（GitHub 仓库/目录 与 SKILL.md 直链自动分流）导入，保存在 `skills/`
- `agent-workspace.js` 新增 `skills/` 与 `managed-skills/` 子目录并纳入硬沙箱

## Current State

**Shipped:** v2.5 (2026-09-10)
- 45 phases complete (4 v1.0 + 5 v1.1 + 3 v1.2 + 1 v1.3 + 8 v2.0 + 4 v2.1 + 4 v2.2 + 4 v2.3 + 6 v2.4 + 6 v2.5)
- 所有里程碑已完成归档
- v2.5 交付：AI 联网搜索与网页抓取（web_search/web_fetch + 配置 UI）+ AI 历史对话管理 + AI 三层条目记忆 + 播放器视频缓存与本地媒体库 + B 站直播 fMP4 转录
- 技术栈：Electron 43.6.0（Chromium 150）+ better-sqlite3 + electron-store + Chrome DevTools Protocol + pi-agent-core + hls.js / dashjs / mpegts.js / mux.js + nodejieba

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
- AI 联网搜索与网页抓取（search-manager + 4 家 API provider + Auto Fallback + 速率限制 + SSRF 防护 + turndown 转 Markdown）
- AI 历史对话管理（独立 SQLite 存储 + 一对话一 Agent + 列表/切换/删除/重命名 + 消息归一化双形状）
- AI 三层条目记忆（USER.md / 全局 MEMORY.md 快照注入 / 容器 memories + 写入威胁扫描）
- 本地媒体库（/proxy 分片磁盘缓存 + FIFO 淘汰 + 观看历史精确续播 + 断网降级照播）
- 媒体任务中心（直播录制 + mux.js 转封装 + realm://tasks 任务页 + 主窗口角标 + 关窗/退出确认）
- AES-128 加密 HLS 解密转封装 + B 站直播 fMP4 转录（EXT-X-MAP init 拼接 + tfdt rebase）

**Known gaps:**
- v2.5 收官时 40 项 `audit-open` 开启项经用户决策全部 acknowledge 归档（含 34 个 debug session 状态记录、4 个历史阶段 UAT、2 个历史阶段 VERIFICATION `human_needed`）——逐项清单见 `STATE.md ## Deferred Items`
- Phase 44 代码审查剩余已接受技术债：WR-07（嗅探首字节判定前提未确证，暂缓）；44-UI-REVIEW 3 项 minor 记入 `Acknowledged Gaps`
- Phase 30 / Phase 35（均已归档 v2.4）的 VERIFICATION 仍为 `human_needed`（历史遗留）
- Phase 28 DASH (.mpd) 播放 gap 暂缓（第二层根因未诊断）
- Phase 46 UAT 3/3 通过（含用临时 IPC 钩子取得 SKILL-04/SC3 端到端可达性证据，钩子已删）；安全审查 23 威胁 / 23 closed / 0 open
- Phase 46 遗留（非阻断）：技能集写路径未落地 —— `syncAgentSystemPrompt()` **无生产调用方**，P8 失效链本阶段只闭合 3/6，其余 3 点交接 48/49/50/51；`/skill:name` 的**实时读盘**要求已记入 STATE.md 待办

**Current milestone:** v2.6 AI 助手技能（Skill）能力（进行中）

## Next Milestone Goals

**v2.6** (in progress) — AI 助手技能（Skill）能力
- Skill 发现与调用 + `/` 命令并入 skill 列表 + 模型自动匹配
- 内置 find-skills / skill-creator 技能（完整目录播种到 managed-skills/）
- manage_skill 工具（AI 自主创建技能）
- 用户技能导入（zip 包 / 网络地址）+ 设置页技能管理区
- agent-workspace 新增 skills/ 与 managed-skills/ 双目录 + 沙箱覆盖

**v2.7+** (候选)
- 增强功能 (ENH-01~06: 截图/画中画/播放列表/字幕/DASH/RTMP)
- 书签导出 / 全屏模式 / 无痕浏览
- 搜索能力补全（浏览器 Provider DOM 解析 + 中文搜索质量优化）

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
- Electron 43.6.0（Chromium 150）+ Node.js
- 主进程管理 Session 和窗口
- 渲染进程通过 contextBridge 暴露 IPC 接口
- electron-store 持久化容器配置

**参考实现：**
- Firefox Multi-Account Containers 的交互模式
- AutoBrowser 项目的 Cookie 持久化方案（JSON 文件格式，支持 domain 前缀点号保留）
- oh-my-pi 的 skill 管理（双目录 + 多来源优先级 + SKILL.md frontmatter + 路径安全/符号链接防护），见 `.planning/research/`

**v2.6 关键发现：**
- pi-agent-core 0.84.3 **原生支持 skill** —— `loadSkills(env, dirs)`、`loadSourcedSkills`（source-tagged，天然适配双目录）、`formatSkillsForSystemPrompt`（`<available_skills>` 注入）、`formatSkillInvocation`（`<skill>` 块注入）均可直接调用；Realm 用 `Agent`（非 AgentHarness）需自行接线
- 复用资产：`/` 斜杠命令面板（renderer.js `SLASH_COMMANDS`）、`ai-attachments-manager` 的 zip 快照导入先例、`aiBashWhitelist` tag 式设置 UI、`createSandboxEnv` 硬沙箱

**代码库状态：**
- v2.5 已 shipped，在 v2.4（多窗口支持）基础上新增 AI 联网搜索与网页抓取、AI 历史对话管理、AI 三层条目记忆、播放器视频缓存与本地媒体库、B 站直播 fMP4 转录
- 45 个阶段完成（v2.5 含 6 phases / 38 plans / 76 tasks），所有计划完成
- 规模：应用源码约 81k 行（根目录 JS + `src/` 下 js/css/html）；v2.5 里程碑区间 610 文件变更 / +85709 −7204 行
- 技术栈：Electron 43.6.0（Chromium 150）+ better-sqlite3 + electron-store + Chrome DevTools Protocol + pi-agent-core + hls.js + mpegts.js + dashjs + mux.js + turndown + nodejieba

## Constraints

- **Tech Stack**: Electron 43.6.0（Chromium 150）— 项目已选定；升级须同步 UA/CH 常量（4 处）并重编原生模块
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
| web_search 走 Auto Fallback（付费 API → anysearch_free → 浏览器 Provider） | 单 provider 失败不应让搜索整体不可用；失败状态分类（rate_limited/auth/empty/low_quality/blocked）指导降级 | ✓ 已验证 — v2.5 |
| SSRF 防护收敛在 search-manager（isPrivateIp + 逐跳重定向校验），web_fetch 复用 | 抓取与搜索共用同一份内网地址判据，避免两处判据漂移 | ✓ 已验证 — Phase 40/41 |
| AI 记忆三层模型（USER.md / 全局 MEMORY.md 冻结快照注入 / 容器 memories 按需 memory_read） | 全局快照为静态文本，冻结注入不破坏前缀缓存；容器记忆不进 prompt，避免跨容器泄漏 | ✓ 已验证 — Phase 43（eval:memory 14/14） |
| 记忆规则统一收在 ai-memory-manager.buildGlobalSnapshot | 规则文本分裂两处会导致部分会话缺失规则 | ✓ 已验证 — Phase 43 |
| 对话创建惰性化（启动/打开面板不建行，首条消息或显式新建才产生对话行） | 启动自动产生的 0 消息「新对话」垃圾行违反用户预期 | ✓ 已验证 — Phase 42 UAT（G-42-1） |
| 播放器视频缓存仅独立窗口（webview tab 流量不进缓存分支） | tab 模式保持既有行为，缓存/代理链路的复杂度隔离在独立窗口 | ✓ 已验证 — Phase 44 |
| 直播录制采用「显式后台任务」模型（并发上限 / 同 URL 去重 / 关窗与退出两级确认） | 录制是长任务，需要可预期的心智模型与丢失防护 | ✓ 已验证 — Phase 44 UAT |
| fMP4 转录走纯 JS 字节拼接而非可选依赖 ffmpeg | 零新依赖、跨平台一致；代价是 QuickTime 需要 tfdt rebase 补偿时间轴 | ✓ 已验证 — Phase 45（UAT 2/2） |
| Electron 43.3.0 上游键盘 ACK use-after-free：延迟销毁 + 补丁线升级双层防御 | 上游 heisenbug 无确定性修复，结构性收窄触发窗口与版本升级并用 | ✓ 已验证 — Phase 44（44-14 / 44-15） |
| 技能段固定为 system prompt 第 4 段（末段），前三段（身份/工作区/记忆快照）全静态 | 技能集变更只影响末尾，冻结记忆段的前缀缓存边界不受影响；空技能集时整段不追加（不产空标签、不留多余空行） | ✓ 已验证 — Phase 46（UAT Test 1 实测 prompt 8989→9200） |
| 加载面收窄必须在 SDK 遍历**之前**（薄 env 覆写 `listDir`/`readTextFile`） | SDK 加载器有「根层黑天鹅」：根层直接放 `SKILL.md` 会短路整个技能集，根层散落带 description 的 `*.md` 会变成幽灵技能；事后过滤救不回，只能前置介入 | ✓ 已验证 — Phase 46 |
| 技能目录一律由 `getWorkspaceDir()` 派生；**不为 `managed-skills/` 加第二个沙箱 root 或只读挂载** | 「AI 不可删改内置技能」是**工具层不变式，不是沙箱不变式**（沙箱只有一个 root）；用第二 root 表达会引入第二套路径判据 | ✓ 已验证 — Phase 46（文档「五、沙箱边界」+ T-46-01-02） |
| 名称权威取目录名（`enforceDirNameAuthority` 就地重写 `skill.name`），重写 ≠ 丢弃 | frontmatter `name` 可声明任意值冒名顶替内置技能（P3/S1）；丢弃则等于静默删除用户从 GitHub 导入的合法技能 | ✓ 已验证 — Phase 46（T-46-02-01） |
| 同名遮蔽的**败者保留在数据层**（标 `shadowed`/`shadowedBy`）而非剔除，仅在 prompt 组装处过滤 | 48 要来源徽标、50 要列表与诊断；剔除会让两阶段需同时改数据源与展示层 | ✓ 已验证 — Phase 46（UAT Test 1 未见重复条目） |
| prompt 段预算的 entryCost 用**边际成本**（`format([dummy, skill]) - format([dummy])`）而非差值口径 | 计划原文差值口径让每条重复计入一次前言，k 条时累计比真实段长少 (k-1) 倍前言，会把贪心放行到超预算（实测 40 条技能段 9404 > 8000） | ✓ 已验证 — Phase 46（46-03） |
| bash 安装档改「**首 token 默认拒绝 + 显式只读清单**」而非继续枚举安装动词 | 白名单是**文本前缀**匹配、黑名单式子命令匹配必然可被同前缀的中间 token / 词法改写击穿（GAP 1 / CR-01 的成因）；默认拒绝把漏检面收敛到「首 token 不是包管理器」这一条天然不命中白名单前缀的边界，D-14 的「install 短路先于白名单」才真正成立 | ✓ 已验证 — Phase 47（47-05） |
| 词法归一化 **只落在 `matchInstall` 内**（`stripShellQuoting`），不提到 `normalizeSegment` / `matchesWhitelist` / `matchDangerous` 层 | 后三者的口径由既有 32 例断言锁定；提到共用层会同时移动白名单与危险判定的语义，超出 GAP 1 的必要范围 | ✓ 已验证 — Phase 47（47-05） |
| 只读豁免的三条承重墙：**空 `readOnly` 不生成动词式正则** / **纵深优先** / **`init`·`audit` 形态化**；且纵深条目**不得遮蔽它自己的只读清单**（pipx 动词限定） | 空捕获组 `\b()\b` 匹配空串 ⇒ 该工具带参形态全放行；`FLAG_TOLERANCE` 取值槽与子命令不可区分 ⇒ 只读正则会把 `npm -g install list` 读成只读；裸纵深条目会让 pipx 的非空只读清单整个不可达 | ✓ 已验证 — Phase 47（47-05） |
| 播种 `detectDiff === 'same'` 时**不写盘**（D-08 的精度化），目录项以 `rel + '/'` 参与差异判定、size/sha256 层只遍历文件条目 | 内容一致仍整目录重建会每次启动白算最贵的 sha256 层并制造 `rename(dst → bak)` 空窗（崩溃残留的触发源）；目录条目不进哈希层则 `readFileSync(dir)` 抛 EISDIR 被 fail-safe 吞成 different，本 gap 以更隐蔽的形式复发 | ✓ 已验证 — Phase 47（47-06，inode 不变实测） |
| 播种失败的三条**并列**可见面：顶层 `catch` 的 `console.error` + `finally { _flushDiagnostics() }` + 结构化 `getSeedDiagnostics()` | `finally` 只输出 `_diagnostics`，而顶层 catch 覆盖循环之外、早于任何诊断 push 的异常（此时诊断为空、flush 零输出）；删掉 catch 的 console.error 会让该路径彻底静默 | ✓ 已验证 — Phase 47（47-06，ENOTDIR 注入用例） |
| Phase 47 的 SC3 普遍性表述以 **override** 收尾，CR-01/CR-02 记技术债 | 两条零卡片残余在阶段基线即存在（非回归）、修复需改判定核心与既有锁定断言（`:847` 把该形态钉成期望的 `allow`），属独立计划规模；用户 2026-09-11 裁定「只修文档面」，文档已逐条具名披露残余 | ✓ 用户裁定 — Phase 47（`47-REVIEW.md` Disposition） |
| 技能是**第二命令源**，绝不并入 `SLASH_COMMANDS` 注册表 | 并入即被本地 handler 吞掉（命令走「清空输入框 + 执行 handler」，技能必须走「组装语法文本 → 既有发送链路 → 主进程权威解析」），两者语义不可合一 | ✓ 已验证 — Phase 48（D-04 / 48-02） |
| `/skill:` 的语法解析与 args 取值只有**一份实现**（`src/skill-picker-model.js`），渲染端与主进程共用 | 两份实现必然漂移；按名长切片取 args 在 `/skill:<前缀>` 形态下会吞掉 args 开头（P-48-01），改为 token 取值法并要求两侧同源 | ✓ 已验证 — Phase 48（48-01 / 48-02） |
| 面板行点击绑定改**扁平索引直绑**（`data-index`），取消按名字反查 | 技能名与本地命令同名时两行并存，按名反查恒命中第一行 ⇒ 「点了没反应 / 点了做错事」（P-48-04）；不可选中行不绑处理器 | ✓ 已验证 — Phase 48（48-02 T-48-09） |
| 发送路径**删除渲染端本地否决**，存在性与启停一律由主进程当场读盘裁定 | 用可能陈旧的 `state.aiSkills` 快照否决会拒掉运行期新增技能（G-48-3，用户 2026-09-11 明确要求「显式调用必须实时读盘」） | ✓ 已验证 — Phase 48（48-06 / UAT round 1 test 3 + round 3 test 14） |
| 缓存未命中时经**唯一权威入口** `syncAgentSystemPrompt()` 重扫**至多一次**后重试读盘 | 读盘口的存在性判据取自模块级缓存，运行期新增目录永不自动进缓存（全仓无 watcher / 无定时器 / 无写工具钩子）；重扫走同一加载管线以保住 shadowed / disabled / tier 三字段的单源，禁止循环与第二套判定 | ✓ 已验证 — Phase 48（48-07 / UAT round 3 test 14） |
| 延迟回写 + `skills:changed` 广播由**唯一实现** `_flushDeferredSkillsPrompt()` 承担，两个**成功**出口（含纯文本轮）共用，首行检脏早退 | 旧形态只在 `promptWithContext()`（带引用/附件）内联消费，而常规 `/skill:` 走 `prompt()` ⇒ 脏标记无限期保持真、运行期新增技能对模型自动匹配与已开面板长期不可见（G-48-18）；无条件调用则让每条普通消息多付一次全量重扫，故检脏必须早退且只在成功出口执行 | ✓ 已验证 — Phase 48（48-08 / UAT round 4 test 19） |
| `skills:changed` 消费侧**只重拉快照 + digest 早退**，不得再触发 `refreshSkills()` | 「广播 → 刷新 → 再广播」是自激回路（P-48-06）；面板刷新只保留「打开面板那一次」这一个触发源 | ✓ 已验证 — Phase 48（48-02 / 48-06，renderer `.refreshSkills(` 恒 1 处） |
| `read` 技能卡片用事件携带的**结构化 `skill_invocation`**，重载路径用同一 `matchSkillByPath` 重建标记 | renderer 侧按路径字符串匹配会随 SDK 文案/路径形态漂移；事件契约是唯一权威，重载不能另起一套判定 | ✓ 已验证 — Phase 48（48-03 / UAT round 1 test 8） |
| 技能徽标只表达**来源分类**（user / builtin / managed）；`仅显式` 标记只由 `disableModelInvocation` 决定且**不改变可选中性**；`allowed-tools` 不展示 | 徽标若被读成「技能授予了额外权限」即为虚假安全感（SDK `Skill` 接口根本没有工具授权字段、运行时也不强制）；`仅显式` 是可见性提示、不是拒绝条件 | ✓ 已验证 — Phase 48（48-02/48-03 / T-48-12） |
| `escapeHtml` 对属性上下文不转义引号（TD-48-01）与取消分支无锚点自校验（TD-48-02）**用户裁定延后** | 阶段 48 不发版；两条为 48-REVIEW 的 Critical，但形态在阶段基线即存在、修复属独立规模；用户 2026-09-12 裁定「延后至 Phase 49 开工前与 TD-48-01/02 同批处置」 | ✓ 用户裁定 — Phase 48（`48-REVIEW.md` Disposition） |
| UAT 多轮同文件用**轮次前缀**（`### [Round N] M.`）隔断编号，正文与结果一字不改 | `uat-predicate` 按 `^###\s*(\d+)\.` 扫全文件，多轮共用编号时历史 issue / skipped 会**永久**把 `phase uat-passed` 判为 false；加前缀后只有当前轮次参与门禁 | ✓ 已验证 — Phase 48 收尾（round 1–3 归档，round 4 全 pass ⇒ `uat-passed: true`） |

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
*Last updated: 2026-09-13 after Phase 48 (技能发现与调用) complete*
