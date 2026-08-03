---
status: diagnosed
phase: 25-script-tab
source: [25-01-SUMMARY.md, 25-02-SUMMARY.md, 25-03-SUMMARY.md, 25-04-SUMMARY.md, 25-05-SUMMARY.md]
started: 2026-08-03T10:45:45Z
updated: 2026-08-03T10:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 冷启动冒烟测试
expected: 完全退出应用后重新 npm run dev 启动，应用无报错启动，窗口正常，能新建 tab 加载网页，AI 面板可用（main.js / src/index.html 在本阶段被修改，需验证冷启动无回归）
result: pass

### 2. 自动覆盖项确认
expected: |
  以下 20 项交付物已全部由自动化验证覆盖（静态验证均通过），请确认可信：
  【25-01 脚本生成工具】generate_script 工具注册 ✓ / 13 种操作白名单 ✓ / validateScriptForSteps 步骤级静态分析 ✓ / 系统提示词含使用指南 ✓
  【25-02 脚本预览卡片】卡片 HTML+CSS ✓ / renderScriptPreviewCard 渲染函数 ✓ / 拖拽排序+内联编辑+增删步骤 ✓ / 步骤状态与拖拽样式 ✓
  【25-03 脚本执行引擎】executeScript 逐步执行引擎 ✓ / script:execute + script:stop IPC ✓ / script:step-update 实时推送 ✓ / 渲染端状态 UI ✓
  【25-04 标签分组工具】suggest_tab_groups 注册 ✓ / strategy 参数(domain/semantic/mixed) ✓ / getTabs 数据获取 ✓ / groups 返回格式 ✓ / 空标签页友好提示 ✓ / 系统提示词 ✓
  【25-05 分组卡片 UI】分组卡片模板/样式/渲染 ✓ / tab:reorder 标签栏重排链路 ✓
result: pass

### 3. generate_script 工具在 _buildRealmTools 中注册，包含参数定义和 execute 函数
expected: generate_script 工具在 _buildRealmTools 中注册，包含参数定义和 execute 函数
result: pass
source: automated
coverage_id: 25-01-D1

### 4. SCRIPT_ALLOWED_ACTIONS 白名单包含 13 种允许的操作类型
expected: SCRIPT_ALLOWED_ACTIONS 白名单包含 13 种允许的操作类型
result: pass
source: automated
coverage_id: 25-01-D2

### 5. validateScriptForSteps 函数实现步骤级静态分析，验证白名单和危险模式
expected: validateScriptForSteps 函数实现步骤级静态分析，验证白名单和危险模式
result: pass
source: automated
coverage_id: 25-01-D3

### 6. 系统提示词包含 generate_script 工具描述和使用指南
expected: 系统提示词包含 generate_script 工具描述和使用指南
result: pass
source: automated
coverage_id: 25-01-D4

### 7. 脚本预览卡片 HTML 模板（script-preview-template）和完整 CSS 样式
expected: 脚本预览卡片 HTML 模板（script-preview-template）和完整 CSS 样式
result: pass
source: automated
coverage_id: 25-02-D1

### 8. renderScriptPreviewCard 主渲染函数、renderScriptStepItem 步骤渲染、renderStepEditor 内联编辑器
expected: renderScriptPreviewCard 主渲染函数、renderScriptStepItem 步骤渲染、renderStepEditor 内联编辑器
result: pass
source: automated
coverage_id: 25-02-D2

### 9. 步骤拖拽排序、内联编辑、添加/删除步骤、自动重新编号
expected: 步骤拖拽排序、内联编辑、添加/删除步骤、自动重新编号
result: pass
source: automated
coverage_id: 25-02-D3

### 10. 步骤状态样式（executing/success/error/skipped）、拖拽样式、编辑器样式
expected: 步骤状态样式（executing/success/error/skipped）、拖拽样式（dragging/drag-over）、编辑器样式
result: pass
source: automated
coverage_id: 25-02-D4

### 11. executeScript 脚本执行引擎 - 逐步调用 cdpManager.executeAction，失败停止，支持中断
expected: executeScript 脚本执行引擎 - 逐步调用 cdpManager.executeAction，失败停止，支持中断
result: pass
source: automated
coverage_id: 25-03-D1

### 12. script:execute 和 script:stop IPC 处理器 - 主进程脚本执行和中断控制
expected: script:execute 和 script:stop IPC 处理器 - 主进程脚本执行和中断控制
result: pass
source: automated
coverage_id: 25-03-D2

### 13. script:step-update 实时推送 - 每步执行结果推送到渲染进程
expected: script:step-update 实时推送 - 每步执行结果推送到渲染进程
result: pass
source: automated
coverage_id: 25-03-D3

### 14. 渲染进程步骤状态 UI - executing/success/error/skipped 状态切换和错误面板
expected: 渲染进程步骤状态 UI - executing/success/error/skipped 状态切换和错误面板
result: pass
source: automated
coverage_id: 25-03-D4

### 15. suggest_tab_groups 工具在 _buildRealmTools() 中注册
expected: suggest_tab_groups 工具在 _buildRealmTools() 中注册
result: pass
source: automated
coverage_id: 25-04-D1

### 16. 工具参数包含 strategy (enum: domain/semantic/mixed) 和 containerId (optional)
expected: 工具参数包含 strategy (enum: domain/semantic/mixed) 和 containerId (optional)
result: pass
source: automated
coverage_id: 25-04-D2

### 17. execute 函数调用 tabManager.getTabs() 获取标签页数据
expected: execute 函数调用 tabManager.getTabs() 获取标签页数据
result: pass
source: automated
coverage_id: 25-04-D3

### 18. 返回格式包含 groups 数组，每组有 name 和 tabs 字段
expected: 返回格式包含 groups 数组，每组有 name 和 tabs 字段
result: pass
source: automated
coverage_id: 25-04-D4

### 19. 空标签页时返回友好的提示信息
expected: 空标签页时返回友好的提示信息
result: pass
source: automated
coverage_id: 25-04-D5

### 20. REALM_SYSTEM_PROMPT 包含 suggest_tab_groups 工具描述和使用场景
expected: REALM_SYSTEM_PROMPT 包含 suggest_tab_groups 工具描述和使用场景
result: pass
source: automated
coverage_id: 25-04-D6

### 21. 标签分组建议卡片 UI（模板、样式、渲染函数）
expected: 标签分组建议卡片 UI（模板、样式、渲染函数）
result: pass
source: automated
coverage_id: 25-05-D1

### 22. 标签栏重排 IPC 和主进程逻辑
expected: 标签栏重排 IPC 和主进程逻辑
result: pass
source: automated
coverage_id: 25-05-D2

### 23. 端到端：AI 整理标签页并实际应用分组
expected: 在 AI 面板输入「整理标签页」，出现可交互的分组建议卡片，点击「应用分组」后标签栏实际按组重排
result: issue
reported: "AI 只输出 markdown 表格回答，实际标签页没有整理，AI 自称没有移动标签页的权限"
severity: major

## Summary

total: 23
passed: 22
issues: 1
pending: 0
skipped: 0

## Gaps

- gap_id: G-25-23
  truth: "AI 整理标签页后用户可通过卡片「应用分组」实际重排标签栏（默认 semantic 策略下同样可用）"
  status: resolved
  reason: "User reported: AI 只输出 markdown 表格回答，实际标签页没有整理，AI 自称没有移动标签页的权限"
  severity: major
  test: 23
  root_cause: "suggest_tab_groups 三种策略返回结构不一致：domain 返回 {groups}（卡片可渲染），semantic 返回 {tabs,message}、mixed 返回 {stableGroups,refineableGroups}（ai-manager.js:2307-2362）。渲染端仅在 resultData.groups 存在时渲染卡片（src/renderer.js:3935），而默认策略恰是 semantic（ai-manager.js:443），导致默认路径卡片永不渲染。且 AI 无 apply_tab_groups 工具，语义分组结论只存在于 AI 文本回复中，无结构化回传通道；系统提示词也未告知卡片存在"
  artifacts:
    - path: "ai-manager.js"
      issue: "semantic/mixed 策略不返回 {groups} 结构，分组结论无结构化回传"
    - path: "src/renderer.js"
      issue: "renderToolCards 仅识别 resultData.groups，semantic/mixed 结果不触发卡片"
    - path: "ai-manager.js REALM_SYSTEM_PROMPT"
      issue: "未告知 AI 分组卡片的存在与应用方式，AI 误判自己无操作权限"
  missing:
    - "semantic/mixed 策略的结构化 groups 回传机制（AI 二次调用提交分组结果，或工具内完成确定性分组）"
    - "渲染端对 semantic/mixed 结果形态的卡片渲染支持"
    - "系统提示词补充分组卡片的应用引导"
  debug_session: "verify-work 主会话内联诊断（2026-08-03）"
