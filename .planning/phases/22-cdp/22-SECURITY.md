---
phase: 22
slug: cdp
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-02
---

# Phase 22 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| LLM 输出 → 工具参数 | 不可信模型输出经 SDK 传入 execute(params)，containerId/url 均为攻击面（预存在，本阶段不扩大） | 工具参数（containerId、url） |
| 主进程 → electron-store 磁盘文件 | realm-config.json 本地可读写；22-04 起容器校验数据源切换到内存 Map，该校验路径不再受磁盘文件篡改影响 | 容器配置 |
| 主进程 → 渲染进程 | open-url-in-tab IPC 链路预存在且不变；幽灵 Tab 路径（绕过渲染进程的主进程直调 createTab）随 navigate 删除彻底消除 | Tab 创建指令 |
| AI 工具 → .planning 文档 | UI-SPEC/UAT 为流程文档，不进入运行时攻击面 | 无 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-22-04-01 | Tampering | 容器校验数据源（open_link/switch_container） | low | accept | 修复本身即收敛风险：内存 Map 由 initContainers 启动时建立，运行期不受 realm-config.json 磁盘篡改影响；getContainers() 仅返回纯配置字段，信息暴露面不大于原 store 读取（证据：ai-manager.js getContainersLazy ×3 引用） | closed |
| T-22-04-02 | Information Disclosure | 容器存在性 oracle（错误文案区分存在/不存在） | low | accept | 单用户本地应用；AI 经 get_tabs 等既有工具本可获知容器列表，oracle 无增量泄露；错误文案保持契约原样不新增细节 | closed |
| T-22-04-03 | DoS | getContainersLazy 每次调用惰性 require | low | accept | Node 模块缓存使重复 require 为 O(1) 哈希查找；initContainers 内存 Map 读取无 I/O | closed |
| T-22-04-SC | Tampering | npm/pip/cargo installs | — | mitigate | 22-04 无新增依赖、无包安装任务（SUMMARY tech-stack added: []，package.json 最近由 22-01 触碰） | closed |
| T-22-05-01 | Elevation of Privilege | AI 工具选择面（打开链接入口） | low | mitigate | 删除 navigate 后打开链接唯一入口为 open_link：URL 白名单（http/https）+ 容器存在性校验（getContainersLazy 内存权威数据）+ 渲染进程全链路创建，旁路校验的幽灵路径不复存在（证据：`grep -c "name: 'navigate'" ai-manager.js` = 0） | closed |
| T-22-05-02 | Tampering | 截断标记/契约文案措辞 | low | accept | 措辞单位修正不改变数据流与阈值数值（102,400 不变）；标记随既有工具结果 JSON 返回，无新增信息暴露 | closed |
| T-22-05-03 | Repudiation | UI-SPEC 契约变更 | low | mitigate | 契约变更记录小节保留两条契约变更的日期/原因/决策来源（UAT Test 5 用户决策、REVIEW IN-01），审计线索完整（证据：22-UI-SPEC.md「契约变更记录」存在） | closed |
| T-22-05-SC | Tampering | npm/pip/cargo installs | — | mitigate | 22-05 无新增依赖、无包安装任务（SUMMARY tech-stack added: []） | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

注：22-01/22-02/22-03 PLAN 未含 threat_model 块（legacy 计划）；上述登记来自 22-04/22-05 PLAN，覆盖本阶段全部代码变更面（容器校验数据源切换 + navigate 移除 + 截断文案对齐）。22-01 引入的 lib/readability-bundle.js 为 Mozilla Readability 静态打包（Apache 2.0 归属已记录），经 node --check 与三验自动检查 PASS，无新增威胁面。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-22-01 | T-22-04-01 | 内存 Map 数据源切换本身收敛风险，残留面不大于原 store 读取 | planner（22-04 PLAN 记录） | 2026-08-02 |
| AR-22-02 | T-22-04-02 | 单用户本地应用，容器列表对 AI 本就可见，oracle 无增量泄露 | planner（22-04 PLAN 记录） | 2026-08-02 |
| AR-22-03 | T-22-04-03 | 惰性 require 经 Node 模块缓存为 O(1)，无 I/O | planner（22-04 PLAN 记录） | 2026-08-02 |
| AR-22-04 | T-22-05-02 | 措辞单位修正不改数据流与阈值，标记随既有 JSON 返回无新增暴露 | planner（22-05 PLAN 记录） | 2026-08-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-02 | 8 | 8 | 0 | gsd-secure-phase (L1 grep-depth，短路规则：threats_open=0 + register_authored_at_plan_time=true + ASVS L1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-02
