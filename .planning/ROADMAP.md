# Roadmap: Realm Browser

## Overview

Realm Browser 是一个多容器隔离浏览器，支持独立的 Cookie 管理、浏览历史记录、收藏夹、常用网站推荐和应用设置。每个容器完全隔离（Cookie、缓存、存储），已集成 AI Agent SDK，并在此之上逐步叠加 AI 联网搜索与抓取、历史对话、条目记忆，以及本地媒体库（嗅探 / 独立播放器 / 分片缓存 / 直播录制转封装）。

v2.6 把 AI 助手推进到**可扩展能力体系**：接入 pi-agent-core 原生 Skill 层，让技能目录落在 agent 工作区硬沙箱内、随包分发自审计过的内置技能、支持 `/skill:name` 显式调用与模型自动匹配、让 AI 用 `manage_skill` 自主创建技能，并提供 zip / 网络地址两条**经过恶意包加固**的用户导入通道。

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-25)
- ✅ **v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面** — Phases 5-9 (shipped 2026-07-26)
- ✅ **v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式** — Phases 10-12 (shipped 2026-07-27)
- ✅ **v1.3 右键菜单增强** — Phase 13 (shipped 2026-07-27)
- ✅ **v2.0 收藏夹文件夹支持 + AI Agent 集成** — Phases 14-21 (shipped 2026-08-01)
- ✅ **v2.1 AI CDP 增强 + Tabbrowser 功能集成** — Phases 22-25 (shipped 2026-08-04)
- ✅ **v2.2 多媒体功能集成** — Phases 26-29 (shipped 2026-08-11)
- ✅ **v2.3 浏览器基础功能补全** — Phases 30-33 (shipped 2026-08-14)
- ✅ **v2.4 多窗口支持** — Phases 34-39 (shipped 2026-08-24)
- ✅ **v2.5 AI 网络搜索功能** — Phases 40-45 (shipped 2026-09-10)
- 🚧 **v2.6 AI 助手技能（Skill）能力** — Phases 46-51 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-25</summary>

- [x] Phase 1: Core Container Management + Architecture Refactoring — completed 2026-07-23
- [x] Phase 2: Browser Core - URL Navigation + Multi-Tab — completed 2026-07-23
- [x] Phase 3: Data Isolation + Cookie Persistence — completed 2026-07-23
- [x] Phase 4: Convenience Features — completed 2026-07-24

</details>

<details>
<summary>✅ v1.1 容器属性增强 + 收藏历史 + 常用网站 + 设置页面 (Phases 5-9) — SHIPPED 2026-07-26</summary>

- [x] Phase 5: 容器属性扩展 — completed 2026-07-25
- [x] Phase 6: 浏览历史记录 — completed 2026-07-25
- [x] Phase 7: 收藏夹管理 — completed 2026-07-25
- [x] Phase 8: 常用网站推荐 + 设置页面 — completed 2026-07-25
- [x] Phase 9: 共享收藏数据库 — completed 2026-07-26

</details>

<details>
<summary>✅ v1.2 Cookie 管理增强 + 设置页面重构 + 开发者模式 (Phases 10-12) — SHIPPED 2026-07-27</summary>

- [x] Phase 10: Cookie 管理增强 — completed 2026-07-26
- [x] Phase 11: 设置页面重构 — completed 2026-07-27
- [x] Phase 12: 开发者模式 — completed 2026-07-27

</details>

<details>
<summary>✅ v1.3 右键菜单增强 (Phase 13) — SHIPPED 2026-07-27</summary>

- [x] Phase 13: 右键菜单增强 — completed 2026-07-27

</details>

<details>
<summary>✅ v2.0 收藏夹文件夹支持 + AI Agent 集成 (Phases 14-21) — SHIPPED 2026-08-01</summary>

- [x] Phase 14: 收藏夹文件夹 - 数据库层实现 — completed 2026-07-28
- [x] Phase 15: 收藏夹文件夹 - UI 交互 — completed 2026-07-28
- [x] Phase 16: 收藏夹文件夹 - 增强功能 — completed 2026-07-29
- [x] Phase 17: Chrome 书签导入 — completed 2026-07-30
- [x] Phase 18: 收藏栏功能 — completed 2026-07-30
- [x] Phase 19: AI Agent 集成 - 基础验证 — completed 2026-07-31
- [x] Phase 20: AI Agent 集成 - 核心功能 — completed 2026-08-01
- [x] Phase 21: AI Agent 集成 - 聊天 UI — completed 2026-08-01

</details>

<details>
<summary>✅ v2.1 AI CDP 增强 + Tabbrowser 功能集成 (Phases 22-25) — SHIPPED 2026-08-04</summary>

- [x] Phase 22: CDP 管理器扩展 + 基础网页操控工具 (5/5 plans) — completed 2026-08-02
- [x] Phase 23: 智能上下文引用 + 全文检索 (2/2 plans) — completed 2026-08-02
- [x] Phase 24: 任务自主执行 (4/4 plans) — completed 2026-08-02
- [x] Phase 25: 脚本生成 + 智能标签整理 (7/7 plans) — completed 2026-08-04

</details>

<details>
<summary>✅ v2.2 多媒体功能集成 (Phases 26-29) — SHIPPED 2026-08-11</summary>

- [x] Phase 26: 视频源检测 + IPC 基础 (2/2 plans) — completed 2026-08-06
- [x] Phase 27: 媒体面板 (2/2 plans) — completed 2026-08-07
- [x] Phase 28: 播放器窗口 (2/2 plans) — completed 2026-08-08
- [x] Phase 29: 多媒体播放器设置控制 (5/5 plans) — completed 2026-08-08

</details>

<details>
<summary>✅ v2.3 浏览器基础功能补全 (Phases 30-33) — SHIPPED 2026-08-14</summary>

- [x] Phase 30: 下载管理器 — 核心引擎 (2/2 plans) — completed 2026-08-11
- [x] Phase 31: 下载管理器 — 用户交互 (3/3 plans) — completed 2026-08-12
- [x] Phase 32: 自动填充 — 凭据引擎 (2/2 plans) — completed 2026-08-13
- [x] Phase 33: 自动填充 — 增强 + Bug 修复 (3/3 plans) — completed 2026-08-14

</details>

<details>
<summary>✅ v2.4 多窗口支持 (Phases 34-39) — SHIPPED 2026-08-24</summary>

- [x] Phase 34: 窗口管理基础 (4/4 plans) — completed 2026-08-16
- [x] Phase 35: Tab 窗口关联 (3/3 plans) — completed 2026-08-15
- [x] Phase 36: Tab 拖拽与跨窗口移动 (3/3 plans) — completed 2026-08-15
- [x] Phase 37: 地址栏地址补全功能 (2/2 plans) — completed 2026-08-21
- [x] Phase 38: AI 助手供应商管理 (3/3 plans) — completed 2026-08-23
- [x] Phase 39: Vimium 键盘操作功能 (4/4 plans) — completed 2026-08-24

</details>

<details>
<summary>✅ v2.5 AI 网络搜索功能 (Phases 40-45) — SHIPPED 2026-09-10</summary>

- [x] Phase 40: 搜索基础设施 + web_search 工具 (3/3 plans) — completed 2026-08-28
- [x] Phase 41: web_fetch 工具 + 搜索配置 UI (2/2 plans) — completed 2026-08-27
- [x] Phase 42: AI 历史对话管理功能 (6/6 plans) — completed 2026-09-02
- [x] Phase 43: AI 记忆系统集成（条目记忆 MVP） (5/5 plans) — completed 2026-09-04
- [x] Phase 44: 播放器视频缓存与本地媒体库 (18/18 plans) — completed 2026-09-10
- [x] Phase 45: B 站直播 fMP4 转录支持 (4/4 plans) — completed 2026-09-08

</details>

### 🚧 v2.6 AI 助手技能（Skill）能力 (In Progress)

**Milestone Goal:** 让 Realm AI 助手具备符合 Anthropic Agent Skills 开放规范的技能发现、调用、创建与管理能力——用户可 `/` 唤出技能、可导入自己的技能，AI 可自主查找与创建技能。

**Execution Order:** 46 → 47 → 48 → 49 → 50 → 51

**Granularity note:** `granularity: coarse` 允许合并 46+47 与 48+49；本路线图**刻意保留 6 个阶段**，因为每个 S1 门禁需要独立归属与独立验收面（P1 归 47、P2/P4 归 51、P3 拆到 46 与 51），合并会让门禁与"同阶段交付"的硬约束互相遮蔽。

**Hard ordering（不可调换）:**

1. 技能目录必须先落入 agent 工作区沙箱（46）——否则模型看得到 `location` 却永远 `read` 不到，静默失效。
2. `manage_skill`（49）必须先于任何其他写入路径（设置页 50 / 导入 51）——name / description / 大小 / 注入校验只能有一份实现。
3. bash「包管理器安装」档必须与内置技能播种同阶段（47）——否则 P1 门禁形同虚设。
4. 导入管线排最后（51）——攻击面最大、耦合最小，风险不外溢。

- [x] **Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入）** - 双目录进沙箱 + `<available_skills>` 注入 + 技能集变更即时生效 (completed 2026-09-11)
- [x] **Phase 47: 内置技能播种 + bash 策略加固** - find-skills / skill-creator 去 CLI 化随包分发 + 包管理器安装档强制确认 (completed 2026-09-11)
- [ ] **Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`）** - `/` 面板并入技能列表 + 显式调用进对话历史 + 模型按 description 自动匹配
- [ ] **Phase 49: `manage_skill` 工具（AI 自建技能）** - create / update / delete + 不吃 `path` 参数 + seeded 边界保护
- [ ] **Phase 50: 设置页技能管理区 + `/api/skills/*`** - 列表 / 诊断 / 启停 / 卸载 + 双入口同一权威
- [ ] **Phase 51: 用户技能导入管线（zip + 网络地址）** - 两阶段预览 + 恶意包整包拒绝 + 网络导入 SSRF 防护

## Phase Details

### Phase 46: 技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入）

**Goal**: AI 助手每次请求都能看到位于硬沙箱内、可被 `read` 工具读取的技能清单；技能集变更即时生效，同名冲突与加载诊断不静默。
**Depends on**: Nothing (v2.6 首个阶段)
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05, SKILL-06, SKILL-07, SKILL-08, DOC-01
**Success Criteria** (what must be TRUE):

  1. 应用启动后 `agent-workspace/skills/` 与 `agent-workspace/managed-skills/` 自动存在，且 AI 的 `read` 工具能在沙箱内成功读取其中任意 `SKILL.md`（不再出现"看到 location 却读不到文件"的静默失效）。
  2. 技能集非空时 system prompt 含 `<available_skills>`（name / description / location）；无技能时该段完全为空（不注入空标签）。
  3. 安装 / 卸载 / 启用禁用 / `manage_skill` 变更后，无需重启应用或重建 Agent，下一条消息即按新技能集生效，且变更经广播同步到其他窗口。
  4. 用户技能与 managed 技能同名时 user 版本胜出、managed 版本被遮蔽，冲突对用户可见（不静默去重）。
  5. 非法 name / 超长 description / YAML 解析失败 / 超限的技能不静默消失：产出含"哪个限额、当前值"的可读诊断，可被上层读出。

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 46-01-PLAN.md — tracer 端到端纵切（目录 → 沙箱加载 → 缓存 → prompt 第 4 段 → 可 read）+ 加载面收窄薄 env + SKILL-01/02/03 断言

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 46-02-PLAN.md — 加载后管线：契约布局过滤 / 名称目录名权威重写（杜绝冒名）/ 同名遮蔽去重（SKILL-05/06）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 46-03-PLAN.md — 诊断合并与双层降级 / 三限额生效与确定性定序 / 启停只过滤不删文件（SKILL-06/07/08）

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 46-04-PLAN.md — Agent prompt 回写（D-03）与 P8 失效链 / P8 门禁映射表 / DOC-01 产品文档骨架

**Security gate**: P8（S2，阻断门禁）技能缓存失效链。**本阶段只存在并交付其中 3 个触发点**：① `init()` Agent 创建点、② `_recreateAgent()` Agent 创建点、⑥ bash/write 工具直改 `skills/`（以"每次 Agent 重建都无条件重扫一次"兜底）。其余 3 点（`/` 面板列表 → 48、设置页导入/卸载 → 50/51、`manage_skill` 三动作 → 49）在本阶段**尚无写路径**，按 46-04 的 `<p8_gate_mapping>` 逐点交接给对应阶段，**不得声称 6 点全覆盖**。本阶段的机制断言：`ai-manager.js` 每个 `new Agent(` 之前 60 行内必须存在 `refreshSkills(`（**创建点覆盖断言**；`syncAgentSystemPrompt()` 等非创建点调用不参与判定 —— **不得**改写成「`refreshSkills(` 与 `new Agent(` 调用次数相等」）。漏接线即红。
**Doc sync**: 本阶段新建 `docs/product/ai-skills.md`（能力 / 双目录 / 优先级 / 限额 / 沙箱边界 / 已知限制骨架）；后续阶段按 AGENTS.md 维护约定增量补齐各自章节。

### Phase 47: 内置技能播种 + bash 策略加固

**Goal**: 随包分发的两个内置技能可用且不含任何"执行外部安装"语义；包管理器安装命令不再可能被白名单免确认。
**Depends on**: Phase 46
**Requirements**: SKILL-09, SEED-01, SEED-02, SEED-03, SEED-04, SEED-05, SEC-01, DOC-02
**Success Criteria** (what must be TRUE):

  1. 首次启动后 `managed-skills/` 出现 find-skills 与 skill-creator 两个技能，技能加载器识别其 name / description 且零诊断；播种按**单个技能目录**粒度**无条件覆盖**（内容一致时 `detectDiff` 判 `same` → 零差异、零诊断，重启不重复写），用户手改 `managed-skills/<name>/` 时先产 `realm_builtin_seed_overwritten`（warning）诊断**再**覆盖为随包版本（不静默、但不阻断覆盖），用户手删后下次启动**自愈重播**；「停用某内置技能」的唯一语义是设置页禁用（`settings.aiSkills.disabled`），定制走 `skills/` 同名遮蔽。
  2. 内置技能全文不含 `npx` / `npm i` / `curl | sh` / `-y` / `-g` 等"执行外部安装"语义；find-skills 只输出候选清单并引导用户到设置页一键导入。
  3. `npx` / `npm i` / `pnpm add` / `pip install` / `brew install` 无论是否在白名单内，执行前都必须弹出确认卡片（白名单不可越过）。
  4. 技能自带 `scripts/` 可以在沙箱内经既有 bash 工具执行（复用既有白名单 + 确认卡片，零新增权限机制）。
  5. 打包后正式 .app 中两个内置技能可被正确加载（`asarUnpack` + `app.isPackaged` 路径分支生效），且 `THIRD_PARTY_NOTICES` 记录来源仓库 + 固定 commit SHA + 许可证 + 是否修改及修改说明。

**Plans**: 6/6 plans executed
**Wave 1**

- [x] 47-01-PLAN.md

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 47-02-PLAN.md
- [x] 47-03-PLAN.md

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 47-04-PLAN.md — ✅ **完成（3/3 任务）**：打包排除项 + DOC-02 文档同步（`22774ca` / `3b3940b`）+ **打包后正式环境实跑验证（SEED-05 收口）**。Task 3 经用户显式授权走 Nightly 路线（`make install-nightly`，不触碰生产 bundle），实测取得：unpacked 面（两个 `SKILL.md`）、安装产物 asar 清单面（`.planning`/`.claude`/`.gsd`/`.wzsh`/`.zcode`/`test`/`tests`/`scripts` 全 0、无 `*.bak`、`skills-builtin/` 与 `THIRD_PARTY_NOTICES.md` 在列）、运行期播种面（`realm-nightly/.../managed-skills/` 两技能齐备）、进程内加载面（`isPackaged:true`、`_cache.diagnostics/errors` 均空、`buildSkillsPrompt()===''`）+ 幂等（`detectDiff==='same'`、无覆盖诊断）+ 自愈（手删重播）。research 假设 A2 实测结论：`make install-nightly` **继承**（不覆盖）`package.json` 的 `build.asarUnpack`。`47-04-SUMMARY.md` 的 `status: complete`

**Security gate**: P1（S1，阻断门禁）npx RCE 向量；P10（发布门禁）内置技能许可证归属义务。
**Gap closure**（`47-VERIFICATION.md` 判 `gaps_found` 68/71 后的收敛计划，`gap_closure: true`）

- [x] 47-05-PLAN.md — **GAP 1 / CR-01（blocker）**：安装档从「子命令黑名单」改为「首 token 是包管理器 → 默认强制确认，仅显式只读子命令降级」+ 两侧共用词法归一化（去引号 + 去反斜杠转义），关闭 `brew "install" wget` 等词法改写与 `npm update` / `cargo add` / `go get` / `yarn workspace … add` / `brew cask install` 两个绕过家族；补齐 `bunx` / `pipx`；三份文档 + `AGENTS.md` 的「白名单不可越过安装档 / 漏检 ≠ 免确认」改为**有前提且为真**的表述（含 REVIEW WR-01 的 `['*']` 条目护栏）
- [x] 47-06-PLAN.md — **GAP 2/3/4**（播种健壮性）：`diff === 'same'` 跳过重写（不再每次启动整目录重建 / 白算 sha256 / 制造 `rename` 空窗）+ 目录项参与差异判定（空目录仍自愈）；启动级清扫 `.tmp_*` / `.bak_*` 残留（消除被加载成永久幽灵技能的路径）；播种诊断按级别统一 `console.error` / `console.warn` 输出（含源缺失的早退路径，消除正式版静默失败）

**Research needed**: find-skills 彻底去 CLI 化的改写方案需产品决策 + 许可证文本法务式复核——每一行都要按"这段文字被模型执行后会做什么"逐句评审。
**Doc sync**: `docs/product/ai-agent-workspace.md` 与 `AGENTS.md` 明确写出「技能不构成额外权限」「`allowed-tools` 当前运行时不被强制，仅供参考」；`docs/product/ai-skills.md` 补内置技能与 bash 档章节。

### Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`）

**Goal**: 用户可在聊天输入框用 `/` 发现技能、以 `/skill:name` 调用；模型也能按 description 自动匹配技能并读取其正文。
**Depends on**: Phase 46（Phase 47 播种的内置技能经同一技能集自动进入列表）
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-07
**Success Criteria** (what must be TRUE):

  1. 输入 `/` 后面板同时列出既有本地命令与全部已启用技能，可按键名实时过滤。
  2. 选择技能以 `/skill:name [args]` 调用后，技能正文作为 `<skill>` 块注入对话、进入对话历史并触发 LLM 回复（与本地 `clear` / `compact` 语义明确区分，是第二命令源而非本地 handler）。
  3. 列表按来源（user / managed / seeded）打徽标，被遮蔽的同名技能可见。
  4. 模型可仅凭 description 自动匹配技能并通过 `read` 打开其正文（用户不显式调用也能生效）。
  5. 调用不存在的技能给出明确错误提示（不出现"点了没反应"）；`disable-model-invocation` 技能不进 system prompt 但可经 `/skill:` 显式调用且在 UI 有标记。

**Plans:** 3/3 plans executed

Plans:
**Wave 1**

- [x] 48-01-PLAN.md — `/skill:name` 主进程端到端纵切（解析 → 实时读盘 → `<skill>` 块组装 → 注入 → 重载还原）+ 收窄投影与三档 tier + 两个面板 IPC 通道 + 气泡 pill / 技能正文折叠块（wave 1，DISC-02/03/04/06/07）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 48-02-PLAN.md — `/` 面板同屏分区列出技能与本地命令、两档实时过滤、↑↓ 可选中导航与选中执行、五要素行与三态可见性、stale-while-revalidate 刷新链路（wave 2，DISC-01/04/07）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 48-03-PLAN.md — `read` 工具卡片技能化（模型自动匹配的可见性）与重载标记重建 + 「发现与调用」产品文档与 AGENTS.md 同步（wave 3，DISC-05）

**UI hint**: yes
**Doc sync**: `docs/product/ai-skills.md` 补发现与调用章节（48-03）。

### Phase 49: `manage_skill` 工具（AI 自建技能）

**Goal**: AI 可自主创建、更新、删除自己的技能，且无法覆盖或删除随包内置技能。
**Depends on**: Phase 46
**Requirements**: MGMT-01, MGMT-02, MGMT-03, MGMT-04, MGMT-05, MGMT-06
**Success Criteria** (what must be TRUE):

  1. AI 经 `manage_skill` 的 create / update / delete 创建、修改、删除 managed 技能后，新技能集在下一条消息即对模型可见。
  2. 工具不接受 `path` 参数，只接受 `name`（`^[a-z0-9-]+$`）与 `content` / `description`；服务端二次校验（LLM 参数不可信），非法 name / 超长 description / 超限正文被拒绝并说明原因。
  3. 对 seeded 内置技能的覆盖或删除请求被拒绝（按**播种登记表**判定，而非按目录位置），并给出可读原因。
  4. 写入为原子操作（经沙箱 `env.renameFile` 获得双基准路径校验），失败不留半成品文件，且不触及 `ai-memory/`、`attachments/` 等其他工作区路径。
  5. 工具描述引导 AI 优先增强已有技能，而非创建近乎重复的新技能。

**Plans**: TBD

**Security gate**: P3 前半（S1）name 二次校验与名称冲突判定——本阶段产出的校验器是 50 / 51 唯一可复用的那一份。

### Phase 50: 设置页技能管理区 + `/api/skills/*`

**Goal**: 用户可在设置页看到全部技能的名称 / 描述 / 来源 / 体积 / 文件数 / 诊断，并启用、禁用、卸载自己的技能。
**Depends on**: Phase 49（复用同一份 name / description / 大小 / 注入校验器，避免第二份实现漂移）
**Requirements**: USER-01, USER-02, USER-06, USER-07, SEC-09
**Success Criteria** (what must be TRUE):

  1. 设置页 AI 分区出现「技能管理」区，逐条列出名称 / 描述 / 来源 / 体积 / 文件数 / 诊断。
  2. 用户可对单个技能启用 / 禁用：禁用只过滤不删文件，禁用后该技能不再进 system prompt 与 `/` 列表，重新启用即恢复。
  3. 卸载仅允许 `source === 'user'` 的技能；对内置 / 托管技能的卸载请求被拒绝（手改 URL 直接调端点也不例外）。
  4. 设置页（realm:// guest）走 `/api/skills/*` + token，主窗口走 `realmAPI` IPC，两入口读同一权威数据；任一入口的变更跨窗口即时同步。
  5. 超过体积上限的请求体（如未压缩 zip 的 base64）在 `/api/*` 层被拒绝并返回明确错误，不无上限读入内存。

**Plans**: TBD
**UI hint**: yes

**Security gate**: SEC-09 请求体体积上限（安全项，非优化项）；P8 多窗口广播与失效链。
**Doc sync**: `allowed-tools` 在列表展示时必须带「当前运行时不被强制，仅供参考」免责标注；`docs/product/ai-skills.md` 补管理面章节。

### Phase 51: 用户技能导入管线（zip + 网络地址）

**Goal**: 用户可从本地 zip 包或网络地址安全导入技能，导入前看清将写入什么；恶意或畸形包整包拒绝且工作区外零写入。
**Depends on**: Phase 50（导入 UI 承载面）+ Phase 46 / 49（目录与统一校验器）
**Requirements**: USER-03, USER-04, USER-05, USER-08, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-10
**Success Criteria** (what must be TRUE):

  1. 导入为两阶段：先展示预览（名称 / description 原文 / 目录树 / 字节数 / 脚本清单标红 / 威胁扫描结论），用户确认后才落盘。
  2. zip 按**单技能包**语义处理（0 个或多个技能根 → 报错并提示）；网络地址自动分流 GitHub 仓库 / 目录 与 SKILL.md 直链。
  3. 恶意或畸形包整包被拒并说明原因：含 symlink entry、路径逃逸族（`..` / 绝对路径 / 盘符 / UNC / 反斜杠 / NTFS ADS / 控制字符 / 尾随空格与点）、大小写或 NFC-NFD 重名、超限额（单 entry / 累计字节 / entry 数 / 压缩比 / 嵌套深度）。
  4. 解压只在 `fs.mkdtempSync` 新建的空目录内进行，落盘前用**最近已存在祖先的 realpath** 复核；导入完成后工作区外不产生任何文件（含 `~` 下敏感位置），且既有沙箱 `writeFile` 的 ENOENT symlink 缺口一并加固。
  5. 网络导入 https-only + 主机白名单 + 逐跳内网地址校验 + 流式字节上限 + magic bytes 校验；扫描同时覆盖 `description` 与 body（复用 `scanInjectionPatterns` + 新增 `SKILL_THREAT_PATTERNS`）；与内置同名拒绝导入、与已有用户技能同名需显式选择（覆盖 / 改名 / 取消）；失败按"命中哪个限额 / 扫描结论 / 校验错误"给出真实原因。

**Plans**: TBD
**UI hint**: yes

**Security gate**: P2（S1，阻断门禁）resolveInside ENOENT symlink 逃逸 + P4（S1）zip 路径类校验 + P9（S2）SSRF 逐跳校验；SEC-06 技能域威胁扫描（description + body 双扫，与 SEC-07 名称冲突策略共同闭合 P3 后半）。
**Research needed**: yauzl 解压 API 形态与四处错误处理面实测（zip-slip / symlink / 炸弹三类恶意样本）；GitHub 三种 URL 形态（zipball / SKILL.md 直链 / contents 列一层）的分流语义需真实网络请求验证。
**Doc sync**: `docs/product/ai-skills.md` 安全边界与已知限制章节在此定稿（含 DNS rebinding 残余风险的如实披露）。

## Security Gates (v2.6)

`security_enforcement: true` / `security_asvs_level: 1` / `security_block_on: high`。以下门禁**不得跨阶段滑落**——每个门禁必须在其归属阶段内完整交付并可独立验收。

| Gate | 级别 | 风险 | 归属阶段 | 阻断判据 |
|------|------|------|----------|----------|
| **P1** | S1 | 内置 find-skills 逐字打包 = 随包分发一份"用 `npx` 绕过沙箱装任意代码"的说明书；`npx` 当前不在 bash 危险解释器清单且可被白名单永久免确认 | Phase 47 | 内置技能文本零"执行外部安装"语义 + 包管理器安装档强制确认（白名单不可越过） |
| **P2** | S1 | `resolveInside` 对"尚不存在"的写目标只做词法校验 → 恶意 zip 一个 symlink entry 即可把文件写出工作区 | Phase 51 | 拒绝含 symlink entry 的**整包**（central directory 属性 + 解压后递归 `lstat`）+ `mkdtempSync` 空目录 + 最近已存在祖先 realpath 复核 |
| **P3** | S1 | SKILL.md `description` 无条件进每次请求的 system prompt（无需任何交互）；技能名可冒名顶替内置技能 | Phase 46（名称/冲突策略）+ Phase 51（description + body 扫描） | name 冲突显式策略（与内置同名拒导入 / 与用户技能同名三选一）+ 技能域威胁模式扫描 |
| **P4** | S1 | zip 路径类缺陷（zip-slip / 大小写冲突 / Unicode NFC-NFD 冲突） | Phase 51 | 逐 entry 校验 + 全量 entry 名 NFD + 小写归一化查重，任一命中拒绝整包 |
| **P8** | S2 | 技能缓存失效链断裂（冻结快照架构 + 6 个触发点，含 bash/write 直改目录这条无事件可挂的路径） | Phase 46 | 单一权威模块 + `buildSystemPrompt()` 只读同步快照 + 每次 Agent 重建兜底重扫 |
| **P9** | S2 | SSRF：`isPrivateHost` 用 Node DNS 而实际请求走 `net.fetch`，被校验的 IP ≠ 被连接的 IP | Phase 51 | https-only + 主机白名单 + 逐跳校验 + 流式上限 + magic bytes；DNS rebinding 残余风险写进威胁模型与产品文档 |
| **P10** | 发布 | `anthropics/skills` 无仓库级 LICENSE，skill-creator 目录内为 Apache-2.0，逐字打包有 §4 标注义务 | Phase 47 | `THIRD_PARTY_NOTICES` 归属完整（来源仓库 + 固定 commit SHA + 许可证 + 是否修改 + 修改说明） |

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 46. 技能基础设施 | 4/4 | Complete | 2026-09-11 |
| 47. 内置技能播种 + bash 策略加固 | 6/6 | In Progress|  |
| 48. 技能发现与调用 | 3/3 | In Progress|  |
| 49. `manage_skill` 工具 | TBD | Not started | - |
| 50. 设置页技能管理区 + `/api/skills/*` | TBD | Not started | - |
| 51. 用户技能导入管线 | TBD | Not started | - |
