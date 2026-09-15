# Milestones

## v2.6 AI 助手技能（Skill）能力 (Shipped: 2026-09-15)

**Phases completed:** 6 phases, 38 plans, 94 tasks

**Key accomplishments:**

- 技能目录落进硬沙箱 root、经薄 env 收窄加载面后进模块级缓存，再由同步零 IO 访问器拼成 system prompt 第 4 段；模型在 prompt 里看到的 `<location>` 已被真实沙箱 `readTextFile` 验证可打开
- SDK 的递归扫描结果被收敛为 Realm 的契约布局（深嵌套不进集合）、名称权威从 frontmatter 收回到目录名（杜绝冒名）、同名来源冲突显式化为「遮蔽」——败者仍在数据层但不再进 prompt，三类新诊断全部可读可查
- 技能集从「能跑」变成「可信」：每一个失败面都变成可同步读到的诊断，三条限额各自在正确位置生效并给出「哪个限额、当前值」，定序跨机确定，启停只过滤不删文件
- 技能集变更从此「无需重启、无需重建 Agent、下一轮即生效、且跨窗口可见」；P8 失效链在本阶段可触发的三条路径全部闭合，并由一条源码扫描断言永久锁住「漏接线」；技能功能有了与实际行为一致的产品说明权威文档
- 随包 `skills-builtin/find-skills`（零安装语义改写版）经 `builtin-skills-seeder.js` 原子播种进 `agent-workspace/managed-skills/`，技能加载器零诊断识别、因 `disable-model-invocation: true` 不进 system prompt —— 并以二段式静态扫描器把「零安装语义」变成机器可检的门禁
- skill-creator 以固定 SHA（`b0cbd3df…`）的上游快照随包（18 文件 225,004 B + 自研 check_env.mjs），SKILL.md 经六处受控改写后不再含平台专有内容且带 Apache-2.0 §4(b) 修改声明；新增的 Node 环境预检探针把「缺 Python / 版本过低 / 缺依赖 / 缺命令」变成 8 个明确失败码与用户可操作指引；`THIRD_PARTY_NOTICES.md` 以五要素记录两个技能并让 `modified` 判定可被测试逐条检索 —— 而零安装语义扫描面同时从单技能扩到两技能、两次反向验证证明它不是空转
- `/skill:name [args]` 打通解析 → 调用瞬间实时读盘 → SDK `<skill>` 块组装 → 注入 Agent → 入历史 → 重开对话按 args 还原气泡；renderer 侧气泡 pill / 折叠块 / 错误回滚 / 重发载荷收敛全部闭合，`skills:changed` 只重拉快照不自激。
- 面板成为技能与本地命令的同屏发现面：展平单数组渲染 + 两个 sticky 分区标题、行五要素（名称 / 三档来源徽标 / `仅显式` / 截断描述 / 行尾标注）、↑↓ 跳过灰显不可选中行、技能行组装 `/skill:{name} args` 走既定发送链路、打开即快照渲染 + 后台刷新（失败保留旧快照）、args 不再吞字符。
- 模型 `read` 技能正文时工具卡片标识为「使用技能「name」」并带来源徽标，重开对话按同一判据重建标记；「发现与调用」产品说明成文
- `readSkillForInvocation` 的同一性判据从「SDK 读回的 name 与入参相等」改为「所在目录路径全等」，命中后把注入用 name 重写为目录名 —— 面板列出即可调用的承诺在 name≠目录名 形态上终于为真
- 用户气泡构建收敛为 `buildUserMessageContent` 单源 + 回填后 `refreshUserMessageBubble` 定向刷新（pill 与折叠块当轮即现）；取消归属改用 `aiCancelledMessageId` 锚点解算，迟到的「用户已取消」只落在被取消的那条气泡上、不再越权复位新一轮
- 发送路径的两段本地否决被删除，`/skill:<name>` 一律由主进程在调用那一刻读盘裁定（失败经既有 `skillError` 回滚，用户可见文案逐字不变）；`skills:changed` 改为无条件重拉快照；产品文档与三份 48 阶段计划/验证文本按 G-48-2 / G-48-3 修订并逐处留档，`AGENTS.md` 测试清单补登记 48-05 新建的取消归属测试
- 主进程缓存存在性门被补上「有界重试」：`/skill:<新名>` 一旦判为不存在，就经唯一权威入口 `syncAgentSystemPrompt()` 重扫恰一次后当场重读磁盘 —— 运行期新增的技能目录（含 AI 经 `write`/`bash` 创建）不需要打开 `/` 面板或重启即可调用，而 shadowed / disabled / tier 三字段仍全部来自同一条加载管线
- 延迟的技能 prompt 回写与 `skills:changed` 广播从「只有带 @ 引用/附件的那一轮、或打开面板才落地」变成
- `manage_skill` 三动作（create / update / delete）落在 `ai-skills-manager.js` 的零 electron 依赖写权威面：统一目标判定 + seeded 登记表保护 + 字段分离扫描 + 文件级 rename 原子写 + 单次 `syncAgentSystemPrompt()` 刷新链，零新依赖
- 三张跨进程白名单表 + 两时点标记（运行中给标题、终态给徽标与短原因）+ 按 toolCallId 的失败态元数据通道（绕开 SDK 恒为 `{}` 的 details）+ 实时与重载共用一个装饰构造，配 16 条 M 组断言与两条 48 共用面前置修复
- 把「AI 自建技能」从代码事实提升为 Phase 50/51 唯一可读的权威口径：新增 `docs/product/ai-skills.md` §十一（三动作 / 九码拒绝面 / 两个上限闸职责 / 扫描与净化口径 / 三条诚实边界 / 时序语义），并在 AGENTS.md 挂上维护约定与实测测试账本、把 49-VALIDATION 矩阵按已交付任务重键并落定四条 OQ 裁决。
- description 改经 YAML 单引号标量编码、净化后复验非空、写侧权威字节闸改按组装全文计字节 —— 「写侧允许落盘的技能必然能被加载管线收下」从一句声明变成三条可失败被观察的代码事实（`tools` 55/55、扫描层 33/33、兄弟套件 172/99 全绿，反向验证逐条指名转红的断言）
- 渲染端的终态标记由覆盖改为经跨进程单源纯函数 `mergeManageSkillMarker` 并入、失败态原因码经 `[code] ` 词缀落库并在重载链路用同一个常量还原 —— Gap 2 / Gap 3 / WR-02 一并闭合，两组假绿守卫各自修出一条
- 把 49-04 / 49-05 落地后变成不成立的三处文档声明逐条纠正（§11.7 失败态短原因 / §11.3 词缀成文 / §11.8 分账），并把「文档数字 == 实测数字」变成一条可重跑命令 —— 48 号五个编号（含 `WR-06`）一字未移出挂账句，本轮五个 49 号闭合项另起一句挂在 `49-REVIEW.md` 名下（八个账本单元一致、单点变异 3/3 转红、49-03 门禁回归通过）
- `manage_skill` 卡片头部的超预算标注改取 `/` 面板单源的 ≤ 4 字机械投影（`超预算`，3 字），使 280px 面板下的头部单行不变式真正成立 —— 标注不再被祖先裁切（越界 0.00px）、技能名回到可压缩的 54px；并留下一条真实渲染回归门禁（红→绿两轮 + 声明投影 sha）兑现「子串/声明扫描会假绿」的教训。
- `renderSkillContentBox` 增加语境开关：气泡实例施加 `role`/`tabindex`/`aria-expanded`/Enter-Space，卡片实例关闭（宿主用 `max-height: 0` 折叠，后代不会自动退出顺序焦点导航），并以真实 Tab 遍历 + 命中测试门禁取得红→绿两轮证据
- 管理面投影 + 不依赖 Agent 的读路径初始化 + `GET /api/skills/list` + 设置页只读三档分组列表（零 innerHTML 全 DOM 构建）+ `STATUS_TEXT` 第 5 条与状态链单源 + D-13 尺寸口径（递归/含 SKILL.md/不含隐藏/目录 size 不计/不穿 symlink/不进 digest）
- 仅 user 可卸载的三态判据 + 第十码 `not_user_owned` + 管理面安全超集谓词；两个 HTTP 写端点与 `aiSkills`/`aiSkills.disabled` 双键服务端校验；写路径「重扫恰一次 + 调用侧补播恰一次」并把补播的存在理由用忙时用例独占钉住
- `readJsonBody(req, res, { maxBytes })` 的累积中体积闸（默认 1 MiB fail-closed，两个书签导入端点显式 32 MiB）+ 承重的 `res` 缺失降级分支 + `sendJson` 幂等护栏（一次修好 13 处发送点）+ 全部 59 处调用点改签名；三个 IPC 管理通道与 `realmAPI` 三方法转发到同一组 manager 函数、handler 零判定
- 行内启停开关（乐观翻转 + 失败回滚）与卸载二次确认弹框（`realm://` div 遮罩范式）；诊断的两层承载 —— 行内 `诊断 N` 徽标控制无 header 的内联详情区、模块级 `errors[]` 走默认展开的顶部汇总条；折叠态收敛到 `setCollapsed` 单点双写；「仅显式」提升为跨进程单源并一并改写三条既有断言
- 管理面从代码事实提升为成文契约（`docs/product/ai-skills.md` §十二 12.1–12.9 + 五条诚实边界），维护约定与测试账本三处同批刷新，counts-parity 扩到 5 套件后转绿（cells=16），Phase 50 的七个套件门禁全绿
- `resolveInsideForWrite` 闭合「中间目录为 symlink 且写目标不存在」的沙箱写逃逸：五个写方法与两个临时目录方法全部切换，读面判据一字未动，既有 21 例零删改、新增 17 例（38/38 全绿）
- `yauzl@^3.4.0` 与精确钉版的 `yaml@2.9.0` 落进 `dependencies`、lock 入库、磁盘上 yaml 单实例、打包面零改动 —— 并把 `yaml` 的 `[SUS]` 供应链闸走成一次可归因的人工确认
- 本计划由编排层在子代理 429 中断后接管续做
- 本计划由主会话内联执行

### Verification

- Closeout type: **override_closeout**（用户 2026-09-15 显式裁决「proceed anyway」）
- 47/47 requirements complete；38/38 plans；6/6 phases
- **Known verification overrides**：46 / 47 / 48 / 49 / 50 五阶段的 `*-VERIFICATION.md` 对**当前树**为 `stale` —— 其 `covered_files` 含 `ai-manager.js` / `main.js` / `src/settings-page.js`，被后续阶段（含 Phase 51 收尾时修掉的 CR-02）与并发 webview 工作改动过 ⇒ `covered_digest` 失效。这是「后续阶段落代码即让先前阶段 digest 失效」的**结构性**后果，**不是**这些阶段的结论有变：五阶段的 `*-UAT.md` 均 `complete`、`*-VERIFICATION.md` 的 frontmatter 均 `status: passed`、`*-SECURITY.md` 均 `threats_open: 0`。
- **未运行里程碑审计**（无 `v2.6-MILESTONE-AUDIT.md`）。`audit-open` 全类扫描为 **0 开放项**，另有 40 项历史 acknowledge 仍处于抑制态。
- **Phase 51 收尾抓到并修复真 blocker `CR-02`**：`ai-manager.js` 的 `downloadPackage` **只有调用没有绑定** ⇒ 所有网络地址导入（zipball 与直链 SKILL.md）运行期 100% `ReferenceError`；三条既有护栏（模块级单测打的是另一侧导出面、「首参逐字 `undefined`」只断言调用**形态**、仓内无 `no-undef` 静态检查）全绿也照不到。详见 `milestones/v2.6-phases/51-zip/51-REVIEW.md`。
- 代码审查挂账未修（不阻断）：`CR-01`（同一弹框会话第 4 次连续预览必返 `too_many_pending` 且无自救入口）、`WR-01` / `WR-02` / `WR-03`。

### Archive

- Roadmap: `.planning/milestones/v2.6-ROADMAP.md`
- Requirements: `.planning/milestones/v2.6-REQUIREMENTS.md`
- Phases: `.planning/milestones/v2.6-phases/`（`46-prompt` / `47-bash` / `48-skill-name` / `49-manage-skill-ai` / `50-api-skills` / `51-zip`）
- Tag: `v2.6`

---

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
