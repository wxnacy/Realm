---
status: passed
phase: 06-浏览历史记录
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md]
started: 2026-07-25T15:00:00Z
updated: 2026-07-25T19:00:00Z
---

## Current Test

[done — 11/11 全部通过]

## Tests

### 1. 冷启动冒烟测试
expected: 应用从零启动无报错，数据库初始化正常，主窗口正常加载
result: pass
fix: "better-sqlite3 v13 与 Electron 32 不兼容导致 SIGSEGV，降级到 v11.7.0 并延迟加载原生模块解决"

### 2. 工具栏历史按钮
expected: 工具栏显示历史记录按钮，点击后打开 realm://history 的新 Tab，页面正常加载
result: pass
reported: "页面有 UI 但样式错乱，记录列表为空"
severity: major
fix: "已修复：(1) history.html 加 <base href=\"/history/\"> 解决 CSS/JS 相对路径 404；(2) 数据层从 IPC 改为 /api/history/* HTTP API（webview guest 被 assertTrustedSender 拒绝），token 经 URL 注入。2026-07-25 用户复测通过"

### 3. 导航自动记录历史
expected: 在任意容器中访问一个网页后，历史记录自动写入当前容器的 SQLite 表中
result: pass

### 4. 历史记录列表展示
expected: 按日期分组显示（今天/昨天/本周/本月/更早），每条记录显示 favicon、标题、URL 和访问时间
result: pass

### 5. 搜索历史记录
expected: 搜索框输入关键词后实时过滤并高亮匹配文本
result: pass
fix: "搜索无结果时页面收缩居中——body 是主窗口 flex 布局，.history-page 缺 flex:1 宽度随内容收缩；添加 flex:1 修复"

### 6. 删除单条历史记录
expected: 点击删除按钮后该记录从列表中移除，无需确认弹窗
result: pass

### 7. 批量删除历史记录
expected: 勾选多条记录后批量删除，弹出确认弹窗
result: pass

### 8. 清空全部历史记录
expected: 点击清空按钮弹出确认弹窗，确认后清空所有记录
result: pass
fix: "清空后旧记录残留需刷新才消失——renderEmpty() 不清空 historyContent；已修复"

### 9. 容器历史记录隔离
expected: 不同容器的历史记录互不可见
result: pass
fix: "历史按钮跨容器复用已有历史 tab 导致串数据；复用条件增加 tab.containerId 匹配（数据层隔离另有 22 项自动化断言覆盖）"

### 10. 空状态显示
expected: 无记录时显示「暂无浏览记录」，搜索无结果显示「未找到匹配的历史记录」
result: pass

### 11. 滚动加载
expected: 记录较多时支持滚动加载更多
result: pass
fix: "body overflow:hidden 且 .history-page 非滚动容器导致无法滚动、window scroll 不触发；改为 .history-page 自身 overflow-y:auto 并监听其 scroll（测试期间 limit 临时调为 20，验证后恢复 50）"

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

note: "后端数据层另有 22 项自动化断言（ELECTRON_RUN_AS_NODE 直测 history-manager：写入/倒序/favicon/隔离/搜索/单删/批删/分页/清空/updateLastTitle/getCount/非法容器 ID 防护），HTTP 静态路由与 token 鉴权经 curl 验证"

## Gaps

- truth: "工具栏历史按钮打开 realm://history Tab，页面正常加载，样式正确，记录列表正常显示"
  status: passed
  reason: "2026-07-25 用户复测通过"
  severity: major
  test: 2
  root_cause: "(1) 相对路径 404：页面从 /history 加载，相对资源解析到根路径；(2) webview guest IPC 被 assertTrustedSender 拒绝。修复：base 标签 + /api/history/* HTTP API + token 鉴权"
  artifacts: [main.js, src/renderer.js, src/history.html, src/history-page.js]
  missing: []
  debug_session: ""
