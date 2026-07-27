---
status: testing
phase: 12-开发者模式
source: [12-VERIFICATION.md]
started: 2026-07-27T12:00:00Z
updated: 2026-07-27T12:00:00Z
---

## Current Test

number: 1
name: 端到端开发者模式流程测试
expected: |
  开启开关 → 添加域名 → webview 导航 → CDP 抓取 → devrequests 页面查看
  devrequests 页面显示抓取的 API 请求记录
awaiting: user response

## Tests

### 1. 端到端开发者模式流程测试
expected: 开启开关 → 添加域名 → webview 导航 → CDP 抓取 → devrequests 页面查看，devrequests 页面显示抓取的 API 请求记录
result: [pending]

### 2. 设置页面开发者模式 UI 交互
expected: toggle 切换、域名添加/删除、队列状态轮询，配置区域禁用/启用状态正确，域名操作正常，队列状态实时更新
result: [pending]

### 3. devrequests 请求查看页面功能
expected: 表格、详情展开、过滤、分页、清空，完整的数据展示和交互功能
result: [pending]

### 4. 应用重启后配置持久化
expected: electron-store 开关和域名列表保持，重启后配置不变
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
