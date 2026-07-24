---
status: partial
phase: 03-data-isolation-cookie-persistence
source: [03-01-SUMMARY.md, 03-VERIFICATION.md]
started: 2026-07-24T10:05:00Z
updated: 2026-07-24T10:20:00Z
---

## Current Test

number: 4
name: 手动导出/导入验证
expected: |
  导出容器 Cookie → 删除容器 → 导入 Cookie → 检查 Cookie 恢复，导入后 Cookie 完全恢复，网站登录状态保持
awaiting: testing complete

## Tests

### 1. 容器间数据隔离验证
expected: 在容器 A 登录网站（如 GitHub）→ 切换到容器 B → 访问同一网站，容器 B 未登录，显示登录页面
result: pass

### 2. Cookie 持久化验证
expected: 在容器中登录网站 → 关闭应用 → 重新打开 → 访问同一网站，仍然保持登录状态
result: pass

### 3. 容器删除清理验证
expected: 删除容器 → 检查 userData/cookies 目录 → 重新创建同名容器，Cookie 文件被删除，新容器无旧 Cookie 残留
result: issue
reported: "JSON 文件可以删除，但 Partitions 目录无法完全清理（被 Electron 自动重建或进程占用）"
severity: minor
debug_session: .planning/debug/container-delete-partitions.md

### 4. 手动导出/导入验证
expected: 导出容器 Cookie → 删除容器 → 导入 Cookie → 检查 Cookie 恢复，导入后 Cookie 完全恢复，网站登录状态保持
result: skipped
reason: UI 按钮未实现，仅 API 层可用

## Summary

total: 4
passed: 2
issues: 1
pending: 0
skipped: 1

## Gaps

- truth: "删除容器时 Partitions 目录应被完全清理"
  status: failed
  reason: "JSON 文件可删除，但 Partitions/container-{id}/ 目录被 Electron 自动重建或进程占用无法删除"
  severity: minor
  test: 3
  artifacts: [cookie-manager.js, container-manager.js]
  missing: [Electron session 清理 API]
  debug_session: .planning/debug/container-delete-partitions.md
