# Project Research Summary

**Project:** Realm Browser — v2.6 AI 助手技能（Skill）能力
**Domain:** Electron 桌面应用内集成 Agent Skills 体系（SKILL.md 目录 + zip / 网络导入 + AI 自建）
**Researched:** 2026-09-10
**Confidence:** HIGH
**Synthesized from:** `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`

---

## Executive Summary

这是**增量集成**，不是从零构建。pi-agent-core 0.84.3 已经内置了本功能最贵的三块：`loadSkills` / `loadSourcedSkills`（目录递归扫描 + frontmatter 解析 + 名称/描述校验 + ignore 文件处理）、`formatSkillsForSystemPrompt`（`<available_skills>` 系统提示注入）、`formatSkillInvocation`（技能正文注入块）。Realm 不需要写扫描器、XML 生成器或 YAML 解析器——**"技能发现与调用"本身的成本是 LOW**。真正的复杂度全部落在 SDK 刻意不管的三块：**写入、导入、安全**（zip 解压、网络来源分流、原子写、managed 边界、名称遮蔽、路径逃逸防护）。技术上只需新增 **1 个运行时依赖**（zip 解压库 `yauzl@^3.4.0`），其余四项前置问题（GitHub 下载、frontmatter 解析、热重载、zlib）全部零新增依赖（详见 STACK.md）。

架构上有一条**决定性的硬约束**：`formatSkillsForSystemPrompt` 会把技能文件的**绝对路径**写进 system prompt 并指示模型调 `read` 工具去读，而 `read` 受 `agent-workspace` 硬沙箱约束。因此 **`skills/` 与 `managed-skills/` 必须落在 `agent-workspace/` 内**，否则模型能看到 location 但永远读失败——**静默失效，不报错、不崩溃、极难定位**。这条决定了它必须排在第一个阶段。第二约束是**同步性**：`buildSystemPrompt()` 是同步契约（有 G-42-4 事故记录），而 `loadSkills` 是异步的，因此必须走"异步加载 → 模块级缓存 → 同步读"的既有模式（与 AI 记忆快照同构）。第三约束是**双目录 + 单一权威**：`skills/`（用户，最高优先级）> `managed-skills/`（内置播种 + AI 自建），去重必须发生在注入之前，且优先级逻辑只能有一份（主进程），renderer 只渲染。

风险集中在**导入面**，且三个最高危项都已实测确认而非推测：**P1——原样打包 vercel-labs 的 `find-skills` 等于随包分发一份"用 `npx skills add -g -y` 绕过沙箱装任意代码"的说明书**（S1，`npx` 当前甚至不在 bash 危险解释器清单里、可被白名单免确认）；**P2——`resolveInside` 对"尚不存在"的写目标只做词法校验，恶意 zip 里一个 symlink 目录 entry 即可把文件写出工作区**（S1，本仓已用 `node -e` 实测复现：越界路径返回非 null）；**P3——SKILL.md 的 `description` 每次请求无条件进 system prompt（无需任何交互），且技能名可冒名顶替内置技能**（S1，`validateName` 只产 warning 不拒绝）。这三项加上 zip-slip（P4）与 SSRF（P9）必须在对应阶段的威胁模型里落为阻断门禁（`security_enforcement: true` + `block_on: high` 已开启）。

---

## Key Findings

### Recommended Stack

**唯一新增运行时依赖：`yauzl@^3.4.0`**（zip 解压）。选它的理由不是"更流行"，而是**结构性安全优势**：yauzl **从不写盘**（只产出 read stream，落盘行为 100% 由 Realm 决定），因此 adm-zip CVE-2026-76845 那一整类"库自己用 `fs.open(w)` 跟随目标目录里预先存在的 symlink 写出根目录"的攻击**在架构上不可能发生**；同时它把三道防线做进默认值——`validateFileName()` 在 `decodeStrings:true`（默认）时对每个条目自动执行（挡 Zip Slip），`validateEntrySizes:true`（默认）强制 `uncompressedSize` 契约（官方标注为 zip bomb 安全特性）。代价是需自写约 60–90 行解压循环，换来每一行落盘都在我们自己手里。**明确不要用**：`extract-zip`（CVE-2026-56876，CVSS 8.1，上游维护者失联、官方声明无补丁、Red Hat 建议停用）、`adm-zip`（CVE-2026-76845，**0.5.9~0.6.0 含最新版全部受影响**，无修复版本）、`unzipper`（依赖树重）、`jszip`/`fflate`（核心价值在压缩侧，不含 ZIP 安全校验语义）。完整对比矩阵与 CVE 出处见 **STACK.md (a)**。

**零新增的其余四块**：① GitHub 下载走 `codeload.github.com/<o>/<r>/zip/refs/heads/<b>` 直连 + `raw.githubusercontent.com` 直链——**实测两者响应完全没有任何 `x-ratelimit-*` 头**，不吃 REST API 的 60/hr 主配额（`api.github.com` 才有）；② frontmatter 解析**不要自己做**——SDK 内部已用 `yaml@2.9.0` 解析并把校验语义封装好了，走"解压到 `.tmp/` → `loadSkills(env, [tmp])` → 读返回的 `Skill[]` + `diagnostics[]`"免费拿到与运行时**完全一致**的校验；③ **不需要任何文件监听**——技能目录的写入者只有本应用自己（导入 / `manage_skill` / 设置页），在变更路径上确定性 reload 即可，比 watching 更简单、零延迟、无误报；④ `zlib` **不能**替代 yauzl（ZIP 是容器格式，不是压缩格式）。

**技术栈要点**：`Skill` API 必须从**包根**动态 import（`await import('@earendil-works/pi-agent-core')`）——SDK 的 `exports` map 只有 4 个入口，**没有 `./harness/skills` 子路径导出**，深路径 import 会抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`。网络请求**必须用 Electron `net.fetch` 而非全局 `fetch`**（undici 不走系统代理，国内环境大面积失败，`favicon-fetcher.js:8-9` 有事故记录）——这是硬约束，因为 `codeload`/`raw.githubusercontent.com` 在国内正是直连常不可达的目标。`yauzl` 纯 JS 无原生模块 → **不需要 `asarUnpack`、不需要 electron-rebuild**，`build.asarUnpack` 保持现状不动。

> ⚠️ **两份研究存在一处选型分歧，本摘要已裁决。** PITFALLS.md P4 建议 `fflate`（写作时未做 CVE 差异化对比）；STACK.md 做了 npm registry + CVE 公告 + 场景适配的完整核验，推荐 `yauzl`。**采纳 STACK.md 的 `yauzl@^3.4.0`**：fflate 是把整包读进内存的压缩优先库，不提供任何 Zip Slip / zip-bomb / symlink 校验语义，落盘后的防护成本反而更高。次选为 `node-stream-zip@^1.16.0`（零依赖、54 KB、自带 `extract()`），**但必须自补两道护栏**（`path.resolve` 包含性复核 + 按 `entry.attr` 拒绝 symlink 条目），且**绝不能**传 `skipEntryNameValidation`。

### Expected Features

**Must have（table stakes，全部属本里程碑 P1 范围）**

- **技能目录纳入沙箱 + 加载接线**（LOW）— 全部功能的前置，`agent-workspace.js` 加两目录常量与 `ensureWorkspaceDir` 建目录；**沙箱零改动**（子目录在根内，`resolveInside` 天然放行）
- **`<available_skills>` 注入 `buildSystemPrompt()`**（LOW）— 直接调 SDK，拼成第 4 段；**必须判空**（无技能时返回 `''`）
- **模型自动激活**（LOW）— description 匹配 → 模型自己 `read` 正文，**零新增工具**；前提是技能在沙箱内
- **`/skill:name [args]` 显式调用**（MEDIUM）— 这是发现机制的**补集而非锦上添花**：官方说明模型对简单任务"故意不触发技能"，且这是用户测试技能的唯一手段
- **`/` 面板并入技能列表**（MEDIUM）— 复用现有 `renderSlashPickerList`；技能命令是**第二命令源**（`kind:'skill'` 判别），**不要混进 `SLASH_COMMANDS`**（详见 ARCHITECTURE.md Anti-Pattern 4）
- **设置页技能管理区**（MEDIUM）— 列表 / 来源 / 诊断 / 启停 / 删除；**必须走 `/api/*` + token，不能用 realmAPI**（webview guest 无 realmAPI，Phase 17 事故根因）
- **用户 > managed 同名优先级 + 冲突可见**（LOW）— `loadSourcedSkills` 天然带 source 标记；静默去重会让用户无法判断导入是否成功
- **诊断透传到设置页**（MEDIUM）— SDK 的失效模式是**静默降级**（非法 name / 超长 description / YAML 解析失败全部只产 warning），不透传就是"导入了但没生效"的静默失败
- **zip 导入 + 网络地址导入（GitHub 仓库/目录 与 SKILL.md 直链自动分流）**（HIGH）
- **`manage_skill` 工具（create/update/delete）**（HIGH）— 生态先例 oh-my-pi 的同类工具**默认关闭且标注 experimental**，Realm 做得稳就是领先
- **内置 find-skills（Realm 化）+ skill-creator（仅作者指南部分）**（MEDIUM）— **必须 Realm 化改写，不能原样 vendor**

**Should have（differentiator）**

- **技能自带 `scripts/` 在沙箱内执行**（MEDIUM）— 复用既有 `ai-bash-policy` 白名单 + 确认卡片，**零新增机制**；这是"技能带脚本既好用又可控"的唯一可行形态
- **技能来源与体积可视化**（MEDIUM）— source（user/managed/seeded）、SKILL.md 字节数、文件数

**Defer（v2+，明确不做）**

- `$ARGUMENTS` / `$N` 替换、堆叠调用、mid-prompt 嵌入 `/skill:` token、自动按需注入技能正文、容器级技能作用域、`context: fork`、技能四态可见性（先做二元 enable/disable）、`hide` 语义
- **明确 Anti-Features（不做且要写进文档）**：应用内技能市场/排行榜/遥测、多源发现（`~/.claude/skills` / plugins 7 层 priority）、预加载技能正文进 system prompt、**动态 shell 注入 `` !`cmd` ``（= 远程代码执行）**、`allowed-tools` 按技能授权、技能目录内捆绑 hooks/MCP/subagent、自动 nudge AI 建技能、技能文件热重载。理由与替代方案见 **FEATURES.md §7.3**。

### Architecture Approach

新增**一个主进程模块 `ai-skills-manager.js`** 作为技能的**单一数据权威**（模块级缓存 `{skills, promptBlock, digest, diagnostics}`），它承担加载/缓存/解析/安装/卸载/增删改/校验，并产出 system prompt 段。`ai-manager.js` 只需四处接线：`buildSystemPrompt()` 加第 4 段（同步读缓存）、两条 Agent 创建路径（`init()` 与 `_recreateAgent()`）在 `buildSystemPrompt()` **之前**异步刷新、新增 `syncAgentSystemPrompt()` 在变更后一次性回写 `agent.state.systemPrompt`（**不重建 Agent**——`agent.state` 直接返回内部 `_state` 且每轮 `createContextSnapshot()` 重读，已三处交叉验证）。前端天然需要**两个入口但只有一个后端权威**：主窗口走 `realmAPI.*` IPC，设置页（`realm://settings` guest）走 `/api/skills/*?token=`。

**双目录设计与归属（本里程碑最核心的一个设计决策）**

| 目录 | 来源 | `source` | 权威性 | 谁可写 |
|------|------|----------|--------|--------|
| `agent-workspace/skills/` | 用户导入（zip / 网络地址） | `'user'` | **最高**（同名遮蔽 managed） | 用户（设置页导入/删除） |
| `agent-workspace/managed-skills/`（内置播种部分） | 随包分发的 find-skills / skill-creator | `'managed'` | 中 | **谁都不可覆盖**（`manage_skill` 按播种登记表拒绝，非按目录位置判定） |
| `agent-workspace/managed-skills/`（AI 自建部分） | AI 经 `manage_skill` 创建 | `'managed'` | 最低 | AI（可增删改） |

**tier 只有 2 层**（user > managed），**不要引入 oh-my-pi 那套 7 层 provider priority 数值表**——那是为 7 个异构来源设计的机制，Realm 没有 `.claude`、plugins、monorepo，引入即纯负担。但**必须保留两点**：① 同名去重 user 胜出、首个胜出；② 同名冲突**必须对用户可见**。

**沙箱的诚实边界（必须写进产品文档）**：`createSandboxEnv` 只知道一个 root，因此它**无法区分** `skills/` 与 `managed-skills/`——"AI 不可删改内置技能"是**工具层不变式，不是沙箱不变式**。必须实现在 `manage_skill` 的写路径里（按播种登记表判定），并如实写明，与 `ai-bash-policy` 的"白名单判定是启发式而非安全边界"同款哲学。**不要**给 `managed-skills/` 做只读挂载或额外 root 白名单——那会引入第二套路径判据，与 `resolveInside` 的双基准/realpath 逻辑形成漂移风险。

**`manage_skill` 的关键接口约束：工具绝不吃 path 参数。** 只吃 `name`（`^[a-z0-9-]+$`），路径由 manager 用 `path.join` 计算。两个技能目录都在沙箱 root 内，`resolveInside` 会放行工作区内的**任意**路径——带 `path` 参数等于让模型可写 `ai-memory/MEMORY.md`、`attachments/`。沙箱在这里提供不了保护，**接口设计本身才是边界**。校验必须在服务端再做一次（JSON Schema `pattern` 只是给 LLM 看的提示，LLM 参数不可信）。

**加载器的两个非直觉行为直接约束导入实现**：① 任何目录层只要直接含 `SKILL.md` 就只加载它并立即 `return` → `skills/` 根目录**绝对不能**直接放 `SKILL.md`，且技能目录内不能再有子技能目录；② 根层散落的带 `description` 的 `*.md` **也会被当成技能加载** → 导入时必须清理 `README.md` 之类文件，否则产生 name 与父目录不匹配的幽灵技能（只有 warning，**不加载失败**）。另外 SDK 是**递归**扫描的，建议加载后按"相对深度 = 2"过滤为固定一层。详见 ARCHITECTURE.md (a)。

### Critical Pitfalls

1. **P1（S1，阻断门禁）——内置 find-skills 逐字打包 = 随包分发一份"绕过沙箱装任意代码"的说明书。** 上游 `find-skills/SKILL.md`（5,472 B）在 Step 6 指示模型执行 `npx skills add <repo> -g -y`：`-y` 跳过 CLI 自身确认、`-g` 装到 `~/.claude/skills`（**在 Realm 扫描范围之外**）、`npx` 在 npm 安装生命周期里执行任意代码且**完全在硬沙箱之外**。本仓具体后果：`npx` 当前**不在** `ai-bash-policy` 的 `DANGEROUS_INTERPRETERS` 中也不匹配任何 `DANGEROUS_PATTERNS` → 落"默认确认"档，用户只要把它加进白名单即**永久免确认**。**避免**：内置技能逐句审计改写（砍掉安装动词，只保留只读检索；把"安装"收敛到 Realm 自己的导入 UI）、禁止出现 `-y`/`--yes`/`-g`/`| sh`/`curl` 管道、**bash 策略补"包管理器安装"档**（`npx`/`npm i`/`pnpm add`/`pip install`/`brew install` 强制确认且白名单不可越过）、内置技能一律 `disable-model-invocation: true`。

2. **P2（S1，阻断门禁）——`resolveInside` 对"尚不存在"的写目标只做词法校验。** 源码 155-165 行在 `realpathSync` 抛 `ENOENT` 时直接 `return abs`——**只认词法校验**。本仓已用 `node -e` 实测复现：`skills/evil → symlink → <外部目录>`，`resolveInside(root, <root>/skills/evil/payload.md)` **返回非 null**（对照：已存在的越界文件正确返回 `null`），写入后文件落在工作区外。恶意 zip 只需一个 symlink entry + 一个 payload，即可写 `~/Library/LaunchAgents/*.plist`、`~/.zshrc`、`.git/hooks/`——**导入是用户主动点的，没有确认卡片兜底，攻击链一次交互完成**。**避免（三道自检缺一不可）**：① **拒绝整个压缩包**（不是跳过条目）——读 central directory 按 `(extAttr >> 16) & 0xF000 === 0xA000` 判 symlink + 解压后 `fs.lstatSync` 递归复核整棵树；② 解压到 `fs.mkdtempSync` 的全新空目录（保证前缀里不可能有预埋链接）；③ 落点复核用**最近已存在祖先的 realpath** 而非只靠 `resolveInside`。

3. **P3（S1，阻断门禁）——SKILL.md 的 `description` 无条件进 system prompt + 技能名可冒名顶替。** (a) `formatSkillsForSystemPrompt` 把所有非 disable 技能的 name/description/location 拼进**每次请求**的 system prompt——`escapeXml` **只做字符转义，不做内容审查**（这是防标签破坏，不是防提示注入）。用户导入一个技能，其 description 就进入了此后每一个会话，**无需模型"选择"它、无需用户调用**；相比之下 body 只在激活时注入，**description 的注入面远大于 body，而实现者通常只审 body**。(b) `validateName` 与目录名不一致时**只产 warning 不拒绝**，且 `name = frontmatterName || parentDirName`——于是 `skills/evil/SKILL.md` 里写 `name: find-skills` 完全合法，`<available_skills>` 里出现两个 `find-skills`，模型无法区分。**避免**：导入时扫描 description **和** body；**实测结论**——既有 `scanInjectionPatterns` 对两份内置技能全文与良性中英文样本**零误伤**（可直接复用），但**对"外发/凭据回显/绕过确认"三类全部放行**，必须新增技能域模式组（`SKILL_THREAT_PATTERNS`）；name 冲突策略显式化（与内置同名 → 拒绝导入；与已有用户技能同名 → 覆盖/改名/取消三选一，不静默覆盖）；两阶段导入预览（照抄 Phase 17 的 `preview`/`import` 模式）。

4. **P4（S1）——zip 路径类缺陷，且项目当前零 zip 运行时依赖。** 逐 entry 校验必须覆盖：绝对路径 / 盘符 / UNC、任何 `..` 段（`path.posix.normalize` 后判，不要 `includes('..')` 一刀切误伤 `a..b`）、反斜杠（统一规范成 `/` 再判）、NTFS ADS、控制字符、尾随空格与点、空 entry 名、**大小写冲突**（APFS 默认大小写不敏感）与 **Unicode NFC/NFD 冲突**（内存里对全量 entry 名做「NFD + 小写」归一化后查重，重复即拒绝整包）。两阶段落盘：`.tmp/skill-import-<rand>/` 解压 → 全树校验 → `renameSync` 原子移到 `skills/<name>/`，失败路径 `try/finally` 清理。

5. **P8（S2，阻断门禁）——技能缓存失效链断裂。** `buildSystemPrompt()` 是同步冻结快照，而 Agent 有**多处创建点**（`init()` 与 `_recreateAgent()`），源码注释已警示"漏一处即部分会话无记忆快照"。失效点共 5 个：两处创建点、`/` 面板列表、设置页导入/卸载、`manage_skill` 三个动作——**最阴的第 6 条是 bash/write 工具直接改 `skills/` 目录**（模型完全可以 `write skills/foo/SKILL.md`，沙箱允许），这条不经过任何 Realm 管理器、没有事件可挂钩。**避免**：权威技能集收敛到一个模块，`buildSystemPrompt()` 只调同步 `getSkillsSnapshot()`；`refreshSkills()` 的调用点清单写进代码注释与测试；**把"每次 Agent 重建都重扫一次"作为兜底**（自动覆盖第 6 条）；卸载必须真删目录（软删除在冻结快照架构下必然留下幽灵）；广播走 `windowManager.broadcast` 而非只刷当前窗口。

**其余中高优先级**：**P5**（技能名回落为父目录名 → 解压到临时目录产出 `tmp-x9f2` / `repo-main` 幽灵技能）、**P6**（`allowed-tools` 在 SDK 里**根本不存在**，UI 展示它 = 虚假安全感）、**P7**（资源耗尽：zip 炸弹 / SKILL.md 正文 SDK 无上限 / 目录递归无深度上限 / 技能数进每请求 prompt）、**P9**（SSRF：`isPrivateHost` 用 Node DNS 而实际请求走 `net.fetch`，**被校验的 IP ≠ 被连接的 IP**，DNS rebinding 残余风险必须写进威胁模型）、**P10**（许可证：`anthropics/skills` **无仓库级 LICENSE**，skill-creator 目录内才是 Apache-2.0，逐字打包有 §4 标注义务）、**P12**（`loadSkills` 全部失败都是 warning → 静默失败）。完整清单、恢复策略与"Looks Done But Isn't"检查表见 **PITFALLS.md**。

---

## Implications for Roadmap

基于依赖关系与安全门禁归属，建议 **6 个阶段**（Phase 46–51，`phase_naming: sequential`，v2.5 止于 Phase 45）。`granularity: coarse` 下若需更少阶段，**Phase 46+47 可合并、Phase 48+49 可合并**——但**不要让任何 S1 门禁跨阶段滑落**。

### Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入）
**Rationale:** 全部功能的不可逆前置。`read` 工具是模型读取技能正文的唯一通道且受 `resolveInside` 硬边界约束 → 技能不在工作区内则自动匹配**静默失效**（ARCHITECTURE.md Anti-Pattern 3）；同步/冻结快照机制一旦定型就难改（与 AI 记忆快照同型的架构决策）。
**Delivers:** `agent-workspace.js` 的 `getSkillsDir()`/`getManagedSkillsDir()` + `ensureWorkspaceDir()` 两行 mkdir；`ai-skills-manager.js` 的 `refreshSkills()`（唯一异步加载入口）/ `buildSkillsPrompt()`（同步纯读缓存）/ `resolveSkill()` / 去重 / 校验 / digest；`ai-manager.js` 四处接线（第 4 段 prompt、两处创建点刷新、`syncAgentSystemPrompt()`）；限额常量集中定义（`MAX_SKILL_MD_BYTES = 64KB`、`MAX_USER_SKILLS`、prompt 段字符预算）。
**Addresses:** 沙箱目录 + 加载接线、`<available_skills>` 注入、模型自动激活、用户 > managed 优先级、诊断透传（数据层）。
**Avoids:** **P8**（失效链，门禁）、**P7**（限额常量化）、**Anti-Pattern 1/2/3**。
**Gate:** 测试断言两个目录在沙箱内可达、两处创建点均含技能段、改磁盘后重建 Agent 即生效。

### Phase 47: 内置技能播种 + bash 策略加固
**Rationale:** 它定义"随包分发的**可信内容**"是什么，也是 P1 的门禁所在；若先做导入再做播种，会带着一个未审计的"可信"技能上线。PITFALLS 明确要求 bash 策略补充与播种**同阶段或紧随其后**，否则门禁形同虚设——故合并在本阶段。
**Delivers:** `skills-builtin/`（find-skills Realm 化改写版 + skill-creator 仅保留作者指南 + 各自 `LICENSE.txt`）+ `package.json` 加 `asarUnpack` + `app.isPackaged` 路径分支 + **按单技能目录粒度**的幂等播种（版本戳登记表，沿用 `migrateAiMemory` 先例）+ `ai-bash-policy.js` 新增"包管理器安装"档 + `THIRD_PARTY_NOTICES.md`（来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明）。
**Addresses:** 内置种子技能、`scripts/` 沙箱执行的安全前提。
**Avoids:** **P1（S1 门禁）**、**P10（发布门禁）**、**P6（不得在任何 UI/文档中暗示 `allowed-tools` 强制）**。
**Uses:** 无新增依赖（纯文本目录随 asar 分发）。
**⚠️ Research needed:** find-skills 改造方案是**产品决策**（保留只读检索 vs 彻底去 CLI 化），许可证文本需法务式复核。

### Phase 48: 技能发现与调用面（`/skill:name` + 面板 + 来源徽标）
**Rationale:** 依赖 Phase 46 产出的技能集；显式调用是发现机制的补集与用户测试技能的唯一手段。技能命令必须是**第二命令源**而非本地 handler。
**Delivers:** `state.skillCommands` + `skillToCommand`（`kind:'skill'` 判别）+ `loadSkillCommands` + `sendSkillInvocation`；`renderSlashPickerList` 双源合并 + 来源徽标；`promptWithContext` 加 `skillName` 参数 + `skillBlock` 组装（**消息块顺序：skillBlock → visionNotice → markerBlock → visionBlock → contextBlock**）；标题派生必须用**注入前的原始文本**；未知技能错误路径；`disable-model-invocation`（不进提示词但可显式调用）的 UI 打标。
**Addresses:** `/skill:name` 调用、`/` 面板并入技能列表、同名冲突可见、来源徽标。
**Avoids:** **Anti-Pattern 4**（混进 `SLASH_COMMANDS` → 拦截分支吞掉调用，"点了没反应"）、**Anti-Pattern 5**（renderer 重建优先级表）、**P3 的同名歧义**、**P8 的面板刷新与多窗口广播**。
**Research:** 不需要（`docs/plan/ai-slash-commands.md` 已有实现与调优记录）。

### Phase 49: `manage_skill` 工具（AI 自建技能）
**Rationale:** 依赖 Phase 46 的缓存刷新基础设施；**必须排在设置页与导入之前**——`manage_skill` 与导入必须共享**同一份** name/description/大小/注入校验，先做其他写入路径极易写出第二份校验（对比 "SSRF 防护收敛在 search-manager" 的判据漂移教训）。
**Delivers:** `_buildRealmTools()` 尾部注册（紧邻 `memory`/`memory_read`，`executionMode: 'sequential'`）；create/update/delete 后端；**工具不吃 path 参数**（只吃 name）；name 服务端双校验；`content`/`description` 大小上限；原子写（走 `env.renameFile` 以获得沙箱双路径校验）；managed 边界（按**播种登记表**拒绝覆盖/删除 seeded 技能，而非按目录位置）；成功后 `refreshSkills` + `syncAgentSystemPrompt()`；工具描述里写死「capture sparingly，优先增强已有技能而非造近乎重复的新技能」。
**Addresses:** `manage_skill` 工具、AI 自建技能。
**Avoids:** **P3（name 校验与冲突）**、**P7（正文上限）**、**P8（失效触发）**、**Anti-Pattern 1**。
**Decision needed:** 默认开（推荐，本里程碑核心差异化能力，风险已由 managed 边界 + 不碰用户技能 + 体积上限 + 名称遮蔽拒绝覆盖）vs oh-my-pi 的默认关。

### Phase 50: 设置页技能管理区 + `/api/skills/*`
**Rationale:** 依赖 Phase 49 的校验器（避免两份实现漂移）；也是 Phase 51 导入功能的 UI 承载面（诊断要在设置页可见）。
**Delivers:** `handleSkillsApi`（仿 `handleAiMemoryApi` 逐行模板）+ `/api/skills/{list,uninstall}`（`install` 留到 Phase 51）+ **逐端点 token 鉴权**（防 CSRF 与 localhost 端口扫描）+ `uninstall` 必须校验 `source === 'user'`（否则手改 URL 即可删内置技能）+ **`readJsonBody` 加体积上限（安全项，非优化项）** + 设置页 AI 分区新增「技能管理」`settings-group`（**初始隐藏必须走 CSS 类，禁止 markup 内联 display**）+ `skillsApi()` fetch 封装 + 列表/启停/删除 + 诊断展示 + 来源徽标 + `skills:changed` 跨窗口广播。
**Addresses:** 设置页技能管理区、单技能 enable/disable（存储键 `settings.aiSkills.disabled`，**加载后过滤而非删文件**）、诊断可见、技能删除。
**Avoids:** **P8（失效链与多窗口广播）**、**P12（静默失败）**、webview guest 误用 realmAPI（Phase 17/38 两次事故）。
**Research:** 不需要（handler 模板逐行可抄）。

### Phase 51: 用户技能导入管线（zip + 网络地址）
**Rationale:** 排在最后是**刻意的风险隔离**：它是唯一需要新依赖、唯一处理二进制、唯一吃不可信归档包的环节，安全面最大而耦合最小。
**Delivers:** `POST /api/skills/install`（zip 文件选择 + URL）；**导入三阶段**：落 `.tmp/skill-import-<rand>/`（`mkdtempSync` 全新空目录）→ 全树校验（P2 三道自检 + P4 路径规则 + P7 限额）→ `renameSync` 原子移动；**symlink entry 拒绝整包**（central directory 属性判定 + 解压后递归 `lstat` 复核）；逐 entry 路径校验（`..` / 绝对路径 / 盘符 / 反斜杠 / ADS / 控制字符 / NFC-NFD + 大小写查重）；**限额**（单 entry 1MB、累计 32MB、entry 数 2000、压缩比 100:1、嵌套深度 8，**先读 central directory 的 `uncompressedSize` 预检**再边解边累加）；**威胁扫描**（description + body 都扫，复用 `scanInjectionPatterns` + 新增 `SKILL_THREAT_PATTERNS`）；**两阶段预览**（展示 name/description 原文、目录树、字节数、脚本清单标红、扫描结论）；URL 分流（codeload zipball / raw 直链 / contents 列一层）+ **主机白名单** + https-only + 逐跳 `isPrivateHost` 校验 + 流式字节上限 + magic bytes 校验 + **zipball 顶层 `<repo>-<ref>/` 前缀剥离** + 技能目录定位（URL 显式子路径 → `skills/<name>/` → 仓库根含 `SKILL.md` → `/contents/` 列一层）；**落盘后回读验证** + diagnostics 原文回传。
**Addresses:** zip 导入、URL 导入（GitHub 仓库/目录/SKILL.md 直链分流）。
**Avoids:** **P2（S1 门禁）**、**P4（S1 门禁）**、**P5（S2 门禁）**、**P9（S2 门禁）**、**P3（扫描）**、**P7（限额）**、**P12（可见性）**、**Anti-Pattern 7**（误用 `search-manager.fetchUrl`——它会把 `text/html` 转 Markdown 并丢掉 frontmatter 原始形态，对 zip 二进制是破坏性的；复用 `isPrivateHost` + 逐跳重定向校验的**同一套判据**，新写二进制/裸文本 fetcher）。
**⚠️ Research needed:** zip 库选型需一次真实打包/解压验证（yauzl vs node-stream-zip）；GitHub 仓库/目录导入的分流语义需产品定义（多技能包、限流提示）。

### Phase Ordering Rationale

1. **46 → 47 是不可逆依赖**：SDK 的 `<location>` 指向 + 模型 `read` 需求决定了技能必须在沙箱内；先把目录与打包路径钉死，后续所有验证才有意义。
2. **48 与 49 都是 46 的并行分支**（显式调用与 AI 自建互不依赖），可独立成 phase 并行，但都依赖 46 产出的"缓存刷新"基础设施。
3. **50 排在 49 之后是为了防校验逻辑漂移**：`manage_skill` 与 zip 导入必须走**同一份** name/description/大小/注入校验。
4. **51 排最后**：安全面最大、耦合最小，隔离在最后，风险不外溢。
5. **bash 策略加固必须在 47**（与播种同阶段）：否则 P1 门禁形同虚设——改写了技能文本却留着"`npx` 可被白名单免确认"的缺口。
6. **文档同步不是独立阶段**：按 AGENTS.md 的强制维护约定（导航入口清单 / `ai-agent-workspace.md` 同款），`docs/product/ai-skills.md`、`docs/product/ai-agent-workspace.md`、`AGENTS.md` 的更新**随各阶段完成**，不回填到最后。

### Research Flags

**Needs deeper research during planning:**
- **Phase 47（内置技能播种）** — find-skills 改造方案需产品决策（保留只读检索 vs 彻底去 CLI 化）；Apache-2.0 / MIT 许可证文本需法务式复核；改写的每一行都要按"这段文字被模型执行后会做什么"逐句评审。
- **Phase 51（用户技能导入）** — zip 库选型需**一次真实的打包 + 解压 + 恶意样本验证**（本摘要已裁决 yauzl，但仍需实测确认 yauzl 的 API 形态与错误处理面）；GitHub 三种 URL 形态的分流语义从未发过真实网络请求验证；多技能包语义需产品定义。

**Standard patterns（可跳过 research-phase）:**
- **Phase 46** — SDK 技能层源码已逐行核对，接线模式有 AI 记忆快照先例（`ai-memory-manager.js:355-403`）。
- **Phase 48** — 斜杠命令面板已有实现与调优记录（`docs/plan/ai-slash-commands.md`）。
- **Phase 49** — 照抄 `ai-memory-manager` 的校验 + 原子写 + "业务校验失败由 manager throw"先例。
- **Phase 50** — `handleAiMemoryApi`（`main.js:2647-2700`）是逐行可抄的 handler 模板。

---

## Open Decisions（requirements / roadmap 必须拍板）

| # | 决策点 | 选项 | 推荐 | 影响阶段 |
|---|--------|------|------|----------|
| **O1** | **find-skills 去 CLI 化程度** | ① 保留只读检索（`npx skills find`）砍掉安装动词；② 彻底去 CLI 化，引导模型输出候选清单 + 用户设置页一键导入 | **②（更彻底）** 或 ① —— 但**无论如何**必须消除 `-y`/`-g`/`npx` 安装语义。判定标准：内置技能文本里不得出现任何"执行外部安装"的动词 | 47 |
| **O2** | **多技能 zip 语义** | ① 包内必须恰好一个技能根（0 个或多个 → 报错）；② 列出全部 `SKILL.md` 让用户勾选；③ 只支持单技能 | **① v1**，并在 UI 写明；多技能选择留 v1.x | 51 |
| **O3** | **`allowed-tools` 范围** | ① 不解析不展示；② 解析但标注"当前运行时不被强制，仅供参考"；③ 在工具执行层做按技能的能力门 | **②**（默认不展示，若为兼容解析则必须加免责标注）；**③ 明确写进 Out of Scope**，别留暗示。绝不能让 UI 制造"该技能只能用这些工具"的虚假安全感 | 47 / 51 |
| **O4** | **seeded 技能升级策略** | "内容 hash 判定未修改才覆盖" vs "版本戳 + 提供恢复内置技能按钮" vs "永不再播种" | **版本戳登记表 + 未修改才覆盖 + 绝不静默覆盖用户修改**；判定依据需在 plan 期细化（播种时记录 hash？） | 47 / v1.x |
| **O5** | **frontmatter 是否显式解析（决定 `yaml` 是否升为直接依赖）** | ① 只走 `loadSkills` 往返（零新增依赖，但无法区分"frontmatter 缺 name"与"name 恰等于目录名"）；② 显式 `require('yaml')` 做严格校验（须提升为 `dependencies`，否则换 pnpm / `--install-strategy=nested` 立刻 `MODULE_NOT_FOUND`） | **① 为主**（往返 + 结构性检测：解压到随机名目录后若解析出的 name 等于该随机名 → 必为缺 name）；**仅当要求"name 字段必须显式存在"的硬语义时**才加 ②，且必须与 SDK 同版本 `2.9.0` 避免双实例 | 51 |
| **O6** | **`managed-skills/` 中 AI 自建技能的可删性边界** | "AI 自建 managed 可改可删" vs "只允许写 user 目录" | 前者（AI 自主创建是里程碑目标），但 seeded 内置技能必须受保护；判定依据是**播种登记表**，不是目录位置 | 49 |
| **O7** | **技能数量上限与 prompt 预算** | 硬上限（如 100）vs 仅软预算 | `MAX_USER_SKILLS`（如 50）+ prompt 段字符预算（如 8000 字符）+ 超限时优先保留 user 来源与 `disableModelInvocation !== true` 的技能，并在 prompt 末尾加"因预算省略 N 个技能，可用 find-skills 查找"（让内置技能有自洽用途） | 46 / 50 |
| **O8** | **`/compact` 是否保留技能正文** | 保留（对齐 Claude Code 的 5000/25000 token 预算）vs 不保留 | **v1 不保留，记入已知限制**（现有压缩管线是自研的，改造成本中等；技能正文可在压缩后由模型重读文件恢复） | 46 或明确 defer |
| **O9** | **既有沙箱的 ENOENT symlink 缺口是否顺带加固** | 只修导入路径 vs 同时加固 `writeFile` 的 `guard(p)` | P2 门禁**至少**覆盖导入路径；**建议同时把既有沙箱写路径加固列为可选附属项**——同一根因，一次修完（但注意写路径的触发者是被提示注入的模型，还需过一次 `ln` 的默认确认档，故严重度低于导入） | 51（附属） |
| **O10** | **内置技能是否默认 `disable-model-invocation: true`** | 是 vs 否 | **是**（PITFALLS P1 建议）：把"是否激活"决定权留给用户显式 `/skill:`，同时避免内置技能名与描述无条件占据每个请求的 system prompt | 47 |
| **O11** | **超限导入行为 / 卸载是否删除目录内相对引用资源** | — | 到顶时导入被拒绝并给出可操作提示（先卸载）；卸载整体删除目录（含 `references/` `assets/` `scripts/`）；**超限报错文案必须说明"是哪个限额、当前值是多少"** | 50 / 51 |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **HIGH** | 依赖事实全部经 npm registry 查询（`npm view` + `api.npmjs.org`）+ 本地 `node_modules` 实读 + 网络端点 `curl` 实测核验；三份 CVE 经 Red Hat / OpenCVE / GHSA / OSV / Snyk 交叉核对。唯一残留分歧（yauzl vs fflate）已在本摘要裁决并说明依据 |
| **Features** | **HIGH**（范围与语义）/ **MEDIUM**（实现成本） | 基线来自四份一手来源：Agent Skills 开放规范、Claude Code 官方文档、oh-my-pi 参考实现（源码/文档级）、**pi-agent-core 0.84.3 源码逐行核对（最高权威）**。Realm 侧的实现成本评估是基于现有代码结构的工程判断 |
| **Architecture** | **HIGH**（接线点）/ **MEDIUM**（新能力空白） | `agent-workspace.js` / `ai-manager.js` / `renderer.js` / `main.js` 接线点全部直读并附行号锚点；`agent.state` 可变性经 `dist/agent.js` 三处交叉验证。**zip 解包方案**与 **GitHub URL 分流细节**为 MEDIUM（后者未发真实网络请求验证） |
| **Pitfalls** | **HIGH** | SDK 技能层源码逐行核对 + 本仓 6 个模块实读 + **本地可执行验证**（`resolveInside` symlink 逃逸实测复现、`scanInjectionPatterns` 对内置技能零误伤 / 对三类技能域攻击放行的语料实测）。仅 `npx skills` CLI 行为细节为 LOW，**且 P1 论证不依赖该细节**（依赖的是 `-y`/`-g`/`npx` 在 SKILL.md 中字面存在这一来自上游原文的事实） |

**Overall confidence:** **HIGH**

### Gaps to Address

- **zip 库选型在两份研究间存在分歧（yauzl vs fflate）** — 已裁决为 `yauzl@^3.4.0`（依据 STACK.md 的 CVE 差异化核验）。plan 期仍需**一次真实的打包 + 解压 + 恶意样本（zip-slip / symlink / 炸弹）验证**，确认 yauzl 的 Promise API 形态与四处错误处理面（callback err / promise rejection / `ZipFile.error` / read stream error）都已覆盖。
- **`yaml` / `ignore` 的依赖归属** — 目前是 pi-agent-core 的传递依赖，靠 npm 扁平化"恰好"可用。**只要 Realm 自己不 `require` 它们就跑得通**；一旦直接 require（例如为严格校验 frontmatter name）就必须提升为 `dependencies`。这是 O5 的直接后果，plan 期必须一并决定。
- **GitHub zipball / contents API 的具体路径语义未发网络请求验证** — `codeload` 直连与顶层前缀剥离已 curl 实测（3.98 MB / 512 条目 / 唯一顶层 `skills-main`），但"列一层让用户挑技能"的 `contents` 分支与 403/429 处理未验证，需在 Phase 51 plan 期确认。
- **`npx skills` CLI 行为细节未实测**（LOW，单源 web 搜索）——`-g` 具体落在哪个目录、是否有环境变量可覆盖。**实施前必须实测确认**，但不构成 P1 论证的依据。
- **产品级开放决策 11 项**（见上方 Open Decisions 表）——O1/O2/O3/O4/O5 会直接改变对应阶段的实现范围与依赖清单，建议在 requirements 阶段一次性拍板，避免各阶段各自决定导致语义分裂。
- **技能数量上限 / 字符预算的具体数值** — 研究给出了参考区间（`MAX_SKILL_MD_BYTES = 64KB` 对齐 oh-my-pi；`MAX_USER_SKILLS` ≈ 50；prompt 段 8000 字符），最终值需结合 Realm 的实际用量与 `getContextUsage()` 观感在 plan 期定。
- **`/compact` 与技能正文的关系**（O8）— 若确定为"v1 不保留"，必须写进 `docs/product/ai-skills.md` 的已知限制，否则会被当成 bug。

---

## Sources

### Primary（HIGH confidence — 本仓与服务端源码直读、本地实测）

- **pi-agent-core 0.84.3 源码逐行核对**：`dist/harness/skills.js`（`loadSkills` / `loadSourcedSkills` / `loadSkillFromFile` / `validateName` 仅 warning / `name = frontmatterName || parentDirName` / `MAX_NAME_LENGTH=64` / `MAX_DESCRIPTION_LENGTH=1024` / 递归遍历与 `includeRootFiles` 行为 / 诊断 code 全集）、`dist/harness/system-prompt.js`（`formatSkillsForSystemPrompt` 原文、`escapeXml` 只做字符转义、`disableModelInvocation` 过滤、空态返回 `''`）、`dist/harness/types.d.ts:28-39`（`Skill` **无 `allowedTools`**）、`dist/agent.js`（`get state()` 返回 `_state`、`createContextSnapshot` 每轮重读）、`dist/index.js:15` + `package.json` exports map（仅 4 入口，skill API 从包根可达）
- **本仓源码**：`agent-workspace.js`（`resolveInside:136-166` 含 **ENOENT 分支只做词法校验**、`createSandboxEnv:179-350`、`ensureWorkspaceDir:96-100`、`migrateAiMemory:108-119`、`exec` 只校验 cwd）、`ai-manager.js`（`buildSystemPrompt:561-564` 同步冻结快照 + G-42-4 注释、两处 `new Agent`、`promptWithContext:1038-1223`、`_buildRealmTools:5292-5420`）、`ai-memory-manager.js`（`scanInjectionPatterns` / `CREDENTIAL_PATTERNS` / `buildGlobalSnapshot:355-403`）、`ai-attachments-manager.js`（symlink 拒绝、`copyDirectory`、`DENIED_HOME_PREFIXES` 未导出）、`ai-bash-policy.js`（`DANGEROUS_PATTERNS` / `DANGEROUS_INTERPRETERS` **不含 npx/npm**）、`search-manager.js`（`isPrivateHost` / `fetchUrl` 逐跳校验 / `MAX_REDIRECTS=5`）、`main.js`（`readJsonBody:885-897` **无大小上限** / `handleAiMemoryApi:2647-2700` handler 模板 / token 鉴权 / 书签导入 `preview`-`import` 两阶段先例）、`src/renderer.js`（`SLASH_COMMANDS:334-337` / 斜杠拦截 `:8673-8689` / `renderSlashPickerList:9900-9951`）、`src/settings.html` + `settings-page.js`（CSP 注释 / `aiMemoryApi:162-186` / `whitelist-tag` 先例）
- **本地可执行验证（本次实测）**：`resolveInside` 对"父目录为 symlink 的不存在路径"返回非 null（P2 复现）；`scanInjectionPatterns` 对 skill-creator（33,168 B）与 find-skills 全文返回 `safe:true`（零误伤），对 4 类经典注入 BLOCK，对"外发/凭据回显/绕过确认"3 类**放行**（P3 覆盖缺口）
- **npm registry 实测（2026-09-10，`npm view` + `api.npmjs.org`）**：`yauzl@3.4.0`（2026-06-07，109,901 B，唯一依赖 `pend@1.2.0` 且 pend 零依赖，27,060,107 次/周，MIT，纯 JS）、`node-stream-zip@1.16.0`、`extract-zip@2.0.1`（2020-06-10）、`adm-zip@0.6.0`、`unzipper@0.12.5`、`jszip@3.10.2`（`MIT OR GPL-3.0-or-later`）、`fflate@0.8.3`、`yaml@2.9.0`、`ignore@7.0.9`、`chokidar@4.0.3`/`5.0.0`
- **GitHub 端点实测（2026-09-10，`curl -D -`）**：`api.github.com/repos/anthropics/skills` → `x-ratelimit-limit: 60`；`codeload.github.com/anthropics/skills/zip/refs/heads/main` → **无任何 `x-ratelimit-*` 头**，3,984,611 B / 512 条目 / 唯一顶层前缀 `skills-main`；`raw.githubusercontent.com` → **无 `x-ratelimit-*` 头**；`anthropics/skills/skills/` → 19 个技能目录含 `skill-creator`；`vercel-labs/skills/skills/` → 含 `find-skills`（仓库根为 CLI 项目）
- **项目文档**：`.planning/PROJECT.md`（v2.6 里程碑目标与 target features、D-04 系统提示词冻结、Key Decisions 全表）、`AGENTS.md`（环境差异/asarUnpack/原生模块发布规则、CSP、弹框、guest 无 realmAPI、导航入口维护约定）、`docs/product/ai-agent-workspace.md`、`docs/plan/{ai-file-bash-tools-integration,ai-memory-system,ai-slash-commands}.md`
- **本机技能副本实测**：`/Users/wxnacy/.codebuddy/skills/skill-creator/`（5 目录 15 文件含 8 个 `.py`）；CodeBuddy 变体 `find-skills/SKILL.md`

### Secondary（MEDIUM confidence — 官方规范 / 官方文档 / 安全公告，多源交叉验证）

- **Agent Skills 开放规范** — https://agentskills.io/specification（目录结构、frontmatter 字段表与约束、`allowed-tools` 标注 Experimental、渐进式披露三层与 token 预算、`skills-ref validate`；2025-12-18 成为跨平台开放标准）
- **Claude Code Docs — Skills** — https://code.claude.com/docs/en/skills（frontmatter 超集字段表、1536 字符截断、`skillOverrides` 四态、发现位置与优先级表、`` !`cmd` `` 动态注入、`context: fork`、压缩 5000/25000 token 预算、claude.ai/Skills API 允许字段硬校验报错原文、"undertrigger" 现象与 pushy description 建议）
- **Anthropic Engineering** — *Equipping agents for the real world with Agent Skills*（2025-10-16）
- **安全公告**：CVE-2026-56876（`extract-zip` symlink 未校验，CVSS 8.1，Red Hat 明确"无补丁、维护者失联、建议停用"）、CVE-2026-76845 / GHSA-vwc7-r8mq-g2x9（`adm-zip` 0.5.9~0.6.0 全部受影响）、CVE-2018-1002204 / SNYK-JS-ADMZIP-1065796、CVE-2026-17514（`unzipper` ≤0.12.3）、GHSA-928X-9MPW-8H56（解压炸弹限额缺失成因）、Snyk zip-slip-vulnerability
- **yauzl README**（`validateFileName` 自动执行条件、`validateEntrySizes` 作为 zip bomb 安全特性、`getFileNameLowLevel()` 绕过警告、`decodeStrings:false` 关闭自动校验、`fromBufferPromise` 强制 `lazyEntries:true`、"How to Avoid Crashing" 四处错误处理要求）
- **node-stream-zip README + 源码**（`validateName` 正则、`skipEntryNameValidation`、`extract()` 用 `fs.open(outPath,'w')`、无 `path.resolve` 包含性复核）
- **GitHub Docs — Rate limits for the REST API**（apiVersion 2026-03-10：未认证 60/hr 按 IP、PAT 5,000/hr、超限 403/429、次级限流 `retry-after`、"继续在被限流时发请求可能导致集成被封禁"）
- **oh-my-pi 参考实现**（`docs/skills.md` / `docs/tools/manage_skill.md` / `src/prompts/system/autolearn-*.md`：技能对象形状、非递归布局、7 层 provider priority、名称与 realpath 去重 + collision warning、`hide` ≠ 禁用、`manage_skill` 完整规格含 64000 B 体积上限与"managed skills ONLY writable skills. NEVER edit user-authored skills."）
- **间接提示注入 / 工具投毒**：Microsoft "Protecting against indirect prompt injection attacks in MCP"、OWASP Prompt Injection
- **来源仓库事实（GitHub API 核对 2026-09-10）**：`vercel-labs/skills` MIT（`skills/find-skills/` 仅 `SKILL.md` 5,472 B）；`anthropics/skills` **无仓库级 LICENSE**、`skills/skill-creator/LICENSE.txt` = Apache-2.0（11,345 B）、目录 15 文件 / 8 个 `.py`
- **chokidar**（paulmillr）— v5 ESM-only 且 Node ≥20；v4 依赖 13→1 并移除 bundled fsevents

### Tertiary（LOW confidence — 单源 web 搜索，未交叉验证，**不作为决策依据，仅作线索**）

- `npx skills` CLI 行为细节（`-g` 具体落在哪个目录、是否有环境变量可覆盖）——**实施前必须实测确认**；本摘要的 P1 论证不依赖该细节
- 各语言生态"技能市场"的攻击案例数量级——不构成风险结论
- 经 GSD research seam 路由至 `websearch` provider 的 6 条 digest（`classify-confidence --provider websearch` = LOW，`--verified` = MEDIUM）——**全部已用 npm registry / 本地源码 / `curl` 实测或权威公告交叉核对**，故最终置信度按核对后来源标注

---

*Research synthesized: 2026-09-10*
*Source files: `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md`*
*Ready for roadmap: yes*
