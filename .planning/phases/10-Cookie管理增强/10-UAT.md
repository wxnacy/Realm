---
status: testing
phase: 10-Cookie管理增强
source: [10-VERIFICATION.md]
started: 2026-07-26T15:35:00Z
updated: 2026-07-26T15:35:00Z
---

## Current Test

number: 1
name: 来源切换功能
expected: |
  打开 Cookie 管理面板后，可以看到 Session 和 File 两个标签页。
  点击 Session 标签显示实时 Cookie，点击 File 标签显示持久化 Cookie。
awaiting: user response

## Tests

### 1. 来源切换功能
expected: 打开 Cookie 管理面板后，可以看到 Session 和 File 两个标签页。点击 Session 标签显示实时 Cookie，点击 File 标签显示持久化 Cookie。
result: [pending]

### 2. 域名过滤功能
expected: Cookie 列表上方有域名过滤工具栏，支持"仅当前域名"、"含子域名"、"全部"三种模式。切换过滤模式后列表实时更新。
result: [pending]

### 3. 分页功能
expected: Cookie 列表每页显示 25 条，底部有分页控件。当 Cookie 超过 25 条时可以翻页。
result: [pending]

### 4. 单条编辑功能
expected: 每个 Cookie 行有编辑按钮。点击后弹出编辑模态框，包含 name（只读）、value、domain、path、expirationDate、secure、httpOnly、sameSite 字段。保存后 Cookie 立即更新。
result: [pending]

### 5. 单条删除功能
expected: 每个 Cookie 行有删除按钮。点击后显示确认对话框，确认后 Cookie 从列表中移除，同时从 Session 和文件中删除。
result: [pending]

### 6. 保存到文件（域名过滤）
expected: 点击保存按钮后，只保存当前域名及其子域名的 Cookie 到文件，不保存其他域名的 Cookie。显示成功提示包含保存数量。
result: [pending]

### 7. 样式一致性
expected: Cookie 管理面板宽度 750px，标签页、过滤栏、列表、分页控件样式与应用整体深色主题一致。
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
