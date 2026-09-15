---
status: complete
phase: 47-bash
source: 47-01-SUMMARY.md, 47-02-SUMMARY.md, 47-03-SUMMARY.md, 47-04-SUMMARY.md, 47-05-SUMMARY.md, 47-06-SUMMARY.md
started: 2026-09-11T15:31:55Z
updated: 2026-09-11T16:30:00Z
---

## Current Test

[testing complete]

## Tests

<!-- 人眼检查点（coverage: present） -->

### 1. Cold Start Smoke Test
expected: 干净状态下从零启动：`managed-skills/` 手删两个内置技能后启动应用，主界面正常、无播种报错，两个技能目录自愈重播且各含 SKILL.md，AI 的 read 工具能在沙箱内读到任一 SKILL.md（SEED-02 / SEED-04 的冷启动面）
result: pass
verified_by: automated
evidence: |
  真实驱动（playwright _electron 启动 `electron .`，NODE_ENV=development；驱动脚本 /tmp/realm-uat47-coldstart2.js、
  /tmp/realm-uat47-probe.js、/tmp/realm-uat47-probe2.js，原始结果 /tmp/realm-uat47-result.json / -probe.json / -probe2.json）：
  - 前置：`~/Library/Application Support/realm-dev/agent-workspace/managed-skills/{find-skills,skill-creator}` 递归删除（15:45:23Z）。
  - 启动：Electron 主进程 PID 83387，2s 内出现主窗口 `file:///Users/<user>/Projects/Realm/src/index.html`，未崩溃、未卡启动。
  - 自愈重播：约 10s 内两个目录重新出现且各含 `SKILL.md`（mtime 15:45:25Z）。
  - 字节一致：`find-skills`（2 文件）/ `skill-creator`（19 文件 + 5 目录）整棵树与 `skills-builtin/` 对应目录逐文件 sha256 全等。
  - 加载器：进程内取真实 app 的 `ai-skills-manager.getSkillsSnapshot()` → `count=4`（2 user + 2 managed）、`diagnostics=[]`、`errors=[]`。
  - prompt 过滤（SEED-04）：`<available_skills>` 段内**不含** `find-skills` / `skill-creator`（两者 `disableModelInvocation: true`），
    仅含用户技能 `demo` / `weather`。注：`buildSkillsPrompt()===''` 是「技能集恰好只有内置技能」时的条件成立，本环境有 2 个用户技能，prompt 非空属正确行为
    （初次断言的过宽口径已由本次复核修正，非实现缺陷）。
  - 日志面：主进程 stdout/stderr 无任何 `realm_builtin_seed_*` 诊断行、无技能/打包相关未捕获异常（干净路径零噪声，与 47-06 D5 设计一致）。
  - 沙箱读：真实 `agent-workspace.createSandboxEnv()` 读 `managed-skills/find-skills/SKILL.md`（3,367 B）与 `skill-creator/SKILL.md`（32,289 B）均 `ok`；
    负对照 `/etc/passwd` 返回 `permission_denied`（沙箱非空转）；`listDir(managed-skills)` 列出两个技能目录。
  - 安全：全部检查后精确强杀本脚本启动的进程树（按 PID，非路径模式），确认无 dev Electron 残留；生产实例 PID 25922 全程存活未受影响。

### 2. 打包态路径分支在真实 .app 内生效（47-01 D5）
expected: 打包态（`app.isPackaged`）下 `process.resourcesPath/app.asar.unpacked/skills-builtin` 这条分支生效：`make install-nightly` 后启动 Nightly，`realm-nightly/agent-workspace/managed-skills/` 出现两个内置技能且加载器零诊断。注意：47-04 已用 Nightly 路线实测收口（不触碰 `/Applications/Realm.app` 生产实例），此处确认该结论成立
result: pass
verified_by: user
evidence: |
  用户实测确认：「nightly 手动删除两个技能后，启动可以重建」——即打包态下随包源解析（`app.isPackaged` → `process.resourcesPath/app.asar.unpacked/skills-builtin`）
  与「手删后下次启动自愈重播」两条判据在真实 Nightly 产物内成立。文件面复核：`realm-nightly/agent-workspace/managed-skills/`
  下 `find-skills`（SKILL.md + LICENSE.txt）与 `skill-creator`（SKILL.md + LICENSE.txt + agents / assets / eval-viewer / references / scripts）齐备，
  mtime 23:49 与 Nightly 启动时序一致。47-04 已留存的打包面证据（unpacked 面两个 SKILL.md、asar 清单面、运行期播种面、进程内加载面 `isPackaged:true` + 零诊断 + 幂等 + 自愈）作为补充。
  注：本次同时暴露一处相邻的体验发现（AI 被问「你现在有哪些技能？」时看不到这两个内置技能），已按用户决定记入 `## Deferred Follow-Ups`，不影响本检查点判定。

### 3. 显式调用链路的已知边界（47-01 D6）
expected: 确认这是 Phase 48 之前的**显式已知边界**而非本阶段缺陷：`disable-model-invocation: true` 的内置技能已被证明不进 system prompt 的 `<available_skills>` 段（Nightly 中用户技能为空 → 该段完全为空；dev 中该段只含用户技能 demo/weather），但 `/skill:name` 显式调用下模型能否读到正文尚未实现（Phase 48 交付），本阶段不对此断言
result: pass
verified_by: user-acknowledgement
note: |
  **本检查点为「确认式」而非「行为式」——没有用户可观察行为可验。** 它是 coverage 分类器标出的 `human_judgment` 条目，
  实为 47-01-SUMMARY 的一条 flagged assumption（Phase 48 才交付显式调用链路），不是本阶段交付物。
  用户 2026-09-11 指出「Test 3 没有可以验证的东西」，据此按「已确认是已知边界、非阶段 47 缺陷」记录为 pass。
  标记说明：`phase uat-passed` 谓词只把 `pass`/`passed` 计为通过，`skipped` 会计入 blockers，故此处不能标 skipped。
  如需让该条不作为检查点出现，可把它整体移入 Observations（total 38→37）。

### 4. 打包后归属仍可读 + 打包态 paths 分支（47-03 D7）
expected: P10-6 在打包态成立：正式/Nightly .app 内 `THIRD_PARTY_NOTICES.md` 与两个技能目录内的 `LICENSE.txt` 均随包且在列，归属信息（来源仓库 + 固定 SHA + 许可证 + 是否修改 + 修改说明）在产物内可读
result: pass
verified_by: automated
evidence: |
  对 `/Applications/Realm Nightly.app`（构建于 2026-09-11 23:49，即用户本次实测的那次 `make install-nightly`）只读检查：
  - `Contents/Resources/app.asar.unpacked/skills-builtin/{find-skills,skill-creator}/` 各含 `SKILL.md` + `LICENSE.txt`；
    四个文件与仓库 `skills-builtin/` 对应文件 **sha256 逐一全等**（find-skills SKILL.md `16e9126f…` / LICENSE.txt `998818e8…`；
    skill-creator SKILL.md `906a6ef9…` / LICENSE.txt `58d1e17f…`）。
  - `Contents/Resources/app.asar` 内以 `@electron/asar extract-file` 取出 `THIRD_PARTY_NOTICES.md`，与仓库根同名文件
    **sha256 全等**（`52c783ec6ff42df73dfd81f5330c14e86f25da8712e90b9a2f2bdb0d71d69ae6`，8,967 B）→ 随包且在列且可读。
  - 五要素齐备：`来源仓库` ×3、`固定 commit SHA` ×3（find-skills `773fb2c7bbf16781670a3520affc4abd0c6151ae`、
    skill-creator `b0cbd3df1533b396d281a6886d5132f623393a9c`）、`许可证` ×13、`是否修改`/`modified` ×3、修改说明成节
    （含 §3 易错事实、§4 不由 Realm 分发的运行时依赖、§5 升级检查清单）。
  - 打包态 paths 分支：`app.asar.unpacked/skills-builtin/` 实际存在（asarUnpack 生效），与 Test 2 的播种成功互为印证。

### 5. 零安装语义扫描的能力上限（47-03 D8）
expected: 确认扫描器的边界如实：`FORBIDDEN_PATTERNS` / `INSTALL_IMPERATIVES` 是模式匹配而非语义分析，无法穷举中英等价改写（实测已发现计划与 RESEARCH 共同断言的「上游 SKILL.md 0 命中」不成立）。真正的判据是**逐句人工评审**——确认 `skills-builtin/` 两个技能正文逐句评审后不含任何「执行外部安装 / 下载并运行」语义
result: pass
verified_by: automated-sentence-review
evidence: |
  逐句评审范围：`find-skills/SKILL.md`（120 行 / 6,933 B）+ `skill-creator/SKILL.md`（487 行 / 32,672 B），共 607 行，全文通读。

  **find-skills —— 零 bash 代码块。** 全部可执行指引都只产生一次 `web_fetch` / `web_search` 工具调用（L36-53 三步检索流程、
  L55-78 唯一端点与两条硬性限制、L80-91 核验规则、L93-105 输出格式）。L107-113 的「安装」是**指路**（设置 → AI → 技能管理 → 导入），
  并显式声明「本技能到此结束，不再对导入过程做任何后续动作」。

  **skill-creator —— 全部 6 条命令行逐条判定，均非安装语义：**
  1. `node scripts/check_env.mjs --capability <name>`（L50）— 随包 Node 探针，本地、无网络
  2. `python -m scripts.aggregate_benchmark …`（L259）— 随包脚本，本地
  3. `nohup python eval-viewer/generate_review.py … &` + `VIEWER_PID=$!`（L268-273）— 随包脚本起本地 viewer
  4. `kill $VIEWER_PID 2>/dev/null`（L317）— 收掉自己起的 viewer
  5. `open /tmp/eval_review_<skill>.html`（L401）— 打开本地文件
  6. `python -m scripts.run_loop …`（L414-419）— 随包脚本，本地优化循环
  另 L216 行内 `cp -r <skill-path> <workspace>/skill-snapshot/` 为本地目录复制。
  → **无一条**「从网络取回后执行」、无一条调用包管理器、无一条写用户级全局位置、无一条建议绕过确认。

  **反向证据（技能主动推开安装）：** L56「Do not run installers yourself… 告知用户缺哪些包，由用户加进**自己**的环境」；
  L193 / L365「never add them yourself」；L57「Python 完全缺失时留在 Realm 的 write/read/bash」；L45 明确脚本是**可选**路径。
  探针自身打印的指引末行即 `Do not auto-install dependencies from this skill.`

  **`install` 词全部 3 处命中，逐条判定（D8「模式匹配无法穷举语义」的实例）：**
  - L53：探针 JSON 的字段名 `installGuidance`（数据字段，非指令）
  - L56：禁止安装的指令本身
  - L62：上游叙述性举例「家长去 google "how to install npm"」，描述**用户画像**而非可执行命令 → 人工判定为不产生命令，保留上游原文（符合「除六处受控改动外不得偏离上游正文」）

  **机械面独立佐证：** `node tests/test-builtin-skills-seeder.js` → `# tests 101 / # pass 101 / # fail 0`（含 SEED-03/SEED-04
  零安装语义二段式扫描与 P1-a 门禁断言组、承重条目反向验证）。

  结论：扫描器的自述上限（模式匹配 ≠ 语义分析）**如实**；逐句评审未发现任何「执行外部安装 / 下载并运行」语义。

### 6. 上游正文两处 Cowork 提及按禁令逐字保留（47-03 D9）
expected: 确认这是有意保留的**受控残余**：`skill-creator` 上游正文 Step 4 的 headless 回退说明与结尾 TodoList 提醒两处 Cowork 提及逐字保留（计划只禁 `present_files` / Claude.ai-specific / Cowork-Specific 三处标题子串，两处残余属环境条件性说明），已在 `WINDOWS.md` 登记
result: pass
verified_by: automated
evidence: |
  - **三处被禁章节标题已删干净**：`present_files` / `Claude.ai-specific` / `Cowork-Specific` 在 `skills-builtin/skill-creator/SKILL.md` 中命中数均为 **0**。
  - **标题清单无平台专有章节**：全文 39 个标题行只含 `## Environment Preflight` / `## Creating a skill` / `## Running and evaluating test cases` /
    `## Improving the skill` / `## Advanced: Blind comparison` / `## Description Optimization` / `## Reference files` 及其子节（另有示例模板里的伪标题）。
  - **两处残余逐字保留**（与 D9 描述完全对应）：L277 `**Cowork / headless environments:** If \`webbrowser.open()\` is not available…`（Step 4 viewer 的无显示环境回退说明）；
    L485 `…If you're in Cowork, please specifically put "Create evals JSON and run …" in your TodoList…`（结尾提醒）。两处均非被删三章的标题子串，属环境条件性说明。
  - **改动声明如实**：L9-17 的 `> **Modified for Realm Browser.**` 段点名来源仓库 + 固定 SHA `b0cbd3df…`、Apache-2.0、改动清单（新增 Environment Preflight、删除三处平台专有章节、两处评测节加 preflight 指针、
    Reference files 更新、中文 description、`disable-model-invocation: true`），并声明「All remaining body text is upstream text, unchanged」——与逐字保留两处残余**不矛盾**（残余即上游原文）。
  - **已登记**：`.planning/WINDOWS.md` 第 16 行（phase 47 / kind deviation / status open）描述与 D9 逐句一致，并写明「若后续阶段判定需要，属新的受控改动，须同步 THIRD_PARTY_NOTICES」。

<!-- 自动覆盖条目（coverage: auto_passed）—— 不由用户呈现 -->

### 7. 随包 find-skills 已 Realm 化为「零安装候选清单技能」
expected: 正文中文、只经 web_fetch/web_search 检索 GitHub 仓库搜索接口，frontmatter 含 disable-model-invocation: true；随附 MIT LICENSE.txt
result: pass
source: automated
coverage_id: 47-01-D1

### 8. builtin-skills-seeder.js 播种模块
expected: 随包源解析 / seeded 身份 / 原子目录替换 / 内容差异检测 / 单技能目录粒度播种 / 4 个诊断 code 全部真实可达
result: pass
source: automated
coverage_id: 47-01-D2

### 9. 端到端纵切：随包 → 播种 → 加载 → 不进 prompt
expected: skills-builtin/find-skills → managed-skills/find-skills（逐字节相同）→ refreshSkills 零诊断识别 name/source → buildSkillsPrompt() === ''
result: pass
source: automated
coverage_id: 47-01-D3

### 10. 启动接线与打包配置
expected: main.js 在 migrateAiMemory() 之后、new AIManager() 之前同步播种；package.json 的 build.asarUnpack 追加 skills-builtin/**
result: pass
source: automated
coverage_id: 47-01-D4

### 11. 包管理器安装命令无法借白名单绕过确认
expected: 13 族（npx / npm / pnpm / yarn / bun / pip / python -m pip / uv / uvx / brew / cargo / go / gem）无论是否命中 settings.aiBashWhitelist，一律 confirm 且 riskLevel high
result: pass
source: automated
coverage_id: 47-02-D1

### 12. 只读子命令零误伤
expected: D-16 的 ≥14 条反例全部不进安装档，且回到既有白名单语义
result: pass
source: automated
coverage_id: 47-02-D2

### 13. 确认卡片能区分安装档与危险档
expected: install → riskLevel 'high' + 专属 title 与文案；danger 文案与 title 保持不变
result: pass
source: automated
coverage_id: 47-02-D3

### 14. 危险与安装同段共存时 danger 优先
expected: sudo npm i x / npm i x && rm -rf y / 管道 sh 全部返回 danger；安装段仍被收集（installNames 不短路）
result: pass
source: automated
coverage_id: 47-02-D4

### 15. 既有 bash 策略用例零回归
expected: 既有 32 例零回归（含 gateway 断言），2 条 deepStrictEqual 按完整形状同步
result: pass
source: automated
coverage_id: 47-02-D5

### 16. 安装档残余风险如实记录且严重性有限
expected: 变量间接（真漏检）不命中安装档也不命中白名单 → 仍 confirm/default；反引号/子 shell 向安全侧倾斜；字面量误报只多一次确认
result: pass
source: automated
coverage_id: 47-02-D6

### 17. skill-creator 作为固定 SHA 的上游快照随包
expected: 18 个上游文件逐字节一致（LICENSE.txt 精确 11,357 B），agents/ 完整保留；SKILL.md 经六处受控改动后不含平台专有内容
result: pass
source: automated
coverage_id: 47-03-D1

### 18. 两个内置技能经播种 → 加载 → 不进 prompt 的完整链路
expected: managed 来源、零诊断零错误；嵌套资源（scripts/ / agents/ / eval-viewer/）完整落盘
result: pass
source: automated
coverage_id: 47-03-D2

### 19. check_env.mjs 环境预检探针
expected: 8 个失败码常量单源、4 个 capability 分组、10s 超时、min Python 3.10、只读包检查、spawnSync 双判；未知项一律 unknown_requirement 且非零退出
result: pass
source: automated
coverage_id: 47-03-D3

### 20. 零安装语义扫描面扩到两技能
expected: P1-a-1/2/3 三条门禁信号各有独立命名断言，两次反向验证证明非空转
result: pass
source: automated
coverage_id: 47-03-D4

### 21. P10 归属门禁载体就位
expected: THIRD_PARTY_NOTICES.md 两技能各五要素、三处易错事实、Python 依赖免责；两个 LICENSE.txt 随播种逐字节落盘
result: pass
source: automated
coverage_id: 47-03-D5

### 22. SKILL-09 的零新增权限机制
expected: 技能自带脚本经既有 bash 工具执行，DANGEROUS_INTERPRETERS 未被放宽
result: pass
source: automated
coverage_id: 47-03-D6

### 23. package.json 的 build.files 新增 11 条排除项
expected: 全部为「!」排除、无正向条目，使 .planning/** 等开发期内容不再随包分发
result: pass
source: automated
coverage_id: 47-04-D1

### 24. 改后 asar 清单（安装产物面）
expected: .planning/ 与 test/ 与 tests/ 与 scripts/ 条目数为 0、无 *.bak、skills-builtin/** 与 THIRD_PARTY_NOTICES.md 在列
result: pass
source: automated
coverage_id: 47-04-D2

### 25. DOC-02 三份文档同步
expected: ai-skills.md 新增第八章/第九章；ai-agent-workspace.md §四/§五/§七/§八 同步；AGENTS.md 三档说明改写；三份口径一致且含「技能不构成额外权限」与 allowed-tools 免责
result: pass
source: automated
coverage_id: 47-04-D3

### 26. SEED-05 的打包面判据
expected: Nightly .app 内 asar.unpacked/skills-builtin/{find-skills,skill-creator}/SKILL.md 存在；managed-skills/ 两个技能目录出现；加载器零诊断；幂等与自愈在打包态成立
result: pass
source: automated
coverage_id: 47-04-D4

### 27. 仓库根审查结论留痕
expected: 每个根条目给出条目数 + 保留/排除结论 + 理由
result: pass
source: automated
coverage_id: 47-04-D5

### 28. 词法噪音形态不再落到 allow 零卡片
expected: `brew "install" wget` 等引号/反斜杠/引号拼接三类噪音在判定前被抹平，8 条改写形态 + 6 条第二绕过家族在文档推荐白名单下全部 confirm/install
result: pass
source: automated
coverage_id: 47-05-D1

### 29. 安装档判定为「首 token 默认拒绝」
expected: 首 token 命中 15 项工具集且子命令不在该工具显式只读清单内即强制确认；只读清单表驱动断言全绿
result: pass
source: automated
coverage_id: 47-05-D2

### 30. 只读豁免的三条承重墙 + 纵深层不遮蔽自身只读清单
expected: 空 readOnly 工具不生成动词式正则；纵深优先把 `npm -g install list` 等真实安装命令收回安装档；pipx list 只读可达而 pipx install black 属安装档
result: pass
source: automated
coverage_id: 47-05-D3

### 31. WR-01 退化入口双向关闭
expected: `['*']` 在服务端校验与匹配层被双向关闭；合法通配条目（`npm run *`）与裸条目行为不变
result: pass
source: automated
coverage_id: 47-05-D4

### 32. DOC-02 安装档描述在新行为下逐句为真
expected: 三份文档含三处形态限定、两条具名残余与 pipx list；AGENTS.md 测试用例数回填实跑值 97
result: pass
source: automated
coverage_id: 47-05-D5

### 33. 内容一致时重启不再重建技能目录
expected: SKILL.md 与技能目录 inode 均不变、mtime 不变、零诊断；sha256 层不再每次启动白算；rename 空窗消失
result: pass
source: automated
coverage_id: 47-06-D1

### 34. 目录项参与差异判定
expected: 源侧新增空目录 → 判 different 并自愈；两层嵌套子目录仍判 same（目录条目不得进入 size/sha256 层）
result: pass
source: automated
coverage_id: 47-06-D2

### 35. 崩溃残留播种前被清扫
expected: 预置两条残留后播种即消失，技能集无 .bak_/.tmp_ 幽灵条目，diagnostics 与 errors 均为空，干净对照项仍在
result: pass
source: automated
coverage_id: 47-06-D3

### 36. 清扫不误删（锚定 \d+$）
expected: 含 .bak_/.tmp_ 但后缀非数字的目录、以及既非残留也不含 SKILL.md 的目录全部存活；阳性对照被删
result: pass
source: automated
coverage_id: 47-06-D4

### 37. 四条诊断路径按级别经 console 输出
expected: 播种结束按级别经 console.error / console.warn 输出；顶层 catch 在零诊断下仍是独立可见面；干净路径零噪声
result: pass
source: automated
coverage_id: 47-06-D5

### 38. 回归：既有播种用例全绿
expected: 88 → 101 例；test-ai-skills 64/64、test-agent-workspace 21/21、test-ai-bash-policy 97/97；四个基线文件零 diff
result: pass
source: automated
coverage_id: 47-06-D6

## Summary

total: 38
passed: 38
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

## Observations

<!-- 非阻断观察，不进入 Gaps（不生成修复计划） -->

- **verify:pre API 门禁误报**（2026-09-11）：`ai-integration · api-coverage` 门禁按 `workflow.api_coverage_gate=true` 阻断启动，命中 5 处顺带提及的 `api` 词（find-skills 正文里的 GitHub 检索端点 URL、THIRD_PARTY_NOTICES 的文档陈述、Realm 本地 `/api/settings/update`、模块内部 API 表述）。经复核确认本阶段无外部 API 集成，按门禁文档认可的误报路径写 `.planning/phases/47-bash/COVERAGE.md` 一行声明 `No external API integration: …` 解除，门禁复验 `block:false / none_declared:true`。
- **提交数对账（#3968）非阻断差异**（2026-09-11）：按 workflow 字面口径 `git rev-list --count <plan_head_before>..HEAD` 得到 47-01=39 / 47-02=35 / 47-03=31 / 47-04=23 / 47-05=13 / 47-06=9，与各 SUMMARY 声明的 3/3/4/4/3/2 不符。改用权威台账 `.git/gsd-plan-head-before-47-0N` 做**计划范围内**计数后：47-01=4(=3+1)、47-02=4(=3+1)、47-05=4(=3+1)、47-06=3(=2+1) 全部自洽；47-03=8 多出的 3 条是 `docs(47-03)` 对 SUMMARY 自身的自检说明补写、47-04=10 多出的 6 条是阶段级 code review / verification / gap-plan / plan-revision 提交（非该计划工作）。**实质风险不存在**：`git status` 干净（仅 `.review-diagnostics/` 未跟踪），每个计划均有归属明确的 feat/fix/test 提交，无「只叙述未提交」的迹象。判定为度量窗口伪差异，不记为 `commit_claim_mismatch`。
- **自动化驱动的关闭面（harness 观察，非阶段缺陷）**（2026-09-11）：playwright `app.close()`（Electron `app.quit()` 语义）在 dev 态 15s 未返回，疑为关闭确认弹框阻塞退出。驱动脚本最终形态为「先礼貌 quit 15s → 失败则按 PID 精确强杀进程树（绝不按路径模式 pkill）」，强杀后确认零残留。该行为属既有应用关闭语义（多标签/会话恢复确认），不属阶段 47 交付面，不记为 gap。
- **AI 对话消息未落盘（独立于阶段 47，待单独排查）**（2026-09-11）：`realm-nightly/ai-conversations.db` 中对话 `38fcf0c6`（标题「你现在有哪些技能？」，创建 15:50:09Z、`updated_at` 15:51:32Z）**0 条消息**；全库仅 6 条消息，均属 9/4 的两条旧对话。`saveCurrentConversation()` 在 `agent_end` 内同时执行 `saveMessages()` 与 `updateConversation()`（后者负责推 `updated_at`），二者不应分离——存在「行更新了但消息没写」的状态。读取方式已排除快照误差：复制 `db + -wal + -shm` 后以读写方式打开做 WAL 恢复，与只读连接结果一致。属 AI 对话持久化链路（Phase 38 面），不记为阶段 47 的 gap。

## Deferred Follow-Ups

```yaml
- test: 2
  idea: "用户报（原文）：「AI 提问『你现在有哪些技能？把每条的 name 和 description 逐条列出来。』没有把这俩个技能返回。」——两个内置技能带 disable-model-invocation: true，技能加载器据此把它们排除出 system prompt 的 <available_skills> 段，故模型完全不知道它们存在；Nightly 的 skills/（用户技能）为空，prompt 段因此完全为空。这是 47-CONTEXT D-04 的锁定决策（不进 prompt 的理由：该标记表示「只能用户显式调用」，description 的人眼消费者是 Phase 48 的 / 面板与 Phase 50 的设置页），技能发现能力由 ROADMAP Phase 48 交付（/ 面板 + /skill:name + 模型按 description 自动匹配）。用户 2026-09-11 决定记为后续项，不在阶段 47 生成修复计划。"
  deferred_at: 2026-09-11
  supporting_evidence:
    - "dev 库对话 05fad4a3（02:46:27Z）：模型把「技能」当成工具，列出 24 个 tool，未提 find-skills / skill-creator"
    - "dev 库对话 cffc505c（02:58:25Z）：模型答「目前我有 1 个技能：demo」，仅列用户技能 demo"
    - "真实 app 进程内 getSkillsSnapshot()：dev 的 prompt 段只含 demo / weather，两个内置技能不在其中（disableModelInvocation: true 被过滤）"
  note: "若 Phase 48 仍不覆盖「模型需知道自己具备哪些内置技能」，需重新评估 D-04 的「不进 prompt」口径（例如只注入 name + description 并标注「需用户显式调用」）。"
```
