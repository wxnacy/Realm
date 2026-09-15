---
schema_version: 1
open_count: 35
waived_count: 0
fixed_count: 2
total_count: 37
last_updated: 2026-09-15T07:11:46.134Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 44 | stub | ipc-handlers.js |  | player:drawer:list 的 completeness 字段暂置 null：分片总数需 44-02 media-task-manager 提供后才能计算完整度百分比（D-14 后半），抽屉 UI 在 44-02/03 渲染时处理 | open |  | 2026-09-06T11:13:37.059Z |  |
| 2 | 44 | stub | src/tasks-page.js |  | 「已落盘部分续转」按钮先渲染，POST /api/tasks/convert-resume 由 44-05 实现前返回 404（计划明确不算缺陷） | open |  | 2026-09-06T11:49:45.824Z |  |
| 3 | 45 | unrun-verify | main.js |  | 45-03 human-check 未跑：缓存链路 fMP4 转换 + QuickTime A1 真机复验（留 end-of-phase UAT） | open |  | 2026-09-08T04:53:56.959Z |  |
| 4 | 45 | unrun-verify | .planning/phases/45-bilibili-fmp4-transcode/45-04-SUMMARY.md |  | 45-04 human-check 真实 B 站直播流 UAT 复测（两链路产物 mpv/VLC 时间轴从 0 开始）留待 end-of-phase UAT | open |  | 2026-09-08T08:22:05.689Z |  |
| 5 | 46 | deviation | ai-skills-manager.js |  | Rule 2: 注释中移除被禁止的库名/子路径字面量（注释-only，无行为变更） | open |  | 2026-09-11T01:55:26.491Z |  |
| 6 | 47 | deviation | builtin-skills-seeder.js |  | 47-01: module.exports 除 6 个计划登记的公开导出外，额外导出 detectDiff 与 safeCopyDir 供测试直接断言（计划 Task 1/Task 2 的 acceptance_criteria 要求直接调用二者；artifacts 段原写「不导出」已被 Task 2 的「可测的导出内部函数」取代） | open |  | 2026-09-11T09:34:42.598Z |  |
| 7 | 47 | deviation | ai-bash-policy.js |  | 47-02: 旗标容忍片段由 (?:\\s+-\\S+)* 扩为 (?:\\s+-\\S+(?:\\s+(?!-)\\S+)?)* —— 逐字照抄 RESEARCH E-1 的表实测漏检计划要求必命中的 npm --prefix ./x i y 与 pnpm --filter a add b（取值旗标形态）；扩展后 0 漏检、34 条只读反例零新增误伤 | open |  | 2026-09-11T09:44:38.968Z |  |
| 8 | 47 | deviation | ai-bash-policy.js |  | 47-02: PACKAGE_MANAGER_INSTALL_PATTERNS 表内把 python -m pip / uv 两族提到通用 pip3? install 之前（仅调顺序，模式文本未改）—— 否则 uv pip install x 被 pip 条目先命中，确认卡片标出错误家族名 | open |  | 2026-09-11T09:44:39.047Z |  |
| 9 | 47 | deviation | tests/test-ai-bash-policy.js |  | 47-02: 计划假设反引号/子 shell 形态不被 install 检测，实测 \\bnpm\\b 仍是词边界故会命中（向安全侧倾斜）；断言按实际行为钉死，'漏检 ≠ 免确认' 的机械证据改由真漏检形态 NPM=npm $NPM i x 承载 | open |  | 2026-09-11T09:44:39.128Z |  |
| 10 | 47 | deviation | tests/test-ai-bash-policy.js |  | 47-02: P1-b-2 的 python -m pip 族标注 evaluateReason danger —— python/python3 属 DANGEROUS_INTERPRETERS，D-14 的 danger 优先与计划'13 族全部 reason install'冲突，以 danger 优先为准（该族仍必须命中 matchInstall） | open |  | 2026-09-11T09:44:39.212Z |  |
| 11 | 47 | deviation | skills-builtin/skill-creator/SKILL.md | 404 | 47-03 Task 1: 计划与 RESEARCH 都断言上游 SKILL.md 对安装语义 regex 0 命中，实测 Description Optimization 第 4 步的 update the skill's SKILL.md frontmatter 命中 INSTALL_IMPERATIVES 的安装技能祈使句模式。第 1 段扫描面按设计零容忍零豁免，故把该句改写为 set it in the skill's SKILL.md frontmatter（语义不变、仅消误报），并记入 THIRD_PARTY_NOTICES 第 11 项 | open |  | 2026-09-11T09:56:11.033Z |  |
| 12 | 47 | deviation | tests/test-builtin-skills-seeder.js |  | 47-03 Task 2: 计划假设 installGuidance 的两行会命中禁用模式故需豁免，实测参照形状的实现对 A-4 模式表 0 命中。改为让第 1 条豁免对准真正命中的那一行（缺依赖指引句），第 2 条（Do not auto-install 逐字声明）保留为防御性登记并在注释里写明它当前不命中；反向验证对第 1 条实跑（红时报出 check_env.mjs:508） | open |  | 2026-09-11T09:56:11.111Z |  |
| 13 | 47 | deviation | tests/test-builtin-skills-seeder.js |  | 47-03 Task 1: 47-01 期的断言第 2 段集合为空在 skill-creator 落地后过时（新增 scripts/ agents/ assets/ eval-viewer/ references/ 五类目录）。改写为断言第 2 段确实覆盖这五类目录且豁免生效下零命中，并把第 2 段扫描面从 FORBIDDEN_PATTERNS 扩到 FORBIDDEN_PATTERNS+INSTALL_IMPERATIVES（更严） | open |  | 2026-09-11T09:56:11.192Z |  |
| 14 | 47 | deviation | tests/test-builtin-skills-seeder.js |  | 47-03 Task 1: Task 1 的验收同时要求 18 个上游文件「逐字节与上游一致」与 SKILL.md「用区间而非精确值」（它承载六处受控改动）。调和为：17 个未改动的上游文件断言精确字节数，SKILL.md 用 [30000,40000] 区间护栏 —— 两个口径都在同一个用例里，注释写明分工 | open |  | 2026-09-11T09:56:18.081Z |  |
| 15 | 47 | deviation | tests/test-builtin-skills-seeder.js |  | 47-03 Task 2/Rule 2: 计划未列 --help 与输出里的 attempted 字段。前者是 CLI 基本可用性；后者是「REALM_SKILL_CREATOR_PYTHON 生效时自动探测被跳过」这条验收判据唯一的机械证据（成功路径下 attempted 只有 1 条），两者均为只读、无副作用 | open |  | 2026-09-11T09:56:18.158Z |  |
| 16 | 47 | deviation | tests/test-builtin-skills-seeder.js |  | 47-03 Task 1（已知残余）: 按计划的禁令「除六处受控改动外不得有其他偏离上游正文」，上游正文里两处 Cowork 提及（Step 4 的 headless 环境回退说明、结尾的 TodoList 提醒）逐字保留，未随三章一并删除。它们不是被删三章的标题子串（验收只禁 present_files / Claude.ai-specific / Cowork-Specific），且属环境条件性说明；若后续阶段判定需要，属新的受控改动，须同步 THIRD_PARTY_NOTICES | open |  | 2026-09-11T09:56:18.235Z |  |
| 17 | 47 | deviation | package.json |  | 47-04 Task 1 step 5（改后 asar 清单取证）未执行：orchestrator 的 mandatory checkpoint guard 硬禁止任何打包/安装命令（make install*、npm run build、electron-builder），因生产实例 PID 25922 正在运行。改后 asar 清单的断言全部顺延到 Task 3 的人工门禁（Task 3 step 2b2 本就是「Task 1 的改后在真实安装产物上的复核」）—— 本计划未以任何方式弱化该判据，只是把它与打包动作一起交给人工 | fixed |  | 2026-09-11T10:03:14.753Z | 2026-09-11T11:22:45.517Z |
| 18 | 47 | unrun-verify | skills-builtin/skill-creator/scripts/check_env.mjs |  | 47-04 Task 3（部分）：SKILL-09 打包态侧证据只演示了「脚本在打包态技能目录内可执行 + stdout 可解析 JSON」（executor 直接以 node 运行），未演示验收原文的「经确认卡片后执行」半条。确认卡片那半条已由 tests/test-ai-bash-policy.js（70 例，含 DANGEROUS_INTERPRETERS 对 node/python3 的强制确认断言）覆盖，本项为额外的打包态端到端演示，非缺陷 | open |  | 2026-09-11T11:22:50.700Z |  |
| 19 | 48 | deviation | src/renderer.js |  | 流式中触发技能调用原会因 abort 的异步取消事件被静默丢弃，已在 abort 后就地复位 state.aiStreaming / aiCurrentMessageId / 发送按钮 | open |  | 2026-09-12T05:13:37.283Z |  |
| 20 | 48 | deviation | src/skill-picker-model.js |  | parseSkillRef 裸名分支加「本地命令名前缀占位」歧义护栏（/foobar 对 foo → null），使计划四条 behavior 行同时成立 | open |  | 2026-09-12T05:13:37.366Z |  |
| 21 | 48 | unrun-verify |  |  | 48-02 Task 3 <human-check>（backstop）：50+ 技能数据集下 220px 面板的分组标题 sticky 常驻 / 行五要素可读 / 行尾标注无一截断 —— 视觉观感无法自动化裁决，留 UAT 实测 | open |  | 2026-09-12T05:25:38.311Z |  |
| 22 | 48 | unrun-verify | src/renderer.js |  | 48-05 G-48-6：pill/折叠块「发送后即现」是运行时机行为，node:test 无 DOM 宿主可断言；最终证据为重跑 /gsd-verify-work 48 的自动驱动探针（UAT test 6 clause 1） | open |  | 2026-09-12T11:57:11.239Z |  |
| 23 | 48 | unrun-verify | src/ai-cancel-state.js |  | 48-05 G-48-4：abort × 新消息的端到端竞态（新气泡不得被写成「用户已取消」）无法在纯 Node 构造；最终证据为重跑 /gsd-verify-work 48 的自动驱动探针（UAT test 4） | open |  | 2026-09-12T11:57:11.319Z |  |
| 24 | 48 | unrun-verify | src/renderer.js |  | 48-07 已修 + 机制更正：① 原文把机制写成「主进程重扫 → 广播 → IPC 往返」，暗示存在「idle 边界自动重扫」链 —— 该链在代码中并不存在（待回写标记只由同步入口自身在忙时置位，不是独立触发源）；② 真正的失效点是主进程 readSkillForInvocation 的缓存存在性门（缓存未命中即判不存在，读盘路径根本不执行）；③ 48-07 的修法 = 调用侧 miss 后经唯一权威入口 syncAgentSystemPrompt 重扫一次 + 重试读盘（shadowed / disabled / tier 三字段仍来自同一条加载管线，不新增第二套判定）；④ 本条为 unrun-verify，最终证据仍是重跑 /gsd-verify-work 48 的自动驱动探针（在 managed-skills 下新建目录后不打开 / 面板直接手打 /skill:<新名>） | fixed |  | 2026-09-12T12:05:50.272Z | 2026-09-12T15:02:36.971Z |
| 25 | 49 | deviation | .planning/phases/49-manage-skill-ai/49-02-PLAN.md |  | 计划自带 verify #1(Task1) 的 node -e 脚本缺语句分隔符，字面 SyntaxError 永不通过（执行侧最小语法修正后通过） | open |  | 2026-09-13T07:13:08.952Z |  |
| 26 | 49 | deviation | .planning/phases/49-manage-skill-ai/49-02-PLAN.md |  | 计划自带 verify #3(Task1)/#1(Task2) 的源码窗口会命中既有代码（状态图标 innerHTML / 通用参数与结果区的 JSON.stringify），字面恒失败；执行侧最小口径修正后通过 | open |  | 2026-09-13T07:13:09.040Z |  |
| 27 | 49 | deviation | .planning/phases/49-manage-skill-ai/49-02-PLAN.md |  | 计划自带 verify #1(Task3) 的徽标底色计数正则 #\\{0,1\\}var\\(--bg-secondary\\) 含多余 # 前缀，字面恒 0 命中；执行侧去掉前缀后通过（实测 6 处） | open |  | 2026-09-13T07:13:09.128Z |  |
| 28 | 49 | stub | ai-manager.js |  | manage_skill 重载链路还原不了失败原因码 code（不落库）⇒ 重开对话后失败历史卡片不显示头部短原因（宁缺勿猜；展开区仍有主进程完整文案） | open |  | 2026-09-13T07:13:09.218Z |  |
| 29 | 49 | stub | ai-manager.js |  | delete 成功卡片的 tier 在删除后不可判定 ⇒ 省略键、不显示来源徽标（不可判定时不猜） | open |  | 2026-09-13T07:13:09.306Z |  |
| 30 | 49 | unrun-verify | docs/product/ai-skills.md |  | 失败态短原因（≤ 6 字）在 280px 面板下的宽度仅由算术保证（8+32+8+66≈114≤129），未用真实渲染逐条覆盖 —— G-49-3 的渲染门禁只覆盖超预算那条形态 | open |  | 2026-09-13T14:29:15.698Z |  |
| 31 | 50 | deviation | src/styles/main.css |  | 计划自带的样式硬禁令判据只扫单个规则块：另起 .skill-manage-row:hover { background: var(--bg-hover) } 可完整绕过（变异实测仍绿）。已由 tests/test-skills-management.js 的样式硬禁令组按选择器形态补判据 | open |  | 2026-09-14T13:23:22.903Z |  |
| 32 | 50 | deviation | ai-skills-manager.js |  | 计划自带的尺寸口径判据只扫「e.kind === 'directory'」起始那一行：把 bytes += 加在下一行（自然写法）不转红。已由 tests/test-skills-management.js 的 3 条行为用例承担该不变式 | open |  | 2026-09-14T13:23:22.986Z |  |
| 33 | 50 | deviation | ai-manager.js |  | 计划文本的「非忙时 channels 恰一次」与 D-18 双广播事实冲突，已拆成合成账/忙时账并如实披露 | open |  | 2026-09-14T13:50:32.895Z |  |
| 34 | 50 | deviation | main.js |  | 计划建议的取值写法（key === 'aiSkills' 三元表达式）会让自带门禁的变异不转红（双键假绿）；改为 !key.includes('.') 后变异如实转红 | open |  | 2026-09-14T13:50:38.325Z |  |
| 35 | 50 | deviation | main.js |  | 两个新写子路由补 aiManager 空值守卫（503），对齐 50-01 的既有范式，避免早期请求撞 null ⇒ 500 | open |  | 2026-09-14T13:50:38.408Z |  |
| 36 | 51 | deviation | tests/test-agent-workspace.js |  | 51-01 Rule 2: env.remove 用例的承重断言改用「尚不存在的逃逸目标」（计划原文 `remove('<link OUT>/x')` 形态）—— 首版删已存在的 root 外文件时，回退加固的树同样拒绝（resolveInside 对已存在路径本就做 realpath 复核）故该用例恒绿、无检出力；改用 ENOENT 目标后回退会退化成底层 not_found 而非 permission_denied，MA 变异可转红（已实测） | open |  | 2026-09-15T07:11:46.049Z |  |
| 37 | 51 | deviation | tests/test-agent-workspace.js |  | 51-01 Rule 2: 新增一条「未覆盖面」行为用例（计划仅要求注释登记）—— 断言 env.exec('echo escaped > ../x') 之后 root 外**确实**存在该文件，把「本加固不封闭 bash 写盘」（prohibitions 第 2 条 / D-15 诚实边界）从注释承诺升级为可执行反证据 | open |  | 2026-09-15T07:11:46.134Z |  |

````json
[
  {
    "id": 1,
    "kind": "stub",
    "phase": "44",
    "file": "ipc-handlers.js",
    "line": null,
    "description": "player:drawer:list 的 completeness 字段暂置 null：分片总数需 44-02 media-task-manager 提供后才能计算完整度百分比（D-14 后半），抽屉 UI 在 44-02/03 渲染时处理",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T11:13:37.059Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "44",
    "file": "src/tasks-page.js",
    "line": null,
    "description": "「已落盘部分续转」按钮先渲染，POST /api/tasks/convert-resume 由 44-05 实现前返回 404（计划明确不算缺陷）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-06T11:49:45.824Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "45",
    "file": "main.js",
    "line": null,
    "description": "45-03 human-check 未跑：缓存链路 fMP4 转换 + QuickTime A1 真机复验（留 end-of-phase UAT）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-08T04:53:56.959Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "45",
    "file": ".planning/phases/45-bilibili-fmp4-transcode/45-04-SUMMARY.md",
    "line": null,
    "description": "45-04 human-check 真实 B 站直播流 UAT 复测（两链路产物 mpv/VLC 时间轴从 0 开始）留待 end-of-phase UAT",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-08T08:22:05.689Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "46",
    "file": "ai-skills-manager.js",
    "line": null,
    "description": "Rule 2: 注释中移除被禁止的库名/子路径字面量（注释-only，无行为变更）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T01:55:26.491Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "47",
    "file": "builtin-skills-seeder.js",
    "line": null,
    "description": "47-01: module.exports 除 6 个计划登记的公开导出外，额外导出 detectDiff 与 safeCopyDir 供测试直接断言（计划 Task 1/Task 2 的 acceptance_criteria 要求直接调用二者；artifacts 段原写「不导出」已被 Task 2 的「可测的导出内部函数」取代）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:34:42.598Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "47",
    "file": "ai-bash-policy.js",
    "line": null,
    "description": "47-02: 旗标容忍片段由 (?:\\s+-\\S+)* 扩为 (?:\\s+-\\S+(?:\\s+(?!-)\\S+)?)* —— 逐字照抄 RESEARCH E-1 的表实测漏检计划要求必命中的 npm --prefix ./x i y 与 pnpm --filter a add b（取值旗标形态）；扩展后 0 漏检、34 条只读反例零新增误伤",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:44:38.968Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "47",
    "file": "ai-bash-policy.js",
    "line": null,
    "description": "47-02: PACKAGE_MANAGER_INSTALL_PATTERNS 表内把 python -m pip / uv 两族提到通用 pip3? install 之前（仅调顺序，模式文本未改）—— 否则 uv pip install x 被 pip 条目先命中，确认卡片标出错误家族名",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:44:39.047Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-ai-bash-policy.js",
    "line": null,
    "description": "47-02: 计划假设反引号/子 shell 形态不被 install 检测，实测 \\bnpm\\b 仍是词边界故会命中（向安全侧倾斜）；断言按实际行为钉死，'漏检 ≠ 免确认' 的机械证据改由真漏检形态 NPM=npm $NPM i x 承载",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:44:39.128Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-ai-bash-policy.js",
    "line": null,
    "description": "47-02: P1-b-2 的 python -m pip 族标注 evaluateReason danger —— python/python3 属 DANGEROUS_INTERPRETERS，D-14 的 danger 优先与计划'13 族全部 reason install'冲突，以 danger 优先为准（该族仍必须命中 matchInstall）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:44:39.212Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "47",
    "file": "skills-builtin/skill-creator/SKILL.md",
    "line": 404,
    "description": "47-03 Task 1: 计划与 RESEARCH 都断言上游 SKILL.md 对安装语义 regex 0 命中，实测 Description Optimization 第 4 步的 update the skill's SKILL.md frontmatter 命中 INSTALL_IMPERATIVES 的安装技能祈使句模式。第 1 段扫描面按设计零容忍零豁免，故把该句改写为 set it in the skill's SKILL.md frontmatter（语义不变、仅消误报），并记入 THIRD_PARTY_NOTICES 第 11 项",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:56:11.033Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-builtin-skills-seeder.js",
    "line": null,
    "description": "47-03 Task 2: 计划假设 installGuidance 的两行会命中禁用模式故需豁免，实测参照形状的实现对 A-4 模式表 0 命中。改为让第 1 条豁免对准真正命中的那一行（缺依赖指引句），第 2 条（Do not auto-install 逐字声明）保留为防御性登记并在注释里写明它当前不命中；反向验证对第 1 条实跑（红时报出 check_env.mjs:508）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:56:11.111Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-builtin-skills-seeder.js",
    "line": null,
    "description": "47-03 Task 1: 47-01 期的断言第 2 段集合为空在 skill-creator 落地后过时（新增 scripts/ agents/ assets/ eval-viewer/ references/ 五类目录）。改写为断言第 2 段确实覆盖这五类目录且豁免生效下零命中，并把第 2 段扫描面从 FORBIDDEN_PATTERNS 扩到 FORBIDDEN_PATTERNS+INSTALL_IMPERATIVES（更严）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:56:11.192Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-builtin-skills-seeder.js",
    "line": null,
    "description": "47-03 Task 1: Task 1 的验收同时要求 18 个上游文件「逐字节与上游一致」与 SKILL.md「用区间而非精确值」（它承载六处受控改动）。调和为：17 个未改动的上游文件断言精确字节数，SKILL.md 用 [30000,40000] 区间护栏 —— 两个口径都在同一个用例里，注释写明分工",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:56:18.081Z",
    "resolved_at": null
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-builtin-skills-seeder.js",
    "line": null,
    "description": "47-03 Task 2/Rule 2: 计划未列 --help 与输出里的 attempted 字段。前者是 CLI 基本可用性；后者是「REALM_SKILL_CREATOR_PYTHON 生效时自动探测被跳过」这条验收判据唯一的机械证据（成功路径下 attempted 只有 1 条），两者均为只读、无副作用",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:56:18.158Z",
    "resolved_at": null
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "47",
    "file": "tests/test-builtin-skills-seeder.js",
    "line": null,
    "description": "47-03 Task 1（已知残余）: 按计划的禁令「除六处受控改动外不得有其他偏离上游正文」，上游正文里两处 Cowork 提及（Step 4 的 headless 环境回退说明、结尾的 TodoList 提醒）逐字保留，未随三章一并删除。它们不是被删三章的标题子串（验收只禁 present_files / Claude.ai-specific / Cowork-Specific），且属环境条件性说明；若后续阶段判定需要，属新的受控改动，须同步 THIRD_PARTY_NOTICES",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T09:56:18.235Z",
    "resolved_at": null
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "47",
    "file": "package.json",
    "line": null,
    "description": "47-04 Task 1 step 5（改后 asar 清单取证）未执行：orchestrator 的 mandatory checkpoint guard 硬禁止任何打包/安装命令（make install*、npm run build、electron-builder），因生产实例 PID 25922 正在运行。改后 asar 清单的断言全部顺延到 Task 3 的人工门禁（Task 3 step 2b2 本就是「Task 1 的改后在真实安装产物上的复核」）—— 本计划未以任何方式弱化该判据，只是把它与打包动作一起交给人工",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-11T10:03:14.753Z",
    "resolved_at": "2026-09-11T11:22:45.517Z"
  },
  {
    "id": 18,
    "kind": "unrun-verify",
    "phase": "47",
    "file": "skills-builtin/skill-creator/scripts/check_env.mjs",
    "line": null,
    "description": "47-04 Task 3（部分）：SKILL-09 打包态侧证据只演示了「脚本在打包态技能目录内可执行 + stdout 可解析 JSON」（executor 直接以 node 运行），未演示验收原文的「经确认卡片后执行」半条。确认卡片那半条已由 tests/test-ai-bash-policy.js（70 例，含 DANGEROUS_INTERPRETERS 对 node/python3 的强制确认断言）覆盖，本项为额外的打包态端到端演示，非缺陷",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-11T11:22:50.700Z",
    "resolved_at": null
  },
  {
    "id": 19,
    "kind": "deviation",
    "phase": "48",
    "file": "src/renderer.js",
    "line": null,
    "description": "流式中触发技能调用原会因 abort 的异步取消事件被静默丢弃，已在 abort 后就地复位 state.aiStreaming / aiCurrentMessageId / 发送按钮",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-12T05:13:37.283Z",
    "resolved_at": null
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "48",
    "file": "src/skill-picker-model.js",
    "line": null,
    "description": "parseSkillRef 裸名分支加「本地命令名前缀占位」歧义护栏（/foobar 对 foo → null），使计划四条 behavior 行同时成立",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-12T05:13:37.366Z",
    "resolved_at": null
  },
  {
    "id": 21,
    "kind": "unrun-verify",
    "phase": "48",
    "file": "",
    "line": null,
    "description": "48-02 Task 3 <human-check>（backstop）：50+ 技能数据集下 220px 面板的分组标题 sticky 常驻 / 行五要素可读 / 行尾标注无一截断 —— 视觉观感无法自动化裁决，留 UAT 实测",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-12T05:25:38.311Z",
    "resolved_at": null
  },
  {
    "id": 22,
    "kind": "unrun-verify",
    "phase": "48",
    "file": "src/renderer.js",
    "line": null,
    "description": "48-05 G-48-6：pill/折叠块「发送后即现」是运行时机行为，node:test 无 DOM 宿主可断言；最终证据为重跑 /gsd-verify-work 48 的自动驱动探针（UAT test 6 clause 1）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-12T11:57:11.239Z",
    "resolved_at": null
  },
  {
    "id": 23,
    "kind": "unrun-verify",
    "phase": "48",
    "file": "src/ai-cancel-state.js",
    "line": null,
    "description": "48-05 G-48-4：abort × 新消息的端到端竞态（新气泡不得被写成「用户已取消」）无法在纯 Node 构造；最终证据为重跑 /gsd-verify-work 48 的自动驱动探针（UAT test 4）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-12T11:57:11.319Z",
    "resolved_at": null
  },
  {
    "id": 24,
    "kind": "unrun-verify",
    "phase": "48",
    "file": "src/renderer.js",
    "line": null,
    "description": "48-07 已修 + 机制更正：① 原文把机制写成「主进程重扫 → 广播 → IPC 往返」，暗示存在「idle 边界自动重扫」链 —— 该链在代码中并不存在（待回写标记只由同步入口自身在忙时置位，不是独立触发源）；② 真正的失效点是主进程 readSkillForInvocation 的缓存存在性门（缓存未命中即判不存在，读盘路径根本不执行）；③ 48-07 的修法 = 调用侧 miss 后经唯一权威入口 syncAgentSystemPrompt 重扫一次 + 重试读盘（shadowed / disabled / tier 三字段仍来自同一条加载管线，不新增第二套判定）；④ 本条为 unrun-verify，最终证据仍是重跑 /gsd-verify-work 48 的自动驱动探针（在 managed-skills 下新建目录后不打开 / 面板直接手打 /skill:<新名>）",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-12T12:05:50.272Z",
    "resolved_at": "2026-09-12T15:02:36.971Z"
  },
  {
    "id": 25,
    "kind": "deviation",
    "phase": "49",
    "file": ".planning/phases/49-manage-skill-ai/49-02-PLAN.md",
    "line": null,
    "description": "计划自带 verify #1(Task1) 的 node -e 脚本缺语句分隔符，字面 SyntaxError 永不通过（执行侧最小语法修正后通过）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-13T07:13:08.952Z",
    "resolved_at": null
  },
  {
    "id": 26,
    "kind": "deviation",
    "phase": "49",
    "file": ".planning/phases/49-manage-skill-ai/49-02-PLAN.md",
    "line": null,
    "description": "计划自带 verify #3(Task1)/#1(Task2) 的源码窗口会命中既有代码（状态图标 innerHTML / 通用参数与结果区的 JSON.stringify），字面恒失败；执行侧最小口径修正后通过",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-13T07:13:09.040Z",
    "resolved_at": null
  },
  {
    "id": 27,
    "kind": "deviation",
    "phase": "49",
    "file": ".planning/phases/49-manage-skill-ai/49-02-PLAN.md",
    "line": null,
    "description": "计划自带 verify #1(Task3) 的徽标底色计数正则 #\\{0,1\\}var\\(--bg-secondary\\) 含多余 # 前缀，字面恒 0 命中；执行侧去掉前缀后通过（实测 6 处）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-13T07:13:09.128Z",
    "resolved_at": null
  },
  {
    "id": 28,
    "kind": "stub",
    "phase": "49",
    "file": "ai-manager.js",
    "line": null,
    "description": "manage_skill 重载链路还原不了失败原因码 code（不落库）⇒ 重开对话后失败历史卡片不显示头部短原因（宁缺勿猜；展开区仍有主进程完整文案）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-13T07:13:09.218Z",
    "resolved_at": null
  },
  {
    "id": 29,
    "kind": "stub",
    "phase": "49",
    "file": "ai-manager.js",
    "line": null,
    "description": "delete 成功卡片的 tier 在删除后不可判定 ⇒ 省略键、不显示来源徽标（不可判定时不猜）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-13T07:13:09.306Z",
    "resolved_at": null
  },
  {
    "id": 30,
    "kind": "unrun-verify",
    "phase": "49",
    "file": "docs/product/ai-skills.md",
    "line": null,
    "description": "失败态短原因（≤ 6 字）在 280px 面板下的宽度仅由算术保证（8+32+8+66≈114≤129），未用真实渲染逐条覆盖 —— G-49-3 的渲染门禁只覆盖超预算那条形态",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-13T14:29:15.698Z",
    "resolved_at": null
  },
  {
    "id": 31,
    "kind": "deviation",
    "phase": "50",
    "file": "src/styles/main.css",
    "line": null,
    "description": "计划自带的样式硬禁令判据只扫单个规则块：另起 .skill-manage-row:hover { background: var(--bg-hover) } 可完整绕过（变异实测仍绿）。已由 tests/test-skills-management.js 的样式硬禁令组按选择器形态补判据",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-14T13:23:22.903Z",
    "resolved_at": null
  },
  {
    "id": 32,
    "kind": "deviation",
    "phase": "50",
    "file": "ai-skills-manager.js",
    "line": null,
    "description": "计划自带的尺寸口径判据只扫「e.kind === 'directory'」起始那一行：把 bytes += 加在下一行（自然写法）不转红。已由 tests/test-skills-management.js 的 3 条行为用例承担该不变式",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-14T13:23:22.986Z",
    "resolved_at": null
  },
  {
    "id": 33,
    "kind": "deviation",
    "phase": "50",
    "file": "ai-manager.js",
    "line": null,
    "description": "计划文本的「非忙时 channels 恰一次」与 D-18 双广播事实冲突，已拆成合成账/忙时账并如实披露",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-14T13:50:32.895Z",
    "resolved_at": null
  },
  {
    "id": 34,
    "kind": "deviation",
    "phase": "50",
    "file": "main.js",
    "line": null,
    "description": "计划建议的取值写法（key === 'aiSkills' 三元表达式）会让自带门禁的变异不转红（双键假绿）；改为 !key.includes('.') 后变异如实转红",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-14T13:50:38.325Z",
    "resolved_at": null
  },
  {
    "id": 35,
    "kind": "deviation",
    "phase": "50",
    "file": "main.js",
    "line": null,
    "description": "两个新写子路由补 aiManager 空值守卫（503），对齐 50-01 的既有范式，避免早期请求撞 null ⇒ 500",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-14T13:50:38.408Z",
    "resolved_at": null
  },
  {
    "id": 36,
    "kind": "deviation",
    "phase": "51",
    "file": "tests/test-agent-workspace.js",
    "line": null,
    "description": "51-01 Rule 2: env.remove 用例的承重断言改用「尚不存在的逃逸目标」（计划原文 `remove('<link OUT>/x')` 形态）—— 首版删已存在的 root 外文件时，回退加固的树同样拒绝（resolveInside 对已存在路径本就做 realpath 复核）故该用例恒绿、无检出力；改用 ENOENT 目标后回退会退化成底层 not_found 而非 permission_denied，MA 变异可转红（已实测）",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-15T07:11:46.049Z",
    "resolved_at": null
  },
  {
    "id": 37,
    "kind": "deviation",
    "phase": "51",
    "file": "tests/test-agent-workspace.js",
    "line": null,
    "description": "51-01 Rule 2: 新增一条「未覆盖面」行为用例（计划仅要求注释登记）—— 断言 env.exec('echo escaped > ../x') 之后 root 外**确实**存在该文件，把「本加固不封闭 bash 写盘」（prohibitions 第 2 条 / D-15 诚实边界）从注释承诺升级为可执行反证据",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-15T07:11:46.134Z",
    "resolved_at": null
  }
]
````
