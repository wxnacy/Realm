---
gsd_state_version: "1.0"
milestone: v2.5
milestone_name: AI 网络搜索功能
status: Awaiting next milestone
stopped_at: All phases complete — start a new milestone
last_updated: "2026-09-10T14:12:01.501Z"
last_activity: 2026-09-10
last_activity_desc: Milestone v2.5 completed and archived
state_head: c2f02ce6affd4776113d6d68ad26eda76551e793
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 38
  completed_plans: 38
  percent: 100
current_phase: 45
current_phase_name: B 站直播 fMP4 转录支持
---

# Project State: Realm Browser

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-26)

**Core value:** 容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载。
**Current focus:** Phase 45 — bilibili-fmp4-transcode

## Current Position

Phase: Milestone v2.5 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-09-10 — Milestone v2.5 completed and archived

## Performance Metrics

**Velocity:**

- Total plans completed: 47+ (v1.0 through v2.4)
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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

### Roadmap Evolution

- Phase 42 added: AI 历史对话功能调研与 pi-agent 集成方案
- Phase 43 added: AI 记忆系统集成（条目记忆 MVP），方案定稿见 docs/plan/ai-memory-system.md
- Phase 44 added: 播放器视频缓存与本地媒体库（独立窗口 proxy 收口、分片缓存+观看历史续播、直播录制+媒体任务中心，方案定稿 2026-09-06 讨论完成）

### Pending Todos

None yet.

### Blockers/Concerns

- DNS rebinding 绕过 SSRF 防护需要额外验证（Phase 41 风险）
- AnySearch 免费 Provider 可用性未验证（Phase 40 风险）
- turndown XSS 风险需与 DOMPurify 集成确认（Phase 41 风险）

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

Last session: 2026-09-08T08:22:33.597Z
Stopped at: All 6 phases complete（40-45）— next: /gsd:new-milestone
Resume file: None

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
