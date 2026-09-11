---
phase: "46"
slug: "prompt"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-11"
---

# Phase 46 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Phase:** 46-技能基础设施（目录 + 沙箱归属 + 加载接线 + prompt 注入）
**Input state:** B（阶段无既有 SECURITY.md，由 4 份 PLAN 的 `<threat_model>` + SUMMARY 的 `## Threat Flags` 建立）
**register_authored_at_plan_time:** true（46-01/02/03/04 四份 PLAN 均含可解析的 `<threat_model>` 块）
**Audit depth:** L1（grep + 源码行级核实）。`asvs_level: 1` + `threats_open: 0` + 计划期已授权登记表 → 按 secure-phase 短路规则不派 `gsd-security-auditor`。
**block_on:** high

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 文件系统（用户手放 / 未来导入的技能目录）→ SDK 加载器 | 不可信输入：目录布局、`SKILL.md` 体积与 frontmatter 形态 | 文件路径 / YAML / 任意文本 |
| `agent-workspace/skills/` `managed-skills/` → 硬沙箱 `resolveInside` | 技能路径必须落在唯一 root 内；越界即静默失效或逃逸 | 绝对路径 |
| `_cache.promptBlock` → 每次 LLM 请求的 system prompt | 技能 description 无条件进入每一轮请求 | 技能 name / description / 绝对路径 |
| `_cache.skills` → prompt 段组装 | 遮蔽 / 超限 / 禁用条目必须在此边界被拦住 | 内存条目 |
| `realm-config.json` 的 `settings.aiSkills.disabled` → `refreshSkills({ disabled })` | 用户可控 name 数组；必须是纯数据、不参与路径拼接 | string[] |
| 磁盘上 `SKILL.md` 的体积 / 数量 → 主进程内存与每轮 prompt | 资源耗尽面（DoS 成本 / 延迟） | 字节数 / 条目数 |
| `agent.state.systemPrompt` → 下一次 LLM 请求 | 技能段变更在此边界生效；错写会污染进行中的对话或丢失上下文 | system prompt 字符串 |
| `windowManager.broadcast('skills:changed')` → 各窗口 renderer | 本阶段只发不收（消费方在 48/50） | 事件名 |
| `docs/product/ai-skills.md` → 用户的安全心智模型 | 文档含糊 = 虚假安全感 | 文档文本 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-46-01-01 | Tampering | `createSkillsEnv.listDir` 收窄逻辑 | medium | mitigate | 收窄仅在 `isScanRoot()`（`path.resolve` 精确比对 `opts.rootDirs`）命中时生效；技能自带 `references/`/`scripts/`/`assets/` 不受影响；被滤 entry 一律 `droppedNotices.push` → 可读诊断，禁静默（`ai-skills-manager.js:137`, `:146`, `:150`） | closed |
| T-46-01-02 | Elevation | 技能目录路径来源 | high | mitigate | `getSkillsDir()` / `getManagedSkillsDir()` 均派生自 `getWorkspaceDir()`（`agent-workspace.js:102`, `:113`，base 在 `:38`），两目录必然落在唯一硬沙箱 root 内；未为 `managed-skills/` 引入第二个 root 或只读挂载；`resolveInside` / `createSandboxEnv` 本阶段零 diff | closed |
| T-46-01-03 | Denial of Service | 超大 / 畸形 `SKILL.md` 触发主进程同步 YAML 解析 | high | mitigate | `createSkillsEnv.readTextFile` 在 SDK 解析**之前**按 `FileInfo.size` 拒绝 > `LIMITS.MAX_SKILL_MD_BYTES`（64 KiB，`ai-skills-manager.js:33`）的 `SKILL.md`，返回 `FileError('invalid')` 不读盘（`:158`） | closed |
| T-46-01-04 | Tampering | 模型的间接提示注入面 = 技能 description | medium | accept | 本阶段无写入路径（导入属 Phase 51），无法在源头扫描 description；可控防线 = 「让用户看到技能集全貌」+ 诚实边界写入文档（`docs/product/ai-skills.md:76`） | closed |
| T-46-01-05 | Information Disclosure | `<location>` 暴露工作区绝对路径进 prompt | low | accept | 路径即设计（模型需它去 `read`）；prompt 只发给用户自己配置的 provider，与既有 `buildWorkspacePrompt()` 同款 | closed |
| T-46-01-SC | Tampering | npm / 依赖安装 | high | mitigate | 本阶段零新增依赖：`git log aa68cfb..HEAD -- package.json` 为空；未执行安装命令；SDK 仅只读契约使用（`ai-skills-manager.js` 无顶层 SDK import，按需动态 import） | closed |
| T-46-02-01 | Spoofing | `skills/evil/SKILL.md` 声明 `name: find-skills` 冒名顶替 | high | mitigate | `enforceDirNameAuthority` 以 `path.basename(path.dirname(skill.filePath))` 为权威重写 `skill.name` + `realm_name_rewritten` 诊断（`ai-skills-manager.js:323`）；系统性不变式「集合内每条 name ≡ 目录名」（P3 前半，S1 门禁在本阶段闭合） | closed |
| T-46-02-02 | Tampering | 深嵌套技能被静默加载进模型可见清单 | medium | mitigate | `inContractLayout` 相对深度 === 2 过滤（`ai-skills-manager.js:196`）+ `realm_layout_violation` 诊断（`:528`, `:532`），属 D-05 第 1 层「正常态跳过」 | closed |
| T-46-02-03 | Repudiation | 同名冲突静默双份注入，用户无从判断哪个生效 | high | mitigate | 遮蔽判定保留败者于数据层但标 `shadowed` / `shadowedBy` + `realm_shadowed` 诊断（`ai-skills-manager.js:344-351`）；消费侧 `!e.shadowed` 过滤保证 prompt 同名只出一条 | closed |
| T-46-02-04 | Denial of Service | 遮蔽条目占 prompt 预算，挤压真实可用技能 | low | mitigate | 遮蔽过滤发生在 `_cache.promptBlock` 组装前，与 46-03 的预算截断复用同一过滤后集合（`ai-skills-manager.js:100` 消费侧状态位） | closed |
| T-46-02-SC | Tampering | npm / 依赖安装 | high | mitigate | 零新增依赖；未执行安装命令；继续遵守「不得直接引入 YAML / ignore 解析库」的依赖纪律（源码扫描断言覆盖） | closed |
| T-46-03-01 | Denial of Service | 畸形 / 超大 `SKILL.md` 触发主进程 YAML 解析 | high | mitigate | `MAX_SKILL_MD_BYTES` 前置拒绝，不读盘不解析；诊断带 `limit` + `currentValue`（`ai-skills-manager.js:158-166`） | closed |
| T-46-03-02 | Denial of Service | 技能数量膨胀导致每请求 system prompt 膨胀（成本 / 延迟） | high | mitigate | `MAX_USER_SKILLS`（50）标记 `overLimit` 不注入（`ai-skills-manager.js:565-566`）+ `SKILLS_PROMPT_CHAR_BUDGET`（8000）整段预算贪心截断 + 段尾省略提示；两条限额独立生效（`:34-35`） | closed |
| T-46-03-03 | Repudiation | 加载失败被静默吞掉，用户以为技能已生效 | high | mitigate | `toRealmDiag` 显式映射（`ai-skills-manager.js:255`）+ 模块级 `_cache.errors`（`:276`, `:465`）+ `realm_skills_dir_missing` 补 SDK 静默缺口（`:474`）；成功复位 errors、失败保留旧快照并记 error | closed |
| T-46-03-04 | Tampering | 禁用实现成「删除文件」或「从数据层移除」 | medium | mitigate | `disabled` 只做标记 + 消费侧过滤（`ai-skills-manager.js:422`, `:440`, `:98`）；测试断言刷新前后文件存在性与 `statSync().size` 一致、条目仍在集合内 | closed |
| T-46-03-05 | Tampering | 诊断 message 原样渲染进设置页造成注入 | low | accept | 本阶段无 UI（Phase 50 才渲染）；届时按 `realm://` 页面约定用 `textContent` 写入。诊断内容为本地路径与 SDK 自产文本，无远端拼接 | closed |
| T-46-03-SC | Tampering | npm / 依赖安装 | high | mitigate | 零新增依赖；未执行安装命令 | closed |
| T-46-04-01 | Tampering | 技能缓存失效（磁盘与内存快照分叉：装了不生效 / 卸了仍被描述 / 改无变化） | high | mitigate | ① 权威收敛到 `ai-skills-manager` 单模块；② 两处 Agent 创建点前无条件 `await refreshSkills`（`ai-manager.js:849`→`:868`、`:2574`→`:2582`；全仓 `new Agent(` 恰 2 处）；③ 源码扫描断言永久锁住漏接线；④ 覆盖 bash/write 直改磁盘（无事件路径）。**本阶段 3/6，其余 3 条经 `<p8_gate_mapping>` 交接 48/49/50/51**（诚实边界，不宣称全覆盖） | closed |
| T-46-04-02 | Repudiation | 变更未广播，多窗口技能列表不一致 | medium | mitigate | 真正改写 prompt 后 `windowManager.broadcast('skills:changed')`（`ai-manager.js:2541`）；本阶段无消费方 —— 端到端投递已由 `46-UAT.md` Test 1 实测（`broadcasts: ["skills:changed"]`，恰一次） | closed |
| T-46-04-03 | Tampering | 忙时改写 prompt 导致当前轮上下文不一致 | medium | mitigate | 忙时（`isProcessing` / `state.isStreaming`）只置 `_skillsPromptDirty`（`ai-manager.js:2527`），在 `promptWithContext()` 的 idle 边界补刷一次（`:1264-1270`）；不在流式回调内改状态。`46-UAT.md` Test 1 实测空闲路径原地改写且 `agentRebuilt: false` | closed |
| T-46-04-04 | Elevation | 用户误以为技能目录是权限边界 | medium | mitigate | 文档「五、沙箱边界」「六、已知限制」逐条写明：技能不构成额外权限；「AI 不可删改内置技能」是工具层而非沙箱不变式（`docs/product/ai-skills.md:81`） | closed |
| T-46-04-05 | Information Disclosure | 文档未声明 description 进每次请求的注入面 | medium | mitigate | 文档明写 description 进每次请求的 system prompt、只转义不审查，并给出「不要导入来源不明的技能」（`docs/product/ai-skills.md:76`） | closed |
| T-46-04-SC | Tampering | npm / 依赖安装 | high | mitigate | 零新增依赖；未执行安装命令 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (= high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Totals:** 23 threats · 20 mitigate · 3 accept · **0 open**

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-46-01 | T-46-01-04 | 技能 description 的提示注入面无法在源头扫描 —— 本阶段**无写入路径**（导入属 Phase 51），可控防线是「让用户看到技能集全貌」+ 文档诚实边界。源头扫描（description/body 威胁模式）已登记为 Phase 51 交付项 | wxnacy | 2026-09-11 |
| AR-46-02 | T-46-01-05 | `<location>` 暴露工作区绝对路径是**设计本身**（模型须凭它 `read`）；prompt 只发往用户自配的 LLM provider，与既有 `buildWorkspacePrompt()` 暴露工作区根路径同级 | wxnacy | 2026-09-11 |
| AR-46-03 | T-46-03-05 | 诊断 message 进 UI 的注入风险在本阶段不存在（无 UI）；Phase 50 渲染时按 `realm://` 约定以 `textContent` 写入，届时重新评估 | wxnacy | 2026-09-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-11 | 23 | 23 | 0 | verify-work orchestrator (L1 grep + 行级核实；短路规则免审计员) |

**Audit notes:**
- 本次为 **State B**（阶段首个 SECURITY.md），登记表由 4 份 PLAN 的 `<threat_model>` 合并去重 + SUMMARY 的 `## Threat Flags` 补齐。
- 缓解措施核实方式：对每条 `mitigate` 在实现文件中定位到具体行（见上表），未依赖 SUMMARY/REVIEW 的叙述。其中 **T-46-04-02 / T-46-04-03 另有端到端证据**：`46-UAT.md` Test 1 用临时 IPC 钩子实测 `agentRebuilt: false` / `promptChanged: true` / `broadcasts: ["skills:changed"]`（钩子已删除）。
- **未派 `gsd-security-auditor`**：`asvs_level: 1` + `threats_open: 0` + 计划期已授权登记表触发 secure-phase 的短路分支（L1 grep 深度对该档位充分）。若后续将 `asvs_level` 提升至 ≥ 2，需重跑并执行 L2 边界放置 / L3 端到端追踪。
- **诚实边界（不在本阶段覆盖）**：P8 失效链 6 个触发点中，本阶段只有 3 个真实存在（两处创建点 + `_recreateAgent` 无条件重扫兜底）；其余 3 个写路径（`/` 面板 48、`manage_skill` 49、设置页 50）尚未落地，ROADMAP 明令不得声称 6 点全覆盖。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-11
