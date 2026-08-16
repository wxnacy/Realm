---
status: complete
phase: 35-tab
source: [35-VERIFICATION.md]
started: 2026-08-15T05:42:00.000Z
updated: 2026-08-15T05:42:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. 窗口关闭级联销毁 Tab webContents
expected: 创建多个 Tab，关闭窗口，所有 Tab 的 webContents 被显式销毁
result: pass

### 2. 活跃任务确认对话框
expected: 启动下载任务后关闭窗口，弹出确认对话框；选择"取消"窗口保持打开；选择"关闭"窗口正常关闭
result: pass

### 3. 窗口标题栏视觉显示
expected: 非默认容器 Tab 标题栏显示"容器名 - 页面标题"格式；默认容器只显示页面标题
result: pass
note: 用户确认所有容器均只显示页面标题，接受当前行为

### 4. 容器颜色条视觉显示
expected: 非默认容器 Tab 窗口顶部显示 3px 颜色条；默认容器颜色条隐藏；切换 Tab 时颜色条实时更新
result: issue
reported: "颜色会把标签页的颜色盖住，去掉这个功能"
severity: major

### 5. 关闭最后一个窗口应用退出
expected: 关闭最后一个窗口时，应用正常退出
result: issue
reported: "没有关闭，而是打开 realm://newtab"
severity: major

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "非默认容器 Tab 窗口顶部显示 3px 颜色条；默认容器颜色条隐藏；切换 Tab 时颜色条实时更新"
  status: failed
  reason: "用户报告: 颜色会把标签页的颜色盖住，去掉这个功能"
  severity: major
  test: 4
  artifacts: []
  missing: []
- truth: "关闭最后一个窗口时，应用正常退出"
  status: failed
  reason: "用户报告: 没有关闭，而是打开 realm://newtab"
  severity: major
  test: 5
  artifacts: []
  missing: []
