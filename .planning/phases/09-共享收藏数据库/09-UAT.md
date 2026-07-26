---
status: testing
phase: 09-共享收藏数据库
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md, 09-VERIFICATION.md]
started: 2026-07-25T16:20:26Z
updated: 2026-07-26T03:10:00Z
---

## Current Test

number: 10
name: 跨容器共享与重复收藏提示
expected: |
  在容器 A 收藏某 URL 后切换到容器 B，打开同一 URL → 星标显示实心已收藏；
  再次点击星标尝试收藏 → 出现「已收藏过该页面」提示而非重复写入；
  favorites 表中该 URL 仅一条记录。
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: 完全退出应用（如正在运行）。启动 `npm run dev`。应用正常启动无报错，数据库迁移自动完成（旧 favorites_* 表被删除，全局 favorites 表创建成功），主界面正常加载。
result: pass

### 2. favorites-manager.js 重构为全局单表，所有 CRUD 函数移除 containerId
expected: favorites-manager.js 重构为全局单表，所有 CRUD 函数移除 containerId
result: pass
source: automated
coverage_id: 09-01/D1

### 3. main.js API 端点移除 containerId 参数，注册 migrateToGlobal 调用
expected: main.js API 端点移除 containerId 参数，注册 migrateToGlobal 调用
result: pass
source: automated
coverage_id: 09-01/D2

### 4. migrateToGlobal() 启动时自动执行，删除旧表创建全局表
expected: migrateToGlobal() 启动时自动执行，删除旧表创建全局表
result: pass
source: automated
coverage_id: 09-01/D3

### 5. preload.js 8 个收藏 IPC 接口移除 containerId 参数
expected: preload.js 8 个收藏 IPC 接口移除 containerId 参数
result: pass
source: automated
coverage_id: 09-02/D1

### 6. renderer.js checkBookmarkStatus/saveBookmark/removeBookmark 移除容器依赖
expected: renderer.js checkBookmarkStatus/saveBookmark/removeBookmark 移除容器依赖
result: pass
source: automated
coverage_id: 09-02/D2

### 7. favorites-page.js 移除 state.containerId，所有 API 调用无 containerId
expected: favorites-page.js 移除 state.containerId，所有 API 调用无 containerId
result: pass
source: automated
coverage_id: 09-02/D3

### 8. 收藏夹按钮全局唯一 Tab：不再按 containerId 匹配已打开 Tab
expected: 收藏夹按钮全局唯一 Tab：不再按 containerId 匹配已打开 Tab
result: pass
source: automated
coverage_id: 09-02/D4

### 9. 收藏与状态回显（星标写入路径端到端 — 09-03 gap closure 后首次人工回归）
expected: |
  在任意容器打开一个未收藏页面，点击工具栏星标 → 出现「已收藏」toast，星标立即变为实心；
  刷新页面后星标仍保持实心（checkBookmarkStatus 读取全局 favorites 表）；
  DevTools Console 不出现「无效的参数」错误。
result: issue
reported: "正常地址收藏显示正常，realm://newtab 这类内置的可以收藏，列表也可以看到，但是页面刷新星标不是实心的"
severity: major
source: human
coverage_id: 09-03/H1

### 10. 跨容器共享与重复收藏提示
expected: |
  在容器 A 收藏某 URL 后切换到容器 B，打开同一 URL → 星标显示实心已收藏；
  再次点击星标尝试收藏 → 出现「已收藏过该页面」提示而非重复写入；
  favorites 表中该 URL 仅一条记录。
result: [pending]
source: human
coverage_id: 09-03/H2

### 11. 取消收藏与收藏管理页回归
expected: |
  点击实心星标取消收藏 → 星标变回空心，跨容器同步；
  打开 realm://favorites → 列表/编辑/搜索/删除均正常；
  整个过程 DevTools Console 无「无效的参数」错误。
result: [pending]
source: human
coverage_id: 09-03/H3

## Summary

total: 11
passed: 8
issues: 1
pending: 2
skipped: 0

## Gaps

- truth: "realm://newtab 等内置 URL 收藏后，页面刷新星标应保持实心（与外部 URL 行为一致）"
  status: failed
  reason: "User reported: 正常地址收藏显示正常，realm://newtab 这类内置的可以收藏，列表也可以看到，但是页面刷新星标不是实心的"
  severity: major
  test: 9
  artifacts: []
  missing: []
