---
gsd_state_version: "1.0"
milestone: v2.6
milestone_name: AI 助手技能（Skill）能力
current_phase: 48
current_phase_name: "技能发现与调用（`/` 面板 + `/skill:name`）"
status: executing
stopped_at: Completed 48-05-PLAN.md
last_updated: "2026-09-12T11:57:53.023Z"
last_activity: 2026-09-12
last_activity_desc: Phase 48 execution started
state_head: b8b855f19fe30ee90c1ab94728f83bcb1a2ea5cc
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 16
  completed_plans: 15
  percent: 0
---

# Project State: Realm Browser

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-11)

**Core value:** 容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载。
**Current focus:** Phase 48 — 技能发现与调用（`/` 面板 + `/skill:name`）

## Current Position

Phase: 48 (技能发现与调用（`/` 面板 + `/skill:name`）) — EXECUTING
Plan: 5 of 6
Status: Ready to execute
Last activity: 2026-09-12 — Phase 48 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 57+ (v1.0 through v2.4)
- Previous milestones: 39 phases complete

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 37. 地址栏地址补全 | 2 | 6min | 3min |
| 38. AI 助手供应商管理 | 3 | — | — |
| 39. Vimium 键盘操作 | 4 | — | — |
| 40 | 3 | - | - |
| 41 | 2 | - | - |
| 42 | 6 | - | - |
| 43 | 5 | - | - |
| 45 | 4 | - | - |
| 44 | 18 | - | - |
| 46 | 4 | - | - |
| 47 | 6 | - | - |

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 42 P03 | 5min | 3 tasks | 5 files |
| Phase 42 P04 | 6min | 2 tasks | 3 files |
| Phase 42 P05 | 6min | 3 tasks | 4 files |
| Phase 42 P06 | 20min | 2 tasks | 2 files |
| Phase 43 P01 | 16min | 3 tasks | 6 files |
| Phase 43 P02 | 22min | 2 tasks | 18 files |
| Phase 43 P03 | 18min | 2 tasks | 4 files |
| Phase 43 P04 | 9 min | 2 tasks | 2 files |
| Phase 43 P05 | 7min | 2 tasks | 1 files |
| Phase 44 P01 | 24min | 3 tasks | 8 files |
| Phase 44 P02 | 6min | 2 tasks | 4 files |
| Phase 44 P03 | 18min | 2 tasks | 10 files |
| Phase 44 P04 | 14min | 3 tasks | 7 files |
| Phase 44 P05 | 20min | 2 tasks | 12 files |
| Phase 44 P06 | 3 min | 3 tasks | 4 files |
| Phase 44 P07 | 5min | 2 tasks | 3 files |
| Phase 44 P08 | 8 | 2 tasks | 3 files |
| Phase 44 P09 | 2min | 2 tasks | 4 files |
| Phase 44 P10 | 4min | 2 tasks | 4 files |
| Phase 44 P11 | 4min | 2 tasks | 3 files |
| Phase 44 P12 | 6min | 2 tasks | 7 files |
| Phase 44 P13 | 3min | 2 tasks | 5 files |
| Phase 44 P17 | 3min | 2 tasks | 2 files |
| Phase 44 P18 | 15min | 3 tasks | 8 files |
| Phase 45-bilibili-fmp4-transcode P01 | 14min | 2 tasks | 4 files |
| Phase 45 P02 | 7min | 2 tasks | 4 files |
| Phase 45 P03 | 8min | 2 tasks | 3 files |
| Phase 45 P04 | 20min | 2 tasks | 2 files |
| Phase 46 P1 | 5min | 3 tasks | 4 files |
| Phase 46 P2 | 3min | 3 tasks | 2 files |
| Phase 46 P3 | 12min | 3 tasks | 2 files |
| Phase 46 P4 | 14min | 3 tasks | 3 files |
| Phase 47 P1 | 12min | 3 tasks | 6 files |
| Phase 47 P2 | 6min | 3 tasks | 3 files |
| Phase 47 P3 | 10min | 4 tasks | 21 files |
| Phase 47 P4 | 22min | 3 tasks | 5 files |
| Phase 47 P5 | ~1 session | 3 tasks | 5 files |
| Phase 47 P6 | ~1 session | 3 tasks | 3 files |
| Phase 48 P01 | 17min | 3 tasks | 11 files |
| Phase 48 P02 | 7min | 3 tasks | 6 files |
| Phase 48 P03 | 21min | 3 tasks | 7 files |
| Phase 48 P04 | 5min | 2 tasks | 2 files |
| Phase 48 P5 | 5min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.6 路线图]: 技能双目录 tier 只有 2 层（`agent-workspace/skills/` user > `managed-skills/` managed），不引入 oh-my-pi 的 7 层 provider priority；同名去重 user 胜出且冲突必须对用户可见 — Realm 只有 2 类来源，7 层机制引入即纯负担
- [v2.6 路线图]: 6 阶段刻意不合并（granularity coarse 允许 46+47 / 48+49 合并）——每个 S1 门禁需要独立归属与独立验收面（P1→47、P2/P4→51、P3 拆 46+51），合并会让门禁与"同阶段交付"硬约束互相遮蔽
- [v2.6 路线图]: 硬排序不可调换——技能目录先入沙箱（46，否则模型可见 location 却 read 不到，静默失效）→ 播种+bash 加固同阶段（47）→ `manage_skill`（49）先于设置页（50）与导入（51），保证 name/description/大小/注入校验只有一份实现 → 导入管线最后（51）
- [v2.6 路线图]: `manage_skill` 工具绝不吃 `path` 参数（只吃 `name` + `content`/`description`，路径由 manager `path.join` 计算）——两个技能目录都在沙箱 root 内，`resolveInside` 会放行工作区任意路径，接口设计本身才是边界
- [v2.6 路线图]: zip 解压库选 `yauzl@^3.4.0`（唯一新增运行时依赖）——它从不写盘（落盘 100% 由 Realm 决定），adm-zip CVE-2026-76845 那类"库自己跟随预置 symlink 写出根目录"在架构上不可能发生；明确不用 extract-zip（CVE-2026-56876 无补丁）/ adm-zip
- [v2.6 路线图]: DOC-01 归 Phase 46（新建 `docs/product/ai-skills.md` 骨架）、DOC-02 归 Phase 47（`ai-agent-workspace.md` + `AGENTS.md` 的权限与免责声明）——按 AGENTS.md 约定随行为变更阶段同步，不设独立文档阶段、不回填到最后
- [Phase 38]: AI 配置按提供商存储（ai.providers.{id}.{apiKey,model}）
- [Phase 38]: AI 消息 Markdown 渲染必须 DOMPurify 消毒
- [Research]: search-manager.js 独立模块，委托 ai-manager 工具注册
- [Research]: SSRF 防护贯穿 search-manager + web_fetch（isPrivateIp + safeFetch）
- [Research]: turndown 唯一新增 npm 依赖（HTML 转 Markdown）
- [Phase 42]: 对话创建惰性化：启动/打开面板不建行，首条消息或显式「新对话」才产生对话行，删除不补建（D-06 修订，G-42-1） — UAT G-42-1：启动自动产生的 0 消息「新对话」垃圾行违反用户预期，空状态「暂无对话」必须可达
- [Phase 42]: saveMessages 全量替换事务 + getConversations LEFT JOIN COUNT message_count + prompt 响应回传 conversationId（G-42-2） — pi-ai AgentMessage 无顶层稳定 id，INSERT OR REPLACE 每次保存重复插入（6 条消息 14 行）；列表需真实消息数与对话 id 高亮
- [Phase 42]: 消息存储管线归一化：写入侧按角色提取（assistant 纯文本+tool_calls 结构化，thinking 不落盘）+ 显示/注入双形状读出 + 旧 JSON 行读时兼容不迁移（G-42-3） — 库数据自解释，读取端无需猜测格式；历史脏数据零迁移成本
- [Phase 42]: switchConversation 改 async 并 await _recreateAgent 后注入 getAgentMessages 历史（AgentMessage 形状，toolResult 按 D-14 参与上下文），IPC 对应 await（G-42-4） — 同步帧内 agent 恒 null 致注入守卫恒 false，是上下文丢失根因
- [Phase 42]: 删除确认目标结构化传参：showDeleteConfirm 写 dialog dataset，确认处理器读 dataset，state.convContextTarget 字段整体移除——彻底解除对会被 document 级 closer 清空的共享状态的依赖（G-42-6） — 确认流程不再依赖可被全局 closer 重置的共享可变状态；菜单项点击在 target 阶段显式关菜单，冒泡阻断后 closer 仅服务真正的面板外点击（G-42-5/G-42-6 诊断首选方案）
- [Phase 42]: 主窗口弹框统一原生 dialog + showModal()/close() + 类规则显式 margin:auto + ::backdrop 遮罩；禁止全屏 div 遮罩类用于 dialog；realm:// 页面 CSP 豁免——已沉淀 AGENTS.md「弹框居中约定」小节（G-42-7 用户明确要求） — 全局 * { margin: 0 } 会清掉 UA 的 dialog margin:auto 居中；width/height:100% 撑满方案已被 Electron 43 实测否决（UA max 尺寸截断致 19px 偏心），与 .modal/下载弹窗项目惯例一致
- [Phase 42]: G-42-8 双层修复：getMessages 同回合相邻 assistant 行合并（仅显示形状：纯工具行卡片追加/文本采纳进空 content 前条/双文本行保守不合并，锚定回合首行 id/timestamp）+ renderAIMessages 空 content 气泡守卫（流式末条占位豁免，不以工具卡片存在为前提）；getAgentMessages 注入形状零变化（D-14/CR-01 行级结构保持） — pi-agent-core 工具回合落库三行 assistant(''+tool_calls) → toolResult → assistant(text)，行级 1:1 映射产出空气泡 + 文本跑到卡片下方；显示/注入双形状分离（冒烟 48 断言证明互不渗漏）
- [Phase 43]: BUDGETS 预算数值只在 ai-memory-manager.js 一处（1375/2200/2200）；memory 工具 parameters 不写数值，预算语义由 description 承载
- [Phase 47]: 安装档改「首 token 默认拒绝 + 显式只读清单」（非继续枚举安装动词）—— 白名单是文本前缀匹配、黑名单式子命令匹配必被同前缀的中间 token / 词法改写击穿；默认拒绝把漏检面收敛到「首 token 不是包管理器」这一条天然不命中白名单前缀的边界
- [Phase 47]: 词法归一化 `stripShellQuoting` 只落在 `matchInstall` 内，不提到 `normalizeSegment` / `matchesWhitelist` / `matchDangerous` 层 —— 后三者口径由既有 32 例断言锁定，提到共用层会同时移动白名单与危险判定语义
- [Phase 47]: 只读豁免三条承重墙（空 `readOnly` 不生成动词式正则 / 纵深优先 / `init`·`audit` 形态化）+ 纵深条目不得遮蔽自身只读清单（pipx 动词限定）—— 空捕获组与旗标取值槽都会反向击穿默认拒绝
- [Phase 47]: 播种 `detectDiff === 'same'` 不写盘（目录项以 `rel + '/'` 参与差异判定、size/sha256 只遍历文件条目）—— 消掉每次启动的最贵哈希层与 `rename(dst → bak)` 空窗（崩溃残留的触发源）
- [Phase 47]: 播种失败保留三条**并列**可见面（顶层 catch 的 `console.error` + `finally` 的 `_flushDiagnostics` + 结构化 `getSeedDiagnostics`）—— `finally` 覆盖不了循环外、零诊断的异常
- [Phase 47]: SC3 普遍性表述以 **override** 收尾，CR-01/CR-02 两条零卡片残余记技术债（基线即存在、非回归；根治走 argv 级分词），文档逐条具名披露 —— 用户 2026-09-11 裁定「只修文档面」
- [Phase 43]: containerId 强制 /^[\w-]+$/ 校验防路径穿越；test:memory 用 node --test glob（Node 22 目录尾斜杠会被当模块解析）
- [Phase 43]: [Phase 43]: 删除钩子惰性 require + await（删除方保证原子性）；harness 复用 ai-manager 工具链经 Module._load 拦截 tab-manager mock；expect 扩展 assistantSays/anyOf 支持二择一行为断言，安全不变式恒在顶层
- [Phase 43]: 43-03：/api/ai-memory 预算数值单源自 manager BUDGETS（端点与前端零字面量）；POST 空 content 400，清空整层记忆暂不可经 UI 完成
- [Phase 43]: 记忆规则统一收在 ai-memory-manager.js buildGlobalSnapshot（不可信来源拒绝+容器记忆边界+层级归属指引），不改 REALM_SYSTEM_PROMPT — 规则文本分裂两处会导致部分会话无规则；快照静态文本随 D-04 冻结注入不破坏前缀缓存（43-04）
- [Phase 43]: 不做工具层载荷标记 fail-closed（T-43-08 accept） — 任意载荷标记无法与正常记忆内容区分会误杀正常写入；D-11 scanInjectionPatterns 已覆盖注入指令模式（43-04）
- [Phase 43]: eval 失败修正只改规则文本不改 fixture 断言；43-04 第 1 轮 13/14 后补正向层级路由，第 2 轮 14/14 — fixture 是验收基准；critical-path-02 失败根因是快照缺正向层级归属指引致模型默认落 user 层
- [Phase 43]: G-43-2 成功提示守卫：updateAiMemoryCount hint 联动段短路（!over return），字数/按钮更新先行不受影响；超限优先清守卫走 danger（T-43-09） — finally 结构不动，改动面最小；2 秒回调无条件复位守卫无残留路径
- [Phase 44]: Phase 44 P01: 分片→视频归属用 vid 参数（m3u8 videoId 经 rewrite 注入子请求），无全局索引文件（裁量区）；整片 buffer 收集后写盘（64MB 上限）使 ENOSPC 强淘重试内聚；cache 标记仅 cache=1 请求展开为 cache+vid，webview tab 流量不进缓存分支（D-01）；新增 player:resume-position 续播点查通道；淘汰豁免双通道（isVideoActive 注入回调 + exemptVideoIds 防强淘误删在写目录）
- [Phase 44]: Phase 44 P02: media-task-manager restoreTasks 按 T-44-05 字段类型白名单校验（未知字段丢弃/非法条目跳过/坏 JSON 返回空数组）；persist 异常吞掉仅告警不阻断状态机；isVideoActive(playbackKey) 为 D-07 豁免查询源契约，注册表不反向依赖 media-cache-manager
- [Phase 44]: 媒体任务键统一 settings.cacheDir/cacheMaxGB（44-01 遗留键切换，无存量数据）
- [Phase 44]: webview guest 设置页对话框走 /api/settings/choose-cache-dir HTTP 端点（guest 无 realmAPI）
- [Phase 44]: Phase 44 P04: 录制引擎去 Electron 化（fetchPage 注入，main.js 容器 session 包装 ses.fetch）；meta.json stop/fail 双路径落盘供 44-05 续转；录制进度 live 流按 recorded/seen 比率偏低是真实语义，VOD 转正收敛；Task3 退出确认续走既有协程（双击确认门会拦截 setImmediate 重启路径）；appQuitting 标志防退出双重弹窗；新增 player:record/list 通道供 keep-recording 重开窗口恢复红点
- [Phase 44]: Phase 44 P05: mux.js 单实例顺序转封装（data 监听先于 push + 流式写盘 + discontinuity 拒转依据落到 record meta/缓存 meta 检测）；缓存 completeness/顺序索引补齐（updatePlaylistIndex 登记分片顺序/总数，playlist_order 优先 stored_at 兜底，附加字段不升 META_VERSION）；convert error 落库带「MP4 转换失败：」前缀（通知去重）；续转扩展 interrupted/failed/completed record；convert 进度整数百分比变化才 updateProgress 降 persist 写放大；settings.lastMediaSaveDir 记忆弹框目录
- [Phase 44]: Phase 44 44-06: 缓存 key 统一为请求 URL（target）废弃 finalUrl——命中优先下 finalUrl 回源后才能得知无法用作查询 key；target 与 44-05 playlist_order segKey（resolveUri(uri, 清单最终URL)）同源，转封装顺序索引不回归（CR-01）
- [Phase 44]: Phase 44 44-06: 旧 finalUrl-key 存量孤儿分片不迁移——键不再被查询，由容量淘汰（44-07 CR-02 修复后生产生效）按 total_size 正常回收，接受此代价（缓存非持久资产）
- [Phase 44]: Phase 44 44-06: hlsRetryCount 复位事件选 FRAG_LOADED 而非 LEVEL_LOADED——分片数据到达=最精确「网络恢复」信号，直播刷新/清单级不误触发（WR-06）
- [Phase 44]: Phase 44 44-07: CR-02 采用水位方案替代每片全库扫描——storeBuffer 成功登记后累计 _trackedTotal（首写惰性初始化取磁盘权威总量、_writeMeta 已含本片不重复加防双计），仅水位越过 capacityBytes 才 evictIfNeeded(exempt 正在写 videoId) 一次并把 r.total 同步回水位自校正漂移；ENOSPC 强淘 D-08 兜底保留（prohibition 无每分片全扫回归）
- [Phase 44]: Phase 44 44-07: setCapacityBytes 为容量变更统一入口——设置页 cacheMaxGB 即改即存改调 mediaCache.setCapacityBytes（校验赋值 + 立即 evictIfNeeded + 水位同步），外部不再直改 capacityBytes 字段；改小容量即时按 last_watched FIFO 收敛（CR-02 missing 第 2 项）
- [Phase 44]: Phase 44 44-07: CR-03 RECORD_ROOT 常量单一来源——main.js whenReady 作用域声明 const RECORD_ROOT = path.join(app.getPath('userData'), 'media-records')，createRecordEngine.recordRoot 与 readRecordTaskSegments 补算同源；字面全文件唯一（引擎写目录与补算回退不漂移）
- [Phase 44]: Phase 44 44-07: readRecordTaskSegments 目录补算 + uuid 白名单——outputPath 缺失（interrupted/failed 终态才落库的恢复快照）按 path.join(RECORD_ROOT, task.id) 补算，task.id 过 /^[0-9a-fA-F-]{8,64}$/ 白名单防本地篡改 JSON 的补算路径穿越；completed 任务沿用 outputPath 不受影响
- [Phase 44]: cancel 对 running record 走 recordEngine.stopRecord（引擎 completeTask 后无需再 cancelTask，not_found 且仍 running 才兜底）——任务页停止语义 = 红点停止 = 停止并保存
- [Phase 44]: convert 取消 = 协作式信号（convertCancelTokens → shouldCancel 每分片检查），reason='cancelled' 拦截在文案映射前落 cancelled 而非 failed
- [Phase 44]: convertCancelTokens 令牌 .finally 注销（三终态路径收敛防 Map 泄漏）；终态竞态窗口接受
- [Phase 44]: G-44-5 toast 落主窗口 renderer，播放器不重复建设 toast 基建；.toast 基类 pointer-events:none，可点击变体必须显式恢复 pointer-events:auto
- [Phase 44]: Phase 44 P12: deleteEntry 历史删除联动收在 IPC 层（严格 === true + 缓存删除成功前置 + hex 防御三重护栏），缺省 falsy 零触达 playerHistory——D-16 仅删缓存语义逐字节不变 — G-44-8：主进程单点裁决防 renderer 伪造第二参误删观看历史
- [Phase 44]: 44-17: convertToMp4 产物改同步 fd 创建（openSync 'w' + createWriteStream {fd}），消除异步 open/unlink 竞态（G-44-7 泄漏层）
- [Phase 44]: 44-18：EXT-X-KEY 加密检测下沉到 m3u8 解析层；key_uris 与 segments 同源 segKey 白名单式排除，密钥不拦截播放只跳落库
- [Phase 45]: D-05: parsePlaylist captures EXT-X-MAP mapUri/mapByterange, multi-MAP latest wins (RFC 8216 4.3.2.5), null defaults
- [Phase 45]: D-06: sniffContainerBuffer returns internal fmp4_container signal; convertToMp4 diverts on initPath presence
- [Phase 45]: Encrypted path (decryption) keeps unsupported_container rejection for fMP4 (D-04)
- [Phase 45]: Final product probe reads 4MB head only (T-45-02), baseline ftyp+size fallback
- [Phase 45]: 45-02 录制引擎 init 留存——pollLoop 检查点在首轮/追新分支之外（首轮 baseline 也下，Pitfall 1）；固定常量 'init' 文件名不进 seen/recorded；BYTERANGE 不下载落 init_missing 兜底；下载失败不记 consecutiveFailures 下轮自然重试（D-05）
- [Phase 45]: 45-02 编排层 initPath 两跳透传（readRecordTaskSegments→startConvertFromRecordTask→startConvertTask→convertToMp4），编排其余零改动（D-06）；CONVERT_FAIL_TEXT 补 init_missing/invalid_init（Pitfall 5）
- [Phase 45]: [Phase 45]: 45-03 缓存链路 MAP 三件套——updatePlaylistIndex 登记 map_uris/has_fmp4_map（BYTERANGE 仅记 map_byterange 兜底 init_missing）；storeBuffer init 本体落盘 <videoDir>/init 绝不进 segments（D-05/D-07/Pitfall 2）；getConvertInfo 透出 initPath/hasFmp4Map（D-03 第二链路）
- [Phase 45]: [Phase 45]: 45-03 startConvertFromInput init_missing 早拒（hasFmp4Map && !initPath，key_unavailable 同区段）+ initPath 透传；lookup() init 回放列入 deferred（RESEARCH Q5 Wave-2）
- [Phase 45]: [Phase 45]: 45-04 tfdt 时间轴 rebase 单点修复——concatFmp4ToMp4 分片写出循环集成 rebaseFmp4SegmentTfdt walker（baselines Map init 写出后/循环前创建），录制 tracer 与缓存链路共用入口单点覆盖；首片 tfdt 记为轨基线改写为 0，当前值<基线保守不改写；不修 moov/不注 elst/零新依赖（G-45-2）
- [Phase 46]: 技能段固定为 system prompt 第 4 段（末段），前三段全静态 —— 技能集变更不影响冻结记忆段前缀缓存（D-01）
- [Phase 46]: 加载面收窄发生在 SDK 遍历之前（薄 env 覆写 listDir/readTextFile），不导出 createSkillsEnv，测试只经公开面断言
- [Phase 46]: 技能目录一律由 getWorkspaceDir() 派生；resolveInside/createSandboxEnv 本阶段零 diff（不为 managed-skills 加第二个沙箱 root）
- [Phase 46]: 46-02：遮蔽败者不从 _cache.skills 剔除（返回数组与输入等长），标 shadowed/shadowedBy 并保留 —— D-06 costly：48 要来源徽标、50 要列表与诊断，剔除需两阶段同时改数据源与展示层
- [Phase 46]: 46-02：名称权威取自 path.basename(path.dirname(entry.skill.filePath)) 并就地重写 skill.name（Skill 五字段无位置字段，<location> 只是 XML 标签名）；重写 ≠ 丢弃，命名不规范的合法技能仍进 prompt
- [Phase 46]: 46-02：applyShadowing 只消费 loadSourcedSkills 的输入顺序（managed → user）不重新定义优先级，且必须排在 enforceDirNameAuthority 之后（重写后单目录内 name 唯一，遮蔽判定才无歧义）
- [Phase 46]: 46-02：本计划不对 getSkillsSnapshot().skills 的条目顺序做任何断言 —— 该顺序唯一权威是 46-03 Task 2 的 bySkillPriority；优先级方向改用「败者 filePath 位于 managed-skills/ 下」钉死
- [Phase 46]: 46-02：_cache.diagnostics 容器在加载后管线开始前就位、之后只做追加（原先管线末尾整体赋值会静默覆盖新诊断）
- [Phase 46]: 46-03：description 类 invalid_metadata 跳过、name 类不跳过 —— 46-02 的 D-08（以目录名重写并保留）与 46-03/SKILL-06 的「非法 name 被跳过」措辞冲突，按更具体的锁定决策 D-08 调和：description 是渐进式披露下模型匹配技能的唯一依据（不可用即永不触发，必须跳过），name 不一致是可被目录名权威化解的告警（丢弃等于静默删除用户从 GitHub 导入的合法技能）
- [Phase 46]: 46-03：prompt 段预算的 entryCost 改用边际成本 format([dummy, skill]) - format([dummy]) —— 计划原文 format([skill]) - format([dummy]) 让每条重复计入一次前言，k 条时累计口径比真实段长少 (k-1) 倍前言，会把贪心放行到超预算（实测 40 条技能段长 9404 > 8000）
- [Phase 46]: 46-03：errors[] 在每次刷新的 try 开工处复位（目录缺失诊断需在成功路径存活；原成功路径末尾整体置空会清掉它）；bySkillPriority 是集合顺序唯一权威且排在遮蔽之后（胜负由输入顺序定，可观测顺序由比较器定，职责正交）
- [Phase 47]: 47-01 内置技能播种：seeded 身份 = 扫随包 skills-builtin/ 目录名集合（零状态文件/零硬编码），播种按单个技能目录粒度无条件覆盖，覆盖前差异诊断固定 warning 级（D-09 可见但不阻断） — 回退到状态文件需 Phase 48/49 同步改数据源且跨环境会分叉
- [Phase 47]: 47-01 差异检测按内容（相对路径集合 → size → sha256 逐层短路）而非 mtime —— safeCopyDir 每次同步都重写 mtime，用时间戳判差异等于每次启动 100% 误报 realm_builtin_seed_overwritten；IO 错误一律 fail-safe 判 different 重同步
- [Phase 47]: 47-01 realm_builtin_src_invalid 必须由 seedBuiltinSkills 的独立源目录扫描产出（先报），不得挂在 getSeededSkillNames 的过滤返回上（后滤）—— 后者已把缺 SKILL.md 的子目录滤掉，会让该 code 永远不可达（评审裁决项 1）
- [Phase 47]: 47-02: install 档独立为 reason 'install' 且短路先于 matchesWhitelist（白名单不可越过安装档）；level 取值集不变，保持三档框架，第三档有两个互不包含的触发源（危险命令表 / 包管理器安装表）
- [Phase 47]: 47-02: evaluateBashCommand 所有分支返回完整形状（含 installNames: []），供 Phase 48/49 直接消费；2 条既有 deepStrictEqual 已同步
- [Phase 47]: 47-04 Task 3 打包实跑（Nightly）取得 SEED-05 全部打包面证据：app.isPackaged 分支为真、asarUnpack 生效（unpacked 两侧同在）、安装产物 asar 清单八类排除全 0 且 skills-builtin/ 与 THIRD_PARTY_NOTICES.md 在列、运行期播种两技能目录齐备、进程内 _cache.diagnostics/errors 均空且 buildSkillsPrompt() 为空、幂等（detectDiff same 且无覆盖诊断）与自愈（手删重播）成立
- [Phase 47]: research 假设 A2 实测结论——make install-nightly 继承（不覆盖）package.json 的 build.asarUnpack；证据为 Makefile 仅传三个点号合并式 --config.* 覆盖 + 本次构建 app.asar.unpacked 下 skills-builtin 与 node_modules/nodejieba 两侧同在（nodejieba 是另一条 asarUnpack，生效即证明整段继承）。注：dist/builder-effective-config.yaml 在 --mac dir 下未随本次构建重新生成，改用重新生成的 builder-debug.yml 佐证 files 段来自 package.json
- [Phase 47]: 打包实跑的两个可复用取证手法——① 读运行中主进程内部状态用直连 Node inspector 的 CDP Runtime.evaluate + includeCommandLineAPI（playwright 的 electronApp.evaluate 上下文无 require）；② Realm 有双击确认退出语义（QUIT_CONFIRM_WINDOW_MS=3000），干净退出需 3 秒内连发两次 osascript quit
- [Phase 48]: [Phase 48] 48-01：跨进程规则单源——解析器住 src/skill-picker-model.js（零依赖双模式导出），renderer 与 main 各自委派，杜绝两份 token/边界实现（P-48-01 的 rest 取值缺陷由 extractArgs token 取值法一次修掉两处）
- [Phase 48]: [Phase 48] 48-01：parseSkillRef 裸名分支加「本地命令名前缀占位」歧义护栏（/foobar 对 foo → null 走未知命令），是计划四条 behavior 行唯一自洽读法；裸名 not-found 与 /skill: not-found 分两条文案（UI-SPEC §Copywriting）
- [Phase 48]: [Phase 48] 48-01：显示值与载荷解耦——气泡 content = args、IPC 载荷 = 完整语法文本；重发路径经 buildResendPayload → buildSkillSyntaxText 重组（空 args 时载荷 /skill:{name} 非空，不再静默不动作）
- [Phase 48]: [Phase 48] 48-01：流式中触发技能调用时 abort 后就地复位 aiStreaming/aiCurrentMessageId/发送按钮（取消事件异步到达，不复位则被流式守卫静默丢弃）
- [Phase 48]: [Phase 48] 48-01：refreshSkillsForPanel 只是 syncAgentSystemPrompt 的读侧生产调用方（函数体逐字未改，46-04 五条方法体断言继续绿）；写路径收口仍归 49/50/51，STATE.md 的 syncAgentSystemPrompt ⚠️ 不因 48 闭合
- [Phase 48]: 48-03：技能标记判定收敛到工具事件生成侧（ai-manager）—— _resolveSkillMarker 同步零 IO；路径归一化只用纯词法 path.resolve（与 SDK env.absolutePath 同规则），不额外展开 ~ / file://，命中只走 matchSkillByPath 的缓存 filePath 规范化全等 + basename 必须为 SKILL.md；renderer 零路径字符串匹配 — renderer 在 file:// 主窗口、无 sandboxEnv，拿不到技能目录权威路径；按字符串包含猜就是第二份判定实现（T-48-10 根因）。~ / file:// 解析后落在工作区外，标 null 与沙箱拒绝行为一致 —— 引入第二套解析会与沙箱分叉
- [Phase 48]: 48-03：一处实现两处调用 —— 实时链路（tool_execution_start 的 skill_invocation）与重载链路（getConversationMessages 装饰 assistant 行 toolExecutions）共用 _resolveSkillMarker，产出对象形状以「键集合逐字相等」断言；标记必须在 start 事件一次性给出（end 不带 params，错过无第二次机会） — 两条链路若各写一份判据必然漂移（重开对话后卡片标记丢失或形状不一致）；用「实时 vs 重载键集合逐字相等」比分别断言两侧形状更难被绕过
- [Phase 48]: 48-03：产品文档讲行为不讲字段 —— 边界行为表用中文状态名（超数量上限 / 未进提示词 · 超预算）不出现 overLimit / promptOmitted；并显式写明 disable-model-invocation（可显式调用、打「仅显式」）与「已禁用」（两入口都拒、面板不显示）是两个互不蕴含的 flag — 字段名属实现细节，文档写字段会让说明随重构腐烂；两个 flag 语义相反是最易被实现合成一个开关的地方（DISC-07 的正面要求），必须成文防回归
- [Phase 48]: [Phase 48] 48-04：readSkillForInvocation 的同一性判据改为**所在目录路径全等**（纯词法 path.resolve），不再比较 SDK 读回的 name —— Skill.name 是 frontmatterName || parentDirName（skills.js:218-219），可被 SKILL.md 内容伪造，用它判同一性等于把 P3/S1 要堵的冒名路径重新放行；目录名才是 Realm 的唯一权威（46 D-08），而该权威此前只作用于缓存层、读盘层不享有 —— 判据取**位置**不取**属性**
- [Phase 48]: [Phase 48] 48-04：命中后返回 { ...fresh, name }（name 重写为入参目录名）—— SDK formatSkillInvocation 取 skill.name 生成 <skill name="…">（skills.js:9），不重写会让 frontmatter 声明的名字进注入块；重载链路 parseStoredSkillInvocation 从该属性取技能名，重写同时保证重开对话后 pill 名称与实时链路一致；并删除与目录路径判据冲突的 || skills[0] 兜底
- [Phase 48]: [Phase 48] 48-04：「目录被换成别的技能」的负例判据换成「目录读不到 / 路径不等」（读盘为空 → not_found），不再依赖会与「name≠目录名」混淆的字段；测试 helper writeSkill 增 frontmatterName 选项（默认 = 目录名，既有 129 例调用零改动）—— 默认值恒等于既有行为是新增覆盖面不产生回归的前提
- [Phase 48]: 48-05：G-48-6 修复用「构建单源 + 定向刷新」而非整列重绘 —— 抽 buildUserMessageContent（用户气泡唯一实现）与 refreshUserMessageBubble（只 replaceChild 该条 .ai-message-content），三处 skillInvocation 回填后立即调用；整列 renderAIMessages() 会丢滚动位置与正在流式的气泡节点（UAT missing 明文要求）
- [Phase 48]: 48-05：G-48-4 取消归属改用 aiCancelledMessageId 锚点并抽到 src/ai-cancel-state.js（零依赖纯函数 resolveCancelAttribution）；resetRunState 只由锚点等式决定、与消息列表形态无关（消息被移除也保住按钮语义），新一轮已开始时不得越权复位（否则 message_update 整批丢弃）；aiCancelledByUser 与停止按钮语义一字未改
- [Phase 48]: 48-05：ai:abort 保持同步返回——刻意不做 48-REVIEW CR-03 的替代方案「等 run 结算再返回」，锚点已能隔离归属，主进程等待语义会新增挂起路径（run 未结算时新消息被无限期挡住、需超时兜底），风险高于收益

### Roadmap Evolution

- Phase 42 added: AI 历史对话功能调研与 pi-agent 集成方案
- Phase 43 added: AI 记忆系统集成（条目记忆 MVP），方案定稿见 docs/plan/ai-memory-system.md
- Phase 44 added: 播放器视频缓存与本地媒体库（独立窗口 proxy 收口、分片缓存+观看历史续播、直播录制+媒体任务中心，方案定稿 2026-09-06 讨论完成）
- v2.6 路线图创建（2026-09-10）：Phase 46-51 六阶段，47 项需求 100% 映射（SKILL 9 / DISC 7 / MGMT 6 / USER 8 / SEED 5 / SEC 10 / DOC 2）；依据 `.planning/research/SUMMARY.md`（HIGH confidence）
- Phase 46 added: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入）
- Phase 47 added: 内置技能播种 + bash 策略加固（P1 门禁）
- Phase 48 added: 技能发现与调用（`/` 面板 + `/skill:name`）
- Phase 49 added: `manage_skill` 工具（AI 自建技能）
- Phase 50 added: 设置页技能管理区 + `/api/skills/*`
- Phase 51 added: 用户技能导入管线（zip + 网络地址，P2/P4/P9 门禁）

### Pending Todos

None yet.

### Blockers/Concerns

**v2.6 需要 plan 期先拍板的开放决策（research Open Decisions）：**

- ~~O1（47）：find-skills 去 CLI 化程度~~ — **已在 Phase 47 落定**（find-skills 改写为零安装候选清单技能 + 二段式零安装语义静态扫描器；skill-creator 按固定 SHA 随包并受控改写三处平台专有内容）
- O2（51）：zip 多技能包语义——v1 定为"恰好一个技能根"，多技能勾选留 v1.x
- O3（47/51）：`allowed-tools` 解析但必须带免责标注；执行层门禁明确 Out of Scope —— **Phase 47 半边已落定**（`ai-agent-workspace.md` §七第 6 条 + `ai-skills.md` §六 的免责标注；IN-04 交叉引用已修正为第 6 条），51 半边（导入时解析该字段）待办
- ~~O4（47）：seeded 技能升级策略——版本戳登记表 + 未修改才覆盖~~ — **已被 Phase 47 取代**：ROADMAP 判据 1 改写为「内容一致时 `detectDiff` 判 `same` → 零差异、零诊断，重启不重复写」，由 47-06 实现（内容比对而非版本戳表；零状态文件、零硬编码）；用户手改 → `realm_builtin_seed_overwritten` warning 后覆盖，手删 → 自愈重播
- O5（51）：frontmatter 是否显式 require `yaml`——若 require 必须提升为直接 `dependencies`（否则换 pnpm 立刻 MODULE_NOT_FOUND）
- ~~O7（46/50）：`MAX_SKILL_MD_BYTES` / `MAX_USER_SKILLS` / prompt 段字符预算具体数值需结合实测用量定~~ — **已在 Phase 46 落定**（`ai-skills-manager.js LIMITS`：64 KiB / 50 / 8000）。Phase 50 只负责把这些数值渲染给用户，不得重新定义
- ~~O8（46）：`/compact` 不保留技能正文，须写进 `docs/product/ai-skills.md` 已知限制~~ — **已在 Phase 46 落定**（文档「六、已知限制」）
- ⚠️ [Phase 48/49/50/51] `syncAgentSystemPrompt()` **本阶段无生产调用方** —— 技能集写路径（`/` 面板 48 / `manage_skill` 49 / 设置页启停卸载 50 / 导入 51）落地时**必须**把「写成功后调用 `syncAgentSystemPrompt()`」写成显式交付项与验收项；P8 失效链本阶段只闭合 3/6 —— **2026-09-12 规划期注记**：Phase 48 已新增**读侧**生产调用方 `refreshSkillsForPanel()` → `await this.syncAgentSystemPrompt()`（D-17 / P8 触发点，48-01 Task 2）；但「写成功后回写」仍归 49/50/51，**该 ⚠️ 不因 48 闭合**
- ⚠️ [Phase 48] `/skill:name` **显式调用必须实时读盘**（用户 2026-09-11 UAT 明确要求）—— 技能正文当场从磁盘读取，不得依赖 prompt 快照或对话历史里的旧回答。背景：46-UAT Test 3 实测「切回老对话看不到磁盘改动」，根因是模型复读自身历史答案（两次回答 1801 字符逐字相同），非重扫失效
- ⚠️ [Phase 48] prompt 未区分「工具 / 技能」两个概念 —— 模型被问「你有哪些技能」时会把 27 个 tool 也称作技能（仅 demo 是真技能）；无历史污染时模型自行区分正确。做 `/` 面板时可考虑补一句措辞
- ⚠️ [Phase 48 · 规划期技术债] **plan-checker 第 4 轮独立门禁未运行** —— 子代理配额 429（重置 2026-09-13 10:53），第 3 轮 checker 查出的 1 blocker（`resolveSkillBubbleArgs` 空 args 分支）+ 1 warning（`regenerateMessage`/`showError` 重试丢技能注入）由 planner 修订后，改由**主会话**做聚焦验证并判定成立。独立 gate 对这两项的属性已降级（非独立上下文）；执行前若配额恢复，可重跑 `/gsd-plan-phase 48 --skip-research` 复验。
- ⚠️ [Phase 48 · 执行期注意] `resolveSkillBubbleArgs` **残留窄洞**：纯 `prompt()` 路径下，若 args 的尾段恰为 `'\n\n' + '/skill:{name}'`（用户手打 `/skill:alpha 第一段` + 空行 + `/skill:alpha`），pass1 无非空解、pass2 命中该假候选 → 返回 `''` 而非真 args（`promptWithContext` 形态因尾段 `用户消息：` 使 pass1 命中而不受影响）。触发需 args 末尾逐字重复同一技能 token，属病态但可达。48-01 Task 1 的八例解析表不含该形态 → 测试可全绿而该输入显示错 args。判据见 `48-01-PLAN.md` Task 1 ③ 第 4/6 步。

- ⚠️ [技术债 · 无归属阶段] **bash 安装档只读豁免的结构性根因** —— `matchInstall` 用「整段正则 + `FLAG_TOLERANCE` 取值槽」判只读，使三条形态在白名单含裸工具名时**零卡片**：CR-01（`npm -g update` / `npm --global rebuild`）、CR-02（`npm audit --json fix`）、残余 ③（`npm -g update ls`）。三者均在 Phase 47 基线即存在（非回归），已具名写进两份产品文档的残余段与 `47-REVIEW.md`。**根治 = argv 级分词 + 显式「带值旗标」清单**；修的时候须同步改 `tests/test-ai-bash-policy.js:847`（它当前把 CR-01 的词法形态钉成期望的 `allow`）与三份文档口径。另两条同源技术债：`ai-bash-policy.js:249` 的 JSDoc 称旗标容忍「不会吞掉子命令本身」（与 CR-01 矛盾）、`docs` 只读枚举缺机械漂移护栏

**v2.6 待实测风险（plan 期验证，research Gaps）：**

- yauzl 的 Promise API 形态与四处错误处理面（callback err / promise rejection / `ZipFile.error` / read stream error）需真实打包 + 解压 + 恶意样本（zip-slip / symlink / 炸弹）验证
- GitHub `contents` 列一层分支与 403/429 处理未发真实网络请求验证（codeload 直连与顶层前缀剥离已 curl 实测）
- `npx skills` CLI 行为细节未实测（LOW；P1 论证不依赖该细节）

**历史遗留（v2.5 及更早）：**

- DNS rebinding 绕过 SSRF 防护需要额外验证（Phase 41 风险）
- AnySearch 免费 Provider 可用性未验证（Phase 40 风险）
- turndown XSS 风险需与 DOMPurify 集成确认（Phase 41 风险）
- ~~47-04 Task 3（打包后正式环境实跑验证 / SEED-05 收口）被人工前置门禁阻塞~~ — ✅ **已闭合（2026-09-11）**：用户显式授权后走 **Nightly 路线**（`make install-nightly`，写 `/Applications/Realm Nightly.app`，**不碰**生产 bundle），Task 3 的四个面 + 幂等/自愈全部实测通过；全程未执行 `make install`、未使用路径模式 `pkill`、`/Applications/Realm.app`（PID 25922）未被触碰。后续若要在**正式版**上复核，前置条件仍是：先由用户自行退出该实例，再 `pgrep` 复跑到无生产实例。

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| debug | 20 个已诊断 debug session 未修复 | Carried | v2.3 |
| review | Phase 23 代码审查遗留 19 项（6 Critical） | Carried | v2.1 |

### v2.5 收官 acknowledge 明细（2026-09-10，40 项）

`audit-open` 在 v2.5 关闭时报 40 项开启，用户选择全部确认归档（`closeout_type=override_closeout`）。如下为逐项披露；确认后审计已清零（后续扫描由 `audit_acknowledged` 标记抑制）。

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| debug_sessions | ai-reply-renders-raw-json | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | cold-start-url-input-no-response | fixed | 2026-09-10 | v2.5 |
| debug_sessions | container-delete-partitions | unknown | 2026-09-10 | v2.5 |
| debug_sessions | conversation-delete-not-effective | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | conversation-list-not-refreshed | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | conversation-rename-no-response | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | convert-mp4-zero-bytes | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | cookie-list-bg-too-dark | fixed | 2026-09-10 | v2.5 |
| debug_sessions | delete-dialog-top-left-position | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | favorites-blank-area-context-menu | fixed | 2026-09-10 | v2.5 |
| debug_sessions | fmp4-timeline-not-rebased | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | media-button-realtime-visibility | fixed | 2026-09-10 | v2.5 |
| debug_sessions | media-panel-empty-list | fixed | 2026-09-10 | v2.5 |
| debug_sessions | media-panel-interaction | fixed | 2026-09-10 | v2.5 |
| debug_sessions | open-link-ghost-tab | fixed | 2026-09-10 | v2.5 |
| debug_sessions | pinned-tab-favicon | fixed | 2026-09-10 | v2.5 |
| debug_sessions | progress-bar-wrong-position | fixed | 2026-09-10 | v2.5 |
| debug_sessions | realm-newtab-star-not-persistent | fixed | 2026-09-10 | v2.5 |
| debug_sessions | record-duration-timer-lag | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | refresh-button-no-stop-icon | fixed | 2026-09-10 | v2.5 |
| debug_sessions | reopen-closed-tabs-batch | fixed | 2026-09-10 | v2.5 |
| debug_sessions | rules-import-no-op | fixed | 2026-09-10 | v2.5 |
| debug_sessions | save-cookie-wrong-domain-filter | fixed | 2026-09-10 | v2.5 |
| debug_sessions | startup-empty-conversation | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | stop-record-sigsegv | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | switch-conversation-context-lost | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | tool-card-empty-bubble | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | truncation-marker-missing | fixed | 2026-09-10 | v2.5 |
| debug_sessions | url-input-enter-no-response | fixed | 2026-09-10 | v2.5 |
| debug_sessions | vim-keys-no-response | investigating | 2026-09-10 | v2.5 |
| debug_sessions | watch-time-icon-replaced | diagnosed | 2026-09-10 | v2.5 |
| debug_sessions | web-context-menu-wrong-items | fixed | 2026-09-10 | v2.5 |
| debug_sessions | whitelist-bypass-script-injection | unknown | 2026-09-10 | v2.5 |
| debug_sessions | whitelist-domain-validation | fixed | 2026-09-10 | v2.5 |
| uat_gaps | Phase 38 (v2.4 归档): 38-UAT-ISSUES.md | unknown | 2026-09-10 | v2.5 |
| uat_gaps | Phase 27 (v2.2 归档): 27-UAT.md | completed | 2026-09-10 | v2.5 |
| uat_gaps | Phase 29 (v2.2 归档): 29-UAT.md | diagnosed | 2026-09-10 | v2.5 |
| uat_gaps | Phase 06 (v1.1 归档): 06-UAT.md | passed | 2026-09-10 | v2.5 |
| verification_gaps | Phase 30 (v2.4 归档): 30-VERIFICATION.md | human_needed | 2026-09-10 | v2.5 |
| verification_gaps | Phase 35 (v2.4 归档): 35-VERIFICATION.md | human_needed | 2026-09-10 | v2.5 |

## Session Continuity

Last session: 2026-09-12T11:57:52.991Z
Stopped at: Completed 48-05-PLAN.md
Resume file: None

## Operator Next Steps

- **Phase 47 已收尾**（override 收尾：SC3 普遍性表述 + CR-01/CR-02 记技术债）。技术债与建议修法见 `.planning/phases/47-bash/47-REVIEW.md` 的 Disposition 与处置补记：CR-01（`npm -g update` 类旗标取值槽吞子命令）、CR-02（`npm audit --json fix` 类）、残余 ③（`npm -g update ls`）、`matchDangerous` 未同源归一化、`sweepSeedResidue` 缺陈旧性判据、`npm version` 被列只读、`ai-bash-policy.js:249` JSDoc 不准确、docs 只读枚举缺漂移护栏 —— 根治走 **argv 级分词 + 显式「带值旗标」清单**（可一次消除 CR-01/CR-02/残余 ③）
- ⚠ **发布前必办**：生产包 `/Applications/Realm.app` 仍是 2026-09-10 构建（无 `skills-builtin/` 与 `THIRD_PARTY_NOTICES.md`、仍含 `.planning`/`tests`）；SC5 的打包面证据经 47-04 的 Nightly 路线取得，**正式发布前必须重跑 `make install`**
- 用户已定：Phase 48 的 `/skill:name` 必须实时读盘（写路径接线 + 实时正文两条都是显式验收项）
- 遗留验证待办：Phase 46 的 P8 失效链 3/6 需在 48/49/50/51 逐点闭合
- Phase 47 收尾时 `phase.complete` 报两条非阻断警告：① 各 SUMMARY 的「files referenced」误报（把代码块里的命令当文件路径）；② `REQUIREMENTS.md` 正文含 `ECO-01..06` 但 Traceability 表未登记（属后续阶段的 ID，收尾时未擅自补录）
