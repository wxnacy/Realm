---
status: partial
phase: 03-data-isolation-cookie-persistence
source: [03-01-SUMMARY.md, 03-VERIFICATION.md]
started: 2026-07-24T10:05:00Z
updated: 2026-07-24T13:12:36Z
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
result: pass
note: 修复后回归验证通过（2026-07-24）。运行中 Cookie/缓存数据即时清除；Partitions 目录因 Chromium 架构限制（session 生命周期=进程生命周期）可能暂存空壳，退出应用时物理删除、启动时兜底清理。详见 .planning/debug/container-delete-partitions.md

### 4. 手动导出/导入验证
expected: 导出容器 Cookie → 删除容器 → 导入 Cookie → 检查 Cookie 恢复，导入后 Cookie 完全恢复，网站登录状态保持
result: skipped
reason: UI 按钮未实现，仅 API 层可用

## Summary

total: 4
passed: 3
issues: 0
pending: 0
skipped: 1

## Gaps

无未解决 gap。（Test 4 为 skipped：导出/导入 UI 按钮未实现，仅 API 层可用，属功能范围外而非缺陷）
