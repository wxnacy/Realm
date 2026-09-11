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

## 七、测试与验证

- 单元测试：`node tests/test-ai-skills.js`（加载管线 / 诊断 / 限额 / 启停 / prompt 注入 / Agent 回写 / P8 机制断言）
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
| 包管理器安装表 | **网络取第三方代码**（安装/执行任意包） | `install` |

两者同为 `riskLevel: high` 的强制确认，**加入白名单也无效**。

**覆盖的包管理器家族**：`npx`；`npm i` / `install` / `ci` / `exec` / `add`；`pnpm` / `yarn` /
`bun` 的 `add` / `dlx` / `install` / `exec` / `x` / `i`；`pip` / `pip3 install`；
`python` / `python3 -m pip install`；`uv` / `uvx`；`brew install` / `upgrade` / `reinstall`；
`cargo` / `go` / `gem install`。

- **白名单不可越过安装档**：`settings.aiBashWhitelist` 里就算写了 `npm *` / `npx` / `brew *`，
  这些安装命令**仍然弹确认卡片** —— 免确认的粒度是「可信的构建类命令」，不是「可信的包管理器」。
- **`riskLevel: high` 与专属文案**：确认卡片的标题是「AI 请求安装第三方软件包」并点名命中的
  家族，与危险命令卡片的「AI 请求执行高危 Bash 命令」区分开 —— 让用户一眼看出风险类型。
- **只读子命令不在表内**（照旧走普通确认或白名单）：`npm run` / `test` / `ls` / `view` /
  `audit` / `outdated` / `init` / `--version`、`pnpm run` / `ls`、`yarn run`、`brew info` /
  `list` / `search`、`pip list` / `show`、`cargo search`、`go list` 等 —— 它们不取新代码。
- **`npm ci` 也在安装档内**：`npm ci` 虽不解析新版本（只按 lockfile 装），但会**执行所有依赖的
  `postinstall` 脚本** —— 那实质是任意代码执行，因此同样强制确认。表内其它 `install` 系命令同理。
- **技能脚本执行的确认成本**：内置技能的脚本入口是 `node` / `python3`，两者都在危险解释器表内
  → **每次跑技能脚本都会弹确认卡片**。这是「技能不构成额外权限机制」的必然结果，是设计而非缺陷。
- **残余风险（诚实声明）**：安装档只审**一级 bash 命令**。取值旗标形态与命令替换/变量间接构造
  不被完全检测；`echo "npm install"` 这类字面量会误报（只多一次确认）。**漏检 ≠ 免确认** ——
  未被识别的形态仍会退化成普通确认卡片，不会免确认。详见
  [ai-agent-workspace.md](ai-agent-workspace.md) 第七节第 5 条。
