---
phase: 24-task-autonomous
plan: 02
subsystem: ai-manager
tags: [ai, tools, form-filling, automation, security]
dependency:
  requires: [24-01]
  provides: [fill_form, execute_action, sanitizeInput, validateScript, requestActionConfirmation]
  affects: [ai-manager.js]
tech_stack:
  added: []
  patterns: [input-sanitization, script-validation, risk-assessment, ipc-confirmation]
key_files:
  created: []
  modified:
    - ai-manager.js
decisions:
  - sanitizeInput 作为独立函数在 ai-manager.js 顶部定义，覆盖 fill_form/execute_action 两个工具的输入消毒
  - validateScript 复用 cdp-manager.js 的危险模式列表，保持两层防护一致
  - requestActionConfirmation 通过 ipcMain.on 监听响应，30 秒超时自动取消
  - 支付检测逻辑：检查 target 和 URL 中的支付关键词（pay/payment/付款/支付/confirm order/place order/下单/结算）
  - fill_form 的 CAPTCHA 检测结果直接返回给 AI，由 AI 提示用户手动操作
metrics:
  duration: ~15m
  completed: "2026-08-02T14:15:00Z"
  tasks_completed: 2
  files_modified: 1
status: complete
---

# Phase 24 Plan 02: fill_form / execute_action AI 工具注册 Summary

## One-Liner

在 AI Manager 中注册 fill_form 和 execute_action 两个 AI 工具，实现风险评估、输入消毒和脚本安全检查。

## What Was Built

### sanitizeInput 输入消毒函数（per D-13）

在 ai-manager.js 顶部新增 `sanitizeInput` 函数，对所有字符串参数执行四层消毒：
1. 过滤 null 字节（\x00）
2. 移除 ${...} 模板字面量表达式
3. 转义反引号防止模板字符串注入
4. 转义单引号和双引号防止字符串逃逸

递归处理嵌套对象和数组，确保 fields 数组中的每个 field/value 都被消毒。

### validateScript 脚本静态分析函数（per D-16）

新增 `validateScript` 函数，检测 execute_script 参数中的 12 种危险模式：
- eval, new Function, import(), require()
- fs., net., http., https. 模块访问
- child_process, process., exec(), spawn()

与 cdp-manager.js 的 DANGEROUS_SCRIPT_PATTERNS 保持一致。

### requestActionConfirmation 高风险操作确认函数（per D-05/D-07）

新增 `requestActionConfirmation` 函数，通过 IPC 实现用户确认流程：
- 发送 `action:request-confirmation` 事件到渲染进程
- 监听 `action:confirm-response:{actionId}` 等待用户响应
- 30 秒超时自动取消
- 窗口不存在时自动返回取消

### fill_form AI 工具

注册 fill_form 工具到 _buildRealmTools()：
- 参数：`{ fields: [{ field: "邮箱", value: "test@example.com" }] }`（per D-02）
- 输入消毒：调用 sanitizeInput 消毒所有参数
- 风险评估：检测 fields 中是否包含 file 类型字段（per D-07）
- 高风险（文件上传）：通过 requestActionConfirmation 等待用户确认
- 低风险：直接调用 cdpManager.fillForm
- CAPTCHA 检测：检测到验证码时返回特殊标记，提示用户手动操作（per D-14/D-15）
- 字段未找到：返回错误信息和可用字段列表（per D-04）

### execute_action AI 工具

注册 execute_action 工具到 _buildRealmTools()：
- 参数：`{ action: 'click', target: '提交按钮', options: {...} }`（per D-11）
- 支持 15 种操作类型（per D-10）
- 风险评估（per D-07）：
  - 高风险：submit、upload、execute_script
  - 支付检测：检查 target/URL 中的支付关键词
- 确认卡片文案：
  - submit → "提交表单：确认向 {url} 提交数据？此操作不可撤销。"
  - upload → "上传文件：确认向 {url} 上传文件？"
  - execute_script → "执行脚本：确认在页面中执行脚本？"
  - payment → "支付操作：确认在 {url} 执行支付？请仔细核对金额。"
- execute_script 安全检查：调用 validateScript 拦截危险调用（per D-13/D-16）
- 返回操作结果 + 页面变化信息（per D-12）

### 系统提示词更新

在 REALM_SYSTEM_PROMPT 中添加 fill_form 和 execute_action 的使用说明，包括参数格式和操作类型列表。

## Decisions Made

1. **sanitizeInput 放在 ai-manager.js 顶部而非 cdp-manager.js**：消毒逻辑是 AI 工具层的职责，CDP 层只负责执行。两层职责分离。
2. **validateScript 与 cdp-manager.js 的 DANGEROUS_SCRIPT_PATTERNS 保持一致**：双重防护，AI 工具层先拦截，CDP 层 executeAction 内部也有检查。
3. **支付检测使用关键词匹配而非页面特征检测**：简单可靠，覆盖常见支付场景。后续可根据实际使用情况扩展。
4. **requestActionConfirmation 超时 30 秒**：平衡用户体验和安全性，避免长时间阻塞 AI 对话。

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

```
$ node -e "const am = require('./ai-manager'); const ai = new am(); const tools = ai._buildRealmTools(); const t = tools.find(t => t.name === 'fill_form'); console.log(t ? 'PASS: ' + t.name : 'FAIL')"
PASS: fill_form

$ node -e "const am = require('./ai-manager'); const ai = new am(); const tools = ai._buildRealmTools(); const t = tools.find(t => t.name === 'execute_action'); console.log(t ? 'PASS: ' + t.name : 'FAIL')"
PASS: execute_action

Tools count: 10
Tool names: get_tabs, search_history, manage_favorites, search_favorites_fulltext, switch_container, read_page_content, extract_links, open_link, fill_form, execute_action
```

## Known Stubs

None - all tools are fully wired with CDP backend calls.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: ipc-confirmation | ai-manager.js | requestActionConfirmation 通过 IPC 接收用户确认响应，需确保 actionId 不可预测（当前使用时间戳+随机数） |

## Self-Check: PASSED

- [x] ai-manager.js exists and loads successfully
- [x] 24-02-SUMMARY.md created
- [x] Commit 4aa91a1 verified in git log
- [x] fill_form tool registered (verified)
- [x] execute_action tool registered (verified)
- [x] 10 total tools in _buildRealmTools()
