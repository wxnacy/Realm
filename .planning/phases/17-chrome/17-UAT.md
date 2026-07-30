---
status: complete
phase: 17-chrome
source: 17-01-SUMMARY.md, 17-02-SUMMARY.md
started: 2026-07-30T05:01:59Z
updated: 2026-07-30T05:01:59Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 完全退出并重启应用后，无报错启动，主窗口正常出现，收藏夹页面正常打开并显示已有收藏数据
result: pass

### 2. 「导入书签」按钮显示
expected: 打开收藏夹页面（realm://favorites），搜索栏右侧显示「导入书签」按钮，布局正常不挤压搜索框
result: pass

### 3. Chrome JSON 自动导入流程
expected: 点击「导入书签」→ 选择 Chrome 导入。若检测到 Chrome 默认书签路径则直接开始导入；未检测到则弹出文件选择对话框让用户选择 Bookmarks JSON 文件
result: pass
note: "初次测试报 issue（点击无反应），根因为 webview 中无 realmAPI + Chrome 检测路径不全；修复后重测通过（2026-07-30）"

### 4. HTML 书签文件导入流程（预览确认）
expected: 点击「导入书签」→ 来源选择框选「选择书签文件」→ 选择 HTML 书签文件后显示预览确认框（书签数、文件夹数、顶级文件夹列表），确认后才执行导入
result: pass

### 5. 导入进度模态框
expected: 导入过程中显示模态进度框，包含进度条、已导入/总数、当前文件名；可通过取消按钮中止导入
result: pass
note: "进度上报链路已修复（stage 分阶段 + 异步让出事件循环）；用户网络下 favicon 服务响应快（0.19s），675 条整体秒级完成，进度条一闪而过属正常现象"

### 6. 导入结果摘要
expected: 导入完成后显示结果摘要（成功导入数、跳过重复数、创建文件夹数），关闭后收藏列表和文件夹树自动刷新，新导入的书签可见
result: pass

### 7. Chrome JSON 书签文件自动检测与解析
expected: Chrome JSON 书签文件自动检测与解析
result: pass
source: automated
coverage_id: 17-01-D1

### 8. Netscape HTML 书签文件解析
expected: Netscape HTML 书签文件解析
result: pass
source: automated
coverage_id: 17-01-D2

### 9. 批量导入数据库操作（事务 + 去重 + 进度报告）
expected: 批量导入数据库操作（事务 + 去重 + 进度报告）
result: pass
source: automated
coverage_id: 17-01-D3

### 10. IPC 通道注册与 preload API 暴露
expected: IPC 通道注册与 preload API 暴露
result: pass
source: automated
coverage_id: 17-01-D4

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

- truth: "点击「导入书签」按钮应触发 Chrome 导入流程（检测路径 → 直接导入或文件选择对话框）"
  status: fixed
  reason: "User reported: 点击导入按钮没有反应"
  severity: major
  test: 3
  root_cause: "favorites 页面运行在 webview 中，按 CR-4 安全架构（main.js:223-227）guest 无 window.realmAPI，数据一律走 /api/favorites/* HTTP 端点；17-02 导入前端误用 window.realmAPI.* IPC 调用（12 处），点击按钮时 TypeError: window.realmAPI is undefined，异常被 catch 后仅 toast 提示"
  artifacts:
    - path: "src/favorites-page.js"
      issue: "导入流程 12 处 window.realmAPI 调用在 webview 中不存在"
    - path: "main.js"
      issue: "缺少 /api/favorites/* 导入端点（detect/import/progress/abort）"
    - path: "favorites-manager.js"
      issue: "导入函数仅支持文件路径源，webview 中 File.path 不可用（Electron 32 移除）"
  missing:
    - "已修复：main.js 新增 5 个 HTTP 端点（detect-chrome-path/import-chrome/import-html/import-progress/import-abort）"
    - "已修复：favorites-page.js 全部改走 favoritesApi HTTP，文件选择改原生 input[type=file] 读内容上传，进度改 300ms 轮询"
    - "已修复：favorites-manager.js 导入函数支持 { content } 源；importHtmlBookmarks 新增 dryRun 预览模式（顺带修复确认后重复导入写库的旧缺陷）"
    - "已修复：detectChromeBookmarksPath 扩展候选路径扫描（Default/Profile N × Bookmarks/AccountBookmarks），覆盖登录 Google 账号后书签存于 AccountBookmarks 的场景（用户机器实测检出 675 书签/36 文件夹）"
    - "已修复：新增 findFolderByName，导入建文件夹时同名同父级复用既有 ID（修复重复导入产生重复文件夹树，Chrome/文件导入均生效）"
    - "已修复：进度上报断裂——favicon 抓取阶段（最耗时）逐项上报 0→90%；batchInsertBookmarks 改异步分批让出事件循环（原同步阻塞导致 HTTP 轮询无响应），批量插入阶段缩放至 90→100%；解析完成立即上报总数"
  debug_session: "main-session 2026-07-30"
