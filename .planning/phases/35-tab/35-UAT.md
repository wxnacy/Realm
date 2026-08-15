---
status: testing
phase: 35-tab
source: [35-VERIFICATION.md]
started: 2026-08-15T05:42:00.000Z
updated: 2026-08-15T05:42:00.000Z
---

## Current Test

number: 1
name: 窗口关闭级联销毁 Tab webContents
expected: |
  创建多个 Tab，关闭窗口，所有 Tab 的 webContents 被显式销毁（通过任务管理器检查进程）
awaiting: user response

## Tests

### 1. 窗口关闭级联销毁 Tab webContents
expected: 创建多个 Tab，关闭窗口，所有 Tab 的 webContents 被显式销毁
result: [pending]

### 2. 活跃任务确认对话框
expected: 启动下载任务后关闭窗口，弹出确认对话框；选择"取消"窗口保持打开；选择"关闭"窗口正常关闭
result: [pending]

### 3. 窗口标题栏视觉显示
expected: 非默认容器 Tab 标题栏显示"容器名 - 页面标题"格式；默认容器只显示页面标题
result: [pending]

### 4. 容器颜色条视觉显示
expected: 非默认容器 Tab 窗口顶部显示 3px 颜色条；默认容器颜色条隐藏；切换 Tab 时颜色条实时更新
result: [pending]

### 5. 关闭最后一个窗口应用退出
expected: 关闭最后一个窗口时，应用正常退出
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
