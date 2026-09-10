# Requirements: Realm Browser — v2.6 AI 助手技能（Skill）能力

**Defined:** 2026-09-10
**Core Value:** 容器间数据完全隔离 — 每个容器的 Cookie、存储、缓存互不干扰，同时支持 Cookie 文件持久化和自动加载。
**Research:** `.planning/research/SUMMARY.md`（HIGH confidence）

**设计基线（已拍板）:**
- 双目录：`agent-workspace/skills/`（用户，source=`user`，最高优先级）> `agent-workspace/managed-skills/`（seeded 内置 + AI 自建，source=`managed`），tier 只有 2 层（不引入 oh-my-pi 的 7 层 provider priority）
- 内置 find-skills **彻底去 CLI 化**（不得出现任何「执行外部安装」语义）；skill-creator **仅保留作者指南部分**
- zip 导入 = **单技能包**语义（包内必须恰好一个技能根）
- `allowed-tools` **解析但标注「当前运行时不被强制，仅供参考」**，执行层门禁明确 Out of Scope

## v1 Requirements

Requirements for v2.6. Each maps to roadmap phases.

### SKILL — 技能基础设施（目录 + 沙箱 + 加载 + 注入）

- [ ] **SKILL-01**: `agent-workspace` 启动时自动创建 `skills/` 与 `managed-skills/` 两个子目录，且两者位于硬沙箱 root 内可达（`resolveInside` 放行）
- [ ] **SKILL-02**: 系统提示词动态注入 `<available_skills>` 段（含 name / description / location），无技能时该段为空（不注入空标签）
- [ ] **SKILL-03**: 技能加载异步完成后同步可读（模块级缓存 + 同步访问器），两处 Agent 创建点（`init()` / `_recreateAgent()`）均在构造 Agent **之前**完成加载
- [ ] **SKILL-04**: 技能集变更后（安装 / 卸载 / 启用禁用 / `manage_skill` / Agent 重建）刷新 Agent 的 system prompt 且**不重建 Agent**；变更经跨窗口广播同步各窗口
- [ ] **SKILL-05**: 用户技能与 managed 技能同名时用户技能遮蔽 managed（user > managed），去重发生在注入之前；同名冲突对用户可见
- [ ] **SKILL-06**: 技能加载诊断（非法 name / 超长 description / YAML 解析失败）透传到设置页，不静默失败
- [ ] **SKILL-07**: 技能资源限额集中定义并生效（SKILL.md 正文字节上限、用户技能数量上限、prompt 段字符预算），超限时给出「哪个限额 / 当前值」的可操作提示
- [ ] **SKILL-08**: 用户可对单个技能启用/禁用（存储于设置，加载后过滤，**不删文件**）
- [ ] **SKILL-09**: 技能自带 `scripts/` 目录可通过既有 bash 工具在沙箱内执行（复用既有白名单 + 确认卡片，**零新增权限机制**）

### DISC — 技能发现与调用

- [ ] **DISC-01**: 用户在聊天输入框输入 `/` 时，面板列出全部已启用技能与既有本地命令，可按名称实时过滤
- [ ] **DISC-02**: 用户可选择技能并以 `/skill:name [args]` 形式调用，技能正文经 `formatSkillInvocation` 作为 `<skill>` 块注入对话
- [ ] **DISC-03**: 技能调用**进入对话历史并触发 LLM**（与既有本地斜杠命令 `clear`/`compact` 语义区分，作为第二命令源而非本地 handler）
- [ ] **DISC-04**: 技能列表区分来源（user / managed / seeded）并以徽标展示；被遮蔽的同名技能可见
- [ ] **DISC-05**: 模型可根据 description 自动匹配技能并读取其正文（经 `read` 工具读取 SKILL.md 的 location）
- [ ] **DISC-06**: 调用不存在的技能给出明确错误提示，不出现「点了没反应」
- [ ] **DISC-07**: `disable-model-invocation` 的技能不进 system prompt 列表，但仍可经 `/skill:` 显式调用并在 UI 打标

### MGMT — AI 自建技能（manage_skill）

- [ ] **MGMT-01**: AI 拥有 `manage_skill` 工具，支持 `create` / `update` / `delete` 三个动作
- [ ] **MGMT-02**: `manage_skill` **不接受 `path` 参数**，只接受 `name`（`^[a-z0-9-]+$`）与 `content` / `description`；路径由 manager 用 `path.join` 计算
- [ ] **MGMT-03**: 服务端对 name / description / 正文字节上限做二次校验（LLM 参数不可信）；写入走原子写（经沙箱 `env.renameFile` 获得双基准路径校验）
- [ ] **MGMT-04**: seeded 内置技能不可被 AI 覆盖或删除（按**播种登记表**判定，而非按目录位置）
- [ ] **MGMT-05**: `manage_skill` 成功后刷新技能集与 Agent system prompt
- [ ] **MGMT-06**: 工具描述引导 AI「优先增强已有技能，而非创建近乎重复的新技能」

### USER — 用户技能管理（设置页 + 导入）

- [ ] **USER-01**: 设置页 AI 分区新增「技能管理」区，列出技能的名称 / 描述 / 来源 / 体积 / 文件数 / 诊断
- [ ] **USER-02**: 设置页可启用 / 禁用 / 卸载技能
- [ ] **USER-03**: 用户可通过上传 **zip 包**导入技能（单技能包语义；0 个或多个技能根 → 报错并提示）
- [ ] **USER-04**: 用户可通过**网络地址**导入技能，自动分流 GitHub 仓库/目录地址 与 SKILL.md 直链
- [ ] **USER-05**: 导入采用两阶段（预览 → 确认落盘），预览展示名称 / description 原文 / 目录树 / 字节数 / 脚本清单（标红）/ 威胁扫描结论
- [ ] **USER-06**: 卸载仅允许 `source === 'user'` 的技能（手改 URL 不得删内置技能）
- [ ] **USER-07**: 设置页经 `/api/skills/*` + token 访问（webview guest 无 realmAPI）；主窗口经 `realmAPI` IPC——同一后端权威、两个前端入口
- [ ] **USER-08**: 导入失败给出真实原因（命中哪个限额 / 扫描结论 / 校验错误），不静默

### SEED — 内置技能播种

- [ ] **SEED-01**: 随包内置 find-skills（Realm 化改写版）与 skill-creator（仅作者指南部分）两个技能
- [ ] **SEED-02**: 首次启动幂等播种到 `managed-skills/`（版本戳登记表，沿用 `migrateAiMemory` 先例）
- [ ] **SEED-03**: 内置技能文本**不含任何「执行外部安装」语义**（无 `npx` / `npm i` / `curl | sh` / `-y` / `-g`）；find-skills 引导模型输出候选清单 + 用户在设置页一键导入
- [ ] **SEED-04**: 内置技能默认 `disable-model-invocation: true`（避免其名称与描述无条件占据每次请求的 system prompt）
- [ ] **SEED-05**: 内置技能随包分发正确（`asarUnpack` + `app.isPackaged` 路径分支），并携带各自 LICENSE 与 `THIRD_PARTY_NOTICES` 归属（来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明）

### SEC — 安全加固

- [ ] **SEC-01**: `ai-bash-policy` 新增「包管理器安装」档：`npx` / `npm i` / `pnpm add` / `pip install` / `brew install` 强制确认，**白名单不可越过**
- [ ] **SEC-02**: zip 解压**拒绝含 symlink entry 的整包**（读 central directory 属性判定 + 解压后递归 `lstat` 复核整棵树），而非跳过单条
- [ ] **SEC-03**: 逐 entry 路径校验：`..` 段（`path.posix.normalize` 后判）/ 绝对路径 / 盘符 / UNC / 反斜杠 / NTFS ADS / 控制字符 / 尾随空格与点；并对全量 entry 名做 NFD+小写归一化查重（大小写与 Unicode 冲突即拒绝整包）
- [ ] **SEC-04**: 解压先读 central directory 的 `uncompressedSize` 预检，再边解边累加；限额覆盖单 entry 字节、累计字节、entry 数、压缩比、嵌套深度
- [ ] **SEC-05**: 解压到 `fs.mkdtempSync` 创建的全新空目录（保证前缀内不可能有预埋链接）；落点复核使用**最近已存在祖先的 realpath**，而非仅依赖 `resolveInside`
- [ ] **SEC-06**: 导入时同时扫描 `description` 与 body：复用 `scanInjectionPatterns`，并新增技能域 `SKILL_THREAT_PATTERNS`（文件外发 / 凭据回显 / 诱导跳过确认三类）
- [ ] **SEC-07**: 与内置技能同名 → 拒绝导入；与已有用户技能同名 → 显式策略（覆盖 / 改名 / 取消），不静默覆盖
- [ ] **SEC-08**: 网络导入 https-only + 主机白名单 + 逐跳 `isPrivateHost` 校验 + 流式字节上限 + magic bytes 校验；**不复用** `search-manager.fetchUrl`（它会把内容转 Markdown，对二进制是破坏性的），复用其 SSRF 判据
- [ ] **SEC-09**: `readJsonBody` 增加体积上限（防 zip base64 放大无上限）
- [ ] **SEC-10**: 加固既有沙箱 `writeFile` 的 ENOENT symlink 缺口（与导入路径同一根因，一次修完）

### DOC — 产品文档同步（AGENTS.md 强制约定）

- [ ] **DOC-01**: 新建 `docs/product/ai-skills.md` 产品说明（能力、双目录、优先级、限额、安全边界、已知限制）
- [ ] **DOC-02**: 同步 `docs/product/ai-agent-workspace.md`（技能不构成额外权限、`allowed-tools` 不被强制）与 `AGENTS.md`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### 技能生态

- **ECO-01**: 多技能 zip 包勾选安装（包内多个技能根时让用户选择）
- **ECO-02**: seeded 内置技能升级推送机制（内容 hash 判定未修改才覆盖 / 恢复内置技能按钮）
- **ECO-03**: `/compact` 保留技能正文（对齐 Claude Code 的 token 预算）
- **ECO-04**: `$ARGUMENTS` / `$N` 占位符替换、技能堆叠调用、mid-prompt 嵌入 `/skill:` token
- **ECO-05**: 技能四态可见性（Claude Code `skillOverrides` 语义）与 `hide` 语义
- **ECO-06**: 容器级技能作用域（技能按容器隔离展示）

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 应用内技能市场 / 排行榜 / 遥测 | 需要服务端与运营，非本期核心价值 |
| 多源发现（`~/.claude/skills`、plugins、7 层 provider priority） | 为 7 个异构来源设计的机制，Realm 只有 2 类来源，引入即纯负担 |
| 预加载技能正文进 system prompt | 违反渐进式披露，token 成本随技能数线性增长 |
| 动态 shell 注入 `` !`cmd` `` | 等价于远程代码执行，绕过既有确认卡片 |
| `allowed-tools` 执行层门禁 | SDK 的 `Skill` 类型根本无该字段；自建机制超出本期范围（解析+免责标注已覆盖） |
| 技能目录内捆绑 hooks / MCP / subagent | 扩大攻击面，且 Realm 无对应运行时 |
| 自动 nudge AI 创建技能 | 打断用户、消耗 token；改为 `manage_skill` 按需调用 |
| 技能文件热重载（chokidar / fs.watch） | 技能写入者只有本应用自己，变更路径确定性 reload 更可靠，且需求无热重载 |
| `context: fork` / subagent 评测循环 | 依赖 Realm 不具备的运行时（多 agent、Python、浏览器） |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SKILL-01..09 | TBD | Pending |
| DISC-01..07 | TBD | Pending |
| MGMT-01..06 | TBD | Pending |
| USER-01..08 | TBD | Pending |
| SEED-01..05 | TBD | Pending |
| SEC-01..10 | TBD | Pending |
| DOC-01..02 | TBD | Pending |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 0
- Unmapped: 47 ⚠️（roadmap 阶段填充）

---
*Requirements defined: 2026-09-10*
*Last updated: 2026-09-10 after initial definition*
