---
status: testing
phase: 40-web-search
source: [40-01-SUMMARY.md, 40-02-SUMMARY.md, 40-03-SUMMARY.md]
started: 2026-08-26T23:20:00Z
updated: 2026-08-28T20:35:00Z
---

## Current Test

[number: 1]
[name: AI 助手搜索功能]
[status: issue]
[reported: 随便输入一个无效的 API Key 也显示搜索成功，没有验证 API Key 的有效性]

## Tests

### 1. AI 助手搜索功能
expected: |
  在 AI 聊天中询问实时信息（如"今天北京天气如何"），AI 能够调用 web_search 工具搜索互联网，返回包含标题、链接和摘要的搜索结果列表。
result: issue
reported: "随便输入一个无效的 API Key 也显示搜索成功，没有验证 API Key 的有效性"
severity: major

### 2. 搜索结果格式化
expected: |
  搜索结果以 Markdown 编号列表形式展示，每条结果包含标题（可点击链接）、URL 和内容摘要。
result: pass

### 3. 多 Provider 自动回退
expected: |
  当配置的搜索 Provider（如 Tavily）失败时，系统自动降级到免费 Provider（anysearch_free），无需用户手动干预。搜索仍能返回结果。
result: pass
note: Gap G-40-3 已由40-02 计划修复 - 添加了12条 [Realm Search] 日志覆盖 doSearch/doAutoSearch/runProviderSearch

### 4. 速率限制保护
expected: |
  连续快速发送多个搜索请求（如 3 次搜索在 10 秒内），不会触发 API 限流错误。系统自动控制请求间隔，搜索正常返回结果。
result: pass
note: 代码层面验证通过 - SearchRateLimiter 实现了 minIntervalMs 间隔控制、maxConcurrent 并发限制、429 指数退避

### 5. SSRF 防护
expected: |
  如果搜索查询中包含私有 IP 地址（如 127.0.0.1、192.168.1.1）或内网域名，系统会阻止访问并返回安全错误，不会泄露内网信息。
result: pass

### 6. 搜索失败错误反馈
expected: |
  当所有搜索 Provider 都失败时，AI 返回明确的错误诊断信息，包括失败原因和尝试次数，而不是沉默失败。
result: pass
note: Gap G-40-6 已由 40-03 计划修复 - 自动化验证通过：all_failed 场景展示 Provider 名称、错误类型、错误消息；非 all_failed 场景返回通用消息

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- gap_id: G-40-3
  truth: "搜索过程应记录 info 级别日志，包含使用的 provider、查询参数和返回结果"
  status: resolved
  resolved_by: 40-02-PLAN.md
  resolved_at: 2026-08-28
  severity: minor
  test: 3

- gap_id: G-40-6
  truth: "当所有搜索 Provider 都失败时，AI 返回明确的错误诊断信息，包括失败原因和尝试次数"
  status: resolved
  resolved_by: 40-03-PLAN.md
  resolved_at: 2026-08-28
  severity: major
  test: 6

- gap_id: G-40-7
  truth: "无效的 API Key 应导致搜索失败并返回明确错误，而不是显示成功"
  status: failed
  reason: "User reported: 随便输入一个无效的 API Key 也显示搜索成功，没有验证 API Key 的有效性"
  severity: major
  test: 1
