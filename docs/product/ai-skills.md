# AI 助手技能（Skill）（产品说明）

> **维护约定（重要）**：本文档是 AI 助手技能功能（技能目录 / 加载语义 / system prompt
> 注入 / 优先级与遮蔽 / 三条限额 / 启用禁用 / 诊断透传 / 沙箱边界）的**产品说明权威文档**。
> 以后修改技能相关行为（加载语义、优先级与遮蔽、诊断透传、限额数值与单位、启停语义、
> 沙箱边界、prompt 段位置）**必须同步更新本文档**，让产品说明与实际行为保持一致。
>
> 另：**修改 `skills-builtin/**`（随包内置技能）时必须同步核对 `THIRD_PARTY_NOTICES.md`
> 的五要素（来源仓库 / 固定 SHA / 许可证 / 是否修改 / 修改说明）并重跑零安装语义扫描** ——
> 随包内容变更而不更新归属声明就是潜在的许可证违约；扫描命令见第七节。
>
> 沙箱与 agent 工作区目录的权威说明见 [ai-agent-workspace.md](ai-agent-workspace.md)
> （其「agent 工作区目录模型」小节与本文档互为引用）；聊天附件见
> [ai-chat-attachments.md](ai-chat-attachments.md)。实现数据源为 `ai-skills-manager.js`。

> **诊断数据形状（供下游阶段只依赖这一处）**：诊断位于**缓存条目的 diagnostics**
> （`getSkillsSnapshot().skills[i].diagnostics`），**不在 `Skill` 对象上** —— `Skill` 本体
> 保持 SDK 五字段形状，仅 `name` 按目录名重写。
>
> 两级分工（照实测，**勿按直觉推断**）：
>
> | 容器 | 承载什么 | 当前取值 |
> |------|---------|---------|
> | 条目级 `skills[i].diagnostics[]` | 只承载「该条目**仍然存在**」的诊断 | `realm_name_rewritten`、`realm_shadowed`，以及 SDK 侧与该文件相关的告警透传 |
> | 模块级 `_cache.diagnostics` | **全集**：条目级之外，还含「条目已被丢弃 / 未被注入」的诊断 | 上述两者 + `realm_layout_violation`、`realm_skill_md_too_large`、`realm_user_skill_limit_exceeded`、`realm_prompt_budget_exceeded`、`realm_root_entry_skipped` |
> | 模块级 `_cache.errors` | 无对应技能的整批 / 环境级失败 | `realm_refresh_failed`、`realm_skills_dir_missing` |
>
> 注意：布局违规与超限类诊断**没有存活条目可挂**（违约条目已被丢弃、超限条目根本不带诊断），
> 因此**只在模块级可见**。要拿全量诊断读 `_cache.diagnostics`；要拿「某个存活技能的诊断」
> 读条目 `diagnostics[]`。

## 一、能力

技能是**按需加载的指令包**：一份带 frontmatter 的 `SKILL.md`，描述「在什么任务下该怎么做」。

- 模型在每一轮请求中只看到每个技能的 **name / description / location**（绝对路径）三项元数据 —— 这是**渐进式披露**设计：让模型知道「有这个技能、它能干什么、正文在哪」，而不必把全部正文塞进上下文。
- 技能**正文不进 system prompt**。模型只有在任务命中 description 后，才通过 `read` 工具按需打开 `location` 指向的 `SKILL.md` 读取正文；技能自带的 `references/` `scripts/` `assets/` 等资源同样按需读取。
- 因此：技能数量增长带来的是**元数据**成本（受限额约束，见第四节），不是正文成本。

## 二、双目录

技能从两个目录加载，启动时自动创建（位于 AI 硬沙箱 root 内）：

| 目录 | `source` | 用途 |
|------|----------|------|
| `agent-workspace/skills/` | `user` | 用户自己的技能，优先级最高 |
| `agent-workspace/managed-skills/` | `managed` | 内置播种与 AI 自建的技能，被同名 user 技能遮蔽 |

**契约布局**：`<目录>/<技能名>/SKILL.md` —— 相对扫描根**恰为一层目录**。

- **不能有中间层目录**：`skills/a/b/SKILL.md` 不会被加载（会有诊断说明正确位置应该是 `skills/b/SKILL.md`）。
- **扫描根下的散落 `*.md` 不会被加载**：技能必须放在自己的目录里；根层放一个 `SKILL.md` 不会「顶替」整组技能，也不会把散落的 `README.md` 变成技能。
- 技能目录只能由工作区根派生（`getWorkspaceDir()`），保证 `<location>` 指向的绝对路径能被 `read` 工具打开。

## 三、优先级

- **同名遮蔽**：两目录存在同名技能时，`user` 来源胜出，`managed` 来源被遮蔽。被遮蔽的条目**仍然保留**在技能集内（带遮蔽标记与诊断），只是**不进 system prompt** —— 用户能看到来源冲突的真实形态，而不是技能「凭空消失」。
- **名称以目录名为权威**：frontmatter 里的 `name` 与所在目录名不一致时，**按目录名生效**并产诊断。这既杜绝了「把技能放进 `skills/evil/` 却在 frontmatter 里声明 `name: find-skills` 来冒名顶替」的情况，又不会丢弃命名不规范的合法技能（从 GitHub 导入时很常见）。
- **顺序确定**：技能段内的条目顺序由确定性全序决定（user 来源优先 → 可自动激活优先 → 名称字典序），跨机器一致 —— 顺序变化会改变请求的字节序列、让模型侧的前缀缓存命中率不可预测。

## 四、限额

三条限额集中定义在 `ai-skills-manager.js` 的 `LIMITS` 一处（端点与前端零字面量），单位不同、互不换算：

| 常量 | 值 | 单位 | 生效位置与行为 |
|------|----|------|----------------|
| `MAX_SKILL_MD_BYTES` | 64 KiB | **字节**（`FileInfo.size`） | 单个 `SKILL.md` 正文字节上限。超限在 **YAML 解析之前**被拒绝（不读盘、不解析），避免超大畸形文件拖慢主进程 |
| `MAX_USER_SKILLS` | 50 | 个（`user` 来源条目数） | 用户技能条目上限。超出的条目标记为超限、**不进 system prompt**，但**不删除**（用户可在设置里看到并卸载） |
| `SKILLS_PROMPT_CHAR_BUDGET` | 8000 | **字符**（JS `string.length`） | system prompt 中技能段的**整段**预算（含 SDK 前言与包裹的固定开销）。超预算时按上述全序贪心保留预算内条数，其余省略 |

- 任何一条限额触发时，对应诊断都带 **`limit`**（哪个限额）与 **`currentValue`**（当前值）两个数值字段 —— 提示是可操作的，不是「加载失败」。
- prompt 段超预算时，技能段的**闭合标签之外**会追加一行省略提示（`Note: N of M skills omitted …`）；未截断时该行完全不出现。截断永不静默。
- 限额数值是否匹配真实用量属开放决策 **O7**；需要调整时只改 `LIMITS` 一处。

## 五、沙箱边界

- 技能目录位于 AI **硬沙箱 root 内**，与 `read` / `write` / `edit` / `bash` 及其它工作区路径**同一套路径判据**：<location> 能被 `read` 打开，正是因为它落在沙箱 root 内。
- **技能不构成额外权限**，也不会绕过 bash 的三档权限（白名单 → 默认确认 → 危险强制确认）与确认卡片。技能正文里写的任何「请执行某某命令」都要走同一套 bash 策略。
- 技能段的变更在**修改之后的下一次请求**生效；对**正在进行中**的那一轮请求不生效（变更不打断当前轮）。若变更到达时 AI 正忙，会先记下、空闲后自动补上，不会丢失。
- 技能的 `description` 会进入**每一次请求**的 system prompt（只做字符转义、**不做内容审查**）→ **不要导入来源不明的技能**；技能正文则只在被 `read` 或显式调用时进入对话。

## 六、已知限制

- **`allowed-tools` 在当前 SDK 不存在该字段**：`@earendil-works/pi-agent-core@0.84.3` 的 `Skill` 接口只有五个字段（`name` / `description` / `content` / `filePath` / `disableModelInvocation`），**没有工具授权字段**。当前运行时也**不强制**任何「按技能授权工具集」的语义 —— 任何展示 `allowed-tools` 的地方都是虚假安全感，不要在技能文本里依赖它。
- **「AI 不可删改内置技能」是工具层不变式，不是沙箱不变式**：沙箱只有一个 root，模型在技术上可以直接写入 `managed-skills/`。该约束由管理工具的判定承担（与 bash 的「白名单是启发式、不是安全边界」同款哲学），**不要**用只读挂载或第二个 sandbox root 去表达它。
- **`/compact` 不保留技能正文**：对话压缩后模型需要重新 `read` 才能看到正文。这是预期行为，不是 bug。
- **同名技能共享启用 / 禁用状态**：禁用键是技能名、不区分来源 —— 先禁用 `managed` 的 `foo`、之后新增的 `user` 的 `foo` 也会随之禁用。
- **深嵌套与根层散落文件不会被加载**：`<目录>/a/b/SKILL.md` 与扫描根下的散落 `*.md` 都会被跳过（会有诊断说明正确布局）。
- **技能正文上限按字节、prompt 段预算按字符**：两条独立限额、互不换算，见第四节。
- **本基础设施阶段尚未提供技能集的变更入口**：技能段「变更 → 下一次请求即生效」的机制与跨窗口通知已就绪，但实际变更入口（技能面板、设置页的启用/禁用与卸载、AI 自建技能、导入）在后续阶段陆续提供。当前管理技能的方式是**直接操作两个技能目录下的文件**。
- **`REALM_SKILL_CREATOR_PYTHON` 的授权语义**：该环境变量由**用户自己设置**，用于指定 skill-creator 的环境预检探针（`scripts/check_env.mjs`）该用哪个 Python 解释器。它只做形态校验（非空字符串），**不校验路径合法性** —— **设置它等于授权 Realm 执行该路径的程序**，请只指向你自己信任的解释器。
- **技能文件改动后需重开对话才反映到已注入的历史消息**：`/skill:name` 的正文在**调用那一刻**从磁盘读取（见第十节「实时读盘口径」），注入之后它就是一条普通历史消息、跨轮保留、**不重读**。因此改了技能文件后，**已发出的那条消息**不会跟着变 —— 重新调用一次或重开对话即可看到新正文。
- **`allowed-tools` 仍不展示、仍不被运行时强制**：本阶段的来源徽标只表达**来源分类**（用户 / 内置 / 托管），与授权无关；该字段的解析与展示属后续阶段（O3 未变），即便将来展示也**必须带**「当前运行时不被强制、仅供参考」的免责标注 —— 见本节第 1 条的既有口径与 [ai-agent-workspace.md](ai-agent-workspace.md) 第七节第 6 条。
- **极端 Unicode 文件名下 `read` 卡片可能不被识别为技能读取**：常见于 NFD 规范化 / 窄空格 / 弯引号变体。**仅影响卡片标题**（显示为普通 `read` 卡片），**不影响正文读取** —— 技能正文照常被 `read` 打开。

## 七、测试与验证

- 单元测试：`node tests/test-ai-skills.js`（加载管线 / 诊断 / 限额 / 启停 / prompt 注入 / Agent 回写 / P8 机制断言；覆盖已扩到**显式调用解析与实时读盘 / 面板投影收窄 / 三档 tier / `promptOmitted` / `read` 卡片标记 / 重载装饰**）
- 面板纯逻辑：`node --test tests/test-skill-picker-model.js`（解析与 args 取值 / 过滤两档 / 展平与可选中性 / 导航取模 / 三条接线扫描）
- 内置技能播种：`node tests/test-builtin-skills-seeder.js`（随包源解析 / 自愈式播种 / 差异诊断 / 零安装语义扫描 / 上游快照与归属门禁）
- 回归：`node tests/test-agent-workspace.js`（沙箱与工作区目录）
- 端到端（人工）：`npm run dev` → 确认两个技能目录已创建 → 问 AI「你有哪些技能」应答出 name / description → 问一个命中 description 的任务，观察是否调 `read` 打开 `location` → 直接编辑 `agent-workspace/skills/<x>/SKILL.md` 后切换对话，下一条消息应反映改动
- 打包态（人工，**不可用 `npm run dev` 替代**）：`make install-nightly` 后启动 .app，确认 `Contents/Resources/app.asar.unpacked/skills-builtin/` 与 `~/Library/Application Support/realm-nightly/agent-workspace/managed-skills/` 下两个内置技能都在

## 八、内置技能

Realm 随包分发两个内置技能，启动时自动播种进 `agent-workspace/managed-skills/`（`source: managed`）：

| 技能 | 内容来源 | 许可证 | 说明 |
|------|---------|--------|------|
| `find-skills` | Realm 改写版（**零安装语义**） | MIT | 只输出技能候选清单，把安装入口留给设置页 |
| `skill-creator` | 上游固定 SHA 快照（受控改写） | Apache-2.0 | 创建/评测技能的完整工作流 + Realm 自研的环境预检探针 |

两者的来源仓库、固定 SHA、许可证、是否修改与修改说明逐项记录在仓库根的
**`THIRD_PARTY_NOTICES.md`** —— 它是归属声明的权威载体，随包分发。

**播种语义（自愈式，每次启动）**：

- **粒度是单个技能目录**：每次启动按技能逐目录同步，**无条件覆盖** `managed-skills/<name>/`，
  不为「该技能已存在」提前返回 —— 否则日后新增的内置技能永不播种。
  **精度补充：内容一致时跳过重建** —— `detectDiff` 判为 `same`（相对路径集合、文件大小、
  sha256 三层全部相同）时**不写盘、不产诊断**，目标目录与其文件 inode 保持不变；
  只有**缺失**（`missing`）或**内容不一致**（`different`）时才写盘。因此稳定态的每次启动
  不会反复重建技能目录，也不会刷出「已覆盖」诊断。
- **崩溃残留自愈**：播种进入逐技能循环**之前**，先清扫 `managed-skills/` 下形如
  `<name>.tmp_<时间戳>` / `<name>.bak_<时间戳>` 的残留目录。原子替换（tmp → rename → bak 回滚）
  刻意让这些兄弟目录与目标**同父目录**以保证同卷，因此它们**落在技能扫描根内** ——
  上一轮崩溃 / 被杀留下的残留若不清扫，会被当成技能加载（永久幽灵技能 + 多条诊断）。
- **播种诊断有 console 兜底**：`getSeedDiagnostics()` 目前**没有生产消费方**
  （Phase 50 接入技能面板之前），因此播种结束会把本轮累积的诊断按级别经
  `console.error` / `console.warn` 输出 —— 保证「一个都没播种成功」在**正式版**里也可见，
  而不是静默无声。
- **覆盖前先产诊断，不静默**：若目标目录内容与随包版本有差异（按相对路径集合 → 大小 →
  sha256 逐层判内容，**不用时间戳**），先产 `realm_builtin_seed_overwritten`（`warning` 级）
  诊断**再**覆盖。诊断可见但不阻断覆盖。
- **手删会自愈重播**：删掉 `managed-skills/<name>/` 后下次启动自动恢复（该路径不产覆盖诊断，
  属「缺失」而非「差异」）。

**「哪些是内置技能」的身份来源**：扫随包 `skills-builtin/` 的**目录名集合** ——
**不是**状态文件、**也不是**「它在 `managed-skills/` 里」。AI 自建技能同样落在
`managed-skills/`，靠目录位置无法区分来源。

**两条正确通道（内置技能不能删改，只能禁用/遮蔽）**：

- **停用**：设置页禁用（`settings.aiSkills.disabled`）。**手工删掉文件无效** —— 下次启动
  自愈重播。
- **定制**：把随包技能复制成 `agent-workspace/skills/<同名目录>/`（用户目录），
  靠**同名遮蔽**（`user` 胜出）生效。直接改 `managed-skills/` 里的文件会在下次启动被覆盖。

**零安装语义**：`find-skills` 只经 `web_fetch` / `web_search` 检索候选仓库并输出清单，
**不调用任何包管理器、不发起任何安装**；真正的安装入口在设置页。该约束有机器可检的
静态扫描器兜底（见 `tests/test-builtin-skills-seeder.js`）。

**skill-creator 的 Python 脚本是可选路径**：先跑 `node scripts/check_env.mjs` 拿到能力清单
（哪些依赖/解释器可用）；不满足时探针会给出可操作指引而**绝不自动安装**。

## 九、bash 包管理器安装档

**包管理器安装档是「强制确认」档（第三档）的第二个触发源**，与危险命令表**语义分离**：

| 触发源 | 语义 | `reason` |
|--------|------|----------|
| 危险命令表 | **本机破坏**（删文件、改系统、提权） | `danger` |
| 包管理器安装档 | **网络取第三方代码**（安装/执行任意包） | `install` |

两者同为 `riskLevel: high` 的强制确认，**加入白名单也无效**。

**覆盖的包管理器家族**（**首 token 默认拒绝**）：`npx`；`bunx`；`npm`；`pnpm`；`yarn`；`bun`；
`pip` / `pip3`；`pipx`；`uv` / `uvx`；`brew`；`cargo`；`go`；`gem`。判定规则是
**默认拒绝** —— 首 token 命中上述工具集时，**只有该工具的显式只读子命令**会降级，
**其余子命令一律强制确认**（不依赖子命令黑名单的枚举完整性）。匹配前会做一次
**词法归一化**（去引号 + 去反斜杠转义），因此 `brew "install" wget` / `brew \install wget` /
`brew ins""tall wget` 与 `brew install wget` 判定相同。

- **白名单不可越过安装档**：`settings.aiBashWhitelist` 里就算写了 `npm *` / `npx` / `brew *`，
  这些安装命令**仍然弹确认卡片** —— 免确认的粒度是「可信的构建类命令」，不是「可信的包管理器」。
  **机制**：安装档判定**短路先于**白名单匹配（install 于 `matchesWhitelist` 之前返回），
  所以「白名单命中」不再蕴含「免确认」。**可自证**：把裸 `brew` 加进白名单后，
  `brew install wget` **与** `brew "install" wget` 都仍然弹卡片。
  ⚠ **该承诺对「常规子命令」成立，但有**三类**具名残余**（`npm -g update` 这类「旗标 + 未知子命令」、
  `npm audit --json fix` 这类「`audit` 与 `fix` 之间夹旗标」、以及 `npm -g update ls` 这类
  「旗标取值与子命令不可区分」会被判只读 → 白名单命中时零卡片）——
  逐条见本节末尾的「残余风险」段 (a)(b)(c)。本句不得读作绝对保证。
- **`riskLevel: high` 与专属文案**：确认卡片的标题是「AI 请求安装第三方软件包」并点名命中的
  家族，与危险命令卡片的「AI 请求执行高危 Bash 命令」区分开 —— 让用户一眼看出风险类型。
- **显式只读清单**（清单内走普通确认或白名单；**清单之外一律强制确认**）。以下即**全部**只读词条，
  与代码 `PACKAGE_MANAGER_TOOLS` 的 `readOnly` 字段（单一来源）一致：
  `npx` / `bunx` / `uvx` 为空（包执行器无只读形态）；`pipx` 为 `list`；
  `npm` 为 `run` · `test` · `start` · `stop` · `restart` · `run-script` · `ls` · `list` · `view` ·
  `audit` · `init` · `outdated` · `help` · `root` · `ping` · `doctor` · `fund` · `version` · `whoami` ·
  `dedupe` · `prune` · `completion` · `search` · `docs` · `repo` · `bugs` · `explain` · `why` · `bin` · `prefix`；
  `pnpm` 为 `run` · `test` · `ls` · `list` · `why` · `outdated` · `audit` · `licenses` · `root` · `bin` ·
  `doctor` · `help` · `version`；`yarn` 为 `run` · `test` · `ls` · `list` · `why` · `info` · `outdated` ·
  `audit` · `licenses` · `bin` · `root` · `help` · `version`；`bun` 为 `run` · `test` · `ls` · `list` ·
  `help` · `version` · `why` · `outdated` · `audit`；`pip` / `pip3` 为 `list` · `show` · `freeze` ·
  `check` · `help` · `version` · `debug`；`uv` 为 `tree` · `lock` · `export` · `version` · `help` ·
  `init` · `cache` · `list` · `show` · `freeze` · `check` · `inspect` · `debug`（外加复合形态
  `uv pip <list|tree|show|freeze|check|inspect|debug>`）；`brew` 为 `info` · `list` · `search` ·
  `config` · `doctor` · `outdated` · `deps` · `uses` · `home` · `desc` · `cat` · `help` · `version`；
  `cargo` 为 `search` · `tree` · `metadata` · `version` · `help` · `locate-project`；`go` 为 `list` ·
  `env` · `version` · `doc` · `help`；`gem` 为 `list` · `search` · `info` · `environment` · `help` · `version`。
  **`pipx list`** 与 `pip list` / `brew list` 同族（只列出已装的隔离应用，不取新代码、不执行第三方
  代码）—— 它的可达前提是纵深层的 pipx 条目**动词限定**，故 `pipx list` 是只读、`pipx install black`
  属安装档。
- **只读清单的三处限定（必须逐条为真，否则即为虚假保证）**：
  1. **形态限定的词条**：`npm init` 只在**不带位置参数**时只读（`npm init` / `npm init -y` /
     `npm init --yes`）；`npm init <initializer>` 等价于 `npx create-<initializer>`，会**联网
     下载并执行第三方代码**，属安装档。`npm` / `pnpm` 的 `audit` 只在**不含 `fix` 形态**时只读
     （`npm audit` / `npm audit --json` / `pnpm audit`）；`npm audit fix` / `npm audit --fix` /
     `pnpm audit --fix` 会安装修复版本，属安装档。
  2. **生命周期的同族别名**：`npm start` / `stop` / `restart` / `run-script` 与 `npm run` /
     `test` **同族**（跑项目自身定义的脚本）→ 只读。
  3. **纵深优先**：只读判定前**先跑安装模式表**，命中即强制确认 —— 因此 `npm -g install list`
     （= `npm install list`）与 `brew --quiet install info`（= `brew install info`）这类
     「旗标 + 安装动词 + 只读同名词」的真实安装命令**仍属安装档**，不会被只读清单吞掉。
- **`npm ci` 也在安装档内**：`npm ci` 虽不解析新版本（只按 lockfile 装），但会**执行所有依赖的
  `postinstall` 脚本** —— 那实质是任意代码执行，因此同样强制确认。档内其它 `install` 系命令同理。
- **技能脚本执行的确认成本**：内置技能的脚本入口是 `node` / `python3`，两者都在危险解释器表内
  → **每次跑技能脚本都会弹确认卡片**。这是「技能不构成额外权限机制」的必然结果，是设计而非缺陷。
- **残余风险（诚实声明，带前提）**：安装档只审**一级 bash 命令**。**「漏检 ≠ 免确认」成立，
  但要带前提**：由默认拒绝规则消除的是「子命令词法改写」「中间 token `brew cask install`」
  「未收录子命令 `npm update`」这三类**首 token 是包管理器的改写形态**；**剩余漏检类别不止一条**——
  「首 token 不是包管理器」（如变量间接 `NPM=npm $NPM i x`）这类命令不以包管理器开头，
  **天然不命中白名单前缀**，仍退化为**普通确认卡片**，不会免确认；但另有**三类会因白名单前缀命中
  而零卡片**，必须逐条告知。`echo "npm install"` 这类字面量仍会误报（只多一次确认，方向安全）。
  **五条具名残余**：
  (a) **（零卡片 · 高优先）旗标取值槽吞掉末尾子命令** —— 裸形式只读正则的旗标容忍片段能把**唯一**
  末尾 token 吞成「旗标取值」，于是 `npm -g update` / `npm -q update` / `npm --prefix=./app update` /
  `npm --global rebuild` 这类**真实联网安装命令**被判只读，白名单含裸 `npm` 时**零卡片**（实测
  `npm -g update` @ `['npm']` → `allow`；对照 `npm update -g` 仍正确判安装档，差异只在旗标位置）。
  (b) **（零卡片）`audit` 与 `fix` 之间夹旗标** —— `audit` 守卫的负向先行断言不跨越中间旗标，
  `npm audit --json fix` / `pnpm audit --registry=x fix` 被判只读，而 npm 实际会执行 fix 安装。
  (c) **（零卡片）旗标取值与子命令在词法上不可区分** —— 既有行为要求 `pnpm --filter a run build`
  判只读（`a` 是 `--filter` 的取值），同一机制使 `npm -g <未知动词> <只读同名词>`
  （如 `npm -g update ls`）仍判只读；它**同样命中白名单前缀**（`matchesWhitelist('npm -g update ls',
  ['npm']) === true`），故裸 `npm` 在白名单里时与 (a)(b) 一样是**零卡片**（实测 @ `['npm']` →
  `allow`）。已用**纵深优先**把可识别面压到最小；与 (a) 同属「**旗标取值槽**」这一条结构性成因
  （(b) 的成因不同：`audit` 守卫的负向先行断言只看向后**紧邻**位置、不跨越中间旗标 —— 实测
  `npm --json audit fix` 仍正确判安装档，而 `npm audit --json fix` 判只读）。
  (d) **大小写形态**（`NPM i x` / `RM -rf x`）不命中包管理器工具集与危险命令表 → 降级为
  **普通确认卡片**而非高风险卡片（风险等级标注的残余，**不是免确认**）。
  (e) **`pnpm` / `yarn` / `bun` 的同类别名（`start` / `stop` / `restart`）未收录** ——
  各 CLI 的别名语义未逐一核验，按「存疑一律不收」处理 → `pnpm start` / `yarn start` / `bun start`
  落强制确认档，卡片文案「将从网络下载并运行第三方代码」对这族命令**不准确**；这是**已接受的
  保守误报**（方向安全：多一次卡片）。
  > 残余 (a)(b)（零卡片类）由代码审查在 gap-closure 复审中具名记录（
  > [47-REVIEW.md](../../.planning/phases/47-bash/47-REVIEW.md) 的 CR-01 / CR-02）；本阶段选择
  > **只修文档面**、把代码洞留作技术债 —— 因此这两条必须如实写明，不得省略。详见
  > [ai-agent-workspace.md](ai-agent-workspace.md) 第七节第 5 条。

## 十、发现与调用

技能有两个入口：**用户显式调用**（`/` 面板或手打语法）与**模型自动匹配**（凭 `description` 自行
`read` 正文）。两者的权威行为如下。

**实现落点**：面板规则与语法在 `src/skill-picker-model.js` —— renderer（`window.SkillPickerModel`）
与主进程（`require`）取**同一个 api 对象引用**，解析规则只此一份；技能集投影与 `read` 标记判定
在主进程侧（`ai-skills-manager.js` / `ai-manager.js`）。

### 10.1 面板形态（输入 `/` 触发）

- 输入框以 `/` 起始即打开面板（既有语义，本阶段**零变化**）。
- **两个 sticky 分区**：「技能」在上、「命令」在下。分组标题吸顶（`position: sticky`）；
  某分区命中 0 项时该标题**整个不输出**。
- **过滤**：取 `/` 后、首个空白前的 token 小写后 —— 技能侧 **name 前缀命中排前**、
  **description 子串命中兜底排后**（两档内各自保持主进程给定的确定性顺序）；命令侧
  `startsWith` 语义与相对顺序**不变**。描述命中**不做高亮**。
- **`/skill:xxx` 作为过滤 token**：`skill:` 前缀被剥离后使用 —— 等价于「只显示技能（按 `xxx` 过滤）」。
- **行五要素**（从左到右）：① `/{name}` 标识名 ② 来源徽标（三档，见 10.5）③ `仅显式` 标记
  （仅 `disable-model-invocation` 的技能）④ 单行截断描述 ⑤ 行尾状态标注。
- 面板**不显示**体积 / 文件数 / 诊断计数 —— 那些属于设置页（Phase 50）。
- 行尾状态标注四条定长文案：`已遮蔽 · 由用户同名技能胜出`、`与本地命令同名 · 本地命令优先`、
  `未进提示词 · 超预算`、`超数量上限`。

### 10.2 两种调用语法与优先级

- **`/skill:name [args]` 与裸 `/name [args]` 都识别**；技能名须匹配 `^[a-z0-9-]+$`
  （与「目录名权威」「SDK 名称校验字符集」同款）。
- **本地命令优先**：技能与本地命令（`clear` / `compact`）同名时，裸 `/name` 走**本地命令**；
  `/skill:name` 无歧义，仍走技能。面板里该技能行**灰显不可选中**并标
  `与本地命令同名 · 本地命令优先`（行**仍渲染**，不静默隐藏 —— 违反「禁止静默失败」的既有约定）。
- **边界语义是「严格前缀 + 空白边界」**：`/foo` 命中技能 `foo`、`/foo bar` 命中并带 args `bar`，
  而 `/foobar` **不**命中 `foo`（`foobar` 是另一个名字）。token 以某本地命令名开头但不构成
  严格边界时（`/foobar` 对命令 `foo`）判为**歧义** → 走「未知命令」提示路径，不静默误判为命令。
- **`args` 取值是「token 之后的全部剩余文本」** —— 不按已知名字长度切分。因此
  `/skill:find 帮我找 X` 的 args 是 `帮我找 X`（不会吞掉开头）。

### 10.3 实时读盘口径（用户明确要求）

**`/skill:name` 的正文在「调用那一刻」从磁盘读取** —— **不**依赖 system prompt 的冻结快照、
**不**沿用对话历史里的旧回答。

注入之后它就成为一条**普通历史消息**：跨轮保留、**不再重读**。因此：

- 技能文件改动后，**已发出的那条消息**不会跟着变 —— 重新调用一次或**重开对话**即可看到新正文
  （见第六节的对应条目）。
- 这与「每次请求都重读全部正文」是**两件事**：每一轮请求只携带技能的 name / description / location
  三项元数据（第一节的渐进式披露）。

### 10.4 边界技能行为表

| 技能状态 | 面板是否显示 | 能否选中 | 能否显式调用 | 是否进提示词 |
|---------|-------------|---------|-------------|-------------|
| 正常 | 显示 | ✅ | ✅（`/skill:` 与裸名均可） | ✅ |
| 仅显式调用（`disable-model-invocation`） | 显示 + `仅显式` 标记 | ✅ | ✅ | ❌ |
| 已禁用 | **不显示** | — | ❌（system-note「技能「foo」已被禁用，可在 设置 → AI → 技能管理 重新启用」） | ❌ |
| 被遮蔽（同名用户技能胜出） | 显示 + 灰显 + `已遮蔽 · 由用户同名技能胜出` | ❌ | ✅ —— 按名字查找必然命中胜出的那个技能 | ❌ |
| 与本地命令同名 | 显示 + 灰显 + `与本地命令同名 · 本地命令优先` | ❌ | ✅ 仅 `/skill:name`；裸 `/name` 走本地命令 | 视预算 |
| 超数量上限 | 显示 + `超数量上限` | ✅ | ✅ | ❌ |
| 未进提示词 · 超预算 | 显示 + `未进提示词 · 超预算` | ✅ | ✅ | ❌ |
| 不存在 / 被跳过 | 不显示 | — | ❌（`/skill:foo` →「未找到技能「foo」，输入 / 查看可用技能」；裸 `/foo` →「未知命令 /foo，输入 / 查看可用技能与命令」） | — |

**两条必须分清的易混语义**：

- **`disable-model-invocation` 与「已禁用」是两个互不蕴含的 flag**：前者只影响「是否进提示词 /
  模型能否自动匹配」，**显式调用仍可**、面板打 `仅显式`；后者两个入口都拒、面板**不显示**。
  任何把两者合成一个开关的实现都是错的。
- **「被遮蔽」只影响面板路径**：手打时按技能名查找必然命中胜出的那个技能，因此「灰显不可选中」
  **不会**给手打路径产生「已遮蔽」的错误分支。
- 导航语义：↑↓ 落在**可选中行**上（被遮蔽 / 与本地命令同名的行**跳过**）；若过滤结果全部不可选中，
  则 `activeIndex` 归 `-1`，Enter 回落到「未知命令」提示路径。

### 10.5 三档来源徽标

| 档 | 含义 | 判定 |
|----|------|------|
| 用户 | `agent-workspace/skills/` 下的技能 | `source === 'user'` |
| 内置 | 随包 `skills-builtin/` 播种来的技能（见第八节） | `source === 'managed'` **且**名字属于「扫随包目录」得到的名字集合 |
| 托管 | AI 自建的技能（`agent-workspace/managed-skills/`） | `source === 'managed'` **且非内置** |

- 判定是**扫随包目录名集合** —— **零状态文件、零硬编码**。AI 自建技能与内置技能同落
  `managed-skills/`，靠目录位置**无法**区分来源。
- 面板行与 `read` 工具卡片**共用同一张查表**：`src/skill-picker-model.js` 的 `TIER_BADGE`
  （取 `label` / `className` / `title`），不存在第二份徽标实现。表外 / 缺失档位 → 渲染时**跳过**徽标。
- 徽标只表达**来源分类**，与授权无关（`allowed-tools` 仍不展示、仍不被运行时强制，见第六节）。

### 10.6 `read` 卡片技能化

模型**仅凭 `description` 自动匹配**技能、并经 `read` 打开其 `SKILL.md` 时：

- 工具卡片标题变为 **`使用技能「name」`** 并带与面板同款的来源徽标。
- **参数区照旧显示实际读取的路径** —— 用户可核对模型到底打开了哪个文件。
- **不额外插提示条 / system-note**：与卡片已有信息重复。
- **重开对话后**，同一条工具卡片按**同一判据**重建标记（实时链路与重载链路共用同一实现，
  产出的对象形状逐字一致）；技能被删除 / 改名 → 静默退化为普通 `read` 卡片，且**不丢消息**。
- **判定只在主进程**（工具事件生成侧）：renderer 不掌握技能目录的权威路径，零路径字符串匹配。
- **可靠性边界**：极端 Unicode 文件名（NFD 规范化 / 窄空格 / 弯引号变体）下标记可能不命中 ——
  **后果仅是显示为普通 `read` 卡片**，技能正文仍被正常读取。

### 10.7 诚实边界

- **面板刷新链路**：打开面板时用主进程的**同步快照**立即渲染（**不**显示骨架屏 / spinner /
  「加载中」占位），随后在后台触发「重扫 → 回写 prompt → 广播」，完成后原地重渲染；广播
  （`skills:changed`）到达时**仅在面板打开时**重拉快照并原地重渲染。**刷新失败保留现有快照**
  （stale-while-revalidate 语义），面板内**不出现任何错误 UI** —— 错误走主进程诊断面（Phase 50 才展示）。
- **AI 未初始化时该链路早退**（没有 Agent 就没有可用的读盘环境）→ 面板显示**上一次投影**。
- **P8 门禁的准确进度**：本阶段让「变更 → 下一次请求即生效」的回写链路**有了生产调用方**
  （打开面板触发重扫 + 回写），但它是「**重扫 + 回写**」语义，**不是「写成功后回写」语义** ——
  技能集的**实际写入入口**仍归设置页（Phase 50）与 AI 自建技能（Phase 49），见第六节的既有条目。
- **`disable-model-invocation` 技能的可见性**：面板打 `仅显式`、该技能**不进提示词**，
  但 `/skill:name` 仍可调用（这是该 flag 的正面要求，不是缺陷）。
