# AI 工作区与文件/Bash 工具（产品说明）

> **维护约定（重要）**：本文档是 AI 助手文件/Bash 工具（read/write/edit/bash）、agent 工作区、
> 权限白名单功能的**产品说明权威文档**。以后修改这些功能的行为（工具能力、权限分档、
> 白名单匹配语义、确认流程、沙箱边界、工作区目录结构等），**必须同步更新本文档**，
> 让产品说明与实际行为保持一致。实现方案与决策记录见
> [docs/plan/ai-file-bash-tools-integration.md](../plan/ai-file-bash-tools-integration.md)。

## 一、功能概述

AI 助手接入了 pi-agent-core SDK 的 4 个内置工具，获得「像本地开发者一样工作」的能力：

| 工具 | 能力 | 用户可见行为 |
|------|------|------------|
| `read` | 读取工作区内文件（文本分段读取 / 图片识别） | 工具卡片显示执行状态 |
| `write` | 在工作区写文件（覆盖语义，父目录自动创建） | 同上 |
| `edit` | 按 oldText 唯一匹配精确替换文件片段 | 同上 |
| `bash` | 在工作区内执行 shell 命令（输出超 2000 行/50KB 截断，全量落临时文件） | 可能弹确认卡片 |

配套机制：

- **agent 工作区**：AI 的专属根目录，所有 AI 落盘数据统一收纳
- **硬沙箱**：read/write/edit 只能访问工作区内的文件
- **三档权限**：bash 命令按「白名单 → 默认确认 → 危险强制确认」分级
- **白名单设置**：设置页 AI 分区可管理免确认的命令前缀

## 二、agent 工作区目录模型

工作区根目录为 `userData/agent-workspace/`（四个环境各自独立）：

```
agent-workspace/
├── ai-memory/                          AI 记忆（原 userData/ai-memory 迁入）
│   ├── USER.md                         用户画像（冻结快照进 system prompt）
│   ├── MEMORY.md                       全局记忆（同上）
│   └── memories/<containerId>.md       容器记忆（memory_read 按需读取）
├── attachments/                        聊天附件快照（用户拖入/粘贴的文件复制于此）
├── .tmp/                               bash 输出截断全量落盘等临时文件
└── （AI 自行创建的文件）                导出、抓取结果、生成的文件等
```

- AI 被约定「所有落盘数据一律写工作区内」（system prompt 明确告知工作区绝对路径）
- 旧 `userData/ai-memory/` 在应用启动时一次性迁移到工作区，**迁移后旧目录保留不删**（回滚保险）
- 容器删除时其容器记忆文件联动删除（既有机制不变）

**聊天附件（attachments/）**：用户在 AI 聊天面板拖入文件/目录，或在输入框粘贴文件/截图时，主进程把源文件**复制快照**到该目录（唯一文件名，不修改原文件），并生成登记 ID 返回给聊天框。发送消息时附件以 `[attached_file: 快照路径]` / `[attached_image: 快照路径]` marker 置于消息最前，快照在工作区内，agent 直接 read 即可；图片附件同时以原生图片块随消息发出。授权语义：**用户拖入/粘贴即显式授权**（与「文件选择器导入」同一信任级别），不弹确认卡片；敏感路径（`~/.ssh`、`~/.gnupg`、`~/.aws`、`~/.kube`、`~/Library/Keychains`、`.env`、shell history 等）与 symlink 源会被拒绝登记——该屏蔽是启发式（防手滑拖整目录连坐敏感文件），不是安全边界。完整产品说明（交互细节、图片内联渲染、持久化与历史恢复、数量与大小边界）见 [ai-chat-attachments.md](ai-chat-attachments.md)。

## 三、read / write / edit：硬沙箱（无确认，路径锁死）

这三个工具只能通过 SDK FileSystem 接口触达文件，而接口被整体包装为沙箱：

1. 路径先词法解析（消化 `..`、相对路径）
2. 必须落在工作区根目录（或其 realpath，兼容 macOS `/var → /private/var`）前缀内——防撞名兄弟目录
3. 已存在的路径再做 realpath 复核——防 symlink 二段式逃逸（bash 先 `ln -s /etc` 再用 read 读 link 会被拒）
4. 越界访问**直接拒绝**（`permission_denied`），没有确认弹窗、没有白名单、没有任何例外

因此**无论模型被怎么诱导，这三个工具都无法触达工作区外的文件**。工作区内的写操作免确认：破坏面已被限定在 AI 专用数据区。

对用户的意义：**想让 AI 读写工作区外的文件，唯一途径是 bash**（见下节）——典型协作模式是「AI 用 bash 把文件复制进工作区，再用 read 读」，每一步复制命令都会弹卡由用户确认。

## 四、bash：三档权限（路径不设防，操作必过人）

bash 是任意 shell，工作目录固定为工作区根目录，但**不受路径沙箱约束**（`cat /etc/hosts` 天然可跑）。它的管控是命令级三档裁决，复合命令（`;` `&&` `||` `|` 分隔）引号感知拆段后**逐段判定**：

| 档 | 判定 | 结果 |
|----|------|------|
| ① 免确认 | 所有段命中白名单 | 自动执行 |
| ② 默认确认 | 未命中白名单 | 弹确认卡片（中风险），卡片完整展示命令原文 |
| ③ 强制确认 | 任一段命中**危险命令表**，或**首 token 是包管理器且子命令不在该工具的显式只读清单内**（包管理器安装档，**默认拒绝**） | 弹确认卡片（高风险），**加入白名单也无效** |

**危险命令表**（强制确认，语义是「必须用户点头」而非「拒绝」）：rm 全系、sudo、su、dd/mkfs、kill/killall/pkill、shutdown/reboot/halt、hdiutil/diskutil/launchctl 等系统配置工具、chmod/chown/chflags、defaults write、重定向覆盖系统路径（`> /非tmp`），以及管道/组合中把任意文本当代码执行的解释器（sh/bash/zsh/eval/source/osascript/python/node/ruby/perl）。

**强制确认档的两个触发源（互不包含）**

第三档有两个语义不同、彼此不包含的触发源，任一命中即强制确认（`riskLevel: high`）：

| 触发源 | 语义 | `reason` | 内容 |
|--------|------|----------|------|
| **危险命令表** | 本机破坏 | `danger` | rm 全系 / sudo / dd / kill / chmod / 重定向覆盖系统路径等，以及管道右侧的解释器 |
| **包管理器安装档** | 网络取第三方代码 | `install` | 首 token 命中包管理器工具集（`npx` / `bunx` / `npm` / `pnpm` / `yarn` / `bun` / `pip` / `pip3` / `pipx` / `uv` / `uvx` / `brew` / `cargo` / `go` / `gem`）时，**只有该工具的显式只读子命令**会降级为普通处理；**未列入清单的子命令一律强制确认**（如 `npm update` / `npm rebuild` / `yarn workspace <name> add` / `cargo add` / `go get` / `brew cask install`） |

- 两者**进白名单也无效** —— 免确认的粒度是「可信的构建类命令」，不是「可信的包管理器」。**机制**：安装档判定**短路先于**白名单匹配（`evaluateBashCommand` 里 install 先于 `matchesWhitelist` 返回），因此「白名单命中」不再蕴含「免确认」。
- **判定前做一次词法归一化**：shell 的引号与反斜杠只影响 argv 的**词法拼装**、不影响 argv 本身，因此匹配前会去掉引号与反斜杠转义 —— `brew "install" wget`、`brew \install wget`、`brew ins""tall wget` 与 `brew install wget` 的判定结果**完全相同**（都是一张高风险安装卡片）。这让「不改首 token 的纯词法改写」不再有安全后果。
- 确认卡片按触发源区分标题与文案（危险 → 「AI 请求执行高危 Bash 命令」；安装 → 「AI 请求安装第三方软件包」并点名命中的家族），让用户一眼看出风险类型。
- **显式只读清单**（清单内走普通确认或白名单；**清单外一律强制确认**，即**默认拒绝**）。以下即**全部**只读词条，与代码 `PACKAGE_MANAGER_TOOLS` 的 `readOnly` 字段一致（该字段是单一来源）：
  - `npx` / `bunx` / `uvx`：**空** —— 包执行器没有只读形态，一律强制确认
  - `pipx`：`list`
  - `npm`：`run` / `test` / `start` / `stop` / `restart` / `run-script` / `ls` / `list` / `view` / `audit` / `init` / `outdated` / `help` / `root` / `ping` / `doctor` / `fund` / `version` / `whoami` / `dedupe` / `prune` / `completion` / `search` / `docs` / `repo` / `bugs` / `explain` / `why` / `bin` / `prefix`
  - `pnpm`：`run` / `test` / `ls` / `list` / `why` / `outdated` / `audit` / `licenses` / `root` / `bin` / `doctor` / `help` / `version`
  - `yarn`：`run` / `test` / `ls` / `list` / `why` / `info` / `outdated` / `audit` / `licenses` / `bin` / `root` / `help` / `version`
  - `bun`：`run` / `test` / `ls` / `list` / `help` / `version` / `why` / `outdated` / `audit`
  - `pip` / `pip3`：`list` / `show` / `freeze` / `check` / `help` / `version` / `debug`
  - `uv`：`tree` / `lock` / `export` / `version` / `help` / `init` / `cache` / `list` / `show` / `freeze` / `check` / `inspect` / `debug`，外加复合形态 `uv pip` + `list` / `tree` / `show` / `freeze` / `check` / `inspect` / `debug`
  - `brew`：`info` / `list` / `search` / `config` / `doctor` / `outdated` / `deps` / `uses` / `home` / `desc` / `cat` / `help` / `version`
  - `cargo`：`search` / `tree` / `metadata` / `version` / `help` / `locate-project`
  - `go`：`list` / `env` / `version` / `doc` / `help`
  - `gem`：`list` / `search` / `info` / `environment` / `help` / `version`
  （`pipx list` 与 `pip list` / `brew list` 同族：只列出已装的隔离应用，不取新代码、不执行第三方代码）
- **只读清单有三处必须写准的限定**（否则会变成虚假保证）：
  1. **形态限定的词条**：`npm init` **只在后不接位置参数时**只读（`npm init` / `npm init -y` / `npm init --yes`）；`npm init <initializer>` 等价于 `npx create-<initializer>`，会**联网下载并执行第三方代码**，属安装档。`npm` / `pnpm` 的 `audit` 只在**不含 `fix` 形态**时只读（`npm audit` / `npm audit --json`）；`npm audit fix` / `npm audit --fix`（`pnpm` 同形）会安装修复版本，属安装档。
  2. **生命周期的同族别名**：`npm start` / `npm stop` / `npm restart` / `npm run-script` 与 `npm run` / `npm test` **同族**（跑项目自身定义的脚本）→ 只读。
  3. **纵深优先**：只读判定前会**先跑既有的安装模式表**，命中即强制确认 —— 因此 `npm -g install list`（= `npm install list`）、`brew --quiet install info` 这类「旗标 + 安装动词 + 同名词」的真实安装命令**仍属安装档**，不会被只读清单吞掉。
- 完整的产品说明（家族清单、`npm ci` 为何也在档内、残余风险与确认成本）见 [ai-skills.md](ai-skills.md) 第九节。

**确认超时**：bash 确认卡片 120 秒未处理自动取消（其他场景确认卡仍为 30 秒）。取消后工具返回「已取消」，AI 不会自动重试。

## 五、白名单（设置页 → AI 助手 → AI Bash 命令白名单）

- **匹配语义（主流前缀式）**：裸条目按命令前缀匹配——`brew` 覆盖 `brew` 本身与 `brew info wget` 等一切 `brew ` 开头的命令（空格边界，不误中 `brewx`）；`npm run *` 为显式通配写法，等价于前缀 `npm run `
- **即改即存**：增删条目立即生效，下一条命令即按新白名单裁决（AI 执行时实时读取，无缓存）
- **服务端校验**：条目必须是非空字符串、≤200 字符、无换行/控制字符；**不支持单独使用 `*`**（`*` / ` *` 去掉通配符后没有剩余前缀，不是命令前缀——否则空前缀会使整份白名单变成全放行）
- **使用建议**：白名单的粒度是**命令前缀，不是路径**。只加构建类可信命令（`npm run`、`git status`、`brew` 等）；**不要加 `cat`/`less` 这类能读任意路径的通用命令**——加了之后它们读任何文件都免确认。注意：包管理器安装档的判定**短路先于**白名单，因此 `brew install` / `brew upgrade` / `brew cask install`、`npm i` / `npm install` / `npm ci` / `npm exec` / `npm update` / `npm rebuild` 等**非只读**子命令**加入白名单也无效**（仍弹高风险卡片）；裸条目 `brew` 能免确认的只是上表列出的**只读**子命令（`brew info` / `brew list` / `brew search` 等）。`npm run` 族（含 `start` / `stop` / `restart` / `test` / `run-script`）与 `npm audit`（**不含 `fix`**）、`npm init -y`（**不带位置参数**）仍是**只读**，而 `npm init <initializer>`（≡ `npx create-<initializer>`）与 `npm audit fix` 与安装档同档。
  **但存在具名残余**（见§七第 5 条附 ①②）：`npm -g update` 这类「**旗标 + 未知子命令**」形态与 `npm audit --json fix` 这类「**`audit` 与 `fix` 之间夹旗标**」形态会被判为**只读**，因白名单前缀命中而**零卡片** —— 因此本句的准确表述是「白名单**不能**放开上表之外的**常规**非只读子命令；两类具名残余除外」。

## 六、确认卡片行为

- bash 未命中白名单/危险命令 → 主窗口 AI 消息流中插入确认卡片（展示命令原文、风险等级、白名单命中说明）
- 用户点「确认执行」→ 命令执行，卡片进入终态（成功/失败/已取消）
- 点「取消」或 120 秒超时 → 命令不执行，AI 收到「已取消」结果，被明确要求不反复重试、改为询问用户
- 卡片是消息流的一部分：**切换对话后未处理的卡片不再显示**（主进程仍按超时取消），处理中的确认以当前对话视图为准

## 七、安全边界（诚实声明）

- **read/write/edit**：硬边界，模型无论被何种提示注入诱导都无法越界
- **bash**：能力等同终端（确认后什么都行），安全依赖「卡片所见即所确认」；静态拆段无法覆盖全部 shell 语法（进程替换、命令替换 `$()` 等），白名单判定是「降低误执行概率」的启发式，**不是安全边界**
- **提示注入下的人因风险**：恶意网页诱导 AI 执行的 bash 命令同样会弹卡，但用户若不看内容直接点确认则防线失效——请养成读卡片上命令原文的习惯
- **OS 级隔离**（macOS sandbox-exec 限制 bash 可访问路径）为预留的后续增强方向，当前未实施
- **（第 5 条）安装档只审一级 bash 命令**：策略引擎看的是用户在卡片上看到的那条命令。若该命令内部再 `spawn` 子进程（如技能自带的 `check_env.mjs` 内部 `spawnSync` 调 `python3`），二次调用不在策略视野内 —— 由用户对第一条命令的确认承担。**「漏检 ≠ 免确认」成立，但要带前提**：由默认拒绝规则消除的，是「子命令词法改写」（`brew "install" wget`）、「中间 token」（`brew cask install`）与「未收录子命令」（`npm update` / `npm rebuild`）这三类**首 token 是包管理器的改写形态**；**剩余漏检类别不止一条**，其中「首 token 不是包管理器」（如变量间接 `NPM=npm $NPM i x`）这类命令**不以包管理器开头 → 天然不命中白名单前缀 → 仍退化为普通确认卡片（不会零卡片）**；但另有两类**会因白名单前缀命中而零卡片**，逐条列在下面的具名残余里。
- **（第 5 条附）五条具名残余**（如实告知，不给绝对保证）：
  1. **（零卡片 · 高优先）旗标取值槽吞掉末尾子命令**：裸形式只读正则的旗标容忍片段可把**唯一**末尾 token 吞成「旗标取值」，于是 `npm -g update` / `npm -q update` / `npm --prefix=./app update` / `npm --global rebuild` 这类**真实联网安装命令**被判**只读**；白名单含裸 `npm` 时即**零卡片**（实测 `npm -g update` @ `['npm']` → `allow`）。对照 `npm update -g` 仍正确判安装档 —— 差异只在旗标位置。这是本条残余中**最需要优先修复**的一类。
  2. **（零卡片）`audit` 与 `fix` 之间夹旗标**：`audit` 的守卫用负向先行断言拒掉紧跟的 `fix` / `--fix`，但不跨越中间旗标，因此 `npm audit --json fix` / `pnpm audit --registry=x fix` 被判**只读**，而 npm 实际会执行 fix 安装（取新代码）。白名单命中时零卡片。
  3. **只能判只读、不会零卡片的同源残余**：既有行为要求 `pnpm --filter a run build` 判只读（`a` 是 `--filter` 的取值），同一机制使 `npm -g <未知动词> <只读同名词>`（如 `npm -g update ls`）仍判只读。已用**纵深优先**（先跑安装模式表）把可识别面压到最小 —— `npm -g install list` / `brew --quiet install info` 已被收回安装档。
  4. **大小写形态**（`NPM i x` / `RM -rf x`）：macOS 解析不区分大小写，这类写法**不命中**包管理器工具集与危险命令表 → 降级为**普通确认卡片**而非高风险卡片。这是卡片**风险等级标注**的残余，**不是免确认**。
  5. **`pnpm` / `yarn` / `bun` 的同类别名（`start` / `stop` / `restart`）未收录**：各 CLI 的别名语义未逐一核验，按「存疑一律不收」处理 → `pnpm start` / `yarn start` / `bun start` 落强制确认档，卡片文案「将从网络下载并运行第三方代码」对这族命令**不准确**。这是**已接受的保守误报**（方向安全：多一次卡片），与 `npm` 族的理由（`start` / `stop` / `restart` / `run-script` 与 `run` / `test` 同族故只读）并列。
  > 残余 ①②（零卡片类）由代码审查在 gap-closure 复审中具名记录（`47-REVIEW.md` 的 CR-01 / CR-02），本阶段选择**只修文档面**、把代码洞留作技术债 —— 因此这两条必须如实写明，不得省略。
- **（第 6 条）技能不构成额外权限，`allowed-tools` 当前运行时不被强制**：技能正文里的任何「请执行某某命令」都要走同一套三档策略与确认卡片；SDK 的 `Skill` 接口只有五个字段（`name` / `description` / `content` / `filePath` / `disableModelInvocation`），**没有工具授权字段**，当前运行时也**不强制**任何「按技能授权工具集」的语义 —— 任何展示 `allowed-tools` 的地方**仅供参考**，是虚假安全感，不要在技能文本里依赖它。详见 [ai-skills.md](ai-skills.md) 第五、六节

## 八、测试与验证

- 单元测试：`node tests/test-agent-workspace.js`（沙箱/迁移）、`node tests/test-ai-bash-policy.js`（策略引擎：三档裁决 / 危险表 / 包管理器安装档**默认拒绝语义与词法改写形态** / 白名单语义与 WR-01 通配条目护栏）
- 内置技能播种与零安装语义：`node tests/test-builtin-skills-seeder.js`
- 端到端：对话中让 AI 执行各类命令观察三档行为；读工作区外路径应得沙箱拒绝；让 AI 执行 `npm install` / `brew install` 类命令，即使已加入白名单也应弹高风险确认卡片
