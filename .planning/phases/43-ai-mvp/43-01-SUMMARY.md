---
phase: 43-ai-mvp
plan: 01
subsystem: main-process / ai-memory
tags: [ai-memory, file-storage, agent-tools, node-test, security]
requires: ["ai-manager.js（_buildRealmTools / 两处 Agent 创建点 / REALM_SYSTEM_PROMPT）"]
provides:
  - "ai-memory-manager.js：三层条目式存储（write/readContainer/readScope/writeScope/deleteContainerMemory/buildGlobalSnapshot/scanInjectionPatterns/setBaseDir/BUDGETS）"
  - "Agent 工具：memory（executionMode sequential）/ memory_read"
  - "ai-manager.js buildSystemPrompt()：两处 Agent 创建点快照注入"
  - "npm run test:memory：node:test Wave 0 套件（55 用例）"
affects: ["43-02（container-manager 删除钩子消费 deleteContainerMemory）", "43-03（/api/ai-memory 消费 readScope/writeScope/BUDGETS）"]
tech-stack:
  added: ["node:test（Node 22 内置，项目新测试惯例）"]
  patterns: ["条目式 md 存储（[Mn] 编号写入磁盘格式）", "fail-closed 校验（throw → isError:true toolResult）", "临时目录注入测试（setBaseDir + t.after 清理）"]
key-files:
  created: ["ai-memory-manager.js", "test/memory/helpers.js", "test/memory/storage.test.js", "test/memory/threat-scan.test.js"]
  modified: ["ai-manager.js", "package.json"]
decisions:
  - "BUDGETS（1375/2200/2200）只在 ai-memory-manager.js 定义一处；memory 工具 parameters 不写 maxLength 数值（满足 grep 反向断言），预算语义由 description 承载"
  - "package.json test:memory 用 glob（test/memory/*.test.js）而非目录尾斜杠——Node 22 下 'node --test test/memory/' 把目录当模块解析直接失败"
  - "containerId 校验 /^[\w-]+$/（manager 层，防路径穿越）——LLM 可传 containerId，属 Rule 2 必要加固"
  - "文件全空后 add 取 M1（编号状态完全在文件内，D-10 max+1 语义的自然推论）"
  - "注入扫描清单：中文（忽略/无视/遗忘指令、系统提示词泄露、角色覆写）+ 英文（ignore/disregard previous、reveal system prompt、act as unrestricted），凭据形态组（password=/密码是/sk-/Bearer/api_key/token=/私钥块/ghp_）——以攻击语料全命中+良性零误伤校准"
metrics:
  duration: 16min
  completed: 2026-09-04
actuals:
  tokens: 11900
  tasks: 3
  commits: 5
status: complete
---

# Phase 43 Plan 01: AI 记忆端到端切片 + 存储层 + 威胁扫描 Summary

三层条目式记忆存储（[Mn] 编号 / 字符预算 / 注入+凭据 fail-closed 扫描 / 原子写 / 懒创建）+ memory/memory_read 两个 Agent 工具 + 两处 Agent 创建点冻结快照注入，55 用例 node:test 全绿。

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (tracer) | 端到端切片：存储 manager + 工具注册 + 快照注入 + Wave 0 基建 | e2d8daa | ai-memory-manager.js, ai-manager.js, test/memory/helpers.js, test/memory/storage.test.js, package.json |
| 2 (TDD RED) | replace/remove/scope API 失败测试 | b1a7860 | test/memory/storage.test.js |
| 2 (TDD GREEN) | 写入语义补全：replace/remove、稳定编号、悬空 fail-closed、预算闸门、readScope/writeScope、deleteContainerMemory | dac4de3 | ai-memory-manager.js, test/memory/storage.test.js |
| 3 (TDD RED) | 威胁扫描三语料失败测试 | 2d6f6fb | test/memory/threat-scan.test.js |
| 3 (TDD GREEN) | scanInjectionPatterns 注入+凭据 fail-closed 拦截接入 write() | 3fe1da6 | ai-memory-manager.js |

## Verification Results

- `npm run test:memory`：55/55 全绿（三层落盘回读、懒创建、稳定编号不回收、悬空编号 fail-closed、预算恰好满/超 1 字符边界、扫描三语料 29 条、write 路径落盘不变式、人工路径豁免反向证明）
- `node --check` ai-memory-manager.js / ai-manager.js 均通过
- `grep -c 'systemPrompt: buildSystemPrompt()' ai-manager.js` = 2（两处 Agent 创建点均注入快照）
- `grep -c '1375\|2200' ai-manager.js` = 0（预算数值仅在 manager BUDGETS 一处）
- `executionMode: 'sequential'` 与 `^M[0-9]+$` pattern 字面量均在 memory 工具定义内

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] test:memory script 从目录改为 glob**
- **Found during:** Task 1
- **Issue:** `node --test test/memory/`（目录带尾斜杠）在 Node v22.22.0 下被当作模块路径解析，直接 `MODULE_NOT_FOUND`
- **Fix:** script 改为 `node --test test/memory/*.test.js`
- **Files modified:** package.json
- **Commit:** e2d8daa

**2. [Rule 2 - Missing security validation] containerId 路径穿越校验**
- **Found during:** Task 1
- **Issue:** containerId 直接拼接 `memories/<id>.md` 文件名，`containerId: '../../evil'` 可穿越写任意路径；containerId 可来自 LLM 参数（memory_read）与活跃 tab
- **Fix:** resolveFile 对 container 层强制 `/^[\w-]+$/` 校验，非法即 throw
- **Files modified:** ai-memory-manager.js
- **Commit:** e2d8daa

### TDD Gate Compliance

- Task 2：test(b1a7860 RED) → feat(dac4de3 GREEN) ✓
- Task 3：test(2d6f6fb RED) → feat(3fe1da6 GREEN) ✓
- GREEN 前 RED 均 9/31 用例按预期失败（缺行为而非语法错）；无跳过 RED 情况

## Known Stubs

None — 本 plan 无 stub。replace/remove 在 Task 1 的 add-only 骨架中暂不可用属计划内 TDD 分期（Task 2 已补全）。

## Threat Surface Scan

无新增超出 `<threat_model>` 的安全面：扫描清单（INJECTION_PATTERNS/CREDENTIAL_PATTERNS）即 T-43-01/T-43-02 的既定缓解；containerId 校验强化了 T-43-03 的边界。零新 npm 依赖（T-43-SC 达成）。

## Notes for Downstream Plans

- 43-02：`deleteContainerMemory(containerId)` 幂等可直接挂 `deleteContainer()`（`await cookieManager.deleteCookies(id)` 之后）；引用用惰性 require
- 43-03：`readScope/writeScope`（白名单 user/global/container:<id>，非法 throw）+ `BUDGETS` 导出即 /api/ai-memory 所需全部 API；writeScope 不扫描（D-11），HTTP 层也不应补扫描
- 威胁扫描误报复盘机制（AI-SPEC §6 flywheel）：语料库在 test/memory/threat-scan.test.js，新绕过措辞按「fixture+语料+1」追加

## Self-Check: PASSED

- 4 个新建文件 + SUMMARY.md 全部存在（FOUND）
- 5 个提交（e2d8daa / b1a7860 / dac4de3 / 2d6f6fb / 3fe1da6）全部在 git log 中（FOUND）
