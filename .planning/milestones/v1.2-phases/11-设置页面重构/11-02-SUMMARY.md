---
phase: 11-设置页面重构
plan: 02
subsystem: api
tags: [rules-import, normalization, tdd, regression-test]

requires:
  - phase: 11-01
    provides: 设置页面重构后的规则管理 UI 与 /api/rules/* HTTP 路由骨架
provides:
  - assignment-rules.js normalizeRulesPayload 导出（任意层级 {rules} 包裹解包）
  - /api/rules/import 服务端归一化防御层
  - handleFileSelect 客户端发送前解包 + result.success 失败检查 + finally 重置
  - scripts/test-rules-import-roundtrip.js 持久运行时回归护栏
affects: [settings-page, assignment-rules, rules-api, uat]

tech-stack:
  added: []
  patterns:
    - "服务端 body 归一化防御层：normalizeXxxPayload 循环解包任意层级 {key} 包裹，与既有 Array.isArray 入口校验串联"
    - "HTTP 200 失败对象的客户端检查契约：result.success === false → toast result.message（沿用 resetShortcut 模式）"

key-files:
  created:
    - scripts/test-rules-import-roundtrip.js
  modified:
    - assignment-rules.js
    - main.js
    - src/settings-page.js

key-decisions:
  - "服务端归一化放在 main.js import 路由调用 importRules 之前，而非修改 importRules 入口校验——保护 ipc-handlers.js rule:import 路径的既有契约不变"
  - "归一化结果放入新局部变量 rules，不复用 rulesData——让函数级负向 grep 能以旧写法字面（rules: rulesData）为靶验证旧代码已清除"
  - "去重文案「所有 N 条规则均已存在，未导入」通过冒烟测试锁定——它将经 HTTP 200 body 到达客户端 toast，改动会让用户看到错乱的失败原因"

patterns-established:
  - "归一化防御层模式：normalizeRulesPayload 在模块出口处对外提供纯函数，路由层串联 importRules 而不侵入 importRules 自身校验逻辑"
  - "文件输入重置 finally 化：所有早退路径（格式非法、服务端失败）都必须重置文件输入以保证 change 事件可再次触发"

requirements-completed: [SETT-09]

coverage:
  - id: D1
    description: "normalizeRulesPayload 覆盖裸数组/单层包裹/双层包裹/非法输入四种形态，非法输入返回 null"
    requirement: SETT-09
    verification:
      - kind: unit
        ref: "node scripts/test-rules-import-roundtrip.js（断言 1-5）"
        status: pass
    human_judgment: false
  - id: D2
    description: "导出→导入往返可用：应用自身导出产物导入成功，count=2 skipped=0"
    requirement: SETT-09
    verification:
      - kind: integration
        ref: "node scripts/test-rules-import-roundtrip.js（断言 6：导出→导入往返）"
        status: pass
    human_judgment: false
  - id: D3
    description: "服务端防御等效：旧版双层包裹 payload 同样导入成功"
    requirement: SETT-09
    verification:
      - kind: integration
        ref: "node scripts/test-rules-import-roundtrip.js（断言 7：防御等效）"
        status: pass
    human_judgment: false
  - id: D4
    description: "归一化失败时 importRules 返回结构化失败对象，去重文案含「均已存在」供客户端 toast"
    requirement: SETT-09
    verification:
      - kind: unit
        ref: "node scripts/test-rules-import-roundtrip.js（断言 8-9）"
        status: pass
    human_judgment: false
  - id: D5
    description: "UAT test 2 重跑：设置页导出→删除→再导入，toast 显示真实条数；非法文件导入显示失败原因"
    requirement: SETT-09
    verification: []
    human_judgment: true
    rationale: "端到端 UI 交互（webview toast、文件选择对话框、列表刷新）需在运行中的 Electron 应用内人工确认；自动化冒烟测试已覆盖数据层，但 toast 文案与文件输入重置的用户感知只能人工判断"
---

# Plan 11-02 Summary: 规则导入失效修复（gap closure）

## Objective

修复 11-UAT.md 报告的唯一 gap（severity: major, test 2）：规则导出文件无法被重新导入，且失败被静默吞掉显示假成功 toast。

## Outcome

**双管齐修完成，9/9 冒烟断言通过。**

- 服务端：assignment-rules.js 新增 normalizeRulesPayload 防御层（main.js:646-651 接入），任意层级 {rules} 包裹均可被接受
- 客户端：handleFileSelect 发送前解包 + result.success 失败检查 + finally 重置文件输入
- 持久护栏：scripts/test-rules-import-roundtrip.js 纳入 git，纯 Node 可重复运行

## Tasks Executed

### Task 1: 服务端导入归一化防御（TDD）

**RED → GREEN 流程证据：**

1. **RED**: 新建 scripts/test-rules-import-roundtrip.js 后运行，首条断言 `typeof mod.normalizeRulesPayload === 'function'` 失败（函数尚不存在），9 条断言 8 条因 `normalizeRulesPayload is not a function` 全部失败
2. **GREEN**: assignment-rules.js 在 exportRules 与 importRules 之间插入 normalizeRulesPayload（while 循环解包，是数组则返回，否则返回 null），加入 module.exports；main.js import 路由改为先读整 body 再 `importRules(normalizeRulesPayload(payload))`
3. **验证**: 9/9 断言 PASS，exit 0

**关键实现：** `assignment-rules.js:243-258`（normalizeRulesPayload）；`main.js:646-651`（路由接入）。

### Task 2: 客户端 handleFileSelect 修复

仅改 src/settings-page.js 的 handleFileSelect（行 555-602 重写），三处：

1. **发送前解包归一化**：JSON.parse 得 rulesData 后 `const rules = Array.isArray(rulesData) ? rulesData : rulesData.rules`，校验为数组后才构造请求体；命名约定遵守——归一化结果放新变量 rules，不复用 rulesData，函数级负向 grep `rules: rulesData` 命中 0
2. **失败响应检查**：`if (result.success === false) { showToast(result.message || '导入失败'); return; }`，对齐 resetShortcut 行 832 模式
3. **文件输入重置 finally 化**：`e.target.value = ''` 从 try/catch 之后移入 finally 块，覆盖所有早退路径

**关键实现：** `src/settings-page.js:555-602`（handleFileSelect 整体重写）。

## Verification Results

| 检查 | 命令 | 结果 |
|------|------|------|
| 冒烟测试 | `node scripts/test-rules-import-roundtrip.js` | 9 passed, 0 failed, exit 0 |
| normalizeRulesPayload 在 assignment-rules.js | `grep -c 'normalizeRulesPayload' assignment-rules.js >= 2` | PASS |
| main.js import 路由接入归一化 | `sed -n "/route === 'import'/,/return;/p" main.js \| grep -c 'normalizeRulesPayload' >= 1` | PASS |
| 客户端 Array.isArray 归一化 | 函数级 grep ≥1 | PASS |
| 客户端 result.success 检查 | 函数级 grep ≥1 | PASS |
| 客户端 finally | 函数级 grep ≥1 | PASS |
| 客户端旧双重包裹写法 | 函数级 grep `rules: rulesData` = 0 | PASS |
| 语法检查 | `node --check main.js / assignment-rules.js / src/settings-page.js` | PASS |

## Deviations from Plan

无。计划的两处明确禁止均遵守：
- 未修改 exportRules 输出格式与 importRules 校验/去重语义
- 未改动 ipc-handlers.js 的 rule:import/rule:export（调试 session 已确认其为死代码）
- 未新增 npm 依赖（冒烟测试仅用 Node 内置模块）
- 新增 JSDoc 未抄写旧双重包裹请求体写法字面值

## Threat Model Dispositions

| Threat ID | Disposition | Evidence |
|-----------|-------------|----------|
| T-11-02-01 (Tampering: body 解析) | mitigate | normalizeRulesPayload 仅认 rules 数组；冒烟测试断言 5 锁定非法输入返回 null |
| T-11-02-02 (DoS: 超大/畸形 JSON) | accept | 既有 readJsonBody 错误处理与 token 鉴权不变 |
| T-11-02-03 (Tampering: 规则覆盖) | accept | importRules 仅新增不覆盖，去重语义被冒烟测试断言 9 锁定 |
| T-11-02-SC (Tampering: 依赖供应链) | accept | 无新增依赖 |

## Commits

```
1e83a23 fix(11-02): 客户端规则导入发送前解包 + 失败可见性
51143c0 fix(11-02): 服务端规则导入归一化防御层
```

## Human Verification Needed

UAT test 2 重跑（end-of-phase 人工验证）：

1. 设置页「分配规则」→ 导出规则得到 realm-rules.json
2. 删除全部规则
3. 导入刚导出的 realm-rules.json → toast 应显示「已导入 N 条规则」（N 为实际数量），列表恢复
4. 任意选一个非规则 JSON 文件导入 → toast 应显示失败原因（如「规则数据格式不正确」或「文件格式不正确：缺少 rules 数组」）
5. 导入失败后再次选择同一文件 → change 事件正常触发（文件输入已被 finally 重置）

## Files Modified

| 文件 | 变更 |
|------|------|
| assignment-rules.js | 新增 normalizeRulesPayload 导出（24 行） |
| main.js | /api/rules/import 路由接入归一化（3 行改动） |
| src/settings-page.js | handleFileSelect 重写（21+/4-） |
| scripts/test-rules-import-roundtrip.js | 新增（162 行，纯 Node 持久回归护栏） |
