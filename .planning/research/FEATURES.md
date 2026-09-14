# Feature Research: Realm Browser AI 助手技能（Skill）能力

**Domain:** Agent Skills（Agent 技能系统）— Electron 桌面浏览器内置 AI 助手
**Researched:** 2026-09-10
**Confidence:** HIGH（结论基线以一手规范与源码为主；其中经由 Web 检索获得的说法均已与官方文档/源码交叉核对，按 `classify-confidence --verified` 归为 MEDIUM，不作为唯一依据）

> 结论基线来自四份一手来源：① Agent Skills 开放规范（agentskills.io/specification，2025-12-18 成为跨平台开放标准）；② Claude Code 官方 Skills 文档（code.claude.com/docs/en/skills）；③ oh-my-pi 参考实现（`docs/skills.md`、`docs/tools/manage_skill.md`、`src/prompts/system/autolearn-guidance.md`）；④ **pi-agent-core 0.84.3 源码**（`dist/harness/skills.js`、`dist/harness/system-prompt.js` 逐行核对）。第 ④ 项是 Realm 的真实契约——它比规范窄得多，所有复杂度评估以此为准。四个关键问题的原始出处见文末 `Sources`。

---

## 0. 先决结论（Roadmap 前必读）

1. **SDK 已经提供了本功能最贵的三块**：`loadSkills` / `loadSourcedSkills`（扫描 + frontmatter 解析 + 名称/描述校验 + .gitignore 忽略）、`formatSkillsForSystemPrompt`（`<available_skills>` 注入）、`formatSkillInvocation`（`<skill>` 块注入）。Realm 不需要自己写扫描器或 XML 生成器。**"接入 skill 发现与调用"本身的成本是 LOW，不是 MEDIUM。**
2. **但 SDK 只做"读取与格式化"，不做"写入与安全"**。市场/导入/AI 自建这三块全部要 Realm 自己实现：zip 解压、网络来源分流、原子写、managed 边界、名称遮蔽、路径逃逸防护。**真正的复杂度在这三块，不在发现。**
3. **两个内定内置技能不能原样 vendor**。本机现有的 `find-skills`（CodeBuddy 变体）硬编码 `~/.workbuddy/skills`、`~/.codebuddy/skills`、`npx clawhub`、SkillHub（lightmake.site），`skill-creator` 依赖 subagent + Python + 浏览器 + `claude -p` CLI——**两者在 Realm 沙箱里都会指向错误目录并教模型发起沙箱外 bash 命令**。必须 Realm 化改写（见 §6、§7 反特性）。
4. **系统提示词冻结语义与"导入即生效"直接冲突**。Realm 的 D-04 冻结语义（`buildSystemPrompt` 在 Agent 创建时一次性拼入，保前缀缓存）意味着技能列表在会话内不可变；导入/新建技能后必须显式重建 Agent（`_recreateAgent()`）才可见。这是 Roadmap 必须拍板的行为决策，不是实现细节。
5. **`read` 工具是技能正文的唯一读取通道**——pi-agent-core **没有 `skill://` 协议解析器**（oh-my-pi 有，是它自己实现的）。因此技能目录必须落在 `agent-workspace/` 沙箱根内，否则模型拿到 `location` 也读不到。**`agent-workspace.js` 增加 `skills/` + `managed-skills/` 是全部功能的前置依赖，必须排在第一个阶段。**

---

## 1. Skill 是什么：规范 vs Realm 运行时现实

### 1.1 开放规范（agentskills.io）— 权威契约

一个技能 = 一个目录，至少含 `SKILL.md`：

```
skill-name/
├── SKILL.md          # 必需：frontmatter（元数据）+ Markdown（指令）
├── scripts/          # 可选：可执行代码（被执行，不载入上下文）
├── references/       # 可选：按需载入的文档
├── assets/           # 可选：模板 / 图片 / 数据文件
└── ...               # 任意其他文件或目录
```

**Frontmatter 字段表（规范原文约束）：**

| 字段 | 必需 | 约束 |
|------|------|------|
| `name` | **YES** | 1–64 字符；仅小写字母 `a-z`、数字 `0-9`、连字符 `-`；不得以 `-` 开头/结尾；不得含连续 `--`；**必须与父目录名一致** |
| `description` | **YES** | 1–1024 字符，非空；须同时描述「做什么」和「何时使用」，含便于匹配的关键词 |
| `license` | no | 许可证名，或指向目录内 license 文件的引用 |
| `compatibility` | no | 1–500 字符；环境要求（目标产品、系统包、网络访问等）。规范明确「多数技能不需要此字段」 |
| `metadata` | no | 任意 string→string 映射；客户端自用（如 author / version） |
| `allowed-tools` | no | 空格分隔的预授权工具串（如 `Bash(git:*) Read`）。**规范标注为 Experimental，"support may vary between agent implementations"** |

**渐进式披露三层（规范原文）**：

| 层 | 内容 | 加载时机 | 预算 |
|----|------|---------|------|
| L1 Metadata | `name` + `description` | 启动时对**所有**技能预加载 | ~100 tokens |
| L2 Instructions | `SKILL.md` 正文 | 技能被激活时全量载入 | 建议 < 5000 tokens / < 500 行 |
| L3 Resources | `scripts/` `references/` `assets/` | 按需导航发现 | 实质上无上限 |

规范要点：文件引用用相对技能根的路径、**保持一层深**（避免深链）；脚本「被执行而非被读入上下文」；用 `skills-ref validate ./my-skill` 校验。

### 1.2 Claude Code 的扩展（超集，非规范）

Claude Code 在规范之上加了一批字段，全部可选，**只有 `description` 是"推荐"**：

| 字段 | 作用 |
|------|------|
| `when_to_use` | 追加上下文（触发短语、示例请求），与 description 合并后在技能列表中**截断于 1536 字符** |
| `argument-hint` | 自动补全时显示的参数提示（`[issue-number]`） |
| `arguments` | 命名位置参数，供 `$name` 替换 |
| `disable-model-invocation` | `true` → 阻止模型自动加载；描述不出现在上下文中；仅用户 `/name` 可触发 |
| `user-invocable` | `false` → 从 `/` 菜单隐藏，输入 `/name` 也不运行（纯背景知识） |
| `allowed-tools` / `disallowed-tools` | 调用轮次内免确认授权 / 移除工具；**用户发下一条消息时授权清除** |
| `model` / `effort` | 覆盖模型与推理档位（仅本轮剩余时间） |
| `context: fork` + `agent` + `background` | 在 fork 出的 subagent 上下文中隔离运行 |
| `hooks` / `paths` / `shell` | 注册 hooks / glob 限定自动激活 / 指定注入命令的 shell |

**关键：Claude Code 对"打包/上传到 claude.ai 或 Skills API"的场景会硬拒绝非规范字段**：

```
Unexpected key(s) in SKILL.md frontmatter: argument-hint.
Allowed properties are: allowed-tools, compatibility, description, license, metadata, name
```

→ 对 Realm 的含义：如果 Realm 要能与 skills.sh / anthropics 生态互操作，**读入时接受超集、写出（AI 生成）时只写规范子集**是正确策略。Realm 的 `manage_skill` 生成固定 frontmatter（对齐 oh-my-pi 的 `name` + `description`）天然满足这一点。

Claude Code 的调用语义补充：

- 正文作为**单条消息**进入对话并跨轮保留；权限例外（`allowed-tools`）在下一条用户消息时清除；**不会在后续轮次重读技能文件**；重复调用相同渲染内容 → 只加一条"已加载"提示而非重复内容。
- 自动压缩时把已调用技能带入 token 预算，重新附加每个技能**最近一次**调用的**前 5000 tokens**，所有技能共享 **25000 tokens** 组合预算。

### 1.3 pi-agent-core 0.84.3 实际实现 —— Realm 的真实契约

`loadSkills(env, dirs)` 返回 `{ skills, diagnostics }`。单个 Skill 对象形状：

```js
{ name, description, content, filePath, disableModelInvocation }
// content = 剥掉 frontmatter 后的正文
```

**实际解析/校验行为（与规范的差异，逐条对照源码）：**

| 项 | 规范要求 | pi-agent-core 实际行为 |
|----|---------|----------------------|
| `name` | 必需 | **可省略** → 回落为父目录名（`frontmatterName \|\| parentDirName`） |
| `name` 违规 | 校验失败 | **只产出 warning 诊断，技能照常加载**（`validateName` 的错误 push 进 diagnostics 后不 return） |
| `description` | 必需 | 必需。空/缺失 → **技能被丢弃**（返回 `skill: null`） |
| `description` 超 1024 | 违规 | **warning 诊断，仍加载** |
| `license` / `compatibility` / `metadata` / `allowed-tools` | 规范定义 | **完全不解析、不存储、不生效**（`formatSkillsForSystemPrompt` 只输出 name/description/location） |
| `disable-model-invocation` | — | 唯一被读取的扩展字段 → `disableModelInvocation`（kebab-case 规范化） |
| 目录深度 | 一层推荐 | **递归扫描**（`<root>/group/<skill>/SKILL.md` 能被发现，与 oh-my-pi 的非递归相反） |
| 忽略文件 | 未定义 | 支持 `.gitignore` / `.ignore` / `.fdignore`，带 root 前缀重写，支持 `!` 取反 |
| 根目录散落 `.md` | 未定义 | 顶层 root 传入 `includeRootFiles: true` → **顶层任意带 description 的 `.md` 会被当成技能**（name 取 frontmatter，或回落为 root 目录名如 `skills`，同时产出「name 与父目录不一致」warning）⚠️ |
| 解析失败 | — | 声明式 `SKILL.md` 解析失败 → 丢弃 + `parse_failed` 诊断；非声明的散落 md 解析失败 → 静默跳过 |
| 缺失目录 | — | 静默跳过（`not_found` 不产诊断） |
| 符号链接 | — | `resolveKind` 会 canonicalPath 解析；`fileInfo` 报 symlink 时会跟随解析 |
| 诊断等级 | — | 全部是 `type: "warning"`，**没有 error 级、没有"拒绝加载"通道** |

**诊断 code 全集**：`file_info_failed` / `list_failed` / `read_failed` / `parse_failed` / `invalid_metadata`。

→ **对 Realm 的含义**：SDK 的校验是"尽力而为的宽容模式"。Realm 若要在导入时对用户给出"这个技能有问题"的明确反馈，**必须在导入路径上自己再跑一遍严格校验**（对齐规范的名字规则 + 必填 description），不能只依赖 `diagnostics`。而"名称与目录不一致"这类问题在 SDK 里只是 warning，技能照常以目录名或 frontmatter 名生效——这是一个**导入同名冲突的隐性来源**。

### 1.4 oh-my-pi 的做法（项目已引用的参考实现）

- 技能对象含 `name` / `description` / `filePath` / `baseDir` / source 元数据（provider、level、path）。
- **建议非递归**（`<skills-root>/<name>/SKILL.md` 一层），嵌套目录不被 provider loader 发现。
- 额外 frontmatter：`globs`、`alwaysApply`、`hide`、`disableModelInvocation`（`hide` 的规范化形式）。
- 「能力提供者按 priority-first 排序，再按注册顺序」：`native(100)` > `omp-plugins(90)` > `claude(80)` > `claude-plugins/agents/codex(70)` > `opencode(55)` > `github(30)` > `omp-managed(5)`；**去重键是技能名，首个胜出**。
- 除名称去重外还**按 `realpath` 去重同一文件**（symlink 安全），并对后续同名冲突**发出 collision warning**。
- `hide: true` **不等于禁用**——仍然加载，仍可通过 `skill://name` 和 `/skill:name` 触达，只是不出现在系统提示词列表里。
- 自建技能（managed）**排在最后**，因此任何同名作者技能始终优先。

---

## 2. 发现（Discovery）：模型怎么知道技能存在

生态里只有两种机制，**Realm 应该两种都用**：

**机制 A — 系统提示词列表（规范与 SDK 的标准做法，必须做）**

`formatSkillsForSystemPrompt(skills)` 产出的完整文本（源码逐字）：

```
The following skills provide specialized instructions for specific tasks.
Read the full skill file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.

<available_skills>
  <skill>
    <name>pdf-processing</name>
    <description>Extract PDF text, fill forms...</description>
    <location>/path/to/agent-workspace/skills/pdf-processing/SKILL.md</location>
  </skill>
</available_skills>
```

注意三点：

- **只注入 L1 元数据**（name + description + location），不注入正文 → 天然实现渐进式披露第一层。
- 函数会**过滤掉 `disableModelInvocation: true` 的技能**；全部被过滤时返回空串（`''`），调用方应判空避免 prompt 里出现空段。
- 提示词里**显式告诉模型"自己去读那个文件"**，并说明相对路径按技能目录解析 → **这直接决定了 Realm 必须把技能放进沙箱**（模型读得到才谈得上激活）。

**机制 B — 工具注册（可选，Realm v1 不必做）**

Claude Code 用一个内部的 `Skill` 工具暴露技能，并用权限语法管控：`Skill(name)` 精确匹配、`Skill(name *)` 前缀匹配；`/permissions` 里 deny `Skill` 可整体禁用。oh-my-pi 走的是另一条路——把技能正文暴露为 `skill://<name>` 内部 URL，由 `read` 工具读取（`skill://pdf/references/tables.md` 解析到技能目录内的相对路径，带绝对路径拒绝、`..` 遍历拒绝、越界拒绝三道守卫）。

**pi-agent-core 没有 `skill://` 解析器、也没有 skill 工具**。因此 Realm 的模型激活链路是：

```
<available_skills> 里的 location 绝对路径
  → 模型自己判断 description 匹配
  → 调 read 工具读该路径（沙箱放行，因为技能在 agent-workspace 内）
  → 正文进入上下文（L2）
  → 正文里引用的 references/xx.md 由模型再按绝对路径 read（L3）
```

这条链路**零新增工具**，是本功能最便宜的部分。

**一个必须知道的事实**（来自 skill-creator 的官方说明，解释模型为什么不总触发技能）：

> Claude only consults skills for tasks it can't easily handle on its own — simple, one-step queries like "read this PDF" may not trigger a skill even if the description matches perfectly, because Claude can handle them directly with basic tools. Complex, multi-step, or specialized queries reliably trigger skills.

→ 含义：**技能描述的质量（而非数量）决定可用性**；且"模型没触发"是正常行为，不是 bug。这直接支撑「用户可 `/skill:name` 强制调用」的必要性——**手动调用通道不是锦上添花，是发现机制的补集**。

---

## 3. 激活（Activation）：正文注入的两种形态

SDK 提供 `formatSkillInvocation(skill, additionalInstructions?)`，产出：

```
<skill name="pdf-processing" location="/abs/path/skills/pdf-processing/SKILL.md">
References are relative to /abs/path/skills/pdf-processing.

<正文（已剥 frontmatter）>
</skill>

<用户附加指令，可选>
```

这是「用户显式调用」场景的注入原语。oh-my-pi 的对应实现给了两条重要设计经验：

1. **两种注入模板必须有区分度**。oh-my-pi 分 `user-invocation.md`（明说"用户调用了这个技能" + 附技能目录 + `User: <args>`）与 `autoload.md`（仅 provenance 的极简格式，`Skill: <path>` + `User: <args>`），理由原文：**"these hidden messages must not claim the user invoked them"**。→ 如果 Realm 未来做「按需自动注入」，必须用第二种模板，不能复用用户调用模板（否则模型会以为自己被显式要求过，行为偏向执行而非参考）。
2. **投递时机跟随提交键位**（Enter = 流式中的 steer 队列；Ctrl+Enter = followUp 队列），没有额外开关。Realm 当前 `handleSendAIMessage` 在流式中直接 `return`，若希望技能调用能在流式中排队，需要额外设计——**建议 v1 不做，调用前先 abort/等待**（与现有 `/clear`、`/compact` 的处理一致：它们内部先 abort）。

**内容生命周期（Realm 必须继承的语义）**：技能正文注入后作为普通消息跨轮保留，**不重读文件**。因此「技能文件更新后需要重开会话才生效」是符合生态预期的行为，不需要额外通知机制。

---

## 4. 用户调用 UX

### 4.1 生态中的命名形态

| 形态 | 出处 | 特征 |
|------|------|------|
| `/skill-name` | Claude Code（个人/项目技能） | 命令名来自**目录名**，frontmatter `name` 仅作展示标签 |
| `/plugin:skill-name` | Claude Code（plugin 技能） | 命名空间前缀；frontmatter `name` 决定末段 |
| `/subdir:skill-name` | Claude Code（嵌套目录） | 相对工作目录的子目录路径作前缀 |
| `/skill:<name> [args]` | **oh-my-pi** | 显式命名空间，避免与内置斜杠命令冲突 |

Realm 的现状与决策空间：`SLASH_COMMANDS` 目前只有 `clear` / `compact`，匹配逻辑是**严格的前缀 + 空白边界**（`text === '/'+name || text.startsWith('/'+name+' ')`），未知命令会提示"未知命令"且**不入历史**。

**PROJECT.md 已定的方案是 `/skill:name args`（oh-my-pi 款）**——这是正确选择，理由有三：

- 与内置 `clear`/`compact` **零命名冲突**，不需要维护"内置优先"的隐式规则；
- 技能名集合是**用户可控的动态集合**（导入什么名字都有可能），裸名方案下任何用户技能叫 `clear` 就会撞车，而 `/skill:clear` 天然隔离；
- `/skill:` 前缀让面板能**用前缀直接分流**（输入 `/skill` 就只显示技能，不混内置命令），实现最简。

代价：与 Claude Code 用户的肌肉记忆不同（他们习惯 `/pdf-processing`）。若要兼顾，可作为 P3 附加一条「无冲突时裸名也可用」的兼容规则——但**建议 v1 不做**，冲突优先级规则是纯增复杂度。

### 4.2 面板 / 自动补全

- 生态共识：`/` 菜单列出所有用户可调用技能；`user-invocable: false` 从菜单隐藏。
- `argument-hint` 用于在**自动补全期间**显示期望参数（`[issue-number]`）。Realm 的 picker 当前渲染 `name` + `description` 两列，没有原生 argument-hint 支持 → **v1 可把 hint 拼进 description 展示**，或作为 P3。
- Claude Code 的 `/skills` 菜单可交互切换可见性（Space 循环，Esc 保存到 `settings.local.json`，四态 `"on"` / `"name-only"` / `"user-invocable-only"` / `"off"`）。Realm 的设置页技能管理区可以对齐这个四态——但**建议 v1 先做二元 enable/disable**，四态是 P3（四态的价值在于"省 token 但保留可调用"，二元已覆盖 80% 需求）。

### 4.3 参数与堆叠

- `$ARGUMENTS` / `$ARGUMENTS[N]` / `$N` / 命名参数（`arguments:` frontmatter）/ `${CLAUDE_SKILL_DIR}` / `${CLAUDE_SESSION_ID}` 等替换变量是 Claude Code 的能力。
- **pi-agent-core 完全不做字符串替换**——`formatSkillInvocation` 只是把 `additionalInstructions` 原文追加在 `<skill>` 块之后。
- → Realm v1 的 args 语义只能是「原始文本追加」（SDK 现成），**不做 `$ARGUMENTS` 替换**（实现成本 LOW 但收益低，且会让技能文件在不支持的宿主上行为分叉）。
- **堆叠调用**（`/a /b 123`，Claude Code 最多展开 6 个）是 P3；Realm 当前的单命令匹配逻辑天然不支持，改造成本中等（需要循环解析 + 参数分配规则），v1 不做。

### 4.4 Mid-prompt 调用（会话中嵌入）

oh-my-pi 支持在普通文本中嵌入 `/skill:<name>` token：

- 识别**前导形式**与**空白分隔的嵌入式 token**两种；
- 嵌入场景下**移除该 token，把周围散文作为 args 传入**；
- **当草稿以另一个斜杠命令或 bash/python 执行 sigil 开头时，不把嵌入 token 视为调用**。

Realm 当前的 `if (text.startsWith('/'))` 门禁意味着**嵌入形式完全不被识别**。要做到 oh-my-pi 那样需要改变拦截位置（先扫描 token 而非先判首字符），并新增"哪些首字符抑制嵌入识别"的规则。→ **P3 明确 defer**：收益（少打一个回车）远小于复杂度（token 扫描 + 多命令共存 + 与 `@` 引用/附件 marker 的交互），且当前单条消息即单次调用的模型更可预测。

---

## 5. 用户安装 / 市场技能 / 优先级 / 启用禁用

### 5.1 外部生态的安装方式

| 生态 | 命令 | 说明 |
|------|------|------|
| vercel-labs `skills` CLI | `npx skills add <owner/repo>`、`npx skills add vercel-labs/agent-skills`、`npx skills add https://skills.sh/p/<pack-id>`、`npx skills find [query]`、`npx skills init <name>` | 开放源码（github.com/vercel-labs/skills）。skills.sh 是它驱动的排行榜站点 |
| skills.sh 排行榜 | 网页浏览 | 排名基于 CLI 匿名遥测（技能名 + 文件 + 时间戳）；`DISABLE_TELEMETRY=1` 可关闭 |
| skills.sh packs | `https://skills.sh/p/<pack-id>` | 把多个公开/私有技能打包成一条安装命令 |
| badges | `[![skills.sh](https://skills.sh/b/owner/repo)]` | README 安装数徽章 |
| 安全 | 「routine security audits」 | 官方明确**不保证每个技能的质量与安全**，建议安装前自行审阅（对应 Anthropic 的安全提示：恶意技能可能引导数据外泄） |

**Realm 的结论：不在应用内实现市场浏览/搜索/排行榜**。理由：① 遥测排行榜是社区排名，非安全性保证；② `npx skills` 需要 Node CLI 环境与 `~/.agents/skills` 等外部目录，与 Realm 硬沙箱模型互斥；③ 内置 `find-skills` 技能 + 现有 `web_search`/`web_fetch` 已经能用自然语言完成「发现 → 找到 → 用 URL 导入」的闭环，**用技能解决发现问题比用 UI 解决更省**。

### 5.2 技能发现位置与优先级（外部生态的多源现实）

Claude Code 的完整位置表与企业级优先级（供对照，**Realm 不需要照搬**）：

| 优先级 | 位置 |
|--------|------|
| 最高 | Enterprise `.claude/skills/`（managed settings 目录） |
| ↓ | Personal `~/.claude/skills/<name>/SKILL.md` |
| ↓ | Project `.claude/skills/<name>/SKILL.md` |
| ↓ | Nested `<subdir>/.claude/skills/`（与根技能**同时保留**，用 `/subdir:name` 区分） |
| ↓ | `--add-dir` 附加目录 |
| — | Plugin `<plugin>/skills/`（命名空间 `/plugin:skill`，**与上述并存不冲突**） |
| — | claude.ai 账号同步（保留名 `synced`，任意大小写） |

其他规则：符号链接的 `<skill-name>` 条目允许（指向同一目标时只加载一次）；`.claude/commands/*.md` 是旧格式，仍支持，但**同名时技能胜出**；monorepo 从启动目录向上到仓库根逐级加载，**启动点之下**的 `.claude/skills/` 在首次读/写该子目录文件时才加载。

oh-my-pi 的过滤与开关体系（更工程化）：

- 过滤顺序严格为：① 未被 `disabledExtensions`（条目 `skill:<name>`）禁用 → ② source toggle 开启 → ③ 不在 `ignoredSkills`（glob 排除）→ ④ 在 `includeSkills` 内（glob 允许表；空 = 全含）。
- source toggle 粒度很细：`enableCodexUser` / `enableClaudeUser` / `enableClaudeProject` / `enablePiUser` / `enablePiProject` / `enableAgentsUser` / `enableAgentsProject`；**禁用 Claude/Codex/Pi 不影响 agents provider**，因为它是 OMP 原生位置。
- 外来源默认 opt-in（`enabledProviders`），原生源与 marketplace 插件默认加载。

**→ Realm 的映射（关键简化）**：Realm 没有 `.claude`、plugins、monorepo 这些外部生态。**真正存在的来源只有三个**：

| 来源 | 目录 | 权威性 | 可写 |
|------|------|--------|------|
| 用户导入技能 | `agent-workspace/skills/` | 最高（遮蔽同名 managed） | 用户（设置页导入/删除） |
| 种子内置技能 | `agent-workspace/managed-skills/`（首次启动播种） | 中 | 否（应由 AI 与用户都不可写） |
| AI 自建技能 | `agent-workspace/managed-skills/` | 最低 | AI（`manage_skill`） |

**tier 数从生态的 7 层降到 2 层**（用户 > managed）。**不要引入 provider priority 数值表**——那是为 7 个异构来源设计的机制，Realm 用不到，引入即纯负担。

但**必须保留两点**：① **同名去重：用户 > managed，首个胜出**（对应 oh-my-pi「managed 排在最后，任何同名作者技能优先」）；② **同名冲突必须对用户可见**（oh-my-pi 会发 collision warning；静默覆盖会让用户以为导入失败或成功，两者都错）。

### 5.3 一个 Realm 特有的目录设计风险（必须在 Roadmap 拍板）

PROJECT.md 把「种子内置技能」和「AI 自建技能」都放在 `managed-skills/`。这带来两个具体问题：

1. **AI 可以 `update` 掉内置的 `skill-creator` / `find-skills`**。oh-my-pi 的设计里 managed 目录**只放 AI 自建**（`~/.omp/agent/managed-skills`），种子内置走 provider 目录——正是为了隔离。Realm 若混用，`manage_skill(update, name="skill-creator")` 会覆盖随应用发布的资产，且不可恢复（除非随包再播种，而"一次性播种"标记会阻止重播）。
   **建议**：managed 目录内加不可变标记（如播种时写 `metadata.seeded: true`，或目录名区分 `managed-skills/_builtin/` vs `managed-skills/<name>/`），`manage_skill` 对 seeded 目标直接拒绝。
2. **AI 自建叫 `find-skills` 会静默遮蔽内置版**。oh-my-pi 的规则是「`create` 时若被作者技能遮蔽就返回 `isError: true` + `details.shadowed = true`，且**不写文件**」。Realm 应对齐：`manage_skill(create)` 若名称已被用户技能或 seeded 内置占用 → 错误返回，不落盘。

---

## 6. AI 自建技能

### 6.1 oh-my-pi `manage_skill` 的完整规格（最接近的参考实现）

| 维度 | 实现 |
|------|------|
| 工具门禁 | 需要 `autolearn.enabled = true`（**默认 `false`**）；工具元数据 `approval: "write"`、`strict: true`、`loadMode: "essential"` |
| 输入 | `action: "create" \| "update" \| "delete"`（必填）、`name`（必填）、`description`（create/update 必填）、`body`（create/update 必填，**不含 frontmatter**） |
| 名称规则 | trim + lowercase 后必须匹配 `[a-z0-9][a-z0-9-]{0,63}` |
| 描述净化 | 压成单行，剥控制/格式字符、尖括号、反引号、连续波浪号；净化后空 → 报错 |
| 正文 | trim 后非空 |
| frontmatter | **工具自己生成**，只含规范化 `name` + 净化后的 `description` |
| 体积上限 | 最终 `SKILL.md` ≤ **64000 UTF-8 字节**（含 frontmatter 与 description） |
| create | **独占创建**语义，已存在则失败 |
| update | 覆写已存在的**常规、单链接**文件；不存在则失败；拒绝非 regular 文件与多重硬链接 |
| delete | 递归删除已存在的 managed 技能目录；不存在则失败 |
| 并发 | 同名写入**进程内串行**（按提交顺序），不同名可并行；**跨进程不串行** |
| 安全 | 检查 managed 根目录、技能目录、文件三层，防 symlink 逃逸 |
| 作者遮蔽 | `create` 时若同名作者技能已存在 → **不写文件，返回 `isError: true` + `details.shadowed = true`**；`update` 不绕过此优先级 |
| 生效时机 | 成功后调 `refreshSkills` 回调，交互会话立即可发现变更 |
| 输出文案 | `Created managed skill "<name>" (managed-skills/<name>/SKILL.md).` |
| 隔离原则 | 原文：**"managed skills ONLY writable skills. NEVER edit user-authored skills."** |

### 6.2 skill-creator（anthropics）的完整工作流 —— 以及为什么不能照搬

skill-creator 的循环是：**捕获意图 → 写草稿 → 造 2–3 个真实测试 prompt → 同轮并行 spawn「带技能」与「基线（无技能/旧版）」两组 subagent → 造断言 → 评分 → 聚合 benchmark（pass_rate / time / tokens，mean±stddev）→ 启动浏览器 eval viewer 让人看 → 读 feedback.json → 改进 → 重复 → 描述优化子循环（20 条触发 eval、60/40 训练测试切分、跑 5 轮、按测试集分数选 best_description 防过拟合）→ `package_skill.py` 打包 `.skill` → `present_files` 呈现。**

**它需要的运行时依赖，Realm 一个都没有：** subagent（并行 spawn + 独立上下文）、Python 3 + `python -m scripts.*`、浏览器/显示器（`generate_review.py` 起服务或 `--static`）、`claude -p` CLI（描述优化循环）、`present_files` 工具（打包呈现）。

skill-creator 里**真正能移植的是"作者指南"部分**，而且这部分质量很高、值得保留：

- 渐进式披露三层与预算（~100 words / < 500 行 / 无限）
- `description` 是**首要触发机制**，所有"何时使用"信息必须写在 description 而不是正文
- 官方指出的模型倾向：**"undertrigger"——该用技能时不用**，因此描述要**略带推促性**（例：把 "How to build a fast dashboard" 改成 "...Make sure to use this skill whenever the user mentions dashboards, data visualization, internal metrics, or wants to display any kind of company data, even if they don't explicitly ask for a 'dashboard.'"）
- SKILL.md < 500 行；接近上限时加一层层级 + 明确指针；> 300 行的参考文件加目录
- **按变体组织**（`cloud-deploy/references/{aws,gcp,azure}.md`，模型只读相关那份）
- 用**祈使句**；解释**为什么**胜过堆砌大写 MUST/NEVER（"如果发现自己在写全大写的 ALWAYS 或 NEVER，那是黄旗信号"）
- **意外性最小原则**：技能不得含恶意/利用代码；不创建误导性技能
- 从重复劳动中提炼脚本（若三次测试都独立写了同一个 helper，就该把脚本放进 `scripts/`）
- 输出格式模板化（`ALWAYS use this exact template: ...`）

→ **Realm 内置 skill-creator 的正确形态**：保留上述作者指南全文 + 明确写一段 `compatibility` 说明「Realm 无 subagent / 无 Python 保证 / 无浏览器 viewer / 无 `claude -p`，因此评估循环不可用；改用 Realm 的 `manage_skill` 落盘 + 与用户对话式迭代」。**去掉 `agents/`、`eval-viewer/`、`scripts/`、`assets/` 四个目录**（本机版本约 5 个目录 ~15 个文件，其中只有 `references/schemas.md` 是纯文档，其余全是不可执行的脚本与 HTML）。

### 6.3 自动学习 / 主动推促（anti-feature）

oh-my-pi 有一套 `autolearn` 机制：agent 停止后**推促**它去总结可复用经验并建 managed 技能（`autolearn-nudge-autocontinue.md` 原文：*"If your previous turn produced reusable output, capture it now only if it will genuinely help next time... If nothing worth keeping, do nothing."*），并由 `autolearn-guidance.md` 注入 steer 指令（*"Capture sparingly, specifically: skill requires reuse; prefer enhancing existing managed skill to creating near-duplicate."*）。

**两点结论**：① 这套机制在 oh-my-pi 里**默认关闭且标注 experimental**；② 它给 Realm 的最大价值是那句**「Capture sparingly」**——如果 Realm 做 `manage_skill`，必须在工具描述里写入等价约束（要求复用性，优先增强已有而非造近乎重复的新技能），否则 AI 会造出一堆一次性技能污染技能列表与系统提示词。

---

## 7. Feature Landscape

### 7.1 Table Stakes（用户认为理所当然存在的功能）

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **技能目录纳入沙箱 + 加载接线** | 全部功能的前置；技能不在沙箱根内，模型拿到 `location` 也读不到 | **LOW** | `agent-workspace.js` 新增 `skills/` + `managed-skills/` 常量与初始化；`createSandboxEnv` 的 `resolveInside` 双基准天然放行，**无需改沙箱逻辑**（子目录在根内） |
| **系统提示词注入 `<available_skills>`** | 模型据此判断何时用技能；不做则技能等于不存在 | **LOW** | 直接调 `formatSkillsForSystemPrompt(skills)`，拼进 `buildSystemPrompt()`（现有三段拼接模式，加第四段）。**判空**：返回 `''` 时不要拼 |
| **`disable-model-invocation` 生效** | 规范/Claude Code 都有；用户用它区分"工作流"与"背景知识" | **LOW** | SDK 已过滤，**零代码**；但设置页应展示该状态（否则用户以为技能坏了） |
| **模型自动激活（description 匹配 → read 读正文）** | 渐进式披露的核心价值；不实现则技能只是"多一段提示词" | **LOW** | SDK 的提示词文本已告诉模型"自己去读 location + 相对路径按技能目录解析"，**零新增工具**。前提是技能在沙箱内 |
| **`/skill:name` 手动调用** | 发现机制的**补集**（模型对简单任务是故意不触发的，见 §2）；也是用户测试技能的唯一手段 | **MEDIUM** | renderer 侧：`SLASH_COMMANDS` 之外新增技能动态列表；主进程提供技能清单 IPC；`/skill:name args` 解析 + `formatSkillInvocation` 注入 + 作为 user 消息入历史 |
| **`/` 面板并入技能列表** | 技能名不可见 = 用户不知道有什么可用；面板是唯一发现入口 | **MEDIUM** | 复用现有 `renderSlashPickerList` 渲染管线；需决定排序（技能 vs 内置命令的先后）与空态；`/skill` 前缀分流 |
| **技能清单展示** | 用户必须能看到装了哪些技能、来源、名称/描述 | **MEDIUM** | 设置页（`realm://settings` guest）**必须走 `/api/*` + token，不能用 realmAPI**（Phase 17 UAT 教训：webview guest 无 realmAPI） |
| **名称/描述校验与诊断可见** | SDK 的校验是宽容模式（违规只发 warning 且技能照常加载）；静默的半坏技能最难排查 | **MEDIUM** | 加载后把 `diagnostics` 透传到设置页（`invalid_metadata` / `parse_failed` 等）。**不要只在控制台打印** |
| **用户 > managed 的同名优先级** | 用户导入的技能不能被 AI 生成的同名技能悄悄盖掉 | **LOW** | 用 `loadSourcedSkills`（source-tagged，SDK 现成）天然适配双目录；按「用户目录先、managed 后」的输入顺序 + 首个胜出 |
| **同名冲突可见** | 静默去重会让用户无法判断导入是否成功 | **LOW** | 加载时对"后续同名被丢弃"生成条目并展示（对齐 oh-my-pi 的 collision warning） |
| **单技能 enable / disable** | 技能会进系统提示词、占 token；用户需要关掉不用的 | **MEDIUM** | 存储键（如 `settings.aiSkills.disabled: string[]`）即改即存；**加载后过滤而非删除文件**；设置页复用 `whitelist-tag` 之外的列表 UI |
| **技能删除** | 导入错了要能删 | **LOW** | 主进程递归删除 + 目录边界校验（`resolveInside`）+ 刷新 |

### 7.2 Differentiators（差异化优势）

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **内置种子技能（find-skills + skill-creator）** | 开箱即有"发现新技能"与"创建新技能"两个元能力，形成自举闭环；生态里只有 Claude Code 内置少量技能，桌面浏览器内置是稀缺 | **MEDIUM** | **必须 Realm 化改写，不能原样 vendor**（见 §0-3 与下方警告）。播种需幂等（已存在不覆盖）+ 版本标记（升级时可推送新版） |
| **`manage_skill` 工具（AI 自建技能）** | 用户说"把刚才这套流程记下来"→ AI 落盘成技能，下次自动可用。生态先例 oh-my-pi 的 `manage_skill` **默认关闭且标注 experimental**，Realm 做得稳就是领先 | **HIGH** | 参考 §6.1 规格；核心难点是**原子写 + managed 边界 + 名称遮蔽 + 体积上限 + 实时刷新**五件事，缺一件都是事故 |
| **技能自带 `scripts/` 可在沙箱内执行** | 生态规范明确「脚本被执行而非载入上下文」；Realm 已有**白名单免确认 + 确认卡片**的 bash 权限引擎，是唯一能让"技能带脚本"这件事既好用又可控的形态 | **MEDIUM** | 复用 `ai-bash-policy.js` + 确认链路，**零新增机制**；只需在 system prompt 里说明"技能脚本在沙箱内、按其目录解析相对路径" |
| **从任意 URL 导入（GitHub 仓库 / 目录 / SKILL.md 直链自动分流）** | 生态里 `npx skills add` 只支持 GitHub 且是 CLI；应用内"粘一个链接就装好"无人做过 | **HIGH** | 分流判断（`github.com/o/r/skills/x/SKILL.md` vs `github.com/o/r/tree/branch/dir` vs 裸 SKILL.md）+ 目录枚举（GitHub API tree 递归 vs `raw` 逐文件）+ **路径遍历/绝对路径/符号链接三重防护** + 大小上限 + 失败可见性 |
| **zip 包导入** | 离线分发、团队内传阅的标准形态；`skills-ref` 生态与 Claude 的 `.skill` 包都是 zip 形态 | **HIGH** | **当前 `package.json` 无任何 zip 依赖**（`js-yaml`/`yaml`/`ignore` 仅作为 pi-agent-core 的传递依赖存在）→ 需新增解压依赖，并检查是否含 `.node` 二进制（含则必须 `asarUnpack` + `app.isPackaged` 路径分支）。**解压必须以"每段路径都过 `resolveInside` + 拒绝 `..` 与绝对路径"为准**（zip slip） |
| **技能来源与体积可视化** | 用户要能判断"这个技能哪来的、多大、值不值得开" | **MEDIUM** | 设置页展示 source（user/managed/AI-seeded）、SKILL.md 字节数、文件数；对齐 oh-my-pi 的 `/skill-doctor`（上下文成本 + 使用频率）的理念，但 v1 只做静态成本 |
| **`hide` 语义与 `disable-model-invocation` 分离** | 生态里 `hide: true` **不等于禁用**（仍可 `/skill:name` 触达，只是不进提示词）；这个区分让"省 token 但保留手动通道"成为可能 | **LOW** | SDK 只读 `disable-model-invocation`，`hide` 需 Realm 自己解析 frontmatter（`loadSkills` 会丢未知字段 → 需要额外读一次文件或改用 `disable-model-invocation` 同义写法） |

> **内置技能警告（本机实测，务必先改后打包）**：`~/.codebuddy/skills/skill-creator/` 与 `~/.codebuddy/plugins/cache/codebuddy-plugins-official/find-skills/1.0.0/skills/find-skills/SKILL.md` 是当前可得的两个参考副本，**都不可直接打包进 Realm**：
>
> - `find-skills`（CodeBuddy 变体）硬编码 `~/.workbuddy/skills` / `~/.codebuddy/skills` 作为目标目录、要求 `npx skills add` / `npx clawhub install`、主源是 SkillHub `https://lightmake.site` API——这些路径在 Realm 沙箱外，命令会全部撞上确认卡片或被拒，**且会教模型去写沙箱外目录**。Realm 版应改为：技能目录 = `agent-workspace/skills/`；搜索走 Realm 现有 `web_search`；安装走 Realm 的 URL 导入（或直接把链接给用户）。
> - `skill-creator` 的 `agents/`（grader/comparator/analyzer）、`eval-viewer/generate_review.py`、`scripts/`（run_loop/run_eval/package_skill/quick_validate）全部依赖 Realm 没有的运行时。

### 7.3 Anti-Features（看似合理、实则有问题的功能）

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **照搬 skill-creator 的评测/基准循环** | 「官方技能，功能最全」 | 需要 subagent 并行、Python 3、浏览器/显示器、`claude -p` CLI、`present_files`。Realm 一个都没有 → 技能会在第一步就死掉，模型还会反复尝试并报错，比没有更糟 | 只保留「作者指南」正文（§6.2 清单），在 `compatibility` 里明说评估循环不可用，改为与用户对话式迭代 |
| **应用内技能市场（浏览/搜索/排行榜/遥测）** | 「像 app store 一样装技能」 | skills.sh 排行榜基于**安装量遥测**而非安全审核，官方原文声明不保证质量与安全；`npx skills` 依赖 Node CLI 与外部目录，与硬沙箱模型互斥；引入后需处理来源信任、版本升级、卸载残留、供应链风险 | 内置 `find-skills` 技能 + 现有 `web_search`/`web_fetch`，走"发现 → 贴链接 → URL 导入"闭环。**用技能解决发现问题** |
| **多源发现（`~/.claude/skills`、plugins、AGENTS.md 生态）** | 「兼容生态，装了就能用」 | Realm 没有这些目录、也没有对应的插件体系；引入 7 层 provider priority + 一堆 source toggle 是**为不存在的问题付复杂度**，且每层都要写安全边界 | 只做 2 层：`skills/`（用户）> `managed-skills/`（种子 + AI）。**不引入 priority 数值表** |
| **把技能正文预加载进系统提示词** | 「省一次工具调用，更可靠」 | ① 破坏 D-04 冻结语义的前缀缓存收益（每加一个技能都改 prompt 前缀）；② token 随技能数线性膨胀；③ 违背渐进式披露的设计初衷（L3 资源可能无限大） | 只注入 L1 元数据（`formatSkillsForSystemPrompt` 现成），正文由模型 `read` 按需拉取 |
| **自动按需注入技能（不告诉用户）** | 「更智能，模型自己会用」 | oh-my-pi 明确记录了教训：**自动注入的消息"must not claim the user invoked them"**，必须用另一套极简 provenance 模板。做错会让模型以为被显式要求过，行为偏向盲目执行；且用户不知道上下文里多了什么 | v1 **不做自动注入**，只做 `<available_skills>` + 模型自主 `read`。若将来做，必须另写注入模板 |
| **动态 shell 注入 `` !`cmd` ``（Claude Code 语法）** | 「技能能内联实时信息，文档更强大」 | **在技能渲染期执行任意命令**，绕过 Realm 现有的确认卡片与白名单引擎（那是唯一的安全边界）。而技能可能来自任意 URL / zip / AI 生成 → 等于引入远程代码执行。Claude Code 自己都要给 claude.ai 同步的技能禁用此功能，并需要 `disableSkillShellExecution` 开关兜底 | 技能不得在任何时候执行内联命令。需要动态信息 → 让模型**显式调 bash 工具**（走白名单/确认），或让模型调 `web_fetch` |
| **`allowed-tools` / `disallowed-tools` 按技能授权** | 「技能声明自己需要什么工具，更安全」 | 规范原文标注 **Experimental**、"support for this field may vary"；pi-agent-core **完全不解析**；Realm 的权限模型是「沙箱 + 确认卡片」，不是"每轮工具允许表"。实现它需要引入一套与现有点击确认并存的第二权限系统，两套权限语义必然漂移 | 不实现。安全边界保持：**硬沙箱（write/edit 限定工作区）+ bash 三档权限 + 确认卡片**；在系统提示词里说明技能的脚本在沙箱内执行 |
| **技能目录内捆绑 hooks / MCP 服务器 / subagent 定义** | 「技能是完整的能力包」 | Claude Code 支持这些是因为它有 hooks 与 MCP 运行时；Realm 没有。引入等于在自己的应用里定义一套外部可写的可执行配置格式（供应链攻击面从"提示词"升级到"代码"） | 技能 = 纯提示词 + 可选脚本（脚本只能经 bash 工具在沙箱内、走确认链路执行）。**不引入任何技能可声明的运行时扩展** |
| **`context: fork` / 技能作为 subagent 运行** | 「隔离上下文，省 token」 | Realm 的 pi-agent-core 使用方式没有 subagent 概念，且「一对话一 Agent」的架构（v2.5 已定）与之冲突 | v1 defer。技能在**当前对话上下文**内执行 |
| **符号链接技能目录** | 「共享技能目录，不重复占空间」 | 硬沙箱的 `resolveInside` 有双基准 + 已存在路径 realpath 复核（防 symlink 二段式逃逸）；符号链接技能目录会让"技能在根内"这个前提变得难以验证；oh-my-pi 也为此写了 `realpath` 去重 + 三层 symlink 逃逸检查 | 导入时**实体复制**（解引用），不保留符号链接。理由：技能体积小（上限 64KB 级），复制的成本远低于安全论证成本 |
| **递归嵌套技能分类（`group/subgroup/skill`）** | 「技能多了要分类」 | pi-agent-core 是**递归**扫描的，能发现嵌套；但嵌套会让技能名与目录名脱钩、去重键歧义、`manage_skill` 的扁平命名规则失效。oh-my-pi 干脆做成非递归并要求 `customDirectories` 指到具体父目录 | **固定一层**：`<root>/<skill-name>/SKILL.md`。注意 SDK 递归这点要在**加载后**按「相对深度 = 2」过滤，否则深层技能会意外混入 |
| **根目录散落 `.md` 也当技能** | 「SDK 支持，白送的」 | `loadSkills` 对顶层 root 传 `includeRootFiles: true` → `skills/` 下任意带 description 的 `.md` 会变成技能，name 若未写就回落成 `skills`，且只产出 warning。用户往目录里丢个 README 就多一个技能 | 加载后**只保留 `<name>/SKILL.md` 形态**（用 `filePath` 的 basename === `SKILL.md` 判定），散落 md 一并计入"诊断"面板提示 |
| **每轮结束后主动推促 AI 建技能（autolearn nudge）** | 「自动沉淀经验」 | oh-my-pi 里默认关闭且 experimental。开启会污染技能列表（AI 造大量一次性技能）+ 每轮多一次 LLM 往返 + 用户无法预期 | 不做推促。技能创建由**用户显式发起**（"把刚才这套存成技能"）触发 `manage_skill`；在工具描述里写死「capture sparingly，优先增强已有技能」 |
| **技能文件热重载 / 文件监听** | 「改了立刻生效」 | 系统提示词在 Agent 创建时冻结（保前缀缓存）；内容注入后不重读文件（生态一致行为）。做热重载要么破坏前缀缓存，要么制造"提示词里的技能列表与磁盘不一致" | 明确的产品语义：**导入/新建/删除技能后重建 Agent**（走 `_recreateAgent()`，与 `/clear` `/compact` 同路），并在设置页提示"新技能在下一轮对话生效" |

---

## Feature Dependencies

```
[agent-workspace 新增 skills/ + managed-skills/ 子目录 + 初始化]
    ├──requires──> [硬沙箱已有 resolveInside 双基准]（已存在，零改动）
    ├──requires──> [loadSkills / loadSourcedSkills 接线]
    │                   ├──requires──> [formatSkillsForSystemPrompt 注入 buildSystemPrompt]
    │                   │                   └──requires──> [模型自动激活（read 读正文）]
    │                   └──requires──> [诊断透传 → 设置页可见]
    └──requires──> [技能清单 IPC/HTTP 通道]
                        ├──requires──> [/ 面板并入技能列表]
                        │                   └──requires──> [/skill:name args 调用 + formatSkillInvocation 注入]
                        └──requires──> [设置页技能管理区]

[设置页技能管理区]  ──requires──> [/api/* HTTP 端点 + token 鉴权]（guest 无 realmAPI）
[zip 导入]          ──requires──> [新增 zip 解压依赖]
[URL 导入]          ──requires──> [现有 fetchUrl / SSRF 校验（web_fetch 复用链）]
[manage_skill 工具] ──requires──> [原子写 + managed 边界 + 名称遮蔽 + 体积上限]
                    ──requires──> [技能刷新（重建 Agent）机制]
[内置种子技能]      ──requires──> [幂等播种 + 版本标记]
                    ──requires──> [Realm 化改写（不可原样 vendor）]

[enable/disable]  ──enhances──> [系统提示词注入]（过滤后再注入，非删除文件）
[scripts/ 可在沙箱执行] ──requires──> [ai-bash-policy 白名单 + 确认链路]（已存在）
[同名冲突可见]    ──enhances──> [用户 > managed 优先级]

[/skill:name 裸名兼容]   ──conflicts──> [内置 clear / compact]（若做裸名需额外优先级规则 → 建议不做）
[技能自动注入]           ──conflicts──> [D-04 系统提示词冻结（前缀缓存）]
[预加载技能正文]         ──conflicts──> [渐进式披露 / token 预算]
```

### Dependency Notes

- **`agent-workspace` 的目录改动是全功能前置**，不是"顺手做的事"：`read` 工具是模型读取技能正文的唯一通道，而它有 `resolveInside` 硬边界。技能目录必须在根内。这条依赖决定了它必须排在**第一个阶段**（且改动极小，风险低，适合打底）。
- **技能清单通道的形态由页面类型决定**：主窗口（`file://`）走 preload `realmAPI.*` IPC；设置页（`realm://settings` → webview guest）**只能走 `/api/*` + URL token**。Phase 17/38 两次踩过"guest 误用 IPC / renderer 直接 fetch localhost 被 CORS 拦"的坑，这里是同款陷阱。**同一个技能清单会有两个消费方（`/` 面板在主窗口、管理区在 guest），设计时就要分两条路，不要试图统一。**
- **`manage_skill` 与"重建 Agent"是强耦合**：写盘后不重建就只有下次会话可见（因为技能列表冻结在 system prompt 里）。若 Roadmap 选择"不重建、下次生效"，必须把这条语义明确告知用户，否则会被当成"AI 建的技能没用"。
- **`/compact` 与技能正文的关系**：Claude Code 会把已调用技能的前 5000 tokens 重新附加（共享 25k 预算）。Realm 的 `/compact` 是自研摘要管线（`SUMMARY_SYSTEM_PROMPT` + `COMPACT_RECENT_TURNS`），**默认不会保留技能正文**——压缩后模型可能丢掉技能的操作细节。这是一个需要显式决策的点（v1 可接受，但应记入已知限制）。
- **`yaml` 与 `ignore` 目前只是 pi-agent-core 的传递依赖**。若 Realm 直接 `require('yaml')` 做 frontmatter 解析（例如为了读 `hide` / `metadata.seeded`），**必须提升为 `dependencies` 直接依赖**——否则将来 SDK 调整依赖树会静默炸掉，且打包时 hoisting 不保证。

---

## MVP Definition

### Launch With (v1) — 本里程碑范围

- [ ] **`agent-workspace` 新增 `skills/` + `managed-skills/`** — 全部功能的前置；沙箱零改动（子目录在根内）
- [ ] **技能加载接线 + `<available_skills>` 注入** — 直接调 SDK 两个函数；成本最低、价值最高的一步
- [ ] **模型自动激活（description 匹配 → read 正文）** — 零新增工具，SDK 提示词已引导；前提是上一条
- [ ] **`/skill:name [args]` 调用 + `/` 面板并入技能列表** — 发现机制的补集，用户测试技能的唯一手段；`formatSkillInvocation` 现成
- [ ] **用户 > managed 优先级 + 同名冲突可见** — 用 `loadSourcedSkills` 天然适配双目录
- [ ] **设置页技能管理区（列表 / 来源 / 诊断 / enable-disable / 删除）** — 走 `/api/*`；复用列表 + tag UI 先例
- [ ] **zip 包导入** — 需新增解压依赖 + zip slip 防护
- [ ] **网络地址导入（GitHub 仓库/目录 与 SKILL.md 直链自动分流）** — 复用 `fetchUrl` + SSRF 校验
- [ ] **`manage_skill` 工具（create/update/delete）** — 名称校验 + 大小上限 + 原子写 + managed 边界 + 名称遮蔽拒绝
- [ ] **内置 find-skills（Realm 化）+ skill-creator（仅作者指南部分）** — 幂等播种 + seeded 不可被 AI 覆盖

### Add After Validation (v1.x)

- [ ] **技能四态可见性（`on` / `name-only` / `user-invocable-only` / `off`）** — 触发条件：用户反馈"想省 token 但保留手动调用"（二元 enable/disable 不够用时）
- [ ] **技能静态成本可视化（SKILL.md 字节数 / 文件数 / 估算 token）** — 触发条件：安装技能数超过 ~15 个，用户开始疑惑 token 去哪了
- [ ] **`hide` 语义（不进提示词但可 `/skill:name`）** — 触发条件：出现"纯背景知识"型技能需求
- [ ] **技能更新检查（seeded 技能随应用升级推送新版）** — 触发条件：内置技能需要迭代
- [ ] **skill-creator 的"描述优化"降级版**（无 `claude -p`，改为 AI 与用户对话式打磨 description） — 触发条件：用户抱怨技能触发不准
- [ ] **技能详情查看（在应用内查看 SKILL.md 正文）** — 触发条件：用户要审阅从网络导入的技能（安全需求）

### Future Consideration (v2+)

- [ ] **`$ARGUMENTS` / `$N` / 命名参数替换** — 收益低于"原始文本追加"，且会让技能在不同宿主行为分叉
- [ ] **堆叠调用（`/a /b 123`）** — 单命令模型更可预测，需求未验证
- [ ] **Mid-prompt 嵌入 `/skill:name` token** — 收益（少按回车）远小于代价（token 扫描 + 与 `@`/附件 marker 交互）
- [ ] **自动按需注入技能正文（另写 provenance-only 模板）** — 需先有真实的多技能场景与用户对"上下文里多了什么"的容忍度
- [ ] **技能作用域（按容器启用）** — 与 Realm 的容器隔离模型天然契合，但需先验证全局技能是否已足够
- [ ] **`context: fork` / subagent 式隔离执行** — 依赖 Realm 引入 subagent 架构，属独立能力
- [ ] **市场/注册表接入** — 见反特性；除非出现可信的、可审计的技能来源

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 沙箱目录 + 加载接线 | HIGH | LOW | **P1** |
| `<available_skills>` 注入 | HIGH | LOW | **P1** |
| 模型自动激活（read 正文） | HIGH | LOW | **P1** |
| `/skill:name` 调用 | HIGH | MEDIUM | **P1** |
| `/` 面板并入技能列表 | HIGH | MEDIUM | **P1** |
| 用户 > managed 优先级 + 冲突可见 | MEDIUM | LOW | **P1** |
| 设置页技能管理区（列表/开关/删除） | HIGH | MEDIUM | **P1** |
| zip 导入 | MEDIUM | HIGH | **P1**（本里程碑内定） |
| URL 导入（GitHub / 直链分流） | MEDIUM | HIGH | **P1**（本里程碑内定） |
| `manage_skill`（AI 自建） | MEDIUM | HIGH | **P1**（本里程碑内定） |
| 内置 find-skills + skill-creator | MEDIUM | MEDIUM | **P1**（本里程碑内定） |
| 诊断透传到设置页 | MEDIUM | MEDIUM | **P1** |
| 技能静态成本可视化 | LOW | MEDIUM | P2 |
| 四态可见性 | LOW | MEDIUM | P2 |
| `hide` 语义 | LOW | LOW | P2 |
| seeded 技能升级推送 | LOW | MEDIUM | P2 |
| 技能详情查看（审阅正文） | MEDIUM | LOW | P2 |
| `$ARGUMENTS` 替换 | LOW | LOW | P3 |
| 堆叠调用 | LOW | MEDIUM | P3 |
| Mid-prompt token | LOW | MEDIUM | P3 |
| 自动按需注入 | LOW | HIGH | P3 |
| 容器级技能作用域 | MEDIUM | HIGH | P3 |
| 市场接入 | LOW | HIGH | **不做** |

**Priority key:** P1 = 必须（本里程碑）｜P2 = 验证后补｜P3 = 未来考虑

---

## Competitor Feature Analysis

| 能力 | Claude Code | oh-my-pi | Realm 方案 |
|------|-------------|----------|------------|
| 技能构成 | `SKILL.md` + `scripts/` `references/` `assets/`；接受规范超集（20+ 字段） | `SKILL.md` + 可选资产；4 个自有字段 + 未知字段透传 | `SKILL.md` + 可选资产；**只读 `disable-model-invocation`，写出只写 `name`/`description`**（保证与规范互通） |
| 发现机制 | `<available_skills>` 列表 + 内部 `Skill` 工具 + 权限语法 `Skill(name *)` | `<available_skills>` 列表 + `read` 读 `skill://` 内部 URL | `<available_skills>`（SDK）+ **`read` 读绝对路径**（SDK 无 `skill://`，技能在沙箱内） |
| 用户调用 | `/skill-name`（目录名）；plugin `/plugin:skill`；嵌套 `/subdir:skill` | `/skill:<name> [args]`，支持 prose 内嵌入 token | **`/skill:name [args]`**（对齐 oh-my-pi；零内置冲突） |
| 参数 | `$ARGUMENTS` / `$N` / 命名参数 / `${CLAUDE_SKILL_DIR}` 等替换 | 原始 `User: <args>` 追加 | **原始文本追加**（SDK `formatSkillInvocation` 现成） |
| 来源与优先级 | 企业 > 个人 > 项目 > 嵌套 > `--add-dir`；plugin 命名空间并存 | 7 个 provider priority + 名称去重 + realpath 去重 + 源开关 + ignore/include glob | **2 层**：`skills/`（用户）> `managed-skills/`（种子 + AI）；无 priority 表 |
| 启用/禁用 | `skillOverrides` 四态（on / name-only / user-invocable-only / off）+ `/skills` 菜单 | `hide` / `disabledExtensions`(`skill:<name>`) / `ignoredSkills` / `includeSkills` | **二元 enable/disable**（P1）→ 四态（P2） |
| AI 自建 | 无专用工具（靠通用 `write`） | `manage_skill`（create/update/delete），`autolearn.enabled` 默认 false、标注 experimental | `manage_skill`（create/update/delete）+ managed 边界 + seeded 保护 |
| 安装 | 目录 / symlink / plugin / claude.ai 同步 | provider 目录 + marketplace 插件 + `skills.customDirectories` | **zip 导入 + URL 导入**（无市场 UI） |
| 脚本执行 | `!`cmd`` 内联注入 + 技能自带脚本 | 技能自带脚本（经 bash 工具） | **仅技能自带脚本**，经 bash 白名单/确认链路；**不做内联注入** |
| 隔离执行 | `context: fork` + subagent | subagent 可显式请求 `manage_skill` | **不做**（无 subagent 架构） |
| 生效时机 | 调用即注入单条消息；不重读文件；压缩时重附前 5000 tokens | `refreshSkills` 回调即时刷新发现列表 | 调用即注入（不重读）；**导入/新建后重建 Agent** 才更新列表 |

---

## 关键设计决策（Roadmap 必须拍板，附推荐）

| # | 决策点 | 选项 | 推荐 | 理由 |
|---|--------|------|------|------|
| D1 | 调用命名 | `/skill:name` vs 裸 `/name` | **`/skill:name`** | 零冲突；技能名是用户可控动态集合，裸名必然撞车；PROJECT.md 已定 |
| D2 | 技能目录变化后是否立即重建 Agent | 立即 `_recreateAgent()` vs 下轮生效 | **立即重建** | 否则"导入成功但技能不出现"会被判为 bug；成本只是一次 Agent 重建（`/clear`/`/compact` 已有先例） |
| D3 | seeded 内置技能与 AI 自建是否同目录 | 同目录（PROJECT.md 现方案） vs 分目录 | **同目录 + seeded 不可变标记** | 保持目录结构简单（两个根即可），用 `metadata.seeded` 或目录前缀防止 AI 覆盖内置资产 |
| D4 | 递归扫描的处理 | 接受 SDK 递归 vs 只保留一层 | **加载后过滤为"一层"** | 避免深层技能让 name/目录脱钩、去重键歧义；同时排除顶层散落 `.md` 被当技能 |
| D5 | `/compact` 是否保留技能正文 | 保留 vs 不保留 | **v1 不保留，记入已知限制** | 现有压缩管线是自研的，改造成本中等；技能正文可在压缩后由模型重读文件恢复（这与"不重读"的默认语义相比是一次显式取舍，需在文档说明） |
| D6 | `manage_skill` 是否加开关 | 默认开 vs 默认关（oh-my-pi 默认关） | **默认开** | 这是本里程碑的核心差异化能力；风险已由"managed 边界 + 不碰用户技能 + 体积上限 + 名称遮蔽拒绝"覆盖。但**必须**在工具描述里写「capture sparingly，优先增强已有」 |

---

## SDK 免费清单（cheap because the SDK already provides them）

| 能力 | SDK 出口 | Realm 需付的成本 |
|------|---------|-----------------|
| 目录扫描 + 递归 + 忽略文件 | `loadSkills(env, dirs)` | **零**（沙箱 env 已实现全部所需 FileSystem 方法） |
| 多源来源标注（user / managed） | `loadSourcedSkills(env, inputs, mapSkill)` | **零**（source 是应用自定义的任意值，SDK 不解释） |
| frontmatter 解析（YAML） | `loadSkills` 内部（`yaml` 包） | **零**（但若要读 `hide`/`metadata` 等未暴露字段，需自行再解析一次） |
| 名称/描述规范校验 | 内部 `validateName` / `validateDescription` | **零**（但只出 warning，严格模式需自实现） |
| `<available_skills>` XML 生成 + XML 转义 + `disableModelInvocation` 过滤 + 空态返回 `''` | `formatSkillsForSystemPrompt(skills)` | **零** |
| 技能正文注入块（含技能目录与相对路径说明） | `formatSkillInvocation(skill, extra)` | **零** |
| 诊断结构（code / message / path / type） | `loadSkills` 返回的 `diagnostics` | **零**（只需透传展示） |
| 沙箱边界（技能目录在根内即天然放行） | `agent-workspace.createSandboxEnv` | **零**（只需新增两个子目录常量） |

**不在 SDK 内、必须自建**：任一来源的写入（zip 解压 / URL 下载 / AI 落盘）、原子写、体积上限、managed 边界、名称遮蔽判定、enable/disable 过滤、设置页 UI、`/` 面板合并、Agent 重建触发、`skill://` 等价物（直接用绝对路径 `read` 替代）。

---

## Sources

**一手规范与官方文档（HIGH）**

- Agent Skills Specification — https://agentskills.io/specification（目录结构、frontmatter 字段表与约束、name/description 规则、可选目录约定、渐进式披露三层与 token 预算、file references、`skills-ref validate`）
- Anthropic Engineering — *Equipping agents for the real world with Agent Skills*（2025-10-16；progressive disclosure 三层定义、文件系统使上下文"effectively unbounded"、代码执行与 token 的关系、四条作者指南、安全提示；2025-12-18 成为开放标准）
- Claude Code Docs — Skills — https://code.claude.com/docs/en/skills（全部 frontmatter 字段表含必需性、1536 字符截断、`skillOverrides` 四态表、发现位置与同名解析优先级表、命名来源表、`` !`cmd` `` 动态注入与 `$ARGUMENTS` 系列、`context: fork`、自动压缩 5000/25000 token 预算、claude.ai/Skills API 允许字段硬校验报错原文、`/skill-doctor`）
- skills.sh Docs / CLI Reference — https://www.skills.sh/docs 、https://www.skills.sh/docs/cli（生态定位、`npx skills add`、packs、遥测排行榜、badge、安全声明与免责）
- anthropics/skills — `skills/skill-creator/SKILL.md`（本机副本 `~/.codebuddy/skills/skill-creator/SKILL.md` 逐行阅读：作者指南全文、评测循环与依赖、description 优化循环、undertrigger 现象与"pushy description"建议、packaging、Claude.ai/Cowork 差异）

**参考实现（HIGH — 源码/文档级）**

- oh-my-pi `docs/skills.md`（技能对象形状、非递归布局、frontmatter 字段、三趟发现管线、7 个 provider 与 priority、去重与 collision、源开关与过滤顺序、`hide` 语义、`/skill:<name>` 完整调用语义含嵌入 token、user-invocation vs autoload 模板、`skill://` 解析与三道守卫、与 AGENTS.md / commands / tools / hooks 的边界）
- oh-my-pi `docs/tools/manage_skill.md`（工具门禁、输入输出、flow、模式变体、副作用、Limits & Caps、全部错误消息、managed 与 authored 隔离）
- oh-my-pi `src/prompts/system/autolearn-guidance.md`、`src/prompts/system/autolearn-nudge-autocontinue.md`、`src/prompts/tools/manage-skill.md`、`docs/settings.md`（`autolearn.enabled` 默认 false）
- oh-my-pi `docs/skills/authoring-marketplaces.md`、`docs/marketplace.md`（marketplace 相关，未展开引用）

**本仓库实际契约（HIGHEST — 逐行核对）**

- `node_modules/@earendil-works/pi-agent-core/dist/harness/skills.js`（0.84.3：`loadSkills` / `loadSourcedSkills` / `formatSkillInvocation`、Skill 对象形状、`validateName` / `validateDescription` 的 warning-only 语义、递归 + ignore 文件处理、顶层散落 md 的 `includeRootFiles` 行为、诊断 code 全集）
- `node_modules/@earendil-works/pi-agent-core/dist/harness/system-prompt.js`（`formatSkillsForSystemPrompt` 原文、`disableModelInvocation` 过滤、空态返回 `''`）
- `.planning/PROJECT.md`（v2.6 里程碑目标与 target features、D-04 系统提示词冻结语义、v2.6 关键发现）
- `ai-manager.js`（`buildSystemPrompt` 三段拼接、`buildWorkspacePrompt`、`_adaptHarnessTool`、工具注册；`/compact` 自研压缩管线）
- `agent-workspace.js`（`getWorkspaceDir`、`ai-memory` 迁移先例、`createSandboxEnv` 全部 FileSystem 方法覆写、`resolveInside` 双基准 + realpath 复核）
- `src/renderer.js`（`SLASH_COMMANDS` 注册表与注释语义、`handleSendAIMessage` 的 `/` 前缀拦截与"未知命令不入历史"、`renderSlashPickerList` 渲染与过滤管线）
- `src/settings-page.js`（`aiBashWhitelist` 即改即存 + `whitelist-tag` UI 先例、`/api/settings/update` 服务端校验先例）
- `AGENTS.md`（内部页面 CSP「markup 内联 style 被拦截」、guest 走 `/api/*` 而非 realmAPI、主窗口 `file://` 不能 fetch localhost、`_recreateAgent` 与记忆冻结快照的既有约束）
- 本机技能副本实测：`~/.codebuddy/skills/skill-creator/`（含 `agents/` `assets/` `eval-viewer/` `references/` `scripts/` 五目录）、`~/.codebuddy/plugins/cache/codebuddy-plugins-official/find-skills/1.0.0/skills/find-skills/SKILL.md`（CodeBuddy 变体，硬编码 WorkBuddy / CodeBuddy 目录与 SkillHub API）
- `package.json` 依赖实测（**无 zip 库**；`yaml` / `ignore` 仅为 pi-agent-core 传递依赖）

**置信度说明**：规范与 Claude Code 部分为官方文档 HIGH；oh-my-pi 为源码/文档级阅读 HIGH；pi-agent-core 为逐行源码核对 HIGHEST；「Realm 侧的实现成本评估」为基于现有代码结构的工程判断 MEDIUM。

---
*Feature research for: Realm Browser AI 助手技能（Skill）能力（v2.6）*
*Researched: 2026-09-10*
