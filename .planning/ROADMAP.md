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
- [x] **Phase 48: 技能发现与调用（`/` 面板 + `/skill:name`）** - `/` 面板并入技能列表 + 显式调用进对话历史 + 模型按 description 自动匹配 (completed 2026-09-13)
- [x] **Phase 49: `manage_skill` 工具（AI 自建技能）** - create / update / delete + 不吃 `path` 参数 + seeded 边界保护 (completed 2026-09-14)
- [x] **Phase 50: 设置页技能管理区 + `/api/skills/*`** - 列表 / 诊断 / 启停 / 卸载 + 双入口同一权威 (completed 2026-09-15)
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

**Plans:** 8/8 plans complete

Plans:

- [x] 48-07-PLAN.md
- [x] 48-08-PLAN.md

**Wave 1**

- [x] 48-01-PLAN.md — `/skill:name` 主进程端到端纵切（解析 → 实时读盘 → `<skill>` 块组装 → 注入 → 重载还原）+ 收窄投影与三档 tier + 两个面板 IPC 通道 + 气泡 pill / 技能正文折叠块（wave 1，DISC-02/03/04/06/07）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 48-02-PLAN.md — `/` 面板同屏分区列出技能与本地命令、两档实时过滤、↑↓ 可选中导航与选中执行、五要素行与三态可见性、stale-while-revalidate 刷新链路（wave 2，DISC-01/04/07）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 48-03-PLAN.md — `read` 工具卡片技能化（模型自动匹配的可见性）与重载标记重建 + 「发现与调用」产品文档与 AGENTS.md 同步（wave 3，DISC-05）

**Gap closure**（`48-UAT.md` 判 `diagnosed`、4 条 gap 后的收敛计划，`gap_closure: true`；TD-48-01 / CR-01 已裁决延后至 Phase 49 开工前，**不在**本轮范围）

**Wave 4** *(仅依赖既有 48-01..03 交付；48-04 与 48-05 文件集互不重叠，可并行)*

- [x] 48-04-PLAN.md — **G-48-2**：`readSkillForInvocation` 的同一性判据从「SDK 读回的 name 与入参相等」改为**目录路径全等**，命中后把注入用的 `name` 重写为目录名（保 46 D-08 防冒名）；测试 helper 支持写 `frontmatter name ≠ 目录名` 并补正/负例（wave 4，DISC-02）
- [x] 48-05-PLAN.md — **G-48-6 + G-48-4**：用户气泡构建抽成单源（`buildUserMessageContent`）+ 回填 `skillInvocation` 后**定向刷新**该条气泡（pill 与「技能正文」折叠块发送后即时出现）；引入「被取消消息」锚点（含独立纯逻辑模块 `src/ai-cancel-state.js`）使迟到取消事件只作用于被取消的那条消息，流式中调用技能不再吃掉新一轮（wave 4，DISC-02/03）

**Wave 5** *(blocked on Wave 4 completion —— 与 48-05 同改 `src/renderer.js` 与 `tests/test-skill-picker-model.js`)*

- [x] 48-06-PLAN.md — **G-48-3**：删除渲染端用陈旧 `state.aiSkills` 快照做本地否决的两段分支（存在性/启停一律由主进程当场读盘裁定、失败经既有 `skillError` 回滚呈现，用户可见文案逐字不变）+ `skills:changed` 无条件重拉快照；同步两套源码扫描断言与 `48-01/48-02/48-VALIDATION` 的旧明文，并**收口本轮全部产品文档面**（`docs/product/ai-skills.md` 的 §10.3 / §10.7 两条 / §10.4 表下两条注 / 新增 §10.8「用户气泡契约」/ §七 测试清单；本轮唯一文档写者）（wave 5，DISC-02/06）

**Wave 7** *(仅依赖既有 48-07 交付；改动面 = `ai-manager.js` + `tests/test-ai-skills.js` + 文档账本，与既有计划无文件重叠)*

- [x] 48-08-PLAN.md — **G-48-18 + G-48-19**：延迟补刷抽成唯一实现 `_flushDeferredSkillsPrompt()` 并由 `prompt()` 与 `promptWithContext()` 两个**成功**出口共用（检脏早退零成本、错误出口与 `_cleanupCurrentAgent` 不补刷），使纯文本 `/skill:` 成功后 system prompt 回写与 `skills:changed` 广播在本轮结束即落地；把 miss 重试块的重扫与重试读盘拆成两个各自独立的 `try`（抛错沿用原判定、不逃逸、不升级第三码、`err` 取值对齐 `String(err)` 形态、两条告警可判别），补 K 组 5 条 + J 组 3 条行为用例并改写 1 条已过时的既有护栏，同步 §10.7 落地时机措辞与 §七 / `AGENTS.md` 例数（wave 7，DISC-02/06）

**UI hint**: yes
**Doc sync**: `docs/product/ai-skills.md` 补发现与调用章节（48-03）；gap 收敛轮全部文档面收口（§10.3 / §10.7 / §10.4 表下注 / 新增 §10.8「用户气泡契约」/ §七）由 **48-06** 单点完成以避免同波并发编辑同一文件；48-08 的文档面（§10.7 的落地时机与失败恢复语义、§七 例数与覆盖面、`AGENTS.md` 测试清单例数）由 **48-08** 自己单点收口。

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

**Plans**: 8/8 plans executed（3 original executed + 4 gap-closure executed，含本轮 49-07 收口 G-49-3）

Plans:

- [x] 49-08-PLAN.md

**Wave 1**

- [x] 49-01-PLAN.md — tracer：`create` 端到端主干（校验器 → 字段分离扫描 → 独占创建 → 沙箱原子写 → 刷新链）+ `update` / `delete` 与边界拒绝矩阵 + 值域矩阵与两条护栏（MGMT-01..06、判据 1–4）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 49-02-PLAN.md — 卡片技能化：两时点标记 + 失败态元数据通道 + 渲染端标题 / 徽标 / 参数摘要 / 正文折叠块 / 结果文本化 / 内联标注 + 样式与 48 的两条前置修复（D-02、MGMT-01/05）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 49-03-PLAN.md — 文档与账本收口：`docs/product/ai-skills.md` §十一 + `AGENTS.md` 维护约定与测试清单 + `49-VALIDATION.md` 矩阵重键与四条 OQ 裁决

**Gap-closure plans** *(49-VERIFICATION.md 判 `gaps_found`；`--gaps-only` 只跑以下三个)*

**Wave 1**

- [x] 49-04-PLAN.md — Gap 1 写侧闭合（CR-02 / CR-03 / WR-01）：YAML 标量编码 + 净化后复验非空 + 组装全文字节闸 + `getSkillPromptIncluded` 三态（MGMT-01/02/03）

**Wave 2** *(blocked on 49-04)*

- [x] 49-05-PLAN.md — Gap 2 / Gap 3 闭合（CR-01 / WR-02）：卡片标记并入单源 `mergeManageSkillMarker` + 失败态原因码经消息词缀落库与重载还原 + 三态 `promptIncluded` 消费侧 + 两组假绿守卫纠正（MGMT-01/05）

**Wave 3** *(blocked on 49-05)*

- [x] 49-06-PLAN.md — 文档纠偏：§11.7 失败态可见性 / §11.8 命名空间分账（48 号挂账句不动 + 49 号闭合另起一句）+ 词缀成文 + 三处测试例数账本 + `AGENTS.md` 维护约定四条新增不变式

**Wave 4** *(blocked on 49-02 / 49-03；49-UAT.md 判 `diagnosed` 的 `G-49-3` 收口)*

- [x] 49-07-PLAN.md — **G-49-3**：卡片头部超预算标注改渲染单源的 ≤ 4 字机械投影（`PROMPT_OMITTED_CARD_NOTE`；48 D-12 的面板串 `未进提示词 · 超预算` 逐字未变）+ 新增可重跑的真实渲染驱动（280px 真实拖拽，红→绿两轮证据，判据取「标注右缘 vs 裁切祖先右缘」以避开旧驱动的假绿）+ 派生投影 / ≤ 4 字 / 48 原文冻结 / 九码长度上限四组护栏 + 产品文档、例数账本与 `49-UI-SPEC.md` 的 E1 收口记录（MGMT-01/05）

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

**Plans**: 5/5 plans executed / 4 waves（已规划，未执行）

**Wave 1**

- [x] 50-01-PLAN.md — tracer：管理读路径端到端纵切（管理投影 + `ensureSkillsFresh` 读路径初始化 + `GET /api/skills/list` + 设置页只读分组列表 + 体积/文件数递归统计进重扫管线）（USER-01、USER-07）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 50-02-PLAN.md — 管理写路径端到端（仅 user 可卸载的三态判据 + 第十码 + 两个管理面谓词 + 失效链收口 + 两条写路由 + `/api/settings/update` 双键校验）（USER-02、USER-06）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 50-03-PLAN.md — SEC-09 体积闸 + 双入口 IPC（`readJsonBody(req, res, {maxBytes})` + `res` 缺失降级分支 + 413 形态 + `sendJson` 幂等护栏 + 全部调用点改签名 + 两个书签端点显式放大 + 三个 IPC 通道）（SEC-09、USER-07）
- [x] 50-04-PLAN.md — 设置页写交互与样式完成面（启停开关乐观翻转/回滚 + 卸载二次确认弹框 + 诊断两层承载 + 「仅显式」单源化）（USER-01、USER-02、USER-06）

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 50-05-PLAN.md — 文档与账本收口（`docs/product/ai-skills.md` §十二 + §11.3 修订 + `AGENTS.md` 维护约定与测试清单 + `50-VALIDATION.md` 回填 + counts-parity 扩到 5 套件）（USER-01、USER-02）

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

**Plans**: 7/7 plans planned / 6 waves（已规划，未执行）
**UI hint**: yes

> ⚠️ `51-02` 的 `autonomous: false`：它的 T1 含唯一的 `checkpoint:human-verify gate="blocking-human"`（`yaml` 的 `[SUS] too-new` 供应链闸 ⇒ 安装前必须用户回话）。

**Wave 1**

- [ ] **51-01-PLAN.md — SEC-10 沙箱写面加固（端到端纵切）**：`resolveInsideForWrite`（最近已存在祖先 realpath 复核）+ `guardForWriteResult` 包装 + 五个写方法切面 + 自指 symlink 仍放行 + 既有用例集合零变化（SEC-10）
- [ ] **51-02-PLAN.md — 两个依赖按实测口径落定（含 blocking-human 检查点）**：`yauzl@^3.4.0`（库自身从不写盘）+ `yaml@2.9.0`（**精确钉版** ⇒ 单实例）+ 依赖审计四条 + `build.files` 的 `!` 前缀护栏（USER-03、USER-04）

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] **51-03-PLAN.md — 阶段主 tracer + zip 全量校验 + 技能域威胁扫描**：设置页选 zip → raw binary `POST /api/skills/import` → `mkdtemp` 空目录解压 → 两阶段预览 → 落盘 → 回读可见；symlink 两路整包拒绝 + 逃逸族十二类 + NFD/小写查重 + 六类限额 + `SKILL_THREAT_PATTERNS` 双扫（带正命题 + 内置语料零误伤回归）+ 唯一落盘实现的源码扫描判据（USER-03、USER-05、SEC-02、SEC-03、SEC-04、SEC-05、SEC-06）

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] **51-04-PLAN.md — 落盘事务与句柄生命周期**：冲突三档（seeded 拒 / user 三选一 / managed 只改名）+ 覆盖的备份与两段 rename 回滚 + 回读验证失败即回滚 + TTL / 并发上限 / 显式取消 / 崩溃残留清扫 + `IMPORT_SKILL_ERROR` 码矩阵与「上传闸对炸弹零贡献」两道独立闸（USER-05、USER-08、SEC-07）

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] **51-05-PLAN.md — 网络地址导入**：URL 三形态分流（仓库 / `tree/<ref>/<path>` / raw 与 blob 直链）+ `www.` 归一化同可达 + zipball 顶层前缀剥离 + 技能根定位；https-only + 主机白名单精确匹配 + 逐跳私网校验 + 跳数上限抛错 + 流式字节上限 + magic bytes + 单一落盘入口（USER-04、SEC-08）

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] **51-06-PLAN.md — 导入 UI 完整面 + uat 驱动**：两 tab 弹框 + 六字段预览卡片（目录树与脚本清单的截断折叠、扫描结论两栏、`allowed-tools` 免责标注）+ 必勾风险确认 + 冲突三选一 + 显示层净化与属性上下文转义 + 15 个新增元素零内联 `style`（USER-05、USER-08）

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] **51-07-PLAN.md — 文档与账本收口**：`docs/product/ai-skills.md` 第十三节【导入】+ 安全边界与已知限制定稿（含 DNS rebinding 残余风险如实披露）+ `AGENTS.md` 维护约定与测试清单 + counts-parity `suites`/`cells` 12 → 20 + `51-VALIDATION.md` 矩阵重键（不自证，交 `/gsd:verify-work`）（全部 12 项）

**Cross-cutting constraints**

- 三条安全门禁各自可独立验收、不得跨阶段滑落：P2（S1）写面 symlink 逃逸（51-01 + 51-03）/ P4（S1）zip 路径类校验（51-03）/ P9（S2）SSRF 逐跳（51-05）
- 「只有一个落盘实现」是跨计划回归判据：`importUserSkill(` 定义恰 1 + 调用恰 1 + handler 与前端各 0；`yauzl.openPromise(` 恰 1（51-03 立、51-04 / 51-05 复验）
- `MANAGE_SKILL_ERROR` 恰 11 键不变（导入码另立 `IMPORT_SKILL_ERROR`）；`main.js` 的 `res.writeHead(` 基线 14 不变；`await readJsonBody(req` 59 → 60


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
| 48. 技能发现与调用 | 8/8 | In Progress|  |
| 49. `manage_skill` 工具 | 8/8 | In Progress|  |
| 50. 设置页技能管理区 + `/api/skills/*` | 5/5 | In Progress|  |
| 51. 用户技能导入管线 | 0/7 | Ready to execute | - |
