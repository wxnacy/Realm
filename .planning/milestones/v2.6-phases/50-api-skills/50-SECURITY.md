---
phase: "50"
slug: "api-skills"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-15"
---

# Phase 50 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> 阶段 50「设置页技能管理区 + `/api/skills/*`」。威胁模型由 5 份 PLAN 各自携带的
> `<threat_model>` 块合成（`register_authored_at_plan_time: true`）；本文件为 **State B（新建）**。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `realm://` guest（设置页）→ 本地 HTTP `realmServer` | 唯一授权是 URL 里的 `REALM_TOKEN`（能力令牌）；无 token / 错 token 必须在**任何副作用之前** 403 | 技能管理投影（名称 / 描述 / 体积 / 文件数 / 诊断）；写指令 `{name, disabled}` / `{name}` |
| 设置页 guest / 主窗口 renderer → IPC 通道 | IPC **不校验调用者即等同主机能力**；`assertTrustedSender` 是唯一控制面 | `ai:get-skills-management` / `ai:set-skill-disabled` / `ai:uninstall-skill` |
| 磁盘上的技能目录 → 主进程（沙箱 `ExecutionEnv`） | 目录内容与结构**不可信**（bash 可随时改写；用户可从 Finder 塞入任意文件 / 符号链接） | `SKILL.md` frontmatter、目录树结构、文件大小 |
| 客户端提供的技能名 → 文件系统删除路径 | 卸载会**递归删目录** ⇒ 名称必须经谓词过滤 + `path.join` + 沙箱 `resolveInside` 双基准 | 技能名（字符串）→ 落盘路径 |
| HTTP 客户端 → `realmServer` 的请求体 | 体积**不受信**（Phase 51 的 zip base64 会放大到数十 MiB）；`Content-Length` 可伪造 / 可缺失 | `POST` body（JSON） |
| 磁盘上的技能元数据（名称 / 描述 / 诊断 message / 错误全文）→ 设置页 DOM | 内容**完全不受信**（用户手放、AI 经 `write`/`bash` 写入、导入的第三方技能） | 文本 → DOM 文本节点 / 属性 |
| `settings.aiSkills.disabled` → 加载管线过滤 | 该键经 `/api/settings/update` 可被客户端写入 | 技能名数组 |
| 文档 / 账本 → 后续阶段（51）与用户 | 文档是**下一阶段的唯一口径来源**；误写「已修 / 已闭合」会被当成前提 | 挂账状态声明、例数账本 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-50-01 | Information Disclosure / Tampering | `GET /api/skills/list` | high | mitigate | `handleSkillsApi` 首段 `reqUrl.searchParams.get('token') !== REALM_TOKEN ⇒ 403`，**先于任何副作用**（`main.js:2833`，实证：函数体第 3 行） | closed |
| T-50-02 | Denial of Service | `measureSkillDir` 递归遍历 | high | mitigate | `e.kind === 'symlink' ⇒ continue`（`ai-skills-manager.js:586`）+ `SKILL_SIZE_WALK_MAX_ENTRIES = 5000`（:83）+ `SKILL_SIZE_WALK_MAX_DEPTH = 16`（:86），超限截断 + warning 诊断、不拒绝加载 | closed |
| T-50-03 | Elevation of Privilege / Information Disclosure | 尺寸遍历的路径来源 | high | mitigate | 遍历只经沙箱 `env.listDir`（`ai-skills-manager.js:567`）；该模块**零 `fs.` 命中**（实证 grep）；路径恒由 `path.join` + `getSkillsDir()` / `getManagedSkillsDir()` 派生 | closed |
| T-50-04 | Denial of Service | `refreshSkills()` 整体 `catch` 回滚 | medium | mitigate | 尺寸统计逐技能隔离失败：单技能读不到只影响自身（`bytes=0` / `fileCount=0` + entry 级诊断），不冒泡到整体回滚 | closed |
| T-50-05 | Repudiation | 统计失败的静默呈现 | medium | mitigate | 显式布尔 `statsUnavailable` 表达（`ai-skills-manager.js` 3 处 / `settings-page.js` 2 处），前端渲染「统计不可用」而非失实的 `0 B · 0 个文件` | closed |
| T-50-06 | Tampering | 设置页渲染磁盘来源的技能数据 | high | mitigate | 新增插值一律 DOM API（`createElement` + `textContent` + `el.title` / `setAttribute`）；技能管理区（`settings-page.js:4700-6000`）内 `innerHTML` / `insertAdjacentHTML` **零真实命中**（仅两处注释说明「不用」）。`TD-48-01` 仍开未修 ⇒ 本阶段只保证**不扩大缺口**，**不声称已修** | closed |
| T-50-07 | Tampering | `computeDigest` 的字段集 | high | mitigate | `computeDigest` 逐字含 `e.disabled === true` / `e.overLimit === true` / `e.shadowed === true`，且**无** `bytes` / `fileCount`（实证读函数体）；`test-ai-skills.js` 187 例钉住 | closed |
| T-50-08 | Denial of Service | 设置页进入时的一次全量重扫 | low | accept | 见 Accepted Risks Log | closed — below high threshold (non-blocking) |
| T-50-09 | Elevation of Privilege | `POST /api/skills/uninstall` 删内置 / 托管技能 | high | mitigate | 判据落在 `deleteUserSkill()`（不经 handler 包装）：只有 `skills/<name>` 存在**且** `kind === 'directory'` 才允许，否则 `not_user_owned` / `not_found`（`ai-skills-manager.js:1204/1211`）。三态用例经 **manager 函数直接调用**验证 ⇒ 手改 URL 直调端点同样被拒 | closed |
| T-50-10 | Tampering | 路径穿越（技能名含 `../` / 分隔符 / 控制字符） | high | mitigate | `validateSkillNameForManagement` 拒 `/`、`\`、`\u0000`-`\u001f`；路径恒由 `path.join(getSkillsDir(), name)` 派生；删除经沙箱 `env.remove`（自带 `resolveInside` 双基准 + realpath 复核） | closed |
| T-50-11 | Tampering | `/api/settings/update` 禁用名单污染 | high | mitigate | `validateDisabledListForSettings`（数组 + 每项非空 ≤64 + 无分隔符/控制字符 + 条数 ≤100）；**两种键形态**（`aiSkills.disabled` 与 `aiSkills`）共用同一份判据（`main.js:1484-1491`） | closed |
| T-50-12 | Tampering | 跨窗口失效链断裂 | high | mitigate | 写路径「重扫恰一次 + 调用侧补播恰一次」；`windowManager.broadcast('skills:changed')` 三处写路径各一（`ai-manager.js:1660/1699/3171`）；`syncAgentSystemPrompt()` 函数体广播次数仍为 1；忙时补播用例 | closed |
| T-50-13 | Repudiation | 卸载失败被告知为「技能不存在」 | medium | mitigate | 第十码 `not_user_owned` 与 `not_found` 分离（`ai-skills-manager.js:1204/1211`）；message 可读可操作、不回显被拒内容 | closed |
| T-50-14 | Tampering | 第二份名称校验实现导致漂移 | medium | mitigate | 谓词单源在 `ai-skills-manager.js` 并导出，`main.js` 直接 require；跨文件断言「两入口转发到同一组方法名」 | closed |
| T-50-15 | Denial of Service | 卸载递归删除在超大目录上耗时 | low | accept | 见 Accepted Risks Log | closed — below high threshold (non-blocking) |
| T-50-16 | Denial of Service | 无上限读入请求体 | high | mitigate | `readJsonBody` 累积中判 + `if (rejected) return` 立即停收（`main.js:959/969`）+ 413；默认 1 MiB fail-closed。**运行期实证**（UAT T6）：1.5 MiB → 413 + `limit:1048576` | closed |
| T-50-17 | Denial of Service | 拒收路径本身崩掉主进程 | high | mitigate | `sendJson` 幂等护栏吸收二次发送；`res` 缺失降级分支（`canRespond`）；行为组断言 `unhandledRejection` 为 0 | closed |
| T-50-18 | Denial of Service | 413 不可达（客户端只拿网络错误） | high | mitigate | 超限走 `req.resume()` 排水（`main.js:947`），**不** `req.destroy()`（全文件零命中）；UAT T6 客户端实测拿到 413 + 可解析 JSON | closed |
| T-50-19 | Tampering | 新增第二个响应发送点绕过幂等护栏 | medium | mitigate | `res.writeHead(` 全文件计数 = **14**（与冻结基线一致，实证）；`sendJson` 内恰 1 处且幂等护栏在其**之前** | closed |
| T-50-20 | Elevation of Privilege | 未受信 IPC 来源调用管理写通道 | high | mitigate | 三个技能通道（`ai:get-skills` / `ai:refresh-skills` / `ai:get-skills-management` 及写通道）**首行**即 `assertTrustedSender(event)`（实证：首行，非「段内某处」） | closed |
| T-50-21 | Tampering | 两入口判定漂移 | high | mitigate | handler **零判定**（只 `return aiManager.<method>()`）；跨文件断言两入口转发到同一组方法名 | closed |
| T-50-22 | Repudiation | 把不可复现因果写成事实（`Connection: close` ⇒ EPIPE） | low | mitigate | 文档只写可复现规则（不 `destroy()`、不设 `Connection: close`、用 `resume()`），并**显式声明**该因果在本仓重研会话中不可复现（`docs/product/ai-skills.md:671`） | closed |
| T-50-23 | Denial of Service | 两个书签导入端点在 1 MiB 默认下 413 | high | mitigate | 恰 **2 处**显式 `{ maxBytes: MAX_JSON_BODY_BYTES_LARGE }`（`main.js:1236/1257`，实证计数 = 2） | closed |
| T-50-24 | Tampering | 属性上下文注入（名称 / 描述含引号逃逸 `title` / `aria-label`） | high | mitigate | 同 T-50-06：全部插值走 `el.title = value` / `setAttribute`；技能管理区零 `innerHTML`。`TD-48-01` 仍开未修 ⇒ **不扩大缺口**，不声称已修 | closed |
| T-50-25 | Tampering | CSP 绕过（markup 内联 `style="display:none"`） | medium | mitigate | 初始隐藏走 CSS 类（`.ai-modal-overlay { display:none }`）；显隐用 CSSOM 具体值。技能管理 markup 段（`settings.html:544-575`）内 `style="…display…"` **零命中**（实证） | closed |
| T-50-26 | Denial of Service | 陈旧复位定时器清掉新消息 | low | mitigate | `setSkillManageHint` 内 `clearTimeout`（函数体第 4 行）**严格早于** `setTimeout`（第 10 行），实证位置顺序 | closed |
| T-50-27 | Tampering | 折叠控件漂移成第二套 | medium | mitigate | `setCollapsed` 单点双写（class + aria 一并）+ 跨文件契约扫描（带正命题） | closed |
| T-50-28 | Repudiation | 失败文案失实 | medium | mitigate | 按服务端 `code` 查**闭合白名单**（`settings-page.js:4855/4856` 两条独立文案 + 表外兜底）；hint 文本与色调**一并设置**（`skillManageErrorText(err), 'danger'`） | closed |
| T-50-29 | Information Disclosure | 诊断 `path` 字段上屏 | low | mitigate | 技能管理区（`settings-page.js:4800-5700`）内 `.path` **零命中**；只渲染 `level` / `message` / `code` | closed |
| T-50-30 | Tampering | 危险按钮对比度不足被当成「有语义」 | low | mitigate | 不使用 `.btn-danger`：该文件内两处 `btn-danger` 命中，一处是**凭据**删除按钮（:2172，区外）、一处是**注释**说明为何不用（:5376）⇒ 技能区真实使用 = 0；危险语义由 `--skill-error-text` + 中性底承担 | closed |
| T-50-31 | Denial of Service | 重渲染重建整棵行 DOM 重置滚动 / 焦点 | low | mitigate | 记录并回写 `.settings-content.scrollTop`；按 `data-skill-name` 归还焦点到同一技能行 | closed |
| T-50-32 | Repudiation | 文档误声明「已修 / 已闭合」⇒ 账本污染 | high | mitigate | `docs/product/ai-skills.md:685/687` 明确「不声称 `TD-48-01` / `TD-48-02` / `WR-02` / `WR-06` 任一已修复或已闭合」、P8 不声称 6/6；两条诚实边界门禁 | closed |
| T-50-33 | Tampering | 账本单元与实测例数漂移 | medium | mitigate | counts-parity（5 套件版）逐单元比对；**本次复核实测**：`test-skills-http-api.js` 32 · `test-skills-management.js` 49 · `test-skill-picker-model.js` 115 · `test-manage-skill.js` 55 · `test-ai-skills.js` 187，五套件全绿 | closed |
| T-50-34 | Information Disclosure | 文档把不可复现因果写成事实 | low | mitigate | 同 T-50-22：`Connection: close` 仅以「不得写成事实」的规则形态出现，未作为因果结论 | closed |
| T-50-35 | Repudiation | 读侧触发点并入写路径份额 ⇒ 被读成 6/6 | medium | mitigate | `docs/product/ai-skills.md:685` 同时出现「写路径 **2/3**」与「**读侧**另计、不得并入 6 个触发点分子」（实证：两处均命中） | closed |
| T-50-36 | Tampering | 验证矩阵按「意图」而非「实际交付」重键 | medium | mitigate | 矩阵 `Automated Command` 列均为可跑具名命令；本次复核五套件全部实际跑通（合计 438 例） | closed |
| T-50-SC | Tampering | npm / pip / cargo 安装（供应链） | high | mitigate | 本阶段**零新增依赖**：5 份 SUMMARY 均记 `package.json` 零 diff；无安装动作 ⇒ 无供应链面。Phase 51 引入 zip 库时必须走完整 Package Legitimacy Gate | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**计数**：合计 **37** 条（T-50-01..36 + T-50-SC）· `mitigate` 35 条 · `accept` 2 条 ·
`closed` 37 条 · **`open` 0 条** · 高于等于 `high` 阈值的 `open` = **0** ⇒ `threats_open: 0`。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-50-01 | T-50-08 | 设置页进入时的首屏一次全量重扫（100 个技能 × 整目录 stat）是**一次性进入成本**，不在每次投影读取时发生；规模已由 `MAX_USER_SKILLS` + `MAX_MANAGED_SKILLS`（各 50）封顶。**实测**（UAT T7）：121 条规模下 `renderSkillManagement` 19.6 ms、`/api/skills/list` 响应体 109 463 字节 | orchestrator（/gsd-verify-work 50） | 2026-09-15 |
| AR-50-02 | T-50-15 | 卸载的递归删除目标是用户在 `skills/` 下自建的技能目录（规模由 `MAX_USER_SKILLS` = 50 封顶）；删除是**一次性用户动作**（有二次确认），不是可循环触发的路径。尺寸统计的双上限（T-50-02）刻意**不约束**删除（删除必须删干净） | orchestrator（/gsd-verify-work 50） | 2026-09-15 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-15 | 37 | 37 | 0 | orchestrator（`/gsd-secure-phase 50`，State B 新建；ASVS L1） |

**本次审计的取证方式**（ASVS level 1 = grep-depth，符合短路口径 `threats_open: 0` + `register_authored_at_plan_time: true` + `asvs_level == 1` ⇒ 未派发 `gsd-security-auditor`）：

1. 5 份 PLAN 的 `<threat_model>` 块合成寄存器；5 份 SUMMARY 的 `## Threat Flags` 全部为
   **「None —— 未引入计划 `<threat_model>` 之外的信任边界」**并逐条给出承担方式 ⇒ 无新增信任边界。
2. 对每条 `mitigate` 威胁做**定点 L1 实证**（函数体读取 / 计数 / 区界扫描），以及
   **行为层面**由以下套件机械验证 —— 全部本次实际跑通：

   | 套件 | 例数 | 结果 |
   |------|------|------|
   | `tests/test-skills-http-api.js` | 32 | PASS |
   | `tests/test-skills-management.js` | 49 | PASS |
   | `tests/test-skill-picker-model.js` | 115 | PASS |
   | `tests/test-manage-skill.js` | 55 | PASS |
   | `tests/test-ai-skills.js` | 187 | PASS |
   | **合计** | **438** | **全绿** |

3. `50-UAT.md` 的真实运行期 UAT（9/9 pass，0 issues）额外覆盖了三条**只能在运行期验证**的
   安全相关面：T-50-16/18（Electron 内 413 + 反向对照）、T-50-01（设置页 guest 经 token 读到投影）。

---

## 诚实边界（不阻断，如实留档）

1. **T-50-06 / T-50-24 的残余缺口来自既有挂账 `TD-48-01`**（`escapeHtml` 只转义 `& < >`、不转义引号）
   —— 本阶段的责任是**不扩大缺口**并已做到（技能管理区零 `innerHTML`），但**未修复**该既有缺口。
   本文件**不声称** `TD-48-01` 已修。
2. **`WR-02`（`settings-page.js:5350` 的 `sw.disabled = true` 位于 `await` 之前 ⇒ Chromium blur、
   焦点掉到 `<body>`）仍挂账**，本次 UAT 已实测确认该写法存在，但**未修复**。
3. **T-50-32 的门禁验证状态**：原计划自陈「只做过负方向实跑，未做正方向与单点变异」。
   本次审计只做了**读侧核对**（文档逐字读），**未**对 50-05 的两条诚实边界门禁做正方向实跑或单点变异
   ⇒ 该两条门禁的**分辨力未被独立证明**。
4. **本次审计为 L1（grep-depth）**：`asvs_level = 1` 下短路口径允许不派发 auditor。
   故**未**做 L2 边界放置检查与 L3 端到端追踪检查。若后续把 `security_asvs_level` 提到 ≥2，
   应重跑本阶段并派发 `gsd-security-auditor`。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-15
