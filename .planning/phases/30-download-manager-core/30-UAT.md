---
status: testing
phase: 30-download-manager-core
source: [30-VERIFICATION.md]
started: 2026-08-11T16:05:00Z
updated: 2026-08-11T16:05:00Z
---

## Current Test

number: 1
name: 系统保存对话框弹出
expected: |
  弹出 macOS 原生保存对话框（NSSavePanel），可选择保存路径，点击取消可阻止下载
awaiting: user response

## Tests

### 1. 系统保存对话框弹出
expected: 弹出 macOS 原生保存对话框（NSSavePanel），可选择保存路径，点击取消可阻止下载
result: [pending]

### 2. 实时进度追踪和三态按钮切换
expected: 按钮从默认箭头切换为圆圈进度环，显示数字徽标，进度环随下载进度实时更新；下载完成后显示绿色对勾 3 秒后恢复默认图标
result: [pending]

### 3. Tooltip 显示下载详情
expected: tooltip 显示文件名、已下载/总大小、速度（如 1.5 MB/s）、剩余时间（如 剩余 30s）
result: [pending]

### 4. SQLite 持久化和容器隔离
expected: 下载记录在 SQLite 中持久化，重启后仍可查询；每个容器只能看到自己的下载记录
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
