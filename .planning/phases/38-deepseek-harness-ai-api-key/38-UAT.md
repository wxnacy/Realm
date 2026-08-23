---
status: complete
phase: 38-deepseek-harness-ai-api-key
source: [38-01-SUMMARY.md, 38-02-SUMMARY.md, 38-03-SUMMARY.md]
started: 2025-08-21T17:20:00Z
updated: 2026-08-22T18:45:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 11
name: 发送按钮
expected: |
  聊天面板工具栏右侧的发送按钮可正常发送消息，功能与之前输入区的发送按钮一致。
result: pass（假 key 下验证发送链路：用户气泡、输入框清空、401 错误容器正常显示）

## Tests

### 1. 设置页供应商列表
expected: 打开设置页面，AI 助手区域显示左右分栏布局。左侧供应商列表展示已配置的供应商，支持搜索过滤。
result: pass

### 2. 添加内置供应商
expected: 点击供应商列表下方的「添加内置供应商」按钮，弹出对话框显示内置供应商列表。选择一个供应商后，左侧列表新增该供应商条目。
result: pass

### 3. 添加自定义供应商
expected: 点击「添加自定义供应商」按钮，右侧编辑区显示表单（名称、API Key、环境变量名、模型标签等）。填写后保存，左侧列表新增自定义供应商。
result: pass（用户确认 + 自动化复验）

### 4. 编辑供应商配置
expected: 点击左侧供应商条目，右侧显示编辑表单。修改 API Key 或环境变量名后保存，配置成功持久化。
result: pass（自动化：改环境变量名 → 保存 → 重选后值持久化，key 预览正常）

### 5. 删除供应商
expected: 在编辑区点击删除按钮，弹出确认对话框。确认后供应商从列表中移除。
result: pass（自动化：确认框出现 → 删除 → 列表移除 + toast 提示）

### 6. 环境变量检测
expected: 编辑供应商时，环境变量名输入框旁显示检测状态（绿色=已找到，红色=未找到）。自动检测当前环境变量是否存在。
result: pass（自动化：绿→红→绿切换正常；修复了 customName 查询参数与 token 拼接冲突导致 403 的 bug）

### 7. 模型检测
expected: 编辑区点击「检测模型」按钮，调用供应商 API 获取可用模型列表，结果以标签形式显示在模型标签区域。
result: pass（用户确认真 key 可获取；自动化验证假 key 401 错误展示）

### 8. 新对话按钮
expected: 聊天面板工具栏点击「新对话」按钮，消息列表清空，流式状态重置，上下文 pill 清除。
result: pass（自动化：消息列表和 pills 均清空）

### 9. 模型选择器下拉
expected: 点击聊天面板工具栏的模型选择器按钮，弹出下拉菜单。菜单按供应商分组显示可用模型，当前选中模型高亮。
result: pass（自动化：分组、active 高亮、accent 圆点、pointerdown 点击外部关闭均正常；修复了主窗口 file:// 源 fetch localhost 被 CORS 拦截 + 单引号模板字符串不插值的双重 bug）

### 9+. 补充验证项（2026-08-22）
| 项 | 结果 |
|----|------|
| 模型选择器键盘导航（↑↓/Enter/Esc） | pass（问题 16：focused 无 CSS 样式 + 无初始聚焦项，已修复复验） |
| API Key 显示/隐藏切换 | pass（password ↔ text，按钮文本联动） |
| 内置供应商弹窗搜索过滤 | pass（40 个供应商，关键词过滤、无匹配提示正常） |
| 删除供应商 | pass（列表移除，activeProvider 与其他供应商 init 不受影响） |
| 聊天面板 AI 设置按钮 | pass（用户确认） |

### 10. 切换模型
expected: 在模型选择器下拉中选择另一个供应商的模型，选择器按钮更新显示新模型名称，对应供应商自动激活。
result: pass（自动化：按钮文本更新、下拉关闭、后端 activeModel 持久化、Agent 重新初始化）

### 11. 发送按钮
expected: 聊天面板工具栏右侧的发送按钮可正常发送消息，功能与之前输入区的发送按钮一致。
result: pass（自动化：用户气泡出现、输入框清空、假 key 401 时错误容器正常展示）

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

测试期间发现的问题均已修复并复验通过，详见 38-UAT-ISSUES.md（问题 1-10）。
